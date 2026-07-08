# Fire Beats — Arrangement Moments Plan

**Date:** 2026-07-08
**Status:** Started
**Continues:** `docs/superpowers/specs/2026-07-02-freeplay-generators-design.md` §§9–11

## User target

"Fire beats" means the Organism should reliably produce beats that feel producer-level, not merely technically correct. This is a quality bar, not a new module name.

## Current diagnosis

The freeplay generators already fixed the core note-writing and delivery-chain problems: open hats, ghost-note audibility, true parallel compression, two-bar kicks, fill rotation, groove pocket, snare/clap layering, kick/808 tuning, seed variety, and band awareness.

The remaining gap is production shape:

1. **Arrangement moments** — pre-drop negative space, drops that feel earned, bar-end transitions, section-entry impacts, controlled tension ramps.
2. **Layered drum sound** — modern kick stacks: sub + punch + top, but only after curated layer-compatible samples exist.
3. **Melodic-side taste** — sub-genre-aware chord/lead instrument choices so the beat does not read like dated GM defaults.
4. **Deeper band awareness** — melody/chord call-and-response, fill-aware comping, and shared groove-pocket offsets across non-drum instruments.

This plan starts with #1 because it is the lowest-risk path to an audible "producer" jump and it extends the existing `GeneratorOrchestrator` arrangement path instead of creating a parallel system.

## Non-goals

- No new Organism brain.
- No duplicate arranger.
- No new beat engine.
- No LLM-generated notes.
- No sample-pack rewrite in this pass.
- No global volume auto-mixing loop.

## Design rule

Arrangement moments are **section-aware performance gestures** layered on top of the existing arrangement skeleton:

- They must live near the existing `applyArrangement()` / `fireSectionFx()` path.
- They must use the existing drum/texture/bass/chord/melody channels.
- They must be scheduled with Tone Transport musical time, not arbitrary wall-clock loops.
- They must never fire in melody-only/freestyle mode.
- They must not resurrect disabled/soloed instruments.
- They must be conservative by default: no random risers in boom-bap/lo-fi.

## Phase 1 — Pre-drop pocket and impact

### Goal
Make drops feel earned without making the beat sound broken.

### Behavior
When the next section is a high-energy drop/drop2:

- Final bar, beat 3: briefly thin bass and trigger a transition fill.
- Final bar, beat 4: optional half-beat negative-space tuck if the current section is `build` or `breakdown`.
- Drop downbeat: trigger impact through the existing drum generator.
- Drop first bar: slightly overdrive hat/kick energy, then settle by bar 2.

### Acceptance
- No full-band silence unless intentionally entering a drop.
- Bass returns exactly at the drop downbeat.
- Melody/chords do not get hard-muted unless a later by-ear pass proves it helps.
- Disabling arrangement mode disables all moments.

## Phase 2 — Fill-aware comping

### Goal
When drums run a bar-end fill, the rest of the band should leave space instead of all layers playing through it.

### Behavior
- During scheduled break/fill window, tell chords and melody to thin or avoid dense stabs.
- Bass may drop or simplify only if the next section is an energy lift.
- Chords should avoid the fill-heavy beat range, similar to existing kick/backbeat avoidance.

### Acceptance
- Bar 4 fill reads as an arranged transition, not clutter.
- Chords do not fight snare rolls or kick-stutters.

## Phase 3 — Build ramps without cheesy risers

### Goal
Builds should create anticipation using musical density before synthetic effects.

### Behavior
- Increase hat density over build bars.
- Increase ghost-snare/perc/fill probability toward final build bar.
- Let texture/riser only participate for trap/drill/electronic-like sub-genres.
- Keep boom-bap/lo-fi builds mostly rhythmic, not EDM-style sweeps.

### Acceptance
- Build sections feel like pressure rising.
- Boom-bap stays authentic.
- Trap/drill can get dramatic transitions.

## Phase 4 — Drum layer contract

### Goal
Prepare kick layering without randomly stacking incompatible samples.

### Behavior
Add a small pure selection contract before any audio implementation:

- `sub` layer: low fundamental, slow body.
- `punch` layer: 80–180 Hz transient/body.
- `top` layer: high transient/click.
- Reject samples with overlapping dominant bands unless explicitly marked compatible.

### Acceptance
- No kick layering until there is a deterministic compatibility score.
- Existing single-sample kick path remains fallback.

## Phase 5 — Melodic taste pass

### Goal
Replace dated default-feeling harmonic voices with sub-genre-aware choices.

### Behavior
- Trap/drill: sparse dark keys, bells, plucks, choir/pad accents.
- Boom-bap: dusty e-piano/organ/soft keys.
- West-coast: synth leads, bright stabs, funk keys.
- Afrobeat/reggaeton: plucks/mallets/guitar-like patterns.

### Acceptance
- Instrument choice changes by sub-genre.
- User overrides still win.
- No GM fallback unless real catalog is unavailable.

## First implementation target

Start in `client/src/organism/generators/GeneratorOrchestrator.ts`:

1. Extract the existing pre-drop break scheduling into a named helper.
2. Add a small `shouldFirePreDropMoment(current, next)` predicate.
3. Add first-bar drop boost state so drop downbeats hit, then settle.
4. Keep `fireSectionFx()` as the entry-impact surface.

## Verification

Minimum checks before merge:

- `npm run check`
- `npm run test:unit`
- Manual by-ear pass on at least:
  - trap / drill / boom-bap / lo-fi
  - arrangement ON and OFF
  - melody-only ON and OFF

## Notes

The current code already contains some pre-drop break and impact behavior. This pass should tighten and formalize it, not replace it with another system.
