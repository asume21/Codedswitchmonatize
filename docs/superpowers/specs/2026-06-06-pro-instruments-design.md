# Pro Instruments — make the Organism play every instrument like a real player

_2026-06-06. GOAL (user): the BEST POSSIBLE sound. When I next test, a real band/orchestra
plays a full beat live — every generator/instrument sounds like a real, expressive player,
solo or in full arrangement, with real depth, structure, and sound. Guitar, piano, and sax
get the upgrade too. Do NOT ask me to test until it hits that bar._

## The problem
Picking "violin" for the melody and soloing it sounds far worse than the recorded strings
LOOP that trap/orchestral styles still trigger (`OrganismProvider.tsx:1134`). Stacked causes:
1. **Sound source** — performers play ~12 GM mp3 samples pitch-shifted across the whole
   range. Thin, artifacty.
2. **No expression** — flat ADSR, no vibrato, identical retriggers ("machine-gun").
3. **No space** — dry/mono vs. the loop's recorded reverb + stereo.
4. **Phrasing** — generator note choices aren't always idiomatic for the instrument.

## Reuse (already built)
- `InstrumentRegistry.ts` — 17 performer profiles w/ range/envelope/technique.
- `selectInstrumentPerformer()` + `orchestrator.setInstrumentPerformer(role,id)`.
- `createMultisampleSampler()` / `createSoundfontSampler()`; catalog at `/api/loops/instruments`.
- `multisampleInstruments.ts` scanner: `id_NOTE` files → playable instrument + `classifyFamily`.
- Per-part enable flags; `setChordMultisample()`; technique/articulation engine.

## Real sample sources (decided)
- **SSO** (`D:\wav\SonatinaOrchestra`, CC0): strings (1st/2nd violins, violas, celli, basses),
  winds (flute, oboe, clarinet, bassoon, alto flute), brass (trumpet, horn, tenor trombone,
  tuba), harp. `sus` articulation or solo single-artic; note = last `-token` of filename.
- **VSCO2** (`D:\wav\VSCO2`, CC0): Upright Piano (note via MappingChart), organ, extra artics.
- **VCSL** (downloading to `D:\wav\VCSL_dl`, CC0): GUITARS + SAX (no local source). Sparse
  clone of Guitars/ + Woodwinds/.
- **Existing in-app**: SK e-pianos/FM/organ (already real multisamples).
- ffmpeg 8.0 available for WAV→ogg.

## Build order

### M1. Real multisamples replace GM (biggest jump) — IN PROGRESS
- `scripts/import-sso-instruments.mjs`: for each mapped instrument, extract note from each
  source WAV, ffmpeg → ogg (libvorbis q5, stereo), write
  `audio/loops/SSO_<Id>/SSO_<Id>_<NOTE>.ogg`. Scanner exposes them, no scanner change.
- Later: `scripts/import-vcsl.mjs` (guitar/sax) + `scripts/import-vsco2-piano.mjs`.
- `client/src/organism/instruments/realInstruments.ts`: `loadRealInstruments()` fetches the
  catalog once; `getRealInstrumentNotes(performer)` → note-URL map or null. Add
  `realInstrument?: string` to the performer profile naming its imported instrument id.
- Generators auto-upgrade: in each `applyVoice`, use `createMultisampleSampler(notes,…)` when
  available, else `createSoundfontSampler(samplerPreset,…)`. GM = graceful fallback.
- Add `MelodyGenerator.setMultisampleInstrument` + `orchestrator.setMelodyMultisample`
  (mirror chord path).

### M2. Performance realism
- Humanization: per-note micro-timing, velocity curve, note-length variance.
- Anti-machine-gun: vary detune/velocity on repeats; round-robins where available.
- Idiomatic phrasing: bowed = legato overlap + slow attack; plucked = staccato; honor
  `defaultTechnique`/`defaultLeadArticulation`.

### M3. Per-instrument space
- Convolution/algorithmic reverb + family EQ so a soloed instrument sits in a room.

### M4. Retire loop-as-melody
- Melodic styles drive real sampled performers instead of `MelodicLoopPlayer.play()`. Keep
  loop code PARKED (user: don't delete).

### M5. Self-verification gate
- audio-debug MCP on the MasterBus tap: capture+analyze each instrument soloed and a full
  arrangement; iterate until it clears the bar. Only THEN tell the user to test.

## Additive scope (logged 2026-06-06, after M1) — do AFTER core sound hits the bar
- **Library tab = real sample/instrument browser.** Currently a "coming soon" card
  (`LIBRARY` surface). Populate from `/api/loops/instruments` (playable instruments),
  `/api/loops` (loops), `/api/organism/kits` (drum kits). Pure UI; no sound impact.
- **Loop slicing → notes/one-shots.** Tear phrase loops into transient slices, map to
  pads/notes for re-sequencing. NOTE: superseded for orchestra/piano/sax now that we
  have real recorded single notes. Keep it for (a) GUITAR (no multisample yet, only
  guitar loops) and (b) creative chops (vocal/synth/odd loops).
- **Guitar multisample** still unsourced (VCSL has none). Options: source another CC0
  guitar pack, or slice the musicradar acoustic-guitar loops.

## M2.5 — The Performer: breathe, develop, shape (added 2026-06-19, VIOLIN FIRST)

User's core dissatisfaction: "there is no violin player that just plays the violin like
this over and over." The engine already develops a motif (transpose/invert/augment, fresh
motif per section, 2-bar phrase refresh) AND has a pro-violin envelope + inline Tone.Vibrato.
So the gap is NOT "no variation" — it's that the variation is *mechanical*, there is *no
breath*, and the expression is *static* (flat across the phrase). Two layers of sameness:
content (looped shape) + delivery (fixed articulation). See memory `project_organism_expression_engine`.

Build as a **violin/string performance pass** in `MelodyGenerator` (extend, don't replace the
motif system). Instrument-gated to strings first; capture-test each slice on the soloed violin
via the audio-debug MCP before moving on.

- [ ] **Slice 1 — Breath + phrase-arc dynamics.** Insert musically-placed rests (phrase-end
      "hangs", occasional 1-2 bar drop-outs) so it never fills every bar. Shape velocity as an
      arc across the phrase (swell toward the peak note, ease at the cadence) instead of flat.
- [ ] **Slice 2 — Expressive vibrato + rubato.** Drive vibrato depth/onset from note length &
      phrase position (straight on fast passing notes, blooming on held/peak notes); micro-timing
      leans into the peak, relaxes at the cadence. (Vibrato node already in the chain — modulate it.)
- [ ] **Slice 3 — Idea development, not transform.** Vary density/register/rhythm between phrases
      (call-and-answer: state, leave space, answer changed) so no two phrases feel identical.
- [ ] **Slice 4 — Roll to melody (other leads) + chords**, once violin clears the by-ear bar.

## M2.6 — The Guitar Soloist (hands first, hybrid-ready) — added 2026-06-20

User goal (verbatim intent): "solo melody with a guitar and have it play something — not
just styles or chords but an actual song." Reuse the EXISTING per-generator Solo ("S")
buttons — isolation already works; the gap is the *content* ("it only plays the styles it
can"). The melody already commits to one motif/section, develops it, and targets
`conductor.chordTones()` — so the notes already FIT the chords. What's missing is a real
*player*: idiomatic technique + expression, which today only exists for violin (M2.5).

**North star (documented, not built now): a multi-agent music team.** Two layers:
- **Hands** = rule-based players, real-time (<100ms/note) — *how* to play (technique, feel).
- **Minds** = an agent team (bandleader/Conductor + soloist + rhythm-section brains),
  per-bar/section (~1-2s) — *what* to play. `musicMind` (WebLLM, phase 5-6) is the first mind.
Per-note live AI is infeasible (timing wall); agents DIRECT, hands EXECUTE. Build hands first
because a smart mind with clumsy hands still sounds like MIDI. The ceiling is RAISABLE: the
"level-5" creative ceiling is the *pure-rules* ceiling — the user's hybrid raises it through
the seam below, no rebuild of the hands.

### The split (the seam)
- **Line Source ("what to play")** — `generatePhrase()` + `developMotif` + Conductor chord
  tones (EXISTS, keep). This IS the swappable seam: a future hybrid/AI soloist brain supplies
  notes (+ phrase intent) HERE without touching the Guitar Player. Phase 1 keeps the rule
  brain; isolate the "what" from the "how" but DON'T over-abstract the interface yet (YAGNI).
- **Guitar Player ("how to play it")** — NEW `applyGuitarPerformance(notes)` gated on
  `isGuitar()`, a direct sibling of `applyStringPerformance()` / `isBowedString()`
  (MelodyGenerator.ts:766, :869, :873). Per-note guitar expression hooks into the `Tone.Part`
  callback next to `shapeVibrato` (:807). Real-time rules, always.

### Slices (each: build, then capture-test the SOLOED guitar via audio-debug before next)
- [x] **Slice 1 — Picking dynamics.** `shapeGuitarDynamics()` — arch swell across the phrase
      + downbeat picking accents (non-destructive, velocity only). Gated on `isGuitar()`,
      sibling of the violin pass. Committed 4a10003e; verified on /organism (14 dB DR).
- [x] **Slice 2 — Guitar idiom, per note.** `planGuitarArticulations()` picks an ornament per
      note via the EXISTING articulation engine: scoop-up (bend into peaks), grace-flick
      (hammer-on stepwise-up), fall-off (release at phrase end), else clean pluck. The id
      rides each Tone.Part event, overriding the global articulation for guitar only.
      Committed f6531378. NOTE: true *continuous* pitch bends are deferred — the melody voice
      (PolySynth/Sampler) has no rampable detune (uses inline Tone.Vibrato); these note-based
      ornaments approximate the feel. Continuous bend = a separate audio-chain spike (add a
      pitch-ramp node) if/when wanted.
- [x] **Slice 3 — Call-and-answer development.** `developGuitarPhrase()` — even phrases state
      the idea, odd phrases answer it sparser (thin weak-beat notes, keep downbeats) so
      consecutive phrases contrast instead of looping. Per-guitar phrase counter; runs on the
      LINE before dynamics. Committed c29cda0f.
- [ ] **Slice 4 — Roll out.** Other plucked leads (clean-electric/distortion), then generalize
      the breath/arc/development helpers shared with strings; chords/bass later. Also: optional
      continuous-bend audio spike (see slice 2 note). Do AFTER the user by-ears guitar slices 1-3.

### Verification gate
Solo guitar on `/organism`, audio-debug capture + by-ear: the soloed line must read as a real
guitarist (idiomatic, develops, breathes), not the generic melody algorithm with a guitar
sample. Only then roll to slice 4 / other instruments.

### Phase-1 non-goals
The agent/AI brain itself (north star, later); a full Line-Source abstraction layer; lead
instruments other than guitar (slice 4+); composed "solo sections" in the arrangement
(separate, later — the existing Solo button is the Phase-1 trigger).

## Non-goals / notes
- A sampler playing generated notes won't always beat a hand-played loop on raw "wow"; it
  wins on playing the actual song in any key. Target: real, expressive, musical.
