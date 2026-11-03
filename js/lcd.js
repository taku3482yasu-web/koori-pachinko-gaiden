// =====================================================================
// 液晶 (演出の 絵)
// ---------------------------------------------------------------------
// 論理 272x138 を 3 倍の canvas に 描き、盤面の 液晶の ところへ 縮めて はる。
// Lcd.handle(event, m)  台の できごと (Machine の events) を うけとる
// Lcd.draw(m, now)      いまの 絵を 描く (変動の すすみは m.spin.elapsed に 合わせる)
// Lcd.prompt()          いま 押してほしい もの ('push' / 'lever' / null)。台の ボタン・金棒レバーを 光らせる
// Lcd.input(kind)       PUSH / 金棒レバーが 押された・引かれた
// Lcd.gimmick()         いま 動いている 役物 { kind, t } (render が 盤面の 上に 描く)
//
// 通常時 = ストーリーの 背景 (町 → 酒場 → 雪原 → 柱の氷の アジト) と 図柄。リーチは 種類ごとの 場面へ。
// ST = 「おにおにの 挑戦」。当たり・転落の 変動は バトル (相手・流派・撃破率の 星・チャンスアップ・決め手・撃破 / 敗北)
// =====================================================================

const Lcd = (() => {
    const W = 272, H = 138, S = 3;
    const FONT = '"DotGothic16", "MS Gothic", monospace';
    let canvas = null, ctx = null;
    // 図柄 1〜9 の キャラ
    const FIG_CHARS = { 1: 'koori', 2: 'furukawa', 3: 'tomoishi', 4: 'okagappa', 5: 'hibikimakuri', 6: 'yamamou', 7: 'onioni', 8: 'hyougaryu', 9: 'harigeneral' };
    const HOLD_COLORS = { white: '#f0f4ff', blue: '#4a9cff', green: '#3adc6a', red: '#ff3a4a', gold: '#ffd84a', rainbow: 'rainbow' };
    const CUTIN_COLORS = { blue: '#2a6cff', green: '#18c050', red: '#e8102a', gold: '#ffc820' };
    const TEAMS = [
        { name: 'チーム5DX', members: ['okagappa', 'hibikimakuri', 'yamamou'] },
        { name: 'チームASK-3', members: ['sasaki', 'kotani', 'asahara'] },
        { name: 'チームお願いマッスル', members: ['shibata', 'ueno', 'ikekimu'] }
    ];

    const st = {
        last: null,          // 最後に 止まった 変動 { plan, result }
        banner: null,        // 画面の まんなかに 出す 知らせ { text, sub, color, until, start }
        flash: 0,            // 画面が 光る (のこり秒)
        shake: 0,
        gim: null,           // 役物 { kind, start, dur }
        action: null,        // 押してほしい もの { kind, from, to, done, result }
        bonus: null,         // 大当たり中の 絵 { rounds, round, count, next, from, chain, start }
        ending: null,        // { next, chain, start }
        fallen: null,        // 転落の 場面 { start, chain }
        chainEnd: null,
        stEntry: null,
        holdFlash: {},
        now: 0
    };

    function init(el) {
        canvas = el || document.createElement('canvas');
        canvas.width = W * S;
        canvas.height = H * S;
        ctx = canvas.getContext('2d');
        return canvas;
    }

    // ----- 部品 -----
    const rainbow = (now, k = 0) => `hsl(${(now * 240 + k * 40) % 360}, 95%, 62%)`;
    function text(str, x, y, size, color, align = 'center', opt = {}) {
        ctx.font = `${opt.bold ? 'bold ' : ''}${size}px ${FONT}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        if (opt.stroke !== false) {
            ctx.lineWidth = opt.strokeWidth || Math.max(2, size / 5);
            ctx.strokeStyle = opt.strokeColor || '#000';
            ctx.lineJoin = 'round';
            ctx.strokeText(str, x, y);
        }
        ctx.fillStyle = color === 'rainbow' ? rainbow(st.now) : color;
        ctx.fillText(str, x, y);
    }
    const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
    const clamp01 = k => Math.min(1, Math.max(0, k));

    // ----- 背景 -----
    let seed = 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    function sky(top, bottom) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, top);
        g.addColorStop(1, bottom);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }
    function snow(now, n = 40, speed = 18, wind = 6, color = 'rgba(255,255,255,0.8)') {
        seed = 3;
        ctx.fillStyle = color;
        for (let i = 0; i < n; i++) {
            const x = (rnd() * W + now * wind * (0.5 + rnd())) % W;
            const y = (rnd() * H + now * speed * (0.6 + rnd())) % H;
            ctx.fillRect(x, y, rnd() < 0.3 ? 2 : 1, rnd() < 0.3 ? 2 : 1);
        }
    }
    function background(id, now) {
        if (id === 'town') {
            sky('#1a2a5a', '#6a8ac8');
            // SE タウン (家と 窓の あかり)
            seed = 11;
            for (let x = -4; x < W;) {
                const w = 16 + Math.floor(rnd() * 22), h = 22 + Math.floor(rnd() * 30);
                ctx.fillStyle = '#1a2040';
                ctx.fillRect(x, H - 26 - h, w - 2, h);
                ctx.fillStyle = '#e8f0ff';
                ctx.fillRect(x - 1, H - 26 - h - 2, w, 3);   // 屋根の 雪
                ctx.fillStyle = '#ffd86a';
                for (let wy = H - 22 - h; wy < H - 30; wy += 7) for (let wx = x + 3; wx < x + w - 5; wx += 6) if (rnd() < 0.5) ctx.fillRect(wx, wy, 3, 3);
                x += w;
            }
            ctx.fillStyle = '#e8f0ff';
            ctx.fillRect(0, H - 26, W, 26);
            snow(now, 50);
        } else if (id === 'tavern') {
            sky('#3a1a0a', '#6a3a1a');
            ctx.fillStyle = '#4a2a12';
            for (let x = 0; x < W; x += 24) ctx.fillRect(x, 0, 2, H - 30);
            // たな と びん
            ctx.fillStyle = '#2a1608';
            ctx.fillRect(0, 30, W, 4);
            ctx.fillRect(0, 62, W, 4);
            seed = 5;
            for (let x = 6; x < W; x += 11) { ctx.fillStyle = ['#3adc6a', '#ff9a4a', '#8ad0ff', '#e04a6a'][Math.floor(rnd() * 4)]; ctx.fillRect(x, 20 + Math.floor(rnd() * 4), 5, 10); ctx.fillRect(x + 3, 54, 4, 8); }
            // ランプ
            const a = 0.25 + 0.08 * Math.sin(now * 3);
            ctx.fillStyle = `rgba(255, 200, 90, ${a})`;
            ctx.beginPath(); ctx.arc(W / 2, 14, 40, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5a3416';
            ctx.fillRect(0, H - 30, W, 30);
            ctx.fillStyle = '#7a4a22';
            ctx.fillRect(0, H - 30, W, 3);
        } else if (id === 'snowfield') {
            sky('#6ab0f0', '#d8f0ff');
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(0, H - 40);
            for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H - 40 - Math.sin(x / 30) * 10 - Math.sin(x / 13) * 3);
            ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
            // 遠くの 山
            ctx.fillStyle = '#a8c8e8';
            ctx.beginPath(); ctx.moveTo(0, H - 46); ctx.lineTo(40, H - 86); ctx.lineTo(80, H - 50); ctx.lineTo(140, H - 100); ctx.lineTo(200, H - 52); ctx.lineTo(256, H - 80); ctx.lineTo(256, H - 40); ctx.lineTo(0, H - 40); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.moveTo(130, H - 92); ctx.lineTo(140, H - 100); ctx.lineTo(150, H - 92); ctx.fill();
            snow(now, 30, 10, 14);
        } else if (id === 'hideout') {
            sky('#0a0a24', '#1a2a4a');
            // 氷の 柱 (柱の氷の アジト)
            for (let i = 0; i < 6; i++) {
                const x = 12 + i * 46, h = 80 + (i % 2) * 20;
                const g = ctx.createLinearGradient(x, 0, x + 18, 0);
                g.addColorStop(0, '#3a6aa8'); g.addColorStop(0.5, '#a8e0ff'); g.addColorStop(1, '#2a4a80');
                ctx.fillStyle = g;
                ctx.fillRect(x, H - 24 - h, 18, h);
                ctx.fillStyle = 'rgba(160, 220, 255, 0.3)';
                ctx.fillRect(x - 3, H - 26 - h, 24, 4);
            }
            const a = 0.15 + 0.1 * Math.sin(now * 2);
            ctx.fillStyle = `rgba(120, 80, 255, ${a})`;
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#10182a';
            ctx.fillRect(0, H - 24, W, 24);
            snow(now, 20, 6, -4, 'rgba(180,220,255,0.6)');
        } else if (id === 'st') {
            // ST: 赤と むらさきの 空・いなずま
            sky('#2a0418', '#6a0a2a');
            seed = 9;
            for (let i = 0; i < 18; i++) {
                const a = (now * 0.4 + i / 18) * Math.PI * 2;
                ctx.strokeStyle = `rgba(255, 90, 120, ${0.08 + 0.05 * Math.sin(now * 3 + i)})`;
                ctx.lineWidth = 6;
                ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(W / 2 + Math.cos(a) * 300, H / 2 + Math.sin(a) * 300); ctx.stroke();
            }
            if (Math.floor(now * 1.3) % 4 === 0 && (now * 1.3) % 1 < 0.12) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, W, H); }
            ctx.fillStyle = '#1a0210';
            ctx.fillRect(0, H - 20, W, 20);
        } else if (id === 'jitan') {
            // 時短: あおい トンネルを かける
            sky('#04102a', '#0a3a6a');
            for (let i = 0; i < 10; i++) {
                const k = ((now * 0.8 + i / 10) % 1);
                const r = 10 + k * 200;
                ctx.strokeStyle = `rgba(120, 200, 255, ${0.5 * (1 - k)})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(W / 2 - r, H / 2 - r * 0.55, r * 2, r * 1.1);
            }
        } else if (id === 'hashiraRash') {
            // 柱の氷RASH: むらさきの ふぶきの 中に 3 本の 柱 (嵐・渦・雪の 色)
            sky('#120830', '#3a2470');
            [['#3ab888', 30], ['#3a78e0', W / 2 - 9], ['#e8eeff', W - 48]].forEach(([c, x], i) => {
                const h = 90 + Math.sin(now * 1.5 + i) * 4;
                ctx.fillStyle = c;
                ctx.globalAlpha = 0.5;
                ctx.fillRect(x, H - 20 - h, 18, h);
                ctx.globalAlpha = 1;
            });
            snow(now, 70, 26, -60, 'rgba(230,220,255,0.8)');
            ctx.fillStyle = '#0a0620';
            ctx.fillRect(0, H - 20, W, 20);
        } else if (id === 'battle') {
            sky('#0a0420', '#3a1a5a');
            seed = 4;
            for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(rnd() * W, rnd() * (H - 40), 1, 1); }
            ctx.fillStyle = '#2a1a3a';
            ctx.fillRect(0, H - 28, W, 28);
            ctx.fillStyle = '#4a3a6a';
            ctx.fillRect(0, H - 28, W, 2);
        } else if (id === 'bonus') {
            sky('#2a1a00', '#a86a00');
            for (let i = 0; i < 16; i++) {
                const a = now * 0.6 + i / 16 * Math.PI * 2;
                ctx.fillStyle = i % 2 ? 'rgba(255, 240, 160, 0.18)' : 'rgba(255, 200, 60, 0.12)';
                ctx.beginPath(); ctx.moveTo(W / 2, H / 2);
                ctx.lineTo(W / 2 + Math.cos(a) * 300, H / 2 + Math.sin(a) * 300);
                ctx.lineTo(W / 2 + Math.cos(a + 0.2) * 300, H / 2 + Math.sin(a + 0.2) * 300);
                ctx.fill();
            }
        }
    }

    // ----- 図柄 -----
    // 氷の ブロックに 数字と キャラ。size: ブロックの 高さ
    function figure(n, cx, cy, size, opt = {}) {
        const w = size * 0.86, h = size;
        const x = cx - w / 2, y = cy - h / 2;
        const odd = n % 2 === 1;
        ctx.save();
        if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, odd ? '#ffffff' : '#f0f4ff');
        g.addColorStop(0.5, odd ? '#bfe8ff' : '#d8dcf0');
        g.addColorStop(1, odd ? '#3a8ad8' : '#7a84a8');
        ctx.fillStyle = '#0a1a3a';
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(x + 2, y + 2, w * 0.35, 2);
        // キャラ
        Art.draw(ctx, FIG_CHARS[n], cx + w * 0.12, y + h - 2, { height: h * 0.62, frame: opt.frame });
        // 数字
        const color = n === 7 ? '#ff2a3a' : odd ? '#1a5ad8' : '#4a4a6a';
        text(String(n), x + w * 0.26, y + h * 0.3, Math.round(size * 0.52), opt.gold ? 'rainbow' : color, 'center', { bold: true, strokeColor: '#ffffff', strokeWidth: Math.max(2, size / 12) });
        ctx.restore();
    }
    // 回っている 図柄 (たてに 流れる)
    function reel(cx, cy, size, offset, opt = {}) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - size, cy - size * 0.75, size * 2, size * 1.5);
        ctx.clip();
        const step = size * 1.08;
        const base = Math.floor(offset);
        const frac = offset - base;
        for (let k = -1; k <= 1; k++) {
            const n = ((base + k) % 9 + 9) % 9 + 1;
            figure(n, cx, cy + (k + frac) * step - step * 0, size, { alpha: 0.85 });
        }
        // 速さの すじ
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(cx - size * 0.45, cy - size * 0.75, size * 0.9, size * 1.5);
        ctx.restore();
    }

    // 3 つの 図柄を 描く。stops: それぞれ 止まったか、figs: 止まった 数字、spinT: 回る 速さの もと
    function reels(layout, figs, stopped, now, opt = {}) {
        const { y, size, gap, x0 } = layout;
        for (let i = 0; i < 3; i++) {
            const cx = (x0 !== undefined ? x0 : W / 2 - gap) + i * gap;
            if (stopped[i]) {
                const bounce = opt.bounce && opt.bounce[i] ? Math.sin(Math.min(1, opt.bounce[i]) * Math.PI) * -3 : 0;
                figure(figs[i], cx, y + bounce, size, { frame: Math.floor(now * 3), gold: opt.gold });
            } else {
                reel(cx, y, size, now * (opt.speed || 14) + i * 3.3, opt);
            }
        }
    }
    const BIG = { y: 64, size: 52, gap: 74 };
    const SMALL = { y: 14, size: 18, gap: 18, x0: 20 };

    // ----- 保留 (下に 4 つ) -----
    function holds(m, now) {
        const list = m.mode === 'normal' ? m.holds[1] : m.holds[2];
        for (let i = 0; i < 4; i++) {
            const x = W / 2 - 30 + i * 20, y = H - 8;
            const h = list[i];
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
            if (!h) continue;
            const c = HOLD_COLORS[h.shownColor || 'white'];
            ctx.fillStyle = c === 'rainbow' ? rainbow(now, i) : c;
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillRect(x - 2, y - 3, 2, 1);
        }
        // いま 変動中の 保留 (左)
        if (m.spin && m.spin.fig === 1 && m.mode === 'normal') {
            const c = HOLD_COLORS[m.spin.result.holdColor || 'white'];
            ctx.fillStyle = c === 'rainbow' ? rainbow(now) : c;
            ctx.beginPath(); ctx.arc(W / 2 - 52, H - 8, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        }
    }

    // ----- 決め手 (PUSH / 金棒レバー) -----
    function setAction(kind, from, to) {
        if (!st.action || st.action.from !== from) st.action = { kind, from, to, done: false };
    }
    function input(kind) {
        const a = st.action;
        if (!a || a.done) return false;
        if (a.kind === 'mash') {
            // 連打: 押すたびに ゲージが のびる (時間が きたら 決まる)
            if (kind !== 'push') return false;
            a.count = (a.count || 0) + 1;
            return true;
        }
        if (a.kind !== kind && !(a.kind === 'push' && kind === 'lever')) return false;
        a.done = true;
        a.doneAt = st.now;
        return true;
    }
    function prompt() {
        const a = st.action;
        return a && !a.done ? a.kind : null;
    }
    // 変動の なかの 決め手の 時間 (from〜to 秒) を すぎたら 自動で 押した ことに
    function actionWindow(kind, el, from, to) {
        if (el >= from && el < to) setAction(kind, from, to);
        const a = st.action;
        if (a && a.from === from && !a.done && el >= to) { a.done = true; a.doneAt = st.now; a.auto = true; }
        return a && a.from === from ? a : null;
    }
    function drawPrompt(a, now) {
        if (!a) return;
        if (!a.done) {
            const k = (now * 4) % 1;
            if (a.kind === 'mash') {
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.fillRect(0, H / 2 - 22, W, 40);
                const r = 14 + (Math.floor(now * 16) % 2) * 3;
                ctx.fillStyle = '#ff2a3a';
                ctx.beginPath(); ctx.arc(W / 2 + 70, H / 2 - 2, r, 0, Math.PI * 2); ctx.fill();
                text('PUSH', W / 2 + 70, H / 2 - 2, 8, '#ffffff', 'center', { bold: true });
                text('ボタンを 連打！', W / 2 - 20, H / 2 - 4, 18, k < 0.5 ? '#4ab0ff' : '#ffffff', 'center', { bold: true });
            } else if (a.kind === 'lever') {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, H / 2 - 22, W, 44);
                Art.draw(ctx, 'kanabo', W / 2 + 70, H / 2 + 22, { height: 44, rot: -0.5 - Math.sin(now * 10) * 0.25 });
                text('金棒レバーを 引け！', W / 2 - 14, H / 2 - 4, 18, k < 0.5 ? '#ff3a4a' : '#ffd84a', 'center', { bold: true });
                text('← 台の 右の レバーを 左へ', W / 2 - 14, H / 2 + 14, 9, '#ffffff');
            } else {
                const r = 18 + Math.sin(now * 12) * 2;
                ctx.fillStyle = '#ff2a3a';
                ctx.beginPath(); ctx.arc(W / 2, H / 2 + 4, r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
                text('PUSH', W / 2, H / 2 + 4, 11, '#ffffff', 'center', { bold: true });
                text('ボタンを 押せ！', W / 2, H / 2 - 22, 12, '#ffd84a');
            }
        } else if (now - a.doneAt < 0.5) {
            ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (now - a.doneAt) / 0.5)})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    // ----- カットイン -----
    function cutin(color, who, line, k, now) {
        if (k <= 0 || k >= 1) return;
        const slide = k < 0.15 ? ease(k / 0.15) : k > 0.85 ? 1 - ease((k - 0.85) / 0.15) : 1;
        const c = color === 'gold' ? `hsl(${45 + Math.sin(now * 20) * 8}, 100%, 55%)` : CUTIN_COLORS[color] || color;
        ctx.save();
        ctx.translate((1 - slide) * -W, 0);
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(W, 22); ctx.lineTo(W, 96); ctx.lineTo(0, 104); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let i = 0; i < 12; i++) ctx.fillRect(((i * 30 + now * 400) % (W + 40)) - 40, 26 + i * 6, 40, 1);
        Art.draw(ctx, who, 60, 100, { height: 66, frame: Math.floor(now * 6) });
        text(line, 170, 62, 13, '#ffffff', 'center', { bold: true });
        ctx.restore();
    }

    // ----- 知らせ -----
    function banner(textStr, sub, color, dur = 2) {
        st.banner = { text: textStr, sub, color, start: st.now, until: st.now + dur };
    }
    // 設定示唆の トロフィー (液晶の 左下。CONFIG.settingHint)
    function trophy(level) { st.trophy = { level, start: st.now }; }
    function drawTrophy(now) {
        const t = st.trophy;
        if (!t) return;
        const el = now - t.start, len = CONFIG.settingHint.show;
        if (el > len) { st.trophy = null; return; }
        const c = CONFIG.settingHint.colors[t.level];
        const x = 10, y = H - 34 - (1 - ease(el / 0.4)) * 40;
        const hue = (now * 240) % 360;
        const main = c.rainbow ? `hsl(${hue},90%,60%)` : c.main;
        const light = c.rainbow ? `hsl(${(hue + 60) % 360},90%,80%)` : c.light;
        const dark = c.rainbow ? `hsl(${(hue + 180) % 360},80%,40%)` : c.dark;
        ctx.globalAlpha = Math.min(1, (len - el) / 0.5);
        ctx.fillStyle = main;
        ctx.fillRect(x + 2, y, 14, 9);              // さかずき
        ctx.fillRect(x - 1, y + 1, 3, 5);           // とって
        ctx.fillRect(x + 16, y + 1, 3, 5);
        ctx.fillStyle = light;
        ctx.fillRect(x + 4, y + 1, 3, 6);
        ctx.fillStyle = dark;
        ctx.fillRect(x + 7, y + 9, 4, 5);           // 柱
        ctx.fillRect(x + 3, y + 14, 12, 4);         // 台
        if (t.level >= 5) {
            ctx.fillStyle = '#ffffff';
            const k = Math.floor(now * 8) % 4;
            ctx.fillRect(x + 18 + k, y - 3, 2, 2);
            ctx.fillRect(x - 3, y + 10 - k, 2, 2);
        }
        ctx.globalAlpha = 1;
    }

    // 先バレ: 赤い わくが 光る。先咆哮は おにおにの 顔が せまって「咆哮」
    function drawSenbare(now) {
        const s = st.senbare;
        if (!s) return;
        const t = now - s.start, len = s.kind === 'roar' ? 2.2 : 1.2;
        if (t > len) { st.senbare = null; return; }
        const a = (1 - t / len) * (0.6 + 0.4 * Math.sin(now * 30));
        ctx.strokeStyle = `rgba(255,30,50,${a})`;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, W - 6, H - 6);
        if (s.kind !== 'roar') return;
        const k = clamp01(t / 0.25), out = clamp01((t - len + 0.4) / 0.4);
        ctx.fillStyle = `rgba(60,0,0,${0.55 * (1 - out)})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1 - out;
        const jx = (Math.random() - 0.5) * 4 * (1 - k * 0.5);
        Art.draw(ctx, 'onioni', W / 2 - 40 + jx, H - 6, { height: 70 + 50 * ease(k), frame: Math.floor(now * 12) % 2 });
        text('咆哮', W / 2 + 62 + jx, H / 2 - 4, 30 * (1.6 - 0.6 * ease(k)), Math.floor(now * 12) % 2 ? '#ff2a3a' : '#ffd84a', 'center', { bold: true });
        text('ガアアアッ！！', W / 2 + 62, H / 2 + 26, 11, '#ffffff');
        ctx.globalAlpha = 1;
    }

    function drawBanner(now) {
        const b = st.banner;
        if (!b || now > b.until) return;
        const k = clamp01((now - b.start) / 0.25);
        ctx.fillStyle = `rgba(0,0,0,${0.55 * k})`;
        ctx.fillRect(0, H / 2 - 22, W, 44);
        text(b.text, W / 2, H / 2 - (b.sub ? 6 : 0), 20 * (0.6 + 0.4 * ease(k)), b.color || '#ffffff', 'center', { bold: true });
        if (b.sub) text(b.sub, W / 2, H / 2 + 14, 10, '#ffffff');
    }

    // ----- できごと -----
    function handle(e, m) {
        if (e.type === 'spinStart') {
            st.action = null;
            st.gimStarted = false;
            if (e.plan.yaku && e.plan.kind === 'normal') st.gimPlanned = true;
            if (e.plan.story !== undefined) st.storyChange = { start: st.now, story: e.plan.story };
        } else if (e.type === 'spinEnd') {
            st.last = { plan: e.plan, result: e.result, at: st.now };
        } else if (e.type === 'bonusStart') {
            st.bonus = { rounds: e.rounds, round: 0, count: 0, next: e.next, from: e.from, chain: e.chain, start: st.now };
            st.ending = null;
            st.flash = 0.6;
            // 大当たりの はじまりに ときどき 役物 (初当たりは かならず どれか)
            if (e.from === 'normal' || Math.random() < 0.35) startGimmick(e.from === 'normal' ? 'pillars' : 'kanabo', 3.2);
        } else if (e.type === 'roundStart') {
            if (st.bonus) { st.bonus.round = e.round; st.bonus.count = 0; }
        } else if (e.type === 'count') {
            if (st.bonus) st.bonus.count = e.count;
        } else if (e.type === 'ending') {
            st.ending = { next: e.next, chain: e.chain, from: e.from, start: st.now };
        } else if (e.type === 'bonusEnd') {
            st.bonus = null;
        } else if (e.type === 'stStart') {
            if (e.entry || e.rash !== st.lastRash) st.stEntry = { start: st.now, rash: e.rash };
            st.lastRash = e.rash;
        } else if (e.type === 'stEnd') {
            st.fallen = { start: st.now, chain: e.chain, rash: e.rash };
        } else if (e.type === 'jitanStart') {
            banner('時短 100回', 'あたれば ST「おにおにの挑戦」！', '#7ad8ff', 2.5);
        } else if (e.type === 'jitanEnd') {
            banner('時短 終了', `${e.chain}連`, '#c8d8ff', 2.5);
        } else if (e.type === 'chainEnd') {
            if (e.chain >= 2) st.chainEnd = { start: st.now, chain: e.chain, balls: e.balls };
        } else if (e.type === 'hold' && e.result.senbare && m.mode === 'hst') {
            // 先バレ: 入った しゅんかんに 光る。先咆哮は おにおにが 叫んで 液晶が ゆれる
            st.flash = e.result.senbare === 'roar' ? 0.4 : 0.7;
            st.senbare = { start: st.now, kind: e.result.senbare };
            if (e.result.senbare === 'roar') st.shake = 1.2;
        } else if (e.type === 'holdChange') {
            st.holdFlash[e.index] = st.now;
        }
    }

    function startGimmick(kind, dur) {
        st.gim = { kind, start: st.now, dur };
    }
    function gimmick() {
        const g = st.gim;
        if (!g) return null;
        const t = (st.now - g.start) / g.dur;
        if (t >= 1) { st.gim = null; return null; }
        return { kind: g.kind, t };
    }

    // ===== 描く =====
    function draw(m, now) {
        st.now = now;
        ctx.setTransform(S, 0, 0, S, 0, 0);
        ctx.imageSmoothingEnabled = false;
        const sh = st.shake > 0 ? (Math.random() - 0.5) * 4 : 0;
        ctx.save();
        ctx.translate(sh, 0);
        if (m.bonus || st.bonus) drawBonus(m, now);
        else if (m.spin) drawSpin(m, now);
        else drawIdle(m, now);
        ctx.restore();
        // 転落 / 連チャン終わり / ST 突入 の 場面は 上に かさねる
        drawFallen(now);
        drawChainEnd(now);
        drawStEntry(now);
        drawSenbare(now);
        drawTrophy(now);
        drawBanner(now);
        if (st.flash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${Math.min(1, st.flash)})`;
            ctx.fillRect(0, 0, W, H);
        }
    }
    function tick(dt) {
        st.flash = Math.max(0, st.flash - dt * 2);
        st.shake = Math.max(0, st.shake - dt);
    }

    function modeBg(m) {
        if (m.mode === 'st') return 'st';
        if (m.mode === 'hst') return 'hashiraRash';
        if (m.mode === 'jitan' || m.mode === 'jitanLast') return 'jitan';
        return SHOW.stories[m.story].bg;
    }

    // 上の 帯 (いまの 状態)
    function header(m, now) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, 11);
        if (m.mode === 'st') {
            text('おにおにRASH', 4, 6, 8, '#ff6a8a', 'left');
            text(`${m.chain}連中`, W - 4, 6, 8, '#ffd84a', 'right');
            text(`${m.stSpins}回転`, W / 2 + 40, 6, 7, '#ffffff', 'center');
        } else if (m.mode === 'hst') {
            text('柱の氷RASH', 4, 6, 8, '#b89cff', 'left');
            text(`${m.chain}連中`, W - 4, 6, 8, '#ffd84a', 'right');
            text(`のこり ${m.stLeft} 回`, W / 2 + 30, 6, 7, '#ffffff', 'center');
        } else if (m.mode === 'jitan' || m.mode === 'jitanLast') {
            text('時短', 4, 6, 8, '#7ad8ff', 'left');
            text(`のこり ${m.jitanLeft} 回`, W - 4, 6, 8, '#ffffff', 'right');
        } else {
            const sname = SHOW.stories[m.story].name;
            text(sname, W - 4, 6, 7, '#e0e8ff', 'right');
        }
    }

    function drawIdle(m, now) {
        background(modeBg(m), now);
        header(m, now);
        const last = st.last;
        const figs = last ? last.plan.figures : [7, 3, 1];
        if (m.mode === 'normal') {
            // おにおにが うろうろ (ストーリーの 場面ごとに 仲間が ふえる)
            idleCast(m, now);
            reels(BIG, figs, [1, 1, 1], now);
        } else {
            reels(m.mode === 'st' ? { y: 60, size: 44, gap: 62 } : BIG, figs, [1, 1, 1], now);
            if (m.mode === 'st') Art.draw(ctx, 'onioni', 30, H - 20, { height: 34, frame: Math.floor(now * 3) });
        }
        holds(m, now);
    }

    function idleCast(m, now) {
        const story = m.story;
        const walk = Math.floor(now * 3);
        const x = 30 + ((now * 10) % 40);
        Art.draw(ctx, 'onioni', x, H - 18, { height: 22, frame: walk, flip: Math.floor(now / 4) % 2 === 1 });
        if (story >= 2) {
            Art.draw(ctx, 'okagappa', W - 46, H - 18, { height: 22, frame: walk });
            Art.draw(ctx, 'hibikimakuri', W - 26, H - 18, { height: 22, frame: walk + 1 });
        }
        if (story === 3) {
            Art.draw(ctx, 'kanezu', W / 2, 40, { height: 26, frame: walk, alpha: 0.35 });
        }
    }

    // ----- 変動中 -----
    function drawSpin(m, now) {
        const sp = m.spin, plan = sp.plan, el = sp.elapsed, D = sp.duration;
        if (plan.kind === 'battle') return drawBattle(m, plan, el, D, now);
        if (plan.kind === 'stMiss') return drawStMiss(m, plan, el, D, now);
        if (plan.kind === 'jitan') return drawJitan(m, plan, el, D, now);
        if (plan.kind === 'hashira') return drawHashira(m, plan, el, D, now);
        drawNormal(m, plan, el, D, now);
    }

    // 通常時の 変動
    function drawNormal(m, plan, el, D, now) {
        const reach = plan.reach;
        const big = reach && reach !== 'normal' && reach !== 'zenkaiten';
        const gunOff = plan.gun ? 2.5 : 0;
        const tL = 1.0 + gunOff, tR = 1.7 + gunOff;
        const tC = reach ? D - 0.7 : D - 0.25;
        const stopped = [el >= tL, el >= tR, el >= tC];
        const figs = plan.figures;
        const sceneStart = tR + 0.9;
        const inScene = big && el >= sceneStart && el < D - 0.7;

        if (inScene) {
            drawReachScene(m, plan, el - sceneStart, D - 0.7 - sceneStart, now);
            reels(SMALL, figs, [1, 0, 1], now, { speed: 10 });
        } else if (reach === 'zenkaiten' && el >= 1.0) {
            background('bonus', now);
            const k = el - 1.0;
            const n = k < D - 3 ? (Math.floor(k * 3) % 9) + 1 : 7;
            reels(BIG, [n, n, n], [1, 1, 1], now, { gold: true });
            text('全回転', W / 2, 12, 12, 'rainbow', 'center', { bold: true });
        } else {
            background(modeBg(m), now);
            header(m, now);
            if (!big) idleCast(m, now);
            reels(BIG, figs, stopped, now, { bounce: stopped.map((s, i) => (s ? (el - [tL, tR, tC][i]) * 4 : 0)) });
            if (reach && stopped[1] && !stopped[2]) {
                text('リーチ', W / 2, 24, 14, Math.floor(now * 6) % 2 ? '#ff3a4a' : '#ffd84a', 'center', { bold: true });
                if (reach === 'normal') {
                    // ノーマルリーチ: まんなかが ゆっくり
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    ctx.fillRect(W / 2 - 36, 30, 72, 70);
                }
            }
            // 群 (ふぶきの 中を ライバル探検隊が かけぬける)
            if (plan.gun && el > 0.6 && el < 0.6 + gunOff + 0.4) drawGun(el - 0.6, now);
        }
        // さいご: 当たり / はずれ
        if (el >= tC && plan.hit) {
            const k = (el - tC) / 0.7;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * (1 - k)})`;
            ctx.fillRect(0, 0, W, H);
        }
        holds(m, now);
    }

    function drawGun(k, now) {
        // ふぶきが ふきあれて、ライバル探検隊が 右から 左へ かけぬける
        ctx.fillStyle = `rgba(230, 240, 255, ${Math.min(0.7, k * 0.8)})`;
        ctx.fillRect(0, 0, W, H);
        snow(now, 160, 30, -160, 'rgba(255,255,255,0.95)');
        const all = TEAMS.flatMap(t => t.members);
        all.forEach((id, i) => {
            const x = W + 30 - (k * 160 - i * 18) % (W + 260);
            Art.draw(ctx, id, x, 80 + (i % 3) * 22, { height: 30, frame: Math.floor(now * 8) + i });
        });
        text('ライバル探検隊が かけつけた！', W / 2, 16, 11, '#1a3a8a', 'center', { strokeColor: '#ffffff' });
    }

    // 大きい リーチの 場面 (探検隊リーチ / 柱の氷リーチ)。k: 場面に 入ってからの 秒、len: 場面の 長さ
    function drawReachScene(m, plan, k, len, now) {
        const reach = plan.reach;
        const hashira = reach === 'haru' || reach === 'okadishi' || reach === 'kanezu';
        background(hashira ? 'hideout' : 'snowfield', now);
        const team = TEAMS[(m.stats.spins1 + (plan.figures[0] || 0)) % TEAMS.length];
        const enemy = hashira ? reach : null;
        const e = enemy ? SHOW.enemies[enemy] : null;
        // 1) タイトル (0〜2 秒)
        if (k < 2) {
            const a = ease(k / 0.4);
            ctx.fillStyle = `rgba(0,0,0,${0.5 * a})`;
            ctx.fillRect(0, 34, W, 60);
            if (hashira) {
                text('柱の氷リーチ', W / 2, 52, 18 * a, '#bfe8ff', 'center', { bold: true });
                text(`${e.name}  ${e.ryuha}`, W / 2, 76, 12, e.color, 'center');
                if (reach === 'kanezu') text('リーダー 登場！', W / 2, 92, 9, '#ff6a8a');
            } else {
                text('探検隊リーチ', W / 2, 52, 18 * a, '#ffd84a', 'center', { bold: true });
                text(team.name, W / 2, 76, 12, '#ffffff', 'center');
            }
            return;
        }
        // 2) すすむ (おにおにと 仲間 / 柱の氷)
        const p = k - 2, body = len - 2;
        const walk = Math.floor(now * 6);
        if (hashira) {
            // おにおに vs 柱の氷
            const clash = Math.sin(p * 3);
            Art.draw(ctx, 'onioni', 70 + clash * 6, H - 26, { height: 44, frame: walk });
            Art.draw(ctx, enemy, 190 - clash * 6, H - 26, { height: 60, frame: walk, flip: true });
            // 流派の わざ (嵐: 風 / 大渦: うず / 吹雪: 雪)
            if (enemy === 'haru') for (let i = 0; i < 6; i++) { ctx.strokeStyle = 'rgba(200,255,220,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(150, 70, 10 + ((p * 30 + i * 12) % 60), now * 4 + i, now * 4 + i + 1.4); ctx.stroke(); }
            if (enemy === 'okadishi') for (let i = 0; i < 5; i++) { ctx.strokeStyle = 'rgba(120,180,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(130, 100, 20 + i * 14, 6 + i * 4, 0, now * 5 + i, now * 5 + i + 2.5); ctx.stroke(); }
            if (enemy === 'kanezu') snow(now, 140, 40, -120);
            text(`VS ${e.name}`, W / 2, 20, 12, e.color, 'center', { bold: true });
        } else {
            // 探検隊と いっしょに こおりくんを さがす (足あとを たどる)
            team.members.forEach((id, i) => Art.draw(ctx, id, 150 + i * 30, H - 24, { height: 34, frame: walk + i }));
            Art.draw(ctx, 'onioni', 100, H - 24, { height: 34, frame: walk });
            text('こおりくんの 足あとだ！', W / 2, 22, 11, '#1a3a8a', 'center', { strokeColor: '#ffffff' });
            for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(90,140,200,0.6)'; ctx.fillRect(20 + i * 14 - (p * 20) % 14, H - 20 + (i % 2) * 3, 4, 2); }
        }
        // 3) カットイン (まんなか)
        if (plan.cutin) {
            const ck = (p - body * 0.35) / 1.6;
            const who = hashira ? (ck < 0.5 ? enemy : 'onioni') : team.members[0];
            cutin(plan.cutin, who, hashira ? (plan.cutin === 'gold' ? 'こおりくんを かえせ！！' : 'いくぞ！') : 'こっちだ！', ck, now);
        }
        // 4) 決め手 (おわりの 3 秒前から)
        const aFrom = len - 3.2, aTo = len - 1.6;
        if (plan.action) {
            const a = actionWindow(plan.action, k, aFrom, aTo);
            if (plan.yaku && a && a.done && !st.gimStarted) { st.gimStarted = true; startGimmick(plan.action === 'lever' ? 'kanabo' : 'doors', 2.6); st.flash = 0.8; }
            drawPrompt(a, now);
        } else if (plan.yaku && k >= aFrom && !st.gimStarted) { st.gimStarted = true; startGimmick('doors', 2.6); }
        // 5) けっか
        if (k >= aTo) {
            const r = (k - aTo) / (len - aTo);
            if (plan.hit) {
                text(hashira ? '撃破！！' : 'みつけた！！', W / 2, 60, 24 * (0.6 + 0.4 * ease(r * 3)), 'rainbow', 'center', { bold: true });
                if (plan.yaku) text('激アツ', W / 2, 88, 12, '#ff3a4a', 'center', { bold: true });
            } else {
                ctx.fillStyle = `rgba(0,0,30,${0.5 * r})`;
                ctx.fillRect(0, 0, W, H);
                text(hashira ? 'おにおにが ふきとばされた…' : 'みうしなった…', W / 2, 60, 12, '#c8d8ff');
            }
        }
    }

    // ----- ST -----
    function drawStMiss(m, plan, el, D, now) {
        background('st', now);
        header(m, now);
        const stopped = [el > D * 0.45, el > D * 0.65, el > D - 0.2];
        reels({ y: 60, size: 44, gap: 62 }, plan.figures, stopped, now, { speed: 22 });
        Art.draw(ctx, 'onioni', 30, H - 20, { height: 34, frame: Math.floor(now * 4) });
        if (plan.tease) {
            // 相手の 気配 (かげが 出て 消える)
            const k = el / D;
            Art.draw(ctx, plan.tease, W - 40, H - 20, { height: 50, alpha: Math.sin(k * Math.PI) * 0.7, silhouette: true });
            if (k > 0.2 && k < 0.8) text('…けはい？', W - 40, 30, 9, '#ffb0c0');
        }
        holds(m, now);
    }

    // おにおにの バトル (当たり = 撃破 / 転落 = 敗北)
    function drawBattle(m, plan, el, D, now) {
        const e = SHOW.enemies[plan.enemy];
        background('battle', now);
        const walk = Math.floor(now * 6);
        if (el < 1.0) {
            background('st', now);
            reels({ y: 60, size: 44, gap: 62 }, [7, 7, 7], [0, 0, 0], now, { speed: 26 });
            return;
        }
        // 1) 相手の 登場 (1〜3.2 秒): 名前・流派・撃破率の 星
        if (el < 3.2) {
            const k = (el - 1) / 2.2;
            Art.draw(ctx, plan.enemy, W / 2 + 50, H - 20, { height: 80 * ease(k * 2), frame: walk, flip: true });
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 20, W * ease(k * 3), 46);
            text('VS', 28, 42, 20, '#ff3a4a', 'center', { bold: true });
            text(e.name, 110, 36, 16, e.color, 'center', { bold: true });
            text(e.ryuha, 110, 56, 9, '#ffffff');
            // 撃破率の 星 (相手ごと)
            const stars = Math.round(e.kill * 5);
            for (let i = 0; i < 5; i++) text('★', 200 + i * 10, 46, 10, i < stars ? '#ffd84a' : '#444', 'center', { stroke: false });
            text('撃破率', 220, 34, 7, '#ffffff');
            return;
        }
        // 2) たたかう
        const p = el - 3.2;
        const hitEnd = D - 2.4;   // 決め手の あと けっか
        const clash = Math.sin(p * 5) * (p < hitEnd - 3.2 ? 8 : 0);
        Art.draw(ctx, 'onioni', 70 + clash, H - 28, { height: 50, frame: walk });
        Art.draw(ctx, plan.enemy, 186 - clash, H - 28, { height: 64, frame: walk, flip: true });
        if (Math.floor(p * 5) % 3 === 0) { ctx.fillStyle = 'rgba(255,240,160,0.8)'; ctx.fillRect(122 + clash, 60, 10, 10); }
        text(`VS ${e.name}`, W / 2, 10, 10, e.color, 'center', { bold: true });
        header(m, now);
        // チャンスアップ (4.5 秒あたり)
        if (plan.chance) {
            const ck = (el - 4.6) / 1.6;
            if (plan.enemy === 'harigeneral') cutin('gold', 'onioni', 'チャンスアップ！', ck, now);
            else cutin('red', 'onioni', 'チャンスアップ！', ck, now);
        }
        // 決め手
        const aFrom = D - 5.2, aTo = D - 3.0;
        const a = actionWindow(plan.action, el, aFrom, aTo);
        if (a && a.done && plan.yaku && !st.gimStarted) { st.gimStarted = true; startGimmick('kanabo', 2.4); }
        drawPrompt(a, now);
        if (el >= aTo) {
            const r = (el - aTo) / (D - aTo);
            if (plan.hit) {
                // 撃破: 相手が ふきとぶ
                ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.7 - r * 2)})`;
                ctx.fillRect(0, 0, W, H);
                text('撃破！！', W / 2, 54, 30 * (0.5 + 0.5 * ease(r * 4)), 'rainbow', 'center', { bold: true });
                text(`${m.chain + 1}連 GET`, W / 2, 86, 12, '#ffd84a', 'center');
                reels({ y: 118, size: 18, gap: 22 }, [7, 7, 7], [1, 1, 1], now);
            } else {
                ctx.fillStyle = `rgba(20,0,10,${Math.min(0.7, r * 1.4)})`;
                ctx.fillRect(0, 0, W, H);
                text('おにおにが たおされた…', W / 2, 60, 13, '#ff8aa0', 'center');
            }
        }
    }

    // ----- 時短 -----
    function drawJitan(m, plan, el, D, now) {
        background('jitan', now);
        header(m, now);
        const stopped = plan.reach ? [el > 0.6, el > 1.1, el > D - 0.4] : [el > D * 0.5, el > D * 0.7, el > D - 0.15];
        reels(BIG, plan.figures, stopped, now, { speed: 24 });
        if (plan.reach && el > 1.1 && el < D - 0.4) {
            text('こおりくんの 声が きこえた…！？', W / 2, 24, 10, '#bfe8ff', 'center');
            Art.draw(ctx, 'koori', W / 2, H - 14, { height: 30 * clamp01((el - 1.5) / 3), alpha: 0.8, frame: Math.floor(now * 3) });
        }
        holds(m, now);
    }

    // ----- 大当たり -----
    function drawBonus(m, now) {
        const b = st.bonus || { rounds: m.bonus.rounds, round: m.bonus.round, count: m.bonus.count, next: m.bonus.next, from: m.bonus.from, chain: m.chain, start: now };
        background('bonus', now);
        const el = now - b.start;
        const fig = st.last && st.last.plan ? st.last.plan.figures : [7, 7, 7];
        if (st.ending) {
            // エンディング: ST 突入 / 時短 / ST 継続
            const k = now - st.ending.start;
            if (st.ending.next === 'st') {
                const hashira = m.rashType === 'hashira';
                background(hashira ? 'hashiraRash' : 'st', now);
                text(st.ending.from === 'st' || st.ending.from === 'hst' ? 'RASH 継続！' : 'RASH 突入！', W / 2, 40, 22 * (0.6 + 0.4 * ease(k * 2)), 'rainbow', 'center', { bold: true });
                text(hashira ? '柱の氷RASH' : 'おにおにRASH', W / 2, 66, 14, hashira ? '#b89cff' : '#ff6a8a', 'center', { bold: true });
                text(`${st.ending.chain}連中`, W / 2, 88, 12, '#ffd84a', 'center');
                if (hashira) ['haru', 'okadishi', 'kanezu'].forEach((id, i) => Art.draw(ctx, id, W - 90 + i * 30, H - 10, { height: 34, frame: Math.floor(now * 4) + i }));
                else Art.draw(ctx, 'onioni', 40, H - 10, { height: 44, frame: Math.floor(now * 4) });
            } else {
                background('jitan', now);
                text('時短 100回', W / 2, 44, 20, '#7ad8ff', 'center', { bold: true });
                text('100回の あいだに あてれば ST！', W / 2, 70, 10, '#ffffff', 'center');
            }
            return;
        }
        if (m.bonus && m.bonus.phase === 'opening') {
            // 大当たり！
            reels({ y: 70, size: 44 + Math.sin(el * 6) * 2, gap: 62 }, fig, [1, 1, 1], now, { gold: true });
            text('大当たり', W / 2, 18, 18 * (0.6 + 0.4 * ease(el * 2)), 'rainbow', 'center', { bold: true });
            const odd = fig[0] % 2 === 1;
            if (b.from === 'normal') text(odd ? 'ST 確定！' : '時短 チャンス', W / 2, 122, 11, odd ? '#ff6a8a' : '#7ad8ff', 'center', { bold: true });
            else if (b.from === 'st') text(`${b.chain}連 撃破！`, W / 2, 122, 11, '#ffd84a', 'center', { bold: true });
            return;
        }
        // ラウンド中: ストーリーの 絵 (ラウンドごとに すすむ)
        const round = m.bonus ? m.bonus.round : b.round;
        roundStory(round, b, now);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, 13);
        text(`ROUND ${round} / ${b.rounds}`, 6, 7, 9, '#ffd84a', 'left', { bold: true });
        text(`${m.bonus ? m.bonus.count : 0} / 10`, W - 6, 7, 9, '#ffffff', 'right');
        text('右打ち →', W - 6, H - 8, 9, Math.floor(now * 3) % 2 ? '#ff6a8a' : '#ffffff', 'right');
        if (m.chain >= 2) text(`${m.chain}連`, 6, H - 8, 10, '#ffd84a', 'left', { bold: true });
    }

    // 大当たりの ラウンド中に 流れる ストーリー
    const ROUND_STORY = [
        { bg: 'town', who: ['onioni'], line: 'こおりくんが いない…！' },
        { bg: 'tavern', who: ['onioni', 'okagappa'], line: '柱の氷が さらったと いう うわさ' },
        { bg: 'snowfield', who: ['onioni', 'hibikimakuri', 'yamamou'], line: 'ライバル探検隊と いっしょに さがそう' },
        { bg: 'hideout', who: ['haru', 'okadishi', 'kanezu'], line: '柱の氷… こおり一族の 悪の 一派' },
        { bg: 'hideout', who: ['kanezu'], line: 'ほのおを こえる ために こおりくんの 大腸菌を…' },
        { bg: 'hideout', who: ['akaishi'], line: 'そして ダケジャの 赤石を もとめている' },
        { bg: 'snowfield', who: ['sasaki', 'kotani', 'asahara'], line: 'チームASK-3も かけつけた！' },
        { bg: 'snowfield', who: ['shibata', 'ueno', 'ikekimu'], line: 'チームお願いマッスルも いるぞ！' },
        { bg: 'hideout', who: ['onioni', 'harigeneral', 'hyougaryu'], line: 'まってろ こおりくん！' },
        { bg: 'town', who: ['koori', 'onioni'], line: 'こおりくんを とりもどせ！！' }
    ];
    function roundStory(round, b, now) {
        // 3R の 台は 3 つ (まんなかを とばす)
        const idx = b.rounds <= 3 ? [0, 3, 9][Math.max(0, round - 1)] ?? 9 : Math.max(0, round - 1) % ROUND_STORY.length;
        const s = ROUND_STORY[idx];
        background(s.bg, now);
        s.who.forEach((id, i) => {
            const n = s.who.length;
            Art.draw(ctx, id, W / 2 + (i - (n - 1) / 2) * 56, H - 30, { height: id === 'akaishi' ? 30 : 50, frame: Math.floor(now * 3) + i });
        });
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, H - 28, W, 16);
        text(s.line, W / 2, H - 20, 9, '#ffffff');
    }

    // ----- かさねる 場面 -----
    function drawFallen(now) {
        const f = st.fallen;
        if (!f) return;
        const k = now - f.start;
        if (k > 3.2) { st.fallen = null; return; }
        ctx.fillStyle = `rgba(10,0,20,${Math.min(0.85, k * 2)})`;
        ctx.fillRect(0, 0, W, H);
        if (f.rash === 'hashira') {
            text('柱の氷RASH 終了', W / 2, 36, 16, '#b89cff', 'center', { bold: true });
            ['haru', 'okadishi', 'kanezu'].forEach((id, i) => Art.draw(ctx, id, W / 2 - 50 + i * 50, H - 24, { height: 34, alpha: 0.7 }));
        } else {
            Art.draw(ctx, 'onioni', W / 2, H - 30, { height: 40, rot: Math.PI / 2 * Math.min(1, k * 2), alpha: 0.8 });
            text('おにおにRASH 終了', W / 2, 36, 16, '#ff8aa0', 'center', { bold: true });
        }
        text(`${f.chain}連で 終了`, W / 2, 60, 11, '#ffffff', 'center');
    }
    function drawChainEnd(now) {
        const c = st.chainEnd;
        if (!c) return;
        const k = now - c.start;
        if (k < 3.2) return;   // 転落の 場面の あと
        if (k > 6.5) { st.chainEnd = null; return; }
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(20, 30, W - 40, 70);
        ctx.strokeStyle = '#ffd84a';
        ctx.strokeRect(20, 30, W - 40, 70);
        text('おにおにの挑戦 結果', W / 2, 44, 11, '#ffd84a', 'center');
        text(`${c.chain}連`, W / 2, 66, 22, 'rainbow', 'center', { bold: true });
        if (c.balls) text(`約 ${c.balls} 個`, W / 2, 88, 10, '#ffffff', 'center');
    }
    function drawStEntry(now) {
        const s = st.stEntry;
        if (!s) return;
        const k = now - s.start;
        if (k > 2.6) { st.stEntry = null; return; }
        const a = Math.min(0.8, k * 3) * (k > 2.2 ? (2.6 - k) / 0.4 : 1);
        if (s.rash === 'hashira') {
            ctx.fillStyle = `rgba(40,10,80,${a})`;
            ctx.fillRect(0, 0, W, H);
            text('柱の氷RASH', W / 2, 44, 24, '#b89cff', 'center', { bold: true });
            text('100回で 当たりを ねらえ！ 先バレ・一発告知に 注目', W / 2, 78, 9, '#ffd84a', 'center');
        } else {
            ctx.fillStyle = `rgba(80,0,20,${a})`;
            ctx.fillRect(0, 0, W, H);
            text('おにおにRASH', W / 2, 44, 24, '#ff3a4a', 'center', { bold: true });
            text('たおされたら 終わり！ 柱の氷を 撃破せよ', W / 2, 78, 9, '#ffd84a', 'center');
        }
    }


    // ----- 柱の氷RASH (2026-11-04 ユーザー指定: 一発告知・先バレが 主役。ときどき バトル) -----
    const ALLY_NAMES = { rival: 'ライバル探検隊', onioni: 'おにおに', koori: 'こおりくん' };
    function drawHashira(m, plan, el, D, now) {
        background('hashiraRash', now);
        header(m, now);
        if (plan.sub === 'quick') {
            const stopped = [el > D * 0.4, el > D * 0.6, el > D - 0.2];
            reels({ y: 64, size: 44, gap: 66 }, plan.hit ? [7, 7, 7] : plan.figures, stopped, now, { speed: 24 });
            if (plan.hit && el > D - 0.2) text('当たり！', W / 2, 112, 14, 'rainbow', 'center', { bold: true });
            holds(m, now);
            return;
        }
        if (plan.sub === 'ippatsu') {
            // 一発告知: はじまって すぐ いきなり 光って 当たり
            if (el < 0.3) { reels({ y: 64, size: 44, gap: 66 }, [7, 7, 7], [0, 0, 0], now, { speed: 24 }); return; }
            if (!st.gimStarted) { st.gimStarted = true; startGimmick(Math.random() < 0.5 ? 'pillars' : 'doors', 3.2); st.flash = 1; st.shake = 0.5; }
            background('bonus', now);
            reels({ y: 66, size: 48, gap: 70 }, [7, 7, 7], [1, 1, 1], now, { gold: true });
            text('一発告知！！', W / 2, 18, 18, 'rainbow', 'center', { bold: true });
            return;
        }
        // バトル
        const walk = Math.floor(now * 6);
        if (el < 0.8) { reels({ y: 64, size: 44, gap: 66 }, [7, 7, 7], [0, 0, 0], now, { speed: 26 }); return; }
        background('battle', now);
        const chanceAlly = plan.ally !== 'rival';
        const team = TEAMS[(m.stSpins + 1) % TEAMS.length];
        const allyIds = plan.ally === 'rival' ? team.members : [plan.ally];
        const extra = plan.shuketsu ? 1.5 : 0;
        // 1) 登場 (0.8〜2.8): 柱の氷 (集結なら 3 人が 1 人ずつ) と 味方
        const k1 = el - 0.8;
        plan.enemies.forEach((id, i) => {
            const appear = clamp01((k1 - i * 0.5) / 0.4);
            if (appear <= 0) return;
            const x = plan.enemies.length === 1 ? W - 70 : W - 120 + i * 44;
            Art.draw(ctx, id, x, H - 26, { height: (plan.enemies.length === 1 ? 64 : 52) * ease(appear), frame: walk + i, flip: true });
        });
        allyIds.forEach((id, i) => {
            const x = allyIds.length === 1 ? 64 : 30 + i * 34;
            const appear = clamp01((k1 - 0.6) / 0.4);
            if (appear > 0) Art.draw(ctx, id, x, H - 26, { height: (allyIds.length === 1 ? 50 : 38) * ease(appear), frame: walk + i });
        });
        if (k1 < 2 + extra) {
            if (plan.shuketsu && k1 > 0.6) text('柱の氷 集結！！', W / 2, 22, 18, Math.floor(now * 8) % 2 ? '#ff3a4a' : '#ffd84a', 'center', { bold: true });
            else if (!plan.shuketsu) text(`VS ${SHOW.enemies[plan.enemies[0]].name}`, W / 2, 22, 13, SHOW.enemies[plan.enemies[0]].color, 'center', { bold: true });
            if (chanceAlly && k1 > 1.2) text(`${ALLY_NAMES[plan.ally]} 参戦！ チャンス！`, W / 2, 42, 11, '#ffd84a', 'center', { bold: true });
            if (plan.shuketsu && k1 > 1.4) text('大チャンス', W / 2, 42 + (chanceAlly ? 16 : 0), 12, 'rainbow', 'center', { bold: true });
        }
        // 2) わざえらび (一撃 / 連撃。ルーレットの ように 光って きまる)
        const tPick = 2.8 + extra, tDecide = tPick + 1.4;
        if (el >= tPick && el < tDecide + 0.8) {
            const spinning = el < tDecide;
            const cur = spinning ? (Math.floor(el * 10) % 2 ? 'ichigeki' : 'rengeki') : plan.attack;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(W / 2 - 80, 50, 160, 34);
            text('一撃', W / 2 - 40, 67, cur === 'ichigeki' ? 18 : 12, cur === 'ichigeki' ? '#ff3a4a' : '#666', 'center', { bold: true });
            text('連撃', W / 2 + 40, 67, cur === 'rengeki' ? 18 : 12, cur === 'rengeki' ? '#4ab0ff' : '#666', 'center', { bold: true });
            if (!spinning) text(plan.attack === 'ichigeki' ? '金棒レバーで 一撃！' : 'ボタン 連打で 連撃！', W / 2, 94, 9, '#ffffff', 'center');
        }
        // 3) 決め手
        const aFrom = D - 5.4, aTo = D - 3.0;
        const a = actionWindow(plan.action, el, aFrom, aTo);
        drawPrompt(a, now);
        if (a && plan.action === 'mash' && !a.done) {
            // 連打の ゲージ
            const g = Math.min(1, (a.count || 0) / 14);
            ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 60, H - 22, 120, 8);
            ctx.fillStyle = g >= 1 ? `hsl(${(now * 400) % 360}, 90%, 60%)` : '#4ab0ff';
            ctx.fillRect(W / 2 - 59, H - 21, 118 * g, 6);
        }
        // 4) けっか
        if (el >= aTo) {
            const r = (el - aTo) / (D - aTo);
            if (plan.hit) {
                ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.7 - r * 2)})`;
                ctx.fillRect(0, 0, W, H);
                text(plan.shuketsu ? '柱の氷 撃破！！' : '撃破！！', W / 2, 54, 26 * (0.5 + 0.5 * ease(r * 4)), 'rainbow', 'center', { bold: true });
                reels({ y: 118, size: 18, gap: 22 }, [7, 7, 7], [1, 1, 1], now);
            } else {
                ctx.fillStyle = `rgba(0,0,30,${Math.min(0.6, r * 1.2)})`;
                ctx.fillRect(0, 0, W, H);
                text('ふせがれた…', W / 2, 60, 13, '#c8d8ff', 'center');
            }
        }
        holds(m, now);
    }

    // 早送り・テスト用
    function debug() { return st; }

    return { init, handle, draw, tick, prompt, input, gimmick, startGimmick, banner, trophy, debug, W, H, S, FIG_CHARS, get canvas() { return canvas; } };
})();
