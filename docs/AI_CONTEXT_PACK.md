# AI Context Pack — CodedSwitch Studio

Purpose: Give an AI the exact repo context it needs to implement UI/UX features without breaking types, API shapes, or workflows.

## Overview
- DAW-like app with AI assist. AI generates melodies, beats, bass lines, lyrics, packs, arrangements, and mastering suggestions.
- All AI outputs must be fully editable; manual workflows always available. Non‑destructive by default.

## Key Files To Read First
- Client (Studio UI)
  - `client/src/components/studio/VerticalPianoRoll.tsx`
  - `client/src/components/studio/types/pianoRollTypes.ts`
  - `client/src/components/studio/StepGrid.tsx`
  - `client/src/components/studio/PianoKeys.tsx`
  - `client/src/components/studio/TrackControls.tsx`
  - `client/src/components/studio/ProfessionalStudio.tsx`
  - `client/src/pages/studio.tsx`
  - `client/src/lib/realisticAudio.ts`
- Server (APIs & AI)
  - `server/routes.ts`
  - `server/services/grok.ts` (xAI/OpenAI wrapper + fallbacks)
  - `server/services/gemini.ts`
  - `server/services/ai-structure-grok.ts`
  - `server/services/ai-structure-generator.ts`
  - `server/services/musicgen.ts`
  - `server/services/musicgen-from-structure.ts`
- Shared
  - `shared/schema.ts` (DB types, not strictly required for UI work)

## Data Types & Conventions
- Piano Roll Notes (client shape):
  - `Note { id: string; note: string; octave: number; step: number; velocity: number; length: number }`.
  - Grid: `STEPS = 32`, one step represents a 1/16 note (0.25 beat). See `pianoRollTypes.ts`.
- Tracks (client shape):
  - `Track { id: string; name: string; color: string; notes: Note[]; muted: boolean; volume: number; instrument: string }`.
- Drum Patterns (server/client):
  - Lanes: `kick, snare, hihat, openhat, clap, tom, bass, perc, crash`.
  - Arrays are boolean or 0/1, typically length 16 (1 bar of 16th notes) or 32 (2 bars).
- Lyrics:
  - Structured sections (Intro/Verse/Chorus/Bridge), lines, optional syllable counts.

## UI/UX Non‑Negotiables
- Editable artifacts only: return MIDI‑like note events, grids, parameters, or manifests. Avoid flattened audio unless exporting.
- Non‑destructive insert: add as new clips/regions with labels, e.g. `AI Melody v3 (seed 1234)`.
- Reproducibility: include `seed` and assumptions (key, tempo, bars, style) in responses and labels.
- Manual parity: when AI is off, provide short step‑by‑step manual instructions using existing tools.

## Constants to Reuse
- From `client/src/components/studio/types/pianoRollTypes.ts`:
  - `STEPS = 32`, `KEY_HEIGHT = 20`, `STEP_WIDTH = 25`
  - Use these in piano‑roll related UI to avoid drift.

## Important Endpoints (normalize shapes)
- Melody: `POST /api/melodies/generate`
  - Input: `{ scale: string, style: string, complexity: number, lyrics?: string, beatData?: any }`
  - Output (normalize to): `{ notes: Array<{ pitch: "C4" | note+octave split; start: beats; duration: beats; velocity: 1–127; track?: string }>, name, scale, musicalAnalysis, seed, assumptions }`
  - Backed by `server/services/grok.ts: generateMelody()` with fallbacks.
- Beats: `POST /api/beats/generate`
  - Current server expects: `{ genre, bpm, duration }` in `server/routes.ts`.
  - Current client sometimes sends `{ style, bpm, complexity }`.
  - Normalize server to accept `style` as alias of `genre` and default `duration=16` steps if missing. Return `{ drums: { lanes... }, bpm }`.
- Lyrics: `POST /api/audio/generate-lyrics`
  - Output should be structured sections. Use `grok.ts` or `gemini.ts`.
- Structure: `POST /api/audio/generate-song`
  - Returns arrangement data via `ai-structure-grok.ts` (strict JSON). Include chord progression and metadata.
- Packs: future `POST /api/packs/generate`
  - Use `musicgen.ts` for metadata‑only or real audio if keys available. Return manifests + optional audio URLs.
- Mastering: future `POST /api/mastering/suggest`
  - Return chain with starting values (EQ, comp, saturator, stereo, limiter) and targets (−14 LUFS, −1 dBTP).

## Adapters (recommended)
- Create a small adapter module to map server pitch strings to client `Note` shape and grid steps.
  - `toPitch(note: string, octave: number) => "C#4"`
  - `fromPitch("C#4") => { note: "C#", octave: 4 }`
  - Steps↔beats: assume `stepsPerBeat = 4` (16ths). `beats = step / 4`, `step = round(beats * 4)`.

## Typical Flows
- Generate Melody → insert as new clip on selected track → allow drag/move/resize, quantize, velocity edit → playback.
- Generate Beat → audition via `useAudio`/`realisticAudio` → convert to StepGrid if needed.
- Generate Lyrics → show structured sections with copy to clipboard → link to melody generation.
- Generate Structure → show sections with instruments/dynamics → future: arrange track regions.

## Error Handling & Fallbacks
- If AI keys missing, services log and return safe fallbacks (`grok.ts`/`gemini.ts` already implement fallbacks).
- Always parse/validate JSON; if parsing fails, use theory‑based fallback (see `generateMusicTheoryBasedFallback`).
- Never crash UI on missing audio init; prompt user to click to enable audio.

## Implementation Priorities (Milestones)
1) Types + adapters: unify constants and create pitch/grid adapters.
2) Piano Roll: finish edit features; import constants from `pianoRollTypes.ts` (avoid duplicate constants in component).
3) AI wiring: normalize `/api/melodies/generate` and `/api/beats/generate` outputs and client adapters.
4) Packs + Mastering: manifest generation and mastering suggestions.
5) Billing gates: heavy audio export behind Stripe, simple generations free.

## Style/Design Notes
- Prefer React + TypeScript + Tailwind. Follow existing tokens and component patterns.
- UX: clear flows, a11y, keyboard shortcuts, tooltips, good empty/error states, and sensible defaults (Key C minor, 120 BPM, 4/4, 8 bars, swing 10%, light humanization).

