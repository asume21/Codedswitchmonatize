/**
 * The mic opened at a rate the device does not run at.
 *
 * audioContext.ts already carries the measured rule, from 2026-07-16:
 *
 *   "NO forced sampleRate: we used to pin 44100, but the user's hardware runs at
 *    48000 — a pinned mismatched rate makes Chrome resample EVERY output quantum
 *    forever, extra work on exactly the audio thread whose missed deadlines ARE
 *    the crackle."
 *
 * That fix was applied to the OUTPUT. The INPUT still asked getUserMedia for
 * 44100 while the shared context ran at 48000. On Windows input and output share
 * one WASAPI device session, so a mismatched input forces the device to
 * renegotiate — which is what OrganismProvider's own comment calls "Windows
 * suspends it due to audio session contention". Symptom: the WHOLE mix distorts
 * the moment the mic is on, not just the vocal.
 *
 * The second half is quieter and worse. createMediaStreamSource resamples the
 * stream INTO the context rate, so the analyser really sees 48000 while every
 * frequency calculation still used 44100 — an 8.8% error, about 1.5 semitones.
 * Every pitch the Organism heard was flat.
 */

import { describe, it, expect } from 'vitest'
import { PitchDetector } from '../algorithms/PitchDetector'
import { AudioAnalysisEngine } from '../AudioAnalysisEngine'

/** One second of a steady sine, at the rate the detector will be told to assume. */
function sine(hz: number, sampleRate: number, frames: number): Float32Array {
  const buf = new Float32Array(frames)
  for (let i = 0; i < frames; i++) buf[i] = Math.sin((2 * Math.PI * hz * i) / sampleRate)
  return buf
}

describe('sample-rate mismatch on the mic path', () => {
  it('misreads pitch by ~8.8% when told 44100 for audio that is really 48000', () => {
    const FRAME = 2048
    const TRUE_HZ = 220        // A3, well inside the 60-1200 detection band
    const DEVICE_RATE = 48000

    // The buffer really is 48 kHz audio — that is what the context produces.
    const buf = sine(TRUE_HZ, DEVICE_RATE, FRAME)

    const correct = new PitchDetector(DEVICE_RATE, FRAME, 60, 1200)
    const wrong   = new PitchDetector(44100, FRAME, 60, 1200)

    const okHz    = correct.process(buf).pitch
    const badHz   = wrong.process(buf).pitch

    expect(okHz).toBeGreaterThan(0)
    expect(badHz).toBeGreaterThan(0)

    // Told the wrong rate, the detector reports the pitch FLAT by the rate ratio.
    expect(okHz).toBeCloseTo(TRUE_HZ, 0)
    expect(badHz / okHz).toBeCloseTo(44100 / 48000, 2)

    // Which is more than a semitone — enough to pick the wrong note.
    const semitones = Math.abs(12 * Math.log2(badHz / okHz))
    expect(semitones).toBeGreaterThan(1)
  })
})

describe('AudioAnalysisEngine.syncSampleRate', () => {
  it('adopts the real device rate instead of the assumed 44100', () => {
    const engine = new AudioAnalysisEngine()
    expect(engine.getSampleRate()).toBe(44100)   // the assumption it ships with

    engine.syncSampleRate(48000)
    expect(engine.getSampleRate()).toBe(48000)
  })

  it('ignores a bogus rate rather than rebuilding the analyzers around NaN', () => {
    const engine = new AudioAnalysisEngine()
    engine.syncSampleRate(48000)
    engine.syncSampleRate(0)
    engine.syncSampleRate(Number.NaN)
    expect(engine.getSampleRate()).toBe(48000)
  })
})
