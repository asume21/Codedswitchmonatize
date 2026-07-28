# Organism Variety Fix (Live-Loop Phase 1, Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the sameness — switching style away and back (lo-fi → trap → lo-fi) must produce a *fresh* cohesive beat, not a byte-identical one.

**Architecture:** The band's beat is a pure function of `(style, section, sessionSalt)`. `sessionSalt` re-rolls only on organism start, so a style round-trip within one run rebuilds the identical song cell. Fix: re-roll the salt at the single chokepoint where a genuine style change is published — `setSongCellStyle` — which already gates on "style actually changed" and already clears stale motifs. Re-rolling there is honored by the existing seed-pinning guard (a pinned/locked seed does NOT re-roll), so this is safe alongside the future Lock feature.

**Tech Stack:** TypeScript, Vitest (unit), Tone.js (runtime, not under test here).

## Global Constraints

- Draw randomness ONCE per phrase as a mask, never per-note (repo rule).
- The song cell must stay the SAME for all five generators within a section (cohesion): the fix must not fork the cell per-caller.
- A pinned seed (`setFreeplaySeed(n)` / `isSeedPinned()`) must remain reproducible — re-roll MUST no-op when a seed is pinned.
- `rerollSessionSalt()` already implements the pin-guard (`if (pinnedSeed === null) sessionSalt = randomSalt()`) — reuse it, do not re-implement.
- This slice covers ONLY the automatic style-change trigger. The explicit user "Fresh" button belongs to the Lock/Evolve/Fresh slice (a later plan).

---

### Task 1: Re-roll the session salt on a genuine style change

**Files:**
- Modify: `client/src/organism/generators/freeplay/songCell.ts` (the `setSongCellStyle` function, ~lines 66-71)
- Test: `client/src/organism/generators/freeplay/__tests__/songCell.variety.test.ts` (create)

**Interfaces:**
- Consumes: `rerollSessionSalt(): number` and `getSessionSalt(): number` and `setFreeplaySeed(seed: number | null): number` from `../utils`.
- Produces: no new exported symbols. Behavior change only: `setSongCellStyle(next)` re-rolls the salt when `next` differs from the current authoritative style AND no seed is pinned.

- [ ] **Step 1: Write the failing test**

Create `client/src/organism/generators/freeplay/__tests__/songCell.variety.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setSongCellStyle } from '../songCell'
import { getSessionSalt, setFreeplaySeed } from '../utils'

describe('setSongCellStyle variety', () => {
  beforeEach(() => {
    setFreeplaySeed(null)      // unpin so re-roll is allowed
    setSongCellStyle(null)     // reset authoritative style
  })

  it('re-rolls the session salt when the style actually changes', () => {
    setSongCellStyle('lofi')
    const saltA = getSessionSalt()
    setSongCellStyle('trap')
    const saltB = getSessionSalt()
    expect(saltB).not.toBe(saltA)   // a real change re-rolls
  })

  it('does NOT re-roll when the style is unchanged', () => {
    setSongCellStyle('lofi')
    const salt1 = getSessionSalt()
    setSongCellStyle('lofi')        // same style → early-return, no re-roll
    expect(getSessionSalt()).toBe(salt1)
  })

  it('does NOT re-roll when a seed is pinned (Lock stays reproducible)', () => {
    setFreeplaySeed(12345)          // pin
    const pinned = getSessionSalt()
    setSongCellStyle('lofi')
    setSongCellStyle('trap')
    expect(getSessionSalt()).toBe(pinned)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- songCell.variety`
Expected: FAIL — the first test asserts `saltB !== saltA` but today the salt never changes on a style switch, so `saltB === saltA`.

- [ ] **Step 3: Implement the minimal change**

In `client/src/organism/generators/freeplay/songCell.ts`, add `rerollSessionSalt` to the utils import at the top of the file:

```ts
import { rerollSessionSalt } from './utils'
```

Then modify `setSongCellStyle` so it re-rolls after confirming a genuine change (the existing early-return already filters no-ops; `rerollSessionSalt` internally no-ops when a seed is pinned):

```ts
export function setSongCellStyle(subGenre: string | null | undefined): void {
  const next = subGenre && subGenre.length > 0 ? subGenre : null
  if (next === authoritativeSubGenre) return
  authoritativeSubGenre = next
  clearMotifsByPrefix('songcell:')
  // Variety: a genuine style change gets a fresh salt so returning to a style
  // yields a NEW but still-cohesive beat instead of a byte-identical rebuild.
  // rerollSessionSalt() no-ops when a seed is pinned, so Lock stays reproducible.
  rerollSessionSalt()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- songCell.variety`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Guard against a circular import**

Confirm `utils.ts` does not import from `songCell.ts` (it must not, or the new import creates a cycle):

Run: `grep -n "songCell" client/src/organism/generators/freeplay/utils.ts || echo "no cycle"`
Expected: `no cycle`.

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: no new errors in `songCell.ts`.

- [ ] **Step 7: Commit**

```bash
git add client/src/organism/generators/freeplay/songCell.ts client/src/organism/generators/freeplay/__tests__/songCell.variety.test.ts
git commit -m "fix(organism): re-roll salt on style change — kill the same-beat-every-time sameness"
```

---

### Task 2: Confirm the start path still re-rolls exactly once (regression guard)

**Files:**
- Read only: `client/src/organism/generators/GeneratorOrchestrator.ts` (lines ~476 `setSongCellStyle(startSubGenre)` and ~496 `rerollSessionSalt()`)

**Interfaces:**
- Consumes: nothing new. This task verifies Task 1 did not introduce a harmful double-reroll on start.

- [ ] **Step 1: Trace the start ordering**

On organism start, `setSongCellStyle(startSubGenre)` (line ~476) now also re-rolls (null → startSubGenre is a genuine change), and `rerollSessionSalt()` still runs at line ~496. Two re-rolls on start is harmless (the later one wins, and start is meant to produce a fresh salt). Confirm no code between them reads the salt expecting the first value.

Run: `grep -n "getSessionSalt\|rerollSessionSalt\|setSongCellStyle" client/src/organism/generators/GeneratorOrchestrator.ts`
Expected: no `getSessionSalt()` read sits between the `setSongCellStyle(startSubGenre)` call and the `rerollSessionSalt()` call. (If one does, it would read a now-different intermediate salt — flag it. Based on current code, the salt is consumed by generators later, after both calls.)

- [ ] **Step 2: No code change needed — record the finding**

If Step 1 shows no intervening read (expected), this task is complete with no edit. If it shows one, STOP and report before proceeding — the start seed-logging (`[Organism] freeplay seed ...`) must still print the salt the beat actually uses.

---

## Manual (ear) acceptance — run after Task 1

This is the user's real acceptance test:

1. `npm run dev`, open the organism, Start.
2. Pick a lo-fi preset → let a beat play. Note it.
3. Switch to a trap preset. Switch back to lo-fi.
4. **Expected:** the lo-fi beat is recognizably lo-fi but a DIFFERENT take — not the same beat as step 2.
5. Sanity: pin a seed in the console (`setFreeplaySeed(1)`), repeat steps 2-4 → the beat should now be reproducible (Lock behavior unaffected).

## Self-Review

- **Spec coverage:** Implements the addendum's "Variety fix (independent, ship FIRST)" — style-change trigger only; the explicit Fresh action is correctly deferred to the Lock/Evolve/Fresh slice. ✓
- **Placeholders:** none — full test + implementation code shown. ✓
- **Type consistency:** uses existing `rerollSessionSalt` / `getSessionSalt` / `setFreeplaySeed` signatures from `utils.ts` verbatim. ✓
- **Pin-guard:** re-roll routed through `rerollSessionSalt`, which already no-ops on a pinned seed — Lock stays reproducible. ✓
