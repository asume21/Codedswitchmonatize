// Freeplay melody: a chord-aware lead line built from the shared section rhythm
// motif, not the small authored melody-bank vocabulary.

import type { ScheduledNote } from '../types'
import type { FreeplayContext } from './types'
import { getSectionMotif, varyMotif, SLOT_PRIORITY } from './motif'
import { getSongCell } from './songCell'
import { jitterVel, midiToNote, swungTime, sectionKind, SectionKind } from './utils'
import {
  contourOffset,
  isStrongBeat,
  phraseNeedsContourFallback,
  resolveDegreeComplementing,
} from '../melody/melodyPhrase'

export type MelodyFreeplayBehavior = 'hint' | 'respond' | 'lead'

export interface MelodyFreeplayContext extends FreeplayContext {
  /** Active scale intervals from the Conductor, semitones from the song key. */
  scaleIntervals: number[]
  /** Song key pitch class, 0 = C. */
  keyPitchClass: number
  /** Active chord tones expressed as scale degrees in the current key. */
  chordDegrees: number[]
  /** Chord degrees the melody should prefer on strong beats to complement comping. */
  preferredDegrees: number[]
  /** Base octave for the lead register. */
  octave: number
  /** Optional live pitch offset from ScaleSnap / user controls. */
  pitchOffsetSemitones?: number
  /** Phrase length in 16th slots. Defaults to bars * 16. */
  length16ths?: number
  /** Current density role from MelodyGenerator. */
  behavior?: MelodyFreeplayBehavior
  /** Performer family, used for duration feel only. */
  performerFamily?: string
  /** User-facing emotional intent. */
  emotionalIntent?: 'sad' | 'beautiful' | null
}

interface PitchIdea {
  anchorDegree: number
  moves: number[]
  answerShift: number
  peakLift: number
}

interface RawMelodyEvent {
  absSlot: number
  degree: number
  velocity: number
}

const pitchIdeaStore = new Map<string, PitchIdea>()

export function clearMelodyMotifs(): void {
  pitchIdeaStore.clear()
}

const DEFAULT_MINOR = [0, 2, 3, 5, 7, 8, 10]
const DEFAULT_MAJOR = [0, 2, 4, 5, 7, 9, 11]

// ── Genre-specific scales — melody picks based on subGenre ───────────
const GENRE_SCALES: Record<string, number[]> = {
  classical:    [0, 2, 4, 5, 7, 9, 11],  // major (Ionian) — Bach, Mozart
  jazz:         [0, 2, 3, 5, 7, 9, 10],  // dorian — jazzy minor
  gospel:       [0, 2, 4, 5, 7, 9, 11],  // major — uplifting
  funk:         [0, 3, 5, 7, 10],         // minor pentatonic — groove
  house:        [0, 2, 3, 5, 7, 8, 10],  // natural minor — dark house
  dnb:          [0, 2, 3, 5, 7, 8, 10],  // natural minor — rolling
  pop:          [0, 2, 4, 5, 7, 9, 11],  // major — catchy
  'k-pop':      [0, 2, 4, 5, 7, 9, 11],  // major — bright
  'j-pop':      [0, 2, 4, 5, 7, 9, 11],  // major — anime bright
  electronic:   [0, 2, 4, 5, 7, 9, 10],  // mixolydian — electronic edge
}

function scaleForGenre(subGenre: string): number[] {
  return GENRE_SCALES[subGenre] ?? DEFAULT_MINOR
}

const PITCH_CONTOURS = [
  [0, 1, 2, 1, 3, 2, 1, 0],
  [0, 2, 1, 0, -1, 0, 1, 0],
  [0, 1, 0, 2, 3, 2, 0, -1],
  [0, -1, 0, 1, 2, 1, 0, 1],
]

// ── Classical contours — wider range, arpeggiated, baroque sequences ─
const CLASSICAL_CONTOURS = [
  [0, 2, 4, 2, 5, 4, 2, 0],     // arpeggiated rise and fall
  [0, 1, 2, 3, 4, 3, 2, 1],     // scalar ascent/descent
  [0, 4, 2, 5, 3, 6, 4, 2],     // wide interval leaps (Bach-style)
  [0, -1, 1, 0, 2, 1, 3, 0],    // baroque ornament pattern
]

// ── Pop/electronic contours — catchy, hook-driven ────────────────────
const POP_CONTOURS = [
  [0, 0, 1, 0, 2, 1, 0, -1],    // repetitive hook
  [0, 1, 2, 1, 0, -1, 0, 0],    // rise and settle
  [0, 2, 0, 3, 0, 2, 0, 1],     // octave-jump hook
  [0, 1, 0, -1, 0, 1, 2, 0],    // undulating pop line
]

// ── Electronic/violin contours — Lindsey Stirling style, fast arps ───
const ELECTRONIC_CONTOURS = [
  [0, 2, 4, 5, 7, 5, 4, 2],     // fast ascending arp
  [0, 3, 7, 3, 0, 3, 7, 10],    // wide dramatic leaps
  [0, 1, 3, 1, 4, 3, 1, 0],     // quick ornamented line
  [0, 4, 2, 5, 4, 7, 5, 4],     // virtuosic run pattern
]


const SECTION_CONTOURS: Record<SectionKind, number[][]> = {
  intro: [
    [0, 1, 0, -1, 0, 1, 0, 0],
    [0, 0, 1, 0, -1, 0, 0, 0],
  ],
  verse: PITCH_CONTOURS,
  // A build's whole job is to climb and NOT resolve. Both shapes end on their
  // highest degree instead of returning to the root, so the phrase arrives at the
  // drop still leaning forward. Every other section's contours come home; these
  // deliberately do not.
  build: [
    [0, 1, 2, 3, 4, 5, 6, 7],
    [0, 2, 1, 3, 2, 4, 5, 7],
  ],
  hook: [
    [0, 1, 2, 3, 2, 1, 0, -1],
    [0, 1, 0, 2, 3, 4, 2, 0],
  ],
  drop: [
    [0, 2, 3, 2, 4, 3, 2, 0],
    [0, 1, 2, 3, 4, 3, 1, 0],
  ],
  breakdown: [
    [0, 0, 1, 0, -1, 0, 0, 0],
    [0, 1, 0, 1, 0, -1, 0, 0],
  ],
  bridge: [
    [0, -1, 0, 1, 2, 1, 0, -1],
    [0, 1, 0, 2, 1, 0, -1, 0],
  ],
}

// SectionKind + sectionKind now live in ./utils (shared with the other improvisers).

function mod(n: number, d: number): number {
  return ((Math.floor(n) % d) + d) % d
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function chordDegreesFromIntervals(ctx: MelodyFreeplayContext): number[] {
  const scale = ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : scaleForGenre(ctx.subGenre)
  const chordRootPc = mod(ctx.rootMidi, 12)
  const chordPcs = new Set(ctx.chordIntervals.map(interval => mod(chordRootPc + interval, 12)))
  const degrees: number[] = []
  for (let d = 0; d < scale.length; d++) {
    const pc = mod(ctx.keyPitchClass + scale[d], 12)
    if (chordPcs.has(pc)) degrees.push(d)
  }
  return degrees.length > 0 ? degrees : [0, 2, 4]
}

function chordDegreesFor(ctx: MelodyFreeplayContext): number[] {
  return ctx.chordDegrees.length > 0 ? [...ctx.chordDegrees] : chordDegreesFromIntervals(ctx)
}

function preferredDegreesFor(ctx: MelodyFreeplayContext, chordDegrees: number[]): number[] {
  return ctx.preferredDegrees.length > 0 ? [...ctx.preferredDegrees] : [...chordDegrees]
}

function isClassical(subGenre: string): boolean {
  return subGenre === 'classical' || subGenre === 'jazz' || subGenre === 'gospel'
}
function isElectronic(subGenre: string): boolean {
  return subGenre === 'electronic' || subGenre === 'house' || subGenre === 'dnb' || subGenre === 'edm' || subGenre === 'techno'
}
function isPop(subGenre: string): boolean {
  return subGenre === 'pop' || subGenre === 'k-pop' || subGenre === 'j-pop' || subGenre === 'r&b-soul' || subGenre === 'soul'
}

function pitchIdeaFor(ctx: MelodyFreeplayContext, chordDegrees: number[], preferredDegrees: number[]): PitchIdea {
  const kind = sectionKind(ctx.sectionName)
  const key = `melody-pitch:${kind}:${ctx.subGenre}:${ctx.motifSeed}`
  const existing = pitchIdeaStore.get(key)
  if (existing) return existing

  const anchors = preferredDegrees.length > 0 ? preferredDegrees : chordDegrees
  const anchorDegree = anchors[Math.floor(ctx.rng() * anchors.length)] ?? chordDegrees[0] ?? 0

  // Genre-specific contour selection
  const contourBank = isClassical(ctx.subGenre) ? CLASSICAL_CONTOURS
    : isElectronic(ctx.subGenre) ? ELECTRONIC_CONTOURS
    : isPop(ctx.subGenre) ? POP_CONTOURS
    : (SECTION_CONTOURS[kind] ?? PITCH_CONTOURS)
  const moves = contourBank[Math.floor(ctx.rng() * contourBank.length)] ?? contourBank[0]
  const idea: PitchIdea = {
    anchorDegree: kind === 'intro' || kind === 'breakdown'
      ? chordDegrees[0] ?? anchorDegree
      : kind === 'hook' || kind === 'drop'
        ? anchors[Math.min(anchors.length - 1, 1)] ?? anchorDegree
        : anchorDegree,
    moves,
    answerShift: ctx.rng() < 0.5 ? -1 : 1,
    peakLift: kind === 'drop' || kind === 'hook'
      ? (ctx.rng() < 0.5 ? 2 : 3)
      : ctx.rng() < 0.55 ? 1 : 2,
  }
  pitchIdeaStore.set(key, idea)
  return idea
}

/**
 * Thin a motif down to the section's density budget.
 *
 * This used to be `filtered.slice(0, max)`, and that one call was why the lead
 * never phrased across the bar. `getSectionMotif` returns its slots SORTED, and
 * `songCell` deliberately picks its accents as the downbeat plus the two LATEST
 * slots — "the idea's shape is carried by where it leaves the grid". So slicing
 * the head of a sorted array deleted the band's late landing points on EVERY
 * phrase, deterministically, and left the lead bunched at the top of the bar
 * (measured: bar 0 playing [0,2,6,7] while the cell's accents were [0,8,14] —
 * skipping the beat-3 landing to play two ornamental 16ths).
 *
 * Density has to come out of the FILLER, never out of the idea. So: keep the
 * anchors first, then let the motif's own remaining slots have the rest of the
 * budget. When the budget is tighter than the anchor count (an intro, a
 * breakdown), even the anchors are chosen by strength rather than by position.
 */
function capSlots(
  slots: number[],
  behavior: MelodyFreeplayBehavior,
  kind: SectionKind,
  subGenre?: string,
  anchors: number[] = [],
): number[] {
  const classicalMult = isClassical(subGenre ?? '') ? 1.25 : 1.0
  const electronicMult = isElectronic(subGenre ?? '') ? 1.15 : 1.0
  const mult = Math.max(classicalMult, electronicMult)
  const sectionMax: Record<SectionKind, number> = {
    intro: Math.round(2 * mult),
    verse: Math.round((behavior === 'lead' ? 5 : 4) * mult),
    // Between verse and hook on purpose. A build that peaks at the hook's density
    // has nowhere left to go; one stuck at the verse's never lifts at all.
    build: Math.round((behavior === 'lead' ? 6 : 5) * mult),
    hook: Math.round((behavior === 'lead' ? 6 : 4) * mult),
    drop: Math.round((behavior === 'lead' ? 6 : 4) * mult),
    breakdown: Math.round(2 * mult),
    bridge: Math.round(3 * mult),
  }
  const max = sectionMax[kind] ?? Math.round((behavior === 'lead' ? 5 : behavior === 'respond' ? 4 : 2) * mult)
  const filtered = behavior === 'hint'
    ? slots.filter(slot => slot === 0 || slot === 8 || slot === 12)
    : slots
  if (filtered.length <= max) return filtered.length > 0 ? [...filtered] : [0]

  const present = new Set(filtered.map(slot => mod(slot, 16)))
  const anchorSet = new Set(
    anchors.map(slot => mod(slot, 16)).filter(slot => present.has(slot)),
  )
  // Anchors in strength order, so a tight budget keeps the downbeat and the
  // beat-3 landing rather than whichever two happen to sort first.
  const kept = SLOT_PRIORITY.filter(slot => anchorSet.has(slot)).slice(0, max)
  // The leftover budget goes to the motif's OWN filler, in its own order. Do not
  // spend it by SLOT_PRIORITY too: that pushes every remaining note onto a strong
  // beat, and resolveDegreeComplementing snaps strong beats to chord tones — so a
  // dense line collapses onto the four chord pitches and the lead gets a stuck
  // note. The ornamental 16ths are the notes that are FREE to be non-chord tones;
  // they are where the melody's colour comes from.
  for (const slot of [...present].sort((a, b) => a - b)) {
    if (kept.length >= max) break
    if (anchorSet.has(slot)) continue
    kept.push(slot)
  }

  const out = kept.sort((a, b) => a - b)
  return out.length > 0 ? out : [0]
}

function slotsForBar(
  bar: number,
  bars: number,
  baseSlots: number[],
  behavior: MelodyFreeplayBehavior,
  kind: SectionKind,
  rng: () => number,
  subGenre?: string,
  anchors: number[] = [],
): number[] {
  if (kind === 'intro' || kind === 'breakdown') {
    return capSlots(baseSlots, behavior, kind, subGenre, anchors)
  }
  if (behavior === 'hint') return capSlots(baseSlots, behavior, kind, subGenre, anchors)
  if (bars > 2 && bar === 2) return capSlots(varyMotif({ slots: baseSlots }, rng).slots, behavior, kind, subGenre, anchors)
  if (bars > 1 && bar === bars - 1) {
    const cadenceSlot = 12
    const setup = baseSlots.filter(slot => slot < cadenceSlot).slice(0, Math.max(1, baseSlots.length - 1))
    return [...new Set([...setup, cadenceSlot])].sort((a, b) => a - b)
  }
  return capSlots(baseSlots, behavior, kind, subGenre, anchors)
}

function durationFromGap(slots: number, family: string | undefined, articulation: 'normal' | 'staccato' | 'legato' = 'normal'): string {
  const sustained = family === 'bowed' || family === 'wind' || family === 'brass'
  // Base duration from gap, then articulation shapes it.
  let base: string
  if (slots >= 8) base = sustained ? '4n' : '2n'
  else if (slots >= 6) base = '4n.'
  else if (slots >= 4) base = '4n'
  else if (slots >= 3) base = '8n.'
  else if (slots >= 2) base = '8n'
  else base = '16n'

  // Articulation: staccato shortens, legato holds through.
  if (articulation === 'staccato') {
    if (base === '2n') return '4n'
    if (base === '4n.') return '4n'
    if (base === '4n') return '8n'
    if (base === '8n.') return '8n'
    if (base === '8n') return '16n'
    return '32n'
  }
  if (articulation === 'legato') {
    if (base === '4n') return '2n'
    if (base === '8n') return '4n'
    if (base === '16n') return '8n'
    return base
  }
  return base
}

function pickArticulation(rng: () => number, subGenre?: string): 'normal' | 'staccato' | 'legato' {
  const roll = rng()
  if (isClassical(subGenre ?? '')) {
    if (roll < 0.10) return 'staccato'
    if (roll < 0.55) return 'legato'
    return 'normal'
  }
  if (isElectronic(subGenre ?? '')) {
    if (roll < 0.45) return 'staccato'
    if (roll < 0.55) return 'legato'
    return 'normal'
  }
  if (roll < 0.25) return 'staccato'
  if (roll < 0.40) return 'legato'
  return 'normal'
}

function degreeToMidi(ctx: MelodyFreeplayContext, degree: number): number {
  const scale = ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : scaleForGenre(ctx.subGenre)
  const scaleLen = scale.length
  const octaveOffset = Math.floor(degree / scaleLen)
  const interval = scale[mod(degree, scaleLen)]
  return ((ctx.octave + octaveOffset + 1) * 12)
    + mod(ctx.keyPitchClass, 12)
    + interval
    + Math.round(ctx.pitchOffsetSemitones ?? 0)
}

function smoothLeap(degree: number, previous: number | null, scaleLen: number): number {
  if (previous === null) return degree
  let out = degree
  while (out - previous > 4) out -= scaleLen
  while (previous - out > 4) out += scaleLen
  return out
}

function velocityFor(ctx: MelodyFreeplayContext, absSlot: number): number {
  const behavior = ctx.behavior ?? 'lead'
  const sub = absSlot % 4
  const strong = isStrongBeat(absSlot)
  const behaviorGain = behavior === 'lead' ? 1.05 : behavior === 'respond' ? 0.92 : 0.78
  const energyGain = 0.85 + clamp01(ctx.energy) * 0.22
  let base = (strong ? 0.72 : sub === 0 ? 0.62 : 0.48) * behaviorGain * energyGain

  // Classical: wider dynamic range (pp → ff), more expressive
  if (isClassical(ctx.subGenre)) {
    base = strong ? 0.55 + ctx.energy * 0.35 : 0.35 + ctx.energy * 0.25
  }
  // Electronic: punchier, more consistent
  if (isElectronic(ctx.subGenre)) {
    base = strong ? 0.78 : 0.62
  }

  if (ctx.emotionalIntent === 'sad') return 0.4 + ctx.rng() * 0.2
  if (ctx.emotionalIntent === 'beautiful') return 0.45 + ctx.rng() * 0.25
  return jitterVel(Math.min(0.82, base), ctx.rng, 0.06)
}

function rawDegreeFor(
  ctx: MelodyFreeplayContext,
  idea: PitchIdea,
  chordDegrees: number[],
  preferredDegrees: number[],
  kind: SectionKind,
  bar: number,
  slot: number,
  absSlot: number,
  melodicIndex: number,
): number {
  const behavior = ctx.behavior ?? 'lead'
  const scaleLen = (ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : scaleForGenre(ctx.subGenre)).length
  const phraseSlots = Math.max(1, ctx.length16ths ?? ctx.bars * 16)
  const pos = absSlot / phraseSlots
  const move = idea.moves[melodicIndex % idea.moves.length] ?? 0
  let degree = idea.anchorDegree + move

  if (absSlot === 0) {
    return chordDegrees[0] ?? 0
  }
  if (bar % 4 === 1) degree += idea.answerShift
  if (bar % 4 === 2) degree += idea.peakLift
  if (kind === 'intro' || kind === 'breakdown') degree += contourOffset(pos, 0)
  else if (kind === 'hook' || kind === 'drop') degree += contourOffset(pos, 3)
  else if (behavior === 'lead') degree += contourOffset(pos, 2)
  else if (behavior === 'respond') degree += contourOffset(pos, 1)

  if (kind === 'hook' || kind === 'drop') {
    if (slot === 4 || slot === 10) degree += 1
    if (slot === 8) degree += 2
  } else if (kind === 'intro' || kind === 'breakdown') {
    if (slot === 4 || slot === 10) degree -= 1
  }

  // Come home at the end of the PHRASE, not at the end of every bar. This used
  // to be `slot >= 12 || …`, which forced the root on slots 12-15 of all four
  // bars — the whole back half of every bar collapsed onto one pitch. It went
  // unnoticed because capSlots was deleting those slots before they could sound;
  // once the lead actually phrased across the bar, the rule turned the back half
  // into a stuck note. Slot 12 is still guaranteed a CHORD TONE below (it is
  // passed as a strong beat to resolveDegreeComplementing) — it just no longer
  // has to be the root every bar, which is where approach notes live.
  if (absSlot >= phraseSlots - 4) {
    degree = chordDegrees[0] ?? 0
  }

  return resolveDegreeComplementing(
    degree,
    chordDegrees,
    preferredDegrees,
    scaleLen,
    isStrongBeat(absSlot) || slot === 12,
  )
}

/**
 * Rescue line for a phrase whose PITCHES came out degenerate (see
 * `phraseNeedsContourFallback`) — it re-states a guaranteed contour.
 *
 * It fixes the pitches; it must not throw away the rhythm to do it. The original
 * placed its contour on an even `i * step` grid, which at a 4-bar phrase is slots
 * 0, 8, 16, 24… — a metronome. Any phrase unlucky enough to trip the fallback
 * therefore stopped playing the section's idea altogether and went stiff, which
 * is a worse fault than the repeated pitch it was rescuing. It now walks the same
 * cell slots the main path uses, so only the PITCHES are replaced.
 */
function buildContourFallback(
  ctx: MelodyFreeplayContext,
  chordDegrees: number[],
  preferredDegrees: number[],
  rhythmSlots: number[],
): ScheduledNote[] {
  const scaleLen = (ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : scaleForGenre(ctx.subGenre)).length
  const totalSlots = Math.max(1, ctx.length16ths ?? ctx.bars * 16)
  const pattern = [0, 1, 2, 4, 3, 2, 1, 0]
  const bars = Math.max(1, Math.ceil(totalSlots / 16))
  const grid = rhythmSlots.length > 0 ? [...rhythmSlots].sort((a, b) => a - b) : [0, 8]
  const absSlots: number[] = []
  for (let bar = 0; bar < bars; bar++) {
    for (const slot of grid) {
      const abs = bar * 16 + slot
      if (abs < totalSlots) absSlots.push(abs)
    }
  }
  const events: RawMelodyEvent[] = []

  for (let i = 0; i < absSlots.length; i++) {
    const absSlot = absSlots[i]
    const pos = absSlot / totalSlots
    // The contour cycles: the grid is now the cell's rhythm, which is rarely
    // exactly `pattern.length` long.
    let degree = (chordDegrees[0] ?? 0) + pattern[i % pattern.length] + contourOffset(pos, 1)
    degree = resolveDegreeComplementing(
      degree,
      chordDegrees,
      preferredDegrees,
      scaleLen,
      isStrongBeat(absSlot) || i === absSlots.length - 1,
    )
    events.push({ absSlot, degree, velocity: velocityFor(ctx, absSlot) })
  }

  return renderEvents(ctx, events, totalSlots)
}

function renderEvents(
  ctx: MelodyFreeplayContext,
  events: RawMelodyEvent[],
  totalSlots: number,
): ScheduledNote[] {
  const bySlot = new Map<number, RawMelodyEvent>()
  for (const event of events) {
    if (event.absSlot < 0 || event.absSlot >= totalSlots) continue
    bySlot.set(event.absSlot, event)
  }
  const ordered = [...bySlot.values()].sort((a, b) => a.absSlot - b.absSlot)
  const notes: ScheduledNote[] = []

  // Phrase breathing: a real melody has space between statements — silence is a
  // note too. But the rest has to be part of the IDEA, not a per-note coin flip:
  // rolling each note independently silenced different notes in bar 0 and bar 1,
  // which destroyed the call-and-response repeat the phrase is built on (bar 1
  // must answer bar 0). So the rests are drawn ONCE as a slot mask and applied
  // to every bar — the same holes land in the same places, and the space becomes
  // rhythm. Quarter-note slots are never rested; the skeleton has to survive.
  const restChance = ctx.behavior === 'hint' ? 0.35 : ctx.behavior === 'respond' ? 0.22 : 0.18
  const restedSlots = new Set<number>()
  for (let slot = 0; slot < 16; slot++) {
    if (slot % 4 === 0) continue
    if (ctx.rng() < restChance) restedSlots.add(slot)
  }
  const filtered = ordered.filter(event => !restedSlots.has(mod(event.absSlot, 16)))

  for (let i = 0; i < filtered.length; i++) {
    const event = filtered[i]
    const next = filtered[i + 1]
    const gap = Math.max(1, (next?.absSlot ?? totalSlots) - event.absSlot)
    const bar = Math.floor(event.absSlot / 16)
    const slot = mod(event.absSlot, 16)
    const articulation = pickArticulation(ctx.rng, ctx.subGenre)
    notes.push({
      pitch: midiToNote(degreeToMidi(ctx, event.degree)),
      duration: durationFromGap(gap, ctx.performerFamily, articulation),
      velocity: event.velocity,
      time: swungTime(bar, slot, ctx.swing),
    })
  }

  return notes
}

export function buildFreeplayMelodyNotes(ctx: MelodyFreeplayContext): ScheduledNote[] {
  const behavior = ctx.behavior ?? 'lead'
  const kind = sectionKind(ctx.sectionName)
  const bars = Math.max(1, Math.floor(ctx.bars) || 1)
  const totalSlots = Math.max(1, ctx.length16ths ?? bars * 16)
  const chordDegrees = chordDegreesFor(ctx)
  const preferredDegrees = preferredDegreesFor(ctx, chordDegrees)
  const idea = pitchIdeaFor(ctx, chordDegrees, preferredDegrees)
  // COHESION — the lead phrases FROM the song cell rather than from a private
  // `melody:<section>` motif that no other player could hear. The cell's slots
  // are the idea's landing points, so the melody's own motif is seeded with them
  // as anchors: it is free to embellish around them (that is what a soloist
  // does), but it starts where the band is.
  const cell = getSongCell(ctx.sectionName, ctx.subGenre, ctx.rng, ctx.density)
  const motif = getSectionMotif(
    `melody:${ctx.sectionName}:${ctx.subGenre}`,
    ctx.rng,
    behavior === 'lead' ? Math.min(0.9, Math.max(0.55, ctx.density))
      : behavior === 'respond' ? Math.min(0.65, Math.max(0.35, ctx.density))
      : Math.min(0.25, ctx.density),
    cell.accents,
  )
  const baseSlots = capSlots(motif.slots, behavior, kind, ctx.subGenre, cell.accents)
  const events: RawMelodyEvent[] = []
  let melodicIndex = 0
  let previousDegree: number | null = null
  const scaleLen = (ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : scaleForGenre(ctx.subGenre)).length

  for (let bar = 0; bar < bars; bar++) {
    const slots = slotsForBar(bar, bars, baseSlots, behavior, kind, ctx.rng, ctx.subGenre, cell.accents)
    for (const slot of slots) {
      const absSlot = bar * 16 + slot
      if (absSlot >= totalSlots) continue
      let degree = rawDegreeFor(ctx, idea, chordDegrees, preferredDegrees, kind, bar, slot, absSlot, melodicIndex)
      degree = smoothLeap(degree, previousDegree, scaleLen)
      previousDegree = degree
      events.push({ absSlot, degree, velocity: velocityFor(ctx, absSlot) })
      melodicIndex++
    }
  }

  // CADENCE — the phrase lands on the FIFTH (see the "starts on the root and
  // cadences on the fifth" test; that is deliberate, not incidental).
  //
  // This was a hardcoded `degree: 4`, which is the fifth ONLY in a 7-note scale.
  // On the pentatonic modes it is not: minor pentatonic is [0,3,5,7,10], so index
  // 4 is the b7 (10) and heat/gravel phrases ended on an unresolved tension
  // instead of landing. Ask the active scale which degree actually IS the fifth
  // rather than assuming its position.
  const cadenceScale = ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : scaleForGenre(ctx.subGenre)
  const fifthDegree = cadenceScale.indexOf(7)
  const cadenceDur = behavior === 'hint' ? 2 : 4
  const cadenceSlot = Math.max(0, totalSlots - cadenceDur)
  events.push({
    absSlot: cadenceSlot,
    // No 7 in the scale at all (an exotic mode) — fall back to the chord root,
    // which always resolves, rather than to a blind index.
    degree: fifthDegree >= 0 ? fifthDegree : (chordDegrees[0] ?? 0),
    velocity: velocityFor(ctx, cadenceSlot),
  })

  const notes = renderEvents(ctx, events, totalSlots)
  if (phraseNeedsContourFallback(notes.map(note => note.pitch))) {
    return buildContourFallback(ctx, chordDegrees, preferredDegrees, baseSlots)
  }
  return notes
}
