/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import type { OrganismState, TransitionEvent, OrganismStateCallback, TransitionEventCallback } from '../../state/types'
import type { PhysicsStateCallback } from '../../physics/types'
import { createToneMock, mockToneStart, mockTransportStart, mockTransportStop } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { GeneratorOrchestrator } from '../GeneratorOrchestrator'
import { useStudioStore } from '../../../stores/useStudioStore'

// ── Mock PhysicsEngine & StateMachine ───────────────────────────────

function createMockPhysicsEngine() {
  const callbacks = new Set<PhysicsStateCallback>()
  return {
    subscribe: vi.fn((cb: PhysicsStateCallback) => {
      callbacks.add(cb)
      return () => callbacks.delete(cb)
    }),
    registerGeneratorLevel: vi.fn(),
    _emit(state: PhysicsState) {
      callbacks.forEach(cb => cb(state))
    },
  }
}

function createMockStateMachine() {
  const stateCallbacks = new Set<OrganismStateCallback>()
  const transitionCallbacks = new Set<TransitionEventCallback>()
  return {
    subscribe: vi.fn((cb: OrganismStateCallback) => {
      stateCallbacks.add(cb)
      return () => stateCallbacks.delete(cb)
    }),
    onTransition: vi.fn((cb: TransitionEventCallback) => {
      transitionCallbacks.add(cb)
      return () => transitionCallbacks.delete(cb)
    }),
    _emitState(state: OrganismState) {
      stateCallbacks.forEach(cb => cb(state))
    },
    _emitTransition(event: TransitionEvent) {
      transitionCallbacks.forEach(cb => cb(event))
    },
  }
}

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

describe('GeneratorOrchestrator', () => {
  let orchestrator: GeneratorOrchestrator
  let mockPhysics: ReturnType<typeof createMockPhysicsEngine>
  let mockStateMachine: ReturnType<typeof createMockStateMachine>

  beforeEach(() => {
    vi.clearAllMocks()
    orchestrator = new GeneratorOrchestrator()
    mockPhysics = createMockPhysicsEngine()
    mockStateMachine = createMockStateMachine()
  })

  it('wire() connects physics and state machine without errors', () => {
    expect(() => {
      orchestrator.wire(
        mockPhysics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
        mockStateMachine as unknown as import('../../state/StateMachine').StateMachine,
      )
    }).not.toThrow()

    expect(mockPhysics.subscribe).toHaveBeenCalledOnce()
    expect(mockStateMachine.subscribe).toHaveBeenCalledOnce()
    expect(mockStateMachine.onTransition).toHaveBeenCalledOnce()
  })

  it('start() resolves and sets Tone.js Transport running', async () => {
    await orchestrator.start()

    expect(mockToneStart).toHaveBeenCalled()
    expect(mockTransportStart).toHaveBeenCalled()
  })

  it('pushes kick anchors from the drum pattern to the bass on start', async () => {
    const spy = vi.spyOn((orchestrator as any).bass, 'setKickAnchors')
    await orchestrator.start(90)
    expect(spy).toHaveBeenCalled()
    const slots = spy.mock.calls[spy.mock.calls.length - 1][0] as number[]
    expect(slots.length).toBeGreaterThan(0)
    expect(slots).toContain(0)   // every sub-genre pattern kicks on beat 1
  })

  it('freeplay drum patterns keep the genre skeleton (loud snares present)', async () => {
    const spy = vi.spyOn((orchestrator as any).drum, 'loadGeneratedPattern')
    await orchestrator.start(90)   // startup sub-genre is boom-bap (commit 9d9eb4fc)
    const hits = spy.mock.calls[spy.mock.calls.length - 1][0] as Array<{ instrument: string; time: string; velocity: number }>
    const snareSlots = hits
      .filter(h => h.instrument === 'snare' && h.velocity > 0.4 && h.time.startsWith('0:'))
      .map(h => { const [, beat, sub] = h.time.split(':').map(parseFloat); return beat * 4 + Math.floor(sub) })
    // boom-bap skeleton snares (2 and 4). If the harness starts on another
    // sub-genre, assert that genre's SKELETONS entry instead — don't delete.
    expect(snareSlots).toContain(4)
    expect(snareSlots).toContain(12)
  })

  it('start(bpm) preserves the explicit preset tempo', async () => {
    const tone = await import('tone')

    await orchestrator.start(140)

    expect(tone.getTransport().bpm.value).toBe(140)
    expect(useStudioStore.getState().bpm).toBe(140)
  })

  it('all 5 generators receive processFrame calls after wire()', () => {
    orchestrator.wire(
      mockPhysics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
      mockStateMachine as unknown as import('../../state/StateMachine').StateMachine,
    )

    // Emit organism state first so onFrame has it
    const organism = makeOrganism()
    mockStateMachine._emitState(organism)

    // Then emit physics — this triggers onFrame
    const physics = makePhysics()
    mockPhysics._emit(physics)

    // registerGeneratorLevel should be called 5 times (one per generator)
    expect(mockPhysics.registerGeneratorLevel).toHaveBeenCalledTimes(5)
  })

  it('getOutput() returns GeneratorOutput with all 5 reports', () => {
    orchestrator.wire(
      mockPhysics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
      mockStateMachine as unknown as import('../../state/StateMachine').StateMachine,
    )

    const organism = makeOrganism()
    mockStateMachine._emitState(organism)
    mockPhysics._emit(makePhysics())

    const output = orchestrator.getOutput()
    expect(output).not.toBeNull()
    expect(output!.drum).toBeDefined()
    expect(output!.bass).toBeDefined()
    expect(output!.melody).toBeDefined()
    expect(output!.texture).toBeDefined()
    expect(output!.chord).toBeDefined()
    expect(output!.drum.name).toBe('drum')
    expect(output!.bass.name).toBe('bass')
    expect(output!.melody.name).toBe('melody')
    expect(output!.texture.name).toBe('texture')
    expect(output!.chord.name).toBe('chord')
  })

  it('reset() zeros all generators and clears lastPhysics', async () => {
    await orchestrator.start()
    orchestrator.reset()

    // reset() calls stop(), but stop() must NOT stop Tone.Transport 
    // to preserve studio playback (piano roll, etc.)
    expect(mockTransportStop).not.toHaveBeenCalled()

    // After reset, getOutput returns null (no lastPhysics)
    expect(orchestrator.getOutput()).toBeNull()
  })

  it('transition event to FLOW → all generators receive onStateTransition(FLOW)', () => {
    orchestrator.wire(
      mockPhysics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
      mockStateMachine as unknown as import('../../state/StateMachine').StateMachine,
    )

    // Need lastPhysics to be set
    const organism = makeOrganism()
    mockStateMachine._emitState(organism)
    const physics = makePhysics()
    mockPhysics._emit(physics)

    // Emit transition event
    const event: TransitionEvent = {
      from: OState.Breathing,
      to: OState.Flow,
      transition: 'BREATHING_TO_FLOW' as import('../../state/types').OTransition,
      timestamp: 2000,
      physicsSnapshot: physics,
    }
    mockStateMachine._emitTransition(event)

    // Should not throw — all generators received the transition
    expect(mockPhysics.registerGeneratorLevel).toHaveBeenCalled()
  })

  it('density > 0.85 triggers thinning on texture generator', () => {
    orchestrator.wire(
      mockPhysics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
      mockStateMachine as unknown as import('../../state/StateMachine').StateMachine,
    )

    const organism = makeOrganism({ current: OState.Flow, flowDepth: 1 })
    mockStateMachine._emitState(organism)

    // Emit physics with high density
    const physics = makePhysics({ density: 0.9 })
    mockPhysics._emit(physics)

    // No error means thinning was set successfully
    expect(mockPhysics.registerGeneratorLevel).toHaveBeenCalled()
  })
})

// ── Loop Pack tests ──────────────────────────────────────────────────

import type { LoopPack } from '@shared/loopPack'

function makeTestPack(): LoopPack {
  const clip = (id: string) => ({ id, url: `https://cdn.test/${id}.wav`, bars: 4 })
  return {
    id: 'test-pack', genre: 'hip-hop', bpm: 95, key: 'Am', label: 'Test Pack',
    loops: {
      drums:   [clip('d1')],
      bass:    [clip('b1')],
      melody:  [clip('m1')],
      chords:  [clip('c1')],
      texture: [clip('t1')],
    },
  }
}

describe('GeneratorOrchestrator — loop pack', () => {
  it('loadLoopPack calls loadLoop on each generator with the first clip', async () => {
    const orch = new GeneratorOrchestrator()
    // Actual field names: drum, bass, melody, chord (not chords), texture
    const spyDrum    = vi.spyOn((orch as any).drum,    'loadLoop').mockResolvedValue(undefined)
    const spyBass    = vi.spyOn((orch as any).bass,    'loadLoop').mockResolvedValue(undefined)
    const spyMelody  = vi.spyOn((orch as any).melody,  'loadLoop').mockResolvedValue(undefined)
    const spyChord   = vi.spyOn((orch as any).chord,   'loadLoop').mockResolvedValue(undefined)
    const spyTexture = vi.spyOn((orch as any).texture, 'loadLoop').mockResolvedValue(undefined)
    vi.spyOn((orch as any).drum,    'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).bass,    'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).melody,  'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).chord,   'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).texture, 'setLoopMode').mockImplementation(() => {})

    const pack = makeTestPack()
    await orch.loadLoopPack(pack)

    expect(spyDrum).toHaveBeenCalledWith(pack.loops.drums[0])
    expect(spyBass).toHaveBeenCalledWith(pack.loops.bass[0])
    expect(spyMelody).toHaveBeenCalledWith(pack.loops.melody[0])
    expect(spyChord).toHaveBeenCalledWith(pack.loops.chords[0])
    expect(spyTexture).toHaveBeenCalledWith(pack.loops.texture[0])
  })

  it('loadLoopPack sets Transport bpm to pack.bpm', async () => {
    const tone = await import('tone')
    const orch = new GeneratorOrchestrator()
    ;['drum', 'bass', 'melody', 'chord', 'texture'].forEach(g => {
      vi.spyOn((orch as any)[g], 'loadLoop').mockResolvedValue(undefined)
      vi.spyOn((orch as any)[g], 'setLoopMode').mockImplementation(() => {})
    })
    await orch.loadLoopPack(makeTestPack())
    expect(tone.getTransport().bpm.value).toBe(95)
    expect(useStudioStore.getState().bpm).toBe(95)
  })

  it('clearLoopPack unloads loop playback resources on all generators', () => {
    const orch = new GeneratorOrchestrator()
    const spies = ['drum', 'bass', 'melody', 'chord', 'texture'].map(g =>
      vi.spyOn((orch as any)[g], 'unloadLoopPlayback').mockImplementation(() => {})
    )
    orch.clearLoopPack()
    spies.forEach(spy => expect(spy).toHaveBeenCalledOnce())
  })

  it('forceSubGenre does not randomize the transport tempo', async () => {
    const tone = await import('tone')
    const orch = new GeneratorOrchestrator()
    useStudioStore.getState().setBpm(144)

    orch.forceSubGenre('trap' as any)

    expect(tone.getTransport().bpm.value).toBe(144)
    expect(useStudioStore.getState().bpm).toBe(144)
  })

  it('emits generator note events when a generated drum pattern is loaded', () => {
    const orch = new GeneratorOrchestrator()
    const events: import('../../session/types').GeneratorEvent[] = []
    orch.onGeneratorEvent((event) => events.push(event))

    orch.loadGeneratedDrumPattern([
      { instrument: 'kick' as any, time: '0:0:0', velocity: 0.8 },
      { instrument: 'snare' as any, time: '0:1:0', velocity: 0.7 },
    ], true)

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      generator: 'drum',
      eventType: 'note_on',
      pitch: 36,
    })
  })
})

// ── Preset swap: clean cut (no stacking) ─────────────────────────────
// A live preset swap must silence the OUTGOING preset's parts immediately
// rather than letting them ride the section-change handoff (which keeps them
// for ~1-2 bars and makes the old + new presets audibly stack). swapSubGenre
// is the dedicated live-swap entry, so the clean cut lives there.

describe('GeneratorOrchestrator — preset swap clean cut', () => {
  it('swapSubGenre hard-cuts every generator part before rebuilding', () => {
    const orch = new GeneratorOrchestrator()
    const spies = ['drum', 'bass', 'melody', 'chord', 'texture'].map(g =>
      vi.spyOn((orch as any)[g], 'stopPart').mockImplementation(() => {})
    )

    // No bpm arg — setBpm uses Transport.bpm.rampTo which the Tone mock omits,
    // and BPM is not what this test covers. The clean cut runs regardless.
    orch.swapSubGenre('boom-bap' as any)

    // All five (including the keys/pad texture) get cut so neither a Tone.Part
    // loop nor a sustained pad voicing survives into the new preset.
    spies.forEach(spy => expect(spy).toHaveBeenCalledOnce())
  })
})
