# CLAUDE.md

このリポジトリで作業する Claude への約束です。

- 返事・コメント・書類は日本語で書く。ゲームの中の文字は、ほかのこおりくんシリーズと同じく ひらがな多め・分かち書き。
- これは 「Pこおりくんの大冒険外伝 ～おにおにの挑戦 めざめる３人の氷達～」(2026-11-03 ユーザー指定)。前作 koori-pachinko の 物理 (physics.js・board.js) を 使い、ほかは この台の ために 作った。
- スペック: 1/319 (初当たり・時短 3R、RASH 中は 10R (`spec.rashRounds`)・ST 50%/時短100 50%・継続 約80%) と 1/399 (ST 50%/時短なし 50%・継続 約75%。RASH は LT = `spec.lt` で 名前の よこに LT)。ST は 2 つ (2026-11-04): おにおにRASH (転落型) と 柱の氷RASH (100回 ST・一発告知と 先バレ)。
- チャージ (2026-11-04。`spec.charge`): 通常時の ヘソで 1/200 (Claude が きめた) の 300発。そのあいだ 右打ち。5% で ST、のこりは 通常時へ (初当たりに 数えない)。
- 1/399 の 出玉 (2026-11-04): 初当たりは ST へ 行くなら 3000発 (20R)、それ以外は 1500発 (10R) で 通常時へ (時短なし)。RASH・時短の 当たりは 3000発 25%・1500発 25%・上乗せタイム 50% (ラウンド中 10 秒 以内に 違和感 → +1500発。成功 50%)。`spec.payout`・`spec.uwanose`。確認は `&force=stHit&pay=uwanose&uwanose=1&auto=1`。
- 設定 1〜6 (2026-11-04): 前作と おなじく 釘 (ヘソの すき間) で つける。出玉率の 目標は `spec.settingRtp` (1/319 は ユーザー指定で 回転数を 優先して 約120〜180%。1/399 は ユーザー指定で 設定1〜5 は 90〜135%、設定6 は 1/319 の 設定6 より 回す 約240%)、釘と ヘソに 入る 割合は `spec.settings`。たしかめは `node tools/test.js --settings --hours 2000` (1/399 は ぶれが 大きい)。釘を かえたら `node tools/flow.js 27 --heso <幅>` で 入る 割合を 測りなおす。設定示唆は トロフィー (`CONFIG.settingHint`)。
- 通常時の 変動 (2026-11-04): セリフ → 疑似連 → 群 → ミニゲーム (成功で リーチ・失敗で はずれ) → SPリーチ。図柄は 左 → 右 → まんなかの 順に 止める (まんなかが さいごで ないと リーチの 結果が 見える)。
  SPリーチは ハリージェネラル < アサタナ (柱の氷の 下っ端) < ハルゥ < オカディシ < カネーズ < 柱の氷リーチ (3 人 同時。80% 以上。`drawHashiraReach`)。ミニゲームは `SHOW.minis` (金面犬は 発見で 95%)。敵の カットインの 文字は 白 < 赤 < 金 (`plan.textColor`。金は 80% 以上)。
  `rel` = 出たら 当たる 割合。はずれの 割合は `Show.rates` が スペックの 確率から 計算する。おかもぅ・マッスルイケノーブルの 絵は ユーザー指定で やまもぅ・マッスルウエノーブルの 絵を 使う (art.js)。
- 背景 (2026-11-04): 雪が降る街・ゲームセンター・SE城・森。満月 (90% 以上)・柱の神殿 (確定) は 保留に 当たりが ある ときに 出る。背景が かわって 5 回転 以内に また かわると 当たり濃厚 (`Show.stepStory`)。1・3・5 そろいは 当たり確定で RASH・先読みなし (`result.sango`。はずれは 1・3・5 に ならない)。
- 昇格チャレンジ (2026-11-04): 通常時の ヘソの 偶数図柄の 当たりの 1 ラウンド目から ラウンド中に (`m.bonus.promo`・`updatePromo`・`drawPromo`。ラウンドの あとだと 1/399 は 出玉で 結果が わかる)。成否は 当たりで きまる (next が st なら 成功)。ST へ 行く 当たりの 6 割が とおる。虹ゲージと レバーは 確定。1/399 は 1500発で 始まり、成功で +10R (3000発)。
- 1・3・5 は ひび割れ → 究極形態 (カードゲームの いちばん 強い 進化「おにおに・鬼の王 覚醒」。絵は カードと おなじ おにおに + 炎と 鎖。`kakusei`) → 咆哮 → おめでとう！ (`drawCrack`)。オープニング・エンディングは `SHOW.story`・`drawStory` (エンディングは 10 連目の あと)。
- おにおにRASH の バトル (2026-11-04): 柱の神殿を ダッシュ → リーチ → (仲間の 合流) → 敵 ★ → 仲間の 攻撃 → 自分の 技 → 敵の 技 → 激突 → 勝ち / 赤い 点滅 → 復活チャレンジ → 図柄ぞろい か END 図柄。`SHOW.stBattle`・`stPlan` (`plan.t` が 時間の ならび)・`drawBattle`。復活は 負けて 見える バトルの 20% に なる ように 当たりの 一部を 負けて 見せる (継続率は かわらない)。仲間は `m.stAlly`。
- 柱の氷RASH (2026-11-04): 柱の氷が 主役。基本は 勝負なし (`sub` flash: 虹ボタン・ぶるぶる・レバブル・先バレ → 虹色フラッシュ)。バトルの 当たりは `hKind` ippatsu / rainbow が ほとんどで plain は まれ。相手は `plan.rival`。
- 「ボタンを押せ」などは 押さないと `CONFIG.show.promptWait` 秒 演出を 止めて 待つ (main の tick)。
- 前作から 移した もの (2026-11-04): カスタマイズ (`js/customize.js`。演出の 見え方は `m.fx`)・図鑑と 実績 (`js/records.js`)・つづき (`saveGame`)・遊タイム (`spec.yutime`)・ステップアップ予告・違和感・全回転 5 種・早送り (ボタン長押し)・当たり履歴。
- 柱の氷RASH の 先バレは 2 つ: 前作の 録音 (`js/sound-heso.js`) を 低く した 音 と、おにおにの 先咆哮 (自作の 音)。どちらも ボタンが 赤く 光る。ボタン・レバーが 震える ときは CSS の vibrate と Sound の buzz。
- 抽選は `js/machine.js` (画面に ふれない)、演出の 筋書きは `js/show.js`、液晶は `js/lcd.js`、盤面の 絵と 役物は `js/render.js`、筐体・金棒レバーは `js/cabinet.js`。数値は `js/config.js`。
- 前作の キャラの 絵は koori-card の `src/art/legacy-art.js` から 写した (`js/art-legacy.js`)。柱の氷の 3 人と 金棒は `js/art.js`。
- 左の 道釘の 坂は 釘の くぼみで 玉が 止まるので、釘の 少し 上に 見えない レール (`board.slopeRail`・面 `slope`) を 通して ある。摩擦 0.998 は ヘソの 入りに とても 効く。玉が 止まる 場所は `node tools/stuck.js 27` で しらべる。
- テスト: `node tools/test.js` (抽選・継続率・撃破率・演出の 信頼度)。盤面の 玉の 流れは `node tools/flow.js`・`tools/trace.html`。コミットの 前に .githooks/pre-commit が テストする (`git config core.hooksPath .githooks`)。
- 画面の 確認: `sh tools/shot.sh "index.html?spec=s319&force=hit&skip=5" out.png 1000,1100` (force: hit / hitJitan / reach / st / stHit / fall / jitan / hst / hstHit / hstMiss。&setting=6・&senbare=roar|voice。force=charge|chargeSt・&reach=hashiraAll・&mini=goldDog&miniWin=0・&text=gold・&gizi=2。画面の「デバッグ」ボタンで リーチ・ミニゲーム・文字の 色・疑似連・チャージを えらべる。&debug=1 なら はじめから ひらく)。
- main に push すると GitHub Pages に 公開される。変更が できて テストが 通ったら、聞かずに commit して main に push する。
