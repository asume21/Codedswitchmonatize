# Groove, arrangement, and musical-variation audit — 2026-08-03

Scope: the Organism's live freeplay drum source, its section/energy handoff, and the browser capture bench used to judge generated output. This audit does not change generator behavior.

## Execution evidence

- Deterministic checks passed: `npm run test:unit -- client/src/organism/generators/__tests__/DrumGenerator.test.ts client/src/organism/generators/freeplay/__tests__/DrumImproviser.test.ts client/src/organism/generators/freeplay/__tests__/ArrangementMoments.test.ts client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts client/src/organism/generators/__tests__/groove.test.ts client/src/organism/state/__tests__/ProducerArrangement.test.ts` — **6 files, 89 tests passed**.
- A live browser capture ran against the local `/organism` page with `Trap 144`, seed `42`, and Song Mode enabled. It saved [`trap-full-seed42.wav`](marketing/output/fire-beats/groove-audit-20260803/trap-full-seed42.wav), but the WebEar analysis endpoint returned HTTP 500 and the next stem capture failed with `Local audio-debug upload failed (500)`. Therefore this report makes no subjective claim from the WAV; the source findings below are verified from the emitted-pattern path.

## Findings (most important first)

- **Title:** The default lock turns an extended section into the same four-bar drum loop repeated over and over
  - **Files + line numbers:** `client/src/organism/state/ProducerArrangement.ts:226-248`; `client/src/organism/generators/GeneratorOrchestrator.ts:119-127`; `client/src/organism/generators/GeneratorOrchestrator.ts:1634-1650`; `client/src/organism/generators/GeneratorOrchestrator.ts:1673-1693`; `client/src/organism/generators/DrumGenerator.ts:600-603`; `client/src/organism/generators/freeplay/songCell.ts:42-45`
  - **Which one wins at runtime, and the precise mechanism that decides:** The four-bar freeplay pattern wins. Template sections are multiplied by four, so a template four-bar verse is sixteen live bars. Yet `buildDrumHits()` always creates four bars; its seed contains only `currentSectionName` and sub-genre, not the section occurrence or the supplied `variantIndex`. `grooveLock` defaults to `true` and returns before mutation, while `DrumGenerator` loops the resulting part at `4m`. Re-entering a same-named verse/drop resolves the same song-cell key and the same drum seed as well.
  - **Observable symptom:** A listener gets the exact same four-bar kick/hat/fill phrase four times through a sixteen-bar verse, and receives it again when that named section returns later in the form. This is the strongest mechanical source of the “it is only a loop” feeling.
  - **Confidence:** HIGH

- **Title:** The drum generator creates a new section using the previous section's energy, so a post-breakdown drop can arrive under-written
  - **Files + line numbers:** `client/src/organism/generators/GeneratorOrchestrator.ts:324-376`; `client/src/organism/generators/GeneratorOrchestrator.ts:1673-1693`; `client/src/organism/generators/GeneratorOrchestrator.ts:1915-2101`; `client/src/organism/generators/DrumGenerator.ts:340-364`; `client/src/organism/generators/freeplay/DrumImproviser.ts:82-90`; `client/src/organism/generators/freeplay/DrumImproviser.ts:109-177`
  - **Which one wins at runtime, and the precise mechanism that decides:** The old `sectionDensityLevel` wins while the new pattern is built. The director's section callback immediately calls `buildDrumHits()`, which passes the stored density/energy into `buildFreeplayDrumHits()`. Only afterward does `applyArrangement()` set that stored value from the newly entered section. `setSectionDensity()` can re-filter existing `rawHits`, but it never regenerates the energy-dependent open hats, roll, ghost-note probability, or hot fill that were omitted while building the raw pattern.
  - **Observable symptom:** The `drop2` after a zero-drum breakdown can play at full gain but be constructed without the high-energy roll/hot-fill material that makes a drop hit. More generally, each rising section's rhythmic detail reflects the preceding section rather than its own stated energy.
  - **Confidence:** HIGH

- **Title:** The promised committed sixteenth-note hi-hat infill is unreachable; the build's “hat density” mostly makes the same grid louder
  - **Files + line numbers:** `client/src/organism/generators/freeplay/DrumImproviser.ts:76-80`; `client/src/organism/generators/freeplay/DrumImproviser.ts:106-143`; `client/src/organism/generators/GeneratorOrchestrator.ts:2131-2144`; `client/src/organism/generators/DrumGenerator.ts:306-308`; `client/src/organism/generators/DrumGenerator.ts:661-685`
  - **Which one wins at runtime, and the precise mechanism that decides:** The empty `hatInfill` set wins: it is allocated and never populated, so the odd-slot infill branch cannot emit a hit. The core pattern therefore emits hats only on even slots (eighth notes), apart from the final-bar roll. The arrangement's build/section `setHatDensityMultiplier()` reaches `applyDynamics()`, where it multiplies the velocity of already-scheduled hats; it does not add or reposition hat events.
  - **Observable symptom:** A Trap build can get louder but retain essentially the verse's eighth-note hat grid. It lacks the controlled subdivision/roll escalation that makes the listener feel mounting energy before the drop.
  - **Confidence:** HIGH

- **Title:** The browser benchmark cannot currently produce the per-stem measurement matrix needed to tune beats by evidence
  - **Files + line numbers:** `scripts/capture-fire-beats.mjs:152-196`; `client/src/lib/audioDebugBridge.ts:455-496`; `server/routes/webearRelay.ts:2144-2191`
  - **Which one wins at runtime, and the precise mechanism that decides:** The capture script intercepts the initial browser upload and can save the full-mix WAV, but its subsequent request to `/api/webear/analyze-app/:captureId` received HTTP 500 in the live run. The next capture then failed when the audio-debug bridge's upload request received HTTP 500, and the script aborts on that thrown error. No per-stem analysis JSON or manifest is written after the abort.
  - **Observable symptom:** There is no reliable A/B benchmark across drums, bass, melody, chords, and texture, so a change can sound better or worse without a repeatable render/analysis record. The failed run left only the initial full-mix WAV, not an auditable stem set.
  - **Confidence:** HIGH

## Highest-value fix order

1. Keep the core loop locked, but introduce deterministic bar 5/9/13 variations and a distinct section-occurrence seed. Do not return to per-frame random mutation.
2. Pass the entering section's energy/density into `buildDrumHits()` before its pattern is created, then add a regression for breakdown → drop2.
3. Populate `hatInfill` from the shared song cell and make the build add a bounded number of actual hat events, not just gain.
4. Restore the capture bench to a full per-stem WAV + analysis manifest before judging mix or sample-selection changes by ear.
