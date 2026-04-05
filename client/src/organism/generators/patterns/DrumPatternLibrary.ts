// Section 04 — Drum Pattern Library
//
// Produces 4-bar (4m) patterns with swing, humanised velocity,
// arrangement variation (bar 4 = fill / bar 3 = half-time option),
// and ghost notes for groove.
//
// Sub-genres: boom-bap, trap, drill, lo-fi, west-coast, dirty-south,
//             phonk, jersey-club, bounce, reggaeton, afrobeat, chill

import { DrumInstrument, type DrumHit } from '../types'
import type { OrganismMode } from '../../physics/types'
import type { HipHopSubGenre, GrooveParams } from '../../state/MusicalState'

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

/**
 * Shift off-beat 16ths (sub 1 and 3) later to create swing feel.
 * @param swingAmt 0 = straight, 1 = full 16th delay.
 * @param instrumentOffset per-instrument swing nudge (-0.1 to +0.1)
 */
function swingTime(bar: number, beat: number, sub: number, swingAmt: number, instrumentOffset = 0): string {
  const effectiveSwing = Math.max(0, Math.min(1, swingAmt + instrumentOffset))
  const swungSub = (sub === 1 || sub === 3) ? sub + effectiveSwing : sub
  return `${bar}:${beat}:${swungSub.toFixed(2)}`
}

/** Randomise velocity within a range for humanisation */
function hv(base: number, spread = 0.08): number {
  return Math.min(1, Math.max(0.1, base + (Math.random() - 0.5) * spread * 2))
}

/** Create a drum hit with swing applied */
function hit(inst: DrumInstrument, bar: number, beat: number, sub: number, vel: number, swingAmt: number, instOffset = 0): DrumHit {
  return { instrument: inst, time: swingTime(bar, beat, sub, swingAmt, instOffset), velocity: hv(vel) }
}

/** Apply accent hierarchy — downbeats are stronger than upbeats */
function accentVel(base: number, beat: number, sub: number, accentWeight: number): number {
  if (sub === 0 && beat === 0) return base * (1 + accentWeight * 0.15)   // beat 1 = strongest
  if (sub === 0 && beat === 2) return base * (1 + accentWeight * 0.08)   // beat 3 = secondary
  if (sub === 0) return base                                               // beats 2,4 = normal (snare)
  if (sub === 2) return base * 0.85                                        // "and" = softer
  return base * 0.7                                                         // "e" and "a" = ghost territory
}

const K = DrumInstrument.Kick
const S = DrumInstrument.Snare
const H = DrumInstrument.Hat
const P = DrumInstrument.Perc

// ── Per-genre swing amounts ───────────────────────────────────────────
// 0 = perfectly straight, 1 = full 16th-note delay on off-beats.
const SWING: Record<string, number> = {
  'boom-bap':    0.60,   // classic MPC / J Dilla pocket
  'trap':        0.20,   // trap is mostly straight 16ths
  'drill':       0.22,   // UK drill — near-straight
  'lo-fi':       0.48,   // dusty lo-fi — slightly laid-back
  'west-coast':  0.52,   // G-funk bounce
  'dirty-south': 0.35,   // crunk — moderate swing
  'phonk':       0.28,   // Memphis — slightly swung
  'jersey-club': 0.15,   // jersey club — nearly straight, fast
  'bounce':      0.42,   // NOLA bounce — moderate
  'reggaeton':   0.10,   // dembow — very straight
  'afrobeat':    0.35,   // moderate clave swing
  'chill':       0.38,   // atmospheric / dream
} as const

// ══════════════════════════════════════════════════════════════════════
//  PATTERN BUILDERS — each returns a 4-bar (4m) DrumHit[] array
// ══════════════════════════════════════════════════════════════════════

// ── Boom-Bap groove (4 bars) ────────────────────────────────────────

function boomBapPattern(sw = SWING['boom-bap']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: beat 1 + "and" of 2 + beat 3 (classic boom-bap)
    h.push(hit(K, bar, 0, 0, 0.95, sw, -0.03))
    h.push(hit(K, bar, 1, 2, 0.72, sw, -0.03))
    h.push(hit(K, bar, 2, 0, 0.88, sw, -0.03))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.80, sw, -0.03))
      h.push(hit(K, bar, 3, 2, 0.65, sw, -0.03))
    }

    // Snare: beats 2 and 4 (backbeat)
    h.push(hit(S, bar, 1, 0, 0.92, sw))
    h.push(hit(S, bar, 3, 0, 0.88, sw))
    h.push(hit(S, bar, 0, 2, 0.25, sw))
    h.push(hit(S, bar, 2, 2, 0.22, sw))
    if (isFill) {
      h.push(hit(S, bar, 3, 1, 0.55, sw))
      h.push(hit(S, bar, 3, 2, 0.60, sw))
      h.push(hit(S, bar, 3, 3, 0.70, sw))
    }

    // Hats: 8th notes with accented downbeats
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, beat % 2 === 0 ? 0.50 : 0.38, sw, 0.02))
      h.push(hit(H, bar, beat, 2, 0.28, sw, 0.02))
    }

    // Perc: shaker on 2-and and 4-and
    if (!isFill) {
      h.push(hit(P, bar, 1, 2, 0.28, sw))
      h.push(hit(P, bar, 3, 2, 0.25, sw))
    }
  }
  return h
}

// ── Boom-Bap 2: Dilla-influenced, heavy pocket (4 bars) ──────────────

function boomBapPattern2(sw = SWING['boom-bap'] + 0.05): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    h.push(hit(K, bar, 0, 0, 0.92, sw, -0.03))
    h.push(hit(K, bar, 1, 1, 0.35, sw, -0.03))
    h.push(hit(K, bar, 2, 2, 0.80, sw, -0.03))
    h.push(hit(K, bar, 3, 1, 0.42, sw, -0.03))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.82, sw, -0.03))
      h.push(hit(K, bar, 3, 2, 0.70, sw, -0.03))
    }

    h.push(hit(S, bar, 1, 0, 0.90, sw))
    h.push(hit(S, bar, 3, 0, 0.86, sw))
    h.push(hit(S, bar, 0, 3, 0.18, sw))
    h.push(hit(S, bar, 1, 3, 0.22, sw))
    h.push(hit(S, bar, 2, 3, 0.20, sw))
    if (isFill) {
      h.push(hit(S, bar, 3, 1, 0.48, sw))
      h.push(hit(S, bar, 3, 2, 0.58, sw))
      h.push(hit(S, bar, 3, 3, 0.70, sw))
    }

    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, beat % 2 === 0 ? 0.55 : 0.42, sw, 0.02))
    }

    h.push(hit(P, bar, 0, 2, 0.22, sw))
    h.push(hit(P, bar, 2, 2, 0.20, sw))
  }
  return h
}

// ── Trap groove (4 bars) ─────────────────────────────────────────────

function trapPattern(sw = SWING['trap']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3
    const isHalf = bar === 2

    h.push(hit(K, bar, 0, 0, 1.0, sw))
    h.push(hit(K, bar, 0, 2, 0.55, sw))
    h.push(hit(K, bar, 2, 0, 0.88, sw))
    if (!isHalf) h.push(hit(K, bar, 2, 3, 0.48, sw))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.75, sw))
      h.push(hit(K, bar, 3, 1, 0.68, sw))
      h.push(hit(K, bar, 3, 2, 0.80, sw))
      h.push(hit(K, bar, 3, 3, 0.72, sw))
    }

    h.push(hit(S, bar, 1, 0, 0.95, sw))
    h.push(hit(S, bar, 3, 0, 0.90, sw))
    h.push(hit(S, bar, 0, 3, 0.18, sw))
    h.push(hit(S, bar, 2, 3, 0.16, sw))
    if (bar % 2 === 1) h.push(hit(S, bar, 1, 2, 0.20, sw))
    if (isFill) {
      for (let s = 0; s < 4; s++) h.push(hit(S, bar, 3, s, 0.50 + s * 0.12, sw))
    }

    for (let beat = 0; beat < 4; beat++) {
      for (let sub = 0; sub < 4; sub++) {
        if ((beat === 1 || beat === 3) && sub === 0) continue
        const accent = sub === 0 ? 0.48 : sub === 2 ? 0.35 : 0.22
        h.push(hit(H, bar, beat, sub, isHalf ? accent * 0.6 : accent, sw))
      }
    }

    h.push(hit(P, bar, 1, 2, 0.30, sw))
    h.push(hit(P, bar, 3, 2, 0.26, sw))
  }
  return h
}

// ── Trap 2: sparse hi-hat triplet feel (4 bars) ───────────────────────

function trapPattern2(sw = SWING['trap']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    h.push(hit(K, bar, 0, 0, 1.0, sw))
    h.push(hit(K, bar, 2, 0, 0.85, sw))
    if (!isFill) h.push(hit(K, bar, 2, 3, 0.42, sw))
    if (isFill) {
      for (let s = 0; s < 4; s++) h.push(hit(K, bar, 3, s, 0.55 + s * 0.1, sw))
    }

    h.push(hit(S, bar, 1, 0, 0.95, sw))
    h.push(hit(S, bar, 3, 0, 0.92, sw))

    for (let beat = 0; beat < 4; beat++) {
      if ((beat === 1 || beat === 3) && !isFill) {
        h.push(hit(H, bar, beat, 1, 0.28, sw))
        h.push(hit(H, bar, beat, 2, 0.35, sw))
      } else {
        h.push(hit(H, bar, beat, 0, 0.40, sw))
        h.push(hit(H, bar, beat, 2, 0.25, sw))
      }
    }

    h.push(hit(P, bar, 1, 3, 0.28, sw))
    h.push(hit(P, bar, 3, 3, 0.24, sw))
  }
  return h
}

// ── UK Drill groove (4 bars) ──────────────────────────────────────────

function drillPattern(sw = SWING['drill']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    h.push(hit(K, bar, 0, 2, 0.92, sw, 0.02))
    h.push(hit(K, bar, 1, 2, 0.78, sw, 0.02))
    h.push(hit(K, bar, 2, 3, 0.85, sw, 0.02))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.80, sw, 0.02))
      h.push(hit(K, bar, 3, 2, 0.70, sw, 0.02))
    }

    h.push(hit(S, bar, 2, 0, 0.95, sw))
    h.push(hit(S, bar, 0, 3, 0.15, sw))
    h.push(hit(S, bar, 1, 3, 0.18, sw))
    if (isFill) {
      h.push(hit(S, bar, 3, 2, 0.50, sw))
      h.push(hit(S, bar, 3, 3, 0.65, sw))
    }

    for (let beat = 0; beat < 4; beat++) {
      if (beat === 2 && bar % 2 === 0) continue
      for (let sub = 0; sub < 4; sub++) {
        if (sub === 0 && (beat === 1 || beat === 3)) continue
        const accent = sub === 0 ? 0.42 : sub === 2 ? 0.30 : 0.18
        h.push(hit(H, bar, beat, sub, accent, sw, -0.01))
      }
    }

    h.push(hit(P, bar, 1, 2, 0.32, sw))
    if (bar % 2 === 1) h.push(hit(P, bar, 3, 2, 0.26, sw))
  }
  return h
}

// ── Glow / dream groove (4 bars) ────────────────────────────────────

function glowPattern(sw = SWING['chill']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    h.push(hit(K, bar, 0, 0, 0.80, sw, -0.03))
    if (bar % 2 === 1) h.push(hit(K, bar, 2, 0, 0.65, sw, -0.03))

    h.push(hit(S, bar, 2, 0, 0.75, sw))
    h.push(hit(S, bar, 1, 3, 0.12, sw))
    if (bar % 2 === 1) h.push(hit(S, bar, 3, 2, 0.10, sw))

    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, 0.30, sw, 0.02))
    }

    if (bar % 2 === 0) {
      h.push(hit(P, bar, 1, 2, 0.15, sw))
      h.push(hit(P, bar, 3, 2, 0.12, sw))
    }
  }
  return h
}

// ── Minimal / Lo-fi groove (4 bars) ──────────────────────────────────

function minimalPattern(sw = SWING['lo-fi']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    h.push(hit(K, bar, 0, 0, 0.85, sw, -0.04))
    h.push(hit(K, bar, 2, 0, 0.75, sw, -0.04))

    h.push(hit(S, bar, 1, 0, 0.80, sw))
    if (bar % 2 === 1) h.push(hit(S, bar, 3, 0, 0.65, sw))
    h.push(hit(S, bar, 0, 3, 0.14, sw))
    if (bar >= 2) h.push(hit(S, bar, 2, 3, 0.12, sw))
    if (isFill) {
      h.push(hit(S, bar, 3, 2, 0.55, sw))
      h.push(hit(S, bar, 3, 3, 0.62, sw))
    }

    h.push(hit(H, bar, 0, 2, 0.38, sw, 0.03))
    h.push(hit(H, bar, 1, 2, 0.32, sw, 0.03))
    h.push(hit(H, bar, 2, 2, 0.36, sw, 0.03))
    h.push(hit(H, bar, 3, 2, 0.30, sw, 0.03))
  }
  return h
}

// ── Hybrid Gritty groove (gravel mode) ───────────────────────────────

function grittyPattern(sw = SWING['boom-bap'] - 0.08): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    h.push(hit(K, bar, 0, 0, 0.95, sw))
    h.push(hit(K, bar, 0, 3, 0.48, sw))
    h.push(hit(K, bar, 1, 2, 0.70, sw))
    h.push(hit(K, bar, 2, 0, 0.90, sw))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.80, sw))
      h.push(hit(K, bar, 3, 2, 0.72, sw))
    }

    h.push(hit(S, bar, 0, 3, 0.20, sw))
    h.push(hit(S, bar, 1, 0, 0.93, sw))
    h.push(hit(S, bar, 2, 3, 0.18, sw))
    h.push(hit(S, bar, 3, 0, 0.90, sw))
    if (isFill) {
      h.push(hit(S, bar, 3, 1, 0.50, sw))
      h.push(hit(S, bar, 3, 2, 0.58, sw))
      h.push(hit(S, bar, 3, 3, 0.68, sw))
    }

    for (let beat = 0; beat < 4; beat++) {
      if (bar === 2 && beat >= 2) continue
      h.push(hit(H, bar, beat, 0, 0.45, sw))
      h.push(hit(H, bar, beat, 2, 0.30, sw))
    }

    h.push(hit(P, bar, 1, 2, 0.30, sw))
    if (bar % 2 === 0) h.push(hit(P, bar, 3, 2, 0.24, sw))
  }
  return h
}

// ── Afrobeat groove (4 bars) ──────────────────────────────────────────

function afrobeatPattern(sw = SWING['afrobeat']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    h.push(hit(K, bar, 0, 0, 0.90, sw, 0.02))
    h.push(hit(K, bar, 0, 3, 0.52, sw, 0.02))
    h.push(hit(K, bar, 1, 2, 0.82, sw, 0.02))
    h.push(hit(K, bar, 3, 0, 0.75, sw, 0.02))
    if (isFill) {
      h.push(hit(K, bar, 3, 2, 0.68, sw, 0.02))
      h.push(hit(K, bar, 3, 3, 0.72, sw, 0.02))
    }

    h.push(hit(S, bar, 1, 0, 0.88, sw, -0.01))
    h.push(hit(S, bar, 3, 0, 0.85, sw, -0.01))
    h.push(hit(S, bar, 0, 3, 0.22, sw))
    h.push(hit(S, bar, 2, 3, 0.20, sw))

    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, beat % 2 === 1 ? 0.52 : 0.38, sw, 0.03))
      h.push(hit(H, bar, beat, 2, 0.32, sw, 0.03))
    }

    h.push(hit(P, bar, 1, 1, 0.45, sw))
    h.push(hit(P, bar, 2, 2, 0.40, sw))
    if (bar % 2 === 0) h.push(hit(P, bar, 3, 1, 0.35, sw))
  }
  return h
}

// ══════════════════════════════════════════════════════════════════════
//  NEW SUB-GENRE PATTERNS
// ══════════════════════════════════════════════════════════════════════

// ── West Coast / G-Funk groove (4 bars) ──────────────────────────────
// Parliament-inspired bounce: lazy kick on 1 and "and" of 3,
// snare cracks on 2 and 4, bouncy 16th hats with open accents.

function westCoastPattern(sw = SWING['west-coast']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: laid-back — beat 1, "and" of 2 (syncopated), beat 3
    h.push(hit(K, bar, 0, 0, 0.92, sw, -0.02))
    h.push(hit(K, bar, 1, 2, 0.68, sw, -0.02))  // syncopated bounce
    h.push(hit(K, bar, 2, 0, 0.85, sw, -0.02))
    if (bar % 2 === 1) h.push(hit(K, bar, 3, 2, 0.55, sw, -0.02))  // ghost on even bars
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.78, sw, -0.02))
      h.push(hit(K, bar, 3, 2, 0.72, sw, -0.02))
    }

    // Snare: clean backbeat on 2 and 4
    h.push(hit(S, bar, 1, 0, 0.90, sw, 0.01))
    h.push(hit(S, bar, 3, 0, 0.88, sw, 0.01))
    // Ghost snares — subtle funky pocket
    h.push(hit(S, bar, 0, 3, 0.20, sw))
    h.push(hit(S, bar, 2, 3, 0.18, sw))
    if (isFill) {
      h.push(hit(S, bar, 3, 1, 0.52, sw))
      h.push(hit(S, bar, 3, 2, 0.60, sw))
      h.push(hit(S, bar, 3, 3, 0.72, sw))
    }

    // Hats: bouncy 16ths with open-hat accents on "and" beats
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, 0.48, sw, 0.03))
      h.push(hit(H, bar, beat, 1, 0.22, sw, 0.03))  // ghost 16th
      h.push(hit(H, bar, beat, 2, 0.42, sw, 0.03))  // open hat feel on "and"
      if (beat % 2 === 0) h.push(hit(H, bar, beat, 3, 0.18, sw, 0.03))  // extra ghost
    }

    // Perc: cowbell / clave hits for west coast flavor
    h.push(hit(P, bar, 0, 2, 0.35, sw))
    h.push(hit(P, bar, 2, 2, 0.30, sw))
    if (bar % 2 === 0) h.push(hit(P, bar, 1, 0, 0.20, sw))  // subtle bell on 2
  }
  return h
}

// ── West Coast 2: G-funk whistle groove (4 bars) ────────────────────
// Lighter, more melodic, less kick density

function westCoastPattern2(sw = SWING['west-coast']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Sparse kick: just 1 and 3 (let the bass carry)
    h.push(hit(K, bar, 0, 0, 0.88, sw, -0.02))
    h.push(hit(K, bar, 2, 0, 0.80, sw, -0.02))
    if (isFill) h.push(hit(K, bar, 3, 2, 0.70, sw, -0.02))

    // Snare: standard backbeat with rim on "and" of 2
    h.push(hit(S, bar, 1, 0, 0.88, sw))
    h.push(hit(S, bar, 3, 0, 0.85, sw))
    if (bar % 2 === 0) h.push(hit(S, bar, 1, 2, 0.30, sw))  // rim ghost

    // Hats: 8ths with accent variation
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, beat === 0 ? 0.50 : 0.38, sw, 0.03))
      h.push(hit(H, bar, beat, 2, 0.32, sw, 0.03))
    }

    // Perc: clave pattern — classic west coast
    h.push(hit(P, bar, 0, 0, 0.38, sw))
    h.push(hit(P, bar, 1, 2, 0.32, sw))
    h.push(hit(P, bar, 2, 0, 0.28, sw))
  }
  return h
}

// ── Dirty South / Crunk groove (4 bars) ──────────────────────────────
// Heavy, aggressive, call-and-response energy. Kick slams, snare pops,
// sparse hats, heavy perc (cowbell or 808 cowbell).

function dirtySouthPattern(sw = SWING['dirty-south']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: HEAVY — beat 1 slam, "and" of 1 double, beat 3 slam
    h.push(hit(K, bar, 0, 0, 1.0, sw))
    h.push(hit(K, bar, 0, 2, 0.62, sw))   // double
    h.push(hit(K, bar, 2, 0, 0.95, sw))
    h.push(hit(K, bar, 2, 2, 0.55, sw))   // double
    if (isFill) {
      // Kick roll into next section
      for (let s = 0; s < 4; s++) h.push(hit(K, bar, 3, s, 0.60 + s * 0.10, sw))
    }

    // Snare: CRACK on 2 and 4 — loud and aggressive
    h.push(hit(S, bar, 1, 0, 1.0, sw, -0.01))
    h.push(hit(S, bar, 3, 0, 0.95, sw, -0.01))
    // Ghost rim before backbeats
    h.push(hit(S, bar, 0, 3, 0.22, sw))
    h.push(hit(S, bar, 2, 3, 0.20, sw))
    if (isFill) {
      h.push(hit(S, bar, 3, 2, 0.65, sw))
      h.push(hit(S, bar, 3, 3, 0.78, sw))
    }

    // Hats: SPARSE — quarter notes, let the bass breathe
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, 0.42, sw, 0.02))
      if (beat % 2 === 1) h.push(hit(H, bar, beat, 2, 0.25, sw, 0.02))
    }

    // Perc: cowbell — signature crunk element
    h.push(hit(P, bar, 0, 0, 0.50, sw))
    h.push(hit(P, bar, 1, 0, 0.42, sw))
    h.push(hit(P, bar, 2, 0, 0.48, sw))
    h.push(hit(P, bar, 3, 0, 0.40, sw))
    // Offbeat cowbell accents
    if (bar % 2 === 0) {
      h.push(hit(P, bar, 0, 2, 0.30, sw))
      h.push(hit(P, bar, 2, 2, 0.28, sw))
    }
  }
  return h
}

// ── Dirty South 2: call-and-response (4 bars) ───────────────────────
// Bars 1-2 heavy, bars 3-4 pull back for voice response

function dirtySouthPattern2(sw = SWING['dirty-south']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isQuiet = bar >= 2 && bar < 3  // bar 3 pulls back
    const isFill = bar === 3

    // Kick: heavy on loud bars, sparse on quiet
    h.push(hit(K, bar, 0, 0, isQuiet ? 0.80 : 1.0, sw))
    if (!isQuiet) h.push(hit(K, bar, 0, 2, 0.55, sw))
    h.push(hit(K, bar, 2, 0, isQuiet ? 0.70 : 0.90, sw))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.85, sw))
      h.push(hit(K, bar, 3, 2, 0.75, sw))
    }

    // Snare
    h.push(hit(S, bar, 1, 0, isQuiet ? 0.78 : 0.95, sw))
    h.push(hit(S, bar, 3, 0, isQuiet ? 0.75 : 0.92, sw))

    // Hats: more active on loud sections
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, 0.40, sw))
      if (!isQuiet) h.push(hit(H, bar, beat, 2, 0.28, sw))
    }

    // Perc: cowbell only on loud sections
    if (!isQuiet) {
      h.push(hit(P, bar, 0, 0, 0.45, sw))
      h.push(hit(P, bar, 2, 0, 0.40, sw))
    }
  }
  return h
}

// ── Phonk / Memphis groove (4 bars) ──────────────────────────────────
// Dark, distorted, heavy kick with cowbell and stuttered hats.
// Slower than trap despite similar straight feel. Dark reverb.

function phonkPattern(sw = SWING['phonk']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: stuttered 808 — beat 1, beat 1-and, beat 3, beat 3-and
    h.push(hit(K, bar, 0, 0, 1.0, sw))
    h.push(hit(K, bar, 0, 2, 0.50, sw))   // stutter
    h.push(hit(K, bar, 2, 0, 0.92, sw))
    h.push(hit(K, bar, 2, 2, 0.45, sw))   // stutter
    if (isFill) {
      // Rapid kick stutter fill
      for (let s = 0; s < 4; s++) h.push(hit(K, bar, 3, s, 0.58 + s * 0.10, sw))
    }

    // Snare: hard clap on 2 and 4, extra ghost grace
    h.push(hit(S, bar, 1, 0, 0.95, sw))
    h.push(hit(S, bar, 3, 0, 0.92, sw))
    h.push(hit(S, bar, 0, 3, 0.15, sw))  // ghost
    if (bar % 2 === 1) h.push(hit(S, bar, 2, 3, 0.18, sw))

    // Hats: stuttered — 16ths on some beats, gaps on others
    for (let beat = 0; beat < 4; beat++) {
      if (beat === 1 || beat === 3) {
        // Sparse on snare beats
        h.push(hit(H, bar, beat, 2, 0.28, sw, 0.01))
      } else {
        // 16th stutter on kick beats
        for (let sub = 0; sub < 4; sub++) {
          h.push(hit(H, bar, beat, sub, sub === 0 ? 0.42 : 0.20, sw, 0.01))
        }
      }
    }

    // Perc: COWBELL — the phonk signature
    h.push(hit(P, bar, 0, 0, 0.55, sw))
    h.push(hit(P, bar, 0, 2, 0.38, sw))
    h.push(hit(P, bar, 1, 0, 0.32, sw))
    h.push(hit(P, bar, 2, 0, 0.50, sw))
    h.push(hit(P, bar, 2, 2, 0.35, sw))
    h.push(hit(P, bar, 3, 0, 0.30, sw))
  }
  return h
}

// ── Phonk 2: darker, half-time (4 bars) ────────────────────────────

function phonkPattern2(sw = SWING['phonk']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: half-time feel — only beat 1 and "a" of 2
    h.push(hit(K, bar, 0, 0, 1.0, sw))
    h.push(hit(K, bar, 1, 3, 0.72, sw))  // late pickup
    if (bar % 2 === 1) h.push(hit(K, bar, 2, 0, 0.80, sw))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.85, sw))
      h.push(hit(K, bar, 3, 2, 0.78, sw))
    }

    // Snare: only beat 3 (half-time)
    h.push(hit(S, bar, 2, 0, 0.95, sw))
    if (bar % 2 === 1) h.push(hit(S, bar, 0, 3, 0.15, sw))

    // Hats: sparse 8ths
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, 0.35, sw))
      if (beat % 2 === 0) h.push(hit(H, bar, beat, 2, 0.22, sw))
    }

    // Perc: cowbell — less dense, more menacing
    h.push(hit(P, bar, 0, 0, 0.48, sw))
    h.push(hit(P, bar, 2, 0, 0.42, sw))
    if (bar % 2 === 0) h.push(hit(P, bar, 1, 2, 0.28, sw))
  }
  return h
}

// ── Jersey Club groove (4 bars) ──────────────────────────────────────
// Fast (130+ BPM), bed-squeak sample, chopped vocal loops.
// Signature: kick on every beat, clap on 2/4, 16th hat rolls with
// distinctive "gallop" pattern.

function jerseyClubPattern(sw = SWING['jersey-club']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: every beat + pickup on "a" of 4 (gallop feel)
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(K, bar, beat, 0, beat === 0 ? 0.95 : 0.82, sw))
    }
    // Gallop pickup
    h.push(hit(K, bar, 3, 3, 0.65, sw))
    if (bar % 2 === 1) h.push(hit(K, bar, 1, 3, 0.55, sw))  // extra gallop
    if (isFill) {
      // Double-time kick
      for (let beat = 2; beat < 4; beat++) {
        h.push(hit(K, bar, beat, 1, 0.55, sw))
        h.push(hit(K, bar, beat, 3, 0.60, sw))
      }
    }

    // Snare/clap: 2 and 4, + "bed squeak" ghost claps
    h.push(hit(S, bar, 1, 0, 0.92, sw))
    h.push(hit(S, bar, 3, 0, 0.90, sw))
    // Bed squeak ghosts — distinctive jersey sound
    h.push(hit(S, bar, 0, 2, 0.30, sw))
    h.push(hit(S, bar, 2, 2, 0.28, sw))
    if (bar % 2 === 0) {
      h.push(hit(S, bar, 1, 2, 0.25, sw))
      h.push(hit(S, bar, 3, 2, 0.22, sw))
    }

    // Hats: 16th rolls — the jersey club signature
    for (let beat = 0; beat < 4; beat++) {
      for (let sub = 0; sub < 4; sub++) {
        const vel = sub === 0 ? 0.50 : sub === 2 ? 0.38 : 0.20
        h.push(hit(H, bar, beat, sub, vel, sw, -0.02))
      }
    }

    // Perc: rim on offbeats for extra bounce
    h.push(hit(P, bar, 0, 2, 0.30, sw))
    h.push(hit(P, bar, 2, 2, 0.28, sw))
  }
  return h
}

// ── New Orleans Bounce groove (4 bars) ───────────────────────────────
// Triggerman pattern: iconic NOLA beat. Kick on 1, snare on 2/4,
// with call-response between kick+bass and perc hits.

function bouncePattern(sw = SWING['bounce']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: Triggerman-inspired — 1, "and" of 1, beat 3, "and" of 3
    h.push(hit(K, bar, 0, 0, 0.95, sw, -0.02))
    h.push(hit(K, bar, 0, 2, 0.60, sw, -0.02))
    h.push(hit(K, bar, 2, 0, 0.88, sw, -0.02))
    h.push(hit(K, bar, 2, 2, 0.55, sw, -0.02))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.80, sw, -0.02))
      h.push(hit(K, bar, 3, 1, 0.65, sw, -0.02))
      h.push(hit(K, bar, 3, 2, 0.72, sw, -0.02))
    }

    // Snare: 2 and 4
    h.push(hit(S, bar, 1, 0, 0.90, sw, 0.01))
    h.push(hit(S, bar, 3, 0, 0.88, sw, 0.01))
    // Ghost snares for bounce pocket
    h.push(hit(S, bar, 0, 3, 0.20, sw))
    h.push(hit(S, bar, 2, 3, 0.18, sw))

    // Hats: bouncy 8ths + 16th accents
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, 0.45, sw, 0.02))
      h.push(hit(H, bar, beat, 2, 0.35, sw, 0.02))
      // Extra 16th bounce on even beats
      if (beat % 2 === 0) h.push(hit(H, bar, beat, 3, 0.20, sw, 0.02))
    }

    // Perc: call-and-response hits between beats
    h.push(hit(P, bar, 1, 2, 0.38, sw))
    h.push(hit(P, bar, 3, 2, 0.35, sw))
    if (bar % 2 === 1) h.push(hit(P, bar, 0, 2, 0.25, sw))
  }
  return h
}

// ── Reggaeton / Dembow groove (4 bars) ───────────────────────────────
// The dembow riddim: kick on 1 and 3, snare on "and" of 2 and "and" of 4.
// Very straight, hypnotic, bass-driven.

function reggaetonPattern(sw = SWING['reggaeton']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: beats 1 and 3 (dembow foundation)
    h.push(hit(K, bar, 0, 0, 0.95, sw))
    h.push(hit(K, bar, 2, 0, 0.90, sw))
    // Ghost kick for extra bounce
    if (bar % 2 === 1) h.push(hit(K, bar, 1, 2, 0.40, sw))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.82, sw))
      h.push(hit(K, bar, 3, 2, 0.75, sw))
    }

    // Snare: THE DEMBOW — "and" of 2 and "and" of 4
    // This is what makes it reggaeton
    h.push(hit(S, bar, 1, 2, 0.92, sw))   // "and" of 2
    h.push(hit(S, bar, 3, 2, 0.88, sw))   // "and" of 4
    // Plus a lighter hit on beat 2 and 4 for fullness
    h.push(hit(S, bar, 1, 0, 0.45, sw))
    h.push(hit(S, bar, 3, 0, 0.42, sw))
    if (isFill) {
      h.push(hit(S, bar, 3, 3, 0.65, sw))
    }

    // Hats: straight 8ths — hypnotic pulse
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, 0.42, sw))
      h.push(hit(H, bar, beat, 2, 0.30, sw))
    }

    // Perc: rim on "e" of 1 and "e" of 3 — adds Latin flavor
    h.push(hit(P, bar, 0, 1, 0.35, sw))
    h.push(hit(P, bar, 2, 1, 0.32, sw))
  }
  return h
}

// ── Reggaeton 2: perreo variation (heavier) ──────────────────────────

function reggaetonPattern2(sw = SWING['reggaeton']): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: heavier — 1, "and" of 1, 3, ghost before 3
    h.push(hit(K, bar, 0, 0, 1.0, sw))
    h.push(hit(K, bar, 0, 2, 0.48, sw))
    h.push(hit(K, bar, 2, 0, 0.92, sw))
    if (bar % 2 === 0) h.push(hit(K, bar, 1, 3, 0.38, sw))
    if (isFill) {
      for (let s = 0; s < 4; s++) h.push(hit(K, bar, 3, s, 0.55 + s * 0.10, sw))
    }

    // Snare: dembow + extra rim shots
    h.push(hit(S, bar, 1, 2, 0.95, sw))
    h.push(hit(S, bar, 3, 2, 0.92, sw))
    h.push(hit(S, bar, 1, 0, 0.40, sw))
    h.push(hit(S, bar, 3, 0, 0.38, sw))

    // Hats: 16ths for more energy
    for (let beat = 0; beat < 4; beat++) {
      for (let sub = 0; sub < 4; sub++) {
        const vel = sub === 0 ? 0.45 : sub === 2 ? 0.35 : 0.18
        h.push(hit(H, bar, beat, sub, vel, sw))
      }
    }

    // Perc: shaker pattern
    h.push(hit(P, bar, 0, 1, 0.38, sw))
    h.push(hit(P, bar, 1, 1, 0.30, sw))
    h.push(hit(P, bar, 2, 1, 0.35, sw))
    h.push(hit(P, bar, 3, 1, 0.28, sw))
  }
  return h
}


// ══════════════════════════════════════════════════════════════════════
//  PATTERN VARIANT REGISTRY
// ══════════════════════════════════════════════════════════════════════

// Maps sub-genre → array of pattern builders. The MusicalDirector picks
// from these based on variant index or random selection.

export const SUBGENRE_PATTERNS: Record<HipHopSubGenre, Array<() => DrumHit[]>> = {
  'boom-bap':    [boomBapPattern, boomBapPattern2],
  'trap':        [trapPattern, trapPattern2],
  'drill':       [drillPattern, grittyPattern],
  'lo-fi':       [minimalPattern, glowPattern],
  'west-coast':  [westCoastPattern, westCoastPattern2],
  'dirty-south': [dirtySouthPattern, dirtySouthPattern2],
  'phonk':       [phonkPattern, phonkPattern2],
  'jersey-club': [jerseyClubPattern],
  'bounce':      [bouncePattern],
  'reggaeton':   [reggaetonPattern, reggaetonPattern2],
  'afrobeat':    [afrobeatPattern],
  'chill':       [glowPattern, minimalPattern],
}

// Legacy mode → pattern mapping (preserved for backward compat)
const MODE_PATTERN_VARIANTS: Record<string, Array<() => DrumHit[]>> = {
  heat:   [trapPattern, trapPattern2, drillPattern],
  ice:    [minimalPattern, glowPattern],
  smoke:  [boomBapPattern, boomBapPattern2, afrobeatPattern],
  gravel: [grittyPattern, boomBapPattern2, drillPattern],
  glow:   [glowPattern, minimalPattern, afrobeatPattern],
}

// ══════════════════════════════════════════════════════════════════════
//  GROOVE MUTATION ENGINE
// ══════════════════════════════════════════════════════════════════════
// Mutates an existing pattern to create variation without generating
// a completely new one. This prevents the "same loop forever" problem.

export interface MutationOptions {
  /** Probability of adding a ghost note (0–1) */
  ghostProbability: number
  /** Probability of removing a hit (0–1) — creates space */
  dropProbability: number
  /** Probability of shifting a hit by ±1 sub-division */
  shiftProbability: number
  /** Velocity randomization spread */
  velocitySpread: number
}

const DEFAULT_MUTATION: MutationOptions = {
  ghostProbability: 0.15,
  dropProbability: 0.08,
  shiftProbability: 0.10,
  velocitySpread: 0.06,
}

/**
 * Mutate an existing drum pattern to create subtle variation.
 * Preserves the groove feel while adding human-like imperfection.
 * Never mutates kick on beat 1 or snare on backbeats — those are sacred.
 */
export function mutatePattern(hits: DrumHit[], opts: Partial<MutationOptions> = {}): DrumHit[] {
  const o = { ...DEFAULT_MUTATION, ...opts }
  const result: DrumHit[] = []

  for (const h of hits) {
    // Parse time to check if this is a "sacred" hit
    const parts = h.time.split(':')
    const beat = parseInt(parts[1], 10)
    const sub  = parseFloat(parts[2])
    const isSacred = (h.instrument === K && beat === 0 && sub < 0.5) ||  // kick on beat 1
                     (h.instrument === S && (beat === 1 || beat === 3) && sub < 0.5) // snare on 2/4

    // Never drop or shift sacred hits
    if (isSacred) {
      result.push({ ...h, velocity: hv(h.velocity, o.velocitySpread) })
      continue
    }

    // Drop probability — remove non-essential hits for breathing room
    if (Math.random() < o.dropProbability) continue

    // Shift probability — nudge timing by ±1 16th subdivision
    let mutatedTime = h.time
    if (Math.random() < o.shiftProbability) {
      const newSub = Math.max(0, Math.min(3, sub + (Math.random() < 0.5 ? -0.5 : 0.5)))
      mutatedTime = `${parts[0]}:${parts[1]}:${newSub.toFixed(2)}`
    }

    result.push({
      instrument: h.instrument,
      time: mutatedTime,
      velocity: hv(h.velocity, o.velocitySpread),
    })
  }

  // Ghost note addition — add extra quiet hits on empty slots
  if (Math.random() < o.ghostProbability) {
    const bar = Math.floor(Math.random() * 4)
    const beat = Math.floor(Math.random() * 4)
    const sub = Math.random() < 0.5 ? 1 : 3
    const inst = Math.random() < 0.6 ? H : S
    const sw = 0.3  // moderate swing for ghosts
    result.push(hit(inst, bar, beat, sub, 0.15 + Math.random() * 0.10, sw))
  }

  return result
}

/**
 * Build a pattern for a specific sub-genre with an optional variant index.
 * This is the primary API for the MusicalDirector.
 */
export function buildSubGenrePattern(subGenre: HipHopSubGenre, variantIndex?: number): DrumPattern {
  const variants = SUBGENRE_PATTERNS[subGenre] ?? [minimalPattern]
  const idx = variantIndex !== undefined ? variantIndex % variants.length : Math.floor(Math.random() * variants.length)
  return { hits: variants[idx](), length: '4m' }
}

// ── Legacy API (backward compatible) ──────────────────────────────────

export function getDrumKit(_mode: OrganismMode | string): DrumKit {
  return { kick: [], snare: [], hat: [], perc: [] }
}

export function buildDrumPattern(kit: DrumKit, mode?: OrganismMode | string): DrumPattern {
  const modeStr = mode?.toString() ?? 'glow'
  const variants = MODE_PATTERN_VARIANTS[modeStr] ?? [minimalPattern]
  const builder = variants[Math.floor(Math.random() * variants.length)]
  return { hits: builder(), length: '4m' }
}

/** Get the swing amount for a sub-genre */
export function getSubGenreSwing(subGenre: HipHopSubGenre): number {
  return SWING[subGenre] ?? 0.35
}
