// =====================================================================
// 台の 筐体 (盤面の まわり)。今どきの 台の ように 上に 大きな ロゴの 看板、まわりに 光る 枠、下に 上皿と スピーカー
// ---------------------------------------------------------------------
// 筐体の 絵は canvas#cabinet-art に 描き (枠の 光は 台の 状態で かわる)、盤面 canvas#board を 中に はめる。
// 右横に おにおにの 金棒レバー (2026-11-03 ユーザー指定: 右横に ついていて 左へ 引く。#lever)、
// 下に 台の ボタン (PUSH。#push。レバーとは べつ)。どちらも Lcd.prompt() で 光って ふるえる。
// 大きさは 筐体の 論理座標 (CAB)。盤面は CAB.board の 場所に 置く (CSS の % で)
// =====================================================================

const Cabinet = (() => {
    const CAB = { w: 470, h: 726, board: { x: 26, y: 84, w: 380, h: 540 }, lever: { x: 420, y: 300, w: 50, h: 220 }, push: { x: 196, y: 650, r: 30 } };
    const FONT = '"DotGothic16", "MS Gothic", monospace';
    let canvas, ctx, outline = null, S = 2;

    function init(el, boardOutline) {
        canvas = el;
        canvas.width = CAB.w * S;
        canvas.height = CAB.h * S;
        ctx = canvas.getContext('2d');
        outline = boardOutline.map(([x, y]) => [x + CAB.board.x, y + CAB.board.y]);
    }

    function rr(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    function text(str, x, y, size, color, stroke = '#000', width = 3, bold = true) {
        ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        if (stroke) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
        ctx.fillStyle = color;
        ctx.fillText(str, x, y);
    }

    // 枠の 光の 色 (台の 状態で)
    function ledColor(state, i, now) {
        if (state.prompt) return Math.floor(now * 10) % 2 ? '#ff2a3a' : '#ffd84a';
        if (state.bonus) return `hsl(${(now * 300 + i * 18) % 360}, 95%, 60%)`;
        if (state.gim) return `hsl(${(now * 600 + i * 30) % 360}, 100%, 65%)`;
        if (state.mode === 'st') { const a = 0.5 + 0.5 * Math.sin(now * 6 + i * 0.4); return `rgba(255, ${40 + a * 60}, ${60 + a * 40}, ${0.5 + a * 0.5})`; }
        if (state.mode === 'hst') { const a = 0.5 + 0.5 * Math.sin(now * 5 + i * 0.5); return (i + Math.floor(now * 10)) % 5 < 2 ? '#e0d0ff' : `rgba(150, 90, 255, ${0.4 + a * 0.5})`; }
        if (state.mode === 'jitan') return (i + Math.floor(now * 14)) % 6 < 2 ? '#7ad8ff' : '#1a3a6a';
        if (state.reach) return (i + Math.floor(now * 16)) % 4 < 2 ? '#ffd84a' : '#5a3a00';
        return (i + Math.floor(now * 6)) % 10 < 2 ? '#bfe8ff' : '#2a4a8a';
    }

    // state: { mode, bonus, reach, prompt, gim, holds1, holds2, futsu }
    function draw(state, now) {
        ctx.setTransform(S, 0, 0, S, 0, 0);
        ctx.clearRect(0, 0, CAB.w, CAB.h);
        // ----- 本体 -----
        const body = ctx.createLinearGradient(0, 0, CAB.w, 0);
        body.addColorStop(0, '#0c1230'); body.addColorStop(0.5, '#1a2450'); body.addColorStop(1, '#0a0e24');
        ctx.fillStyle = body;
        rr(2, 2, CAB.w - 4, CAB.h - 4, 22);
        ctx.fill();
        ctx.strokeStyle = '#5a6aa8'; ctx.lineWidth = 2; ctx.stroke();
        // ----- 看板 (上): 氷の とげの かんむりと ロゴ -----
        const top = ctx.createLinearGradient(0, 0, 0, 84);
        top.addColorStop(0, '#2a1050'); top.addColorStop(1, '#0a0828');
        ctx.fillStyle = top;
        rr(10, 6, CAB.w - 20, 76, 16);
        ctx.fill();
        // 氷の とげ
        for (let i = 0; i < 13; i++) {
            const x = 28 + i * 34, h = 10 + (i % 3) * 5 + (i === 6 ? 10 : 0);
            const g = ctx.createLinearGradient(x, 6, x + 12, 6);
            g.addColorStop(0, '#5aa8e8'); g.addColorStop(0.5, '#e8f8ff'); g.addColorStop(1, '#3a78c8');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(x - 7, 12); ctx.lineTo(x, 12 - h); ctx.lineTo(x + 7, 12); ctx.fill();
        }
        // ロゴ
        const shine = (Math.sin(now * 1.3) + 1) / 2;
        text('こおりくんの大冒険外伝', CAB.w / 2, 24, 13, '#bfe8ff', '#0a1440', 3);
        text('おにおにの挑戦', CAB.w / 2, 49, 30, '#ff2a3a', '#ffffff', 5);
        ctx.save();
        ctx.globalAlpha = 0.6 * shine;
        text('おにおにの挑戦', CAB.w / 2, 49, 30, '#ffd0d8', null);
        ctx.restore();
        text('～めざめる３人の氷達～', CAB.w / 2, 72, 11, '#9cf0c8', '#0a1440', 3);
        // 看板の 左右に 柱の氷の しるし
        [['嵐', '#3adc8a'], ['渦', '#4a8aff'], ['雪', '#e8f0ff']].forEach(([ch, c], i) => {
            const x = i === 2 ? CAB.w - 40 : 40, y = i === 1 ? 999 : 46;
            if (y > CAB.h) return;
            ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
            text(ch, x, y + 1, 13, '#0a1440', null);
        });
        Art.draw(ctx, 'kanabo', CAB.w - 72, 66, { height: 46, rot: 0.5 });
        Art.draw(ctx, 'onioni', 76, 70, { height: 30, frame: Math.floor(now * 2) });
        // ----- 盤面の まわりの 枠 (光る) -----
        if (outline) {
            ctx.save();
            ctx.beginPath();
            outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.closePath();
            ctx.lineWidth = 16;
            const chrome = ctx.createLinearGradient(0, CAB.board.y, 0, CAB.board.y + CAB.board.h);
            chrome.addColorStop(0, '#e8eef8'); chrome.addColorStop(0.5, '#6a7a9a'); chrome.addColorStop(1, '#c8d0e0');
            ctx.strokeStyle = chrome;
            ctx.stroke();
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#0a0e24';
            ctx.stroke();
            ctx.restore();
            // LED (枠に そって)
            const n = outline.length;
            for (let i = 0; i < n; i += 2) {
                const [x, y] = outline[i];
                ctx.fillStyle = ledColor(state, i / 2, now);
                ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
            }
        }
        // 左右の 光の 柱
        for (const side of [0, 1]) {
            const x = side ? CAB.w - 60 + 44 : 6;
            for (let i = 0; i < 26; i++) {
                ctx.fillStyle = ledColor(state, i + side * 7, now);
                rr(x, 110 + i * 19, 8, 14, 3);
                ctx.fill();
            }
        }
        // ----- レバーの 台座 (右横) -----
        const L = CAB.lever;
        const plate = ctx.createLinearGradient(L.x, 0, L.x + L.w, 0);
        plate.addColorStop(0, '#2a2a3a'); plate.addColorStop(0.5, '#8a8aa0'); plate.addColorStop(1, '#2a2a3a');
        ctx.fillStyle = plate;
        rr(L.x + 6, L.y + L.h - 40, L.w - 10, 40, 8);
        ctx.fill();
        ctx.fillStyle = '#0a0a14';
        rr(L.x + 12, L.y + L.h - 30, L.w - 22, 8, 3);
        ctx.fill();
        text('← 引く', L.x + L.w / 2 + 2, L.y + L.h - 10, 9, '#ffd84a', '#000', 2);
        // ----- 下: 上皿・スピーカー・表示 -----
        const tray = ctx.createLinearGradient(0, 630, 0, CAB.h);
        tray.addColorStop(0, '#2a3260'); tray.addColorStop(1, '#0a0e24');
        ctx.fillStyle = tray;
        rr(10, 632, CAB.w - 20, CAB.h - 640, 18);
        ctx.fill();
        // 上皿 (玉が たまる)
        ctx.fillStyle = '#05070f';
        rr(250, 646, 150, 30, 12);
        ctx.fill();
        const balls = Math.min(40, Math.floor((state.balls || 0) / 25));
        for (let i = 0; i < balls; i++) {
            const bx = 262 + (i % 20) * 6.6, by = 668 - Math.floor(i / 20) * 6;
            ctx.fillStyle = '#c8d0dc'; ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 1.5, by - 1.5, 1, 1);
        }
        text('上皿', 325, 690, 9, '#8a9ac8', null);
        // スピーカー
        for (const sx of [44, CAB.w - 44]) {
            ctx.fillStyle = '#05070f';
            ctx.beginPath(); ctx.arc(sx, 678, 24, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2a3260';
            for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) { ctx.beginPath(); ctx.arc(sx - 12 + a * 6, 666 + b * 6, 1.4, 0, Math.PI * 2); ctx.fill(); }
            ctx.strokeStyle = ledColor(state, sx, now);
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx, 678, 26, 0, Math.PI * 2); ctx.stroke();
        }
        // 小さい 表示 (特図・普図・保留の ランプ。本物の 台の ように)
        ctx.fillStyle = '#05070f';
        rr(86, 650, 70, 34, 4);
        ctx.fill();
        text('特1', 98, 657, 6, '#8a9ac8', null, 0, false);
        text('特2', 98, 667, 6, '#8a9ac8', null, 0, false);
        text('普', 98, 677, 6, '#8a9ac8', null, 0, false);
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i < (state.holds1 || 0) ? '#ff4a4a' : '#2a1010'; ctx.fillRect(108 + i * 8, 655, 5, 4);
            ctx.fillStyle = i < (state.holds2 || 0) ? '#ff4a4a' : '#2a1010'; ctx.fillRect(108 + i * 8, 665, 5, 4);
            ctx.fillStyle = i < (state.futsu || 0) ? '#4aff6a' : '#102a10'; ctx.fillRect(108 + i * 8, 675, 5, 4);
        }
        // 右打ちの ランプ
        if (state.right) text('右打ち →', 121, 703, 11, Math.floor(now * 3) % 2 ? '#ff3a4a' : '#ffffff', '#000', 3);
    }

    // CSS の 置き場所 (筐体の 中での %)
    function place(el, r) {
        el.style.left = (r.x / CAB.w * 100) + '%';
        el.style.top = (r.y / CAB.h * 100) + '%';
        el.style.width = (r.w / CAB.w * 100) + '%';
        el.style.height = (r.h / CAB.h * 100) + '%';
    }

    // ----- 金棒レバー (右横・左へ 引く) -----
    // onPull: 引ききったとき。ドラッグで 左へ 引く / タップでも 引いた ことに する (スマホで 遊びやすく)
    function setupLever(el, onPull) {
        place(el, CAB.lever);
        const art = el.querySelector('canvas');
        art.width = 28; art.height = 96;
        const g = art.getContext('2d');
        g.imageSmoothingEnabled = false;
        Art.draw(g, 'kanabo', 14, 96, { height: 96 });
        let start = null, angle = 0, anim = null;
        const set = a => { angle = a; el.style.setProperty('--lever-angle', a + 'deg'); };
        const pull = () => {
            onPull();
            el.classList.add('pulled');
            // もどる
            cancelAnimationFrame(anim);
            let a = -42;
            const back = () => { a *= 0.82; set(a); if (a < -0.5) anim = requestAnimationFrame(back); else { set(0); el.classList.remove('pulled'); } };
            set(a);
            anim = requestAnimationFrame(back);
        };
        el.addEventListener('pointerdown', e => {
            e.preventDefault();
            start = { x: e.clientX, t: performance.now() };
            el.setPointerCapture(e.pointerId);
        });
        el.addEventListener('pointermove', e => {
            if (!start) return;
            const dx = e.clientX - start.x;
            set(Math.max(-42, Math.min(0, dx / 1.6)));
        });
        const up = () => {
            if (!start) return;
            const quick = performance.now() - start.t < 300 && angle > -6;
            start = null;
            if (angle <= -24 || quick) pull();
            else set(0);
        };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        return { pull };
    }

    return { CAB, init, draw, place, setupLever };
})();
