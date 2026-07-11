# WebEar Stem Capture — Design (PARKED, build after fire beats)

**Date:** 2026-07-10
**Status:** PARKED — fire-beats tuning comes first. This spec captures the design so we don't re-derive it later.

Extends the AI Perception platform direction (see `project_ai_perception_platform`
memory + `server/routes/webearRelay.ts`). **Do not write a second WebEar spec** —
continue this one.

## Goal

Make per-instrument ("stem") capture a first-class, **monetizable** WebEar
capability: one MCP call returns a per-role X-ray (full mix + each instrument in
isolation, each analyzed). Reframes WebEar from "audio meter" to "AI mix engineer
that hears each instrument."

## Monetization framing (the reason to build it)

- WebEar bills per MCP tool call via credits. `capture_stems` = 6 captures + 6
  analyses + a combined report → a premium, high-value unit priced above a single
  `capture_audio`.
- **Build it as a generic protocol, not a CodedSwitch hack.** Any audio app that
  exposes named channels can use it; CodedSwitch is the reference integration.
  That is the platform-positioning play.
- Honest limit: this needs app cooperation (the app must expose channels). It is
  NOT universal stem-separation of arbitrary audio — that would be a separate,
  much larger ML bet.

## Architecture (reuses existing WebEar infra)

Today: MCP tool → `browserRes.write('event: capture', {captureId, durationMs})`
over SSE → browser `__audioDebug.startCapture()` → uploads blob → server analyzes.
Capture, analyze, `diff_audio`, `groove_score`, `mix_coach` already exist. The
capture payload is already extensible (WebEye passes a `selector` field).

### Three integration points

1. **Browser generic hook** (`client/src/lib/audioDebugBridge.ts`, the
   `event: capture` handler): if the payload carries a `role`, call
   `window.__webearStems?.(role)` before `startCapture`, then
   `window.__webearStems?.(null)` after the upload resolves.
   - CodedSwitch implements the hook in `OrganismProvider.tsx` by pointing
     `window.__webearStems` at the existing `mix.soloChannel` (already built for
     the standalone bench). Any other app can implement its own.

2. **Server payload** (`server/routes/webearRelay.ts`): thread an optional `role`
   into the capture event `data: {captureId, durationMs, role}` — same pattern as
   WebEye's `selector`.

3. **New MCP tool `capture_stems`**: sequences full + each declared role,
   collecting captureIds, analyzes each, returns one combined per-instrument
   report (RMS/peak/crest/band-energy per role, plus a "which role dominates /
   which is muddy" summary). Premium credit cost.

### Capability declaration

The app declares which roles it exposes so `capture_stems` knows what to loop.
Minimal: a `window.__webearStemRoles` array (CodedSwitch =
`['drum','bass','melody','chord','texture']`). The tool falls back to the full
mix only if none are declared.

## Relationship to the standalone bench

The standalone `scripts/capture-fire-beats.mjs` stays useful for **deterministic
seed/preset batch runs** (headless, reproducible A/B). WebEar `capture_stems`
covers the **live, logged-in session** case (which the headless script can't do —
it can't be logged in). Same `soloChannel` primitive underneath; no engine
changes needed.

## Not in scope

- Universal/arbitrary-audio stem separation (separate ML bet).
- Pricing specifics (set when wiring credits).
- WebEye/WebSense equivalents (follow the same protocol later if wanted).

## Build order (when un-parked)

1. `window.__webearStems` hook + role declaration in the browser (CodedSwitch → `soloChannel`).
2. `role` through the capture SSE event + browser handler.
3. `capture_stems` MCP tool + combined report.
4. Credit cost + docs.
