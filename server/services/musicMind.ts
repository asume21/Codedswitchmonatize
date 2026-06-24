// server/services/musicMind.ts
//
// Pure harmonic intelligence: maps (subGenre, sectionName) → chord progression.
// No network calls, no side effects. All data is hand-curated for emotional fit.
//
// Lookup order:
//   FULL_MATRIX[subGenre]?.[sectionName]
//     ?? GENERIC_FALLBACK[sectionName]
//     ?? GENERIC_FALLBACK['verse']

import type { ArrangementSectionName } from '../../shared/arrangement'

type SectionMap = Partial<Record<ArrangementSectionName, string[]>>
type GenreMatrix = Record<string, SectionMap>

// ── Generic per-section fallback ──────────────────────────────────────────────
// Used when a genre is missing from FULL_MATRIX. Still emotionally varied
// by section — never a flat repeat.

const GENERIC_FALLBACK: Record<string, string[]> = {
  intro:     ['i', 'VI', 'III', 'VII'],
  verse:     ['i', 'iv', 'VI', 'III'],
  build:     ['i', 'v', 'VII', 'iv'],
  drop:      ['i', 'VII', 'VI', 'VII'],
  breakdown: ['VI', 'III', 'VII', 'i'],
  drop2:     ['i', 'VII', 'VI', 'v'],
  outro:     ['i', 'VI', 'III', 'IV'],
}

// ── Full genre × section matrix ───────────────────────────────────────────────

const FULL_MATRIX: GenreMatrix = {
  'boom-bap': {
    intro:     ['i', 'bVII', 'bVI', 'bVII'],
    verse:     ['i', 'iv', 'bVI', 'bVII'],
    build:     ['i', 'v', 'bVI', 'V7'],
    drop:      ['i', 'bVI', 'bVII', 'i'],
    breakdown: ['bVI', 'bVII', 'i', 'v'],
    drop2:     ['i', 'bVI', 'bVII', 'V7'],
    outro:     ['i', 'iv', 'bVII', 'i'],
  },

  'lo-fi': {
    intro:     ['Imaj7', 'iii7', 'IVmaj7', 'V7'],
    verse:     ['vi7', 'ii7', 'V7', 'Imaj7'],
    build:     ['iii7', 'VI7', 'ii7', 'V7sus4'],
    drop:      ['Imaj7', 'bVIImaj7', 'IVmaj7', 'V7'],
    breakdown: ['vi7', 'bVIImaj7', 'IVmaj7', 'i7'],
    drop2:     ['Imaj7', 'vi7', 'IVmaj7', 'V7'],
    outro:     ['Imaj7', 'iii7', 'vi7', 'IVmaj7'],
  },

  'trap': {
    intro:     ['i', 'bVII', 'bVI', 'V'],
    verse:     ['i', 'VI', 'III', 'VII'],
    build:     ['i', 'v', 'bVI', 'bVII'],
    drop:      ['i', 'bVII', 'bVI', 'bVII'],
    breakdown: ['bVI', 'III', 'bVII', 'i'],
    drop2:     ['i', 'bVI', 'bVII', 'V'],
    outro:     ['i', 'VI', 'bVII', 'i'],
  },

  'drill': {
    intro:     ['i', 'v', 'bVII', 'VI'],
    verse:     ['i', 'v', 'VII', 'VI'],
    build:     ['i', 'iv', 'v', 'bVII'],
    drop:      ['i', 'bVI', 'v', 'bVII'],
    breakdown: ['bVI', 'bVII', 'i', 'iv'],
    drop2:     ['i', 'v', 'bVI', 'V7'],
    outro:     ['i', 'VI', 'bVII', 'i'],
  },

  'r&b': {
    intro:     ['Imaj7', 'vi7', 'IVmaj7', 'V7'],
    verse:     ['Imaj7', 'vi7', 'ii7', 'V7'],
    build:     ['iii7', 'VI7', 'ii7', 'V7'],
    drop:      ['Imaj7', 'IV', 'V', 'vi'],
    breakdown: ['vi7', 'ii7', 'bVIImaj7', 'IVmaj7'],
    drop2:     ['Imaj7', 'vi7', 'IV', 'V7'],
    outro:     ['Imaj7', 'iii7', 'vi7', 'IVmaj7'],
  },

  'soul': {
    intro:     ['vi7', 'ii7', 'V7', 'Imaj7'],
    verse:     ['Imaj7', 'IV', 'V7', 'vi'],
    build:     ['iii', 'VI7', 'ii7', 'V7'],
    drop:      ['I', 'IV', 'V', 'I'],
    breakdown: ['vi', 'ii7', 'IVmaj7', 'V7sus4'],
    drop2:     ['I', 'bVII', 'IV', 'I'],
    outro:     ['Imaj7', 'vi7', 'ii7', 'V7'],
  },

  'chill': {
    intro:     ['Imaj7', 'iii7', 'vi7', 'IVmaj7'],
    verse:     ['Imaj7', 'IVmaj7', 'iii7', 'vi7'],
    build:     ['ii7', 'V7', 'iii7', 'VI7'],
    drop:      ['Imaj7', 'bVIImaj7', 'IVmaj7', 'Imaj7'],
    breakdown: ['vi7', 'iii7', 'IVmaj7', 'ii7'],
    drop2:     ['Imaj7', 'vi7', 'IVmaj7', 'V7'],
    outro:     ['Imaj7', 'iii7', 'IVmaj7', 'Imaj7'],
  },

  'west-coast': {
    intro:     ['i7', 'bVIImaj7', 'bVImaj7', 'V7'],
    verse:     ['i7', 'iv7', 'bVII7', 'bVI7'],
    build:     ['ii7b5', 'V7', 'i7', 'bVII7'],
    drop:      ['i7', 'bVImaj7', 'bVIImaj7', 'V7'],
    breakdown: ['bVImaj7', 'bVIImaj7', 'i7', 'iv7'],
    drop2:     ['i7', 'bVII7', 'bVImaj7', 'V7'],
    outro:     ['i7', 'iv7', 'bVIImaj7', 'i7'],
  },

  'dirty-south': {
    intro:     ['i', 'bVII', 'bVI', 'bVII'],
    verse:     ['i', 'iv', 'V', 'i'],
    build:     ['i', 'bVI', 'bVII', 'V'],
    drop:      ['i', 'bVII', 'bVI', 'V'],
    breakdown: ['bVI', 'bVII', 'i', 'iv'],
    drop2:     ['i', 'iv', 'bVII', 'V7'],
    outro:     ['i', 'bVI', 'bVII', 'i'],
  },

  'phonk': {
    intro:     ['i', 'bVII', 'bVI', 'V7'],
    verse:     ['i', 'bVII', 'bVI', 'bVII'],
    build:     ['i', 'iv', 'bVI', 'V7'],
    drop:      ['i', 'bVI', 'bVII', 'V'],
    breakdown: ['bVI', 'i', 'bVII', 'iv'],
    drop2:     ['i', 'bVII', 'bVI', 'V7'],
    outro:     ['i', 'bVII', 'i', 'bVII'],
  },

  'afrobeat': {
    intro:     ['i', 'bVII', 'bVI', 'bVII'],
    verse:     ['i', 'bVII', 'bVI', 'iv'],
    build:     ['i', 'iv', 'bVII', 'V'],
    drop:      ['i', 'bIII', 'bVII', 'i'],
    breakdown: ['bVI', 'bVII', 'i', 'bVII'],
    drop2:     ['i', 'bVII', 'bIII', 'bVII'],
    outro:     ['i', 'bVII', 'iv', 'i'],
  },

  'jersey-club': {
    intro:     ['i', 'iv', 'i', 'V'],
    verse:     ['i', 'bVI', 'bVII', 'i'],
    build:     ['i', 'bVI', 'bVII', 'V'],
    drop:      ['i', 'bVII', 'bVI', 'bVII'],
    breakdown: ['bVI', 'bVII', 'i', 'iv'],
    drop2:     ['i', 'iv', 'bVII', 'V7'],
    outro:     ['i', 'iv', 'bVI', 'i'],
  },

  'bounce': {
    intro:     ['i', 'bIII', 'bVII', 'i'],
    verse:     ['i', 'bIII', 'bVII', 'iv'],
    build:     ['i', 'iv', 'bVI', 'bVII'],
    drop:      ['i', 'bVII', 'bVI', 'bVII'],
    breakdown: ['bVI', 'i', 'bIII', 'iv'],
    drop2:     ['i', 'bIII', 'bVII', 'V'],
    outro:     ['i', 'bVII', 'bIII', 'i'],
  },

  'reggaeton': {
    intro:     ['i', 'V', 'bVI', 'V'],
    verse:     ['i', 'V', 'bVI', 'bVII'],
    build:     ['i', 'iv', 'V', 'bVI'],
    drop:      ['i', 'bVI', 'V', 'bVII'],
    breakdown: ['bVI', 'V', 'i', 'iv'],
    drop2:     ['i', 'V', 'bVI', 'V7'],
    outro:     ['i', 'bVI', 'bVII', 'i'],
  },

  'hip-hop': {
    intro:     ['i', 'VI', 'III', 'VII'],
    verse:     ['i', 'iv', 'VI', 'III'],
    build:     ['i', 'v', 'VII', 'iv'],
    drop:      ['i', 'VII', 'VI', 'VII'],
    breakdown: ['VI', 'III', 'VII', 'i'],
    drop2:     ['i', 'VII', 'VI', 'v'],
    outro:     ['i', 'VI', 'III', 'IV'],
  },
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the hand-curated chord progression for a given sub-genre and section.
 * Lookup order: full matrix → generic per-section fallback → generic verse.
 * Never returns an empty array.
 */
export function getProgressionForSection(
  subGenre: string,
  sectionName: string,
): string[] {
  return (
    FULL_MATRIX[subGenre]?.[sectionName as ArrangementSectionName] ??
    GENERIC_FALLBACK[sectionName] ??
    GENERIC_FALLBACK['verse']
  )
}
