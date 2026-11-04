// =====================================================================
// 抽選と状態 (パチンコ台の 中身。画面・物理には さわらない)
// ---------------------------------------------------------------------
// ST 転落型 + 時短 (2026-11-03 ユーザー指定):
//   通常時: ヘソ (特図1) で spec.hitRate。当たれば firstHit の 振り分けで ST か 時短 (jitanSpins 回)
//   時短:   確率は 通常時と 同じ。電サポで 右打ち。当たれば ST。jitanSpins 回 まわして 当たらなければ 通常時
//   ST:     回数の かぎりなし。1 回転ごとに 大当たり (st.hitRate)・転落 (st.fallRate)・はずれ を 抽選。
//           大当たり → ラウンドの あと また ST / 転落 → 通常時へ (おにおにが たおされる)
//   大当たりは spec.rounds ラウンド (1/319 は いつも 3R)。spec.payout が ある 台 (1/399) は 初当たり 20R・RASH 中は 振り分け、
//   上乗せタイム (spec.uwanose) が 成功すると ラウンドが ふえる (できごと uwanoseStart → iwakan → uwanose / uwanoseEnd)
//   チャージ (2026-11-04 ユーザー指定。spec.charge): 通常時の ヘソの 低確率の 当たり (result.kind 'charge')。300発 (2R) を 右打ちで。spec.charge.st (5%) で ST、のこりは 通常時へ (回転数・連チャンは そのまま)
//   ST は 2 つ (2026-11-04 ユーザー指定)。ST に 入る 大当たりの あいだに えらぶ (m.rashType。Machine.setRashType):
//     おにおにRASH ('onioni'。mode 'st'): 上の 転落型
//     柱の氷RASH ('hashira'。mode 'hst'): 前作と 同じ ST 型。spec.hashira.spins 回 (100 回) の あいだ spec.hashira.hitRate で 当たりを ねらう。
//       ぬけたら 通常時。継続率 (100 回の うちに 当たる 割合) は おにおにRASH と 同じに して ある
// 抽選の 結果は 玉が 入った ときに 決める (保留の 先読みに 使う)。ただし 決めた ときと 状態が かわった 保留 (ST で 入って 転落の あとに まわる など) は、
//   まわす ときに いまの 状態で 決めなおす (result.mode が ちがう とき)
// 保留は 特図2 (電チュー) を 先に 消化する。変動の 時間と 演出は Show.plan (js/show.js) が 決める。
//
// 使い方:
//   const m = Machine.create(config, 's319', rng)
//   Machine.enter(m, 'heso' | 'denchu' | 'attacker' | 'gate')
//   Machine.update(m, dt)
//   m.parts.denchu / m.parts.attacker   いま 開いているか (盤面に 反映する)
//   m.events                            起きた こと (液晶・音。読んだら 空に する)
// =====================================================================

const Machine = (() => {
    function weightedPick(list, rng) {
        const total = list.reduce((a, x) => a + x.weight, 0);
        let r = rng() * total;
        for (const x of list) if ((r -= x.weight) < 0) return x;
        return list[list.length - 1];
    }

    function create(config, specId, rng = Math.random) {
        return {
            config, specId, spec: config.specs[specId], rng,
            time: 0,
            mode: 'normal',          // 'normal' 通常時 / 'jitan' 時短 / 'st' おにおにRASH / 'hst' 柱の氷RASH
            rashType: 'onioni',      // つぎの ST を どちらの RASH に するか ('onioni' / 'hashira')
            stLeft: 0,               // 柱の氷RASH の 残り回数
            jitanLeft: 0,            // 時短の 残り回数
            stSpins: 0,              // ST に 入ってからの 回転数
            chain: 0,                // 連チャン数 (初当たりを 1 とする。通常時に もどったら 0)
            chainBalls: 0,           // 連チャン中に 出た 玉 (表示用。main が 足す)
            holds: { 1: [], 2: [] },
            spin: null,              // 変動中 { fig, result, plan, duration, elapsed }
            bonus: null,             // 大当たり中 { rounds, round, count, phase, timer, next, kind }
            futsu: { holds: 0, spin: 0, opening: null, result: false },
            parts: { denchu: false, attacker: false },
            story: 0,                // 通常時の ストーリーの すすみ (演出。Show.stepStory)
            normalSpins: 0,          // 通常時の 回転数 (当たりで 0)
            stats: { spins1: 0, spins2: 0, firstHits: 0, charges: 0, chargeSt: 0, stEntries: 0, jitanEntries: 0, jitanHits: 0, stHits: 0, falls: 0, hstEntries: 0, hstHits: 0, hstEnds: 0, bonusRounds: 0, bestChain: 0 },
            events: []
        };
    }

    const emit = (m, type, data = {}) => m.events.push({ type, time: m.time, ...data });
    // 電サポ中か (ST・時短。時短の 最後の 1 回は その 変動が 止まるまで)
    const support = m => m.mode === 'st' || m.mode === 'hst' || m.mode === 'jitan' || Boolean(m.spin && (m.spin.jitan || m.spin.hstLast));
    const lotteryMode = m => (m.mode === 'st' || m.mode === 'hst' ? m.mode : 'normal');

    // ----- 抽選 -----
    function draw(m, fig) {
        const lm = lotteryMode(m);
        const r = m.rng();
        if (lm === 'st') {
            const st = m.spec.st;
            if (r < st.hitRate) return { kind: 'hit', mode: lm, next: 'st' };
            if (r < st.hitRate + st.fallRate) return { kind: 'fall', mode: lm };
            return { kind: 'miss', mode: lm };
        }
        if (lm === 'hst') return r < m.spec.hashira.hitRate ? { kind: 'hit', mode: lm, next: 'st' } : { kind: 'miss', mode: lm };
        if (r < m.spec.hitRate) {
            // 時短中・電チュー (特図2) の 当たりは ST。通常時の ヘソは 振り分け
            const next = m.mode === 'normal' && fig === 1 ? weightedPick(m.spec.firstHit, m.rng).next : 'st';
            return { kind: 'hit', mode: lm, next };
        }
        const c = m.spec.charge;
        if (c && m.mode === 'normal' && fig === 1 && r < m.spec.hitRate + c.rate) return { kind: 'charge', mode: lm, next: m.rng() < c.st ? 'st' : 'normal' };
        return { kind: 'miss', mode: lm };
    }

    function addShow(m, fig, result) {
        if (typeof Show !== 'undefined') Object.assign(result, Show.hold(m.config, m, fig, result, m.rng));
    }

    // ----- 玉が 入った -----
    function enter(m, id) {
        if (id === 'heso' || id === 'denchu') {
            const fig = id === 'heso' ? 1 : 2;
            if (fig === 2 && m.futsu.opening) m.futsu.opening.count++;
            if (m.holds[fig].length >= m.config.machine.holdMax) return;   // 保留が いっぱい (賞球だけ)
            const result = draw(m, fig);
            addShow(m, fig, result);
            m.holds[fig].push(result);
            emit(m, 'hold', { fig, result, count: m.holds[fig].length });
        } else if (id === 'attacker') {
            if (m.bonus && m.bonus.phase === 'open') {
                m.bonus.count++;
                emit(m, 'count', { count: m.bonus.count });
            }
        } else if (id === 'gate') {
            if (m.futsu.holds < m.config.machine.futsu.holdMax) m.futsu.holds++;
        }
    }

    // ----- 時間を すすめる -----
    function update(m, dt) {
        m.time += dt;
        updateFutsu(m, dt);
        if (m.bonus) updateBonus(m, dt);
        else updateSpin(m, dt);
        m.parts.attacker = Boolean(m.bonus && m.bonus.phase === 'open');
        m.parts.denchu = Boolean(m.futsu.opening && m.futsu.opening.open);
    }

    function updateSpin(m, dt) {
        if (!m.spin) {
            const fig = m.holds[2].length ? 2 : m.holds[1].length ? 1 : 0;
            if (!fig) return;
            let result = m.holds[fig].shift();
            if (result.mode !== lotteryMode(m) || (result.kind === 'charge' && m.mode !== 'normal')) {
                // 状態が かわった (ST の 保留が 転落の あとに まわる・チャージの 保留が 時短で まわる など): いまの 状態で 決めなおす
                const again = draw(m, fig);
                addShow(m, fig, again);
                result = again;
            }
            const jitan = m.mode === 'jitan';
            if (jitan) m.jitanLeft--;
            if (m.mode === 'st') m.stSpins++;
            const hst = m.mode === 'hst';
            if (hst) { m.stSpins++; m.stLeft--; }
            const plan = typeof Show !== 'undefined'
                ? Show.plan(m.config, m, { fig, result, holdsLeft: m.holds[fig].length, jitanLeft: m.jitanLeft, lastJitan: jitan && m.jitanLeft <= 0 }, m.rng)
                : { duration: 1, kind: 'plain' };
            if (m.mode === 'normal') {
                m.normalSpins++;
                if (typeof Show !== 'undefined' && fig === 1) {
                    const story = Show.stepStory(m.config, m, result, m.rng);
                    if (story !== null) { m.story = story; plan.story = story; }
                }
            }
            if (jitan && m.jitanLeft <= 0) m.mode = 'jitanLast';   // 最後の 1 回 (止まるまで 電サポ)
            m.spin = { fig, result, plan, duration: plan.duration, elapsed: 0, jitan, hstLast: hst && m.stLeft <= 0 };
            m.stats[fig === 1 ? 'spins1' : 'spins2']++;
            emit(m, 'spinStart', { fig, result, plan, duration: plan.duration, mode: m.mode, jitanLeft: m.jitanLeft, stSpins: m.stSpins, stLeft: m.stLeft });
            if (plan.story !== undefined) emit(m, 'storyChange', { story: plan.story });
            return;
        }
        m.spin.elapsed += dt;
        if (m.spin.elapsed < m.spin.duration) return;
        const { fig, result, plan, hstLast } = m.spin;
        m.spin = null;
        emit(m, 'spinEnd', { fig, result, plan });
        if (result.kind === 'hit') startBonus(m, result, fig);
        else if (result.kind === 'charge') startCharge(m, result, fig);
        else if (result.kind === 'fall') fall(m);
        else if (hstLast && m.mode === 'hst') {
            // 柱の氷RASH の 100 回を ぬけた
            m.stats.hstEnds++;
            m.mode = 'normal';
            emit(m, 'stEnd', { chain: m.chain, spins: m.stSpins, rash: 'hashira' });
            endChain(m);
        }
        else if (m.mode === 'jitanLast') {
            m.mode = 'normal';
            emit(m, 'jitanEnd', { chain: m.chain });
            endChain(m);
        }
    }

    // 転落: おにおにが たおされて 通常時へ
    function fall(m) {
        m.stats.falls++;
        m.mode = 'normal';
        emit(m, 'stEnd', { chain: m.chain, spins: m.stSpins, rash: 'onioni' });
        endChain(m);
    }

    function endChain(m) {
        emit(m, 'chainEnd', { chain: m.chain, balls: m.chainBalls });
        m.chain = 0;
        m.chainBalls = 0;
        m.stSpins = 0;
    }

    // ----- 大当たり -----
    function startBonus(m, result, fig) {
        const cfg = m.config.machine.bonus;
        const from = m.mode === 'jitanLast' ? 'jitan' : m.mode;
        if (from !== 'normal') result.next = 'st';   // 時短・ST の 当たりは いつも ST
        if (from === 'normal') { m.stats.firstHits++; m.chain = 1; m.normalSpins = 0; }
        else {
            m.chain++;
            if (from === 'st') m.stats.stHits++;
            else if (from === 'hst') m.stats.hstHits++;
            else m.stats.jitanHits++;
        }
        m.stats.bestChain = Math.max(m.stats.bestChain, m.chain);
        m.mode = 'bonus';
        m.jitanLeft = 0;
        let rounds = m.spec.rounds, payKind = null, uwanose = null;
        const pay = m.spec.payout;
        if (pay && from === 'normal') { rounds = result.next === 'st' ? pay.first : pay.firstJitan; payKind = 'first'; }
        else if (pay) {
            const k = (result.forcePay && pay.rash.find(x => x.id === result.forcePay)) || weightedPick(pay.rash, m.rng);
            rounds = k.rounds;
            payKind = k.id;
            if (k.uwanose) {
                const u = m.spec.uwanose, rnd = (a, b) => a + (b - a) * m.rng();
                uwanose = {
                    round: u.rounds[0] + Math.floor(m.rng() * (u.rounds[1] - u.rounds[0] + 1)),
                    success: result.forceUwanose !== undefined ? result.forceUwanose : m.rng() < u.success,
                    iwakanAt: rnd(u.iwakan[0], u.iwakan[1]), phase: 'wait', t: 0, iwakan: false
                };
            }
        }
        m.bonus = { rounds, round: 0, count: 0, phase: 'opening', timer: cfg.opening, next: result.next, from, fig, payKind, uwanose };
        m.stats.bonusRounds += rounds;
        emit(m, 'bonusStart', { rounds, next: result.next, from, chain: m.chain, fig, plan: result.plan || null, payKind });
    }

    // チャージ: 初当たりには 数えない。ST へ 行くときは ending で 連チャンを はじめる
    function startCharge(m, result, fig) {
        const cfg = m.config.machine.bonus, rounds = m.spec.charge.rounds;
        m.stats.charges++;
        m.mode = 'bonus';
        m.bonus = { rounds, round: 0, count: 0, phase: 'opening', timer: cfg.chargeOpening, next: result.next, from: 'normal', fig, payKind: null, uwanose: null, charge: true };
        m.stats.bonusRounds += rounds;
        emit(m, 'bonusStart', { rounds, next: result.next, from: 'normal', chain: m.chain, fig, plan: null, payKind: null, charge: true });
    }

    // 上乗せタイム (window 秒)。成功なら iwakanAt 秒に 違和感 → reveal 秒 あとに ラウンドが ふえる
    function updateUwanose(m, dt) {
        const b = m.bonus, u = b.uwanose, cfg = m.spec.uwanose;
        if (!u || u.phase !== 'time') return;
        u.t += dt;
        if (u.success && !u.iwakan && u.t >= u.iwakanAt) {
            u.iwakan = true;
            emit(m, 'iwakan', {});
        }
        if (u.success && u.iwakan && u.t >= u.iwakanAt + cfg.reveal) {
            u.phase = 'done';
            b.rounds += cfg.addRounds;
            m.stats.bonusRounds += cfg.addRounds;
            m.stats.uwanose = (m.stats.uwanose || 0) + 1;
            emit(m, 'uwanose', { add: cfg.addRounds, rounds: b.rounds });
        } else if (!u.success && u.t >= cfg.window) {
            u.phase = 'done';
            emit(m, 'uwanoseEnd', { success: false });
        }
    }

    function updateBonus(m, dt) {
        const cfg = m.config.machine.bonus;
        const b = m.bonus;
        b.timer -= dt;
        updateUwanose(m, dt);
        if (b.phase === 'open') {
            if (b.count < cfg.count && b.timer > 0) return;
            emit(m, 'roundEnd', { round: b.round, count: b.count });
            if (b.round >= b.rounds && !(b.uwanose && b.uwanose.phase === 'time')) {
                b.phase = 'ending';
                b.timer = b.charge && b.next !== 'st' ? cfg.chargeEnding : cfg.ending;
                if (b.charge && b.next === 'st') {
                    m.stats.chargeSt++;
                    m.chain = 1;
                    m.normalSpins = 0;
                    m.stats.bestChain = Math.max(m.stats.bestChain, 1);
                }
                emit(m, 'ending', { next: b.next, chain: m.chain, from: b.from, charge: Boolean(b.charge) });
            } else {
                b.phase = 'interval';
                b.timer = cfg.interval;
            }
            return;
        }
        if (b.timer > 0) return;
        if (b.phase === 'opening' || b.phase === 'interval') {
            b.round++;
            b.count = 0;
            b.phase = 'open';
            b.timer = cfg.maxTime;
            emit(m, 'roundStart', { round: b.round, rounds: b.rounds });
            if (b.uwanose && b.uwanose.phase === 'wait' && b.round >= b.uwanose.round) {
                b.uwanose.phase = 'time';
                emit(m, 'uwanoseStart', { window: m.spec.uwanose.window });
            }
        } else if (b.phase === 'ending') {
            m.bonus = null;
            if (b.next === 'st') {
                const inRash = b.from === 'st' || b.from === 'hst';
                if (!inRash) m.stats.stEntries++;
                m.stSpins = 0;
                if (m.rashType === 'hashira') {
                    if (b.from !== 'hst') m.stats.hstEntries++;
                    m.mode = 'hst';
                    m.stLeft = m.spec.hashira.spins;
                } else m.mode = 'st';
                emit(m, 'stStart', { chain: m.chain, entry: !inRash, rash: m.rashType, spins: m.stLeft });
            } else if (b.next === 'normal') {
                m.mode = 'normal';   // チャージの おわり
                emit(m, 'chargeEnd', {});
            } else {
                m.stats.jitanEntries++;
                m.mode = 'jitan';
                m.jitanLeft = m.spec.jitanSpins;
                emit(m, 'jitanStart', { spins: m.jitanLeft, chain: m.chain });
            }
            emit(m, 'bonusEnd', { next: b.next });
        }
    }

    // ----- 普図 (ゲート → 電チュー) -----
    function updateFutsu(m, dt) {
        const f = m.futsu;
        const cfg = m.config.machine.futsu;
        const mode = support(m) || m.mode === 'jitanLast' ? cfg.support : cfg.normal;
        if (f.opening) {
            const o = f.opening;
            o.timer -= dt;
            if (o.count >= cfg.denchuCount) f.opening = null;
            else if (o.timer <= 0) {
                if (o.open) {
                    o.open = false;
                    o.left--;
                    o.timer = o.gap;
                    if (o.left <= 0) f.opening = null;
                } else {
                    o.open = true;
                    o.timer = o.openTime;
                }
            }
            return;
        }
        if (f.spin > 0) {
            f.spin -= dt;
            if (f.spin > 0) return;
            f.spin = 0;
            if (f.result) {
                f.opening = { open: true, timer: mode.open, openTime: mode.open, gap: mode.gap, left: mode.opens, count: 0 };
                emit(m, 'futsuHit');
            }
            return;
        }
        if (f.holds > 0 && !m.bonus) {
            f.holds--;
            f.result = m.rng() < mode.rate;
            f.spin = mode.spin;
        }
    }

    // つぎの ST の RASH を えらぶ ('onioni' / 'hashira')。大当たり中 (ST へ 行く とき) に 画面の ボタンで
    function setRashType(m, type) {
        if (type === 'onioni' || type === 'hashira') m.rashType = type;
    }

    // 盤面で どちらを 狙うか。大当たり・ST・時短・残り保留 (特図2) の あいだは 右打ち
    function aim(m) {
        if (m.bonus || m.mode !== 'normal' || m.holds[2].length || (m.spin && m.spin.fig === 2)) return 'right';
        return 'left';
    }

    // ----- 前回の 続き -----
    function snapshot(m) {
        const { config, spec, rng, events, ...rest } = m;
        return JSON.parse(JSON.stringify(rest));
    }
    function restore(config, data, rng = Math.random) {
        const m = create(config, data.specId, rng);
        Object.assign(m, data, { config, spec: config.specs[data.specId], rng, events: [] });
        return m;
    }

    // ----- デバッグ用 -----
    // 保留を 1 つ 先頭に 足す。kind: 'hit' / 'fall' / 'miss' / 'reach' (リーチはずれ) / 'charge'。next: 'st' / 'jitan'。options.enemy: ST の 相手
    // options.reach: リーチの 種類 / mini + miniWin: ミニゲームと 成否 / textColor: 敵の カットインの 文字の 色 / gizi: 疑似連の 回数
    function debugHold(m, kind, options = {}) {
        const fig = m.mode === 'normal' ? 1 : 2;
        const result = { kind: kind === 'reach' ? 'miss' : kind, mode: lotteryMode(m) };
        if (kind === 'hit') result.next = m.mode === 'normal' ? (options.next || 'st') : 'st';
        if (kind === 'reach') result.force = 'reach';
        if (kind === 'charge') result.next = options.next === 'st' ? 'st' : 'normal';
        if (options.enemy) result.forceEnemy = options.enemy;
        if (options.yaku) result.forceYaku = true;
        if (options.reach) result.forceReach = options.reach;
        if (options.battle) result.forceBattle = true;
        if (options.ally) result.forceAlly = options.ally;
        if (options.shuketsu !== undefined) result.forceShuketsu = options.shuketsu;
        if (options.attack) result.forceAttack = options.attack;
        if (options.gun !== undefined) result.forceGun = options.gun;
        if (options.mini) { result.forceMini = options.mini; result.forceMiniWin = options.miniWin !== false; }
        if (options.textColor) result.forceText = options.textColor;
        if (options.gizi !== undefined) result.forceGizi = options.gizi;
        addShow(m, fig, result);
        if (options.holdColor) result.holdColor = result.shownColor = options.holdColor;
        if (options.senbare) result.senbare = options.senbare;
        if (options.pay) result.forcePay = options.pay;
        if (options.uwanose !== undefined) result.forceUwanose = options.uwanose;
        m.holds[fig].unshift(result);
        if (m.holds[fig].length > m.config.machine.holdMax) m.holds[fig].pop();
        emit(m, 'hold', { fig, result, count: m.holds[fig].length });
    }
    // いきなり ST / 時短に 入る
    function debugMode(m, mode) {
        if (m.bonus) return;
        if (m.chain === 0) m.chain = 1;
        if (mode === 'st') { m.mode = 'st'; m.rashType = 'onioni'; m.stSpins = 0; emit(m, 'stStart', { chain: m.chain, entry: true, rash: 'onioni' }); }
        else if (mode === 'hst') { m.mode = 'hst'; m.rashType = 'hashira'; m.stSpins = 0; m.stLeft = m.spec.hashira.spins; emit(m, 'stStart', { chain: m.chain, entry: true, rash: 'hashira', spins: m.stLeft }); }
        else { m.mode = 'jitan'; m.jitanLeft = m.spec.jitanSpins; emit(m, 'jitanStart', { spins: m.jitanLeft, chain: m.chain }); }
    }

    return { create, enter, update, aim, support, setRashType, snapshot, restore, debugHold, debugMode, weightedPick };
})();
if (typeof module !== 'undefined') module.exports = { Machine };
