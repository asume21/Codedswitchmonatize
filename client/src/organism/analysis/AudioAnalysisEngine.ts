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
  private stream: MediaStream | null = null

  private readonly rmsAnalyzer: RmsAnalyzer
  private readonly pitchDetector: PitchDetector
  private readonly onsetDetector: OnsetDetector
  private readonly spectralAnalyzer: SpectralAnalyzer

  private readonly callbacks: Set<AnalysisFrameCallback> = new Set()

  private running = false
  private frameIndex = 0
  private lastFrame: AnalysisFrame | null = null
  private readonly frequencyData: Float32Array<ArrayBuffer>

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = {
      ...DEFAULT_ANALYSIS_CONFIG,
      ...config,
    }

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
        autoGainControl: false,
      },
    })

    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate,
    })

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
    this.analyserNode?.disconnect()
    this.sourceNode?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    this.audioContext?.close()

    this.workletNode = null
    this.analyserNode = null
    this.sourceNode = null
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

  getLastFrame(): AnalysisFrame | null {
    return this.lastFrame
  }

  private onWorkletFrame(buffer: Float32Array, _workletFrameIndex: number): void {
    if (!this.analyserNode) {
      return
    }

    const now = performance.now()
    const linearSpectrum = new Float32Array(this.frequencyData.length)

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

    const voiceActive = rms > this.config.voiceActivityThreshold
    const voiceConfidence = Math.min(1, rms / (this.config.voiceActivityThreshold * 5))

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
