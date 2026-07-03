import { describe, expect, it } from 'vitest'
import { planAnswer } from '../duet'
import type { PerformerState } from '../../audio/types'

// Minimal PerformerState with sensible defaults; override per case.
const perf = (over: Partial<PerformerState> = {}): PerformerState => ({
  bpm: 90, bpmConfidence: 0.8, rhythmTightness: 0.8,
  phraseBar: 0, phrasePosition: 0, isInPhrase: false, breathingNow: false,
  energy: 0.5, energyPeak: 0.6, dynamicRange: 0.5,
  syllabicRate: 4, spectralBrightness: 0.5,
  lastOnsetMs: 0, timestamp: 0,
  ...over,
})

// A wide-open gap: not throttled.
const openCtx = { wasBreathing: false, msSinceLastAnswer: 5000 }

describe('planAnswer', () => {
  it('answers on the rising edge of a gap (the moment the MC stops)', () => {
    const cue = planAnswer(perf({ isInPhrase: false, breathingNow: true }), openCtx)
    expect(cue).not.toBeNull()
  })

  it('never answers OVER an active phrase (the flow keeps the floor)', () => {
    const cue = planAnswer(perf({ isInPhrase: true, breathingNow: true }), openCtx)
    expect(cue).toBeNull()
  })

  it('answers once per gap, not every frame of the same silence', () => {
    // Sustained breath: breathingNow true AND was already breathing last frame.
    const cue = planAnswer(perf({ breathingNow: true }), { ...openCtx, wasBreathing: true })
    expect(cue).toBeNull()
  })

  it('throttles back-to-back answers (one answer per gap window)', () => {
    const cue = planAnswer(perf({ breathingNow: true }), { wasBreathing: false, msSinceLastAnswer: 200 })
    expect(cue).toBeNull()
  })

  it('answers a lively bar with a melodic phrase, a calm gap with a stab', () => {
    const hot = planAnswer(perf({ breathingNow: true, energy: 0.8 }), openCtx)
    const calm = planAnswer(perf({ breathingNow: true, energy: 0.1 }), openCtx)
    expect(hot?.answer).toBe('phrase')
    expect(calm?.answer).toBe('stab')
  })

  it('scales the answer velocity with the performer energy, clamped musical', () => {
    const hot = planAnswer(perf({ breathingNow: true, energy: 1 }), openCtx)
    const calm = planAnswer(perf({ breathingNow: true, energy: 0 }), openCtx)
    expect(hot!.velocity).toBeGreaterThan(calm!.velocity)
    expect(calm!.velocity).toBeGreaterThanOrEqual(0.3)
    expect(hot!.velocity).toBeLessThanOrEqual(0.95)
  })
})

// ── Instrumental Duet — the band answers itself in listening mode ───────────
import { planInstrumentalAnswer, melodyIsQuiet } from '../duet'

const instCtx = (over: Partial<import('../duet').InstrumentalDuetContext> = {}) => ({
  melodyRestSec: 1.2,        // well past a beat at 90bpm (0.667s/beat)
  beatSec: 60 / 90,
  wasQuiet: false,           // rising edge
  msSinceLastAnswer: 5000,   // not throttled
  voiceActive: false,        // pure listening mode
  ...over,
})

describe('planInstrumentalAnswer', () => {
  it('answers a melody rest with a chord stab in listening mode', () => {
    const cue = planInstrumentalAnswer(instCtx())
    expect(cue).not.toBeNull()
    expect(cue!.answer).toBe('stab')
  })

  it('fires on the rising edge of the rest only — not every silent frame', () => {
    expect(planInstrumentalAnswer(instCtx({ wasQuiet: true }))).toBeNull()
  })

  it('does not treat the space between two 8th notes as a rest', () => {
    // 0.3s gap at 90bpm is under the beat-and-a-quarter threshold
    expect(planInstrumentalAnswer(instCtx({ melodyRestSec: 0.3 }))).toBeNull()
  })

  it('throttles back-to-back answers', () => {
    expect(planInstrumentalAnswer(instCtx({ msSinceLastAnswer: 800 }))).toBeNull()
  })

  it('yields the floor to the vocal Duet while an MC is active', () => {
    expect(planInstrumentalAnswer(instCtx({ voiceActive: true }))).toBeNull()
  })

  it('melodyIsQuiet threshold scales with tempo', () => {
    // 1.0s rest: quiet at 140bpm (beat 0.43s), NOT quiet at 60bpm (beat 1.0s)
    expect(melodyIsQuiet(1.0, 60 / 140)).toBe(true)
    expect(melodyIsQuiet(1.0, 60 / 60)).toBe(false)
  })
})
