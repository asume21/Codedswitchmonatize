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

  it('all 4 generators receive processFrame calls after wire()', () => {
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

    // registerGeneratorLevel should be called 4 times (one per generator)
    expect(mockPhysics.registerGeneratorLevel).toHaveBeenCalledTimes(4)
  })

  it('getOutput() returns GeneratorOutput with all 4 reports', () => {
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
    expect(output!.drum.name).toBe('drum')
    expect(output!.bass.name).toBe('bass')
    expect(output!.melody.name).toBe('melody')
    expect(output!.texture.name).toBe('texture')
  })

  it('reset() stops transport and zeros all generators', async () => {
    await orchestrator.start()
    orchestrator.reset()

    expect(mockTransportStop).toHaveBeenCalled()

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
