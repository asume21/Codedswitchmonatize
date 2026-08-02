# Generator Output Quality Audit

Scope: deterministic output from the Organism's drum, bass, chord, melody, and arrangement paths. This audit reviewed emitted note/event logic and ran the current deterministic suite; it does not claim subjective listening results from a browser render.

## Execution baseline

Command run:

```text
npm run test:unit -- client/src/organism/generators client/src/organism/performers/__tests__/InstrumentPerformerRouter.test.ts client/src/organism/state/__tests__/ProducerArrangement.test.ts
```

Result: **36 test files, 354 tests passed.** The suite already protects several valuable rules: deterministic seeds, key/register limits, bass/kick glue, drum skeletons, bounded density, musical fills, voice-leading, and part/clock logic.

## Findings and highest-value improvements

1. **`build` sections produce verse-shaped freeplay melody material instead of a build**

   - **Files + line numbers:** `client/src/organism/state/ProducerArrangement.ts:76-81`, `client/src/organism/state/ProducerArrangement.ts:107-113`, `client/src/organism/state/MusicalState.ts:111-114`, `client/src/organism/generators/freeplay/MelodyImproviser.ts:112-145`, `client/src/organism/generators/freeplay/MelodyImproviser.ts:469-498`, `client/src/organism/generators/MelodyGenerator.ts:536-556`
   - **What the output path does:** The active arrangement repeatedly emits the named section `build` and gives it elevated melody/energy multipliers. `sectionKind()` does not recognise `build`, however, so it falls through to `verse`. The freeplay melody then selects the verse contour and verse note cap. `MelodyGenerator.onSectionChange()` also reserves the `fills` motif bank for `chorus`, `hook`, and `drop`, not `build`.
   - **Observable output symptom:** A build can become louder, but its phrase shape and density vocabulary remain verse-like. It therefore has less melodic lift/tension before the drop than the producer arrangement promises.
   - **Recommended improvement:** Add a `build` section kind with an ascending contour bank, a deliberate rising/cadential final bar, and an explicit density cap between verse and drop. Add a deterministic test that a fixed seed's `build` phrase differs structurally from its `verse` phrase and leads into `drop` without excess note collisions.
   - **Confidence: HIGH**

2. **Chord lead-avoidance folds a four-bar melody into one 16-slot mask**

   - **Files + line numbers:** `client/src/organism/generators/freeplay/utils.ts:114-127`, `client/src/organism/generators/MelodyGenerator.ts:972-1033`, `client/src/organism/generators/MelodyGenerator.ts:1543-1545`, `client/src/organism/generators/GeneratorOrchestrator.ts:732-735`, `client/src/organism/generators/ChordGenerator.ts:624-649`, `client/src/organism/generators/freeplay/ChordImproviser.ts:127-139`
   - **What the output path does:** Melody emits a four-bar phrase, then `extractBusySlots16ths()` folds every occupied position with `% 16`. The resulting union is passed to the chord improviser as `leadBusy16ths`; it also normalizes it with `% 16` and applies that same one-bar mask to every comping bar. A melody note in bar 3 at slot 10 therefore blocks chord slot 10 in bars 0–3, even where the melody is silent.
   - **Observable output symptom:** The chord part can become unnecessarily sparse or repeat the same safe slots for an entire phrase, reducing call-and-response and leaving audible holes that do not correspond to an active melody note.
   - **Recommended improvement:** Pass absolute busy slots or a `Map<bar, Set<slot>>` to the comp planner and make `leadRoom(bar, slot)` inspect only the matching bar. Preserve the downbeat exemption. Add a four-bar regression fixture with melody activity in one bar only, asserting chords still use that slot in the other bars and never overlap it in the active bar.
   - **Confidence: HIGH**

3. **The test suite has no full-band, full-section output matrix, so genre/arrangement regressions can pass green**

   - **Files + line numbers:** `client/src/organism/generators/freeplay/__tests__/DrumImproviser.test.ts:26-160`, `client/src/organism/generators/freeplay/__tests__/BassImproviser.test.ts:28-215`, `client/src/organism/generators/freeplay/__tests__/ChordImproviser.test.ts:29-234`, `client/src/organism/generators/freeplay/__tests__/MelodyImproviser.test.ts:60-118`, `client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts:90-150`, `client/src/organism/generators/freeplay/MelodyImproviser.ts:63-79`
   - **What the audit verified:** The 354 passing tests are mostly unit-level. Their detailed drum, bass, chord, and melody cases use the default `boom-bap` context, with targeted `trap` cases. The melody implementation contains additional genre modes, but there is no deterministic snapshot/score test that runs every supported drum style and every arrangement section through the complete band output. The orchestrator test verifies wiring, transport, kick anchors, and pocket propagation—not the resulting combined event set.
   - **Observable output symptom:** A change can preserve every current unit contract yet make a particular genre or section feel flat, too dense, harmonically crowded, or poorly paced. It will be discovered only by manual listening after release.
   - **Recommended improvement:** Add a pure `GeneratorQualityMatrix.test.ts` with fixed session seeds. Iterate `Object.keys(SKELETONS)`, each active producer section (`intro`, `verse`, `build`, `drop`, `breakdown`, `drop2`), and 8 seeds. Capture the combined events as JSON and assert: valid grid/time range; melody pitches in the chosen scale; bass register and root/approach rules; preserved drum skeleton; no same-bar chord/lead overlap except downbeat; bounded per-bar density; and relative section energy (`intro < verse/build <= drop`). Save one approved JSON fixture per canonical genre/section as an intelligible review artifact, not an opaque hash.
   - **Confidence: HIGH**

## Recommended implementation order

1. Fix the `build` melody classification and add its focused regression test.
2. Make chord lead-avoidance bar-aware and add the four-bar collision regression test.
3. Establish the full deterministic quality matrix before further style changes. It will turn subjective “this beat got worse” feedback into a seed, event payload, failed musical rule, and owning generator.
