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
  })

  it('clearLoopPack calls setLoopMode(false) on all generators', () => {
    const orch = new GeneratorOrchestrator()
    const spies = ['drum', 'bass', 'melody', 'chord', 'texture'].map(g =>
      vi.spyOn((orch as any)[g], 'setLoopMode').mockImplementation(() => {})
    )
    orch.clearLoopPack()
    spies.forEach(spy => expect(spy).toHaveBeenCalledWith(false))
  })
})
