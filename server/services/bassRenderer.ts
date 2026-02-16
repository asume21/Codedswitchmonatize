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

export interface BassRenderOptions {
  style?: string;
  quality?: 'basic' | 'high';
}

export interface BassRenderInfo {
  mode: 'midi-synthesis';
  quality: 'basic' | 'enhanced';
  processingChain: string[];
  warning?: string;
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

function onePoleLowPass(input: Float32Array, cutoffHz: number): Float32Array {
  const output = new Float32Array(input.length);
  const dt = 1 / SAMPLE_RATE;
  const rc = 1 / (TWO_PI * Math.max(10, cutoffHz));
  const alpha = dt / (rc + dt);
  let y = 0;
  for (let i = 0; i < input.length; i++) {
    y = y + alpha * (input[i] - y);
    output[i] = y;
  }
  return output;
}

function onePoleHighPass(input: Float32Array, cutoffHz: number): Float32Array {
  const output = new Float32Array(input.length);
  const dt = 1 / SAMPLE_RATE;
  const rc = 1 / (TWO_PI * Math.max(10, cutoffHz));
  const alpha = rc / (rc + dt);
  let prevInput = 0;
  let prevOutput = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = alpha * (prevOutput + x - prevInput);
    output[i] = y;
    prevInput = x;
    prevOutput = y;
  }
  return output;
}

function applySoftSaturation(input: Float32Array, drive = 1.2): Float32Array {
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    output[i] = Math.tanh(input[i] * drive);
  }
  return output;
}

function applySimpleCompressor(input: Float32Array, threshold = 0.55, ratio = 3, attackMs = 8, releaseMs = 120): Float32Array {
  const output = new Float32Array(input.length);
  const attackCoeff = Math.exp(-1 / (Math.max(1, attackMs) * 0.001 * SAMPLE_RATE));
  const releaseCoeff = Math.exp(-1 / (Math.max(1, releaseMs) * 0.001 * SAMPLE_RATE));
  let env = 0;

  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const level = Math.abs(x);
    env = level > env
      ? attackCoeff * env + (1 - attackCoeff) * level
      : releaseCoeff * env + (1 - releaseCoeff) * level;

    let gain = 1;
    if (env > threshold) {
      const over = env / threshold;
      const compressed = Math.pow(over, 1 / ratio);
      gain = compressed > 0 ? 1 / compressed : 1;
    }

    output[i] = x * gain;
  }

  return output;
}

function applyLimiterInPlace(buffer: Float32Array, ceiling = 0.95) {
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    peak = Math.max(peak, Math.abs(buffer[i]));
  }
  if (peak > ceiling) {
    const gain = ceiling / peak;
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] *= gain;
    }
  }
}

export async function renderBassToWav(bassNotes: BassNote[], uploadsDir: string, options: BassRenderOptions = {}) {
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

  const processingChain: string[] = [];
  let warning: string | undefined;

  // Quality chain for less "MIDI-ish" tone
  const highQualityRequested = options.quality !== 'basic';
  if (highQualityRequested) {
    let processed = onePoleHighPass(buffer, 28);
    processingChain.push('high-pass@28Hz');

    processed = onePoleLowPass(processed, 3200);
    processingChain.push('low-pass@3.2kHz');

    processed = applySoftSaturation(processed, 1.25);
    processingChain.push('soft-saturation');

    processed = applySimpleCompressor(processed, 0.52, 3.2, 8, 110);
    processingChain.push('compressor(3.2:1)');

    buffer.set(processed);
  } else {
    warning = 'Using basic MIDI render chain';
  }

  applyLimiterInPlace(buffer, 0.95);
  processingChain.push('limiter@-0.45dBFS');

  if (bassNotes.length < 4 && !warning) {
    warning = 'Very short note sequence may still sound synthetic';
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
    renderInfo: {
      mode: 'midi-synthesis' as const,
      quality: highQualityRequested ? 'enhanced' as const : 'basic' as const,
      processingChain,
      warning,
    },
  };
}
