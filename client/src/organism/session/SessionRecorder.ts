import type {
  PhysicsSnapshot,
  StateSnapshot,
  GeneratorEvent,
  TransitionSnapshot,
  CaptureConfig,
}                          from './types'
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import type { TransitionEvent } from '../state/types'

export class SessionRecorder {
  private readonly config: CaptureConfig

  private physicsTimeline:  PhysicsSnapshot[]  = []
  private stateTimeline:    StateSnapshot[]     = []
  private generatorEvents:  GeneratorEvent[]    = []
  private transitions:      TransitionSnapshot[] = []

  private sessionStartMs:   number = -1
  private frameCounter:     number = 0

  constructor(config: CaptureConfig) {
    this.config = config
  }

  start(): void {
    this.sessionStartMs = performance.now()
    this.frameCounter   = 0
    this.physicsTimeline  = []
    this.stateTimeline    = []
    this.generatorEvents  = []
    this.transitions      = []
  }

  recordFrame(physics: PhysicsState, organism: OrganismState): void {
    this.frameCounter++

    if (this.frameCounter % this.config.timelineSampleRate !== 0) return

    const physicsSnap: PhysicsSnapshot = {
      frameIndex:  physics.frameIndex,
      timestamp:   physics.timestamp,
      pulse:       physics.pulse,
      bounce:      physics.bounce,
      swing:       physics.swing,
      pocket:      physics.pocket,
      presence:    physics.presence,
      density:     physics.density,
      mode:        physics.mode,
      voiceActive: physics.voiceActive,
    }

    const stateSnap: StateSnapshot = {
      frameIndex:      organism.frameIndex,
      timestamp:       organism.timestamp,
      state:           organism.current,
      flowDepth:       organism.flowDepth,
      syllabicDensity: organism.syllabicDensity,
    }

    this.physicsTimeline.push(physicsSnap)
    this.stateTimeline.push(stateSnap)

    const maxEntries = (2 * 60 * 43) / this.config.timelineSampleRate
    if (this.physicsTimeline.length > maxEntries) {
      this.physicsTimeline.shift()
      this.stateTimeline.shift()
    }
  }

  recordTransition(event: TransitionEvent): void {
    this.transitions.push({
      frameIndex: event.physicsSnapshot.frameIndex,
      timestamp:  event.timestamp,
      from:       event.from,
      to:         event.to,
      physicsAtTransition: {
        frameIndex:  event.physicsSnapshot.frameIndex,
        timestamp:   event.physicsSnapshot.timestamp,
        pulse:       event.physicsSnapshot.pulse,
        bounce:      event.physicsSnapshot.bounce,
        swing:       event.physicsSnapshot.swing,
        pocket:      event.physicsSnapshot.pocket,
        presence:    event.physicsSnapshot.presence,
        density:     event.physicsSnapshot.density,
        mode:        event.physicsSnapshot.mode,
        voiceActive: event.physicsSnapshot.voiceActive,
      },
    })
  }

  recordGeneratorEvent(event: GeneratorEvent): void {
    if (this.generatorEvents.length >= this.config.maxGeneratorEvents) {
      this.generatorEvents.shift()
    }
    this.generatorEvents.push(event)
  }

  getData(): {
    physicsTimeline:  PhysicsSnapshot[]
    stateTimeline:    StateSnapshot[]
    generatorEvents:  GeneratorEvent[]
    transitions:      TransitionSnapshot[]
    sessionStartMs:   number
    currentMs:        number
  } {
    return {
      physicsTimeline:  [...this.physicsTimeline],
      stateTimeline:    [...this.stateTimeline],
      generatorEvents:  [...this.generatorEvents],
      transitions:      [...this.transitions],
      sessionStartMs:   this.sessionStartMs,
      currentMs:        performance.now(),
    }
  }

  getDurationMs(): number {
    if (this.sessionStartMs < 0) return 0
    return performance.now() - this.sessionStartMs
  }

  reset(): void {
    this.physicsTimeline  = []
    this.stateTimeline    = []
    this.generatorEvents  = []
    this.transitions      = []
    this.sessionStartMs   = -1
    this.frameCounter     = 0
  }
}
