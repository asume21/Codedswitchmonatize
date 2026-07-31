# Chord Audit — "the chords is way off" (2026-07-29)

Scope: ChordGenerator.ts, freeplay/ChordImproviser.ts, freeplay/score.ts,
conductor/Conductor.ts, conductor/voicing.ts, patterns/*, techniques/*.
Read-only; no edits made.

---

## Finding 1 — Chord register sits dead center in the rapper's vocal pocket, with no carve-out

**File:line:** `client/src/organism/conductor/voicing.ts:85-88` (`bassBase = 36`,
`center = 55`, `low = 48`, `high = 67`) — consumed by
`client/src/organism/generators/ChordGenerator.ts:598` (`conductor.currentVoicing().inner`).

**What is wrong:** The comping ("inner") voices are constrained to MIDI 48-67
(C3-G4 = ~130-392 Hz), and the code comment even says "Chords live an octave
below the lead — octave 3 voicings (C3-G4) are the hip-hop/R&B register."
There is no filter, sidechain, or dynamic carve applied to the DRY chord
signal for this band — the only highpass in the FX chain
(`ChordGenerator.ts:346`, `reverbReturnHP` at 250 Hz) is on the *reverb
return only*, not the dry `dryBus` path that carries most of the signal
(`dryBus` gain 0.72 vs `reverbSend` gain 0.24, `ChordGenerator.ts:343-355`).
I grepped the whole `organism/` tree for any vocal-aware mechanism
(`vocal|duck|sidechain|mic`) and found none — nothing anywhere ducks or
EQs the chord bed when a vocal is present.

**Why it sounds "off":** A male rap vocal's fundamental typically sits
~85-180 Hz with its first formant (the body of the voice, the part that
reads as "presence") around 300-800 Hz. The chord comp's entire register
(130-392 Hz) overlaps that fundamental-to-F1 window directly. There is
nothing in this codebase that opens space there — the user's stated target
("center open for his vocal") is aspirational in memory/CLAUDE.md, but
unimplemented in the actual chord voicing code. The chords aren't wrong
notes; they're wrong real estate — parked exactly where the vocal needs
room, at full volume, with no frequency or dynamic yield mechanism.

**Confidence: HIGH** (register bounds and missing carve are directly
verified in code; the acoustic overlap with typical male speech/rap
fundamental+F1 is well-established, not inferred from a comment).

---

## Finding 2 — Chords default to 'lead' role (full activity ceiling) AND hook-mode presence, simultaneously, with no arrangement plan

**File:line:** `client/src/organism/generators/GeneratorOrchestrator.ts:2049-2052`
```
this.drum.setRole(orch?.drums ?? 'lead')
this.bass.setRole(orch?.bass ?? 'lead')
this.melody.setRole(orch?.melody ?? 'support')
this.chord.setRole(orch?.chord ?? 'lead')
```
combined with `client/src/organism/generators/arrangementRole.ts:9-16`
(`roleCeiling('lead') === 1.0`, `roleCeiling('support') === 0.6`) and
`client/src/organism/generators/freeplay/ChordImproviser.ts:88-98`
(`clampHookVel` raises velocity to 0.4-0.85 vs `clampVel`'s 0.3-0.7, and
`leadRoom = (slot) => hook || slot === 0 || !leadBusy.has(slot)` — in hook
mode the melody-dodge preference is unconditionally disabled).

**What is wrong:** In jam mode (no `ArrangementPlan.orchestration`, which is
the common case — freestyling over a live beat, exactly this user's use
case per his profile), the chord seat's role defaults to `'lead'`, same as
drums and bass — giving it the same 1.0 activity ceiling as the rhythm
section, while melody/texture are capped at 0.6. That role ALSO flips
`ChordImproviser` into `hookMode`, which (a) raises the comp's velocity
floor/ceiling, (b) turns off the "dodge the lead" preference entirely,
and (c) remaps quiet bed gestures (`sustain`, `phrase-end`) into loud
foreground ones (`stabs`/`roll`/`call-response`) via `toHookGesture()`.

**Why it sounds "off":** This is a deliberate "chords-as-the-hook" design
(dated 2026-07-17, per the code comments), but stacked with Finding 1 it
means: by default, the chord layer plays at full loudness ceiling, in a
foreground/hook rhythmic character, parked in the vocal's frequency pocket,
never yielding to the melody. For a freestyle rapper wanting "a tight simple
pocket... center open for vocal," this is close to the opposite of the
target mix — the chords behave like a second lead vocalist rather than
"pads AS the colour."

**Confidence: HIGH** for the mechanism (role defaults and hook-mode effects
are directly verified); **MEDIUM** for whether this specific default is
"the" cause the user is hearing vs. a contributing factor, since it depends
on whether the session in question had no `ArrangementPlan.orchestration`
set (jam/freeplay mode) — the common path per his workflow, but not
verified against the specific recording that prompted the complaint.

---

## Finding 3 — `applySpread` (drop-2 voicing) can push the WHOLE chord up multiple octaves in a way that fights `high`, only enforcing the floor

**File:line:** `client/src/organism/conductor/voicing.ts:42-53`
```ts
function applySpread(closeInner: number[], style: VoicingStyle, low: number): number[] {
  if (style === 'close' || closeInner.length < 3) return closeInner
  const v = [...closeInner].sort((a, b) => a - b)
  v[v.length - 2] -= 12
  v.sort((a, b) => a - b)
  while (v[0] < low) {
    for (let i = 0; i < v.length; i++) v[i] += 12
  }
  return v
}
```
**What is wrong:** The drop-2 spread only checks the FLOOR (`low = 48`) after
dropping the second-from-top voice an octave; it never re-checks the ceiling
(`high = 67`) afterward. For a 4-voice chord whose top note started near 67
and whose 2nd-from-top was already near the floor, the octave-lift loop can
push the entire voicing (including the original top note) up by 12+
semitones to clear the floor, landing the top voice well above `high` (into
G5+ territory) with no bound. This affects `lo-fi / r&b / soul / chill /
west-coast` sub-genres, which are set to `'spread'` in
`Conductor.ts:209-228` — genres squarely in this user's stated
"warm melancholic" wheelhouse.

**Why it sounds "off":** An unbounded top voice pushed into the 5th octave
reads as thin/bright "toy-keyboard" — the exact failure mode the code's own
comment at `ChordGenerator.ts:48-50` warns against ("Voicing them up at
octave 4+ reads as bright 'toy-keyboard' against an 808"). This would
manifest as an occasional, chord-dependent register spike rather than a
constant problem, which matches an inconsistent "something's off" complaint
better than a chord being wrong every time.

**Confidence: MEDIUM** — the code path is real and the missing ceiling
re-check is a genuine gap, but triggering it requires a specific chord
shape (tight lower cluster near the floor) that I did not exhaustively
enumerate against the 176-progression bank's actual voicings; I did not
observe it fire in a live capture.

---

## Additional (not primary — noted for completeness)

- **Dead duplicate `voiceChord`:** `client/src/organism/generators/patterns/ChordProgressionBank.ts:305-319`
  exports a second, unrelated `voiceChord(chord, rootPitchClass, octave)` that
  does simple root-position stacking with no voice-leading. I grepped every
  import site in `client/src` and confirmed it is **never imported anywhere**
  — `ChordGenerator`/`Conductor` both use `conductor/voicing.ts`'s `voiceChord`
  exclusively. This is a "doubles" fossil (same name, competing logic) but it
  is dead code, not currently audible. Worth deleting for the next person who
  greps "voiceChord" and edits the wrong one, but not a cause of the reported
  problem. **Confidence: LOW** (as an audible cause) / **HIGH** (as a real
  duplicate that should be removed).

---

## Checked and found sound

- **`CHORD_INTERVALS` table** (`Conductor.ts:51-74`) — every quality's
  interval literal verified against its label (maj/min/dim/aug/sus2/sus4/
  dominant7/maj7/m7/mMaj7/dim7/m7b5/9/maj9/m9/add9/6/m6). All correct.
- **Guide-tone selection** (`voicing.ts:114-122`) — filters semitones
  {3,4,10,11} (m3/M3/b7/maj7), matching the definition of "guide tones."
  Correct.
- **`DEFAULT_PROGRESSIONS` per sub-genre** (`Conductor.ts:160-179`) — spot
  checked every entry's Roman-numeral comment against its actual chord
  symbols (boom-bap i-iv-V-i, trap i-VI-VII-i, drill i-v-VII-VI, r&b
  I-vi-ii-V, etc.). All match.
- **`compVoicingForHit`** (`freeplay/score.ts:42-51`) — the 4-cycle
  (full stack / drop lowest / move top up / shell) only ever returns notes
  drawn from the Conductor's own voiced tones (±12); it never invents a
  wrong-quality note. Confirmed no hardcoded interval bypasses
  `chordIntervals`.
- **`conformChordToInstrument` / `conformMidiToRange`** (`performers/
  InstrumentPerformerRouter.ts:147-185`) — checked every registered
  instrument's `range` in `InstrumentRegistry.ts`; all spans are ≥ 20
  semitones (well over an octave), so per-note octave-shifting to fit an
  instrument's range cannot scramble the intended voicing order/inversion.
- **`voiceChordHit` figuration gestures** (`melody/chordFiguration.ts`) —
  strum/keyboard/bloom/stab/block all only reorder/offset the SAME note
  set passed in; no pitch is altered, transposed, or wrong-interval'd.
- **Chord-vs-bass register collision** — bass register is MIDI 33-48
  (~55-130 Hz, `BassGenerator.ts:730-734` comment) and chord inner voices
  are MIDI 48-67 (~130-392 Hz) — these only touch at the boundary (C3),
  not stacked on top of each other. Not a bass/chord mud problem; the
  overlap is with the VOCAL, not the bass (see Finding 1).
- **Kick/snare dodging** — confirmed still functions even in hook mode
  (`collides()` in `ChordImproviser.ts:130-131` applies unconditionally);
  only the lead-dodge preference is disabled in hook mode, per the design
  comment at `types.ts:20-21`.
