# ACE Everywhere — ACE-Step as primary provider at every music generation point

_2026-06-12. User decision: ACE-Step becomes the FIRST-CHOICE provider for all
AI music-audio generation, with each point's current provider kept as silent
fallback. Plus the Organism×ACE loop: the ArrangementPlan preview/live coherence
design finally gets its client wiring._

## Why

- We pay Replicate/Suno per call for things our own RunPod ACE-Step worker can do.
- ACE-Step supports text2music (with lyrics), per-track `lego` stems, `extract`,
  and `complete` — covering every generation surface we have.
- The render pipeline is one runtime response-key away from proven (see
  `runpodServerlessService.ts` resolveAudio banner). Everything gates on that.

## Step 0 — Prove the pipe (prerequisite, no feature code before this)

Trigger a cheap render (≤10s audio, inferStep 20) against the configured
`RUNPOD_SERVERLESS_ENDPOINT_ID` from the dev server. If the worker completes but
`resolveAudio` can't find the audio, the structured banner prints the actual
response keys — add that key to the resolver candidates. Done when a playable
file lands in `private/ace-step/output` and is served at
`/api/ai-music/audio/:file`.

## Step 1 — One adapter, not eight edits

`server/services/aceFirst.ts`:

```ts
export interface AceFirstResult { url: string; localPath?: string; durationS: number }
export async function tryAceFirst(req: AceStepRequest, label: string): Promise<AceFirstResult | null>
```

- Health-gates with a short timeout (`isWorkerReady`), submits, polls, normalizes.
- Returns `null` on ANY failure (endpoint down, timeout, no-audio) after logging
  ONE structured line (`[aceFirst] <label> fell back: <reason>`). Never throws.
- Prompt mapping: prose → comma-tag prompt via the existing
  `genreDatabase`/`buildAceStepPrompt` helpers; bpm/duration/lyrics/instrumental
  pass through.

## Step 2 — Wire the generation points (ACE first, current provider fallback)

| Point | File | ACE task | Fallback (unchanged) |
|---|---|---|---|
| Samples/beats/tracks | `unifiedMusicService.generateTrack`, `generateWithMusicGenLarge`, `generateWithStableAudio` | text2music instrumental | Replicate MusicGen / StableAudio |
| Full songs | `unifiedMusicService.generateFullSong`, `generateStitchedSong`; `songs.ts` Suno path | text2music + lyrics | Suno / Replicate |
| Sample packs | `unifiedMusicService.generateSamplePack` (covers `packs.ts`) | text2music per sample | local MusicGen / JASCO |
| Backing tracks | `aiAudio.ts` → backingTrackService | text2music instrumental + bpm | current service |
| Stems | `stemGeneration.ts` | `lego` per requested track | MusicGen sidecar |

Routes `audio.ts`, `packs.ts`, `lyrics.ts`, `astutely.ts` inherit via
unifiedMusicService. Response shapes to the client DO NOT change.

## Step 3 — Organism×ACE: the ArrangementPlan loop (client wiring)

Backend already shipped (`composer.ts`, `Conductor.loadPlan/loadSection`,
`Orchestrator.loadArrangementPlan`, `POST /api/ai-music/compose`). Missing:

1. OrganismProvider (Song Mode path) calls `/api/ai-music/compose`, stores the
   plan, calls `orchestrator.loadArrangementPlan(plan)`.
2. "Render preview" action: feed `plan.acePrompt` (+bpm/key tags) through the
   same ACE pipeline → user hears the song the band is about to play.
3. Section durations derive from `plan.sections[].bars` instead of the fixed
   32-bar PRODUCER_ARRANGEMENT skeleton when a plan is loaded.
4. Coherence check: render + live playback of the same plan share key/bpm/
   progression by construction.

## Error handling

ACE failures are invisible to users: one log line, silent fallback. No new
client error states. Serverless cold starts are tolerated by the existing
10-minute poll budget; adapter health-gate keeps interactive paths snappy.

## Testing

- Unit: `aceFirst` fallback behavior with mocked service (down / timeout /
  no-audio / success).
- Integration: Step 0 live render is the gate. After Step 2, one live call per
  wired surface, verified by file-on-disk + HTTP 200 on the served URL.
- Existing unit suites must stay green (`npm run test:unit`, `npm run check`).

## Non-goals

- Credits/pricing changes.
- Client UI redesigns (Step 3 adds wiring + a preview trigger, not new surfaces).
- Removing Replicate/Suno/JASCO (they're the fallback tier).
- The Organism's live instruments keep playing real multisamples — ACE renders
  previews/audio artifacts, it does not replace the live band.
