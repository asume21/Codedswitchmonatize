// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { OrganismContext } from '../OrganismContext'
import type { OrganismContextValue } from '../OrganismContext'
import { OrganismPage } from '../OrganismPage'

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
    isCapturing: false,
    error: null,
    ...overrides,
  }
}

function renderPage(ctx?: Partial<OrganismContextValue>) {
  return render(
    <OrganismContext.Provider value={makeCtx(ctx)}>
      <OrganismPage />
    </OrganismContext.Provider>
  )
}

describe('OrganismPage', () => {
  afterEach(() => cleanup())

  it('Page renders without crash', () => {
    renderPage()
    expect(screen.getAllByText('Hip-Hop Organism').length).toBeGreaterThan(0)
  })

  it('"Hip-Hop Organism" heading present', () => {
    renderPage()
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Hip-Hop Organism')
  })

  it('Controls section present', () => {
    renderPage()
    expect(screen.getAllByText(/Start/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Capture/).length).toBeGreaterThan(0)
  })

  it('Visualizer section present', () => {
    renderPage()
    expect(screen.getAllByText(/Organism is dormant/).length).toBeGreaterThan(0)
  })

  it('Session sidebar shows "No session captured yet" initially', () => {
    renderPage()
    expect(screen.getAllByText(/No session captured yet/).length).toBeGreaterThan(0)
  })
})
