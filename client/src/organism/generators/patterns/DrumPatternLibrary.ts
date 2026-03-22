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

/**
 * Shift off-beat 16ths (sub 1 and 3) later to create swing feel.
 * @param swingAmt 0 = straight, 1 = full 16th delay.
 *   Typical values: boom-bap 0.55–0.65, lo-fi 0.42–0.50,
 *   trap/drill 0.18–0.25 (nearly straight), afrobeat 0.35
 */
function swingTime(bar: number, beat: number, sub: number, swingAmt: number): string {
  const swungSub = (sub === 1 || sub === 3) ? sub + swingAmt : sub
  return `${bar}:${beat}:${swungSub.toFixed(2)}`
}

/** Randomise velocity within a range for humanisation */
function hv(base: number, spread = 0.08): number {
  return Math.min(1, Math.max(0.1, base + (Math.random() - 0.5) * spread * 2))
}

function hit(inst: DrumInstrument, bar: number, beat: number, sub: number, vel: number, swingAmt: number): DrumHit {
  return { instrument: inst, time: swingTime(bar, beat, sub, swingAmt), velocity: hv(vel) }
}

const K = DrumInstrument.Kick
const S = DrumInstrument.Snare
const H = DrumInstrument.Hat
const P = DrumInstrument.Perc

// ── Per-genre swing amounts ───────────────────────────────────────────
// 0 = perfectly straight, 1 = full 16th-note delay on off-beats.
// These live in one place so tuning a genre feel requires one edit.
const SWING = {
  boomBap:  0.60,   // classic MPC / J Dilla pocket
  dilla:    0.65,   // heavier Dilla-esque feel
  lofi:     0.48,   // dusty lo-fi — slightly laid-back
  trap:     0.20,   // trap is mostly straight 16ths
  drill:    0.22,   // UK drill — near-straight
  glow:     0.38,   // atmospheric / dream
  gritty:   0.52,   // hybrid boom-bap×trap
  afrobeat: 0.35,   // moderate clave swing
} as const

// ── Boom-Bap groove (4 bars) ────────────────────────────────────────

function boomBapPattern(sw = SWING.boomBap): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: beat 1 + "and" of 2 + beat 3 (classic boom-bap)
    h.push(hit(K, bar, 0, 0, 0.95, sw))
    h.push(hit(K, bar, 1, 2, 0.72, sw))   // syncopated
    h.push(hit(K, bar, 2, 0, 0.88, sw))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.80, sw))  // fill: extra kick
      h.push(hit(K, bar, 3, 2, 0.65, sw))  // double kick roll
    }

    // Snare: beats 2 and 4 (backbeat)
    h.push(hit(S, bar, 1, 0, 0.92, sw))
    h.push(hit(S, bar, 3, 0, 0.88, sw))
    // Ghost snares for groove
    h.push(hit(S, bar, 0, 2, 0.25, sw))    // ghost
    h.push(hit(S, bar, 2, 2, 0.22, sw))    // ghost
    if (isFill) {
      // Snare drag fill
      h.push(hit(S, bar, 3, 1, 0.55, sw))
      h.push(hit(S, bar, 3, 2, 0.60, sw))
      h.push(hit(S, bar, 3, 3, 0.70, sw))
    }

    // Hats: 8th notes with accented downbeats
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, beat % 2 === 0 ? 0.50 : 0.38, sw))
      h.push(hit(H, bar, beat, 2, 0.28, sw))  // off-beat (swung)
    }

    // Perc: shaker on 2-and and 4-and
    if (!isFill) {
      h.push(hit(P, bar, 1, 2, 0.28, sw))
      h.push(hit(P, bar, 3, 2, 0.25, sw))
    }
  }
  return h
}

// ── Trap groove (4 bars) ─────────────────────────────────────────────

function trapPattern(sw = SWING.trap): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3
    const isHalf = bar === 2  // bar 3 = half-time variation

    // Kick: 808 pattern — beat 1, "and" of 1, beat 3, ghost on "e" of 3
    h.push(hit(K, bar, 0, 0, 1.0,  sw))
    h.push(hit(K, bar, 0, 2, 0.55, sw))   // double
    h.push(hit(K, bar, 2, 0, 0.88, sw))
    if (!isHalf) {
      h.push(hit(K, bar, 2, 3, 0.48, sw))  // ghost kick
    }
    if (isFill) {
      // Triplet kick roll into bar 1
      h.push(hit(K, bar, 3, 0, 0.75, sw))
      h.push(hit(K, bar, 3, 1, 0.68, sw))
      h.push(hit(K, bar, 3, 2, 0.80, sw))
      h.push(hit(K, bar, 3, 3, 0.72, sw))
    }

    // Snare/clap: beats 2 and 4
    h.push(hit(S, bar, 1, 0, 0.95, sw))
    h.push(hit(S, bar, 3, 0, 0.90, sw))
    // Ghost snares — subtle pocket hits before the backbeat
    h.push(hit(S, bar, 0, 3, 0.18, sw))   // ghost before beat 2
    h.push(hit(S, bar, 2, 3, 0.16, sw))   // ghost before beat 4
    if (bar % 2 === 1) {
      h.push(hit(S, bar, 1, 2, 0.20, sw)) // ghost on "and" of 2 every other bar
    }
    if (isFill) {
      // Snare roll
      for (let s = 0; s < 4; s++) {
        h.push(hit(S, bar, 3, s, 0.50 + s * 0.12, sw))
      }
    }

    // Hats: 16th note rolls with open-hat accents
    for (let beat = 0; beat < 4; beat++) {
      for (let sub = 0; sub < 4; sub++) {
        // Skip hat on snare beats to avoid clutter
        if ((beat === 1 || beat === 3) && sub === 0) continue
        const accent = sub === 0 ? 0.48 : sub === 2 ? 0.35 : 0.22
        h.push(hit(H, bar, beat, sub, isHalf ? accent * 0.6 : accent, sw))
      }
    }

    // Perc: rim on "and" of 2, "and" of 4
    h.push(hit(P, bar, 1, 2, 0.30, sw))
    h.push(hit(P, bar, 3, 2, 0.26, sw))
  }
  return h
}

// ── Boom-Bap 2: Dilla-influenced, heavy pocket (4 bars) ──────────────

function boomBapPattern2(sw = SWING.dilla): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: beat 1, syncopated "and" of 3 — late and heavy
    h.push(hit(K, bar, 0, 0, 0.92, sw))
    h.push(hit(K, bar, 1, 1, 0.35, sw))  // ghost before 2-and
    h.push(hit(K, bar, 2, 2, 0.80, sw))  // "and" of 3
    h.push(hit(K, bar, 3, 1, 0.42, sw))  // ghost before 4
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.82, sw))
      h.push(hit(K, bar, 3, 2, 0.70, sw))
    }

    // Snare: beats 2 and 4 + heavier ghost pocket
    h.push(hit(S, bar, 1, 0, 0.90, sw))
    h.push(hit(S, bar, 3, 0, 0.86, sw))
    h.push(hit(S, bar, 0, 3, 0.18, sw))  // ghost
    h.push(hit(S, bar, 1, 3, 0.22, sw))  // ghost
    h.push(hit(S, bar, 2, 3, 0.20, sw))  // ghost
    if (isFill) {
      h.push(hit(S, bar, 3, 1, 0.48, sw))
      h.push(hit(S, bar, 3, 2, 0.58, sw))
      h.push(hit(S, bar, 3, 3, 0.70, sw))
    }

    // Hats: quarter notes — open, lazy feel
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, beat % 2 === 0 ? 0.55 : 0.42, sw))
    }

    // Perc: rim on "and" of 1 and "and" of 3
    h.push(hit(P, bar, 0, 2, 0.22, sw))
    h.push(hit(P, bar, 2, 2, 0.20, sw))
  }
  return h
}

// ── Trap 2: sparse hi-hat triplet feel (4 bars) ───────────────────────

function trapPattern2(sw = SWING.trap): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: simple 1 and 3 with ghost before 3
    h.push(hit(K, bar, 0, 0, 1.0,  sw))
    h.push(hit(K, bar, 2, 0, 0.85, sw))
    if (!isFill) h.push(hit(K, bar, 2, 3, 0.42, sw))  // ghost
    if (isFill) {
      for (let s = 0; s < 4; s++) h.push(hit(K, bar, 3, s, 0.55 + s * 0.1, sw))
    }

    // Snare/clap: 2 and 4
    h.push(hit(S, bar, 1, 0, 0.95, sw))
    h.push(hit(S, bar, 3, 0, 0.92, sw))

    // Hats: sparse — off-beat double hits for triplet trap feel
    for (let beat = 0; beat < 4; beat++) {
      if ((beat === 1 || beat === 3) && !isFill) {
        h.push(hit(H, bar, beat, 1, 0.28, sw))
        h.push(hit(H, bar, beat, 2, 0.35, sw))
      } else {
        h.push(hit(H, bar, beat, 0, 0.40, sw))
        h.push(hit(H, bar, beat, 2, 0.25, sw))
      }
    }

    // Perc: rim on "a" of 2 and 4
    h.push(hit(P, bar, 1, 3, 0.28, sw))
    h.push(hit(P, bar, 3, 3, 0.24, sw))
  }
  return h
}

// ── Glow / dream groove: sparse quarter-note hats, wide kicks ─────────

function glowPattern(sw = SWING.glow): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    // Kick: beat 1 only; every other bar adds beat 3
    h.push(hit(K, bar, 0, 0, 0.80, sw))
    if (bar % 2 === 1) h.push(hit(K, bar, 2, 0, 0.65, sw))

    // Snare: beat 3 only (half-time feel)
    h.push(hit(S, bar, 2, 0, 0.75, sw))
    // Ghost snares — very soft, add human pocket to the dream
    h.push(hit(S, bar, 1, 3, 0.12, sw))   // whisper ghost before beat 3
    if (bar % 2 === 1) {
      h.push(hit(S, bar, 3, 2, 0.10, sw)) // occasional ghost on "and" of 4
    }

    // Hats: light quarter notes
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, 0.30, sw))
    }

    // Perc: subtle shaker on off-beats for gentle movement (every other bar)
    if (bar % 2 === 0) {
      h.push(hit(P, bar, 1, 2, 0.15, sw))
      h.push(hit(P, bar, 3, 2, 0.12, sw))
    }
  }
  return h
}

// ── Minimal / Lo-fi groove (4 bars) ──────────────────────────────────

function minimalPattern(sw = SWING.lofi): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: just beat 1 and beat 3
    h.push(hit(K, bar, 0, 0, 0.85, sw))
    h.push(hit(K, bar, 2, 0, 0.75, sw))

    // Snare: beat 2 only (half-time feel)
    h.push(hit(S, bar, 1, 0, 0.80, sw))
    if (bar % 2 === 1) {
      h.push(hit(S, bar, 3, 0, 0.65, sw))  // every other bar adds beat 4
    }
    // Ghost snares — dusty, laid-back pocket
    h.push(hit(S, bar, 0, 3, 0.14, sw))   // ghost before beat 2
    if (bar >= 2) {
      h.push(hit(S, bar, 2, 3, 0.12, sw)) // ghost before beat 4 (bars 3-4 only)
    }
    if (isFill) {
      h.push(hit(S, bar, 3, 2, 0.55, sw))
      h.push(hit(S, bar, 3, 3, 0.62, sw))
    }

    // Hats: sparse off-beats only (swung)
    h.push(hit(H, bar, 0, 2, 0.38, sw))
    h.push(hit(H, bar, 1, 2, 0.32, sw))
    h.push(hit(H, bar, 2, 2, 0.36, sw))
    h.push(hit(H, bar, 3, 2, 0.30, sw))
  }
  return h
}

// ── Hybrid Gritty groove (gravel mode) ───────────────────────────────

function grittyPattern(sw = SWING.gritty): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: boom-bap base + trap double
    h.push(hit(K, bar, 0, 0, 0.95, sw))
    h.push(hit(K, bar, 0, 3, 0.48, sw))  // ghost
    h.push(hit(K, bar, 1, 2, 0.70, sw))  // syncopated
    h.push(hit(K, bar, 2, 0, 0.90, sw))
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.80, sw))
      h.push(hit(K, bar, 3, 2, 0.72, sw))
    }

    // Snare: hard backbeat with ghost grace note
    h.push(hit(S, bar, 0, 3, 0.20, sw))  // ghost before 2
    h.push(hit(S, bar, 1, 0, 0.93, sw))
    h.push(hit(S, bar, 2, 3, 0.18, sw))  // ghost before 4
    h.push(hit(S, bar, 3, 0, 0.90, sw))
    if (isFill) {
      h.push(hit(S, bar, 3, 1, 0.50, sw))
      h.push(hit(S, bar, 3, 2, 0.58, sw))
      h.push(hit(S, bar, 3, 3, 0.68, sw))
    }

    // Hats: 8th notes, drop on beat 3 of bar 3 for breathing
    for (let beat = 0; beat < 4; beat++) {
      if (bar === 2 && beat >= 2) continue  // drop-out
      h.push(hit(H, bar, beat, 0, 0.45, sw))
      h.push(hit(H, bar, beat, 2, 0.30, sw))
    }

    // Perc: rim shots
    h.push(hit(P, bar, 1, 2, 0.30, sw))
    if (bar % 2 === 0) h.push(hit(P, bar, 3, 2, 0.24, sw))
  }
  return h
}

// ── UK Drill groove (4 bars) ──────────────────────────────────────────

function drillPattern(sw = SWING.drill): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: offbeat — "and" of 1, beat 2-and, "a" of 3
    h.push(hit(K, bar, 0, 2, 0.92, sw))   // "and" of 1
    h.push(hit(K, bar, 1, 2, 0.78, sw))   // "and" of 2
    h.push(hit(K, bar, 2, 3, 0.85, sw))   // "a" of 3
    if (isFill) {
      h.push(hit(K, bar, 3, 0, 0.80, sw))
      h.push(hit(K, bar, 3, 2, 0.70, sw))
    }

    // Snare/clap: only beat 3 (half-time)
    h.push(hit(S, bar, 2, 0, 0.95, sw))
    // Ghost snares — very subdued
    h.push(hit(S, bar, 0, 3, 0.15, sw))
    h.push(hit(S, bar, 1, 3, 0.18, sw))
    if (isFill) {
      h.push(hit(S, bar, 3, 2, 0.50, sw))
      h.push(hit(S, bar, 3, 3, 0.65, sw))
    }

    // Hats: 16th roll but gaps for pocket
    for (let beat = 0; beat < 4; beat++) {
      if (beat === 2 && bar % 2 === 0) continue  // skip beat 3 every other bar
      for (let sub = 0; sub < 4; sub++) {
        if (sub === 0 && (beat === 1 || beat === 3)) continue  // skip on snare beats
        const accent = sub === 0 ? 0.42 : sub === 2 ? 0.30 : 0.18
        h.push(hit(H, bar, beat, sub, accent, sw))
      }
    }

    // Perc: dark rim on "and" of 2
    h.push(hit(P, bar, 1, 2, 0.32, sw))
    if (bar % 2 === 1) h.push(hit(P, bar, 3, 2, 0.26, sw))
  }
  return h
}

// ── Afrobeat groove (4 bars) ──────────────────────────────────────────

function afrobeatPattern(sw = SWING.afrobeat): DrumHit[] {
  const h: DrumHit[] = []
  for (let bar = 0; bar < 4; bar++) {
    const isFill = bar === 3

    // Kick: 1, "a" of 1, "and" of 2 — offbeat heavy
    h.push(hit(K, bar, 0, 0, 0.90, sw))
    h.push(hit(K, bar, 0, 3, 0.52, sw))   // "a" of 1
    h.push(hit(K, bar, 1, 2, 0.82, sw))   // "and" of 2
    h.push(hit(K, bar, 3, 0, 0.75, sw))   // beat 4
    if (isFill) {
      h.push(hit(K, bar, 3, 2, 0.68, sw))
      h.push(hit(K, bar, 3, 3, 0.72, sw))
    }

    // Snare: beat 2 + beat 4 with ghost grace notes
    h.push(hit(S, bar, 1, 0, 0.88, sw))
    h.push(hit(S, bar, 3, 0, 0.85, sw))
    h.push(hit(S, bar, 0, 3, 0.22, sw))   // ghost
    h.push(hit(S, bar, 2, 3, 0.20, sw))   // ghost

    // Hats: 8th notes with accent on "and" beats
    for (let beat = 0; beat < 4; beat++) {
      h.push(hit(H, bar, beat, 0, beat % 2 === 1 ? 0.52 : 0.38, sw))   // offbeat accent
      h.push(hit(H, bar, beat, 2, 0.32, sw))
    }

    // Perc: clave-inspired — "e" of 2 and "and" of 3
    h.push(hit(P, bar, 1, 1, 0.45, sw))
    h.push(hit(P, bar, 2, 2, 0.40, sw))
    if (bar % 2 === 0) h.push(hit(P, bar, 3, 1, 0.35, sw))
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
