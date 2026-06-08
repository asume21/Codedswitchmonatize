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

## Non-goals / notes
- A sampler playing generated notes won't always beat a hand-played loop on raw "wow"; it
  wins on playing the actual song in any key. Target: real, expressive, musical.
