// client/src/organism/generators/freeplay/DrumImproviser.ts
// Freeplay drums: the sub-genre SKELETON (kick/snare anchors) is authored and
// immutable — boom-bap stays boom-bap. Everything AROUND it (extra kicks, hat
// density, ghosts, rolls, fills) is improvised from energy/density + motif.

import { DrumInstrument, type DrumHit } from '../types'
import type { FreeplayContext } from './types'
import { getSectionMotif } from './motif'
import { swungTime, jitterVel } from './utils'

/** Immutable per-genre backbone (16th slots 0..15). Slot 4 = beat 2, 12 = beat 4. */
export const SKELETONS: Record<string, { kicks: number[]; snares: number[] }> = {
  'boom-bap':    { kicks: [0, 6, 10],        snares: [4, 12] },
  'trap':        { kicks: [0, 10],           snares: [8] },        // half-time clap on 3
  'drill':       { kicks: [0, 9],            snares: [8] },
  'lo-fi':       { kicks: [0, 8],            snares: [4, 12] },
  'west-coast':  { kicks: [0, 7, 10],        snares: [4, 12] },
  'dirty-south': { kicks: [0, 6],            snares: [4, 12] },
  'phonk':       { kicks: [0, 7, 11],        snares: [4, 12] },
  'jersey-club': { kicks: [0, 6, 10, 13],    snares: [4, 12] },
  'bounce':      { kicks: [0, 7, 10],        snares: [4, 12] },
  'reggaeton':   { kicks: [0, 4, 8, 12],     snares: [3, 7, 11, 14] }, // dembow
  'afrobeat':    { kicks: [0, 7],            snares: [4, 12] },
  'chill':       { kicks: [0, 8],            snares: [4, 12] },
}

const K = DrumInstrument.Kick
const S = DrumInstrument.Snare
const H = DrumInstrument.Hat

function push(hits: DrumHit[], inst: DrumInstrument, bar: number, slot: number, vel: number, swing: number, rng: () => number): void {
  hits.push({ instrument: inst, time: swungTime(bar, slot, swing), velocity: jitterVel(vel, rng) })
}

export function buildFreeplayDrumHits(ctx: FreeplayContext): DrumHit[] {
  const skeleton = SKELETONS[ctx.subGenre] ?? SKELETONS['boom-bap']
  const hits: DrumHit[] = []

  // Slots forbidden for improvised additions: the backbone and its neighbours.
  const protectedSlots = new Set<number>()
  for (const s of [...skeleton.kicks, ...skeleton.snares]) {
    protectedSlots.add(s); protectedSlots.add(s - 1); protectedSlots.add(s + 1)
  }

  // ONE extra-kick motif per section — repeats every bar (A-A-A-A for kicks;
  // the development lives in hats/ghosts/fill, keeping the floor rock solid).
  // Extra kicks are SYNCOPATION ONLY: never on the quarter notes (0/4/8/12) —
  // adding beat-3 kicks turned boom-bap into four-on-the-floor house (measured
  // by ear + WebEar describe, 2026-07-02). Max 2 per bar keeps the floor hip-hop.
  const kickMotif = getSectionMotif(
    `drums:${ctx.sectionName}:${ctx.subGenre}`,
    ctx.rng,
    Math.min(ctx.density, 0.4),
    [],
  ).slots
    .filter(s => !protectedSlots.has(s) && s % 4 !== 0)
    .slice(0, 2)

  for (let bar = 0; bar < ctx.bars; bar++) {
    const isFillBar = bar === ctx.bars - 1

    // 1) Skeleton (immutable, loud)
    for (const s of skeleton.kicks) push(hits, K, bar, s, 0.95, ctx.swing, ctx.rng)
    for (const s of skeleton.snares) push(hits, S, bar, s, 0.9, ctx.swing, ctx.rng)

    // 2) Improvised extra kicks (quieter than the backbone)
    for (const s of kickMotif) {
      if (ctx.rng() < 0.8) push(hits, K, bar, s, 0.6, ctx.swing, ctx.rng)
    }

    // 3) Hats: 8ths always; 16th infill probability scales with density;
    //    occasional roll replaces the last 8th of odd bars at high energy.
    for (let slot = 0; slot < 16; slot++) {
      const isEighth = slot % 2 === 0
      const rollZone = slot >= 14 && bar % 2 === 1 && ctx.energy > 0.6
      if (rollZone) continue // handled below
      if (isEighth) {
        const accent = slot % 4 === 0 ? 0.48 : 0.35
        push(hits, H, bar, slot, accent, ctx.swing, ctx.rng)
      } else if (ctx.rng() < ctx.density * 0.5) {
        push(hits, H, bar, slot, 0.22, ctx.swing, ctx.rng)
      }
    }
    if (bar % 2 === 1 && ctx.energy > 0.6 && ctx.rng() < 0.7) {
      // 32nd hat roll across the last two 16ths (slots 14-15 as 4 hits)
      for (let i = 0; i < 4; i++) {
        hits.push({
          instrument: H,
          time: `${bar}:3:${(2 + i * 0.5).toFixed(2)}`,
          velocity: jitterVel(0.3 + i * 0.08, ctx.rng),
        })
      }
    }

    // 4) Ghost snares (feel, not backbeat — velocity stays under 0.3)
    for (const s of [3, 7, 11]) {
      if (!protectedSlots.has(s) && ctx.rng() < ctx.density * 0.35) {
        push(hits, S, bar, s, 0.2, ctx.swing, ctx.rng)
      }
    }

    // 5) Fill: last beat of bar 4, intensity from energy
    if (isFillBar && ctx.energy >= 0.3) {
      const fillSlots = ctx.energy > 0.7 ? [12, 13, 14, 15] : [13, 14, 15]
      fillSlots.forEach((s, i) => push(hits, S, bar, s, 0.5 + i * 0.12, ctx.swing, ctx.rng))
    }
  }

  return hits
}
