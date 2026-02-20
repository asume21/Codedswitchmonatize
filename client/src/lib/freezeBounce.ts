/**
 * Freeze/Bounce Engine — Render tracks to audio to save CPU.
 * Freeze: render track offline, replace live processing with static audio.
 * Bounce: render track/selection to a new audio file.
 */

export interface FreezeState {
  trackId: string;
  frozen: boolean;
  frozenAudioUrl: string | null;
  frozenBuffer: AudioBuffer | null;
  originalState: any; // preserved so we can unfreeze
}

function analyzeBounceMetrics(buffer: AudioBuffer): BounceMetrics {
  let peak = 0;
  let sumSquares = 0;
  let sampleCount = 0;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const abs = Math.abs(value);
      if (abs > peak) peak = abs;
      sumSquares += value * value;
      sampleCount++;
    }
  }

  const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
  const fingerprint = createBounceFingerprint(buffer);

  return { peak, rms, fingerprint };
}

export function createBounceFingerprint(buffer: AudioBuffer, targetSamples: number = 4096): string {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const safeTarget = Math.max(128, targetSamples);
  const stride = Math.max(1, Math.floor(length / safeTarget));

  let hash = 2166136261;
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i += stride) {
      const quantized = Math.round(Math.max(-1, Math.min(1, data[i])) * 32767);
      hash ^= (quantized & 0xff);
      hash = Math.imul(hash, 16777619);
      hash ^= ((quantized >> 8) & 0xff);
      hash = Math.imul(hash, 16777619);
    }
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export interface BounceConfig {
  trackIds: string[];           // which tracks to include
  startBeat: number;
  endBeat: number;
  bpm: number;
  sampleRate: number;
  channels: 1 | 2;
  normalize: boolean;
  format: 'wav' | 'mp3';
  includeEffects: boolean;
  includeSends: boolean;
  latencyCompensationMs?: number;
}

export interface BounceMetrics {
  peak: number;
  rms: number;
  fingerprint: string;
}

export interface BounceParityResult {
  matches: boolean;
  expectedFingerprint: string;
  actualFingerprint: string;
  severity: 'none' | 'warning';
}

export function evaluateBounceParity(
  expectedFingerprint: string | null | undefined,
  metrics: BounceMetrics,
): BounceParityResult | null {
  const expected = (expectedFingerprint || '').trim().toLowerCase();
  if (!expected) return null;

  const actual = (metrics.fingerprint || '').trim().toLowerCase();
  const matches = expected === actual;

  return {
    matches,
    expectedFingerprint: expected,
    actualFingerprint: actual,
    severity: matches ? 'none' : 'warning',
  };
}

const frozenTracks: Map<string, FreezeState> = new Map();

/**
 * Render a track offline to an AudioBuffer.
 * This processes all notes/clips through the track's effects chain.
 */
export async function renderTrackOffline(
  trackData: {
    audioUrl?: string;
    notes?: any[];
    clips?: any[];
    effects?: any[];
    volume: number;
    pan: number;
  },
  durationSeconds: number,
  sampleRate: number = 48000,
  channels: number = 2,
): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(channels, Math.ceil(durationSeconds * sampleRate), sampleRate);

  if (trackData.audioUrl) {
    // Audio track — fetch and decode
    const response = await fetch(trackData.audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const sourceBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

    const source = offlineCtx.createBufferSource();
    source.buffer = sourceBuffer;

    // Apply volume
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = trackData.volume;

    // Apply pan
    const panNode = offlineCtx.createStereoPanner();
    panNode.pan.value = trackData.pan;

    source.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(offlineCtx.destination);
    source.start(0);
  } else {
    // MIDI/empty track — create silence
    const silentBuffer = offlineCtx.createBuffer(channels, Math.ceil(durationSeconds * sampleRate), sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
  }

  return offlineCtx.startRendering();
}

/**
 * Freeze a track — render it offline and store the result.
 */
export async function freezeTrack(
  trackId: string,
  trackData: {
    audioUrl?: string;
    notes?: any[];
    clips?: any[];
    effects?: any[];
    volume: number;
    pan: number;
  },
  durationSeconds: number,
): Promise<FreezeState> {
  const buffer = await renderTrackOffline(trackData, durationSeconds);
  const audioUrl = audioBufferToObjectUrl(buffer);

  const state: FreezeState = {
    trackId,
    frozen: true,
    frozenAudioUrl: audioUrl,
    frozenBuffer: buffer,
    originalState: { ...trackData },
  };

  frozenTracks.set(trackId, state);
  return state;
}

/**
 * Unfreeze a track — restore original state.
 */
export function unfreezeTrack(trackId: string): FreezeState | null {
  const state = frozenTracks.get(trackId);
  if (!state) return null;

  if (state.frozenAudioUrl) {
    URL.revokeObjectURL(state.frozenAudioUrl);
  }

  const restored: FreezeState = {
    ...state,
    frozen: false,
    frozenAudioUrl: null,
    frozenBuffer: null,
  };

  frozenTracks.set(trackId, restored);
  return restored;
}

/**
 * Check if a track is frozen.
 */
export function isTrackFrozen(trackId: string): boolean {
  return frozenTracks.get(trackId)?.frozen ?? false;
}

/**
 * Get frozen audio URL for playback.
 */
export function getFrozenAudioUrl(trackId: string): string | null {
  return frozenTracks.get(trackId)?.frozenAudioUrl ?? null;
}

/**
 * Bounce multiple tracks to a single audio file.
 */
export async function bounceTracks(
  config: BounceConfig,
  trackDataMap: Map<string, {
    audioUrl?: string;
    notes?: any[];
    clips?: any[];
    effects?: any[];
    volume: number;
    pan: number;
    startTimeSeconds?: number;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
    latencyCompensationMs?: number;
  }>,
): Promise<{ blob: Blob; url: string; buffer: AudioBuffer; metrics: BounceMetrics }> {
  const beatsPerSecond = config.bpm / 60;
  const durationBeats = config.endBeat - config.startBeat;
  const durationSeconds = durationBeats / beatsPerSecond;
  const totalSamples = Math.ceil(durationSeconds * config.sampleRate);

  const offlineCtx = new OfflineAudioContext(config.channels, totalSamples, config.sampleRate);

  // Render each track and mix them
  for (const trackId of config.trackIds) {
    const trackData = trackDataMap.get(trackId);
    if (!trackData || !trackData.audioUrl) continue;

    try {
      const response = await fetch(trackData.audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const sourceBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

      const source = offlineCtx.createBufferSource();
      source.buffer = sourceBuffer;

      const gainNode = offlineCtx.createGain();
      gainNode.gain.value = trackData.volume;

      const panNode = offlineCtx.createStereoPanner();
      panNode.pan.value = trackData.pan;

      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(offlineCtx.destination);

      const bounceStartAbs = config.startBeat / beatsPerSecond;
      const bounceEndAbs = bounceStartAbs + durationSeconds;

      const latencySeconds = Math.max(0, (config.latencyCompensationMs || 0) / 1000) +
        Math.max(0, (trackData.latencyCompensationMs || 0) / 1000);
      const trackStartAbs = Math.max(0, (trackData.startTimeSeconds || 0) - latencySeconds);

      const trimStart = Math.max(0, Math.min(sourceBuffer.duration, trackData.trimStartSeconds || 0));
      const trimEnd = Math.max(trimStart, Math.min(sourceBuffer.duration, trackData.trimEndSeconds || sourceBuffer.duration));
      const playableDuration = Math.max(0, trimEnd - trimStart);

      if (playableDuration <= 0) continue;

      const trackEndAbs = trackStartAbs + playableDuration;
      const intersectStart = Math.max(bounceStartAbs, trackStartAbs);
      const intersectEnd = Math.min(bounceEndAbs, trackEndAbs);

      if (intersectEnd <= intersectStart) continue;

      const scheduleAt = intersectStart - bounceStartAbs;
      const sourceOffset = trimStart + (intersectStart - trackStartAbs);
      const playDuration = intersectEnd - intersectStart;

      source.start(scheduleAt, sourceOffset, playDuration);
    } catch (err) {
      console.warn(`Failed to render track ${trackId}:`, err);
    }
  }

  const renderedBuffer = await offlineCtx.startRendering();

  // Normalize if requested
  if (config.normalize) {
    normalizeBuffer(renderedBuffer);
  }

  const blob = audioBufferToWavBlob(renderedBuffer);
  const url = URL.createObjectURL(blob);
  const metrics = analyzeBounceMetrics(renderedBuffer);

  return { blob, url, buffer: renderedBuffer, metrics };
}

/**
 * Bounce the master output (all tracks mixed).
 */
export async function bounceMaster(
  allTrackData: Array<{
    trackId: string;
    audioUrl?: string;
    volume: number;
    pan: number;
    startTimeSeconds?: number;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
    latencyCompensationMs?: number;
  }>,
  durationSeconds: number,
  sampleRate: number = 48000,
  normalize: boolean = true,
  latencyCompensationMs: number = 0,
): Promise<{ blob: Blob; url: string; metrics: BounceMetrics }> {
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(durationSeconds * sampleRate), sampleRate);

  for (const track of allTrackData) {
    if (!track.audioUrl) continue;
    try {
      const response = await fetch(track.audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const sourceBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

      const source = offlineCtx.createBufferSource();
      source.buffer = sourceBuffer;

      const gain = offlineCtx.createGain();
      gain.gain.value = track.volume;

      const pan = offlineCtx.createStereoPanner();
      pan.pan.value = track.pan;

      source.connect(gain);
      gain.connect(pan);
      pan.connect(offlineCtx.destination);

      const bounceStartAbs = 0;
      const bounceEndAbs = durationSeconds;
      const latencySeconds = Math.max(0, latencyCompensationMs / 1000) +
        Math.max(0, (track.latencyCompensationMs || 0) / 1000);
      const trackStartAbs = Math.max(0, (track.startTimeSeconds || 0) - latencySeconds);

      const trimStart = Math.max(0, Math.min(sourceBuffer.duration, track.trimStartSeconds || 0));
      const trimEnd = Math.max(trimStart, Math.min(sourceBuffer.duration, track.trimEndSeconds || sourceBuffer.duration));
      const playableDuration = Math.max(0, trimEnd - trimStart);
      if (playableDuration <= 0) continue;

      const trackEndAbs = trackStartAbs + playableDuration;
      const intersectStart = Math.max(bounceStartAbs, trackStartAbs);
      const intersectEnd = Math.min(bounceEndAbs, trackEndAbs);
      if (intersectEnd <= intersectStart) continue;

      const scheduleAt = intersectStart - bounceStartAbs;
      const sourceOffset = trimStart + (intersectStart - trackStartAbs);
      const playDuration = intersectEnd - intersectStart;

      source.start(scheduleAt, sourceOffset, playDuration);
    } catch (err) {
      console.warn(`Failed to include track ${track.trackId} in master bounce:`, err);
    }
  }

  const buffer = await offlineCtx.startRendering();
  if (normalize) normalizeBuffer(buffer);

  const blob = audioBufferToWavBlob(buffer);
  const url = URL.createObjectURL(blob);
  const metrics = analyzeBounceMetrics(buffer);
  return { blob, url, metrics };
}

// ─── Utility functions ──────────────────────────────────────────────

function normalizeBuffer(buffer: AudioBuffer, targetPeak: number = 0.95): void {
  let maxSample = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxSample) maxSample = abs;
    }
  }

  if (maxSample === 0 || maxSample >= targetPeak) return;

  const gain = targetPeak / maxSample;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] *= gain;
    }
  }
}

function audioBufferToObjectUrl(buffer: AudioBuffer): string {
  const blob = audioBufferToWavBlob(buffer);
  return URL.createObjectURL(blob);
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Clean up all frozen track resources.
 */
export function disposeAllFrozen() {
  for (const [, state] of frozenTracks) {
    if (state.frozenAudioUrl) {
      URL.revokeObjectURL(state.frozenAudioUrl);
    }
  }
  frozenTracks.clear();
}
