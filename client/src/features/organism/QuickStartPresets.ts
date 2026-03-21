/**
 * QUICK START PRESETS
 *
 * Pre-configured physics snapshots that let the Organism skip the cold start
 * (Dormant → Awakening → Breathing) and jump straight into beat generation.
 *
 * Each preset defines:
 *  - A synthetic PhysicsState snapshot (as if the user had been freestyling for 30s)
 *  - A target BPM
 *  - A target OrganismMode
 *  - A human-readable label and genre tag
 *
 * The Organism remains fully reactive after quick start — it just skips the warm-up.
 */

import { OrganismMode } from '../../organism/physics/types'
import type { PhysicsState } from '../../organism/physics/types'

export interface QuickStartPreset {
  id:          string
  label:       string
  genre:       string
  bpm:         number
  mode:        OrganismMode
  energy:      'low' | 'medium' | 'high'
  icon:        string
  physics:     PhysicsState
}

function makePhysics(overrides: Partial<PhysicsState> & { mode: OrganismMode; pulse: number }): PhysicsState {
  const beatDurationMs = 60000 / overrides.pulse
  return {
    bounce:              overrides.bounce   ?? 0.5,
    swing:               overrides.swing    ?? 0.3,
    pocket:              overrides.pocket   ?? 0.4,
    presence:            overrides.presence ?? 0.6,
    density:             overrides.density  ?? 0.5,
    mode:                overrides.mode,
    pulse:               overrides.pulse,
    beatDurationMs,
    sixteenthDurationMs: beatDurationMs / 4,
    swungSixteenthMs:    (beatDurationMs / 4) * (overrides.swing ?? 0.3) * 2,
    timestamp:           performance.now(),
    frameIndex:          0,
    voiceActive:         false,
  }
}

export const QUICK_START_PRESETS: QuickStartPreset[] = [
  {
    id:     'trap-140',
    label:  'Trap',
    genre:  'Trap / Hard',
    bpm:    140,
    mode:   OrganismMode.Heat,
    energy: 'high',
    icon:   '🔥',
    physics: makePhysics({
      mode:     OrganismMode.Heat,
      pulse:    140,
      bounce:   0.7,
      swing:    0.15,
      pocket:   0.3,
      presence: 0.75,
      density:  0.65,
    }),
  },
  {
    id:     'lofi-85',
    label:  'Lo-fi',
    genre:  'Lo-fi / Chill',
    bpm:    85,
    mode:   OrganismMode.Ice,
    energy: 'low',
    icon:   '❄️',
    physics: makePhysics({
      mode:     OrganismMode.Ice,
      pulse:    85,
      bounce:   0.3,
      swing:    0.55,
      pocket:   0.6,
      presence: 0.35,
      density:  0.3,
    }),
  },
  {
    id:     'boombap-90',
    label:  'Boom-bap',
    genre:  'Boom-bap / Classic',
    bpm:    90,
    mode:   OrganismMode.Smoke,
    energy: 'medium',
    icon:   '💨',
    physics: makePhysics({
      mode:     OrganismMode.Smoke,
      pulse:    90,
      bounce:   0.55,
      swing:    0.45,
      pocket:   0.5,
      presence: 0.55,
      density:  0.45,
    }),
  },
  {
    id:     'drill-140',
    label:  'Drill',
    genre:  'Drill / Dark',
    bpm:    140,
    mode:   OrganismMode.Gravel,
    energy: 'high',
    icon:   '⚡',
    physics: makePhysics({
      mode:     OrganismMode.Gravel,
      pulse:    140,
      bounce:   0.65,
      swing:    0.1,
      pocket:   0.25,
      presence: 0.7,
      density:  0.7,
    }),
  },
  {
    id:     'chill-75',
    label:  'Chill',
    genre:  'Chill / Melodic',
    bpm:    75,
    mode:   OrganismMode.Glow,
    energy: 'low',
    icon:   '✨',
    physics: makePhysics({
      mode:     OrganismMode.Glow,
      pulse:    75,
      bounce:   0.25,
      swing:    0.5,
      pocket:   0.65,
      presence: 0.3,
      density:  0.25,
    }),
  },
  {
    id:     'funk-100',
    label:  'Funk',
    genre:  'Funk / Groove',
    bpm:    100,
    mode:   OrganismMode.Smoke,
    energy: 'medium',
    icon:   '🎸',
    physics: makePhysics({
      mode:     OrganismMode.Smoke,
      pulse:    100,
      bounce:   0.6,
      swing:    0.6,
      pocket:   0.55,
      presence: 0.6,
      density:  0.5,
    }),
  },
]

/** Look up a preset by id, returns undefined if not found. */
export function getQuickStartPreset(id: string): QuickStartPreset | undefined {
  return QUICK_START_PRESETS.find(p => p.id === id)
}
