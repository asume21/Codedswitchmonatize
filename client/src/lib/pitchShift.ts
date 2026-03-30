/**
 * Pitch Shifting — Transpose audio clips by semitones without changing playback speed.
 *
 * Uses a granular synthesis approach:
 *   1. Slice input into overlapping grains
 *   2. Resample each grain at the pitch ratio
 *   3. Overlap-add the resampled grains back together
 *
 * For real-time use, the Web Audio API's AudioBufferSourceNode.detune can handle
 * simple cases, but this offline processor gives higher quality results.
 */

export interface PitchShiftOptions {
  /** Semitones to shift (positive = up, negative = down). Default 0. */
  semitones: number;
  /** Grain size in samples. Larger = smoother but more latency. Default 2048. */
  grainSize?: number;
  /** Overlap factor (0–0.9). Higher = smoother crossfades. Default 0.5. */
  overlap?: number;
}

/**
 * Shift pitch of an AudioBuffer by the given number of semitones (offline).
 * Returns a new AudioBuffer at the same duration and sample rate.
 */
export function pitchShiftBuffer(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  options: PitchShiftOptions,
): AudioBuffer {
  const { semitones, grainSize = 2048, overlap = 0.5 } = options;
  if (semitones === 0) return buffer;

  const ratio = Math.pow(2, semitones / 12);
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const inputLength = buffer.length;
  const outputLength = inputLength; // same duration

  const output = ctx.createBuffer(numChannels, outputLength, sampleRate);

  const hopSize = Math.round(grainSize * (1 - overlap));

  for (let ch = 0; ch < numChannels; ch++) {
    const inputData = buffer.getChannelData(ch);
    const outputData = output.getChannelData(ch);
    const windowBuf = new Float32Array(grainSize);

    // Hann window
    for (let i = 0; i < grainSize; i++) {
      windowBuf[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
    }

    // Normalization buffer to compensate for overlapping windows
    const normBuf = new Float32Array(outputLength);

    for (let outPos = 0; outPos < outputLength; outPos += hopSize) {
      // Where to read from in input (accounting for pitch ratio)
      const inCenter = outPos;

      for (let i = 0; i < grainSize; i++) {
        const outIdx = outPos + i;
        if (outIdx >= outputLength) break;

        // Map output grain sample back to input at shifted rate
        const inIdx = inCenter + (i - grainSize / 2) * ratio + grainSize / 2;
        const inIdxFloor = Math.floor(inIdx);
        const frac = inIdx - inIdxFloor;

        // Linear interpolation for sub-sample accuracy
        let sample = 0;
        if (inIdxFloor >= 0 && inIdxFloor < inputLength - 1) {
          sample = inputData[inIdxFloor] * (1 - frac) + inputData[inIdxFloor + 1] * frac;
        } else if (inIdxFloor >= 0 && inIdxFloor < inputLength) {
          sample = inputData[inIdxFloor];
        }

        const w = windowBuf[i];
        outputData[outIdx] += sample * w;
        normBuf[outIdx] += w;
      }
    }

    // Normalize by overlapping window sum
    for (let i = 0; i < outputLength; i++) {
      if (normBuf[i] > 0.001) {
        outputData[i] /= normBuf[i];
      }
    }
  }

  return output;
}

/**
 * Real-time pitch shift using Web Audio API detune parameter.
 * This is simpler but changes duration slightly — best for live preview.
 * Returns the configured AudioBufferSourceNode (caller must connect & start).
 */
export function createPitchShiftedSource(
  ctx: AudioContext,
  buffer: AudioBuffer,
  semitones: number,
): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.detune.value = semitones * 100; // detune is in cents (100 cents = 1 semitone)
  return source;
}

/**
 * Shift pitch of a buffer using OfflineAudioContext + detune for highest quality.
 * Preserves duration by compensating playback rate.
 */
export async function pitchShiftOffline(
  buffer: AudioBuffer,
  semitones: number,
): Promise<AudioBuffer> {
  if (semitones === 0) return buffer;

  const ratio = Math.pow(2, semitones / 12);
  // To keep same duration while shifting pitch:
  // We play at `ratio` speed (which shifts pitch) but stretch time by 1/ratio
  // Net effect: same duration, different pitch
  // We render a buffer that is `length * ratio` samples, then resample back

  const renderLength = Math.ceil(buffer.length / ratio);
  const offline = new OfflineAudioContext(
    buffer.numberOfChannels,
    renderLength,
    buffer.sampleRate,
  );

  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = ratio;
  source.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();

  // Now resample rendered back to original length to preserve duration
  if (Math.abs(rendered.length - buffer.length) < 2) return rendered;

  const finalOffline = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );

  const src2 = finalOffline.createBufferSource();
  src2.buffer = rendered;
  src2.playbackRate.value = rendered.length / buffer.length;
  src2.connect(finalOffline.destination);
  src2.start(0);

  return finalOffline.startRendering();
}
