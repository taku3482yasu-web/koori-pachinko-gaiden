// =====================================================================
// カスタマイズ (演出・盤面の 見た目。2026-11-04 ユーザー指定: 前作の パチンコと おなじ ように)
// ---------------------------------------------------------------------
// 遊ぶ人が えらぶ。当たりやすさ・出玉には 関係しない (見た目と 演出だけ)。えらんだ 内容は この ブラウザに 保存する。
// Customize.get('theme') で 読む。Customize.onChange(fn) で かわった ときに 呼ばれる。
// =====================================================================

const Customize = (() => {
    const OPTIONS = {
        senyomi: { label: '先読み', group: '演出', note: '保留の 色・背景の 先読みが 出る 量',
            choices: { none: 'なし', chance: 'チャンス', recommend: 'おすすめ', hot: '熱' }, default: 'recommend' },
        notice: { label: '告知', group: '演出', note: '先告知: 当たりの 変動の はじめに ボタンが 虹色に 光る。後告知: 演出なしで 図柄が ばらばらに 止まって から 当たりを 知らせる。一発告知: 変動の はじめに すぐ 当たり',
            choices: { normal: 'ふつう', pre: '先告知', post: '後告知', oneshot: '一発告知' }, default: 'normal' },
        line: { label: 'ふるカワ', group: '演出', note: '',
            choices: { often: 'よくしゃべる', normal: 'ふつう', off: 'しゃべらない' }, default: 'normal' },
        leverBuru: { label: 'レバブル', group: '演出', note: 'リーチの ときに 金棒レバーが ぶるぶる 震える ことが ある',
            choices: { on: 'あり', off: 'なし' }, default: 'on' },
        opening: { label: 'オープニング', group: '演出', note: '台を えらんだ ときに 流す', choices: { on: 'あり', off: 'なし' }, default: 'on' },
        fx: { label: '演出の強さ', group: '演出', note: '控えめ: レバー・ボタンの 震えと 本体の 振動・可動液晶を 出さない',
            choices: { quiet: '控えめ', normal: 'ふつう' }, default: 'normal' },
        lcdZoom: { label: '可動液晶', group: '演出', note: 'バトルや 大当たりの はじまりで 液晶が 前に せり出す',
            choices: { on: 'あり', off: 'なし' }, default: 'on' },
        vibrate: { label: 'ボタンの振動', group: '演出', note: 'スマホの 本体の 振動',
            choices: { on: 'ON', off: 'OFF' }, default: 'on' },
        yaku: { label: '当たりの役物', group: '演出', note: '当たりで 盤面の 役物が 動く 演出',
            choices: { always: '毎回', sometimes: 'ときどき', off: 'なし' }, default: 'always' },
        bgm: { label: 'BGM', group: '演出', note: '',
            choices: { on: 'ON', off: 'OFF' }, default: 'on' },
        bgmVolume: { label: 'BGM の音量', group: '演出', note: '',
            choices: { low: '小', normal: 'ふつう', high: '大' }, default: 'normal' },
        seVolume: { label: '効果音の音量', group: '演出', note: '',
            choices: { low: '小', normal: 'ふつう', high: '大' }, default: 'normal' },
        skip: { label: '早送り', group: '操作', note: '台の ボタン (B キー) を 長押しすると、演出を 結果の 手前まで とばす',
            choices: { on: 'ON', off: 'OFF' }, default: 'on' },
        leverTap: { label: 'レバーの操作', group: '操作', note: '「レバーを引け！」の とき、台の ボタンでも よい',
            choices: { off: 'レバーだけ', on: 'ボタンでもOK' }, default: 'off' },
        autoAim: { label: '打ち分け', group: '操作', note: '自動: 台の 状態に 合わせて 強さを 左打ち・右打ちに 合わせる',
            choices: { off: '手動', on: '自動' }, default: 'on' },
        theme: { label: '盤面の色', group: '見た目', note: '',
            choices: { night: '夜', ice: '氷', crimson: '紅', sakura: '夜桜', gold: '黄金' }, default: 'night' },
        ball: { label: '玉の色', group: '見た目', note: '',
            choices: { silver: '銀', gold: '金' }, default: 'silver' },
        koori: { label: 'こおりくんの色', group: '見た目', note: '液晶の 図柄の こおりくんの 色',
            choices: { normal: 'ノーマル', ichigo: 'いちご', melon: 'メロン', lemon: 'レモン' }, default: 'normal' }
    };
    // 盤面の 色 (render.js の COLORS を 上書き)
    const THEMES = {
        night: {},
        ice: { boardTop: '#0d2a4a', boardBottom: '#071528', accent: '#7fd3f7', accentDark: '#0b1a33', frame: '#1b3a6b', frameLight: '#bff0ff', skyline: '#081830', window: '#bff0ff', deco: 'rgba(127, 211, 247, 0.1)' },
        crimson: { boardTop: '#4a0a18', boardBottom: '#14040a', accent: '#ff5a6a', accentDark: '#2a0610', frame: '#5a1420', frameLight: '#ff9aa8', skyline: '#1a060c', window: '#ffb070', deco: 'rgba(255, 106, 122, 0.1)' },
        sakura: { boardTop: '#1a0f2a', boardBottom: '#0a0614', accent: '#ff7ab0', accentDark: '#200a18', frame: '#5a2a4a', frameLight: '#ff9ec8', skyline: '#10061a', window: '#ffd0e4', deco: 'rgba(255, 158, 200, 0.1)' },
        gold: { boardTop: '#3a2a08', boardBottom: '#140c02', accent: '#ffd84a', accentDark: '#201402', frame: '#6a4a10', frameLight: '#ffe066', skyline: '#140c02', window: '#fff0a0', deco: 'rgba(255, 224, 102, 0.1)' }
    };
    const BALLS = { silver: {}, gold: { ball: '#ffe680', ballShade: '#a07810', ballLight: '#fffbe0' } };
    // こおりくんの 色 (LEGACY_ART.koori の c: 明 / b: 影 / d: 足)
    const KOORI = {
        normal: { c: '#bff0ff', b: '#7fd3f7', d: '#4aa8e0' },
        ichigo: { c: '#ffd0dc', b: '#ff8aa8', d: '#e0507a' },
        melon: { c: '#d4f8c0', b: '#8ae070', d: '#4ab040' },
        lemon: { c: '#fff6b0', b: '#ffe050', d: '#e0b020' }
    };
    const KEY = 'koori-gaiden-customize';
    const VOLUMES = { low: 0.45, normal: 1, high: 1.6 };
    let values = {};
    const listeners = [];

    function load() {
        try { values = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { values = {}; }
        Object.entries(OPTIONS).forEach(([k, o]) => { if (!(values[k] in o.choices)) values[k] = o.default; });
        apply();
    }
    const get = key => values[key] ?? OPTIONS[key].default;
    function set(key, value) {
        if (!OPTIONS[key] || !(value in OPTIONS[key].choices)) return;
        values[key] = value;
        try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (e) { /* 保存できない */ }
        apply();
        listeners.forEach(fn => fn(key, value));
    }
    const onChange = fn => listeners.push(fn);
    function apply() {
        if (typeof LEGACY_ART !== 'undefined') Object.assign(LEGACY_ART.koori.palette, KOORI[get('koori')]);
        if (typeof Art !== 'undefined' && Art.clearCache) Art.clearCache();
    }
    const boardColors = () => ({ ...THEMES[get('theme')], ...BALLS[get('ball')] });
    const volume = key => VOLUMES[get(key)] || 1;
    return { OPTIONS, load, get, set, onChange, boardColors, volume };
})();
