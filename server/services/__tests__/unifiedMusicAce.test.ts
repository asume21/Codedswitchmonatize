import { beforeEach, describe, expect, it, vi } from 'vitest'

// unifiedMusicService pulls in heavy network/IO modules at import time —
// mock the seams, keep the service's own routing logic real.
vi.mock('../aceFirst', () => ({ tryAceFirst: vi.fn() }))
vi.mock('replicate', () => ({
  default: class MockReplicate {
    run = vi.fn(async () => 'https://replicate.example/out.wav')
  },
}))
vi.mock('../local-musicgen', () => ({ localMusicGenService: { generateSamplePack: vi.fn() } }))
vi.mock('../../objectStorage', () => ({ ObjectStorageService: class {} }))
vi.mock('../sunoApiService', () => ({ sunoApiService: { isConfigured: () => false } }))

import { tryAceFirst } from '../aceFirst'
import { unifiedMusicService } from '../unifiedMusicService'

const mockAce = vi.mocked(tryAceFirst)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('unifiedMusicService ACE-first wiring', () => {
  it('generateTrack returns the ACE render when ACE succeeds', async () => {
    mockAce.mockResolvedValue({ url: '/api/ai-music/audio/t1.wav', durationS: 30 })

    const result = await unifiedMusicService.generateTrack('dark trap beat', {
      type: 'beat', genre: 'trap', duration: 30,
    })

    expect(result.status).toBe('success')
    expect(result.audio_url).toBe('/api/ai-music/audio/t1.wav')
    expect(result.metadata.generator).toBe('ace-step')
  })

  it('generateTrack falls back to Replicate when ACE returns null', async () => {
    mockAce.mockResolvedValue(null)

    const result = await unifiedMusicService.generateTrack('dark trap beat', {
      type: 'beat', genre: 'trap', duration: 30,
    })

    expect(mockAce).toHaveBeenCalled()
    expect(result.status).toBe('success')
    expect(result.audio_url).toBe('https://replicate.example/out.wav')
    expect(result.metadata.generator).toBe('musicgen')
  })

  it('generateFullSong (instrumental) returns ACE render as provider 0', async () => {
    mockAce.mockResolvedValue({ url: '/api/ai-music/audio/s1.wav', durationS: 60 })

    const result = await unifiedMusicService.generateFullSong('chill lo-fi song', {
      genre: 'lo-fi', vocals: false, duration: 60,
    })

    expect(result.status).toBe('success')
    expect(result.audio_url).toBe('/api/ai-music/audio/s1.wav')
    expect(result.metadata.generator).toBe('ace-step')
  })

  it('generateFullSong with vocals skips ACE (no lyrics available here)', async () => {
    mockAce.mockResolvedValue({ url: '/api/ai-music/audio/never.wav' })

    const result = await unifiedMusicService.generateFullSong('a song about love', {
      genre: 'pop', vocals: true, duration: 60,
    })

    expect(mockAce).not.toHaveBeenCalled()
    // Suno is unconfigured in this test, so the cascade lands on Replicate.
    expect(result.audio_url).toBe('https://replicate.example/out.wav')
  })
})
