import type { AnalysisFrame, AnalysisFrameCallback } from '../analysis/types'
import type { InputSource } from './types'

/**
 * Fully autonomous input source that generates its own physics curve
 * without any external input. The Organism becomes a self-driving
 * generative beat machine.
 *
 * Uses layered sine waves, Perlin-like noise, and periodic "breath"
 * patterns to create organic, evolving AnalysisFrame sequences.
 */

type EnergyProfile = 'chill' | 'medium' | 'intense'

interface AutoGenerateConfig {
  bpm: number
  energy: EnergyProfile
}

const ENERGY_PARAMS: Record<EnergyProfile, {
  rmsBase: number
  rmsRange: number
  pitchCenter: number
  pitchRange: number
  onsetRate: number
  centroidBase: number
  breathCycleSec: number
}> = {
  chill: {
    rmsBase: 0.22,
    rmsRange: 0.10,
    pitchCenter: 180,
    pitchRange: 60,
    onsetRate: 0.45,
    centroidBase: 800,
    breathCycleSec: 12,
  },
  medium: {
    rmsBase: 0.40,
    rmsRange: 0.18,
    pitchCenter: 250,
    pitchRange: 120,
    onsetRate: 0.65,
    centroidBase: 1500,
    breathCycleSec: 8,
  },
  intense: {
    rmsBase: 0.58,
    rmsRange: 0.22,
    pitchCenter: 320,
    pitchRange: 200,
    onsetRate: 0.80,
    centroidBase: 2500,
    breathCycleSec: 5,
  },
}

export class AutoGenerateSource implements InputSource {
  private running = false
  private frameIndex = 0
  private lastFrame: AnalysisFrame | null = null
  private readonly callbacks = new Set<AnalysisFrameCallback>()
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private startTime = 0

  private readonly bpm: number
  private readonly params: typeof ENERGY_PARAMS['medium']

  // Internal noise state for smooth randomness
  private noisePhase = 0
  private noiseStep = 0.013
  private drift = 0

  private static readonly FRAME_INTERVAL_MS = 23 // ~43 fps

  constructor(config: Partial<AutoGenerateConfig> = {}) {
    this.bpm = config.bpm ?? 90
    this.params = ENERGY_PARAMS[config.energy ?? 'medium']
  }

  async start(): Promise<void> {
    if (this.running) return

    this.running = true
    this.frameIndex = 0
    this.startTime = performance.now()
    this.noisePhase = Math.random() * 1000

    this.tickInterval = setInterval(
      () => this.emitFrame(),
      AutoGenerateSource.FRAME_INTERVAL_MS,
    )
  }

  stop(): void {
    if (!this.running) return

    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }

    this.running = false
    this.frameIndex = 0
  }

  subscribe(callback: AnalysisFrameCallback): () => void {
    this.callbacks.add(callback)
    return () => { this.callbacks.delete(callback) }
  }

  isRunning(): boolean { return this.running }
  getLastFrame(): AnalysisFrame | null { return this.lastFrame }

  private emitFrame(): void {
    const now = performance.now()
    const elapsed = (now - this.startTime) / 1000 // seconds
    const p = this.params

    // Breathing cycle — slow sine envelope
    const breathPhase = (elapsed / p.breathCycleSec) * Math.PI * 2
    const breath = (Math.sin(breathPhase) + 1) / 2 // 0..1

    // Layered noise for organic variation
    this.noisePhase += this.noiseStep
    const noise1 = Math.sin(this.noisePhase * 2.3 + 0.7)
    const noise2 = Math.sin(this.noisePhase * 5.1 + 2.1)
    const noise3 = Math.sin(this.noisePhase * 0.8 + 4.3)

    // Slow drift for long-term evolution
    this.drift += (Math.random() - 0.5) * 0.002
    this.drift = Math.max(-0.2, Math.min(0.2, this.drift))

    // RMS — breathing + noise
    const rms = clamp(
      p.rmsBase + p.rmsRange * breath * 0.6 + noise1 * p.rmsRange * 0.3 + this.drift,
      0, 1,
    )

    // Pitch — slow wander with breath modulation
    const pitchHz = clamp(
      p.pitchCenter + p.pitchRange * noise3 * 0.5 + breath * p.pitchRange * 0.3,
      60, 1200,
    )
    const pitchMidi = Math.round(69 + 12 * Math.log2(pitchHz / 440))

    // Onsets — probabilistic at BPM-derived rate
    const beatInterval = 60 / this.bpm
    const beatPhase = (elapsed % beatInterval) / beatInterval
    const onsetDetected = beatPhase < 0.08 && Math.random() < p.onsetRate + breath * 0.2
    const onsetStrength = onsetDetected ? 0.5 + Math.random() * 0.5 : 0

    // Spectral centroid — brightness follows energy
    const spectralCentroid = clamp(
      p.centroidBase + noise2 * 800 + breath * 600,
      200, 8000,
    )

    // Voice active when rms is above threshold
    const voiceActive = rms > 0.05
    const voiceConfidence = Math.min(1, rms * 3)

    const frame: AnalysisFrame = {
      timestamp: now,
      frameIndex: this.frameIndex,
      sampleRate: 44100,
      rms,
      rmsRaw: rms,
      pitch: pitchHz,
      pitchConfidence: voiceActive ? 0.8 + noise1 * 0.15 : 0,
      pitchMidi,
      pitchCents: 0,
      spectralCentroid,
      hnr: voiceActive ? 10 + noise2 * 5 : 0,
      spectralFlux: clamp(0.1 + noise1 * 0.15 + breath * 0.2, 0, 1),
      onsetDetected,
      onsetStrength,
      onsetTimestamp: onsetDetected ? now : 0,
      voiceActive,
      voiceConfidence,
    }

    this.frameIndex += 1
    this.lastFrame = frame
    this.callbacks.forEach((cb) => cb(frame))
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
