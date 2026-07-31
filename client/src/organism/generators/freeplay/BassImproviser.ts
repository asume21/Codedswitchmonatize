// Freeplay bass: improvise a 4-bar line from the LIVE chord's tones, anchored
// to the kick. The conductor informs (root, intervals, swing); this writes notes.

import type { ScheduledNote } from '../types'
import type { FreeplayContext } from './types'
import { midiToNote, swungTime, jitterVel } from './utils'
import { getSongCell } from './songCell'
import { bassVelocityForJob } from './score'

/** Same register rule as BassGenerator.bassRootFromMidi (33..48, pitch class kept). */
function clampToBassRegister(midi: number): number {
  let m = midi
  while (m > 48) m -= 12
  while (m < 33) m += 12
  return m
}

const SUSTAINED_SUBGENRES = new Set(['trap', 'drill', 'phonk', 'dirty-south'])
const WALKING_SUBGENRES = new Set(['jazz', 'classical', 'funk', 'gospel', 'boom-bap', 'lo-fi'])
const HOUSE_SUBGENRES = new Set(['house', 'dnb', 'techno', 'edm'])
const POP_SUBGENRES = new Set(['pop', 'r&b-soul', 'soul', 'k-pop', 'j-pop', 'afrobeat', 'reggaeton'])
type SectionKind = 'intro' | 'verse' | 'hook' | 'drop' | 'breakdown' | 'bridge'

function sectionKind(sectionName: string): SectionKind {
  const n = sectionName.toLowerCase()
  if (n.includes('intro')) return 'intro'
  if (n.includes('drop')) return 'drop'
  if (n.includes('hook') || n.includes('chorus')) return 'hook'
  if (n.includes('break')) return 'breakdown'
  if (n.includes('bridge')) return 'bridge'
  return 'verse'
}

/** Chromatic leading tone into `nextRoot`, approached from the direction of
 *  travel. Falls back to the other side if the preferred tone leaves the bass
 *  register — an octave-displaced approach loses the semitone pull. */
function approachTone(nextRoot: number, ascending: boolean): number {
  const preferred = ascending ? nextRoot - 1 : nextRoot + 1
  if (preferred >= 33 && preferred <= 48) return preferred
  const other = ascending ? nextRoot + 1 : nextRoot - 1
  if (other >= 33 && other <= 48) return other
  return clampToBassRegister(preferred)
}

/**
 * The bass HITS while the harmony holds, and WALKS when it moves.
 *
 * A bassline exists to CONNECT chord changes. When the chord sits still, a
 * walking line has nothing to connect and just sounds busy (the old motif bass
 * walked constantly — WebEar heard "very active plucky bass … Tech House").
 * When the chord moves, the bass earns its motion by leading the ear into the
 * new root. The orchestrator advances the Conductor's chord on the last bar of
 * the phrase, so bars 0..n-2 always hold and only the final bar can move.
 *
 * The two idioms differ by genre:
 *  - sustained (trap/drill/phonk): hold the 808, then GLIDE into the next root.
 *    The mono 808's portamento turns the late onset into the classic trap slide.
 *  - everything else (boom-bap/lo-fi/jazzy): a walking line through the chord's
 *    real tones into a chromatic approach on beat 4.
 */
export function buildFreeplayBassNotes(ctx: FreeplayContext): ScheduledNote[] {
  const root = clampToBassRegister(ctx.rootMidi)
  const kind = sectionKind(ctx.sectionName)
  const sustained = SUSTAINED_SUBGENRES.has(ctx.subGenre)
  const walking = WALKING_SUBGENRES.has(ctx.subGenre)
  const house = HOUSE_SUBGENRES.has(ctx.subGenre)
  const pop = POP_SUBGENRES.has(ctx.subGenre)
  const notes: ScheduledNote[] = []

  const nextRoot = ctx.nextRootMidi === undefined ? root : clampToBassRegister(ctx.nextRootMidi)
  const harmonyMoves = nextRoot !== root
  const ascending = nextRoot > root

  // A walking genre only WALKS when there is somewhere to walk to. This is the
  // contract stated on FreeplayContext.nextRootMidi: "Same as rootMidi (or absent)
  // = the harmony is holding, so there is nothing for a bassline to connect — the
  // bass hits instead of walking."
  //
  // Without this, boom-bap/jazz/funk/gospel/lo-fi took the walking pattern
  // ([0,4,8,12], four notes a bar, root-fifth-third-fifth) even over a static
  // chord: busy movement going nowhere, sitting in the low end where it crowds
  // the vocal. Falling back to the simple pattern makes a held chord read as an
  // anchor instead of an unresolved run.
  //
  // House is deliberately NOT included — four-on-the-floor pumping is the point of
  // house bass and should keep pumping whether the harmony moves or not.
  const walkingActive = walking && harmonyMoves

  // ── Genre-specific hit patterns ───────────────────────────────────
  const hitPatterns: Record<SectionKind, number[]> = house ? {
    intro:      [0, 8],
    verse:      [0, 4, 8, 12],     // four-on-the-floor pumping
    hook:       [0, 4, 8, 12],
    drop:       [0, 4, 8, 12],
    breakdown:  [0, 8],
    bridge:     [0, 4, 8, 12],
  } : walkingActive ? {
    intro:      [0],
    verse:      [0, 4, 8, 12],     // walking — every beat
    hook:       [0, 4, 8, 12],
    drop:       [0, 4, 8, 12],
    breakdown:  [0, 8],
    bridge:     [0, 4, 8, 12],
  } : pop ? {
    intro:      [0],
    verse:      [0, 8],            // simple root-fifth
    hook:       [0, 6, 12],
    drop:       [0, 8],
    breakdown:  [0],
    bridge:     [0, 8],
  } : {
    intro:      [0],
    verse:      [0, 8],
    hook:       [0, 6, 12],
    drop:       [0, 8],
    breakdown:  [0],
    bridge:     [0, 8],
  }

  // Real chord quality — the setBassChordQuality lesson: never assume minor.
  // Declared BEFORE hitContour on purpose: it used to live below, so the walking
  // contour couldn't reach it and hardcoded 5 instead (see below).
  const third = ctx.chordIntervals.includes(4) && !ctx.chordIntervals.includes(3) ? 4 : 3

  const hitContour: number[] = house
    ? [0, 12, 0, 12]               // root, octave, root, octave — pumping
    : walkingActive
      // root, fifth, THIRD, fifth. This was hardcoded [0, 7, 5, 7] — but 5
      // semitones is a FOURTH, not a third (minor 3rd = 3, major 3rd = 4), so
      // every walking line put an F over a C chord: a non-chord tone that only
      // makes sense as a passing note and just clashes when held. Use the chord's
      // real third, same as the walk below already does.
      ? [0, 7, third, 7]
      : kind === 'hook'
        ? [0, 7, 0]
        : kind === 'drop'
          ? [0, 12]
          : [0, 0]

  // COHESION — land on the SONG CELL, not on a pattern of our own invention.
  // The fixed patterns above ignored what every other player was doing, which is
  // a large part of why the band had no cohesion. Keep the downbeat (the bass
  // must anchor), then take the rest of this section's onsets FROM the shared
  // idea, capped at the section's onset budget so the bass still breathes.
  const cell = getSongCell(ctx.sectionName, ctx.subGenre, ctx.rng, ctx.density)
  const budget = hitPatterns[kind].length
  const fromCell = cell.slots.filter(s => s !== 0).slice(0, Math.max(0, budget - 1))
  const hitSlots = [0, ...fromCell].sort((a, b) => a - b)

  for (let bar = 0; bar < ctx.bars; bar++) {
    const isFinalBar = bar === ctx.bars - 1

    // ── LINE: the chord changes at this bar's end — walk into it ────
    if (isFinalBar && harmonyMoves) {
      if (sustained) {
        notes.push({
          pitch: midiToNote(root),
          duration: '2n',
          velocity: jitterVel(0.9, ctx.rng),
          time: swungTime(bar, 0, ctx.swing),
        })
        notes.push({
          pitch: midiToNote(nextRoot),
          duration: '8n',
          velocity: jitterVel(0.7, ctx.rng),
          time: swungTime(bar, 14, ctx.swing),
        })
      } else if (walking) {
        // Classical/jazz walking: stepwise approach with passing tones
        const stepDir = ascending ? 2 : -2
        const steps = [
          { slot: 0,  midi: root },
          { slot: 4,  midi: clampToBassRegister(root + stepDir) },
          { slot: 8,  midi: clampToBassRegister(root + stepDir * 2) },
          { slot: 12, midi: approachTone(nextRoot, ascending) },
        ]
        for (const { slot, midi } of steps) {
          notes.push({
            pitch: midiToNote(midi),
            duration: '4n',
            velocity: jitterVel(slot === 0 ? 0.85 : 0.65, ctx.rng),
            time: swungTime(bar, slot, ctx.swing),
          })
        }
      } else if (house) {
        // House/DnB: octave pump into the change
        notes.push({
          pitch: midiToNote(root),
          duration: '8n',
          velocity: jitterVel(0.9, ctx.rng),
          time: swungTime(bar, 0, ctx.swing),
        })
        notes.push({
          pitch: midiToNote(clampToBassRegister(root + 12)),
          duration: '8n',
          velocity: jitterVel(0.8, ctx.rng),
          time: swungTime(bar, 4, ctx.swing),
        })
        notes.push({
          pitch: midiToNote(root),
          duration: '8n',
          velocity: jitterVel(0.85, ctx.rng),
          time: swungTime(bar, 8, ctx.swing),
        })
        notes.push({
          pitch: midiToNote(nextRoot),
          duration: '8n',
          velocity: jitterVel(0.75, ctx.rng),
          time: swungTime(bar, 12, ctx.swing),
        })
      } else {
        const steps = [
          { slot: 0,  midi: root },
          { slot: 4,  midi: clampToBassRegister(root + 7) },
          { slot: 8,  midi: clampToBassRegister(root + third) },
          { slot: 12, midi: approachTone(nextRoot, ascending) },
        ]
        for (const { slot, midi } of steps) {
          notes.push({
            pitch: midiToNote(midi),
            duration: '4n',
            velocity: jitterVel(slot === 0 ? 0.9 : 0.7, ctx.rng),
            time: swungTime(bar, slot, ctx.swing),
          })
        }
      }
      continue
    }

    // Harmony holding. On the final bar of a static phrase, drop the last beat
    // so the loop turnaround breathes and the return downbeat lands harder.
    const barSlots = isFinalBar ? hitSlots.filter(s => s < 12) : hitSlots

    barSlots.forEach((slot, i) => {
      const isDownbeat = slot === 0
      const pitchMidi = clampToBassRegister(root + (hitContour[i] ?? 0))

      // Duration: sustain through to the next onset (or the end of the bar).
      const gap = (barSlots[i + 1] ?? 16) - slot
      const dur = sustained
        ? (gap >= 8 ? '2n' : gap >= 4 ? '4n' : '8n')
        : (gap >= 4 ? '4n' : gap >= 2 ? '8n' : '16n')

      // Velocity is DERIVED from the note's job, not rolled. bassVelocityForJob
      // weighs the downbeat anchor, whether it lands with the kick, whether the
      // lead is busy in this slot (so the bass makes room without any live
      // ducking), the section energy, and how far into the phrase we are. Same
      // position always gives the same weight, so a locked section still repeats
      // byte-identically — the variety comes from POSITION, not from dice.
      notes.push({
        pitch: midiToNote(pitchMidi),
        duration: dur,
        velocity: bassVelocityForJob({
          slot, bar, bars: ctx.bars,
          kickSlots: ctx.kickTimes16ths,
          leadBusy: ctx.leadBusy16ths,
          energy: ctx.energy,
          isResolution: isFinalBar && i === barSlots.length - 1,
        }),
        time: swungTime(bar, slot, ctx.swing),
      })
    })

    // ── TURNAROUND PICKUP: make the loop turn OVER instead of restarting ──
    // The filter above already clears slots 12-15 of the final bar so the
    // turnaround breathes. On 808 genres, fill the last 16th of that gap with the
    // fifth BELOW the root. Two things follow from one note:
    //   * portamento is live on these behaviours (Slide808 0.12 / Phonk 0.08), so
    //     the synth GLIDES from it up into the returning downbeat — the "hits and
    //     holds and then something slides" move, now caused by the phrase turning
    //     over rather than only by a chord change.
    //   * with portamento off it is still just a tasteful pickup, so this cannot
    //     sound broken on a voice that does not glide.
    // Deliberately the fifth (root - 5 is the same pitch class as root + 7), NOT a
    // chromatic approach tone: a leading tone resolves into a NEW root, and here we
    // are returning to the SAME one — it would clash, and it would break the
    // chord-tone invariant.
    // Two guards, both learned from tests that caught this addition:
    //   * barSlots.length < 3 — the bass has a hard onset cap so it LEAVES ROOM
    //     (that space is where the vocal sits). A turnaround flourish must never be
    //     the note that crowds the bar.
    //   * not on a drop — there the 808 is meant to SUSTAIN, and a short 16th
    //     pickup is the opposite gesture. A drop lands by holding, not by fidgeting.
    if (isFinalBar && sustained && kind !== 'drop' && barSlots.length < 3) {
      notes.push({
        pitch: midiToNote(clampToBassRegister(root - 5)),
        duration: '16n',
        velocity: jitterVel(0.55, ctx.rng),   // under the downbeat it feeds
        time: swungTime(bar, 15, ctx.swing),
      })
    }
  }

  return notes
}
