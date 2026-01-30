import { getAudioContext } from './audioContext';

export class AudioPremixCache {
  private cache = new Map<string, string>();
  private inFlight = new Map<string, Promise<string>>();

  async getOrCreate(cacheKey: string, urls: string[]): Promise<string | null> {
    if (!urls.length) return null;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const existing = this.inFlight.get(cacheKey);
    if (existing) {
      return existing;
    }

    const premixPromise = renderPremixedAudio(urls)
      .then((url) => {
        this.cache.set(cacheKey, url);
        this.inFlight.delete(cacheKey);
        return url;
      })
      .catch((error) => {
        this.inFlight.delete(cacheKey);
        throw error;
      });

    this.inFlight.set(cacheKey, premixPromise);
    return premixPromise;
  }

  clear() {
    this.inFlight.clear();
    this.cache.forEach((url) => URL.revokeObjectURL(url));
    this.cache.clear();
  }
}

export async function renderPremixedAudio(urls: string[]): Promise<string> {
  if (!urls.length) {
    throw new Error('No audio URLs provided for premix');
  }

  const sharedCtx = getAudioContext();
  const buffers: AudioBuffer[] = [];

  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio sample: ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const decoded = await sharedCtx.decodeAudioData(arrayBuffer.slice(0));
    buffers.push(decoded);
  }

  if (!buffers.length) {
    throw new Error('No buffers were decoded for premix');
  }

  const baseSampleRate = buffers[0].sampleRate;
  const maxFrames = Math.max(...buffers.map((buffer) => buffer.length));
  const offline = new OfflineAudioContext(2, maxFrames, baseSampleRate);

  buffers.forEach((buffer) => {
    const source = offline.createBufferSource();
    const stereoBuffer = ensureStereoBuffer(buffer, offline);
    source.buffer = stereoBuffer;
    source.connect(offline.destination);
    source.start(0);
  });

  const mixed = await offline.startRendering();
  const wavBlob = audioBufferToWav(mixed);
  return URL.createObjectURL(wavBlob);
}

function ensureStereoBuffer(buffer: AudioBuffer, context: OfflineAudioContext): AudioBuffer {
  if (buffer.numberOfChannels >= 2) {
    return buffer;
  }
  const stereo = context.createBuffer(2, buffer.length, buffer.sampleRate);
  const monoData = buffer.getChannelData(0);
  stereo.copyToChannel(monoData, 0);
  stereo.copyToChannel(monoData, 1);
  return stereo;
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  const channelData: Float32Array[] = [];
  for (let channel = 0; channel < numChannels; channel++) {
    channelData[channel] = buffer.getChannelData(channel);
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
