import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SessionRecorder } from '../SessionRecorder'
import { DEFAULT_CAPTURE_CONFIG } from '../types'
import type { PhysicsState } from '../../physics/types'
import type { OrganismState } from '../../state/types'
import type { TransitionEvent } from '../../state/types'
import { OrganismMode } from '../../physics/types'
import { OState, OTransition } from '../../state/types'

function makePhysics(frameIndex: number): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0.3, presence: 0.4, density: 0.5,
    mode: OrganismMode.Glow, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: frameIndex * 23, frameIndex, voiceActive: true,
  }
}

function makeOrganism(frameIndex: number): OrganismState {
  return {
    current: OState.Flow, previous: OState.Breathing,
    framesInState: 100, msInState: 2300, barsInState: 2,
    awakeningProgress: 1, breathingWarmth: 1, flowDepth: 0.8,
    syllabicDensity: 2.0,
    cadenceLockBars: 0, cadenceLockAchieved: false,
    silenceDurationMs: 0, lastTransitionPhysics: null,
    timestamp: frameIndex * 23, frameIndex,
  }
}

describe('SessionRecorder', () => {
  let recorder: SessionRecorder

  beforeEach(() => {
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(1000) })
    recorder = new SessionRecorder(DEFAULT_CAPTURE_CONFIG)
  })

  it('start() resets all buffers and sets sessionStartMs', () => {
    recorder.start()
    const data = recorder.getData()
    expect(data.physicsTimeline).toHaveLength(0)
    expect(data.stateTimeline).toHaveLength(0)
    expect(data.generatorEvents).toHaveLength(0)
    expect(data.transitions).toHaveLength(0)
    expect(data.sessionStartMs).toBe(1000)
  })

  it('recordFrame() only samples at timelineSampleRate interval', () => {
    recorder.start()
    // DEFAULT_CAPTURE_CONFIG.timelineSampleRate = 10
    for (let i = 1; i <= 25; i++) {
      recorder.recordFrame(makePhysics(i), makeOrganism(i))
    }
    const data = recorder.getData()
    // Frames 10, 20 → 2 entries
    expect(data.physicsTimeline).toHaveLength(2)
    expect(data.stateTimeline).toHaveLength(2)
  })

  it('after timelineSampleRate * 5 frames → 5 entries', () => {
    recorder.start()
    for (let i = 1; i <= 50; i++) {
      recorder.recordFrame(makePhysics(i), makeOrganism(i))
    }
    const data = recorder.getData()
    expect(data.physicsTimeline).toHaveLength(5)
  })

  it('recordTransition() appends to transitions buffer', () => {
    recorder.start()
    const event: TransitionEvent = {
      from: OState.Breathing,
      to: OState.Flow,
      transition: OTransition.BreathingToFlow,
      timestamp: 5000,
      physicsSnapshot: makePhysics(100),
    }
    recorder.recordTransition(event)
    const data = recorder.getData()
    expect(data.transitions).toHaveLength(1)
    expect(data.transitions[0].from).toBe(OState.Breathing)
    expect(data.transitions[0].to).toBe(OState.Flow)
  })

  it('getDurationMs() returns correct elapsed time', () => {
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(1000) })
    recorder.start()
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(6000) })
    expect(recorder.getDurationMs()).toBe(5000)
  })

  it('reset() clears all buffers', () => {
    recorder.start()
    for (let i = 1; i <= 20; i++) {
      recorder.recordFrame(makePhysics(i), makeOrganism(i))
    }
    recorder.reset()
    const data = recorder.getData()
    expect(data.physicsTimeline).toHaveLength(0)
    expect(data.sessionStartMs).toBe(-1)
  })
})
