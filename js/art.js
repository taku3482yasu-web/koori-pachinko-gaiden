// =====================================================================
// キャラの ドット絵
// ---------------------------------------------------------------------
// 前作の キャラ (こおりくん・おにおに・ハリージェネラル・ヒョウガリュウ・ライバル探検隊 など) は js/art-legacy.js (写した 絵)。
// 新しい キャラ = 柱の氷 (2026-11-03 ユーザー指定): ハルゥ (嵐の 流派)・オカディシ (大渦の 流派)・カネーズ (吹雪の 流派。リーダー。
//   古来より 生きている こおり一族で 古い しきたりを 重んじる)。こおり一族 なので こおりくんと 同じ 氷の 四角い 体に、それぞれの 流派の 飾り。
//   描き方は { w, h, draw(r, frame) } (r(x, y, w, h, 色) で 四角を ぬる。frame は 0 / 1 で 動く)
// Art.draw(ctx, id, x, y, { scale, frame, flip, alpha }) で 足もと まんなか (x, y) に 描く。Art.size(id) で 大きさ
// =====================================================================

const NEW_ART = {
    // ハルゥ: 嵐の 流派。みどりの 氷・白い はちまき・なびく マフラー・まわりに 風
    haru: {
        w: 34, h: 36,
        draw(r, f) {
            const o = '#0d3a2a', g = '#8ff0c4', l = '#e4fff2', d = '#38b888', s = '#20c070', w = '#ffffff';
            // なびく マフラー (うしろ)
            r(0, 15 + f, 7, 3, s); r(1, 18 + f, 5, 2, s); r(0, 20 - f, 3, 2, '#139050');
            // 氷の とげ (頭)
            r(9, 2, 3, 3, g); r(15, 0, 4, 5, g); r(22, 2, 3, 3, g);
            r(10, 1, 1, 1, l); r(16, 0, 1, 1, l);
            // 体
            r(5, 4, 24, 24, o); r(6, 5, 22, 22, g);
            r(7, 6, 7, 3, l); r(7, 9, 3, 3, l);
            r(25, 7, 2, 19, d); r(6, 24, 22, 3, d);
            // はちまき
            r(6, 9, 22, 3, w); r(3, 8, 4, 2, w); r(2, 10, 3, 2, w);
            r(14, 9, 6, 3, '#c8f0e0'); r(16, 10, 2, 1, s);
            // まゆ (つりあがり)・目
            r(9, 13, 5, 1, o); r(12, 14, 2, 1, o);
            r(20, 13, 5, 1, o); r(20, 14, 2, 1, o);
            r(10, 15, 4, 3, '#10162a'); r(20, 15, 4, 3, '#10162a');
            r(12, 16, 1, 1, '#ff3a4a'); r(22, 16, 1, 1, '#ff3a4a');
            // くち (にやり)
            r(13, 21, 7, 1, o); r(19, 20, 2, 1, o);
            // むねの 柱の しるし
            r(15, 23, 4, 1, w); r(16, 24, 2, 2, w);
            // 足
            r(9, 28, 5, 3, o); r(20, 28, 5, 3, o);
            // 風 (うず)
            const k = f ? 1 : 0;
            r(29, 4 + k, 4, 1, w); r(32, 5 + k, 1, 2, w); r(29, 7 + k, 3, 1, w);
            r(28, 18 - k, 5, 1, 'rgba(255,255,255,0.8)'); r(31, 20 - k, 3, 1, 'rgba(255,255,255,0.6)');
            r(1, 27 + k, 4, 1, 'rgba(255,255,255,0.7)');
        }
    },
    // オカディシ: 大渦の 流派。こい あおの 大きな 氷・おなかに うずまき・三つまたの ほこ
    okadishi: {
        w: 36, h: 38,
        draw(r, f) {
            const o = '#0a1a4a', b = '#3a78e0', l = '#a8d0ff', d = '#1f4aa8', w = '#e0f0ff';
            // ほこ (右手)
            r(31, 3, 2, 33, '#c89a3a'); r(31, 3, 1, 33, '#e8c060');
            r(28, 4, 8, 1, w); r(28, 0, 1, 5, w); r(31, 0, 2, 4, w); r(35, 0, 1, 5, w);
            // 氷の とげ
            r(8, 4, 4, 4, b); r(15, 2, 5, 5, b); r(23, 4, 4, 4, b);
            r(16, 2, 1, 2, l);
            // 体 (大きい)
            r(3, 6, 28, 28, o); r(4, 7, 26, 26, b);
            r(5, 8, 8, 3, l); r(5, 11, 3, 3, l);
            r(27, 9, 2, 23, d); r(4, 30, 26, 3, d);
            // 目 (おもい まぶた)
            r(8, 12, 6, 2, o); r(20, 12, 6, 2, o);
            r(9, 14, 4, 2, '#10162a'); r(21, 14, 4, 2, '#10162a');
            r(10, 14, 1, 1, '#ffe85a'); r(22, 14, 1, 1, '#ffe85a');
            // ひげ
            r(11, 18, 5, 2, w); r(18, 18, 5, 2, w); r(9, 19, 2, 2, w); r(23, 19, 2, 2, w);
            // おなかの うずまき (まわる)
            const c = f ? 1 : 0;
            r(10, 21, 14, 10, w); r(11, 22, 12, 8, b); r(13, 23 + c, 8, 5, w); r(14, 24 + c, 6, 3, b);
            r(16, 25, 3, 1, w); r(10 + c * 10, 25, 2, 2, b);
            // 足
            r(7, 34, 7, 3, o); r(20, 34, 7, 3, o);
            // しぶき
            r(0, 30 - c, 2, 2, l); r(1, 26 + c, 1, 1, w); r(33, 30 + c, 2, 2, l);
        }
    },
    // カネーズ: 吹雪の 流派。柱の氷の リーダー。白く すきとおる 古い 氷・つららの かんむり・長い ひげ・むらさきの マント・雪の つえ
    kanezu: {
        w: 40, h: 46,
        draw(r, f) {
            const o = '#1a1440', i = '#eef4ff', l = '#ffffff', d = '#b8c4ec', cape = '#3a2470', capeL = '#5a3aa0', gold = '#ffd84a';
            // マント (うしろ)
            r(4, 16, 32, 26, cape); r(2, 22, 3, 18, cape); r(35, 22, 3, 18, cape);
            r(5, 17, 2, 22, capeL); r(33, 17, 2, 22, capeL);
            // つえ (左手。先に 雪の 結晶が 光る)
            r(1, 8, 2, 36, '#8a6a40');
            r(-2 + 2, 5, 6, 1, '#bfe8ff'); r(1, 2, 2, 7, '#bfe8ff'); r(0, 3, 1, 1, '#bfe8ff'); r(3, 3, 1, 1, '#bfe8ff'); r(0, 7, 1, 1, '#bfe8ff'); r(3, 7, 1, 1, '#bfe8ff');
            if (f) r(1, 4, 2, 2, l);
            // つららの かんむり
            r(10, 3, 2, 6, '#bfe8ff'); r(14, 1, 2, 8, '#bfe8ff'); r(19, 0, 2, 9, '#dff4ff'); r(24, 1, 2, 8, '#bfe8ff'); r(28, 3, 2, 6, '#bfe8ff');
            r(9, 8, 22, 2, gold); r(19, 8, 2, 2, '#ff3a4a');
            // 体 (古い 氷。ひびが ある)
            r(8, 10, 24, 22, o); r(9, 11, 22, 20, i);
            r(10, 12, 6, 2, l); r(28, 12, 2, 18, d);
            r(25, 12, 1, 3, d); r(26, 15, 1, 2, d);
            // まゆ (ふさふさ)・目 (ほそく 光る)
            r(10, 15, 7, 2, l); r(23, 15, 7, 2, l); r(9, 16, 2, 2, l); r(29, 16, 2, 2, l);
            r(12, 18, 4, 1, o); r(24, 18, 4, 1, o);
            r(13, 18, 2, 1, f ? '#7ad8ff' : '#4ab0f0'); r(25, 18, 2, 1, f ? '#7ad8ff' : '#4ab0f0');
            // くちひげと 長い ひげ
            r(12, 21, 7, 2, l); r(21, 21, 7, 2, l);
            r(12, 23, 16, 5, l); r(13, 28, 14, 5, '#f4f8ff'); r(15, 33, 10, 4, l); r(17, 37, 6, 3, '#eef2ff'); r(19, 40, 2, 2, l);
            r(14, 25, 1, 6, d); r(20, 26, 1, 8, d); r(25, 25, 1, 5, d);
            // 足
            r(11, 42, 6, 3, o); r(23, 42, 6, 3, o);
            // ふぶき
            const k = f ? 2 : 0;
            r(34, 6 + k, 2, 2, l); r(37, 12 - k, 1, 1, l); r(33, 2 + k, 1, 1, l); r(6, 4 - k / 2, 1, 1, l);
        }
    },
    // アサタナ: 柱の氷の 下っ端 (2026-11-04 ユーザー指定)。小さい 灰色の 氷・ずきん・ぼろの やり
    asatana: {
        w: 26, h: 28,
        draw(r, f) {
            const o = '#1a2a3a', g = '#a8bccc', l = '#dce8f0', d = '#6a8298', h = '#3a4a5a';
            // やり
            r(23, 2 + f, 2, 24, '#6a4a2a'); r(22, 0 + f, 4, 3, '#c8d8e8');
            // ずきん
            r(6, 1, 12, 3, h); r(4, 3, 16, 5, h); r(5, 4, 6, 1, '#5a6a7a');
            // 体
            r(4, 7, 16, 16, o); r(5, 8, 14, 14, g);
            r(6, 9, 4, 2, l); r(17, 9, 1, 12, d); r(5, 20, 14, 2, d);
            // 目 (たよりない)・くち
            r(8, 12, 3, 3, '#10162a'); r(14, 12, 3, 3, '#10162a');
            r(9, 12, 1, 1, '#ffffff'); r(15, 12, 1, 1, '#ffffff');
            r(10, 18, 5, 1, o);
            // むねの 柱の しるし
            r(11, 20, 3, 1, '#ffffff');
            // うで・足
            r(20, 14 + f, 3, 2, g);
            r(7, 23, 4, 3, o); r(14, 23, 4, 3, o);
        }
    },
    // 金棒 (おにおにの 武器。レバー・役物の 絵に 使う)。たて向き
    kanabo: {
        w: 14, h: 48,
        draw(r) {
            const dark = '#2a2a34', body = '#5a5a6a', light = '#9a9aac', spike = '#d8d8e8', grip = '#8a2a1a';
            r(4, 0, 6, 2, dark); r(2, 2, 10, 30, dark); r(3, 2, 8, 30, body); r(4, 3, 2, 28, light);
            for (let y = 4; y < 31; y += 5) { r(0, y, 2, 2, spike); r(12, y + 2, 2, 2, spike); r(6, y + 1, 2, 2, spike); }
            r(4, 32, 6, 3, '#c8a040');
            r(5, 35, 4, 11, grip); r(5, 36, 4, 1, '#c84a2a'); r(5, 39, 4, 1, '#c84a2a'); r(5, 42, 4, 1, '#c84a2a');
            r(4, 46, 6, 2, '#c8a040');
        }
    },
    // ダケジャの 赤石 (ストーリーの 宝)
    akaishi: {
        w: 14, h: 14,
        draw(r, f) {
            r(4, 0, 6, 1, '#ff9a9a'); r(2, 1, 10, 2, '#ff4a4a'); r(1, 3, 12, 6, '#e01a2a'); r(2, 9, 10, 2, '#a00a1a'); r(4, 11, 6, 2, '#700010'); r(6, 13, 2, 1, '#500008');
            r(3, 2, 3, 2, '#ffd0d0'); r(4, 4, 2, 2, '#ff8a8a');
            if (f) { r(10, 3, 1, 1, '#ffffff'); r(9, 2, 1, 1, '#ffd0d0'); }
        }
    }
};

// ミニゲームの キャラの 絵 (2026-11-04 ユーザー指定): おかもぅ = やまもぅ・マッスルイケノーブル = マッスルウエノーブル
LEGACY_ART.okamou = LEGACY_ART.yamamou;
LEGACY_ART.ikenoble = LEGACY_ART.ueno;

const Art = (() => {
    const cache = new Map();
    // 1 枚の 絵を 小さな canvas に 描いて とっておく
    function sheet(id, frame) {
        const key = id + ':' + frame;
        if (cache.has(key)) return cache.get(key);
        const a = NEW_ART[id] || LEGACY_ART[id];
        if (!a || typeof document === 'undefined') return null;
        const c = document.createElement('canvas');
        c.width = a.w;
        c.height = a.h;
        const g = c.getContext('2d');
        if (a.draw) a.draw((x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); }, frame);
        else {
            a.rows.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) {
                    const color = a.palette[row[x]];
                    if (color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
                }
            });
        }
        cache.set(key, c);
        return c;
    }
    function has(id) { return Boolean(NEW_ART[id] || LEGACY_ART[id]); }
    function size(id) { const a = NEW_ART[id] || LEGACY_ART[id]; return a ? { w: a.w, h: a.h } : { w: 16, h: 16 }; }
    // 足もと まんなか (x, y)。height を わたすと その 高さに 合わせる
    function draw(ctx, id, x, y, opt = {}) {
        const a = NEW_ART[id] || LEGACY_ART[id];
        if (!a) return;
        const frame = a.draw ? (opt.frame || 0) % 2 : 0;
        const img = sheet(id, frame);
        if (!img) return;
        const scale = opt.height ? opt.height / a.h : (opt.scale || 1);
        const w = a.w * scale, h = a.h * scale;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
        ctx.translate(x, y);
        if (opt.rot) ctx.rotate(opt.rot);
        if (opt.flip) ctx.scale(-1, 1);
        // 動かない 絵 (前作の 絵) は ぴょこぴょこ させる
        const bob = !a.draw && opt.frame && opt.frame % 2 ? -scale : 0;
        if (opt.silhouette) {
            ctx.filter = 'brightness(0)';
        }
        ctx.drawImage(img, -w / 2, -h + bob, w, h);
        ctx.restore();
    }
    return { draw, has, size, clearCache: () => cache.clear() };
})();
