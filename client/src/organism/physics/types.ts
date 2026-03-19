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
  pulseInertiaBars:     8,
  pulseConfidenceMin:   0.3,
  bounceWindowFrames:   86,
  bounceSmoothing:      0.05,
  swingWindowOnsets:    16,
  swingSmoothing:       0.03,
  pocketAttackMs:       20,
  pocketReleaseMs:      400,
  presenceAttackMs:     10,
  presenceReleaseMs:    300,
  densityWindowFrames:  172,
  densitySmoothing:     0.02,
  modeWindowFrames:     344,
  modeHysteresisFrames: 172,
}

export type PhysicsStateCallback = (state: PhysicsState) => void
