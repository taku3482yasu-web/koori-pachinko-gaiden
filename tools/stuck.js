// =====================================================================
// 玉が 止まる 場所の しらべ (Node.js)。左打ちで 打って、ゆっくりの まま 動かない 玉の 場所を 数える
//   node tools/stuck.js                強さ 27 を 3000 発
//   node tools/stuck.js 27 --n 3000 --heso 7.25 --slow 12 --after 1
// 失敗 (止まった 玉が ある) と 終了コード 1
// =====================================================================
const { load } = require('./flow.js');
const args = process.argv.slice(2);
const argOf = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : d; };
const strength = Number(args.find((a, i) => /^\d+$/.test(a) && !String(args[i - 1]).startsWith('--'))) || 27;
const N = argOf('n', 3000), SLOW = argOf('slow', 12), AFTER = argOf('after', 1), heso = argOf('heso', 0);
const g = load(11);
const board = g.Board.build(g.CONFIG, heso ? { hesoWidth: heso } : {});
const world = { board, balls: [], rng: g.rng, events: [] };
const dt = 1 / 60;
let shot = 0, time = 0, next = 0, life = 0, oldest = 0;
const spots = {}, born = new Map(), mark = new Map();
while (shot < N || world.balls.length) {
    if (shot < N && time >= next) { g.Physics.launch(world, strength, g.CONFIG); shot++; next = time + g.CONFIG.launch.interval; }
    g.Physics.step(world, dt, g.CONFIG);
    time += dt;
    world.events.length = 0;
    for (const b of world.balls) {
        if (!born.has(b)) born.set(b, time);
        const age = time - born.get(b);
        oldest = Math.max(oldest, age);
        const m = mark.get(b);
        // AFTER 秒の あいだ ほぼ おなじ 場所に いたら 止まっている
        if (!m || Math.hypot(b.x - m.x, b.y - m.y) > 4) mark.set(b, { x: b.x, y: b.y, t: time, done: false });
        else if (!m.done && time - m.t > AFTER) {
            m.done = true;
            const k = `${Math.round(b.x / 4) * 4},${Math.round(b.y / 4) * 4}`;
            spots[k] = (spots[k] || 0) + 1;
        }
    }
    if (time > N * 3 + 120) { life = world.balls.length; break; }
}
const list = Object.entries(spots).sort((a, b) => b[1] - a[1]);
const total = list.reduce((a, [, v]) => a + v, 0);
console.log(`${N} 発・止まった ${total} 回・いちばん 長く 盤面に いた 玉 ${oldest.toFixed(1)} 秒・のこった 玉 ${life}`);
list.slice(0, 15).forEach(([k, v]) => console.log(`  (${k})  ${v} 回`));
process.exitCode = total || life ? 1 : 0;
