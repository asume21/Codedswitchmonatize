import { describe, expect, it } from 'vitest'
import { computeProfile } from '../ProfileEngine'
import { OrganismMode } from '../../physics/types'
import type { SessionDNA } from '../../session/types'

function makeSessionDNA(overrides: Partial<SessionDNA> = {}): SessionDNA {
  return {
    sessionId: 'sess-1', userId: 'user1', createdAt: Date.now(),
    durationMs: 60000, dominantMode: OrganismMode.Glow,
    modeDistribution: {
      [OrganismMode.Heat]: 0.1,
      [OrganismMode.Ice]: 0.1,
      [OrganismMode.Smoke]: 0.1,
      [OrganismMode.Gravel]: 0.1,
      [OrganismMode.Glow]: 0.6,
    },
    avgPulse: 90, pulseRange: [80, 100],
    avgBounce: 0.5, avgSwing: 0.5, avgPresence: 0.4, avgDensity: 0.5,
    timeInFlowMs: 30000, flowPercentage: 0.5,
    longestFlowStreak: 15000, transitionCount: 5,
    cadenceLockEvents: 2, avgSyllabicDensity: 1.8,
    pitchCenter: 200, energyProfile: 'warm',
    physicsTimeline: [], stateTimeline: [],
    transitions: [], generatorEvents: [],
    ...overrides,
  }
}

describe('ProfileEngine', () => {
  it('empty sessions → returns NULL_PROFILE with userId', () => {
    const profile = computeProfile('user1', [])
    expect(profile.userId).toBe('user1')
    expect(profile.sessionCount).toBe(0)
    expect(profile.bounceBias).toBe(0)
    expect(profile.confidence).toBe(0)
  })

  it('1 session → sessionCount=1, confidence=0.05', () => {
    const sessions = [makeSessionDNA()]
    const profile = computeProfile('user1', sessions)
    expect(profile.sessionCount).toBe(1)
    expect(profile.confidence).toBeCloseTo(0.05, 2)
  })

  it('20 sessions → confidence saturates at 1.0', () => {
    const sessions = Array.from({ length: 20 }, () => makeSessionDNA())
    const profile = computeProfile('user1', sessions)
    expect(profile.confidence).toBe(1)
  })

  it('high bounce sessions → positive bounceBias', () => {
    const sessions = Array.from({ length: 10 }, () =>
      makeSessionDNA({ avgBounce: 0.8 })
    )
    const profile = computeProfile('user1', sessions)
    expect(profile.bounceBias).toBeGreaterThan(0)
  })

  it('low pulse sessions → negative pulseBias', () => {
    const sessions = Array.from({ length: 10 }, () =>
      makeSessionDNA({ avgPulse: 75 })
    )
    const profile = computeProfile('user1', sessions)
    expect(profile.pulseBias).toBeLessThan(0)
  })

  it('dominantly Heat mode → positive heat modeBias', () => {
    const sessions = Array.from({ length: 10 }, () =>
      makeSessionDNA({
        modeDistribution: {
          [OrganismMode.Heat]: 0.8,
          [OrganismMode.Ice]: 0.05,
          [OrganismMode.Smoke]: 0.05,
          [OrganismMode.Gravel]: 0.05,
          [OrganismMode.Glow]: 0.05,
        },
      })
    )
    const profile = computeProfile('user1', sessions)
    expect(profile.modeBias[OrganismMode.Heat]).toBeGreaterThan(0)
  })

  it('biases are clamped within range', () => {
    const sessions = Array.from({ length: 10 }, () =>
      makeSessionDNA({ avgBounce: 1.0, avgPulse: 200 })
    )
    const profile = computeProfile('user1', sessions)
    expect(profile.bounceBias).toBeLessThanOrEqual(0.3)
    expect(profile.pulseBias).toBeLessThanOrEqual(15)
  })
})
