# Hold-and-Mutate Generator Parts — Bass Proof Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the "build → teardown → rebuild" crackle by making `BassGenerator` hold its looping `Tone.Part` for the whole run and mutate its events in place, instead of disposing + recreating the Part on every rebuild.

**Architecture:** Add a shared `updatePartEvents(part, events)` helper to `GeneratorBase` (`part.clear()` then `part.add(e)` per event). Split `BassGenerator.rebuildPart` into a first-build branch (create the Part once, grid-aligned start) and a mutate branch (swap events on the existing running Part). Prove it on bass, verify by ear, then the other four generators get the identical change in a later plan.

**Tech Stack:** TypeScript, Tone.js (`Tone.Part`), Vitest (unit tests with a hand-rolled Tone mock).

## Global Constraints

- Only `BassGenerator` changes behaviorally this slice. Do NOT touch Drum/Chord/Melody/Texture generators, the loop-player machinery, or the orchestrator stagger.
- Never mutate a Part from inside an audio-thread callback — keep the existing chord-change dirty-flag deferral to `processFrame`.
- The Part is a looping 4-bar Part: `part.loop = true; part.loopEnd = '4m'`. Preserve that.
- Verification of "no crackle" is BY EAR (tab focused, auto mode). Tests prove the mechanism (no dispose on rebuild), not the absence of crackle.
- Spec: `docs/superpowers/specs/2026-07-02-freeplay-generators-design.md` §13.

---

### Task 1: Add `updatePartEvents` to GeneratorBase + extend the Tone mock

**Files:**
- Modify: `client/src/organism/generators/GeneratorBase.ts` (add one protected method)
- Modify: `client/src/organism/generators/__tests__/__mocks__/toneMock.ts:305-313` (add `clear`/`add` to the mock Part)
- Test: `client/src/organism/generators/__tests__/GeneratorBase.updatePartEvents.test.ts` (create)

**Interfaces:**
- Produces: `protected updatePartEvents(part: Tone.Part, events: Array<{ time: string; [k: string]: unknown }>): void` — clears the Part then adds each event. Task 2 consumes this.
- Produces (mock): `mockPartClear`, `mockPartAdd` vi.fn() exports mirroring the existing `mockPartStart`/`mockPartStop`/`mockPartDispose`.

- [ ] **Step 1: Extend the Tone mock Part with `clear` and `add`**

In `toneMock.ts`, near the other Part mocks (`mockPartStart` ~line 22), add:

```typescript
export const mockPartClear = vi.fn()
export const mockPartAdd = vi.fn()
```

Then in the `Part:` mock implementation (~line 305-313), add the two methods:

```typescript
    Part: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        loop: false,
        loopEnd: '2m',
        start: mockPartStart,
        stop: mockPartStop,
        dispose: mockPartDispose,
        clear: mockPartClear,
        add: mockPartAdd,
      })
    }),
```

- [ ] **Step 2: Write the failing test**

Create `client/src/organism/generators/__tests__/GeneratorBase.updatePartEvents.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('tone', () => import('./__mocks__/toneMock'))
import * as Tone from 'tone'
import { mockPartClear, mockPartAdd } from './__mocks__/toneMock'
import { GeneratorBase } from '../GeneratorBase'

// Minimal concrete subclass so we can reach the protected helper.
class TestGen extends GeneratorBase {
  readonly output = new (Tone as any).Gain()
  processFrame(): void {}
  onStateTransition(): void {}
  reset(): void {}
  stopPart(): void {}
  callUpdate(part: any, events: any[]) { this.updatePartEvents(part, events) }
}

describe('GeneratorBase.updatePartEvents', () => {
  beforeEach(() => { mockPartClear.mockClear(); mockPartAdd.mockClear() })

  it('clears the part once, then adds every event — never disposes', () => {
    const gen = new TestGen('bass' as any)
    const part = new (Tone as any).Part()
    const events = [{ time: '0:0:0' }, { time: '0:1:0' }, { time: '0:2:0' }]

    gen.callUpdate(part, events)

    expect(mockPartClear).toHaveBeenCalledTimes(1)
    expect(mockPartAdd).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/__tests__/GeneratorBase.updatePartEvents.test.ts`
Expected: FAIL — `this.updatePartEvents is not a function` (method not defined yet).

- [ ] **Step 4: Implement `updatePartEvents` in GeneratorBase**

In `GeneratorBase.ts`, add this protected method (place it near the other protected Part/loop helpers, e.g. just above `abstract processFrame`):

```typescript
  /** Swap a looping Part's events IN PLACE — clear then re-add — so a "rebuild"
   *  never disposes/recreates the Part (which floods the audio scheduler and
   *  crackles). The Part keeps looping; new events land at the next iteration.
   *  Spec 2026-07-02-freeplay-generators-design.md §13. */
  protected updatePartEvents(
    part: Tone.Part,
    events: Array<{ time: string; [k: string]: unknown }>,
  ): void {
    part.clear()
    for (const event of events) {
      part.add(event as any)
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run client/src/organism/generators/__tests__/GeneratorBase.updatePartEvents.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/organism/generators/GeneratorBase.ts client/src/organism/generators/__tests__/__mocks__/toneMock.ts client/src/organism/generators/__tests__/GeneratorBase.updatePartEvents.test.ts
git commit -m "feat(organism): updatePartEvents helper — mutate a Part's events in place"
```

---

### Task 2: Split `BassGenerator.rebuildPart` into first-build vs mutate

**Files:**
- Modify: `client/src/organism/generators/BassGenerator.ts:662-806` (`rebuildPart`)
- Test: `client/src/organism/generators/__tests__/BassGenerator.holdPart.test.ts` (create)

**Interfaces:**
- Consumes: `updatePartEvents` from Task 1; the existing `this.part`, `this.hasStartedPlayback`, `getLivePartStart`, `livePartStartOffset`, `quantizeGridTime`.
- Produces: no new public surface — behavior change only. After the first successful build, `this.part` stays alive across rebuilds; `mockPartDispose` is NOT called on a rebuild.

- [ ] **Step 1: Write the failing test**

Create `client/src/organism/generators/__tests__/BassGenerator.holdPart.test.ts`. This drives two rebuilds and asserts the second one mutates rather than disposes.

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('tone', () => import('./__mocks__/toneMock'))
import { mockPartDispose, mockPartClear, mockPartStart } from './__mocks__/toneMock'
import { BassGenerator } from '../BassGenerator'
import { OState } from '../../state/types'

// A physics snapshot dense enough that generateNotes returns notes.
// OState.Flow is a real enum member (state/types.ts); OState.Playing does NOT
// exist. Flow falls through onStateTransition's Dormant/Awakening guards to the
// generic rebuild branch, and yields a valid computeTargetLevel.
const physics = () => ({ mode: 'flow', pocket: 0.3, density: 0.6, flowDepth: 0.4 } as any)
const organism = () => ({ current: OState.Flow, flowDepth: 0.4 } as any)

describe('BassGenerator holds its Part across rebuilds', () => {
  beforeEach(() => {
    mockPartDispose.mockClear(); mockPartClear.mockClear(); mockPartStart.mockClear()
  })

  it('first build creates+starts a Part; a second rebuild mutates in place (no dispose)', () => {
    const bass = new BassGenerator()
    bass.setEnabled(true)

    // First build — a real start. (If this assertion is 0, buildFreeplayBassNotes
    // returned no notes for this physics — see Step 1 prerequisite note below.)
    bass.onStateTransition(OState.Flow, physics())
    expect(mockPartStart).toHaveBeenCalledTimes(1)
    const disposesAfterFirst = mockPartDispose.mock.calls.length

    // Force a second rebuild by changing behavior (bypass the throttle).
    ;(bass as any).lastRebuildTime = -Infinity
    ;(bass as any).currentBehavior = 'FORCE_DIFFERENT'
    bass.processFrame(physics(), organism())

    // The second rebuild must MUTATE, not dispose+recreate.
    expect(mockPartClear).toHaveBeenCalled()
    expect(mockPartDispose.mock.calls.length).toBe(disposesAfterFirst) // no new dispose
    expect(mockPartStart).toHaveBeenCalledTimes(1)                     // no re-start
  })
})
```

Note for the implementer: the exact calls that trigger a second rebuild may need small tweaks to match `BassGenerator`'s current behavior-resolution (read `resolveBassBehavior` / `processFrame` around lines 326-338). The assertions are the contract: **clear called, dispose count unchanged, start count still 1.**

PREREQUISITE: confirm the first build actually produces notes for this physics — the `toHaveBeenCalledTimes(1)` start assertion depends on `generateNotes`/`buildFreeplayBassNotes` returning ≥1 note for `{ density: 0.6, subGenre: 'boom-bap' (default) }`. If it returns empty, `rebuildPart` hits the `cappedNotes.length === 0 → stopPart()` early-return and never starts a Part. Quick check: log `notes.length` once, or set a physics/subGenre known to yield notes. If empty, raise density or set a subGenre with a guaranteed bass pattern before asserting the start.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/organism/generators/__tests__/BassGenerator.holdPart.test.ts`
Expected: FAIL — the current code disposes the old Part and calls `new Tone.Part().start()` again, so `mockPartDispose` grows and `mockPartStart` is 2.

- [ ] **Step 3: Rewrite `rebuildPart` to split first-build vs mutate**

Replace the body of `rebuildPart` STARTING AT the `const startAt = getLivePartStart(...)` line (currently line 684) through `this.hasStartedPlayback = true; return true`. Keep everything ABOVE that line unchanged — including the existing `this.emitNoteEvents(events)` call (line 682). The new tail must NOT call `emitNoteEvents` again (doing so double-emits every note to the event sink). New tail (does not start with emitNoteEvents):

```typescript
    // HOLD-AND-MUTATE (spec §13): if the Part already exists and is running, swap
    // its events in place. No dispose, no re-start, no grid re-alignment — the
    // dispose+create burst was the crackle source (GeneratorOrchestrator.ts:400).
    if (this.part && this.hasStartedPlayback) {
      this.updatePartEvents(this.part, events)
      return true
    }

    // FIRST BUILD (no Part yet, or it was dropped on stop): create once and start
    // grid-aligned. This is the ONLY place the bass Part is (re)started.
    const startAt = getLivePartStart(this.hasStartedPlayback)
    this.part = new Tone.Part((time, event) => {
      // ... KEEP the existing callback body verbatim (lines ~718-798) ...
    }, events)
    this.part.loop    = true
    this.part.loopEnd = '4m'
    this.part.start(startAt, livePartStartOffset(startAt, 4))
    this.hasStartedPlayback = true
    return true
```

Delete the old "seamless handoff" block (the `const oldPart = this.part; if (oldPart) { ... stop/dispose/setTimeout ... } this.part = null`). `msUntilTransportTime` may become an unused import in this file — remove it from the import if so (leave it exported from `CompositionClock`; other generators still use it).

IMPORTANT: paste the existing callback `(time, event) => { ... }` body verbatim from the current code — do not rewrite it. Its closure locals (`lastNoteEndTime`, `lastNoteFreq` at ~714-715) stay declared just above the Part creation, exactly as today.

- [ ] **Step 4: Run the new test + the full bass suite**

Run: `npx vitest run client/src/organism/generators/__tests__/BassGenerator.holdPart.test.ts`
Expected: PASS.

Run the whole bass suite:
Run: `npx vitest run client/src/organism/generators/__tests__/ --reporter=dot`

TWO existing tests in `BassGenerator.test.ts` WILL fail because they assert
`mockPartStart` is called on a REBUILD — exactly the behavior this change removes
(a rebuild now mutates in place, it does not re-`start`). Rewrite both to assert
mutation instead:

- **`BassGenerator.test.ts:80`** — test `'sub-genre changes rebuild the bass vocabulary'`
  (~lines 73-81). After the first build, `setSubGenre('trap')` now mutates. Change
  `expect(mockPartStart).toHaveBeenCalled()` → assert the events were swapped, e.g.
  `expect(mockPartClear).toHaveBeenCalled()` and `expect(mockPartAdd).toHaveBeenCalled()`.
- **`BassGenerator.test.ts:140`** — test `'Conductor advanceChord defers rebuild and
  retries if throttled'` (~109-145). The deferred `processFrame` rebuild is now a
  mutate. Same swap: assert `mockPartClear`/`mockPartAdd` instead of `mockPartStart`.
  Import `mockPartClear`/`mockPartAdd` from the mock at the top of the file, and clear
  them in the test's `beforeEach` alongside the other Part mocks.

Do NOT change the test at ~line 65 — that asserts a FIRST build's `start`, which is
still correct (the one grid-aligned start is preserved). No existing test asserts
`mockPartDispose` on a rebuild (verified), so there is nothing to change there.
Expected after the rewrites: whole suite PASS.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0. (Catches an unused `msUntilTransportTime` import or a signature mismatch.)

- [ ] **Step 6: Commit**

```bash
git add client/src/organism/generators/BassGenerator.ts client/src/organism/generators/__tests__/BassGenerator.holdPart.test.ts
git commit -m "fix(organism): bass holds its Part and mutates events in place — kill the rebuild crackle"
```

---

### Task 3: Verify by ear (manual — the real acceptance)

**Files:** none (manual verification).

- [ ] **Step 1: Start the dev app**

Run: `npm run dev` (client http://localhost:5001, server :4001).

- [ ] **Step 2: Play the Organism in auto, tab FOCUSED**

Open `http://localhost:5001/organism`, press play, keep the tab focused, let it run 30s+ through a section change / build.

- [ ] **Step 3: Confirm the acceptance criteria**

- No crackle, no cutout while the tab is focused (the reported bug is gone).
- A section/behavior/chord change still AUDIBLY changes the bass line (proves `clear()/add()` actually swapped events — not a frozen loop).

If crackle persists, it is NOT the bass Part rebuild (other generators still churn) — note that and proceed to convert the next generator in a follow-up plan; the bass slice is still correct. If the bass line goes silent or stops updating on a change, revert Task 2's commit and re-open the mutate/first-build guard (`this.part && this.hasStartedPlayback`) — the most likely cause is `hasStartedPlayback` not being what the guard expects after a `stopPart`.

- [ ] **Step 4: Capture an AI-ear read (optional, if audio-debug MCP is connected)**

Use `capture_audio` (~15000ms) then `describe_audio` to get a second opinion on cohesion/feel while the change is fresh.

---

## Self-Review

**Spec coverage (§13):** §13.2 mechanism → Tasks 1+2. §13.3 build order (bass first, verify, then roll) → Tasks 2+3 (roll-out is a separate future plan, per the slice decision). §13.4 acceptance → Task 3. §13.5 risk (next-loop-boundary landing) → covered by the by-ear check in Task 3. ✓

**Placeholder scan:** The only "fill in" is the deliberate "KEEP the existing callback body verbatim" in Task 2 Step 3 — intentional (do not rewrite working audio code) and explicitly instructed, not a vague TODO. ✓

**Type consistency:** `updatePartEvents(part, events)` signature identical in Task 1 (definition) and Task 2 (call site). Mock exports `mockPartClear`/`mockPartAdd` used consistently. ✓
