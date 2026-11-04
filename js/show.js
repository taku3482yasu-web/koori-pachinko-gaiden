// =====================================================================
// 演出の 筋書き (どの 変動で 何を 見せるか。画面には さわらない)
// ---------------------------------------------------------------------
// Show.hold(config, m, fig, result, rng)   保留が 入った とき: 保留の 色・先読み
// Show.plan(config, m, ctx, rng)           変動の はじめ: 変動の 中身と 時間 (液晶は plan どおりに 描く)
// Show.stepStory(config, m, result, rng)   通常時の ストーリー (背景) を すすめる
//
// 通常時 (ストーリー 2026-11-03 ユーザー指定): こおりくんが 行方不明 → おにおにが さがす → 柱の氷の うわさ →
//   ライバル探検隊と 合流 → 柱の氷 (ハルゥ・オカディシ・カネーズ) と たたかう
//   変動の 流れ (2026-11-04 ユーザー指定): セリフ → 疑似連 (NEXT) → 群 → ミニゲーム → 失敗なら はずれ / 成功なら リーチ → SPリーチ → 撃破で 当たり
//   リーチ: ノーマル → 探検隊リーチ → SPリーチ (ハリージェネラル < アサタナ < ハルゥ < オカディシ < カネーズ) → 柱の氷リーチ (3 人 同時。80% 以上)
//   ミニゲーム (成功度の 低い 順): おかもぅダッシュ < イシイー遺跡チャレンジ < マッスルチャレンジ < ASAHARA宣言 < ゴールド金面犬発見チャレンジ (発見で 95% 当たり)
//   チャンスアップ: 保留の 色・セリフの 色・疑似連・カットインの 色・敵の カットインの 文字の 色 (白 < 赤 < 金。金は 80% 以上)・群 (ふぶき)・PUSH ボタン・金棒レバー・役物
//   rel = 出たら 当たる 割合。はずれで 出る 割合は スペックの 確率から rates() が 計算する
// ST (バトル): 当たり・転落の 変動は おにおにの バトル。相手で 撃破率が かわる (show.battle)
//   相手は 結果から えらぶ: 当たりなら weight × 撃破率、転落なら weight × (1 − 撃破率)。
//   こう すると「その 相手が 出たときの 撃破率」が ちょうど kill に なる (weight は スペックの 継続率に 合わせて ある)
// 時短: はやい 変動。当たりは「こおりくんの 声が きこえた！」リーチから
// 柱の氷RASH (2026-11-04 ユーザー指定): 一発告知と 先バレが 主役。ときどき バトル。
//   先バレ: 電チューに 玉が 入った しゅんかんに 光って 鳴る (当たりの 35%)。一発告知: 変動の はじめに いきなり 当たり (当たりの 25%)
//   バトル: 味方 (ライバル探検隊 / おにおに / こおりくん。おにおに・こおりくんは チャンス) vs 柱の氷 (3人 集結は 大チャンス)。
//     わざは 一撃 (金棒レバーを 引く) か 連撃 (ボタンを 連打)。一撃の ほうが 期待度が 高い
// =====================================================================

const SHOW = {
    // ST の 相手 (2026-11-03 ユーザー指定: 撃破率が 高い 順に ハリージェネラル > ヒョウガリュウ > ハルゥ > オカディシ > カネーズ)
    enemies: {
        harigeneral: { name: 'ハリージェネラル', kill: 0.95, side: 'ally', ryuha: 'はり一族の 将軍', color: '#ffd84a', intro: 'はり一族の 力を 見よ！', win: '出直してくるがよい！', lose: 'ばかな… 針が 折れた…' },
        hyougaryu:   { name: 'ヒョウガリュウ', kill: 0.85, side: 'ally', ryuha: '氷河の 竜', color: '#7ad8ff' },
        asatana:     { name: 'アサタナ', kill: 0.6, side: 'hashira', ryuha: '柱の氷の 下っ端', color: '#a8c8e8', intro: 'ここは 通さないぞ！', win: 'へへっ ざまあみろ！', lose: 'ひいい… カネーズさま…' },
        haru:        { name: 'ハルゥ', kill: 0.70, side: 'hashira', ryuha: '嵐の 流派', color: '#9cf0b0', intro: '嵐が おまえを さらう！', win: '風は わたしの みかただ', lose: '嵐が… やんだ…' },
        okadishi:    { name: 'オカディシ', kill: 0.50, side: 'hashira', ryuha: '大渦の 流派', color: '#5a9cff', intro: '大渦に のまれろ！', win: 'うずの そこで ねむれ', lose: 'うずが… ほどける…' },
        kanezu:      { name: 'カネーズ', kill: 0.30, side: 'hashira', ryuha: '吹雪の 流派', color: '#e0e8ff', intro: '古き しきたりに したがえ！', win: 'これが こおり一族の 力だ', lose: 'しきたりが… くずれる…' }
    },
    // 相手の 出やすさ (スペックごと)。Σ weight × kill / Σ weight = 継続率 に なる ように して ある (tools/test.js で たしかめる)
    battleWeights: {
        s319: { harigeneral: 40, hyougaryu: 28, haru: 17, okadishi: 9, kanezu: 6 },   // 継続率 80%
        s399: { harigeneral: 28, hyougaryu: 28, haru: 22, okadishi: 13, kanezu: 9 }   // 継続率 75%
    },
    // ハリージェネラルは 出たら 95% で チャンスアップが からむ (ユーザー指定)。当たりは 98%・転落は 38% で 合わせて 95%
    harigeneralChance: { hit: 0.98, fall: 0.38 },
    // ほかの 相手の チャンスアップ (当たり / 転落)
    chanceUp: { hit: 0.55, fall: 0.12 },
    // ST の はずれで ときどき 相手の 気配 (バトルに ならない)
    stTease: 0.06,

    // 保留の 色 (通常時)。trust: 当たりの ときと はずれの ときの 出やすさ
    holdColors: {
        white:   { hit: 0,    miss: 0 },
        blue:    { hit: 0.18, miss: 0.04 },
        green:   { hit: 0.22, miss: 0.012 },
        red:     { hit: 0.3,  miss: 0.0025 },
        gold:    { hit: 0.12, miss: 0.0002 },
        rainbow: { hit: 0.02, miss: 0 }
    },

    // リーチの 出やすさ (通常時)。hit: 当たりの ときの 割合 / miss: はずれの 変動で 出る 割合 / rel: 出たら 当たる 割合 (はずれで 出る 割合は rates() が 計算する)
    reaches: {
        normal:  { name: 'ノーマルリーチ', hit: 0.04, miss: 0.07 },
        tanken:  { name: '探検隊リーチ', hit: 0.05, miss: 0.03 },
        harigeneral: { name: 'SPリーチ ハリージェネラル', hit: 0.07, rel: 0.02 },
        asatana: { name: 'SPリーチ アサタナ', hit: 0.09, rel: 0.04 },
        haru:    { name: 'SPリーチ ハルゥ', hit: 0.12, rel: 0.08 },
        okadishi: { name: 'SPリーチ オカディシ', hit: 0.15, rel: 0.15 },
        kanezu:  { name: 'SPリーチ カネーズ', hit: 0.2, rel: 0.35 },
        hashiraAll: { name: '柱の氷リーチ', hit: 0.26, rel: 0.82 },
        zenkaiten: { name: '全回転', hit: 0.02, miss: 0 }
    },
    // 敵と たたかう リーチ (敵の カットインの 文字の 色が つく)
    battleReaches: ['harigeneral', 'asatana', 'haru', 'okadishi', 'kanezu', 'hashiraAll'],
    // 敵の カットインの 文字の 色 (2026-11-04 ユーザー指定: 内部の 期待度で かわる。ふだんは 白)。
    //   hit: 当たりの ときの 割合 / rel: 出たら 当たる 割合 (金は 80% 以上)
    textColors: { gold: { hit: 0.2, rel: 0.85 }, red: { hit: 0.35, rel: 0.4 } },
    // ST・柱の氷RASH の バトルの 文字の 色 (当たり / はずれの 割合)
    battleText: { hit: { gold: 0.25, red: 0.4 }, st: { gold: 0.01, red: 0.2 }, hst: { gold: 0.005, red: 0.06 } },
    // ミニゲーム (2026-11-04 ユーザー指定。成功度の 低い 順)。前作の チャレンジと おなじく、成功すると リーチへ、失敗すると はずれ。
    //   hit: 当たりの ときの 重み / win: 全体の 成功率 / rel: 成功したら 当たる 割合 / high: 熱い リーチ (miniHigh) の ときだけ 出る
    minis: {
        okamou:  { name: 'おかもぅダッシュ', who: 'okamou', hit: 24, win: 0.2, rel: 0.04 },
        ishii:   { name: 'イシイー遺跡チャレンジ', who: 'ishii', hit: 24, win: 0.35, rel: 0.08 },
        muscle:  { name: 'マッスルイケノーブルのマッスルチャレンジ', who: 'ikenoble', hit: 22, win: 0.5, rel: 0.15 },
        asahara: { name: 'ASAHARA宣言', who: 'asahara', hit: 18, win: 0.65, rel: 0.35 },
        goldDog: { name: 'ゴールド金面犬発見チャレンジ', who: 'goldDog', hit: 30, win: 0.8, rel: 0.95, high: true }
    },
    miniShare: 0.7,                      // 当たりの SPリーチの うち ミニゲームを とおる 割合
    miniHigh: ['kanezu', 'hashiraAll'],
    // 疑似連 (前作と おなじ。NEXT で 図柄が 回り直す 回数の 重み)。ミニゲームか SPリーチに 入る 変動だけ
    gizi: { hit: { 0: 35, 1: 25, 2: 22, 3: 18 }, reach: { 0: 65, 1: 22, 2: 10, 3: 3 }, fail: { 0: 85, 1: 12, 2: 3, 3: 0 } },
    // セリフ (通常時の 変動の はじめに ふるカワが しゃべる。前作と おなじ 考え方)。熱さ 0〜6 で 出やすさと 色が かわる
    //   熱さ: はずれ 0 / ミニゲーム失敗 1 / ノーマルリーチ 2 / SPリーチ はずれ 3 / 当たり 5 / 虹保留 6
    lines: {
        appear: [0.12, 0.3, 0.45, 0.6, 0.75, 0.85, 1],
        colorWeights: [{ 0: 85, 1: 12, 2: 3 }, { 0: 50, 1: 35, 2: 15 }, { 0: 30, 1: 30, 2: 30, 3: 10 }, { 1: 20, 2: 30, 3: 40, 4: 10 }, { 1: 10, 2: 20, 3: 40, 4: 30 }, { 2: 10, 3: 35, 4: 55 }, { 5: 100 }],
        colors: ['#ffffff', '#4f9bff', '#3fdf6f', '#ff3a3a', '#ffd84a', 'rainbow'],
        text: [
            ['おにおに、がんばれ！', 'こおりくん どこだろう…', 'なにか 来そう…？'],
            ['ん…？ なんだか 気になる', 'ちょっと 期待していいかも'],
            ['いける いける！', 'チャンスかも！'],
            ['これは 来るかも…！', 'チャンス！！'],
            ['激アツだよ！！', 'きたきたーっ！！'],
            ['すごいのが 来る…！！！']
        ]
    },
    // 演出の 部品 (当たり / はずれ の 出やすさ。リーチの ときだけ)
    parts: {
        gun:    { hit: 0.18, miss: 0.006 },           // 群 (ふぶきの 中を ライバル探検隊が かけぬける)
        cutin:  { blue: [0.25, 0.6], green: [0.3, 0.3], red: [0.35, 0.09], gold: [0.1, 0.01] },   // [当たり, はずれ]
        button: { push: [0.3, 0.3], lever: [0.42, 0.015] },   // PUSH ボタン / 金棒レバー
        chance: { hit: 0.5, miss: 0.1 },      // SPリーチ中の「チャンスアップ！」
        yaku:   { hit: 0.22, miss: 0.0008 }           // 役物が 動く (ほぼ 当たり)
    },
    // ストーリーの 場面 (通常時の 背景)
    stories: [
        { id: 'town', name: 'こおりくんが いない…', bg: 'town' },
        { id: 'rumor', name: '柱の氷の うわさ', bg: 'tavern' },
        { id: 'rival', name: 'ライバル探検隊と 合流', bg: 'snowfield' },
        { id: 'hideout', name: '柱の氷の アジト', bg: 'hideout' }
    ],
    hashira: {
        // 先バレ [当たり, はずれ] (2026-11-04 ユーザー指定で 2 種類): voice = 前作の 音を 低く した もの / roar = おにおにの 先咆哮 (こっちが アツい)。
        // どちらも 台の ボタンが 赤く 光る
        senbare: { voice: [0.22, 0.0012], roar: [0.13, 0.0003] },
        ippatsu: 0.25, quickHit: 0.1,                    // 当たりの うち 一発告知 / ふつうに そろう (のこりは バトル)
        missBattle: 0.1,                                 // はずれの バトルの 割合
        ally: { hit: { rival: 40, onioni: 35, koori: 25 }, miss: { rival: 84, onioni: 12, koori: 4 } },
        shuketsu: [0.4, 0.012],                          // 柱の氷 集結 [当たり, はずれ]
        ichigeki: [0.62, 0.2]                            // 一撃 (のこりは 連撃) [当たり, はずれ]
    },
    storyEvery: 40,        // だいたい 何回転で 場面が すすむ か (はずれの とき)
    // 変動の 時間 (秒)
    // plain: はずれの 変動 (リーチなし) を、のこりの 保留 (0〜3) ごとに。保留が たまるほど 速い (設定が 高くて よく 入る 台でも 回る ように)
    // missReachByHolds: はずれの リーチの 出やすさを、のこりの 保留ごとに 何倍に するか (保留が たまると リーチが へる)
    plainByHolds: [5.2, 4, 2.4, 1.4],
    missReachByHolds: [1, 1, 0.6, 0.35],
    // next: 疑似連 1 回 / gun: 群 / mini: ミニゲーム / miniFail: 失敗の あと 図柄が 止まるまで / charge: チャージの 変動 / sp: SPリーチごと
    time: { next: 1.6, gun: 2.5, mini: 6.5, miniFail: 2.4, charge: 3.6, sp: { harigeneral: 22, asatana: 23, haru: 25, okadishi: 26, kanezu: 28, hashiraAll: 32 },
        normalReach: 11, tanken: 18, zenkaiten: 14, stMiss: 1.8, stTease: 4.5, battle: 12, jitan: 1.6, jitanReach: 9, hQuick: 1.8, hIppatsu: 4, hBattle: 11 }
};

const Show = (() => {
    const pick = (obj, rng) => {
        const keys = Object.keys(obj), total = keys.reduce((a, k) => a + obj[k], 0);
        let r = rng() * total;
        for (const k of keys) if ((r -= obj[k]) < 0) return k;
        return keys[keys.length - 1];
    };
    const isHit = r => r.kind === 'hit';
    const isBig = reach => Boolean(reach) && reach !== 'normal' && reach !== 'zenkaiten';
    const sum = list => list.reduce((a, b) => a + b, 0);

    // ミニゲームの 重み (リーチの 種類ごと)。high の ものは 熱い リーチの ときだけ
    function miniWeights(reach) {
        const w = {};
        for (const [id, v] of Object.entries(SHOW.minis)) if (!v.high || SHOW.miniHigh.includes(reach)) w[id] = v.hit;
        return w;
    }
    // スペックの 確率から、はずれの 変動で 出る 割合を 計算する (rel の とおりに なる ように)
    const rateCache = new Map();
    function rates(m) {
        if (rateCache.has(m.specId)) return rateCache.get(m.specId);
        const p = m.spec.hitRate, odds = p / (1 - p), R = SHOW.reaches;
        const reachMiss = {};
        for (const [k, v] of Object.entries(R)) reachMiss[k] = v.rel ? v.hit * odds * (1 - v.rel) / v.rel : v.miss;
        const big = Object.keys(R).filter(isBig);
        const mini = {};
        for (const [id, v] of Object.entries(SHOW.minis)) {
            const allowed = big.filter(r => miniWeights(r)[id]);
            const hitShare = sum(allowed.map(r => R[r].hit * SHOW.miniShare * v.hit / sum(Object.values(miniWeights(r)))));
            const win = hitShare * odds * (1 - v.rel) / v.rel;   // はずれの 変動で 成功する 割合
            // success: SPリーチの はずれの うち この ミニゲームを とおる 割合 / fail: リーチなしの はずれで 失敗する 割合
            mini[id] = { success: win / sum(allowed.map(r => reachMiss[r])), fail: (hitShare * odds + win) * (1 - v.win) / v.win };
        }
        const battleMiss = sum(SHOW.battleReaches.map(r => reachMiss[r])), battleHit = sum(SHOW.battleReaches.map(r => R[r].hit));
        const text = {};
        for (const [c, v] of Object.entries(SHOW.textColors)) text[c] = battleHit * v.hit * odds * (1 - v.rel) / v.rel / battleMiss;
        const out = { reachMiss, mini, text };
        rateCache.set(m.specId, out);
        return out;
    }
    const pickText = (w, rng) => { const r = rng(); return r < w.gold ? 'gold' : r < w.gold + w.red ? 'red' : 'white'; };
    function speech(heat, rng) {
        const L = SHOW.lines;
        if (rng() >= L.appear[heat]) return null;
        const c = Number(pick(L.colorWeights[heat], rng)), list = L.text[c];
        return { text: list[Math.floor(rng() * list.length)], color: L.colors[c] };
    }

    // ----- 保留 -----
    function hold(config, m, fig, result, rng) {
        if (m.mode === 'hst') {
            const i = isHit(result) ? 0 : 1, r = rng();
            const { voice, roar } = SHOW.hashira.senbare;
            const senbare = r < roar[i] ? 'roar' : r < roar[i] + voice[i] ? 'voice' : null;
            return { holdColor: 'white', shownColor: 'white', senbare };
        }
        if (m.mode === 'st' || fig === 2) return { holdColor: 'white', shownColor: 'white' };
        // 保留の 色: 当たりかで 出やすさが ちがう
        let color = 'white';
        const r = rng();
        let acc = 0;
        for (const [c, t] of Object.entries(SHOW.holdColors)) {
            if (c === 'white') continue;
            acc += isHit(result) ? t.hit : t.miss;
            if (r < acc) { color = c; break; }
        }
        if (result.force === 'reach' && color === 'white') color = 'blue';
        // 保留変化: 白で 入って 変動の はじめに 色が かわる (ときどき)
        const shown = color !== 'white' && rng() < 0.4 ? 'white' : color;
        return { holdColor: color, shownColor: shown };
    }

    // ----- 変動 -----
    function plan(config, m, ctx, rng) {
        const { result } = ctx;
        if (m.mode === 'st') return stPlan(config, m, result, rng);
        if (m.mode === 'hst') return hashiraPlan(m, result, rng);
        if (m.mode === 'jitan' || ctx.fig === 2) return jitanPlan(m, ctx, result, rng);
        return normalPlan(config, m, ctx, result, rng);
    }

    // 図柄 (1〜9)。当たりは ぞろ目。はずれの リーチは 左右が おなじで まんなかが ちがう
    function figures(result, reach, rng) {
        const d = () => 1 + Math.floor(rng() * 9);
        if (isHit(result)) {
            // ST へ 行く 当たりは 奇数 (7 が 多い)、時短へ 行く 当たりは 偶数
            const odd = [1, 3, 5, 7, 7, 7], even = [2, 4, 6, 8];
            const n = result.next === 'st' ? odd[Math.floor(rng() * odd.length)] : even[Math.floor(rng() * even.length)];
            return [n, n, n];
        }
        if (reach) {
            const n = d();
            let c = d();
            if (c === n) c = n % 9 + 1;
            return [n, c, n];
        }
        let a = d(), b = d(), c = d();
        if (a === c) c = c % 9 + 1;
        return [a, b, c];
    }

    function normalPlan(config, m, ctx, result, rng) {
        const hit = isHit(result);
        const T = SHOW.time, R = rates(m);
        const p = { kind: 'normal', hit, holdColor: result.holdColor, shownColor: result.shownColor };
        if (result.kind === 'charge') return { ...p, charge: true, next: result.next, reach: null, figures: figures(result, false, rng), duration: T.charge };
        const holdsK = SHOW.missReachByHolds[Math.min(3, ctx.holdsLeft || 0)];
        // リーチの 種類
        let reach = null;
        if (hit) reach = pick(Object.fromEntries(Object.entries(SHOW.reaches).map(([k, v]) => [k, v.hit])), rng);
        else if (result.force === 'reach') reach = rng() < 0.5 ? 'tanken' : 'haru';
        else {
            const r = rng();
            let acc = 0;
            // 保留の 色が 熱いほど リーチに なりやすい (見た目を 合わせる)
            const boost = { white: 1, blue: 3, green: 5, red: 8, gold: 10, rainbow: 10 }[result.holdColor] || 1;
            for (const k of Object.keys(SHOW.reaches)) {
                acc += R.reachMiss[k] * holdsK * (SHOW.reaches[k].rel ? 1 : boost);
                if (r < acc) { reach = k; break; }
            }
        }
        if (result.holdColor === 'rainbow') reach = reach === 'zenkaiten' ? reach : 'hashiraAll';
        if (result.forceReach) reach = result.forceReach;
        // ミニゲーム: 成功なら リーチへ、失敗なら はずれ
        let mini = null;
        if (result.forceMini) {
            mini = { id: result.forceMini, win: hit || result.forceMiniWin !== false };
            if (!mini.win) reach = null;
            else if (!isBig(reach)) reach = 'harigeneral';
        } else if (hit) {
            if (isBig(reach) && rng() < SHOW.miniShare) mini = { id: pick(miniWeights(reach), rng), win: true };
        } else if (isBig(reach)) {
            const r = rng();
            let acc = 0;
            for (const id of Object.keys(miniWeights(reach))) {
                acc += R.mini[id].success;
                if (r < acc) { mini = { id, win: true }; break; }
            }
        } else if (!reach) {
            const r = rng();
            let acc = 0;
            for (const id of Object.keys(SHOW.minis)) {
                acc += R.mini[id].fail * holdsK;
                if (r < acc) { mini = { id, win: false }; break; }
            }
        }
        p.reach = reach;
        p.mini = mini;
        p.figures = figures(result, Boolean(reach), rng);
        if (reach === 'zenkaiten') p.figures = [7, 7, 7];
        // 演出の 部品
        const P = SHOW.parts;
        const roll = (o) => rng() < (hit ? o.hit : o.miss);
        const big = isBig(reach);
        p.gun = big && (result.forceGun !== undefined ? result.forceGun : roll(P.gun));
        p.yaku = Boolean(result.forceYaku) || (big && roll(P.yaku));
        if (reach && reach !== 'zenkaiten') {
            // カットインの 色 (当たり・はずれで 出やすさが ちがう)。なし も ある
            const w = Object.fromEntries(Object.entries(P.cutin).map(([k, v]) => [k, v[hit ? 0 : 1]]));
            w.none = hit ? 0.05 : 0.5;
            const c = pick(w, rng);
            p.cutin = c === 'none' ? null : c;
            // 決め手: 金棒レバー (熱い) / PUSH ボタン
            if (big) {
                const r = rng();
                if (r < P.button.lever[hit ? 0 : 1]) p.action = 'lever';
                else if (r < P.button.lever[hit ? 0 : 1] + P.button.push[hit ? 0 : 1]) p.action = 'push';
            }
            if (hit && p.yaku) p.action = p.action || 'push';
        }
        if (big) p.chance = rng() < (hit ? P.chance.hit : P.chance.miss);
        // 柱の氷リーチは かならず さいごに「レバーを引け！」
        if (reach === 'hashiraAll') { p.action = 'lever'; p.leverText = 'レバーを引け！'; p.cutin = null; p.chance = false; }
        // 敵の カットインの 文字の 色
        if (SHOW.battleReaches.includes(reach)) {
            const w = hit ? { gold: SHOW.textColors.gold.hit, red: SHOW.textColors.red.hit } : R.text;
            p.textColor = result.forceText || pickText(w, rng);
        }
        // 疑似連
        p.gizi = 0;
        if (mini || big) p.gizi = Number(pick(SHOW.gizi[hit ? 'hit' : big ? 'reach' : 'fail'], rng));
        if (result.forceGizi !== undefined) p.gizi = result.forceGizi;
        // セリフ
        const heat = result.holdColor === 'rainbow' ? 6 : hit ? 5 : big ? 3 : reach ? 2 : mini ? 1 : 0;
        p.line = speech(heat, rng);
        // 当たりの ときの 告知: 役物が 落ちる (yaku) か、決め手の あとに 当たり
        // 図柄が 止まりはじめる 前の 時間 (lead): 疑似連 → 群 → ミニゲーム。t はそれぞれの はじまる 秒
        p.t = { gizi: 0.6 };
        p.t.gun = p.t.gizi + p.gizi * T.next;
        p.t.mini = p.t.gun + (p.gun ? T.gun : 0);
        p.lead = p.t.mini + (mini ? T.mini : 0) - 0.6;
        p.duration = p.lead + (!reach ? (mini ? T.miniFail : SHOW.plainByHolds[Math.min(3, ctx.holdsLeft || 0)])
            : reach === 'normal' ? T.normalReach
            : reach === 'tanken' ? T.tanken
            : reach === 'zenkaiten' ? T.zenkaiten
            : T.sp[reach]);
        if (big) p.enemy = reach === 'tanken' ? 'rival' : reach;
        // 当たりの 次: ST / 時短 (液晶で 見せる)
        p.next = hit ? result.next : null;
        return p;
    }

    // ST: はずれは はやく。当たり・転落は バトル
    function stPlan(config, m, result, rng) {
        const T = SHOW.time;
        if (result.kind === 'miss') {
            const tease = rng() < SHOW.stTease;
            return { kind: 'stMiss', figures: figures(result, false, rng), tease: tease ? pickEnemyAny(m, rng) : null, duration: tease ? T.stTease : T.stMiss };
        }
        const hit = isHit(result);
        const enemy = result.forceEnemy || battleEnemy(m.specId, hit, rng);
        const e = SHOW.enemies[enemy];
        let chance;
        if (enemy === 'harigeneral') chance = rng() < (hit ? SHOW.harigeneralChance.hit : SHOW.harigeneralChance.fall);
        else chance = rng() < (hit ? SHOW.chanceUp.hit : SHOW.chanceUp.fall);
        // 決め手: 当たりの とき ときどき 金棒レバー (ほぼ 撃破)
        const action = hit ? (rng() < 0.35 ? 'lever' : 'push') : (rng() < 0.03 ? 'lever' : 'push');
        return {
            kind: 'battle', hit, enemy, enemyName: e.name, kill: e.kill, chance, action,
            textColor: result.forceText || pickText(SHOW.battleText[hit ? 'hit' : 'st'], rng),
            yaku: hit && rng() < 0.15,
            figures: hit ? [7, 7, 7] : [1, 2, 3],
            duration: T.battle + (chance ? 1 : 0)
        };
    }

    function battleEnemy(specId, hit, rng) {
        const w = SHOW.battleWeights[specId] || SHOW.battleWeights.s319;
        return pick(Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v * (hit ? SHOW.enemies[k].kill : 1 - SHOW.enemies[k].kill)])), rng);
    }
    function pickEnemyAny(m, rng) {
        const w = SHOW.battleWeights[m.specId] || SHOW.battleWeights.s319;
        return pick(w, rng);
    }

    // 柱の氷RASH
    function hashiraPlan(m, result, rng) {
        const H = SHOW.hashira, T = SHOW.time;
        const hit = isHit(result);
        const base = { kind: 'hashira', hit, senbare: Boolean(result.senbare), figures: figures(result, false, rng), last: m.stLeft <= 0 };
        if (hit) {
            const r = rng();
            if (result.forceBattle) { /* バトルに する */ }
            else if (r < H.ippatsu) return { ...base, sub: 'ippatsu', duration: T.hIppatsu };
            else if (r < H.ippatsu + H.quickHit) return { ...base, sub: 'quick', duration: T.hQuick + 0.6 };
        } else if (!result.forceBattle && rng() >= H.missBattle) return { ...base, sub: 'quick', duration: T.hQuick };
        const ally = result.forceAlly || pick(hit ? H.ally.hit : H.ally.miss, rng);
        const shuketsu = result.forceShuketsu !== undefined ? result.forceShuketsu : rng() < H.shuketsu[hit ? 0 : 1];
        const enemies = shuketsu ? ['haru', 'okadishi', 'kanezu'] : [['haru', 'okadishi', 'kanezu'][Math.floor(rng() * 3)]];
        const ichigeki = result.forceAttack ? result.forceAttack === 'ichigeki' : rng() < H.ichigeki[hit ? 0 : 1];
        const textColor = result.forceText || pickText(SHOW.battleText[hit ? 'hit' : 'hst'], rng);
        return { ...base, sub: 'battle', textColor, ally, enemies, shuketsu, attack: ichigeki ? 'ichigeki' : 'rengeki', action: ichigeki ? 'lever' : 'mash', duration: T.hBattle + (shuketsu ? 1.5 : 0) };
    }

    // 時短: はやい 変動。当たりは リーチ
    function jitanPlan(m, ctx, result, rng) {
        const T = SHOW.time;
        const hit = isHit(result);
        const reach = hit || rng() < 0.03;
        return { kind: 'jitan', hit, reach, figures: figures(result, reach, rng), duration: reach ? T.jitanReach : T.jitan, last: ctx.lastJitan, next: hit ? 'st' : null };
    }

    // ----- ストーリー -----
    // はずれの 変動で ときどき 次の 場面へ (さいごの アジトの あとは はじめに もどる)。かわらなければ null
    function stepStory(config, m, result, rng) {
        if (rng() < 1 / SHOW.storyEvery) return (m.story + 1) % SHOW.stories.length;
        return null;
    }

    // ST の 相手の、出たときの 撃破率 (表示・テスト用)
    function killRate(enemy) { return SHOW.enemies[enemy].kill; }

    return { hold, plan, stepStory, killRate, battleEnemy, rates };
})();
if (typeof module !== 'undefined') module.exports = { SHOW, Show };
