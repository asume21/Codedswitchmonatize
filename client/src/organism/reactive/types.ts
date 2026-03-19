// Section 05 — Reactive Behavior Types

import type { AnalysisFrame }  from '../analysis/types'
import type { PhysicsState }   from '../physics/types'
import type { OrganismState }  from '../state/types'

// Full context passed to every behavior every frame
export interface ReactiveContext {
  frame:    AnalysisFrame
  physics:  PhysicsState
  organism: OrganismState
  now:      number          // performance.now()
}

// What a behavior wants to mutate this frame
export interface BehaviorOutput {
  // Drum mutations
  hatDensityMultiplier:   number   // 1.0 = no change. < 1 = thin. > 1 = dense.
  kickVelocityMultiplier: number   // 1.0 = no change.
  // Bass mutations
  bassVolumeMultiplier:   number   // 1.0 = no change.
  // Melody mutations
  melodyPitchOffsetSemitones: number  // integer semitone shift, 0 = no change
  melodyVolumeMultiplier:     number
  // Texture mutations
  textureVolumeMultiplier: number
  // Global
  masterDuckMultiplier:    number   // applies to everything except voice
}

export const NEUTRAL_BEHAVIOR_OUTPUT: BehaviorOutput = {
  hatDensityMultiplier:       1.0,
  kickVelocityMultiplier:     1.0,
  bassVolumeMultiplier:       1.0,
  melodyPitchOffsetSemitones: 0,
  melodyVolumeMultiplier:     1.0,
  textureVolumeMultiplier:    1.0,
  masterDuckMultiplier:       1.0,
}

export interface ReactiveConfig {
  // SyllabicBreathing
  syllabicHatDenseThreshold:  number
  syllabicHatSparseThreshold: number
  syllabicSmoothing:          number

  // PitchEmpathy
  pitchRiseMinSyllables:      number
  pitchEmpathySemitones:      number
  pitchEmpathySmoothing:      number

  // PauseResponse
  pauseMinBeats:              number
  pauseMaxBars:               number

  // EnergyMirroring
  energyMirrorSmoothing:      number

  // TensionRelease
  tensionBuildBars:           number
  tensionReleaseWindowBars:   number

  // PresenceDucking
  presenceDuckThreshold:      number
  presenceDuckDepth:          number
  presenceDuckAttackMs:       number
  presenceDuckReleaseMs:      number
}

export const DEFAULT_REACTIVE_CONFIG: ReactiveConfig = {
  syllabicHatDenseThreshold:  3.0,
  syllabicHatSparseThreshold: 1.0,
  syllabicSmoothing:          0.08,
  pitchRiseMinSyllables:      4,
  pitchEmpathySemitones:      7,
  pitchEmpathySmoothing:      0.04,
  pauseMinBeats:              1,
  pauseMaxBars:               4,
  energyMirrorSmoothing:      0.12,
  tensionBuildBars:           6,
  tensionReleaseWindowBars:   2,
  presenceDuckThreshold:      0.6,
  presenceDuckDepth:          0.4,
  presenceDuckAttackMs:       15,
  presenceDuckReleaseMs:      250,
}
