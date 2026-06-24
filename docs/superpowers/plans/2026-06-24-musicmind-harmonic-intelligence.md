# musicMind — Harmonic Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every section of an ArrangementPlan a unique, emotionally-appropriate chord progression instead of repeating the same one for all sections.

**Architecture:** New pure module `server/services/musicMind.ts` exposes `getProgressionForSection(subGenre, sectionName)`. `composer.ts` calls it per section in `buildDeterministicPlan()`, replacing the current flat `DEFAULT_PROGRESSIONS` repeat. No new routes, no schema changes, no client-side changes.

**Tech Stack:** TypeScript, Vitest (tests live in `server/services/__tests__/`)

## Global Constraints

- Pure functions only in `musicMind.ts` — no imports beyond `shared/arrangement.ts` types, no side effects, no network calls
- Roman numeral notation must match the existing convention: uppercase = major chord (I, II…), lowercase = minor (i, ii…); suffixes: maj7, m7, 7, sus4, sus2, dim, dim7, add9, 9, maj9, m9, 6; accidentals: bIII, bVI, bVII, #IV
- `DEFAULT_PROGRESSIONS` in `composer.ts` is RETIRED (deleted) — musicMind is the new source of truth
- No two adjacent sections in the returned plan may have the same `progression` array
- Fallback order: `fullMatrix[subGenre]?.[sectionName] ?? genericFallback[sectionName] ?? genericFallback['verse']`
- All existing 384 organism tests must remain green; `npm run check` must stay clean
- Test command: `npx vitest run server/services/__tests__/`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/services/musicMind.ts` | **Create** | Full progression matrix + generic fallback + `getProgressionForSection` |
| `server/services/__tests__/musicMind.test.ts` | **Create** | Unit tests for the matrix |
| `server/services/composer.ts` | **Modify** lines 43-59, 136-137, 159 | Call `getProgressionForSection` per section; delete `DEFAULT_PROGRESSIONS` |
| `server/services/__tests__/composer.test.ts` | **Modify** lines 22-24, 27-30 | Update two tests that expected all sections to share one progression |

---

## Task 1 — Create `musicMind.ts` with the full progression matrix

**Files:**
- Create: `server/services/musicMind.ts`
- Create: `server/services/__tests__/musicMind.test.ts`

**Interfaces:**
- Produces: `getProgressionForSection(subGenre: string, sectionName: string): string[]`

---

- [ ] **Step 1: Write the failing tests**

Create `server/services/__tests__/musicMind.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getProgressionForSection } from '../musicMind'

describe('getProgressionForSection', () => {
  it('returns a non-empty array for every known genre × section combo', () => {
    const genres = [
      'boom-bap','lo-fi','trap','drill','r&b','soul','chill',
      'west-coast','dirty-south','phonk','afrobeat','jersey-club',
      'bounce','reggaeton','hip-hop',
    ]
    const sections = ['intro','verse','build','drop','breakdown','drop2','outro']
    for (const genre of genres) {
      for (const section of sections) {
        const prog = getProgressionForSection(genre, section)
        expect(prog.length, `${genre}/${section} should have chords`).toBeGreaterThan(0)
      }
    }
  })

  it('no two adjacent sections share the same progression for any genre', () => {
    const genres = [
      'boom-bap','lo-fi','trap','drill','r&b','soul','chill',
      'west-coast','dirty-south','phonk','afrobeat','jersey-club',
      'bounce','reggaeton','hip-hop',
    ]
    const sections = ['intro','verse','build','drop','breakdown','drop2']
    for (const genre of genres) {
      for (let i = 0; i < sections.length - 1; i++) {
        const a = getProgressionForSection(genre, sections[i])
        const b = getProgressionForSection(genre, sections[i + 1])
        expect(
          JSON.stringify(a),
          `${genre}: ${sections[i]} and ${sections[i+1]} must differ`
        ).not.toBe(JSON.stringify(b))
      }
    }
  })

  it('falls back to a section-appropriate progression for unknown genre', () => {
    const intro = getProgressionForSection('breakcore', 'intro')
    const drop  = getProgressionForSection('breakcore', 'drop')
    expect(intro.length).toBeGreaterThan(0)
    expect(drop.length).toBeGreaterThan(0)
    // Fallback must still differ by section
    expect(JSON.stringify(intro)).not.toBe(JSON.stringify(drop))
  })

  it('absolute last resort returns a non-empty array for a completely unknown section', () => {
    const result = getProgressionForSection('breakcore', 'unknown-section-xyz')
    expect(result.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the tests — verify they FAIL**

```
npx vitest run server/services/__tests__/musicMind.test.ts
```

Expected: FAIL with `Cannot find module '../musicMind'`

- [ ] **Step 3: Create `server/services/musicMind.ts`**

```ts
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
```

- [ ] **Step 4: Run tests — verify they PASS**

```
npx vitest run server/services/__tests__/musicMind.test.ts
```

Expected: `3 passed (3)` — all assertions green.

- [ ] **Step 5: Commit**

```
git add server/services/musicMind.ts server/services/__tests__/musicMind.test.ts
git commit -m "feat(musicMind): per-section harmonic progression matrix (15 genres × 7 sections)"
```

---

## Task 2 — Wire musicMind into composer + update tests

**Files:**
- Modify: `server/services/composer.ts` (lines 43–59 delete `DEFAULT_PROGRESSIONS`; lines 134–137 update `buildDeterministicPlan`; line 159 update section map)
- Modify: `server/services/__tests__/composer.test.ts` (update two tests that expected a flat progression repeat)

**Interfaces:**
- Consumes: `getProgressionForSection` from Task 1

---

- [ ] **Step 1: Update the two existing composer tests that expect flat progressions**

In `server/services/__tests__/composer.test.ts`, replace lines 16–30:

```ts
  it('honours sub-genre + applies the matching BPM default', () => {
    const trap = composeDeterministic({ subGenre: 'trap' })
    expect(trap.subGenre).toBe('trap')
    expect(trap.bpm).toBe(140)
    expect(validateArrangementPlan(trap)).toBeNull()
    // Each section now has its own progression — intro ≠ verse ≠ build ≠ drop
    const progressions = trap.sections.map(s => JSON.stringify(s.progression))
    const unique = new Set(progressions)
    expect(unique.size).toBeGreaterThan(1)
    // Drop is the hardest section — verify it has content
    const drop = trap.sections.find(s => s.name === 'drop')
    expect(drop?.progression.length).toBeGreaterThan(0)
  })

  it('falls back to a section-appropriate progression for unknown sub-genres', () => {
    const weird = composeDeterministic({ subGenre: 'breakcore' })
    // Generic fallback is still section-varied — intro ≠ drop
    const intro = weird.sections.find(s => s.name === 'intro')?.progression
    const drop  = weird.sections.find(s => s.name === 'drop')?.progression
    expect(intro?.length).toBeGreaterThan(0)
    expect(JSON.stringify(intro)).not.toBe(JSON.stringify(drop))
  })
```

- [ ] **Step 2: Run the composer tests — verify these two now FAIL (because composer still uses flat progressions)**

```
npx vitest run server/services/__tests__/composer.test.ts
```

Expected: the two updated tests fail; the other 3 tests still pass.

- [ ] **Step 3: Update `composer.ts`**

Add the import at the top of the imports block (after the existing imports):

```ts
import { getProgressionForSection } from './musicMind'
```

Delete the entire `DEFAULT_PROGRESSIONS` block (lines 39–59):

```ts
// DELETE THIS ENTIRE BLOCK:
// Per-sub-genre default progression — Roman numerals against the plan's
// `key`. These are the same progressions the live Conductor uses today via
// its DEFAULT_PROGRESSIONS table, just expressed in numeral form so they
// transpose for free when the composer picks a non-C key.
const DEFAULT_PROGRESSIONS: Record<string, string[]> = {
  'boom-bap':    ['i',     'iv',    'V',     'i'],
  // ... (all 15 entries)
}
```

In `buildDeterministicPlan()`, replace lines 136–137:

```ts
// REMOVE:
  const progression = DEFAULT_PROGRESSIONS[defaults.subGenre]
                    ?? DEFAULT_PROGRESSIONS['hip-hop']
```

(The variable `progression` is no longer needed — delete it entirely.)

In the `sections` map (line 159), replace `progression: [...progression]` with a per-section call:

```ts
// BEFORE:
      progression: [...progression],

// AFTER:
      progression: getProgressionForSection(defaults.subGenre, slot.name),
```

- [ ] **Step 4: Run the full composer test suite — verify all pass**

```
npx vitest run server/services/__tests__/composer.test.ts
```

Expected: `5 passed (5)` — all tests green including the two updated ones.

- [ ] **Step 5: Run the full server test suite — verify nothing broken**

```
npx vitest run server/services/__tests__/
```

Expected: all tests pass.

- [ ] **Step 6: Type-check**

```
npm run check
```

Expected: no errors.

- [ ] **Step 7: Run the organism suite — verify nothing broken client-side**

```
npx vitest run client/src/organism
```

Expected: `384 passed (384)`

- [ ] **Step 8: Commit**

```
git add server/services/composer.ts server/services/__tests__/composer.test.ts
git commit -m "feat(composer): use musicMind per-section progressions — retire flat DEFAULT_PROGRESSIONS"
```

---

## Done

After Task 2 commits, every `ArrangementPlan` produced by `buildDeterministicPlan` (and the Ollama seed it generates) will have a unique, emotionally-appropriate chord progression per section. The Conductor, voice-leading, and generators consume `section.progression` without change — they get harmonic variety for free.
