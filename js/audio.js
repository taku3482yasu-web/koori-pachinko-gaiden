// =====================================================================
// 効果音 (Web Audio で音を作る。音のファイルは使わない)
// ---------------------------------------------------------------------
// ブラウザは、画面を一度さわる・キーを押すまで音を出せないので、そのときに準備する (Sound.unlock)。
// Sound.play('button') などで鳴らす。Sound.muted で消音。
// =====================================================================

const Sound = (() => {
    let ctx = null;
    let muted = false;
    try { muted = localStorage.getItem('koori-pachinko-gaiden-muted') === '1'; } catch (e) { /* 保存できない環境 */ }

    let seOut = null, seLevel = 1;
    // 効果音の 音量 (0〜)。1 が ふつう
    function setVolume(level) {
        seLevel = level;
        if (seOut) seOut.gain.setTargetAtTime(level, ctx.currentTime, 0.02);
    }

    function unlock() {
        if (ctx) {
            if (ctx.state === 'suspended') ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
            ctx = new AC();
            // 効果音の 音量 (カスタマイズ「効果音の音量」2026-10-24)。効果音は みな ここを 通す
            seOut = ctx.createGain();
            seOut.gain.value = seLevel;
            seOut.connect(ctx.destination);
            loadVoice();
        }
    }

    // 前作の 録音 (js/sound-heso.js の HESO_SOUND) を 読みこむ。data: の URL なので、ファイルを 直接 開いても 読める
    let voiceBuffer = null;
    function loadVoice() {
        if (!ctx || typeof HESO_SOUND === 'undefined') return;
        const bin = atob(HESO_SOUND.split(',')[1]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        ctx.decodeAudioData(bytes.buffer).then(buf => { voiceBuffer = buf; }, () => { voiceBuffer = null; });
    }

    // 先バレ音 (2026-11-04 ユーザー指定: 前作の 先バレ音を 低く した もの)。前作と おなじ 録音の 長い ほう (1.3〜3.5 秒) を
    // 低く (rate 0.8) して、少し こもらせ、短い こだまを つける。録音が 読めない ときは 低い キュイン
    const VOICE = { start: 1.3, end: 3.5, gain: 4, rate: 0.8, lowpass: 2400, echo: 0.18, feedback: 0.3 };
    function senbareVoice() {
        if (!voiceBuffer) {
            tone(600, 0, 0.4, { slideTo: 2100, volume: 0.09, type: 'square' });
            tone(1200, 0.05, 0.35, { slideTo: 3000, volume: 0.04 });
            return;
        }
        const v = VOICE, t0 = ctx.currentTime;
        const out = ctx.createGain();
        out.gain.value = v.gain;
        out.connect(seOut);
        const muffle = ctx.createBiquadFilter();
        muffle.type = 'lowpass';
        muffle.frequency.value = v.lowpass;
        muffle.connect(out);
        const delay = ctx.createDelay(1), back = ctx.createGain();
        delay.delayTime.value = v.echo;
        back.gain.value = v.feedback;
        muffle.connect(delay);
        delay.connect(back).connect(delay);
        delay.connect(out);
        const src = ctx.createBufferSource();
        src.buffer = voiceBuffer;
        src.playbackRate.value = v.rate;
        src.connect(muffle);
        src.start(t0, v.start, v.end - v.start);
    }

    // 先咆哮 (2026-11-04 ユーザー指定: 動画の エヴァの 先咆哮の ような、おにおにが 叫ぶ 先バレ)。音は 自作:
    //   ドンッ (低い 一撃) → おにおにの 叫び (のこぎり波の うなりを ゆらし、ひずませ、ざらざらした 息を まぜる。高く なって 低く ぬける)
    //   → 叫びの あとに 高い 音 (約 4000Hz) が キーンと 残って 消える (動画の 音の 形を まねた)
    function senbareRoar() {
        const t0 = ctx.currentTime, len = 1.5;
        tone(70, 0, 0.5, { slideTo: 32, volume: 0.2, type: 'sine' });
        tone(140, 0, 0.18, { slideTo: 50, volume: 0.12, type: 'square' });
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, t0);
        out.gain.exponentialRampToValueAtTime(0.22, t0 + 0.1);
        out.gain.setValueAtTime(0.22, t0 + len * 0.6);
        out.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
        out.connect(seOut);
        // ひずみ
        const shaper = ctx.createWaveShaper();
        const curve = new Float32Array(1024);
        for (let i = 0; i < curve.length; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 4); }
        shaper.curve = curve;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.Q.value = 1.2;
        band.frequency.setValueAtTime(500, t0);
        band.frequency.exponentialRampToValueAtTime(1500, t0 + 0.35);
        band.frequency.exponentialRampToValueAtTime(600, t0 + len);
        shaper.connect(band).connect(out);
        // うなり (のどの ふるえ = 速い ゆれ)
        const vib = ctx.createOscillator(), vibDepth = ctx.createGain();
        vib.frequency.value = 11;
        vibDepth.gain.value = 14;
        vib.connect(vibDepth);
        for (const [f, vol] of [[110, 0.5], [165, 0.35], [113, 0.4]]) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(f, t0);
            o.frequency.exponentialRampToValueAtTime(f * 1.6, t0 + 0.35);
            o.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + len);
            vibDepth.connect(o.frequency);
            g.gain.value = vol;
            o.connect(g).connect(shaper);
            o.start(t0);
            o.stop(t0 + len + 0.05);
        }
        vib.start(t0);
        vib.stop(t0 + len + 0.05);
        // 息 (ざらざら)
        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        noise.buffer = buf;
        const ng = ctx.createGain();
        ng.gain.value = 0.35;
        noise.connect(ng).connect(band);
        noise.start(t0);
        // キーン (叫びの あと 残る 高い 音。少し ゆれる)
        const ring = ctx.createOscillator(), rg = ctx.createGain();
        ring.type = 'sine';
        ring.frequency.setValueAtTime(4000, t0 + 0.9);
        const trem = ctx.createOscillator(), tg = ctx.createGain();
        trem.frequency.value = 7;
        tg.gain.value = 18;
        trem.connect(tg).connect(ring.frequency);
        rg.gain.setValueAtTime(0.0001, t0 + 0.9);
        rg.gain.exponentialRampToValueAtTime(0.035, t0 + 1.1);
        rg.gain.setValueAtTime(0.035, t0 + 2.4);
        rg.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.6);
        ring.connect(rg).connect(seOut);
        [ring, trem].forEach(o => { o.start(t0 + 0.9); o.stop(t0 + 3.7); });
    }

    // 1つの音: 周波数 freq (Hz)、start 秒後から length 秒。slideTo で音の高さを変える
    function tone(freq, start, length, { type = 'square', volume = 0.08, slideTo = null } = {}) {
        const t0 = ctx.currentTime + start;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + length);
        gain.gain.setValueAtTime(volume, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
        osc.connect(gain).connect(seOut);
        osc.start(t0);
        osc.stop(t0 + length + 0.02);
    }

    // ぶるぶる の 機械音 (2026-11-03 ユーザー指定: レバブル・ボタン・ハンドルが 震える とき「ヴヴヴヴヴ…」)
    //   低い のこぎり波の うなりを、速い 波 (約 26 回 / 秒) で 大きく したり 小さく したりして モーターの ふるえに する
    function buzz(length = 1.3) {
        const t0 = ctx.currentTime;
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, t0);
        out.gain.exponentialRampToValueAtTime(0.16, t0 + 0.04);
        out.gain.setValueAtTime(0.16, t0 + length - 0.15);
        out.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
        const trem = ctx.createGain();
        trem.gain.value = 0.5;
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.type = 'square';
        lfo.frequency.value = 26;
        depth.gain.value = 0.5;
        lfo.connect(depth).connect(trem.gain);
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 900;
        for (const [freq, type, vol] of [[68, 'sawtooth', 1], [136, 'square', 0.35], [71, 'sawtooth', 0.6]]) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, t0);
            o.frequency.linearRampToValueAtTime(freq * 0.94, t0 + length);   // 少し ずつ 低く (モーターが へたる)
            g.gain.value = vol;
            o.connect(g).connect(filt);
            o.start(t0);
            o.stop(t0 + length + 0.05);
        }
        filt.connect(trem).connect(out).connect(seOut);
        lfo.start(t0);
        lfo.stop(t0 + length + 0.05);
    }

    const SOUNDS = {
        buzz: () => buzz(1.3),
        buzzShort: () => buzz(0.7),
        stop: () => tone(660, 0, 0.06, { volume: 0.05 }),
        hold: () => tone(1046, 0, 0.05, { volume: 0.04, type: 'triangle' }),
        // 台のボタンの高い音 (先読み)
        button: () => { tone(2637, 0, 0.12, { volume: 0.07 }); tone(3136, 0.14, 0.18, { volume: 0.07 }); tone(3520, 0.34, 0.3, { volume: 0.07 }); },
        challenge: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.12, { volume: 0.06 })),
        success: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.18, { volume: 0.07 })),
        fail: () => tone(330, 0, 0.5, { slideTo: 110, volume: 0.06, type: 'sawtooth' }),
        reach: () => { tone(880, 0, 0.15); tone(880, 0.2, 0.15); tone(1175, 0.4, 0.4); },
        attack: () => tone(220, 0, 0.15, { slideTo: 880, volume: 0.06, type: 'sawtooth' }),
        hurt: () => tone(160, 0, 0.2, { slideTo: 60, volume: 0.08, type: 'square' }),
        push: () => tone(1568, 0, 0.1, { volume: 0.06 }),
        // レバーを引け！ (2026-10-24): PUSH！ から 変わる ガコッ / レバーを 引いた ズドン
        lever: () => { tone(110, 0, 0.12, { volume: 0.12, type: 'square' }); tone(1760, 0.08, 0.25, { volume: 0.07, slideTo: 2637 }); },
        pull: () => { tone(90, 0, 0.35, { slideTo: 40, volume: 0.14, type: 'sawtooth' }); tone(880, 0.05, 0.3, { slideTo: 1760, volume: 0.07 }); },
        // レバーを 引いている あいだの カチッ (2026-10-24)
        leverTick: () => { tone(1400, 0, 0.03, { volume: 0.06, type: 'square' }); tone(180, 0, 0.05, { volume: 0.08, type: 'triangle' }); },
        // 当たりの 役物 (2026-10-24 ユーザー指定: 音楽と ともに 変形し、変形後に ファンファーレ)
        //   yakuMusic: 約 3.3 秒。ベースが 刻み、上がっていく アルペジオで 盛り上げる / fanfare: 金管の ような 和音
        yakuMusic: () => {
            const beat = 0.21;
            for (let i = 0; i < 16; i++) {
                tone(i % 4 === 0 ? 65 : 98, i * beat, 0.16, { volume: 0.1, type: 'triangle' });
                if (i % 2 === 1) tone(5200, i * beat, 0.03, { volume: 0.02, type: 'square' });
            }
            const notes = [523, 659, 784, 659, 587, 740, 880, 740, 659, 831, 988, 831, 784, 988, 1175, 1568];
            notes.forEach((f, i) => tone(f, i * beat + 0.02, beat * 0.9, { volume: 0.05, type: 'square' }));
            tone(392, 2.52, 0.8, { volume: 0.05, type: 'sawtooth', slideTo: 1568 });
        },
        fanfare: () => {
            [[523, 659, 784], [587, 740, 880], [698, 880, 1047], [784, 988, 1175, 1568]].forEach((chord, i) => {
                const len = i === 3 ? 1.4 : 0.16;
                chord.forEach(f => { tone(f, i * 0.17, len, { volume: 0.05, type: 'sawtooth' }); tone(f * 2, i * 0.17, len, { volume: 0.02, type: 'square' }); });
            });
            tone(1047, 0.51, 1.4, { volume: 0.04, type: 'triangle' });
        },
        // 1・3・5 の ひび割れ (2026-10-24): ピキッ / バリィン / おにおに・怪の 咆哮
        crack: () => { tone(2400, 0, 0.05, { volume: 0.08, type: 'square' }); tone(1800, 0.07, 0.05, { volume: 0.07, type: 'square' }); tone(3000, 0.16, 0.08, { volume: 0.08, type: 'square', slideTo: 900 }); },
        smash: () => { for (let i = 0; i < 8; i++) tone(1500 + i * 420, i * 0.03, 0.12, { volume: 0.05, type: 'square', slideTo: 300 }); tone(80, 0, 0.5, { volume: 0.14, type: 'sawtooth', slideTo: 40 }); },
        roar: () => { tone(70, 0, 1.4, { volume: 0.16, type: 'sawtooth', slideTo: 45 }); tone(105, 0.05, 1.3, { volume: 0.12, type: 'sawtooth', slideTo: 60 }); tone(140, 0.1, 1.1, { volume: 0.08, type: 'square', slideTo: 70 }); },
        win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.2, { volume: 0.08 })),
        lose: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.18, 0.25, { volume: 0.06, type: 'triangle' })),
        v: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.06, 0.15, { volume: 0.07 })),
        round: () => tone(988, 0, 0.12, { volume: 0.05 }),
        // 外伝の 音 (2026-11-03)
        cutin: () => { tone(220, 0, 0.25, { slideTo: 1760, volume: 0.07, type: 'sawtooth' }); tone(2637, 0.22, 0.2, { volume: 0.05 }); },
        chance: () => [784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.05, 0.2, { volume: 0.06, type: 'square' })),
        clash: () => { tone(120, 0, 0.12, { slideTo: 50, volume: 0.12, type: 'square' }); tone(3200, 0, 0.05, { volume: 0.04, type: 'square' }); },
        gekiha: () => { tone(80, 0, 0.6, { volume: 0.16, type: 'sawtooth', slideTo: 30 }); [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.12 + i * 0.07, 0.3, { volume: 0.06 })); },
        fall: () => { tone(440, 0, 1.2, { slideTo: 55, volume: 0.09, type: 'sawtooth' }); [392, 311, 262, 196].forEach((f, i) => tone(f, 0.4 + i * 0.25, 0.3, { volume: 0.06, type: 'triangle' })); },
        gun: () => { for (let i = 0; i < 12; i++) tone(200 + i * 60, i * 0.08, 0.12, { volume: 0.04, type: 'sawtooth' }); },
        stIn: () => { tone(60, 0, 1.0, { volume: 0.15, type: 'sawtooth', slideTo: 120 }); [587, 698, 880, 1175].forEach((f, i) => tone(f, 0.3 + i * 0.12, 0.3, { volume: 0.07, type: 'square' })); },
        count: () => tone(1760, 0, 0.04, { volume: 0.03 }),
        // 先バレ (前作の 音を 低く した もの / おにおにの 先咆哮) と 一発告知 (ズキューン)
        senbareVoice,
        senbareRoar,
        ippatsu: () => { tone(4000, 0, 0.5, { slideTo: 600, volume: 0.09, type: 'sawtooth' }); tone(80, 0, 0.6, { volume: 0.15, type: 'square', slideTo: 40 }); [1568, 2093, 2637].forEach((f, i) => tone(f, 0.45 + i * 0.08, 0.4, { volume: 0.07 })); },
        payout: () => tone(2637, 0, 0.03, { volume: 0.015, type: 'triangle' })
    };

    // 違和感演出の「音が 消える」(P4): しばらく 効果音を 鳴らさない
    let hushUntil = 0;
    const hushed = () => typeof performance !== 'undefined' && performance.now() < hushUntil;
    function hush(ms) {
        hushUntil = performance.now() + ms;
    }

    function play(name) {
        if (muted || hushed() || !ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
        SOUNDS[name]();
    }

    function setMuted(value) {
        muted = value;
        try { localStorage.setItem('koori-pachinko-gaiden-muted', value ? '1' : '0'); } catch (e) { /* 無視 */ }
    }

    return { unlock, play, setMuted, setVolume, hush, get hushed() { return hushed(); }, get muted() { return muted; }, get context() { return ctx; } };
})();
