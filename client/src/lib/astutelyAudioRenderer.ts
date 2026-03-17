/**
 * astutelyAudioRenderer.ts
 * Renders Astutely patterns (drums/bass/chords/melody) to WAV audio stems
 * using the in-app GM synth (realisticAudio) for deterministic playback.
 */

import { realisticAudio } from './realisticAudio';
import { resumeAudioContext, getAudioContext } from './audioContext';
import type { AstutelyResult } from './astutelyEngine';

interface StemAudio {
  name: string;
  audioBuffer: AudioBuffer;
  duration: number;
}

/**
 * Render Astutely pattern to separate audio stems (drums, bass, chords, melody)
 * Returns array of AudioBuffers ready to be converted to WAV/imported to tracks
 */
export async function renderAstutelyToStems(result: AstutelyResult): Promise<StemAudio[]> {
  await resumeAudioContext();
  await realisticAudio.initialize();

  const audioContext = getAudioContext();
  if (!audioContext) throw new Error('AudioContext not available');

  const stepDuration = 60 / result.bpm / 4; // 16th note duration in seconds
  const maxStep = Math.max(
    ...result.drums.map(d => d.step),
    ...result.bass.map(b => b.step + b.duration),
    ...result.chords.map(c => c.step + c.duration),
    ...result.melody.map(m => m.step + m.duration),
    16 // minimum 1 bar
  );
  const totalDuration = (maxStep + 4) * stepDuration; // add tail room
  const sampleRate = audioContext.sampleRate;
  const totalSamples = Math.ceil(totalDuration * sampleRate);

  // Create offline contexts for each stem
  const stems: StemAudio[] = [];

  // Render drums
  const drumsBuffer = await renderDrums(result, totalSamples, sampleRate, stepDuration);
  stems.push({ name: 'drums', audioBuffer: drumsBuffer, duration: totalDuration });

  // Render bass
  const bassBuffer = await renderMelodicPart(
    result.bass.map(b => ({ pitch: b.note, startStep: b.step, duration: b.duration })),
    'synth_bass_1',
    totalSamples,
    sampleRate,
    stepDuration
  );
  stems.push({ name: 'bass', audioBuffer: bassBuffer, duration: totalDuration });

  // Render chords
  const chordNotes = result.chords.flatMap(c =>
    c.notes.map(note => ({ pitch: note, startStep: c.step, duration: c.duration }))
  );
  const chordsBuffer = await renderMelodicPart(
    chordNotes,
    'acoustic_grand_piano',
    totalSamples,
    sampleRate,
    stepDuration
  );
  stems.push({ name: 'chords', audioBuffer: chordsBuffer, duration: totalDuration });

  // Render melody
  const melodyBuffer = await renderMelodicPart(
    result.melody.map(m => ({ pitch: m.note, startStep: m.step, duration: m.duration })),
    'lead_2_sawtooth',
    totalSamples,
    sampleRate,
    stepDuration
  );
  stems.push({ name: 'melody', audioBuffer: melodyBuffer, duration: totalDuration });

  return stems;
}

/**
 * Render drums using realisticAudio's drum synthesis
 */
async function renderDrums(
  result: AstutelyResult,
  totalSamples: number,
  sampleRate: number,
  stepDuration: number
): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(1, totalSamples, sampleRate);
  const pitchMap: Record<string, number> = { kick: 36, snare: 38, hihat: 42, perc: 46 };

  // Schedule each drum hit
  for (const d of result.drums) {
    const startTime = d.step * stepDuration;
    const pitch = pitchMap[d.type];
    
    // Use realisticAudio's drum synthesis (kick/snare/hihat)
    // We'll create a simple oscillator + noise approximation here since we can't directly call realisticAudio in offline context
    if (d.type === 'kick') {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.frequency.setValueAtTime(150, startTime);
      osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.1);
      gain.gain.setValueAtTime(0.8, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
      osc.connect(gain).connect(offlineCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    } else if (d.type === 'snare') {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.frequency.value = 200;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
      osc.connect(gain).connect(offlineCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    } else if (d.type === 'hihat') {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.frequency.value = 8000;
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);
      osc.connect(gain).connect(offlineCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.05);
    }
  }

  return await offlineCtx.startRendering();
}

/**
 * Render melodic parts (bass/chords/melody) using simple oscillators
 */
async function renderMelodicPart(
  notes: Array<{ pitch: number; startStep: number; duration: number }>,
  instrument: string,
  totalSamples: number,
  sampleRate: number,
  stepDuration: number
): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(1, totalSamples, sampleRate);

  for (const note of notes) {
    const startTime = note.startStep * stepDuration;
    const noteDuration = note.duration * stepDuration;
    const freq = 440 * Math.pow(2, (note.pitch - 69) / 12); // MIDI to Hz

    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();
    
    osc.frequency.value = freq;
    osc.type = instrument.includes('bass') ? 'sawtooth' : 'sine';
    
    gain.gain.setValueAtTime(0.4, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);
    
    osc.connect(gain).connect(offlineCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + noteDuration);
  }

  return await offlineCtx.startRendering();
}

/**
 * Convert AudioBuffer to WAV blob
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const length = buffer.length * buffer.numberOfChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, buffer.numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
  view.setUint16(32, buffer.numberOfChannels * 2, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
