import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CaptureEngine } from '../CaptureEngine'
import type { PhysicsState } from '../../physics/types'
import type { OrganismState } from '../../state/types'
import { OrganismMode } from '../../physics/types'
import { OState } from '../../state/types'

vi.mock('uuid', () => ({ v4: () => 'capture-uuid-5678' }))

// Mock fetch to prevent real network calls
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))

function makePhysics(): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0.3, presence: 0.4, density: 0.5,
    mode: OrganismMode.Glow, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: 1000, frameIndex: 1, voiceActive: true,
  }
}

function makeOrganism(): OrganismState {
  return {
    current: OState.Flow, previous: OState.Breathing,
    framesInState: 100, msInState: 2300, barsInState: 2,
    awakeningProgress: 1, breathingWarmth: 1, flowDepth: 0.8,
    syllabicDensity: 2.0,
    cadenceLockBars: 0, cadenceLockAchieved: false,
    silenceDurationMs: 0, lastTransitionPhysics: null,
    timestamp: 1000, frameIndex: 1,
  }
}

describe('CaptureEngine', () => {
  let engine: CaptureEngine

  beforeEach(() => {
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(1000) })
    engine = new CaptureEngine()
    engine.setUserId('test-user')
    engine.startSession()
  })

  it('capture() returns SessionDNA with valid sessionId and userId', async () => {
    // Record some frames so we have data
    for (let i = 0; i < 20; i++) {
      vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(1000 + i * 100) })
      engine.recordFrame(makePhysics(), makeOrganism())
    }
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(3000) })

    const dna = await engine.capture()
    expect(dna.sessionId).toBe('capture-uuid-5678')
    expect(dna.userId).toBe('test-user')
  })

  it('onCapture() callback fires after capture()', async () => {
    const cb = vi.fn()
    engine.onCapture(cb)

    await engine.capture()
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb.mock.calls[0][0].userId).toBe('test-user')
  })

  it('exportMidi() returns null before first capture()', () => {
    expect(engine.exportMidi()).toBeNull()
  })

  it('exportMidi() returns MidiExportResult after capture()', async () => {
    await engine.capture()
    const result = engine.exportMidi()
    expect(result).not.toBeNull()
    expect(result!.blob).toBeInstanceOf(Blob)
    expect(result!.filename).toContain('capture-uuid-5678')
  })

  it('reset() clears lastDNA and resets recorder', async () => {
    await engine.capture()
    expect(engine.getLastDNA()).not.toBeNull()

    engine.reset()
    expect(engine.getLastDNA()).toBeNull()
    expect(engine.exportMidi()).toBeNull()
  })
})
