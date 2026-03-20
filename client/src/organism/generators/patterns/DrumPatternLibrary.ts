// Section 04 — Drum Pattern Library
//
// Produces 4-bar (4m) patterns with swing, humanised velocity,
// arrangement variation (bar 4 = fill / bar 3 = half-time option),
// and ghost notes for groove.

import { DrumInstrument, type DrumHit } from '../types'
import type { OrganismMode } from '../../physics/types'

export interface DrumPattern {
  hits:   DrumHit[]
  length: string
}

export interface DrumKit {
  kick:  DrumHit[]
  snare: DrumHit[]
  hat:   DrumHit[]
  perc:  DrumHit[]
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Shift an off-beat 16th forward by ~30 ms for swing feel */
function swingTime(bar: number, beat: number, sub: number): string {
  // sub 1 and 3 (off-16ths) get pushed late → swing
  const swungSub = (sub === 1 || sub === 3) ? sub + 0.35 : sub
  return `${bar}:${beat}:${swungSub.toFixed(2)}`
}

/** Randomise velocity within a range for humanisation */
function hv(base: number, spread = 0.08): number {
  return Math.min(1, Math.max(0.1, base + (Math.random() - 0.5) * spread * 2))
}

function hit(inst: DrumInstrument, bar: number, beat: number, sub: number, vel: number): DrumHit {
  return { instrument: inst, time: swingTime(bar, beat, sub), velocity: hv(vel) }
}

const K = DrumInstrument.Kick
const S = DrumInstrument.Snare
const H = DrumInstrument.Hat
const P = DrumInstrument.Perc

// ── Boom-Bap groove (4 bars) ────────────────────────────────────────

function boomBapPattern(): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: beat 1 + "and" of 2 + beat 3 (classic boom-bap)
    h.push(hit(K, bar, 0, 0, 0.95))
    h.push(hit(K, bar, 1, 2, 0.72))   // syncopated
    h.push(hit(K, bar, 2, 0, 0.88))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.80))  // fill: extra kick
      h.push(hit(K, bar, 3, 2, 0.65))  // double kick roll
    }

    // Snare: beats 2 and 4 (backbeat)
    h.push(hit(S, bar, 1, 0, 0.92))
    h.push(hit(S, bar, 3, 0, 0.88))
    // Ghost snares for groove
    h.push(hit(S, bar, 0, 2, 0.25))    // ghost
    h.push(hit(S, bar, 2, 2, 0.22))    // ghost
    if (isFill) {
      // Snare drag fill
      h.push(hit(S, bar, 3, 1, 0.55))
      h.push(hit(S, bar, 3, 2, 0.60))
      h.push(hit(S, bar, 3, 3, 0.70))
    }

    // Hats: 8th notes with accented downbeats
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, beat % 2 === 0 ? 0.50 : 0.38))
      h.push(hit(H, bar, beat, 2, 0.28))  // off-beat (swung)
    }

    // Perc: shaker on 2-and and 4-and
    if (!isFill) {
      h.push(hit(P, bar, 1, 2, 0.28))
      h.push(hit(P, bar, 3, 2, 0.25))
    }
  }
  return h
}

// ── Trap groove (4 bars) ─────────────────────────────────────────────

function trapPattern(): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3
    const isHalf = bar === 2  // bar 3 = half-time variation

    // Kick: 808 pattern — beat 1, "and" of 1, beat 3, ghost on "e" of 3
    h.push(hit(K, bar, 0, 0, 1.0))
    h.push(hit(K, bar, 0, 2, 0.55))   // double
    h.push(hit(K, bar, 2, 0, 0.88))
    if (!isHalf) {
      h.push(hit(K, bar, 2, 3, 0.48))  // ghost kick
    }
    if (isFill) {
      // Triplet kick roll into bar 1
      h.push(hit(K, bar, 3, 0, 0.75))
      h.push(hit(K, bar, 3, 1, 0.68))
      h.push(hit(K, bar, 3, 2, 0.80))
      h.push(hit(K, bar, 3, 3, 0.72))
    }

    // Snare/clap: beats 2 and 4
    h.push(hit(S, bar, 1, 0, 0.95))
    h.push(hit(S, bar, 3, 0, 0.90))
    if (isFill) {
      // Snare roll
      for (let s = 0; s < 4; s++) {
        h.push(hit(S, bar, 3, s, 0.50 + s * 0.12))
      }
    }

    // Hats: 16th note rolls with open-hat accents
    for (let beat = 0; beat < 4; beat++) {
      for (let sub = 0; sub < 4; sub++) {
        // Skip hat on snare beats to avoid clutter
        if ((beat === 1 || beat === 3) && sub === 0) continue
        const accent = sub === 0 ? 0.48 : sub === 2 ? 0.35 : 0.22
        h.push(hit(H, bar, beat, sub, isHalf ? accent * 0.6 : accent))
      }
    }

    // Perc: rim on "and" of 2, "and" of 4
    h.push(hit(P, bar, 1, 2, 0.30))
    h.push(hit(P, bar, 3, 2, 0.26))
  }
  return h
}

// ── Minimal / Lo-fi groove (4 bars) ──────────────────────────────────

function minimalPattern(): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: just beat 1 and beat 3
    h.push(hit(K, bar, 0, 0, 0.85))
    h.push(hit(K, bar, 2, 0, 0.75))

    // Snare: beat 2 only (half-time feel)
    h.push(hit(S, bar, 1, 0, 0.80))
    if (bar % 2 === 1) {
      h.push(hit(S, bar, 3, 0, 0.65))  // every other bar adds beat 4
    }
    if (isFill) {
      h.push(hit(S, bar, 3, 2, 0.55))
      h.push(hit(S, bar, 3, 3, 0.62))
    }

    // Hats: sparse off-beats only (swung)
    h.push(hit(H, bar, 0, 2, 0.38))
    h.push(hit(H, bar, 1, 2, 0.32))
    h.push(hit(H, bar, 2, 2, 0.36))
    h.push(hit(H, bar, 3, 2, 0.30))
  }
  return h
}

// ── Hybrid Gritty groove (gravel mode) ───────────────────────────────

function grittyPattern(): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: boom-bap base + trap double
    h.push(hit(K, bar, 0, 0, 0.95))
    h.push(hit(K, bar, 0, 3, 0.48))  // ghost
    h.push(hit(K, bar, 1, 2, 0.70))  // syncopated
    h.push(hit(K, bar, 2, 0, 0.90))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.80))
      h.push(hit(K, bar, 3, 2, 0.72))
    }

    // Snare: hard backbeat with ghost grace note
    h.push(hit(S, bar, 0, 3, 0.20))  // ghost before 2
    h.push(hit(S, bar, 1, 0, 0.93))
    h.push(hit(S, bar, 2, 3, 0.18))  // ghost before 4
    h.push(hit(S, bar, 3, 0, 0.90))
    if (isFill) {
      h.push(hit(S, bar, 3, 1, 0.50))
      h.push(hit(S, bar, 3, 2, 0.58))
      h.push(hit(S, bar, 3, 3, 0.68))
    }

    // Hats: 8th notes, drop on beat 3 of bar 3 for breathing
    for (let beat = 0; beat < 4; beat++) {
      if (bar === 2 && beat >= 2) continue  // drop-out
      h.push(hit(H, bar, beat, 0, 0.45))
      h.push(hit(H, bar, beat, 2, 0.30))
    }

    // Perc: rim shots
    h.push(hit(P, bar, 1, 2, 0.30))
    if (bar % 2 === 0) h.push(hit(P, bar, 3, 2, 0.24))
  }
  return h
}

// ── Mode mapping ────────────────────────────────────────────────────

const MODE_PATTERN_BUILDERS: Record<string, () => DrumHit[]> = {
  heat:   trapPattern,
  ice:    minimalPattern,
  smoke:  boomBapPattern,
  gravel: grittyPattern,
  glow:   minimalPattern,
}

export function getDrumKit(_mode: OrganismMode | string): DrumKit {
  // Legacy interface — returns empty kit; buildDrumPattern uses builder instead
  return { kick: [], snare: [], hat: [], perc: [] }
}

export function buildDrumPattern(kit: DrumKit, mode?: OrganismMode | string): DrumPattern {
  const modeStr = mode?.toString() ?? 'glow'
  const builder = MODE_PATTERN_BUILDERS[modeStr] ?? minimalPattern
  return { hits: builder(), length: '4m' }
}
