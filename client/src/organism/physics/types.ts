export enum OrganismMode {
  Heat   = 'heat',
  Ice    = 'ice',
  Smoke  = 'smoke',
  Gravel = 'gravel',
  Glow   = 'glow',
}

export interface PhysicsState {
  bounce:               number
  swing:                number
  pocket:               number
  presence:             number
  density:              number
  mode:                 OrganismMode
  pulse:                number
  beatDurationMs:       number
  sixteenthDurationMs:  number
  swungSixteenthMs:     number
  timestamp:            number
  frameIndex:           number
  voiceActive:          boolean
}

export interface PhysicsConfig {
  pulseMinBpm:          number
  pulseMaxBpm:          number
  pulseInertiaBars:     number
  pulseConfidenceMin:   number
  bounceWindowFrames:   number
  bounceSmoothing:      number
  swingWindowOnsets:    number
  swingSmoothing:       number
  pocketAttackMs:       number
  pocketReleaseMs:      number
  presenceAttackMs:     number
  presenceReleaseMs:    number
  densityWindowFrames:  number
  densitySmoothing:     number
  modeWindowFrames:     number
  modeHysteresisFrames: number
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  pulseMinBpm:          60,
  pulseMaxBpm:          180,
  pulseInertiaBars:     6,
  pulseConfidenceMin:   0.25,
  bounceWindowFrames:   48,
  bounceSmoothing:      0.12,
  swingWindowOnsets:    12,
  swingSmoothing:       0.08,
  pocketAttackMs:       15,
  pocketReleaseMs:      250,
  presenceAttackMs:     8,
  presenceReleaseMs:    180,
  densityWindowFrames:  96,
  densitySmoothing:     0.06,
  modeWindowFrames:     172,
  modeHysteresisFrames: 86,
}

export type PhysicsStateCallback = (state: PhysicsState) => void
