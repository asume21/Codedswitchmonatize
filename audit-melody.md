# Melody Audit — 2026-07-29

Scope: `MelodyGenerator.ts`, `freeplay/MelodyImproviser.ts`, `melody/**`, `freeplay/motif.ts`,
`instruments/ExpressiveEngine.ts` (checked, nothing melody-specific lives there — see bottom).
Read-only. Every finding below was traced to an exact line and verified against the actual
runtime call order in `rebuildPhrase`, not inferred from comments.

---

## 1. The "answer"/"variation" phrase-character never survives — voice-leading folds the octave recast right back

**File:** `client/src/organism/generators/melody/performerExpression.ts:150` (`developPhraseCharacter`)
and `client/src/organism/generators/MelodyGenerator.ts:906-934` (call order in `rebuildPhrase`)
and `client/src/organism/generators/melody/voiceLeading.ts:44-51` (`applyVoiceLeading`)

**What is wrong:** `applyPerformerExpression` (called at line 906) picks a `PhraseCharacter` per
section and, for character `1` ("answer"), transposes **every note in the phrase up a full
octave** (`octaveShift = 12`); character `2` ("variation") drops it a full octave (`-12`). This
runs *before* `applyVoiceLeading` (lines 915-934), which is called immediately after with
`maxLeapSemitones = isSustainedPitch(...) ? 4 : 7` and `seedMidi = this.lastPhraseEndMidi` (the
previous phrase's last note, in normal register).

`applyVoiceLeading`'s fold step (voiceLeading.ts:44-47) is unconditional:
```
while (m - prev > maxLeapSemitones) m -= 12
while (prev - m > maxLeapSemitones) m += 12
```
A 12-semitone octave shift is always greater than `maxLeapSemitones` (4 or 7), so the very first
note of the "recast" phrase gets folded straight back down/up by exactly one octave to stay near
`prev`. Every subsequent note then folds toward *that* corrected note, cascading the same
octave-correction through the whole phrase. The net effect: the register recast that
`developPhraseCharacter` computed is silently undone, note by note, before the Tone.Part ever
schedules it.

**Why it sounds wrong:** The code comment (performerExpression.ts:131-137) explicitly promises
"a real soloist states an idea, then answers it... leaps an octave up (a question answered)" —
but the listener never hears that. Every phrase, regardless of which character the section
hashed to, ends up in the same narrow register voice-leading always produces. This is the
"gate that discards a tuned value" bug family: two systems (character development, then
voice-leading continuity) disagree, and the later one silently wins every time. The `breakAt`
exemption (line 920, `this.lastPhraseCharacter === 1 ? ... : null`) only skips the *fold*
step for one note — it still hits the unconditional register-cap clamp two lines later
(voiceLeading.ts:50-51), so even the one "reach" note can't actually land an octave away.

**Confidence: HIGH** — traced the exact call order and the numeric relationship
(12 > maxLeapSemitones for both branches: 4 and 7).

---

## 2. No pitch/register avoidance when the vocal is active — only volume gets ducked

**File:** `client/src/organism/generators/MelodyGenerator.ts` — `voiceActive` usages (grep: lines
177, 681, 700, 1186, 1268, 1357) vs. the Tone.Part callback at lines 974-977 (`presenceDuck`)

**What is wrong:** `voiceActive` (is the MC currently rapping) only ever touches:
- **behavior** (density) — `getMelodyBehavior()` drops to `Hint` (patterns/MelodyPatternLibrary.ts:54)
- **motif bank selection** (motifSelection.ts input)
- **legato duration choice** (line 1357, only when *not* voiceActive)
- **velocity floor** (line 1186-1188)

It never changes **octave/register**. The actual per-note volume duck in the audio callback
(`presenceDuck = Math.max(0.3, 1 - this.currentPresence * 0.5)`, line 975) is keyed on
`physics.presence`, not on register or pitch placement. `MODE_OCTAVES` (MelodyPatternLibrary.ts:31-38)
is a fixed per-mode register (e.g. heat/ice/glow all sit at octave 3-4) regardless of whether the
MC is silent or actively rapping.

**Why it sounds wrong:** For a freestyle rapper (male vocal fundamental commonly sits around
octave 2-4), a melody parked at the *same* register whether or not he's rapping is precisely the
"melody fights the vocal" bug the brief called out — it just gets quieter and sparser at that
register, not out of the way. The center is never actually opened; it's turned down. This
matches the user's target sound directly ("critically the CENTRE KEPT OPEN FOR HIS VOCAL").

**Confidence: HIGH** — confirmed by exhaustive grep of every `voiceActive` read site; none
touch octave, `MODE_OCTAVES`, `floorMidi`/`ceilingMidi`, or `melodicOctave`.

---

## 3. Freeplay cadence lands on a hardcoded scale degree, bypassing chord-tone resolution entirely

**File:** `client/src/organism/generators/freeplay/MelodyImproviser.ts:510-516`

```js
const cadenceDur = behavior === 'hint' ? 2 : 4
const cadenceSlot = Math.max(0, totalSlots - cadenceDur)
events.push({
  absSlot: cadenceSlot,
  degree: 4,
  velocity: velocityFor(ctx, cadenceSlot),
})
```

**What is wrong:** Every other degree computed in this file (`rawDegreeFor`, `buildContourFallback`)
is routed through `resolveDegreeComplementing(degree, chordDegrees, preferredDegrees, scaleLen, strong)`
so it snaps to the nearest actual chord tone on strong beats. The cadence event — literally the
last note of the phrase, "the period at the end of the sentence" per the sibling comment in
`melodyPhrase.ts:106-108` — skips that call completely and hardcodes `degree: 4`. This is a raw
scale-index, not a chord-relative resolution: for a 7-note diatonic scale, index 4 happens to be
the 5th (usually a valid chord tone), but for the 5-note pentatonic scales this same engine also
uses (`GENRE_SCALES` doesn't cover trap/drill, and `ctx.scaleIntervals` is fed from the Conductor,
which can be `MODE_SCALES.heat`/`gravel` = `[0,3,5,7,10]`), scale-index 4 mod 5 = index 4 = the
interval `10`, i.e. the **flat 7th** — not the root, not necessarily any chord tone at all. There
is also no dependence on `chordDegrees[0]` (the actual current chord's root degree), so even in
the diatonic case the cadence note is disconnected from what chord is actually playing when the
phrase ends.

**Why it sounds wrong:** A cadence that doesn't resolve to a chord tone reads as an "unfinished
sentence" — the melody's ending note can clash against the harmony instead of landing home,
exactly the kind of unresolved dissonance a listener hears as "off," especially in pentatonic
trap/drill modes.

**Confidence: HIGH** — read the literal code; no `resolveDegreeComplementing` call touches this
event before `renderEvents`/`degreeToMidi` convert it to a pitch.

---

## 4. `MODE_SCALES.ice` doesn't match its own comment and contains a half-step clash — live at every session wake in Ice mode

**File:** `client/src/organism/generators/patterns/MelodyPatternLibrary.ts:10`

```js
ice: [0, 2, 3, 5, 7, 10, 11],   // natural minor + maj7 — jazzy lo-fi
```

**What is wrong:** Natural minor is `[0, 2, 3, 5, 7, 8, 10]`. "Natural minor + maj7" (harmonic
minor, replacing the b7 with a major 7) is `[0, 2, 3, 5, 7, 8, 11]`. The actual array is neither:
it drops the b6 (`8`) entirely and keeps **both** the b7 (`10`) *and* the maj7 (`11`) — two
scale tones a single semitone apart. That is not a standard scale in any common jazz/lo-fi
vocabulary; it's an artifact (looks like `8` was mistyped as `10`, or `11` was appended without
removing `10`).

This table is not dead code: `MelodyGenerator.onStateTransition` (line 764) sets
`this.currentScale = [...(MODE_SCALES[physics.mode] ?? MODE_SCALES.glow)]` directly from this
table on every Dormant→Breathing/Flow transition (i.e., every time the organism wakes/starts),
and `rebuildPhrase` is invoked immediately after (line 783) — so this exact interval set plays
before the next Conductor chord-change event overwrites it via `syncFromConductor`.

**Why it sounds wrong:** Ice is the lo-fi/melancholic mode — closest to the user's stated target
aesthetic ("warm melancholic pads"). A scale with a half-step clash between the b7 and maj7 will
produce passing/neighbor tones a semitone apart from the previous note in a way no real "jazzy
lo-fi" line would use; landing a phrase on the maj7 right next to a b7 chord tone the bass/comp
is also playing reads as a wrong note, not color.

**Confidence: MEDIUM-HIGH** — the interval math and comment mismatch are certain; how audible
it is in practice depends on how often `degreeToPitch`/motif steps happen to land on index 5 or
6 (the `10`/`11` degrees) during the brief window before the Conductor resync fires.

---

## 5. Delivered-but-unread context: `nextRootMidi` and `kickTimes16ths` never reach the melody

**Files:** `client/src/organism/generators/freeplay/types.ts:5-16` (field definitions),
`client/src/organism/generators/MelodyGenerator.ts:1247` (call site — `kickTimes16ths: []`
hardcoded, `nextRootMidi` omitted entirely), `client/src/organism/generators/freeplay/MelodyImproviser.ts`
(grepped for `nextRootMidi`/`kickTimes16ths`/`leadBusy16ths`/`hookMode`/`compGesture` — zero matches)

**What is wrong:** `FreeplayContext.nextRootMidi` is documented as "bass-register root the
phrase RESOLVES INTO (conductor lookahead)... nothing for a bassline to connect" — exactly the
signal a cadence would need to anticipate where the harmony is going next. `MelodyGenerator`
never passes it to `buildFreeplayMelodyNotes` at all, and `MelodyImproviser.ts` never reads it
even if it were passed. Separately, `kickTimes16ths` is hardcoded to `[]` at the call site, so
even though the field exists on the interface, the melody generator guarantees it's always
empty and `MelodyImproviser.ts` never reads it anyway.

**Why it sounds wrong:** This is the exact "notes with no reason" complaint — the cadence (see
finding #3) hardcodes a scale degree instead of using the one signal (`nextRootMidi`) that would
let it resolve *into* where the next chord is going, and the melody has zero drum-locked
anchor points to build "construction and substance" around beyond the shared song-cell accents
it already gets via `getSongCell`.

**Confidence: MEDIUM** — confirmed both fields are unread/unwired; whether this is "the" cause
of any specific audible symptom (vs. #3 alone) is a design gap, not a crash-level bug.

---

## Checked and found sound

- `resolveDegreeComplementing` (melodyPhrase.ts) — the "complement the comp's guide tones"
  soft-preference math is internally consistent; scoring/penalty logic checks out.
- `applySoloistEmbellishments` (soloistEmbellishments.ts) — the solo-mode trill/grace budget
  (≤1 trill + ≤1 grace per bar, hold-first, deterministic hash) matches the "riff not shred"
  design brief and doesn't reintroduce the old machine-gun trill bug.
- `getSectionMotif` / `varyMotif` (freeplay/motif.ts) — rhythm-motif commit-then-develop
  discipline is sound; downbeat always anchored, bounded single-operation variation.
- Swing application in `generatePhrase` (MelodyGenerator.ts:1380) and `swungTime` — melody's
  off-16th subdivisions are correctly swung by the shared `currentSwing`, matching drums/bass.
- `MODE_SCALES.heat`/`gravel` (minor pentatonic `[0,3,5,7,10]`), `smoke` (blues scale
  `[0,3,5,6,7,10]`), `glow` (major pentatonic `[0,2,4,7,9]`), `classical` (major/Ionian
  `[0,2,4,5,7,9,11]`) — all match their comments exactly; only `ice` (finding #4) is wrong.
  `MODE_OCTAVES.gravel` vs `heat` (lower octave for drill) matches its comment too.
- `applyVoiceLeading` register-cap logic itself (floor/ceiling clamp, leap-fold toward previous
  note) is correct in isolation — the bug is purely the interaction with the octave-recast
  upstream (finding #1), not a defect in voice-leading's own math.
- `client/src/organism/instruments/ExpressiveEngine.ts` — read in full; it's a generic
  per-note-transform engine (vibrato/swell/breath primitives) with no melody-specific logic or
  hardcoded intervals to check; nothing to flag here.
- `melodyPhrase.ts`'s `PhraseMemory` / `generatePhraseSteps` / `nearestChordDegree` /
  `resolveDegreeForBeat` / `constrainPhraseLength` — exist and are unit-tested but are **dead
  code in production**: grepped the whole `organism` tree and the only non-test callers are
  each other; `MelodyGenerator.ts` and `MelodyImproviser.ts` never import them. Not an audible
  bug (nothing calls them), but worth knowing before extending that file further — it's a second,
  unused phrase-structure system sitting next to the one that's actually wired.
