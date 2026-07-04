# Performer Expression Rollout (Pro-Instruments Slice 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the duplicate "real soloist" performance logic (velocity arc, breath/rests, phrase-character development) currently implemented separately for bowed strings (`applyStringPerformance()` in `MelodyGenerator.ts`) and guitar (`guitarPerformance.ts`) into one shared, family-configurable module, then roll that expression out to every remaining lead family (wind, brass, keyboard, plucked, synth) so a soloed lead in any of those families plays like a real player instead of a flat generator line.

**Architecture:** A new pure module, `client/src/organism/generators/melody/performerExpression.ts`, holds three stateless functions — `shapePerformanceDynamics()`, `applyBreathAndRests()`, `developPhraseCharacter()` — each driven by a small per-family `PerformerExpressionConfig` object plus (where randomness is needed) an injected `rng: () => number` so the functions stay pure and testable without `Tone` or class state. `MelodyGenerator.ts`'s `applyStringPerformance()` and `guitarPerformance.ts`'s `shapeGuitarDynamics()`/`developGuitarPhrase()` become thin callers into this module with their existing tuned values expressed as config, not separate implementations. Family detection moves from regex-on-voice-name (`isBowedString()`/`isGuitar()`) to the structured `currentPerformer.family` field. `shapeVibrato()`'s gate generalizes to any "sustained pitch" family (bowed/wind/brass) with a per-family depth cap. Guitar's per-note ornament picker (`planGuitarArticulations()`) is untouched — it's guitar-specific idiom, not shared expression.

**Tech Stack:** TypeScript, Vitest (unit tests), Tone.js (untouched by this plan — no audio-chain changes).

## Global Constraints

- No audio-chain changes (no new nodes, no reverb/EQ) — this is note/velocity/timing logic only, per the spec's M3 boundary.
- Guitar's existing tested behavior (`guitarPerformance.test.ts`) must keep passing — its assertions are shape-based (peak position, relative loudness, monotonic bounds), not exact-float, so the underlying arc formula may be re-expressed as long as those shape properties hold.
- `planGuitarArticulations()` and `noteToMidi()` in `guitarPerformance.ts` are NOT touched — guitar-specific ornamentation stays guitar-specific.
- Full test suite (currently 667 passing) and `npx tsc --noEmit -p .` must stay clean after every task.
- Per-family config values, exactly as decided in the spec (`docs/superpowers/specs/2026-06-06-pro-instruments-design.md`, Slice 4 table):

  | Family | Peak pos | Rest density multiplier | Octave recast | Vibrato | Vibrato depth cap |
  |---|---|---|---|---|---|
  | `bowed` | 0.66 | 1.0 | yes | yes | 0.35 |
  | `wind` | 0.66 | 1.0 | yes | yes | 0.35 |
  | `brass` | 0.72 | 0.6 | yes | yes | 0.22 |
  | `keyboard` | 0.60 | 1.4 | no | no | n/a |
  | `plucked` | 0.66 | 1.0 | yes | no | n/a |
  | `synth` | 0.66 | 1.0 | yes | no | n/a |

---

### Task 1: `performerExpression.ts` skeleton — types, config table, family helpers

**Files:**
- Create: `client/src/organism/generators/melody/performerExpression.ts`
- Test: `client/src/organism/generators/melody/__tests__/performerExpression.test.ts`

**Interfaces:**
- Produces: `export type PerformerFamily = 'bowed' | 'wind' | 'brass' | 'keyboard' | 'plucked' | 'synth'`, `export interface PerformerExpressionConfig { peakPosition: number; restDensityMultiplier: number; octaveRecastEnabled: boolean; vibratoDepthCap: number | null }`, `export function getPerformerExpressionConfig(family: PerformerFamily | string | undefined): PerformerExpressionConfig`, `export function isSustainedPitch(family: PerformerFamily | string | undefined): boolean`, `export function sixteenthPosOf(time: string): number`.

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/organism/generators/melody/__tests__/performerExpression.test.ts
import { describe, expect, it } from 'vitest'
import { getPerformerExpressionConfig, isSustainedPitch, sixteenthPosOf } from '../performerExpression'

describe('getPerformerExpressionConfig', () => {
  it('returns the tuned config for each known family', () => {
    expect(getPerformerExpressionConfig('bowed')).toEqual({
      peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true, vibratoDepthCap: 0.35,
    })
    expect(getPerformerExpressionConfig('wind')).toEqual({
      peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true, vibratoDepthCap: 0.35,
    })
    expect(getPerformerExpressionConfig('brass')).toEqual({
      peakPosition: 0.72, restDensityMultiplier: 0.6, octaveRecastEnabled: true, vibratoDepthCap: 0.22,
    })
    expect(getPerformerExpressionConfig('keyboard')).toEqual({
      peakPosition: 0.60, restDensityMultiplier: 1.4, octaveRecastEnabled: false, vibratoDepthCap: null,
    })
    expect(getPerformerExpressionConfig('plucked')).toEqual({
      peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true, vibratoDepthCap: null,
    })
    expect(getPerformerExpressionConfig('synth')).toEqual({
      peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true, vibratoDepthCap: null,
    })
  })

  it('falls back to the synth (neutral) config for an unknown or undefined family', () => {
    const synthConfig = getPerformerExpressionConfig('synth')
    expect(getPerformerExpressionConfig('made-up-family')).toEqual(synthConfig)
    expect(getPerformerExpressionConfig(undefined)).toEqual(synthConfig)
  })
})

describe('isSustainedPitch', () => {
  it('is true for bowed, wind, and brass', () => {
    expect(isSustainedPitch('bowed')).toBe(true)
    expect(isSustainedPitch('wind')).toBe(true)
    expect(isSustainedPitch('brass')).toBe(true)
  })

  it('is false for keyboard, plucked, synth, unknown, and undefined', () => {
    expect(isSustainedPitch('keyboard')).toBe(false)
    expect(isSustainedPitch('plucked')).toBe(false)
    expect(isSustainedPitch('synth')).toBe(false)
    expect(isSustainedPitch('made-up-family')).toBe(false)
    expect(isSustainedPitch(undefined)).toBe(false)
  })
})

describe('sixteenthPosOf', () => {
  it('resolves a bar:beat:sub time string to a 0..15 sixteenth-grid position', () => {
    expect(sixteenthPosOf('0:0:0')).toBe(0)
    expect(sixteenthPosOf('0:1:0')).toBe(4)
    expect(sixteenthPosOf('0:3:3')).toBe(15)
    expect(sixteenthPosOf('2:2:1')).toBe(9) // bars ignored — position is within-bar
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/performerExpression.test.ts`
Expected: FAIL — `Cannot find module '../performerExpression'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// client/src/organism/generators/melody/performerExpression.ts
/**
 * Pro-instruments spec Slice 4 — shared "real soloist" performance layer.
 *
 * Consolidates what used to be two separate implementations (bowed strings'
 * applyStringPerformance() in MelodyGenerator.ts, and guitar's dynamics/
 * development functions in guitarPerformance.ts) into one family-configurable
 * module. Every lead family gets the same three layers — velocity arc, breath/
 * rests, phrase-character development — tuned per family instead of per
 * hardcoded instrument. Guitar's per-note ornament picker (bends/hammer-ons in
 * guitarPerformance.ts) stays separate — that's guitar-specific idiom, not
 * shared expression. See docs/superpowers/specs/2026-06-06-pro-instruments-design.md.
 */

export type PerformerFamily = 'bowed' | 'wind' | 'brass' | 'keyboard' | 'plucked' | 'synth'

export interface PerformerExpressionConfig {
  /** 0..1 — phrase position of the dynamic/energy peak. */
  peakPosition: number
  /** Multiplies the base rest-drop probability; >1 = more rests, <1 = fewer. */
  restDensityMultiplier: number
  /** Whether phrase-character development recasts the register by an octave. */
  octaveRecastEnabled: boolean
  /** Max vibrato depth (0..1), or null if this family doesn't vibrato. */
  vibratoDepthCap: number | null
}

const PERFORMER_EXPRESSION_CONFIG: Record<PerformerFamily, PerformerExpressionConfig> = {
  bowed:    { peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true,  vibratoDepthCap: 0.35 },
  wind:     { peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true,  vibratoDepthCap: 0.35 },
  brass:    { peakPosition: 0.72, restDensityMultiplier: 0.6, octaveRecastEnabled: true,  vibratoDepthCap: 0.22 },
  keyboard: { peakPosition: 0.60, restDensityMultiplier: 1.4, octaveRecastEnabled: false, vibratoDepthCap: null },
  plucked:  { peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true,  vibratoDepthCap: null },
  synth:    { peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true,  vibratoDepthCap: null },
}

const SUSTAINED_FAMILIES = new Set<PerformerFamily>(['bowed', 'wind', 'brass'])

/** Neutral fallback for an unknown/undefined family — same shape as `synth`. */
const DEFAULT_CONFIG = PERFORMER_EXPRESSION_CONFIG.synth

export function getPerformerExpressionConfig(family: PerformerFamily | string | undefined): PerformerExpressionConfig {
  if (family && family in PERFORMER_EXPRESSION_CONFIG) {
    return PERFORMER_EXPRESSION_CONFIG[family as PerformerFamily]
  }
  return DEFAULT_CONFIG
}

/** True for families whose real instrument sustains/bows/blows a held pitch (can realistically vibrato). */
export function isSustainedPitch(family: PerformerFamily | string | undefined): boolean {
  return family !== undefined && SUSTAINED_FAMILIES.has(family as PerformerFamily)
}

/** sixteenth-grid position (0..15) from a "bar:beat:sub" Tone time string. */
export function sixteenthPosOf(time: string): number {
  const parts = String(time).split(':')
  const beat = parseFloat(parts[1] ?? '0')
  const sub = parseFloat(parts[2] ?? '0')
  return Math.floor(beat * 4 + sub) % 16
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/performerExpression.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/melody/performerExpression.ts client/src/organism/generators/melody/__tests__/performerExpression.test.ts
git commit -m "feat(organism): add performerExpression config table (pro-instruments slice 4)"
```

---

### Task 2: `shapePerformanceDynamics()` — the shared velocity arc

**Files:**
- Modify: `client/src/organism/generators/melody/performerExpression.ts`
- Test: `client/src/organism/generators/melody/__tests__/performerExpression.test.ts`

**Interfaces:**
- Consumes: `sixteenthPosOf()` from Task 1.
- Produces: `export interface DynamicsOptions { peakPosition: number; edgeFloor?: number; downbeatAccent?: number }`, `export function shapePerformanceDynamics(notes: ScheduledNote[], options: DynamicsOptions): ScheduledNote[]` (non-destructive — returns a new array, same length/pitch/timing).

- [ ] **Step 1: Write the failing test**

```typescript
// append to client/src/organism/generators/melody/__tests__/performerExpression.test.ts
import { shapePerformanceDynamics } from '../performerExpression'
import type { ScheduledNote } from '../../types'

function flatPhrase(n = 8, vel = 0.7): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  for (let i = 0; i < n; i++) {
    const sixteenth = i * 2
    const beat = Math.floor(sixteenth / 4)
    const sub = sixteenth % 4
    notes.push({ pitch: 'C4', duration: '8n', velocity: vel, time: `0:${beat}:${sub}` })
  }
  return notes
}

describe('shapePerformanceDynamics', () => {
  it('is non-destructive: same count, pitches, and timing', () => {
    const input = flatPhrase()
    const out = shapePerformanceDynamics(input, { peakPosition: 0.66 })
    expect(out).toHaveLength(input.length)
    expect(out.map(n => n.pitch)).toEqual(input.map(n => n.pitch))
    expect(out.map(n => n.time)).toEqual(input.map(n => n.time))
  })

  it('shapes an arch — the peak sits past the middle, edges are softer', () => {
    const out = shapePerformanceDynamics(flatPhrase(9, 0.7), { peakPosition: 0.66 })
    const vels = out.map(n => n.velocity)
    const peakIdx = vels.indexOf(Math.max(...vels))
    expect(peakIdx).toBeGreaterThan(2)
    expect(peakIdx).toBeLessThan(vels.length - 1)
    expect(vels[0]).toBeLessThan(vels[peakIdx])
    expect(vels[vels.length - 1]).toBeLessThan(vels[peakIdx])
  })

  it('keeps velocities within [0,1] even with hot input + accents', () => {
    const out = shapePerformanceDynamics(flatPhrase(8, 0.98), { peakPosition: 0.66, downbeatAccent: 0.3 })
    for (const n of out) {
      expect(n.velocity).toBeGreaterThanOrEqual(0)
      expect(n.velocity).toBeLessThanOrEqual(1)
    }
  })

  it('accents downbeats when downbeatAccent is set', () => {
    const notes: ScheduledNote[] = [
      { pitch: 'C4', duration: '16n', velocity: 0.6, time: '0:0:0' }, // downbeat
      { pitch: 'C4', duration: '16n', velocity: 0.6, time: '0:0:1' }, // off-beat
    ]
    const out = shapePerformanceDynamics(notes, { peakPosition: 0.66, downbeatAccent: 0.12 })
    expect(out[0].velocity).toBeGreaterThan(out[1].velocity)
  })

  it('does not accent when downbeatAccent is omitted (default 0)', () => {
    const notes: ScheduledNote[] = [
      { pitch: 'C4', duration: '16n', velocity: 0.6, time: '0:0:0' },
      { pitch: 'C4', duration: '16n', velocity: 0.6, time: '0:0:1' },
    ]
    const out = shapePerformanceDynamics(notes, { peakPosition: 0.66 })
    expect(out[0].velocity).toBe(out[1].velocity)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/performerExpression.test.ts`
Expected: FAIL — `shapePerformanceDynamics is not a function`

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to client/src/organism/generators/melody/performerExpression.ts
import type { ScheduledNote } from '../types'

export interface DynamicsOptions {
  /** 0..1 — phrase position of the dynamic peak. */
  peakPosition: number
  /** 0..1 — velocity multiplier floor at the phrase edges, relative to the peak. Default 0.78. */
  edgeFloor?: number
  /** Velocity boost added to notes landing on a 16th-grid downbeat. Default 0 (no accent). */
  downbeatAccent?: number
}

/**
 * Shapes a flat phrase into an arc: rises toward `peakPosition`, eases back
 * toward the cadence. Non-destructive — same notes, pitches, timing, only
 * velocity changes. Optional `downbeatAccent` adds a picking-style accent on
 * 16th-grid downbeats (used by plucked families; 0 for bowed/wind/brass/keys).
 */
export function shapePerformanceDynamics(notes: ScheduledNote[], options: DynamicsOptions): ScheduledNote[] {
  const { peakPosition: peak, edgeFloor = 0.78, downbeatAccent = 0 } = options
  const n = notes.length
  if (n === 0) return notes

  return notes.map((note, i) => {
    const pos = n <= 1 ? peak : i / (n - 1)
    const g = pos <= peak
      ? edgeFloor + (1 - edgeFloor) * (pos / Math.max(1e-6, peak))
      : 1.0 - (1 - edgeFloor) * ((pos - peak) / Math.max(1e-6, 1 - peak))
    const isDownbeat = sixteenthPosOf(note.time) % 4 === 0
    const accent = downbeatAccent > 0 && isDownbeat ? downbeatAccent : 0
    return { ...note, velocity: Math.max(0, Math.min(1, note.velocity * g + accent)) }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/performerExpression.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/melody/performerExpression.ts client/src/organism/generators/melody/__tests__/performerExpression.test.ts
git commit -m "feat(organism): shared shapePerformanceDynamics velocity arc"
```

---

### Task 3: `applyBreathAndRests()` — the shared rest-weighting layer

**Files:**
- Modify: `client/src/organism/generators/melody/performerExpression.ts`
- Test: `client/src/organism/generators/melody/__tests__/performerExpression.test.ts`

**Interfaces:**
- Consumes: `ScheduledNote` from `../types`.
- Produces: `export interface BreathOptions { dropMod: number; rng: () => number }`, `export function applyBreathAndRests(notes: ScheduledNote[], options: BreathOptions): ScheduledNote[]`.

- [ ] **Step 1: Write the failing test**

```typescript
// append to client/src/organism/generators/melody/__tests__/performerExpression.test.ts
import { applyBreathAndRests } from '../performerExpression'

describe('applyBreathAndRests', () => {
  // 10 notes, interior ones (index 1..8) deliberately "weak" (velocity < 0.55)
  // so they're eligible to be dropped; first/last are loud so they're protected.
  function breathablePhrase(n = 10): ScheduledNote[] {
    const notes: ScheduledNote[] = []
    for (let i = 0; i < n; i++) {
      const weak = i > 0 && i < n - 1
      notes.push({ pitch: 'C4', duration: '8n', velocity: weak ? 0.3 : 0.9, time: `0:${i}:0` })
    }
    return notes
  }

  it('never drops the first or last note', () => {
    const alwaysDrop = () => 0 // rng always below any probability threshold
    const out = applyBreathAndRests(breathablePhrase(), { dropMod: 3, rng: alwaysDrop })
    const input = breathablePhrase()
    expect(out[0]).toEqual(input[0])
    expect(out[out.length - 1]).toEqual(input[input.length - 1])
  })

  it('never drops loud (non-weak) interior notes', () => {
    const notes: ScheduledNote[] = [
      { pitch: 'C4', duration: '8n', velocity: 0.9, time: '0:0:0' },
      { pitch: 'C4', duration: '8n', velocity: 0.9, time: '0:1:0' }, // loud interior — protected
      { pitch: 'C4', duration: '8n', velocity: 0.9, time: '0:2:0' },
    ]
    const out = applyBreathAndRests(notes, { dropMod: 3, rng: () => 0 })
    expect(out).toHaveLength(3)
  })

  it('drops weak interior notes when rng rolls under the threshold', () => {
    const out = applyBreathAndRests(breathablePhrase(), { dropMod: 3, rng: () => 0 })
    expect(out.length).toBeLessThan(10)
  })

  it('drops nothing when rng always rolls above any threshold', () => {
    const out = applyBreathAndRests(breathablePhrase(), { dropMod: 3, rng: () => 0.999 })
    expect(out).toHaveLength(10)
  })

  it('never thins below 2 notes remaining', () => {
    const tiny: ScheduledNote[] = [
      { pitch: 'C4', duration: '8n', velocity: 0.9, time: '0:0:0' },
      { pitch: 'C4', duration: '8n', velocity: 0.3, time: '0:1:0' },
      { pitch: 'C4', duration: '8n', velocity: 0.9, time: '0:2:0' },
    ]
    const out = applyBreathAndRests(tiny, { dropMod: 3, rng: () => 0 })
    expect(out.length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/performerExpression.test.ts`
Expected: FAIL — `applyBreathAndRests is not a function`

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to client/src/organism/generators/melody/performerExpression.ts
export interface BreathOptions {
  /** Smaller = more rests. Typically 3 (airy), 4 (default), or 6 (driving/dense). */
  dropMod: number
  /** Injected PRNG (0..1) so this stays pure/deterministic under test. */
  rng: () => number
}

/**
 * BREATH — rests weak interior notes (never the first/last) so a phrase opens
 * space and rings instead of filling every slot. Drop probability rises toward
 * the phrase end (a real player breathes more as a phrase resolves).
 */
export function applyBreathAndRests(notes: ScheduledNote[], options: BreathOptions): ScheduledNote[] {
  const { dropMod, rng } = options
  const n = notes.length
  if (n < 3) return notes

  const kept: ScheduledNote[] = []
  for (let i = 0; i < n; i++) {
    const interior = i > 0 && i < n - 1
    const weak = notes[i].velocity < 0.55
    const pos = i / (n - 1)
    const baseProb = 1 / dropMod
    const scaledProb = baseProb * (0.2 + 1.6 * pos)
    const restHere = interior && weak && (rng() < scaledProb)
    if (!restHere) kept.push(notes[i])
  }
  return (kept.length >= 2 && kept.length < n) ? kept : notes
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/performerExpression.test.ts`
Expected: PASS (19 tests)

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/melody/performerExpression.ts client/src/organism/generators/melody/__tests__/performerExpression.test.ts
git commit -m "feat(organism): shared applyBreathAndRests phrase-breathing layer"
```

---

### Task 4: `developPhraseCharacter()` — the shared statement/answer/variation/climb cycle

**Files:**
- Modify: `client/src/organism/generators/melody/performerExpression.ts`
- Test: `client/src/organism/generators/melody/__tests__/performerExpression.test.ts`

**Interfaces:**
- Consumes: `ScheduledNote` from `../types`.
- Produces: `export type PhraseCharacter = 0 | 1 | 2 | 3`, `export function phraseCharacterOf(phraseCounter: number): PhraseCharacter`, `export function developPhraseCharacter(notes: ScheduledNote[], character: PhraseCharacter, octaveRecastEnabled: boolean): ScheduledNote[]` (returns a new array with pitches transposed per character; no-ops the transpose when `octaveRecastEnabled` is false).

- [ ] **Step 1: Write the failing test**

```typescript
// append to client/src/organism/generators/melody/__tests__/performerExpression.test.ts
import { phraseCharacterOf, developPhraseCharacter } from '../performerExpression'
import * as Tone from 'tone'

describe('phraseCharacterOf', () => {
  it('cycles 0 (statement) -> 1 (answer) -> 2 (variation) -> 3 (climb) -> 0 ...', () => {
    expect(phraseCharacterOf(0)).toBe(0)
    expect(phraseCharacterOf(1)).toBe(1)
    expect(phraseCharacterOf(2)).toBe(2)
    expect(phraseCharacterOf(3)).toBe(3)
    expect(phraseCharacterOf(4)).toBe(0)
    expect(phraseCharacterOf(9)).toBe(1)
  })
})

describe('developPhraseCharacter', () => {
  const notes = (): ScheduledNote[] => [
    { pitch: 'C4', duration: '8n', velocity: 0.7, time: '0:0:0' },
    { pitch: 'E4', duration: '8n', velocity: 0.7, time: '0:1:0' },
  ]

  it('character 0 (statement) leaves pitches unchanged', () => {
    const out = developPhraseCharacter(notes(), 0, true)
    expect(out.map(n => n.pitch)).toEqual(['C4', 'E4'])
  })

  it('character 1 (answer) transposes up an octave when recast is enabled', () => {
    const out = developPhraseCharacter(notes(), 1, true)
    expect(out.map(n => n.pitch)).toEqual(['C5', 'E5'])
  })

  it('character 2 (variation) transposes down an octave when recast is enabled', () => {
    const out = developPhraseCharacter(notes(), 2, true)
    expect(out.map(n => n.pitch)).toEqual(['C3', 'E3'])
  })

  it('character 3 (climb) leaves pitches unchanged (denser/driving is a rest-density concern, not register)', () => {
    const out = developPhraseCharacter(notes(), 3, true)
    expect(out.map(n => n.pitch)).toEqual(['C4', 'E4'])
  })

  it('never recasts register when octaveRecastEnabled is false (e.g. keyboard)', () => {
    const out = developPhraseCharacter(notes(), 1, false)
    expect(out.map(n => n.pitch)).toEqual(['C4', 'E4'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/performerExpression.test.ts`
Expected: FAIL — `phraseCharacterOf is not a function`

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to client/src/organism/generators/melody/performerExpression.ts
import * as Tone from 'tone'

export type PhraseCharacter = 0 | 1 | 2 | 3

/**
 * DEVELOPMENT — a real soloist states an idea, then answers it / varies it /
 * builds on it; they don't replay it. Each phrase commits to a different
 * character so a recurring motif is genuinely re-cast, not looped:
 *   0 statement — as written
 *   1 answer    — leaps an octave up (a question answered)
 *   2 variation — drops an octave (darker restatement)
 *   3 climb     — as written register; density/drive comes from BreathOptions.dropMod
 */
export function phraseCharacterOf(phraseCounter: number): PhraseCharacter {
  return (phraseCounter % 4) as PhraseCharacter
}

/** Recasts a phrase's register per `character`. No-ops when `octaveRecastEnabled` is false. */
export function developPhraseCharacter(
  notes: ScheduledNote[],
  character: PhraseCharacter,
  octaveRecastEnabled: boolean,
): ScheduledNote[] {
  if (!octaveRecastEnabled) return notes
  const octaveShift = character === 1 ? 12 : character === 2 ? -12 : 0
  if (octaveShift === 0) return notes

  return notes.map((note) => {
    try {
      return { ...note, pitch: Tone.Frequency(note.pitch).transpose(octaveShift).toNote() }
    } catch {
      return note // leave the pitch as-is if it can't be parsed
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/performerExpression.test.ts`
Expected: PASS (25 tests)

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/melody/performerExpression.ts client/src/organism/generators/melody/__tests__/performerExpression.test.ts
git commit -m "feat(organism): shared developPhraseCharacter statement/answer/variation/climb cycle"
```

---

### Task 5: Wire `MelodyGenerator.ts` to the shared module + family-based detection + vibrato generalization

**Files:**
- Modify: `client/src/organism/generators/MelodyGenerator.ts:969-976` (isBowedString/isGuitar), `:986-1005` (shapeVibrato), `:1007-1078` (applyStringPerformance), `:825-848` (generatePhrase call sites)

**Interfaces:**
- Consumes: `getPerformerExpressionConfig`, `isSustainedPitch`, `shapePerformanceDynamics`, `applyBreathAndRests`, `phraseCharacterOf`, `developPhraseCharacter` from `./melody/performerExpression`.
- Produces: `private currentFamily(): string | undefined` (replaces `isBowedString()`/`isGuitar()` call sites where family-general, guitar-specific string matching for `isGuitar()` is kept separately since ornamentation stays guitar-only).

- [ ] **Step 1: Add the import and replace `isBowedString()` with a family accessor**

In `client/src/organism/generators/MelodyGenerator.ts`, add to the existing imports near the top (alongside the other `./melody/*` imports):

```typescript
import {
  getPerformerExpressionConfig,
  isSustainedPitch,
  shapePerformanceDynamics,
  applyBreathAndRests,
  phraseCharacterOf,
  developPhraseCharacter,
} from './melody/performerExpression'
```

Replace:
```typescript
  /** True when the current lead voice is a bowed string (violin / cello / viola). */
  private isBowedString(): boolean {
    return /violin|cello|viola|string/i.test(this.currentVoiceName)
  }

  /** True when the current lead voice is a guitar (nylon / clean / distortion). */
  private isGuitar(): boolean {
    return /guitar|nylon/i.test(this.currentVoiceName)
  }
```
with:
```typescript
  /** True when the current lead voice is a bowed string (violin / cello / viola). */
  private isBowedString(): boolean {
    return this.currentPerformer?.family === 'bowed'
  }

  /** True when the current lead voice is a guitar (nylon / clean / distortion). Guitar
   *  ornamentation (planGuitarArticulations) is idiom-specific, not shared expression,
   *  so it stays keyed on the actual voice name rather than the broader 'plucked' family
   *  (which also covers harp/pizzicato — those should NOT get guitar bends/hammer-ons). */
  private isGuitar(): boolean {
    return /guitar|nylon/i.test(this.currentVoiceName)
  }
```

- [ ] **Step 2: Generalize `shapeVibrato()`'s gate and depth cap**

Replace:
```typescript
  private shapeVibrato(dur: Tone.Unit.Time, time: number): void {
    const depth = this.vibrato.depth
    let durSec = 0.25
    try { durSec = Tone.Time(dur).toSeconds() } catch { /* keep default */ }

    try {
      depth.cancelScheduledValues(time)
      if (durSec < 0.22) {
        // Fast passing note — straight tone, no vibrato.
        depth.setValueAtTime(0.012, time)
      } else {
        // Sustained note — straight attack, then vibrato blooms in and widens
        // with length (capped so it stays musical, not seasick).
        const target = Math.min(0.35, 0.16 + durSec * 0.12)
        const bloomAt = time + Math.min(0.35, durSec * 0.45)
        depth.setValueAtTime(0.02, time)
        depth.linearRampToValueAtTime(target, bloomAt)
      }
    } catch { /* signal busy / negative time — skip this note's vibrato shaping */ }
  }
```
with:
```typescript
  private shapeVibrato(dur: Tone.Unit.Time, time: number): void {
    const depthCap = getPerformerExpressionConfig(this.currentPerformer?.family).vibratoDepthCap
    if (depthCap === null) return // this family doesn't vibrato (plucked/keyboard/synth)

    const depth = this.vibrato.depth
    let durSec = 0.25
    try { durSec = Tone.Time(dur).toSeconds() } catch { /* keep default */ }

    try {
      depth.cancelScheduledValues(time)
      if (durSec < 0.22) {
        // Fast passing note — straight tone, no vibrato.
        depth.setValueAtTime(0.012, time)
      } else {
        // Sustained note — straight attack, then vibrato blooms in and widens
        // with length (capped per-family so it stays musical, not seasick).
        const target = Math.min(depthCap, 0.16 + durSec * 0.12)
        const bloomAt = time + Math.min(0.35, durSec * 0.45)
        depth.setValueAtTime(0.02, time)
        depth.linearRampToValueAtTime(target, bloomAt)
      }
    } catch { /* signal busy / negative time — skip this note's vibrato shaping */ }
  }
```

- [ ] **Step 3: Replace the `shapeVibrato` call gate in the `Tone.Part` callback**

Find this line inside the `Tone.Part` callback (around line 899):
```typescript
      if (this.isBowedString()) this.shapeVibrato(event.dur, Math.max(0, time))
```
Replace with:
```typescript
      if (isSustainedPitch(this.currentPerformer?.family)) this.shapeVibrato(event.dur, Math.max(0, time))
```
(`shapeVibrato` itself now also no-ops via its own `depthCap === null` check — this call-site change avoids computing `Tone.Time(dur)` at all for families that can never vibrato.)

- [ ] **Step 4: Rewrite `applyStringPerformance()` to call the shared module**

Replace the full body of `applyStringPerformance()` (currently lines ~1024-1078) with:
```typescript
  /**
   * Pro-instruments spec M2.5/Slice 4 — the shared lead PERFORMER pass. Runs
   * for any family via performerExpression.ts; per-family tuning comes from
   * getPerformerExpressionConfig(). Mutates in place is NOT done — this
   * reassigns the array reference the caller passed by returning the shaped
   * result, mirroring guitarPerformance's non-destructive contract.
   */
  private applyPerformerExpression(notes: ScheduledNote[]): ScheduledNote[] {
    const n = notes.length
    if (n < 3) return notes
    this.phraseCounter++

    const family = this.currentPerformer?.family
    const config = getPerformerExpressionConfig(family)
    const character = phraseCharacterOf(this.phraseCounter)

    // DEVELOPMENT — recast register per character (no-op if this family doesn't recast).
    let shaped = developPhraseCharacter(notes, character, config.octaveRecastEnabled)

    // Velocity ARC — crescendo toward a drifting peak, ease at the cadence. The peak
    // drifts slightly per phrase (same "not identical every time" feel as before).
    const peak = Math.min(0.85, config.peakPosition + 0.12 * ((this.phraseCounter % 3) / 2) - 0.08)
    shaped = shapePerformanceDynamics(shaped, { peakPosition: peak })

    // BREATH — rest weak interior notes (never first/last). Density varies by
    // character (answer is airy, climb is driving) and by family (config.restDensityMultiplier).
    const dropMod = (character === 1 ? 3 : character === 3 ? 6 : 4) * config.restDensityMultiplier
    this.seedRng(this.sessionSeed + this.phraseCounter)
    shaped = applyBreathAndRests(shaped, { dropMod, rng: () => this.nextRandom() })

    return shaped
  }
```

- [ ] **Step 5: Update the `generatePhrase()` call sites**

Replace:
```typescript
    // Pro-instruments M2.5 slice 1: a real string player breathes + shapes
    // dynamics. Gated to bowed strings (violin/cello) so other leads are untouched.
    if (this.isBowedString()) this.applyStringPerformance(notes)

    // Pro-instruments M2.6 — the Guitar Player. Gated to guitar voices so other
    // leads are untouched. Order matters: develop the LINE first (what to play),
    // then shape dynamics (how loud) — articulations (how to play) come below.
    if (this.isGuitar()) {
      // Slice 3: call-and-answer development — odd phrases answer the statement
      // with more space so consecutive phrases don't loop identically.
      notes = developGuitarPhrase(notes, this.guitarPhraseCounter++)
      // Slice 1: arch swell + downbeat picking accents (non-destructive velocity).
      notes = shapeGuitarDynamics(notes)
    }
```
with:
```typescript
    // Pro-instruments Slice 4: EVERY lead family gets the shared breathe/arc/
    // develop performance pass, tuned per family via performerExpression.ts.
    // Guitar additionally gets its own idiom-specific line development below
    // (call-and-answer thinning + picking accents) before the shared pass —
    // order matters: develop the LINE first (what to play), THEN shape the
    // shared dynamics/breath (how loud/where to rest), THEN articulations
    // (how to play) below.
    if (this.isGuitar()) {
      notes = developGuitarPhrase(notes, this.guitarPhraseCounter++)
    }
    notes = this.applyPerformerExpression(notes)
```

- [ ] **Step 6: Run the full MelodyGenerator + performerExpression test suites**

Run: `npx vitest run client/src/organism/generators/__tests__/MelodyGenerator.test.ts client/src/organism/generators/melody --reporter=dot`
Expected: All pass, no failures.

Run: `npx tsc --noEmit -p .`
Expected: No errors. (This will fail until `shapeGuitarDynamics` is no longer called at this site AND `guitarPerformance.ts`'s exports still exist — Task 6 handles the `guitarPerformance.ts` side. If `tsc` complains about an unused import of `shapeGuitarDynamics` in `MelodyGenerator.ts`, remove that import now — it's no longer called from this file after this step.)

- [ ] **Step 7: Commit**

```bash
git add client/src/organism/generators/MelodyGenerator.ts
git commit -m "refactor(organism): wire MelodyGenerator to shared performerExpression module"
```

---

### Task 6: Simplify `guitarPerformance.ts` to delegate + fix `motifSelection` family naming drift

**Files:**
- Modify: `client/src/organism/generators/melody/guitarPerformance.ts`
- Modify: `client/src/organism/generators/melody/__tests__/motifSelection.test.ts`

**Interfaces:**
- Consumes: `shapePerformanceDynamics` from `./performerExpression` (guitar no longer needs its own `shapeGuitarDynamics` implementation — Task 5 already stopped calling it, so it can be deleted rather than kept as a redundant wrapper).
- Produces: no change to `noteToMidi()` or `planGuitarArticulations()` signatures (untouched, guitar-specific).

- [ ] **Step 1: Remove the now-dead `shapeGuitarDynamics()` from `guitarPerformance.ts`**

`shapeGuitarDynamics()` is no longer called anywhere (Task 5 replaced its call site with the shared `applyPerformerExpression()`, which uses `plucked`'s config — guitar's old default `peakPosition: 0.66` matches `plucked`'s config exactly, so behavior is preserved). Delete the `shapeGuitarDynamics` function and its `GuitarDynamicsOptions` interface from `client/src/organism/generators/melody/guitarPerformance.ts` (currently lines 3-10 and 97-130).

- [ ] **Step 2: Update `guitarPerformance.test.ts` to drop the deleted function's tests**

In `client/src/organism/generators/melody/__tests__/guitarPerformance.test.ts`, remove the entire `describe('shapeGuitarDynamics', ...)` block (lines 17-61) and its now-unused `flatPhrase` helper (lines 5-15) — `shapePerformanceDynamics`'s own tests in `performerExpression.test.ts` (Task 2) already cover this logic.

- [ ] **Step 3: Run the guitar test file to confirm it's still green**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/guitarPerformance.test.ts`
Expected: PASS — only `noteToMidi`, `planGuitarArticulations`, `developGuitarPhrase` describe blocks remain, all green.

- [ ] **Step 4: Fix the family-naming drift in `motifSelection.test.ts`**

`InstrumentRegistry.ts` emits `family: 'plucked'` and `family: 'keyboard'`, but `motifSelection.test.ts` exercises the non-lyrical branch using the fixture strings `'keys'` and `'pluck'`, which never occur on a real performer — those tests happen to pass today only because neither string is in `LYRICAL_FAMILIES` either way, not because they represent real values. In `client/src/organism/generators/melody/__tests__/motifSelection.test.ts`, replace:

```typescript
  it('preserves the existing arps/fills split for non-lyrical leads in auto mode', () => {
    expect(selectMotifBankKey({ family: 'keys', voiceActive: false, preferredBankKey: null, chordSeed: 7 })).toBe('arps')
    expect(selectMotifBankKey({ family: 'keys', voiceActive: false, preferredBankKey: null, chordSeed: 3 })).toBe('fills')
  })

  it('defaults to ostinatos for a non-lyrical lead with a live vocalist', () => {
    expect(selectMotifBankKey({ family: 'pluck', voiceActive: true, preferredBankKey: null, chordSeed: 4 })).toBe('ostinatos')
  })
```
with:
```typescript
  it('preserves the existing arps/fills split for non-lyrical leads in auto mode', () => {
    expect(selectMotifBankKey({ family: 'keyboard', voiceActive: false, preferredBankKey: null, chordSeed: 7 })).toBe('arps')
    expect(selectMotifBankKey({ family: 'keyboard', voiceActive: false, preferredBankKey: null, chordSeed: 3 })).toBe('fills')
  })

  it('defaults to ostinatos for a non-lyrical lead with a live vocalist', () => {
    expect(selectMotifBankKey({ family: 'plucked', voiceActive: true, preferredBankKey: null, chordSeed: 4 })).toBe('ostinatos')
  })
```

- [ ] **Step 5: Run the motifSelection test file**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/motifSelection.test.ts`
Expected: PASS (6 tests) — behavior identical, fixture strings now match real family values.

- [ ] **Step 6: Full-suite check + typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx vitest run --reporter=dot`
Expected: all pass (baseline was 667; this task nets roughly -5 from removing shapeGuitarDynamics's tests, +25 from Tasks 1-4's new tests — exact count isn't the point, zero failures is).

- [ ] **Step 7: Commit**

```bash
git add client/src/organism/generators/melody/guitarPerformance.ts client/src/organism/generators/melody/__tests__/guitarPerformance.test.ts client/src/organism/generators/melody/__tests__/motifSelection.test.ts
git commit -m "refactor(organism): remove now-redundant shapeGuitarDynamics, fix family-name drift in motifSelection tests"
```

---

### Task 7: Wind integration test + final verification

**Files:**
- Modify: `client/src/organism/generators/__tests__/MelodyGenerator.test.ts`

**Interfaces:**
- Consumes: `MelodyGenerator` (already imported in the test file), `makePhysics()` helper (defined at the top of the test file), the existing `gen.setInstrumentPerformer(id)` / `gen.onStateTransition(state, physics)` pattern used by every performer-gated test in this file (e.g. the "boosts selected lead sampler gain" test at line 107 and "fills lead phrases with repeated motifs" test at line 94). `'flute'` is the wind-family performer id (`InstrumentRegistry.ts:143`, `family: 'wind'`).

- [ ] **Step 1: Write the failing test**

Add this `describe` block to `client/src/organism/generators/__tests__/MelodyGenerator.test.ts`, right after the existing "keeps no-vocal lead phrase velocities above background level" test (around line 128), following the exact `setInstrumentPerformer` + `onStateTransition` + `Tone.Part` mock-inspection pattern already used elsewhere in this file:

```typescript
  describe('performer expression rollout — wind family', () => {
    it('a wind lead (flute) builds a scheduled phrase without throwing', () => {
      const physics = makePhysics({ voiceActive: false })

      gen.setInstrumentPerformer('flute')
      expect(() => gen.onStateTransition(OState.Flow, physics)).not.toThrow()

      const partMock = Tone.Part as unknown as {
        mock: { calls: Array<[unknown, Array<{ vel: number }>]> }
      }
      const events = partMock.mock.calls.at(-1)?.[1] ?? []
      expect(events.length).toBeGreaterThan(0)
    })

    it('a wind lead phrase has non-uniform velocities (the shared dynamics arc is applied)', () => {
      const physics = makePhysics({ voiceActive: false })

      gen.setInstrumentPerformer('flute')
      gen.onStateTransition(OState.Flow, physics)

      const partMock = Tone.Part as unknown as {
        mock: { calls: Array<[unknown, Array<{ vel: number }>]> }
      }
      const events = partMock.mock.calls.at(-1)?.[1] ?? []
      const distinctVels = new Set(events.map(e => Math.round(e.vel * 100)))
      expect(distinctVels.size).toBeGreaterThan(1)
    })
  })
```

(This is deliberately an integration smoke test — `performerExpression.test.ts` from Tasks 1-4 already covers the numeric behavior of each pure function in isolation. This test only confirms the wind family is wired end-to-end through the real `MelodyGenerator` pipeline: `setInstrumentPerformer('flute')` sets `currentPerformer.family = 'wind'`, which `applyPerformerExpression()` now picks up via `getPerformerExpressionConfig('wind')` instead of the old `isBowedString()` regex gate that would have skipped a flute entirely.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/__tests__/MelodyGenerator.test.ts -t "performer expression rollout"`
Expected: FAIL if Task 5 wasn't completed first (wind wouldn't get the dynamics arc, so the "non-uniform velocities" assertion fails) — confirms the test actually exercises the new wiring. If Tasks 1-6 are already done in order, this may already PASS; if so, skip to Step 3.

- [ ] **Step 3: Run it, confirm it passes**

Run: `npx vitest run client/src/organism/generators/__tests__/MelodyGenerator.test.ts`
Expected: PASS, no throw.

- [ ] **Step 4: Full verification pass**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx vitest run --reporter=dot`
Expected: all pass, zero failures.

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/__tests__/MelodyGenerator.test.ts
git commit -m "test(organism): add wind-family integration smoke test for performer expression rollout"
```
