# Make the Melody Sound Like a Melody — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Organism's in-key-but-noodling melody into an actual tune by adding time-structure (commit-and-develop one motif, a phrase arc with strong-beat chord tones + climax + cadence) and formalizing the line as a timbre-agnostic stream.

**Architecture:** Extract the melodic "brain" into three PURE, unit-testable modules under `client/src/organism/generators/melody/` (no Tone.js, no Conductor singleton). `MelodyGenerator.generatePhrase` becomes a thin orchestrator that gathers harmony from the Conductor, calls these pure functions, and schedules the result via the existing Tone.Part path.

**Tech Stack:** TypeScript, Vitest (`npm run test:unit`), Tone.js (only in the generator, not the new pure modules).

**Spec:** `docs/superpowers/specs/2026-06-16-melody-as-melody-design.md`

**Reference types (already exist):**
- `MotifStep { index: number; isChordTone: boolean; dur16ths: number }` and `MelodyMotif { name: string; steps: MotifStep[] }` — `client/src/organism/generators/patterns/MelodyPatternLibrary.ts:62,73`
- `ScheduledNote { pitch: string; duration: string; velocity: number; time: string }` — `client/src/organism/generators/types.ts:53`
- `HIP_HOP_MOTIFS: Record<string, MelodyMotif[]>` (banks: `arps`, `ostinatos`, `fills`) — `MelodyPatternLibrary.ts:78`
- `generatePhrase(length16ths, physics): ScheduledNote[]` — `MelodyGenerator.ts:815`; inner closure `renderMotif(m, cursorStart, transposeOct)` at `:876`; chord-degree mapping `chordDegs` at `:840`.

---

## File Structure

- **Create** `client/src/organism/generators/melody/melodyMotif.ts` — motif development (pure). Responsibility: transform ONE motif into related variations.
- **Create** `client/src/organism/generators/melody/melodyPhrase.ts` — phrase shaping (pure). Responsibility: strong-beat detection, chord-tone snapping, contour curve, cadence step.
- **Create** `client/src/organism/generators/melody/melodyVoice.ts` — voice assignment (pure). Responsibility: deterministic section→instrument pick.
- **Create** tests for each under `client/src/organism/generators/melody/__tests__/`.
- **Modify** `client/src/organism/generators/MelodyGenerator.ts` — `generatePhrase` (motif commitment+development, strong-beat/contour/cadence), `onSectionChange` (section base-motif + optional voice hand-off), add `melodySectionHandoffEnabled` flag + `currentSectionMotif` field.

---

## Task 1: Motif development module (pure)

**Files:**
- Create: `client/src/organism/generators/melody/melodyMotif.ts`
- Test: `client/src/organism/generators/melody/__tests__/melodyMotif.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// melodyMotif.test.ts
import { describe, expect, it } from 'vitest'
import type { MelodyMotif } from '../../patterns/MelodyPatternLibrary'
import { developMotif, pickPhraseVariations } from '../melodyMotif'

const base: MelodyMotif = { name: 'test', steps: [
  { index: 0, isChordTone: true, dur16ths: 2 },
  { index: 2, isChordTone: true, dur16ths: 2 },
  { index: 1, isChordTone: true, dur16ths: 4 },
] }

describe('developMotif', () => {
  it('identity returns the same step indices and durations', () => {
    const out = developMotif(base, 'identity')
    expect(out.steps.map(s => s.index)).toEqual([0, 2, 1])
    expect(out.steps.map(s => s.dur16ths)).toEqual([2, 2, 4])
  })
  it('transpose shifts every index by amount', () => {
    expect(developMotif(base, 'transpose', 2).steps.map(s => s.index)).toEqual([2, 4, 3])
  })
  it('invert mirrors indices around the first step', () => {
    // mirror around 0: 0->0, 2->-2, 1->-1
    expect(developMotif(base, 'invert').steps.map(s => s.index)).toEqual([0, -2, -1])
  })
  it('augment doubles durations; diminish halves them', () => {
    expect(developMotif(base, 'augment').steps.map(s => s.dur16ths)).toEqual([4, 4, 8])
    expect(developMotif(base, 'diminish').steps.map(s => s.dur16ths)).toEqual([1, 1, 2])
  })
  it('does not mutate the input motif', () => {
    developMotif(base, 'transpose', 5)
    expect(base.steps[0].index).toBe(0)
  })
})

describe('pickPhraseVariations', () => {
  it('always states the theme first (identity) then develops it', () => {
    const v = pickPhraseVariations(0, 4)
    expect(v).toHaveLength(4)
    expect(v[0]).toBe('identity')
  })
  it('is deterministic for a given seed', () => {
    expect(pickPhraseVariations(7, 4)).toEqual(pickPhraseVariations(7, 4))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/melodyMotif.test.ts`
Expected: FAIL — "Cannot find module '../melodyMotif'".

- [ ] **Step 3: Write minimal implementation**

```ts
// melodyMotif.ts
import type { MelodyMotif, MotifStep } from '../patterns/MelodyPatternLibrary'

export type MotifVariation = 'identity' | 'transpose' | 'invert' | 'augment' | 'diminish'

/** Return a NEW motif that is the base idea, transformed. Never mutates `base`. */
export function developMotif(base: MelodyMotif, variation: MotifVariation, amount = 0): MelodyMotif {
  const first = base.steps[0]?.index ?? 0
  const steps: MotifStep[] = base.steps.map((s) => {
    switch (variation) {
      case 'transpose': return { ...s, index: s.index + amount }
      case 'invert':    return { ...s, index: 2 * first - s.index }
      case 'augment':   return { ...s, dur16ths: s.dur16ths * 2 }
      case 'diminish':  return { ...s, dur16ths: Math.max(1, s.dur16ths / 2) }
      case 'identity':
      default:          return { ...s }
    }
  })
  return { name: `${base.name}:${variation}`, steps }
}

/**
 * A phrase = the theme stated, then developed. Index 0 is always 'identity'
 * (state the catchphrase) so the listener has something to recognize coming back.
 * Deterministic given the seed.
 */
export function pickPhraseVariations(seed: number, phraseCount: number): MotifVariation[] {
  const cycle: MotifVariation[] = ['transpose', 'identity', 'invert', 'augment']
  const out: MotifVariation[] = []
  for (let i = 0; i < phraseCount; i++) {
    out.push(i === 0 ? 'identity' : cycle[(i - 1 + seed) % cycle.length])
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/melodyMotif.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/melody/melodyMotif.ts client/src/organism/generators/melody/__tests__/melodyMotif.test.ts
git commit -m "feat(melody): pure motif-development module (commit-and-develop one idea)"
```

---

## Task 2: Phrase shaping module (pure)

**Files:**
- Create: `client/src/organism/generators/melody/melodyPhrase.ts`
- Test: `client/src/organism/generators/melody/__tests__/melodyPhrase.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// melodyPhrase.test.ts
import { describe, expect, it } from 'vitest'
import { isStrongBeat, resolveDegreeForBeat, contourOffset, cadenceStep } from '../melodyPhrase'

describe('isStrongBeat', () => {
  it('is true on beat 1 and beat 3 downbeats, false elsewhere', () => {
    expect(isStrongBeat(0)).toBe(true)   // bar:0 beat:0 sub:0
    expect(isStrongBeat(8)).toBe(true)   // beat:2 sub:0
    expect(isStrongBeat(4)).toBe(false)  // beat:1 sub:0
    expect(isStrongBeat(2)).toBe(false)  // off-16th
  })
})

describe('resolveDegreeForBeat', () => {
  const chordDegs = [0, 2, 4] // root/3rd/5th scale degrees, 7-note scale
  it('snaps to the nearest chord tone on strong beats', () => {
    expect(resolveDegreeForBeat(3, chordDegs, 7, true)).toBe(2) // 3 -> nearest chord deg (2 or 4) -> 2
    expect(resolveDegreeForBeat(1, chordDegs, 7, true)).toBe(0)
  })
  it('leaves the degree untouched on weak beats (passing tones allowed)', () => {
    expect(resolveDegreeForBeat(3, chordDegs, 7, false)).toBe(3)
  })
  it('preserves octave region when snapping', () => {
    expect(resolveDegreeForBeat(10, chordDegs, 7, true)).toBe(9) // 10 = oct1+deg3 -> oct1+deg2 = 9
  })
})

describe('contourOffset', () => {
  it('peaks near 2/3 through the phrase and is ~0 at the ends', () => {
    expect(contourOffset(0, 3)).toBe(0)
    expect(contourOffset(1, 3)).toBe(0)
    expect(contourOffset(0.66, 3)).toBeGreaterThan(contourOffset(0.2, 3))
  })
})

describe('cadenceStep', () => {
  it('lands on the chord root (index 0, chord tone) held long', () => {
    const s = cadenceStep()
    expect(s.index).toBe(0)
    expect(s.isChordTone).toBe(true)
    expect(s.dur16ths).toBeGreaterThanOrEqual(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/melodyPhrase.test.ts`
Expected: FAIL — "Cannot find module '../melodyPhrase'".

- [ ] **Step 3: Write minimal implementation**

```ts
// melodyPhrase.ts
import type { MotifStep } from '../patterns/MelodyPatternLibrary'

/** A 16th-grid cursor lands on a downbeat (beat 1 or 3, on the beat). */
export function isStrongBeat(cursor16: number): boolean {
  const inBar = ((cursor16 % 16) + 16) % 16
  const beat = Math.floor(inBar / 4)
  const sub = inBar % 4
  return sub === 0 && (beat === 0 || beat === 2)
}

/** Nearest chord-tone scale-degree to `deg`, preserving deg's octave region. */
export function nearestChordDegree(deg: number, chordDegs: number[], scaleLen: number): number {
  if (chordDegs.length === 0) return deg
  const oct = Math.floor(deg / scaleLen)
  const within = ((deg % scaleLen) + scaleLen) % scaleLen
  let best = chordDegs[0]
  let bestDist = Infinity
  for (const c of chordDegs) {
    const d = Math.abs(c - within)
    if (d < bestDist) { bestDist = d; best = c }
  }
  return oct * scaleLen + best
}

/** Strong beats MUST be chord tones (stable); weak beats may be passing tones. */
export function resolveDegreeForBeat(deg: number, chordDegs: number[], scaleLen: number, strong: boolean): number {
  return strong ? nearestChordDegree(deg, chordDegs, scaleLen) : deg
}

/** Arch curve: rises to a single climax ~2/3 through, falls back to ~0 at the end. */
export function contourOffset(posFraction: number, intensity: number): number {
  const peak = 0.66
  const x = posFraction <= peak ? posFraction / peak : 1 - (posFraction - peak) / (1 - peak)
  return Math.round(intensity * Math.max(0, x))
}

/** The "period" at the end of the sentence: resolve to the chord root, held. */
export function cadenceStep(dur16ths = 4): MotifStep {
  return { index: 0, isChordTone: true, dur16ths }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/melodyPhrase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/melody/melodyPhrase.ts client/src/organism/generators/melody/__tests__/melodyPhrase.test.ts
git commit -m "feat(melody): pure phrase-shaping (strong-beat chord tones, contour, cadence)"
```

---

## Task 3: Voice assignment module (pure)

**Files:**
- Create: `client/src/organism/generators/melody/melodyVoice.ts`
- Test: `client/src/organism/generators/melody/__tests__/melodyVoice.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// melodyVoice.test.ts
import { describe, expect, it } from 'vitest'
import { assignMelodyVoice } from '../melodyVoice'

const pool = ['piano', 'strings', 'sax'] as unknown as Parameters<typeof assignMelodyVoice>[2]

describe('assignMelodyVoice', () => {
  it('is deterministic for a section + seed', () => {
    expect(assignMelodyVoice('chorus', 3, pool)).toBe(assignMelodyVoice('chorus', 3, pool))
  })
  it('can pick different voices for different sections', () => {
    const verse = assignMelodyVoice('verse', 3, pool)
    const chorus = assignMelodyVoice('chorus', 3, pool)
    // not guaranteed different, but both must be from the pool
    expect(pool).toContain(verse)
    expect(pool).toContain(chorus)
  })
  it('returns null when no instrument is available', () => {
    expect(assignMelodyVoice('verse', 1, [] as unknown as typeof pool)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/melodyVoice.test.ts`
Expected: FAIL — "Cannot find module '../melodyVoice'".

- [ ] **Step 3: Write minimal implementation**

```ts
// melodyVoice.ts
import type { InstrumentPerformerId } from '../../performers'

/**
 * Deterministic section -> instrument pick. Lets the lead hand off between
 * sections (piano verse -> strings chorus). Returns null if no voice is available
 * (caller keeps the current voice). Pure: no side effects.
 */
export function assignMelodyVoice(
  section: string,
  seed: number,
  available: InstrumentPerformerId[],
): InstrumentPerformerId | null {
  if (available.length === 0) return null
  let h = seed >>> 0
  for (let i = 0; i < section.length; i++) h = (Math.imul(h, 31) + section.charCodeAt(i)) >>> 0
  return available[h % available.length]
}
```

> Import path verified: `InstrumentPerformerId` is exported from `client/src/organism/performers` (imported in `MelodyGenerator.ts:34` as `from '../performers'`). From `generators/melody/` that is `../../performers`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/melody/__tests__/melodyVoice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/melody/melodyVoice.ts client/src/organism/generators/melody/__tests__/melodyVoice.test.ts
git commit -m "feat(melody): pure voice-assignment for section instrument hand-off"
```

---

## Task 4: Commit-and-develop ONE motif per phrase (replace motif salad)

**Files:**
- Modify: `client/src/organism/generators/MelodyGenerator.ts` (`generatePhrase` ~`:815`, fields near `:58-70`)

- [ ] **Step 1: Add fields for the committed motif (near the other phrase fields, ~`:67`)**

```ts
  // The ONE motif the current section commits to. Developed (transpose/invert/
  // augment) across the phrase instead of swapping to a different bank entry —
  // that "motif salad" was why the line never cohered into a recognizable tune.
  private currentSectionMotif: import('./patterns/MelodyPatternLibrary').MelodyMotif | null = null
```

- [ ] **Step 2: Add imports at the top of the file (with the other generator imports)**

```ts
import { developMotif, pickPhraseVariations } from './melody/melodyMotif'
```

- [ ] **Step 3: Pick + commit the base motif inside `generatePhrase`, replacing the per-iteration bank lookup**

In `generatePhrase`, the current motif bank selection (~`:834-837`) chooses a bank; KEEP the bank choice, but pick ONE base motif and reuse it. Replace the loop body's `const motif = motifBank[(chordSeed + phraseIndex) % motifBank.length]` (~`:974-975`) with a developed variation of the committed motif:

```ts
    // Commit to ONE motif for this phrase (picked once), then DEVELOP it.
    if (!this.currentSectionMotif) {
      this.currentSectionMotif = motifBank[chordSeed % motifBank.length]
    }
    const baseMotif = this.currentSectionMotif
    const variations = pickPhraseVariations(this.sessionSeed + chordSeed, maxIterations)
```

Then inside the `while` loop, replace the motif selection lines with:

```ts
      const variation = variations[phraseIndex] ?? 'identity'
      const transposeAmount = variation === 'transpose' ? 1 + (chordSeed % 3) : 0
      const motif = developMotif(baseMotif, variation, transposeAmount)
      const transposeOct = this.currentBehavior === MelodyBehavior.Lead && phraseIndex % 4 === 3 ? 1 : 0
      const result = renderMotif(motif, cursor, transposeOct)
```

(Delete the old `const motifIdx = ...` / `const motif = motifBank[motifIdx]` / `const transposeOct = ...` lines this replaces.)

- [ ] **Step 4: Reset the committed motif when the phrase context changes**

At the end of `generatePhrase` (just before `return notes`), the existing code clears phrase state. Add a one-time reset hook so a NEW section picks a fresh motif (Task 6 wires `onSectionChange` to null it; this step just ensures the field is honored). No code change needed here if `currentSectionMotif` is only nulled in `onSectionChange` — leave a comment:

```ts
    // NOTE: currentSectionMotif persists across phrase refreshes WITHIN a section
    // (that's the point — the idea recurs). onSectionChange() nulls it so the next
    // section commits to a fresh motif. See Task 6.
```

- [ ] **Step 5: Run the existing MelodyGenerator suite + type check**

Run: `npx vitest run client/src/organism/generators/__tests__/MelodyGenerator.test.ts && npm run check`
Expected: PASS, tsc clean. (If a test asserted the old motif-salad behavior, update it to assert the developed-motif behavior — a phrase should now reuse one recognizable motif shape.)

- [ ] **Step 6: Commit**

```bash
git add client/src/organism/generators/MelodyGenerator.ts client/src/organism/generators/__tests__/MelodyGenerator.test.ts
git commit -m "feat(melody): commit to one motif per phrase and develop it (kills motif salad)"
```

---

## Task 5: Strong-beat chord tones + contour + cadence in the phrase

**Files:**
- Modify: `client/src/organism/generators/MelodyGenerator.ts` (`renderMotif` closure ~`:876-963`, phrase tail ~`:985`)

- [ ] **Step 1: Import the phrase-shaping helpers (top of file)**

```ts
import { isStrongBeat, resolveDegreeForBeat, contourOffset, cadenceStep } from './melody/melodyPhrase'
```

- [ ] **Step 2: Apply strong-beat targeting + contour where `degIndex` is computed in `renderMotif`**

In `renderMotif`, after `degIndex` is computed (~`:882-891`) and BEFORE `const pitch = degreeToPitch(degIndex, transposeOct)`, insert:

```ts
        // Phrase arc: bias the line upward toward a single climax ~2/3 in...
        const posFraction = length16ths > 0 ? c / length16ths : 0
        degIndex += contourOffset(posFraction, 2)
        // ...and make the note that lands on a downbeat a CHORD TONE (stable),
        // leaving passing/neighbour tones for the off-beats.
        degIndex = resolveDegreeForBeat(degIndex, chordDegs, this.currentScale.length, isStrongBeat(c))
```

(`c` is the running 16th cursor already in scope; `chordDegs` and `this.currentScale` are in scope.)

- [ ] **Step 3: Append a cadence at the end of the phrase**

After the `while` loop and the existing call/response block (~after `:990`), and BEFORE the collapse-to-single-pitch safety net (`:997`), append a resolving final note if there is room:

```ts
    // Cadence: end the sentence on the chord root, held — a "period" so the
    // phrase resolves instead of just stopping when the bar runs out.
    {
      const cad = cadenceStep(4)
      const cadCursor = Math.max(0, length16ths - cad.dur16ths)
      const cadResult = renderMotif({ name: 'cadence', steps: [cad] }, cadCursor, 0)
      notes.push(...cadResult.out)
    }
```

- [ ] **Step 4: Add a phrase-shape unit test (integration-level, via the generator)**

Add to `client/src/organism/generators/__tests__/MelodyGenerator.test.ts` a test that the last scheduled note resolves to a chord tone. Use the generator's public surface as other tests in that file do (follow the existing harness there — check how it instantiates the generator and reads notes; mirror that). Skeleton:

```ts
it('ends each phrase on a resolving chord tone (cadence)', () => {
  // ...instantiate as the other tests do, drive one phrase, read scheduled notes...
  // assert the final note's pitch class is one of the current chord tones.
})
```

> If the test file has no easy hook to read scheduled notes, assert at the pure level instead: that `cadenceStep().index === 0 && cadenceStep().isChordTone` (already covered in Task 2) and rely on the by-ear check in Task 7. Do NOT leave a non-compiling test.

- [ ] **Step 5: Run tests + type check**

Run: `npx vitest run client/src/organism/generators/__tests__/MelodyGenerator.test.ts && npm run check`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add client/src/organism/generators/MelodyGenerator.ts client/src/organism/generators/__tests__/MelodyGenerator.test.ts
git commit -m "feat(melody): phrase arc — strong-beat chord tones, climax contour, cadence"
```

---

## Task 6: Section base-motif (chorus contrast) + optional voice hand-off

**Files:**
- Modify: `client/src/organism/generators/MelodyGenerator.ts` (`onSectionChange` ~`:432-451`, fields)

- [ ] **Step 1: Add the hand-off flag (default OFF) near the other fields**

```ts
  // Section instrument hand-off (piano verse -> strings chorus) is built but OFF
  // by default: timbre variety only pays off once the LINE is good, and we don't
  // want to debug a jumping voice while the note logic is still settling.
  private melodySectionHandoffEnabled = false
```

- [ ] **Step 2: Import voice assignment (top of file)**

```ts
import { assignMelodyVoice } from './melody/melodyVoice'
```

- [ ] **Step 3: In `onSectionChange`, drop the committed motif so the new section commits fresh, biasing the chorus/hook to a contrasting bank**

Inside `onSectionChange` (after `this.scaleDirty = true` ~`:443`), add:

```ts
    // New section -> commit to a FRESH motif. Chorus/hook gets a deliberately
    // contrasting bank (fills = bigger, more active) so the song has shape
    // section-to-section; everything else uses the smoother ostinato/arp banks.
    this.currentSectionMotif = null
    const isHook = /chorus|hook|drop/i.test(_sectionName)
    this.preferredMotifBankKey = isHook ? 'fills' : null  // null = existing default choice

    if (this.melodySectionHandoffEnabled) {
      const voice = assignMelodyVoice(_sectionName, this.sessionSeed, this.availablePerformerIds())
      if (voice && voice !== this.explicitPerformerId) this.setInstrumentPerformer(voice)
    }
```

- [ ] **Step 4: Add the supporting field + helper, and honor `preferredMotifBankKey` in `generatePhrase`**

Add field near the others:

```ts
  private preferredMotifBankKey: string | null = null
```

Add a helper method (near `setInstrumentPerformer`):

```ts
  /** Performer ids the melody may hand off to. Stub returns the current one only
   *  until a richer catalog is wired; keeps hand-off safe + deterministic. */
  private availablePerformerIds(): import('../performers').InstrumentPerformerId[] {
    return this.explicitPerformerId ? [this.explicitPerformerId] : []
  }
```

In `generatePhrase`, where the bank is chosen (~`:834-837`), honor the preferred key:

```ts
    let motifBank: MelodyMotif[] = HIP_HOP_MOTIFS.ostinatos
    if (this.preferredMotifBankKey && HIP_HOP_MOTIFS[this.preferredMotifBankKey]) {
      motifBank = HIP_HOP_MOTIFS[this.preferredMotifBankKey]
    } else if (!this.voiceActive) {
      motifBank = chordSeed > 5 ? HIP_HOP_MOTIFS.arps : HIP_HOP_MOTIFS.fills
    }
```

- [ ] **Step 5: Run tests + type check**

Run: `npx vitest run client/src/organism/generators/__tests__/MelodyGenerator.test.ts && npm run check`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add client/src/organism/generators/MelodyGenerator.ts
git commit -m "feat(melody): fresh motif per section + chorus contrast; voice hand-off (default off)"
```

---

## Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole unit suite**

Run: `npm run test:unit`
Expected: all suites green (the 3 new melody suites + existing 65 files).

- [ ] **Step 2: Type check**

Run: `npm run check`
Expected: tsc clean (no output).

- [ ] **Step 3: By-ear check in the running app**

Run: `npm run dev` (client 5001 / API 4001). Open `localhost:5001`, start the Organism, and confirm:
- a short idea (motif) recurs and is recognizable within a section (not new every 2 bars),
- the line breathes (rests), builds to a high point, and **lands/resolves** at phrase ends,
- chorus/hook sections feel bigger than verses,
- (optional) flip `melodySectionHandoffEnabled = true` and confirm the lead can change instrument between sections without breaking the line.

- [ ] **Step 4: Final commit if any test files were adjusted**

```bash
git add -A
git commit -m "test(melody): verify melody redesign suite green"
```

---

## Self-Review (completed)

- **Spec coverage:** §1 motif commit+develop → Tasks 1,4. §1 unity-within / contrast-across → Task 6. §2 strong-beat targeting + contour + cadence → Tasks 2,5. §3 voiced stream + hand-off (default off) → Tasks 3,6. Testing → each task + Task 7. ✔
- **Placeholders:** none — every code step has real code. Task 3 and Task 5 Step 4 carry explicit "confirm the import path / mirror the existing harness" notes rather than vague TODOs, with a concrete fallback that still compiles. ✔
- **Type consistency:** `MotifVariation` (Task 1) reused in Task 4; `developMotif`/`pickPhraseVariations` (Task 1) → Task 4; `isStrongBeat`/`resolveDegreeForBeat`/`contourOffset`/`cadenceStep` (Task 2) → Task 5; `assignMelodyVoice` (Task 3) → Task 6. `currentSectionMotif`, `preferredMotifBankKey`, `melodySectionHandoffEnabled`, `availablePerformerIds()` all defined before use. ✔
