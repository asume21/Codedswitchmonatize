# PR Body Draft

## Summary

Starts the Fire Beats arrangement-moments pass for the Organism.

This is intentionally the foundation layer: it establishes the source-of-truth plan, adds a pure/testable planner for pre-drop/drop-entry decisions, and records the exact wiring point in `GeneratorOrchestrator.ts` so this work continues the current architecture instead of creating a duplicate system.

## Added

- `docs/superpowers/plans/2026-07-08-fire-beats-arrangement-moments.md`
- `client/src/organism/generators/freeplay/ArrangementMoments.ts`
- `client/src/organism/generators/freeplay/__tests__/ArrangementMoments.test.ts`
- continuation/checklist docs under `docs/superpowers/plans/`

## Why

The current Organism already has freeplay, producer-quality drum fixes, arrangement templates, impacts, fills, progressive intro, and band awareness. The missing Fire Beats gap is production shape: controlled negative space, stronger drop entries, and transition decisions that feel intentional.

## Current behavior change

No live-audio behavior is changed yet. The branch adds the pure planning layer first.

## Next step

Wire:

- `planPreDropMoment()` into `GeneratorOrchestrator.applyArrangement()`
- `planDropEntryBoost()` into drop section entry behavior

## Verification needed

- `npm run check`
- `npm run test:unit`
- By-ear test: trap, drill, boom-bap, lo-fi with arrangement ON/OFF
