# Freeplay Generators — Design Spec

**Date:** 2026-07-02
**Status:** Approved direction (user approved Approach A this session)
**Continues:** the 2026-06-12 freeplay decision (recorded in auto-memory
`project_organism_timing_groove_issue`) — designed then, never built. This spec is
the buildable version. Related: `2026-06-18-conductor-directs-the-band.md` (the
Conductor contract this design rides on). This spec does NOT replace it.

---

## 1. Problem (the user's words)

> "It sounds like no one knows what the hell they are supposed to be playing …
> the styles in the app are some of the issue … it feels like these are just
> looped over and over."

The user pointed at the PLAYING STYLE dropdowns (Chords: Block Chord / Rolled /
Alberti / Strum…, Melody articulations, Bass articulations). Diagnosis, confirmed
in code:

- **Drums** read fixed 4-bar authored patterns from `DrumPatternLibrary.ts` and
  loop them until a pattern swap.
- **Bass** reads authored pattern builders from `BassPatternLibrary.ts`
  (per-`BassBehavior`), looped, rebuilt on chord change.
- **Chords** apply ONE named technique (`currentTechniqueId`) to every chord hit.
- **Melody is the only improviser** (`MelodyGenerator.generatePhrase`) — and it is
  consistently the layer the user says feels alive.

So three of four players are literally "reading the same sheet of paper on
repeat." Variation historically came from *swapping* patterns/techniques — the
style churn that was (correctly) gated off in June. Result: stable but looped.

## 2. The already-made decision this implements (2026-06-12)

- **Improvisation lives in the GENERATORS, not the Conductor.** The Conductor
  INFORMS (key, live chord + real quality/intervals, groove/swing, harmonic
  rhythm) but never writes notes.
- Each player improvises **within its instrument idiom**. The MelodyGenerator
  engine is the working template.
- Per-generator **switch**: freeplay vs authored style. Authored styles stay
  available; freeplay is the alternative.
- Proof case: the bass minor-pentatonic bug — improvising was never the problem;
  improvising against MISSING information was. `setBassChordQuality` fixed it by
  feeding the real 3rd/7th. Freeplay builds on that same information channel.

## 3. Goals / non-goals

**Goals**
1. Bass, drums, and chords each get a freeplay engine that generates its own part
   live from Conductor-supplied harmony + shared groove.
2. The band coheres: one swing source, bass anchored to the kick, chords comping
   around the backbeat, all parts aligned to the 4-bar chord cycle.
3. Repetition that DEVELOPS: each section commits to a rhythmic motif and varies
   it — never re-roll every bar. (Hard-won lesson: repetition IS the rhyme;
   killing it made things worse.)
4. Styles/articulation dropdowns remain as the authored alternative; existing
   articulations get REUSED as decorations on improvised notes.

**Non-goals**
- No LLM/composer writing notes (rejected 2026-06-12; also credits-constrained).
- No changes to MelodyGenerator's improviser (it's the template, not a patient).
- No new arrangement brain, no new mix paths, no changes to Loop Packs / Loops
  Mode / ACE stems. **Do not create parallel systems — extend the generators.**
- No new swing source. Use `swingForSubGenre` / `swingTime` only.

## 4. Architecture

New folder: `client/src/organism/generators/freeplay/` containing **pure,
unit-testable functions** (no Tone.js imports, no side effects):

```
freeplay/
  BassImproviser.ts    — buildFreeplayBassNotes(ctx): ScheduledBassNote[]
  DrumImproviser.ts    — buildFreeplayDrumHits(ctx): DrumHit[]
  ChordImproviser.ts   — buildFreeplayCompPlan(ctx): CompEvent[]
  motif.ts             — shared rhythmic-motif commit/develop helpers
  types.ts             — FreeplayContext types
```

Each generator gets a `freeplayEnabled: boolean` flag (default **ON** — this is
the professional-sound bet; authored styles are the opt-out) and branches inside
its EXISTING rebuild path:

- `BassGenerator.rebuildPart()` (BassGenerator.ts:606): when freeplay, call
  `buildFreeplayBassNotes` instead of the `BassPatternLibrary` builder. The
  returned notes flow through the SAME quantize/Part/emit pipeline.
- `DrumGenerator`: orchestrator already feeds patterns via
  `loadGeneratedPattern(hits, force)` (DrumGenerator.ts:368). Freeplay generates
  `DrumHit[]` and feeds the SAME entry point — section-density thinning,
  swing, and event emission all keep working untouched.
- `ChordGenerator`: in the part-build path where `getTechnique(currentTechniqueId)`
  is applied (ChordGenerator.ts:641), freeplay instead expands the comp plan's
  rhythm/inversion events. Voicing STILL comes from `getConductor().currentVoicing()`.

**Scheduling rule (non-negotiable, from `project_organism_silence_audio_routing`):**
all Part event times in TICKS-based grid via the existing `quantizeGridTime` /
`swingTime` helpers. Never schedule in seconds.

### 4.1 FreeplayContext (what the Conductor/orchestrator supplies)

```ts
interface FreeplayContext {
  rootMidi: number            // bass register root, from conductor voicing
  chordIntervals: number[]    // real quality — the setBassChordQuality channel
  bars: number                // phrase length in bars (align to 4-bar chord cycle)
  swing: number               // swingForSubGenre(subGenre) — the ONE source
  subGenre: HipHopSubGenre    // idiom skeleton selection
  energy: number              // 0..1 from section arc
  density: number             // 0..1 from section arc
  sectionName: string         // 'intro' | 'verse' | 'build' | 'drop' | ...
  motifSeed: number           // per-section seed — same seed = same motif family
  kickTimes16ths: number[]    // drum kick anchor positions (for bass glue)
  rng: () => number           // seeded RNG so improvisers are TESTABLE
}
```

`rng` is a seeded generator (tiny mulberry32 inline — no dependency). Purity +
seeded RNG means a budget model can verify every improviser with plain vitest
assertions, no audio needed.

### 4.2 Motif discipline (`motif.ts`)

- On section change, commit ONE rhythmic motif per instrument (derived from
  `motifSeed`): a 1-bar rhythm mask (which 16th slots fire).
- A phrase = 4 bars: bar 1 = motif, bar 2 = motif, bar 3 = variation (ONE
  operation: add a note / drop a note / shift one onset by a 16th), bar 4 =
  motif + fill/turnaround. (A-A-A'-A+fill — the boom-bap/trap norm.)
- Variation ops are drawn from `rng`, bounded: never change more than 25% of the
  motif's onsets in one phrase.
- Mirrors `MelodyGenerator`'s committed-motif rule (MelodyGenerator.ts:110-116).

### 4.3 Bass freeplay (`BassImproviser.ts`) — Phase 1

- **Pitch pool:** root, and chord tones from `chordIntervals` (3rd/5th/7th when
  present), octave-below root; passing tones only as approach notes into a chord
  tone on a weak 16th.
- **Rhythm:** anchored to `kickTimes16ths` — ≥60% of bass onsets land ON or one
  16th after a kick (the bass-locks-to-kick glue). Remaining onsets from the
  committed motif mask.
- **Idiom by sub-genre:** boom-bap = short quarter/8th notes, root-heavy, ghost
  8ths; trap/drill = long 808 sustains with occasional slides (reuse existing
  slide targets logic); west-coast = walking approach into bar 1 of each chord.
- **Register:** clamp MIDI 33–48 (same as `bassRootFromMidi`).
- **Integration:** `BassGenerator` gains `setKickAnchors(times: number[])`; the
  orchestrator pushes `drum.rawHits` kick positions after every drum pattern
  load. Rebuild stays deferred to `processFrame` (the `conductorChordDirty`
  pattern — NEVER rebuild inside the chord-change callback; audible drift,
  BassGenerator.ts:265-268).

### 4.4 Drum freeplay (`DrumImproviser.ts`) — Phase 2

- **Skeleton stays authored:** a `SKELETONS` table per sub-genre defines the
  IMMUTABLE kick/snare anchors (e.g. boom-bap: snare on 2 and 4; trap: snare on
  3). Boom-bap must still sound boom-bap — freeplay drums improvise AROUND the
  backbone, never move it.
- **Improvised layers:** extra kicks (syncopated, from motif mask), hat pattern
  (density from `density` × energy; occasional triplet/32nd rolls reusing
  `hit32ndRoll`/`hitTripletRoll` from DrumPatternLibrary), ghost snares
  (velocity < 0.3), fill in bar 4 (intensity from `energy`).
- **Velocity:** humanized per hit (existing `hv()` helper).
- **Integration:** orchestrator calls `buildFreeplayDrumHits` wherever it
  currently selects a library pattern, then feeds `loadGeneratedPattern`.
  Regenerate per 4-bar phrase (a NEW variation each phrase, same skeleton+motif).

### 4.5 Chord freeplay (`ChordImproviser.ts`) — Phase 3

- **Notes:** always the Conductor's `currentVoicing()` — freeplay chooses WHEN
  and HOW, never WHAT pitches.
- **Rhythm:** comp mask from motif — e.g. anticipations (hit on the "and" before
  the downbeat), sustained pads on low energy, stabs on high energy; leave space
  where the snare backbeat lands.
- **How:** each comp event tagged with a technique-style rendering (block /
  rolled / stab) chosen by energy — REUSING the existing technique note-expansion
  helpers rather than duplicating strum code (the humanized micro-strum from
  fc2ed540 stays the block renderer).

## 5. UI (minimal, in the existing PLAYING STYLE panel)

- Chords / Melody / Bass dropdowns each get a first entry: **“Freeplay
  (improvise)”**. Selecting any named style switches that player to authored
  mode (exact current behavior). Melody's dropdown: "Freeplay" simply maps to
  its existing improviser default — no engine change.
- Drums (no dropdown today): add one **Freeplay** toggle pill in the DRUMS
  section of `OrganismCommandCenter.tsx`.
- **AUTO buttons / AUTO SHIFTS apply only in authored mode** — in freeplay they
  are disabled (grayed) for that row. No other UI additions.
- Provider: `freeplay` state per generator in `OrganismProvider` →
  orchestrator setters `setFreeplay(generator, enabled)` with
  `markAsOverride`-style semantics matching `setTechnique`.

## 6. Timing baseline & verification (do FIRST, and per phase)

The user also reports "timing feels off." Before any freeplay code:

1. Run the app, start the Organism (boom-bap preset), capture ~20s with
   `mcp__webear__capture_audio` → `mcp__webear__analyze_audio` (FREE DSP — no
   credits). Record peak/RMS, clipping %, band energy, onset stats.
   **Known trap:** BPM/onset-jitter metrics are unreliable on swung sparse
   material (it once locked 148 onto a 90bpm boom-bap; "jitter" measures swing).
   Use them directionally; the user's ears are the gate.
2. If clipping > ~1%: the known suspects are the `toDestination()` paths that
   bypass MasterBus's limiter (`MelodicLoopPlayer.ts`, `AceStemLayer.ts`,
   `ExpressiveEngine.ts`) — fix is routing them into the master bus, NOT
   turning volumes down.
3. After EACH phase: re-capture, compare, and get the user's by-ear verdict
   before starting the next phase. Never push to main unverified (pushes deploy
   to production).

**Unit verification (free, per phase):** vitest tests on the pure improvisers —
seeded ctx in ⇒ exact notes out. Assert: pitch pool ⊆ chord tones, kick-anchor
ratio, motif stability across bars 1-2, bounded variation in bar 3, skeleton
immutability for drums, comp-avoids-backbeat for chords. `npm run check` +
`npm run test:unit` green before each commit.

## 7. Build order

| Phase | What | Why this order |
|---|---|---|
| 0 | WebEar baseline capture + timing check | Measurement before change (house rule) |
| 1 | Bass freeplay + kick anchors | Smallest lift (chord quality already piped), biggest glue win |
| 2 | Drum freeplay | The beat itself; skeleton table keeps genre identity |
| 3 | Chord freeplay | Depends on comp-vs-backbeat info from 1–2 |
| 4 | UI switches | Each engine defaults ON in code as its phase lands (that's how it gets ear-verified); the UI phase adds the per-player opt-out |

Each phase = separate commit(s), by-ear gate before the next. Baseline commit
for all of this: `fc2ed540`.

## 8. Risks

- **Freeplay sounds random** → the motif discipline (§4.2) is the mitigation;
  if a phase still feels aimless, tighten variation bounds — do not add more
  randomness sources.
- **CPU** — improvisers are pure array math regenerated once per 4-bar phrase;
  negligible vs. the existing per-frame physics.
- **Doubles trap** — improvisers must be called FROM the existing rebuild paths.
  If an implementation finds itself creating a new Part-scheduling pipeline or a
  second swing table, STOP: that's the anti-pattern this repo fights.

---

## 9. Producer-quality caps (2026-07-03) — continues this spec

Full-pipeline audit after freeplay landed ("why isn't it producer level?").
The note-writing layer was sound; the caps were downstream. All fixed on
`claude/organism-producer-beats-r7o9a7`:

**Delivery-chain bugs (the big ones):**
1. **Open hats never fired in freeplay** — `resolveVoice` splits open/closed at
   velocity 0.55; freeplay hats maxed at 0.48. Fixed two ways: the improviser
   now writes deliberate open-hat accents (vel 0.68 on chosen off-beat 8ths),
   and the kit resolves the voice from the PRE-duck pattern velocity so a
   kick-duck can't flip an open hat closed (`trigger(..., voiceVelocity)`).
2. **Double hat attenuation** — `rebuildPart` multiplied pattern velocities by
   `hatCyclicPattern` [1.0, 0.4, …] on top of the improviser's own shaping
   (0.22 × 0.4 → inaudible). Removed; pattern sources own velocity.
3. **Linear velocity→gain** buried the feel layer. `velocityToGain()` in
   SampledDrumKit: floor 0.12 + power curve 1.35 — ghosts audible, accents keep
   contrast.
4. **"Parallel compression" was serial** — drums+bass ran THROUGH the 4:1 bus
   comp (no dry path): four compressors in series, no thwack, pumping 808.
   MixEngine now wires true NY parallel: dry `drumBus → bandMaster` plus a
   crushed copy (-24/6:1/3ms) blended at 0.45 underneath.
5. **Blanket 18ms Haas** on melody+chords+texture comb-filtered everything in
   mono. Haas now applies to texture only; melody/chords place via panners.
6. **Sample truncation** — VOICE_DURATION cut kick tails at 0.65s / open hat at
   0.5s. Lengthened (kick 1.1s, open hat 0.85s); closed hat stays 0.08s.
7. **Level ceiling** — Flow capped drums at 0.78 with no makeup gain anywhere;
   raised to 0.88 (master -9 dB + -0.3 dBFS WaveShaper ceiling absorb it).

**Musical upgrades:**
8. **2-bar kick cycle** — SKELETONS gained `kicksB`; bar B answers bar A
   (identity genres — jersey club, reggaeton dembow, chill — keep A = B). The
   1-bar kick loop ×4 was the strongest remaining "it's looped" signal.
9. **Fill rotation** — snare-run / kick-stutter / cut (silence) / perc-run,
   drawn per phrase, instead of the same ascending snare run forever.
10. **Motif-driven 16th hat infill** — committed off-16th slots per section
    (was a per-slot coin flip = noise, contradicting §4.2).
11. **Groove template** — DrumGenerator's lazy-snare/hat-shuffle jitter was
    `Math.random()` per event; now seeded per-slot offsets stable across bars
    and rebuilds (MPC-style pocket), seeded per physics mode.
12. **Snare+clap layering** — backbeat snares (vel ≥ 0.75) stack the clap at
    0.55× under the snare; claps are layer-only, no more random round-robin
    snare/clap alternation.
13. **Key tuning** — new pure `pitchDetect.ts` (autocorrelation, 25–200 Hz,
    tail-weighted, octave-error guard). Kicks retune onto the Conductor's key
    root via playbackRate (≤ ±3 st, cached off-thread); Real808BassSampler
    measures its sample's true fundamental and keys the sampler on the DETECTED
    root instead of trusting `rootNote || 'C1'` metadata.

**Deferred:** arrangement "moments" (pre-drop silence, risers, filter moves) —
that's arrangement writing, a separate design; kick layering (sub+punch+top
stacks) — needs curated layer-compatible sample sets.

**Verification:** vitest green (freeplay + pitchDetect suites, 598 total),
`npm run check` clean. WebEar capture + by-ear gate still required before this
merges — same §6 rule as every phase.

---

## 10. Melodic-side pass + session variety (2026-07-03, same day)

By-ear verdict on §9 in production: "almost but not there" — mix/loudness feel
+ still repetitive, **melodic side worst**. Second pass:

1. **Chord comping was a 1-bar loop** hitting the same 3 slots every bar of a
   section. `buildFreeplayCompPlan` now plans multi-bar: bar 1 states the
   section motif, last bar develops it (bounded variation + mid-bar push on the
   and-of-2, slot 6 — same-voicing, chord-boundary-safe unlike the removed
   next-voicing anticipation). ChordGenerator freeplay loops 2 bars.
2. **Width restored properly** — §9 removed the melody-bus Haas outright,
   leaving keys/lead a dry mono blob in the centre. A slow mostly-dry stereo
   chorus (0.5 Hz / 3.5 ms / depth 0.35 / wet 0.25, spread 180) now sits on the
   melody+chord bus: modulated width, no static mono comb.
3. **SESSION_SALT** (`freeplay/utils.ts`) — every freeplay seed was a
   deterministic string hash + a counter starting at 0, so each fresh app load
   improvised the IDENTICAL beat per preset. A random per-load salt is mixed in
   at every call site (drums/bass/chords/groove template). Purity preserved:
   the salt never enters the improvisers, tests pass explicit rngs.

Still open if the melodic side needs more: chord instrument choice per
sub-genre (GM soundfont defaults read dated), melody/chord call-and-response,
arrangement moments (§9 deferred list).
