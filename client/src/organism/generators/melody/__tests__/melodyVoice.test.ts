import { describe, expect, it } from 'vitest'
import { assignMelodyVoice } from '../melodyVoice'

const pool = ['piano', 'strings', 'sax'] as unknown as Parameters<typeof assignMelodyVoice>[2]

describe('assignMelodyVoice', () => {
  it('is deterministic for a section + seed', () => {
    expect(assignMelodyVoice('chorus', 3, pool)).toBe(assignMelodyVoice('chorus', 3, pool))
  })
  it('always picks a voice from the available pool', () => {
    const verse = assignMelodyVoice('verse', 3, pool)
    const chorus = assignMelodyVoice('chorus', 3, pool)
    expect(pool).toContain(verse)
    expect(pool).toContain(chorus)
  })
  it('returns null when no instrument is available', () => {
    expect(assignMelodyVoice('verse', 1, [] as unknown as typeof pool)).toBeNull()
  })
})
