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
    const TEAMS = SHOW.teams;

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
    let lt = '';   // RASH の 名前の よこの 表記 (1/399 は LT)
    const opt = { yaku: 'always', leverTap: false };   // カスタマイズ (main が setOptions で わたす)
    const setOptions = o => Object.assign(opt, o);
    // 敵の カットインの 文字の 色 (内部の 期待度。白 < 赤 < 金)
    const enemyTextColor = (c, now) => c === 'gold' ? `hsl(${46 + Math.sin(now * 16) * 6}, 100%, 62%)` : c === 'red' ? '#ff3a4a' : '#ffffff';
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
        } else if (id === 'templeRun' || id === 'templeFight') {
            // おにおにRASH: 柱の神殿の 中を ダッシュ
            sky('#140a30', '#3a2470');
            const off = id === 'templeRun' ? (now * 120) % 60 : 0;
            ctx.fillStyle = '#d8d0f4';
            ctx.fillRect(0, 12, W, 5);
            for (let x = -off; x < W + 20; x += 60) {
                const g = ctx.createLinearGradient(x, 0, x + 18, 0);
                g.addColorStop(0, '#5a6ad0'); g.addColorStop(0.5, '#d8e8ff'); g.addColorStop(1, '#5a4ac0');
                ctx.fillStyle = g;
                ctx.fillRect(x, 17, 18, H - 41);
            }
            ctx.fillStyle = '#2a1a4a';
            ctx.fillRect(0, H - 24, W, 24);
            ctx.fillStyle = '#6a5aa0';
            for (let x = -((now * 240) % 40) * (id === 'templeRun' ? 1 : 0); x < W; x += 40) ctx.fillRect(x, H - 22, 20, 2);
        } else if (id === 'black') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, W, H);
        } else if (id === 'arcade') {
            // ゲームセンター: 暗い 店内に ならぶ きょう体と ネオン
            sky('#12082a', '#2a1048');
            ctx.fillStyle = '#ff4ab0';
            ctx.fillRect(0, 18, W, 2);
            ctx.fillStyle = '#4ad8ff';
            ctx.fillRect(0, 22, W, 1);
            for (let i = 0; i < 7; i++) {
                const x = 6 + i * 39;
                ctx.fillStyle = '#1a1a34';
                ctx.fillRect(x, 34, 32, H - 58);
                ctx.fillStyle = `hsl(${(i * 50 + now * 40) % 360}, 80%, ${40 + 12 * Math.sin(now * 3 + i)}%)`;
                ctx.fillRect(x + 4, 40, 24, 24);
                ctx.fillStyle = '#c8c8e0';
                ctx.fillRect(x + 8, 72, 3, 8);
                ctx.fillStyle = '#ff3a4a';
                ctx.fillRect(x + 7, 69, 5, 4);
                ctx.fillStyle = i % 2 ? '#ffd84a' : '#4ad8ff';
                ctx.fillRect(x + 18, 74, 4, 4);
            }
            ctx.fillStyle = '#2a1a44';
            ctx.fillRect(0, H - 24, W, 24);
        } else if (id === 'castle') {
            // SE城: 夕やみの 石の 城
            sky('#2a1a4a', '#c86a4a');
            ctx.fillStyle = '#2a2438';
            ctx.fillRect(40, 44, W - 80, H - 68);
            for (let x = 40; x < W - 40; x += 14) ctx.fillRect(x, 38, 8, 8);
            [[24, 26], [W / 2 - 16, 12], [W - 56, 26]].forEach(([x, y]) => {
                ctx.fillStyle = '#34304a';
                ctx.fillRect(x, y, 32, H - 24 - y);
                ctx.fillStyle = '#7a2a3a';
                ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 16, y - 16); ctx.lineTo(x + 35, y); ctx.fill();
                ctx.fillStyle = '#ffd86a';
                ctx.fillRect(x + 13, y + 14, 6, 9);
            });
            ctx.fillStyle = '#14101e';
            ctx.fillRect(W / 2 - 14, H - 54, 28, 30);
            ctx.fillStyle = '#3a3448';
            ctx.fillRect(0, H - 24, W, 24);
        } else if (id === 'forest') {
            // 森: 雪の のこる 木立
            sky('#0e2a2a', '#3a7a5a');
            seed = 6;
            for (let layer = 0; layer < 2; layer++) {
                for (let x = -10; x < W + 10; x += 26 + layer * 8) {
                    const h = 50 + rnd() * 34, bx = x + rnd() * 10, by = H - 22 - layer * 6;
                    ctx.fillStyle = layer ? '#0e3a2a' : '#16523a';
                    ctx.beginPath(); ctx.moveTo(bx - 16, by); ctx.lineTo(bx, by - h); ctx.lineTo(bx + 16, by); ctx.fill();
                    ctx.fillStyle = '#e8f4f0';
                    ctx.beginPath(); ctx.moveTo(bx - 5, by - h + 15); ctx.lineTo(bx, by - h); ctx.lineTo(bx + 5, by - h + 15); ctx.fill();
                }
            }
            ctx.fillStyle = '#d8ece4';
            ctx.fillRect(0, H - 24, W, 24);
            snow(now, 24, 10, 4);
        } else if (id === 'moon') {
            // 満月: 大きな 月と 雪の 丘
            sky('#04081e', '#16204a');
            const glow = 0.18 + 0.06 * Math.sin(now * 2);
            ctx.fillStyle = `rgba(255, 230, 150, ${glow})`;
            ctx.beginPath(); ctx.arc(W / 2, 50, 56, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffe89a';
            ctx.beginPath(); ctx.arc(W / 2, 50, 38, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e8cc78';
            [[-14, -10, 7], [12, 6, 9], [-6, 16, 5]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(W / 2 + x, 50 + y, r, 0, Math.PI * 2); ctx.fill(); });
            ctx.fillStyle = '#0c1430';
            ctx.beginPath(); ctx.moveTo(0, H);
            for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H - 26 - Math.sin(x / 40) * 8);
            ctx.lineTo(W, H); ctx.fill();
            snow(now, 26, 8, 4, 'rgba(255,245,210,0.7)');
        } else if (id === 'temple') {
            // 柱の神殿: 虹色に 光る 氷の 柱
            sky('#1a0a3a', '#4a2a7a');
            for (let i = 0; i < 12; i++) {
                const a = now * 0.5 + i / 12 * Math.PI * 2;
                ctx.fillStyle = `hsla(${(i * 30 + now * 60) % 360}, 90%, 65%, 0.14)`;
                ctx.beginPath(); ctx.moveTo(W / 2, 30);
                ctx.lineTo(W / 2 + Math.cos(a) * 300, 30 + Math.sin(a) * 300);
                ctx.lineTo(W / 2 + Math.cos(a + 0.26) * 300, 30 + Math.sin(a + 0.26) * 300);
                ctx.fill();
            }
            ctx.fillStyle = '#e8e0ff';
            ctx.beginPath(); ctx.moveTo(30, 28); ctx.lineTo(W / 2, 4); ctx.lineTo(W - 30, 28); ctx.fill();
            ctx.fillRect(30, 28, W - 60, 6);
            for (let i = 0; i < 5; i++) {
                const x = 42 + i * 44;
                const g = ctx.createLinearGradient(x, 0, x + 16, 0);
                g.addColorStop(0, '#6a8ae0'); g.addColorStop(0.5, '#e8f4ff'); g.addColorStop(1, '#6a5ad0');
                ctx.fillStyle = g;
                ctx.fillRect(x, 34, 16, H - 58);
            }
            ctx.fillStyle = '#c8b8f0';
            ctx.fillRect(16, H - 24, W - 32, 6);
            ctx.fillStyle = '#2a1a4a';
            ctx.fillRect(0, H - 18, W, 18);
        } else if (id === 'ruins') {
            // イシイーの 遺跡: 石の かべ
            sky('#2a2010', '#5a4420');
            ctx.fillStyle = '#3a2c16';
            for (let y = 0; y < H - 24; y += 14) for (let x = (y / 14 % 2) * 14 - 14; x < W; x += 28) ctx.fillRect(x, y, 26, 12);
            ctx.fillStyle = '#2a1c0c';
            ctx.fillRect(0, H - 24, W, 24);
        } else if (id === 'goldHall') {
            // 金庫の 暗やみ
            sky('#0a0804', '#2a2008');
            seed = 8;
            for (let i = 0; i < 26; i++) { ctx.fillStyle = 'rgba(255,216,74,0.25)'; ctx.fillRect(rnd() * W, rnd() * H, 2, 2); }
            ctx.fillStyle = '#1a1406';
            ctx.fillRect(0, H - 22, W, 22);
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
        if (n === 'END') {
            // END 図柄 (おにおにRASH の おわり)
            ctx.fillStyle = '#000000';
            ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
            ctx.fillStyle = '#5a0a14';
            ctx.fillRect(x, y, w, h);
            text('END', cx, cy, Math.round(size * 0.36), '#ffffff', 'center', { bold: true, strokeColor: '#a00a1a' });
            return;
        }
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
    const TOP = { y: 28, size: 26, gap: 30 };   // おにおにRASH は 図柄を 小さく して おにおにを 見せる
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
        if (a.kind !== kind && !(a.kind === 'push' && kind === 'lever') && !(a.kind === 'lever' && kind === 'push' && opt.leverTap)) return false;
        a.done = true;
        a.doneAt = st.now;
        return true;
    }
    // 押してほしいのに まだ 押されて いない (main が 演出を 止めて 待つ)
    const promptWaiting = () => Boolean(st.action && !st.action.done && !st.holdPrompt);
    const promptRainbow = () => Boolean(st.action && !st.action.done && st.action.rainbow);
    function prompt() {
        if (st.holdPrompt) return 'push';
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
    // 時間切れ (押さなかった)
    function closeAction() {
        const a = st.action;
        if (a && !a.done) { a.done = true; a.doneAt = st.now; a.auto = true; }
    }
    function drawPrompt(a, now) {
        if (!a) return;
        if (!a.done) {
            const k = (now * 4) % 1;
            if (a.kind === 'mash') {
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.fillRect(0, H / 2 - 22, W, 40);
                const r = 14 + (Math.floor(now * 16) % 2) * 3;
                ctx.fillStyle = a.rainbow ? rainbow(now) : '#ff2a3a';
                ctx.beginPath(); ctx.arc(W / 2 + 70, H / 2 - 2, r, 0, Math.PI * 2); ctx.fill();
                text('PUSH', W / 2 + 70, H / 2 - 2, 8, '#ffffff', 'center', { bold: true });
                text('ボタンを 連打！', W / 2 - 20, H / 2 - 4, 18, k < 0.5 ? '#4ab0ff' : '#ffffff', 'center', { bold: true });
            } else if (a.kind === 'lever') {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, H / 2 - 22, W, 44);
                Art.draw(ctx, 'kanabo', W / 2 + 70, H / 2 + 22, { height: 44, rot: -0.5 - Math.sin(now * 10) * 0.25 });
                text(a.text || '金棒レバーを 引け！', W / 2 - 14, H / 2 - 4, 18, a.rainbow ? 'rainbow' : k < 0.5 ? '#ff3a4a' : '#ffd84a', 'center', { bold: true });
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
    function cutin(color, who, line, k, now, lineColor = '#ffffff') {
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
        text(line, 170, 62, 13, lineColor, 'center', { bold: true });
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
            st.hashiraFlash = false;
            st.crackSnap = null;
            st.crackSmash = false;
            st.holdPrompt = false;
            st.reviveFlash = false;
            st.gimWin = false;
            if (e.plan.yaku && e.plan.kind === 'normal') st.gimPlanned = true;
            if (e.plan.story !== undefined) {
                const s = SHOW.stories[e.plan.story];
                banner(s.name, null, e.plan.story === 5 ? 'rainbow' : e.plan.story === 4 ? '#ffe89a' : '#ffffff', e.plan.story >= 4 ? 2.4 : 1.2);
                st.flash = e.plan.story >= 4 ? 0.9 : 0.4;
            }
        } else if (e.type === 'spinEnd') {
            st.last = { plan: e.plan, result: e.result, at: st.now };
            st.holdPrompt = false;
            st.action = null;
        } else if (e.type === 'bonusStart') {
            st.bonus = { rounds: e.rounds, round: 0, count: 0, next: e.next, from: e.from, chain: e.chain, start: st.now, payKind: e.payKind, charge: e.charge };
            st.uwanose = null;
            st.ending = null;
            st.flash = 0.6;
            // 大当たりの はじまりに ときどき 役物 (初当たりは かならず どれか)
            if (!e.charge && !st.gim && (e.from === 'normal' || Math.random() < 0.35)) startGimmick(e.from === 'normal' ? 'pillars' : 'kanabo', 3.2);
        } else if (e.type === 'uwanoseStart') {
            st.uwanose = { start: st.now, window: e.window, state: 'time' };
        } else if (e.type === 'iwakan') {
            if (st.uwanose) { st.uwanose.state = 'iwakan'; st.uwanose.iwakan = st.now; }
        } else if (e.type === 'uwanose') {
            if (st.uwanose) { st.uwanose.state = 'win'; st.uwanose.end = st.now; }
            if (st.bonus) st.bonus.rounds = e.rounds;
            st.flash = 1;
            st.shake = 0.6;
            startGimmick('kanabo', 2.4);
        } else if (e.type === 'uwanoseEnd') {
            if (st.uwanose) { st.uwanose.state = 'lose'; st.uwanose.end = st.now; }
        } else if (e.type === 'promoStart') {
            Object.assign(st, { action: null, promoGauge: 0, promoLast: 0, promoFlash: false, promoHit: false });
        } else if (e.type === 'promoEnd') {
            st.holdPrompt = false;
            st.action = null;
        } else if (e.type === 'bonusSkip') {
            banner('スキップ', `+${e.balls}発`, '#ffd84a', 1.6);
            st.flash = 0.4;
        } else if (e.type === 'roundStart') {
            if (st.bonus) { st.bonus.round = e.round; st.bonus.count = 0; }
        } else if (e.type === 'count') {
            if (st.bonus) st.bonus.count = e.count;
        } else if (e.type === 'ending') {
            st.ending = { next: e.next, chain: e.chain, from: e.from, charge: e.charge, start: st.now };
        } else if (e.type === 'bonusEnd') {
            st.bonus = null;
        } else if (e.type === 'stStart') {
            if (e.entry || e.rash !== st.lastRash) st.stEntry = { start: st.now, rash: e.rash };
            st.lastRash = e.rash;
        } else if (e.type === 'stEnd') {
            st.fallen = { start: st.now, chain: e.chain, rash: e.rash };
        } else if (e.type === 'yutime') {
            banner('遊タイム 突入！', `${e.at} 回転 はまった`, 'rainbow', 3);
        } else if (e.type === 'jitanStart' && m.stats.yutimes && m.normalSpins >= (m.spec.yutime ? m.spec.yutime.at : Infinity)) {
            // 遊タイムの 知らせを 出して いる
        } else if (e.type === 'jitanStart') {
            banner('時短 100回', 'あたれば ST「おにおにの挑戦」！', '#7ad8ff', 2.5);
        } else if (e.type === 'jitanEnd') {
            banner('時短 終了', `${e.chain}連`, '#c8d8ff', 2.5);
        } else if (e.type === 'chainEnd') {
            if (e.chain >= 2) st.chainEnd = { start: st.now, chain: e.chain, balls: e.balls };
        } else if (e.type === 'hold' && e.result.senbare) {
            // 先バレ: 入った しゅんかんに 光る。先咆哮は おにおにが 叫んで 液晶が ゆれる
            st.flash = e.result.senbare === 'roar' ? 0.4 : 0.7;
            st.senbare = { start: st.now, kind: e.result.senbare };
            if (e.result.senbare === 'roar') st.shake = 1.2;
        } else if (e.type === 'holdChange') {
            st.holdFlash[e.index] = st.now;
        }
    }

    function startGimmick(kind, dur, force = false) {
        if (!force && (opt.yaku === 'off' || (opt.yaku === 'sometimes' && Math.random() > 0.3))) return;
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
        lt = m.spec.lt ? ' LT' : '';
        ctx.setTransform(S, 0, 0, S, 0, 0);
        ctx.imageSmoothingEnabled = false;
        if (st.story && drawStory(now)) return;
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
        if (m.mode === 'st') return 'templeRun';
        if (m.mode === 'hst') return 'hashiraRash';
        if (m.mode === 'jitan' || m.mode === 'jitanLast') return 'jitan';
        return SHOW.stories[m.story].bg;
    }

    // 上の 帯 (いまの 状態)
    function header(m, now) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, 11);
        if (m.mode === 'st') {
            text('おにおにRASH' + lt, 4, 6, 8, '#ff6a8a', 'left');
            text(`${m.chain}連中`, W - 4, 6, 8, '#ffd84a', 'right');
            text(`${m.stSpins}回転`, W / 2 + 40, 6, 7, '#ffffff', 'center');
        } else if (m.mode === 'hst') {
            text('柱の氷RASH' + lt, 4, 6, 8, '#b89cff', 'left');
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
            if (m.mode === 'st') { stRunners(m, now); reels(TOP, figs, [1, 1, 1], now); }
            else if (m.mode === 'hst') { hashiraTrio(now); reels(TOP, figs, [1, 1, 1], now); }
            else reels(BIG, figs, [1, 1, 1], now);
        }
        holds(m, now);
    }

    function idleCast(m, now) {
        const story = m.story;
        const walk = Math.floor(now * 3);
        const x = 30 + ((now * 10) % 40);
        Art.draw(ctx, 'onioni', x, H - 18, { height: 22, frame: walk, flip: Math.floor(now / 4) % 2 === 1 });
        if (story === 1 || story === 3) {
            Art.draw(ctx, 'okagappa', W - 46, H - 18, { height: 22, frame: walk });
            Art.draw(ctx, 'hibikimakuri', W - 26, H - 18, { height: 22, frame: walk + 1 });
        }
        if (story === 5) {
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
        const reach = plan.reach, lead = plan.lead || 0, t = plan.t || {};
        const big = reach && reach !== 'normal' && reach !== 'zenkaiten';
        const staged = reach || lead;
        const end = plan.stopAt || D;   // 1・3・5・後告知・一発告知は 止まった あとに 知らせる
        const tL = staged ? 1.0 + lead : end * 0.45, tR = staged ? 1.7 + lead : end * 0.65;
        const tC = reach ? D - 0.7 : end - 0.25;
        // 止まる 順は 左 → 右 → まんなか (2026-11-04 ユーザー指定: まんなかを さいごに して リーチの 結果を かくす)
        const stopped = [el >= tL, el >= tC, el >= tR];
        const figs = plan.fake && el < end + 0.8 ? plan.fake : plan.figures;
        const sceneStart = tR + 0.9;
        const inScene = big && el >= sceneStart && el < D - 0.7;

        if (plan.mini && el >= t.mini && el < t.mini + SHOW.time.mini) {
            drawMini(plan, el - t.mini, now);
        } else if (inScene) {
            drawReachScene(m, plan, el - sceneStart, D - 0.7 - sceneStart, now);
            reels(SMALL, figs, [1, 0, 1], now, { speed: 10 });
        } else if (reach === 'zenkaiten' && el >= 1.0) {
            background('bonus', now);
            const n = figs[0], z = SHOW.zenkaiten[plan.zenkaiten];
            reels(BIG, [n, n, n], [1, 1, 1], now, { gold: true });
            text(z ? `${z.name} 全回転` : '全回転', W / 2, 12, 12, 'rainbow', 'center', { bold: true });
        } else {
            background(modeBg(m), now);
            header(m, now);
            if (!big) idleCast(m, now);
            const odd = el < 0.9 ? plan.iwakan : null;   // 違和感
            reels(BIG, figs, stopped, now, { bounce: stopped.map((s, i) => (s ? (el - [tL, tC, tR][i]) * 4 : 0)), speed: odd === 'reverse' ? -14 : odd === 'stop' && el > 0.3 ? 0.001 : undefined });
            if (odd === 'noise') for (let i = 0; i < 30; i++) { ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#444455'; ctx.fillRect(Math.random() * W, Math.random() * H, 4 + Math.random() * 40, 1); }
            if (odd === 'lamp' && Math.floor(now * 14) % 2) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, W - 4, H - 4); }
            if (reach && stopped[2] && !stopped[1]) {
                text('リーチ', W / 2, 24, 14, Math.floor(now * 6) % 2 ? '#ff3a4a' : '#ffd84a', 'center', { bold: true });
                if (reach === 'normal') {
                    // ノーマルリーチ: まんなかが ゆっくり
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    ctx.fillRect(W / 2 - 36, 30, 72, 70);
                }
            }
            // 群 (ふぶきの 中を ライバル探検隊が かけぬける)
            if (plan.gun && el > t.gun && el < t.gun + SHOW.time.gun + 0.4) drawGun(el - t.gun, now);
            if (plan.step && el >= t.step && el < t.gizi) drawStep(plan.step, el - t.step, now);
            if (plan.gizi && el >= t.gizi && el < t.gun) drawNext(el - t.gizi, now);
            else if (plan.gizi && el < tR) text(`疑似${plan.gizi + 1}連`, 6, 18, 9, plan.gizi >= 3 ? 'rainbow' : plan.gizi === 2 ? '#ff6a8a' : '#7fd3f7', 'left', { bold: true });
            if (!plan.step || el >= t.gizi) drawLine(plan.line, el, now);
            if (plan.sango && el >= end) return drawCrack(el - end, figs, now);
            if (plan.post && el >= end) {
                if (!st.gimStarted) { st.gimStarted = true; st.flash = 1; }
                text('後告知！！', W / 2, 18, 18, 'rainbow', 'center', { bold: true });
            }
            if (plan.oneshot && el >= 0.5) {
                if (!st.gimStarted) { st.gimStarted = true; st.flash = 1; st.shake = 0.5; }
                text('一発告知！！', W / 2, 18, 18, 'rainbow', 'center', { bold: true });
            }
            if (plan.charge && el >= tC) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, H / 2 - 20, W, 40);
                text('チャージ！', W / 2, H / 2, 22, 'rainbow', 'center', { bold: true });
            }
        }
        // さいご: 当たり / はずれ
        if (el >= tC && plan.hit) {
            const k = (el - tC) / 0.7;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * (1 - k)})`;
            ctx.fillRect(0, 0, W, H);
        }
        holds(m, now);
    }

    // 1・3・5 そろい (2026-11-04 ユーザー指定): 画面が ひび割れて → おにおにの 究極形態が 出現 → 画面を 粉砕 → 咆哮 → おめでとう！
    // 究極形態 = カードゲームで いちばん 強い 進化「おにおに・鬼の王 覚醒」(ユーザー指定)。カードと おなじく おにおにの 絵に 炎と 鎖
    function kakusei(x, y, height, now) {
        seed = 15;
        for (let i = 0; i < 14; i++) {
            const h = height * (0.45 + 0.35 * rnd()) * (0.85 + 0.15 * Math.sin(now * 14 + i));
            ctx.fillStyle = i % 2 ? 'rgba(255, 138, 42, 0.85)' : 'rgba(255, 58, 26, 0.85)';
            ctx.fillRect(x - height * 0.62 + i * height * 0.09, y - h, height * 0.08, h);
        }
        Art.draw(ctx, 'onioni', x, y, { height, frame: Math.floor(now * 10) });
        // ちぎれた 鎖
        ctx.fillStyle = '#c8c8d8';
        for (let i = 0; i < 6; i++) {
            ctx.fillRect(x - height * 0.7 - i * 9, y - height * 0.5 - i * 5, 6, 3);
            ctx.fillRect(x + height * 0.7 + i * 9, y - height * 0.5 - i * 5, 6, 3);
        }
    }
    const CRACK_LINE = [[136, 0], [122, 22], [146, 42], [118, 66], [150, 92], [126, 116], [140, 138]];
    function crackPath(n) {
        ctx.beginPath();
        CRACK_LINE.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
    }
    function drawCrack(k, figs, now) {
        const T = SHOW.crack;
        if (k < T.crack) {
            // ひびが 上から 走る
            if (!st.crackSnap) {
                st.crackSnap = document.createElement('canvas');
                st.crackSnap.width = canvas.width;
                st.crackSnap.height = canvas.height;
                st.crackSnap.getContext('2d').drawImage(canvas, 0, 0);
                st.shake = 0.3;
            }
            const n = 1 + Math.ceil(k / T.crack * (CRACK_LINE.length - 1));
            ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 3; crackPath(n);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; crackPath(n);
            return;
        }
        if (k < T.emerge) {
            // すき間が ひらいて 赤い 光の 中から 究極形態
            const e = (k - T.crack) / (T.emerge - T.crack), gap = ease(e) * 70;
            ctx.fillStyle = '#3a0008';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = `rgba(255, 40, 30, ${0.4 + 0.3 * Math.sin(now * 20)})`;
            ctx.fillRect(W / 2 - gap, 0, gap * 2, H);
            kakusei(W / 2, H - 4 + 60 * (1 - ease(e)), 70 + 50 * e, now);
            if (st.crackSnap) {
                const sw = canvas.width / 2;
                ctx.drawImage(st.crackSnap, 0, 0, sw, canvas.height, -gap, 0, W / 2, H);
                ctx.drawImage(st.crackSnap, sw, 0, sw, canvas.height, W / 2 + gap, 0, W / 2, H);
            }
            return;
        }
        if (k < T.smash) {
            // 画面を 粉砕: かけらが とびちる
            const e = (k - T.emerge) / (T.smash - T.emerge);
            if (!st.crackSmash) { st.crackSmash = true; st.flash = 1; st.shake = 1.2; }
            ctx.fillStyle = '#2a0006';
            ctx.fillRect(0, 0, W, H);
            kakusei(W / 2, H - 4, 120, now);
            seed = 12;
            for (let i = 0; i < 40; i++) {
                const a = rnd() * Math.PI * 2, d = e * (120 + rnd() * 180), s = 6 + rnd() * 14;
                ctx.fillStyle = i % 3 ? '#bfe8ff' : '#ffffff';
                ctx.fillRect(W / 2 + Math.cos(a) * d - s / 2, H / 2 + Math.sin(a) * d - s / 2, s, s * 0.7);
            }
            return;
        }
        if (k < T.roar) {
            // 咆哮
            st.shake = Math.max(st.shake, 0.3);
            ctx.fillStyle = Math.floor(now * 10) % 2 ? '#7a0010' : '#a80018';
            ctx.fillRect(0, 0, W, H);
            for (let i = 0; i < 16; i++) {
                const a = now * 2 + i / 16 * Math.PI * 2;
                ctx.strokeStyle = 'rgba(255, 216, 74, 0.35)'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(W / 2, 50); ctx.lineTo(W / 2 + Math.cos(a) * 300, 50 + Math.sin(a) * 300); ctx.stroke();
            }
            kakusei(W / 2, H - 2, 118 + Math.sin(now * 30) * 3, now);
            text('おにおに・鬼の王 覚醒', W / 2, 16, 17, '#ffd84a', 'center', { bold: true });
            text('グオオオオッ！！', W / 2, H - 14, 14, '#ffffff', 'center', { bold: true });
            return;
        }
        // おめでとう！
        const e = k - T.roar;
        background('bonus', now);
        reels({ y: 62, size: 44, gap: 62 }, figs, [1, 1, 1], now, { gold: true });
        text('おめでとう！', W / 2, 116, 24 * (0.6 + 0.4 * ease(e * 2)), 'rainbow', 'center', { bold: true });
    }

    // 昇格チャレンジ (2026-11-04 ユーザー指定): ラウンド中に おこなう。おにおに vs こおりくんの 影。左の ゲージ (青 < 緑 < 紫 < 赤 < 虹) を ボタン長押しで ためる (押さなくても 結果は おなじ)。
    //   色が きまったら 激突して ボタンか レバー (レバーは 確定)。成功なら ゲージが 虹色に フラッシュして 撃破 → RASH
    function drawPromo(m, now) {
        const P = SHOW.promo, T = P.time, b = m.bonus, pr = b.promo, t = m.config.machine.bonus.promo - pr.timer;
        const final = P.gauge.indexOf(pr.color) + 1;
        const dt = st.promoLast ? Math.max(0, now - st.promoLast) : 0;
        st.promoLast = now;
        // ゲージ: ゆっくり のびる。長押しで はやく のびる。とまるのは きまった 色
        const auto = final * clamp01((t - T.intro) / (T.charge - T.intro));
        st.promoGauge = Math.min(final, Math.max(st.promoGauge || 0, auto) + (st.holding && t >= T.intro ? dt * 1.5 : 0));
        if (t >= T.charge) st.promoGauge = final;
        st.holdPrompt = t >= T.intro && t < T.charge;
        if (t >= T.clash) closeAction();
        background('hideout', now);
        ctx.fillStyle = 'rgba(30, 0, 50, 0.55)';
        ctx.fillRect(0, 0, W, H);
        const rush = ease((t - T.decide) / (T.clash - T.decide - 1.2));
        const walk = Math.floor(now * 6);
        Art.draw(ctx, 'onioni', 84 + (W / 2 - 24 - 84) * rush, H - 26, { height: 56, frame: walk });
        const sx = W - 56 - (W - 56 - W / 2 - 24) * rush;
        const won = pr.win && t >= T.clash;
        if (!won || Math.floor(now * 12) % 2) {
            ctx.fillStyle = 'rgba(160, 60, 255, 0.25)';
            ctx.beginPath(); ctx.arc(sx, H - 56, 42, 0, Math.PI * 2); ctx.fill();
            Art.draw(ctx, 'koori', sx, H - 26, { height: 64, silhouette: true, flip: true });
            ctx.fillStyle = '#ff2a3a';
            ctx.fillRect(sx - 14, H - 66, 6, 4);
            ctx.fillRect(sx + 4, H - 66, 6, 4);
        }
        // ゲージ
        const gx = 10, gy = 22, gh = H - 40, seg = gh / 5;
        ctx.fillStyle = '#000000';
        ctx.fillRect(gx - 2, gy - 2, 20, gh + 4);
        for (let i = 0; i < 5; i++) {
            const fill = clamp01(st.promoGauge - i), c = P.gauge[i];
            if (fill <= 0) continue;
            ctx.fillStyle = won ? rainbow(now, i) : c === 'rainbow' ? rainbow(now, i) : P.colors[c];
            ctx.fillRect(gx, gy + gh - i * seg - seg * fill, 16, seg * fill - 1);
        }
        if (won) { ctx.strokeStyle = rainbow(now); ctx.lineWidth = 3; ctx.strokeRect(gx - 3, gy - 3, 22, gh + 6); }
        // ラウンド中なので 右打ちの ままで
        text('右打ち →', W - 6, H - 8, 9, Math.floor(now * 3) % 2 ? '#ff6a8a' : '#ffffff', 'right');
        if (t < T.intro) {
            ctx.fillStyle = `rgba(0,0,0,${0.6 * ease(t * 3)})`;
            ctx.fillRect(0, 26, W, 46);
            text('昇格チャレンジ', W / 2, 42, 20, '#ffd84a', 'center', { bold: true });
            text('こおりくんの 影を 撃破せよ！', W / 2, 62, 11, '#ffffff');
        } else if (t < T.charge) {
            text('ボタン 長押しで ためろ！', W / 2 + 12, 18, 13, Math.floor(now * 4) % 2 ? '#ffd84a' : '#ffffff', 'center', { bold: true });
        } else if (t < T.decide) {
            if (pr.color === 'rainbow' && !st.promoFlash) { st.promoFlash = true; st.flash = 1; }
            text(`${P.names[pr.color]} ゲージ！`, W / 2 + 12, 40, 22, pr.color === 'rainbow' ? 'rainbow' : P.colors[pr.color], 'center', { bold: true });
        } else if (t < T.clash) {
            const a = actionWindow(pr.action, t, T.decide + 1.2, T.clash);
            if (a) a.text = 'レバーを引け！';
            text('激突！！', W / 2, 18, 15, '#ff3a4a', 'center', { bold: true });
            drawPrompt(a, now);
        } else {
            const r = t - T.clash;
            if (pr.win) {
                if (!st.promoHit) { st.promoHit = true; st.flash = 1; st.shake = 0.8; startGimmick('kanabo', 2.6); }
                text('撃破！！', W / 2, 44, 28 * (0.6 + 0.4 * ease(r * 3)), 'rainbow', 'center', { bold: true });
                text(pr.extra ? '昇格！ 3000発 + RASH 突入！' : '昇格！ RASH 突入！', W / 2, 72, 12, '#ffd84a', 'center', { bold: true });
            } else {
                ctx.fillStyle = `rgba(0,0,20,${Math.min(0.6, r)})`;
                ctx.fillRect(0, 0, W, H);
                text('おにおにが はじきとばされた…', W / 2, 56, 12, '#c8d8ff');
            }
        }
    }

    // オープニング・エンディング (2026-11-04 ユーザー指定)
    function playStory(name, chain) {
        const scenes = SHOW.story[name];
        st.story = { name, scenes, start: st.now, total: scenes.reduce((a, s) => a + s.dur, 0), chain };
    }
    function drawStory(now) {
        const s = st.story;
        let t = now - s.start;
        if (t >= s.total) { st.story = null; return false; }
        const sc = s.scenes.find(x => (t -= x.dur) < 0);
        const k = t + sc.dur, fade = Math.min(clamp01(k / 0.5), clamp01((sc.dur - k) / 0.4));
        background(sc.bg, now);
        const n = sc.who.length;
        sc.who.forEach((id, i) => Art.draw(ctx, id, W / 2 + (i - (n - 1) / 2) * Math.min(56, 220 / n), H - 34, { height: n > 3 ? 44 : 58, frame: Math.floor(now * 3) + i, silhouette: sc.shadow }));
        if (sc.text) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, H - 30, W, 24);
            text(sc.text, W / 2, H - 18, 11, '#ffffff');
        }
        if (sc.title) {
            text('こおりくんの大冒険外伝', W / 2, 32, 12, '#bfe8ff', 'center', { bold: true });
            text('おにおにの挑戦', W / 2, 64, 30 * (0.6 + 0.4 * ease(k * 2)), '#ff3a4a', 'center', { bold: true, strokeColor: '#ffffff' });
            text('～めざめる３人の氷達～', W / 2, 96, 13, '#9cf0c8', 'center', { bold: true });
        }
        if (sc.end) {
            text(`${s.chain || 10}連 おめでとう！`, W / 2, 34, 22, 'rainbow', 'center', { bold: true });
            text('THE END', W / 2, 62, 16, '#ffffff', 'center', { bold: true });
            text('…RASH は まだ つづく！', W / 2, 122, 11, '#ffd84a', 'center', { bold: true });
        }
        ctx.fillStyle = `rgba(0,0,0,${1 - fade})`;
        ctx.fillRect(0, 0, W, H);
        text('PUSH で とばす', W - 4, 7, 7, '#c8d8ff', 'right');
        return true;
    }
    const setHolding = v => { st.holding = v; };

    // ステップアップ予告 (前作から): キャラが 1 段ずつ 出る。3 段目の 文字が 赤なら チャンス・金なら 約 90%
    function drawStep(s, k, now) {
        const kind = SHOW.stepUp.kinds[s.kind], T = SHOW.stepUp.time;
        const n = Math.min(s.step, Math.floor(k / T) + 1);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 26, W, 84);
        for (let i = 0; i < n; i++) Art.draw(ctx, kind.who[i], 56 + i * 80, 92, { height: 54, frame: Math.floor(now * 5) + i });
        const color = n === 3 ? enemyTextColor(s.color, now) : '#ffffff';
        text(`STEP ${n}`, 8, 34, 9, '#7ad8ff', 'left', { bold: true });
        text(kind.text[n - 1], W / 2, 102, 12, color, 'center', { bold: true });
    }

    // 疑似連: NEXT で 図柄が 回り直す
    function drawNext(k, now) {
        const n = Math.floor(k / SHOW.time.next), local = k - n * SHOW.time.next;
        if (local < 0.3) {
            ctx.fillStyle = `rgba(255,255,255,${0.8 - local * 2.5})`;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 44, W, 46);
        text('NEXT', W / 2, 60, 26, Math.floor(now * 8) % 2 ? '#ffe066' : '#ff3a3a', 'center', { bold: true });
        text(`疑似${n + 2}連`, W / 2, 81, 12, n >= 2 ? 'rainbow' : n === 1 ? '#ff6a8a' : '#7fd3f7');
    }

    // セリフ: 変動の はじめに ふるカワが しゃべる
    function drawLine(line, el, now) {
        if (!line || el < 0.2 || el > 3.2) return;
        Art.draw(ctx, 'furukawa', 22, H - 16, { height: 32, frame: Math.floor(now * 4) });
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(42, H - 40, W - 92, 18);
        text(line.text, 46, H - 31, 10, line.color, 'left');
    }

    // ----- ミニゲーム (2026-11-04 ユーザー指定)。k: はじまってからの 秒。さいごに PUSH → 成功 / 失敗 -----
    function drawMini(plan, k, now) {
        const { id, win } = plan.mini, v = SHOW.minis[id], T = SHOW.time.mini;
        const aFrom = T - 2.4, aTo = T - 1.4;
        const prog = clamp01((k - 1.2) / (aFrom - 1.2)), done = k >= aTo, walk = Math.floor(now * 8);
        if (id === 'okamou') {
            // ダッシュ: ゴールの 旗へ かける
            background('snowfield', now);
            const x = 34 + prog * 170 + (done && win ? 24 : 0);
            ctx.fillStyle = '#c82a3a';
            ctx.fillRect(W - 30, H - 58, 2, 40);
            ctx.fillRect(W - 28, H - 58, 14, 9);
            Art.draw(ctx, v.who, x, H - 18, { height: 38, frame: walk, rot: done && !win ? Math.PI / 2 : 0 });
            for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(160,190,230,0.7)'; ctx.fillRect(x - 24 - i * 9 - (now * 60) % 9, H - 26 + (i % 3) * 3, 6, 1); }
        } else if (id === 'ishii') {
            // 遺跡: おくの とびらが ひらくか
            background('ruins', now);
            const open = done && win ? clamp01((k - aTo) * 2) : 0;
            ctx.fillStyle = '#ffd84a';
            ctx.fillRect(W - 76, H - 86, 44, 62);
            ctx.fillStyle = '#4a3418';
            ctx.fillRect(W - 76, H - 86, 22 - 22 * open, 62);
            ctx.fillRect(W - 54 + 22 * open, H - 86, 22 - 22 * open, 62);
            Art.draw(ctx, v.who, 50 + prog * 90, H - 22, { height: 46, frame: walk });
        } else if (id === 'muscle') {
            // マッスルチャレンジ: バーベルを 持ちあげる
            background('tavern', now);
            const lift = done ? (win ? 1 : 0) : prog * (0.75 + 0.15 * Math.sin(now * 14));
            const y = H - 40 - lift * 44;
            Art.draw(ctx, v.who, W / 2, H - 28, { height: 56, frame: walk });
            ctx.fillStyle = '#c8c8d8';
            ctx.fillRect(W / 2 - 62, y, 124, 4);
            ctx.fillStyle = '#2a2a34';
            ctx.fillRect(W / 2 - 70, y - 11, 10, 26);
            ctx.fillRect(W / 2 + 60, y - 11, 10, 26);
        } else if (id === 'asahara') {
            // ASAHARA宣言: 台の 上で 宣言する
            background('town', now);
            ctx.fillStyle = '#7a1a2a';
            ctx.fillRect(W / 2 - 34, H - 40, 68, 22);
            Art.draw(ctx, v.who, W / 2, H - 40, { height: 60, frame: Math.floor(now * 3) });
            if (k >= 1.2) text(done ? (win ? 'こおりくんを とりもどすと 宣言する！' : '…やっぱり やめた！') : 'ここに 宣言する…！', W / 2, 26, 11, '#ffffff', 'center', { bold: true });
        } else {
            // ゴールド金面犬: 暗やみを ライトで さがす
            background('goldHall', now);
            const lx = done ? W / 2 : W / 2 + Math.sin(now * 2.4) * 100;
            ctx.fillStyle = 'rgba(255,240,170,0.2)';
            ctx.beginPath(); ctx.arc(lx, H - 44, 38, 0, Math.PI * 2); ctx.fill();
            if (done && win) {
                Art.draw(ctx, v.who, W / 2, H - 20, { height: 64 * ease((k - aTo) * 3), frame: walk });
                for (let i = 0; i < 12; i++) { ctx.fillStyle = '#ffe680'; ctx.fillRect(W / 2 + Math.sin(now * 3 + i * 2) * 60, 40 + ((now * 30 + i * 13) % 70), 2, 2); }
            } else Art.draw(ctx, v.who, W / 2 + 70, H - 20, { height: 34, alpha: 0.45, silhouette: true });
        }
        if (k < 1.2) {
            ctx.fillStyle = `rgba(0,0,0,${0.65 * ease(k * 4)})`;
            ctx.fillRect(0, 30, W, 42);
            text('ミニゲーム', W / 2, 41, 9, '#7ad8ff');
            text(v.name, W / 2, 58, v.name.length > 14 ? 12 : 16, '#ffd84a', 'center', { bold: true });
            return;
        }
        drawPrompt(actionWindow('push', k, aFrom, aTo), now);
        if (done) {
            if (win) text(id === 'goldDog' ? '発見！！' : '成功！！', W / 2, 50, 24 * (0.6 + 0.4 * ease((k - aTo) * 3)), 'rainbow', 'center', { bold: true });
            else text(id === 'goldDog' ? 'みつからなかった…' : '失敗…', W / 2, 50, 16, '#9ab0d0', 'center', { bold: true });
        }
    }

    // ----- 柱の氷リーチ (2026-11-04 ユーザー指定): ブラックアウト → しじまのそこから → 目覚めるその氷たち → 時を越え (赤) →
    //   3 人 同時に カットイン → おにおにたちと 激闘 → 全員 激突 → レバーを引け！ → 撃破 -----
    const HASHIRA_T = { silence: 1, wake: 3.4, time: 5.8, cutin: 7.6, battle: 9.6, clash: 8, lever: 4.4, result: 1.6 };
    function drawHashiraReach(m, plan, k, len, now) {
        const T = HASHIRA_T, three = ['haru', 'okadishi', 'kanezu'];
        const tc = enemyTextColor(plan.textColor, now);
        if (k < T.battle) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, W, H);
            const fade = (a, b) => Math.min(clamp01((k - a) / 0.5), clamp01((b - k) / 0.4));
            if (k >= T.silence && k < T.wake) { ctx.globalAlpha = fade(T.silence, T.wake); text('しじまのそこから', W / 2, H / 2, 17, '#ffffff', 'center', { stroke: false }); }
            else if (k >= T.wake && k < T.time) { ctx.globalAlpha = fade(T.wake, T.time); text('目覚めるその氷たち', W / 2, H / 2, 17, '#ffffff', 'center', { stroke: false }); }
            else if (k >= T.time && k < T.cutin) { ctx.globalAlpha = fade(T.time, T.cutin); text('時を越え', W / 2, H / 2, 30, '#ff1a2a', 'center', { bold: true, stroke: false }); }
            ctx.globalAlpha = 1;
            if (k >= T.cutin) {
                if (!st.hashiraFlash) { st.hashiraFlash = true; st.flash = 1; st.shake = 0.8; }
                const c = ease((k - T.cutin) * 2.5);
                three.forEach((id, i) => {
                    const x = i * W / 3, e = SHOW.enemies[id];
                    ctx.fillStyle = ['#0e4a34', '#123a7a', '#3a4a6a'][i];
                    ctx.fillRect(x + 1, 0, W / 3 - 2, H);
                    Art.draw(ctx, id, x + W / 6, H - 22 + (1 - c) * (i % 2 ? -120 : 120), { height: 84, frame: Math.floor(now * 6) + i });
                    text(e.name, x + W / 6, H - 12, 12, tc, 'center', { bold: true });
                });
                text('柱の氷', W / 2, 13, 15, tc, 'center', { bold: true });
            }
            return;
        }
        background('hideout', now);
        const walk = Math.floor(now * 8), tClash = len - T.clash, aFrom = len - T.lever, aTo = len - T.result;
        const allies = ['onioni', 'okagappa', 'sasaki'];
        // 激闘: 左右で ぶつかりあう → 全員が まんなかへ 激突
        const rush = ease((k - tClash) / (aFrom - tClash) * 1.2);
        const sway = k < tClash ? Math.sin(k * 6) * 12 : 0;
        allies.forEach((id, i) => {
            const x0 = 30 + i * 30;
            Art.draw(ctx, id, x0 + (W / 2 - 22 - x0) * rush + sway, H - 26 - (i % 2) * 8, { height: i ? 36 : 46, frame: walk + i });
        });
        three.forEach((id, i) => {
            const x0 = W - 90 + i * 32;
            Art.draw(ctx, id, x0 + (W / 2 + 22 - x0) * rush - sway, H - 26 - (i % 2) * 8, { height: 48, frame: walk + i, flip: true });
        });
        if (k < tClash) {
            text('おにおにたち VS 柱の氷', W / 2, 14, 12, tc, 'center', { bold: true });
            // 激闘: 2 秒ごとに だれかの 必殺技
            const F = SHOW.hashiraFight, fi = Math.floor((k - T.battle) / SHOW.spBeat), fq = (k - T.battle) / SHOW.spBeat - fi, f = F[fi % F.length];
            if (fq < 0.55) cutin(f.color, f.who, f.move, fq / 0.55, now, f.who === 'onioni' ? '#ffd84a' : '#ffffff');
            else if (fq < 0.8) {
                ctx.fillStyle = `rgba(255,255,255,${0.5 * (0.8 - fq) / 0.25})`;
                ctx.fillRect(0, 0, W, H);
                text('ドンッ！', W / 2, 50, 18, '#ffffff', 'center', { bold: true });
                st.shake = Math.max(st.shake, 0.15);
            }
        } else {
            st.shake = Math.max(st.shake, 0.2);
            ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(now * 30)})`;
            ctx.beginPath(); ctx.arc(W / 2, H - 50, 20 + rush * 36, 0, Math.PI * 2); ctx.fill();
            if (k < aFrom) text('全員 激突！！', W / 2, 16, 15, '#ff3a4a', 'center', { bold: true });
        }
        const a = actionWindow('lever', k, aFrom, aTo);
        if (a) a.text = plan.leverText;
        if (a && a.done && plan.yaku && !st.gimStarted) { st.gimStarted = true; startGimmick('pillars', 2.6); }
        drawPrompt(a, now);
        if (k >= aTo) {
            const r = (k - aTo) / (len - aTo);
            if (plan.hit) {
                ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.7 - r * 2)})`;
                ctx.fillRect(0, 0, W, H);
                gimmickWin('pillars', 3);
                text('撃破！！', W / 2, 60, 28 * (0.6 + 0.4 * ease(r * 3)), 'rainbow', 'center', { bold: true });
            } else {
                ctx.fillStyle = `rgba(0,0,30,${0.6 * r})`;
                ctx.fillRect(0, 0, W, H);
                text('おにおにたちが ふきとばされた…', W / 2, 60, 12, '#c8d8ff');
            }
        }
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

    // SPリーチの たたかい: セリフと 必殺技の 応酬 (SHOW.spScript)。p: はじまってからの 秒、end: 決め手の 前まで
    function spBattle(enemy, e, plan, p, end, now) {
        const S = SHOW.spScript, T = SHOW.spBeat, walk = Math.floor(now * 6);
        const active = p < end, idx = Math.min(Math.floor(p / T), S.length * 4), q = (p - idx * T) / T;
        const b = S[idx % S.length], special = active && b.kind === 'special';
        // 体力 (必殺技が 当たるたびに へる)
        let hitE = 0, hitO = 0;
        for (let i = 0; i <= idx; i++) {
            const s = S[i % S.length];
            if (s.kind !== 'special' || (i === idx && (q < 0.62 || !active))) continue;
            if (s.who === 'enemy') hitO++; else hitE++;
        }
        const lunge = special && q > 0.4 && q < 0.75 ? Math.sin((q - 0.4) / 0.35 * Math.PI) : 0;
        const impact = special && q >= 0.58 && q < 0.8;
        const jolt = impact ? (Math.random() - 0.5) * 6 : 0;
        const ox = 70 + (b.who === 'oni' ? lunge * 70 : impact ? -10 + jolt : 0);
        const ex = 196 - (b.who === 'enemy' ? lunge * 70 : impact ? -10 + jolt : 0);
        Art.draw(ctx, 'onioni', ox, H - 26, { height: 46, frame: walk });
        Art.draw(ctx, enemy, ex, H - 26, { height: 60, frame: walk, flip: true });
        // 体力の 帯
        const bar = (x, v, c) => { ctx.fillStyle = '#000'; ctx.fillRect(x, 32, 100, 6); ctx.fillStyle = c; ctx.fillRect(x + 1, 33, 98 * Math.max(0.12, v), 4); };
        bar(16, 1 - hitO * 0.22, '#3fdf6f');
        bar(W - 116, 1 - hitE * 0.3, '#ff5a3a');
        text('おにおに', 16, 44, 8, '#ffffff', 'left');
        text(e.name, W - 16, 44, 8, enemyTextColor(plan.textColor, now), 'right', { bold: true });
        if (!active) return;
        if (b.kind === 'talk') {
            // セリフの ふきだし
            const line = b.line ? e[b.line] : b.text, x = b.who === 'enemy' ? W - 96 : 96;
            const n = Math.min(line.length, Math.floor(q * 40) + 1);
            ctx.font = `11px ${FONT}`;
            const w = ctx.measureText(line).width + 14;
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.fillRect(x - w / 2, 52, w, 18);
            ctx.beginPath(); ctx.moveTo(x - 4, 70); ctx.lineTo(x + (b.who === 'enemy' ? 12 : -12), 78); ctx.lineTo(x + 6, 70); ctx.fill();
            text(line.slice(0, n), x - w / 2 + 7, 61, 11, '#14102a', 'left', { stroke: false });
        } else {
            // 必殺技: カットイン → 突進 → 命中
            const oni = b.who === 'oni', name = oni ? SHOW.stBattle.selfMoves[b.move] : e.special;
            if (q < 0.42) cutin(oni ? '#6a0a18' : '#2a0a4a', oni ? 'onioni' : enemy, name, q / 0.42, now, oni ? '#ffd84a' : '#ffffff');
            if (impact) {
                const tx = oni ? ex : ox;
                ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (q - 0.58) / 0.22)})`;
                ctx.fillRect(0, 0, W, H);
                seed = 21;
                for (let i = 0; i < 12; i++) {
                    const a = rnd() * Math.PI * 2, d = (q - 0.58) * 240 * (0.5 + rnd());
                    ctx.fillStyle = i % 2 ? '#ffd84a' : '#ff5a3a';
                    ctx.fillRect(tx + Math.cos(a) * d, H - 56 + Math.sin(a) * d, 4, 4);
                }
                text('ドンッ！', tx, 50, 16, '#ffffff', 'center', { bold: true });
                st.shake = Math.max(st.shake, 0.15);
            }
        }
    }
    // 撃破の しゅんかんに 役物 (1 回の 変動で 1 度)
    function gimmickWin(kind, dur = 2.8) {
        if (st.gimWin) return;
        st.gimWin = true;
        startGimmick(kind, dur);
    }

    // 大きい リーチの 場面 (探検隊リーチ / 柱の氷リーチ)。k: 場面に 入ってからの 秒、len: 場面の 長さ
    function drawReachScene(m, plan, k, len, now) {
        const reach = plan.reach;
        if (reach === 'hashiraAll') return drawHashiraReach(m, plan, k, len, now);
        const hashira = SHOW.battleReaches.includes(reach);
        background(hashira ? (SHOW.enemies[reach].side === 'hashira' ? 'hideout' : 'battle') : 'snowfield', now);
        const team = TEAMS[(m.stats.spins1 + (plan.figures[0] || 0)) % TEAMS.length];
        const enemy = hashira ? reach : null;
        const e = enemy ? SHOW.enemies[enemy] : null;
        // 1) タイトル (0〜2 秒)
        if (k < 2) {
            const a = ease(k / 0.4);
            ctx.fillStyle = `rgba(0,0,0,${0.5 * a})`;
            ctx.fillRect(0, 34, W, 60);
            if (hashira) {
                // 敵の カットイン: 文字の 色は 内部の 期待度 (白 < 赤 < 金)
                text('SPリーチ', W / 2, 16, 12 * a, '#bfe8ff', 'center', { bold: true });
                cutin('#1a1030', enemy, e.name, k / 2, now, enemyTextColor(plan.textColor, now));
                text(e.ryuha, 170, 80, 9, '#ffffff');
                if (reach === 'kanezu') text('リーダー 登場！', W / 2, 112, 9, '#ff6a8a');
            } else {
                text('探検隊リーチ', W / 2, 52, 18 * a, '#ffd84a', 'center', { bold: true });
                text(team.name, W / 2, 76, 12, '#ffffff', 'center');
            }
            return;
        }
        // 2) すすむ (おにおにと 仲間 / 柱の氷)
        const p = k - 2, body = len - 2;
        const walk = Math.floor(now * 6);
        const aFrom0 = len - 3.2;
        if (hashira) {
            spBattle(enemy, e, plan, p, aFrom0 - 2, now);
        } else {
            // 探検隊と いっしょに こおりくんを さがす (足あとを たどる)
            team.members.forEach((id, i) => Art.draw(ctx, id, 150 + i * 30, H - 24, { height: 34, frame: walk + i }));
            Art.draw(ctx, 'onioni', 100, H - 24, { height: 34, frame: walk });
            const L = SHOW.tankenLines, i = Math.floor(p / SHOW.spBeat);
            text(L[i % L.length], W / 2, 22, 12, '#1a3a8a', 'center', { strokeColor: '#ffffff', bold: true });
            Art.draw(ctx, team.members[i % 3], 28, 62, { height: 26, frame: walk });
            for (let f = 0; f < 6; f++) { ctx.fillStyle = 'rgba(90,140,200,0.6)'; ctx.fillRect(20 + f * 14 - (p * 20) % 14, H - 20 + (f % 2) * 3, 4, 2); }
        }
        // 3) カットイン (まんなか)
        if (plan.cutin) {
            const ck = (p - body * 0.35) / 1.6;
            const who = hashira ? (ck < 0.5 ? enemy : 'onioni') : team.members[0];
            cutin(plan.cutin, who, hashira ? (plan.cutin === 'gold' ? 'こおりくんを かえせ！！' : 'いくぞ！') : 'こっちだ！', ck, now);
        }
        // チャンスアップ
        if (plan.chance) cutin('red', hashira ? 'onioni' : team.members[1], 'チャンスアップ！', (p - body * 0.6) / 1.4, now);
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
                gimmickWin(hashira ? 'kanabo' : 'doors');
                text(hashira ? '撃破！！' : 'みつけた！！', W / 2, 60, 24 * (0.6 + 0.4 * ease(r * 3)), 'rainbow', 'center', { bold: true });
                if (plan.yaku) text('激アツ', W / 2, 88, 12, '#ff3a4a', 'center', { bold: true });
                if (hashira) text(e.lose, W / 2, 104, 10, '#ffffff');
            } else {
                ctx.fillStyle = `rgba(0,0,30,${0.5 * r})`;
                ctx.fillRect(0, 0, W, H);
                text(hashira ? 'おにおにが ふきとばされた…' : 'みうしなった…', W / 2, 60, 12, '#c8d8ff');
                if (hashira) text(e.win, W / 2, 80, 10, '#ffffff');
            }
        }
    }

    // ----- ST -----
    // 技の 文字の 色 (白 青 緑 赤 金・敵は 紫 赤 金)
    const moveColor = (c, now) => ({ blue: '#4f9bff', green: '#3fdf6f', purple: '#c080ff' }[c] || enemyTextColor(c, now));
    // ダッシュする おにおにと 仲間
    function stRunners(m, now, ally = m.stAlly) {
        const walk = Math.floor(now * 10);
        Art.draw(ctx, 'onioni', W / 2 + 30, H - 20, { height: 46, frame: walk });
        if (ally) ally.members.forEach((id, i) => Art.draw(ctx, id, W / 2 - 22 - i * 30, H - 20, { height: 36, frame: walk + i }));
    }
    function drawStMiss(m, plan, el, D, now) {
        background('templeRun', now);
        header(m, now);
        stRunners(m, now);
        const stopped = [el > D * 0.45, el > D - 0.2, el > D * 0.65];
        reels(TOP, plan.figures, stopped, now, { speed: 22 });
        if (plan.tease) {
            // 相手の 気配 (かげが 出て 消える)
            const k = el / D;
            Art.draw(ctx, plan.tease, W - 40, H - 20, { height: 50, alpha: Math.sin(k * Math.PI) * 0.7, silhouette: true });
            if (k > 0.2 && k < 0.8) text('…けはい？', W - 40, 30, 9, '#ffb0c0');
        }
        if (plan.joined) cutin('#1a4a8a', plan.joined.members[0], plan.joined.team ? `${plan.joined.team} 合流！` : 'なかまが 合流！', (el - 0.3) / 2.4, now, plan.joined.team ? 'rainbow' : '#ffffff');
        holds(m, now);
    }

    // おにおにの バトル (2026-11-04 ユーザー指定)。流れは show.js の stPlan。plan.t が それぞれの はじまる 秒
    function drawBattle(m, plan, el, D, now) {
        const t = plan.t, e = SHOW.enemies[plan.enemy], B = SHOW.stBattle, walk = Math.floor(now * 6);
        if (t.notice !== undefined && el >= t.notice && el < t.notice + SHOW.rashMode.noticeTime) return drawShuketsu(el - t.notice, now);
        const dashing = el < t.enemy, lost = plan.revive !== 'none';
        if (el >= t.result) closeAction();
        background(dashing ? 'templeRun' : 'templeFight', now);
        header(m, now);
        if (dashing) {
            stRunners(m, now, t.join !== undefined && el >= t.join + 0.6 ? plan.ally : t.join === undefined ? plan.ally : null);
            if (el >= t.reach) text('リーチ', W / 2, 54, 14, Math.floor(now * 6) % 2 ? '#ff3a4a' : '#ffd84a', 'center', { bold: true });
            if (t.join !== undefined) cutin('#1a4a8a', plan.ally.members[0], plan.ally.team ? `${plan.ally.team} 合流！` : 'なかまが 合流！', (el - t.join) / B.time.join, now, plan.ally.team ? 'rainbow' : '#ffffff');
        } else if (el < t.self) {
            // 敵を 発見: 敵の カットインと 撃破期待度
            if (el < t.enemy + B.time.enemy) {
                const k = (el - t.enemy) / B.time.enemy;
                cutin('#1a1030', plan.enemy, e.name, k, now, enemyTextColor(plan.textColor, now));
                if (k > 0.12 && k < 0.88) {
                    text('撃破期待度', 170, 84, 8, '#ffffff');
                    for (let i = 0; i < 5; i++) text('★', 146 + i * 12, 96, 11, i < plan.stars ? '#ffd84a' : '#555566', 'center', { stroke: false });
                    if (plan.chance) text('チャンスアップ！', 170, 40, 10, '#ffd84a', 'center', { bold: true });
                }
            } else if (plan.ally) {
                // 仲間が 先に たたかう
                const len = plan.ally.team ? B.time.team : B.time.ally, k = (el - t.ally) / len, n = plan.ally.members.length;
                const i = Math.min(n - 1, Math.floor(k * n)), id = plan.ally.members[i];
                if (plan.ally.team && i === 0 && k < 0.08) text(plan.ally.team, W / 2, 20, 12, 'rainbow', 'center', { bold: true });
                cutin('#1a4a8a', id, B.allyMoves[id], k * n - i, now, moveColor(plan.allyColor, now));
            }
        } else if (el < t.foe) {
            cutin('#6a0a18', 'onioni', B.selfMoves[plan.self], (el - t.self) / B.time.self, now, moveColor(plan.self, now));
        } else if (el < t.clash) {
            const line = plan.foe === 'gold' ? '威嚇…！' : plan.foe === 'red' ? `${e.name}の 大技！` : `${e.name}の こうげき！`;
            cutin('#2a0a4a', plan.enemy, line, (el - t.foe) / B.time.foe, now, moveColor(plan.foe, now));
        } else if (el < t.result) {
            // 激突: ボタン か レバー
            const rush = ease((el - t.clash) / B.time.clash);
            Art.draw(ctx, 'onioni', 60 + (W / 2 - 24 - 60) * rush, H - 26, { height: 50, frame: walk });
            if (plan.ally) plan.ally.members.forEach((id, i) => Art.draw(ctx, id, 24 + i * 22 + (W / 2 - 70) * rush, H - 26, { height: 30, frame: walk + i }));
            Art.draw(ctx, plan.enemy, W - 60 - (W - 60 - W / 2 - 24) * rush, H - 26, { height: 60, frame: walk, flip: true });
            const a = actionWindow(plan.action, el, t.action, t.result);
            if (a) a.text = 'レバーを引け！';
            if (a && a.done && plan.yaku && !st.gimStarted) { st.gimStarted = true; startGimmick('kanabo', 2.4); }
            drawPrompt(a, now);
        } else if (!lost || el >= t.end) {
            // けっか: 図柄ぞろい / END 図柄
            const r = el - (lost ? t.end : t.result);
            const win = plan.hit;
            if (win) {
                gimmickWin(plan.revive === 'win' ? 'pillars' : 'kanabo');
                if (plan.revive === 'win') kakusei(W / 2, H - 4, 96, now);
                else Art.draw(ctx, 'onioni', W / 2, H - 22, { height: 40, frame: walk });
                ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.7 - r)})`;
                ctx.fillRect(0, 0, W, H);
                reels({ y: 50, size: 34, gap: 48 }, plan.figures, [1, 1, 1], now, { gold: true });
                text(plan.revive === 'win' ? '覚醒 撃破！！' : '撃破！！', W / 2, 18, 18, 'rainbow', 'center', { bold: true });
                text(`${m.chain + 1}連 GET`, W / 2, 84, 12, '#ffd84a', 'center');
            } else {
                ctx.fillStyle = 'rgba(20,0,10,0.75)';
                ctx.fillRect(0, 0, W, H);
                reels({ y: 56, size: 40, gap: 54 }, plan.figures, [1, 1, 1], now);
                text('おにおにが たおされた…', W / 2, 104, 12, '#ff8aa0', 'center');
            }
            return;
        } else if (el < t.revive) {
            // 負けた: 画面が 真っ赤に 点滅
            ctx.fillStyle = Math.floor(now * 10) % 2 ? '#ff0a1a' : '#5a0008';
            ctx.fillRect(0, 0, W, H);
            Art.draw(ctx, 'onioni', W / 2, H - 30, { height: 44, rot: Math.PI / 2 });
            text(e.win, W / 2, 40, 12, '#ffffff', 'center', { bold: true });
        } else {
            // 復活チャレンジ: ボタン長押しで ゲージが のびる (結果は おなじ)
            st.holdPrompt = true;
            const k = (el - t.revive) / B.time.revive;
            ctx.fillStyle = '#2a0006';
            ctx.fillRect(0, 0, W, H);
            Art.draw(ctx, 'onioni', W / 2, H - 30, { height: 44, rot: Math.PI / 2 * (1 - k * 0.3) });
            text('復活チャレンジ', W / 2, 24, 18, Math.floor(now * 6) % 2 ? '#ff3a4a' : '#ffd84a', 'center', { bold: true });
            text('ボタン 長押しで 覚醒せよ！', W / 2, 44, 11, '#ffffff');
            ctx.fillStyle = '#000000';
            ctx.fillRect(W / 2 - 70, 56, 140, 10);
            ctx.fillStyle = st.holding ? '#ff8a2a' : '#c83a2a';
            ctx.fillRect(W / 2 - 68, 58, 136 * k, 6);
            drawNormalHint(now);
        }
        // 図柄 (上に 小さく)。まんなかは けっかまで 回る
        if (el < t.result) reels(TOP, plan.figures, [el >= t.reach - 0.4, false, el >= t.reach], now, { speed: 20 });
        holds(m, now);
    }
    const drawNormalHint = now => { if (Math.floor(now * 4) % 2) text('PUSH', W / 2, H - 12, 10, '#ffd84a', 'center', { bold: true }); };

    // ----- 時短 -----
    function drawJitan(m, plan, el, D, now) {
        background('jitan', now);
        header(m, now);
        // 左 → 右 → まんなか
        const stopped = plan.reach ? [el > 0.6, el > D - 0.4, el > 1.1] : [el > D * 0.5, el > D - 0.15, el > D * 0.7];
        reels(BIG, plan.figures, stopped, now, { speed: 24 });
        if (plan.reach && el > 1.1 && el < D - 0.4) {
            text('こおりくんの 声が きこえた…！？', W / 2, 24, 10, '#bfe8ff', 'center');
            Art.draw(ctx, 'koori', W / 2, H - 14, { height: 30 * clamp01((el - 1.5) / 3), alpha: 0.8, frame: Math.floor(now * 3) });
        }
        holds(m, now);
    }

    // ----- 大当たり -----
    function drawBonus(m, now) {
        if (m.bonus && m.bonus.promo && m.bonus.promo.state === 'run') return drawPromo(m, now);
        const b = st.bonus || { rounds: m.bonus.rounds, round: m.bonus.round, count: m.bonus.count, next: m.bonus.next, from: m.bonus.from, chain: m.chain, start: now, charge: m.bonus.charge };
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
                text((hashira ? '柱の氷RASH' : 'おにおにRASH') + lt, W / 2, 66, 14, hashira ? '#b89cff' : '#ff6a8a', 'center', { bold: true });
                text(`${st.ending.chain}連中`, W / 2, 88, 12, '#ffd84a', 'center');
                if (hashira) ['haru', 'okadishi', 'kanezu'].forEach((id, i) => Art.draw(ctx, id, W - 90 + i * 30, H - 10, { height: 34, frame: Math.floor(now * 4) + i }));
                else Art.draw(ctx, 'onioni', 40, H - 10, { height: 44, frame: Math.floor(now * 4) });
            } else if (st.ending.next === 'normal') {
                background('jitan', now);
                text(st.ending.charge ? 'チャージ 終了' : '大当たり 終了', W / 2, 52, 18, '#7ad8ff', 'center', { bold: true });
                text('左打ちに もどしてね', W / 2, 76, 10, '#ffffff');
            } else {
                background('jitan', now);
                text('時短 100回', W / 2, 44, 20, '#7ad8ff', 'center', { bold: true });
                text('100回の あいだに あてれば ST！', W / 2, 70, 10, '#ffffff', 'center');
            }
            return;
        }
        if (b.charge) {
            // チャージ: 300発 (右打ち)
            background('jitan', now);
            text('チャージ', W / 2, 46, 26, 'rainbow', 'center', { bold: true });
            text(`${b.rounds * 150}発 ゲット！`, W / 2, 74, 13, '#ffd84a', 'center', { bold: true });
            text('右打ち →', W / 2, 96, 12, Math.floor(now * 3) % 2 ? '#ff6a8a' : '#ffffff', 'center', { bold: true });
            if (m.bonus && m.bonus.phase !== 'opening') {
                text(`ROUND ${m.bonus.round} / ${b.rounds}`, 6, 7, 9, '#ffd84a', 'left', { bold: true });
                text(`${m.bonus.count} / 10`, W - 6, 7, 9, '#ffffff', 'right');
            }
            return;
        }
        if (m.bonus && m.bonus.phase === 'opening') {
            // 大当たり！
            reels({ y: 70, size: 44 + Math.sin(el * 6) * 2, gap: 62 }, fig, [1, 1, 1], now, { gold: true });
            text('大当たり', W / 2, 18, 18 * (0.6 + 0.4 * ease(el * 2)), 'rainbow', 'center', { bold: true });
            const odd = fig[0] % 2 === 1;
            if (b.from === 'normal') text(odd ? 'ST 確定！' : m.bonus.promo ? '昇格チャレンジへ！' : '時短 チャンス', W / 2, 122, 11, odd ? '#ff6a8a' : '#7ad8ff', 'center', { bold: true });
            else if (b.from === 'st') text(`${b.chain}連 撃破！`, W / 2, 122, 11, '#ffd84a', 'center', { bold: true });
            // 出玉 (1/399): 3000発 / 1500発
            if (b.payKind) text(`${b.rounds * 150}発`, W / 2, 108, 12, b.rounds >= 20 ? 'rainbow' : '#ffffff', 'center', { bold: true });
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
        drawUwanose(now);
    }

    // 上乗せタイム (1/399 の RASH 中の 大当たり): のこり 秒の ゲージ。違和感 (液晶が ブツッと 消える) が 起きたら 成功 → +1500発
    function drawUwanose(now) {
        const u = st.uwanose;
        if (!u) return;
        if (u.state === 'time') {
            const left = Math.max(0, u.window - (now - u.start));
            ctx.fillStyle = 'rgba(40,0,60,0.7)';
            ctx.fillRect(0, 16, W, 30);
            text('上乗せタイム', W / 2 - 40, 26, 13, Math.floor(now * 4) % 2 ? '#ffd84a' : '#ff6a8a', 'center', { bold: true });
            text(`${Math.ceil(left)}`, W / 2 + 46, 30, 22, '#ffffff', 'center', { bold: true });
            ctx.fillStyle = '#ffd84a';
            ctx.fillRect(10, 41, (W - 20) * left / u.window, 3);
            text('違和感が 起きたら 上乗せ！', W / 2, 52, 8, '#ffffff');
        } else if (u.state === 'iwakan') {
            // 違和感: 液晶が ブツッと 消えて ノイズ
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, W, H);
            for (let i = 0; i < 40; i++) {
                ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#555566';
                ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 20, 1);
            }
        } else {
            const k = now - u.end;
            if (k > 3) { st.uwanose = null; return; }
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, H / 2 - 30, W, 56);
            if (u.state === 'win') {
                text('上乗せ！', W / 2, H / 2 - 14, 22 * (0.6 + 0.4 * ease(k * 3)), 'rainbow', 'center', { bold: true });
                text('+1500発', W / 2, H / 2 + 12, 18, '#ffd84a', 'center', { bold: true });
            } else {
                text('上乗せ ならず…', W / 2, H / 2 - 2, 16, '#9ab0d0', 'center', { bold: true });
            }
        }
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
            text(`柱の氷RASH${lt} 終了`, W / 2, 36, 16, '#b89cff', 'center', { bold: true });
            ['haru', 'okadishi', 'kanezu'].forEach((id, i) => Art.draw(ctx, id, W / 2 - 50 + i * 50, H - 24, { height: 34, alpha: 0.7 }));
        } else {
            Art.draw(ctx, 'onioni', W / 2, H - 30, { height: 40, rot: Math.PI / 2 * Math.min(1, k * 2), alpha: 0.8 });
            text(`おにおにRASH${lt} 終了`, W / 2, 36, 16, '#ff8aa0', 'center', { bold: true });
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
            text('柱の氷RASH' + lt, W / 2, 44, 24, '#b89cff', 'center', { bold: true });
            text('100回で 当たりを ねらえ！ 先バレ・一発告知に 注目', W / 2, 78, 9, '#ffd84a', 'center');
        } else {
            ctx.fillStyle = `rgba(80,0,20,${a})`;
            ctx.fillRect(0, 0, W, H);
            text('おにおにRASH' + lt, W / 2, 44, 24, '#ff3a4a', 'center', { bold: true });
            text('たおされたら 終わり！ 柱の氷を 撃破せよ', W / 2, 78, 9, '#ffd84a', 'center');
        }
    }


    // ----- 柱の氷RASH (2026-11-04 ユーザー指定: 柱の氷が 主役。基本は 勝負なしで 虹色に フラッシュ。バトルは 一発告知か 虹色の 決め手) -----
    const RIVAL_NAMES = { onioni: 'おにおに', koori: 'こおりくん' };
    // 柱の氷の 3 人 (rainbow: 虹色に はげしく フラッシュ)
    function hashiraTrio(now, rainbowOn = false) {
        ['haru', 'okadishi', 'kanezu'].forEach((id, i) => {
            const x = W / 2 - 70 + i * 70, y = H - 20;
            if (rainbowOn) {
                ctx.fillStyle = `hsla(${(now * 900 + i * 120) % 360}, 100%, 60%, 0.85)`;
                ctx.beginPath(); ctx.arc(x, y - 26, 32 + Math.sin(now * 40 + i) * 6, 0, Math.PI * 2); ctx.fill();
            }
            Art.draw(ctx, id, x, y, { height: rainbowOn ? 62 : 48, frame: Math.floor(now * (rainbowOn ? 16 : 3)) + i });
        });
    }
    // 柱の氷モードの 集結告知 (1/399。3000発 以上の 当たりの 前)
    function drawShuketsu(k, now) {
        const len = SHOW.rashMode.noticeTime;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);
        const c = ease(k * 3);
        ['haru', 'okadishi', 'kanezu'].forEach((id, i) => {
            const x = i * W / 3;
            ctx.fillStyle = ['#0e4a34', '#123a7a', '#3a4a6a'][i];
            ctx.fillRect(x + 1, 0, W / 3 - 2, H);
            Art.draw(ctx, id, x + W / 6, H - 16 + (1 - c) * (i % 2 ? -130 : 130), { height: 84, frame: Math.floor(now * 8) + i });
        });
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 8, W, 42);
        text('柱の氷 集結！！', W / 2, 20, 16, '#ffd84a', 'center', { bold: true });
        if (k > 1) text('3000発 以上 確定！', W / 2, 40, 15 * (0.7 + 0.3 * ease((k - 1) * 3)), 'rainbow', 'center', { bold: true });
        if (k > len - 0.3) { ctx.fillStyle = `rgba(255,255,255,${(k - len + 0.3) / 0.3})`; ctx.fillRect(0, 0, W, H); }
    }
    function drawHashira(m, plan, el, D, now) {
        if (plan.shuketsuNotice && el >= 0.3 && el < 0.3 + SHOW.rashMode.noticeTime) return drawShuketsu(el - 0.3, now);
        background('hashiraRash', now);
        header(m, now);
        if (plan.sub === 'quick') {
            hashiraTrio(now);
            reels(TOP, plan.figures, [el > D * 0.4, el > D - 0.2, el > D * 0.6], now, { speed: 24 });
            holds(m, now);
            return;
        }
        if (plan.sub === 'flash') {
            // 勝負なし: 知らせの あと 柱の氷が 虹色に はげしく フラッシュして 図柄が そろう
            const f = plan.noticeAt + 0.9, align = D - 1.4;
            if (el < f) {
                hashiraTrio(now);
                reels(TOP, plan.figures, [0, 0, 0], now, { speed: 24 });
                holds(m, now);
                return;
            }
            if (!st.gimStarted) { st.gimStarted = true; startGimmick('pillars', 3); st.shake = 0.6; }
            if (el < align) {
                const c = (now * 900) % 360;
                ctx.fillStyle = `hsla(${c}, 100%, 55%, 0.6)`;
                ctx.fillRect(0, 0, W, H);
                if (Math.floor(now * 16) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(0, 0, W, H); }
                hashiraTrio(now, true);
                reels(TOP, plan.figures, [0, 0, 0], now, { speed: 30 });
            } else {
                background('bonus', now);
                hashiraTrio(now, true);
                reels({ y: 44, size: 40, gap: 58 }, plan.figures, [1, 1, 1], now, { gold: true });
                text('当たり！', W / 2, 14, 16, 'rainbow', 'center', { bold: true });
            }
            return;
        }
        // バトル: 左が 柱の氷、右が 相手
        const walk = Math.floor(now * 6);
        if (el < 0.8) { hashiraTrio(now); reels(TOP, plan.figures, [0, 0, 0], now, { speed: 26 }); return; }
        if (plan.ippatsuAt && el >= plan.ippatsuAt) {
            // 一発告知
            if (!st.gimStarted) { st.gimStarted = true; startGimmick(Math.random() < 0.5 ? 'pillars' : 'doors', 3.2); st.flash = 1; st.shake = 0.5; }
            background('bonus', now);
            reels({ y: 66, size: 48, gap: 70 }, plan.figures, [1, 1, 1], now, { gold: true });
            text('一発告知！！', W / 2, 18, 18, 'rainbow', 'center', { bold: true });
            return;
        }
        background('battle', now);
        const team = TEAMS[(m.stSpins + 1) % TEAMS.length];
        const rivalIds = plan.rival === 'rival' ? team.members : [plan.rival];
        const rivalName = plan.rival === 'rival' ? team.name : RIVAL_NAMES[plan.rival];
        const chanceRival = plan.rival !== 'rival';
        const extra = plan.shuketsu ? 1.5 : 0;
        // 1) 登場 (0.8〜2.8): 柱の氷 (集結なら 3 人が 1 人ずつ) と 相手
        const k1 = el - 0.8;
        plan.enemies.forEach((id, i) => {
            const appear = clamp01((k1 - i * 0.5) / 0.4);
            if (appear <= 0) return;
            const x = plan.enemies.length === 1 ? 70 : 34 + i * 44;
            Art.draw(ctx, id, x, H - 26, { height: (plan.enemies.length === 1 ? 64 : 52) * ease(appear), frame: walk + i });
        });
        rivalIds.forEach((id, i) => {
            const x = rivalIds.length === 1 ? W - 64 : W - 100 + i * 34;
            const appear = clamp01((k1 - 0.6) / 0.4);
            if (appear > 0) Art.draw(ctx, id, x, H - 26, { height: (rivalIds.length === 1 ? 50 : 38) * ease(appear), frame: walk + i, flip: true });
        });
        if (k1 < 2 + extra) {
            if (plan.shuketsu && k1 > 0.6) text('柱の氷 集結！！', W / 2, 22, 18, Math.floor(now * 8) % 2 ? '#ff3a4a' : '#ffd84a', 'center', { bold: true });
            else if (!plan.shuketsu) text(`VS ${rivalName}`, W / 2, 22, 13, enemyTextColor(plan.textColor, now), 'center', { bold: true });
            if (chanceRival && k1 > 1.2) text(`${rivalName} 登場！ チャンス！`, W / 2, 42, 11, '#ffd84a', 'center', { bold: true });
            if (plan.shuketsu && k1 > 1.4) text('大チャンス', W / 2, 42 + (chanceRival ? 16 : 0), 12, 'rainbow', 'center', { bold: true });
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
        // 3) 決め手 (虹色なら 当たり)
        const aFrom = D - 5.4, aTo = D - 3.0;
        const a = plan.ippatsuAt ? null : actionWindow(plan.action, el, aFrom, aTo);
        if (a) { a.rainbow = plan.rainbow; a.text = 'レバーを引け！'; }
        drawPrompt(a, now);
        if (a && plan.action === 'mash' && !a.done) {
            // 連打の ゲージ
            const g = Math.min(1, (a.count || 0) / 14);
            ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 60, H - 22, 120, 8);
            ctx.fillStyle = g >= 1 ? `hsl(${(now * 400) % 360}, 90%, 60%)` : '#4ab0ff';
            ctx.fillRect(W / 2 - 59, H - 21, 118 * g, 6);
        }
        // 4) けっか
        if (el >= aTo && !plan.ippatsuAt) {
            const r = (el - aTo) / (D - aTo);
            if (plan.hit) {
                ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.7 - r * 2)})`;
                ctx.fillRect(0, 0, W, H);
                gimmickWin('pillars', 3);
                text('柱の氷 勝利！！', W / 2, 54, 22 * (0.5 + 0.5 * ease(r * 4)), 'rainbow', 'center', { bold: true });
                reels({ y: 104, size: 26, gap: 32 }, plan.figures, [1, 1, 1], now);
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

    return { promptWaiting, promptRainbow, playStory, setHolding, storyActive: () => Boolean(st.story), storySkip: () => { st.story = null; }, setOptions, init, handle, draw, tick, prompt, input, gimmick, startGimmick, banner, trophy, debug, W, H, S, FIG_CHARS, get canvas() { return canvas; } };
})();
