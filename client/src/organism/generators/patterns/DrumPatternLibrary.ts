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

// ── Boom-Bap 2: Dilla-influenced, heavy pocket (4 bars) ──────────────

function boomBapPattern2(): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: beat 1, syncopated "and" of 3 — late and heavy
    h.push(hit(K, bar, 0, 0, 0.92))
    h.push(hit(K, bar, 1, 1, 0.35))  // ghost before 2-and
    h.push(hit(K, bar, 2, 2, 0.80))  // "and" of 3
    h.push(hit(K, bar, 3, 1, 0.42))  // ghost before 4
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.82))
      h.push(hit(K, bar, 3, 2, 0.70))
    }

    // Snare: beats 2 and 4 + heavier ghost pocket
    h.push(hit(S, bar, 1, 0, 0.90))
    h.push(hit(S, bar, 3, 0, 0.86))
    h.push(hit(S, bar, 0, 3, 0.18))  // ghost
    h.push(hit(S, bar, 1, 3, 0.22))  // ghost
    h.push(hit(S, bar, 2, 3, 0.20))  // ghost
    if (isFill) {
      h.push(hit(S, bar, 3, 1, 0.48))
      h.push(hit(S, bar, 3, 2, 0.58))
      h.push(hit(S, bar, 3, 3, 0.70))
    }

    // Hats: quarter notes — open, lazy feel
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, beat % 2 === 0 ? 0.55 : 0.42))
    }

    // Perc: rim on "and" of 1 and "and" of 3
    h.push(hit(P, bar, 0, 2, 0.22))
    h.push(hit(P, bar, 2, 2, 0.20))
  }
  return h
}

// ── Trap 2: sparse hi-hat triplet feel (4 bars) ───────────────────────

function trapPattern2(): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: simple 1 and 3 with ghost before 3
    h.push(hit(K, bar, 0, 0, 1.0))
    h.push(hit(K, bar, 2, 0, 0.85))
    if (!isFill) h.push(hit(K, bar, 2, 3, 0.42))  // ghost
    if (isFill) {
      for (let s = 0; s < 4; s++) h.push(hit(K, bar, 3, s, 0.55 + s * 0.1))
    }

    // Snare/clap: 2 and 4
    h.push(hit(S, bar, 1, 0, 0.95))
    h.push(hit(S, bar, 3, 0, 0.92))

    // Hats: sparse — off-beat double hits for triplet trap feel
    for (let beat = 0; beat < 4; beat++) {
      if ((beat === 1 || beat === 3) && !isFill) {
        h.push(hit(H, bar, beat, 1, 0.28))
        h.push(hit(H, bar, beat, 2, 0.35))
      } else {
        h.push(hit(H, bar, beat, 0, 0.40))
        h.push(hit(H, bar, beat, 2, 0.25))
      }
    }

    // Perc: rim on "a" of 2 and 4
    h.push(hit(P, bar, 1, 3, 0.28))
    h.push(hit(P, bar, 3, 3, 0.24))
  }
  return h
}

// ── Glow / dream groove: sparse quarter-note hats, wide kicks ─────────

function glowPattern(): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    // Kick: beat 1 only; every other bar adds beat 3
    h.push(hit(K, bar, 0, 0, 0.80))
    if (bar % 2 === 1) h.push(hit(K, bar, 2, 0, 0.65))

    // Snare: beat 3 only (half-time feel)
    h.push(hit(S, bar, 2, 0, 0.75))

    // Hats: light quarter notes
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, 0.30))
    }
    // No perc — dreaminess through space
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

// ── UK Drill groove (4 bars) ──────────────────────────────────────────

function drillPattern(): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: offbeat — "and" of 1, beat 2-and, "a" of 3
    h.push(hit(K, bar, 0, 2, 0.92))   // "and" of 1
    h.push(hit(K, bar, 1, 2, 0.78))   // "and" of 2
    h.push(hit(K, bar, 2, 3, 0.85))   // "a" of 3
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.80))
      h.push(hit(K, bar, 3, 2, 0.70))
    }

    // Snare/clap: only beat 3 (half-time)
    h.push(hit(S, bar, 2, 0, 0.95))
    // Ghost snares — very subdued
    h.push(hit(S, bar, 0, 3, 0.15))
    h.push(hit(S, bar, 1, 3, 0.18))
    if (isFill) {
      h.push(hit(S, bar, 3, 2, 0.50))
      h.push(hit(S, bar, 3, 3, 0.65))
    }

    // Hats: 16th roll but gaps for pocket
    for (let beat = 0; beat < 4; beat++) {
      if (beat === 2 && bar % 2 === 0) continue  // skip beat 3 every other bar
      for (let sub = 0; sub < 4; sub++) {
        if (sub === 0 && (beat === 1 || beat === 3)) continue  // skip on snare beats
        const accent = sub === 0 ? 0.42 : sub === 2 ? 0.30 : 0.18
        h.push(hit(H, bar, beat, sub, accent))
      }
    }

    // Perc: dark rim on "and" of 2
    h.push(hit(P, bar, 1, 2, 0.32))
    if (bar % 2 === 1) h.push(hit(P, bar, 3, 2, 0.26))
  }
  return h
}

// ── Afrobeat groove (4 bars) ──────────────────────────────────────────

function afrobeatPattern(): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: 1, "a" of 1, "and" of 2 — offbeat heavy
    h.push(hit(K, bar, 0, 0, 0.90))
    h.push(hit(K, bar, 0, 3, 0.52))   // "a" of 1
    h.push(hit(K, bar, 1, 2, 0.82))   // "and" of 2
    h.push(hit(K, bar, 3, 0, 0.75))   // beat 4
    if (isFill) {
      h.push(hit(K, bar, 3, 2, 0.68))
      h.push(hit(K, bar, 3, 3, 0.72))
    }

    // Snare: beat 2 + beat 4 with ghost grace notes
    h.push(hit(S, bar, 1, 0, 0.88))
    h.push(hit(S, bar, 3, 0, 0.85))
    h.push(hit(S, bar, 0, 3, 0.22))   // ghost
    h.push(hit(S, bar, 2, 3, 0.20))   // ghost

    // Hats: 8th notes with accent on "and" beats
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, beat % 2 === 1 ? 0.52 : 0.38))   // offbeat accent
      h.push(hit(H, bar, beat, 2, 0.32))
    }

    // Perc: clave-inspired — "e" of 2 and "and" of 3
    h.push(hit(P, bar, 1, 1, 0.45))
    h.push(hit(P, bar, 2, 2, 0.40))
    if (bar % 2 === 0) h.push(hit(P, bar, 3, 1, 0.35))
  }
  return h
}

// ── Mode mapping — multiple variants picked randomly ─────────────────

const MODE_PATTERN_VARIANTS: Record<string, Array<() => DrumHit[]>> = {
  heat:   [trapPattern, trapPattern2, drillPattern],
  ice:    [minimalPattern, glowPattern],
  smoke:  [boomBapPattern, boomBapPattern2, afrobeatPattern],
  gravel: [grittyPattern, boomBapPattern2, drillPattern],
  glow:   [glowPattern, minimalPattern, afrobeatPattern],
}

export function getDrumKit(_mode: OrganismMode | string): DrumKit {
  // Legacy interface — returns empty kit; buildDrumPattern uses builder instead
  return { kick: [], snare: [], hat: [], perc: [] }
}

export function buildDrumPattern(kit: DrumKit, mode?: OrganismMode | string): DrumPattern {
  const modeStr = mode?.toString() ?? 'glow'
  const variants = MODE_PATTERN_VARIANTS[modeStr] ?? [minimalPattern]
  const builder = variants[Math.floor(Math.random() * variants.length)]
  return { hits: builder(), length: '4m' }
}
