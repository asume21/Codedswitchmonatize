# The Conductor Directs the Band — MASTER SPEC

**This is the single source of truth for the "Conductor as the band's authority"
program. Check this file FIRST before starting any conductor/mix/arrangement work.**

Supersedes and merges:
- `2026-06-17-conductor-directs-the-band-design.md` (arrangement roles — folded into Part 1)
- `2026-06-18-conductor-owns-the-mix-design.md` (mix churn — folded into Part 2)

Implementation plan for Part 1 (historical record of shipped work):
`docs/superpowers/plans/2026-06-17-conductor-directs-the-band.md`

---

## The Law

> Every musical decision flows down from the Conductor — harmony, dynamics, mix,
> and eventually the conversation with the MC. No generator self-decides; no
> side-loop fights for control. "Everyone in their own direction" is the sound of
> no conductor. The cure is the conductor holding the baton, by law.

The Conductor object (`client/src/organism/conductor/Conductor.ts`) already exists.
This program is NOT about building it from scratch — it is about **widening what it
leads**, one section of the orchestra at a time, while never creating a rival
authority (that would just be the doubles reborn).

The first-chair players (the five generators) keep their seats and get *better*
over time. We only ever remove **meddlers** — uncoordinated systems that grab
controls the Conductor should own.

---

## Part 1 — Arrangement: WHO PLAYS  ✅ SHIPPED (2026-06-17)

The Conductor decides who plays, supports, or sits out each section.

- `InstrumentRole = 'lead' | 'support' | 'out'` and `SectionOrchestration` live in
  `shared/arrangement.ts` (per-section, optional for back-compat).
- `roleCeiling()` pure helper in `client/src/organism/generators/arrangementRole.ts`
  (`out`→0, `support`→0.6, `lead`→1.0); used identically by every generator so
  behavior can't drift.
- `GeneratorBase.setRole()` + each generator's `computeTargetLevel` = "directive
  decides, physics humanizes UNDER the role ceiling."
- Orchestrator applies the section's roles on section entry; composer emits
  orchestration per section; conducting (Song Mode) intended default-on.

**Status: live code.** Verified present: `arrangementRole.ts`, role wiring across
all 5 generators + `GeneratorBase` + `GeneratorOrchestrator` + tests.

> Note for Part 2: Part 1's reactive curve is a **humanizer under a role ceiling**
> (activity/feel). It is a SEPARATE layer from the mix-volume meddlers Part 2
> deletes. Part 2 must NOT remove the role/ceiling system — only the volume churn.

---

## Part 2 — The Mix: HOW LOUD  ← ACTIVE, not yet built

### Problem (root cause, confirmed by code trace 2026-06-18)

During passive listening, each instrument's volume swells and ducks on its own —
"melody loud, then down, drums up, then chords" — and never settles. Three
independent systems write per-generator **volume** on three different clocks, with
no coordinator:

1. **`applyPerformerState`** — `GeneratorOrchestrator.ts:556-608`. Per input frame,
   writes melody/texture volume (+ drum kick-velocity/hat-density) from performer
   energy & breathing.
2. **`applySelfListenReport`** — `GeneratorOrchestrator.ts:614-681`. A closed
   feedback loop on the Organism's own output that nudges `selfListenGainCorrection`
   + the `reactive*Multiplier`s to "balance" the mix. It has no setpoint, so it
   **oscillates** — the dominant churn during passive listening.
3. **`applyReactiveMultipliers`** — `GeneratorOrchestrator.ts:721-750`, driven by
   `ReactiveBehaviorEngine.ts:174`. Overwrites all reactive volume multipliers again.

"Last writer wins" until the next fires. This is a coordination/duplication
failure, not a generator-quality failure — which is why tuning a single generator
never fixed it.

### Fix — the existing MixEngine is the one mix authority (CORRECTED 2026-06-18)

**Discovery during planning:** the mix authority already exists and is wired.
`MixEngine` (`client/src/organism/mix/MixEngine.ts`) is instantiated in the
provider (`OrganismProvider.tsx:337`), routed via `mix.wire(orchestr)` (`:415`),
and holds a *tuned, mastered* per-channel balance (`DEFAULT_MIX_CONFIG`: drum +6,
bass −4, melody +8, chord +3, texture −14) **plus a master limiter**
(`master.limiterThreshDb: -3.0`). So we do NOT add a `getMixLevels()` type or a new
limiter — that would be a duplicate. The signal chain is:

```
generator synth → generator.output (volume multiplier)  ← the meddlers move THIS
  → MixEngine channel (gainDb + EQ + comp)              ← the real, mastered mix
    → MixEngine master (limiter)                         ← the "mastered" half, already here
      → destination
```

The churn is the per-generator `output` multiplier being moved every frame. The
fix: **stop moving it.** Generators output at their fixed base level (user slider,
default 1.0); the MixEngine channel strips provide the mixed/mastered balance,
held steady. The MixEngine is the single mix authority.

**Conducted dynamics already exist** and are kept: section build/drop shaping runs
through Part 1's `applyArrangementMultiplier` (driven by `applyArrangement()` on
bar ticks from roles/section) — that is the Conductor directing dynamics on
musical boundaries, NOT a per-frame feedback loop. No new mix-direction code is
needed for Part 2; richer Conductor→MixEngine channel automation is a later
enhancement, not required for the solid bed.

### Deletions (removals, NOT switches — a gated-off system is the next double)

1. Remove the volume math in `applyPerformerState` (`:590-602`).
2. Remove the mix-writing in `applySelfListenReport` — the `selfListenGainCorrection`
   adjustments and `reactive*Multiplier` band-balancing (`:621-668`). The auto-mix
   loop is deleted, not disabled.
3. Remove `applyReactiveMultipliers`' volume role + the `ReactiveBehaviorEngine`
   call into it (`ReactiveBehaviorEngine.ts:174`).
4. Delete the orphaned fields: `reactive*Multiplier` (5) + `selfListenGainCorrection`
   (`GeneratorOrchestrator.ts:65-74`).

**Do NOT touch Part 1's shipped role/ceiling system.** This resolves the only
apparent contradiction between the two original specs: Part 1 keeps the reactive
*humanizer* (activity under a role ceiling); Part 2 deletes the separate
*mix-volume* meddlers. Different layers.

**Why deleting (not subordinating) is right for the goal, and what we are NOT
losing:** What Part 2 removes is an unstable **auto-gain loop** (it listens to its
own output and chases a setpoint it never reaches → the swelling/ducking), NOT
"humanization." Real liveness survives in two places we do not touch: note-level
groove/velocity variation, and Part 1's activity humanizer. Real *responsiveness*
to the performer is the Part 3 duet (a MUSICAL answer — fills/phrases/hits — not
fader-twiddling). The legitimate value (intentional dynamics) is RELOCATED to the
Conductor: conducted section dynamics now, the duet later. So keeping these loops
has no upside for the goal — it only re-imports the churn and a kept-loser double.

### Master limiter — ALREADY EXISTS (do not add one)

The "mastered" half is already covered: `MixEngine.master` is a `Tone.Limiter` at
`-3 dB` with 5ms lookahead (`DEFAULT_MIX_CONFIG.master`). Deleting the self-listen
loop removes its ad-hoc clip-ducking, but the real limiter remains in the path, so
no replacement is needed. Adding a second limiter would be a double — do not.

### Self-listen — keep the ears, delete the hands

Self-listen was intentionally added so the Organism could hear its own output
(WebEar-grade analyzer) and play/mix better. Keep the **analyzer**
(`SelfListenAnalyzer`) and its report broadcast (HUD `selfListenReport`, the
`organism:self-listen-report` event for Astutely) — read-only ears. Delete only
the **write path** in `applySelfListenReport` that mutates `selfListenGainCorrection`
and the `reactive*Multiplier`s. The ears stay; the unstable auto-mix hands go.

### Testing

- `Conductor.getMixLevels()` returns expected balance per preset/section;
  deterministic; idempotent.
- Assert the deleted paths no longer change generator volume (guards the churn
  from returning).
- Existing suite stays green; `npm run check` clean.
- **By ear (the real acceptance test):** play lo-fi → mix stable, no instrument
  self-swells over 60+s; swap preset → new balance applies once and holds.

### Error handling

- No preset mix defined → fall back to the default-mix table (never silent/clipped).
- Limiter is always in the path; transparent at normal levels.

---

## Part 3 — Voicing & the Duet  ✅ DONE 2026-06-20 (V1–V4 + the Duet shipped)

User reframed the goal (2026-06-20): cohesion alone makes the band TIGHT but
BLAND. A conductor is only as good as its musical KNOWLEDGE. Today the Conductor
knows the *skeleton* (key, scale, a real progression library, sub-genre grooves,
who-plays roles) but NOT: **voicing** (which notes, spread how, so two players
sound good together), **orchestration** (which instruments pair, who sits where),
**interplay** (how one part carries another). Deepen that knowledge — voicing
FIRST (most foundational + audible) — so when it leads, it leads *well*.

Today each player voices the same symbol independently (bass = `rootMidi`, chords
= `currentChord().pitches` stacked at octave 4, melody = a `chordTones()` pick).
The fix: the Conductor voices the chord ONCE and assigns voices, so the harmonic
core sounds like one instrument breathing, not three near-misses.

### Build plan — the Voicing layer (do first)
Conductor API already in place to build on: `currentChord()`/`nextChord()`
(ParsedChord: rootMidi, intervals, pitches), `chordTones()`, `getScale()`,
`getKeyPitchClass()`. `nextChord()` gives the look-ahead voice-leading needs.

- [x] **V1 — Voicing + voice-leading core.** ✅ `conductor/voicing.ts`:
      `voiceChord(chord, prevVoicing | null, opts) → Voicing { bass, inner[], guideTones[] }`.
      Inner notes MINIMISE movement from the previous voicing (hold common tones, step
      the rest); `bass` = root in the bass register; `guideTones` = 3rd/7th. Conductor
      caches `currentVoicing()`, chains on `advanceChord`. TDD'd (movement < naive).
- [x] **V2 — Chords read the voicing.** ✅ ChordGenerator plays `voicing.inner`
      (voice-led) instead of root-position `pitches`; its local `MODE_OCTAVES` +
      `voiceChord` import deleted.
- [x] **V3 — Bass + melody align to it.** ✅ Bass plays `voicing.bass` (root in the
      bass register, ~C2); melody COMPLEMENTS `guideTones` on strong beats via the pure
      `resolveDegreeComplementing()` (prefers root/5th/extensions, leaves the 3rd/7th
      colour to the comp; 'beautiful' intent excepted). TDD'd in melodyPhrase.test.ts.
- [x] **V4 — Orchestration & spread.** ✅ Conductor picks a per-sub-genre voicing
      STYLE (`SUB_GENRE_VOICING_STYLE`): lush genres (lo-fi/R&B/soul/chill/west-coast)
      comp with an open **drop-2 spread**, the rest stay close. `voicing.ts` gained
      `VoicingStyle` + `applySpread()` (drop-2, stays above the bass). TDD'd.
      **NOT duplicated:** "WHICH instrument carries the harmony per preset (lo-fi →
      Rhodes, dark → strings/pad)" ALREADY exists in `InstrumentPerformerRouter`
      (mode/sub-genre-keyed), which the Conductor feeds via sub-genre. Re-deciding it
      in the Conductor would be a rival authority (a "double") — so the Conductor owns
      only the voicing (style/spread), not the instrument choice. The optional
      "spread one chord across players, one note each" is left for later (the router +
      role system already separate who plays; per-note hand-off is a bigger change).

### The Duet — musical call-and-response  ✅ DONE 2026-06-20 (voicing V1–V4 + Duet)
- [x] **D1 — The cue decision (pure).** ✅ `conductor/duet.ts`: `planAnswer(performer,
      ctx) → DuetCue | null`. Answers only on the RISING EDGE of a gap (the moment the MC
      stops: `breathingNow && !wasBreathing && !isInPhrase`), throttled to one reply per
      gap window (default 1500ms). Answer TYPE from energy: lively bar → `'phrase'` (lead
      lick), calm gap → `'stab'` (comp punctuation); velocity scales with energy. TDD'd.
- [x] **D2 — Execute the cue.** ✅ Orchestrator's `applyPerformerState` owns the edge/
      throttle state and runs the cue, quantized to the next 8th (ticks) so it lands on
      the beat. `MelodyGenerator.triggerAnswerLick()` (ascending chord-tone lick an octave
      up) and `ChordGenerator.triggerAnswerStab()` (one-shot of the current voicing) are
      one-shots OUTSIDE the looping Parts. `setDuetEnabled()` toggle; state reset on stop.
- **Division of labour (no double):** the WOW layer (`useWowMoments`) owns DRUM MIMICRY —
      it echoes the MC's beatbox onsets into drum hits WHILE they happen. The Duet owns the
      HARMONIC/MELODIC REPLY — the band's own idea, played AFTER the phrase, in the gap.
      Different layer, different moment; they don't collide. Drum fills as a Duet answer are
      intentionally deferred so the Duet never competes with WOW for the drum layer.

### Still captured for later (after the duet is heard)
- The deeper source of "taste" (orchestration/voicing it wasn't explicitly told) is
  the AI "minds"/musicMind layer — the hybrid. Rules give the floor; AI raises it.

---

## Out of scope (separate efforts)

- The transport-time display artifact (`GlobalTransportBar.tsx:151` divides a
  monotonic beat counter by tempo — cosmetic; not audio doubling).
- The intermittent stacking on hot swap ("stacked, but not every time") — likely
  scheduled Tone events not cancelled on `swapPreset`. Next investigation after
  Part 2.
- Generator-quality / "best first chairs" / pro instruments — unlocked by this
  program but ongoing separate work.

## Sequencing

Part 1 ✅ → Part 2 ✅ (mix churn killed, heard 2026-06-20) → Part 3 ✅ (V1 voicing core →
V2 chords read it → V3 bass+melody align → V4 per-preset spread → the Duet, all
2026-06-20). Conductor first so the players' skill isn't wasted; better players pay
off only once the band plays as one.

**Next (separate efforts):** verify the whole Part 3 chain BY EAR (the real
acceptance test — voicing cohesion + the Duet answering in live freestyle); then the
AI "minds"/musicMind hybrid that gives the Conductor taste it wasn't explicitly told.
