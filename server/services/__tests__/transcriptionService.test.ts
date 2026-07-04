import { describe, it, expect } from 'vitest'
import { needsWhisperCompression } from '../transcriptionService'

const MiB = 1024 * 1024

describe('needsWhisperCompression', () => {
  it('leaves small files alone (under the 24 MiB safety threshold)', () => {
    expect(needsWhisperCompression(5 * MiB)).toBe(false)
    expect(needsWhisperCompression(24 * MiB)).toBe(false)
  })

  it('compresses files that would trip Whisper 25 MiB cap', () => {
    // The real failure: a ~26.4 MB WAV → OpenAI 413.
    expect(needsWhisperCompression(26_380_250)).toBe(true)
    expect(needsWhisperCompression(25 * MiB)).toBe(true)
  })

  it('uses a margin below the hard 25 MiB limit so borderline files are re-encoded', () => {
    expect(needsWhisperCompression(24 * MiB + 1)).toBe(true)
  })
})
