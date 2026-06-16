import { beforeEach, describe, expect, it, vi } from 'vitest'

// Network-backed service is unavoidable to mock: tryAceFirst's whole job is
// deciding whether/when to call it and how to normalize/fail-soft the result.
vi.mock('../aceStepService', () => ({
  isWorkerReady: vi.fn(),
  generateAndWait: vi.fn(),
}))

import { isWorkerReady, generateAndWait } from '../aceStepService'
import { tryAceFirst } from '../aceFirst'

const mockReady = vi.mocked(isWorkerReady)
const mockGenerate = vi.mocked(generateAndWait)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('tryAceFirst', () => {
  it('returns a normalized result when ACE renders successfully', async () => {
    mockReady.mockResolvedValue(true)
    mockGenerate.mockResolvedValue({
      jobId: 'j1',
      status: 'done',
      outputPath: '/data/ace/j1.wav',
      outputUrl: '/api/ai-music/audio/j1.wav',
      durationS: 30,
      generationS: 42,
    })

    const result = await tryAceFirst({ prompt: 'trap, 808, dark' }, 'unit-test')

    expect(result).toEqual({
      url: '/api/ai-music/audio/j1.wav',
      localPath: '/data/ace/j1.wav',
      durationS: 30,
    })
    expect(mockGenerate).toHaveBeenCalledWith({ prompt: 'trap, 808, dark' })
  })

  it('returns null without generating when the worker is not ready', async () => {
    mockReady.mockResolvedValue(false)

    const result = await tryAceFirst({ prompt: 'trap' }, 'unit-test')

    expect(result).toBeNull()
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('returns null instead of throwing when generation fails', async () => {
    mockReady.mockResolvedValue(true)
    mockGenerate.mockRejectedValue(new Error('ACE-Step generation failed: boom'))

    await expect(tryAceFirst({ prompt: 'trap' }, 'unit-test')).resolves.toBeNull()
  })

  it('returns null when the job completes without any audio reference', async () => {
    mockReady.mockResolvedValue(true)
    mockGenerate.mockResolvedValue({ jobId: 'j2', status: 'done' })

    await expect(tryAceFirst({ prompt: 'trap' }, 'unit-test')).resolves.toBeNull()
  })

  it('returns null when even the health check itself throws', async () => {
    mockReady.mockRejectedValue(new Error('network down'))

    const result = await tryAceFirst({ prompt: 'trap' }, 'unit-test')

    expect(result).toBeNull()
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('falls back to a remote URL when no local file was written', async () => {
    mockReady.mockResolvedValue(true)
    mockGenerate.mockResolvedValue({
      jobId: 'j3',
      status: 'done',
      outputUrl: 'https://cdn.example.com/j3.wav',
      durationS: 12,
    })

    const result = await tryAceFirst({ prompt: 'lo-fi' }, 'unit-test')

    expect(result).toEqual({
      url: 'https://cdn.example.com/j3.wav',
      localPath: undefined,
      durationS: 12,
    })
  })
})
