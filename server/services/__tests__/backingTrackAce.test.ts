import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../aceFirst', () => ({ tryAceFirst: vi.fn() }))
vi.mock('axios', () => ({ default: { post: vi.fn() } }))
vi.mock('../localStorageService', () => ({ LocalStorageService: class {} }))

import axios from 'axios'
import { tryAceFirst } from '../aceFirst'
import { backingTrackService } from '../backingTrack'

const mockAce = vi.mocked(tryAceFirst)
const mockPost = vi.mocked(axios.post)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('backingTrackService ACE-first', () => {
  it('returns the ACE render without touching the MusicGen sidecar', async () => {
    mockAce.mockResolvedValue({
      url: '/api/ai-music/audio/bt.wav',
      localPath: 'D:/tmp/bt.wav',
      durationS: 15,
    })

    const result = await backingTrackService.generateBackingTrack({
      prompt: 'warm lo-fi backing',
      durationSeconds: 15,
    })

    expect(result.audioUrl).toBe('/api/ai-music/audio/bt.wav')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('falls through to the sidecar when ACE returns null', async () => {
    mockAce.mockResolvedValue(null)
    mockPost.mockResolvedValue({ data: { success: false, error: 'sidecar down' } } as any)

    await expect(
      backingTrackService.generateBackingTrack({ prompt: 'x', durationSeconds: 10 }),
    ).rejects.toThrow(/sidecar down/)

    expect(mockPost).toHaveBeenCalled()
  })
})
