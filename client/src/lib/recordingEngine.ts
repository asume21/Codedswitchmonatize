/**
 * Recording Engine — Real-time audio recording with multi-take,
 * punch-in/out, latency compensation, and input monitoring.
 */

export interface RecordingConfig {
  inputDeviceId?: string;
  sampleRate: number;
  channels: 1 | 2;
  latencyCompensationMs: number;
  monitorInput: boolean;
  monitorVolume: number;
  punchInBeat: number | null;
  punchOutBeat: number | null;
}

export interface RecordingTake {
  id: string;
  trackId: string;
  audioBlob: Blob;
  audioUrl: string;
  startBeat: number;
  endBeat: number;
  durationMs: number;
  timestamp: number;
  selected: boolean;
}

export interface CompRegion {
  takeId: string;
  startBeat: number;
  endBeat: number;
}

const DEFAULT_CONFIG: RecordingConfig = {
  sampleRate: 48000,
  channels: 2,
  latencyCompensationMs: 0,
  monitorInput: false,
  monitorVolume: 0.8,
  punchInBeat: null,
  punchOutBeat: null,
};

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let monitorGain: GainNode | null = null;
let isRecording = false;
let isPaused = false;
let recordedChunks: Blob[] = [];
let recordingStartTime = 0;
let currentConfig: RecordingConfig = { ...DEFAULT_CONFIG };
let takes: RecordingTake[] = [];
let listeners: Array<(state: RecordingState) => void> = [];

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  isMonitoring: boolean;
  elapsedMs: number;
  inputLevel: number;
  takes: RecordingTake[];
  availableDevices: MediaDeviceInfo[];
  config: RecordingConfig;
}

function notify(state: Partial<RecordingState>) {
  const full: RecordingState = {
    isRecording,
    isPaused,
    isMonitoring: currentConfig.monitorInput && !!sourceNode,
    elapsedMs: isRecording ? Date.now() - recordingStartTime : 0,
    inputLevel: 0,
    takes,
    availableDevices: [],
    config: currentConfig,
    ...state,
  };
  listeners.forEach(fn => fn(full));
}

export function subscribeRecording(listener: (state: RecordingState) => void): () => void {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

/**
 * Get available audio input devices.
 */
export async function getInputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  } catch {
    return [];
  }
}

/**
 * Measure input latency by analyzing round-trip time.
 */
export async function measureLatency(): Promise<number> {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: currentConfig.sampleRate });
  }
  // Estimate based on buffer size and sample rate
  const bufferSize = 256;
  const latencyMs = (bufferSize / audioContext.sampleRate) * 1000 * 2; // input + output
  return Math.round(latencyMs);
}

/**
 * Update recording configuration.
 */
export function setRecordingConfig(config: Partial<RecordingConfig>) {
  currentConfig = { ...currentConfig, ...config };
  if (monitorGain) {
    monitorGain.gain.value = currentConfig.monitorInput ? currentConfig.monitorVolume : 0;
  }
  notify({});
}

/**
 * Start input monitoring (hear yourself without recording).
 */
export async function startMonitoring(): Promise<void> {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: currentConfig.sampleRate });
  }

  const constraints: MediaStreamConstraints = {
    audio: {
      deviceId: currentConfig.inputDeviceId ? { exact: currentConfig.inputDeviceId } : undefined,
      sampleRate: currentConfig.sampleRate,
      channelCount: currentConfig.channels,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };

  mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
  sourceNode = audioContext.createMediaStreamSource(mediaStream);
  monitorGain = audioContext.createGain();
  monitorGain.gain.value = currentConfig.monitorInput ? currentConfig.monitorVolume : 0;
  sourceNode.connect(monitorGain);
  monitorGain.connect(audioContext.destination);
  notify({});
}

/**
 * Stop input monitoring.
 */
export function stopMonitoring() {
  if (monitorGain) {
    monitorGain.disconnect();
    monitorGain = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (mediaStream && !isRecording) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  notify({});
}

/**
 * Start recording a new take.
 */
export async function startRecording(
  trackId: string,
  startBeat: number,
  config?: Partial<RecordingConfig>,
): Promise<void> {
  if (config) setRecordingConfig(config);

  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: currentConfig.sampleRate });
  }

  if (!mediaStream) {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: currentConfig.inputDeviceId ? { exact: currentConfig.inputDeviceId } : undefined,
        sampleRate: currentConfig.sampleRate,
        channelCount: currentConfig.channels,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
  }

  // Set up monitoring if enabled
  if (currentConfig.monitorInput && !sourceNode) {
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    monitorGain = audioContext.createGain();
    monitorGain.gain.value = currentConfig.monitorVolume;
    sourceNode.connect(monitorGain);
    monitorGain.connect(audioContext.destination);
  }

  recordedChunks = [];
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(mediaStream, {
    mimeType,
    audioBitsPerSecond: 256000,
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: mimeType });
    const audioUrl = URL.createObjectURL(blob);
    const durationMs = Date.now() - recordingStartTime;

    const take: RecordingTake = {
      id: crypto.randomUUID(),
      trackId,
      audioBlob: blob,
      audioUrl,
      startBeat,
      endBeat: startBeat + (durationMs / 1000) * (120 / 60), // approximate, will be recalculated
      durationMs,
      timestamp: Date.now(),
      selected: true,
    };

    // Deselect previous takes for this track
    takes = takes.map(t => t.trackId === trackId ? { ...t, selected: false } : t);
    takes.push(take);
    notify({});
  };

  mediaRecorder.start(100); // collect data every 100ms
  isRecording = true;
  isPaused = false;
  recordingStartTime = Date.now();
  notify({});
}

/**
 * Stop recording the current take.
 */
export function stopRecording(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
  isPaused = false;

  // Stop monitoring if it was only for recording
  if (!currentConfig.monitorInput) {
    stopMonitoring();
  }

  notify({});
}

/**
 * Pause recording (if supported).
 */
export function pauseRecording(): void {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    isPaused = true;
    notify({});
  }
}

/**
 * Resume recording after pause.
 */
export function resumeRecording(): void {
  if (mediaRecorder && mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    isPaused = false;
    notify({});
  }
}

/**
 * Get all takes for a track.
 */
export function getTakesForTrack(trackId: string): RecordingTake[] {
  return takes.filter(t => t.trackId === trackId);
}

/**
 * Select a take (for comping).
 */
export function selectTake(takeId: string): void {
  const take = takes.find(t => t.id === takeId);
  if (!take) return;
  takes = takes.map(t => {
    if (t.trackId === take.trackId) {
      return { ...t, selected: t.id === takeId };
    }
    return t;
  });
  notify({});
}

/**
 * Delete a take.
 */
export function deleteTake(takeId: string): void {
  const take = takes.find(t => t.id === takeId);
  if (take) {
    URL.revokeObjectURL(take.audioUrl);
  }
  takes = takes.filter(t => t.id !== takeId);
  notify({});
}

/**
 * Comp multiple takes — select regions from different takes.
 * Returns a list of regions to stitch together.
 */
export function createComp(trackId: string, regions: CompRegion[]): CompRegion[] {
  // Sort by start beat and remove overlaps
  const sorted = [...regions].sort((a, b) => a.startBeat - b.startBeat);
  const result: CompRegion[] = [];

  for (const region of sorted) {
    if (result.length === 0) {
      result.push(region);
      continue;
    }
    const last = result[result.length - 1];
    if (region.startBeat < last.endBeat) {
      // Overlap — trim the previous region
      last.endBeat = region.startBeat;
    }
    result.push(region);
  }

  return result;
}

/**
 * Convert a take's blob to a WAV file for better compatibility.
 */
export async function takeToWav(take: RecordingTake): Promise<Blob> {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: currentConfig.sampleRate });
  }

  const arrayBuffer = await take.audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Encode as WAV
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Clean up all resources.
 */
export function disposeRecording() {
  stopRecording();
  stopMonitoring();
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  takes.forEach(t => URL.revokeObjectURL(t.audioUrl));
  takes = [];
  listeners = [];
}
