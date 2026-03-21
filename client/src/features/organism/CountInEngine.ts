/**
 * COUNT-IN ENGINE
 *
 * Plays a "1, 2, 3, 4" metronome click at the specified BPM,
 * then fires a callback when the count-in is complete so the
 * Organism can drop the beat on the downbeat of bar 2.
 *
 * Uses Tone.js for precise scheduling — clicks are scheduled
 * into the audio graph, not via setTimeout, so they're sample-accurate.
 */

import * as Tone from 'tone'

export interface CountInOptions {
  bpm:       number
  beats?:    number   // default 4
  onBeat?:   (beat: number, total: number) => void
  onComplete: () => void
}

export class CountInEngine {
  private synth:     Tone.MembraneSynth | null = null
  private transport: typeof Tone.Transport | null = null
  private eventIds:  number[] = []
  private disposed:  boolean = false

  /**
   * Start the count-in. Returns immediately — beats are scheduled
   * into the Tone.js Transport timeline.
   */
  async start(options: CountInOptions): Promise<void> {
    const { bpm, beats = 4, onBeat, onComplete } = options

    await Tone.start()

    this.transport = Tone.getTransport()

    // Create a short, clicky synth for the metronome
    this.synth = new Tone.MembraneSynth({
      pitchDecay:  0.008,
      octaves:     2,
      oscillator:  { type: 'sine' },
      envelope:    { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
      volume:      -12,
    }).toDestination()

    // Set BPM
    this.transport.bpm.value = bpm

    // Schedule each beat
    const beatDuration = 60 / bpm  // seconds per beat

    for (let i = 0; i < beats; i++) {
      const time = i * beatDuration
      const beatNum = i + 1
      const isDownbeat = i === 0

      const eventId = this.transport.schedule((scheduledTime) => {
        if (this.disposed || !this.synth) return

        // Downbeat (beat 1) is higher pitched
        const note = isDownbeat ? 'C4' : 'C3'
        const velocity = isDownbeat ? 0.9 : 0.6
        this.synth.triggerAttackRelease(note, '32n', scheduledTime, velocity)

        // Notify UI of current beat
        if (onBeat) {
          Tone.getDraw().schedule(() => {
            onBeat(beatNum, beats)
          }, scheduledTime)
        }
      }, `+${time}`)

      this.eventIds.push(eventId)
    }

    // Schedule the completion callback after all beats
    const totalDuration = beats * beatDuration
    const completeId = this.transport.schedule((scheduledTime) => {
      if (this.disposed) return

      Tone.getDraw().schedule(() => {
        this.dispose()
        onComplete()
      }, scheduledTime)
    }, `+${totalDuration}`)

    this.eventIds.push(completeId)

    // Start transport if not already running
    if (this.transport.state !== 'started') {
      this.transport.start()
    }
  }

  /** Cancel the count-in and clean up. */
  dispose(): void {
    this.disposed = true

    if (this.transport) {
      for (const id of this.eventIds) {
        this.transport.clear(id)
      }
    }
    this.eventIds = []

    if (this.synth) {
      this.synth.dispose()
      this.synth = null
    }
  }
}
