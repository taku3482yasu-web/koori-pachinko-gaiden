// =====================================================================
// BGM (Web Audio で 鳴らす チップチューン。前作 koori-pachinko の js/bgm.js と 同じ 作りで、曲は 外伝の ために 作った)
// ---------------------------------------------------------------------
// 曲は 8分音符 単位の 音名の 並び。'.' は 休符。メロディ (矩形波) と ベース (三角波)。
// 通常時 (さがす 旅)・柱の氷の アジト・ST おにおにの挑戦 (はげしい)・バトル・時短 (いそぐ)・大当たり (ファンファーレ)
// 先の 音を 少しずつ 予約して 鳴らすので、描画が 重くても テンポが ずれにくい
// =====================================================================

const BGM_TRACKS = {
    // 通常時: こおりくんを さがす 旅 (すこし さびしい 行進)
    normal: {
        bpm: 128,
        melody: [
            'A4', 'C5', 'E5', 'A5', 'G5', 'E5', 'D5', '.',
            'C5', 'D5', 'E5', 'G5', 'E5', '.', '.', '.',
            'F5', 'E5', 'D5', 'C5', 'D5', 'E5', 'A4', '.',
            'B4', 'C5', 'D5', 'B4', 'A4', '.', '.', '.'
        ],
        bass: [
            'A2', '.', 'E3', '.', 'A2', '.', 'E3', '.',
            'C3', '.', 'G3', '.', 'C3', '.', 'G3', '.',
            'F2', '.', 'C3', '.', 'D3', '.', 'A2', '.',
            'E2', '.', 'B2', '.', 'A2', '.', 'E2', '.'
        ]
    },
    // 柱の氷の アジト: ふぶきの 中の 不穏な 曲
    hideout: {
        bpm: 112,
        melody: [
            'E5', '.', 'F5', '.', 'E5', '.', 'B4', '.',
            'C5', '.', 'B4', '.', 'A4', '.', '.', '.',
            'E5', '.', 'F5', '.', 'G5', '.', 'F5', 'E5',
            'D#5', '.', '.', '.', 'E5', '.', '.', '.'
        ],
        bass: [
            'E2', 'E2', 'E2', 'E2', 'F2', 'F2', 'F2', 'F2',
            'E2', 'E2', 'E2', 'E2', 'A2', 'A2', 'A2', 'A2',
            'E2', 'E2', 'E2', 'E2', 'F2', 'F2', 'G2', 'G2',
            'B2', 'B2', 'B2', 'B2', 'E2', 'E2', 'E2', 'E2'
        ]
    },
    // ST おにおにの挑戦: はやくて あつい 曲
    st: {
        bpm: 176,
        melody: [
            'D5', 'D5', 'F5', 'D5', 'G5', 'F5', 'D5', 'C5',
            'D5', '.', 'A5', '.', 'G5', 'F5', 'G5', '.',
            'D5', 'D5', 'F5', 'D5', 'A5', 'G5', 'F5', 'G5',
            'A5', 'C6', 'A5', 'G5', 'F5', 'E5', 'D5', '.'
        ],
        bass: [
            'D3', 'D3', 'D4', 'D3', 'D3', 'D4', 'D3', 'D4',
            'A#2', 'A#2', 'A#3', 'A#2', 'C3', 'C3', 'C4', 'C3',
            'D3', 'D3', 'D4', 'D3', 'D3', 'D4', 'D3', 'D4',
            'A#2', 'A#3', 'C3', 'C4', 'A2', 'A3', 'D3', 'D3'
        ]
    },
    // バトル (ST の 当たり・転落の 変動・柱の氷リーチ)
    battle: {
        bpm: 160,
        melody: [
            'E5', 'G5', 'B5', 'E6', 'D6', 'B5', 'G5', 'A5',
            'B5', '.', 'B5', '.', 'C6', 'B5', 'A5', 'G5',
            'E5', 'G5', 'B5', 'E6', 'F#6', 'E6', 'D6', 'E6',
            'B5', '.', 'G5', '.', 'E5', '.', 'E5', '.'
        ],
        bass: [
            'E2', 'E3', 'E2', 'E3', 'E2', 'E3', 'E2', 'E3',
            'C3', 'C4', 'C3', 'C4', 'D3', 'D4', 'D3', 'D4',
            'E2', 'E3', 'E2', 'E3', 'E2', 'E3', 'E2', 'E3',
            'C3', 'C4', 'D3', 'D4', 'E3', 'E2', 'E3', 'E2'
        ]
    },
    // 柱の氷RASH: つめたく はやい 曲
    hashira: {
        bpm: 168,
        melody: [
            'B4', 'D5', 'F#5', 'B5', 'A5', 'F#5', 'D5', 'E5',
            'F#5', '.', 'F#5', 'G5', 'F#5', 'E5', 'D5', '.',
            'B4', 'D5', 'F#5', 'B5', 'C#6', 'B5', 'A5', 'B5',
            'F#5', 'E5', 'D5', 'C#5', 'B4', '.', 'B4', '.'
        ],
        bass: [
            'B2', 'B3', 'B2', 'B3', 'G2', 'G3', 'G2', 'G3',
            'D3', 'D4', 'D3', 'D4', 'A2', 'A3', 'A2', 'A3',
            'B2', 'B3', 'B2', 'B3', 'G2', 'G3', 'G2', 'G3',
            'F#2', 'F#3', 'F#2', 'F#3', 'B2', 'B3', 'B2', 'B2'
        ]
    },
    // 時短: いそげ！
    jitan: {
        bpm: 150,
        melody: [
            'G5', 'A5', 'B5', 'D6', 'B5', 'A5', 'G5', '.',
            'E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'E5', '.',
            'G5', 'A5', 'B5', 'D6', 'E6', 'D6', 'B5', 'D6',
            'A5', '.', 'B5', '.', 'G5', '.', '.', '.'
        ],
        bass: [
            'G2', 'D3', 'G2', 'D3', 'G2', 'D3', 'G2', 'D3',
            'E2', 'B2', 'E2', 'B2', 'C3', 'G3', 'C3', 'G3',
            'G2', 'D3', 'G2', 'D3', 'C3', 'G3', 'C3', 'G3',
            'D3', 'A3', 'D3', 'A3', 'G2', 'D3', 'G2', '.'
        ]
    },
    // 大当たり中: こおりくんを とりもどす ファンファーレ
    bonus: {
        bpm: 144,
        melody: [
            'C5', 'E5', 'G5', 'C6', '.', 'G5', 'C6', 'E6',
            'D6', '.', 'C6', 'B5', 'A5', 'B5', 'C6', '.',
            'F5', 'A5', 'C6', 'F6', '.', 'E6', 'D6', 'C6',
            'B5', 'C6', 'D6', 'G5', 'C6', '.', '.', '.'
        ],
        bass: [
            'C3', 'G3', 'C3', 'G3', 'C3', 'G3', 'C3', 'G3',
            'G2', 'D3', 'G2', 'D3', 'A2', 'E3', 'A2', 'E3',
            'F2', 'C3', 'F2', 'C3', 'F2', 'C3', 'F2', 'C3',
            'G2', 'D3', 'G2', 'D3', 'C3', 'G3', 'C3', '.'
        ]
    }
};

const Bgm = (() => {
    const LOOKAHEAD = 0.15;
    const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    let ctx = null, master = null, trackName = null, step = 0, nextTime = 0, volume = 0.5, paused = true;

    // 台の 状態から 曲を 決める
    function trackFor(m) {
        if (m.bonus) return 'bonus';
        const p = m.spin && m.spin.plan;
        if (p && (p.kind === 'battle' || (p.kind === 'hashira' && p.sub === 'battle') || (p.kind === 'normal' && p.enemy && p.enemy !== 'rival' && m.spin.elapsed > 3))) return 'battle';
        if (m.mode === 'st') return 'st';
        if (m.mode === 'hst') return 'hashira';
        if (m.mode === 'jitan' || m.mode === 'jitanLast') return 'jitan';
        if (m.story >= 4) return 'hideout';
        return 'normal';
    }

    function frequency(note) {
        const match = /^([A-G]#?)(\d)$/.exec(note);
        const midi = (Number(match[2]) + 1) * 12 + NOTE_INDEX[match[1]];
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
    function applyVolume() {
        if (master) master.gain.setTargetAtTime(paused ? 0 : volume * 0.12, ctx.currentTime, 0.02);
    }
    function init(audioContext) {
        if (ctx || !audioContext) return;
        ctx = audioContext;
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        applyVolume();
        setInterval(schedule, 25);
    }
    function note(freq, type, time, duration, level) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(level, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(time);
        osc.stop(time + duration + 0.02);
    }
    function schedule() {
        if (!ctx || !trackName || paused || ctx.state !== 'running') return;
        const track = BGM_TRACKS[trackName];
        const stepDur = 60 / track.bpm / 2;
        if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
        while (nextTime < ctx.currentTime + LOOKAHEAD) {
            const m = track.melody[step % track.melody.length];
            const b = track.bass[step % track.bass.length];
            if (m !== '.') note(frequency(m), 'square', nextTime, stepDur * 0.9, 0.35);
            if (b !== '.') note(frequency(b), 'triangle', nextTime, stepDur * 0.95, 0.8);
            nextTime += stepDur;
            step++;
        }
    }
    function play(name) {
        if (trackName === name) return;
        trackName = name;
        step = 0;
        if (ctx) nextTime = ctx.currentTime + 0.1;
    }
    function setPaused(on) {
        if (paused === on) return;
        paused = on;
        if (!on && ctx) nextTime = ctx.currentTime + 0.1;
        applyVolume();
    }
    function setVolume(level) { volume = 0.5 * level; applyVolume(); }

    return { init, play, setPaused, setVolume, trackFor, get track() { return trackName; } };
})();
if (typeof module !== 'undefined') module.exports = { Bgm, BGM_TRACKS };
