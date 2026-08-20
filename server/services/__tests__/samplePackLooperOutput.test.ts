import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression guard for the bug that made generated packs unplayable.
 *
 * Production evidence (2026-08-20): every saved pack held
 *   {"audioUrl":{}, ...} x4  followed by  {"audioUrl":null, ...} x16
 * because (a) replicate.run returns FileOutput objects, not URL strings, and a
 * `as string` cast let them reach res.json() where they serialise to `{}`, and
 * (b) musicgen-looper's schema declares variation_01..variation_20 but only
 * fills as many as `variations` requested, leaving 16 null holes.
 */

const REAL_URLS = [
  'https://replicate.delivery/pbxt/aaa/variation_01.wav',
  'https://replicate.delivery/pbxt/bbb/variation_02.wav',
  'https://replicate.delivery/pbxt/ccc/variation_03.wav',
  'https://replicate.delivery/pbxt/ddd/variation_04.wav',
]

/** Mirrors replicate's createFileOutput: a ReadableStream carrying the URL. */
function makeFileOutput(url: string) {
  class FileOutput extends ReadableStream {
    url() { return new URL(url) }
    toString() { return url }
  }
  return new FileOutput({ start(c) { c.close() } })
}

/** The exact output musicgen-looper produces for `variations: 4`. */
function looperOutput() {
  const out: Record<string, unknown> = {}
  for (let i = 1; i <= 20; i++) {
    const key = `variation_${String(i).padStart(2, '0')}`
    out[key] = i <= 4 ? makeFileOutput(REAL_URLS[i - 1]) : null
  }
  return out
}

const runMock = vi.fn(async () => looperOutput())

vi.mock('../aceFirst', () => ({ tryAceFirst: vi.fn() }))
vi.mock('../generatedAudioStore', () => ({ persistRemoteAudio: vi.fn() }))
vi.mock('replicate', () => ({
  default: class MockReplicate { run = runMock },
}))
vi.mock('../local-musicgen', () => ({ localMusicGenService: { generateSamplePack: vi.fn() } }))
vi.mock('../../objectStorage', () => ({ ObjectStorageService: class {} }))

import { tryAceFirst } from '../aceFirst'
import { persistRemoteAudio } from '../generatedAudioStore'
import { unifiedMusicService } from '../unifiedMusicService'

const mockAce = vi.mocked(tryAceFirst)
const mockPersist = vi.mocked(persistRemoteAudio)

/** Stand-in for the stored copy: the URL our own server serves it back on. */
const storedUrlFor = (remote: string) =>
  `/api/ai-music/audio/looper-${remote.slice(-18, -4)}.wav`

beforeEach(() => {
  vi.clearAllMocks()
  runMock.mockImplementation(async () => looperOutput())
  mockPersist.mockImplementation(async (remote: string) => storedUrlFor(remote))
  process.env.REPLICATE_API_TOKEN = 'test-token'
})

describe('sample packs from the musicgen-looper fallback', () => {
  it('resolves FileOutput values into real URLs that survive JSON serialisation', async () => {
    mockAce.mockResolvedValue(null)

    await unifiedMusicService.generateSamplePack('dark trap', { packCount: 1 })

    // The FileOutput must be unwrapped before anything downstream sees it —
    // a raw cast reached persistence/JSON as `{}`.
    expect(mockPersist.mock.calls.map((call) => call[0])).toEqual(REAL_URLS)
  })

  it('serves the stored copy, not the replicate.delivery URL that expires in an hour', async () => {
    mockAce.mockResolvedValue(null)

    const packs = await unifiedMusicService.generateSamplePack('dark trap', { packCount: 1 })
    const roundTripped = JSON.parse(JSON.stringify(packs))

    expect(roundTripped[0].samples.map((s: any) => s.audioUrl)).toEqual(
      REAL_URLS.map(storedUrlFor),
    )
  })

  it('keeps the remote URL when persistence fails, so a storage fault is not silence', async () => {
    mockAce.mockResolvedValue(null)
    mockPersist.mockResolvedValue(null)

    const packs = await unifiedMusicService.generateSamplePack('dark trap', { packCount: 1 })

    expect(packs[0].samples.map((s) => s.audioUrl)).toEqual(REAL_URLS)
  })

  it('drops the 16 unfilled variation slots instead of shipping null samples', async () => {
    mockAce.mockResolvedValue(null)

    const packs = await unifiedMusicService.generateSamplePack('dark trap', { packCount: 1 })

    expect(packs[0].samples).toHaveLength(4)
    expect(packs[0].samples.every((s) => typeof s.audioUrl === 'string')).toBe(true)
  })

  it('numbers the surviving samples contiguously', async () => {
    mockAce.mockResolvedValue(null)

    const packs = await unifiedMusicService.generateSamplePack('dark trap', { packCount: 1 })

    expect(packs[0].samples.map((s) => s.name.slice(-5).trim())).toEqual(
      ['Var 1', 'Var 2', 'Var 3', 'Var 4'],
    )
  })

  it('emits no pack at all when the looper fills none of the slots', async () => {
    mockAce.mockResolvedValue(null)
    runMock.mockImplementation(async () => {
      const out: Record<string, unknown> = {}
      for (let i = 1; i <= 20; i++) out[`variation_${String(i).padStart(2, '0')}`] = null
      return out
    })

    const packs = await unifiedMusicService.generateSamplePack('dark trap', { packCount: 1 })

    expect(packs).toHaveLength(0)
  })
})
