// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { OrganismContext } from '../OrganismContext'
import type { OrganismContextValue } from '../OrganismContext'
import { OrganismControls } from '../OrganismControls'
import { OrganismMode } from '../../../organism/physics/types'

function makeCtx(overrides: Partial<OrganismContextValue> = {}): OrganismContextValue {
  return {
    analysisEngine: null,
    physicsEngine: null,
    stateMachine: null,
    orchestrator: null,
    reactiveBehaviors: null,
    mixEngine: null,
    captureEngine: null,
    physicsState: null,
    organismState: null,
    meterReading: null,
    lastSessionDNA: null,
    start: vi.fn(),
    stop: vi.fn(),
    capture: vi.fn().mockResolvedValue(null),
    downloadMidi: vi.fn(),
    inputSource: 'mic' as const,
    setInputSource: vi.fn(),
    autoEnergy: 'medium' as const,
    setAutoEnergy: vi.fn(),
    isRunning: false,
    isRecording: false,
    isCapturing: false,
    startRecording: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn().mockResolvedValue(null),
    lastSavedSession: null,
    savedSessions: [],
    downloadSession: vi.fn(),
    error: null,
    transcription: null,
    transcriptionEnabled: false,
    setTranscriptionEnabled: vi.fn(),
    copyLyrics: vi.fn().mockResolvedValue(false),
    exportLyrics: vi.fn(),
    latchMode: false,
    setLatchMode: vi.fn(),
    isPatternLocked: false,
    lockPattern: vi.fn(),
    unlockPattern: vi.fn(),
    hatDensity: 1,
    kickVelocity: 1,
    bassVolume: 1,
    melodyVolume: 1,
    setHatDensity: vi.fn(),
    setKickVelocity: vi.fn(),
    setBassVolume: vi.fn(),
    setMelodyVolume: vi.fn(),
    ...overrides,
  }
}

function renderWithCtx(ctx: OrganismContextValue) {
  return render(
    <OrganismContext.Provider value={ctx}>
      <OrganismControls />
    </OrganismContext.Provider>
  )
}

describe('OrganismControls', () => {
  afterEach(() => cleanup())

  it('Start button renders when isRunning=false', () => {
    renderWithCtx(makeCtx({ isRunning: false }))
    expect(screen.getByText(/Start/)).toBeDefined()
  })

  it('Stop button renders when isRunning=true', () => {
    renderWithCtx(makeCtx({ isRunning: true }))
    expect(screen.getByText(/Stop/)).toBeDefined()
  })

  it('Capture button disabled when isRunning=false', () => {
    renderWithCtx(makeCtx({ isRunning: false }))
    const btns = screen.getAllByText('Capture')
    const btn = btns[0]
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('Download MIDI button absent when lastSessionDNA=null', () => {
    renderWithCtx(makeCtx({ lastSessionDNA: null }))
    expect(screen.queryByText('Download MIDI')).toBeNull()
  })

  it('Download MIDI button present when lastSessionDNA is set', () => {
    renderWithCtx(makeCtx({
      lastSessionDNA: {
        sessionId: 'test', userId: 'u1', createdAt: 0, durationMs: 5000,
        dominantMode: OrganismMode.Glow,
        modeDistribution: {} as Record<OrganismMode, number>,
        avgPulse: 90, pulseRange: [80, 100],
        avgBounce: 0.5, avgSwing: 0.5, avgPresence: 0.4, avgDensity: 0.5,
        timeInFlowMs: 2000, flowPercentage: 0.4,
        longestFlowStreak: 1000, transitionCount: 3,
        cadenceLockEvents: 1, avgSyllabicDensity: 1.5,
        pitchCenter: 200, energyProfile: 'warm',
        physicsTimeline: [], stateTimeline: [],
        transitions: [], generatorEvents: [],
      },
    }))
    expect(screen.getByText('Download MIDI')).toBeDefined()
  })

  it('Error message renders when error is non-null', () => {
    renderWithCtx(makeCtx({ error: 'Mic denied' }))
    expect(screen.getByText('Mic denied')).toBeDefined()
  })
})
