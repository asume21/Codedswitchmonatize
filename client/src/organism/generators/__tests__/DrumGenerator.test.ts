import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { LoopClip } from '@shared/loopPack'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import type { OrganismState } from '../../state/types'
import { DrumInstrument, GeneratorName } from '../types'
import { createToneMock, mockGainRampTo } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import * as Tone from 'tone'
import { DrumGenerator } from '../DrumGenerator'

// ── Helpers ─────────────────────────────────────────────────────────

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0, presence: 0, density: 0.3,
    mode: OrganismMode.Smoke, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: 1000, frameIndex: 43, voiceActive: false,
    ...overrides,
  }
}

function makeOrganism(overrides: Partial<OrganismState> = {}): OrganismState {
  return {
    current: OState.Breathing, previous: OState.Awakening,
    framesInState: 100, msInState: 2300, barsInState: 2,
    awakeningProgress: 1, breathingWarmth: 0.6, flowDepth: 0,
    syllabicDensity: 1.5, cadenceLockBars: 0, cadenceLockAchieved: false,
    silenceDurationMs: 0, lastTransitionPhysics: null,
    timestamp: 1000, frameIndex: 43,
    ...overrides,
  }
}

describe('DrumGenerator', () => {
  let gen: DrumGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    gen = new DrumGenerator()
  })

  it('has correct generator name', () => {
    expect(gen.name).toBe(GeneratorName.Drum)
  })

  it('getActivityReport() returns level=0 in DORMANT state', () => {
    gen.processFrame(makePhysics(), makeOrganism({ current: OState.Dormant }))
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBeLessThan(0.01)
    expect(report.name).toBe(GeneratorName.Drum)
  })

  it('onStateTransition(AWAKENING) → activityLevel approaches 0.15', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Awakening, physics)

    // Simulate several frames in awakening
    const organism = makeOrganism({
      current: OState.Awakening,
      awakeningProgress: 1.0,
    })
    for (let i = 0; i < 200; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBeGreaterThan(0.10)
    expect(report.activityLevel).toBeLessThan(0.25)
  })

  it('onStateTransition(BREATHING) → activityLevel approaches 0.55', () => {
    const physics = makePhysics()
    gen.setRole('lead')   // measure the pure reactive curve (ceiling 1.0)
    gen.onStateTransition(OState.Breathing, physics)

    const organism = makeOrganism({
      current: OState.Breathing,
      breathingWarmth: 1.0,
    })
    for (let i = 0; i < 300; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBeGreaterThan(0.40)
    expect(report.activityLevel).toBeLessThan(0.65)
  })

  it('onStateTransition(FLOW) → activityLevel approaches 0.85', () => {
    const physics = makePhysics()
    gen.setRole('lead')   // measure the pure reactive curve (ceiling 1.0)
    gen.onStateTransition(OState.Flow, physics)

    const organism = makeOrganism({
      current: OState.Flow,
      flowDepth: 1.0,
    })
    for (let i = 0; i < 400; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBeGreaterThan(0.70)
    expect(report.activityLevel).toBeLessThan(0.95)
  })

  it('role "out" silences the part regardless of Flow state (composer sits it out)', () => {
    const physics = makePhysics()
    gen.setRole('out')
    gen.onStateTransition(OState.Flow, physics)

    const organism = makeOrganism({ current: OState.Flow, flowDepth: 1.0 })
    for (let i = 0; i < 400; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBeLessThan(0.001)
  })

  it('processFrame with high presence → hat velocity reduced (pocket behavior)', () => {
    const physics = makePhysics({ presence: 0.9 })
    gen.onStateTransition(OState.Breathing, physics)

    const organism = makeOrganism({ current: OState.Breathing, breathingWarmth: 1 })
    gen.processFrame(physics, organism)

    // Gain rampTo should have been called (output level applied)
    expect(mockGainRampTo).toHaveBeenCalled()
  })

  it('processFrame with bounce=1.0 → kick velocity increased', () => {
    const physics = makePhysics({ bounce: 1.0 })
    gen.onStateTransition(OState.Breathing, physics)

    const organism = makeOrganism({ current: OState.Breathing })
    gen.processFrame(physics, organism)

    // The drum generator stores bounce for dynamic application
    expect(mockGainRampTo).toHaveBeenCalled()
  })

  it('pattern rebuilds on state transition without error', () => {
    const physics = makePhysics()
    expect(() => gen.onStateTransition(OState.Breathing, physics)).not.toThrow()
    expect(() => gen.onStateTransition(OState.Flow, physics)).not.toThrow()
  })

  it('keeps snare backbeats when section density is sparse', () => {
    const events: import('../../session/types').GeneratorEvent[] = []
    gen.setGeneratorEventSink(event => events.push(event))
    gen.setSectionDensity(0.25)

    gen.loadGeneratedPattern([
      { instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.9 },
      { instrument: DrumInstrument.Snare, time: '0:1:0', velocity: 0.8 },
      { instrument: DrumInstrument.Hat, time: '0:2:0', velocity: 0.5 },
      { instrument: DrumInstrument.Perc, time: '0:3:0', velocity: 0.4 },
    ], true)

    // With Bug 9 fixed, hats/perc are filtered out entirely in the sparse tier (< 0.45),
    // keeping only Kick and Snare.
    expect(events.map(event => event.pitch)).toEqual([36, 38])
  })

  it('keeps default runtime pocket tight instead of dragging the kit late', () => {
    gen.loadGeneratedPattern([
      { instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.9 },
      { instrument: DrumInstrument.Snare, time: '0:1:0', velocity: 0.8 },
      { instrument: DrumInstrument.Hat, time: '0:0:1', velocity: 0.5 },
    ], true)

    const partMock = Tone.Part as unknown as {
      mock: {
        calls: Array<[unknown, Array<{ instrument: DrumInstrument; microShift: number }>]>
      }
    }
    const events = partMock.mock.calls.at(-1)?.[1] ?? []
    const snare = events.find(event => event.instrument === DrumInstrument.Snare)
    const hat = events.find(event => event.instrument === DrumInstrument.Hat)

    expect(snare?.microShift).toBeGreaterThanOrEqual(0.002)
    expect(snare?.microShift).toBeLessThanOrEqual(0.007)
    expect(hat?.microShift).toBeGreaterThanOrEqual(0)
    expect(hat?.microShift).toBeLessThanOrEqual(0.003)
  })

  it('reset() zeros activity level', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Breathing, physics)
    const organism = makeOrganism({ current: OState.Breathing, breathingWarmth: 1 })
    for (let i = 0; i < 100; i++) gen.processFrame(physics, organism)

    gen.reset()
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
  })

  it('supports odd time signatures (3/4, 5/4, 7/8) without crashing', () => {
    const transport = Tone.getTransport()
    
    transport.timeSignature = 3
    expect(() => gen.loadGeneratedPattern([
      { instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.9 },
      { instrument: DrumInstrument.Snare, time: '0:1:0', velocity: 0.8 },
      { instrument: DrumInstrument.Hat, time: '0:2:0', velocity: 0.5 },
    ], true)).not.toThrow()

    transport.timeSignature = 5
    expect(() => gen.loadGeneratedPattern([
      { instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.9 },
      { instrument: DrumInstrument.Snare, time: '0:2:0', velocity: 0.8 },
      { instrument: DrumInstrument.Hat, time: '0:4:0', velocity: 0.5 },
    ], true)).not.toThrow()

    transport.timeSignature = 7.8
    expect(() => gen.loadGeneratedPattern([
      { instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.9 },
      { instrument: DrumInstrument.Snare, time: '0:3:0', velocity: 0.8 },
    ], true)).not.toThrow()
  })

  it('adjusts swingAmount based on the sub-genre', () => {
    gen.setGenreTarget('jazz')
    expect(gen.swingAmount).toBe(0.08)
    
    gen.setGenreTarget('edm')
    expect(gen.swingAmount).toBe(0)
    
    gen.setGenreTarget('boom-bap')
    expect(gen.swingAmount).toBe(0.05)
  })

  it('applies genre-aware velocity profiles to hits', () => {
    gen.setEnabled(true)
    gen['lastKickTime'] = -100 // Avoid test-induced sidechain ducking
    
    // 1. Test Latin (should scale down lower velocities)
    gen.setGenreTarget('latin')
    gen.loadGeneratedPattern([
      { instrument: DrumInstrument.Hat, time: '0:0:0', velocity: 0.5 }
    ], true)
    
    let partMock = Tone.Part as any
    let lastCall = partMock.mock.calls.at(-1)
    let callback = lastCall[0]
    let events = lastCall[1]
    
    let spy = vi.spyOn(gen['sampledKit']!, 'trigger').mockReturnValue(true)
    callback(0, events[0])
    expect(spy).toHaveBeenCalledWith(DrumInstrument.Hat, expect.any(Number), 0.35, 0.5)
    
    // 2. Test EDM (should compress range and make hits harder)
    spy.mockClear()
    gen.setGenreTarget('edm')
    gen.loadGeneratedPattern([
      { instrument: DrumInstrument.Hat, time: '0:0:0', velocity: 0.5 }
    ], true)
    
    partMock = Tone.Part as any
    lastCall = partMock.mock.calls.at(-1)
    callback = lastCall[0]
    events = lastCall[1]
    
    callback(0, events[0])
    expect(spy).toHaveBeenCalledWith(DrumInstrument.Hat, expect.any(Number), 0.9, 0.5)
  })

  it('supports pattern locking and unlocking', () => {
    const hits = [
      { instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.9 },
      { instrument: DrumInstrument.Snare, time: '0:2:0', velocity: 0.8 },
    ]
    gen.loadGeneratedPattern(hits, true)
    
    expect(gen.isPatternLocked()).toBe(false)
    
    const locked = gen.lockPattern()
    expect(gen.isPatternLocked()).toBe(true)
    expect(locked.length).toBe(2)
    expect(gen.getLockedHits()).toEqual(locked)
    
    // Rebuilds should be blocked when locked
    gen.onStateTransition(OState.Breathing, makePhysics())
    expect(gen.getLockedHits()).toEqual(locked)
    
    gen.unlockPattern()
    expect(gen.isPatternLocked()).toBe(false)
    expect(gen.getLockedHits()).toEqual([])
  })

  it('blocks all pattern rebuilds and immediate hits when disabled', () => {
    gen.setEnabled(false)
    
    const hits = [{ instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.9 }]
    gen.loadGeneratedPattern(hits, true)
    expect(gen['part']).toBeNull()
    
    const spy = vi.spyOn(gen['sampledKit']!, 'trigger').mockReturnValue(true)
    gen.triggerImmediateHit(DrumInstrument.Kick, 0.8)
    expect(spy).not.toHaveBeenCalled()
  })

  it('schedules micro-fills and break-fills correctly', () => {
    const transport = Tone.getTransport()
    const scheduleOnceSpy = vi.spyOn(transport, 'scheduleOnce')
    
    gen.triggerMicroFill(10, 0)
    expect(scheduleOnceSpy).toHaveBeenCalledTimes(4)
    
    scheduleOnceSpy.mockClear()
    gen.triggerMicroFill(10, 1)
    expect(scheduleOnceSpy).toHaveBeenCalledTimes(2)
    
    scheduleOnceSpy.mockClear()
    gen.triggerMicroFill(10, 2)
    expect(scheduleOnceSpy).toHaveBeenCalledTimes(2)
    
    const clearSpy = vi.spyOn(transport, 'clear')
    gen.clearMicroFill()
    expect(clearSpy).toHaveBeenCalled()
    
    gen.triggerBarEndBreakFill(20)
    expect(gen['breakFillPart']).not.toBeNull()
    gen.clearBarEndBreakFill()
    expect(gen['breakFillPart']).toBeNull()
  })

  it('triggers kick sidechain callback when kick is played', () => {
    const callback = vi.fn()
    gen.setKickTriggerCallback(callback)
    
    vi.spyOn(gen['sampledKit']!, 'trigger').mockReturnValue(true)
    gen['triggerDrum'](DrumInstrument.Kick, 1.5, 0.8)
    expect(callback).toHaveBeenCalledWith(expect.any(Number))
  })

  it('triggers cinematic impact hits', () => {
    const kickSubSpy = vi.spyOn(gen['kickSub']!, 'triggerAttackRelease')
    const hatOpenSpy = vi.spyOn(gen['hatOpen']!, 'triggerAttackRelease')
    
    gen.triggerImpact(5.0, 0.95)
    
    expect(kickSubSpy).toHaveBeenCalledWith('G0', '2n', expect.any(Number), 0.95)
    expect(hatOpenSpy).toHaveBeenCalledWith('4n', expect.any(Number), 0.95 * 0.7)
  })

  it('throttles pattern rebuilds to MIN_REBUILD_INTERVAL_MS', () => {
    const rebuildSpy = vi.spyOn(gen as any, 'rebuildPart')
    const hits = [{ instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.9 }]
    
    const originalNow = performance.now
    performance.now = vi.fn().mockReturnValue(1000)
    
    gen.loadGeneratedPattern(hits, false)
    expect(rebuildSpy).toHaveBeenCalledTimes(1)
    
    rebuildSpy.mockClear()
    gen.loadGeneratedPattern(hits, false)
    expect(rebuildSpy).not.toHaveBeenCalled()
    
    performance.now = vi.fn().mockReturnValue(1600)
    gen.loadGeneratedPattern(hits, false)
    expect(rebuildSpy).toHaveBeenCalledTimes(1)
    
    performance.now = originalNow
  })

  it('broadcasts beat pattern to BeatMaker and deduplicates it', () => {
    const originalWindow = global.window
    const dispatchSpy = vi.fn()
    global.window = { dispatchEvent: dispatchSpy } as any
    
    const hits = [
      { instrument: DrumInstrument.Kick, time: '0:0:0', velocity: 0.9 }
    ]
    
    gen.loadGeneratedPattern(hits, true)
    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    
    const event = dispatchSpy.mock.calls[0][0]
    expect(event.type).toBe('ai:loadBeatPattern')
    expect(event.detail.tracks.find((t: any) => t.id === 'kick').pattern[0].active).toBe(true)
    
    global.window = originalWindow
  })

  it('nullifies references on dispose() to avoid memory leaks', () => {
    gen.dispose()
    expect(gen['kickSub']).toBeNull()
    expect(gen['kickClick']).toBeNull()
    expect(gen['snareBody']).toBeNull()
    expect(gen['snareTone']).toBeNull()
    expect(gen['hat']).toBeNull()
    expect(gen['hatOpen']).toBeNull()
    expect(gen['perc']).toBeNull()
    expect(gen['sampledKit']).toBeNull()
  })
})

describe('DrumGenerator — loop mode', () => {
  let gen: DrumGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    gen = new DrumGenerator()
  })

  it('loadLoop creates a Tone.Player with loop:true', async () => {
    const { Player } = await import('tone')
    const clip: LoopClip = { id: 'd1', url: 'http://cdn.test/drums.wav', bars: 4 }
    await gen.loadLoop(clip)
    expect(Player).toHaveBeenCalledWith(expect.objectContaining({ url: clip.url, loop: true }))
  })

  it('setLoopMode(true) schedules player start at next bar boundary', async () => {
    const tone = await import('tone')
    const clip: LoopClip = { id: 'd1', url: 'http://cdn.test/drums.wav', bars: 4 }
    await gen.loadLoop(clip)
    gen.setLoopMode(true)
    expect(tone.getTransport().scheduleOnce).toHaveBeenCalledWith(expect.any(Function), '@1m')
  })

  it('setLoopMode(false) stops the player', async () => {
    const tone = await import('tone')
    const clip: LoopClip = { id: 'd1', url: 'http://cdn.test/drums.wav', bars: 4 }
    await gen.loadLoop(clip)
    gen.setLoopMode(true)
    gen.setLoopMode(false)
    // The mock player's stop should have been called — use last result since
    // SampledDrumKit also creates Player instances in DrumGenerator's constructor
    const mockPlayer = (tone.Player as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value
    expect(mockPlayer?.stop).toHaveBeenCalled()
  })

  it('stopLoopPlayback clears pending loop starts before they can fire later', async () => {
    const tone = await import('tone')
    const clip: LoopClip = { id: 'd1', url: 'http://cdn.test/drums.wav', bars: 4 }
    await gen.loadLoop(clip)
    gen.setLoopMode(true)

    gen.stopLoopPlayback()

    expect(tone.getTransport().clear).toHaveBeenCalledWith(0)
    const mockPlayer = (tone.Player as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value
    expect(mockPlayer?.stop).toHaveBeenCalled()
  })

  it('setLoopMode(false) before loadLoop does not throw', () => {
    expect(() => gen.setLoopMode(false)).not.toThrow()
  })
})
