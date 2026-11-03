# CLAUDE.md

このリポジトリで作業する Claude への約束です。

- 返事・コメント・書類は日本語で書く。ゲームの中の文字は、ほかのこおりくんシリーズと同じく ひらがな多め・分かち書き。
- これは 「Pこおりくんの大冒険外伝 ～おにおにの挑戦 めざめる３人の氷達～」(2026-11-03 ユーザー指定)。前作 koori-pachinko の 物理 (physics.js・board.js) を 使い、ほかは この台の ために 作った。
- スペック: 1/319 (3R・ST 50%/時短100 50%・継続 約80%) と 1/399 (10R・ST 80%/時短100 20%・継続 約75%)。ST は 2 つ (2026-11-04): おにおにRASH (転落型) と 柱の氷RASH (100回 ST・一発告知と 先バレ)。
- 設定 1〜6 (2026-11-04): 前作と おなじく 釘 (ヘソの すき間) で つける。出玉率の 目標は `CONFIG.settingRtp` (80〜120%)、釘と ヘソに 入る 割合は `spec.settings`。たしかめは `node tools/test.js --settings --hours 2000` (1/399 は ぶれが 大きい)。釘を かえたら `node tools/flow.js 27 --heso <幅>` で 入る 割合を 測りなおす。設定示唆は トロフィー (`CONFIG.settingHint`)。
- 柱の氷RASH の 先バレは 2 つ: 前作の 録音 (`js/sound-heso.js`) を 低く した 音 と、おにおにの 先咆哮 (自作の 音)。どちらも ボタンが 赤く 光る。ボタン・レバーが 震える ときは CSS の vibrate と Sound の buzz。
- 抽選は `js/machine.js` (画面に ふれない)、演出の 筋書きは `js/show.js`、液晶は `js/lcd.js`、盤面の 絵と 役物は `js/render.js`、筐体・金棒レバーは `js/cabinet.js`。数値は `js/config.js`。
- 前作の キャラの 絵は koori-card の `src/art/legacy-art.js` から 写した (`js/art-legacy.js`)。柱の氷の 3 人と 金棒は `js/art.js`。
- テスト: `node tools/test.js` (抽選・継続率・撃破率・演出の 信頼度)。盤面の 玉の 流れは `node tools/flow.js`・`tools/trace.html`。コミットの 前に .githooks/pre-commit が テストする (`git config core.hooksPath .githooks`)。
- 画面の 確認: `sh tools/shot.sh "index.html?spec=s319&force=hit&skip=5" out.png 1000,1100` (force: hit / hitJitan / reach / st / stHit / fall / jitan / hst / hstHit / hstMiss。&setting=6・&senbare=roar|voice。&debug=1 で デバッグの ボタン)。
- main に push すると GitHub Pages に 公開される。変更が できて テストが 通ったら、聞かずに commit して main に push する。
