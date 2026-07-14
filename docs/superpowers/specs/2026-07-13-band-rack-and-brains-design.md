# The Band Rack & The Brains — Design

**Date:** 2026-07-13
**Status:** Approved direction from brainstorming session (band-rack architecture,
seat/brain assignments, reimagine path). Ready for implementation planning.

**This spec EXTENDS, never rivals:**
- `2026-06-18-conductor-directs-the-band.md` — the Conductor stays the sole musical
  authority. Part C here puts a brain in that seat; it does not create a new one.
- `2026-06-12-ace-everywhere-design.md` — ACE-Step stays the audio renderer. Part D
  adds one new task shape (audio-in reimagine), reusing the same pipe.
- `2026-07-11-organism-as-playable-instrument-design.md` — the product umbrella.
  This spec is the "tape machine + who plays" half of that identity.

---

## The one-sentence vision

The Organism is a five-player band; everything it plays lands as **editable MIDI
tracks** in the studio (the rack), the plan it plays from is written by the best
available **brain** (Claude → Ollama → deterministic), and any take can be
**reimagined** by ACE-Step into record-quality audio — while the notes stay the
editable source of truth.

## The law that drives everything

> **Anything the AI makes must be editable.** The AI is the DAW. Its output is
> notes first, audio second. Rendered audio is always a bounce of the current
> notes, never the master copy of the idea.

## The seats (who does what)

| Seat | Occupant | Nature |
|---|---|---|
| Composer | Claude → Ollama → deterministic (`server/services/composer.ts`) | AI, offline, one plan per session |
| Conductor | `Conductor.ts` (rules today; brain consult = Part C, later) | Executes the plan; sole authority |
| Players ×5 | Generators (drums, bass, chords, melody, texture) | Rules — our musical taste as code |
| Tape machine | **The Band Rack** (Part A — the missing build) | Five ordinary studio tracks of MIDI |
| Record button | Render → ACE-Step reimagine (Part D) | Audio polish, gated on render pipe |

---

## Part A — The Band Rack (build first)

### What it is

Five **ordinary studio tracks**, one per generator: Drums, Bass, Chords, Melody,
Texture. Not a special AI panel — they live in the existing track system, appear
in the mixer and arrangement view, solo/mute like any track. The drum track opens
in the Beat Maker; the others open in the Piano Roll. Created (or reused) when the
Organism starts.

### The performance stream (the one new pipe)

Each generator, at the moment it schedules a note into Tone.js, also emits that
note event to a single client-side **performance stream** (a small store — NOT
window events). Two consumers:

1. **Track writer** — always subscribed, even with no editor open. Accumulates
   notes into each generator's track as editable notes. Nothing is ever lost to
   an unmounted component.
2. **Live lighting** — when an editor is open, piano roll keys flash and beat
   maker cells pulse as notes fire. Pure display; costs nothing extra; this is
   the "you can watch the AI play" feature, and it rides the same pipe.

### Track content model: the current loop, revised in place

Matching the locked-loop philosophy (a beat = sections of locked loops): each
track holds the **current loop's notes**, updated in place when the band changes
pattern (new section / new riff). The user watches the band sculpt.

**Keep/Save** snapshots all five tracks as they currently stand → a saved beat in
MIDI, editable, exportable. This is the harvest moment: hear fire → Keep → yours.

### Kills these doubles (delete, don't deprecate)

- `ai:loadBeatPattern` window event (`DrumGenerator.ts` hand-rolled dispatch,
  `UnifiedStudioWorkspace.tsx` second hand-rolled dispatch, `ProBeatMaker`
  listener) — replaced by the stream.
- `ai:loadNotes` dead listener in `VerticalPianoRoll.tsx` (nothing ever sent it).
- `aiToEditorBridge.ts` dispatch functions (never called by anyone). The format
  converters in that file may be reused by the track writer if they fit.

### Downstream = existing machinery, no new engines

- **Playback:** saved tracks play through the unified DAW clock
  (TransportContext → pianoRollScheduler) and studio instruments. Already exists.
- **MIDI export:** `midiExport.ts` already exists — wire it to the rack tracks
  (per track and all-five).
- **Out of scope (v1):** two-way sync (Organism reading user edits back),
  non-note texture audio, continuous timeline recording of whole songs.

---

## Part B — Claude in the composer seat (small, do alongside Part A)

`composer.ts` already has the relay pattern: Ollama JSON → defensive validation →
deterministic fallback. Extend the chain by one link:

```
Claude (Anthropic API, already a configured provider)
  → Ollama (Railway service, llama3.2:3b)
  → deterministic plan builder
```

- Same system prompt contract (JSON ArrangementPlan, allowed template/style IDs).
  Claude gets the same defensive validation — no brain is trusted.
- One call per session start; seconds of latency acceptable (offline seat);
  cost is cents and meterable through the existing credit ledger.
- Why: the song ARC (build, contrast, story) is the diagnosed gap between
  "loops" and "a song" — composition is the highest-leverage decision, and the
  big model writes plans in the band's native vocabulary (real style IDs,
  techniques, roles).
- Env-selectable brain order so dev can test each link in isolation.

---

## Part C — The Conductor gets a brain (design sketch; spec details belong in
the conductor master spec when built)

At each section boundary (Conductor already has lookahead), one consult to the
brain relay: live state in (section, energy, what changed, mic hot?), a small
**multiple-choice decision set** out (e.g. thin hats / bass walks into drop /
melody lays out 2 bars). Validated JSON; late or malformed answer → rules
proceed unchanged. **Never worse than today** is the floor.

Deferred until the rack exists (so its choices can be heard AND harvested), and
until Part E's jam sessions have discovered which decisions actually matter —
the jam transcript becomes the decision menu and the prompt.

## Part D — The Reimagine Path (extends ace-everywhere)

The reverse of "ACE as composer" (rejected — its output has no notes, violates
the editability law). Instead:

1. Band performance → rack tracks (Part A)
2. Tracks render to audio (capture-bench machinery + the render pipe — which is
   still gated on the one `resolveAudio` response-field fix, see
   `project_render_pipeline_state`)
3. Render goes INTO ACE-Step as source audio + target tags, moderate strength →
   same groove and structure, record-quality production on top
4. Output is a bounce. Edits happen in the notes; re-render; reimagine again.

The strength dial is a user-facing creative control ("how much the engineer
cooks"). Per-stem reimagine via ACE `lego` is a later refinement.

## Part E — The jam method (how we tune the brains)

Before automating the conductor seat: Claude sits in live during dev sessions —
WebEar for ears (capture + analyze between sections), the browser-connected
OrganismCommandCenter for hands, one decision per section. Record what moves
made the band feel alive; that transcript defines Part C's decision menu.

Product moment: a reel — Claude conducting the band live, the user freestyling
over it. (WebEar `capture_video` / `create_post_from_video` exist for this.)

---

## Build order (each step feeds the next)

1. **Part A — Band Rack** (performance → editable MIDI; the harvest)
2. **Part B — Claude composer** (better plans immediately; tiny diff)
3. **Render-pipe field fix** (unblocks everything audio)
4. **Part D — Reimagine** (the "make it a record" button)
5. **Part E jams → Part C conductor brain** (the AI that's really there, live)

## Testing

- Performance stream: unit-test that generator note events land in the store
  with correct step/pitch/velocity mapping (pure functions, no Tone).
- Track writer: notes survive editor unmount/remount; Keep/Save snapshot
  deep-copies (no live mutation after save).
- Composer relay: contract test per brain link — malformed JSON from any link
  falls through without altering the plan shape (mirror existing Ollama
  validation tests).
- By-ear acceptance stays king (fire-beats bench) — a green suite that sounds
  wrong is red.
