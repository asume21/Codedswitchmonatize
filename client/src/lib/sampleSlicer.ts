/**
 * Sample Slicer — Chop audio loops into individual hits, map to pads.
 * Supports transient detection, equal-division slicing, and manual markers.
 */

export interface SliceMarker {
  id: string;
  startSample: number;
  endSample: number;
  startTime: number;   // seconds
  endTime: number;      // seconds
  padIndex: number;     // 0-15 for a 4x4 pad grid
  name: string;
  velocity: number;     // 0-127 default trigger velocity
}

export interface SlicedSample {
  id: string;
  sourceUrl: string;
  sourceName: string;
  sampleRate: number;
  duration: number;     // total duration in seconds
  slices: SliceMarker[];
  audioBuffer: AudioBuffer | null;
}

/**
 * Load an audio file and prepare it for slicing.
 */
export async function loadSampleForSlicing(
  source: string | File | Blob,
  name: string,
): Promise<SlicedSample> {
  const ctx = new AudioContext();
  let arrayBuffer: ArrayBuffer;
  let sourceUrl: string;

  try {
    if (source instanceof Blob) {
      arrayBuffer = await source.arrayBuffer();
      sourceUrl = URL.createObjectURL(source);
    } else {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
      arrayBuffer = await response.arrayBuffer();
      sourceUrl = source;
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    return {
      id: crypto.randomUUID(),
      sourceUrl,
      sourceName: name,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
      slices: [],
      audioBuffer,
    };
  } finally {
    await ctx.close();
  }
}

/**
 * Slice into equal divisions (e.g., 8, 16, 32 slices).
 */
export function sliceEqual(sample: SlicedSample, numSlices: number): SlicedSample {
  if (!sample.audioBuffer) return sample;

  const totalSamples = sample.audioBuffer.length;
  const samplesPerSlice = Math.floor(totalSamples / numSlices);
  const slices: SliceMarker[] = [];

  for (let i = 0; i < numSlices; i++) {
    const startSample = i * samplesPerSlice;
    const endSample = i === numSlices - 1 ? totalSamples : (i + 1) * samplesPerSlice;
    slices.push({
      id: crypto.randomUUID(),
      startSample,
      endSample,
      startTime: startSample / sample.sampleRate,
      endTime: endSample / sample.sampleRate,
      padIndex: i % 16,
      name: `Slice ${i + 1}`,
      velocity: 100,
    });
  }

  return { ...sample, slices };
}

/**
 * Slice by transient detection — find attack onsets in the audio.
 */
export function sliceByTransients(
  sample: SlicedSample,
  sensitivity: number = 0.3,  // 0-1, higher = more slices
  minSliceDurationMs: number = 50,
): SlicedSample {
  if (!sample.audioBuffer) return sample;

  const channelData = sample.audioBuffer.getChannelData(0);
  const sampleRate = sample.audioBuffer.sampleRate;
  const minSliceSamples = Math.floor((minSliceDurationMs / 1000) * sampleRate);

  // Compute energy envelope
  const hopSize = 512;
  const frameSize = 1024;
  const energies: number[] = [];

  for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += channelData[i + j] * channelData[i + j];
    }
    energies.push(energy / frameSize);
  }

  // Compute spectral flux (energy difference)
  const flux: number[] = [0];
  for (let i = 1; i < energies.length; i++) {
    const diff = energies[i] - energies[i - 1];
    flux.push(Math.max(0, diff));
  }

  // Adaptive threshold
  const windowSize = 10;
  const threshold = sensitivity * 0.5;
  const onsets: number[] = [];

  for (let i = windowSize; i < flux.length - windowSize; i++) {
    let localMean = 0;
    for (let j = i - windowSize; j < i + windowSize; j++) {
      localMean += flux[j];
    }
    localMean /= (windowSize * 2);

    if (flux[i] > localMean + threshold && flux[i] > flux[i - 1] && flux[i] >= flux[i + 1]) {
      const samplePos = i * hopSize;
      if (onsets.length === 0 || samplePos - onsets[onsets.length - 1] >= minSliceSamples) {
        onsets.push(samplePos);
      }
    }
  }

  // Always include start
  if (onsets.length === 0 || onsets[0] > minSliceSamples) {
    onsets.unshift(0);
  }

  // Create slices from onsets
  const slices: SliceMarker[] = [];
  for (let i = 0; i < onsets.length; i++) {
    const startSample = onsets[i];
    const endSample = i < onsets.length - 1 ? onsets[i + 1] : channelData.length;
    slices.push({
      id: crypto.randomUUID(),
      startSample,
      endSample,
      startTime: startSample / sampleRate,
      endTime: endSample / sampleRate,
      padIndex: i % 16,
      name: `Hit ${i + 1}`,
      velocity: 100,
    });
  }

  return { ...sample, slices };
}

/**
 * Slice by beat divisions (requires known BPM).
 */
export function sliceByBeats(
  sample: SlicedSample,
  bpm: number,
  division: number = 4, // slices per beat (4 = 16th notes)
): SlicedSample {
  if (!sample.audioBuffer) return sample;

  const sampleRate = sample.audioBuffer.sampleRate;
  const totalSamples = sample.audioBuffer.length;
  const samplesPerBeat = (60 / bpm) * sampleRate;
  const samplesPerSlice = Math.floor(samplesPerBeat / division);

  const slices: SliceMarker[] = [];
  let i = 0;
  let startSample = 0;

  while (startSample < totalSamples) {
    const endSample = Math.min(startSample + samplesPerSlice, totalSamples);
    slices.push({
      id: crypto.randomUUID(),
      startSample,
      endSample,
      startTime: startSample / sampleRate,
      endTime: endSample / sampleRate,
      padIndex: i % 16,
      name: `Beat ${Math.floor(i / division) + 1}.${(i % division) + 1}`,
      velocity: 100,
    });
    startSample = endSample;
    i++;
  }

  return { ...sample, slices };
}

/**
 * Add a manual slice marker at a specific time.
 */
export function addManualSlice(
  sample: SlicedSample,
  timeSec: number,
): SlicedSample {
  if (!sample.audioBuffer) return sample;

  const samplePos = Math.floor(timeSec * sample.sampleRate);
  const sorted = [...sample.slices].sort((a, b) => a.startSample - b.startSample);

  // Find which existing slice this falls in and split it
  const newSlices: SliceMarker[] = [];
  let splitDone = false;

  for (const slice of sorted) {
    if (!splitDone && samplePos > slice.startSample && samplePos < slice.endSample) {
      // Split this slice into two
      newSlices.push({
        ...slice,
        endSample: samplePos,
        endTime: samplePos / sample.sampleRate,
      });
      newSlices.push({
        id: crypto.randomUUID(),
        startSample: samplePos,
        endSample: slice.endSample,
        startTime: samplePos / sample.sampleRate,
        endTime: slice.endTime,
        padIndex: (newSlices.length) % 16,
        name: `Slice ${newSlices.length + 1}`,
        velocity: 100,
      });
      splitDone = true;
    } else {
      newSlices.push(slice);
    }
  }

  // Re-index pads
  const reindexed = newSlices.map((s, idx) => ({ ...s, padIndex: idx % 16 }));
  return { ...sample, slices: reindexed };
}

/**
 * Remove a slice marker (merge with next slice).
 */
export function removeSlice(sample: SlicedSample, sliceId: string): SlicedSample {
  const sorted = [...sample.slices].sort((a, b) => a.startSample - b.startSample);
  const idx = sorted.findIndex(s => s.id === sliceId);
  if (idx === -1 || sorted.length <= 1) return sample;

  if (idx < sorted.length - 1) {
    // Merge with next slice
    sorted[idx + 1] = {
      ...sorted[idx + 1],
      startSample: sorted[idx].startSample,
      startTime: sorted[idx].startTime,
    };
  } else {
    // Last slice — merge with previous
    sorted[idx - 1] = {
      ...sorted[idx - 1],
      endSample: sorted[idx].endSample,
      endTime: sorted[idx].endTime,
    };
  }

  const filtered = sorted.filter(s => s.id !== sliceId);
  const reindexed = filtered.map((s, i) => ({ ...s, padIndex: i % 16 }));
  return { ...sample, slices: reindexed };
}

/**
 * Extract a single slice as an AudioBuffer.
 */
export function extractSliceBuffer(
  sample: SlicedSample,
  sliceId: string,
): AudioBuffer | null {
  if (!sample.audioBuffer) return null;
  const slice = sample.slices.find(s => s.id === sliceId);
  if (!slice) return null;

  const numChannels = sample.audioBuffer.numberOfChannels;
  const length = slice.endSample - slice.startSample;
  const ctx = new OfflineAudioContext(numChannels, length, sample.sampleRate);
  const buffer = ctx.createBuffer(numChannels, length, sample.sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const source = sample.audioBuffer.getChannelData(ch);
    const dest = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      dest[i] = source[slice.startSample + i] || 0;
    }
  }

  return buffer;
}

/**
 * Play a single slice through the given AudioContext.
 */
export function playSlice(
  audioCtx: AudioContext,
  sample: SlicedSample,
  sliceId: string,
  destination?: AudioNode,
): AudioBufferSourceNode | null {
  const buffer = extractSliceBuffer(sample, sliceId);
  if (!buffer) return null;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(destination || audioCtx.destination);
  source.start();
  return source;
}

/**
 * Export all slices as individual WAV blobs.
 */
export async function exportSlicesAsWav(
  sample: SlicedSample,
): Promise<Array<{ name: string; blob: Blob }>> {
  if (!sample.audioBuffer) return [];

  const results: Array<{ name: string; blob: Blob }> = [];

  for (const slice of sample.slices) {
    const buffer = extractSliceBuffer(sample, slice.id);
    if (!buffer) continue;

    const numChannels = buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = length * blockAlign;
    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);

    // WAV header
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
        const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        view.setInt16(offset, s * 0x7FFF, true);
        offset += 2;
      }
    }

    results.push({
      name: `${slice.name}.wav`,
      blob: new Blob([wavBuffer], { type: 'audio/wav' }),
    });
  }

  return results;
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
