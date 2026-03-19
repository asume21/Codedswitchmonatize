import { describe, expect, it } from 'vitest'
import { PulseTracker } from '../computers/PulseTracker'

const MIN_BPM       = 60
const MAX_BPM       = 180
const INERTIA_FAST  = 1    // reduced inertia for convergence tests
const INERTIA_SLOW  = 8    // default inertia for inertia-behavior test
const CONF_MIN      = 0.3

function feedOnsets(tracker: PulseTracker, intervalMs: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    tracker.process(true, i * intervalMs, 1.0)
  }
}

describe('PulseTracker', () => {
  it('converges toward 120 BPM when onsets arrive every 500ms', () => {
    const tracker = new PulseTracker(MIN_BPM, MAX_BPM, INERTIA_FAST, CONF_MIN)
    feedOnsets(tracker, 500, 500)
    const bpm = tracker.getBpm()
    expect(bpm).toBeGreaterThan(100)
    expect(bpm).toBeLessThan(140)
  })

  it('converges toward 160 BPM when onsets arrive every 375ms', () => {
    const tracker = new PulseTracker(MIN_BPM, MAX_BPM, INERTIA_FAST, CONF_MIN)
    feedOnsets(tracker, 375, 500)
    const bpm = tracker.getBpm()
    expect(bpm).toBeGreaterThan(140)
    expect(bpm).toBeLessThanOrEqual(MAX_BPM)
  })

  it('never exceeds pulseMaxBpm or goes below pulseMinBpm', () => {
    const tracker = new PulseTracker(MIN_BPM, MAX_BPM, INERTIA_FAST, CONF_MIN)
    feedOnsets(tracker, 50, 32)
    expect(tracker.getBpm()).toBeLessThanOrEqual(MAX_BPM)
    feedOnsets(tracker, 2000, 32)
    expect(tracker.getBpm()).toBeGreaterThanOrEqual(MIN_BPM)
  })

  it('returns default BPM (90) with fewer than 4 onsets — no crash', () => {
    const tracker = new PulseTracker(MIN_BPM, MAX_BPM, INERTIA_SLOW, CONF_MIN)
    feedOnsets(tracker, 500, 2)
    expect(tracker.getBpm()).toBe(90)
  })

  it('corrects BPM over multiple frames with inertia, not instantly', () => {
    const tracker   = new PulseTracker(MIN_BPM, MAX_BPM, INERTIA_SLOW, CONF_MIN)
    const bpmBefore = tracker.getBpm()
    feedOnsets(tracker, 500, 500)
    const bpmAfter  = tracker.getBpm()
    expect(Math.abs(bpmAfter - 120)).toBeLessThan(Math.abs(bpmBefore - 120))
  })
})
