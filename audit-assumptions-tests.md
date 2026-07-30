# Rotted Test Assumptions Audit — client/src/organism (test lane)

Scope: every `__tests__/` dir and `*.test.ts(x)` under `client/`, `server/`, `shared/`
(excluding `node_modules`, `.claude/worktrees`, `private/`), cross-checked against the
source each test exercises. Ground truth run: `npx vitest run` → 793 tests, 789 passed,
4 failed (all pre-existing/known: 2x `AutoGenerateSource`, 1x `BassImproviser`, 1x
`DrumImproviser`).

## Finding 1 — AutoGenerateSource test comment/interval mismatch (root cause of 2 of the 4 current failures)

- **Test file:** `client/src/organism/input/__tests__/AutoGenerateSource.test.ts:32-33, 38-51, 69-76`
- **Source file:** `client/src/organism/input/AutoGenerateSource.ts:74-98`
- **The assumption** (test comment, line 32): `// Advance past several frame intervals (~23ms each)` followed by `vi.advanceTimersByTime(100)` in the passing test, but `vi.advanceTimersByTime(50)` in the two failing tests (`'frames have valid AnalysisFrame fields'` line 43, `'getLastFrame() returns last emitted frame'` line 71).
- **The reality** (source, line 74-79): `// TANK BUILD: 10fps (was 30fps). ... private static readonly FRAME_INTERVAL_MS = 100 // 10 fps`. `start()` (line 86-98) only arms a `setInterval(() => this.emitFrame(), FRAME_INTERVAL_MS)` — there is no synchronous first-frame emission. The real cadence is one frame per 100ms, not ~23ms (nor even the old 30fps ≈33ms the comment seems to be a leftover guess for).
- **Status: FAILING NOW.** `vi.advanceTimersByTime(50)` never crosses the 100ms interval boundary, so `emitFrame()` never runs, `lastFrame` stays `null`, and both tests fail at `expect(lastFrame).not.toBeNull()`.
- **Observable symptom:** Fails and looks like a source regression ("AutoGenerateSource is broken, it never emits a frame") when it is actually a stale ~23ms-per-frame assumption from before the 10fps TANK BUILD throttle landed. A developer chasing this will waste time in `emitFrame()`/`start()` before realizing the test's `advanceTimersByTime(50)` is simply too short for the current 100ms interval.
- **Fix:** change `vi.advanceTimersByTime(50)` → `vi.advanceTimersByTime(100)` (or `>= FRAME_INTERVAL_MS`) in both tests, and correct/remove the stale "~23ms each" comment.
- **Confidence: HIGH** — quoted both the test's literal (`50`) and the source's constant (`FRAME_INTERVAL_MS = 100`), and confirmed no synchronous emit path in `start()`.

## Finding 2 — Weak smoke assertions that would pass even if the feature were deleted

- **Test files:**
  - `client/src/organism/generators/__tests__/BassGenerator.test.ts:56, 70, 195`
  - `client/src/organism/generators/__tests__/DrumGenerator.test.ts:159-160, 236, 243, 249, 486`
  - `client/src/organism/generators/__tests__/MelodyGenerator.test.ts:142, 199, 255, 410`
- **The assumption:** e.g. `MelodyGenerator.test.ts:409-410`: `it('disposes clean without errors', () => { expect(() => gen.dispose()).not.toThrow() })`; similarly `expect(() => gen.onStateTransition(OState.Flow, physics)).not.toThrow()` repeated across Bass/Drum/Melody generators with no assertion on the resulting pattern, node graph, or emitted state.
- **The reality:** these call real methods (`dispose()`, `onStateTransition()`, `setLoopMode()`, `loadGeneratedPattern(..., true)`) but only check that no exception was thrown — a no-op stub with the same method signature would pass identically.
- **Status: PASSING BUT ROTTED (in the "proves nothing" sense, not a value-drift sense).**
- **Observable symptom:** "passes but proves nothing" — if `onStateTransition` or `dispose` silently stopped doing its real work (e.g. a future refactor no-ops the body), these tests give false confidence and would not catch it. Not urgent, but worth flagging since several of these generators are under active rework (per recent commits touching `MelodyGenerator.ts`/`TextureGenerator.ts`/`GeneratorOrchestrator.ts`).
- **Confidence: MEDIUM** — verified by reading the test bodies directly; did not exhaustively verify every one has zero deeper assertion nearby (some `not.toThrow()` calls are followed by real assertions in the same `it`, e.g. `GeneratorOrchestrator.test.ts:90-99` which also checks `mockPhysics.subscribe` — that one is NOT included above because it's not weak).

## Checked and found CLEAN (worth recording so it isn't re-audited)

- **`MIN_REBUILD_INTERVAL_MS` throttle tests** — `BassGenerator.ts:654`, `ChordGenerator.ts:558`, `DrumGenerator.ts:335`, `MelodyGenerator.ts:204` are all `900`. Corresponding tests (`BassGenerator.test.ts:138`, `ChordGenerator.test.ts:105`, `DrumGenerator.test.ts:397`) all use `1000 + 900 + 1`, consistent with the source and with explanatory comments referencing the correct constant. This is the exact bug class fixed earlier today — already fixed, no rot remains.
- **`DrumGenerator` "TANK BUILD" `setTimeout(0)` deferred rebuild** (`DrumGenerator.ts:350-351`) — `DrumGenerator.test.ts` uses an explicit `flushForcedRebuild()` helper (`await new Promise(resolve => setTimeout(resolve, 0))`) after every `loadGeneratedPattern(hits, true)` call that asserts on the rebuilt state. Confirmed the one sync assertion after `force=true` (line 328, `setEnabled(false)` case) is safe because `loadGeneratedPattern` returns before scheduling `setTimeout` when `!this.enabled` (line 341).
- **`compVoicingForHit`** (`client/src/organism/generators/freeplay/score.ts:42-51`) and its test (`compVoicing.test.ts`) — verified the 4-hit cycle (`hitIndex % 4`), the pitch-class invariance, and the hit-0-full-stack case all match the source exactly.
- **`songCell.variety.test.ts`** — added alongside the `rerollSessionSalt()` fix in the same commit (9ff407c9); tests and source are current.

## Not re-diagnosed (per instructions — known pre-existing failures)

- `BassImproviser.test.ts` — `'harmony HOLDING (next root == root) → the bass hits, it does not walk'`
- `DrumImproviser.test.ts` — `'kick programming is a 2-bar cycle — bar B answers bar A for most genres'`

These were already flagged as known behavioral/musical disagreements; left alone.

## Constants RETYPED in tests instead of imported (fix = import, valuable even though currently correct)

- `MIN_REBUILD_INTERVAL_MS` (value `900`) — retyped as the literal `900` (inside `1000 + 900 + 1` expressions) in `BassGenerator.test.ts:138`, `ChordGenerator.test.ts:105`, `DrumGenerator.test.ts:397`, instead of importing the private static from `BassGenerator`/`ChordGenerator`/`DrumGenerator`. (Field is `private static readonly`, so a true import isn't currently possible without exporting it — but every one of these tests will silently rot again the next time the constant changes, exactly as happened before today's fix.)
- `FRAME_INTERVAL_MS` (value `100`) — `AutoGenerateSource.test.ts` retypes assumptions about the frame cadence as free-floating comments/literals (`50`, `100`, `200`) rather than referencing `AutoGenerateSource.FRAME_INTERVAL_MS` (also private). Same rot risk, and it already rotted once (see Finding 1).
- `compVoicingForHit`'s 4-hit cycle — `compVoicing.test.ts:31` hardcodes `hitIndex 2` / `hitIndex 6` to prove the 4-cycle rather than referencing a named cycle-length constant; low risk since `score.ts` has no exported constant for it, but flagging since it's the same shape of assumption.
