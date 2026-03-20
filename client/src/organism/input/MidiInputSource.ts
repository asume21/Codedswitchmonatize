import type { AnalysisFrame, AnalysisFrameCallback } from '../analysis/types'
import type { InputSource } from './types'

/**
 * Converts live MIDI controller input into AnalysisFrame objects.
 *
 * Mapping:
 * - velocity      → rms / presence
 * - note number   → pitch / pitchMidi
 * - notes-per-sec → onsetStrength / density
 * - aftertouch    → spectralCentroid / brightness
 *
 * Emits frames at ~43 fps to match AudioAnalysisEngine cadence.
 */
export class MidiInputSource implements InputSource {
  private running = false
  private frameIndex = 0
  private lastFrame: AnalysisFrame | null = null
  private readonly callbacks = new Set<AnalysisFrameCallback>()
  private midiAccess: MIDIAccess | null = null
  private tickInterval: ReturnType<typeof setInterval> | null = null

  // Live state updated by MIDI messages
  private currentVelocity = 0
  private currentNote = 0
  private currentAftertouch = 0
  private noteOnCount = 0
  private noteOnWindow: number[] = []
  private decayRate = 0.92

  // Latch mode — holds last energy level when keys are released
  // so the organism keeps running without continuous input
  private latchEnabled = false
  private latchedVelocity = 0        // energy snapshot taken at latch-on
  private latchedNote = 0
  private latchedAftertouch = 0
  private hasPlayedSinceLatch = false // don't latch at zero if user never played

  setLatch(enabled: boolean): void {
    this.latchEnabled = enabled
    if (!enabled) {
      // Releasing latch — let velocity decay naturally from wherever it is
      this.hasPlayedSinceLatch = false
    }
  }

  isLatched(): boolean { return this.latchEnabled }

  private static readonly FRAME_INTERVAL_MS = 23 // ~43 fps
  private static readonly NOTE_WINDOW_MS = 1000

  async start(): Promise<void> {
    if (this.running) return

    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API not supported in this browser')
    }

    this.midiAccess = await navigator.requestMIDIAccess({ sysex: false })
    this.bindInputs()

    // Re-bind when devices connect/disconnect
    this.midiAccess.onstatechange = () => this.bindInputs()

    this.running = true
    this.frameIndex = 0

    // Emit frames on a fixed interval like AudioAnalysisEngine
    this.tickInterval = setInterval(() => this.emitFrame(), MidiInputSource.FRAME_INTERVAL_MS)
  }

  stop(): void {
    if (!this.running) return

    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }

    if (this.midiAccess) {
      this.midiAccess.inputs.forEach((input) => {
        input.onmidimessage = null
      })
      this.midiAccess.onstatechange = null
      this.midiAccess = null
    }

    this.running = false
    this.frameIndex = 0
    this.currentVelocity = 0
    this.currentNote = 0
    this.currentAftertouch = 0
    this.noteOnCount = 0
    this.noteOnWindow = []
  }

  subscribe(callback: AnalysisFrameCallback): () => void {
    this.callbacks.add(callback)
    return () => { this.callbacks.delete(callback) }
  }

  isRunning(): boolean { return this.running }
  getLastFrame(): AnalysisFrame | null { return this.lastFrame }

  private bindInputs(): void {
    if (!this.midiAccess) return
    this.midiAccess.inputs.forEach((input) => {
      input.onmidimessage = (event) => this.onMidiMessage(event)
    })
  }

  private onMidiMessage(event: MIDIMessageEvent): void {
    const data = event.data
    if (!data || data.length < 2) return

    const status = data[0] & 0xf0
    const value1 = data[1]
    const value2 = data.length > 2 ? data[2] : 0

    switch (status) {
      case 0x90: // Note On
        if (value2 > 0) {
          this.currentNote = value1
          this.currentVelocity = value2 / 127
          this.noteOnWindow.push(performance.now())
          // Snapshot energy for latch every time a note plays
          if (this.latchEnabled) {
            this.latchedVelocity    = this.currentVelocity
            this.latchedNote        = this.currentNote
            this.latchedAftertouch  = this.currentAftertouch
            this.hasPlayedSinceLatch = true
          }
        } else {
          this.currentVelocity = Math.max(0, this.currentVelocity - 0.3)
        }
        break
      case 0x80: // Note Off
        this.currentVelocity = Math.max(0, this.currentVelocity - 0.3)
        break
      case 0xd0: // Channel Aftertouch
        this.currentAftertouch = value1 / 127
        break
      case 0xa0: // Polyphonic Aftertouch
        this.currentAftertouch = value2 / 127
        break
      case 0xb0: // Control Change — CC 1 (mod wheel) maps to brightness
        if (value1 === 1) {
          this.currentAftertouch = value2 / 127
        }
        break
      default:
        break
    }
  }

  private emitFrame(): void {
    const now = performance.now()

    // Decay velocity when no new notes
    this.currentVelocity *= this.decayRate

    // Latch: if enabled and user has played at least once, floor velocity at
    // the latched snapshot so the organism stays alive when keys are released
    if (this.latchEnabled && this.hasPlayedSinceLatch && this.currentVelocity < this.latchedVelocity * 0.5) {
      this.currentVelocity = this.latchedVelocity * 0.5  // hold at half the peak energy
      this.currentNote     = this.latchedNote
      this.currentAftertouch = this.latchedAftertouch
    }

    // Prune note-on window to last 1 second
    this.noteOnWindow = this.noteOnWindow.filter(
      (t) => now - t < MidiInputSource.NOTE_WINDOW_MS,
    )
    const notesPerSec = this.noteOnWindow.length

    // Convert MIDI note to Hz: f = 440 * 2^((n-69)/12)
    const pitchHz = this.currentNote > 0
      ? 440 * Math.pow(2, (this.currentNote - 69) / 12)
      : 0

    const rms = Math.min(1, this.currentVelocity)
    const voiceActive = rms > 0.02

    const frame: AnalysisFrame = {
      timestamp: now,
      frameIndex: this.frameIndex,
      sampleRate: 44100,
      rms,
      rmsRaw: rms,
      pitch: pitchHz,
      pitchConfidence: this.currentNote > 0 ? 0.95 : 0,
      pitchMidi: this.currentNote,
      pitchCents: 0,
      spectralCentroid: 500 + this.currentAftertouch * 4000, // 500–4500 Hz range
      hnr: voiceActive ? 15 : 0,
      spectralFlux: Math.min(1, notesPerSec / 8),
      onsetDetected: this.noteOnWindow.some((t) => now - t < MidiInputSource.FRAME_INTERVAL_MS),
      onsetStrength: Math.min(1, this.currentVelocity * 1.2),
      onsetTimestamp: this.noteOnWindow.length > 0
        ? this.noteOnWindow[this.noteOnWindow.length - 1]
        : 0,
      voiceActive,
      voiceConfidence: rms,
    }

    this.frameIndex += 1
    this.lastFrame = frame
    this.callbacks.forEach((cb) => cb(frame))
  }
}
