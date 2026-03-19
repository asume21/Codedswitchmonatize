import { describe, expect, it } from 'vitest'
import { StateMachine } from '../StateMachine'
import { OState, OTransition, type OrganismState } from '../types'
import type { PhysicsState } from '../../physics/types'
import { OrganismMode } from '../../physics/types'

const DEFAULT_CONFIG = {
  voiceOnsetRmsThreshold: 0.02,
  pulseConfidenceThreshold: 0.4,
  syllabicDensityThreshold: 1.5,
  cadenceLockBarsRequired: 2,
  awakeningToSilenceMs: 8000,
  breathingToAwakeningMs: 4000,
  breathingToDormantMs: 30000,
  flowToBreathingMs: 4000,
  flowToDormantMs: 30000,
  awakeningMinBars: 2,
  awakeningMaxBars: 4,
  syllabicDensityWindowBars: 2,
}

const FRAME_MS = 23

const makePhysics = (override: Partial<PhysicsState> = {}): PhysicsState => ({
  bounce: 0,
  swing: 0.5,
  pocket: 0,
  presence: 0,
  density: 0,
  mode: OrganismMode.Heat,
  pulse: 120,
  beatDurationMs: 500,
  sixteenthDurationMs: 125,
  swungSixteenthMs: 250,
  timestamp: 0,
  frameIndex: 0,
  voiceActive: false,
  ...override,
})

function runFrames(
  machine: StateMachine,
  frames: number,
  startTs: number,
  physics: Partial<PhysicsState>,
): OrganismState {
  let state = machine.getCurrentState()
  for (let i = 0; i < frames; i += 1) {
    state = machine.processFrame(makePhysics({
      ...physics,
      timestamp: startTs + i * FRAME_MS,
      frameIndex: i,
    }))
  }

  return state
}

function forceFlowState(machine: StateMachine): OrganismState {
  machine.forceState(OState.Awakening, makePhysics({
    voiceActive: true,
    presence: 0.5,
    beatDurationMs: 100,
    timestamp: 0,
  }))

  machine.forceState(OState.Breathing, makePhysics({
    voiceActive: true,
    presence: 0.5,
    beatDurationMs: 100,
    timestamp: 10,
  }))

  machine.forceState(OState.Flow, makePhysics({
    voiceActive: true,
    presence: 0.5,
    beatDurationMs: 100,
    timestamp: 20,
  }))

  return machine.getCurrentState()
}

describe('StateMachine', () => {
  it('initial state is dormant', () => {
    const machine = new StateMachine(DEFAULT_CONFIG)
    expect(machine.getCurrentState().current).toBe(OState.Dormant)
  })

  it('enters awakening when voice presence exceeds threshold', () => {
    const machine = new StateMachine(DEFAULT_CONFIG)
    const state = machine.processFrame(makePhysics({
      voiceActive: true,
      presence: 0.05,
      timestamp: 0,
      frameIndex: 0,
    }))

    expect(state.current).toBe(OState.Awakening)
  })

  it('transitions through awakening to breathing after enough bars', () => {
    const machine = new StateMachine({
      ...DEFAULT_CONFIG,
      syllabicDensityWindowBars: 2,
    })

    runFrames(machine, 1, 0, {
      voiceActive: true,
      presence: 0.05,
      beatDurationMs: 100,
    })

    const state = runFrames(machine, 120, FRAME_MS, {
      voiceActive: true,
      presence: 0.05,
      beatDurationMs: 100,
      pulse: 120,
    })

    expect(state.current).toBe(OState.Breathing)
  })

  it('enters flow after sustained cadence lock', () => {
    const machine = new StateMachine({
      ...DEFAULT_CONFIG,
      syllabicDensityWindowBars: 2,
    })

    forceFlowState(machine)

    const state = machine.processFrame(makePhysics({
      voiceActive: true,
      presence: 1,
      beatDurationMs: 100,
      timestamp: FRAME_MS,
    }))

    expect(state.current).toBe(OState.Flow)
  })

  it('falls from flow to breathing after 4s silence, then to dormant after 30s', () => {
    const flowFallbackConfig = {
      ...DEFAULT_CONFIG,
      breathingToAwakeningMs: 99999,
    }
    const machine = new StateMachine(flowFallbackConfig)

    forceFlowState(machine)

    const after4s = runFrames(machine, 200, 0, {
      voiceActive: false,
      presence: 0,
      beatDurationMs: 100,
    })

    expect(after4s.current).toBe(OState.Breathing)

    const after30s = runFrames(machine, 1500, FRAME_MS * 200 + FRAME_MS, {
      voiceActive: false,
      presence: 0,
      beatDurationMs: 100,
    })

    expect(after30s.current).toBe(OState.Dormant)
  })

  it('resets flowDepth on fallback and keeps cadenceLockAchieved', () => {
    const flowFallbackConfig = {
      ...DEFAULT_CONFIG,
      breathingToAwakeningMs: 99999,
    }
    const machine = new StateMachine(flowFallbackConfig)

    forceFlowState(machine)
    const stateFlow = machine.getCurrentState()
    expect(stateFlow.current).toBe(OState.Flow)

    const fallback = runFrames(machine, 200, 0, {
      voiceActive: false,
      presence: 0,
      beatDurationMs: 100,
    })

    expect(fallback.current).toBe(OState.Breathing)
    expect(fallback.cadenceLockAchieved).toBe(true)
    expect(fallback.flowDepth).toBe(0)
  })

  it('fires transition event for first transition', () => {
    const machine = new StateMachine(DEFAULT_CONFIG)
    const events: Array<{ from: OState; to: OState; transition: OTransition }> = []

    machine.onTransition((event) => {
      events.push({ from: event.from, to: event.to, transition: event.transition })
    })

    runFrames(machine, 1, 0, {
      voiceActive: true,
      presence: 0.05,
      beatDurationMs: 100,
    })
    runFrames(machine, 120, FRAME_MS, {
      voiceActive: true,
      presence: 0.05,
      beatDurationMs: 100,
      pulse: 120,
    })

    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toMatchObject({
      from: OState.Dormant,
      to: OState.Awakening,
      transition: OTransition.DormantToAwakening,
    })
  })

  it('reset() returns to dormant and zeroes counters', () => {
    const machine = new StateMachine(DEFAULT_CONFIG)

    machine.forceState(OState.Flow, makePhysics({
      voiceActive: true,
      presence: 0.8,
      timestamp: 0,
      beatDurationMs: 100,
    }))
    machine.processFrame(makePhysics({
      voiceActive: true,
      presence: 1,
      timestamp: FRAME_MS,
      beatDurationMs: 100,
    }))

    machine.reset()

    const state = machine.getCurrentState()
    expect(state.current).toBe(OState.Dormant)
    expect(state.syllabicDensity).toBe(0)
    expect(state.cadenceLockBars).toBe(0)
    expect(state.silenceDurationMs).toBe(0)
    expect(state.framesInState).toBe(0)
    expect(state.barsInState).toBe(0)
  })
})
