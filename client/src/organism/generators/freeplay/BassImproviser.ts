// Freeplay bass: improvise a 4-bar line from the LIVE chord's tones, anchored
// to the kick. The conductor informs (root, intervals, swing); this writes notes.

import type { ScheduledNote } from '../types'
import type { FreeplayContext } from './types'
import { getSectionMotif, varyMotif } from './motif'
import { midiToNote, swungTime, jitterVel } from './utils'

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

export function buildFreeplayBassNotes(ctx: FreeplayContext): ScheduledNote[] {
  const root = clampToBassRegister(ctx.rootMidi)
  const kind = sectionKind(ctx.sectionName)
  // Real chord quality — the setBassChordQuality lesson: never assume minor.
  const third = ctx.chordIntervals.includes(4) && !ctx.chordIntervals.includes(3) ? 4 : 3
  const seventh = ctx.chordIntervals.includes(11) && !ctx.chordIntervals.includes(10) ? 11 : 10

  // Motif anchored to bar-1 kicks — this is the kick-glue: the motif's slots
  // ARE (mostly) kick slots, so ≥60% of onsets land with the kick by design.
  const kickSlotsBar = [...new Set(ctx.kickTimes16ths.map(s => s % 16))].sort((a, b) => a - b)
  const motif = getSectionMotif(
    `bass:${ctx.sectionName}:${ctx.subGenre}`,
    ctx.rng,
    Math.min(ctx.density, 0.5),          // bass stays sparser than drums
    kickSlotsBar.slice(0, 4),
  )

  // Kick-glue guarantee: keep kick-slots first and at most kickCount/2 free
  // slots, so ≥60% of onsets land with the kick even for busy motifs.
  // HARD CAP 4 onsets/bar: 5+ short notes per bar reads as a bubbly tech-house
  // bassline, not a hip-hop pocket (WebEar describe heard "very active plucky
  // bass … Tech House", 2026-07-02). Fewer onsets also lengthens durations.
  const kickish = motif.slots.filter(s => kickSlotsBar.includes(s)).slice(0, 4)
  const freeCap = Math.max(4 - kickish.length, 0) > 0
    ? Math.min(Math.max(1, Math.floor(kickish.length / 2)), 4 - kickish.length)
    : 0
  const free = motif.slots.filter(s => !kickSlotsBar.includes(s)).slice(0, freeCap)
  const sectionMaxOnsets: Record<SectionKind, number> = {
    intro: 2,
    verse: 3,
    hook: 4,
    drop: 4,
    breakdown: 2,
    bridge: 3,
  }
  const maxOnsets = sectionMaxOnsets[kind] ?? 4
  const baseMask = { slots: [...new Set([...kickish, ...free])].sort((a, b) => a - b).slice(0, maxOnsets) }

  const sustained = SUSTAINED_SUBGENRES.has(ctx.subGenre)
  const kickSet = new Set(ctx.kickTimes16ths)
  const notes: ScheduledNote[] = []
  const sustainedContours: Record<SectionKind, number[]> = {
    intro: [0, 0, 7, 0],
    verse: [0, 7, third, 0, seventh, 0],
    hook: [0, 12, 7, 12, third, 0],
    drop: [0, 12, 7, 12, seventh, 0],
    breakdown: [0, 0, third, 0],
    bridge: [0, third, 7, seventh],
  }
  const sustainedContour = sustainedContours[kind]

  for (let bar = 0; bar < ctx.bars; bar++) {
    // A-A-A'-A: bar 3 (index 2) is the single bounded variation.
    // Re-cap after varying — the 'add' op must not break the 4-onset pocket cap.
    const varied = bar === 2 ? varyMotif(baseMask, ctx.rng) : baseMask
    const mask = varied.slots.length > maxOnsets ? { slots: varied.slots.slice(0, maxOnsets) } : varied
    const slots = mask.slots

    slots.forEach((slot, i) => {
      const isDownbeat = slot === 0
      const onKick = kickSet.has(bar * 16 + slot) || kickSlotsBar.includes(slot)

      // Pitch: trap/drill/phonk want a real 808 line, not a pile of isolated
      // hits. Downbeats stay rooted; the rest of the phrase walks a short,
      // chord-tone contour so the low end reads as a line with motion.
      let interval = 0
      if (!isDownbeat && sustained) {
        const contourStep = (bar * 4 + i) % sustainedContour.length
        const contour = sustainedContour[contourStep]
        interval = contour
      } else if (!isDownbeat) {
        const roll = ctx.rng()
        if (kind === 'intro' || kind === 'breakdown') {
          interval = roll < 0.8 ? 0 : 7
        } else if (kind === 'hook' || kind === 'drop') {
          if (onKick) interval = roll < 0.8 ? 0 : 12
          else interval = roll < 0.55 ? 7 : roll < 0.8 ? third : seventh
        } else {
          if (onKick) interval = roll < 0.7 ? 0 : 12
          else interval = roll < 0.4 ? 7 : roll < 0.7 ? third : seventh
        }
      }
      const pitchMidi = clampToBassRegister(root + interval)

      // Duration from the gap to the next onset; 808 genres sustain the downbeat.
      const nextSlot = slots[i + 1] ?? 16
      const gap = nextSlot - slot
      const dur = sustained && isDownbeat
        ? (kind === 'intro' || kind === 'breakdown' ? '2n.' : '2n')
        : gap >= 4 ? '4n' : gap >= 2 ? '8n' : '16n'

      notes.push({
        pitch: midiToNote(pitchMidi),
        duration: dur,
        velocity: jitterVel(
          isDownbeat ? 0.9
            : (kind === 'intro' || kind === 'breakdown') ? 0.5
            : onKick ? 0.68
            : 0.55,
          ctx.rng,
        ),
        time: swungTime(bar, slot, ctx.swing),
      })
    })

    // Turnaround: approach the next downbeat from the chord third on the
    // final swung 16th of the phrase.
    if (bar === ctx.bars - 1 && !baseMask.slots.includes(15)) {
      notes.push({
        pitch: midiToNote(clampToBassRegister(root + 7)),
        duration: '16n',
        velocity: jitterVel(0.5, ctx.rng),
        time: swungTime(bar, 15, ctx.swing),
      })
    }
  }

  return notes
}
