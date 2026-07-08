# Fire Beats — Next Wiring Steps

**Date:** 2026-07-08
**Branch:** `feat/fire-beats-arrangement-moments`

## Landed on this branch

- `docs/superpowers/plans/2026-07-08-fire-beats-arrangement-moments.md`
- `client/src/organism/generators/freeplay/ArrangementMoments.ts`
- `client/src/organism/generators/freeplay/__tests__/ArrangementMoments.test.ts`

## Next code step

Wire the pure planner into `client/src/organism/generators/GeneratorOrchestrator.ts`.

### 1. Import planner

Add near the other freeplay imports:

```ts
import { planPreDropMoment, planDropEntryBoost } from './freeplay/ArrangementMoments'
```

### 2. Replace hardcoded pre-drop predicate

In `applyArrangement()`, replace the inline:

```ts
const enteringDrop = nextSection.energy >= 0.9 && nextSection.energy > section.energy + 0.05
```

with:

```ts
const preDrop = planPreDropMoment({
  current: section,
  next: nextSection,
  sectionBar,
  barNumber,
  cycleBar,
  arrangementEnabled: this.arrangementEnabled,
  melodyOnlyMode: this.melodyOnlyMode,
  drumEnabled: this.drumEnabled,
})
```

Then gate scheduling on `preDrop.shouldFire` and use `preDrop.breakStartTime` / `preDrop.breakEndTime`.

### 3. Use planner duck values

At break start:

- bass → `preDrop.bassDuck`
- melody → `preDrop.melodyDuck`
- chord → `preDrop.chordDuck`
- trigger fill only if `preDrop.triggerFill`

At break end:

- restore next section multipliers.

### 4. Add drop-entry boost

On section change, before or inside `fireSectionFx()`, evaluate:

```ts
const dropBoost = planDropEntryBoost(section, sectionBar)
```

If `dropBoost.shouldBoost`:

- trigger impact at `dropBoost.impactVelocity`
- temporarily apply hat/kick boost for the first bar
- settle back to normal on the next bar

### 5. By-ear acceptance

Test arrangement ON for:

- trap
- drill
- boom-bap
- lo-fi

Specifically listen for:

- drop feels bigger
- no random full-band silence
- no boom-bap EDM riser behavior
- melody/chords do not vanish unexpectedly
