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
    let curBonus = 0, curFrom = null, curNext = null, firstKinds = { st: 0, jitan: 0, normal: 0 };
    const promoSt = { n: 0, promo: 0, ends: 0, wins: 0 };
    const stage = { moon: 0, moonHit: 0, temple: 0, templeHit: 0, fast: 0, fastHit: 0 };
    let watch = [];   // 背景が 出た あと 5 回転の あいだに 当たるか
    const uw = { n: 0, win: 0, lose: 0 };
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
            if (e.type === 'bonusStart' && e.from === 'normal' && e.fig === 1 && !e.charge) firstKinds[e.next]++;   // ヘソの 初当たり (電チューの 残り保留の 当たりは ST)
            if (e.type === 'bonusStart') { curFrom = e.charge ? 'charge' : e.from; curNext = e.next; }
            if (e.type === 'bonusEnd') { bonusBalls.push({ balls: curBonus, from: curFrom, next: curNext }); curBonus = 0; }
            if (e.type === 'bonusStart' && e.from === 'normal' && e.fig === 1 && !e.charge && e.next === 'st') { promoSt.n++; if (e.promo) promoSt.promo++; }
            if (e.type === 'promoEnd') { promoSt.ends++; if (e.win) promoSt.wins++; }
            if (e.type === 'uwanoseStart') uw.n++;
            if (e.type === 'uwanose') uw.win++;
            if (e.type === 'uwanoseEnd') uw.lose++;
            if (e.type === 'chainEnd') chains.push(e.chain);
            if (e.type === 'spinStart' && e.mode === 'normal') {
                watch = watch.filter(w => m.stats.spins1 <= w.until);
                const p = e.plan, kind = p.story === 4 ? 'moon' : p.story === 5 ? 'temple' : p.fastStage ? 'fast' : null;
                if (kind) { stage[kind]++; watch.push({ kind, until: m.stats.spins1 + 5 }); }
            }
            if (e.type === 'bonusStart' && e.from === 'normal' && !e.charge) { watch.forEach(w => stage[w.kind + 'Hit']++); watch = []; }
        }
    }
    return { m, out, inBalls, chains, bonusBalls, firstKinds, normalTime, uw, stage, promoSt };
}

const rotation = r => r.m.stats.spins1 / (r.normalTime / CONFIG.launch.interval) * 250;

// ----- 設定 (2026-11-04 ユーザー指定: 前作と おなじく 設定 1〜6 を 釘で つける) -----
if (args.includes('--sweep')) {
    const list = args[args.indexOf('--sweep') + 1].split(',').map(Number);
    for (const specId of Object.keys(CONFIG.specs).filter(k => !args.includes('--only') || k === args[args.indexOf('--only') + 1])) for (const h of list) {
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
        spec.rot6 = 0;
        spec.settings.forEach((st, i) => {
            const r = run(specId, HOURS, SEED + i, 'onioni', st.heso);
            const rtp = r.inBalls / r.out, goal = (spec.settingRtp || CONFIG.settingRtp)[i];
            check(near(rtp, goal, goal * 0.08) && rtp > prev, `${spec.label} 設定${i + 1}: 出玉率 ${pct(rtp)} (目標 ${pct(goal)})・${rotation(r).toFixed(1)} 回転`);
            prev = rtp;
            spec.rot6 = rotation(r);
        });
    }
    check(CONFIG.specs.s399.rot6 > CONFIG.specs.s319.rot6, `1/399 の 設定6 は 1/319 の 設定6 より 回る (${CONFIG.specs.s399.rot6.toFixed(1)} > ${CONFIG.specs.s319.rot6.toFixed(1)})`);
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
    const n1 = r.firstKinds.st + r.firstKinds.jitan + r.firstKinds.normal;
    const stShare = r.firstKinds.st / n1;
    check(near(stShare, spec.target.st, 3 * Math.sqrt(spec.target.st * (1 - spec.target.st) / n1)), `${spec.label}: 初当たりの ST 突入 ${pct(stShare)} (目標 ${pct(spec.target.st)})`);
    const cont = s.stHits / (s.stHits + s.falls);
    check(near(cont, spec.target.continuation, 3 * Math.sqrt(0.2 / (s.stHits + s.falls))), `${spec.label}: ST の 継続率 ${pct(cont)} (ST 当たり ${s.stHits}・転落 ${s.falls})`);
    const spinsN = s.spins1;
    const firstRate = spinsN / Math.max(1, s.firstHits);
    check(firstRate > 1 / spec.hitRate * 0.75 && firstRate < 1 / spec.hitRate * 1.35, `${spec.label}: 初当たり 1/${firstRate.toFixed(0)} (回転 ${spinsN}・初当たり ${s.firstHits})`);
    // 1 回の 大当たりの 出玉 (1R = 10C x 賞球)。spec.payout が ある 台は 初当たりと RASH 中で わける
    const perRound = CONFIG.machine.bonus.count * CONFIG.payout.attacker;
    const avgOf = list => list.reduce((a, b) => a + b.balls, 0) / Math.max(1, list.length);
    const pay = spec.payout;
    const firstBonus = r.bonusBalls.filter(b => b.from === 'normal' && b.next === 'st'), rashBonus = r.bonusBalls.filter(b => b.from !== 'normal' && b.from !== 'charge' && (!spec.rashRounds || b.from !== 'jitan'));
    const firstJitan = r.bonusBalls.filter(b => b.from === 'normal' && b.next !== 'st');
    const expFirst = (pay ? pay.first : spec.rounds) * perRound, expJitan = (pay ? pay.firstNormal : spec.rounds) * perRound;
    let expRash = (spec.rashRounds || spec.rounds) * perRound;
    if (pay) {
        const tw = pay.rash.reduce((a, k) => a + k.weight, 0);
        expRash = pay.rash.reduce((a, k) => a + k.weight / tw * (k.rounds + (k.uwanose ? spec.uwanose.success * spec.uwanose.addRounds : 0)), 0) * perRound;
    }
    check(near(avgOf(firstBonus), expFirst, expFirst * 0.02), `${spec.label}: 初当たり (ST) の 出玉 ${avgOf(firstBonus).toFixed(0)} 個 (目標 ${expFirst})`);
    check(near(avgOf(firstJitan), expJitan, expJitan * 0.02), `${spec.label}: 初当たり (時短) の 出玉 ${avgOf(firstJitan).toFixed(0)} 個 (目標 ${expJitan})`);
    // チャージ: 低確率で 300発。5% で ST
    const chargeBonus = r.bonusBalls.filter(b => b.from === 'charge'), expCharge = spec.charge.rounds * perRound;
    const chargeRate = s.spins1 / Math.max(1, s.charges);
    check(chargeRate > 1 / spec.charge.rate * 0.75 && chargeRate < 1 / spec.charge.rate * 1.35, `${spec.label}: チャージ 1/${chargeRate.toFixed(0)} (${s.charges} 回)`);
    check(near(avgOf(chargeBonus), expCharge, expCharge * 0.02), `${spec.label}: チャージの 出玉 ${avgOf(chargeBonus).toFixed(0)} 個 (目標 ${expCharge})`);
    check(near(s.chargeSt / s.charges, spec.charge.st, 3 * Math.sqrt(0.05 * 0.95 / s.charges)), `${spec.label}: チャージの ST 突入 ${pct(s.chargeSt / s.charges)} (${s.chargeSt}/${s.charges})`);
    check(near(avgOf(rashBonus), expRash, expRash * 0.05), `${spec.label}: RASH・時短の 大当たりの 出玉 ${avgOf(rashBonus).toFixed(0)} 個 (目標 ${expRash.toFixed(0)})`);
    if (pay) {
        const tw = pay.rash.reduce((a, k) => a + k.weight, 0);
        const share = r.uw.n / rashBonus.length, expShare = pay.rash.filter(k => k.uwanose).reduce((a, k) => a + k.weight, 0) / tw;
        check(near(share, expShare, 3 * Math.sqrt(0.25 / r.uw.n)), `${spec.label}: 上乗せジャッジの 発生 ${pct(share)} (目標 ${pct(expShare)})`);
        check(r.uw.win + r.uw.lose === r.uw.n && near(r.uw.win / r.uw.n, spec.uwanose.success, 3 * Math.sqrt(0.25 / r.uw.n)), `${spec.label}: 上乗せジャッジの 成功 ${pct(r.uw.win / r.uw.n)} (${r.uw.win}/${r.uw.n})`);
        const counts = {};
        rashBonus.forEach(b => { counts[b.balls] = (counts[b.balls] || 0) + 1; });
        console.log(`      RASH・時短の 出玉: ${Object.entries(counts).map(([k, v]) => `${k}個 ${pct(v / rashBonus.length)}`).join('・')}`);
    }
    const ps = r.promoSt;
    check(near(ps.promo / ps.n, 0.6 * (1 - SHOW.sango), 3 * Math.sqrt(0.25 / ps.n)), `${spec.label}: RASH へ 行く 当たりの 昇格チャレンジ経由 ${pct(ps.promo / ps.n)} (${ps.promo}/${ps.n})`);
    check(ps.wins === ps.promo && ps.ends === ps.wins + r.firstKinds.jitan + r.firstKinds.normal, `${spec.label}: 昇格チャレンジの 成否は 当たりの ときに きまる (成功 ${ps.wins}/${ps.ends})`);
    const g = r.stage;
    check(g.temple > 0 && g.templeHit === g.temple, `${spec.label}: 柱の神殿は 当たり確定 (${g.templeHit}/${g.temple})`);
    check(g.moon > 0 && g.moonHit / g.moon > 0.9 - 2 * Math.sqrt(0.09 / g.moon), `${spec.label}: 満月 ${pct(g.moonHit / g.moon)} (${g.moonHit}/${g.moon})`);
    check(g.fast > 0 && g.fastHit / g.fast > 0.85, `${spec.label}: 背景の 連続変化 ${pct(g.fastHit / g.fast)} (${g.fastHit}/${g.fast})`);
    if (!spec.firstHit.some(x => x.next === 'jitan')) check(s.jitanEntries === 0, `${spec.label}: 初当たりの 時短なし`);
    const avgChain = r.chains.reduce((a, b) => a + b, 0) / r.chains.length;
    const perFirst = r.bonusBalls.reduce((a, b) => a + b.balls, 0) / r.chains.length;
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
        if (result.sango) { hitN++; hitReach++; continue; }
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
// 通常時の 演出 (2026-11-04 ユーザー指定): SPリーチ・ミニゲーム・敵の 文字の 色・疑似連・セリフの 信頼度。
// 当たりと はずれを 別に まわして、スペックの 確率で 合わせる
for (const specId of Object.keys(CONFIG.specs)) {
    const label = CONFIG.specs[specId].label, p = CONFIG.specs[specId].hitRate;
    const rng = seeded(SEED + 4);
    const m = Machine.create(CONFIG, specId, rng);
    const c = { hit: {}, miss: {} };
    const add = (h, k) => { c[h][k] = (c[h][k] || 0) + 1; };
    const N = { hit: 300000, miss: 3000000 };
    let bad7 = 0, hit7 = 0;
    for (const h of ['hit', 'miss']) for (let i = 0; i < N[h]; i++) {
        const result = { kind: h, mode: 'normal', next: 'st' };
        Object.assign(result, Show.hold(CONFIG, m, 1, result, rng));
        if (result.sango) { add(h, 'sango'); continue; }
        if (result.senbare) add(h, 'sb:' + result.senbare);
        if (result.btn) add(h, 'btn:' + result.btn);
        const q = Show.plan(CONFIG, m, { fig: 1, result, holdsLeft: i % 3 }, rng);
        if (q.figures.join() === '1,3,5') check(false, 'はずれは 1・3・5 に ならない');
        if (h === 'miss' && q.reach && q.figures[0] === 7) bad7++;
        if (h === 'hit' && q.reach && q.figures[0] === 7) hit7++;
        if (q.step) add(h, 'step:' + q.step.id);
        if (q.iwakan) add(h, 'iwakan');
        if (q.reach) add(h, 'reach:' + q.reach);
        if (q.textColor) add(h, 'text:' + q.textColor);
        if (q.mini) { add(h, 'mini:' + q.mini.id); if (q.mini.win) add(h, 'win:' + q.mini.id); }
        if (q.gizi) add(h, 'gizi:' + q.gizi);
        if (q.line) add(h, 'line:' + q.line.color);
        if (q.mini && q.mini.win && !q.reach) check(false, 'ミニゲームの 成功は リーチに なる');
        if (q.mini && !q.mini.win && q.reach) check(false, 'ミニゲームの 失敗は リーチに ならない');
        if (q.reach && q.figures[0] !== q.figures[2]) check(false, 'リーチは 左と 右が おなじ');
    }
    check(bad7 === 0 && hit7 > 0, `${label}: 7 の リーチは 当たり確定 (当たり ${hit7}・はずれ ${bad7})`);
    const mass = (h, k) => (c[h][k] || 0) / N[h] * (h === 'hit' ? p : 1 - p);
    const trust = k => mass('hit', k) / (mass('hit', k) + mass('miss', k));
    let prev = 0;
    for (const r of SHOW.battleReaches) {
        check(trust('reach:' + r) > prev, `${label}: ${SHOW.reaches[r].name} ${pct(trust('reach:' + r))}`);
        prev = trust('reach:' + r);
    }
    check(prev > 0.8, `${label}: 柱の氷リーチは 80% 以上 (${pct(prev)})`);
    check(trust('text:gold') > 0.8 && trust('text:gold') > trust('text:red') && trust('text:red') > trust('text:white'), `${label}: 敵の 文字 白 ${pct(trust('text:white'))} < 赤 ${pct(trust('text:red'))} < 金 ${pct(trust('text:gold'))}`);
    let prevWin = 0;
    for (const id of Object.keys(SHOW.minis)) {
        const win = (mass('hit', 'win:' + id) + mass('miss', 'win:' + id)) / (mass('hit', 'mini:' + id) + mass('miss', 'mini:' + id));
        check(win > prevWin, `${label}: ${SHOW.minis[id].name} 成功 ${pct(win)}・成功なら 当たり ${pct(trust('win:' + id))}`);
        prevWin = win;
    }
    check(near(trust('win:goldDog'), 0.95, 0.03), `${label}: 金面犬を 発見したら 95% 当たり (${pct(trust('win:goldDog'))})`);
    check(trust('step:s3gold') > 0.85 && trust('step:s3gold') > trust('step:s3red') && trust('step:s3red') > trust('step:s3'), `${label}: ステップアップ 3 段 白 ${pct(trust('step:s3'))} < 赤 ${pct(trust('step:s3red'))} < 金 ${pct(trust('step:s3gold'))}`);
    check(trust('sb:roar') > trust('sb:voice') && trust('sb:roar') > 0.7, `${label}: 通常時の 先バレ 音 ${pct(trust('sb:voice'))} < 咆哮 ${pct(trust('sb:roar'))}`);
    check(trust('btn:gold') > 0.9 && trust('btn:gold') > trust('btn:purple'), `${label}: ボタン 紫 ${pct(trust('btn:purple'))} < 金 ${pct(trust('btn:gold'))}`);
    check(trust('iwakan') > 0.6, `${label}: 違和感 ${pct(trust('iwakan'))}`);
    check(trust('gizi:3') > trust('gizi:1'), `${label}: 疑似連 2連 ${pct(trust('gizi:1'))} < 4連 ${pct(trust('gizi:3'))}`);
    check(trust('line:#ffd84a') > trust('line:#ffffff'), `${label}: セリフ 白 ${pct(trust('line:#ffffff'))} < 金 ${pct(trust('line:#ffd84a'))}`);
}
// 1・3・5 そろい: 当たり確定で RASH へ・先読みなし
{
    const m = Machine.create(CONFIG, 's399', seeded(SEED + 5));
    Machine.debugHold(m, 'hit', { next: 'st', sango: true });
    const h = m.holds[1][0];
    check(h.shownColor === 'white' && h.holdColor === 'white', '1・3・5 は 保留が 白');
    const p = Show.plan(CONFIG, m, { fig: 1, result: h, holdsLeft: 0 }, m.rng);
    check(p.figures.join() === '1,3,5' && p.hit && !p.step && !p.line && !p.gizi && !p.reach && !p.mini, '1・3・5 は 予告なしで 当たり');
    check(Show.stepStory(CONFIG, m, h, () => 0) === null, '1・3・5 は 背景が かわらない');
    let toSt = false;
    for (let i = 0; i < 60 * 60 * 3 && !toSt; i++) {
        Machine.update(m, 1 / 30);
        if (m.parts.attacker) Machine.enter(m, 'attacker');
        for (const e of m.events.splice(0)) if (e.type === 'stStart') toSt = true;
    }
    check(toSt, '1・3・5 の あとは RASH');
}
// 昇格チャレンジ: 虹ゲージと レバーは 確定・奇数図柄と 1・3・5 は とおらない
{
    const rng = seeded(SEED + 6);
    let rainbowLose = 0, leverLose = 0, leverWin = 0;
    for (let i = 0; i < 20000; i++) {
        const lose = Show.promoPlan(false, rng), win = Show.promoPlan(true, rng);
        if (lose.color === 'rainbow') rainbowLose++;
        if (lose.action === 'lever') leverLose++;
        if (win.action === 'lever') leverWin++;
    }
    check(rainbowLose === 0 && leverLose === 0 && leverWin > 0, '昇格チャレンジ: 虹ゲージと レバーは 確定');
    const m = Machine.create(CONFIG, 's399', rng);
    let bad = 0;
    for (let i = 0; i < 5000; i++) {
        const result = { kind: 'hit', mode: 'normal', next: i % 2 ? 'st' : 'normal' };
        Object.assign(result, Show.hold(CONFIG, m, 1, result, rng));
        if (result.sango) continue;
        const even = Show.plan(CONFIG, m, { fig: 1, result, holdsLeft: 0 }, rng).figures[0] % 2 === 0;
        if (even !== Boolean(result.promo)) bad++;
    }
    check(bad === 0, '昇格チャレンジは 偶数図柄だけ');
}
// 遊タイム: 天井まで まわすと 時短
{
    for (const specId of Object.keys(CONFIG.specs)) {
        const spec = CONFIG.specs[specId], m = Machine.create(CONFIG, specId, () => 0.999);
        let at = 0;
        for (let i = 0; i < spec.yutime.at * 12 * 10 && !at; i++) {
            if (m.holds[1].length < 2 && m.mode === 'normal') Machine.enter(m, 'heso');
            Machine.update(m, 1 / 10);
            for (const e of m.events.splice(0)) if (e.type === 'yutime') at = m.stats.spins1;
        }
        check(at === spec.yutime.at && m.mode === 'jitan', `${spec.label}: 遊タイムは ${spec.yutime.at} 回転で 時短 (${at} 回転)`);
    }
}
// おにおにRASH の バトル (2026-11-04 ユーザー指定)
for (const specId of Object.keys(CONFIG.specs)) {
    const spec = CONFIG.specs[specId], rng = seeded(SEED + 8), m = Machine.create(CONFIG, specId, rng);
    m.mode = 'st';
    const cont = spec.st.hitRate / (spec.st.hitRate + spec.st.fallRate);
    const c = {};
    const add = k => { c[k] = (c[k] || 0) + 1; };
    let bad = 0;
    for (let i = 0; i < 300000; i++) {
        const hit = rng() < cont;
        m.stAlly = null;
        const p = Show.plan(CONFIG, m, { fig: 2, result: { kind: hit ? 'hit' : 'fall' }, holdsLeft: 0 }, rng);
        const h = hit ? 'H:' : 'F:';
        add(h + 'all');
        if (p.revive !== 'none') { add('lost'); if (hit) add('revived'); }
        add(h + 'self:' + (p.self === 'white' ? 'white' : 'color'));
        add(h + 'foe:' + p.foe);
        if (p.ally) { add(h + (p.ally.team ? 'team' : 'one')); if (p.ally.team && p.ally.members.length !== 3) bad++; }
        if (hit ? p.figures[1] !== p.figures[0] : p.figures[1] !== 'END' || p.figures[0] !== p.figures[2] || p.figures[0] === 7) bad++;
        if (p.revive === 'win' && p.foe === 'gold') bad++;
        if (!(p.t.reach < p.t.enemy && p.t.enemy < p.t.self && p.t.self < p.t.foe && p.t.foe < p.t.clash && p.t.clash < p.t.action && p.t.action < p.t.result && p.t.result <= p.t.end && p.t.end < p.duration)) bad++;
    }
    const trust = k => (c['H:' + k] || 0) / ((c['H:' + k] || 0) + (c['F:' + k] || 0));
    check(bad === 0, `${spec.label}: バトルの 図柄 (勝ちは そろう・負けは まんなか END)・時間の ならび`);
    check(near(c.revived / c.lost, SHOW.stBattle.revive, 0.01), `${spec.label}: 復活チャレンジ ${pct(c.revived / c.lost)}`);
    check(trust('self:color') > 0.8, `${spec.label}: 白以外の 技 撃破率 ${pct(trust('self:color'))} (白 ${pct(trust('self:white'))})`);
    check(trust('foe:gold') === 1 && trust('foe:red') > trust('foe:purple'), `${spec.label}: 敵の 技 紫 ${pct(trust('foe:purple'))} < 赤 ${pct(trust('foe:red'))} < 金 確定`);
    check(trust('team') > 0.9 && trust('team') > trust('one'), `${spec.label}: 仲間 1 人 ${pct(trust('one'))}・チーム ${pct(trust('team'))}`);
}
// 先バレ: おにおにRASH でも 出る
{
    const rng = seeded(SEED + 9), m = Machine.create(CONFIG, 's319', rng);
    m.mode = 'st';
    const c = { hit: 0, gold: 0, fall: 0, fallGold: 0 };
    for (let i = 0; i < 200000; i++) {
        const hit = i % 2 === 0;
        const r = { kind: hit ? 'hit' : 'fall', mode: 'st', ...{} };
        Object.assign(r, Show.hold(CONFIG, m, 2, r, rng));
        if (r.senbare) { c[hit ? 'hit' : 'fall']++; if (r.btn === 'gold') c[hit ? 'gold' : 'fallGold']++; }
    }
    check(c.hit > 0 && c.gold > 0 && c.fallGold === 0, `おにおにRASH の 先バレ (当たり ${c.hit}・転落 ${c.fall}・金 ${c.gold})`);
    const j = Machine.create(CONFIG, 's399', rng);
    j.mode = 'jitan';
    check(!Show.hold(CONFIG, j, 2, { kind: 'miss' }, () => 0).senbare, '時短の 電チューでは 先バレなし');
}
// RASH の カスタマイズ
{
    const spec = CONFIG.specs.s399, rng = seeded(SEED + 11);
    // 柱の氷モード: 3000発 以上の 当たりだけ 告知。出玉の 振り分けは かわらない
    for (const mode of ['st', 'hst']) {
        const m = Machine.create(CONFIG, 's399', rng);
        m.mode = mode; m.stLeft = 100; m.fx = { rashMode: 'hashira' };
        let n = 0, big = 0, shown = 0, wrong = 0, upN = 0, upShown = 0;
        for (let i = 0; i < 100000; i++) {
            const result = { kind: 'hit', mode };
            const p = Show.plan(CONFIG, m, { fig: 2, result, holdsLeft: 0 }, rng);
            const k = spec.payout.rash.find(x => x.id === result.forcePay);
            const full = k.rounds >= 20, up = k.uwanose && result.forceUwanose;
            const notice = Boolean(p.shuketsuNotice);
            n++; if (full || up) big++; if (notice) shown++;
            if (up) { upN++; if (notice) upShown++; }
            if (full ? !notice : !up && notice) wrong++;
            if (notice && p.revive === 'win') wrong++;
        }
        check(wrong === 0 && near(big / n, 0.5, 0.01), `柱の氷モード (${mode}): 3000発 以上の 当たり ${pct(big / n)}・告知 ${pct(shown / n)}`);
        check(near(1 - upShown / upN, SHOW.rashMode.uwanoseSilent, 0.01), `柱の氷モード (${mode}): 上乗せで 3000発の 告知なし ${pct(1 - upShown / upN)}`);
        const miss = Show.plan(CONFIG, m, { fig: 2, result: { kind: 'miss', mode }, holdsLeft: 0 }, rng);
        check(!miss.shuketsuNotice, `柱の氷モード (${mode}): はずれでは 告知なし`);
    }
    const light = Machine.create(CONFIG, 's319', rng);
    light.mode = 'st'; light.fx = { rashMode: 'hashira' };
    check(!Show.plan(CONFIG, light, { fig: 2, result: { kind: 'hit', mode: 'st' }, holdsLeft: 0 }, rng).shuketsuNotice, '1/319 では 告知なし');
    // こおりくんモード: 先読みの 期待度が 上がる
    const trust = rashMode => {
        const m = Machine.create(CONFIG, 's399', rng);
        m.mode = 'hst'; m.fx = { rashMode };
        let h = 0, f = 0;
        for (let i = 0; i < 200000; i++) { if (Show.hold(CONFIG, m, 2, { kind: 'hit' }, rng).senbare) h++; if (Show.hold(CONFIG, m, 2, { kind: 'miss' }, rng).senbare) f++; }
        return (h / 73) / (h / 73 + f * 72 / 73);
    };
    const a = trust('onioni'), b = trust('koori');
    check(b > a + 0.1, `こおりくんモードの 先バレ ${pct(b)} > おにおにモード ${pct(a)}`);
}
// 上乗せジャッジの レバー: 成功の ゲームの 25% で 一発告知 (失敗の ゲームでは 出ない)
{
    const judge = (win, seed) => {
        const u = Machine.create(CONFIG, 's399', seeded(seed));
        Machine.debugMode(u, 'st');
        Machine.debugHold(u, 'hit', { pay: 'uwanose', uwanose: win, enemy: 'haru' });
        for (let i = 0; i < 30 * 60 && !u.bonus; i++) Machine.update(u, 1 / 30);
        Machine.skipBonus(u);
        u.events.length = 0;
        const shot = Machine.uwanoseLever(u), again = Machine.uwanoseLever(u);
        const t0 = u.bonus.uwanose.t;
        let flashAt = null;
        for (let i = 0; i < 30 * 12 && u.bonus && flashAt === null; i++) {
            Machine.update(u, 1 / 30);
            if (u.events.some(e => e.type === 'goldFlash')) flashAt = u.bonus.uwanose.t - t0;
        }
        return { shot, again, flashAt };
    };
    let shots = 0, late = 0, wrong = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
        const r = judge(true, SEED + 100 + i);
        if (r.again) wrong++;
        if (r.flashAt === null) wrong++;
        if (r.shot) { shots++; if (r.flashAt > CONFIG.specs.s399.uwanose.oneshot + 0.2) late++; }
        if (judge(false, SEED + 900 + i).shot) wrong++;
    }
    check(wrong === 0 && late === 0 && near(shots / N, 0.25, 0.07), `上乗せジャッジ: レバーの 一発告知 ${pct(shots / N)}・失敗の ゲームでは なし`);
}
// ラウンドの スキップ
{
    const play = (m, onTick) => { for (let i = 0; i < 30 * 400 && m.mode === 'bonus' || i < 60; i++) { Machine.update(m, 1 / 30); if (onTick) onTick(); } };
    const bonusOf = (next, opt) => { const m = Machine.create(CONFIG, 's399', seeded(SEED + 12)); Machine.debugHold(m, 'hit', { next, promo: false, gizi: 0, gun: false, reach: 'normal', ...opt }); for (let i = 0; i < 30 * 40 && !m.bonus; i++) Machine.update(m, 1 / 30); return m; };
    // 奇数図柄の 初当たり: すぐ スキップできて 3000発
    let m = bonusOf('st');
    check(Machine.canSkip(m) && Machine.skipBonus(m) === 3000 && m.bonus.phase === 'ending', 'スキップ: 3000発 まるごと');
    // 昇格チャレンジ: 結果が わかるまで スキップできない
    m = bonusOf('st', { promo: true });
    let before = Machine.canSkip(m), during = false, after = false, balls = 0;
    for (let i = 0; i < 30 * 200 && m.bonus && !after; i++) {
        if (m.parts.attacker && i % 20 === 0) Machine.enter(m, 'attacker');
        Machine.update(m, 1 / 30);
        if (m.bonus && m.bonus.promo.state === 'run' && Machine.canSkip(m)) during = true;
        if (m.bonus && m.bonus.promo.state === 'done') { after = Machine.canSkip(m); }
    }
    balls = Machine.skipBonus(m) + m.bonus.round * 0;
    check(!before && !during && after && m.stats.promoWins === 1 && m.bonus.rounds === 20 && balls > 1500, `スキップ: 昇格チャレンジの 結果の あとから (${balls}発)`);
    // 上乗せ: スキップの あとに 上乗せジャッジ → 判定
    for (const win of [true, false]) {
        const u = Machine.create(CONFIG, 's399', seeded(SEED + 13));
        Machine.debugMode(u, 'st');
        Machine.debugHold(u, 'hit', { pay: 'uwanose', uwanose: win, enemy: 'haru' });
        for (let i = 0; i < 30 * 60 && !u.bonus; i++) Machine.update(u, 1 / 30);
        u.events.length = 0;
        const first = Machine.skipBonus(u);
        const waited = u.bonus.phase === 'uwanoseWait' && u.events.some(e => e.type === 'uwanoseStart');
        for (let i = 0; i < 30 * 20 && u.bonus.phase === 'uwanoseWait'; i++) Machine.update(u, 1 / 30);
        const got = u.events.some(e => e.type === 'uwanose');
        const second = win ? Machine.skipBonus(u) : 0;
        check(first === 1500 && waited && got === win && second === (win ? 1500 : 0), `スキップ: 上乗せ${win ? '成功' : '失敗'} (${first} + ${second}発)`);
    }
    // チャージも スキップできる
    const c = Machine.create(CONFIG, 's399', seeded(SEED + 14));
    Machine.debugHold(c, 'charge', { next: 'normal' });
    for (let i = 0; i < 30 * 30 && !c.bonus; i++) Machine.update(c, 1 / 30);
    check(Machine.skipBonus(c) === 300, 'スキップ: チャージ 300発');
}
// 敵の 文字の 色 (ST・柱の氷RASH): 金は 80% 以上
for (const [mode, chance] of [['st', 0.8], ['hst', 0.1]]) {
    const w = SHOW.battleText, g = w.hit.gold * chance, b = w[mode].gold * (1 - chance);
    check(g / (g + b) > 0.8, `${mode === 'st' ? 'おにおにRASH' : '柱の氷RASH'} の 金文字 ${pct(g / (g + b))}`);
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
        if (p.sub === 'battle') { add(h, p.attack); add(h, 'k:' + p.hKind); if (p.shuketsu) add(h, 'shuketsu'); if (p.rival !== 'rival') add(h, 'allyChance'); }
    }
    const trust = k => { const a = (c.hit[k] || 0), b = (c.miss[k] || 0); return a / (a + b); };
    check(trust('senbare') > 0.75, `先バレの 信頼度 ${pct(trust('senbare'))}`);
    check(trust('sb_roar') > trust('sb_voice') && trust('sb_voice') > 0.7, `先咆哮 ${pct(trust('sb_roar'))} は 先バレ音 ${pct(trust('sb_voice'))} より アツい`);
    check(trust('flash') === 1, '虹色の フラッシュは かならず 当たり');
    check(trust('k:ippatsu') === 1 && trust('k:rainbow') === 1, 'バトルの 一発告知・虹色の 決め手は かならず 当たり');
    check(trust('k:plain') < 0.05 && (c.hit['k:plain'] || 0) > 0, `一発告知も 虹色も ない バトルは ほぼ はずれ (${pct(trust('k:plain'))})`);
    check((c.hit.flash || 0) > (c.hit.battle || 0), `当たりは 勝負なしが 多い (勝負なし ${c.hit.flash}・バトル ${c.hit.battle})`);
    check(trust('ichigeki') > trust('rengeki'), `一撃 ${pct(trust('ichigeki'))} は 連撃 ${pct(trust('rengeki'))} より 期待度が 高い`);
    check(trust('shuketsu') > 0.6, `柱の氷 集結 ${pct(trust('shuketsu'))} は 大チャンス`);
    check(trust('allyChance') > trust('battle'), `おにおに・こおりくん 参戦 ${pct(trust('allyChance'))} は チャンス (バトル全体 ${pct(trust('battle'))})`);
}
// 時短の はずれの リーチも 7 では 出ない
{
    const rng = seeded(SEED + 10), m = Machine.create(CONFIG, 's319', rng);
    m.mode = 'jitan';
    let bad = 0, reach = 0;
    for (let i = 0; i < 100000; i++) {
        const p = Show.plan(CONFIG, m, { fig: 2, result: { kind: 'miss' }, holdsLeft: 0 }, rng);
        if (p.reach) { reach++; if (p.figures[0] === 7) bad++; }
    }
    check(reach > 0 && bad === 0, `時短の はずれの リーチは 7 に ならない (${reach} 回)`);
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
