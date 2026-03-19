import { describe, expect, it, vi } from 'vitest'
import { buildSessionDNA } from '../SessionDNA'
import { OrganismMode } from '../../physics/types'
import { OState } from '../../state/types'
import type { PhysicsSnapshot, StateSnapshot } from '../types'

vi.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }))

function makePhysicsSnap(
  i: number,
  overrides: Partial<PhysicsSnapshot> = {}
): PhysicsSnapshot {
  return {
    frameIndex: i, timestamp: i * 100,
    pulse: 90, bounce: 0.5, swing: 0.5, pocket: 0.3,
    presence: 0.4, density: 0.5, mode: OrganismMode.Glow,
    voiceActive: true, ...overrides,
  }
}

function makeStateSnap(
  i: number,
  overrides: Partial<StateSnapshot> = {}
): StateSnapshot {
  return {
    frameIndex: i, timestamp: i * 100,
    state: OState.Breathing, flowDepth: 0,
    syllabicDensity: 1.5, ...overrides,
  }
}

describe('buildSessionDNA', () => {
  it('empty timelines → valid DNA with 0 values', () => {
    const dna = buildSessionDNA('user1', {
      physicsTimeline: [],
      stateTimeline: [],
      generatorEvents: [],
      transitions: [],
      sessionStartMs: 0,
      currentMs: 5000,
    })
    expect(dna.sessionId).toBe('test-uuid-1234')
    expect(dna.userId).toBe('user1')
    expect(dna.avgPulse).toBe(0)
    expect(dna.avgBounce).toBe(0)
    expect(dna.flowPercentage).toBe(0)
  })

  it('mode with 60% of frames → appears as dominantMode', () => {
    const timeline: PhysicsSnapshot[] = []
    for (let i = 0; i < 60; i++) {
      timeline.push(makePhysicsSnap(i, { mode: OrganismMode.Heat }))
    }
    for (let i = 0; i < 40; i++) {
      timeline.push(makePhysicsSnap(60 + i, { mode: OrganismMode.Ice }))
    }

    const dna = buildSessionDNA('user1', {
      physicsTimeline: timeline,
      stateTimeline: timeline.map((_, i) => makeStateSnap(i)),
      generatorEvents: [],
      transitions: [],
      sessionStartMs: 0,
      currentMs: 10000,
    })

    expect(dna.dominantMode).toBe(OrganismMode.Heat)
    expect(dna.modeDistribution[OrganismMode.Heat]).toBeCloseTo(0.6, 1)
  })

  it('50% of state timeline in FLOW → flowPercentage ≈ 0.5', () => {
    const stateTimeline: StateSnapshot[] = []
    for (let i = 0; i < 50; i++) {
      stateTimeline.push(makeStateSnap(i, { state: OState.Flow }))
    }
    for (let i = 50; i < 100; i++) {
      stateTimeline.push(makeStateSnap(i, { state: OState.Breathing }))
    }
    const physicsTimeline = stateTimeline.map((_, i) => makePhysicsSnap(i))

    const dna = buildSessionDNA('user1', {
      physicsTimeline,
      stateTimeline,
      generatorEvents: [],
      transitions: [],
      sessionStartMs: 0,
      currentMs: 10000,
    })

    expect(dna.flowPercentage).toBeCloseTo(0.5, 1)
  })

  it('pulseRange correctly identifies min and max pulse values', () => {
    const physicsTimeline = [
      makePhysicsSnap(0, { pulse: 80 }),
      makePhysicsSnap(1, { pulse: 120 }),
      makePhysicsSnap(2, { pulse: 95 }),
    ]

    const dna = buildSessionDNA('user1', {
      physicsTimeline,
      stateTimeline: physicsTimeline.map((_, i) => makeStateSnap(i)),
      generatorEvents: [],
      transitions: [],
      sessionStartMs: 0,
      currentMs: 3000,
    })

    expect(dna.pulseRange[0]).toBe(80)
    expect(dna.pulseRange[1]).toBe(120)
  })

  it("energyProfile 'hot' when avgPresence > 0.7", () => {
    const physicsTimeline = Array.from({ length: 10 }, (_, i) =>
      makePhysicsSnap(i, { presence: 0.85 })
    )

    const dna = buildSessionDNA('user1', {
      physicsTimeline,
      stateTimeline: physicsTimeline.map((_, i) => makeStateSnap(i)),
      generatorEvents: [],
      transitions: [],
      sessionStartMs: 0,
      currentMs: 5000,
    })

    expect(dna.energyProfile).toBe('hot')
  })
})
