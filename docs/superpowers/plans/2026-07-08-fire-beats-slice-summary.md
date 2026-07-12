# Fire Beats — First Slice Summary

## Completed in this branch

- Created the Fire Beats arrangement-moments plan.
- Added pure planner logic for:
  - detecting real energy lifts into drops
  - planning conservative pre-drop negative space
  - planning one-bar drop-entry boost values
- Added unit coverage for the planner.

## Why this slice is intentionally small

The current `GeneratorOrchestrator.ts` already contains live pre-drop break and impact behavior. The next change should replace that inline logic with the pure planner carefully, not rewrite the arrangement engine.

Keeping the decision logic pure first makes the risky part smaller: the live audio wiring can be reviewed as a focused follow-up diff.

## What still needs wiring

- Import `planPreDropMoment` and `planDropEntryBoost` into `GeneratorOrchestrator.ts`.
- Replace the inline `enteringDrop` block in `applyArrangement()` with the pure planner.
- Feed drop-entry boost into the existing kick/hat multiplier paths.
- Confirm by ear with arrangement ON/OFF and melody-only ON/OFF.
