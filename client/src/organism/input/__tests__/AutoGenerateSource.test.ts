import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { AutoGenerateSource } from '../AutoGenerateSource'
import type { AnalysisFrame } from '../../analysis/types'

describe('AutoGenerateSource', () => {
  let source: AutoGenerateSource

  beforeEach(() => {
    vi.useFakeTimers()
    source = new AutoGenerateSource({ energy: 'medium' })
  })

  afterEach(() => {
    source.stop()
    vi.useRealTimers()
  })

  it('isRunning() is false before start()', () => {
    expect(source.isRunning()).toBe(false)
  })

  it('isRunning() is true after start()', async () => {
    await source.start()
    expect(source.isRunning()).toBe(true)
  })

  // AutoGenerateSource.FRAME_INTERVAL_MS is 100 (10fps — "TANK BUILD", down from
  // 30fps; see AutoGenerateSource.ts:74-79). It is a private static so it can't be
  // imported; mirror it here ONCE instead of scattering bare numbers. Tests advanced
  // 50ms against a 100ms interval and never crossed a single boundary, so no frame
  // was ever emitted — two failed outright and two others passed vacuously by
  // comparing zero frames to zero frames.
  const FRAME_MS = 100
  const FRAMES = (n: number) => FRAME_MS * n + 1   // +1 to land past the boundary

  it('emits frames to subscribers after start()', async () => {
    const frames: AnalysisFrame[] = []
    source.subscribe((frame) => frames.push(frame))

    await source.start()
    vi.advanceTimersByTime(FRAMES(3))

    expect(frames.length).toBeGreaterThan(0)
  })

  it('frames have valid AnalysisFrame fields', async () => {
    let lastFrame: AnalysisFrame | null = null
    source.subscribe((frame) => { lastFrame = frame })

    await source.start()
    vi.advanceTimersByTime(FRAMES(3))

    expect(lastFrame).not.toBeNull()
    const f = lastFrame!
    expect(f.timestamp).toBeGreaterThan(0)
    expect(f.frameIndex).toBeGreaterThanOrEqual(0)
    expect(f.sampleRate).toBe(44100)
    expect(f.rms).toBeGreaterThanOrEqual(0)
    expect(f.rms).toBeLessThanOrEqual(1)
    expect(typeof f.pitch).toBe('number')
    expect(typeof f.voiceActive).toBe('boolean')
  })

  it('emits musical energy without faking a human voice', async () => {
    const frames: AnalysisFrame[] = []
    source.subscribe((frame) => frames.push(frame))

    await source.start()
    vi.advanceTimersByTime(FRAMES(3))

    expect(frames.length).toBeGreaterThan(0)
    expect(frames.every(frame => frame.voiceActive === false)).toBe(true)
    expect(frames.every(frame => frame.voiceConfidence === 0)).toBe(true)
    expect(frames.some(frame => frame.rms > 0.05)).toBe(true)
  })

  it('getLastFrame() returns last emitted frame', async () => {
    await source.start()
    vi.advanceTimersByTime(FRAMES(3))

    const frame = source.getLastFrame()
    expect(frame).not.toBeNull()
    expect(frame!.frameIndex).toBeGreaterThanOrEqual(0)
  })

  it('stop() halts frame emission', async () => {
    const frames: AnalysisFrame[] = []
    source.subscribe((frame) => frames.push(frame))

    await source.start()
    vi.advanceTimersByTime(FRAMES(3))
    const countBefore = frames.length
    // Guard the guard: without this the test proved nothing — it used to advance
    // less than one interval, so countBefore was 0 and the assertion below was
    // 0 === 0, which would hold even if emission were completely broken.
    expect(countBefore).toBeGreaterThan(0)

    source.stop()
    vi.advanceTimersByTime(FRAMES(3))

    expect(frames.length).toBe(countBefore)
    expect(source.isRunning()).toBe(false)
  })

  it('unsubscribe prevents further callbacks', async () => {
    const frames: AnalysisFrame[] = []
    const unsub = source.subscribe((frame) => frames.push(frame))

    await source.start()
    vi.advanceTimersByTime(FRAMES(3))
    expect(frames.length).toBeGreaterThan(0)   // else the check below is vacuous

    unsub()
    const countAfterUnsub = frames.length

    vi.advanceTimersByTime(FRAMES(3))
    expect(frames.length).toBe(countAfterUnsub)
  })

  it('chill energy produces lower rms than intense', async () => {
    const chillSource = new AutoGenerateSource({ energy: 'chill' })
    const intenseSource = new AutoGenerateSource({ energy: 'intense' })

    const chillFrames: AnalysisFrame[] = []
    const intenseFrames: AnalysisFrame[] = []

    chillSource.subscribe((f) => chillFrames.push(f))
    intenseSource.subscribe((f) => intenseFrames.push(f))

    await chillSource.start()
    await intenseSource.start()
    vi.advanceTimersByTime(500)

    chillSource.stop()
    intenseSource.stop()

    const avgChillRms = chillFrames.reduce((s, f) => s + f.rms, 0) / chillFrames.length
    const avgIntenseRms = intenseFrames.reduce((s, f) => s + f.rms, 0) / intenseFrames.length

    expect(avgChillRms).toBeLessThan(avgIntenseRms)
  })
})
