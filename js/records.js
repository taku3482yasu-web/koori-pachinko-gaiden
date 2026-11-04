// =====================================================================
// 図鑑と 実績 (2026-11-04 ユーザー指定: 前作の パチンコと おなじ ように)。この ブラウザに 保存する。台を えらび直しても 残る
// ---------------------------------------------------------------------
// Records.add('hits')           数を 足す / Records.best('bestChain', 5)   いちばん 大きい 数を のこす
// Records.seen('reach', 'kanezu')  演出を 見た / Records.onUnlock(fn)  実績を 解除した ときに 呼ばれる
// 実績の stat: 記録の 名前 / 'seen:グループ' (見た 種類の 数) / 'seen:グループ:id'。value: 'all' は その グループの ぜんぶ
// =====================================================================

const Records = (() => {
    const KEY = 'koori-gaiden-records';
    const GROUPS = {
        reach: { title: 'リーチ', items: () => Object.fromEntries(Object.entries(SHOW.reaches).map(([k, v]) => [k, v.name])) },
        mini: { title: 'ミニゲーム', items: () => Object.fromEntries(Object.entries(SHOW.minis).map(([k, v]) => [k, v.name])) },
        stage: { title: '背景', items: () => Object.fromEntries(SHOW.stories.map(s => [s.id, s.name])) },
        zenkaiten: { title: '全回転', items: () => Object.fromEntries(Object.entries(SHOW.zenkaiten).map(([k, v]) => [k, v.name])) },
        iwakan: { title: '違和感', items: () => Object.fromEntries(Object.entries(SHOW.iwakan).map(([k, v]) => [k, v.name])) },
        premium: { title: 'プレミア', items: () => ({ teamJoin: 'チームの 合流', sango: '1・3・5 そろい', fastStage: '背景の 連続変化', stepGold: 'ステップアップの 金文字', gizi4: '疑似4連' }) }
    };
    const ACHIEVEMENTS = [
        { id: 'firstHit', name: 'はじめての 大当たり', desc: '大当たりを 引く', stat: 'hits', value: 1 },
        { id: 'rash', name: 'RASH 突入', desc: 'RASH に 入る', stat: 'entries', value: 1 },
        { id: 'chain5', name: '5連チャン', desc: '5 連 する', stat: 'bestChain', value: 5 },
        { id: 'chain10', name: '10連チャン', desc: '10 連 する', stat: 'bestChain', value: 10 },
        { id: 'balls5000', name: '一撃 5000発', desc: '1 回の 連チャンで 5000発 出す', stat: 'bestBalls', value: 5000 },
        { id: 'balls20000', name: '一撃 20000発', desc: '1 回の 連チャンで 20000発 出す', stat: 'bestBalls', value: 20000 },
        { id: 'charge', name: 'チャージ', desc: 'チャージを 引く', stat: 'charges', value: 1 },
        { id: 'chargeSt', name: 'チャージから RASH', desc: 'チャージから RASH に 入る', stat: 'chargeSt', value: 1 },
        { id: 'promo', name: '昇格', desc: '昇格チャレンジで こおりくんの 影を 撃破する', stat: 'promoWins', value: 1 },
        { id: 'ending', name: 'こおりくん 救出', desc: 'エンディングを 見る', stat: 'endings', value: 1 },
        { id: 'revive', name: '覚醒', desc: '復活チャレンジで 覚醒する', stat: 'revives', value: 1 },
        { id: 'teamJoin', name: 'チーム 合流', desc: 'おにおにRASH で チームが 合流する', stat: 'seen:premium:teamJoin', value: 1 },
        { id: 'yutime', name: '遊タイム', desc: '遊タイムに 入る', stat: 'yutimes', value: 1 },
        { id: 'sango', name: '1・3・5', desc: '図柄が 1・3・5 で そろう', stat: 'seen:premium:sango', value: 1 },
        { id: 'temple', name: '柱の神殿', desc: '背景が 柱の神殿に なる', stat: 'seen:stage:temple', value: 1 },
        { id: 'moon', name: '満月の 夜', desc: '背景が 満月に なる', stat: 'seen:stage:moon', value: 1 },
        { id: 'fast', name: 'めまぐるしい 旅', desc: '背景が 5 回転 以内に また かわる', stat: 'seen:premium:fastStage', value: 1 },
        { id: 'hashira', name: '時を越え', desc: '柱の氷リーチを 見る', stat: 'seen:reach:hashiraAll', value: 1 },
        { id: 'goldDog', name: '金面犬 発見', desc: 'ゴールド金面犬を 発見する', stat: 'goldDogs', value: 1 },
        { id: 'allMini', name: 'ミニゲーム コンプリート', desc: 'ミニゲームを ぜんぶ 見る', stat: 'seen:mini', value: 'all' },
        { id: 'allStage', name: '旅の 記録', desc: '背景を ぜんぶ 見る', stat: 'seen:stage', value: 'all' },
        { id: 'zenkaiten', name: '全回転', desc: '全回転を 見る', stat: 'seen:zenkaiten', value: 1 },
        { id: 'allZenkaiten', name: '全回転 コンプリート', desc: '全回転を ぜんぶ 見る', stat: 'seen:zenkaiten', value: 'all' },
        { id: 'gizi4', name: '疑似4連', desc: '疑似連を 4 連まで つづける', stat: 'seen:premium:gizi4', value: 1 },
        { id: 'stepGold', name: '金の 文字', desc: 'ステップアップ予告の 3 段目が 金に なる', stat: 'seen:premium:stepGold', value: 1 },
        { id: 'allIwakan', name: '違和感 マスター', desc: '違和感を ぜんぶ 見る', stat: 'seen:iwakan', value: 'all' },
        { id: 'trophy', name: '虹の トロフィー', desc: '虹の トロフィー (設定6 確定) を 見る', stat: 'trophy6', value: 1 },
        { id: 'spins3000', name: '打ちこみ 3000回転', desc: '合計 3000 回転 まわす', stat: 'spins', value: 3000 }
    ];
    let data = { stats: {}, seen: {}, done: {} };
    const listeners = [];

    function load() {
        try { data = { ...data, ...(JSON.parse(localStorage.getItem(KEY) || '{}') || {}) }; } catch (e) { /* こわれていたら はじめから */ }
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 保存できない */ } }
    function valueOf(stat) {
        if (!stat.startsWith('seen:')) return data.stats[stat] || 0;
        const [, group, id] = stat.split(':');
        const seen = data.seen[group] || {};
        return id ? seen[id] || 0 : Object.keys(seen).length;
    }
    function check() {
        for (const a of ACHIEVEMENTS) {
            if (data.done[a.id]) continue;
            const goal = a.value === 'all' ? Object.keys(GROUPS[a.stat.split(':')[1]].items()).length : a.value;
            if (valueOf(a.stat) < goal) continue;
            data.done[a.id] = true;
            listeners.forEach(fn => fn(a));
        }
    }
    function add(key, n = 1) { data.stats[key] = (data.stats[key] || 0) + n; check(); save(); }
    function best(key, v) { if (v > (data.stats[key] || 0)) { data.stats[key] = v; check(); save(); } }
    function seen(group, id) {
        const g = data.seen[group] = data.seen[group] || {};
        g[id] = (g[id] || 0) + 1;
        check();
        save();
    }
    const onUnlock = fn => listeners.push(fn);
    const achievements = () => ACHIEVEMENTS.map(a => ({ ...a, done: Boolean(data.done[a.id]) }));
    const groups = () => Object.entries(GROUPS).map(([id, g]) => ({ id, title: g.title, items: Object.entries(g.items()).map(([k, name]) => ({ id: k, name, count: (data.seen[id] || {})[k] || 0 })) }));
    return { load, add, best, seen, onUnlock, achievements, groups };
})();
