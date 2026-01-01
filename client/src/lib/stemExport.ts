/**
 * Stem Export Utility
 * Renders individual tracks to separate audio files for mixing/mastering
 */

import type { Track, Note } from '@/components/studio/types/pianoRollTypes';

// Audio rendering constants
const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_BPM = 120;

interface StemExportOptions {
  sampleRate?: number;
  bpm?: number;
  format?: 'wav' | 'mp3';
  normalize?: boolean;
  includeEffects?: boolean;
}

interface RenderedStem {
  trackId: string;
  trackName: string;
  audioBuffer: AudioBuffer;
  blob: Blob;
}

/**
 * Convert note name to frequency in Hz
 */
function noteToFrequency(noteName: string, octave: number): number {
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'E#': 5,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11, 'B#': 0,
  };
  
  const semitone = noteMap[noteName] ?? 0;
  // A4 = 440Hz, MIDI note 69
  const midiNote = semitone + (octave + 1) * 12;
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Convert steps to seconds based on BPM
 * 4 steps = 1 beat (16th notes)
 */
function stepsToSeconds(steps: number, bpm: number): number {
  const beatsPerSecond = bpm / 60;
  const stepsPerBeat = 4;
  return steps / (stepsPerBeat * beatsPerSecond);
}

/**
 * Generate a simple waveform for a note
 */
function generateNoteWaveform(
  frequency: number,
  duration: number,
  velocity: number,
  sampleRate: number,
  waveType: 'sine' | 'square' | 'sawtooth' | 'triangle' = 'sine'
): Float32Array {
  const numSamples = Math.ceil(duration * sampleRate);
  const samples = new Float32Array(numSamples);
  const amplitude = (velocity / 127) * 0.5; // Scale velocity to amplitude
  
  // ADSR envelope
  const attackTime = 0.01;
  const decayTime = 0.1;
  const sustainLevel = 0.7;
  const releaseTime = 0.1;
  
  const attackSamples = Math.floor(attackTime * sampleRate);
  const decaySamples = Math.floor(decayTime * sampleRate);
  const releaseSamples = Math.floor(releaseTime * sampleRate);
  const releaseStart = numSamples - releaseSamples;
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Generate waveform
    const phase = 2 * Math.PI * frequency * t;
    switch (waveType) {
      case 'sine':
        sample = Math.sin(phase);
        break;
      case 'square':
        sample = Math.sin(phase) > 0 ? 1 : -1;
        break;
      case 'sawtooth':
        sample = 2 * ((frequency * t) % 1) - 1;
        break;
      case 'triangle':
        sample = 2 * Math.abs(2 * ((frequency * t) % 1) - 1) - 1;
        break;
    }
    
    // Apply ADSR envelope
    let envelope = 1;
    if (i < attackSamples) {
      envelope = i / attackSamples;
    } else if (i < attackSamples + decaySamples) {
      const decayProgress = (i - attackSamples) / decaySamples;
      envelope = 1 - (1 - sustainLevel) * decayProgress;
    } else if (i >= releaseStart) {
      const releaseProgress = (i - releaseStart) / releaseSamples;
      envelope = sustainLevel * (1 - releaseProgress);
    } else {
      envelope = sustainLevel;
    }
    
    samples[i] = sample * amplitude * envelope;
  }
  
  return samples;
}

/**
 * Get wave type based on instrument
 */
function getWaveTypeForInstrument(instrument: string): 'sine' | 'square' | 'sawtooth' | 'triangle' {
  const instrumentWaveMap: Record<string, 'sine' | 'square' | 'sawtooth' | 'triangle'> = {
    'piano': 'sine',
    'electric_piano_1': 'sine',
    'electric_piano_2': 'triangle',
    'organ': 'square',
    'bass-electric': 'sawtooth',
    'bass-synth': 'sawtooth',
    'synth-analog': 'sawtooth',
    'leads-square': 'square',
    'leads-saw': 'sawtooth',
    'strings': 'triangle',
    'strings-violin': 'triangle',
  };
  
  return instrumentWaveMap[instrument] || 'sine';
}

/**
 * Render a single track to an AudioBuffer
 */
async function renderTrackToBuffer(
  track: Track,
  options: StemExportOptions = {}
): Promise<AudioBuffer> {
  const { sampleRate = DEFAULT_SAMPLE_RATE, bpm = DEFAULT_BPM } = options;
  
  // Calculate total duration based on notes
  let maxEndStep = 0;
  for (const note of track.notes) {
    const endStep = note.step + note.length;
    if (endStep > maxEndStep) maxEndStep = endStep;
  }
  
  // Add some padding at the end
  const totalDuration = stepsToSeconds(maxEndStep + 4, bpm);
  const totalSamples = Math.ceil(totalDuration * sampleRate);
  
  // Create offline audio context for rendering
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);
  
  // Get wave type for this instrument
  const waveType = getWaveTypeForInstrument(track.instrument);
  
  // Render each note
  for (const note of track.notes) {
    if (track.muted) continue;
    
    const frequency = noteToFrequency(note.note, note.octave);
    const startTime = stepsToSeconds(note.step, bpm);
    const duration = stepsToSeconds(note.length, bpm);
    const velocity = Math.round(note.velocity * (track.volume / 100));
    
    // Generate waveform
    const waveform = generateNoteWaveform(frequency, duration, velocity, sampleRate, waveType);
    
    // Create buffer source
    const noteBuffer = offlineCtx.createBuffer(1, waveform.length, sampleRate);
    noteBuffer.getChannelData(0).set(waveform);
    
    const source = offlineCtx.createBufferSource();
    source.buffer = noteBuffer;
    source.connect(offlineCtx.destination);
    source.start(startTime);
  }
  
  // Render to buffer
  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer;
}

/**
 * Convert AudioBuffer to WAV Blob
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Interleave channels and write samples
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Normalize an AudioBuffer to prevent clipping
 */
function normalizeBuffer(buffer: AudioBuffer): AudioBuffer {
  const ctx = new AudioContext();
  const normalizedBuffer = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  
  // Find peak amplitude
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const channelData = buffer.getChannelData(c);
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > peak) peak = abs;
    }
  }
  
  // Normalize if needed
  const gain = peak > 0 ? 0.95 / peak : 1;
  
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const sourceData = buffer.getChannelData(c);
    const destData = normalizedBuffer.getChannelData(c);
    for (let i = 0; i < sourceData.length; i++) {
      destData[i] = sourceData[i] * gain;
    }
  }
  
  ctx.close();
  return normalizedBuffer;
}

/**
 * Export all tracks as separate stems
 */
export async function exportStems(
  tracks: Track[],
  options: StemExportOptions = {}
): Promise<RenderedStem[]> {
  const { normalize = true } = options;
  const stems: RenderedStem[] = [];
  
  for (const track of tracks) {
    if (track.notes.length === 0) continue;
    
    let audioBuffer = await renderTrackToBuffer(track, options);
    
    if (normalize) {
      audioBuffer = normalizeBuffer(audioBuffer);
    }
    
    const blob = audioBufferToWav(audioBuffer);
    
    stems.push({
      trackId: track.id,
      trackName: track.name,
      audioBuffer,
      blob,
    });
  }
  
  return stems;
}

/**
 * Download a single stem
 */
export function downloadStem(stem: RenderedStem, prefix: string = ''): void {
  const filename = `${prefix}${stem.trackName.replace(/[^a-z0-9]/gi, '_')}.wav`;
  const url = URL.createObjectURL(stem.blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Download all stems as individual files
 */
export async function downloadAllStems(
  tracks: Track[],
  projectName: string = 'project',
  options: StemExportOptions = {}
): Promise<void> {
  const stems = await exportStems(tracks, options);
  
  // Download each stem with a delay to prevent browser blocking
  for (let i = 0; i < stems.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    downloadStem(stems[i], `${projectName}_`);
  }
}

/**
 * Create a ZIP file containing all stems (requires JSZip library)
 * Falls back to individual downloads if JSZip is not available
 */
export async function exportStemsAsZip(
  tracks: Track[],
  projectName: string = 'project',
  options: StemExportOptions = {}
): Promise<Blob | null> {
  const stems = await exportStems(tracks, options);
  
  // Check if JSZip is available
  if (typeof (window as any).JSZip !== 'undefined') {
    const JSZip = (window as any).JSZip;
    const zip = new JSZip();
    
    for (const stem of stems) {
      const filename = `${stem.trackName.replace(/[^a-z0-9]/gi, '_')}.wav`;
      zip.file(filename, stem.blob);
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return zipBlob;
  }
  
  // Fallback: download individually
  console.warn('JSZip not available, downloading stems individually');
  await downloadAllStems(tracks, projectName, options);
  return null;
}

/**
 * Export and download stems (main entry point)
 */
export async function exportAndDownloadStems(
  tracks: Track[],
  projectName: string = 'project',
  options: StemExportOptions = {}
): Promise<void> {
  const zipBlob = await exportStemsAsZip(tracks, projectName, options);
  
  if (zipBlob) {
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName}_stems.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Render master mix (all tracks combined)
 */
export async function renderMasterMix(
  tracks: Track[],
  options: StemExportOptions = {}
): Promise<Blob> {
  const { sampleRate = DEFAULT_SAMPLE_RATE, bpm = DEFAULT_BPM, normalize = true } = options;
  
  // Find total duration
  let maxEndStep = 0;
  for (const track of tracks) {
    for (const note of track.notes) {
      const endStep = note.step + note.length;
      if (endStep > maxEndStep) maxEndStep = endStep;
    }
  }
  
  const totalDuration = stepsToSeconds(maxEndStep + 4, bpm);
  const totalSamples = Math.ceil(totalDuration * sampleRate);
  
  // Create offline context for master
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);
  
  // Render each track and mix
  for (const track of tracks) {
    if (track.muted || track.notes.length === 0) continue;
    
    const trackBuffer = await renderTrackToBuffer(track, options);
    
    // Create buffer source and connect to destination
    const source = offlineCtx.createBufferSource();
    source.buffer = trackBuffer;
    
    // Apply track volume
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = track.volume / 100;
    
    source.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
    source.start(0);
  }
  
  let masterBuffer = await offlineCtx.startRendering();
  
  if (normalize) {
    masterBuffer = normalizeBuffer(masterBuffer);
  }
  
  return audioBufferToWav(masterBuffer);
}

/**
 * Export and download master mix
 */
export async function exportAndDownloadMaster(
  tracks: Track[],
  filename: string = 'master.wav',
  options: StemExportOptions = {}
): Promise<void> {
  const blob = await renderMasterMix(tracks, options);
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.wav') ? filename : `${filename}.wav`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
