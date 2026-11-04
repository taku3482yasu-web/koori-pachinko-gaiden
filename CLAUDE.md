# CLAUDE.md

このリポジトリで作業する Claude への約束です。

- 返事・コメント・書類は日本語で書く。ゲームの中の文字は、ほかのこおりくんシリーズと同じく ひらがな多め・分かち書き。
- これは 「Pこおりくんの大冒険外伝 ～おにおにの挑戦 めざめる３人の氷達～」(2026-11-03 ユーザー指定)。前作 koori-pachinko の 物理 (physics.js・board.js) を 使い、ほかは この台の ために 作った。
- スペック: 1/319 (3R・ST 50%/時短100 50%・継続 約80%) と 1/399 (ST 50%/時短100 50%・継続 約75%。RASH は LT = `spec.lt` で 名前の よこに LT)。ST は 2 つ (2026-11-04): おにおにRASH (転落型) と 柱の氷RASH (100回 ST・一発告知と 先バレ)。
- チャージ (2026-11-04。`spec.charge`): 通常時の ヘソで 1/200 (Claude が きめた) の 300発。そのあいだ 右打ち。5% で ST、のこりは 通常時へ (初当たりに 数えない)。
- 1/399 の 出玉 (2026-11-04): 初当たりは ST へ 行くなら 3000発 (20R)、時短へ 行くなら 1500発 (10R)。RASH・時短の 当たりは 3000発 25%・1500発 25%・上乗せタイム 50% (ラウンド中 10 秒 以内に 違和感 → +1500発。成功 50%)。`spec.payout`・`spec.uwanose`。確認は `&force=stHit&pay=uwanose&uwanose=1&auto=1`。
- 設定 1〜6 (2026-11-04): 前作と おなじく 釘 (ヘソの すき間) で つける。出玉率の 目標は `CONFIG.settingRtp` (80〜120%。1/399 は `spec.settingRtp`: ユーザー指定で 設定1〜5 は 90〜135%、設定6 は 1/319 の 設定6 より 回す 約245%)、釘と ヘソに 入る 割合は `spec.settings`。たしかめは `node tools/test.js --settings --hours 2000` (1/399 は ぶれが 大きい)。釘を かえたら `node tools/flow.js 27 --heso <幅>` で 入る 割合を 測りなおす。設定示唆は トロフィー (`CONFIG.settingHint`)。
- 通常時の 変動 (2026-11-04): セリフ → 疑似連 → 群 → ミニゲーム (成功で リーチ・失敗で はずれ) → SPリーチ。図柄は 左 → 右 → まんなかの 順に 止める (まんなかが さいごで ないと リーチの 結果が 見える)。
  SPリーチは ハリージェネラル < アサタナ (柱の氷の 下っ端) < ハルゥ < オカディシ < カネーズ < 柱の氷リーチ (3 人 同時。80% 以上。`drawHashiraReach`)。ミニゲームは `SHOW.minis` (金面犬は 発見で 95%)。敵の カットインの 文字は 白 < 赤 < 金 (`plan.textColor`。金は 80% 以上)。
  `rel` = 出たら 当たる 割合。はずれの 割合は `Show.rates` が スペックの 確率から 計算する。おかもぅ・マッスルイケノーブルの 絵は ユーザー指定で やまもぅ・マッスルウエノーブルの 絵を 使う (art.js)。
- 柱の氷RASH の 先バレは 2 つ: 前作の 録音 (`js/sound-heso.js`) を 低く した 音 と、おにおにの 先咆哮 (自作の 音)。どちらも ボタンが 赤く 光る。ボタン・レバーが 震える ときは CSS の vibrate と Sound の buzz。
- 抽選は `js/machine.js` (画面に ふれない)、演出の 筋書きは `js/show.js`、液晶は `js/lcd.js`、盤面の 絵と 役物は `js/render.js`、筐体・金棒レバーは `js/cabinet.js`。数値は `js/config.js`。
- 前作の キャラの 絵は koori-card の `src/art/legacy-art.js` から 写した (`js/art-legacy.js`)。柱の氷の 3 人と 金棒は `js/art.js`。
- テスト: `node tools/test.js` (抽選・継続率・撃破率・演出の 信頼度)。盤面の 玉の 流れは `node tools/flow.js`・`tools/trace.html`。コミットの 前に .githooks/pre-commit が テストする (`git config core.hooksPath .githooks`)。
- 画面の 確認: `sh tools/shot.sh "index.html?spec=s319&force=hit&skip=5" out.png 1000,1100` (force: hit / hitJitan / reach / st / stHit / fall / jitan / hst / hstHit / hstMiss。&setting=6・&senbare=roar|voice。force=charge|chargeSt・&reach=hashiraAll・&mini=goldDog&miniWin=0・&text=gold・&gizi=2。画面の「デバッグ」ボタンで リーチ・ミニゲーム・文字の 色・疑似連・チャージを えらべる。&debug=1 なら はじめから ひらく)。
- main に push すると GitHub Pages に 公開される。変更が できて テストが 通ったら、聞かずに commit して main に push する。
