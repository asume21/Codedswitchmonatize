import { RmsAnalyzer } from './algorithms/RmsAnalyzer'
import { PitchDetector } from './algorithms/PitchDetector'
import { OnsetDetector } from './algorithms/OnsetDetector'
import { SpectralAnalyzer } from './algorithms/SpectralAnalyzer'
import {
  AnalysisConfig,
  AnalysisFrame,
  AnalysisFrameCallback,
  DEFAULT_ANALYSIS_CONFIG,
} from './types'
import { getAudioContext, resumeAudioContext } from '../../lib/audioContext'

type MessagePayload = {
  type: 'frame'
  frameIndex: number
  buffer: Float32Array
}

export class AudioAnalysisEngine {
  private config: AnalysisConfig
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private analyserNode: AnalyserNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private silentSink: GainNode | null = null
  private stream: MediaStream | null = null

  private readonly rmsAnalyzer: RmsAnalyzer
  private readonly pitchDetector: PitchDetector
  private readonly onsetDetector: OnsetDetector
  private readonly spectralAnalyzer: SpectralAnalyzer

  private readonly callbacks: Set<AnalysisFrameCallback> = new Set()

  private running = false
  private frameIndex = 0
  private lastFrame: AnalysisFrame | null = null

  // Adaptive voice-activity threshold. On start() we measure the ambient noise
  // floor (which includes beat bleed through speakers) for ~1.4 seconds, then
  // set the threshold to 3.5× that floor. Rapping is always much louder than
  // beat bleed, so this keeps voiceActive false when the beat plays but you're
  // not rapping, and true when you are.
  private readonly CALIBRATION_FRAMES = 60   // ~1.4s at typical frame rate
  private calibrationFrames = 0
  private calibrationPeakRms = 0
  private adaptiveVoiceThreshold: number

  /**
   * Returns the live MediaStream if the mic is open, else null. Callers
   * (e.g. the Organism's MediaRecorder) can reuse this instead of calling
   * getUserMedia a second time, which would open a competing mic stream.
   */
  getStream(): MediaStream | null {
    return this.stream
  }
  private readonly frequencyData: Float32Array<ArrayBuffer>

  private readonly linearSpectrumData: Float32Array<ArrayBuffer>

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = {
      ...DEFAULT_ANALYSIS_CONFIG,
      ...config,
    }
    this.adaptiveVoiceThreshold = this.config.voiceActivityThreshold

    this.rmsAnalyzer = new RmsAnalyzer(
      this.config.sampleRate,
      this.config.frameSize,
      this.config.smoothingAttackMs,
      this.config.smoothingReleaseMs,
    )

    this.pitchDetector = new PitchDetector(
      this.config.sampleRate,
      this.config.frameSize,
      this.config.pitchMinHz,
      this.config.pitchMaxHz,
    )

    this.onsetDetector = new OnsetDetector(
      this.config.sampleRate,
      this.config.frameSize,
      this.config.onsetThreshold,
    )

    this.spectralAnalyzer = new SpectralAnalyzer(
      this.config.sampleRate,
      this.config.frameSize,
    )

    this.frequencyData = new Float32Array(new ArrayBuffer(this.config.frameSize / 2 * Float32Array.BYTES_PER_ELEMENT))
    this.linearSpectrumData = new Float32Array(new ArrayBuffer(this.config.frameSize / 2 * Float32Array.BYTES_PER_ELEMENT))
  }

  async start(): Promise<void> {
    if (this.running) {
      return
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: this.config.sampleRate,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    await resumeAudioContext()
    this.audioContext = getAudioContext()

    await this.audioContext.audioWorklet.addModule('/organism/worklets/analysis-worklet-processor.js')

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)
    this.analyserNode = this.audioContext.createAnalyser()
    this.analyserNode.fftSize = this.config.frameSize * 2
    this.analyserNode.smoothingTimeConstant = 0

    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      'analysis-worklet-processor',
    )

    this.sourceNode.connect(this.analyserNode)
    this.analyserNode.connect(this.workletNode)
    this.silentSink = this.audioContext.createGain()
    this.silentSink.gain.value = 0
    this.workletNode.connect(this.silentSink)
    this.silentSink.connect(this.audioContext.destination)

    this.workletNode.port.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data
      if (!data || typeof data !== 'object' || !('type' in data)) {
        return
      }

      const payload = data as MessagePayload
      if (payload.type !== 'frame') {
        return
      }

      if (!payload.buffer) {
        return
      }

      this.onWorkletFrame(payload.buffer, payload.frameIndex)
    }

    this.running = true
  }

  stop(): void {
    if (!this.running) {
      return
    }

    if (this.workletNode) {
      this.workletNode.port.onmessage = null
    }
    this.workletNode?.disconnect()
    this.silentSink?.disconnect()
    this.analyserNode?.disconnect()
    this.sourceNode?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())

    this.workletNode = null
    this.analyserNode = null
    this.sourceNode = null
    this.silentSink = null
    this.stream = null
    this.audioContext = null
    this.running = false
    this.frameIndex = 0

    this.rmsAnalyzer.reset()
    this.onsetDetector.reset()
    this.spectralAnalyzer.reset()
  }

  subscribe(callback: AnalysisFrameCallback): () => void {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  isRunning(): boolean {
    return this.running
  }

  /**
   * Reset the adaptive noise-floor calibration. Call this whenever the beat
   * starts or the preset changes so the threshold re-calibrates against the
   * new ambient level (beat bleed + room noise).
   */
  recalibrate(): void {
    this.calibrationFrames = 0
    this.calibrationPeakRms = 0
    this.adaptiveVoiceThreshold = this.config.voiceActivityThreshold
  }

  getLastFrame(): AnalysisFrame | null {
    return this.lastFrame
  }

  private onWorkletFrame(buffer: Float32Array, _workletFrameIndex: number): void {
    if (!this.analyserNode) {
      return
    }

    const now = performance.now()
    const linearSpectrum = this.linearSpectrumData

    this.analyserNode.getFloatFrequencyData(this.frequencyData)
    for (let index = 0; index < this.frequencyData.length; index += 1) {
      linearSpectrum[index] = Math.pow(10, this.frequencyData[index] / 20)
    }

    let { rms, rmsRaw } = this.rmsAnalyzer.process(buffer)

    // Noise gate: zero out signal below threshold so ambient room noise
    // doesn't trigger the physics engine or wake the organism
    if (rms < this.config.noiseGateThreshold) {
      rms = 0
      rmsRaw = 0
    }

    const {
      pitch,
      confidence: pitchConfidence,
      midi: pitchMidi,
      cents: pitchCents,
    } = this.pitchDetector.process(buffer)

    const {
      detected: onsetDetected,
      strength: onsetStrength,
      timestamp: onsetTimestamp,
    } = this.onsetDetector.process(linearSpectrum, now)

    const {
      centroid: spectralCentroid,
      hnr,
      flux: spectralFlux,
    } = this.spectralAnalyzer.process(linearSpectrum)

    // Calibration window: measure peak ambient RMS (beat bleed + room noise)
    // for the first ~1.4s, then lock the adaptive threshold to 3.5× that floor.
    // Rapping voice will always be significantly louder than passive beat bleed.
    if (this.calibrationFrames < this.CALIBRATION_FRAMES) {
      this.calibrationFrames++
      if (rms > this.calibrationPeakRms) this.calibrationPeakRms = rms
      if (this.calibrationFrames === this.CALIBRATION_FRAMES) {
        this.adaptiveVoiceThreshold = Math.max(
          this.config.voiceActivityThreshold,
          this.calibrationPeakRms * 3.5,
        )
      }
    }

    const voiceActive = rms > this.adaptiveVoiceThreshold
    const voiceConfidence = Math.min(1, rms / (this.adaptiveVoiceThreshold * 5))

    const frame: AnalysisFrame = {
      timestamp: now,
      frameIndex: this.frameIndex,
      sampleRate: this.config.sampleRate,
      rms,
      rmsRaw,
      pitch,
      pitchConfidence,
      pitchMidi,
      pitchCents,
      spectralCentroid,
      hnr,
      spectralFlux,
      onsetDetected,
      onsetStrength,
      onsetTimestamp,
      voiceActive,
      voiceConfidence,
      ...(this.config.debugMode && { rawBuffer: buffer }),
    }

    this.frameIndex += 1
    this.lastFrame = frame

    this.callbacks.forEach((callback) => {
      callback(frame)
    })
  }
}
