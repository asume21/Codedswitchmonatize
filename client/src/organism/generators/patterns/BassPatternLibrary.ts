// Section 04 — Bass Pattern Library

import { BassBehavior } from '../types'
import type { OrganismMode } from '../../physics/types'
import type { OState } from '../../state/types'

// Pentatonic minor intervals from root
export const PENTATONIC_MINOR: number[] = [0, 3, 5, 7, 10]

// Map mode → default bass behavior per organism state
const MODE_BASS_MAP: Record<string, Record<string, BassBehavior>> = {
  heat:   { BREATHING: BassBehavior.Bounce,  FLOW: BassBehavior.Walk },
  ice:    { BREATHING: BassBehavior.Breathe, FLOW: BassBehavior.Lock },
  smoke:  { BREATHING: BassBehavior.Lock,    FLOW: BassBehavior.Walk },
  gravel: { BREATHING: BassBehavior.Bounce,  FLOW: BassBehavior.Bounce },
  glow:   { BREATHING: BassBehavior.Breathe, FLOW: BassBehavior.Lock },
}

export function getBassBehavior(
  mode: OrganismMode | string,
  organismState: OState,
): BassBehavior {
  const modeMap = MODE_BASS_MAP[mode.toString()]
  if (!modeMap) return BassBehavior.Breathe
  return modeMap[organismState] ?? BassBehavior.Breathe
}

// Filter cutoff targets per mode (Hz)
export const MODE_BASS_FILTER: Record<string, number> = {
  heat:   800,
  ice:    400,
  smoke:  600,
  gravel: 500,
  glow:   350,
}

export function getBassFilterCutoff(mode: OrganismMode | string, pocket: number): number {
  const base = MODE_BASS_FILTER[mode.toString()] ?? 400
  // Higher pocket → lower cutoff (ducking)
  return base * Math.max(0.25, 1 - pocket * 0.75)
}
