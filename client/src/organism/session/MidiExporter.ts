// @ts-ignore — midi-writer-js types exist but package.json "exports" prevents resolution
import MidiWriter from 'midi-writer-js'
import type { GeneratorEvent } from './types'

export interface MidiExportResult {
  blob:     Blob
  filename: string
}

export function exportToMidi(
  generatorEvents: GeneratorEvent[],
  sessionId:       string,
  bpm:             number
): MidiExportResult {
  const tracks = {
    drum:    new MidiWriter.Track(),
    bass:    new MidiWriter.Track(),
    melody:  new MidiWriter.Track(),
    texture: new MidiWriter.Track(),
  }

  tracks.drum.addTrackName('Drum')
  tracks.bass.addTrackName('Bass')
  tracks.melody.addTrackName('Melody')
  tracks.texture.addTrackName('Texture')

  const tempoEvent = new MidiWriter.TempoEvent({ bpm })
  Object.values(tracks).forEach(t => t.addEvent(tempoEvent))

  const byGenerator = {
    drum:    generatorEvents.filter(e => e.generator === 'drum'),
    bass:    generatorEvents.filter(e => e.generator === 'bass'),
    melody:  generatorEvents.filter(e => e.generator === 'melody'),
    texture: generatorEvents.filter(e => e.generator === 'texture'),
  }

  for (const [gen, events] of Object.entries(byGenerator)) {
    const track = tracks[gen as keyof typeof tracks]
    const noteOns = events.filter(e => e.eventType === 'note_on' && e.pitch !== undefined)

    for (const event of noteOns) {
      const noteOff = events.find(e =>
        e.eventType === 'note_off' &&
        e.pitch === event.pitch &&
        e.timestamp > event.timestamp
      )

      const durationMs = noteOff
        ? noteOff.timestamp - event.timestamp
        : (event.durationMs ?? 100)

      const msPerBeat = 60000 / bpm
      const ticks     = Math.round((durationMs / msPerBeat) * 128)

      const note = new MidiWriter.NoteEvent({
        pitch:    [event.pitch!],
        velocity: event.velocity ?? 80,
        duration: `T${ticks}`,
      })

      track.addEvent(note)
    }
  }

  const writer = new MidiWriter.Writer([
    tracks.drum,
    tracks.bass,
    tracks.melody,
    tracks.texture,
  ])

  const base64 = writer.base64()
  const binary  = atob(base64)
  const bytes   = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return {
    blob:     new Blob([bytes], { type: 'audio/midi' }),
    filename: `organism-session-${sessionId}.mid`,
  }
}
