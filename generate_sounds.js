const fs = require('fs');
const path = require('path');

function writeWav(filename, generateSamples, durationSec, sampleRate = 44100) {
    const numSamples = Math.round(sampleRate * durationSec);
    const buffer = Buffer.alloc(44 + numSamples * 2);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVE', 8);

    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); 
    buffer.writeUInt16LE(1, 20); 
    buffer.writeUInt16LE(1, 22); 
    buffer.writeUInt32LE(sampleRate, 24); 
    buffer.writeUInt32LE(sampleRate * 2, 28); 
    buffer.writeUInt16LE(2, 32); 
    buffer.writeUInt16LE(16, 34); 

    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);

    for (let i = 0; i < numSamples; i++) {
        const sample = generateSamples(i, sampleRate, numSamples);
        const val = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
        buffer.writeInt16LE(val, 44 + i * 2);
    }

    fs.writeFileSync(filename, buffer);
}

const dir = 'android/app/src/main/res/raw';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

writeWav(path.join(dir, 'shoot.wav'), (i, sr) => {
    const t = i / sr;
    const freq = 1000 * Math.exp(-t * 20); 
    const vol = Math.max(0, 1 - t * 5); 
    return (Math.sin(2 * Math.PI * freq * t) > 0 ? 0.3 : -0.3) * vol;
}, 0.2);

writeWav(path.join(dir, 'hit.wav'), (i, sr) => {
    const t = i / sr;
    const vol = Math.max(0, 1 - t * 10); 
    return (Math.random() - 0.5) * vol;
}, 0.1);

writeWav(path.join(dir, 'destroy.wav'), (i, sr) => {
    const t = i / sr;
    const vol = Math.max(0, 1 - t * 2); 
    const sweep = 200 * Math.exp(-t * 5);
    const wave = Math.sin(2 * Math.PI * sweep * t);
    const noise = (Math.random() - 0.5) * 0.5;
    return (wave + noise) * vol;
}, 0.5);


// ---------------------------------------------------------------------------
// Extra effects
// ---------------------------------------------------------------------------

// Player taking a hit: low thud with a crunchy noise burst
writeWav(path.join(dir, 'hurt.wav'), (i, sr) => {
    const t = i / sr;
    const vol = Math.max(0, 1 - t * 4);
    const thud = Math.sin(2 * Math.PI * (140 * Math.exp(-t * 6)) * t);
    return (thud * 0.8 + (Math.random() - 0.5) * 0.6 * Math.exp(-t * 14)) * vol * 0.9;
}, 0.28);

// Medic kit: bright two-note rising chime
writeWav(path.join(dir, 'pickup.wav'), (i, sr) => {
    const t = i / sr;
    const f = t < 0.1 ? 660 : 990;
    const local = t < 0.1 ? t : t - 0.1;
    const vol = Math.exp(-local * 9);
    return (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t)) * vol * 0.35;
}, 0.45);

// Boss warning: two siren sweeps
writeWav(path.join(dir, 'warning.wav'), (i, sr) => {
    const t = i / sr;
    const cycle = (t % 0.5) / 0.5;
    const f = 420 + 380 * Math.sin(Math.PI * cycle);
    const fade = Math.min(1, t * 20) * Math.min(1, (1.4 - t) * 8);
    const phase = 2 * Math.PI * f * t;
    return (Math.sin(phase) * 0.5 + (Math.sin(phase) > 0 ? 0.12 : -0.12)) * fade * 0.7;
}, 1.4);

// Level cleared: rising major arpeggio
writeWav(path.join(dir, 'win.wav'), (i, sr) => {
    const t = i / sr;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    let v = 0;
    notes.forEach((f, n) => {
        const lt = t - n * 0.13;
        if (lt < 0) return;
        const hold = n === notes.length - 1 ? 3.5 : 7;
        v += (Math.sin(2 * Math.PI * f * lt) * 0.6 + Math.sin(2 * Math.PI * f * 2 * lt) * 0.15) * Math.exp(-lt * hold);
    });
    return v * 0.4;
}, 1.4);

// Mission failed: slow falling minor figure
writeWav(path.join(dir, 'lose.wav'), (i, sr) => {
    const t = i / sr;
    const notes = [392.0, 311.13, 261.63, 196.0];
    let v = 0;
    notes.forEach((f, n) => {
        const lt = t - n * 0.22;
        if (lt < 0) return;
        const saw = 2 * ((f * lt) % 1) - 1;
        v += (saw * 0.35 + Math.sin(2 * Math.PI * f * lt) * 0.4) * Math.exp(-lt * 4);
    });
    return v * 0.4;
}, 1.6);

// ---------------------------------------------------------------------------
// Music: tiny step sequencer. Everything is mixed into a ring buffer, so the
// tail of the last notes wraps to the start and the loop is seamless.
// ---------------------------------------------------------------------------
const MUSIC_RATE = 22050;
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

function renderMusic(bpm, bars, build) {
    const beat = 60 / bpm;
    const total = Math.round(beat * 4 * bars * MUSIC_RATE);
    const buf = new Float32Array(total);
    // voice(startBeat, durBeats, hz, wave, gain, release)
    const add = (startBeat, durBeats, hz, wave, gain, rel = 0.12) => {
        const start = Math.round(startBeat * beat * MUSIC_RATE);
        const len = Math.round((durBeats * beat + rel) * MUSIC_RATE);
        const hold = durBeats * beat;
        for (let n = 0; n < len; n++) {
            const t = n / MUSIC_RATE;
            const atk = Math.min(1, t / 0.006);
            const env = t < hold ? 1 : Math.max(0, 1 - (t - hold) / rel);
            const ph = (hz * t) % 1;
            let w;
            if (wave === 'square') w = ph < 0.5 ? 1 : -1;
            else if (wave === 'saw') w = 2 * ph - 1;
            else if (wave === 'tri') w = 4 * Math.abs(ph - 0.5) - 1;
            else w = Math.sin(2 * Math.PI * ph);
            buf[(start + n) % total] += w * gain * atk * env;
        }
    };
    const noise = (startBeat, lenSec, gain, hp) => {
        const start = Math.round(startBeat * beat * MUSIC_RATE);
        const len = Math.round(lenSec * MUSIC_RATE);
        let prev = 0;
        for (let n = 0; n < len; n++) {
            const x = Math.random() * 2 - 1;
            const y = hp ? x - prev : x; // crude high-pass for hats
            prev = x;
            buf[(start + n) % total] += y * gain * Math.exp(-n / (len * 0.28));
        }
    };
    const kick = (startBeat, gain) => {
        const start = Math.round(startBeat * beat * MUSIC_RATE);
        const len = Math.round(0.22 * MUSIC_RATE);
        let ph = 0;
        for (let n = 0; n < len; n++) {
            const t = n / MUSIC_RATE;
            ph += (50 + 110 * Math.exp(-t * 28)) / MUSIC_RATE;
            buf[(start + n) % total] += Math.sin(2 * Math.PI * ph) * gain * Math.exp(-t * 11);
        }
    };
    build({ add, noise, kick, bars });
    let peak = 0;
    for (let n = 0; n < total; n++) peak = Math.max(peak, Math.abs(buf[n]));
    const norm = 0.85 / (peak || 1);
    return { samples: buf, norm, total };
}

function writeMusic(name, bpm, bars, build) {
    const { samples, norm, total } = renderMusic(bpm, bars, build);
    writeWav(path.join(dir, name), i => samples[i] * norm, total / MUSIC_RATE, MUSIC_RATE);
}

const chordsOf = (roots, minor) => roots.map((r, i) => ({ root: r, third: r + (minor[i] ? 3 : 4), fifth: r + 7 }));

// Battle: driving 4-on-the-floor with a bass pulse and a 16th arpeggio (Am F C G)
writeMusic('music_battle.wav', 140, 8, ({ add, noise, kick }) => {
    const roots = [57, 53, 60, 55]; // A3 F3 C4 G3
    const chords = chordsOf(roots, [true, false, false, false]);
    for (let bar = 0; bar < 8; bar++) {
        const c = chords[Math.floor(bar / 2)];
        const b0 = bar * 4;
        for (let b = 0; b < 4; b++) {
            kick(b0 + b, 0.9);
            if (b % 2 === 1) noise(b0 + b, 0.14, 0.32, false);
            noise(b0 + b + 0.5, 0.05, 0.12, true);
        }
        for (let e = 0; e < 8; e++) add(b0 + e * 0.5, 0.45, midiHz(c.root - 12 + (e % 4 === 3 ? 12 : 0)), 'saw', 0.22, 0.05);
        const arp = [c.root + 12, c.third + 12, c.fifth + 12, c.third + 12];
        for (let s = 0; s < 16; s++) add(b0 + s * 0.25, 0.2, midiHz(arp[s % 4] + (s % 8 >= 4 ? 12 : 0)), 'square', 0.07, 0.05);
        if (bar % 2 === 0) add(b0, 4, midiHz(c.root + 24), 'tri', 0.1, 0.3);
    }
});

// Boss: faster and darker with a heavier pulse (Dm Bb Gm A)
writeMusic('music_boss.wav', 156, 8, ({ add, noise, kick }) => {
    const roots = [50, 46, 43, 45]; // D3 Bb2 G2 A2
    const chords = chordsOf(roots, [true, false, true, false]);
    for (let bar = 0; bar < 8; bar++) {
        const c = chords[Math.floor(bar / 2)];
        const b0 = bar * 4;
        for (let b = 0; b < 4; b++) {
            kick(b0 + b, 1.0);
            if (b % 2 === 1) noise(b0 + b, 0.16, 0.4, false);
            noise(b0 + b + 0.5, 0.05, 0.14, true);
            kick(b0 + b + 0.75, 0.45);
        }
        for (let e = 0; e < 16; e++) add(b0 + e * 0.25, 0.22, midiHz(c.root - 12), 'saw', 0.2, 0.04);
        const stab = [c.root + 12, c.third + 12, c.fifth + 12, c.root + 24];
        for (let s = 0; s < 8; s++) add(b0 + s * 0.5, 0.3, midiHz(stab[s % 4]), 'square', 0.09, 0.05);
        add(b0, 2, midiHz(c.root + 24), 'saw', 0.07, 0.2);
        add(b0 + 2, 2, midiHz(c.fifth + 24), 'saw', 0.07, 0.2);
    }
});

// Menu: slow, airy pad with a bell-like arpeggio (C G Am F)
writeMusic('music_menu.wav', 88, 8, ({ add }) => {
    const roots = [48, 55, 57, 53];
    const chords = chordsOf(roots, [false, false, true, false]);
    for (let bar = 0; bar < 8; bar++) {
        const c = chords[Math.floor(bar / 2)];
        const b0 = bar * 4;
        [c.root, c.third, c.fifth].forEach(n => {
            add(b0, 4, midiHz(n), 'sine', 0.22, 0.6);
            add(b0, 4, midiHz(n) * 1.004, 'tri', 0.07, 0.6);
        });
        add(b0, 4, midiHz(c.root - 12), 'sine', 0.3, 0.5);
        const arp = [c.root + 24, c.fifth + 12, c.third + 24, c.fifth + 24];
        for (let s = 0; s < 8; s++) {
            const n = arp[(s * 3) % 4];
            add(b0 + s * 0.5, 0.45, midiHz(n), 'sine', 0.12, 0.5);
            add(b0 + s * 0.5, 0.2, midiHz(n) * 2, 'sine', 0.03, 0.4);
        }
    }
});

console.log('Sounds generated successfully.');
