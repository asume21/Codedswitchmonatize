import {
  OState,
  OTransition,
  OrganismState,
  TransitionEvent,
  StateMachineConfig,
  DEFAULT_STATE_MACHINE_CONFIG,
  OrganismStateCallback,
  TransitionEventCallback,
} from './types'
import type { PhysicsState } from '../physics/types'
import { evaluateDormantTransition }   from './transitions/DormantTransition'
import { evaluateAwakeningTransition } from './transitions/AwakeningTransition'
import { evaluateBreathingTransition } from './transitions/BreathingTransition'
import { evaluateFlowTransition }      from './transitions/FlowTransition'

const FRAME_ESTIMATE_MS = 1000 / 43

export class StateMachine {
  private readonly config: StateMachineConfig

  private state: OrganismState

  private stateCallbacks: Set<OrganismStateCallback> = new Set()
  private transitionCallbacks: Set<TransitionEventCallback> = new Set()

  private onsetCountBuffer: number[] = []
  private currentBeatOnsets: number = 0
  private lastBeatTimestamp: number = Number.NEGATIVE_INFINITY
  private lastFrameTimestamp: number = Number.NEGATIVE_INFINITY

  constructor(config: Partial<StateMachineConfig> = {}) {
    this.config = { ...DEFAULT_STATE_MACHINE_CONFIG, ...config }
    this.state  = this.makeInitialState()
  }

  processFrame(physics: PhysicsState): OrganismState {
    const now = physics.timestamp

    // 1. silence tracking
    this.updateSilenceTracking(physics, now)

    // 2. syllabic density
    this.updateSyllabicDensity(physics)

    // 3. timers in-state
    this.updateTimeCounters(physics)

    // 4. progress values
    this.updateProgressValues()

    // 5. transition evaluation
    const transition = this.evaluateTransition(physics)

    // 6. apply transition if any
    if (transition !== null) {
      this.applyTransition(transition, physics)
    }

    // 7. stamp frame metadata
    this.state.timestamp  = now
    this.state.frameIndex = physics.frameIndex
    this.stateCallbacks.forEach((callback) => callback({ ...this.state }))

    return { ...this.state }
  }

  subscribe(callback: OrganismStateCallback): () => void {
    this.stateCallbacks.add(callback)
    return () => this.stateCallbacks.delete(callback)
  }

  onTransition(callback: TransitionEventCallback): () => void {
    this.transitionCallbacks.add(callback)
    return () => this.transitionCallbacks.delete(callback)
  }

  getCurrentState(): OrganismState {
    return { ...this.state }
  }

  forceState(target: OState, physics: PhysicsState): void {
    const transition = this.resolveForceTransition(this.state.current, target)
    if (transition) this.applyTransition(transition, physics)
  }

  reset(): void {
    this.state = this.makeInitialState()
    this.onsetCountBuffer  = []
    this.currentBeatOnsets = 0
    this.lastBeatTimestamp = Number.NEGATIVE_INFINITY
    this.lastFrameTimestamp = Number.NEGATIVE_INFINITY
  }

  private updateSilenceTracking(physics: PhysicsState, now: number): void {
    const deltaMs = this.frameDeltaMs(now)

    if (physics.voiceActive) {
      this.state.silenceDurationMs = 0
    } else {
      this.state.silenceDurationMs += deltaMs
    }
  }

  private updateSyllabicDensity(physics: PhysicsState): void {
    const now = physics.timestamp

    if (this.lastBeatTimestamp === Number.NEGATIVE_INFINITY) {
      this.lastBeatTimestamp = now
    }

    const beatMs = Math.max(0, physics.beatDurationMs)
    const framesPerBeat = beatMs > 0
      ? Math.max(1, Math.round(beatMs / FRAME_ESTIMATE_MS))
      : 43

    // Add inferred onsets into current beat window.
    if (physics.voiceActive) {
      const syllableProxy = Math.max(0, Math.min(4, physics.presence * 4))
      this.currentBeatOnsets += syllableProxy / framesPerBeat
    }

    if (beatMs > 0 && now - this.lastBeatTimestamp >= beatMs) {
      const elapsedBeats = Math.floor((now - this.lastBeatTimestamp) / beatMs)
      for (let i = 0; i < elapsedBeats; i += 1) {
        this.onsetCountBuffer.push(Math.min(8, this.currentBeatOnsets))
        const maxBeats = this.config.syllabicDensityWindowBars * 4
        if (this.onsetCountBuffer.length > maxBeats) {
          this.onsetCountBuffer.shift()
        }
        this.currentBeatOnsets = 0
        this.lastBeatTimestamp += beatMs
      }
    }

    if (this.onsetCountBuffer.length > 0) {
      const total = this.onsetCountBuffer.reduce((acc, value) => acc + value, 0)
      this.state.syllabicDensity = total / this.onsetCountBuffer.length
    } else {
      this.state.syllabicDensity = 0
    }

    // Track sustained cadence-lock readiness in bars-equivalent units.
    const aboveThreshold = this.state.syllabicDensity >= this.config.syllabicDensityThreshold
    const framesInWindow = this.config.syllabicDensityWindowBars * 4 * 43

    if (aboveThreshold) {
      this.state.cadenceLockBars = Math.min(
        this.state.cadenceLockBars + 1 / Math.max(1, framesInWindow),
        this.config.cadenceLockBarsRequired + 1
      )
    } else {
      this.state.cadenceLockBars = Math.max(0, this.state.cadenceLockBars - 0.005)
    }

  }

  private updateTimeCounters(physics: PhysicsState): void {
    const deltaMs = this.frameDeltaMs(physics.timestamp)
    this.state.framesInState += 1
    this.state.msInState += deltaMs

    const msPerBar = physics.beatDurationMs * 4
    this.state.barsInState = msPerBar > 0
      ? this.state.msInState / msPerBar
      : 0

    this.lastFrameTimestamp = physics.timestamp
  }

  private updateProgressValues(): void {
    if (this.state.current === OState.Awakening) {
      this.state.awakeningProgress = Math.min(
        1,
        this.state.barsInState / this.config.awakeningMinBars
      )
    } else {
      this.state.awakeningProgress = 0
    }

    if (this.state.current === OState.Breathing || this.state.current === OState.Flow) {
      this.state.breathingWarmth = Math.min(1, this.state.breathingWarmth + 0.003)
    }

    if (this.state.current === OState.Flow) {
      this.state.flowDepth = Math.min(1, this.state.flowDepth + 0.002)
    }
  }

  private evaluateTransition(physics: PhysicsState): OTransition | null {
    switch (this.state.current) {
      case OState.Dormant:
        return evaluateDormantTransition(this.state, physics, this.config)
      case OState.Awakening:
        return evaluateAwakeningTransition(this.state, physics, this.config)
      case OState.Breathing:
        return evaluateBreathingTransition(this.state, physics, this.config)
      case OState.Flow:
        return evaluateFlowTransition(this.state, physics, this.config)
      default:
        return null
    }
  }

  private applyTransition(transition: OTransition, physics: PhysicsState): void {
    const from = this.state.current
    const to = this.resolveTargetState(transition)

    const event: TransitionEvent = {
      from,
      to,
      transition,
      timestamp: physics.timestamp,
      physicsSnapshot: { ...physics },
    }

    this.transitionCallbacks.forEach((callback) => callback(event))

    this.state.previous = from
    this.state.current = to
    this.state.framesInState = 0
    this.state.msInState = 0
    this.state.barsInState = 0
    this.state.lastTransitionPhysics = { ...physics }

    const isFallback = [
      OTransition.FlowToBreathing,
      OTransition.FlowToDormant,
      OTransition.BreathingToAwakening,
      OTransition.BreathingToDormant,
      OTransition.AwakeningToDormant,
    ].includes(transition)

    if (isFallback) {
      this.state.flowDepth = 0
      if (to === OState.Awakening || to === OState.Dormant) {
        this.state.breathingWarmth = 0
      }
      if (to === OState.Dormant) {
        this.state.syllabicDensity = 0
        this.state.cadenceLockBars = 0
      }
    }

    if (to === OState.Flow) {
      this.state.cadenceLockAchieved = true
    }
  }

  private resolveTargetState(transition: OTransition): OState {
    const map: Record<OTransition, OState> = {
      [OTransition.DormantToAwakening]: OState.Awakening,
      [OTransition.AwakeningToBreathing]: OState.Breathing,
      [OTransition.BreathingToFlow]: OState.Flow,
      [OTransition.FlowToBreathing]: OState.Breathing,
      [OTransition.BreathingToAwakening]: OState.Awakening,
      [OTransition.BreathingToDormant]: OState.Dormant,
      [OTransition.AwakeningToDormant]: OState.Dormant,
      [OTransition.FlowToDormant]: OState.Dormant,
    }

    return map[transition]
  }

  private resolveForceTransition(from: OState, to: OState): OTransition | null {
    const map: Record<string, OTransition | undefined> = {
      [`${OState.Dormant}->${OState.Awakening}`]: OTransition.DormantToAwakening,
      [`${OState.Awakening}->${OState.Breathing}`]: OTransition.AwakeningToBreathing,
      [`${OState.Breathing}->${OState.Flow}`]: OTransition.BreathingToFlow,
      [`${OState.Flow}->${OState.Breathing}`]: OTransition.FlowToBreathing,
      [`${OState.Breathing}->${OState.Awakening}`]: OTransition.BreathingToAwakening,
      [`${OState.Breathing}->${OState.Dormant}`]: OTransition.BreathingToDormant,
      [`${OState.Awakening}->${OState.Dormant}`]: OTransition.AwakeningToDormant,
      [`${OState.Flow}->${OState.Dormant}`]: OTransition.FlowToDormant,
    }

    return map[`${from}->${to}`] ?? null
  }

  private frameDeltaMs(now: number): number {
    if (this.lastFrameTimestamp === Number.NEGATIVE_INFINITY) {
      return FRAME_ESTIMATE_MS
    }

    const delta = now - this.lastFrameTimestamp
    return delta >= 0 ? delta : FRAME_ESTIMATE_MS
  }

  private makeInitialState(): OrganismState {
    return {
      current: OState.Dormant,
      previous: null,
      framesInState: 0,
      msInState: 0,
      barsInState: 0,
      awakeningProgress: 0,
      breathingWarmth: 0,
      flowDepth: 0,
      syllabicDensity: 0,
      cadenceLockBars: 0,
      cadenceLockAchieved: false,
      silenceDurationMs: 0,
      lastTransitionPhysics: null,
      timestamp: 0,
      frameIndex: 0,
    }
  }
}
