# Draft PR Notes — Fire Beats Arrangement Moments

## Summary

Starts the Fire Beats arrangement-moments pass without duplicating the Organism architecture.

This branch adds:

- A source-of-truth plan for the Fire Beats quality target.
- A pure arrangement-moment planner.
- Unit tests for pre-drop and drop-entry planning behavior.
- Wiring notes for integrating the planner into `GeneratorOrchestrator`.

## Why this shape

The existing Organism already has freeplay generators, arrangement templates, section changes, fills, impacts, progressive intro, and band awareness. The missing Fire Beats layer is not a new engine. It is producer-style arrangement behavior: stronger drops, controlled negative space, and transition decisions that are explicit and testable.

## Current status

This is intentionally a draft foundation. It does not yet change live audio behavior because the first safe step is to isolate the arrangement decision logic from the large orchestrator file.

## Next implementation step

Wire `planPreDropMoment()` and `planDropEntryBoost()` into `GeneratorOrchestrator.applyArrangement()` and `fireSectionFx()`.

## Verification target

- `npm run check`
- `npm run test:unit`
- By-ear pass with arrangement ON for trap, drill, boom-bap, and lo-fi.
