# Loop Pack System — Design Spec
_2026-06-24_

## Problem

The Organism's generators compose notes dynamically in real time. This is hard to make consistently sound professional — quality depends on algorithm choices, and the result can feel mechanical. The user needs a **guaranteed fire beat** they can record and post without tuning knobs.

## Solution

A standalone **Loop Pack System**: pre-produced audio loops organized into genre packs, distributed to and played by the existing generators. When Loops Mode is ON, each generator swaps its compose-notes logic for play-this-loop. Everything else — audio routing, MixEngine, section energy, volume faders — stays identical.

The user sees no new UI complexity: same genre picker, same Organism controls, one new **Loops Mode** toggle. The sound is guaranteed because every loop in a pack was produced to work together (same BPM, same key, same vibe).

---

## Architecture

### 1. Pack Format

A pack is a JSON manifest + a folder of audio files (WAV, hosted on GCS/S3). Stored at `/api/loops/packs/:id`.

```ts
interface LoopPack {
  id:     string               // e.g. "hip-hop-classic"
  genre:  string               // matches QuickStartPreset.genre
  bpm:    number               // session BPM locks to this when pack is active
  key:    string               // e.g. "C", "Am"
  label:  string               // display name
  loops: {
    drums:   LoopClip[]
    bass:    LoopClip[]
    melody:  LoopClip[]
    chords:  LoopClip[]
    texture: LoopClip[]        // pads, atmospheres, other
  }
}

interface LoopClip {
  id:   string
  url:  string                 // absolute GCS/S3 URL
  bars: number                 // loop length in bars (2, 4, or 8)
  label?: string               // optional human name
}
```

Each genre's `QuickStartPreset` gets one new optional field:

```ts
loopPackId?: string            // ID of the pack to load in Loops Mode
```

Packs are fetched via `/api/loops/packs/:id` (public endpoint — no auth required, same as `/api/loops`). The server reads pack manifests from GCS/S3 or a local JSON file in dev.

**Pack sizes:** 12–24 loops per pack. Minimum viable pack: 2 drum + 2 bass + 3 melody + 2 chord + 1 texture = 10 loops. Full pack: up to 24.

---

### 2. Generator Loop Mode

Each generator gets two new methods. No changes to existing generate/compose logic.

```ts
// Added to every generator (Drum, Bass, Melody, Chord, Texture)
loadLoop(clip: LoopClip): Promise<void>   // preloads audio, ready to play
setLoopMode(enabled: boolean): void       // switch between compose and loop playback
```

When `loopMode = true`:
- The generator's `processFrame` / `scheduleNext` plays the loaded `Tone.Player` loop instead of composing
- The loop is set to `loop: true` on the `Tone.Player`, quantized to bar boundaries
- All existing routing stays: generator output → generator's MixEngine channel → master bus
- Section orchestration still applies: if the plan says drums are `'out'`, the drum loop's volume is floored to 0 via `roleCeiling()` (no code change needed — this is already wired)

When `loopMode = false`:
- Generator resumes composing as normal (existing behavior)
- The loaded `Tone.Player` is stopped and released

**Loop sync:** `Tone.Player` is started at the next bar boundary via `Tone.Transport.scheduleOnce(() => player.start(), '@1m')`. This guarantees clicks-free, in-time entry.

---

### 3. GeneratorOrchestrator — pack distribution

One new method on `GeneratorOrchestrator`:

```ts
loadLoopPack(pack: LoopPack): Promise<void>
```

Steps:
1. For each instrument type (drums/bass/melody/chords/texture), picks the first available clip from the pack (AI or simple round-robin — see §4)
2. Calls `generator.loadLoop(clip)` on each generator in parallel
3. Calls `generator.setLoopMode(true)` on all generators once loaded
4. Adjusts `Tone.Transport.bpm.value` to match `pack.bpm`

```ts
clearLoopPack(): void
```

Steps:
1. Calls `generator.setLoopMode(false)` on all generators
2. Releases preloaded audio
3. Restores session BPM

---

### 4. Loop Selection (AI direction)

For V1: simple **round-robin / random pick** from each instrument pool within the pack. The pack is small enough (2–4 per type) that any pick sounds good — that's the point of the pack.

Future (not this spec): the Conductor or a lightweight LLM call picks which loop variant fits the current section energy (e.g., sparse drum loop for intro, heavy variant for drop). The interface (`loadLoop(clip)`) already supports hot-swapping at section boundaries.

---

### 5. OrganismProvider — mode toggle

One new boolean:

```ts
const [loopsModeEnabled, setLoopsModeEnabled] = useState(false)
```

When toggled ON:
1. Fetch the pack for the current preset's `loopPackId`
2. Call `orchestrator.loadLoopPack(pack)` — generators keep composing during the 1–2s load so there's no silence gap; loop mode activates once all clips are buffered
3. If no `loopPackId` exists for this preset, log a warning and stay in generate mode silently

When toggled OFF:
1. Call `orchestrator.clearLoopPack()`
2. Generators resume normal compose mode

**UI:** One **"Loops"** toggle button in the existing Organism controls bar. No other UI change. If no pack exists for the current genre, the button is greyed out with a tooltip "No pack available for this genre yet."

---

### 6. Server — pack API

New route added to the existing `/api/loops` router:

```
GET /api/loops/packs           → list available packs (id, genre, label, bpm, key)
GET /api/loops/packs/:id       → full pack manifest with loop URLs
```

Public endpoint (no auth). Pack manifests are either:
- **Dev:** JSON files in `server/data/loop-packs/`
- **Prod:** fetched from GCS/S3 bucket `codedswitchmonatize-loop-packs`

No database table needed in V1 — manifests are static JSON files. A future admin UI can manage them.

---

## File Map

| File | Change |
|---|---|
| `shared/loopPack.ts` | NEW — `LoopPack`, `LoopClip` types |
| `server/data/loop-packs/` | NEW — JSON manifests (dev) |
| `server/routes/loops.ts` | ADD `/packs` and `/packs/:id` routes |
| `server/index.ts` | Already public — no change needed |
| `client/src/organism/generators/DrumGenerator.ts` | ADD `loadLoop`, `setLoopMode` |
| `client/src/organism/generators/BassGenerator.ts` | ADD `loadLoop`, `setLoopMode` |
| `client/src/organism/generators/MelodyGenerator.ts` | ADD `loadLoop`, `setLoopMode` |
| `client/src/organism/generators/ChordGenerator.ts` | ADD `loadLoop`, `setLoopMode` |
| `client/src/organism/generators/TextureGenerator.ts` | ADD `loadLoop`, `setLoopMode` |
| `client/src/organism/generators/GeneratorOrchestrator.ts` | ADD `loadLoopPack`, `clearLoopPack` |
| `client/src/features/organism/QuickStartPresets.ts` | ADD `loopPackId` field |
| `client/src/features/organism/OrganismProvider.tsx` | ADD `loopsModeEnabled`, fetch + load pack |
| Organism UI controls | ADD "Loops" toggle button |

---

## What This Is NOT

- No new audio engine or synthesis path
- No changes to MixEngine, MasterBus, or audio routing
- No changes to the Conductor, ArrangementPlan, or section system
- No user-facing loop grid or box visualization (that's future)
- No loop generation — loops are pre-made audio files
- No generator replacement — generators keep all existing logic; loop mode is an additive flag

---

## Success Criteria

1. User toggles Loops Mode ON → Organism starts playing a fire beat within 2 seconds
2. Beat is locked to pack BPM, all loops in time
3. Toggle OFF → generators resume composing, no audio glitch
4. User can record the output (existing record flow unchanged)
5. No crash when a genre has no pack yet (silent fallback to generate mode)

---

## Future Direction: Live Band + Loops Hybrid (2026-07-09, PARKED until fire beats lands)

Captured from a session discussion so the idea isn't lost. **Not active work.**

### The priority, stated plainly

**The generators are the main fire source. Full stop.** The user's position:
the live band CAN produce fire beats on its own, and that's the north star
(see the fire-beats arrangement-moments work, PR #38). Loops are never the
answer to "the generators don't sound good enough" — that gets fixed in the
generators themselves.

### What the hybrid IS (when its time comes)

A blend mode, not a replacement: loops as *supporting texture* under a live
band that leads. Example: a pack's texture/perc loop runs as a bed while the
live drum, bass, melody, and chord generators compose on top — one clock
(TransportContext), one harmonic brain (Conductor), one arrangement.

Most seams already exist:
- `applyLoopSceneForSection()` already swaps loop scenes on section change
  inside the same arrangement tick the band follows.
- Freeze mode already proves the live/static blend (frozen groove + evolving
  melody).
- ArrangementPlan is the single artifact both paths read.

Main missing piece: loop channels responding to `applyArrangementMultiplier`
and the pre-drop break ducks the way generator channels do, so arrangement
moments (pre-drop break, drop-entry boost) hit loops and band together.

### Sequencing

1. Fire beats via generators (ACTIVE — arrangement moments, PR #38). ✅
2. Validate by ear; fix the freeze→unfreeze drift decay. ✅ (song cell 0ba70d82, pad source fix 586fa611)
3. Only then: hybrid blend mode, extending THIS spec — do not write a new one. ← **ACTIVE 2026-07-16 (below)**

---

## Hybrid Implementation: Switches, Not Modes (2026-07-16, ACTIVE)

The groove-work design note applies here verbatim: **switches, not modes.**
There is no third "Hybrid Mode" toggle — each of the five rows gets a SOURCE
switch: `band` (live generator composes) or `loop` (pack clip plays). What we
call "Loops Mode" is just all five switches on `loop`; the hybrid is any mix.

### Defaults (from the standing feedback rule)

Generators are THE fire source; loops are supporting texture only. The Hybrid
quick-toggle therefore flips **texture → loop** and leaves drums/bass/melody/
chords on `band`. The user can flip any row live from the Command Center.

### Mechanics

- `GeneratorOrchestrator.rowSources: Record<LoopInstrument, 'band'|'loop'>`,
  default all `band`. `setRowSource(row, source)` flips ONE generator's
  `setLoopMode`, guarded on a loaded pack for `loop`.
- `loadLoopPack(pack, rows?)` — optional `rows` limits which rows flip to
  `loop` on load (default: all five = existing Loops Mode, unchanged).
  Buffers still warm for the whole pack so later flips are instant.
- **BPM lock**: Transport locks to `pack.bpm` while ≥1 row is `loop`
  (WAV clips can't follow tempo); restores the pre-lock BPM when the last
  loop row flips back to `band`.
- **Key**: Conductor key is harmonized to `pack.key` on pack load (already
  shipped) — so live rows compose in the loop's key. One harmonic brain.
- **Arrangement**: `loopGain` already follows the arrangement multiplier
  (GeneratorBase), so section dynamics and moments hit loop rows and band
  rows together. `applyLoopSceneForSection` must only swap rows whose
  source is `loop` — a `band` row's generator owns its own part.
- Flipping a row back to `band` replays the last organism state to that one
  generator (same replayStateToGenerator path clearLoopPack uses) so its
  Parts rebuild on the grid.

### Success criteria

1. Hybrid quick-toggle: texture bed loops under the live band within 2s,
   no BPM/key clash, one clock.
2. Any row flips band↔loop live without stopping the others (players stay
   phase-locked; band rows keep composing).
3. Arrangement moments (pre-drop cut, drop boost) audibly shape loop rows
   and band rows together.
4. Loops Mode (all-loop) and Generate Mode (all-band) behave exactly as
   before — they are just switch presets now.

---

## Sample Leads: the Band HEARS the Loop (2026-07-17, ACTIVE)

The row switches connected the wiring; this connects the MUSIC. User verdict
on switches alone: "not even close." The missing piece is the hip-hop
production model: **the loop is the SAMPLE the beat is built around.** The
band must hear what's inside it — its key, its chords, its bounce — and play
WITH it. This is the song-cell fix one level up: the cell cured five
generators ignoring each other; this cures the band ignoring the sample.

### Vision decisions (user, 2026-07-17)

- End state: "one living thing" — loop and band indistinguishable from one band.
- First domino: **band hears the loop** (composition-level lock, this section).
- Who leads: **the loop is the sample/star**; the band derives from it.
- Scope: pack loops first; "drop any sample in" is phase 4 on the same analyzer.

### 1. Musical DNA — analyzed once at import (approach A)

Extend the EXISTING per-clip profiling (LoopProfile / profile-loops.ts —
do not build a parallel pipeline) with a `musical` block per clip:

```ts
interface LoopMusical {
  keyGuess:    string | null   // 'Am'
  chordPerBar: string[]        // ['Dm7','G7','Cmaj7','Am7'] — one per bar
  onsetGrid:   number[]        // 16 values 0..1 — hit strength per 16th slot
  analyzedAt:  string
}
```

Server-side script (`scripts/analyze-loop-musical.ts`) decodes each WAV
(same ffmpeg approach as profile-loops), then:
- **onsetGrid**: envelope energy rise per 16th slot at the pack BPM
- **chordPerBar**: pitch-class energy (Goertzel at semitone bins) per bar →
  best-fit major/minor triad
- **keyGuess**: aggregate chroma vs major/minor key profiles

Deterministic, zero runtime cost, and the same analyzer runs at upload time
in phase 4.

### 2. Runtime: existing brains, new food

`GeneratorOrchestrator.setSampleLeadClip(row | null)`:
- **Conductor**: `setProgression(clip.musical.chordPerBar)` + key from
  keyGuess — bass/chords voice-lead WITH the sample. (API already exists.)
- **Song cell**: the loop's onsetGrid becomes the section's cell
  (`setSampleCell` override in songCell.ts) — drums accent the sample's
  rhythm, bass lands on its hits, chords comp in its GAPS.
- **Roles**: melody drops to support (sparse, answers in the gaps) — the
  "chords as the hook" flip with the sample as the hook.
- Motifs cleared + patterns rebuilt so the band re-derives immediately.

### 3. UI

"🎤 Sample Leads" chip in the hybrid row-chip strip: picks the sample row
(first loop row among chords → melody → texture) and engages the above.
Off = loop plays but band composes independently (the old hybrid).

### Phases to "one living thing"

1. Band hears the loop (THIS).
2. Loop obeys the groove — chop/retrigger with the band's pocket.
3. The glue — loop through band channel strips/sidechain/master color.
4. Any sample upload — same analyzer at upload time.
