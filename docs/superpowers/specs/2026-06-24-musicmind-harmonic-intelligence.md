# musicMind — Per-Section Harmonic Intelligence

**Status:** Approved for implementation  
**Branch:** organism/melody-voice-leading  
**Date:** 2026-06-24

---

## Problem

The Organism's `ArrangementPlan` currently gives every section of a beat the **same chord progression** — intro, verse, build, drop, and breakdown all play `["i", "VI", "III", "VII"]` (or whatever the genre default is). The Conductor, voice-leading, and generators all work correctly, but they're working on flat, undifferentiated harmonic input. The beat loops harmonically even when the section names change.

This is the single highest-leverage gap between "sounds like loops" and "sounds like a song."

---

## Solution

A new pure module, `server/services/musicMind.ts`, that exposes one function:

```ts
getProgressionForSection(subGenre: string, section: ArrangementSectionName): string[]
```

No network calls, no AI API, no state, no side effects. Just a data lookup with a graceful fallback. The data is a hand-curated matrix of 15 sub-genres × 7 section types = 105 progressions, each chosen for emotional fit with its section role.

`composer.ts` calls this once per section when building the deterministic plan, replacing the current flat `DEFAULT_PROGRESSIONS[subGenre]` repeat.

---

## Data Design

### Level 1 — Full genre matrix (primary)

Each genre gets six section-specific progressions chosen for emotional arc:

| Section | Emotional role |
|---|---|
| `intro` | Open, sparse, sets the mood — unresolved, inviting |
| `verse` | Grounded home — the beat's "normal" state |
| `build` | Rising tension — unresolved, forward-pushing |
| `drop` | Peak — hardest-hitting, most resolved or most triumphant |
| `breakdown` | Stripped, questioning — gives next drop weight |
| `drop2` | Triumphant return — slight variation on the first drop |
| `outro` | Wind-down — familiar but loosening |

Genres covered: `boom-bap`, `lo-fi`, `trap`, `drill`, `r&b`, `soul`, `chill`, `west-coast`, `dirty-south`, `phonk`, `afrobeat`, `jersey-club`, `bounce`, `reggaeton`, `hip-hop`

### Level 2 — Generic per-section fallback

When a genre is missing from the matrix (new genre added in future, typo, etc.), falls back to a **universal hip-hop per-section matrix** — still emotionally varied by section, just not genre-specific. Never falls back to a flat single progression.

```ts
intro:     ['i', 'VI', 'III', 'VII']       // open, familiar
verse:     ['i', 'iv', 'VI', 'III']         // grounded movement  
build:     ['i', 'v', 'VII', 'iv']          // rising tension
drop:      ['i', 'VII', 'VI', 'VII']        // heavy, resolved
breakdown: ['VI', 'III', 'VII', 'i']        // sparse, questioning
drop2:     ['i', 'VII', 'VI', 'v']          // triumphant variation
outro:     ['i', 'VI', 'III', 'IV']         // wind down
```

### Lookup order

```
fullMatrix[subGenre]?.[sectionName]
  ?? genericFallback[sectionName]
  ?? genericFallback['verse']           // absolute last resort
```

---

## Integration

### `server/services/musicMind.ts` (new file)

- Exports `getProgressionForSection(subGenre, sectionName): string[]`
- Pure function — no imports from outside `shared/`
- The full matrix and generic fallback live here as `const` objects

### `server/services/composer.ts` (one change)

In `buildDeterministicPlan()`, replace:

```ts
const progression = DEFAULT_PROGRESSIONS[defaults.subGenre] ?? DEFAULT_PROGRESSIONS['hip-hop']
// ...
progression: [...progression],   // same for every section
```

With:

```ts
progression: getProgressionForSection(defaults.subGenre, slot.name),  // per-section
```

`DEFAULT_PROGRESSIONS` is retired — musicMind is the new source of truth. The Ollama path already receives the deterministic plan as a seed to refine, so it benefits automatically.

### No other changes needed

The Conductor, Orchestrator, voice-leading system, and all 5 generators already read `section.progression` from the plan. They get harmonically varied sections for free — no wiring changes required.

---

## What does NOT change

- `ArrangementSection` schema — no new fields
- The Conductor or any generator — they already consume `progression`
- The Ollama composer path — it refines the deterministic seed, which now has varied progressions
- Any client-side code

---

## Testing

- Unit test `getProgressionForSection` for every genre × every section name — verify no two adjacent sections return the same progression for any genre
- Verify the generic fallback is never a flat repeat (all 7 fallback entries are distinct)
- `buildDeterministicPlan()` test: sections in the returned plan must each have a unique `progression` array (no identical repeats)
- `npm run check` clean; existing 384 organism tests still pass

---

## Future extension

When budget allows, Claude (Anthropic API) can be dropped in as an enrichment layer on top of this curated base — it would receive the curated plan as a seed and add emotional color, variation, and surprise. The interface (`getProgressionForSection`) doesn't change; the data source does. This is a one-file swap.

---

## Out of scope

- Changing any generator, the Conductor, or the voice-leading system
- Adding new schema fields to `ArrangementSection`
- Any real-time (per-bar) harmonic decisions
- Grok, OpenAI, Gemini, or any other API
