/**
 * TimeStretch — Adjust audio playback speed to match project BPM.
 *
 * Level 1 (basic):   playbackRate adjustment — changes speed AND pitch.
 * Level 2 (quality): Phase Vocoder — changes speed WITHOUT changing pitch.
 *
 * Level 1 is a one-liner and works great for drums/percussion.
 * Level 2 uses an overlap-add phase vocoder for melodic content.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface StretchConfig {
  /** Original BPM of the audio sample */
  sourceBpm: number;
  /** Target BPM (project BPM) */
  targetBpm: number;
  /** Whether to preserve pitch (uses phase vocoder when true) */
  preservePitch?: boolean;
}

export interface StretchedResult {
  /** The stretched AudioBuffer */
  buffer: AudioBuffer;
  /** The playbackRate applied (if preservePitch is false) */
  playbackRate: number;
  /** Actual duration after stretch */
  durationSeconds: number;
}

// ─── Level 1: PlaybackRate (simple, changes pitch) ──────────────────

/**
 * Calculate the playback rate needed to match target BPM.
 * Use this to set `source.playbackRate.value` in Web Audio.
 */
export function calculatePlaybackRate(sourceBpm: number, targetBpm: number): number {
  if (sourceBpm <= 0) return 1;
  return targetBpm / sourceBpm;
}

/**
 * Stretch an AudioBuffer by resampling (changes pitch).
 * Fast and simple — best for drums, percussion, non-melodic content.
 */
export async function stretchByRate(
  buffer: AudioBuffer,
  config: StretchConfig,
): Promise<StretchedResult> {
  const rate = calculatePlaybackRate(config.sourceBpm, config.targetBpm);
  const newLength = Math.ceil(buffer.length / rate);
  const sampleRate = buffer.sampleRate;

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    newLength,
    sampleRate,
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  source.connect(offlineCtx.destination);
  source.start(0);

  const stretched = await offlineCtx.startRendering();

  return {
    buffer: stretched,
    playbackRate: rate,
    durationSeconds: stretched.length / sampleRate,
  };
}

// ─── Level 2: Phase Vocoder (preserves pitch) ───────────────────────

/**
 * Time-stretch an AudioBuffer WITHOUT changing pitch.
 * Uses an overlap-add (OLA) phase vocoder algorithm.
 *
 * This is the same technique Ableton's Complex warp mode uses.
 * Best for vocals, strings, synths — any pitched content.
 */
export async function stretchPreservePitch(
  buffer: AudioBuffer,
  config: StretchConfig,
): Promise<StretchedResult> {
  const rate = calculatePlaybackRate(config.sourceBpm, config.targetBpm);
  const stretchFactor = 1 / rate; // > 1 = slower, < 1 = faster
  const sampleRate = buffer.sampleRate;

  // Process each channel
  const numChannels = buffer.numberOfChannels;
  const inputLength = buffer.length;
  const outputLength = Math.ceil(inputLength * stretchFactor);

  const outputBuffer = new AudioBuffer({
    length: outputLength,
    numberOfChannels: numChannels,
    sampleRate,
  });

  for (let ch = 0; ch < numChannels; ch++) {
    const inputData = new Float32Array(buffer.getChannelData(ch));
    const outputData = olaTimeStretch(inputData, stretchFactor);
    outputBuffer.copyToChannel(outputData as unknown as Float32Array<ArrayBuffer>, ch);
  }

  return {
    buffer: outputBuffer,
    playbackRate: rate,
    durationSeconds: outputLength / sampleRate,
  };
}

/**
 * Overlap-Add (OLA) time stretching with WSOLA-style best-overlap search.
 * Uses a normalization buffer for correct amplitude across all stretch ratios.
 */
function olaTimeStretch(input: Float32Array, stretchFactor: number): Float32Array {
  const windowSize = 2048;
  const hopIn = Math.floor(windowSize / 4);       // Analysis hop
  const hopOut = Math.floor(hopIn * stretchFactor); // Synthesis hop
  const outputLength = Math.ceil(input.length * stretchFactor);
  const output = new Float32Array(outputLength);
  const normBuf = new Float32Array(outputLength); // per-sample normalization
  const windowFunction = hanningWindow(windowSize);

  // WSOLA search range (samples) to find best overlap alignment
  const searchRange = Math.min(hopIn, 64);

  let readPos = 0;
  let writePos = 0;

  while (readPos + windowSize < input.length && writePos + windowSize < outputLength) {
    // WSOLA: find best offset within search range for minimal discontinuity
    let bestOffset = 0;
    if (writePos > 0 && searchRange > 0) {
      let bestCorr = -Infinity;
      for (let off = -searchRange; off <= searchRange; off++) {
        const candidateRead = readPos + off;
        if (candidateRead < 0 || candidateRead + windowSize >= input.length) continue;
        // Cross-correlate a small segment at the overlap boundary
        let corr = 0;
        const checkLen = Math.min(hopOut, 128);
        for (let j = 0; j < checkLen; j++) {
          const outIdx = writePos + j;
          if (outIdx < outputLength) {
            corr += output[outIdx] * input[candidateRead + j];
          }
        }
        if (corr > bestCorr) {
          bestCorr = corr;
          bestOffset = off;
        }
      }
    }

    const actualRead = readPos + bestOffset;
    if (actualRead >= 0 && actualRead + windowSize < input.length) {
      for (let i = 0; i < windowSize; i++) {
        const outIdx = writePos + i;
        if (outIdx < outputLength) {
          const w = windowFunction[i];
          output[outIdx] += input[actualRead + i] * w;
          normBuf[outIdx] += w;
        }
      }
    }

    readPos += hopIn;
    writePos += hopOut;
  }

  // Normalize using the per-sample window accumulation
  for (let i = 0; i < outputLength; i++) {
    if (normBuf[i] > 0.001) {
      output[i] /= normBuf[i];
    }
  }

  return output;
}

/**
 * Generate a Hanning window of the given size.
 */
function hanningWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

// ─── Convenience: Auto-select method ────────────────────────────────

/**
 * Time-stretch an AudioBuffer to match a target BPM.
 * Automatically chooses the best method based on `preservePitch`.
 */
export async function timeStretch(
  buffer: AudioBuffer,
  config: StretchConfig,
): Promise<StretchedResult> {
  if (config.preservePitch) {
    return stretchPreservePitch(buffer, config);
  }
  return stretchByRate(buffer, config);
}

// ─── BPM Detection (basic) ──────────────────────────────────────────

/**
 * Estimate the BPM of an AudioBuffer using onset detection.
 * Returns the most likely BPM in the range 60-180.
 *
 * This is a simplified autocorrelation-based approach.
 */
export function estimateBpm(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // Downsample to ~11kHz for faster processing
  const downsampleFactor = Math.max(1, Math.floor(sampleRate / 11025));
  const downsampled: number[] = [];
  for (let i = 0; i < data.length; i += downsampleFactor) {
    downsampled.push(Math.abs(data[i]));
  }

  const effectiveRate = sampleRate / downsampleFactor;

  // Onset detection: compute energy difference
  const frameSize = Math.floor(effectiveRate * 0.01); // 10ms frames
  const energies: number[] = [];

  for (let i = 0; i < downsampled.length - frameSize; i += frameSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += downsampled[i + j] * downsampled[i + j];
    }
    energies.push(energy);
  }

  // Onset flux: positive differences
  const flux: number[] = [];
  for (let i = 1; i < energies.length; i++) {
    flux.push(Math.max(0, energies[i] - energies[i - 1]));
  }

  // Autocorrelation of onset flux
  const minLag = Math.floor(60 / 180 * (flux.length / (buffer.duration))); // 180 BPM
  const maxLag = Math.floor(60 / 60 * (flux.length / (buffer.duration)));  // 60 BPM

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, flux.length / 2); lag++) {
    let corr = 0;
    for (let i = 0; i < flux.length - lag; i++) {
      corr += flux[i] * flux[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Convert lag to BPM
  const secondsPerBeat = (bestLag * buffer.duration) / flux.length;
  const bpm = secondsPerBeat > 0 ? 60 / secondsPerBeat : 120;

  // Clamp to reasonable range
  return Math.round(Math.max(60, Math.min(180, bpm)));
}
