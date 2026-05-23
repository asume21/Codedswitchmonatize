// Local chord progression generator — replaces /chords routes' GPT call.
// Deterministic, instant, zero AI cost. Same response shape as before.

type Quality = 'maj' | 'min' | 'dim'

interface RomanEntry {
  offset: number
  quality: Quality
}

const ROMAN_TABLE: Record<string, RomanEntry> = {
  I:   { offset: 0,  quality: 'maj' },
  i:   { offset: 0,  quality: 'min' },
  II:  { offset: 2,  quality: 'maj' },
  ii:  { offset: 2,  quality: 'min' },
  III: { offset: 4,  quality: 'maj' },
  iii: { offset: 4,  quality: 'min' },
  IV:  { offset: 5,  quality: 'maj' },
  iv:  { offset: 5,  quality: 'min' },
  V:   { offset: 7,  quality: 'maj' },
  v:   { offset: 7,  quality: 'min' },
  VI:  { offset: 9,  quality: 'maj' },
  vi:  { offset: 9,  quality: 'min' },
  VII: { offset: 10, quality: 'maj' },
  vii: { offset: 11, quality: 'dim' },
}

const NOTE_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

const KEY_TO_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}

const MOOD_PROGRESSIONS: Record<string, string[][]> = {
  happy:       [['I','V','vi','IV'], ['I','IV','V','I'], ['I','vi','IV','V'], ['I','IV','vi','V']],
  joyful:      [['I','V','vi','IV'], ['I','IV','V'],     ['I','V','IV','V']],
  triumphant:  [['I','IV','V','I'], ['ii','V','I','IV'], ['I','V','vi','iii','IV','I','IV','V']],
  hopeful:     [['I','iii','vi','IV'], ['I','V','vi','iii'], ['IV','V','iii','vi']],
  romantic:    [['vi','IV','I','V'], ['I','vi','ii','V'], ['I','iii','vi','IV']],
  nostalgic:   [['I','vi','IV','V'], ['vi','ii','V','I'], ['iii','vi','IV','I']],
  peaceful:    [['I','IV','I','V'], ['IV','I','V','vi'], ['I','iii','IV','I']],
  relaxed:     [['I','IV','I','V'], ['IV','V','iii','vi']],
  chill:       [['ii','V','I','IV'], ['I','IV','iii','vi'], ['vi','IV','I','V']],
  playful:     [['I','V','IV','V'], ['I','vi','IV','V'], ['I','V','I','IV']],
  sad:         [['i','VI','III','VII'], ['i','iv','VII','III'], ['vi','IV','I','V']],
  melancholy:  [['i','VII','VI','VII'], ['i','iv','i','V'], ['vi','iii','IV','I']],
  tense:       [['i','VII','VI','V'], ['i','iv','V','i'], ['i','VI','iv','V']],
  dark:        [['i','VI','VII','i'], ['i','iv','VII','III'], ['i','VII','iv','V']],
  epic:        [['i','VI','III','VII'], ['i','V','VI','IV'], ['i','VII','VI','VII']],
  mysterious:  [['i','VII','VI','VII'], ['i','iv','VI','V'], ['vi','iii','vii','iii']],
  spiritual:   [['I','iii','vi','IV'], ['IV','V','I','vi'], ['I','vi','IV','V']],
  tender:      [['I','vi','ii','IV'], ['vi','IV','I','V'], ['I','iii','IV','vi']],
}

function realizeChord(numeral: string, keyRootIdx: number): string {
  const entry = ROMAN_TABLE[numeral] ?? ROMAN_TABLE.I
  const rootName = NOTE_SHARP[(keyRootIdx + entry.offset) % 12]
  if (entry.quality === 'min') return `${rootName}m`
  if (entry.quality === 'dim') return `${rootName}dim`
  return rootName
}

function normalizeKey(input: string): number {
  const cleaned = String(input ?? 'C').trim().replace(/[mM](in|aj)?$/i, '')
  const titled = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  return KEY_TO_INDEX[titled] ?? 0
}

function pickMoodProgressions(mood: string): string[][] {
  const key = String(mood ?? 'happy').trim().toLowerCase()
  return MOOD_PROGRESSIONS[key] ?? MOOD_PROGRESSIONS.happy
}

export interface ChordProgressionResult {
  chords: string[]
  progression: string
  key: string
  mood: string
}

export function generateChordProgression(key: string, mood: string): ChordProgressionResult {
  const keyRootIdx = normalizeKey(key)
  const candidates = pickMoodProgressions(mood)
  const numerals = candidates[Math.floor(Math.random() * candidates.length)]
  const chords = numerals.map(n => realizeChord(n, keyRootIdx))
  return {
    chords,
    progression: numerals.join('-'),
    key,
    mood,
  }
}
