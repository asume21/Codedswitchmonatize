import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiRequest = vi.fn()
vi.mock('@/lib/queryClient', () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))

import { parseAceStems, requestAceStems } from '../requestAceStems'

function jsonResponse(body: unknown, ok = true): unknown {
  return { ok, status: ok ? 200 : 500, json: async () => body }
}

beforeEach(() => { apiRequest.mockReset() })

describe('parseAceStems — ACE lego object shape -> AceStem[]', () => {
  it('maps { drums, bass, other } URLs to named stems carrying the render bpm', () => {
    const stems = parseAceStems(
      { drums: '/api/stems/a_drums.wav', bass: '/api/stems/a_bass.wav', other: '/api/stems/a_other.wav' },
      140,
    )
    expect(stems).toEqual([
      { name: 'drums', url: '/api/stems/a_drums.wav', bpm: 140 },
      { name: 'bass',  url: '/api/stems/a_bass.wav',  bpm: 140 },
      { name: 'other', url: '/api/stems/a_other.wav', bpm: 140 },
    ])
  })

  it('skips empty/missing URLs', () => {
    expect(parseAceStems({ drums: '/x.wav', bass: '' }, 90)).toEqual([{ name: 'drums', url: '/x.wav', bpm: 90 }])
  })

  it('returns [] for a non-object or the sidecar array shape (not ours)', () => {
    expect(parseAceStems(undefined, 90)).toEqual([])
    expect(parseAceStems([{ name: 'drums', url: '/d.wav' }], 90)).toEqual([])
  })
})

describe('requestAceStems — start + poll', () => {
  it('returns parsed stems when the job completes', async () => {
    apiRequest
      .mockResolvedValueOnce(jsonResponse({ success: true, jobId: 'ace:1', status: 'pending' }))
      .mockResolvedValueOnce(jsonResponse({ success: true, jobId: 'ace:1', status: 'running' }))
      .mockResolvedValueOnce(jsonResponse({ success: true, jobId: 'ace:1', status: 'complete', stems: { drums: '/d.wav', bass: '/b.wav' } }))

    const stems = await requestAceStems({ prompt: 'trap', bpm: 140 }, { pollIntervalMs: 1, maxWaitMs: 5000 })

    expect(stems).toEqual([
      { name: 'drums', url: '/d.wav', bpm: 140 },
      { name: 'bass',  url: '/b.wav', bpm: 140 },
    ])
    expect(apiRequest).toHaveBeenCalledWith(
      'POST', '/api/stem-generation/generate',
      expect.objectContaining({ prompt: 'trap', bpm: 140 }),
    )
  })

  it('returns null when the generate call fails', async () => {
    apiRequest.mockResolvedValueOnce(jsonResponse({ error: 'nope' }, false))
    const stems = await requestAceStems({ prompt: 'x', bpm: 90 }, { pollIntervalMs: 1, maxWaitMs: 100 })
    expect(stems).toBeNull()
  })

  it('returns null when the job reports an error', async () => {
    apiRequest
      .mockResolvedValueOnce(jsonResponse({ jobId: 'ace:2', status: 'pending' }))
      .mockResolvedValueOnce(jsonResponse({ jobId: 'ace:2', status: 'error', error: 'oom' }))
    const stems = await requestAceStems({ prompt: 'x', bpm: 90 }, { pollIntervalMs: 1, maxWaitMs: 5000 })
    expect(stems).toBeNull()
  })
})
