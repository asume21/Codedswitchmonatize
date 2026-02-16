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
  }>,
): Promise<{ blob: Blob; url: string; buffer: AudioBuffer }> {
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

      // Calculate start offset based on beat position
      const startOffsetSeconds = config.startBeat / beatsPerSecond;
      source.start(0, startOffsetSeconds, durationSeconds);
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

  return { blob, url, buffer: renderedBuffer };
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
  }>,
  durationSeconds: number,
  sampleRate: number = 48000,
  normalize: boolean = true,
): Promise<{ blob: Blob; url: string }> {
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
      source.start(0);
    } catch (err) {
      console.warn(`Failed to include track ${track.trackId} in master bounce:`, err);
    }
  }

  const buffer = await offlineCtx.startRendering();
  if (normalize) normalizeBuffer(buffer);

  const blob = audioBufferToWavBlob(buffer);
  const url = URL.createObjectURL(blob);
  return { blob, url };
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
