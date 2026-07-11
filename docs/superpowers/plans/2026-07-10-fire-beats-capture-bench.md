# Fire Beats — Capture Bench

**Date:** 2026-07-10
**Branch:** `feat/fire-beats-arrangement-moments`

Continuation of the fire-beats line. **Do not write a new spec** — this extends
the acceptance work in `2026-07-08-fire-beats-acceptance.md` and unblocks the
"land fire beats by ear" gate that `2026-06-24-loop-pack-system-design.md:194`
(Live Band + Loops Hybrid) is parked behind.

## Why

You can hear that a beat is off but waste time guessing which generator caused
it. The bench makes tuning measurable: same seed before/after a change, each
role captured in isolation, saved for level-matched A/B.

## What already existed (reused, NOT rebuilt)

- Deterministic replay — `window.setFreeplaySeed(n)` (`freeplay/utils.ts`).
- Capture tap — `window.__audioDebug.startCapture(ms)` (`audioDebugBridge.ts`).
- Analysis — `GET /api/webear/analyze-app/:id` (`webearRelay.ts`).
- A/B + loudness-matched compare — WebEar MCP `diff_audio`, `groove_score`, `mix_coach`.
- Acceptance scorecard — `2026-07-08-fire-beats-acceptance.md`.

## What was genuinely missing (built here)

1. **Per-role isolation** — `ChannelStrip.setSoloMuted()` + observable `muted`
   getter (uses the output node, independent of the tuned fader so restore is
   bit-exact). `MixEngine.soloChannel(role | null)` mutes the other four;
   `getSoloedRole()` reports state. The soloed stem still runs through the real
   master chain — the honest "what you hear" signal. Also the primitive the
   future Solo Spotlight UI needs.
2. **Dev bridge** — `useMixEngine` exposes `window.soloChannel(role)` and
   `window.__organismMix` in DEV only (mirrors `window.setFreeplaySeed`).
3. **Driver** — `scripts/capture-fire-beats.mjs` + `npm run capture:fire-beats`.
   Per preset: pin seed → play → for each of `full, drum, bass, melody, chord,
   texture`, solo → capture → save WAV (via blob-POST interception, no port
   dependency) + analysis JSON. Writes `manifest.json`.

## Output

`marketing/output/fire-beats/<baseline|candidate>/<preset>-<stem>-seed<N>.{wav,json}`

Presets: Trap 144 / Drill 144 / Boom-bap / Lo-fi (matches acceptance checklist).

## Usage

```bash
npm run dev                                   # client :5001, server :4001
npm run capture:fire-beats baseline 42        # before a change
# ...make one change...
npm run capture:fire-beats candidate 42       # after — same seed
```

Then diff a stem across folders with the WebEar MCP tools, level-matched.

## Tests

`MixEngine.test.ts` — solo mutes the other four, `null` restores all, second
solo un-mutes the first. 22/22 mix tests green.

## Next (by ear, then un-park hybrid)

Run baseline, fix ONE audible weakness at a time (the uncommitted texture/bass/
master changes are the first suspects — capture before touching them), re-run
candidate, keep what wins. Once fire beats land by ear, un-park the Live Band +
Loops Hybrid section of the loop-pack spec — **extend that spec, don't fork it.**
