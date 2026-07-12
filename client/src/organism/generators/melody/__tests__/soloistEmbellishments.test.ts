import { describe, it, expect } from 'vitest'
import { applySoloistEmbellishments, type SoloistContext } from '../soloistEmbellishments'
import type { ScheduledNote } from '../../types'

// Chromatic helpers for a C-major-ish test context: step up/down by 2 semitones.
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const midiToNote = (m: number) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`
const noteToMidi = (n: string): number => {
  const m = /^([A-G]#?)(-?\d+)$/.exec(n)!
  return (parseInt(m[2], 10) + 1) * 12 + NOTE_NAMES.indexOf(m[1])
}

const ctx: SoloistContext = {
  stepAbove: (midi) => midiToNote(midi + 2),
  stepBelow: (midi) => midiToNote(midi - 2),
  legatoFamily: false,
}

const note = (time: string, pitch: string, duration: string, velocity = 0.8): ScheduledNote =>
  ({ time, pitch, duration, velocity })

/** Absolute position in 16ths from a "bar:beat:sub" time string. */
const abs16 = (t: string) => {
  const [bar, beat, sub] = t.split(':').map(Number)
  return bar * 16 + beat * 4 + sub
}

describe('applySoloistEmbellishments — a riff you can rap over', () => {
  // A busy riff: 8 eighth notes in one bar. Nothing here is long enough to
  // trill; grace budget is 1/bar — so at least 7 of 8 notes must be untouched.
  const busyRiff: ScheduledNote[] = Array.from({ length: 8 }, (_, i) =>
    note(`0:${Math.floor(i / 2)}:${(i % 2) * 2}`, i % 2 ? 'E4' : 'G4', '8n'))

  it('leaves the vast majority of a busy riff untouched', () => {
    const out = applySoloistEmbellishments(busyRiff, ctx)
    const untouched = busyRiff.filter(orig =>
      out.some(o => o.time === orig.time && o.pitch === orig.pitch && o.duration === orig.duration))
    expect(untouched.length).toBeGreaterThanOrEqual(7)
  })

  it('is deterministic — the riff ornaments identically every loop cycle', () => {
    const a = applySoloistEmbellishments(busyRiff, ctx)
    const b = applySoloistEmbellishments(busyRiff, ctx)
    expect(a).toEqual(b)
  })

  it('never turns a long note into wall-to-wall 16ths — the note HOLDS first', () => {
    // Two bars, each with one whole-bar note: at least one will be trilled
    // (deterministic hash), and when it is, the head must keep the original
    // pitch at the original onset and last at least half the note.
    const longNotes = [note('0:0:0', 'A4', '1m'), note('1:0:0', 'C5', '1m')]
    const out = applySoloistEmbellishments(longNotes, ctx)

    for (const orig of longNotes) {
      const group = out.filter(o => abs16(o.time) >= abs16(orig.time) && abs16(o.time) < abs16(orig.time) + 16)
      // Head note: original pitch at original onset.
      const head = group.find(o => o.time === orig.time)
      expect(head).toBeDefined()
      expect(head!.pitch).toBe(orig.pitch)
      if (group.length > 1) {
        // Ornamented: the tail turn is SHORT (max 4 steps) and the head holds
        // at least half the note before any turn begins.
        expect(group.length).toBeLessThanOrEqual(5)
        const firstTail = group.filter(o => o !== head).map(o => abs16(o.time)).sort((x, y) => x - y)[0]
        expect(firstTail - abs16(orig.time)).toBeGreaterThanOrEqual(8)
        // The turn resolves back HOME: last event is the main pitch.
        const last = group.reduce((p, c) => (abs16(c.time) > abs16(p.time) ? c : p))
        expect(last.pitch).toBe(orig.pitch)
      }
    }
  })

  it('budgets ornaments per bar — at most one trill and one grace', () => {
    // A 2-bar riff with two long notes and two medium notes per bar.
    const riff = [
      note('0:0:0', 'A4', '2n'), note('0:2:0', 'E4', '4n'), note('0:3:0', 'G4', '4n'),
      note('1:0:0', 'C5', '2n'), note('1:2:0', 'G4', '4n'), note('1:3:0', 'E4', '4n'),
    ]
    const out = applySoloistEmbellishments(riff, ctx)
    for (const bar of [0, 1]) {
      const barEvents = out.filter(o => abs16(o.time) >= bar * 16 && abs16(o.time) < (bar + 1) * 16)
      const added = barEvents.length - riff.filter(n2 => abs16(n2.time) >= bar * 16 && abs16(n2.time) < (bar + 1) * 16).length
      // one trill adds ≤4 events, one grace adds 1 → never more than 5 extra
      expect(added).toBeLessThanOrEqual(5)
      // grace notes (32n) — at most one per bar
      expect(barEvents.filter(o => o.duration === '32n').length).toBeLessThanOrEqual(1)
    }
  })

  it('grace note sits just below the main note and the main note survives', () => {
    // Medium notes only (no trill candidates ≥ a half note) so any ornament is a grace.
    const riff = Array.from({ length: 8 }, (_, i) =>
      note(`${Math.floor(i / 4)}:${i % 4}:0`, 'D4', '4n'))
    const out = applySoloistEmbellishments(riff, ctx)
    const graces = out.filter(o => o.duration === '32n')
    for (const g of graces) {
      expect(noteToMidi(g.pitch)).toBeLessThan(noteToMidi('D4'))
      expect(g.velocity).toBeLessThan(0.8)
      // The displaced main note still exists within half a 16th of the grace.
      const main = out.find(o => o.pitch === 'D4' && Math.abs(abs16(o.time) - abs16(g.time)) <= 0.5 && o !== g)
      expect(main).toBeDefined()
    }
  })

  it('legato families get stepwise notes slurred (dotted), others do not', () => {
    const stepwise = [note('0:0:0', 'C4', '8n'), note('0:0:2', 'D4', '8n')]
    const plain = applySoloistEmbellishments(stepwise, ctx)
    expect(plain[0].duration).toBe('8n')
    const bowed = applySoloistEmbellishments(stepwise, { ...ctx, legatoFamily: true })
    expect(bowed[0].duration).toBe('8n.')
  })
})
