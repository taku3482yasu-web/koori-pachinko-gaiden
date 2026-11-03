// =====================================================================
// こおりくんの大冒険外伝 ～おにおにの挑戦 めざめる3人の氷達～ (2026-11-03 ユーザー指定) の 数値
// ---------------------------------------------------------------------
// 盤面の形・玉の物理・発射・賞球・スペック (1/319 と 1/399)・抽選の 時間。演出の 数値は show。
// 座標は 盤面の 論理座標 (横 board.width x 縦 board.height)。左上が (0, 0)、下向きが +y。角度は 度 (右 0°・上 90°)。
// 盤面は 今どきの 台の ように 液晶を 大きく (前作の 約 1.6 倍)。外レールの 円を 大きく して、液晶の まわりを 玉が 通る
// =====================================================================

const CONFIG = {
    board: {
        width: 380,
        height: 540,
        center: { x: 190, y: 255 },
        outerRadius: 186,
        innerRadius: 175,
        outerArc: { from: 200, to: -25 },
        innerArc: { from: 200, to: 121 },
        bottomY: 518,

        // 液晶の 枠 (玉は 入れない)。上は 山形の 屋根
        lcdFrame: { left: 70, right: 310, top: 110, shoulder: 140, bottom: 262 },
        // 液晶の 画面 (枠の 内側いっぱい)。描く 絵は 320x176 を 縮める
        lcd: { x: 73, y: 141, w: 234, h: 119 },
        // 液晶の 左の ワープ (右向きの 玉だけ) → 液晶の 下の ステージへ
        warp: { x: 60, y: 196, w: 8, h: 16, minVx: 15, exitX: 84, exitY: 265, exitVx: 70 },
        // ステージ (液晶の 下の 床)。まんなかの 切れ目から 落ちると ヘソの 真上
        stage: {
            left: [[76, 268], [130, 277], [183, 272]],
            right: [[197, 272], [250, 277], [304, 268]],
            spills: [{ x: 130, y: 274 }, { x: 250, y: 274 }],
            spillWidth: 6
        },
        rubber: { angle: 22, length: 18, tilt: 35 },
        rightDivider: [[312, 262], [300, 330], [296, 432]],
        guides: [
            [[310, 284], [319.5, 300]],
            [[360, 284], [332.5, 300]],
            [[304, 338], [313, 366]],
            [[350, 338], [339, 366]],
            [[20, 288], [40, 306]]              // 左の レールを 落ちる 玉を 道釘へ
        ],
        pockets: {
            heso:     { x: 190, y: 352, width: 9, payout: 'heso' },
            denchu:   { x: 326, y: 376, width: 6.8, payout: 'denchu', kind: 'denchu' },
            attacker: { x: 330, y: 446, width: 56, payout: 'attacker', kind: 'attacker' },
            general1: { x: 58, y: 432, width: 6.8, payout: 'general' },
            general2: { x: 252, y: 444, width: 6.8, payout: 'general' }
        },
        gates: {
            gate: { x: 326, y: 306, width: 7 }
        },
        windmills: [
            { x: 50, y: 272, radius: 9, blades: 4, omega: 300 }
        ],
        nailRadius: 1.3,
        nails: [
            { type: 'grid', x0: 84, x1: 296, y0: 80, y1: 92, dx: 11, dy: 10, stagger: true },          // 天釘 (液晶の 上)
            { type: 'grid', x0: 22, x1: 64, y0: 150, y1: 262, dx: 11, dy: 11, stagger: true },         // 左の 道
            { type: 'line', from: [30, 304], to: [166, 342], spacing: 3.2 },                          // 道釘 (ヘソへ)
            { type: 'points', points: [[160, 328], [176, 322], [204, 322], [182, 340], [198, 340]] }, // ジャンプ釘・寄り釘
            { type: 'grid', x0: 40, x1: 272, y0: 370, y1: 476, dx: 14, dy: 13, stagger: true },        // ヘソの 下
            { type: 'grid', x0: 92, x1: 288, y0: 288, y1: 318, dx: 16, dy: 14, stagger: true },        // ステージの 下
            { type: 'grid', x0: 304, x1: 352, y0: 316, y1: 328, dx: 12, dy: 12, stagger: true },       // 右打ち: ゲートの 下
            { type: 'grid', x0: 300, x1: 356, y0: 396, y1: 424, dx: 13, dy: 12, stagger: true }        // 右打ち: 電チューの 下
        ],
        keepout: [
            { type: 'circle', x: 50, y: 272, r: 15 },
            { type: 'rect', x0: 182, x1: 198, y0: 268, y1: 322 },
            { type: 'rect', x0: 180, x1: 200, y0: 346, y1: 368 },
            { type: 'rect', x0: 318, x1: 334, y0: 300, y1: 316 },
            { type: 'rect', x0: 318, x1: 334, y0: 370, y1: 390 },
            { type: 'rect', x0: 290, x1: 362, y0: 428, y1: 462 },
            { type: 'rect', x0: 50, x1: 66, y0: 424, y1: 442 },
            { type: 'rect', x0: 244, x1: 260, y0: 436, y1: 454 },
            { type: 'rect', x0: 290, x1: 318, y0: 258, y1: 436 }
        ]
    },

    ball: {
        radius: 3,
        gravity: 420,
        substeps: 10,
        maxBalls: 60,
        surfaces: {
            nail: { restitution: 0.5, friction: 0.97 },
            rail: { restitution: 0.15, friction: 0.9998 },
            wall: { restitution: 0.3, friction: 0.9995 },
            stage: { restitution: 0.2, friction: 0.999 },
            windmill: { restitution: 0.4, friction: 0.9 },
            rubber: { restitution: 0.55, friction: 0.9 }
        },
        jitter: 6,
        stall: { speed: 8, after: 0.4, kick: 40 }
    },

    launch: {
        x: 20.4,
        y: 510,
        speedMin: 590,
        speedMax: 720,
        noise: 0.006,
        interval: 0.6,       // 1分に 100発
        foulY: 514,
        defaultStrength: 27,
        presets: { left: 27, right: 95 }
    },

    payout: { heso: 3, denchu: 1, general: 3, attacker: 15 },
    balls: { start: 250, lend: 125 },

    // ----- スペック (2026-11-03 ユーザー指定) -----
    //   1/319: 大当たりは いつも 3R (約 450個)。初当たりの 50% が ST、50% が 時短 100回 (確率は 1/319 の まま・当たれば ST)。ST の 継続率 約 80%
    //   1/399: 初当たりは 3000発 (20R)。RASH 中は 3000発・1500発・上乗せタイム (spec.payout)。初当たりの 80% が ST、20% が 時短 100回。ST の 継続率 約 75% (出玉は 1/399 の ほうが 多め)
    //   ST は 転落型: 1 回転ごとに「大当たり (st.hitRate)」と「転落 (st.fallRate)」を 抽選。継続率 = hit / (hit + fall)。
    //     どちらかが 出た 回転は おにおにの バトル (相手で 撃破率が かわる。show.battle)。大当たりなら 撃破、転落なら おにおにが たおされて 通常時へ
    // ----- 設定 1〜6 (2026-11-04 ユーザー指定: 前作と おなじく 設定を つける) -----
    // 前作と おなじく 釘で つける (釘調整)。設定が 高いほど ヘソの 命釘が ひらいて よく 回り、出玉率が 上がる。
    // 出玉率の 目標 (settingRtp) は 両スペック 共通 (Claude が きめた。設定1 は 負けやすく、設定6 は 大きく 勝てる)。
    // spec.settings[]: hesoWidth = ヘソの 命釘の すき間 (玉の 直径は 6) / heso = 左打ちの 玉が ヘソに 入る 割合 (tools/flow.js で 測った 数。tools/test.js が 使う)
    //   たしかめ: node tools/test.js --settings
    settingRtp: [0.8, 0.88, 0.96, 1.04, 1.12, 1.2],
    // 設定示唆 (前作と おなじ 考え方。数値は 前作の まま): RASH・時短が 終わった とき rate の 確率で、液晶の 左下に トロフィーが 出る (show 秒)。
    //   色は「設定○以上」 (白は どの 設定でも 出る、虹は 設定6 確定)。weights は 台の 設定ごとの、出た ときの 色の 重み
    settingHint: {
        rate: 0.5, show: 8,
        weights: {
            1: { 1: 100 },
            2: { 1: 55, 2: 45 },
            3: { 1: 40, 2: 20, 3: 40 },
            4: { 1: 30, 2: 15, 3: 15, 4: 40 },
            5: { 1: 25, 2: 10, 3: 10, 4: 15, 5: 40 },
            6: { 1: 20, 2: 10, 3: 10, 4: 10, 5: 15, 6: 35 }
        },
        colors: {
            1: { name: '白', main: '#f2f2f2', light: '#ffffff', dark: '#a8a8b8' },
            2: { name: '青', main: '#3f8cff', light: '#a8ccff', dark: '#1d4ea8' },
            3: { name: '緑', main: '#3fcf5f', light: '#a8f0b8', dark: '#1d7a33' },
            4: { name: '紫', main: '#a860ff', light: '#d8b8ff', dark: '#5a2a9a' },
            5: { name: '赤', main: '#ff3a3a', light: '#ffb0b0', dark: '#9a1a1a' },
            6: { name: '虹', rainbow: true }
        }
    },

    specs: {
        s319: {
            label: '1/319', name: 'ライトスペック',
            note: 'いつも 3R (約450個)。初当たりの 50% が ST・のこりは 時短100回。ST 継続率 約80%',
            hitRate: 1 / 319.6,
            rounds: 3,
            firstHit: [{ weight: 50, next: 'st' }, { weight: 50, next: 'jitan' }],
            jitanSpins: 100,
            st: { hitRate: 1 / 60, fallRate: 1 / 240 },
            // 柱の氷RASH: 100 回で 当たりを ねらう (1 − (1 − 1/62.6)^100 ≒ 80%)
            hashira: { hitRate: 1 / 62.6, spins: 100 },
            target: { st: 0.5, continuation: 0.8 },
            // 設定 1〜6 の 釘 (1000円で 約 25 〜 39 回転。3R なので よく 回らないと 勝てない)
            settings: [{ hesoWidth: 12.2, heso: 0.113 }, { hesoWidth: 13.5, heso: 0.133 }, { hesoWidth: 14.2, heso: 0.148 },
                { hesoWidth: 15.4, heso: 0.17 }, { hesoWidth: 16.2, heso: 0.194 }, { hesoWidth: 16.9, heso: 0.22 }]
        },
        s399: {
            label: '1/399', name: 'ミドルスペック',
            note: '初当たりは 3000発。RASH 中は 3000発 25%・1500発 25%・上乗せタイム 50% (成功で +1500発)。初当たりの 80% が ST・のこりは 時短100回。ST 継続率 約75%',
            hitRate: 1 / 399.6,
            rounds: 10,
            // 出玉の 振り分け (2026-11-04 ユーザー指定)。1R = 10C x 15 = 150発 なので 3000発 = 20R・1500発 = 10R
            //   first: 初当たり (通常時の 当たり) は いつも 3000発
            //   rash: RASH・時短の 当たり。3000発 25% / 1500発 25% / 1500発 + 上乗せタイム 50%
            //   (時短の 当たりも ここ。「最初は 3000発」は 通常時の 当たりだけ と した。Claude が きめた)
            payout: {
                first: 20,
                rash: [{ id: 'full', weight: 25, rounds: 20 }, { id: 'base', weight: 25, rounds: 10 }, { id: 'uwanose', weight: 50, rounds: 10, uwanose: true }]
            },
            // 上乗せタイム: ラウンド中 (rounds の どれかの ラウンドの はじめ) に 発生。window 秒 以内に 違和感が 起きたら 成功で addRounds (1500発) 上乗せ。
            //   success: 成功する 割合 / iwakan: 違和感が 起きる 秒 [はやい, おそい] / reveal: 違和感から 上乗せを 知らせる までの 秒
            uwanose: { success: 0.5, addRounds: 10, window: 10, rounds: [2, 5], iwakan: [2, 8.5], reveal: 1.2 },
            firstHit: [{ weight: 80, next: 'st' }, { weight: 20, next: 'jitan' }],
            jitanSpins: 100,
            st: { hitRate: 1 / 70, fallRate: 1 / 210 },
            hashira: { hitRate: 1 / 72.6, spins: 100 },   // 1 − (1 − 1/72.6)^100 ≒ 75%
            target: { st: 0.8, continuation: 0.75 },
            // 設定 1〜6 の 釘 (1000円で 約 8 〜 13.5 回転。3000発・上乗せで 出玉が 多い ぶん、しめて ある)
            settings: [{ hesoWidth: 6.1, heso: 0.032 }, { hesoWidth: 6.25, heso: 0.037 }, { hesoWidth: 6.6, heso: 0.041 },
                { hesoWidth: 7.2, heso: 0.045 }, { hesoWidth: 7.3, heso: 0.05 }, { hesoWidth: 7.6, heso: 0.054 }]
        }
    },

    // 演出の 数値 (筋書きは js/show.js の SHOW)。lcdZoom: 可動液晶 (見せ場で 液晶が 前へ せり出す) の 大きさ
    show: { lcdZoom: { scale: 1.42, offsetY: 6 } },

    machine: {
        holdMax: 4,
        // 変動の 時間 (秒)。通常時は 演出で きまる (show.js)。ST・時短中は 速い
        spin: { fast: 1.6, battle: 9 },
        // 大当たり: opening → ラウンド (count 個か maxTime 秒) → interval → … → ending
        bonus: { opening: 4, count: 10, maxTime: 25, interval: 1.2, ending: 5 },
        // 普図 (ゲート → 電チュー)。support = ST・時短中 (電サポ)
        futsu: {
            normal: { rate: 1 / 16, spin: 12, opens: 1, open: 0.2, gap: 0 },
            support: { rate: 1, spin: 1, opens: 3, open: 1.6, gap: 0.4 },
            holdMax: 4,
            denchuCount: 4
        }
    }
};
if (typeof module !== 'undefined') module.exports = { CONFIG };
