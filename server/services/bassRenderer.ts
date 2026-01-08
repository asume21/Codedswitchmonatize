import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

export interface BassNote {
  note: string;
  octave: number;
  start: number; // seconds
  duration: number; // seconds
  velocity: number; // 0-127
  glide?: number;
}

const SAMPLE_RATE = 44100;
const TWO_PI = Math.PI * 2;

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

function noteToFrequency(note: string, octave: number) {
  const semitone = NOTE_TO_SEMITONE[note] ?? 0;
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function writeWav(samples: Float32Array): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (SAMPLE_RATE * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2; // 16-bit
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(s * 32767), 44 + i * 2);
  }

  return buffer;
}

export async function renderBassToWav(bassNotes: BassNote[], uploadsDir: string) {
  const totalDuration = bassNotes.reduce(
    (max, n) => Math.max(max, n.start + n.duration),
    0
  );
  const totalSamples = Math.ceil(totalDuration * SAMPLE_RATE) + SAMPLE_RATE; // pad 1s
  const buffer = new Float32Array(totalSamples);

  const attack = 0.01;
  const release = 0.08;

  for (const n of bassNotes) {
    const freq = noteToFrequency(n.note, n.octave);
    const amp = (n.velocity ?? 90) / 127;
    const startSample = Math.floor(n.start * SAMPLE_RATE);
    const noteSamples = Math.floor(n.duration * SAMPLE_RATE);

    for (let i = 0; i < noteSamples; i++) {
      const t = i / SAMPLE_RATE;
      const envAttack = Math.min(1, t / attack);
      const envRelease = Math.min(1, (n.duration - t) / release);
      const env = Math.max(0, Math.min(envAttack, envRelease));
      const sample = Math.sin(TWO_PI * freq * t) * amp * env * 0.6;
      const idx = startSample + i;
      if (idx < buffer.length) buffer[idx] += sample;
    }
  }

  // simple limiter
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    peak = Math.max(peak, Math.abs(buffer[i]));
  }
  if (peak > 0.99) {
    const gain = 0.99 / peak;
    for (let i = 0; i < buffer.length; i++) buffer[i] *= gain;
  }

  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `bass-${Date.now()}-${nanoid(6)}.wav`;
  const fullPath = path.join(uploadsDir, filename);
  const wav = writeWav(buffer);
  await fs.writeFile(fullPath, wav);

  return {
    filePath: fullPath,
    fileName: filename,
    duration: totalDuration,
  };
}
