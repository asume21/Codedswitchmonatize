# Generator Feature Solos — Audit, Decisions, and Implementation Log

**Date:** 2026-08-08  
**Status:** Implemented and statically/audio verified; live visual inspection pending browser-control attachment  
**User goal:** Every generator should sound intentional alone and together. Melody,
chords, and texture may become full-song featured players; drums and bass remain the
rhythmic foundation. Melody and chords must also be able to trade phrases. Texture
needs real pad/keys voice choices. Preserve a separate mixer-isolation solo for
auditioning stems.

## Non-negotiable vocabulary

There are two different operations. They must not share one hidden state:

1. **Isolate** — a mixer action. Mute the other channels so one generator can be
   inspected. It does not promise a different composition.
2. **Feature** — a musical arrangement action. A chosen player owns the foreground
   over the whole song while the other players support it. Melody + Chords is a duet
   feature in which the two players leave and answer space.

The existing UI calls its mixer button `Solo`. Keep that compatibility for now, but
new musical controls and APIs use **Feature** so we do not recreate the ambiguity
already documented in the July 11 design spec.

## Capability inventory — do not duplicate

| User need | Current capability | Status | Decision |
|---|---|---:|---|
| Isolate drums/bass/melody/chords | `OrganismCommandCenter.handleSolo` writes per-role volumes; `MixEngine.soloChannel` is the engine-level equivalent | Complete, but duplicated UI/engine paths | Reuse existing UI behavior in this slice; do not add another mixer |
| Isolate texture | `MixEngine.soloChannel('texture')` and capture bench support it, but Command Center intentionally omits it | Engine complete; UI gap | Add texture to the existing `InstrumentSelect`/solo UI |
| Instrument choices for melody/chords/bass | `InstrumentPerformerRouter`, registry, generator setters, provider assignments, and dropdowns | Complete | Reuse unchanged |
| Texture makes musical pad audio | `TextureGenerator` already sustains Conductor voicings, swaps a sampler by mode, shapes sections, and owns the safe one-convolver signal path | Complete internally | Do not build a second texture synth or scheduler |
| Texture voice picker | Registry already marks Strings and Choir as texture-capable; Texture has sampler-swap internals, but no public setter/provider assignment/dropdown | Partial | Extend the existing instrument-assignment pipeline to `texture` |
| Melody develops phrases | `MelodyImproviser` already has section contours, statement/answer/variation/climb behavior, performer-aware articulation, and Song Mode sections | Complete foundation | Feature mode must steer this engine, not invent another melody sequencer |
| Chords can own the hook | Existing `lead/support/out` roles and `ChordImproviser.hookMode` turn foreground chords into the hook | Complete foundation | Feature mode overrides section roles through this path |
| Melody and chords listen to one another | `leadBusy16ths`, `maybeAnswerMelodyRest`, `planInstrumentalAnswer`, `executeDuetCue`, and call-response comp gestures | Complete foundation | Duet feature makes this intent explicit and keeps both players forward |
| Band builds around an external sample | Existing `setSampleLead` and `_sampleLeadRow` feed loop DNA to the Conductor/song cell | Complete, separate feature | Do not overload it for generator feature ownership |
| Full-song structure | Song Mode + producer arrangement already provide intro/verse/build/drop/bridge-style section arcs | Complete foundation | A Full Song feature enables/uses Song Mode and changes foreground ownership |
| Featured melody | Generator `setSoloMode` currently adds sparse embellishments to a repeatable riff; no explicit full-song owner | Partial | Add one orchestrator-owned feature intent; retain riff/isolate behavior separately |
| Featured chords | Chord hook mode exists, but there is no explicit user-owned full-song feature state | Partial | Drive existing chord role/hook behavior from feature intent |
| Featured texture | Texture has section dynamics but is always treated as a support bed | Partial | Allow texture to own foreground dynamics without pretending it is a monophonic lead |
| Drums/bass as full-song soloists | Both have `isSoloMode` flourishes used while isolated | Exists, but conflicts with product decision | Keep for audition quality; do not expose drums/bass as Full Song feature owners |
| Crackle/cutout prevention | Shared audio context has increased look-ahead; texture reverb CPU was reduced; `updatePartEvents` exists; bass holds/mutates its Part | Partial | Reuse `updatePartEvents`; do not add effects/parallel schedulers |
| Chord Part churn | Chord still rebuilds from Conductor changes; history shows a broad hold/mutate rollout was reverted after it wiped schedules | Confirmed risk | Change only with equality guards and focused lifecycle tests |
| Melody Part churn | Phrase refresh replaces the scheduled Part; previous broad rollout was reverted | Confirmed risk | Do not combine with feature UI work; stabilize in a separately tested slice |
| Audio inspection | WebEar MCP, `audioDebugBridge`, `__orgDebug`, `__audioHealth`, node census, and deterministic capture bench exist | Complete tooling; relay currently has a persistence 500 | Reuse tools and record relay fault; do not build another recorder/analyzer |

## Existing decisions preserved

- The July 11 playable-instrument spec already decided there are two musical asks:
  a repeatable loop bed and a full-song performance. This work does not redefine the
  existing mixer `S` button as both.
- Drums and bass remain foundation players. Their isolate mode may add fills or
  expression so they sound good under inspection, but they are not selectable as
  full-song feature owners.
- A texture voice must use the current sampler + one reverb chain. The prior two-
  convolver texture graph caused measured render-thread underruns.
- `lead/support/out` is section orchestration, not user feature ownership. Feature
  intent is a separate type so existing plans and sample-lead ownership remain valid.

## Confirmed implementation gaps

1. Extend `OrganismInstrumentRole` and assignments with `texture`.
2. Add `TextureGenerator.setInstrumentPerformer()` by adapting its existing sampler
   swap, with `null` restoring mode-auto behavior.
3. Add texture-capable keys/pad registry choices and render Texture through the
   existing `InstrumentSelect`, including isolate parity.
4. Add one orchestrator-owned `FeaturedPerformance` state:
   `none | melody | chord | texture | melody-chords`.
5. Apply feature ownership where existing section roles are assigned. Do not create
   another arrangement scheduler.
6. Expose the feature state through `OrganismContext` and the Command Center. A Full
   Song feature ensures Song Mode is on.
7. Keep the existing instrumental-duet planner as the engine behind
   `melody-chords`; the new state supplies explicit intent.
8. Add focused tests for routing, role ownership, restoration, and texture voice
   selection before live audio verification.

## Baseline audio findings (before implementation)

- Deterministic Trap seed 42 full-mix WAV: 6.8 seconds, peak `-2.41 dB`, RMS
  `-15.99 dB`; no 50 ms silence segments and no detected dropouts; one large sample
  jump (`0.40`) worth monitoring.
- Headless 30-second run: no audio-clock stalls; two main-thread long tasks totaling
  212 ms (worst 153 ms).
- Live harmonic channels were intentionally suppressed by section multipliers
  (melody `0.35`, chords `0.50`, texture `0.35`), explaining the “barely audible”
  perception without evidence of actual long cutouts in the captured WAV.
- WebEar's uploaded analyzer JSON was empty because the relay persistence request
  returned HTTP 500 after the browser capture; the WAV itself contained audio. This
  is a diagnostic-service defect, not proof that the generator emitted silence.

## Implementation log

### 2026-08-08 — audit

- Read current code, tests, July/August specs, and relevant Git history before edits.
- Confirmed the large building blocks already exist and reduced the new design to
  explicit intent + routing/UI gaps.
- Preserved unrelated working-tree changes in `client/src/main.tsx`,
  `client/src/lib/audioNodeCensus.ts`, and existing audit documents.

### 2026-08-08 — implemented without duplicate engines

- Added `FeaturedPerformance` as explicit user intent only. It resolves the
  existing section roles and multipliers; it does not schedule notes itself.
- Added Full Song Feature choices for Melody, Chords, Pads / Keys, and
  Melody + Chords. Drums and bass intentionally remain foundation/isolate roles.
- Melody + Chords enables the existing instrumental-duet listener/answer path.
- Added local text/voice routing for phrases such as `solo melody`,
  `feature chords for a full song`, `feature the pads`, and `melody and chords
  duet`. Named instruments use the existing role assignment path.
- Extended the existing texture sampler swap with an explicit performer setter.
  The picker now offers Acoustic Piano, Rhodes, String Ensemble, Choir Aahs, and
  Hammond Organ (real `SK_Organ01` when the catalog is ready).
- Added texture to the existing `InstrumentSelect`, including the same mixer
  isolate button as the other roles.
- Raised the existing authoritative channel-strip gains after a measured stem
  audit: melody `+3 -> +9 dB`, texture `+2 -> +12 dB`. No new gain stage was
  created.
- Made WebEar database persistence best-effort after the in-memory blob is
  complete. A database write failure no longer turns a valid capture into HTTP
  500 or strands its pending request.

### 2026-08-08 — scheduler decision

- Did **not** reapply the reverted chord/melody hold-and-mutate rollout. Chord's
  callback closes over per-voicing balance state, and an immediate in-place
  mutation can put the next chord into the old bar before the boundary. Current
  code already holds through transient missing Conductor data and performs a
  boundary handoff. The new capture found no full-mix silence segment, so a risky
  scheduler rewrite is not justified by present evidence.

### 2026-08-08 — measured result

Deterministic Trap, seed 42, Song Mode on:

| Stem | Before RMS | Final RMS | Final peak (analyzer) | Silent |
|---|---:|---:|---:|---:|
| Full | -13.4 dBFS* | -17.8 dBFS | -1.2 dBFS | No |
| Melody | -32.0 dBFS | -23.1 dBFS | -6.1 dBFS | No |
| Texture | -43.6 dBFS | -35.8 dBFS | -21.9 dBFS | No |

`*` Song Mode advances while stems are captured sequentially, so full/stem runs
can land in different arrangement sections; use the deltas as an audibility
check, not a loudness-mastering A/B. The final full WAV's independent ffmpeg
scan measured `-3.59 dBFS` sample peak / `-20.32 dBFS` RMS and found no silence
segment at `-55 dB` for 50 ms. Melody contains intentional phrase rests; texture
has no detected 150 ms dropout at `-60 dB`.

Artifacts: `marketing/output/fire-beats/harmonic-balance-after-20260808/`.

WebEar signal analysis completed for all six captures. A temporary Gemini key
later enabled a qualitative listening pass without being written to the repo.

### 2026-08-08 — qualitative listening result

The friendly producer prompt found a coherent 4/4 groove, compatible melody and
chords, no digital cutouts, and only subtle stylistic crackle. The isolated-stem
pass found no channel leakage, but exposed the core sound-design problem:

- Melody: bright brassy synth, rigid/staccato, repetitive, and too mechanical to
  carry a full-song featured solo.
- Chords: glassy keyboard in a mid-high register; clean and spacious but static.
- Texture: sustained upper-mid pad/drone; spacious, but too high and harmonically
  dense to sit cleanly behind a normal melody.
- Bass/drums: technically present and clean, but the full mix does not translate
  their low-end weight and transient punch as competitively as the isolated
  stems suggest.

A deliberately blunt commercial-competitiveness prompt classified the exact
full-mix clip as **WEAK, 3.5/10**, predicting that a skilled rapper with choices
would pass. Its priorities were: rebuild the drum sound for stronger impact,
replace the dated/General-MIDI-like harmonic timbres, and make the existing
kick/sub relationship translate with convincing weight in the full mix. The
model's literal claim that no sub-bass exists conflicts with the isolated-bass
capture and signal measurements; interpret that as a translation/punch problem,
not an instruction to blindly add more bass.

## Remediation roadmap — from functional to fire

The first implementation fixed control, routing, feature modes, texture choice,
and audibility. The next pass targets timbre, performance, and competitive
impact in this order:

1. **Make the listening bench truthful.** Add selected performer ID, actual
   voice source, sample-loaded state, fallback-synth usage, section, bar, and
   role to each capture record. Reset each full/stem capture to the same section
   and wait for the requested sampler before recording. This prevents judging a
   temporary FM fallback or comparing different arrangement sections.
2. **Curate automatic instrument taste.** Keep every instrument available in
   the manual selectors, but make automatic Trap/hip-hop choices favor proven
   real/sample-backed leads and comping voices. A wildcard can add color only
   after the core sound passes a quality gate; it must not make a dated brass or
   General-MIDI-like voice the default identity of the beat.
3. **Make Featured Melody a performance, not a volume boost.** Give featured
   melody a 4/8-bar solo arc with motif, answer, development, breath, controlled
   register, velocity shape, and family-specific articulation. Prevent an
   identical staccato two-bar riff from looping through the feature.
4. **Give chords a pocket.** Retain the existing conductor/voicing system, but
   choose warmer comping voices, thin voicings when a lead is active, keep the
   top note out of the lead's register, and vary rhythmic technique by section.
5. **Put texture behind the song.** Remove the unconditional +12-semitone lift
   and automatic top-octave doubling in busy sections. Use two/three-note,
   lower-register pad voicings behind melody; reserve wide/high washes for intros
   and breakdowns. Make Pads, Keys, Strings, and Choir audibly distinct choices.
6. **Restore competitive impact after the harmonic parts are fixed.** Recheck
   kick/snare transient shape and kick/bass translation in the full mix. Do not
   add more sub merely because one model said it was absent; the isolated stem
   proves it exists. Clean the measured 200–350 Hz overlap and tame only verified
   3–4 kHz harshness.
7. **Pass both technical and taste gates.** Preserve zero cutouts/clipping and
   clean stem isolation. Then use the same blunt rubric for every candidate,
   compare deterministic A/B captures, and require human listening sign-off.
   AI taste scores are advisory because prompt wording changed the same clip
   from friendly praise to 3.5/10.

### 2026-08-08 — remediation implemented

- Capture records now include the actual performer, voice source, sampler-ready
  state, fallback state, drum-kit source/load counts, section, Transport
  position, role state, and same-run gain report. Jam-mode captures are marked
  comparable and wait for both sample readiness and settled generator gains.
- Automatic lead/chord color is now curated: the Trap and boom-bap pools no
  longer default to brass, wildcard probability is `8%` instead of `18%`, and
  automatic wildcards are restricted to a taste-safe set. Every registered
  instrument remains available through an explicit user selection.
- Featured Melody and Melody + Chords now promote Melody into its existing solo
  machinery even while the band is present. Solo phrases are at least four bars,
  allow up to 40 developed notes, and refresh every four bars; changing feature
  state invalidates the old short phrase instead of merely making it louder.
- Chords use the existing performer and Conductor, but featured-lead mode folds
  them below MIDI 67 and thins them to at most three voices.
- Texture no longer applies the unconditional octave lift or top-note doubling.
  It uses at most two lower voices behind a lead, three as a normal bed, and four
  only when Texture itself owns the feature.
- Runtime diagnostics now prove bass, chord, texture, melody, and drum sample
  sources instead of inferring them from the UI label.
- Added 2.5 dB of codec-safe final output headroom after the existing safety
  shaper. This leaves the transient/compressor behavior intact but prevents
  Opus/AAC decode overshoot from recreating digital clipping.

### 2026-08-08 — clean deterministic proof

Trap preset, seed 42, comparable jam mode, 7.92-second captures:

| Stem | RMS | Peak | Clipping | Verified source |
|---|---:|---:|---:|---|
| Full | -17.77 dBFS | -0.95 dBFS | 0.00% | all roles |
| Drums | -19.80 dBFS | -1.51 dBFS | 0.00% | `private:infinity-real-beat`, all 29 slots loaded |
| Bass | -21.60 dBFS | -8.27 dBFS | 0.00% | real 808 sample |
| Melody | -47.31 dBFS | -31.07 dBFS | 0.00% | loaded Clean Electric Guitar sample |
| Chords | -42.65 dBFS | -26.28 dBFS | 0.00% | loaded Clean Electric Guitar soundfont |
| Texture | -34.59 dBFS | -19.58 dBFS | 0.00% | loaded real VSCO2 String Section |

The normal jam-mode melody/chord stems remain intentionally tucked; Full Song
Feature raises their ownership/role and invokes the longer performance path.
The remaining acceptance item is a human listen to those four feature choices,
especially whether Auto choosing guitar for both lead and chords is desirable
for this seed or should be changed explicitly in the two instrument selectors.

Artifacts: `marketing/output/fire-beats/remediation-clean-20260808/`.

## Verification ledger

- [x] Final focused unit tests — 4 files / 62 tests passed
- [x] Full unit suite — 112 files / 839 tests passed
- [x] TypeScript check
- [x] Final production build — 3,568 modules transformed
- [x] Deterministic full/stem capture — six WAVs + analyzer JSON
- [x] Full-mix silence/clipping scan
- [ ] In-app browser desktop/narrow visual pass — browser-control attachment timed out
- [x] AI listening notes — full mix plus all five isolated stems
- [ ] Human listening sign-off for feature modes and instrument taste
