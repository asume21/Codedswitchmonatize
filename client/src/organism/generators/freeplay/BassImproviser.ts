// Freeplay bass: improvise a 4-bar line from the LIVE chord's tones, anchored
// to the kick. The conductor informs (root, intervals, swing); this writes notes.

import type { ScheduledNote } from '../types'
import type { FreeplayContext } from './types'
import { midiToNote, swungTime, jitterVel } from './utils'
import { getSongCell } from './songCell'

/** Same register rule as BassGenerator.bassRootFromMidi (33..48, pitch class kept). */
function clampToBassRegister(midi: number): number {
  let m = midi
  while (m > 48) m -= 12
  while (m < 33) m += 12
  return m
}

const SUSTAINED_SUBGENRES = new Set(['trap', 'drill', 'phonk', 'dirty-south'])
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
  const notes: ScheduledNote[] = []

  // Does the harmony actually move at the end of this phrase? Absent lookahead,
  // or a chord that repeats its own root, means there is nothing to walk into.
  const nextRoot = ctx.nextRootMidi === undefined ? root : clampToBassRegister(ctx.nextRootMidi)
  const harmonyMoves = nextRoot !== root
  const ascending = nextRoot > root

  // ── HITS: the chord is holding ────────────────────────────────────
  // 1-3 onsets per bar. Simple, repetitive, and it sings — the Metro/Dilla
  // pocket. Never kick-locked: doubling the kick makes the bass a drum.
  const hitPatterns: Record<SectionKind, number[]> = {
    intro:      [0],
    verse:      [0, 8],           // root on 1, root on 3
    hook:       [0, 6, 12],       // root on 1, fifth on and-of-2, root on 4
    drop:       [0, 8],           // root on 1, octave on 3
    breakdown:  [0],
    bridge:     [0, 8],
  }
  const hitContour: number[] = kind === 'hook'
    ? [0, 7, 0]                    // root, fifth, root
    : kind === 'drop'
      ? [0, 12]                    // root, octave
      : [0, 0]                     // root, root (verse/bridge)

  // COHESION — land on the SONG CELL, not on a pattern of our own invention.
  // The fixed patterns above ignored what every other player was doing, which is
  // a large part of why the band had no cohesion. Keep the downbeat (the bass
  // must anchor), then take the rest of this section's onsets FROM the shared
  // idea, capped at the section's onset budget so the bass still breathes.
  const cell = getSongCell(ctx.sectionName, ctx.subGenre, ctx.rng, ctx.density)
  const budget = hitPatterns[kind].length
  const fromCell = cell.slots.filter(s => s !== 0).slice(0, Math.max(0, budget - 1))
  const hitSlots = [0, ...fromCell].sort((a, b) => a - b)

  // Real chord quality — the setBassChordQuality lesson: never assume minor.
  const third = ctx.chordIntervals.includes(4) && !ctx.chordIntervals.includes(3) ? 4 : 3

  for (let bar = 0; bar < ctx.bars; bar++) {
    const isFinalBar = bar === ctx.bars - 1

    // ── LINE: the chord changes at this bar's end — walk into it ────
    if (isFinalBar && harmonyMoves) {
      if (sustained) {
        // 808 idiom: hold the root, then slide up/down into the next root.
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
      } else {
        // Walking line: root → fifth → third → leading tone → (next downbeat).
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

      notes.push({
        pitch: midiToNote(pitchMidi),
        duration: dur,
        velocity: jitterVel(isDownbeat ? 0.9 : 0.72, ctx.rng),
        time: swungTime(bar, slot, ctx.swing),
      })
    })
  }

  return notes
}
