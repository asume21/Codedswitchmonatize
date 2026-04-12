# AI Handoff Context

This file helps Replit Agent and Windsurf/Cascade share context when working on this project.

---

## Last Updated
**Date:** April 12, 2026
**By:** Claude Code (Opus 4.6)

---

## Current State
Organism technique/articulation system shipped end-to-end: categorical style shifts,
per-generator runtime transforms, and manual overrides from the brain panel. Stable.

---

## Recent Changes
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
