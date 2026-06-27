# Make the Melody Sound Like a Melody — design spec

_2026-06-16. The Organism's live melody plays in-key, swung, velocity-shaped notes
but doesn't cohere into a *tune*. Audit of `client/src/organism/generators/
MelodyGenerator.ts` found the engine works **note-by-note** with almost no **memory
across time** — no recurring catchphrase, no arc, no ending. This spec adds the
time-structure layer that turns correct notes into a melody, and formalizes melody
as a timbre-agnostic line any instrument can play._

## Plain-language goal

A melody is like a spoken sentence: a **catchphrase (motif)** said in **breathing
sentences (phrases)** that **rise and fall to a peak (contour)**, creating
**questions and answers (tension/release)** that **land on punctuation (cadence)** —
and the **instrument (timbre)** is just whose voice is saying it. The engine today
has the words and the breaths but keeps changing the catchphrase, never builds to a
peak, and never finishes a sentence. We fix exactly those.

## What exists today (audit result — do NOT rebuild these)

- Melody is already a **note-event stream** (`ScheduledNote[]`: pitch, duration,
  velocity, time) — the "role, not instrument" abstraction is half-real.
- It already reads the harmony from the Conductor (`chordTones()`,
  `scaleIntervals()`, `getKeyPitchClass()`), maps chord tones to scale degrees
  (`chordDegs`), applies the band's shared swing, and adapts note durations to the
  instrument family (`currentPerformer.family`: bowed/wind/brass sustain vs.
  keys/pluck decay).
- It already leaves **rests** between motifs and has a basic call/response answer.
- Safety net: collapse-to-single-pitch falls back to `defaultMinorContour`.

## The three changes

### 1. Commit to a motif, then DEVELOP it (the biggest win)

**Problem:** `generatePhrase` picks a *different* motif each iteration
(`motifBank[(chordSeed + phraseIndex) % bank.length]`) — "motif salad." No idea
recurs, so nothing is memorable.

**Change:** Choose **one** base motif per section (seeded by section + chord +
`sessionSeed`), then build the phrase by **restating it with variation** instead of
swapping it. Variation operators (deterministic, chosen per phrase position):
- **transpose** by a scale step or to a different chord tone,
- **octave displacement** (the existing `transposeOct` generalized),
- **rhythmic augmentation/diminution** (stretch/compress `dur16ths`),
- **inversion** (flip the up/down direction of the motif's steps).

New pure module `melodyMotif.ts`:
```ts
// A motif is the existing MelodyMotif (steps). Variation is pure + testable.
export type MotifVariation = 'identity' | 'transpose' | 'octave' | 'augment' | 'diminish' | 'invert'
export function developMotif(base: MelodyMotif, variation: MotifVariation, amount: number): MelodyMotif
export function pickPhraseVariations(seed: number, phraseCount: number): MotifVariation[]
```
A typical 4-phrase shape: `identity → transpose → identity → invert` (statement,
move it, restate, answer) — the classic "A A' A B" sentence.

**Unity within a section, variety across sections.** A section commits to ONE motif
and develops it (unity — the idea recurs so it's memorable). DIFFERENT sections get
DIFFERENT base motifs, and the **chorus/hook gets a deliberately contrasting motif**
(bigger/higher contour, see §2) so the song has shape section-to-section — exactly
how real songs work (verse idea vs. hook idea). So variety lives *across* sections,
coherence lives *within* a section. `onSectionChange` already fires; it (re)picks
the section's base motif, choosing the contrasting bank for chorus/hook sections.

### 2. Phrase arc — strong-beat chord-tone targeting + climax + cadence

**Strong-beat targeting:** a note that lands on a **downbeat** (`beat 0/2, sub 0`)
must be a **chord tone**; off-beat steps connect chord tones with **stepwise**
scale (passing/neighbor) tones. Today beat position only drives swing/accent — now
it also drives note *choice*. New pure helper:
```ts
// Given the scale, the chord degrees, a target degree, and the beat strength,
// snap to the nearest chord tone on strong beats; allow a passing tone otherwise.
export function resolveDegreeForBeat(deg: number, chordDegs: number[], scaleLen: number, strong: boolean): number
```

**Contour/climax:** shape the whole phrase to rise to one **high point** ~2/3 in,
then descend — a contour curve that biases the octave/degree offset per position.
```ts
export function contourOffset(posFraction: number, intensity: number): number // 0..1 → degree bias
```

**Cadence:** the **final note** of every phrase resolves to a **stable chord tone**
(root, then 3rd/5th), gets a longer duration, and lands on/near a strong beat — the
"period" at the end of the sentence. Implemented as a forced final step appended by
the phrase builder.

### 3. Formalize melody as a voiced stream + section voice assignment

Keep the line generation **timbre-agnostic** (it already emits `ScheduledNote[]`) so
*any* instrument can render the same line. Build the **voice assignment** capability
but keep section hand-off **OFF by default** — one instrument per session for now.
Rationale: timbre-variety is an independent, lower-priority dial, and swapping
instruments only sounds good once the *line* is good; ship the strong line first,
enable hand-off later without touching the note logic.
```ts
// section name → performer id; deterministic, seedable. Falls back to current voice.
export function assignMelodyVoice(section: string, seed: number, available: InstrumentPerformerId[]): InstrumentPerformerId | null
```
Behind a flag `melodySectionHandoffEnabled` (default **false**). When false, the
session keeps one performer (current behavior). When true, `onSectionChange` calls
`assignMelodyVoice` and, if the voice changed, calls the existing
`setInstrumentPerformer`. The duration/family adaptation in `renderMotif` stays
either way. This isolates the (riskier, cosmetic) hand-off from the (core) line fix.

## Architecture / isolation

The musical brain becomes **pure, unit-testable functions** with no Tone.js and no
Conductor singleton — they take plain inputs (scale intervals, chord degrees, length,
seed, contour params) and return note events. `MelodyGenerator.generatePhrase`
becomes the thin orchestrator that gathers inputs from the Conductor, calls these
pure functions, and schedules the result.

```
Conductor (key, scale, chordTones, section, bar)  ─┐
sessionSeed ───────────────────────────────────────┤
                                                    ▼
  pickBaseMotif → developMotif (×phrases) → resolveDegreeForBeat + contourOffset
                                          → append cadence  →  ScheduledNote[]
                                                    │
                              assignMelodyVoice (section) → setInstrumentPerformer
                                                    ▼
                                          Tone.Part (existing scheduling)
```

New files: `client/src/organism/generators/melody/melodyMotif.ts`,
`melodyPhrase.ts`, `melodyVoice.ts` (pure). `MelodyGenerator.ts` shrinks to wiring.

## Error handling

- Keep the collapse-to-single-pitch → `defaultMinorContour` safety net.
- Empty `chordDegs` → existing root/3rd/5th fallback.
- A phrase MUST always end with a cadence note even if the motif runs short — the
  builder appends one rather than relying on motif length.
- Voice assignment returns `null` (keep current voice) if no performer is available;
  never throws.

## Testing

Pure functions get vitest unit tests (matches existing generator test culture):
- `developMotif`: each variation yields a related-but-different step list (e.g.
  invert flips direction; augment doubles durations).
- `resolveDegreeForBeat`: strong beats always return a chord-tone degree; weak beats
  may return passing tones.
- phrase builder: the last note is a stable chord tone (cadence); exactly one
  climax region exists; a recurring motif is detectable across the phrase.
- section contrast: the chorus/hook base motif differs from the verse base motif;
  within a section the motif recurs (unity).
- `assignMelodyVoice`: deterministic for a given seed; falls back gracefully. With
  `melodySectionHandoffEnabled = false` (default), the performer stays constant
  across section changes.
- Regression: existing MelodyGenerator/Organism suites stay green; `npm run check`
  clean.
- By-ear: start the Organism, confirm the lead states a hummable idea, breathes,
  builds, and resolves — and that it can change instrument between sections.

## Addendum 2026-06-23 — §4 Voice-leading + register cap (the line still leaps)

_By-ear feedback from the user (a performer): the violin "goes super high then low
over and over for ~4 bars," with "no direction, no soul." Diagnosis: §1–§3 built the
phrase STRUCTURE (motif, arch, cadence) but the original spec deferred voice-leading
(see old non-goal). With no interval control, motif `index`→chord-tone modulo math
("index 3 = root + 1 octave") plus a 2-octave `MODE_OCTAVES` range makes consecutive
notes jump octaves. The arch never reads as a *line*; expression (`applyStringPerformance`)
can't rescue a leaping contour. So voice-leading becomes the focused next change._

**Change:** a pure post-process on `generatePhrase`'s `ScheduledNote[]`, applied in
`rebuildPhrase` BEFORE `applyStringPerformance` (smooth the line, then shape its
dynamics). It preserves each note's **pitch class** (harmony untouched — the win of
§2 stays) and only adjusts its **octave**:
```ts
// client/src/organism/generators/melody/voiceLeading.ts (pure, unit-tested)
export interface VoiceLeadOptions { maxLeapSemitones: number; floorMidi: number; ceilingMidi: number }
export function applyVoiceLeading(notes: ScheduledNote[], opts: VoiceLeadOptions): ScheduledNote[]
```
Per note after the first: octave-shift toward the previous note until the interval
≤ `maxLeapSemitones` (a leap becomes the nearest octave of the same pitch class);
then clamp into `[floorMidi, ceilingMidi]` by octave (register cap wins over leap).
First note: clamp into register only. Pitch class is never changed.

Wire-in: bowed strings get a tight ceiling (no shrieking) and a small `maxLeap`
(mostly-stepwise singing line). Other leads can keep wider defaults. Velocity,
duration, and time are untouched — only `pitch` changes.

**Tests (pure):** oscillating input (A4,A5,A4,A5) collapses to one octave (no leaps);
a note above the ceiling is octave-dropped under it; output pitch classes == input
pitch classes (harmony preserved); the existing MelodyGenerator/Organism suites stay
green; `npm run check` clean. By-ear: the violin sings a stepwise line that sits in a
sane register instead of zig-zagging.

## Non-goals

- Not touching the ChordGenerator/harmony or the Conductor (harmony already works).
- Not a full counterpoint engine; not ML/LLM melody generation. (§4 adds *octave*
  voice-leading only — pitch classes are chosen upstream and left intact.)
- Not hand-authoring new motif banks — reuse `HIP_HOP_MOTIFS` as seed material; the
  win is development, not more raw motifs.
- Not changing the melody routing/level work shipped earlier this session.
