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
