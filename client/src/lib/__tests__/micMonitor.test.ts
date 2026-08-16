/**
 * The mic monitor fed the microphone back into the speakers.
 *
 * User: "when i try and use the mic for leading with my voice everything starts
 * sounding distorted", and confirmed the monitor toggle was ON.
 *
 * FloatingAudioMonitor connected mic -> gain(0.8) -> shared context destination,
 * having opened its OWN getUserMedia with echoCancellation/noiseSuppression/
 * autoGainControl all FALSE. Two separate faults in one path:
 *
 *   1. A second, COMPETING mic stream. AudioAnalysisEngine.getStream() exists
 *      precisely so callers can avoid this — its docstring says so in as many
 *      words — and this caller ignored it. Two opens with OPPOSITE processing
 *      constraints force the device to reconcile them, which on Windows means
 *      renegotiating the shared WASAPI session that output is also using.
 *   2. Echo cancellation off on a path that goes to the speakers. That is the one
 *      browser feature whose entire job is stopping this loop.
 *
 * Reusing the analyser's stream fixes both: one device open, and it already has
 * echo cancellation on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const destination = {}
const gainNode = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }
const sourceNode = { connect: vi.fn(), disconnect: vi.fn() }
const fakeCtx = {
  destination,
  createGain: vi.fn(() => gainNode),
  createMediaStreamSource: vi.fn(() => sourceNode),
}

vi.mock('../audioContext', () => ({ getAudioContext: () => fakeCtx }))

import { startMicMonitor, stopMicMonitor, isMonitorUsingSharedStream } from '../micMonitor'

function fakeStream(label: string) {
  const track = { stop: vi.fn(), label }
  return { getTracks: () => [track], getAudioTracks: () => [track], __track: track } as unknown as
    MediaStream & { __track: { stop: ReturnType<typeof vi.fn> } }
}

describe('micMonitor', () => {
  beforeEach(() => {
    stopMicMonitor()
    vi.clearAllMocks()
  })

  it('reuses the analyser stream instead of opening a competing one', async () => {
    const shared = fakeStream('shared')
    const gum = vi.fn()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: gum } })

    await startMicMonitor(0.8, shared)

    expect(gum).not.toHaveBeenCalled()
    expect(isMonitorUsingSharedStream()).toBe(true)
  })

  it('does NOT stop a stream it does not own — that would kill the Organism input', async () => {
    const shared = fakeStream('shared')
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })

    await startMicMonitor(0.8, shared)
    stopMicMonitor()

    expect(shared.__track.stop).not.toHaveBeenCalled()
  })

  it('opens its own stream when none is shared, and stops that one', async () => {
    const own = fakeStream('own')
    const gum = vi.fn(async () => own)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: gum } })

    await startMicMonitor(0.8, null)
    expect(gum).toHaveBeenCalled()
    expect(isMonitorUsingSharedStream()).toBe(false)

    stopMicMonitor()
    expect(own.__track.stop).toHaveBeenCalled()
  })

  it('turns echo cancellation ON when it must open its own stream to the speakers', async () => {
    const gum = vi.fn(async () => fakeStream('own'))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: gum } })

    await startMicMonitor(0.8, null)

    const constraints = gum.mock.calls[0][0] as { audio: Record<string, unknown> }
    expect(constraints.audio.echoCancellation).toBe(true)
  })
})
