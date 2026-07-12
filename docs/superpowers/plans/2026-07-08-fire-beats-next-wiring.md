# Fire Beats — Wiring Next Step

This branch currently contains the safe first slice for arrangement moments:

- `ArrangementMoments.ts` — pure planner for pre-drop moments and drop-entry boosts.
- `ArrangementMoments.test.ts` — unit tests for the decision logic.
- `2026-07-08-fire-beats-arrangement-moments.md` — source-of-truth plan.

## Next code step

Wire the pure planner into `client/src/organism/generators/GeneratorOrchestrator.ts`.

### Intended replacement

Replace the inline pre-drop scheduling block inside `applyArrangement()` with:

1. `planPreDropMoment({ current: section, next: nextSection, sectionBar, barNumber, cycleBar, arrangementEnabled, melodyOnlyMode, drumEnabled })`
2. If `shouldFire`, schedule `breakStartTime` and `breakEndTime` from the returned plan.
3. On break start:
   - duck bass to `plan.bassDuck`
   - optionally tuck melody/chords to `plan.melodyDuck` / `plan.chordDuck`
   - call `drum.triggerBarEndBreakFill(time)` when `plan.triggerFill`
4. On break end:
   - clear fill
   - restore next-section multipliers

### Drop-entry boost

Inside the section-change branch, call `planDropEntryBoost(section, sectionBar)` before `fireSectionFx()`.

If it returns `shouldBoost`:

- apply a short kick/hat multiplier lift using the existing `setKickVelocityMultiplier` / `setHatDensityMultiplier` paths
- schedule a one-bar settle back to base multipliers
- pass `impactVelocity` into `fireSectionFx` or a small wrapper around `drum.triggerImpact`

### Guardrails

- Do not create a new arranger.
- Do not add another scheduler loop.
- Do not fire moments when arrangement is off, melody-only is on, or drums are disabled.
- Do not hard-mute melody/chords by default.
- Keep boom-bap/lo-fi conservative.
