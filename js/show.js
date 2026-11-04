// =====================================================================
// 演出の 筋書き (どの 変動で 何を 見せるか。画面には さわらない)
// ---------------------------------------------------------------------
// Show.hold(config, m, fig, result, rng)   保留が 入った とき: 保留の 色・先読み
// Show.plan(config, m, ctx, rng)           変動の はじめ: 変動の 中身と 時間 (液晶は plan どおりに 描く)
// Show.stepStory(config, m, result, rng)   通常時の ストーリー (背景) を すすめる
//
// 通常時 (ストーリー 2026-11-03 ユーザー指定): こおりくんが 行方不明 → おにおにが さがす → 柱の氷の うわさ →
//   ライバル探検隊と 合流 → 柱の氷 (ハルゥ・オカディシ・カネーズ) と たたかう
//   背景 (2026-11-04 ユーザー指定): 雪が降る街・ゲームセンター・SE城・森。満月は 90% 以上、柱の神殿は 当たり確定 (保留に 当たりが ある ときに 出る)。
//     背景が かわって 5 回転 以内に また かわれば 当たり濃厚 (stepStory)
//   1・3・5 そろい (2026-11-04 ユーザー指定): 当たり確定で RASH へ。先読みも 予告も 出ない (result.sango)。ひび割れ → おにおにの 究極形態 → 咆哮 → おめでとう！
//   昇格チャレンジ (2026-11-04 ユーザー指定): 偶数図柄の 当たりの ラウンド中に、おにおに vs こおりくんの 影。ゲージの 色は 青 < 緑 < 紫 < 赤 < 虹 (虹は 確定)・レバーは 確定。
//     ST へ 行く 当たりの 約 6 割が とおる (result.promo)。のこりは 奇数図柄で そのまま RASH
//   変動の 流れ (2026-11-04 ユーザー指定): セリフ → ステップアップ予告 → 疑似連 (NEXT) → 群 → ミニゲーム → 失敗なら はずれ / 成功なら リーチ → SPリーチ → 撃破で 当たり
//   リーチ: ノーマル → 探検隊リーチ → SPリーチ (ハリージェネラル < アサタナ < ハルゥ < オカディシ < カネーズ) → 柱の氷リーチ (3 人 同時。80% 以上)
//   ミニゲーム (成功度の 低い 順): おかもぅダッシュ < イシイー遺跡チャレンジ < マッスルチャレンジ < ASAHARA宣言 < ゴールド金面犬発見チャレンジ (発見で 95% 当たり)
//   チャンスアップ: 保留の 色・セリフの 色・疑似連・カットインの 色・敵の カットインの 文字の 色 (白 < 赤 < 金。金は 80% 以上)・群 (ふぶき)・PUSH ボタン・金棒レバー・役物
//   rel = 出たら 当たる 割合。はずれで 出る 割合は スペックの 確率から rates() が 計算する
// ST (バトル): 当たり・転落の 変動は おにおにの バトル。相手で 撃破率が かわる (show.battle)
//   おにおにRASH の 流れ (2026-11-04 ユーザー指定): 柱の神殿を ダッシュ → リーチ → 敵の カットインと 撃破期待度 ★1〜5 →
//     (仲間が いれば 先に 攻撃) → 自分の 技 (白 青 緑 赤 金。白以外は 80% 以上) → 敵の 技 (紫 赤 金。金は 確定 = 威嚇) → 激突 (ボタン / レバー) →
//     勝てば 図柄ぞろい / 負ければ 画面が 赤く 点滅して 復活チャレンジ (20% で 覚醒して 復活・ダメなら まんなかが END 図柄で 終了)
//   仲間: リーチの 前や 当たりの 保留の 前に 合流する。チームで 来たら 当たり濃厚
//   相手は 結果から えらぶ: 当たりなら weight × 撃破率、転落なら weight × (1 − 撃破率)。
//   こう すると「その 相手が 出たときの 撃破率」が ちょうど kill に なる (weight は スペックの 継続率に 合わせて ある)
// 時短: はやい 変動。当たりは「こおりくんの 声が きこえた！」リーチから
// 柱の氷RASH (2026-11-04 ユーザー指定): 柱の氷が 主役。ライバルチーム・こおりくん・おにおにと たたかい、柱の氷が 勝てば 当たり。
//   基本は 勝負なし: ボタンが 虹色・ぶるぶる・レバブル・先バレ などで 柱の氷が 虹色に フラッシュして 図柄が そろう (sub 'flash')。
//   バトルの 当たりは 一発告知 か、一撃・連撃の レバー・ボタンが 虹色。それらが ないと ほぼ 当たらない (ごくまれに 当たる)
//   先バレ: 電チューに 玉が 入った しゅんかんに 光って 鳴る (当たりの 35%)
//   バトル: 柱の氷 (3人 集結は 大チャンス) vs 相手 (ライバルチーム / おにおに / こおりくん。おにおに・こおりくんは チャンス)。
//     わざは 一撃 (金棒レバーを 引く) か 連撃 (ボタンを 連打)。一撃の ほうが 期待度が 高い
// =====================================================================

const SHOW = {
    // ST の 相手 (2026-11-03 ユーザー指定: 撃破率が 高い 順に ハリージェネラル > ヒョウガリュウ > ハルゥ > オカディシ > カネーズ)
    enemies: {
        harigeneral: { name: 'ハリージェネラル', stars: 5, kill: 0.95, side: 'ally', ryuha: 'はり一族の 将軍', color: '#ffd84a', intro: 'はり一族の 力を 見よ！', win: '出直してくるがよい！', lose: 'ばかな… 針が 折れた…' },
        hyougaryu:   { name: 'ヒョウガリュウ', stars: 4, kill: 0.85, side: 'ally', ryuha: '氷河の 竜', color: '#7ad8ff' },
        asatana:     { name: 'アサタナ', kill: 0.6, side: 'hashira', ryuha: '柱の氷の 下っ端', color: '#a8c8e8', intro: 'ここは 通さないぞ！', win: 'へへっ ざまあみろ！', lose: 'ひいい… カネーズさま…' },
        haru:        { name: 'ハルゥ', stars: 3, kill: 0.70, side: 'hashira', ryuha: '嵐の 流派', color: '#9cf0b0', intro: '嵐が おまえを さらう！', win: '風は わたしの みかただ', lose: '嵐が… やんだ…' },
        okadishi:    { name: 'オカディシ', stars: 2, kill: 0.50, side: 'hashira', ryuha: '大渦の 流派', color: '#5a9cff', intro: '大渦に のまれろ！', win: 'うずの そこで ねむれ', lose: 'うずが… ほどける…' },
        kanezu:      { name: 'カネーズ', stars: 1, kill: 0.30, side: 'hashira', ryuha: '吹雪の 流派', color: '#e0e8ff', intro: '古き しきたりに したがえ！', win: 'これが こおり一族の 力だ', lose: 'しきたりが… くずれる…' }
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
    // おにおにRASH の バトル。hit: 勝つ ように 見える バトル / fall: 負ける ように 見える バトル (転落と 復活する 当たり)
    stBattle: {
        revive: 0.2,      // 負けた ように 見えた バトルの うち 覚醒して 復活する 割合
        self: { hit: { white: 35, blue: 20, green: 20, red: 15, gold: 10 }, fall: { white: 80, blue: 10, green: 6, red: 3, gold: 1 } },
        foe: { hit: { purple: 55, red: 30, gold: 15 }, fall: { purple: 80, red: 20, gold: 0 } },
        selfMoves: { white: '金棒ふり', blue: '鬼火パンチ', green: '鬼鬼ラッシュ', red: '鬼鬼の金棒', gold: '鬼鬼の金棒・極' },
        // 仲間の 合流: hit / fall は 当たり・転落の 回転で (リーチの 前に。2026-11-04 ユーザー指定: 当たりの 回転でも 合流する)、aheadHit / aheadFall は 保留に バトルが ある はずれの 回転で、miss は ふつうの はずれで
        join: { hit: 0.35, fall: 0.08, aheadHit: 0.3, aheadFall: 0.1, miss: 0.004 },
        team: { hit: 0.25, fall: 0.01 },     // 合流が チーム (3 人) に なる 割合
        allyMoves: { okagappa: 'おかピポっと光線', hibikimakuri: '大音響4DX', yamamou: 'おちょくりボーンフィーバー', sasaki: 'ASAスラッシュ', kotani: 'NABIテンポ', asahara: 'DOPAPANCHI', shibata: 'シバタードライバー', ikekimu: 'イケキムドライブ', ueno: 'マッスルウエノクラッシュ' },
        time: { reach: 1, reachHold: 1.4, join: 1.8, enemy: 2.4, ally: 2.4, team: 3.6, self: 1.8, foe: 1.8, clash: 1, action: 2.2, red: 1.4, revive: 3, end: 2 }
    },
    teams: [
        { name: 'チーム5DX', members: ['okagappa', 'hibikimakuri', 'yamamou'] },
        { name: 'チームASK-3', members: ['sasaki', 'kotani', 'asahara'] },
        { name: 'チームお願いマッスル', members: ['shibata', 'ueno', 'ikekimu'] }
    ],
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
    // 昇格チャレンジ。st: ST へ 行く 当たりの うち 偶数図柄で ここを とおる 割合 / weights: ゲージの 色の 重み (win: 成功 / lose: 失敗) / lever: 成功の ときに レバーに なる 割合
    //   time: 液晶の 流れ (秒)。intro → charge (ためる) → decide (色が きまる) → clash (激突・ボタンか レバー) → end
    promo: {
        st: 0.6, lever: 0.35,
        gauge: ['blue', 'green', 'purple', 'red', 'rainbow'],
        names: { blue: '青', green: '緑', purple: '紫', red: '赤', rainbow: '虹' },
        colors: { blue: '#3f8cff', green: '#3fcf5f', purple: '#a860ff', red: '#ff3a3a' },
        weights: { win: { blue: 5, green: 10, purple: 20, red: 30, rainbow: 35 }, lose: { blue: 45, green: 30, purple: 18, red: 7, rainbow: 0 } },
        time: { intro: 2.5, charge: 7.5, decide: 9, clash: 13, end: 15.5 }
    },
    // オープニング・エンディング (2026-11-04 ユーザー指定)。エンディングは 10 連目の 大当たりの あと。場面: dur 秒 / bg 背景 / who キャラ / text 文字
    story: {
        endingAt: 10,
        opening: [
            { dur: 3.5, bg: 'town', who: ['koori'], text: 'ここは 雪が 降る 街…' },
            { dur: 2.5, bg: 'black', who: [], text: 'ある夜…' },
            { dur: 3.5, bg: 'town', who: ['onioni'], text: 'こおりくんが いない…！！' },
            { dur: 3.5, bg: 'tavern', who: ['onioni', 'okagappa'], text: '柱の氷が さらったと いう うわさを 耳にした' },
            { dur: 4, bg: 'hideout', who: ['haru', 'okadishi', 'kanezu'], shadow: true, text: 'こおり一族の 悪の 一派「柱の氷」' },
            { dur: 4, bg: 'snowfield', who: ['onioni', 'okagappa', 'hibikimakuri', 'yamamou'], text: 'ライバル探検隊と ともに 旅が はじまる！' },
            { dur: 4.5, bg: 'battle', who: [], title: true }
        ],
        ending: [
            { dur: 4, bg: 'hideout', who: ['onioni', 'haru', 'okadishi', 'kanezu'], text: '柱の氷との たたかいは ついに 決着！' },
            { dur: 3, bg: 'black', who: [], text: '氷の おくから 声が きこえる…' },
            { dur: 4, bg: 'hideout', who: ['koori'], text: 'こおりくんを とりもどした！！' },
            { dur: 4, bg: 'town', who: ['koori', 'onioni'], text: 'ふたりは 雪が 降る 街へ もどった' },
            { dur: 4.5, bg: 'town', who: ['okagappa', 'hibikimakuri', 'yamamou', 'koori', 'onioni'], text: 'ライバル探検隊も いっしょに おいわい！' },
            { dur: 5, bg: 'bonus', who: ['koori'], end: true }
        ]
    },
    // 先バレ (2026-11-04 ユーザー指定: 通常時も どちらの RASH も 発生。咆哮の ほうが 期待度が 高い)。通常時は hit: 当たりの ときの 割合 / rel: 出たら 当たる 割合。
    //   RASH 中は hashira.senbare の 割合。先バレの ときの ボタンの 色は 紫か 金 (金は RASH 突入濃厚)。gold: hit は 当たり (RASH へ 行く もの) の ときに 金に なる 割合・miss は それ以外
    senbare: { voice: { hit: 0.12, rel: 0.5 }, roar: { hit: 0.06, rel: 0.85 }, gold: { hit: 0.35, miss: 0.002 } },
    // 1・3・5 そろい: ST へ 行く 通常時の 当たりの うち この 割合。はずれは 1・3・5 に ならない
    sango: 0.08,
    // 背景: 満月の rel は 90% 以上 (rates が はずれの 割合を 計算する)。hitAhead は 保留に 当たりが ある 1 回転ごとの 出やすさ
    stage: { moon: { hitAhead: 0.1, hit: 0.1, rel: 0.95 }, temple: { hitAhead: 0.05 }, change: 0.35, fast: 0.7, fastMiss: 0.0002 },
    // ステップアップ予告 (前作から。3 段目の 文字が 赤なら チャンス・金なら 約 90%)。hit: 当たりの ときの 割合 / rel: 出たら 当たる 割合
    stepUp: {
        time: 1.1, tail: 0.5,
        outcomes: {
            s1: { step: 1, color: 'white', hit: 0.08, rel: 0.03 }, s2: { step: 2, color: 'white', hit: 0.12, rel: 0.08 },
            s3: { step: 3, color: 'white', hit: 0.1, rel: 0.25 }, s3red: { step: 3, color: 'red', hit: 0.12, rel: 0.55 },
            s3gold: { step: 3, color: 'gold', hit: 0.08, rel: 0.9 }
        },
        kinds: [
            { who: ['onioni', 'okagappa', 'harigeneral'], text: ['おにおにが さがしている…', 'ライバル探検隊が 手がかりを！', 'こおりくんは 近いぞ！'] },
            { who: ['asatana', 'haru', 'kanezu'], text: ['柱の氷の けはい…', 'ふぶきが 強くなる…', 'カネーズが 見ている！'] },
            { who: ['furukawa', 'tomoishi', 'koori'], text: ['こおりくんの うわさ…', '声が きこえる…', 'こおりくんが よんでいる！'] }
        ]
    },
    // 違和感 (前作から。変動の はじめに なにかが おかしい。見た目だけなので Math.random で えらぶ)
    iwakan: {
        noise: { name: '液晶に ノイズ', hit: 0.04, rel: 0.7 }, silent: { name: '音が 消える', hit: 0.03, rel: 0.75 },
        reverse: { name: '図柄が 逆に 回る', hit: 0.03, rel: 0.8 }, stop: { name: '図柄が 一瞬 止まる', hit: 0.03, rel: 0.8 },
        lamp: { name: '画面が チカチカ', hit: 0.02, rel: 0.85 }
    },
    // 全回転 (前作から 5 種類)。figure: そろう 図柄 (奇数は ST へ 行く 当たり・偶数は それ以外)
    zenkaiten: {
        koori: { name: 'こおりくん', figure: 1 }, onioni: { name: 'おにおに', figure: 7 }, hibiki: { name: 'ひびきまくり', figure: 5 },
        okagappa: { name: 'おかがっぱ', figure: 4 }, hyougaryu: { name: 'ヒョウガリュウ', figure: 8 }
    },
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
        { id: 'town', name: '雪が降る街', bg: 'town' },
        { id: 'arcade', name: 'ゲームセンター', bg: 'arcade' },
        { id: 'castle', name: 'SE城', bg: 'castle' },
        { id: 'forest', name: '森', bg: 'forest' },
        { id: 'moon', name: '満月', bg: 'moon' },
        { id: 'temple', name: '柱の神殿', bg: 'temple' }
    ],
    hashira: {
        // 先バレ [当たり, はずれ] (2026-11-04 ユーザー指定で 2 種類): voice = 前作の 音を 低く した もの / roar = おにおにの 先咆哮 (こっちが アツい)。
        // どちらも 台の ボタンが 赤く 光る
        senbare: { voice: [0.22, 0.0012], roar: [0.13, 0.0003] },
        flash: 0.65,                                     // 当たりの うち 勝負なしで そろう (のこりは バトル)
        notices: { rainbow: 40, buru: 30, lever: 30 },   // 勝負なしの 知らせ (先バレが あれば 先バレ): ボタンが 虹色 / ぶるぶる / レバブル
        battleHit: { ippatsu: 50, rainbow: 40, plain: 10 },   // バトルの 当たり: 一発告知 / 虹色の レバー・ボタン / なにも なし
        missBattle: 0.1,                                 // はずれの バトルの 割合
        rival: { hit: { rival: 40, onioni: 35, koori: 25 }, miss: { rival: 84, onioni: 12, koori: 4 } },
        shuketsu: [0.4, 0.008],                          // 柱の氷 集結 [当たり, はずれ]
        ichigeki: [0.62, 0.2]                            // 一撃 (のこりは 連撃) [当たり, はずれ]
    },
    storyEvery: 40,        // だいたい 何回転で 場面が すすむ か (はずれの とき)
    // 変動の 時間 (秒)
    // plain: はずれの 変動 (リーチなし) を、のこりの 保留 (0〜3) ごとに。保留が たまるほど 速い (設定が 高くて よく 入る 台でも 回る ように)
    // missReachByHolds: はずれの リーチの 出やすさを、のこりの 保留ごとに 何倍に するか (保留が たまると リーチが へる)
    plainByHolds: [5.2, 4, 2.4, 1.4],
    missReachByHolds: [1, 1, 0.6, 0.35],
    // next: 疑似連 1 回 / gun: 群 / mini: ミニゲーム / miniFail: 失敗の あと 図柄が 止まるまで / charge: チャージの 変動 / sp: SPリーチごと
    // crack: 1・3・5 の あとの 流れ (秒)。ひび → 究極形態が 出る → 画面を 粉砕 → 咆哮 → おめでとう！
    crack: { crack: 1.5, emerge: 3.7, smash: 4.7, roar: 6.9, end: 9.5 },
    time: { sango: 14, sangoStop: 4.5, post: 6.5, postStop: 4, oneshot: 4, oneshotStop: 2.2, next: 1.6, gun: 2.5, mini: 6.5, miniFail: 2.4, charge: 3.6, sp: { harigeneral: 22, asatana: 23, haru: 25, okadishi: 26, kanezu: 28, hashiraAll: 32 },
        normalReach: 11, tanken: 18, zenkaiten: 14, stMiss: 1.8, stJoin: 3.2, stTease: 4.5, battle: 12, jitan: 1.6, jitanReach: 9, hQuick: 1.8, hFlash: 4.6, hBattle: 11 }
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
        const fromRel = v => v.hit * odds * (1 - v.rel) / v.rel;
        const step = Object.fromEntries(Object.entries(SHOW.stepUp.outcomes).map(([k, v]) => [k, fromRel(v)]));
        const iwakan = Object.fromEntries(Object.entries(SHOW.iwakan).map(([k, v]) => [k, fromRel(v)]));
        const senbare = { voice: fromRel(SHOW.senbare.voice), roar: fromRel(SHOW.senbare.roar) };
        const out = { reachMiss, mini, text, step, iwakan, senbare, moon: fromRel(SHOW.stage.moon) };
        rateCache.set(m.specId, out);
        return out;
    }
    const pickText = (w, rng) => { const r = rng(); return r < w.gold ? 'gold' : r < w.gold + w.red ? 'red' : 'white'; };
    function speech(heat, rng, mode) {
        const L = SHOW.lines;
        if (mode === 'off' || rng() >= L.appear[heat] * (mode === 'often' ? 1.6 : 1)) return null;
        const c = Number(pick(L.colorWeights[heat], rng)), list = L.text[c];
        return { text: list[Math.floor(rng() * list.length)], color: L.colors[c] };
    }

    // 先バレの ボタンの 色
    function buttonColor(toRash, rng) {
        return rng() < (toRash ? SHOW.senbare.gold.hit : SHOW.senbare.gold.miss) ? 'gold' : 'purple';
    }
    // RASH 中の 先バレ
    function rashSenbare(result, rng) {
        const i = isHit(result) ? 0 : 1, r = rng();
        const { voice, roar } = SHOW.hashira.senbare;
        const senbare = r < roar[i] ? 'roar' : r < roar[i] + voice[i] ? 'voice' : null;
        return { holdColor: 'white', shownColor: 'white', senbare, btn: senbare ? buttonColor(isHit(result), rng) : null };
    }

    // ----- 保留 -----
    function hold(config, m, fig, result, rng) {
        if (m.mode === 'hst' || m.mode === 'st') return rashSenbare(result, rng);
        if (fig === 2) return { holdColor: 'white', shownColor: 'white' };
        // 1・3・5 そろい: 先読みなし
        if (isHit(result) && result.next === 'st' && m.mode === 'normal' && rng() < SHOW.sango) return { holdColor: 'white', shownColor: 'white', sango: true };
        // 昇格チャレンジを とおるか (偶数図柄)。ST へ 行かない 当たりは ぜんぶ、ST へ 行く 当たりは promo.st
        const promo = isHit(result) && m.mode === 'normal' && fig === 1 && (result.next !== 'st' || rng() < SHOW.promo.st);
        const senyomi = { none: 0, chance: 0.5, recommend: 1, hot: 1.6 }[m.fx.senyomi || 'recommend'];
        // 保留の 色: 当たりかで 出やすさが ちがう
        let color = 'white';
        const r = rng();
        let acc = 0;
        for (const [c, t] of Object.entries(SHOW.holdColors)) {
            if (c === 'white') continue;
            acc += (isHit(result) ? t.hit : t.miss) * senyomi;
            if (r < acc) { color = c; break; }
        }
        if (result.force === 'reach' && color === 'white') color = 'blue';
        // 保留変化: 白で 入って 変動の はじめに 色が かわる (ときどき)
        const shown = color !== 'white' && rng() < 0.4 ? 'white' : color;
        // 先バレ (先読みなしの カスタマイズでは 出さない)
        let senbare = null;
        if (m.mode === 'normal' && senyomi > 0) {
            const S = SHOW.senbare, R = rates(m), hit = isHit(result), v = rng();
            const roar = hit ? S.roar.hit : R.senbare.roar, voice = hit ? S.voice.hit : R.senbare.voice;
            senbare = v < roar ? 'roar' : v < roar + voice ? 'voice' : null;
        }
        return { holdColor: color, shownColor: shown, promo, senbare, btn: senbare ? buttonColor(isHit(result) && result.next === 'st', rng) : null };
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
            const n = result.next === 'st' && !result.promo ? odd[Math.floor(rng() * odd.length)] : even[Math.floor(rng() * even.length)];
            return [n, n, n];
        }
        if (reach) {
            // 7 の リーチは 当たり確定 (2026-11-04 ユーザー指定) なので はずれでは 出さない
            let n = d();
            while (n === 7) n = d();
            let c = d();
            if (c === n) c = n % 9 + 1;
            return [n, c, n];
        }
        let a = d(), b = d(), c = d();
        if (a === c) c = c % 9 + 1;
        if (a === 1 && b === 3 && c === 5) c = 7;   // 1・3・5 は 当たり確定なので はずれでは 出さない
        return [a, b, c];
    }

    function normalPlan(config, m, ctx, result, rng) {
        const hit = isHit(result);
        const T = SHOW.time, R = rates(m);
        const p = { kind: 'normal', hit, holdColor: result.holdColor, shownColor: result.shownColor };
        if (result.sango) return { ...p, sango: true, hit: true, next: 'st', reach: null, figures: [1, 3, 5], duration: T.sango, stopAt: T.sangoStop };
        // 告知の カスタマイズ: 後告知・一発告知は 演出なしで 当たりを 知らせる (デバッグで リーチを えらんだ ときは そのまま)
        const notice = m.fx.notice;
        if (hit && !result.forceReach && !result.forceMini && (notice === 'post' || notice === 'oneshot')) {
            const figs = figures(result, true, rng);
            if (notice === 'post') return { ...p, post: true, next: result.next, reach: null, figures: figs, fake: figures({ kind: 'miss' }, false, rng), duration: T.post, stopAt: T.postStop };
            return { ...p, oneshot: true, next: result.next, reach: null, figures: figs, duration: T.oneshot, stopAt: T.oneshotStop };
        }
        p.pre = hit && notice === 'pre';
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
        // ステップアップ予告
        let step = result.forceStep || null;
        if (!step && reach !== 'zenkaiten') {
            const r = rng();
            let acc = 0;
            for (const [k, v] of Object.entries(SHOW.stepUp.outcomes)) {
                acc += hit ? v.hit : R.step[k] * holdsK;
                if (r < acc) { step = k; break; }
            }
        }
        if (step) {
            const o = SHOW.stepUp.outcomes[step];
            p.step = { id: step, step: o.step, color: o.color, kind: Math.floor(rng() * SHOW.stepUp.kinds.length) };
            if (o.step === 3 && !reach) { reach = 'tanken'; mini = null; }   // 3 段目まで 行ったら リーチには なる
        }
        p.reach = reach;
        p.mini = mini;
        p.figures = figures(result, Boolean(reach), rng);
        if (reach === 'zenkaiten' && hit) {
            const list = Object.entries(SHOW.zenkaiten).filter(([, v]) => (v.figure % 2 === 1) === (result.next === 'st' && !result.promo));
            const [id, v] = list[Math.floor(rng() * list.length)];
            p.zenkaiten = id;
            p.figures = [v.figure, v.figure, v.figure];
        }
        // 違和感 (見た目だけ)
        {
            const r = Math.random();
            let acc = 0;
            for (const [k, v] of Object.entries(SHOW.iwakan)) {
                acc += hit ? v.hit : R.iwakan[k];
                if (r < acc) { p.iwakan = k; break; }
            }
        }
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
        p.line = speech(heat, rng, m.fx.line);
        // 当たりの ときの 告知: 役物が 落ちる (yaku) か、決め手の あとに 当たり
        // 図柄が 止まりはじめる 前の 時間 (lead): 疑似連 → 群 → ミニゲーム。t はそれぞれの はじまる 秒
        const stepT = p.step ? p.step.step * SHOW.stepUp.time + SHOW.stepUp.tail : 0;
        p.t = { step: 0.4, gizi: 0.6 + stepT };
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

    // おにおにRASH の 仲間 (だれか 1 人 / チームなら 3 人)
    function pickAlly(good, rng, force) {
        const team = SHOW.teams[Math.floor(rng() * SHOW.teams.length)];
        if (force === 'team' || (!force && rng() < SHOW.stBattle.team[good ? 'hit' : 'fall'])) return { team: team.name, members: team.members };
        return { team: null, members: [team.members[Math.floor(rng() * 3)]] };
    }

    // ST: はずれは はやく。当たり・転落は リーチから バトル
    function stPlan(config, m, result, rng) {
        const T = SHOW.time, B = SHOW.stBattle, BT = B.time;
        if (result.kind === 'miss') {
            // 仲間の 合流 (当たりの 保留の 前に 来やすい)
            const hitAhead = m.holds[2].some(h => isHit(h)), fallAhead = m.holds[2].some(h => h.kind === 'fall');
            let joined = null;
            if (!m.stAlly && rng() < (hitAhead ? B.join.aheadHit : fallAhead ? B.join.aheadFall : B.join.miss)) joined = m.stAlly = pickAlly(hitAhead, rng);
            const tease = rng() < SHOW.stTease;
            return { kind: 'stMiss', figures: figures(result, false, rng), tease: tease ? pickEnemyAny(m, rng) : null, joined, duration: joined ? T.stJoin : tease ? T.stTease : T.stMiss };
        }
        const hit = isHit(result);
        const enemy = result.forceEnemy || battleEnemy(m.specId, hit, rng);
        const e = SHOW.enemies[enemy];
        let chance;
        if (enemy === 'harigeneral') chance = rng() < (hit ? SHOW.harigeneralChance.hit : SHOW.harigeneralChance.fall);
        else chance = rng() < (hit ? SHOW.chanceUp.hit : SHOW.chanceUp.fall);
        // 復活: 負けた ように 見えた バトルの revive が 復活に なる ように、当たりの 一部を「負けて 復活」に する
        const st = m.spec.st, reviveShare = B.revive / (1 - B.revive) * st.fallRate / st.hitRate;
        const revive = !hit ? 'fail' : result.forceRevive || rng() < reviveShare ? 'win' : 'none';
        const looksWin = revive === 'none', pool = looksWin ? 'hit' : 'fall';
        // 仲間: すでに 合流している か、リーチの 前に 合流する
        let ally = m.stAlly, joinNow = false;
        if (result.forceStAlly) { ally = pickAlly(hit, rng, result.forceStAlly); joinNow = true; }
        else if (!ally && rng() < B.join[hit ? 'hit' : 'fall']) { ally = pickAlly(hit, rng); joinNow = true; }
        m.stAlly = null;
        const self = result.forceSelf || pick(B.self[pool], rng);
        const foe = result.forceFoe || pick(B.foe[pool], rng);
        const allyColor = ally ? pick(B.self[pool], rng) : null;
        // 決め手: 金棒レバーは ほぼ 撃破
        const action = looksWin ? (rng() < 0.35 ? 'lever' : 'push') : (rng() < 0.03 ? 'lever' : 'push');
        // 7 の リーチは 当たり確定なので 転落では 出さない
        const odd = hit ? [1, 3, 5, 7, 7, 7] : [1, 3, 5], n = odd[Math.floor(rng() * odd.length)];
        // 時間の ならび
        const t = {};
        let c = 0.4;
        if (joinNow) { t.join = c; c += BT.join; }   // 合流は リーチの 前
        t.reach = c + BT.reach - 0.4;
        c = t.reach + BT.reachHold;
        t.enemy = c; c += BT.enemy;
        if (ally) { t.ally = c; c += ally.team ? BT.team : BT.ally; }
        t.self = c; c += BT.self;
        t.foe = c; c += BT.foe;
        t.clash = c; c += BT.clash;
        t.action = c; c += BT.action;
        t.result = c;
        if (!looksWin) { t.red = c; c += BT.red; t.revive = c; c += BT.revive; t.end = c; } else t.end = c;
        c += BT.end;
        return {
            kind: 'battle', hit, enemy, enemyName: e.name, kill: e.kill, stars: e.stars, chance, action, revive, ally, self, foe, allyColor, t,
            textColor: result.forceText || pickText(SHOW.battleText[hit ? 'hit' : 'st'], rng),
            yaku: looksWin && rng() < 0.15,
            figures: hit ? [n, n, n] : [n, 'END', n],
            duration: c
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
        // 基本は 勝負なし
        if (hit && !result.forceBattle && (result.forceNotice || rng() < H.flash)) {
            const notice = result.forceNotice || (result.senbare ? 'senbare' : pick(H.notices, rng));
            return { ...base, sub: 'flash', notice, noticeAt: 0.5, duration: T.hFlash };
        }
        if (!hit && !result.forceBattle && rng() >= H.missBattle) return { ...base, sub: 'quick', duration: T.hQuick };
        const rival = result.forceAlly || pick(hit ? H.rival.hit : H.rival.miss, rng);
        const shuketsu = result.forceShuketsu !== undefined ? result.forceShuketsu : rng() < H.shuketsu[hit ? 0 : 1];
        const enemies = shuketsu ? ['haru', 'okadishi', 'kanezu'] : [['haru', 'okadishi', 'kanezu'][Math.floor(rng() * 3)]];
        const ichigeki = result.forceAttack ? result.forceAttack === 'ichigeki' : rng() < H.ichigeki[hit ? 0 : 1];
        const textColor = result.forceText || pickText(SHOW.battleText[hit ? 'hit' : 'hst'], rng);
        const hKind = hit ? result.forceHKind || pick(H.battleHit, rng) : 'plain';
        const extra = shuketsu ? 1.5 : 0;
        const ippatsuAt = hKind === 'ippatsu' ? 3.4 + extra : null;
        return { ...base, sub: 'battle', textColor, rival, enemies, shuketsu, hKind, rainbow: hKind === 'rainbow', ippatsuAt, attack: ichigeki ? 'ichigeki' : 'rengeki', action: ichigeki ? 'lever' : 'mash', duration: ippatsuAt ? ippatsuAt + 3.6 : T.hBattle + extra };
    }

    // 時短: はやい 変動。当たりは リーチ
    function jitanPlan(m, ctx, result, rng) {
        const T = SHOW.time;
        const hit = isHit(result);
        const reach = hit || rng() < 0.03;
        return { kind: 'jitan', hit, reach, figures: figures(result, reach, rng), duration: reach ? T.jitanReach : T.jitan, last: ctx.lastJitan, next: hit ? 'st' : null };
    }

    // ----- ストーリー -----
    // 背景を かえるか きめる。かわらなければ null
    //   はずれは 背景が かわって 5 回転の あいだは ほとんど かわらない → 5 回転 以内に また かわれば 当たり濃厚。
    //   満月・柱の神殿は 保留に 当たりが ある ときに 出る (満月は ごくまれに はずれでも)。1・3・5 は 先読みなしなので 数えない
    function stepStory(config, m, result, rng) {
        if (result.sango) return null;
        const ahead = m.fx.senyomi !== 'none' && m.holds[1].some(h => isHit(h) && !h.sango);
        const hitAhead = isHit(result) || ahead;
        const S = SHOW.stage, nextStage = () => (m.story + 1) % 4;
        if (m.story >= 4) return hitAhead ? null : Math.floor(rng() * 4);
        if (hitAhead) {
            const r = rng();
            if (r < S.temple.hitAhead) return 5;
            if (r < S.temple.hitAhead + S.moon.hitAhead) return 4;
            return rng() < (m.storySpins <= 5 ? S.fast : S.change) ? nextStage() : null;
        }
        if (rng() < rates(m).moon) return 4;
        if (m.storySpins <= 5) return rng() < S.fastMiss ? nextStage() : null;
        return rng() < 1 / SHOW.storyEvery ? nextStage() : null;
    }

    // 昇格チャレンジの ゲージの 色と 決め手
    function promoPlan(win, rng) {
        return { color: pick(SHOW.promo.weights[win ? 'win' : 'lose'], rng), action: win && rng() < SHOW.promo.lever ? 'lever' : 'push' };
    }

    // ST の 相手の、出たときの 撃破率 (表示・テスト用)
    function killRate(enemy) { return SHOW.enemies[enemy].kill; }

    return { hold, plan, stepStory, killRate, battleEnemy, rates, promoPlan };
})();
if (typeof module !== 'undefined') module.exports = { SHOW, Show };
