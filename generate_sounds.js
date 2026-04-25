const fs = require('fs');
const path = require('path');

function writeWav(filename, generateSamples, durationSec) {
    const sampleRate = 44100;
    const numSamples = sampleRate * durationSec;
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

console.log('Sounds generated successfully.');
