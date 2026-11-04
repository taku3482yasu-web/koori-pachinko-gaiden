// =====================================================================
// ゲームの 進行
// ---------------------------------------------------------------------
// はじめに 台を えらぶ (1/319 ライト・1/399 ミドル)。1/60 秒ごとに 物理 → 入賞を 台 (Machine) に つたえる → 台の 時間を すすめる →
// 電チュー・アタッカーの 開け閉めを 盤面に → 液晶・筐体・音。
// 操作: 発射 (タップで 発射 / 停止・Space)・強さ (ゲージ・← →)・左打ち / 右打ち・台の ボタン PUSH (B)・金棒レバー (L・右横を 左へ 引く)
// URL (確認用): ?spec=s319 (台えらびを とばす) &auto=1 (自動で 打つ。台に 合わせて 左右も) &skip=30 (はじめに 30 秒 早送り)
//   &force=charge|chargeSt (チャージ) &reach=hashiraAll (リーチの 種類) &mini=goldDog &miniWin=0 (ミニゲームと 成否) &text=gold (敵の 文字の 色) &gizi=2 (疑似連)
//   &pay=full|base|uwanose &uwanose=1|0 (1/399 の RASH の 出玉・上乗せの 成否) &setting=6 (設定。はぶくと 設定4) &senbare=voice|roar (柱の氷RASH の 先バレ) &balls=9999 &force=hit|st|jitan|reach|fall (はじめの 保留) &enemy=kanezu (ST の 相手) &debug=1 (デバッグの ボタン)
// =====================================================================

(() => {
    const params = new URLSearchParams(location.search);
    const $ = id => document.getElementById(id);
    const canvas = $('board');
    const store = {
        get(k, d) { try { const v = localStorage.getItem('koori-gaiden-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem('koori-gaiden-' + k, JSON.stringify(v)); } catch (e) { /* 保存できない */ } }
    };

    const game = {
        balls: Number(params.get('balls')) || CONFIG.balls.start,
        strength: store.get('strength', CONFIG.launch.defaultStrength),
        fireOn: false, holding: false,
        auto: params.get('auto') === '1',
        nextShot: 0,
        machine: null, board: null, world: null, view: null,
        lastAim: 'left', zoom: 0, paused: true,
        stats: { launched: 0, launchedLeft: 0, heso: 0, paid: 0 },
        record: store.get('record', { plays: 0, firstHits: 0, bestChain: 0, bestBalls: 0 }),
        chainStartBalls: 0
    };
    if (params.has('strength')) game.strength = Number(params.get('strength'));
    Lcd.init();

    // ----- 台を 用意する -----
    // setting: 設定 1〜6 (釘が かわる) / settingKnown: 自分で えらんだか (おまかせの ときは 画面に 出さない)
    function startMachine(specId, setting, settingKnown) {
        const spec = CONFIG.specs[specId];
        game.specId = specId;
        game.setting = setting;
        game.settingKnown = settingKnown;
        game.hints = [];
        game.machine = Machine.create(CONFIG, specId);
        Machine.setRashType(game.machine, store.get('rash', 'onioni'));
        game.board = Board.build(CONFIG, spec.settings[setting - 1]);
        game.world = { board: game.board, balls: [], rng: Math.random, events: [] };
        game.view = BoardView.create(canvas, game.board, CONFIG);
        Cabinet.init($('cabinet-art'), BoardView.outline(game.board));
        Cabinet.place(canvas, Cabinet.CAB.board);
        $('spec-display').textContent = `${spec.label} ${spec.name}${settingKnown ? ` / 設定${setting}` : ''}`;
        document.querySelectorAll('.lt-badge').forEach(b => { b.hidden = !spec.lt; });
        game.paused = false;
        game.record.plays++;
        store.set('record', game.record);
        const force = params.get('force');
        const opt = {
            next: force === 'hitJitan' ? 'jitan' : 'st', enemy: params.get('enemy'), yaku: params.get('yaku') === '1',
            reach: params.get('reach') || undefined, gun: params.has('gun') ? params.get('gun') === '1' : undefined,
            battle: params.get('battle') === '1', ally: params.get('ally') || undefined, attack: params.get('attack') || undefined,
            shuketsu: params.has('shuketsu') ? params.get('shuketsu') === '1' : undefined, senbare: params.get('senbare') || undefined,
            pay: params.get('pay') || undefined, uwanose: params.has('uwanose') ? params.get('uwanose') === '1' : undefined,
            mini: params.get('mini') || undefined, miniWin: params.get('miniWin') !== '0', textColor: params.get('text') || undefined,
            gizi: params.has('gizi') ? Number(params.get('gizi')) : undefined
        };
        if (force === 'st' || force === 'jitan' || force === 'hst') Machine.debugMode(game.machine, force);
        else if (force === 'stHit' || force === 'fall') { Machine.debugMode(game.machine, 'st'); Machine.debugHold(game.machine, force === 'fall' ? 'fall' : 'hit', opt); }
        else if (force === 'hstHit' || force === 'hstMiss') { Machine.debugMode(game.machine, 'hst'); Machine.debugHold(game.machine, force === 'hstHit' ? 'hit' : 'miss', opt); }
        else if (force === 'reach') Machine.debugHold(game.machine, 'reach', opt);
        else if (force === 'charge' || force === 'chargeSt') Machine.debugHold(game.machine, 'charge', { next: force === 'chargeSt' ? 'st' : 'normal' });
        else if (force) Machine.debugHold(game.machine, 'hit', opt);
    }

    // ----- 1 フレーム -----
    let time = 0;
    function tick(dt) {
        time += dt;
        const m = game.machine;
        const aim = Machine.aim(m);
        if (game.auto) game.strength = CONFIG.launch.presets[aim];
        if ((game.fireOn || game.holding || game.auto) && time >= game.nextShot && game.balls > 0 && game.world.balls.length < CONFIG.ball.maxBalls) {
            Physics.launch(game.world, game.strength, CONFIG);
            game.balls--;
            game.stats.launched++;
            if (aim === 'left') game.stats.launchedLeft++;
            game.nextShot = time + CONFIG.launch.interval;
        }
        Physics.step(game.world, dt, CONFIG);
        game.world.events.splice(0).forEach(ballEvent);
        Machine.update(m, dt);
        Board.setOpen(game.board, 'denchu', m.parts.denchu);
        Board.setOpen(game.board, 'attacker', m.parts.attacker);
        m.events.splice(0).forEach(machineEvent);
        Lcd.tick(dt);
        if (aim !== game.lastAim) {
            game.lastAim = aim;
            if (store.get('autoAim', true)) setStrength(CONFIG.launch.presets[aim]);
            if (aim === 'right') Lcd.banner('右打ち →', null, '#ff6a8a', 1.6);
            else Lcd.banner('左打ちに もどしてね', null, '#bfe8ff', 1.6);
        }
    }

    function ballEvent(e) {
        if (e.type === 'foul') game.balls++;
        else if (e.type === 'pocket') {
            const pay = CONFIG.payout[e.payout] || 0;
            game.balls += pay;
            game.stats.paid += pay;
            if (game.machine.chain > 0) game.machine.chainBalls += e.id === 'attacker' ? pay : 0;
            if (e.id === 'heso') game.stats.heso++;
            if (e.id === 'heso' || e.id === 'denchu' || e.id === 'attacker') Machine.enter(game.machine, e.id);
            if (e.id === 'attacker') Sound.play('payout');
        } else if (e.type === 'gate') Machine.enter(game.machine, 'gate');
    }

    // 台の できごと → 液晶・音・記録
    let lastAction = null;
    function machineEvent(e) {
        const m = game.machine;
        Lcd.handle(e, m);
        if (e.type === 'hold') {
            if (e.result.senbare && m.mode === 'hst') senbare(e.result.senbare);
            else Sound.play('hold');
        }
        else if (e.type === 'spinStart') { Sound.play('stop'); schedule(e.plan, e.duration); }
        else if (e.type === 'spinEnd') { if (e.result.kind === 'hit') Sound.play('win'); }
        else if (e.type === 'bonusStart') {
            Sound.play(e.charge ? 'chance' : 'fanfare');
            if (e.next === 'st' && !e.charge) openRashChoice();
            if (e.from === 'normal' && !e.charge) { game.record.firstHits++; game.chainStartBalls = game.balls; }
        } else if (e.type === 'ending') {
            // チャージから ST: ここで はじめて 知らせる
            if (e.charge && e.next === 'st') { Sound.play('fanfare'); openRashChoice(); }
        } else if (e.type === 'roundStart') Sound.play('round');
        else if (e.type === 'uwanoseStart') Sound.play('chance');
        else if (e.type === 'iwakan') { Sound.play('iwakan'); Sound.hush(900); }
        else if (e.type === 'uwanose') { Sound.play('gekiha'); Sound.play('fanfare'); }
        else if (e.type === 'uwanoseEnd') Sound.play('lose');
        else if (e.type === 'bonusEnd') closeRashChoice();
        else if (e.type === 'stStart' && e.entry) Sound.play('stIn');
        else if (e.type === 'stEnd') { Sound.play('fall'); settingHint(); }
        else if (e.type === 'jitanEnd') settingHint();
        else if (e.type === 'chainEnd') {
            game.record.bestChain = Math.max(game.record.bestChain, e.chain);
            game.record.bestBalls = Math.max(game.record.bestBalls, e.balls);
            store.set('record', game.record);
            game.stats.launchedLeft = 0;
            game.stats.heso = 0;
        }
    }

    // 変動の なかの 音 (時間で 鳴らす)
    let cues = [];
    function schedule(plan, D) {
        cues = [];
        const at = (t, name) => cues.push({ t: time + t, name });
        if (plan.kind === 'normal') {
            const g = plan.lead || 0, t = plan.t || {};
            for (let i = 0; i < (plan.gizi || 0); i++) at(t.gizi + i * SHOW.time.next, 'reach');
            if (plan.gun) at(t.gun, 'gun');
            if (plan.mini) {
                at(t.mini, 'challenge');
                at(t.mini + SHOW.time.mini - 1.4, plan.mini.win ? 'success' : 'fail');
            }
            if (plan.reach) at(1.7 + g, 'reach');
            if (plan.reach === 'hashiraAll') {
                const sceneStart = 1.7 + g + 0.9, len = D - 0.7 - sceneStart;
                at(sceneStart + 5.8, 'roar');
                at(sceneStart + 7.6, 'cutin');
                for (let k = 9.6; k < len - 8; k += 0.5) at(sceneStart + k, 'clash');
                at(sceneStart + len - 8, 'smash');
                at(sceneStart + len - 1.6, plan.hit ? 'gekiha' : 'lose');
            } else if (plan.reach && plan.reach !== 'normal' && plan.reach !== 'zenkaiten') {
                const sceneStart = 1.7 + g + 0.9, len = D - 0.7 - sceneStart, body = len - 2;
                if (plan.textColor) at(sceneStart, plan.textColor === 'white' ? 'cutin' : 'chance');
                if (plan.cutin) at(sceneStart + 2 + body * 0.35, 'cutin');
                if (plan.chance) at(sceneStart + 2 + body * 0.6, 'chance');
                if (plan.enemy && plan.enemy !== 'rival') for (let k = 3; k < len - 3; k += 0.7) at(sceneStart + k, 'clash');
                at(sceneStart + len - 1.6, plan.hit ? 'gekiha' : 'lose');
            }
        } else if (plan.kind === 'battle') {
            at(1.0, 'cutin');
            for (let k = 3.4; k < D - 5.4; k += 0.6) at(k, 'clash');
            if (plan.chance) at(4.6, 'chance');
            at(D - 3.0, plan.hit ? 'gekiha' : 'fall');
        } else if (plan.kind === 'jitan' && plan.reach) at(1.1, 'reach');
        else if (plan.kind === 'hashira') {
            if (plan.sub === 'ippatsu') at(0.3, 'ippatsu');
            else if (plan.sub === 'quick' && plan.hit) at(D - 0.2, 'win');
            else if (plan.sub === 'battle') {
                const x = plan.shuketsu ? 1.5 : 0;
                at(0.8, 'cutin');
                if (plan.shuketsu) { [0.8, 1.3, 1.8].forEach(t => at(t, 'clash')); at(2.2, 'vibratePush'); }
                if (plan.ally !== 'rival' || plan.shuketsu) at(2.0, 'chance');
                at(2.8 + x + 1.4, plan.attack === 'ichigeki' ? 'smash' : 'chance');
                at(D - 3.0, plan.hit ? 'gekiha' : 'lose');
            }
        }
    }
    function playCues() {
        while (cues.length && cues[0].t <= time) {
            const name = cues.shift().name;
            if (name === 'vibratePush') vibrate('push');
            else Sound.play(name);
        }
    }

    // 設定示唆: RASH・時短が 終わった とき、ときどき 液晶の 左下に トロフィー (色で「設定○以上」)
    function settingHint() {
        const h = CONFIG.settingHint;
        if (Math.random() >= h.rate) return;
        const w = h.weights[game.setting];
        let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
        let level = 1;
        for (const [k, v] of Object.entries(w)) if ((r -= v) < 0) { level = Number(k); break; }
        game.hints.push(level);
        Lcd.trophy(level);
    }

    // 先バレ (2026-11-04 ユーザー指定): voice = 前作の 先バレ音を 低く した もの / roar = おにおにの 先咆哮。どちらも ボタンが 赤く 光る
    function senbare(kind) {
        Sound.play(kind === 'roar' ? 'senbareRoar' : 'senbareVoice');
        flashClass($('push'), 'red', kind === 'roar' ? 2200 : 1400);
    }
    // ボタン・レバーが 震える (2026-11-04 ユーザー指定: 動画を 参考に): モーターの ような 速い ぶるぶる (CSS の vibrate) と ヴヴヴヴ… (Sound の buzz)。
    // スマホは 本体も ふるわせる
    function vibrate(which) {
        flashClass($(which), 'vibrate', 1300);
        Sound.play('buzz');
        try { if (navigator.vibrate) navigator.vibrate([280, 40, 280, 40, 560]); } catch (e) { /* ふるえない 端末 */ }
    }
    const flashTimers = new Map();
    function flashClass(el, cls, ms) {
        const key = el.id + cls;
        clearTimeout(flashTimers.get(key));
        el.classList.add(cls);
        flashTimers.set(key, setTimeout(() => el.classList.remove(cls), ms));
    }

    // RASH えらび (2026-11-04 ユーザー指定: ST を おにおにRASH と 柱の氷RASH に 分ける)。ST へ 行く 大当たりの あいだに えらぶ。1 / 2 キーでも
    function openRashChoice() {
        $('rash-choice').hidden = false;
        markRash();
    }
    function closeRashChoice() { $('rash-choice').hidden = true; }
    function markRash() {
        document.querySelectorAll('[data-rash]').forEach(b => b.classList.toggle('selected', b.dataset.rash === game.machine.rashType));
    }
    function chooseRash(type) {
        if (!game.machine || $('rash-choice').hidden) return;
        Machine.setRashType(game.machine, type);
        store.set('rash', type);
        markRash();
        Sound.play('push');
    }
    document.querySelectorAll('[data-rash]').forEach(b => b.addEventListener('click', () => chooseRash(b.dataset.rash)));

    // PUSH / 金棒レバー
    function push() {
        Sound.unlock();
        if (Lcd.prompt() === 'mash') { if (Lcd.input('push')) Sound.play('clash'); }
        else if (Lcd.input('push')) { Sound.play('push'); Sound.play('chance'); }
        else Sound.play('push');
        $('push').classList.add('down');
        setTimeout(() => $('push').classList.remove('down'), 120);
    }
    function lever() {
        Sound.unlock();
        if (Lcd.input('lever')) { Sound.play('pull'); Sound.play('smash'); }
        else Sound.play('leverTick');
    }

    // ----- 表示 -----
    let lastPrompt = null;
    function updateStatus() {
        const m = game.machine;
        $('balls').textContent = game.balls;
        $('spins').textContent = m.normalSpins;
        const shot = game.stats.launchedLeft;
        $('rate').textContent = shot > 50 ? (game.stats.heso / shot * 250).toFixed(1) : '-';
        $('chain').textContent = m.chain > 0 ? `${m.chain}連` : '-';
        let mode = '通常時';
        if (m.bonus) mode = `${m.bonus.charge ? 'チャージ' : '大当たり'} ${m.bonus.round}/${m.bonus.rounds}R`;
        else if (m.mode === 'st') mode = `おにおにRASH${m.spec.lt ? ' LT' : ''} ${m.chain}連中`;
        else if (m.mode === 'hst') mode = `柱の氷RASH${m.spec.lt ? ' LT' : ''} ${m.chain}連中 のこり ${m.stLeft} 回`;
        else if (m.mode === 'jitan' || m.mode === 'jitanLast') mode = `時短 のこり ${m.jitanLeft} 回`;
        $('mode-display').textContent = mode;
        $('mode-display').className = 'mode-display mode-' + (m.bonus ? 'bonus' : m.mode === 'st' ? 'st' : m.mode === 'normal' ? 'normal' : 'jitan');
        $('aim-display').hidden = Machine.aim(m) !== 'right';
        const p = Lcd.prompt();
        $('push').classList.toggle('glow', p === 'push');
        $('lever').classList.toggle('glow', p === 'lever');
        // 「金棒レバーを 引け！」が 出た しゅんかんに レバーが 震える (レバブル)
        if (p !== lastPrompt) {
            if (p === 'lever') vibrate('lever');
            lastPrompt = p;
        }
        if (!$('debug-panel').hidden) {
            const s = m.stats;
            $('debug-stats').textContent = `初当たり ${s.firstHits} / チャージ ${s.charges} (ST ${s.chargeSt}) / ST突入 ${s.stEntries} / ST当たり ${s.stHits} / 転落 ${s.falls} / 時短 ${s.jitanEntries} (引き戻し ${s.jitanHits}) / 最高 ${s.bestChain}連 / 保留 ${m.holds[1].length}+${m.holds[2].length}`;
        }
    }

    function setStrength(v) {
        game.strength = Math.max(0, Math.min(100, Math.round(v)));
        store.set('strength', game.strength);
        $('strength-slider').value = game.strength;
        $('strength-value').textContent = game.strength;
        $('handle-knob').style.transform = `rotate(${-120 + game.strength * 2.4}deg)`;
        const presets = CONFIG.launch.presets;
        $('left-button').classList.toggle('active', Math.abs(presets.left - game.strength) <= 3);
        $('right-button').classList.toggle('active', Math.abs(presets.right - game.strength) <= 3);
    }
    function setFire(on) {
        game.fireOn = on;
        const b = $('fire-button');
        b.classList.toggle('firing', on);
        b.querySelector('.fire-icon').textContent = on ? '■' : '▶';
        b.querySelector('.fire-word').textContent = on ? '停止' : '発射';
    }

    // 液晶の ズーム (可動液晶: バトル・大きい リーチ・大当たりの はじめに 前へ せり出す)
    function zoomTarget(m) {
        if (m.bonus && m.bonus.phase === 'opening') return 1;
        const sp = m.spin;
        if (!sp) return 0;
        const p = sp.plan;
        if (p.kind === 'battle' && sp.elapsed > 1 && sp.elapsed < sp.duration - 0.2) return 1;
        if (p.kind === 'hashira' && p.sub !== 'quick' && sp.elapsed > 0.8 && sp.elapsed < sp.duration - 0.2) return 1;
        if (p.kind === 'normal' && p.reach && p.reach !== 'normal' && p.reach !== 'zenkaiten' && sp.elapsed > 3 + (p.lead || 0)) return 1;
        return 0;
    }

    let last = null, acc = 0;
    function frame(ts) {
        const now = ts / 1000;
        if (last === null) last = now;
        acc = Math.min(acc + now - last, 0.25);
        last = now;
        if (!game.paused && game.machine) {
            const dt = 1 / 60;
            while (acc >= dt) { tick(dt); acc -= dt; }
            playCues();
            const m = game.machine;
            const z = zoomTarget(m) * (store.get('zoom', true) ? 1 : 0);
            game.zoom += (z - game.zoom) * 0.12;
            if (game.zoom < 0.01) game.zoom = 0;
            Lcd.draw(m, time);
            BoardView.draw(game.view, game.world, Lcd.canvas, Lcd.gimmick(), time, game.zoom);
            const p = m.spin && m.spin.plan;
            Cabinet.draw({
                mode: m.mode === 'jitanLast' ? 'jitan' : m.mode, bonus: Boolean(m.bonus), reach: Boolean(p && (p.reach || p.kind === 'battle')),
                prompt: Lcd.prompt(), gim: Boolean(Lcd.gimmick()), holds1: m.holds[1].length, holds2: m.holds[2].length, futsu: m.futsu.holds,
                balls: game.balls, right: Machine.aim(m) === 'right'
            }, time);
            if (typeof Bgm !== 'undefined' && Sound.context) {
                Bgm.init(Sound.context);
                Bgm.setPaused(Sound.muted || !store.get('bgm', true));
                Bgm.play(Bgm.trackFor(m));
            }
            updateStatus();
        } else acc = 0;
        requestAnimationFrame(frame);
    }

    // ----- 操作 -----
    const fire = $('fire-button');
    fire.addEventListener('click', () => { Sound.unlock(); setFire(!game.fireOn); });
    const handle = $('handle');
    handle.addEventListener('pointerdown', e => { Sound.unlock(); game.holding = true; handle.setPointerCapture(e.pointerId); handle.dataset.x = e.clientX; handle.dataset.s = game.strength; });
    handle.addEventListener('pointermove', e => { if (game.holding) setStrength(Number(handle.dataset.s) + (e.clientX - Number(handle.dataset.x)) / 2); });
    ['pointerup', 'pointercancel'].forEach(t => handle.addEventListener(t, () => { game.holding = false; }));
    $('strength-slider').addEventListener('input', e => setStrength(Number(e.target.value)));
    $('left-button').addEventListener('click', () => setStrength(CONFIG.launch.presets.left));
    $('right-button').addEventListener('click', () => setStrength(CONFIG.launch.presets.right));
    $('push').addEventListener('pointerdown', e => { e.preventDefault(); push(); });
    Cabinet.place($('push'), { x: Cabinet.CAB.push.x - Cabinet.CAB.push.r, y: Cabinet.CAB.push.y - Cabinet.CAB.push.r, w: Cabinet.CAB.push.r * 2, h: Cabinet.CAB.push.r * 2 });
    Cabinet.setupLever($('lever'), lever);
    $('lend-button').addEventListener('click', () => { game.balls += CONFIG.balls.lend; });
    $('sound-button').addEventListener('click', () => {
        Sound.unlock();
        Sound.setMuted(!Sound.muted);
        $('sound-button').textContent = Sound.muted ? '音: OFF' : '音: ON';
    });
    $('sound-button').textContent = Sound.muted ? '音: OFF' : '音: ON';
    $('machine-button').addEventListener('click', () => { game.paused = true; setFire(false); $('picker').hidden = false; });
    $('data-button').addEventListener('click', () => {
        const r = game.record, m = game.machine, s = m.stats;
        const colors = CONFIG.settingHint.colors;
        const seen = [1, 2, 3, 4, 5, 6].map(l => `${colors[l].name} ${game.hints.filter(x => x === l).length}`).join('・');
        const rate = game.stats.launchedLeft > 50 ? (game.stats.heso / game.stats.launchedLeft * 250).toFixed(1) : '-';
        $('data-body').innerHTML = `<p>この台: 初当たり ${s.firstHits} 回・ST 突入 ${s.stEntries} 回・ST の 撃破 ${s.stHits} 回・転落 ${s.falls} 回・最高 ${s.bestChain} 連</p>`
            + `<p>設定: ${game.settingKnown ? `設定${game.setting}` : '？ (おまかせ)'}・回転率 ${rate} (1000円あたり)<br>トロフィー: ${seen}<br>`
            + `<small>白 = どの 設定でも・青 = 2 以上・緑 = 3 以上・紫 = 4 以上・赤 = 5 以上・虹 = 6 確定</small></p>`
            + `<p>これまで: 初当たり ${r.firstHits} 回・最高 ${r.bestChain} 連・最高 ${r.bestBalls} 個</p>`;
        $('data-panel').hidden = false;
    });
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { b.closest('.picker').hidden = true; }));
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT') return;
        Sound.unlock();
        if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setFire(!game.fireOn); }
        else if (e.code === 'ArrowLeft') setStrength(game.strength - (e.shiftKey ? 10 : 1));
        else if (e.code === 'ArrowRight') setStrength(game.strength + (e.shiftKey ? 10 : 1));
        else if (e.code === 'KeyB' || e.code === 'Enter') push();
        else if (e.code === 'Digit1') chooseRash('onioni');
        else if (e.code === 'Digit2') chooseRash('hashira');
        else if (e.code === 'KeyL') { Cabinet.setupLever && document.getElementById('lever').dispatchEvent(new Event('keypull')); }
    });
    $('lever').addEventListener('keypull', () => { const el = $('lever'); el.classList.add('pulled'); el.style.setProperty('--lever-angle', '-42deg'); setTimeout(() => { el.style.setProperty('--lever-angle', '0deg'); el.classList.remove('pulled'); }, 260); lever(); });

    // 台えらび (設定を えらんでから 台を 押す)
    let chosenSetting = store.get('setting', 'random');
    function markSetting() {
        document.querySelectorAll('[data-setting]').forEach(b => b.classList.toggle('selected', b.dataset.setting === String(chosenSetting)));
    }
    document.querySelectorAll('[data-setting]').forEach(b => b.addEventListener('click', () => {
        chosenSetting = b.dataset.setting === 'random' ? 'random' : Number(b.dataset.setting);
        store.set('setting', chosenSetting);
        markSetting();
    }));
    markSetting();
    document.querySelectorAll('[data-spec]').forEach(b => b.addEventListener('click', () => {
        Sound.unlock();
        $('picker').hidden = true;
        const random = chosenSetting === 'random';
        startMachine(b.dataset.spec, random ? 1 + Math.floor(Math.random() * 6) : chosenSetting, !random);
    }));

    // デバッグ (2026-11-04 ユーザー指定: 「デバッグ」の ボタンで いつでも ひらく。&debug=1 なら はじめから)
    {
        $('debug-panel').hidden = params.get('debug') !== '1';
        $('debug-button').addEventListener('click', () => {
            $('debug-panel').hidden = !$('debug-panel').hidden;
            if (!$('debug-panel').hidden) $('debug-panel').scrollIntoView({ block: 'nearest' });
        });
        const enemy = () => $('debug-enemy').value || null;
        // えらんだ リーチ・ミニゲーム・文字の 色・疑似連で 次の 変動を つくる
        const staged = () => ({
            reach: $('debug-reach-kind').value || undefined, mini: $('debug-mini').value || undefined,
            textColor: $('debug-text').value || undefined, gizi: $('debug-gizi').value === '' ? undefined : Number($('debug-gizi').value)
        });
        $('debug-show-hit').addEventListener('click', () => Machine.debugHold(game.machine, 'hit', { next: 'st', ...staged() }));
        $('debug-show-miss').addEventListener('click', () => Machine.debugHold(game.machine, 'reach', staged()));
        $('debug-mini-fail').addEventListener('click', () => Machine.debugHold(game.machine, 'miss', { ...staged(), mini: $('debug-mini').value || 'okamou', miniWin: false, reach: undefined }));
        $('debug-charge').addEventListener('click', () => Machine.debugHold(game.machine, 'charge', { next: 'normal' }));
        $('debug-charge-st').addEventListener('click', () => Machine.debugHold(game.machine, 'charge', { next: 'st' }));
        $('debug-hit').addEventListener('click', () => Machine.debugHold(game.machine, 'hit', { next: 'st', enemy: enemy() }));
        $('debug-hit-jitan').addEventListener('click', () => Machine.debugHold(game.machine, 'hit', { next: 'jitan' }));
        $('debug-yaku').addEventListener('click', () => Machine.debugHold(game.machine, 'hit', { next: 'st', yaku: true }));
        $('debug-reach').addEventListener('click', () => Machine.debugHold(game.machine, 'reach'));
        $('debug-fall').addEventListener('click', () => Machine.debugHold(game.machine, 'fall', { enemy: enemy() }));
        $('debug-st').addEventListener('click', () => Machine.debugMode(game.machine, 'st'));
        $('debug-jitan').addEventListener('click', () => Machine.debugMode(game.machine, 'jitan'));
        $('debug-hst').addEventListener('click', () => Machine.debugMode(game.machine, 'hst'));
        $('debug-hbattle').addEventListener('click', () => Machine.debugHold(game.machine, 'hit', { battle: true, shuketsu: true, ally: 'onioni' }));
        $('debug-auto').addEventListener('click', () => { game.auto = !game.auto; });
        ['pillars', 'doors', 'kanabo'].forEach(k => $('debug-gim-' + k).addEventListener('click', () => Lcd.startGimmick(k, 3)));
    }

    setStrength(game.strength);
    if (params.has('spec') && CONFIG.specs[params.get('spec')]) {
        $('picker').hidden = true;
        const setting = Math.min(6, Math.max(1, Number(params.get('setting')) || 4));
        startMachine(params.get('spec'), setting, params.has('setting'));
        const skip = Number(params.get('skip')) || 0;
        for (let i = 0; i < skip * 60; i++) tick(1 / 60);
    }
    window.__game = game;
    requestAnimationFrame(frame);
})();
