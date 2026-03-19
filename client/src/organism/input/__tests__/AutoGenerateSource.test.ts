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

  it('emits frames to subscribers after start()', async () => {
    const frames: AnalysisFrame[] = []
    source.subscribe((frame) => frames.push(frame))

    await source.start()
    // Advance past several frame intervals (~23ms each)
    vi.advanceTimersByTime(100)

    expect(frames.length).toBeGreaterThan(0)
  })

  it('frames have valid AnalysisFrame fields', async () => {
    let lastFrame: AnalysisFrame | null = null
    source.subscribe((frame) => { lastFrame = frame })

    await source.start()
    vi.advanceTimersByTime(50)

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

  it('getLastFrame() returns last emitted frame', async () => {
    await source.start()
    vi.advanceTimersByTime(50)

    const frame = source.getLastFrame()
    expect(frame).not.toBeNull()
    expect(frame!.frameIndex).toBeGreaterThanOrEqual(0)
  })

  it('stop() halts frame emission', async () => {
    const frames: AnalysisFrame[] = []
    source.subscribe((frame) => frames.push(frame))

    await source.start()
    vi.advanceTimersByTime(50)
    const countBefore = frames.length

    source.stop()
    vi.advanceTimersByTime(200)

    expect(frames.length).toBe(countBefore)
    expect(source.isRunning()).toBe(false)
  })

  it('unsubscribe prevents further callbacks', async () => {
    const frames: AnalysisFrame[] = []
    const unsub = source.subscribe((frame) => frames.push(frame))

    await source.start()
    vi.advanceTimersByTime(50)

    unsub()
    const countAfterUnsub = frames.length

    vi.advanceTimersByTime(100)
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
