// Freeplay melody: a chord-aware lead line built from the shared section rhythm
// motif, not the small authored melody-bank vocabulary.

import type { ScheduledNote } from '../types'
import type { FreeplayContext } from './types'
import { getSectionMotif, varyMotif } from './motif'
import { jitterVel, midiToNote, swungTime } from './utils'
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

const PITCH_CONTOURS = [
  [0, 1, 2, 1, 3, 2, 1, 0],
  [0, 2, 1, 0, -1, 0, 1, 0],
  [0, 1, 0, 2, 3, 2, 0, -1],
  [0, -1, 0, 1, 2, 1, 0, 1],
]

type SectionKind = 'intro' | 'verse' | 'hook' | 'drop' | 'breakdown' | 'bridge'

const SECTION_CONTOURS: Record<SectionKind, number[][]> = {
  intro: [
    [0, 1, 0, -1, 0, 1, 0, 0],
    [0, 0, 1, 0, -1, 0, 0, 0],
  ],
  verse: PITCH_CONTOURS,
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

function sectionKind(sectionName: string): SectionKind {
  const n = sectionName.toLowerCase()
  if (n.includes('intro')) return 'intro'
  if (n.includes('drop')) return 'drop'
  if (n.includes('hook') || n.includes('chorus')) return 'hook'
  if (n.includes('break')) return 'breakdown'
  if (n.includes('bridge')) return 'bridge'
  return 'verse'
}

function mod(n: number, d: number): number {
  return ((Math.floor(n) % d) + d) % d
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function chordDegreesFromIntervals(ctx: MelodyFreeplayContext): number[] {
  const scale = ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : DEFAULT_MINOR
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

function pitchIdeaFor(ctx: MelodyFreeplayContext, chordDegrees: number[], preferredDegrees: number[]): PitchIdea {
  const kind = sectionKind(ctx.sectionName)
  const key = `melody-pitch:${kind}:${ctx.subGenre}:${ctx.motifSeed}`
  const existing = pitchIdeaStore.get(key)
  if (existing) return existing

  const anchors = preferredDegrees.length > 0 ? preferredDegrees : chordDegrees
  const anchorDegree = anchors[Math.floor(ctx.rng() * anchors.length)] ?? chordDegrees[0] ?? 0
  const contourBank = SECTION_CONTOURS[kind]
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

function capSlots(slots: number[], behavior: MelodyFreeplayBehavior, kind: SectionKind): number[] {
  const sectionMax: Record<SectionKind, number> = {
    intro: 2,
    verse: behavior === 'lead' ? 5 : 4,
    hook: behavior === 'lead' ? 6 : 4,
    drop: behavior === 'lead' ? 6 : 4,
    breakdown: 2,
    bridge: 3,
  }
  const max = sectionMax[kind] ?? (behavior === 'lead' ? 5 : behavior === 'respond' ? 4 : 2)
  const filtered = behavior === 'hint'
    ? slots.filter(slot => slot === 0 || slot === 8 || slot === 12)
    : slots
  const out = filtered.slice(0, max)
  return out.length > 0 ? out : [0]
}

function slotsForBar(
  bar: number,
  bars: number,
  baseSlots: number[],
  behavior: MelodyFreeplayBehavior,
  kind: SectionKind,
  rng: () => number,
): number[] {
  if (kind === 'intro' || kind === 'breakdown') {
    return capSlots(baseSlots, behavior, kind)
  }
  if (behavior === 'hint') return capSlots(baseSlots, behavior, kind)
  if (bars > 2 && bar === 2) return capSlots(varyMotif({ slots: baseSlots }, rng).slots, behavior, kind)
  if (bars > 1 && bar === bars - 1) {
    const cadenceSlot = 12
    const setup = baseSlots.filter(slot => slot < cadenceSlot).slice(0, Math.max(1, baseSlots.length - 1))
    return [...new Set([...setup, cadenceSlot])].sort((a, b) => a - b)
  }
  return capSlots(baseSlots, behavior, kind)
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

function pickArticulation(rng: () => number): 'normal' | 'staccato' | 'legato' {
  const roll = rng()
  if (roll < 0.25) return 'staccato'
  if (roll < 0.40) return 'legato'
  return 'normal'
}

function degreeToMidi(ctx: MelodyFreeplayContext, degree: number): number {
  const scale = ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : DEFAULT_MINOR
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
  const base = (strong ? 0.72 : sub === 0 ? 0.62 : 0.48) * behaviorGain * energyGain

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
  const scaleLen = (ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : DEFAULT_MINOR).length
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

  if (slot >= 12 || absSlot >= phraseSlots - 4) {
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

function buildContourFallback(
  ctx: MelodyFreeplayContext,
  chordDegrees: number[],
  preferredDegrees: number[],
): ScheduledNote[] {
  const scaleLen = (ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : DEFAULT_MINOR).length
  const totalSlots = Math.max(1, ctx.length16ths ?? ctx.bars * 16)
  const pattern = [0, 1, 2, 4, 3, 2, 1, 0]
  const step = Math.max(2, Math.floor(totalSlots / pattern.length))
  const events: RawMelodyEvent[] = []

  for (let i = 0; i < pattern.length; i++) {
    const absSlot = i * step
    if (absSlot >= totalSlots) break
    const pos = absSlot / totalSlots
    let degree = (chordDegrees[0] ?? 0) + pattern[i] + contourOffset(pos, 1)
    degree = resolveDegreeComplementing(
      degree,
      chordDegrees,
      preferredDegrees,
      scaleLen,
      isStrongBeat(absSlot) || i === pattern.length - 1,
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
    const articulation = pickArticulation(ctx.rng)
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
  const motif = getSectionMotif(
    `melody:${ctx.sectionName}:${ctx.subGenre}`,
    ctx.rng,
    behavior === 'lead' ? Math.min(0.9, Math.max(0.55, ctx.density))
      : behavior === 'respond' ? Math.min(0.65, Math.max(0.35, ctx.density))
      : Math.min(0.25, ctx.density),
    [0],
  )
  const baseSlots = capSlots(motif.slots, behavior, kind)
  const events: RawMelodyEvent[] = []
  let melodicIndex = 0
  let previousDegree: number | null = null
  const scaleLen = (ctx.scaleIntervals.length > 0 ? ctx.scaleIntervals : DEFAULT_MINOR).length

  for (let bar = 0; bar < bars; bar++) {
    const slots = slotsForBar(bar, bars, baseSlots, behavior, kind, ctx.rng)
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

  const cadenceDur = behavior === 'hint' ? 2 : 4
  const cadenceSlot = Math.max(0, totalSlots - cadenceDur)
  events.push({
    absSlot: cadenceSlot,
    degree: 4,
    velocity: velocityFor(ctx, cadenceSlot),
  })

  const notes = renderEvents(ctx, events, totalSlots)
  if (phraseNeedsContourFallback(notes.map(note => note.pitch))) {
    return buildContourFallback(ctx, chordDegrees, preferredDegrees)
  }
  return notes
}
