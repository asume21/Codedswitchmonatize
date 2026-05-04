# AI Handoff Context

This file helps Replit Agent and Windsurf/Cascade share context when working on this project.

---

## Last Updated
**Date:** May 3, 2026
**By:** Codex (GPT-5.5)

---

## Current State
Organism technique/articulation system remains in place. A shared composition-clock
reflex now snaps generator event times to the DAW grid and starts regenerated live
parts on a common measure boundary, improving pulse lock across drums, bass, melody,
and chords. The Organism now also has an instrument performer layer that turns
generic melody/bass/chord intent into instrument-aware guitar, violin, bass, flute,
strings, brass, wind, and keyboard performances. Drum generation now favors a
deterministic foundation groove and stable kit timbre on startup/rebuilds so the
rhythmic skeleton does not wander before higher-level musical variation is added.

---

## Recent Changes
### Organism — Drum Foundation / Pocket Stabilization (May 2026)
- Removed random initial drum pattern selection from
  `client/src/organism/generators/patterns/DrumPatternLibrary.ts`.
  `buildDrumPattern()` now uses each mode's first foundation groove, and
  `buildSubGenrePattern()` defaults to variant `0` unless the caller supplies an
  explicit variant index.
- Reordered mode foundations so Heat starts with a sparse trap groove, Smoke with
  boom-bap, Gravel with boom-bap grit, Ice with minimal lo-fi, and Glow with a
  simple dream groove.
- Tamed `DrumGenerator` kit behavior:
  - Stable one-kit-per-mode mapping instead of random kit swaps on rebuild.
  - Lower hi-hat and percussion volumes, reduced MetalSynth resonance, and softened
    hat bandpass filtering to reduce brittle "diharmonic" top-end.
  - Tightened kick pitch sweep/envelope and reduced timing jitter from 8ms to 3ms.
- Added `client/src/organism/generators/__tests__/DrumPatternLibrary.test.ts`
  covering deterministic foundation selection and kick/snare anchoring.

### Organism — Multi-Instrument Performer Layer (May 2026)
- Added `client/src/organism/performers/` with:
  - `InstrumentRegistry.ts`: performer profiles for nylon/clean/distorted guitar,
    violin, cello, electric/upright/synth bass, flute, clarinet, sax, trumpet, piano,
    Rhodes, string ensemble, harp, and sitar.
  - `InstrumentPerformerRouter.ts`: mode/role-based performer selection plus range
    conformance and mono/poly chord voicing rules.
  - `types.ts` and barrel export.
- Wired performer profiles into live generators:
  - `MelodyGenerator` now selects lead performers by Organism mode and performer energy,
    loads the matching SoundFont preset, uses performer-default lead articulation, and
    keeps generated notes inside the instrument's playable range.
  - `BassGenerator` now selects electric/upright/synth bass performers by mode, loads
    the matching bass sampler, applies performer-default bass articulation, and conforms
    bass notes to instrument range.
  - `ChordGenerator` now selects chord performers by mode, loads the matching sampler,
    uses performer-default chord technique, and adapts chord voicings for mono instruments
    like violin/trumpet or compact plucked voicings like guitar/harp.
- Added `client/src/organism/performers/__tests__/InstrumentPerformerRouter.test.ts`
  covering performer selection, note↔MIDI conversion, range conformance, mono voicing,
  and compact plucked voicings.

### Organism — Composition Clock / Quantization Reflex (May 2026)
- Added `client/src/organism/generators/CompositionClock.ts` as a shared timing layer
  for Organism generators.
- Drum, bass, melody, and chord generator rebuilds now use `getLivePartStart()`:
  stopped Transport pre-rolls from `0`; running Transport rebuilds enter on the next
  measure boundary instead of each generator choosing its own next `16n`.
- Generator event times now pass through `quantizeGridTime()` before reaching
  `Tone.Part`, snapping AI/generated decimal drift to the nearest 16th and clamping
  events to the loop frame.
- Melody and chord generated swing decimals are now normalized at the event-grid layer;
  expressive timing should come from technique/articulation callbacks, not from
  unsynchronized Part start positions.
- Added focused tests in
  `client/src/organism/generators/__tests__/CompositionClock.test.ts`. Verified with
  CompositionClock + GeneratorOrchestrator unit tests and production build.

### Organism — Technique & Articulation System (Apr 2026)
- **Chord technique library** (`client/src/organism/techniques/library.ts`): 20 idiomatic
  techniques across piano / guitar / strings / brass / wind families. Each exposes a
  `schedule(notes, ctx) → ScheduledEvent[]` that splits a chord over time (block, rolled,
  strum, alberti, tremolo, muted-stab, legato, etc.).
- **Articulation library** (`client/src/organism/techniques/articulations.ts`): 9 single-note
  transforms for Melody + Bass (legato-slur, staccato-pop, grace-flick, trill-ornament,
  bass-slide-up, bass-ghost-note, bass-octave-jump, bass-walking-step, plus 'none' identity).
- **Mode-default maps**: Each organism mode (heat/ice/smoke/gravel/glow) auto-picks an
  idiomatic technique + articulation combo when the user hasn't overridden.
- **Runtime wiring**: `ChordGenerator:442`, `MelodyGenerator:479`, `BassGenerator:373` all
  invoke the library transforms inside their `Tone.Part` callbacks — so schedule changes
  reach the audio graph every event.
- **StyleShift reactive behavior** (`client/src/organism/reactive/behaviors/StyleShift.ts`):
  Maps smoothed rapper energy → {low, mid, high} zones via hysteresis + 8s cooldown; each
  zone commits a `{chordTechnique, melodyArticulation, bassArticulation}` preset through
  the orchestrator. Toggleable via `ReactiveBehaviorEngine.setStyleShiftsEnabled()`.
- **Brain Panel UI** (`AstutelyBrainPanel.tsx` → Style section): dropdowns for chord
  technique / melody articulation / bass articulation + auto-shift toggle. Routed through
  `astutelyOrganismBridge` → window events → `OrganismProvider` to reach the orchestrator.
- **Warmup phrase integration**: Cypher / storytelling / other presets assign a specific
  technique+articulation combo on entry, with override semantics so mode defaults don't
  clobber them mid-phrase.
- **Test coverage**: 37 new unit tests (`library.test.ts` 13, `articulations.test.ts` 17,
  `StyleShift.test.ts` 7). Plus defensive hardening in articulations for jsdom Tone.js
  fragility (try/catch around `Tone.Time` / `Tone.Frequency`).

### Organism — Earlier 2026 work
- **Chord generator** (5th Organism generator): 176 real chord progressions, mood-mapped,
  drives chord-aware bass/melody. See memory `project_chord_generator.md`.
- **Unified DAW clock**: `TransportContext` owns `Tone.Transport.start/stop` and
  `pianoRollScheduler`. `getAudioContext()` is the single shared `AudioContext`.
- **Arrangement timeline**: `DawArrangementView` with clip ops, automation, undo/redo
  (commit `b11e13f`).

### Pre-organism (Dec 2025)
- ProBeatMaker localStorage persistence, MIDI learn mode, computer keyboard hook.

---

## In Progress
Nothing currently in progress.

---

## Next Steps / Backlog
- **UI clear-override affordance**: Brain panel has dropdowns that force override, but no
  "reset to mode default" button. `MelodyGenerator.clearArticulationOverride()` exists
  but isn't surfaced in UI.
- **Velocity mirroring for techniques**: Chord techniques currently use static velocities.
  Could mirror performer energy (similar to EnergyMirroring behavior) for livelier feel.
- **Genre-locked technique sets**: Technique picker could filter by detected genre rather
  than just by instrument family. See `project_organism_architecture.md` memory for the
  drift problem this would address.
- **Test coverage for generators**: 28 pre-existing tests still fail in jsdom due to
  missing `cancelScheduledValues` on Tone mocks. Not blocking but should be cleaned up.
- Integrate computer keyboard hook into VerticalPianoRoll, BassStudio, MelodyComposer.

---

## Key Files to Know
| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project conventions + architecture primer for AI agents |
| `replit.md` | Full project documentation |
| `client/src/organism/techniques/library.ts` | 20 chord techniques (piano/guitar/strings/etc.) |
| `client/src/organism/techniques/articulations.ts` | 9 single-note transforms for Melody + Bass |
| `client/src/organism/reactive/ReactiveBehaviorEngine.ts` | Merges reactive behaviors → orchestrator |
| `client/src/organism/reactive/behaviors/StyleShift.ts` | Energy→technique/articulation preset |
| `client/src/organism/generators/GeneratorOrchestrator.ts` | Central generator control surface |
| `client/src/contexts/TransportContext.tsx` | Single source of truth for audio clock |
| `client/src/contexts/AstutelyCoreContext.tsx` | React-facing Organism API |
| `client/src/lib/astutelyOrganismBridge.ts` | Context ↔ Organism decoupling via window events |
| `client/src/components/studio/AstutelyBrainPanel.tsx` | UI for overriding Organism state |
| `client/src/components/studio/ProBeatMaker.tsx` | Beat maker with persistence |
| `docs/IMPLEMENTATION_PRIORITY_GUIDE.md` | Feature roadmap |

---

## Notes for Next Agent
- Project uses React + TypeScript + Vite (frontend) and Express (backend)
- Audio uses Tone.js and soundfont-player
- All shadcn/ui components available at `@/components/ui/`
- Database is PostgreSQL with Drizzle ORM
- Refer to `replit.md` for full context

---

## How to Use This File
1. **Before starting work**: Read this file to understand current state
2. **During work**: Update "In Progress" section
3. **After finishing**: Move completed items to "Recent Changes", clear "In Progress", update "Next Steps"
4. **Always update**: The "Last Updated" timestamp and "By" field
