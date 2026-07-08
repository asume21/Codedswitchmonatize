# Fire Beats — Implementation Log

**Branch:** `feat/fire-beats-arrangement-moments`

## 2026-07-08

Started the first production-quality pass for the Organism's "fire beats" target.

### Added

- `client/src/organism/generators/freeplay/ArrangementMoments.ts`
  - Pure, testable planner for pre-drop and drop-entry arrangement moments.
  - Detects meaningful energy lift into `drop` / `drop2`.
  - Plans bass-only pre-drop negative space for ordinary section lifts.
  - Plans stronger rhythm-section negative space for `build` / `breakdown` / `bridge` into drop.
  - Plans one-bar drop-entry boost values for kick/hat/impact.

- `client/src/organism/generators/freeplay/__tests__/ArrangementMoments.test.ts`
  - Covers energy-lift detection.
  - Covers ordinary pre-drop bass ducking.
  - Covers stronger build-like negative space.
  - Covers arrangement/melody-only/drum-disabled gating.
  - Covers drop-entry boost gating.

### Why this shape

This is deliberately pure logic first. The existing `GeneratorOrchestrator.applyArrangement()` already has pre-drop break scheduling, micro-fills, and `fireSectionFx()`. The next code step should import this planner there and replace the inline conditionals, rather than adding another arrangement system.

### Next step

Wire `planPreDropMoment()` into `GeneratorOrchestrator.applyArrangement()` where it currently schedules the final-bar pre-drop break, and wire `planDropEntryBoost()` into the section-entry path next to `fireSectionFx()`.

### Verification still needed

- `npm run test:unit -- ArrangementMoments`
- `npm run check`
- By-ear pass after the planner is wired into live audio
