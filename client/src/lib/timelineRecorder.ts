/**
 * TimelineRecorder — Record audio (vocals, guitar, etc.) directly onto the timeline.
 *
 * Syncs start/stop with the transport so recordings land at the correct position.
 * Produces a WAV blob + waveform data that can be added as a new audio track.
 */

import { audioBufferToWav } from '@/lib/stemExport';

// ─── Types ──────────────────────────────────────────────────────────

export interface RecordingResult {
  /** The recorded audio as a WAV blob */
  blob: Blob;
  /** Object URL for immediate playback */
  url: string;
  /** Duration in seconds */
  durationSeconds: number;
  /** The transport beat position where recording started */
  startBeat: number;
  /** Waveform peaks for visualization (0-1 normalized) */
  waveformPeaks: number[];
  /** The raw AudioBuffer for further processing */
  buffer: AudioBuffer;
}

export interface RecorderState {
  isRecording: boolean;
  isPreparing: boolean;
  inputLevel: number;      // 0-1, live meter
  elapsedSeconds: number;
  hasPermission: boolean;
  error: string | null;
  selectedInputId: string | null;
  availableInputs: MediaDeviceInfo[];
}

type StateListener = (state: RecorderState) => void;

// ─── The Recorder ───────────────────────────────────────────────────

export class TimelineRecorder {
  private state: RecorderState = {
    isRecording: false,
    isPreparing: false,
    inputLevel: 0,
    elapsedSeconds: 0,
    hasPermission: false,
    error: null,
    selectedInputId: null,
    availableInputs: [],
  };

  private listeners: Set<StateListener> = new Set();

  // Web Audio nodes
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  // Recording buffer
  private recordedChunks: Float32Array[] = [];
  private sampleRate = 48000;
  private recordingStartBeat = 0;
  private recordingStartTime = 0;
  private meterAnimFrame: number | null = null;
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;

  // ─── State Management ───────────────────────────────────────────

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state); // Emit current state immediately
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<RecorderState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  getState(): RecorderState {
    return this.state;
  }

  // ─── Permission & Input Selection ───────────────────────────────

  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the test stream immediately
      stream.getTracks().forEach(t => t.stop());
      this.setState({ hasPermission: true, error: null });
      await this.refreshInputs();
      return true;
    } catch (err: any) {
      this.setState({
        hasPermission: false,
        error: `Microphone access denied: ${err.message}`,
      });
      return false;
    }
  }

  async refreshInputs(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      this.setState({ availableInputs: audioInputs });

      // Auto-select first input if none selected
      if (!this.state.selectedInputId && audioInputs.length > 0) {
        this.setState({ selectedInputId: audioInputs[0].deviceId });
      }
    } catch {
      // Permissions may not be granted yet
    }
  }

  selectInput(deviceId: string): void {
    this.setState({ selectedInputId: deviceId });
  }

  // ─── Start / Stop Recording ─────────────────────────────────────

  /**
   * Start recording from the selected audio input.
   * @param startBeat — The transport beat position to anchor the recording.
   */
  async startRecording(startBeat: number = 0): Promise<void> {
    if (this.state.isRecording) return;

    this.setState({ isPreparing: true, error: null });

    try {
      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      this.sampleRate = this.audioContext.sampleRate;

      // Get mic stream
      const constraints: MediaStreamConstraints = {
        audio: this.state.selectedInputId
          ? { deviceId: { exact: this.state.selectedInputId } }
          : true,
      };
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Connect: mic → analyser (for metering) + processor (for recording)
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Analyser for input level metering
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.sourceNode.connect(this.analyserNode);

      // ScriptProcessor to capture raw PCM samples
      // Using 4096 buffer size for low latency while being stable
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.recordedChunks = [];

      this.processorNode.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        // Copy the buffer (it gets reused by Web Audio)
        this.recordedChunks.push(new Float32Array(inputData));
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination); // Required for processing to run

      // Start metering
      this.startMetering();

      // Track timing
      this.recordingStartBeat = startBeat;
      this.recordingStartTime = Date.now();

      // Elapsed timer
      this.elapsedTimer = setInterval(() => {
        this.setState({
          elapsedSeconds: (Date.now() - this.recordingStartTime) / 1000,
        });
      }, 100);

      this.setState({
        isRecording: true,
        isPreparing: false,
        elapsedSeconds: 0,
        hasPermission: true,
      });

      console.log(`🎙️ Recording started at beat ${startBeat}`);
    } catch (err: any) {
      this.setState({
        isPreparing: false,
        error: `Failed to start recording: ${err.message}`,
      });
      this.cleanup();
    }
  }

  /**
   * Stop recording and return the result.
   */
  async stopRecording(): Promise<RecordingResult | null> {
    if (!this.state.isRecording) return null;

    this.setState({ isRecording: false });

    // Stop metering and elapsed timer
    this.stopMetering();
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }

    // Calculate duration
    const durationSeconds = (Date.now() - this.recordingStartTime) / 1000;

    // Merge all recorded chunks into a single buffer
    const totalSamples = this.recordedChunks.reduce((sum, chunk) => sum + chunk.length, 0);

    if (totalSamples === 0) {
      this.cleanup();
      return null;
    }

    const mergedSamples = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of this.recordedChunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    // Create an AudioBuffer
    const buffer = new AudioBuffer({
      length: totalSamples,
      numberOfChannels: 1,
      sampleRate: this.sampleRate,
    });
    buffer.copyToChannel(mergedSamples, 0);

    // Generate waveform peaks for visualization
    const waveformPeaks = this.generateWaveformPeaks(mergedSamples, 200);

    // Convert to WAV blob
    const blob = audioBufferToWav(buffer);
    const url = URL.createObjectURL(blob);

    // Cleanup mic and audio nodes
    this.cleanup();

    const result: RecordingResult = {
      blob,
      url,
      durationSeconds,
      startBeat: this.recordingStartBeat,
      waveformPeaks,
      buffer,
    };

    console.log(`🎙️ Recording complete: ${durationSeconds.toFixed(1)}s, ${totalSamples} samples`);
    return result;
  }

  /**
   * Cancel an in-progress recording without saving.
   */
  cancelRecording(): void {
    this.setState({ isRecording: false });
    this.stopMetering();
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
    this.recordedChunks = [];
    this.cleanup();
  }

  // ─── Input Level Metering ───────────────────────────────────────

  private startMetering(): void {
    if (!this.analyserNode) return;

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const tick = () => {
      if (!this.analyserNode) return;

      this.analyserNode.getByteTimeDomainData(dataArray);

      // Calculate RMS level
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      this.setState({ inputLevel: Math.min(1, rms * 3) }); // Scale up for visibility

      this.meterAnimFrame = requestAnimationFrame(tick);
    };

    tick();
  }

  private stopMetering(): void {
    if (this.meterAnimFrame !== null) {
      cancelAnimationFrame(this.meterAnimFrame);
      this.meterAnimFrame = null;
    }
    this.setState({ inputLevel: 0 });
  }

  // ─── Waveform Peak Generation ───────────────────────────────────

  private generateWaveformPeaks(samples: Float32Array, numPeaks: number): number[] {
    const peaks: number[] = [];
    const samplesPerPeak = Math.floor(samples.length / numPeaks);

    for (let i = 0; i < numPeaks; i++) {
      let max = 0;
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, samples.length);

      for (let j = start; j < end; j++) {
        const abs = Math.abs(samples[j]);
        if (abs > max) max = abs;
      }

      peaks.push(max);
    }

    return peaks;
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  private cleanup(): void {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  dispose(): void {
    this.cancelRecording();
    this.listeners.clear();
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

let _instance: TimelineRecorder | null = null;

export function getTimelineRecorder(): TimelineRecorder {
  if (!_instance) {
    _instance = new TimelineRecorder();
  }
  return _instance;
}
