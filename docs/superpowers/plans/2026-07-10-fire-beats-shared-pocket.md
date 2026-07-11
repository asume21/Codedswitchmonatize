# Fire Beats — Shared Pocket (cohesion / "one as one")

**Date:** 2026-07-10
**Branch:** `feat/fire-beats-arrangement-moments`

Continuation of the fire-beats line. Extends
`docs/superpowers/specs/2026-07-02-freeplay-generators-design.md` and the
Conductor spec `2026-06-18-conductor-directs-the-band.md`. **Do not write a new
conductor spec** — the pocket is a Conductor-directed value.

## The problem (user's ear, then measured)

User, asked what's missing when he raps over the beat:
> "Cohesion — a sense of together, one as one. It always sounds either too much
> or not enough. There's never a groove."

Bench evidence (Trap 144, seed 42): WebEar reported **"no clear beat detected"**
on the full mix; per-stem onset timing spread is inconsistent (bass ~6 ms, drums
~52 ms, melody ~139 ms) — the instruments are not sharing one feel.

## Root cause (measured in code)

The freeplay path — what actually plays on `/organism` — has **two timing layers
applied inconsistently**:

- `swungTime(bar, slot, swing)` — mechanical 8th-note swing on the off-beat 16ths
  (`utils.ts:82`). Rigid grid.
- `applyGroovePocket(slot, pocket)` — the *human* micro-pocket (laid-back snare,
  pushed hats) that makes a band breathe together (`groove.ts`).

The **classic generators** (`BassGenerator`, `ChordGenerator`, `DrumGenerator`,
`MelodyGenerator`) all apply `applyGroovePocket`. The **freeplay improvisers**
(`Bass/Chord/Melody/DrumImproviser`) use **only `swungTime`** — no shared pocket.
So the freeplay band is quantized to a stiff swing grid: one shared swing *number*
(`swingForSubGenre` — "the ONE swing source") but **no shared human pocket** binding
the instruments into one feel. That is "never a groove / not together as one."

This is a classic "double": two generator systems, only one of which grooves.

## The fix — one pocket the whole band lays into

1. Add `pocket: readonly number[]` (16 micro-offsets in seconds) to
   `FreeplayContext` (`freeplay/types.ts`). Derived **once per section** by the
   orchestrator/Conductor from subGenre. **Reuse the same pocket source the
   classic generators' `groovePocket` uses** — do NOT invent a second pocket.
2. Apply it uniformly in every improviser so effective time =
   `swungTime(...)` nudged by `pocket[slot]`. Implementation note: `swungTime`
   returns a Tone time string (`bar:beat:sub`), so either fold the pocket into the
   sub fraction or apply it as a seconds offset when the freeplay event is
   scheduled — pick ONE site and keep it the only one.
3. Keep `kickTimes16ths` bass-glue; the pocket now makes the *other* instruments
   lay back into the drums' feel too, not just the bass.
4. The Conductor owns the pocket choice (its `groove` field → a pocket template),
   so "one as one" is a single Conductor decision, not a per-generator accident.

## Measure success with the bench

Capture stems seed 42 before/after. Expect: onset spread across stems converges,
and WebEar returns **"clear beat detected"** on the full mix. Real success =
the user hears a locked pocket ("together as one"). Numbers guide; ear decides.

## "Too much or not enough" — density (separate slice, do after)

The other half of the complaint is density/energy: the arrangement swings between
cluttered and empty. That is arrangement cohesion (energy/density arc), related to
`project_organism_song_arc_gap`. **Do not fix both at once** — land the pocket
(timing cohesion) first, measure, then tackle density.

## Build order

1. Add `pocket` to `FreeplayContext`; derive in the orchestrator from the existing
   classic-generator pocket source.
2. Apply in `DrumImproviser` + `BassImproviser` first (kick + bass are the pocket
   anchor). Capture seed 42, measure onset convergence, listen.
3. Extend to `ChordImproviser` + `MelodyImproviser`.
4. Separate slice: density/energy arc for "too much or not enough."

## Guardrail

Memory notes two past blind timing fixes failed. Change ONE improviser at a time,
capture seed 42, compare to `baseline-trap-seed42`, and get the by-ear verdict
before extending to the next instrument.
