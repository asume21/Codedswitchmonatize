// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { OrganismProvider } from '../OrganismProvider'
import { useOrganism } from '../OrganismContext'

// Mock all organism engines using classes so `new` works
const noop = () => {}

vi.mock('../../../organism/analysis/AudioAnalysisEngine', () => ({
  AudioAnalysisEngine: class {
    subscribe = vi.fn().mockReturnValue(noop)
    start = vi.fn().mockResolvedValue(undefined)
    stop = vi.fn()
    getLastFrame = vi.fn().mockReturnValue(null)
  },
}))

vi.mock('../../../organism/physics/PhysicsEngine', () => ({
  PhysicsEngine: class {
    subscribe = vi.fn().mockReturnValue(noop)
    processFrame = vi.fn()
    getLastState = vi.fn().mockReturnValue(null)
    reset = vi.fn()
  },
}))

vi.mock('../../../organism/state/StateMachine', () => ({
  StateMachine: class {
    subscribe = vi.fn().mockReturnValue(noop)
    onTransition = vi.fn().mockReturnValue(noop)
    processFrame = vi.fn()
    getCurrentState = vi.fn().mockReturnValue({
      current: 'DORMANT', previous: null,
      framesInState: 0, msInState: 0, barsInState: 0,
      awakeningProgress: 0, breathingWarmth: 0, flowDepth: 0,
      syllabicDensity: 0, cadenceLockBars: 0, cadenceLockAchieved: false,
      silenceDurationMs: 0, lastTransitionPhysics: null,
      timestamp: 0, frameIndex: 0,
    })
  },
}))

vi.mock('../../../organism/generators/GeneratorOrchestrator', () => ({
  GeneratorOrchestrator: class {
    wire = vi.fn()
    start = vi.fn().mockResolvedValue(undefined)
    stop = vi.fn()
    reset = vi.fn()
  },
}))

vi.mock('../../../organism/reactive/ReactiveBehaviorEngine', () => ({
  ReactiveBehaviorEngine: class {
    wire = vi.fn()
    processFrame = vi.fn()
  },
}))

vi.mock('../../../organism/mix/MixEngine', () => ({
  MixEngine: class {
    wire = vi.fn()
    startMetering = vi.fn()
    onMeter = vi.fn().mockReturnValue(noop)
    dispose = vi.fn()
  },
}))

vi.mock('../../../organism/session/CaptureEngine', () => ({
  CaptureEngine: class {
    setUserId = vi.fn()
    startSession = vi.fn()
    recordFrame = vi.fn()
    recordTransition = vi.fn()
    onCapture = vi.fn().mockReturnValue(noop)
    capture = vi.fn().mockResolvedValue({
      sessionId: 'test', userId: 'user1',
      createdAt: Date.now(), durationMs: 5000,
      dominantMode: 'glow', modeDistribution: {},
      avgPulse: 90, pulseRange: [80, 100],
      avgBounce: 0.5, avgSwing: 0.5,
      avgPresence: 0.4, avgDensity: 0.5,
      timeInFlowMs: 2000, flowPercentage: 0.4,
      longestFlowStreak: 1000, transitionCount: 3,
      cadenceLockEvents: 1, avgSyllabicDensity: 1.5,
      pitchCenter: 200, energyProfile: 'warm',
      physicsTimeline: [], stateTimeline: [],
      transitions: [], generatorEvents: [],
    })
    downloadMidi = vi.fn()
    reset = vi.fn()
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return <OrganismProvider userId="test-user">{children}</OrganismProvider>
}

describe('OrganismProvider', () => {
  it('renders children without crashing', () => {
    const { result } = renderHook(() => useOrganism(), { wrapper })
    expect(result.current).toBeDefined()
  })

  it('useOrganism() outside provider → throws error', () => {
    expect(() => {
      renderHook(() => useOrganism())
    }).toThrow('useOrganism must be used inside OrganismProvider')
  })

  it('isRunning starts as false', () => {
    const { result } = renderHook(() => useOrganism(), { wrapper })
    expect(result.current.isRunning).toBe(false)
  })

  it('error starts as null', () => {
    const { result } = renderHook(() => useOrganism(), { wrapper })
    expect(result.current.error).toBeNull()
  })

  it('isCapturing starts as false', () => {
    const { result } = renderHook(() => useOrganism(), { wrapper })
    expect(result.current.isCapturing).toBe(false)
  })

  it('lastSessionDNA starts as null', () => {
    const { result } = renderHook(() => useOrganism(), { wrapper })
    expect(result.current.lastSessionDNA).toBeNull()
  })
})
