# Phase 0 Foundation (human-readable snapshot)

What we locked in:
- Single AI helper (`server/services/aiGateway.ts`) that every feature uses.
- One shared set of music/lyrics/analysis types (`shared/types/aiMusic.ts`) for backend + any client.
- Simple storage abstraction (`server/services/localStorageService.ts`) that saves JSON/audio under `/data/...`, with `/data` served statically in dev/prod.

How to use it:
- Any new AI route calls `callAI(...)` instead of talking to providers directly.
- Reuse the shared types when defining inputs/outputs so frontends stay stable.
- Persist artifacts via `LocalStorageService.saveJson` or `saveAudio`; the server already exposes them from `/data`.

Notes:
- Environment: `DATA_ROOT` is optional; defaults to `./data`.
- This page stays human-friendly; see `.handoff/messages.json` for detailed handoff logs.

## Phase 1 - Song Plan Service (snapshot)

What it does:
- Adds `POST /api/ai/song/plan` to turn a free-text idea into a structured `SongPlan` (BPM, key, sections, mood, references).

Key contracts (in `shared/types/aiMusic.ts`):
- `SongSection`: `{ id: string; type: string; bars: number }`.
- `SongPlan`: includes `id`, `bpm`, `key`, `timeSignature`, `genre`, optional `subGenre`/`referenceArtists`, `mood`, `durationSeconds`, `sections: SongSection[]`, and `createdAt`.

How to use it:
- Clients send `{ idea, targetAudience?, durationSeconds? }` to `/api/ai/song/plan`.
- Backend uses `callAI(...)` to ask Grok for the plan, then stamps `id` and `createdAt` server-side.
- Plan is stored via `LocalStorageService.saveJson("songPlan", plan.id, plan)` so later phases (lyrics, MIDI, arrangement) can reference `songPlanId` without re-calling AI.

---

Phase 2 - Lyrics Engine (human-friendly summary):
- Endpoints live at `/api/ai/lyrics`:
  - `POST /generate` returns section-scoped lyrics JSON and saves under `/data/json/lyrics/{id}.json`.
  - `POST /punchup` returns improved lines JSON and saves under `/data/json/lyrics-punchup/{sectionId}.json`.
- Both use the shared types in `shared/types/aiMusic.ts` and the Phase 0 `callAI` + `LocalStorageService` foundations.
- Inputs expected:
  - Generate: `{ songPlanId, sectionId, style, topic, syllablesPerBar?, rhymeScheme? }`.
  - Punch-up: `{ sectionId, originalLines: [...] }`.

---

Phase 3 - MIDI Pattern Engine (human-friendly snapshot, from Cascade):
- Purpose: produce symbolic tracks (melody, drums, bass) per section using shared types in `shared/types/aiMusic.ts`.
- Melody: `POST /api/ai/music/melody` → `{ sectionId, trackType: "melody", notes: AiNote[] }` for inputs like `{ songPlanId, sectionId, key, bpm, lengthBars, density?, contour? }`.
- Drums: `POST /api/ai/music/drums` → `DrumGrid` for inputs `{ songPlanId, sectionId, bpm, bars, style, gridResolution }`.
- Bass: `POST /api/ai/music/bass` → `BassTrack` for inputs `{ songPlanId, sectionId, key, bpm, bars, chordProgression }`.
- Clients render these as MIDI/piano-roll; backend stores JSON via `LocalStorageService.saveJson(...)`.

---

Phase 4 - Backing Track Audio (human-friendly summary):
- Endpoint: `POST /api/ai/audio/backing-track`.
- Input: `{ prompt, durationSeconds?, seed?, songPlanId?, sectionId? }`.
- Behavior: calls the MusicGen microservice at `MUSICGEN_URL` (default `http://localhost:5005/generate`), expects `{ success, filePath }`, copies the audio into `/data/audio/...`, and returns `audioUrl` plus the IDs you passed.
- Notes:
  - Requires the MusicGen microservice running and reachable.
  - Output is real audio (no placeholders); stored via `LocalStorageService`.

---

Phase 5 - Arrangement Engine (human-friendly summary):
- Endpoint: `POST /api/ai/song/arrange`.
- Input: `{ songPlan, addBreakdown?, notes? }` (must include sections).
- Behavior: uses Grok via `callAI` to build an `ArrangementTimeline` (startBar per section); falls back to a deterministic bar-accurate timeline if AI fails; saves under `/data/json/arrangements/{id}.json`.
- Output: `{ arrangementId, arrangement, songPlanId }` where `arrangement` matches the shared `ArrangementTimeline` type and `automationIdeas` may be included by AI.

---

Phase 6 - Unified Analysis Schemas (snapshot, from Cascade):
- Goal: `/api/songs/analyze` and `/api/lyrics/analyze` always return stable shapes, regardless of AI vs fallback.
- SongAnalysis: fixed fields like BPM/key, vocalAnalysis, lyricsQuality, productionQuality, specificIssues[], commercialViability, analysisNotes. Defaults filled in fallback.
- LyricsAnalysis: fixed fields like rhyme, syllables (per line), sentiment, flow, suggestions, and syllable/rhyme stats. Defaults filled in fallback.
- Clients can import `SongAnalysis` / `LyricsAnalysis` from `shared/types/aiMusic.ts` and ignore which provider was used.
