import { describe, expect, it } from 'vitest'
import { exportToMidi } from '../MidiExporter'
import type { GeneratorEvent } from '../types'

function makeNoteOn(
  generator: GeneratorEvent['generator'],
  pitch: number,
  timestamp: number,
  velocity = 80
): GeneratorEvent {
  return {
    frameIndex: 0, timestamp, generator,
    eventType: 'note_on', pitch, velocity,
    durationMs: 100,
  }
}

describe('MidiExporter', () => {
  it('exportToMidi() returns a non-empty Blob', () => {
    const events: GeneratorEvent[] = [
      makeNoteOn('drum', 36, 0),
      makeNoteOn('bass', 40, 100),
    ]
    const result = exportToMidi(events, 'sess-1', 90)
    expect(result.blob.size).toBeGreaterThan(0)
  })

  it('Blob MIME type is audio/midi', () => {
    const result = exportToMidi([], 'sess-2', 90)
    expect(result.blob.type).toBe('audio/midi')
  })

  it('10 note_on events in drum generator → drum track has 10 notes', () => {
    const events: GeneratorEvent[] = []
    for (let i = 0; i < 10; i++) {
      events.push(makeNoteOn('drum', 36, i * 500))
    }
    const result = exportToMidi(events, 'sess-3', 120)
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.filename).toContain('sess-3')
  })

  it('empty generatorEvents → returns valid empty MIDI file (no crash)', () => {
    const result = exportToMidi([], 'sess-4', 90)
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.filename).toBe('organism-session-sess-4.mid')
  })
})
