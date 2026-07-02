# Freeplay Generators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bass, drums, and chords improvise their parts live inside the Conductor's key/chord/groove (like the melody already does) instead of looping authored patterns — per spec `docs/superpowers/specs/2026-07-02-freeplay-generators-design.md`.

**Architecture:** Pure, seeded, unit-testable improviser functions in `client/src/organism/generators/freeplay/` are called from the generators' EXISTING rebuild paths (`BassGenerator.generateNotes`, orchestrator → `DrumGenerator.loadGeneratedPattern`, `ChordGenerator.rebuildPart`). No new Tone.Parts, no new schedulers, no new swing sources.

**Tech Stack:** TypeScript, Tone.js (only in generators, NEVER in `freeplay/`), vitest.

## Global Constraints

- Baseline commit: `fc2ed540`. Branch: work on `main` LOCALLY — **NEVER `git push`** (Railway auto-deploys `origin/main` to production; the user pushes after ear-verification).
- `freeplay/` files must NOT import `tone` (purity is what makes them testable).
- All event times are strings `"bar:beat:sub"` built with the swing convention: off-beat 16th subs (1 and 3) get `+ swing` added (see `swingTime` in `DrumPatternLibrary.ts:34`). Never schedule in seconds.
- ONE swing source: values always arrive via context from `swingForSubGenre` / `getBassSwing` — never define a new swing table.
- Repetition discipline: bar pattern A-A-A′-A(+fill); a variation changes at most one onset.
- Run `npm run check` and `npm run test:unit` before EVERY commit; both must pass. (Git prints `LF will be replaced by CRLF` warnings — harmless, ignore.)
- Don't modify `MelodyGenerator.ts`.
- After Tasks 3, 5, and 7: STOP and tell the user to listen (by-ear gate). Do not continue to the next task without their verdict.

---

## Task 0: Baseline capture (with the user, before any code)

No code. Ask the user to run `npm run dev`, open the studio, start the Organism on a boom-bap preset. If the WebEar MCP tools are connected (`mcp__webear__capture_audio` → `mcp__webear__analyze_audio` — free DSP, no credits), capture ~20s and record in a note: peak dBFS, RMS, clipping %, per-band energy. This is the before-measurement. Known trap: BPM/onset-jitter numbers are unreliable on swung sparse material — directional only. If WebEar isn't connected, skip (the user's ears gate each phase anyway) and continue to Task 1.

---

## Task 1: Freeplay scaffolding — utils + motif

**Files:**
- Create: `client/src/organism/generators/freeplay/utils.ts`
- Create: `client/src/organism/generators/freeplay/types.ts`
- Create: `client/src/organism/generators/freeplay/motif.ts`
- Test: `client/src/organism/generators/freeplay/__tests__/motif.test.ts`

**Interfaces:**
- Produces: `mulberry32(seed: number): () => number`, `hashString(s: string): number`, `midiToNote(midi: number): string`, `swungTime(bar: number, slot16: number, swing: number): string`, `jitterVel(base: number, rng: () => number): number`, `FreeplayContext`, `RhythmMotif`, `getSectionMotif(key, rng, density, anchorSlots): RhythmMotif`, `varyMotif(motif, rng): RhythmMotif`, `clearMotifs(): void`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/organism/generators/freeplay/__tests__/motif.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mulberry32, hashString, midiToNote, swungTime, jitterVel } from '../utils'
import { getSectionMotif, varyMotif, clearMotifs } from '../motif'

describe('freeplay utils', () => {
  it('mulberry32 is deterministic for a given seed', () => {
    const a = mulberry32(42), b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('hashString is deterministic and differs across strings', () => {
    expect(hashString('verse:boom-bap')).toBe(hashString('verse:boom-bap'))
    expect(hashString('verse:boom-bap')).not.toBe(hashString('drop:trap'))
  })

  it('midiToNote converts MIDI to note names', () => {
    expect(midiToNote(36)).toBe('C2')
    expect(midiToNote(45)).toBe('A2')
  })

  it('swungTime delays only off-beat 16ths (subs 1 and 3)', () => {
    expect(swungTime(1, 0, 0.3)).toBe('1:0:0.00')   // slot 0 → beat 0 sub 0, straight
    expect(swungTime(0, 5, 0.3)).toBe('0:1:1.30')    // slot 5 → beat 1 sub 1, swung
    expect(swungTime(0, 6, 0.3)).toBe('0:1:2.00')    // sub 2 stays straight
  })

  it('jitterVel stays in [0.1, 1]', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 50; i++) {
      const v = jitterVel(0.9, rng)
      expect(v).toBeGreaterThanOrEqual(0.1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('motif', () => {
  beforeEach(() => clearMotifs())

  it('same key returns the SAME committed motif (repetition is the rhyme)', () => {
    const rng = mulberry32(1)
    const m1 = getSectionMotif('bass:verse:boom-bap', rng, 0.6, [0, 6])
    const m2 = getSectionMotif('bass:verse:boom-bap', rng, 0.6, [0, 6])
    expect(m2).toEqual(m1)
  })

  it('includes the anchor slots and the downbeat', () => {
    const m = getSectionMotif('k', mulberry32(2), 0.5, [6, 10])
    expect(m.slots).toContain(0)
    expect(m.slots).toContain(6)
    expect(m.slots).toContain(10)
  })

  it('slots are sorted, unique, within 0..15, and 2..8 in count', () => {
    for (let seed = 0; seed < 20; seed++) {
      clearMotifs()
      const m = getSectionMotif('k', mulberry32(seed), seed / 20, [])
      expect(m.slots.length).toBeGreaterThanOrEqual(2)
      expect(m.slots.length).toBeLessThanOrEqual(8)
      expect([...m.slots]).toEqual([...new Set(m.slots)].sort((a, b) => a - b))
      m.slots.forEach(s => { expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(15) })
    }
  })

  it('varyMotif changes at most one onset and never drops the downbeat', () => {
    const m = getSectionMotif('k', mulberry32(3), 0.6, [0])
    for (let seed = 0; seed < 20; seed++) {
      const v = varyMotif(m, mulberry32(seed))
      expect(v.slots).toContain(0)
      const added = v.slots.filter(s => !m.slots.includes(s))
      const removed = m.slots.filter(s => !v.slots.includes(s))
      expect(added.length + removed.length).toBeLessThanOrEqual(2) // one shift = 1 add + 1 remove
      expect(v.slots.length).toBeGreaterThanOrEqual(2)
      expect(v.slots.length).toBeLessThanOrEqual(8)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/freeplay --reporter=dot`
Expected: FAIL — cannot resolve `../utils` / `../motif`.

- [ ] **Step 3: Write the implementation**

```ts
// client/src/organism/generators/freeplay/utils.ts
// Pure helpers for the freeplay improvisers. NO tone imports (testability).

/** Deterministic PRNG — same seed, same stream. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a string hash → 32-bit uint. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** MIDI number → scientific pitch (60 = C4), matching Tone.Frequency output. */
export function midiToNote(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

/**
 * 16th-slot (0..15) → "bar:beat:sub" with the band's swing convention:
 * off-beat 16ths (sub 1 and 3) are delayed by `swing` (same rule as
 * DrumPatternLibrary.swingTime — do NOT invent a different one).
 */
export function swungTime(bar: number, slot16: number, swing: number): string {
  const beat = Math.floor(slot16 / 4)
  const sub = slot16 % 4
  const swungSub = (sub === 1 || sub === 3) ? sub + Math.max(0, Math.min(1, swing)) : sub
  return `${bar}:${beat}:${swungSub.toFixed(2)}`
}

/** Humanised velocity (seeded twin of DrumPatternLibrary.hv). */
export function jitterVel(base: number, rng: () => number, spread = 0.08): number {
  return Math.min(1, Math.max(0.1, base + (rng() - 0.5) * spread * 2))
}
```

```ts
// client/src/organism/generators/freeplay/types.ts
/** Everything an improviser is allowed to know. The Conductor/orchestrator
 *  INFORMS; the improviser writes the notes. */
export interface FreeplayContext {
  rootMidi: number            // bass-register chord root (conductor voicing)
  chordIntervals: number[]    // the chord's real intervals (3rd/7th quality)
  bars: number                // phrase length (4 = one chord cycle)
  swing: number               // swingForSubGenre value — the ONE swing source
  subGenre: string            // idiom skeleton selection
  energy: number              // 0..1 section arc
  density: number             // 0..1 section arc
  sectionName: string         // motif memory key component
  motifSeed: number           // hash(section + subGenre) — motif family
  kickTimes16ths: number[]    // absolute kick slots 0..(bars*16-1), for bass glue
  rng: () => number           // seeded — improvisers are deterministic per seed
}
```

```ts
// client/src/organism/generators/freeplay/motif.ts
// The repetition discipline: each (generator, section) commits to ONE rhythm
// motif and develops it. "Repetition IS the rhyme" — never re-roll per bar.

export interface RhythmMotif {
  /** Sorted unique 16th slots (0..15) that fire within one bar. */
  slots: number[]
}

const motifStore = new Map<string, RhythmMotif>()

/** Clear all committed motifs (called on orchestrator cold start). */
export function clearMotifs(): void {
  motifStore.clear()
}

/** Downbeat-first candidate order so motifs feel grounded, not random. */
const WEIGHTED_SLOTS = [0, 8, 4, 12, 6, 14, 2, 10, 3, 7, 11, 15, 1, 5, 9, 13]

/** Get (or commit) the section's motif. Anchors (e.g. kick slots) always kept. */
export function getSectionMotif(
  key: string,
  rng: () => number,
  density: number,
  anchorSlots: number[] = [],
): RhythmMotif {
  const existing = motifStore.get(key)
  if (existing) return existing

  const slots = new Set<number>([0])
  for (const a of anchorSlots) slots.add(((Math.floor(a) % 16) + 16) % 16)
  const target = Math.max(2, Math.min(8, 2 + Math.round(density * 4) + anchorSlots.length))
  for (const c of WEIGHTED_SLOTS) {
    if (slots.size >= target) break
    if (rng() < 0.6) slots.add(c)
  }
  if (slots.size < 2) slots.add(8)

  const motif: RhythmMotif = { slots: [...slots].sort((a, b) => a - b) }
  motifStore.set(key, motif)
  return motif
}

/** One development operation: add ONE, drop ONE, or shift ONE onset by a 16th.
 *  Never touches the downbeat. Bounded — this is variation, not a new idea. */
export function varyMotif(motif: RhythmMotif, rng: () => number): RhythmMotif {
  const slots = new Set(motif.slots)
  const movable = motif.slots.filter(s => s !== 0)
  const op = Math.floor(rng() * 3)

  if (op === 0 && slots.size < 8) {
    slots.add(Math.floor(rng() * 16))
  } else if (op === 1 && slots.size > 2 && movable.length > 0) {
    slots.delete(movable[Math.floor(rng() * movable.length)])
  } else if (movable.length > 0) {
    const s = movable[Math.floor(rng() * movable.length)]
    slots.delete(s)
    slots.add(Math.min(15, Math.max(1, s + (rng() < 0.5 ? -1 : 1))))
  }

  const out = [...slots].sort((a, b) => a - b)
  return { slots: out.length >= 2 ? out : motif.slots }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/freeplay --reporter=dot`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/freeplay
git commit -m "feat(freeplay): scaffolding — seeded rng, swung time, motif commit/develop"
```

---

## Task 2: BassImproviser (pure)

**Files:**
- Create: `client/src/organism/generators/freeplay/BassImproviser.ts`
- Test: `client/src/organism/generators/freeplay/__tests__/BassImproviser.test.ts`

**Interfaces:**
- Consumes: Task 1 (`utils.ts`, `motif.ts`, `types.ts`); `ScheduledNote` from `../types` (`{ pitch: string; duration: string; velocity: number; time: string }`)
- Produces: `buildFreeplayBassNotes(ctx: FreeplayContext): ScheduledNote[]`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/organism/generators/freeplay/__tests__/BassImproviser.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildFreeplayBassNotes } from '../BassImproviser'
import { clearMotifs } from '../motif'
import { mulberry32, hashString, midiToNote } from '../utils'
import type { FreeplayContext } from '../types'

function ctx(overrides: Partial<FreeplayContext> = {}): FreeplayContext {
  return {
    rootMidi: 36,                       // C2
    chordIntervals: [0, 3, 7, 10],      // minor 7
    bars: 4,
    swing: 0.3,
    subGenre: 'boom-bap',
    energy: 0.6,
    density: 0.6,
    sectionName: 'verse',
    motifSeed: hashString('verse:boom-bap'),
    kickTimes16ths: [0, 6, 10, 16, 22, 26, 32, 38, 42, 48, 54, 58],
    rng: mulberry32(99),
    ...overrides,
  }
}

describe('BassImproviser', () => {
  beforeEach(() => clearMotifs())

  it('every pitch is a chord tone (root/3rd/5th/7th/octave) of the live chord', () => {
    const notes = buildFreeplayBassNotes(ctx())
    // allowed pitch classes for C minor 7: C(0), Eb(3), G(7), Bb(10)
    const allowedPc = new Set([0, 3, 7, 10])
    const nameToPc = new Map<string, number>()
    for (let m = 24; m < 60; m++) nameToPc.set(midiToNote(m), m % 12)
    for (const n of notes) {
      expect(allowedPc.has(nameToPc.get(n.pitch)! )).toBe(true)
    }
  })

  it('uses the MAJOR third when the chord is major (no minor-pent clash)', () => {
    const notes = buildFreeplayBassNotes(ctx({ chordIntervals: [0, 4, 7, 11], sectionName: 'chorus' }))
    const nameToPc = new Map<string, number>()
    for (let m = 24; m < 60; m++) nameToPc.set(midiToNote(m), m % 12)
    for (const n of notes) {
      const pc = nameToPc.get(n.pitch)!
      expect(pc).not.toBe(3)   // minor third of C is forbidden over C major
      expect(pc).not.toBe(10)  // b7 forbidden over maj7 chord
    }
  })

  it('at least 60% of onsets land on a kick slot (kick glue)', () => {
    const c = ctx()
    const notes = buildFreeplayBassNotes(c)
    const kickSet = new Set(c.kickTimes16ths)
    const onsetSlot = (t: string) => {
      const [bar, beat, sub] = t.split(':').map(parseFloat)
      return bar * 16 + beat * 4 + Math.floor(sub)
    }
    const onKick = notes.filter(n => kickSet.has(onsetSlot(n.time)))
    expect(onKick.length / notes.length).toBeGreaterThanOrEqual(0.6)
  })

  it('bars 1 and 2 repeat the same rhythm (A-A), bar 3 is a bounded variation', () => {
    const notes = buildFreeplayBassNotes(ctx())
    const rhythmOfBar = (bar: number) =>
      notes.filter(n => n.time.startsWith(`${bar}:`)).map(n => n.time.slice(2)).sort()
    expect(rhythmOfBar(1)).toEqual(rhythmOfBar(0))
    const a = new Set(rhythmOfBar(0))
    const b = rhythmOfBar(2)
    const changed = b.filter(t => !a.has(t)).length + [...a].filter(t => !b.includes(t)).length
    expect(changed).toBeLessThanOrEqual(2)
  })

  it('pitches stay in the bass register (MIDI 28..52)', () => {
    const notes = buildFreeplayBassNotes(ctx({ rootMidi: 48 }))
    const nameToMidi = new Map<string, number>()
    for (let m = 0; m < 90; m++) nameToMidi.set(midiToNote(m) + '|' + m, m)
    for (const n of notes) {
      // reconstruct midi from name: search the map
      const midi = [...nameToMidi.entries()].find(([k]) => k.startsWith(n.pitch + '|'))![1]
      expect(midi).toBeGreaterThanOrEqual(28)
      expect(midi).toBeLessThanOrEqual(52)
    }
  })

  it('is deterministic for the same seed', () => {
    const n1 = buildFreeplayBassNotes(ctx({ rng: mulberry32(5) }))
    clearMotifs()
    const n2 = buildFreeplayBassNotes(ctx({ rng: mulberry32(5) }))
    expect(n1).toEqual(n2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/freeplay/__tests__/BassImproviser.test.ts --reporter=dot`
Expected: FAIL — cannot resolve `../BassImproviser`.

- [ ] **Step 3: Write the implementation**

```ts
// client/src/organism/generators/freeplay/BassImproviser.ts
// Freeplay bass: improvise a 4-bar line from the LIVE chord's tones, anchored
// to the kick. The conductor informs (root, intervals, swing); this writes notes.

import type { ScheduledNote } from '../types'
import type { FreeplayContext } from './types'
import { getSectionMotif, varyMotif } from './motif'
import { midiToNote, swungTime, jitterVel } from './utils'

/** Same register rule as BassGenerator.bassRootFromMidi (33..48, pitch class kept). */
function clampToBassRegister(midi: number): number {
  let m = midi
  while (m > 48) m -= 12
  while (m < 33) m += 12
  return m
}

const SUSTAINED_SUBGENRES = new Set(['trap', 'drill', 'phonk', 'dirty-south'])

export function buildFreeplayBassNotes(ctx: FreeplayContext): ScheduledNote[] {
  const root = clampToBassRegister(ctx.rootMidi)
  // Real chord quality — the setBassChordQuality lesson: never assume minor.
  const third = ctx.chordIntervals.includes(4) && !ctx.chordIntervals.includes(3) ? 4 : 3
  const seventh = ctx.chordIntervals.includes(11) && !ctx.chordIntervals.includes(10) ? 11 : 10

  // Motif anchored to bar-1 kicks — this is the kick-glue: the motif's slots
  // ARE (mostly) kick slots, so ≥60% of onsets land with the kick by design.
  const kickSlotsBar = [...new Set(ctx.kickTimes16ths.map(s => s % 16))].sort((a, b) => a - b)
  const motif = getSectionMotif(
    `bass:${ctx.sectionName}:${ctx.subGenre}`,
    ctx.rng,
    Math.min(ctx.density, 0.5),          // bass stays sparser than drums
    kickSlotsBar.slice(0, 4),
  )

  // Kick-glue guarantee: keep ALL kick-slots but at most kickCount/2 free
  // slots, so ≥60% of onsets land with the kick even for busy motifs.
  const kickish = motif.slots.filter(s => kickSlotsBar.includes(s))
  const freeCap = Math.max(1, Math.floor(kickish.length / 2))
  const free = motif.slots.filter(s => !kickSlotsBar.includes(s)).slice(0, freeCap)
  const baseMask = { slots: [...new Set([...kickish, ...free])].sort((a, b) => a - b) }

  const sustained = SUSTAINED_SUBGENRES.has(ctx.subGenre)
  const kickSet = new Set(ctx.kickTimes16ths)
  const notes: ScheduledNote[] = []

  for (let bar = 0; bar < ctx.bars; bar++) {
    // A-A-A'-A: bar 3 (index 2) is the single bounded variation.
    const mask = bar === 2 ? varyMotif(baseMask, ctx.rng) : baseMask
    const slots = mask.slots

    slots.forEach((slot, i) => {
      const isDownbeat = slot === 0
      const onKick = kickSet.has(bar * 16 + slot) || kickSlotsBar.includes(slot)

      // Pitch: downbeat = root; kick-anchored = root or octave; free slots =
      // 5th / chord 3rd / chord 7th (all pitches are chord tones — no scale runs).
      let interval = 0
      if (!isDownbeat) {
        const roll = ctx.rng()
        if (onKick) interval = roll < 0.7 ? 0 : 12
        else interval = roll < 0.4 ? 7 : roll < 0.7 ? third : seventh
      }
      const pitchMidi = clampToBassRegister(root + interval)

      // Duration from the gap to the next onset; 808 genres sustain the downbeat.
      const nextSlot = slots[i + 1] ?? 16
      const gap = nextSlot - slot
      const dur = sustained && isDownbeat ? '2n' : gap >= 4 ? '4n' : gap >= 2 ? '8n' : '16n'

      notes.push({
        pitch: midiToNote(pitchMidi),
        duration: dur,
        velocity: jitterVel(isDownbeat ? 0.85 : onKick ? 0.72 : 0.55, ctx.rng),
        time: swungTime(bar, slot, ctx.swing),
      })
    })

    // Turnaround: approach the next downbeat from the chord third on the
    // final swung 16th of the phrase.
    if (bar === ctx.bars - 1 && !baseMask.slots.includes(15)) {
      notes.push({
        pitch: midiToNote(clampToBassRegister(root + third)),
        duration: '16n',
        velocity: jitterVel(0.5, ctx.rng),
        time: swungTime(bar, 15, ctx.swing),
      })
    }
  }

  return notes
}
```

**NOTE on the ≥60% kick-glue test:** the guarantee comes from the `freeCap` cap (free slots ≤ half the kick slots). If the test lands just under 0.6 for some seed, tighten `freeCap` to `Math.max(1, Math.floor(kickish.length / 3))` — do NOT loosen the test.
**NOTE on the turnaround vs A-A test:** the turnaround note is added in bar 3 only, and the A-A assertion compares bars 0 and 1 — no conflict.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/freeplay --reporter=dot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/freeplay
git commit -m "feat(freeplay): bass improviser — chord-tone lines anchored to the kick"
```

---

## Task 3: Bass integration (BassGenerator + orchestrator plumbing)

**Files:**
- Modify: `client/src/organism/generators/GeneratorBase.ts` (add `sectionName` field + setter near the `sectionDensity` machinery)
- Modify: `client/src/organism/generators/patterns/BassPatternLibrary.ts` (export `getBassSwing`)
- Modify: `client/src/organism/generators/BassGenerator.ts`
- Modify: `client/src/organism/generators/GeneratorOrchestrator.ts`
- Test: `client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts` (extend)

**Interfaces:**
- Consumes: `buildFreeplayBassNotes` (Task 2), `clearMotifs` (Task 1)
- Produces: `BassGenerator.setFreeplay(enabled: boolean): void`, `BassGenerator.setKickAnchors(slots: number[]): void`, `GeneratorBase.setSectionName(name: string): void` (protected field `currentSectionName`), `GeneratorOrchestrator.setBassFreeplay(enabled: boolean): void`, `getBassSwing(): number`

- [ ] **Step 1: GeneratorBase — section name**

In `client/src/organism/generators/GeneratorBase.ts`, inside `export abstract class GeneratorBase`, add (near the other protected fields, e.g. below `protected _loopMode = false`):

```ts
  /** Current arrangement section (from the orchestrator's section listener).
   *  Freeplay improvisers key their committed motif on this. */
  protected currentSectionName = 'verse'

  setSectionName(name: string): void {
    this.currentSectionName = name
  }
```

- [ ] **Step 2: BassPatternLibrary — swing getter**

In `client/src/organism/generators/patterns/BassPatternLibrary.ts`, directly below the `setBassSwing` function (line ~78), add:

```ts
/** Read the live bass swing (set by setBassSwingFromSubGenre) — freeplay
 *  must swing by the same amount as the authored patterns. */
export function getBassSwing(): number {
  return currentSwing
}
```

- [ ] **Step 3: BassGenerator — freeplay branch**

In `client/src/organism/generators/BassGenerator.ts`:

3a. Add imports at the top (with the other `./` imports):

```ts
import { buildFreeplayBassNotes } from './freeplay/BassImproviser'
import { hashString, mulberry32 } from './freeplay/utils'
```

and add `getBassSwing` to the existing import list from `'./patterns/BassPatternLibrary'`.

3b. Add fields near `private currentBehavior: BassBehavior = BassBehavior.Breathe` (line ~62):

```ts
  // ── Freeplay (spec 2026-07-02) — improvise from the live chord instead of
  // reading BassPatternLibrary. Default ON; the styles dropdown is the opt-out.
  private freeplayEnabled = true
  private chordIntervals: number[] = [0, 3, 7]
  private kickAnchors: number[] = []
  private freeplayPhraseCounter = 0
```

3c. In the constructor's `conductor.onChordChange((chord) => {` callback (line ~256), add ONE line directly above `setBassChordQuality(chord.intervals)`:

```ts
      this.chordIntervals = chord.intervals
```

3d. Add public setters (near `setSubGenre` or any other public setter):

```ts
  /** Freeplay on/off. Rebuild immediately so the switch is audible. */
  setFreeplay(enabled: boolean): void {
    if (this.freeplayEnabled === enabled) return
    this.freeplayEnabled = enabled
    if (this.lastOutputGain > 0) this.rebuildPart()
  }

  /** Kick onset slots (absolute 16ths, 0..63) from the current drum pattern. */
  setKickAnchors(slots: number[]): void {
    this.kickAnchors = slots
  }
```

3e. In `generateNotes` (line 741), insert the branch before `return buildBassNotes(...)` (keep the portamento code above it untouched):

```ts
    if (this.freeplayEnabled) {
      const seed = hashString(`bass:${this.currentSectionName}:${this.currentSubGenre ?? 'none'}`)
      return buildFreeplayBassNotes({
        rootMidi: this.rootMidi,
        chordIntervals: this.chordIntervals,
        bars: 4,
        swing: getBassSwing(),
        subGenre: (this.currentSubGenre ?? 'boom-bap') as string,
        energy: physics.density,
        density: physics.density,
        sectionName: this.currentSectionName,
        motifSeed: seed,
        kickTimes16ths: this.kickAnchors,
        rng: mulberry32(seed + this.freeplayPhraseCounter++),
      })
    }
```

- [ ] **Step 4: Orchestrator — kick anchors, section push, freeplay setter, motif reset**

In `client/src/organism/generators/GeneratorOrchestrator.ts`:

4a. Imports:

```ts
import { extractKickSlots } from './freeplay/DrumImproviser'   // ← added in Task 4; for NOW use the inline helper below instead
import { clearMotifs } from './freeplay/motif'
```

**For this task** (DrumImproviser doesn't exist yet) create the helper as a module-level function in `freeplay/utils.ts` instead, and import it from there:

```ts
// append to client/src/organism/generators/freeplay/utils.ts
/** Kick onset slots (absolute 16ths) from a DrumHit[] — used for bass glue.
 *  Times are "bar:beat:sub" strings; swing fractions floor to the slot. */
export function extractKickSlots(
  hits: Array<{ instrument: string; time: string }>,
): number[] {
  const slots = new Set<number>()
  for (const h of hits) {
    if (h.instrument !== 'kick') continue
    const [bar, beat, sub] = h.time.split(':').map(parseFloat)
    if ([bar, beat, sub].some(Number.isNaN)) continue
    slots.add(bar * 16 + beat * 4 + Math.floor(sub))
  }
  return [...slots].sort((a, b) => a - b)
}
```

Then in the orchestrator: `import { extractKickSlots, ... } from './freeplay/utils'`.

4b. After EACH of the three drum-pattern loads, push kick anchors to the bass. The three sites (search for `loadGeneratedPattern`):
- in `start()` (line ~437): after `this.drum.loadGeneratedPattern(startPattern.hits, true)` add `this.bass.setKickAnchors(extractKickSlots(startPattern.hits))`
- in `onSubGenreChange` (line ~1310): after `this.drum.loadGeneratedPattern(drumPattern.hits, true)` add `this.bass.setKickAnchors(extractKickSlots(drumPattern.hits))`
- in `onPatternMutation` (line ~1339): after `this.drum.loadGeneratedPattern(mutated)` add `this.bass.setKickAnchors(extractKickSlots(mutated))`

4c. In the `onSectionChange` listener (line ~265, right after `const barNumber = ...`), add:

```ts
      this.bass.setSectionName(section)
      this.chord.setSectionName(section)
```

4d. In `start()`, near the top (before generators start — e.g. right after the `running` flag / first lines of the method), add:

```ts
    clearMotifs()   // per-start variety: each session commits fresh motifs
```

4e. Add the public setter (near `setBassArticulation` or other bass setters — search `setBassArticulation(`):

```ts
  /** Freeplay switch — bass improvises from the live chord vs authored patterns. */
  setBassFreeplay(enabled: boolean): void {
    this.bass.setFreeplay(enabled)
  }
```

- [ ] **Step 5: Add the orchestrator regression test**

In `client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts`, add inside the main `describe('GeneratorOrchestrator', ...)` block:

```ts
  it('pushes kick anchors from the drum pattern to the bass on start', async () => {
    const spy = vi.spyOn((orchestrator as any).bass, 'setKickAnchors')
    await orchestrator.start(90)
    expect(spy).toHaveBeenCalled()
    const slots = spy.mock.calls[spy.mock.calls.length - 1][0] as number[]
    expect(slots.length).toBeGreaterThan(0)
    expect(slots).toContain(0)   // every sub-genre pattern kicks on beat 1
  })
```

- [ ] **Step 6: Run all checks**

Run: `npm run check` → expected: no TypeScript errors.
Run: `npm run test:unit` → expected: all pass (549+).
If `check` complains about the `physics.density` access in `generateNotes`, note that `generateNotes(physics: PhysicsState)` already reads `physics.density` at the existing `buildBassNotes` call — mirror whatever access pattern compiles there.
If an existing `BassGenerator` test asserts authored-library output, add `(gen as any).setFreeplay(false)` (or the public `gen.setFreeplay(false)`) to that test's setup — the authored path must remain byte-identical.

- [ ] **Step 7: Commit**

```bash
git add client/src/organism/generators client/src/organism/generators/__tests__
git commit -m "feat(freeplay): bass plays freeplay by default — chord-tone improv locked to the kick"
```

- [ ] **Step 8: 🔊 BY-EAR GATE — STOP**

Tell the user: "Bass freeplay is in (default ON). Run `npm run dev`, start a boom-bap preset, listen for: bass locking with the kick, no sour notes on major chords, a bassline that develops instead of looping. Then a trap preset for 808 sustains." Do not proceed to Task 4 without their verdict. If it fails, debug with them (suspects: kick anchors empty → check Step 4b; wrong swing → check `getBassSwing`).

---

## Task 4: DrumImproviser (pure)

**Files:**
- Create: `client/src/organism/generators/freeplay/DrumImproviser.ts`
- Test: `client/src/organism/generators/freeplay/__tests__/DrumImproviser.test.ts`

**Interfaces:**
- Consumes: Task 1; `DrumHit`/`DrumInstrument` from `../types` (`{ instrument: DrumInstrument; time: string; velocity: number }`, enum values `'kick' | 'snare' | 'hat' | 'perc'`)
- Produces: `buildFreeplayDrumHits(ctx: FreeplayContext): DrumHit[]`, `SKELETONS` table

- [ ] **Step 1: Write the failing test**

```ts
// client/src/organism/generators/freeplay/__tests__/DrumImproviser.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildFreeplayDrumHits, SKELETONS } from '../DrumImproviser'
import { clearMotifs } from '../motif'
import { mulberry32, hashString } from '../utils'
import type { FreeplayContext } from '../types'

function ctx(overrides: Partial<FreeplayContext> = {}): FreeplayContext {
  return {
    rootMidi: 36, chordIntervals: [0, 3, 7], bars: 4, swing: 0.3,
    subGenre: 'boom-bap', energy: 0.6, density: 0.7,
    sectionName: 'verse', motifSeed: hashString('verse:boom-bap'),
    kickTimes16ths: [], rng: mulberry32(11),
    ...overrides,
  }
}

const slotOf = (t: string) => {
  const [bar, beat, sub] = t.split(':').map(parseFloat)
  return { bar, slot: beat * 4 + Math.floor(sub) }
}

describe('DrumImproviser', () => {
  beforeEach(() => clearMotifs())

  it('the sub-genre skeleton is IMMUTABLE — every bar contains every anchor', () => {
    const hits = buildFreeplayDrumHits(ctx())
    const { kicks, snares } = SKELETONS['boom-bap']
    for (let bar = 0; bar < 4; bar++) {
      const kickSlots = hits.filter(h => h.instrument === 'kick' && slotOf(h.time).bar === bar).map(h => slotOf(h.time).slot)
      const snareSlots = hits.filter(h => h.instrument === 'snare' && slotOf(h.time).bar === bar && h.velocity > 0.4).map(h => slotOf(h.time).slot)
      for (const k of kicks) expect(kickSlots).toContain(k)
      for (const s of snares) expect(snareSlots).toContain(s)
    }
  })

  it('trap skeleton differs from boom-bap (genre identity preserved)', () => {
    expect(SKELETONS['trap'].snares).not.toEqual(SKELETONS['boom-bap'].snares)
  })

  it('density controls hat count', () => {
    const sparse = buildFreeplayDrumHits(ctx({ density: 0.2, sectionName: 'intro' }))
    clearMotifs()
    const busy = buildFreeplayDrumHits(ctx({ density: 1.0, sectionName: 'drop' }))
    const hats = (hs: typeof sparse) => hs.filter(h => h.instrument === 'hat').length
    expect(hats(busy)).toBeGreaterThan(hats(sparse))
  })

  it('bar 4 contains a fill (extra snares on the last beat) when energy is high', () => {
    const hits = buildFreeplayDrumHits(ctx({ energy: 0.9 }))
    const lastBeatSnares = hits.filter(h =>
      h.instrument === 'snare' && slotOf(h.time).bar === 3 && slotOf(h.time).slot >= 12)
    expect(lastBeatSnares.length).toBeGreaterThanOrEqual(3)
  })

  it('no fill when energy is low (intro stays clean)', () => {
    const hits = buildFreeplayDrumHits(ctx({ energy: 0.2, sectionName: 'intro' }))
    const { snares } = SKELETONS['boom-bap']
    const extraLastBeat = hits.filter(h =>
      h.instrument === 'snare' && slotOf(h.time).bar === 3 &&
      slotOf(h.time).slot >= 12 && !snares.includes(slotOf(h.time).slot))
    expect(extraLastBeat.length).toBe(0)
  })

  it('is deterministic for the same seed', () => {
    const h1 = buildFreeplayDrumHits(ctx({ rng: mulberry32(4) }))
    clearMotifs()
    const h2 = buildFreeplayDrumHits(ctx({ rng: mulberry32(4) }))
    expect(h1).toEqual(h2)
  })

  it('every sub-genre in the SWING table has a skeleton', () => {
    for (const g of ['boom-bap','trap','drill','lo-fi','west-coast','dirty-south','phonk','jersey-club','bounce','reggaeton','afrobeat','chill']) {
      expect(SKELETONS[g], `missing skeleton: ${g}`).toBeDefined()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/freeplay/__tests__/DrumImproviser.test.ts --reporter=dot`
Expected: FAIL — cannot resolve `../DrumImproviser`.

- [ ] **Step 3: Write the implementation**

```ts
// client/src/organism/generators/freeplay/DrumImproviser.ts
// Freeplay drums: the sub-genre SKELETON (kick/snare anchors) is authored and
// immutable — boom-bap stays boom-bap. Everything AROUND it (extra kicks, hat
// density, ghosts, rolls, fills) is improvised from energy/density + motif.

import { DrumInstrument, type DrumHit } from '../types'
import type { FreeplayContext } from './types'
import { getSectionMotif } from './motif'
import { swungTime, jitterVel } from './utils'

/** Immutable per-genre backbone (16th slots 0..15). Slot 4 = beat 2, 12 = beat 4. */
export const SKELETONS: Record<string, { kicks: number[]; snares: number[] }> = {
  'boom-bap':    { kicks: [0, 6, 10],        snares: [4, 12] },
  'trap':        { kicks: [0, 10],           snares: [8] },        // half-time clap on 3
  'drill':       { kicks: [0, 9],            snares: [8] },
  'lo-fi':       { kicks: [0, 8],            snares: [4, 12] },
  'west-coast':  { kicks: [0, 7, 10],        snares: [4, 12] },
  'dirty-south': { kicks: [0, 6],            snares: [4, 12] },
  'phonk':       { kicks: [0, 7, 11],        snares: [4, 12] },
  'jersey-club': { kicks: [0, 6, 10, 13],    snares: [4, 12] },
  'bounce':      { kicks: [0, 7, 10],        snares: [4, 12] },
  'reggaeton':   { kicks: [0, 4, 8, 12],     snares: [3, 7, 11, 14] }, // dembow
  'afrobeat':    { kicks: [0, 7],            snares: [4, 12] },
  'chill':       { kicks: [0, 8],            snares: [4, 12] },
}

const K = DrumInstrument.Kick
const S = DrumInstrument.Snare
const H = DrumInstrument.Hat

function push(hits: DrumHit[], inst: DrumInstrument, bar: number, slot: number, vel: number, swing: number, rng: () => number): void {
  hits.push({ instrument: inst, time: swungTime(bar, slot, swing), velocity: jitterVel(vel, rng) })
}

export function buildFreeplayDrumHits(ctx: FreeplayContext): DrumHit[] {
  const skeleton = SKELETONS[ctx.subGenre] ?? SKELETONS['boom-bap']
  const hits: DrumHit[] = []

  // Slots forbidden for improvised additions: the backbone and its neighbours.
  const protectedSlots = new Set<number>()
  for (const s of [...skeleton.kicks, ...skeleton.snares]) {
    protectedSlots.add(s); protectedSlots.add(s - 1); protectedSlots.add(s + 1)
  }

  // ONE extra-kick motif per section — repeats every bar (A-A-A-A for kicks;
  // the development lives in hats/ghosts/fill, keeping the floor rock solid).
  const kickMotif = getSectionMotif(
    `drums:${ctx.sectionName}:${ctx.subGenre}`,
    ctx.rng,
    Math.min(ctx.density, 0.4),
    [],
  ).slots.filter(s => !protectedSlots.has(s))

  for (let bar = 0; bar < ctx.bars; bar++) {
    const isFillBar = bar === ctx.bars - 1

    // 1) Skeleton (immutable, loud)
    for (const s of skeleton.kicks) push(hits, K, bar, s, 0.95, ctx.swing, ctx.rng)
    for (const s of skeleton.snares) push(hits, S, bar, s, 0.9, ctx.swing, ctx.rng)

    // 2) Improvised extra kicks (quieter than the backbone)
    for (const s of kickMotif) {
      if (ctx.rng() < 0.8) push(hits, K, bar, s, 0.6, ctx.swing, ctx.rng)
    }

    // 3) Hats: 8ths always; 16th infill probability scales with density;
    //    occasional roll replaces the last 8th of odd bars at high energy.
    for (let slot = 0; slot < 16; slot++) {
      const isEighth = slot % 2 === 0
      const rollZone = slot >= 14 && bar % 2 === 1 && ctx.energy > 0.6
      if (rollZone) continue // handled below
      if (isEighth) {
        const accent = slot % 4 === 0 ? 0.48 : 0.35
        push(hits, H, bar, slot, accent, ctx.swing, ctx.rng)
      } else if (ctx.rng() < ctx.density * 0.5) {
        push(hits, H, bar, slot, 0.22, ctx.swing, ctx.rng)
      }
    }
    if (bar % 2 === 1 && ctx.energy > 0.6 && ctx.rng() < 0.7) {
      // 32nd hat roll across the last two 16ths (slots 14-15 as 4 hits)
      for (let i = 0; i < 4; i++) {
        hits.push({
          instrument: H,
          time: `${bar}:3:${(2 + i * 0.5).toFixed(2)}`,
          velocity: jitterVel(0.3 + i * 0.08, ctx.rng),
        })
      }
    }

    // 4) Ghost snares (feel, not backbeat — velocity stays under 0.3)
    for (const s of [3, 7, 11]) {
      if (!protectedSlots.has(s) && ctx.rng() < ctx.density * 0.35) {
        push(hits, S, bar, s, 0.2, ctx.swing, ctx.rng)
      }
    }

    // 5) Fill: last beat of bar 4, intensity from energy
    if (isFillBar && ctx.energy >= 0.3) {
      const fillSlots = ctx.energy > 0.7 ? [12, 13, 14, 15] : [13, 14, 15]
      fillSlots.forEach((s, i) => push(hits, S, bar, s, 0.5 + i * 0.12, ctx.swing, ctx.rng))
    }
  }

  return hits
}
```

**NOTE:** the low-energy test expects NO extra last-beat snares when `energy: 0.2` — the `ctx.energy >= 0.3` gate handles that; boom-bap's skeleton snare at slot 12 is excluded by the test itself.
**NOTE:** the immutable-skeleton test checks snares with `velocity > 0.4` so ghost snares don't interfere; fill snares ADD to slot 12+ which is fine (assertion is `toContain`, not exact-equality).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/freeplay --reporter=dot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/freeplay
git commit -m "feat(freeplay): drum improviser — immutable genre skeleton, improvised hats/ghosts/fills"
```

---

## Task 5: Drum integration (orchestrator)

**Files:**
- Modify: `client/src/organism/generators/GeneratorOrchestrator.ts`
- Test: `client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts` (extend)

**Interfaces:**
- Consumes: `buildFreeplayDrumHits`, `SKELETONS` (Task 4), `extractKickSlots` (Task 3), `hashString`, `mulberry32` (Task 1)
- Produces: `GeneratorOrchestrator.setDrumFreeplay(enabled: boolean): void`; private `buildDrumHits(subGenre, variantIndex): DrumHit[]`

- [ ] **Step 1: Add imports and fields**

In `GeneratorOrchestrator.ts` add imports:

```ts
import { buildFreeplayDrumHits } from './freeplay/DrumImproviser'
import { hashString, mulberry32, extractKickSlots } from './freeplay/utils'
```

(merge with the Task 3 import line — one import statement per module).

Add fields near `private running: boolean = false`:

```ts
  // ── Freeplay (spec 2026-07-02) ──
  private drumFreeplay = true
  private currentSectionName = 'intro'
  private sectionDensityLevel = 0.7
  private freeplayDrumCounter = 0
```

- [ ] **Step 2: Track section + density**

2a. In the `onSectionChange` listener (where Task 3 added `this.bass.setSectionName(section)`), add above those lines:

```ts
      this.currentSectionName = section
```

2b. Find `this.drum.setSectionDensity(drumsMultiplier)` (line ~1715, in `applyArrangement`) and add directly below it:

```ts
    this.sectionDensityLevel = Math.max(0, Math.min(1, drumsMultiplier))
```

- [ ] **Step 3: The pattern-source helper**

Add this private method near `onPatternMutation`:

```ts
  /** ONE drum-pattern source: freeplay improviser (default) or the authored
   *  library. Also pushes kick anchors to the bass so the rhythm section is
   *  glued regardless of which source produced the pattern. */
  private buildDrumHits(subGenre: HipHopSubGenre, variantIndex: number): DrumHit[] {
    let hits: DrumHit[]
    if (this.drumFreeplay) {
      const seed = hashString(`drums:${this.currentSectionName}:${subGenre}`)
      hits = buildFreeplayDrumHits({
        rootMidi: 0, chordIntervals: [0],           // drums don't use pitch
        bars: 4,
        swing: swingForSubGenre(subGenre),
        subGenre: subGenre as string,
        energy: this.sectionDensityLevel,
        density: this.sectionDensityLevel,
        sectionName: this.currentSectionName,
        motifSeed: seed,
        kickTimes16ths: [],
        rng: mulberry32(seed + this.freeplayDrumCounter++),
      })
    } else {
      hits = buildSubGenrePattern(subGenre, variantIndex).hits
    }
    this.bass.setKickAnchors(extractKickSlots(hits))
    return hits
  }

  /** Freeplay switch for drums (UI: DRUMS panel pill). */
  setDrumFreeplay(enabled: boolean): void {
    if (this.drumFreeplay === enabled) return
    this.drumFreeplay = enabled
    if (this.drumEnabled && this.running) {
      const state = this.director.getState()
      this.drum.loadGeneratedPattern(this.buildDrumHits(state.subGenre, state.drums.variantIndex), true)
    }
  }
```

(`DrumHit` may need adding to the type imports from `./types`; `swingForSubGenre` and `buildSubGenrePattern` are already imported.)

- [ ] **Step 4: Route the three call sites through the helper**

4a. `start()` (line ~437): replace

```ts
      this.drum.loadGeneratedPattern(startPattern.hits, true)
      this.bass.setKickAnchors(extractKickSlots(startPattern.hits))
```

with — keep whatever line computes `startPattern` for the non-freeplay path by replacing the pair with:

```ts
      this.drum.loadGeneratedPattern(this.buildDrumHits(startSubGenre, this.director.getState().drums.variantIndex), true)
```

(`startSubGenre` is already in scope in `start()` — see line ~415.)

4b. `onSubGenreChange` (line ~1309): replace

```ts
      const drumPattern = buildSubGenrePattern(subGenre, this.director.getState().drums.variantIndex)
      this.drum.loadGeneratedPattern(drumPattern.hits, true)
      this.bass.setKickAnchors(extractKickSlots(drumPattern.hits))
```

with:

```ts
      this.drum.loadGeneratedPattern(this.buildDrumHits(subGenre, this.director.getState().drums.variantIndex), true)
```

4c. `onPatternMutation` (line ~1332): replace the whole body after the two guard `if`s with:

```ts
    const state = this.director.getState()
    if (this.drumFreeplay) {
      // Freeplay regenerates a fresh variation each mutation tick — that IS
      // the mutation (same skeleton + motif, new hats/ghosts/fill roll).
      this.drum.loadGeneratedPattern(this.buildDrumHits(state.subGenre, state.drums.variantIndex))
      return
    }
    const pattern = buildSubGenrePattern(state.subGenre, state.drums.variantIndex)
    const mutated = mutatePattern(pattern.hits, {
      ghostProbability: 0.08,
      dropProbability: 0,
      shiftProbability: 0,
      velocitySpread: 0.04,
    })
    this.drum.loadGeneratedPattern(mutated)
    this.bass.setKickAnchors(extractKickSlots(mutated))
```

- [ ] **Step 5: Add the regression test**

In `GeneratorOrchestrator.test.ts` (main describe block):

```ts
  it('freeplay drum patterns keep the genre skeleton (loud snares present)', async () => {
    const spy = vi.spyOn((orchestrator as any).drum, 'loadGeneratedPattern')
    await orchestrator.start(90)   // startup sub-genre is boom-bap (commit 9d9eb4fc)
    const hits = spy.mock.calls[spy.mock.calls.length - 1][0] as Array<{ instrument: string; time: string; velocity: number }>
    const snareSlots = hits
      .filter(h => h.instrument === 'snare' && h.velocity > 0.4 && h.time.startsWith('0:'))
      .map(h => { const [, beat, sub] = h.time.split(':').map(parseFloat); return beat * 4 + Math.floor(sub) })
    // boom-bap skeleton snares (2 and 4). If the harness starts on another
    // sub-genre, assert that genre's SKELETONS entry instead — don't delete.
    expect(snareSlots).toContain(4)
    expect(snareSlots).toContain(12)
  })
```

- [ ] **Step 6: Run all checks**

Run: `npm run check` then `npm run test:unit`
Expected: both pass. Watch specifically `DrumGenerator.test.ts` ("keeps snare backbeats…") and existing orchestrator tests — they must stay green (they feed explicit patterns, bypassing freeplay, so they should).

- [ ] **Step 7: Commit**

```bash
git add client/src/organism/generators
git commit -m "feat(freeplay): drums improvise around the genre skeleton by default"
```

- [ ] **Step 8: 🔊 BY-EAR GATE — STOP**

Tell the user: "Drum freeplay is in. Listen for: boom-bap still sounds boom-bap (snare 2&4), hats breathe with the section, a fill turns the corner every 4 bars, and the beat no longer feels like a photocopied loop. Also confirm the bass still locks (it now follows the improvised kicks)." Wait for verdict before Task 6.

---

## Task 6: ChordImproviser (pure)

**Files:**
- Create: `client/src/organism/generators/freeplay/ChordImproviser.ts`
- Test: `client/src/organism/generators/freeplay/__tests__/ChordImproviser.test.ts`

**Interfaces:**
- Consumes: Task 1
- Produces: `CompEvent { time: string; dur: string; vel: number; useNextVoicing?: boolean }`, `buildFreeplayCompPlan(ctx: FreeplayContext): CompEvent[]`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/organism/generators/freeplay/__tests__/ChordImproviser.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildFreeplayCompPlan, clearCompCounters } from '../ChordImproviser'
import { clearMotifs } from '../motif'
import { mulberry32, hashString } from '../utils'
import type { FreeplayContext } from '../types'

function ctx(overrides: Partial<FreeplayContext> = {}): FreeplayContext {
  return {
    rootMidi: 60, chordIntervals: [0, 3, 7], bars: 1, swing: 0.3,
    subGenre: 'boom-bap', energy: 0.6, density: 0.6,
    sectionName: 'verse', motifSeed: hashString('chord:verse'),
    kickTimes16ths: [], rng: mulberry32(21),
    ...overrides,
  }
}

const slotOf = (t: string) => {
  const [, beat, sub] = t.split(':').map(parseFloat)
  return beat * 4 + Math.floor(sub)
}

describe('ChordImproviser', () => {
  beforeEach(() => { clearMotifs(); clearCompCounters() })

  it('low energy → one sustained pad covering the bar', () => {
    const plan = buildFreeplayCompPlan(ctx({ energy: 0.2 }))
    expect(plan).toHaveLength(1)
    expect(plan[0].time).toBe('0:0:0.00')
    expect(plan[0].dur).toBe('1m')
  })

  it('comp events avoid the backbeat slots (4 and 12) — leave room for the snare', () => {
    for (let seed = 0; seed < 10; seed++) {
      clearMotifs()
      const plan = buildFreeplayCompPlan(ctx({ energy: 0.6, rng: mulberry32(seed) }))
      for (const ev of plan) {
        expect([4, 12]).not.toContain(slotOf(ev.time))
      }
    }
  })

  it('high energy → stabs plus an anticipation of the NEXT chord', () => {
    const plan = buildFreeplayCompPlan(ctx({ energy: 0.9 }))
    expect(plan.length).toBeGreaterThanOrEqual(3)
    const anticipation = plan.find(e => e.useNextVoicing)
    expect(anticipation).toBeDefined()
    expect(slotOf(anticipation!.time)).toBe(15)
  })

  it('same section repeats the same comp rhythm (mostly) — motif memory', () => {
    const p1 = buildFreeplayCompPlan(ctx({ rng: mulberry32(8) }))
    const p2 = buildFreeplayCompPlan(ctx({ rng: mulberry32(9) }))
    const times = (p: typeof p1) => p.filter(e => !e.useNextVoicing).map(e => e.time).sort()
    // calls 1 and 2 of a section = A and A (variation only every 3rd call)
    expect(times(p2)).toEqual(times(p1))
  })

  it('velocities stay in a comping range (never louder than the lead)', () => {
    const plan = buildFreeplayCompPlan(ctx({ energy: 1 }))
    for (const ev of plan) {
      expect(ev.vel).toBeLessThanOrEqual(0.7)
      expect(ev.vel).toBeGreaterThanOrEqual(0.3)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/freeplay/__tests__/ChordImproviser.test.ts --reporter=dot`
Expected: FAIL — cannot resolve `../ChordImproviser`.

- [ ] **Step 3: Write the implementation**

```ts
// client/src/organism/generators/freeplay/ChordImproviser.ts
// Freeplay comping: WHEN and HOW to hit — never WHAT pitches (the Conductor's
// voicing owns the notes; ChordGenerator maps this plan onto it).

import type { FreeplayContext } from './types'
import { getSectionMotif, varyMotif, type RhythmMotif } from './motif'
import { swungTime } from './utils'

export interface CompEvent {
  time: string
  dur: string
  vel: number
  /** Anticipation: render with the NEXT chord's voicing (pickup into the change). */
  useNextVoicing?: boolean
}

// Per-section call counter → A-A-A'-A across successive 1-bar rebuilds.
const compCounters = new Map<string, number>()

const BACKBEAT = new Set([4, 12])

export function buildFreeplayCompPlan(ctx: FreeplayContext): CompEvent[] {
  // Low energy: one pad, whole bar. Space is comping too.
  if (ctx.energy < 0.4) {
    return [{ time: swungTime(0, 0, ctx.swing), dur: '1m', vel: 0.5 }]
  }

  const key = `chord:${ctx.sectionName}:${ctx.subGenre}`
  const motif = getSectionMotif(key, ctx.rng, Math.min(ctx.density, 0.5), [0])
  const count = (compCounters.get(key) ?? 0) + 1
  compCounters.set(key, count)

  // Every 3rd bar gets the single bounded variation (A-A-A'), else the motif.
  const mask: RhythmMotif = count % 3 === 0 ? varyMotif(motif, ctx.rng) : motif
  const slots = mask.slots.filter(s => !BACKBEAT.has(s)).slice(0, ctx.energy > 0.7 ? 4 : 3)

  const events: CompEvent[] = slots.map((slot, i) => ({
    time: swungTime(0, slot, ctx.swing),
    dur: ctx.energy > 0.7 ? '8n' : slot === 0 ? '2n' : '4n',
    vel: Math.min(0.7, Math.max(0.3, (slot === 0 ? 0.6 : 0.48) - i * 0.02)),
  }))

  // High energy: pickup into the next chord on the final swung 16th.
  if (ctx.energy > 0.7) {
    events.push({ time: swungTime(0, 15, ctx.swing), dur: '16n', vel: 0.42, useNextVoicing: true })
  }

  return events
}

/** Reset the A-A-A' counters (orchestrator cold start). */
export function clearCompCounters(): void {
  compCounters.clear()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/freeplay --reporter=dot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/freeplay
git commit -m "feat(freeplay): chord improviser — comp plans that leave room for the backbeat"
```

---

## Task 7: Chord integration (ChordGenerator)

**Files:**
- Modify: `client/src/organism/generators/ChordGenerator.ts`
- Modify: `client/src/organism/generators/GeneratorOrchestrator.ts` (setter + counter reset)

**Interfaces:**
- Consumes: `buildFreeplayCompPlan`, `CompEvent`, `clearCompCounters` (Task 6)
- Produces: `ChordGenerator.setFreeplay(enabled: boolean): void`, `GeneratorOrchestrator.setChordFreeplay(enabled: boolean): void`

- [ ] **Step 1: ChordGenerator freeplay branch**

1a. Imports:

```ts
import { buildFreeplayCompPlan } from './freeplay/ChordImproviser'
import { hashString, mulberry32 } from './freeplay/utils'
```

1b. Fields near `private currentTechniqueId: string = DEFAULT_TECHNIQUE_ID` (line ~86):

```ts
  // ── Freeplay (spec 2026-07-02) ── comp plans instead of a fixed technique.
  private freeplayEnabled = true
  private freeplayCallCounter = 0
```

1c. Public setter near `setTechnique` (line ~101):

```ts
  /** Freeplay on/off. Entering freeplay resets to the default (humanised
   *  block) renderer so a stale technique doesn't restyle the comp plan. */
  setFreeplay(enabled: boolean): void {
    if (this.freeplayEnabled === enabled) return
    this.freeplayEnabled = enabled
    if (enabled) this.currentTechniqueId = DEFAULT_TECHNIQUE_ID
    this.rebuildPart()
  }
```

1d. In `rebuildPart()` (line ~511): the behavior switch starting `switch (this.currentBehavior) {` at line ~554 fills `const events: ChordPartEvent[] = []`. Wrap it:

```ts
    if (this.freeplayEnabled) {
      // Energy from the current behavior — the behavior resolver already maps
      // organism state to intensity, so reuse it instead of a second signal.
      const energy = this.currentBehavior === ChordBehavior.Pad ? 0.3
        : this.currentBehavior === ChordBehavior.Stab ? 0.85 : 0.6
      const seed = hashString(`chord:${this.currentSectionName}`)
      const plan = buildFreeplayCompPlan({
        rootMidi: 60, chordIntervals: parsedCurrent.intervals ?? [0, 4, 7],
        bars: 1,
        swing: this.currentSwing,
        subGenre: 'none',
        energy,
        density: energy,
        sectionName: this.currentSectionName,
        motifSeed: seed,
        kickTimes16ths: [],
        rng: mulberry32(seed + this.freeplayCallCounter++),
      })
      for (const ev of plan) {
        const notes = ev.useNextVoicing
          ? conductor.nextVoicing().inner.map((m) => Tone.Frequency(m, 'midi').toNote())
          : noteStrings
        events.push({ time: ev.time, notes, dur: ev.dur, vel: ev.vel, chordIdx: 0 })
      }
    } else {
      switch (this.currentBehavior) {
        // ... existing switch body UNCHANGED (Pad / Rhythm / Stab cases) ...
      }
    }
```

Keep the `ChordBehavior.Silent` early-return above it untouched — freeplay respects Silent.
NOTE: `parsedCurrent` and `noteStrings` are already defined above in this method (lines ~531 and ~550); `conductor` at ~530.

- [ ] **Step 2: Orchestrator setter + counter reset**

In `GeneratorOrchestrator.ts`:

```ts
import { clearCompCounters } from './freeplay/ChordImproviser'
```

Next to `setBassFreeplay`:

```ts
  /** Freeplay switch — chords comp freely vs a named technique. */
  setChordFreeplay(enabled: boolean): void {
    this.chord.setFreeplay(enabled)
  }
```

And in `start()` next to the Task 3 `clearMotifs()` call, add `clearCompCounters()`.

- [ ] **Step 3: Run all checks**

Run: `npm run check` then `npm run test:unit`
Expected: both pass. If a ChordGenerator test asserted specific Pad/Rhythm event shapes, it may now hit the freeplay branch — fix by calling `gen.setFreeplay(false)` in that test's setup (the authored path must stay exactly as it was).

- [ ] **Step 4: Commit**

```bash
git add client/src/organism/generators
git commit -m "feat(freeplay): chords comp freely from the Conductor voicing by default"
```

- [ ] **Step 5: 🔊 BY-EAR GATE — STOP**

Tell the user: "Chord freeplay is in — full freeplay band now. Listen for: chords staying out of the snare's way, anticipation pickups into chord changes at high energy, pads when the section is calm. And the big one: does the band finally sound like it knows what it's playing?" Wait for verdict before Task 8.

---

## Task 8: UI — Freeplay in the PLAYING STYLE panel

**Files:**
- Modify: `client/src/features/organism/OrganismCommandCenter.tsx`

**Interfaces:**
- Consumes: `orchestrator.setChordFreeplay/setBassFreeplay/setDrumFreeplay` (Tasks 3/5/7), `setChordTechnique/setBassArticulation/setMelodyArticulation` (existing)

- [ ] **Step 1: Wire the handlers**

In `OrganismCommandCenter.tsx` (state at lines ~509-515, handlers at ~523-548):

1a. Add near the state declarations:

```ts
  const FREEPLAY_ID = 'freeplay'
```

1b. Change the initial local states so the UI reflects the new engine defaults:

```ts
  const [chordTech,    setChordTechLocal]  = useState(FREEPLAY_ID)
  const [bassArt,      setBassArtLocal]    = useState(FREEPLAY_ID)
  const [drumFreeplay, setDrumFreeplayLocal] = useState(true)
```

(`melodyArt` stays exactly as it is — the melody ALREADY improvises; its dropdown selects articulation decorations and gets NO freeplay entry.)

1c. Replace the chord/bass apply handlers and add the drums toggle (the melody handler stays unchanged):

```ts
  const applyChordTech = useCallback((id: string) => {
    setChordTechLocal(id)
    if (id === FREEPLAY_ID) {
      orchestrator?.setChordFreeplay(true)
    } else {
      orchestrator?.setChordFreeplay(false)
      orchestrator?.setChordTechnique(id)
    }
  }, [orchestrator])

  const applyBassArt = useCallback((id: string) => {
    setBassArtLocal(id)
    if (id === FREEPLAY_ID) {
      orchestrator?.setBassFreeplay(true)
    } else {
      orchestrator?.setBassFreeplay(false)
      orchestrator?.setBassArticulation(id)
    }
  }, [orchestrator])

  const toggleDrumFreeplay = useCallback(() => {
    const next = !drumFreeplay
    setDrumFreeplayLocal(next)
    orchestrator?.setDrumFreeplay(next)
  }, [drumFreeplay, orchestrator])
```

1d. In the `organism:musical-state` sync effect (line ~551), guard so engine style
echoes don't kick the UI out of freeplay:

```ts
      if (chordTechnique) setChordTechLocal(prev => prev === FREEPLAY_ID ? prev : chordTechnique)
      if (bassArticulation) setBassArtLocal(prev => prev === FREEPLAY_ID ? prev : bassArticulation)
      // melodyArticulation line stays unchanged
```

- [ ] **Step 2: Add the dropdown options + drums pill**

2a. Find the chords and bass `<select>` elements (search the JSX for `applyChordTech(` and `applyBassArt(` — they'll be in `onChange` props). Leave the melody select alone. As the FIRST option of each of the two, before the mapped style options, add:

```tsx
<option value="freeplay">Freeplay (improvise)</option>
```

2b. The AUTO buttons next to each dropdown call the `reset*Override` handlers. Disable them in freeplay (a budget model: find each AUTO `<button>` adjacent to a dropdown and add):

```tsx
disabled={chordTech === FREEPLAY_ID}    // chords row
disabled={bassArt === FREEPLAY_ID}      // bass row
```

2c. In the DRUMS panel section (search the JSX for `Hat density`), add a toggle pill styled like the existing AUTO SHIFTS button:

```tsx
<button
  onClick={toggleDrumFreeplay}
  className={`px-2 py-1 rounded border text-xs ${drumFreeplay ? 'border-cyan-400 text-cyan-300' : 'border-gray-600 text-gray-400'}`}
  title="Drums improvise around the genre skeleton"
>
  Freeplay
</button>
```

(match the exact className conventions of the neighboring buttons in that file — copy a sibling button's classes rather than inventing new ones).

- [ ] **Step 3: Verify**

Run: `npm run check` then `npm run test:unit` — both pass.
Then `npm run dev`: the three dropdowns show "Freeplay (improvise)" selected by default; picking "Block Chord" makes chords play the authored technique again; picking Freeplay back re-enters improvisation; the drums Freeplay pill toggles the drum source live; AUTO buttons gray out in freeplay rows.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/organism/OrganismCommandCenter.tsx
git commit -m "feat(freeplay): Freeplay entries in PLAYING STYLE dropdowns + drums pill"
```

---

## Task 9: Final verification + handoff to the user

- [ ] **Step 1:** `npm run check` and `npm run test:unit` — full green.
- [ ] **Step 2:** With the user: `npm run dev`, full listen across presets (boom-bap, trap, lo-fi). If WebEar is connected, capture and `analyze_audio`; compare with the Task 0 baseline (clipping must not be worse; levels similar).
- [ ] **Step 3:** Report to the user what changed, and remind them: **pushing to `origin/main` deploys to production** — they push when their ears say so. Do NOT push for them.
- [ ] **Step 4:** If anything sounds wrong, the debug order is: (1) is the right improviser being called (add a temporary `console.log` in `buildDrumHits`/`generateNotes`)? (2) are kick anchors non-empty? (3) is swing arriving (log `ctx.swing`)? Fix, re-listen — never tune blind.
