// =====================================================================
// 盤面の描画 (canvas)
// ---------------------------------------------------------------------
// 動かないもの (盤面の絵・レール・釘・液晶の枠) は最初に1枚の絵に描いておき、
// 毎フレームはそれを貼ってから、液晶・開け閉めする部品・風車・玉を上に描く。
// 盤面の論理座標を SCALE 倍した大きさの canvas に描く。
// =====================================================================

const BoardView = (() => {
    const SCALE = 2;
    // ふつうの 盤面の 色 (2026-10-23 ユーザー指定: 台の デザインを ルパン三世の 台の つくりに 合わせる。黒と 赤の「紅」)。
    //   accent: 赤い 飾り / accentDark: 盤面の まわりの 枠 / skyline: 液晶の 下の 街並み / window: 街の 窓 / deco: 回路の 線
    // 外伝の 盤面の 色 (2026-11-03): こおり一族の 青と、柱の氷の むらさき、おにおにの 赤を さし色に
    const BASE_COLORS = {
        boardTop: '#0a1438', boardBottom: '#05060f',
        snow: 'rgba(190, 220, 255, 0.25)',
        rail: '#e8eaf0', railShadow: '#5a5a66',
        nail: '#d8dee8', nailShade: '#7a8698', nailLight: '#ffffff',
        frame: '#14204a', frameLight: '#7ad8ff', frameDark: '#04060e',
        stage: '#d8f0ff', stageShade: '#2a6cd8',
        accent: '#5a8aff', accentDark: '#1a1050', skyline: '#0a0e24', window: '#7ad8ff', deco: 'rgba(120, 170, 255, 0.12)',
        pocket: '#ffcc33', pocketDark: '#a06a10',
        denchu: '#ff6a8a', attacker: '#ff3355', attackerOpen: '#ffe066',
        gate: '#9cff8a', warp: '#ffffff',
        windmill: '#9cd8ff', windmillHub: '#ffffff',
        ball: '#e8edf2', ballShade: '#8a96a6', ballLight: '#ffffff'
    };
    // いまの色 (カスタマイズの盤面の色・玉の色で上書きする)
    const COLORS = { ...BASE_COLORS };
    function applyColors() {
        Object.assign(COLORS, BASE_COLORS, typeof Customize !== 'undefined' ? Customize.boardColors() : {});
    }

    function create(canvas, board, config) {
        applyColors();
        const b = board.config;
        canvas.width = b.width * SCALE;
        canvas.height = b.height * SCALE;
        const ctx = canvas.getContext('2d');
        const base = document.createElement('canvas');
        base.width = canvas.width;
        base.height = canvas.height;
        drawStatic(base.getContext('2d'), board, config);
        // ドットフォントの読み込みが終わったら描き直す (読み込み前は別の字体で描かれるため)
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                const g = base.getContext('2d');
                g.setTransform(1, 0, 0, 1, 0, 0);
                g.clearRect(0, 0, base.width, base.height);
                drawStatic(g, board, config);
            });
        }
        return { canvas, ctx, base, board, config };
    }

    function line(g, points, width, color) {
        g.strokeStyle = color;
        g.lineWidth = width;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        g.stroke();
    }

    function disc(g, x, y, r, color) {
        g.fillStyle = color;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
    }

    function drawStatic(g, board, config) {
        const b = board.config;
        g.save();
        g.scale(SCALE, SCALE);

        // 盤面の地 (氷の夜空)
        const grad = g.createLinearGradient(0, 0, 0, b.height);
        grad.addColorStop(0, COLORS.boardTop);
        grad.addColorStop(1, COLORS.boardBottom);
        // レールの 外は 透明 (筐体の 絵が 盤面の 丸い 形に 合わせて 枠を 描く。2026-10-23 ユーザー指定: 四角の 空きを なくす)
        g.clearRect(0, 0, b.width, b.height);
        g.fillStyle = grad;
        g.beginPath();
        board.rails.outer.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        g.lineTo(board.rails.outer[board.rails.outer.length - 1][0], b.bottomY + 4);
        g.lineTo(board.rails.outer[0][0], b.bottomY + 4);
        g.fill();
        // 雪の粒 (毎回同じ配置)
        let seed = 7;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        g.fillStyle = COLORS.snow;
        for (let i = 0; i < 260; i++) g.fillRect(Math.floor(rnd() * b.width), Math.floor(rnd() * b.height), 1, 1);
        // 回路・地図の ような うすい 線 (透明な 盤面の 飾り。2026-10-23)
        g.save();
        g.beginPath();
        board.rails.outer.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        g.lineTo(board.rails.outer[board.rails.outer.length - 1][0], b.bottomY + 4);
        g.lineTo(board.rails.outer[0][0], b.bottomY + 4);
        g.clip();
        g.strokeStyle = COLORS.deco;
        g.fillStyle = COLORS.deco;
        g.lineWidth = 1;
        for (let i = 0; i < 46; i++) {
            let x = Math.floor(rnd() * b.width), y = Math.floor(rnd() * b.height);
            g.beginPath();
            g.moveTo(x, y);
            for (let k = 0; k < 3; k++) {
                if (rnd() < 0.5) x += (rnd() < 0.5 ? -1 : 1) * (8 + rnd() * 26); else y += (rnd() < 0.5 ? -1 : 1) * (8 + rnd() * 26);
                g.lineTo(x, y);
            }
            g.stroke();
            g.fillRect(x - 1, y - 1, 2, 2);
        }
        // 透明な 板の 光の すじ
        const shine = g.createLinearGradient(0, 0, b.width, b.height);
        shine.addColorStop(0, 'rgba(255,255,255,0)');
        shine.addColorStop(0.3, 'rgba(255,255,255,0.06)');
        shine.addColorStop(0.36, 'rgba(255,255,255,0)');
        shine.addColorStop(0.62, 'rgba(255,255,255,0.04)');
        shine.addColorStop(0.66, 'rgba(255,255,255,0)');
        g.fillStyle = shine;
        g.fillRect(0, 0, b.width, b.height);
        g.restore();
        // 液晶の 下の 街並み (SEタウン。窓が 光る)
        const lc = b.lcd;
        for (let x = lc.x - 6; x < lc.x + lc.w + 6;) {
            const bw = 6 + Math.floor(rnd() * 9), bh = 6 + Math.floor(rnd() * 14);
            g.fillStyle = COLORS.skyline;
            g.fillRect(x, lc.y + lc.h - bh, bw - 1, bh);
            g.fillStyle = COLORS.window;
            for (let wy = lc.y + lc.h - bh + 2; wy < lc.y + lc.h - 2; wy += 3) for (let wx = x + 1; wx < x + bw - 2; wx += 2) if (rnd() < 0.35) g.fillRect(wx, wy, 1, 1);
            x += bw;
        }
        // 右下の ダイヤ (氷の 結晶)
        const dx = b.pockets.attacker.x - 12, dy = b.pockets.attacker.y + 14, ds = 9;
        g.strokeStyle = 'rgba(220, 240, 255, 0.75)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(dx - ds, dy - ds * 0.3); g.lineTo(dx - ds * 0.5, dy - ds * 0.8); g.lineTo(dx + ds * 0.5, dy - ds * 0.8); g.lineTo(dx + ds, dy - ds * 0.3); g.lineTo(dx, dy + ds); g.closePath();
        g.fillStyle = COLORS.deco;
        g.fill();
        g.moveTo(dx - ds, dy - ds * 0.3); g.lineTo(dx + ds, dy - ds * 0.3);
        g.moveTo(dx - ds * 0.5, dy - ds * 0.8); g.lineTo(dx, dy + ds); g.lineTo(dx + ds * 0.5, dy - ds * 0.8);
        g.stroke();

        // 右打ちの通り道に色をつける
        g.fillStyle = 'rgba(255, 80, 110, 0.07)';
        g.beginPath();
        [...b.rightDivider, [b.width - 22, 420], [b.width - 22, 240]].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        g.fill();

        // レール (外の レールには 赤い 帯を そえる)
        line(g, board.rails.outer, 9, COLORS.accentDark);
        line(g, board.rails.outer, 5, COLORS.accent);
        line(g, board.rails.outer, 3, COLORS.railShadow);
        line(g, board.rails.outer, 1.6, COLORS.rail);
        line(g, board.rails.inner, 3, COLORS.railShadow);
        line(g, board.rails.inner, 1.6, COLORS.rail);
        const os = board.rails.outer[0], oe = board.rails.outer[board.rails.outer.length - 1], is = board.rails.inner[0];
        line(g, [os, [os[0], b.bottomY + 4]], 1.6, COLORS.rail);
        line(g, [oe, [oe[0], b.bottomY + 4]], 1.6, COLORS.rail);
        line(g, [is, [is[0], config.launch.foulY + 4]], 1.6, COLORS.rail);

        // 返しゴム
        const rb = board.rubber;
        line(g, [[rb.x1, rb.y1], [rb.x2, rb.y2]], 3, '#7ad8ff');

        // 壁 (床・右打ちの壁)
        board.segments.filter(s => s.surface === 'wall').forEach(s => line(g, [[s.x1, s.y1], [s.x2, s.y2]], 1.4, '#8fb4d8'));

        // 液晶の枠 (氷のブロック)
        const f = b.lcdFrame;
        const framePath = Board.framePolygon(f);
        g.fillStyle = COLORS.frame;
        g.beginPath();
        framePath.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        g.closePath();
        g.fill();
        line(g, framePath, 1.5, COLORS.frameLight);
        g.fillStyle = COLORS.frameDark;
        g.fillRect(b.lcd.x - 2, b.lcd.y - 2, b.lcd.w + 4, b.lcd.h + 4);
        // 枠の上の飾り: 赤い ロゴ「こおりくん」に 白い ふち (ルパン三世の 台の 液晶の 上の ロゴの ように。2026-10-23)
        // 小さすぎるとドット文字の「こ」がつぶれるので 12px 以上
        g.font = 'bold 15px "DotGothic16", "MS Gothic", monospace';
        g.textAlign = 'center';
        g.lineWidth = 3;
        g.strokeStyle = '#ffffff';
        g.strokeText('おにおにの挑戦', b.center.x, f.shoulder - 9);
        g.fillStyle = '#e8102a';
        g.fillText('おにおにの挑戦', b.center.x, f.shoulder - 9);


        // ワープ入口
        const w = b.warp;
        g.fillStyle = 'rgba(255, 255, 255, 0.25)';
        g.fillRect(w.x, w.y, w.w, w.h);
        line(g, [[w.x, w.y], [w.x, w.y + w.h]], 1, COLORS.warp);

        // ステージ
        [b.stage.left, b.stage.right].forEach(points => {
            line(g, points, 3, COLORS.stageShade);
            line(g, points, 1.4, COLORS.stage);
        });
        b.stage.spills.forEach(s => disc(g, s.x, s.y + 2, 1.5, '#000'));

        // 入賞口
        Object.entries(b.pockets).forEach(([id, p]) => {
            const half = p.width / 2 + b.nailRadius;
            const color = p.kind === 'denchu' ? COLORS.denchu : p.kind === 'attacker' ? COLORS.attacker : COLORS.pocket;
            g.fillStyle = COLORS.pocketDark;
            g.fillRect(p.x - half - 2, p.y + 1, half * 2 + 4, 6);
            g.fillStyle = color;
            g.fillRect(p.x - half - 2, p.y + 6, half * 2 + 4, 2);
            if (id === 'heso') {
                g.fillStyle = '#fff';
                g.font = '6px "DotGothic16", "MS Gothic", monospace';
                g.fillText('START', p.x, p.y + 14);
            }
        });
        // ゲート
        Object.values(b.gates).forEach(gt => {
            g.strokeStyle = COLORS.gate;
            g.lineWidth = 1;
            g.strokeRect(gt.x - gt.width / 2 - 2, gt.y - 3, gt.width + 4, 6);
        });

        // 釘
        board.circles.filter(c => c.surface === 'nail').forEach(c => {
            disc(g, c.x + 0.3, c.y + 0.3, c.r, COLORS.nailShade);
            disc(g, c.x, c.y, c.r, COLORS.nail);
            g.fillStyle = COLORS.nailLight;
            g.fillRect(c.x - 0.6, c.y - 0.6, 0.6, 0.6);
        });

        // 右打ちの矢印
        g.fillStyle = 'rgba(255, 120, 140, 0.8)';
        g.font = '7px "DotGothic16", "MS Gothic", monospace';
        g.fillText('右打ち→', b.lcdFrame.right + 24, b.lcdFrame.shoulder + 4);
        g.restore();
    }

    // 盤面の 役物 (2026-11-03 ユーザー指定: ふだんは しまわれていて、当たりの ときなどに 変形して 出てくる)。g = Lcd.gimmick() { kind, t (0〜1) }
    //   pillars: 液晶の 屋根の 上に 先だけ 見えている 3 本の 氷の 柱 (柱の氷)。おりてきて 液晶の 前に ならび、ひびが 入って くだけ、金の 光
    //   doors:   液晶の 枠の 左右に しまってある 氷の 扉。しまって 液晶を かくし、まんなかの 結晶が 光って いきおいよく ひらく
    //   kanabo:  枠の 右上に ねている おにおにの 金棒。ふりおろされて 液晶を たたき、衝撃波
    function drawGimmick(ctx, b, g, now) {
        const f = b.lcdFrame, L = b.lcd;
        const cx = L.x + L.w / 2, cy = L.y + L.h / 2;
        const t = g ? g.t : -1;
        const font = '"DotGothic16", "MS Gothic", monospace';
        // ----- 柱 -----
        const pillarColors = [['#2a9870', '#bff8e0'], ['#2a68d0', '#a8d0ff'], ['#a8b4e0', '#ffffff']];
        const isP = g && g.kind === 'pillars';
        const pk = isP ? (t < 0.2 ? ease(t / 0.2) : 1) : 0;
        const pw = 24;
        for (let i = 0; i < 3; i++) {
            const px = cx + (i - 1) * 60;
            const restTop = f.top - 9 + Math.abs(i - 1) * 9, restH = 6;
            const downTop = L.y - 2, downH = L.h - 4;
            const top = restTop + (downTop - restTop) * pk, h = restH + (downH - restH) * pk;
            if (isP && t >= 0.8) {
                // くだけた かけら
                const k = (t - 0.8) / 0.2;
                ctx.fillStyle = pillarColors[i][1];
                ctx.globalAlpha = 1 - k;
                for (let s = 0; s < 10; s++) {
                    const a = s / 10 * Math.PI * 2 + i;
                    ctx.fillRect(px + Math.cos(a) * k * 70, cy + Math.sin(a) * k * 50, 4, 4);
                }
                ctx.globalAlpha = 1;
                continue;
            }
            const grad = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
            grad.addColorStop(0, pillarColors[i][0]);
            grad.addColorStop(0.45, pillarColors[i][1]);
            grad.addColorStop(1, pillarColors[i][0]);
            ctx.fillStyle = grad;
            ctx.fillRect(px - pw / 2, top, pw, h);
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillRect(px - pw / 2, top, pw, 1.5);
            ctx.fillStyle = pillarColors[i][1];
            ctx.beginPath(); ctx.moveTo(px - pw / 2, top + h); ctx.lineTo(px, top + h + 7); ctx.lineTo(px + pw / 2, top + h); ctx.fill();
            if (pk > 0.6) {
                // 流派の しるし (嵐・渦・雪)
                ctx.fillStyle = `hsl(${(now * 300 + i * 120) % 360}, 90%, 62%)`;
                ctx.beginPath(); ctx.arc(px, cy, 8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold 9px ${font}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(['嵐', '渦', '雪'][i], px, cy + 0.5);
            }
            if (isP && t > 0.6) {
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(px - 6, top + 10); ctx.lineTo(px + 3, cy - 12); ctx.lineTo(px - 4, cy + 10); ctx.lineTo(px + 5, top + h - 6); ctx.stroke();
            }
        }
        if (isP && t >= 0.8) {
            const k = (t - 0.8) / 0.2;
            ctx.globalAlpha = 1 - k * 0.6;
            rays(ctx, cx, cy, 40 + k * 50, now);
            text(ctx, '激アツ', cx, cy, 20, '#ffd84a', '#6a3a00', font);
            ctx.globalAlpha = 1;
        }
        // ----- 扉 -----
        const isD = g && g.kind === 'doors';
        const dk = isD ? (t < 0.18 ? ease(t / 0.18) : t < 0.7 ? 1 : 1 - ease((t - 0.7) / 0.12)) : 0;
        const dw = 5 + (L.w / 2 - 5) * dk;
        for (const side of [-1, 1]) {
            const x0 = side < 0 ? L.x - 3 : L.x + L.w + 3 - dw;
            const grad = ctx.createLinearGradient(x0, 0, x0 + dw, 0);
            grad.addColorStop(0, '#3a6aa8'); grad.addColorStop(0.5, '#d8f0ff'); grad.addColorStop(1, '#3a6aa8');
            ctx.fillStyle = grad;
            ctx.fillRect(x0, L.y - 2, dw, L.h + 4);
            ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.8;
            ctx.strokeRect(x0 + 1, L.y, dw - 2, L.h);
            if (dk > 0.3) {
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x0 + dw * k / 4, L.y + 4); ctx.lineTo(x0 + dw * k / 4, L.y + L.h - 4); ctx.stroke(); }
            }
        }
        if (isD && t > 0.15 && t < 0.72) {
            const r = 16 + Math.sin(now * 10) * 1.5;
            rays(ctx, cx, cy, 34, now);
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(now * 2);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
            for (let k = 0; k < 6; k++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r); ctx.moveTo(0, -r * 0.6); ctx.lineTo(4, -r * 0.82); ctx.moveTo(0, -r * 0.6); ctx.lineTo(-4, -r * 0.82); ctx.stroke(); }
            ctx.restore();
        }
        if (isD && t >= 0.7) {
            ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (t - 0.7) / 0.3)})`;
            ctx.fillRect(L.x, L.y, L.w, L.h);
        }
        // ----- 金棒 -----
        const isK = g && g.kind === 'kanabo';
        const pivot = { x: f.right - 6, y: f.top + 8 };
        let ka = Math.PI;   // ねている (屋根の 右に そって 左向き)
        let len = 46;
        if (isK) {
            // ふりあげて → ふりおろす (液晶の まんなかへ) → ぶるぶる → もどる
            const down = Math.atan2(cy + 10 - pivot.y, cx - pivot.x);
            const up = Math.PI + 0.5;
            if (t < 0.12) ka = Math.PI + 0.5 * ease(t / 0.12);
            else if (t < 0.22) ka = up + (down + Math.PI * 2 - up) * ease((t - 0.12) / 0.1);
            else if (t < 0.8) ka = down + Math.PI * 2 + Math.sin((t - 0.22) * 60) * 0.04 * (1 - (t - 0.22) / 0.58);
            else ka = down + Math.PI * 2 + (Math.PI - down - Math.PI * 2) * ease((t - 0.8) / 0.2);
            len = 46 + 104 * (t < 0.12 ? ease(t / 0.12) : t < 0.8 ? 1 : 1 - ease((t - 0.8) / 0.2));
        }
        ctx.save();
        ctx.translate(pivot.x, pivot.y);
        ctx.rotate(ka);
        drawKanabo(ctx, len);
        ctx.restore();
        if (isK && t >= 0.22 && t < 0.6) {
            const k = (t - 0.22) / 0.38;
            ctx.strokeStyle = `rgba(255,220,120,${1 - k})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(cx, cy + 10, 20 + k * 120, 8 + k * 40, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
            ctx.fillRect(L.x, L.y, L.w, L.h);
            text(ctx, 'ドーン！', cx - 20, cy - 30, 16, '#ff3a4a', '#ffffff', font);
        }
    }
    // 金棒 (根もとが 原点。+x 方向へ のびる)
    function drawKanabo(ctx, len) {
        const w0 = Math.max(3, len * 0.07), w1 = Math.max(6, len * 0.15);
        ctx.fillStyle = '#8a2a1a';
        ctx.fillRect(0, -w0 / 2, len * 0.22, w0);
        ctx.fillStyle = '#c8a040';
        ctx.fillRect(len * 0.22, -w0 * 0.7, len * 0.03, w0 * 1.4);
        const grad = ctx.createLinearGradient(0, -w1 / 2, 0, w1 / 2);
        grad.addColorStop(0, '#a8a8bc'); grad.addColorStop(0.5, '#5a5a6a'); grad.addColorStop(1, '#2a2a34');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(len * 0.25, -w0 * 0.7); ctx.lineTo(len, -w1 / 2); ctx.lineTo(len, w1 / 2); ctx.lineTo(len * 0.25, w0 * 0.7);
        ctx.fill();
        ctx.fillStyle = '#e8e8f4';
        for (let k = 0.32; k < 0.97; k += 0.09) {
            const w = w0 * 0.7 + (w1 / 2 - w0 * 0.7) * (k - 0.25) / 0.75;
            ctx.fillRect(len * k, -w - 1.5, 1.6, 1.6);
            ctx.fillRect(len * k + 2.5, w, 1.6, 1.6);
        }
    }
    function rays(ctx, x, y, r, now) {
        for (let i = 0; i < 14; i++) {
            const a = i / 14 * Math.PI * 2 + now * 1.5;
            ctx.strokeStyle = `hsla(${(now * 300 + i * 26) % 360}, 95%, 65%, 0.6)`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4);
            ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            ctx.stroke();
        }
    }
    function text(ctx, str, x, y, size, color, stroke, font) {
        ctx.font = `bold ${size}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = stroke;
        ctx.strokeText(str, x, y);
        ctx.fillStyle = color;
        ctx.fillText(str, x, y);
    }
    const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

    // 可動液晶 (2026-10-23 アップグレード P1): 見せ場で 液晶が 盤面の 前に せり出して 大きくなる (zoom 0〜1)。
    //   玉と 盤面の 動きは そのまま (見た目だけ)。大きさは config.lcdZoom
    function drawZoomedLcd(ctx, b, lcdCanvas, zoom, now) {
        if (!lcdCanvas || !(zoom > 0)) return;
        const z = CONFIG.show.lcdZoom;
        const k = zoom < 1 ? 1 - Math.pow(1 - zoom, 3) : 1;
        const w = b.lcd.w + (b.lcd.w * z.scale - b.lcd.w) * k;
        const h = w * b.lcd.h / b.lcd.w;
        const cx = b.lcd.x + b.lcd.w / 2;
        const cy = b.lcd.y + b.lcd.h / 2 + (z.offsetY || 0) * k;
        const x = cx - w / 2, y = cy - h / 2;
        // 影と 金の 枠 (前に 出てきた 感じ)
        ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * k})`;
        ctx.fillRect(x - 6, y - 4, w + 12, h + 14);
        const frame = ctx.createLinearGradient(0, y - 5, 0, y + h + 5);
        frame.addColorStop(0, '#fff2a8');
        frame.addColorStop(0.5, '#e0a82a');
        frame.addColorStop(1, '#8a5a10');
        ctx.fillStyle = frame;
        ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(lcdCanvas, x, y, w, h);
        ctx.imageSmoothingEnabled = false;
        // ふちの 光
        ctx.strokeStyle = `rgba(255, 240, 160, ${0.4 + 0.3 * Math.sin(now * 6)})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
    }

    // lcdCanvas: 液晶の絵 (256x144)。玉と部品は view.world から。gimmick: 役物の進み具合 (0〜1、動いていないときは null)
    function draw(view, world, lcdCanvas, gimmick = null, now = 0, zoom = 0) {
        const { ctx, board } = view;
        const b = board.config;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);   // レールの 外は 透明
        ctx.drawImage(view.base, 0, 0);
        ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

        if (lcdCanvas) {
            // 2 倍で 描いた 液晶を なめらかに 縮める (2026-10-23 P1)
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(lcdCanvas, b.lcd.x, b.lcd.y, b.lcd.w, b.lcd.h);
            ctx.imageSmoothingEnabled = false;
        }
        // 盤面の 役物は 筐体 (js/cabinet.js) が 大きく 描く ときは 描かない (view.noGimmick。2026-10-23 ユーザー指定)
        if (!view.noGimmick) drawGimmick(ctx, b, gimmick, now);

        // 電チューの羽根・アタッカーのふた
        Object.entries(board.parts).forEach(([id, part]) => {
            const kind = b.pockets[id].kind;
            const color = kind === 'attacker' ? (part.open ? COLORS.attackerOpen : COLORS.attacker) : COLORS.denchu;
            (part.open ? part.opened : part.closed).forEach(s => line(ctx, [[s.x1, s.y1], [s.x2, s.y2]], kind === 'attacker' ? 3 : 2, color));
            if (kind === 'attacker' && part.open) {
                const p = b.pockets[id];
                ctx.fillStyle = 'rgba(255, 224, 102, 0.35)';
                ctx.fillRect(p.x - p.width / 2, p.y, p.width, 6);
            }
        });

        // 風車
        board.windmills.forEach(m => {
            Board.windmillBlades(m).forEach(s => line(ctx, [[s.x1, s.y1], [s.x2, s.y2]], 2, COLORS.windmill));
            disc(ctx, m.x, m.y, 2, COLORS.windmillHub);
        });

        // 玉
        world.balls.forEach(ball => {
            disc(ctx, ball.x + 0.4, ball.y + 0.5, ball.r, 'rgba(0, 0, 0, 0.35)');
            disc(ctx, ball.x, ball.y, ball.r, COLORS.ballShade);
            disc(ctx, ball.x - 0.4, ball.y - 0.4, ball.r - 0.7, COLORS.ball);
            disc(ctx, ball.x - 1.1, ball.y - 1.1, 0.8, COLORS.ballLight);
        });
        // 可動液晶: 見せ場では 玉の 上に 大きく 出す
        drawZoomedLcd(ctx, b, lcdCanvas, zoom, now);
    }

    // カスタマイズで色が変わったときに、動かない部分を描き直す
    function redraw(view) {
        applyColors();
        const g = view.base.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, view.base.width, view.base.height);
        drawStatic(g, view.board, view.config);
    }

    // 画面上の位置 (CSS ピクセル) → 盤面の論理座標
    function toBoard(view, clientX, clientY) {
        const rect = view.canvas.getBoundingClientRect();
        return [(clientX - rect.left) / rect.width * view.board.config.width, (clientY - rect.top) / rect.height * view.board.config.height];
    }

    // 盤面の 形 (レールの 外の ふち。筐体が この 形に 合わせて 枠を 描く): 盤面の 座標の 点の 列
    function outline(board) {
        const o = board.rails.outer, b = board.config;
        return [...o, [o[o.length - 1][0], b.bottomY + 4], [o[0][0], b.bottomY + 4]];
    }

    return { create, draw, redraw, toBoard, outline, SCALE };
})();
