import type { AnalysisFrame }    from '../analysis/types'
import type { PhysicsProfile }   from '../evolution/types'
import {
  DEFAULT_PHYSICS_CONFIG,
  OrganismMode,
  type PhysicsConfig,
  type PhysicsState,
  type PhysicsStateCallback,
} from './types'
import { PulseTracker }          from './computers/PulseTracker'
import { BounceComputer }        from './computers/BounceComputer'
import { SwingComputer }         from './computers/SwingComputer'
import { PresenceComputer }      from './computers/PresenceComputer'
import { PocketComputer }        from './computers/PocketComputer'
import { DensityComputer }       from './computers/DensityComputer'
import { ModeClassifier }        from './computers/ModeClassifier'

const SAMPLE_RATE = 44100
const FRAME_SIZE  = 1024

export class PhysicsEngine {
  private readonly config: PhysicsConfig

  private readonly pulseTracker:     PulseTracker
  private readonly bounceComputer:   BounceComputer
  private readonly swingComputer:    SwingComputer
  private readonly presenceComputer: PresenceComputer
  private readonly pocketComputer:   PocketComputer
  private readonly densityComputer:  DensityComputer
  private readonly modeClassifier:   ModeClassifier

  private callbacks: Set<PhysicsStateCallback> = new Set()
  private lastState: PhysicsState | null = null
  private profile: PhysicsProfile | null = null
  private lockedMode: OrganismMode | null = null  // when set, ModeClassifier is bypassed

  constructor(config: Partial<PhysicsConfig> = {}) {
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config }

    this.pulseTracker = new PulseTracker(
      this.config.pulseMinBpm,
      this.config.pulseMaxBpm,
      this.config.pulseInertiaBars,
      this.config.pulseConfidenceMin
    )
    this.bounceComputer = new BounceComputer(
      this.config.bounceWindowFrames,
      this.config.bounceSmoothing
    )
    this.swingComputer = new SwingComputer(
      this.config.swingWindowOnsets,
      this.config.swingSmoothing
    )
    this.presenceComputer = new PresenceComputer(
      SAMPLE_RATE, FRAME_SIZE,
      this.config.presenceAttackMs,
      this.config.presenceReleaseMs
    )
    this.pocketComputer = new PocketComputer(
      SAMPLE_RATE, FRAME_SIZE,
      this.config.pocketAttackMs,
      this.config.pocketReleaseMs
    )
    this.densityComputer = new DensityComputer(
      this.config.densityWindowFrames,
      this.config.densitySmoothing
    )
    this.modeClassifier = new ModeClassifier(
      this.config.modeWindowFrames,
      this.config.modeHysteresisFrames
    )
  }

  processFrame(frame: AnalysisFrame): void {
    const pulse = this.pulseTracker.process(
      frame.onsetDetected,
      frame.onsetTimestamp,
      frame.onsetStrength
    )

    const beatDurationMs      = 60000 / pulse
    const sixteenthDurationMs = beatDurationMs / 4

    const gridDeviationMs = frame.onsetDetected
      ? this.computeGridDeviation(frame.onsetTimestamp, sixteenthDurationMs)
      : 0

    const bouncRaw = this.bounceComputer.process(frame.onsetDetected, gridDeviationMs)
    const swingRaw  = this.swingComputer.process(frame.onsetDetected, frame.onsetTimestamp)

    const presenceRaw = this.presenceComputer.process(frame.rms, frame.spectralCentroid)
    const pocketRaw   = this.pocketComputer.process(presenceRaw, frame.voiceActive)

    const { density: densityRaw } = this.densityComputer.process(presenceRaw)

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
    const bounce   = clamp01(bouncRaw   + (this.profile?.bounceBias   ?? 0))
    const swing    = clamp01(swingRaw   + (this.profile?.swingBias    ?? 0))
    const presence = clamp01(presenceRaw + (this.profile?.presenceBias ?? 0))
    const pocket   = clamp01(pocketRaw  + (this.profile?.pocketBias   ?? 0))
    const density  = clamp01(densityRaw + (this.profile?.densityBias  ?? 0))

    // If a genre preset locked the mode, bypass the classifier entirely
    const mode = this.lockedMode ?? this.modeClassifier.process(
      frame.rms,
      frame.pitch,
      frame.spectralCentroid,
      frame.hnr
    )

    const swungSixteenthMs = sixteenthDurationMs * swing * 2

    const pulseBiased = Math.max(
      this.config.pulseMinBpm,
      Math.min(this.config.pulseMaxBpm, pulse + (this.profile?.pulseBias ?? 0))
    )

    const state: PhysicsState = {
      bounce,
      swing,
      pocket,
      presence,
      density,
      mode,
      pulse: pulseBiased,
      beatDurationMs,
      sixteenthDurationMs,
      swungSixteenthMs,
      timestamp:   frame.timestamp,
      frameIndex:  frame.frameIndex,
      voiceActive: frame.voiceActive,
    }

    this.lastState = state
    this.callbacks.forEach(cb => cb(state))
  }

  subscribe(callback: PhysicsStateCallback): () => void {
    this.callbacks.add(callback)
    return () => { this.callbacks.delete(callback) }
  }

  getLastState(): PhysicsState | null {
    return this.lastState
  }

  setProfile(profile: PhysicsProfile | null): void {
    this.profile = profile
  }

  /** Lock the mode to a specific value (genre preset). ModeClassifier is bypassed. */
  lockMode(mode: OrganismMode): void {
    this.lockedMode = mode
  }

  /** Unlock mode — ModeClassifier resumes control. */
  unlockMode(): void {
    this.lockedMode = null
  }

  getLockedMode(): OrganismMode | null {
    return this.lockedMode
  }

  registerGeneratorLevel(name: string, level: number): void {
    this.densityComputer.registerGeneratorLevel(name, level)
  }

  reset(): void {
    this.pulseTracker.reset()
    this.bounceComputer.reset()
    this.swingComputer.reset()
    this.presenceComputer.reset()
    this.pocketComputer.reset()
    this.densityComputer.reset()
    this.modeClassifier.reset()
    this.lastState = null
  }

  private computeGridDeviation(
    onsetTimestamp: number,
    sixteenthDurationMs: number
  ): number {
    if (sixteenthDurationMs <= 0) return 0
    const phase    = onsetTimestamp % sixteenthDurationMs
    const halfGrid = sixteenthDurationMs / 2
    return phase > halfGrid ? phase - sixteenthDurationMs : phase
  }
}
