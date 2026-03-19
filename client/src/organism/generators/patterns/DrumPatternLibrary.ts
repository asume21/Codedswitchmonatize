// Section 04 — Drum Pattern Library

import { DrumInstrument, type DrumHit } from '../types'
import type { OrganismMode } from '../../physics/types'

export interface DrumPattern {
  hits:     DrumHit[]
  length:   string      // Tone.js loop length, e.g. '2m'
}

// ── Kick patterns ──────────────────────────────────────────────────

const KICK_BOOM_BAP: DrumHit[] = [
  { instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.95 },
  { instrument: DrumInstrument.Kick, time: '0:2:0', velocity: 0.80 },
  { instrument: DrumInstrument.Kick, time: '1:0:0', velocity: 0.90 },
  { instrument: DrumInstrument.Kick, time: '1:2:2', velocity: 0.75 },
]

const KICK_TRAP: DrumHit[] = [
  { instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 1.0 },
  { instrument: DrumInstrument.Kick, time: '0:0:2', velocity: 0.60 },
  { instrument: DrumInstrument.Kick, time: '0:2:0', velocity: 0.85 },
  { instrument: DrumInstrument.Kick, time: '1:0:0', velocity: 1.0 },
  { instrument: DrumInstrument.Kick, time: '1:1:2', velocity: 0.70 },
]

const KICK_MINIMAL: DrumHit[] = [
  { instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.85 },
  { instrument: DrumInstrument.Kick, time: '1:0:0', velocity: 0.80 },
]

// ── Snare patterns ─────────────────────────────────────────────────

const SNARE_BOOM_BAP: DrumHit[] = [
  { instrument: DrumInstrument.Snare, time: '0:1:0', velocity: 0.90 },
  { instrument: DrumInstrument.Snare, time: '1:1:0', velocity: 0.85 },
]

const SNARE_TRAP: DrumHit[] = [
  { instrument: DrumInstrument.Snare, time: '0:1:0', velocity: 0.95 },
  { instrument: DrumInstrument.Snare, time: '1:1:0', velocity: 0.90 },
  { instrument: DrumInstrument.Snare, time: '1:3:0', velocity: 0.60 },
]

const SNARE_MINIMAL: DrumHit[] = [
  { instrument: DrumInstrument.Snare, time: '0:1:0', velocity: 0.80 },
  { instrument: DrumInstrument.Snare, time: '1:1:0', velocity: 0.75 },
]

// ── Hi-hat patterns ────────────────────────────────────────────────

const HAT_EIGHTH: DrumHit[] = Array.from({ length: 8 }, (_, i) => ({
  instrument: DrumInstrument.Hat as const,
  time:       `${Math.floor(i / 4)}:${i % 4}:0`,
  velocity:   i % 2 === 0 ? 0.55 : 0.35,
}))

const HAT_SIXTEENTH: DrumHit[] = Array.from({ length: 16 }, (_, i) => ({
  instrument: DrumInstrument.Hat as const,
  time:       `${Math.floor(i / 8)}:${Math.floor((i % 8) / 2)}:${(i % 2) * 2}`,
  velocity:   0.30 + (i % 4 === 0 ? 0.20 : 0),
}))

const HAT_SPARSE: DrumHit[] = [
  { instrument: DrumInstrument.Hat, time: '0:0:2', velocity: 0.40 },
  { instrument: DrumInstrument.Hat, time: '0:2:2', velocity: 0.35 },
  { instrument: DrumInstrument.Hat, time: '1:0:2', velocity: 0.40 },
  { instrument: DrumInstrument.Hat, time: '1:2:2', velocity: 0.35 },
]

// ── Perc patterns ──────────────────────────────────────────────────

const PERC_SHAKER: DrumHit[] = [
  { instrument: DrumInstrument.Perc, time: '0:1:2', velocity: 0.30 },
  { instrument: DrumInstrument.Perc, time: '0:3:2', velocity: 0.25 },
  { instrument: DrumInstrument.Perc, time: '1:1:2', velocity: 0.30 },
  { instrument: DrumInstrument.Perc, time: '1:3:2', velocity: 0.25 },
]

// ── Pattern lookup by mode ─────────────────────────────────────────

export interface DrumKit {
  kick:  DrumHit[]
  snare: DrumHit[]
  hat:   DrumHit[]
  perc:  DrumHit[]
}

const MODE_KITS: Record<string, DrumKit> = {
  heat:   { kick: KICK_TRAP,     snare: SNARE_TRAP,     hat: HAT_SIXTEENTH, perc: PERC_SHAKER },
  ice:    { kick: KICK_MINIMAL,  snare: SNARE_MINIMAL,  hat: HAT_SPARSE,    perc: [] },
  smoke:  { kick: KICK_BOOM_BAP, snare: SNARE_BOOM_BAP, hat: HAT_EIGHTH,    perc: PERC_SHAKER },
  gravel: { kick: KICK_TRAP,     snare: SNARE_BOOM_BAP, hat: HAT_EIGHTH,    perc: PERC_SHAKER },
  glow:   { kick: KICK_MINIMAL,  snare: SNARE_MINIMAL,  hat: HAT_SPARSE,    perc: [] },
}

export function getDrumKit(mode: OrganismMode | string): DrumKit {
  return MODE_KITS[mode.toString()] ?? MODE_KITS.glow
}

export function buildDrumPattern(kit: DrumKit): DrumPattern {
  const hits: DrumHit[] = [
    ...kit.kick,
    ...kit.snare,
    ...kit.hat,
    ...kit.perc,
  ]
  return { hits, length: '2m' }
}
