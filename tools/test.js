// =====================================================================
// 自動テスト (Node.js)。台の 抽選 (js/machine.js) と 演出の 筋書き (js/show.js) を ブラウザなしで たしかめる
// ---------------------------------------------------------------------
// 盤面の 物理は 使わず、玉の 行き先を きまった 割合 (RATES) で きめて 台を 長い 時間 まわす。乱数は 種を 固定。
//   node tools/test.js               すべての テスト
//   node tools/test.js --hours 2000  台を まわす 時間 (1 スペック あたり)
//   node tools/test.js --setting 6   台の 設定 (ヘソの 入りやすさ。ふだんは 設定4)
//   node tools/test.js --settings    設定 1〜6 の 出玉率だけ しらべる (遅い)
//   node tools/test.js --sweep 0.05,0.1  ヘソに 入る 割合ごとの 出玉率 (設定の 数を きめる ため)
// 失敗が あると 終了コード 1
// =====================================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const argOf = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : fallback; };
const HOURS = argOf('hours', 400);
const SETTING = argOf('setting', 4);
const SEED = argOf('seed', 20261103);

function seeded(seed) {
    let t = seed >>> 0;
    return () => {
        t = (t + 0x6D2B79F5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
function load(files) {
    const ctx = { console, Math };
    vm.createContext(ctx);
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
    vm.runInContext('this.CONFIG = CONFIG; this.Machine = Machine; this.Show = Show; this.SHOW = SHOW;', ctx);
    return ctx;
}

let failed = 0;
function check(ok, label, detail = '') {
    console.log(`${ok ? '  ok ' : '  NG '} ${label}${detail ? '  ' + detail : ''}`);
    if (!ok) failed++;
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const pct = x => (x * 100).toFixed(1) + '%';

const G = load(['config.js', 'show.js', 'machine.js']);
const { CONFIG, Machine, Show, SHOW } = G;

// 玉の 行き先の 割合 (1 発 あたり)。tools/flow.js で しらべた 数に 近い
const RATES = {
    // ヘソは 設定ごとの 釘 (spec.settings[].hesoWidth) で かわる。入る 割合は tools/flow.js で しらべた 数 (spec.settings[].heso)
    left: { general: 0.005 },
    right: { gate: 0.95, denchu: 0.85, attacker: 0.9 }
};
const hesoRate = (specId, setting = SETTING) => argOf('heso', CONFIG.specs[specId].settings[setting - 1].heso);

// ----- 1. ST の 相手と 撃破率 -----
console.log('■ ST の 相手と 撃破率');
for (const specId of Object.keys(CONFIG.specs)) {
    const spec = CONFIG.specs[specId];
    const cont = spec.st.hitRate / (spec.st.hitRate + spec.st.fallRate);
    check(near(cont, spec.target.continuation, 0.005), `${spec.label}: ST の 継続率 ${pct(cont)}`);
    const w = SHOW.battleWeights[specId];
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    const avg = Object.entries(w).reduce((a, [k, v]) => a + v * SHOW.enemies[k].kill, 0) / total;
    check(near(avg, cont, 0.005), `${spec.label}: 相手の 出やすさ × 撃破率 = 継続率 (${pct(avg)})`);
    // 結果から 相手を えらんで、相手ごとの 撃破率を 数える
    const rng = seeded(SEED);
    const seen = {};
    for (let i = 0; i < 400000; i++) {
        const hit = rng() < cont;
        const e = Show.battleEnemy(specId, hit, rng);
        seen[e] = seen[e] || { n: 0, hit: 0 };
        seen[e].n++;
        if (hit) seen[e].hit++;
    }
    const order = ['harigeneral', 'hyougaryu', 'haru', 'okadishi', 'kanezu'];
    let prev = 1.01;
    for (const e of order) {
        const k = seen[e].hit / seen[e].n;
        check(near(k, SHOW.enemies[e].kill, 0.015) && k < prev, `${spec.label}: ${SHOW.enemies[e].name} の 撃破率 ${pct(k)} (出現 ${pct(seen[e].n / 400000)})`);
        prev = k;
    }
}
// ハリージェネラルの チャンスアップ
{
    const rng = seeded(SEED + 1);
    let n = 0, cu = 0;
    const m = Machine.create(CONFIG, 's319', rng);
    m.mode = 'st';
    for (let i = 0; i < 100000; i++) {
        const hit = rng() < 0.95;
        const p = Show.plan(CONFIG, m, { fig: 2, result: { kind: hit ? 'hit' : 'fall', forceEnemy: 'harigeneral' }, holdsLeft: 0 }, rng);
        n++;
        if (p.chance) cu++;
    }
    check(near(cu / n, 0.95, 0.01), `ハリージェネラルは ${pct(cu / n)} で チャンスアップ`);
}

// ----- 2. 台を 長い 時間 まわす -----
function run(specId, hours, seed, rash = 'onioni', heso = hesoRate(specId)) {
    const rng = seeded(seed);
    const m = Machine.create(CONFIG, specId, rng);
    Machine.setRashType(m, rash);
    const dt = 1 / 30;
    let t = 0, nextShot = 0, out = 0, inBalls = 0;
    const payout = CONFIG.payout;
    const chains = [];
    const bonusBalls = [];
    let curBonus = 0, firstKinds = { st: 0, jitan: 0 };
    let normalTime = 0;
    while (t < hours * 3600) {
        t += dt;
        if (t >= nextShot) {
            nextShot = t + CONFIG.launch.interval;
            out++;
            const aim = Machine.aim(m);
            if (aim === 'left') normalTime += CONFIG.launch.interval;
            const r = rng();
            if (aim === 'left') {
                if (r < heso) { Machine.enter(m, 'heso'); inBalls += payout.heso; }
                else if (r < heso + RATES.left.general) inBalls += payout.general;
            } else if (m.parts.attacker) {
                if (r < RATES.right.attacker) { Machine.enter(m, 'attacker'); inBalls += payout.attacker; curBonus += payout.attacker; }
            } else if (m.parts.denchu) {
                if (r < RATES.right.denchu) { Machine.enter(m, 'denchu'); inBalls += payout.denchu; }
            } else if (r < RATES.right.gate) Machine.enter(m, 'gate');
        }
        Machine.update(m, dt);
        for (const e of m.events.splice(0)) {
            if (e.type === 'bonusStart' && e.from === 'normal' && e.fig === 1) firstKinds[e.next]++;   // ヘソの 初当たり (電チューの 残り保留の 当たりは ST)
            if (e.type === 'bonusEnd') { bonusBalls.push(curBonus); curBonus = 0; }
            if (e.type === 'chainEnd') chains.push(e.chain);
        }
    }
    return { m, out, inBalls, chains, bonusBalls, firstKinds, normalTime };
}

const rotation = r => r.m.stats.spins1 / (r.normalTime / CONFIG.launch.interval) * 250;

// ----- 設定 (2026-11-04 ユーザー指定: 前作と おなじく 設定 1〜6 を 釘で つける) -----
if (args.includes('--sweep')) {
    const list = args[args.indexOf('--sweep') + 1].split(',').map(Number);
    for (const specId of Object.keys(CONFIG.specs)) for (const h of list) {
        const r = run(specId, HOURS, SEED, 'onioni', h);
        console.log(`${CONFIG.specs[specId].label} ヘソ ${h}: 出玉率 ${pct(r.inBalls / r.out)}・${rotation(r).toFixed(1)} 回転`);
    }
    process.exit(0);
}
if (args.includes('--settings')) {
    console.log(`■ 設定ごとの 出玉率 (${HOURS} 時間ずつ)`);
    for (const specId of Object.keys(CONFIG.specs)) {
        const spec = CONFIG.specs[specId];
        let prev = 0;
        spec.settings.forEach((st, i) => {
            const r = run(specId, HOURS, SEED + i, 'onioni', st.heso);
            const rtp = r.inBalls / r.out;
            check(near(rtp, CONFIG.settingRtp[i], 0.06) && rtp > prev, `${spec.label} 設定${i + 1}: 出玉率 ${pct(rtp)} (目標 ${pct(CONFIG.settingRtp[i])})・${rotation(r).toFixed(1)} 回転`);
            prev = rtp;
        });
    }
    console.log(failed ? `\n${failed} 件 失敗` : '\nぜんぶ ok');
    process.exit(failed ? 1 : 0);
}
// 設定は 高い ほど ヘソが 入りやすい
for (const specId of Object.keys(CONFIG.specs)) {
    const st = CONFIG.specs[specId].settings;
    check(st.length === 6 && st.every((s, i) => i === 0 || (s.hesoWidth > st[i - 1].hesoWidth && s.heso > st[i - 1].heso)), `${CONFIG.specs[specId].label}: 設定 1〜6 の 釘`);
}

console.log(`■ 台を まわす (${HOURS} 時間ずつ・設定${SETTING})`);
for (const specId of Object.keys(CONFIG.specs)) {
    const spec = CONFIG.specs[specId];
    const r = run(specId, HOURS, SEED);
    const s = r.m.stats;
    const stShare = r.firstKinds.st / (r.firstKinds.st + r.firstKinds.jitan);
    const n1 = r.firstKinds.st + r.firstKinds.jitan;
    check(near(stShare, spec.target.st, 3 * Math.sqrt(spec.target.st * (1 - spec.target.st) / n1)), `${spec.label}: 初当たりの ST 突入 ${pct(stShare)} (目標 ${pct(spec.target.st)})`);
    const cont = s.stHits / (s.stHits + s.falls);
    check(near(cont, spec.target.continuation, 0.03), `${spec.label}: ST の 継続率 ${pct(cont)} (ST 当たり ${s.stHits}・転落 ${s.falls})`);
    const spinsN = s.spins1;
    const firstRate = spinsN / Math.max(1, s.firstHits);
    check(firstRate > 1 / spec.hitRate * 0.75 && firstRate < 1 / spec.hitRate * 1.35, `${spec.label}: 初当たり 1/${firstRate.toFixed(0)} (回転 ${spinsN}・初当たり ${s.firstHits})`);
    const avgBonus = r.bonusBalls.reduce((a, b) => a + b, 0) / r.bonusBalls.length;
    const expect = spec.rounds * CONFIG.machine.bonus.count * CONFIG.payout.attacker;
    check(near(avgBonus, expect, expect * 0.08), `${spec.label}: 1 回の 大当たりの 出玉 ${avgBonus.toFixed(0)} 個 (${spec.rounds}R)`);
    const avgChain = r.chains.reduce((a, b) => a + b, 0) / r.chains.length;
    const perFirst = avgBonus * avgChain;
    console.log(`      平均 連チャン ${avgChain.toFixed(2)} 回・初当たり 1 回の 出玉 ${perFirst.toFixed(0)} 個・最高 ${s.bestChain} 連・時短で 引き戻し ${s.jitanHits}/${s.jitanEntries}`);
    const rtp = r.inBalls / r.out;
    console.log(`      出玉率 ${pct(rtp)} (打った ${r.out}・もどった ${r.inBalls})・1000円 (250発) あたり ${rotation(r).toFixed(1)} 回転`);
    r.perFirst = perFirst;
    module.exports[specId] = r;
}
// 柱の氷RASH (100 回の ST): 継続率は おにおにRASH と おなじ
for (const specId of Object.keys(CONFIG.specs)) {
    const spec = CONFIG.specs[specId];
    const calc = 1 - Math.pow(1 - spec.hashira.hitRate, spec.hashira.spins);
    check(near(calc, spec.target.continuation, 0.005), `${spec.label}: 柱の氷RASH の 継続率 (計算) ${pct(calc)}`);
    const r = run(specId, HOURS, SEED + 7, 'hashira');
    const s = r.m.stats;
    const cont = s.hstHits / (s.hstHits + s.hstEnds);
    check(near(cont, spec.target.continuation, 3 * Math.sqrt(0.2 / (s.hstHits + s.hstEnds))) && s.falls === 0, `${spec.label}: 柱の氷RASH の 継続率 ${pct(cont)} (当たり ${s.hstHits}・ぬけ ${s.hstEnds})`);
}
const a = module.exports.s319, b = module.exports.s399;
check(b.perFirst > a.perFirst, `1/399 の ほうが 初当たり 1 回の 出玉が 多い (${a.perFirst.toFixed(0)} < ${b.perFirst.toFixed(0)})`);

// ----- 3. 演出の 筋書き -----
console.log('■ 演出');
{
    const rng = seeded(SEED + 2);
    const m = Machine.create(CONFIG, 's319', rng);
    let hitReach = 0, hitN = 0, missReach = 0, missN = 0, lever = { hit: 0, miss: 0 }, yaku = { hit: 0, miss: 0 };
    for (let i = 0; i < 200000; i++) {
        const hit = i % 50 === 0;
        const result = { kind: hit ? 'hit' : 'miss', mode: 'normal', next: 'st' };
        Object.assign(result, Show.hold(CONFIG, m, 1, result, rng));
        const p = Show.plan(CONFIG, m, { fig: 1, result, holdsLeft: 0 }, rng);
        if (hit) { hitN++; if (p.reach) hitReach++; if (p.action === 'lever') lever.hit++; if (p.yaku) yaku.hit++; }
        else { missN++; if (p.reach) missReach++; if (p.action === 'lever') lever.miss++; if (p.yaku) yaku.miss++; }
        if (hit && p.figures[0] !== p.figures[2]) { check(false, '当たりは 図柄が そろう'); break; }
        if (!hit && p.figures[0] === p.figures[1] && p.figures[1] === p.figures[2]) { check(false, 'はずれは 図柄が そろわない'); break; }
    }
    check(hitReach === hitN, '当たりは かならず リーチ');
    console.log(`      はずれの リーチ ${pct(missReach / missN)}`);
    const leverTrust = (lever.hit / hitN / 319) / (lever.hit / hitN / 319 + lever.miss / missN * 318 / 319);
    const yakuTrust = (yaku.hit / hitN / 319) / (yaku.hit / hitN / 319 + yaku.miss / missN * 318 / 319);
    check(leverTrust > 0.4, `金棒レバーの 信頼度 ${pct(leverTrust)}`);
    check(yakuTrust > 0.75, `役物の 信頼度 ${pct(yakuTrust)}`);
}
// 柱の氷RASH の 演出: 先バレ・一発告知・バトル (一撃の ほうが 期待度が 高い・集結は 大チャンス)
{
    const rng = seeded(SEED + 3);
    const m = Machine.create(CONFIG, 's319', rng);
    m.mode = 'hst'; m.stLeft = 100;
    const c = { hit: {}, miss: {} };
    const add = (h, k) => { c[h][k] = (c[h][k] || 0) + 1; };
    const N = 200000;
    for (let i = 0; i < N; i++) {
        const hit = i % 63 === 0;
        const result = { kind: hit ? 'hit' : 'miss', mode: 'hst' };
        Object.assign(result, Show.hold(CONFIG, m, 2, result, rng));
        const p = Show.plan(CONFIG, m, { fig: 2, result, holdsLeft: 0 }, rng);
        const h = hit ? 'hit' : 'miss';
        add(h, 'n');
        if (result.senbare) { add(h, 'senbare'); add(h, 'sb_' + result.senbare); }
        add(h, p.sub);
        if (p.sub === 'battle') { add(h, p.attack); if (p.shuketsu) add(h, 'shuketsu'); if (p.ally !== 'rival') add(h, 'allyChance'); }
    }
    const trust = k => { const a = (c.hit[k] || 0), b = (c.miss[k] || 0); return a / (a + b); };
    check(trust('senbare') > 0.75, `先バレの 信頼度 ${pct(trust('senbare'))}`);
    check(trust('sb_roar') > trust('sb_voice') && trust('sb_voice') > 0.7, `先咆哮 ${pct(trust('sb_roar'))} は 先バレ音 ${pct(trust('sb_voice'))} より アツい`);
    check(trust('ippatsu') === 1, '一発告知は かならず 当たり');
    check(trust('ichigeki') > trust('rengeki'), `一撃 ${pct(trust('ichigeki'))} は 連撃 ${pct(trust('rengeki'))} より 期待度が 高い`);
    check(trust('shuketsu') > 0.6, `柱の氷 集結 ${pct(trust('shuketsu'))} は 大チャンス`);
    check(trust('allyChance') > trust('battle'), `おにおに・こおりくん 参戦 ${pct(trust('allyChance'))} は チャンス (バトル全体 ${pct(trust('battle'))})`);
}
// 時短 100 回で 当たらなければ 通常時へ
{
    const m = Machine.create(CONFIG, 's319', () => 0.999);
    Machine.debugMode(m, 'jitan');
    let ended = false;
    for (let i = 0; i < 100 * 60 * 10 && !ended; i++) {
        if (m.holds[2].length < 2) Machine.enter(m, 'denchu');
        Machine.update(m, 1 / 10);
        for (const e of m.events.splice(0)) if (e.type === 'jitanEnd') ended = true;
    }
    check(ended && m.mode === 'normal' && m.stats.spins2 === 100, `時短は 100 回で 終わる (${m.stats.spins2} 回)`);
}

console.log(failed ? `\n${failed} 件 失敗` : '\nぜんぶ ok');
process.exitCode = failed ? 1 : 0;
