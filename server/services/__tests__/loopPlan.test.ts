import { describe, it, expect } from 'vitest'
import { barsToSeconds, planLoopGeneration, MIN_SAFE_SECONDS } from '../loopPlan'

/**
 * Two production findings drive this, both confirmed by ear (2026-08-20):
 *
 * 1. We asked ACE-Step for a flat 8 seconds regardless of tempo. At 90 BPM
 *    that is 12 beats — THREE bars. A clip that is not a whole number of bars
 *    cannot loop, so every "loop" was cut off mid-phrase.
 *
 * 2. Asked for a 4-bar clip directly (10.67s at 90 BPM) ACE-Step produced
 *    artifacting the user described as "an annoying high pitch dolphin". The
 *    same prompt at 21.33s sounded fine. Below roughly 20s the diffusion does
 *    not resolve, so we generate long and slice the loop out.
 */
describe('barsToSeconds', () => {
  it('converts 4/4 bars at a tempo', () => {
    expect(barsToSeconds(4, 90)).toBeCloseTo(10.667, 2)
    expect(barsToSeconds(8, 90)).toBeCloseTo(21.333, 2)
    expect(barsToSeconds(4, 120)).toBe(8)
  })
})

describe('planLoopGeneration', () => {
  it('generates well above the artifacting floor even for a short loop', () => {
    const plan = planLoopGeneration({ bpm: 90, loopBars: 4 })
    expect(plan.generateSeconds).toBeGreaterThanOrEqual(MIN_SAFE_SECONDS)
    expect(plan.generateBars).toBe(8)
  })

  it('doubles again at fast tempos, where 8 bars is still too short', () => {
    // 8 bars at 140 BPM is only 13.7s — still in dolphin territory.
    const plan = planLoopGeneration({ bpm: 140, loopBars: 4 })
    expect(plan.generateSeconds).toBeGreaterThanOrEqual(MIN_SAFE_SECONDS)
    expect(plan.generateBars).toBe(16)
  })

  it('keeps the generated length a whole multiple of the loop length', () => {
    for (const bpm of [60, 75, 90, 110, 128, 140, 174]) {
      const plan = planLoopGeneration({ bpm, loopBars: 4 })
      expect(plan.generateBars % 4).toBe(0)
    }
  })

  it('slices from the middle, skipping the intro that fades in', () => {
    const plan = planLoopGeneration({ bpm: 90, loopBars: 4 })
    expect(plan.startBar).toBe(4)
    expect(plan.startSeconds).toBeCloseTo(10.667, 2)
  })

  it('never slices past the end of what was generated', () => {
    for (const bpm of [60, 90, 128, 174]) {
      const plan = planLoopGeneration({ bpm, loopBars: 4 })
      expect(plan.startSeconds + plan.loopSeconds).toBeLessThanOrEqual(plan.generateSeconds + 1e-6)
    }
  })

  it('reports the loop length the user actually asked for', () => {
    expect(planLoopGeneration({ bpm: 90, loopBars: 4 }).loopSeconds).toBeCloseTo(10.667, 2)
    expect(planLoopGeneration({ bpm: 90, loopBars: 8 }).loopSeconds).toBeCloseTo(21.333, 2)
  })

  it('does not generate absurd lengths for very slow tempos', () => {
    const plan = planLoopGeneration({ bpm: 60, loopBars: 4 })
    expect(plan.generateSeconds).toBeLessThanOrEqual(240)
  })
})

describe('generation padding', () => {
  it('asks for more than the musical target, because ACE lands short', () => {
    // Asked for 21.333s it returned 21.269s. Without slack the midpoint cut ran
    // 63.8ms short and the loop drifted; with slack it is sample-exact.
    const plan = planLoopGeneration({ bpm: 90, loopBars: 4 })
    expect(plan.requestSeconds).toBeGreaterThan(plan.generateSeconds)
    expect(plan.requestSeconds).toBeCloseTo(plan.generateSeconds + 2, 5)
  })

  it('leaves enough audio for the full loop even if the model lands short', () => {
    const plan = planLoopGeneration({ bpm: 90, loopBars: 4 })
    const worstCase = plan.requestSeconds - 0.5 // pessimistic shortfall
    expect(plan.startSeconds + plan.loopSeconds).toBeLessThanOrEqual(worstCase)
  })

  it('never asks beyond the model ceiling', () => {
    expect(planLoopGeneration({ bpm: 20, loopBars: 8 }).requestSeconds).toBeLessThanOrEqual(240)
  })
})
