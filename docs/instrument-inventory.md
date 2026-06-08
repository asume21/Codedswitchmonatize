# Instrument & Sample Inventory

_Generated 2026-06-06. Foundation for the "Organism plays any instrument solo" feature._

This is the answer to two questions: **what can the app already play?** and **what raw
samples do we own (in `D:\wav`) that we could turn into playable instruments?**

---

## PART 1 — What the app can play TODAY (in-app instruments)

### 1A. Self-hosted GM soundfonts — the proven, ready-now path
Loaded by `createSoundfontSampler()` (`client/src/organism/instruments/SamplerUtils.ts`)
from `client/public/soundfonts/`. The generators (bass/chord/melody) already render
through these. **23 instruments, playable immediately, no new work:**

| Family    | Instruments |
|-----------|-------------|
| Keys      | `acoustic_grand_piano`, `electric_piano_1` |
| Bass      | `acoustic_bass`, `electric_bass_finger`, `synth_bass_1` (+ fallbacks: `synth_bass_2`, `slap_bass_1`, `fretless_bass`, `electric_bass_pick`) |
| Guitar    | `acoustic_guitar_nylon`, `electric_guitar_clean`, `distortion_guitar` |
| Strings   | `violin`, `cello`, `string_ensemble_1` |
| Brass     | `trumpet`, `trombone`, `french_horn` |
| Woodwind  | `flute`, `clarinet`, `oboe`, `alto_sax` |
| Other     | `choir_aahs`, `marimba`, `vibraphone`, `orchestral_harp`, `sitar` |

> Note: these are ~12 mp3 samples per instrument (every minor third, octaves 3–5),
> Tone transposes for full range. Good for "playable now", lower fidelity than the
> full multisample libraries below.

### 1B. Real note-mapped multisample instruments (high fidelity)
Built by `createMultisampleSampler()`, served from `audio/loops/` via
`/api/loops/instruments`. **Keys only so far:**
- `SK_ElPiano01`–`05` (electric pianos)
- `SK_FMPiano01`–`03` (FM/digital pianos)
- `SK_Organ01`–`04` (organs)

These are what the keys-styles comp chords on. **This is the path to extend** — same
mechanism works for any note-mapped pack (e.g. importing the orchestra in Part 2).

### 1C. Synthesized "realistic" instruments
Hand-built Web Audio synthesis in `client/src/lib/audio.ts` — violin (bowed, formant-
filtered), guitar (plucked), flute, piano, bass. No samples; pure synthesis. Fallback
voices.

### 1D. Phrase loops (fixed recorded phrases, NOT playable per-note)
`MelodicLoopPlayer` plays these whole; they can't play arbitrary notes:
- `MoodyString_Mini_SP`, `Soul&DiscoStrings_Mini_SP` (string phrases)
- `NordicPop_Mini_SP`, `TriSamples Melody`
- `musicradar-acoustic-guitar-samples` (guitar loops 85/120 bpm)
- Soulful Keys loops & chord-hits

### 1E. Drum kits
- Organism sample kits via `/api/organism/kits` (`server/services/organismKitLibrary.ts`)
- GM-style kit names used by presets: `808`, `909`, `lofi`, `acoustic`, `default`

### 1F. The generators (the "players")
`GeneratorOrchestrator` drives 5: **Drum, Bass, Chord, Melody, Texture.** Each can be
enabled/disabled and (chord today, melody soon) swapped to a real multisample voice.

---

## PART 2 — Raw samples we OWN (`D:\wav`) — not yet wired into the app

### Note-mapped instrument libraries (→ can become playable instruments)
| Library | Files | Contents | Articulations |
|---------|-------|----------|---------------|
| **SonatinaOrchestra** | 1,626 | Full orchestra: 1st/2nd Violins, Violas, Cellos/Celli, Basses, all brass, all woodwinds, harp, piano, harpsichord, celeste, choir, mallets, percussion | `sus` (277), `piz` (134), `rr1`/`rr2` round-robins |
| **VSCO2** (Versilian Chamber Orch.) | 3,174 | Brass (F Horn, trombones, trumpet, tuba), Strings (cello/violin sections), Keys (organ, uprights), Percussion (glock, marimba, timpani, xylo), woodwinds | sus, stac, pizz, spic, trem, susvib, mute, vib |
| **Pianos** | 2,495 | Yamaha Grand, Dusty Upright, Archive LoFi Piano + synth string/pad patches (Kawai/Korg/Roland) | — |

### Drum / percussion sample packs
- `musicradar-drum-samples` (934), `musicradar-808-samples` (378 — full 808 hits + loops),
  `99 Drum Samples II` (110), `[99Sounds] 99 Drum Samples` (99)

### Composition data (not audio)
- `LakhMIDIDataset` (~178,561 MIDI files) — melody/progression mining, MIDI training, NOT samples
- `GrooveMonkeeFreeMIDI` — MIDI drum grooves

### Still packaged / needs extraction or format work
- `Strings`, `All` — `.zip` (unextracted)
- `VirtualPlayingOrchestra`, `Choir`, `Woodwinds`, `Drums`, `Chords`, `Basslines` —
  empty or non-WAV format (likely `.sfz`/`.nki`); needs investigation

---

## Gap analysis — what's missing to "play any instrument solo"

1. **Melody generator can't take a multisample yet** — only the chord generator has
   `setMultisampleInstrument`. Need the mirror on `MelodyGenerator`.
2. **No orchestral multisamples imported** — SonatinaOrchestra/VSCO2 are on disk but not
   in `audio/loops/` nor in the scanner's `id_NOTE` naming → not in `/api/loops/instruments`.
   Need a one-time import/convert pass (pick `sus` notes, WAV→ogg, rename).
3. **No per-instrument "solo" selection** in the Organism UI/control surface — currently
   instrument choice is driven by style preset, not user pick.
4. **No "play this instrument live over the current beat" mode** — the generators follow
   the Conductor; need a path to point one generator at a chosen instrument on demand.
