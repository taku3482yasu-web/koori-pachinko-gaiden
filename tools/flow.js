// =====================================================================
// 玉の 流れの しらべ (Node.js)。盤面 (js/config.js の board) に 玉を 打って、どこへ 行くかを 数える
//   node tools/flow.js              強さ 20〜100 を 10 ずつ、それぞれ 300 発
//   node tools/flow.js 30 95        強さを えらぶ
//   --open (電チュー・アタッカーを 開けたまま) / --n 1000 / --heso 10.5 (ヘソの 命釘の すき間)
// =====================================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
function load(seed = 7) {
    let t = seed >>> 0;
    const rng = () => {
        t = (t + 0x6D2B79F5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
    const m = Object.create(Math);
    m.random = rng;
    const ctx = { console, Math: m };
    vm.createContext(ctx);
    for (const f of ['config.js', 'board.js', 'physics.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
    vm.runInContext('this.CONFIG = CONFIG; this.Board = Board; this.Physics = Physics;', ctx);
    return { ...ctx, rng };
}

// strength で n 発 打ち、行き先を 数える
function flow(strength, n = 300, { open = false, seed = 7, hesoWidth } = {}) {
    const g = load(seed);
    const board = g.Board.build(g.CONFIG, hesoWidth ? { hesoWidth } : {});
    if (open) { g.Board.setOpen(board, 'denchu', true); g.Board.setOpen(board, 'attacker', true); }
    const world = { board, balls: [], rng: g.rng, events: [] };
    const count = {};
    const add = k => { count[k] = (count[k] || 0) + 1; };
    const dt = 1 / 60;
    let shot = 0, time = 0, next = 0;
    while (shot < n || world.balls.length) {
        if (shot < n && time >= next) { g.Physics.launch(world, strength, g.CONFIG); shot++; next = time + g.CONFIG.launch.interval / 2; }
        g.Physics.step(world, dt, g.CONFIG);
        time += dt;
        for (const e of world.events.splice(0)) add(e.type === 'pocket' ? e.id : e.type);
        if (time > n * 3 + 60) break;
    }
    return count;
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const open = args.includes('--open');
    const ni = args.indexOf('--n');
    const n = ni >= 0 ? Number(args[ni + 1]) : 300;
    const hi = args.indexOf('--heso');
    const hesoWidth = hi >= 0 ? Number(args[hi + 1]) : undefined;
    const list = args.filter((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--n' && args[i - 1] !== '--heso').map(Number);
    for (const s of list.length ? list : [20, 30, 40, 50, 60, 70, 80, 90, 100]) {
        const c = flow(s, n, { open, hesoWidth });
        const pct = k => ((c[k] || 0) / n * 100).toFixed(1).padStart(5);
        console.log(`強さ ${String(s).padStart(3)}: ヘソ ${pct('heso')}%  ゲート ${pct('gate')}%  電チュー ${pct('denchu')}%  アタッカー ${pct('attacker')}%  一般 ${pct('general1')}/${pct('general2')}%  ワープ ${pct('warp')}%  ファール ${pct('foul')}%  アウト ${pct('out')}%`);
    }
}
module.exports = { flow, load };
