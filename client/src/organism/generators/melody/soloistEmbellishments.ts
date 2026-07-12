import type { ScheduledNote } from '../types'

/**
 * Soloist embellishments — how the lead "shows off" when it has the floor
 * (solo mode / melody-only freestyle backing).
 *
 * The design brief, straight from the user: a solo instrument is a RIFF you
 * can rap over — a nice guitar line looping clean — not a conservatory
 * audition. The previous version turned 50% of held notes into wall-to-wall
 * 16th trills and grace-noted 70% of the rest, which machine-gunned every
 * sustained instrument into millisecond blips (a bowed violin never got past
 * its attack). The riff must survive its own decoration:
 *
 *   1. THE LINE IS THE STAR — every original note keeps its onset and pitch;
 *      the large majority pass through completely untouched.
 *   2. BUDGET — at most one trill and one grace per bar, never on the same
 *      note. A player decorates the money note, not everything.
 *   3. HOLD FIRST — a trilled note sustains for at least half its length
 *      before a short measured turn (≤4 steps) that resolves back home.
 *   4. DETERMINISTIC — hash-seeded from note position, so the riff ornaments
 *      identically on every loop cycle (the locked-loop rule: repetition IS
 *      the point).
 */

export interface SoloistContext {
  /** Scale-snapped pitch a step above the given midi (ornament upper neighbour). */
  stepAbove(midi: number): string
  /** Scale-snapped pitch a step below the given midi (grace-note approach). */
  stepBelow(midi: number): string
  /** Bowed strings / guitar: slur stepwise motion by dotting the first note. */
  legatoFamily: boolean
}

const NOTE_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}

function noteToMidi(note: string): number | null {
  const m = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note)
  if (!m) return null
  const pc = NOTE_TO_PC[m[1]]
  if (pc == null) return null
  return (parseInt(m[2], 10) + 1) * 12 + pc
}

/** Notation duration → length in 16ths (supports 'Xn', 'Xn.', 'Xm'). */
function durTo16ths(duration: string): number {
  if (duration.endsWith('m')) return (parseFloat(duration) || 1) * 16
  const denom = parseFloat(duration.replace('n', '').replace('.', '')) || 4
  const dotted = duration.endsWith('.') ? 1.5 : 1.0
  return (16 / denom) * dotted
}

/** Length in 16ths → nearest not-longer notation duration. */
function sixteenthsToDur(len: number): string {
  if (len >= 16) return '1m'
  if (len >= 12) return '2n.'
  if (len >= 8) return '2n'
  if (len >= 6) return '4n.'
  if (len >= 4) return '4n'
  if (len >= 3) return '8n.'
  if (len >= 2) return '8n'
  if (len >= 1) return '16n'
  return '32n'
}

function timeToAbs16(time: string): number {
  const parts = time.split(':')
  const bar = parseInt(parts[0] ?? '0', 10) || 0
  const beat = parseInt(parts[1] ?? '0', 10) || 0
  const sub = parseFloat(parts[2] ?? '0') || 0
  return bar * 16 + beat * 4 + sub
}

function abs16ToTime(abs: number): string {
  const bar = Math.floor(abs / 16)
  const beat = Math.floor((abs % 16) / 4)
  const sub = abs % 4
  return `${bar}:${beat}:${Number.isInteger(sub) ? sub : sub.toFixed(2)}`
}

/** Deterministic 0..1 hash from a note's position — stable across loop cycles. */
function positionHash(abs: number, salt: number): number {
  const h = Math.sin(abs * 7.13 + salt * 3.7) * 1000
  return h - Math.floor(h)
}

const TRILL_CHANCE = 0.45
const GRACE_CHANCE = 0.35
/** A note must be at least a half note to earn a trill — the ones that sing. */
const TRILL_MIN_16THS = 8
const GRACE_MIN_16THS = 3

export function applySoloistEmbellishments(
  notes: ScheduledNote[],
  ctx: SoloistContext,
): ScheduledNote[] {
  if (notes.length === 0) return []

  // Group note indices by bar so ornament budgets are per-bar decisions.
  const byBar = new Map<number, number[]>()
  for (let i = 0; i < notes.length; i++) {
    const bar = Math.floor(timeToAbs16(notes[i].time) / 16)
    const list = byBar.get(bar) ?? []
    list.push(i)
    byBar.set(bar, list)
  }

  const trillAt = new Set<number>()
  const graceAt = new Set<number>()

  for (const [bar, idxs] of byBar) {
    // Trill candidate: the LONGEST note in the bar (the money note), if it
    // truly sustains. Ties go to the earlier note.
    let money = -1
    for (const i of idxs) {
      const len = durTo16ths(notes[i].duration)
      if (len < TRILL_MIN_16THS) continue
      if (money === -1 || len > durTo16ths(notes[money].duration)) money = i
    }
    if (money >= 0 && positionHash(timeToAbs16(notes[money].time), bar + 1) < TRILL_CHANCE) {
      trillAt.add(money)
    }

    // Grace candidate: one medium-or-longer note that is NOT the trilled one.
    for (const i of idxs) {
      if (i === money) continue
      if (durTo16ths(notes[i].duration) < GRACE_MIN_16THS) continue
      if (positionHash(timeToAbs16(notes[i].time), bar + 17) < GRACE_CHANCE) {
        graceAt.add(i)
        break // budget: one grace per bar
      }
    }
  }

  const out: ScheduledNote[] = []
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]
    const midi = noteToMidi(n.pitch)
    if (midi === null) { out.push(n); continue }

    if (trillAt.has(i)) {
      // HOLD FIRST: the head keeps the original onset/pitch and sustains at
      // least half the note; then a measured turn at 16th rate — upper/main
      // alternation, at most 4 steps, resolving home on the main pitch.
      const len = durTo16ths(n.duration)
      const turnSteps = Math.min(4, Math.floor(len / 2)) & ~1 || 2 // even, 2..4
      const headLen = len - turnSteps
      const start = timeToAbs16(n.time)
      const upper = ctx.stepAbove(midi)
      out.push({ ...n, duration: sixteenthsToDur(headLen) })
      for (let s = 0; s < turnSteps; s++) {
        const isUpper = s % 2 === 0 // start on the upper neighbour…
        const isLast = s === turnSteps - 1 // …and land back home
        out.push({
          pitch: isLast ? n.pitch : (isUpper ? upper : n.pitch),
          duration: '16n',
          velocity: n.velocity * (isLast ? 1.0 : isUpper ? 0.78 : 0.85),
          time: abs16ToTime(start + headLen + s),
        })
      }
      continue
    }

    if (graceAt.has(i)) {
      // A single soft scale-step approach from below; the main note slides
      // half a 16th late — the classic "lean" into the note.
      const start = timeToAbs16(n.time)
      out.push({ pitch: ctx.stepBelow(midi), duration: '32n', velocity: n.velocity * 0.6, time: n.time })
      out.push({ ...n, time: abs16ToTime(start + 0.5) })
      continue
    }

    out.push(n)
  }

  // Legato slur for bowed/guitar: stepwise adjacent notes overlap slightly
  // (dot the first) so the line connects instead of gapping.
  if (ctx.legatoFamily) {
    for (let i = 0; i < out.length - 1; i++) {
      const a = noteToMidi(out[i].pitch)
      const b = noteToMidi(out[i + 1].pitch)
      if (a !== null && b !== null && Math.abs(a - b) <= 2 && out[i].duration.endsWith('n')) {
        out[i] = { ...out[i], duration: out[i].duration + '.' }
      }
    }
  }

  return out
}
