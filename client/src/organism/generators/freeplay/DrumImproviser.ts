// client/src/organism/generators/freeplay/DrumImproviser.ts
// Freeplay drums: the sub-genre SKELETON (kick/snare anchors) is authored and
// immutable — boom-bap stays boom-bap. The skeleton IS the groove: extra kicks,
// ghost snares and 16th hat infill were removed (2026-07-11 fire-beats) because
// they buried the backbone the ear needs to lock onto. Improvisation is now
// limited to open-hat accents and the phrase-end fill.

import { DrumInstrument, type DrumHit } from '../types'
import type { FreeplayContext } from './types'
import { swungTime, jitterVel } from './utils'
import { getSongCell } from './songCell'

/** Immutable per-genre backbone (16th slots 0..15). Slot 4 = beat 2, 12 = beat 4.
 *  `kicks` is the bar-A pattern; `kicksB` answers it on odd bars — hip-hop kick
 *  programming lives on a 2-bar call/response cycle, and looping a single bar of
 *  kicks ×4 was the strongest remaining "it feels looped" signal. Genres whose
 *  kick pattern IS the genre (jersey club, reggaeton dembow) keep A === B. */
export const SKELETONS: Record<string, { kicks: number[]; kicksB: number[]; snares: number[] }> = {
  'boom-bap':    { kicks: [0, 6, 10],     kicksB: [0, 7, 10],     snares: [4, 12] },
  'trap':        { kicks: [0, 10],        kicksB: [0, 6, 13],     snares: [8] },        // half-time clap on 3
  'drill':       { kicks: [0, 9],         kicksB: [0, 9, 14],     snares: [8] },
  'lo-fi':       { kicks: [0, 8],         kicksB: [0, 8, 11],     snares: [4, 12] },
  'west-coast':  { kicks: [0, 7, 10],     kicksB: [0, 7, 11],     snares: [4, 12] },
  'dirty-south': { kicks: [0, 6],         kicksB: [0, 6, 11],     snares: [4, 12] },
  'phonk':       { kicks: [0, 7, 11],     kicksB: [0, 7, 14],     snares: [4, 12] },
  'jersey-club': { kicks: [0, 6, 10, 13], kicksB: [0, 6, 10, 13], snares: [4, 12] },
  'bounce':      { kicks: [0, 7, 10],     kicksB: [0, 3, 10],     snares: [4, 12] },
  'reggaeton':   { kicks: [0, 4, 8, 12],  kicksB: [0, 4, 8, 12],  snares: [3, 7, 11, 14] }, // dembow
  'afrobeat':    { kicks: [0, 7],         kicksB: [0, 7, 10],     snares: [4, 12] },
  'chill':       { kicks: [0, 8],         kicksB: [0, 8],         snares: [4, 12] },
  'r&b-soul':    { kicks: [0, 8],         kicksB: [0, 6, 10],     snares: [4, 12] },    // laid-back, ghost kicks on B
  'funk':        { kicks: [0, 6, 10],     kicksB: [0, 7, 10],     snares: [4, 12] },    // tight syncopated pocket
  'house':       { kicks: [0, 4, 8, 12],  kicksB: [0, 4, 8, 12],  snares: [4, 12] },    // four-on-the-floor
  'dnb':         { kicks: [0, 6],         kicksB: [0, 6, 11],     snares: [8] },        // half-time snare, rolling kicks
}

const K = DrumInstrument.Kick
const S = DrumInstrument.Snare
const H = DrumInstrument.Hat
const P = DrumInstrument.Perc

/** Open-hat accents live on the off-beat 8ths ("the and"). Velocity must clear
 *  the kit's open/closed split (>0.55 in SampledDrumKit.resolveVoice). */
const OPEN_HAT_CANDIDATES = [6, 14, 2, 10]
const OPEN_HAT_VELOCITY = 0.68

/** Fill flavours for the last beat of bar 4 — rotating so consecutive phrases
 *  don't all end on the same ascending snare run (the stockest fill there is). */
type FillType = 'snare-run' | 'kick-stutter' | 'cut' | 'perc-run'
const FILL_TYPES: FillType[] = ['snare-run', 'kick-stutter', 'cut', 'perc-run']

function push(hits: DrumHit[], inst: DrumInstrument, bar: number, slot: number, vel: number, swing: number, rng: () => number): void {
  hits.push({ instrument: inst, time: swungTime(bar, slot, swing), velocity: jitterVel(vel, rng) })
}

export function buildFreeplayDrumHits(ctx: FreeplayContext): DrumHit[] {
  const skeleton = SKELETONS[ctx.subGenre] ?? SKELETONS['boom-bap']
  const hits: DrumHit[] = []

  // Slots forbidden for improvised additions: the backbone (both bar variants)
  // and its neighbours.
  const protectedSlots = new Set<number>()
  for (const s of [...skeleton.kicks, ...skeleton.kicksB, ...skeleton.snares]) {
    protectedSlots.add(s); protectedSlots.add(s - 1); protectedSlots.add(s + 1)
  }

  // The skeleton IS the groove (fire-beats 2026-07-11): random extra kicks,
  // ghost snares and 16th hat infill buried the backbone, so they stay gone.
  //
  // COHESION (2026-07-12): but the drums must still ACCENT the song cell — the
  // one idea the whole band is playing. These are not random extra kicks; they
  // are the drums stating the section's rhythm. Max 2, never on a quarter note
  // (a beat-3 kick turns boom-bap into house), never near the skeleton's own
  // hits. That keeps the pocket locked while making the kick agree with what the
  // bass is landing on and the chords are answering.
  const cell = getSongCell(ctx.sectionName, ctx.subGenre, ctx.rng, ctx.density)
  const kickMotif: number[] = cell.accents
    .filter(s => s !== 0 && s % 4 !== 0 && !protectedSlots.has(s))
    .slice(0, 2)
  const hatInfill = new Set<number>()

  // 0-2 open-hat accents per bar, drawn once per phrase so the placement is an
  // idea, not noise. Kept off slots where the closed 8th grid would double them.
  const openHatSlots = OPEN_HAT_CANDIDATES
    .filter(() => ctx.rng() < 0.25 + ctx.density * 0.35)
    .slice(0, 2)

  // Pick this phrase's fill flavour up front so the hat loop can honour a
  // "cut" fill (silence IS the fill) by leaving the last beat empty.
  const fillType: FillType = FILL_TYPES[Math.floor(ctx.rng() * FILL_TYPES.length)]

  for (let bar = 0; bar < ctx.bars; bar++) {
    const isFillBar = bar === ctx.bars - 1
    const cutFill = isFillBar && ctx.energy >= 0.3 && fillType === 'cut'
    const barKicks = bar % 2 === 0 ? skeleton.kicks : skeleton.kicksB

    // 1) Skeleton (immutable, loud) — bar A / bar B kick call-and-response
    for (const s of barKicks) push(hits, K, bar, s, 0.95, ctx.swing, ctx.rng)
    for (const s of skeleton.snares) push(hits, S, bar, s, 0.9, ctx.swing, ctx.rng)

    // 2) Improvised extra kicks (quieter than the backbone)
    for (const s of kickMotif) {
      if (ctx.rng() < 0.8) push(hits, K, bar, s, 0.6, ctx.swing, ctx.rng)
    }

    // 3) Hats: 8ths always (open-hat accents on chosen "ands"); 16th infill
    //    from the committed motif; occasional roll replaces the last 8th of
    //    odd bars at high energy.
    for (let slot = 0; slot < 16; slot++) {
      if (cutFill && slot >= 12) continue // fill = silence, let the beat breathe
      const isEighth = slot % 2 === 0
      const rollZone = slot >= 14 && isFillBar && ctx.energy > 0.6
      if (rollZone) continue // handled below
      if (isEighth) {
        if (openHatSlots.includes(slot)) {
          push(hits, H, bar, slot, OPEN_HAT_VELOCITY, ctx.swing, ctx.rng)
        } else {
          const accent = slot % 4 === 0 ? 0.48 : 0.35
          push(hits, H, bar, slot, accent, ctx.swing, ctx.rng)
        }
      } else if (hatInfill.has(slot)) {
        // LOCK (2026-07-11 fire-beats cohesion): the committed infill plays
        // EVERY bar, deterministically — no per-bar coin flip. The AI listen
        // heard "busy, wandering hats that never lock into a groove"; the
        // rng gate made the committed figure flicker bar-to-bar so the pattern
        // never repeated. An instrumental beat's hats are a REPEATING loop.
        // The random off-motif sparkle is dropped for the same reason.
        push(hits, H, bar, slot, 0.24, ctx.swing, ctx.rng)
      }
    }
    // Roll only on the phrase's fill bar now (was every odd bar, 70% of the
    // time) — "too many drums / so fast": the 32nd roll is the fastest element,
    // so it becomes a deliberate once-per-phrase fill instead of constant chatter.
    if (isFillBar && ctx.energy > 0.6 && !cutFill) {
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

    // 5) Fill: last beat of bar 4, flavour rotates per phrase, intensity from energy
    if (isFillBar && ctx.energy >= 0.3) {
      const hot = ctx.energy > 0.7
      switch (fillType) {
        case 'snare-run': {
          const fillSlots = hot ? [12, 13, 14, 15] : [13, 14, 15]
          fillSlots.forEach((s, i) => push(hits, S, bar, s, 0.5 + i * 0.12, ctx.swing, ctx.rng))
          break
        }
        case 'kick-stutter': {
          push(hits, K, bar, 12, 0.75, ctx.swing, ctx.rng)
          push(hits, K, bar, 14, 0.55, ctx.swing, ctx.rng)
          push(hits, S, bar, 15, hot ? 0.7 : 0.55, ctx.swing, ctx.rng)
          break
        }
        case 'cut': {
          // Hats already muted for slots 12-15 above; one lone snare marks the gap.
          push(hits, S, bar, 14, 0.6, ctx.swing, ctx.rng)
          break
        }
        case 'perc-run': {
          const fillSlots = hot ? [12, 13, 14, 15] : [13, 14, 15]
          fillSlots.forEach((s, i) => push(hits, P, bar, s, 0.45 + i * 0.1, ctx.swing, ctx.rng))
          break
        }
      }
    }
  }

  return hits
}
