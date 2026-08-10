import * as Tone from 'tone'
import type { OrganismKitSample } from './OrganismKitCache'
import { detectFundamentalHz, hzToMidi } from './pitchDetect'
import { midiToNote } from '../generators/freeplay/utils'
export { findBass808Sample } from './OrganismKitCache'

export type Real808BassSample = OrganismKitSample
export type Real808BassLoadState = 'idle' | 'loading' | 'loaded' | 'error'

/**
 * Real 808 bass sampler — plays a recorded long 808 sample chromatically.
 *
 * Unlike the synthesised fatsine MonoSynth, this uses a real WAV tail. The
 * sample is pitched across the keyboard like a producer uses a single 808
 * sample: lower notes stretch and rumble, higher notes tighten and knock.
 * A long amplitude envelope lets the sub ring for the whole bar.
 */
export class Real808BassSampler {
  private sampler: Tone.Sampler | null = null
  // Any audio node (Gain or Compressor) — the 808 routes through the bass
  // compressor so its recorded transients are controlled like the synth 808.
  private output: Tone.ToneAudioNode
  private state: Real808BassLoadState = 'idle'
  private loadPromise: Promise<void> | null = null
  private rootNote: string
  private tuneSemitones: number
  private readonly volume: number

  constructor(
    output: Tone.ToneAudioNode,
    options: {
      rootNote?: string
      tuneSemitones?: number
      volume?: number
    } = {}
  ) {
    this.output = output
    this.rootNote = options.rootNote ?? 'C1'
    this.tuneSemitones = options.tuneSemitones ?? 0
    this.volume = options.volume ?? -4
  }

  load(sample: Real808BassSample): Promise<void> {
    if (this.loadPromise) return this.loadPromise
    this.state = 'loading'

    // The metadata rootNote is a guess ('C1' fallback) — and a wrong root makes
    // every melodic 808 line consistently sharp/flat against the chords. Load
    // the buffer first, MEASURE the sample's true fundamental, and key the
    // sampler on the detected root instead. Metadata is kept as the fallback
    // when the detector finds no confident pitch.
    this.loadPromise = new Promise((resolve) => {
      const buffer = new Tone.ToneAudioBuffer(
        sample.url,
        () => {
          let rootNote = sample.rootNote || this.rootNote
          try {
            const audio = buffer.get()
            if (audio) {
              const f0 = detectFundamentalHz(audio.getChannelData(0), audio.sampleRate)
              if (f0) {
                const detected = midiToNote(Math.round(hzToMidi(f0)))
                if (detected !== rootNote) {
                  console.info('[Real808BassSampler] tuned 808 root by ear', {
                    metadataRoot: sample.rootNote ?? null, detectedRoot: detected, f0: Math.round(f0 * 10) / 10,
                  })
                }
                rootNote = detected
              }
            }
          } catch { /* detection is an enhancement — metadata root still works */ }

          this.sampler = new Tone.Sampler({
            urls: { [rootNote]: buffer },
            attack: 0.001,
            release: 2.5,
            volume: this.volume,
          })
          this.sampler.connect(this.output)
          this.state = 'loaded'
          resolve()
        },
        (err) => {
          console.warn('[Real808BassSampler] failed to load 808 sample', { sampleUrl: sample.url, err })
          this.state = 'error'
          resolve()
        },
      )
    })

    return this.loadPromise
  }

  getState(): Real808BassLoadState {
    return this.state
  }

  isLoaded(): boolean {
    return this.state === 'loaded'
  }

  triggerAttackRelease(
    note: string | number,
    duration: Tone.Unit.Time,
    time: number,
    velocity: number,
  ): boolean {
    if (!this.sampler || this.state !== 'loaded') return false
    try {
      const noteStr = typeof note === 'number' ? Tone.Frequency(note, 'midi').toNote() : note
      this.sampler.triggerAttackRelease(noteStr, duration, time, Math.max(0, Math.min(1, velocity)))
      return true
    } catch (err) {
      console.warn('[Real808BassSampler] trigger failed', { note, err })
      return false
    }
  }

  // Tone.Sampler has no portamento; real 808 slides are handled by the pattern
  // spacing and the synth 808 fallback. This method is kept for API parity.
  setPortamento(_portamento: number): void {
    // no-op
  }

  dispose(): void {
    if (this.sampler) {
      this.sampler.dispose()
      this.sampler = null
    }
    this.state = 'idle'
    this.loadPromise = null
  }
}
