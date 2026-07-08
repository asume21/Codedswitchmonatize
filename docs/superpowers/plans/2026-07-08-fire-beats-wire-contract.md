# Fire Beats Wire Contract

This file exists to prevent the next agent from starting over.

## Branch

`feat/fire-beats-arrangement-moments`

## Core helper

`client/src/organism/generators/freeplay/ArrangementMoments.ts`

Exports:

- `isEnergyLiftIntoDrop(current, next)`
- `planPreDropMoment(ctx)`
- `planDropEntryBoost(section, sectionBar)`

## Integration location

`client/src/organism/generators/GeneratorOrchestrator.ts`

Use the helper inside the existing arrangement code only:

- `applyArrangement()`
- `fireSectionFx()` if needed

Do not create a new orchestrator, arranger, scheduler, or global audio path.

## Safety rules

- Arrangement OFF means no fire-beats moments.
- Melody-only means no fire-beats moments.
- Disabled drums stay disabled.
- No synthetic riser by default.
- No full-band silence by default.
- Prefer ducking bass first; only tuck melody/chords on build-like sections entering a drop.
