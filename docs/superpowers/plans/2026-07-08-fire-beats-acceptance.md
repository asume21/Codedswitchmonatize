# Fire Beats — Acceptance Checklist

Use this checklist before merging arrangement-moment wiring.

## Unit checks

- `ArrangementMoments.test.ts` passes.
- Existing freeplay generator tests pass.
- `npm run check` passes.

## Manual by-ear checks

Test at least these presets / sub-genres:

- Trap
- Drill
- Boom-bap
- Lo-fi / chill

For each:

1. Start Organism with arrangement OFF.
   - Beat should remain a stable freestyle loop.
   - No pre-drop moments should fire.
2. Turn arrangement ON.
   - Section changes should feel intentional.
   - Pre-drop fill should only happen before real drop lifts.
   - Bass should return on the drop downbeat.
   - Melody/chords should not vanish unless the current section is build-like.
3. Turn melody-only ON.
   - Moments should not fire.
   - Vocal/performance space should stay clear.
4. Disable drums.
   - Moments should not resurrect drums.

## Subjective gate

The change is successful only if the drop feels more produced without making the engine feel jumpy, broken, or over-arranged.
