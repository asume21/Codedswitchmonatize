import { RmsAnalyzer } from '../analysis/algorithms/RmsAnalyzer'
import { PitchDetector } from '../analysis/algorithms/PitchDetector'
import { OnsetDetector } from '../analysis/algorithms/OnsetDetector'
import { SpectralAnalyzer } from '../analysis/algorithms/SpectralAnalyzer'
import type { AnalysisFrame, AnalysisFrameCallback } from '../analysis/types'
import { DEFAULT_ANALYSIS_CONFIG } from '../analysis/types'
import type { InputSource } from './types'

/**
 * Routes audio file playback through the same analysis pipeline
 * as the mic-based AudioAnalysisEngine, producing identical
 * AnalysisFrame objects so the Organism reacts to the file content.
 *
 * Accepts a File object or a URL string.
 */
export class AudioFileSource implements InputSource {
  private running = false
  private frameIndex = 0
  private lastFrame: AnalysisFrame | null = null
  private readonly callbacks = new Set<AnalysisFrameCallback>()

  private audioContext: AudioContext | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private analyserNode: AnalyserNode | null = null
  private scriptNode: ScriptProcessorNode | null = null
  private audioElement: HTMLAudioElement | null = null

  private readonly rmsAnalyzer: RmsAnalyzer
  private readonly pitchDetector: PitchDetector
  private readonly onsetDetector: OnsetDetector
  private readonly spectralAnalyzer: SpectralAnalyzer

  private readonly config = DEFAULT_ANALYSIS_CONFIG
  private objectUrl: string | null = null

  constructor(private readonly fileOrUrl: File | string) {
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
  }

  async start(): Promise<void> {
    if (this.running) return

    this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate })

    // Create audio element from File or URL
    this.audioElement = new Audio()
    this.audioElement.crossOrigin = 'anonymous'

    if (this.fileOrUrl instanceof File) {
      this.objectUrl = URL.createObjectURL(this.fileOrUrl)
      this.audioElement.src = this.objectUrl
    } else {
      this.audioElement.src = this.fileOrUrl
    }

    // Wait for enough data to play
    await new Promise<void>((resolve, reject) => {
      if (!this.audioElement) { reject(new Error('No audio element')); return }
      this.audioElement.addEventListener('canplaythrough', () => resolve(), { once: true })
      this.audioElement.addEventListener('error', () => reject(new Error('Failed to load audio file')), { once: true })
      this.audioElement.load()
    })

    this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement)
    this.analyserNode = this.audioContext.createAnalyser()
    this.analyserNode.fftSize = this.config.frameSize * 2
    this.analyserNode.smoothingTimeConstant = 0

    // ScriptProcessorNode gives us raw time-domain buffers per frame
    // (AudioWorklet would be ideal but requires a separate file and CORS)
    this.scriptNode = this.audioContext.createScriptProcessor(this.config.frameSize, 1, 1)

    this.sourceNode.connect(this.analyserNode)
    this.analyserNode.connect(this.scriptNode)
    this.scriptNode.connect(this.audioContext.destination)
    // Also let the audio play through speakers
    this.sourceNode.connect(this.audioContext.destination)

    this.scriptNode.onaudioprocess = (event) => {
      const buffer = event.inputBuffer.getChannelData(0)
      this.processFrame(buffer)
    }

    // Auto-stop when file ends
    this.audioElement.addEventListener('ended', () => this.stop(), { once: true })

    this.running = true
    this.frameIndex = 0
    await this.audioElement.play()
  }

  stop(): void {
    if (!this.running) return

    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.currentTime = 0
    }

    this.scriptNode?.disconnect()
    this.analyserNode?.disconnect()
    this.sourceNode?.disconnect()
    this.audioContext?.close()

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }

    this.scriptNode = null
    this.analyserNode = null
    this.sourceNode = null
    this.audioContext = null
    this.audioElement = null
    this.running = false
    this.frameIndex = 0

    this.rmsAnalyzer.reset()
    this.onsetDetector.reset()
    this.spectralAnalyzer.reset()
  }

  subscribe(callback: AnalysisFrameCallback): () => void {
    this.callbacks.add(callback)
    return () => { this.callbacks.delete(callback) }
  }

  isRunning(): boolean { return this.running }
  getLastFrame(): AnalysisFrame | null { return this.lastFrame }

  private processFrame(buffer: Float32Array): void {
    if (!this.analyserNode) return

    const now = performance.now()
    const freqData = new Float32Array(this.config.frameSize / 2)
    this.analyserNode.getFloatFrequencyData(freqData)

    const linearSpectrum = new Float32Array(freqData.length)
    for (let i = 0; i < freqData.length; i++) {
      linearSpectrum[i] = Math.pow(10, freqData[i] / 20)
    }

    const { rms, rmsRaw } = this.rmsAnalyzer.process(buffer)
    const { pitch, confidence: pitchConfidence, midi: pitchMidi, cents: pitchCents } =
      this.pitchDetector.process(buffer)
    const { detected: onsetDetected, strength: onsetStrength, timestamp: onsetTimestamp } =
      this.onsetDetector.process(linearSpectrum, now)
    const { centroid: spectralCentroid, hnr, flux: spectralFlux } =
      this.spectralAnalyzer.process(linearSpectrum)

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
    }

    this.frameIndex += 1
    this.lastFrame = frame
    this.callbacks.forEach((cb) => cb(frame))
  }
}
