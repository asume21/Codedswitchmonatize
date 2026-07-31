- **Production splits uploaded-song storage between `/data/objects` and `./objects`**
  - **Files + line numbers:** `esbuild.config.js:19-25`; `server/index.prod.ts:1-11,68-70`; `server/routes.ts:764-770,4030-4048,4060-4075`; `server/routes/songs.ts:108-133,417-426,488-489`
  - **Which one wins at runtime, and the precise mechanism that decides:** `npm run build` bundles `server/index.prod.ts`, which never assigns `process.env.LOCAL_OBJECTS_DIR`. On a host with `/data`, the inline routes in `server/routes.ts` independently select `/data/objects` and write/read `/api/internal/uploads/*` there. The earlier-mounted `/api/songs` router selects `process.env.LOCAL_OBJECTS_DIR || <cwd>/objects` for its persistence, playback, and conversion paths; without an independently supplied environment variable, its `<cwd>/objects` fallback wins for `/api/songs/*`. The endpoint prefix therefore decides the storage root for the same upload URL.
  - **Observable symptom:** On a persistent-volume deployment, an upload can succeed and be playable through `/api/internal/uploads/*`, while saving the song, serving it through `/api/songs/:id/audio`, or converting it reports the file missing (or stores/reads from ephemeral `./objects`).
  - **Confidence: HIGH**

- **Global “Kill All Audio” is a second Transport owner that bypasses TransportContext state**
  - **Files + line numbers:** `client/src/main.tsx:1-2`; `client/src/App.tsx:239-254`; `client/src/components/layout/GlobalNav.tsx:147-152`; `client/src/lib/globalAudioKillSwitch.ts:55-61,83-106,231-236`; `client/src/contexts/TransportContext.tsx:250-269,290-315`
  - **Which one wins at runtime, and the precise mechanism that decides:** The globally mounted nav button and the global Ctrl+Shift+K listener invoke `globalAudioKillSwitch.killAllAudio()` directly. That method calls `Tone.getTransport().stop()` and `.cancel(0)` but does not call TransportContext's `storeStop()`, `pianoRollScheduler.stop()`, or `arrangementScheduler.stop()`. Its direct stop therefore wins over the transport state whenever either global control is used, bypassing the registered TransportContext owner.
  - **Observable symptom:** Pressing Ctrl+Shift+K or the nav’s Stop All control can silence the Transport while the studio still reports playback as active and its playhead/schedulers continue, yielding a stopped/silent audio engine with stale playing UI state.
  - **Confidence: HIGH**

- **The melodic-loop router shadows the legacy BeatLab loop-library endpoint**
  - **Files + line numbers:** `server/routes.ts:370-372,821-839`; `server/routes/loops.ts:18-25`; `server/services/melodicLoopLibrary.ts:23-30,214-225`; `client/src/components/studio/LoopLibrary.tsx:55-77`; `client/src/components/studio/BeatLab.tsx:220-224`
  - **Which one wins at runtime, and the precise mechanism that decides:** Express registers `app.use('/api/loops', createLoopRoutes())` before the later `app.get('/api/loops', ...)`. For `GET /api/loops`, the mounted router's `router.get('/')` sends its JSON response and never calls `next()`, so it wins; the later legacy handler that emits `{ id, name, filename, category, audioUrl }` is unreachable.
  - **Observable symptom:** BeatLab’s Loop Library receives melodic-loop records with `fileName` and `url`, not the legacy `name` and `audioUrl` contract it was built for. It falls back to displaying every item as “Loop”, while the dead handler’s labeled catalog can never be returned.
  - **Confidence: HIGH**

- **The active `/api/credits` handler shadows a conflicting balance response**
  - **Files + line numbers:** `server/routes.ts:318-319,898-918`; `server/routes/credits.ts:21-37`
  - **Which one wins at runtime, and the precise mechanism that decides:** `createCreditRoutes(storage)` is mounted at `/api/credits` before the inline `app.get('/api/credits')`. Its `router.get('/')` always terminates with either a 401 or `{ message, costs }` and does not call `next()`, so the later `{ credits, totalCreditsSpent }` implementation is unreachable.
  - **Observable symptom:** Any client or developer using the documented-looking root credit endpoint gets only a cost summary instead of the legacy balance/spend fields; changing the lower handler has no production effect.
  - **Confidence: HIGH**

- **WebSense capture creates a competing AudioContext instead of inspecting the shared one**
  - **Files + line numbers:** `client/src/lib/audioContext.ts:12-42`; `client/src/main.tsx:9-15`; `client/src/lib/websenseBridge.ts:233-249,351-367`
  - **Which one wins at runtime, and the precise mechanism that decides:** `getAudioContext()` owns the shared context, but loading the bridge through `?websense=1` exposes a capture action that directly constructs `new AudioContextClass()` to collect telemetry. Neither replaces the other: during a capture the shared context remains live and the bridge’s fresh context is additionally opened until its asynchronous `close()` call; browser audio-session policy decides how the two concurrent contexts contend.
  - **Observable symptom:** A WebSense-enabled capture can briefly add a second audio device/session and alter the context count, sample-rate/latency observation, or audio-unlock behavior while the Studio is playing—making an audio-only issue appear or disappear when telemetry is enabled.
  - **Confidence: HIGH**
