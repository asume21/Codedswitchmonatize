# HANDOFF — CodedSwitch / Organism + WebEar

_Last updated: 2026-06-26. Full state of what we did this session and what the user
wants next. Read top to bottom before touching the Organism or WebEar._

---

## WHO THE USER IS (read first)

- A **freestyle rapper**. Design for **LIVE performance first**, editing second.
- Wants ONE thing above all: a **guaranteed FIRE beat to freestyle over and
  record/post**. Not a DAW. Not cinematic listening. A beat to *ride*.
- Hardware: Donner 25 Pro (25 keys + 8 pads).
- Solo founder. "Pre-existing failures" are still OURS — never deflect. Owns
  mistakes; expects the same.
- **Cost-constrained.** Cannot afford to rent a GPU. Burns budget on testing.
  Every paid-API path must be justified or free.

---

## THE NORTH STAR (unchanged across sessions)

A **live AI beat-making instrument** that makes a **professional "fire" beat in
real time** — a SONG that builds itself, like a guitarist who finds an idea and
develops it, NOT a loop machine that "gets a good sound going then starts over."
"Fire" = composition + sound + mix. Canonical: `docs/NORTH_STAR.md` +
`docs/superpowers/specs/2026-06-18-conductor-directs-the-band.md`.

### The breakthrough this session (the drift)
> A **freeze→unfreeze cycle RESETS the Organism to "just like I always want it" —
> but it DOESN'T LAST. It DRIFTS away.**

This is the same gap the prior session called "gets a good sound then starts over."
Now we know: **the target sound is achievable; something ACCUMULATES over time and
degrades it.** The freeze→unfreeze resets it because `setLoopMode(false)` makes the
generators rebuild fresh Parts.

**Suspects for the drift:** the reactive / self-listen **volume loops** (they nudge
per-generator gain every frame with no setpoint → oscillate); **audio clock
ownership** (Tone.Transport has two callers, orchestrator never stops it). **Method:**
diff generator/mix state *fresh after a reset* vs. *accumulated when gone bad*, using
WebEar `analyze` to measure both.

---

## THE DIAGNOSTIC METHOD THAT FINALLY WORKED (use this, always)

The user was furious about "flying blind" — changing audio, it sounds the same,
repeat. The fix: **stop guessing, MEASURE** with WebEar on the live output.

- `mcp__webear__capture_audio` (free) → `mcp__webear__analyze_audio` (free DSP, no
  LLM): objective numbers — clipping %, peak/RMS dBFS, per-band energy, onset timing
  jitter, tempo.
- `mcp__webear__describe_audio` (Gemini): perceptual read.

**Proven:** capture caught clipping **+3.77 dBFS / 3.36%**, bass **34%**, timing
jitter **±48 ms**, "no clear beat." After the groove fix: timing **±6.7 ms
(locked)**, bass **25%**, clipping **0.72%**. MEASURED before/after.

**RULE: never change Organism audio blind. Capture → change → re-measure.**

WebEar gotcha: every Railway redeploy drops WebEar's in-memory links. After a
deploy: (1) refresh the CodedSwitch tab (re-runs WebEar.init, browser→server link),
(2) `/mcp` reconnect (me→server link). BOTH needed.

---

## THE TWO OPEN BUGS THE USER NAILED (highest priority)

### 1. Slow loop load + INVERTED button state (the real chaos source)
User: *"the loops weren't working because it takes a year to load, then the buttons
get all fucked up and when it's off it's on and vice versa."*
- `loadLoopPack` awaits `Promise.all` of 5 `loadLoop`s; each `await Tone.loaded()`
  waits for ALL Tone buffers globally; WAVs are large → seconds of load.
- `OrganismProvider.setLoopsModeEnabled` sets React state optimistically + reverts on
  fail, with **no guard against concurrent toggles / stale async completion** → the
  toggle state desyncs/inverts when clicked during the long load.
- **Fix:** request token / loading flag; disable toggle while loading; ignore stale
  completions; faster/pre-decoded assets.

### 2. The drift (see North Star above). Make the "badass" sound LAST.

---

## FREEZE MODE — built then REVERTED (rebuild it RIGHT)

User LOVES a happy accident: pressing **Loops** before the WAVs load leaves the synth
groove **frozen-looping**; unclicking resumes fresh-sounding live composition.
- I built an intentional **Freeze** toggle (freeze drums/bass/chord/texture via
  `setLoopMode(true)`, melody stays live to evolve; `_freezeMode` flag paused
  `director.update()` + `applyArrangement()`). Commit ae019860 → **REVERTED
  (54a8718c)** because the user said *"all it does is freeze and it's laggy as fuck"*
  — no evolution, perf regression, and the "badass" sound was gone.
- **What the user actually wants:** freeze the live groove into a loop that
  **EVOLVES** (fills, melodic variation, build) — not a static repeat — and is NOT
  laggy, and does NOT kill the live sound. Mechanism is valid (`MelodyGenerator.ts`
  `part.loop = true`); execution needs work.

---

## WHAT THE USER WANTS — TWO SEPARATE LOOP MODES (keep BOTH)

1. **FREEZE mode** — freeze the live Organism groove into an evolving loop. The
   freestyler's dream: lock a pocket, let it develop, rap over it.
2. **LOOPS mode** — play the pre-made **Cymatics WAV packs**. Do NOT delete these.

Both selectable, clearly separate, possibly "switchable."

---

## THE PAUSED BRAINSTORM (loops + AI) — resume here

Mid superpowers:brainstorming when interrupted. Approved direction:
- AI has **three jobs over loops:** (1) **Arrange** — which loop variant per section,
  layer in/out (GroovePad-style; AI "taps the pads" behind the scenes, no visible
  grid for now); (2) **Garnish** — sprinkle **FX + one-shots** for variety (user's
  idea: add an FX/one-shot pool to each pack — risers into drops, perc fills, vocal
  chops, so loops don't sound static); (3) **Harmonize** (hybrid) — AI plays LIVE
  melody/bass over the loop bed, musicMind keyed to the loop's key.
- **Hybrid vision (the real want):** loops + live AI AT THE SAME TIME — polished loop
  foundation (drums/bass/texture) with the AI playing live, reactive melody/chords on
  top, harmonized to the loop key. "Both switchable."
- **Recommended (Approach C):** deterministic rule-based **LoopArranger** now (variant
  pick, FX garnish, live/loop split, musicMind key link) + a clean seam for an LLM
  enrichment layer later (same pattern as musicMind: curated rules now, AI raises the
  ceiling later).
- **Gap to close for hybrid:** loop packs store only a single `key`, no progression.
  `loadLoopPack` does NOT set the Conductor key to the pack key — wire that (parse
  "Cm" → root + minor) so live parts harmonize with the loop.

Never speced/built. Resume: superpowers:brainstorming → writing-plans.

---

## SERVER ROUTES MODULARIZATION (SWE-2 session, UNCOMMITTED local work)

`server/routes.ts` went from **5,000 lines → ~190**. All inline route clusters were
extracted into `server/routes/*.ts` factory modules (`createXRoutes(storage)`
returning a `Router` mounted at `/`, paths verbatim). Pre-existing `createXRoutes`
mounts unchanged.

New modules: `publicInfo`, `fileServing`, `aiChat`, `musicGeneration`, `billing`,
`mixing`, `aiOps`, `stemSeparation`, `securityScan`, `playlists`,
`speechCorrection`, `voices`, `audioAnalysis`, `library`, `transcription`,
`tracks`, `jamSessions` — plus `common.ts` holding the shared helpers that used to
be inline (`sendError`, the three rate limiters, multer `upload`,
`LOCAL_OBJECTS_DIR`, `getAudioDuration`, `polishGeneratedAudio`, `NOTE_NAMES`,
`estimateDominantPitchClass`).

**Gotchas preserved:** `NEUMANN_DIR`/`checkoutHandler` consts moved with their
routes; `jamSessions` keeps its `ENABLE_JAMS` env gate; dynamic `import('./x')`
in moved handlers became `import('../x')`; mount order = original code order
(each router mounts where its first region was) so shadowing semantics are
unchanged.

**Verification:** `npm run check` clean, eslint clean on all touched files, and a
route-table diff (mount old vs new `registerRoutes` on a real Express app,
enumerate `app._router.stack`) shows **identical 292-route tables** — zero
missing, zero added. Harness: `tools/smoke_routes.ts`
(`ROUTES_FILE=<module> ROUTES_OUT=<json> npx tsx tools/smoke_routes.ts`);
extractor: `tools/split_routes.py` (region-table driven — do NOT rerun blindly
against the new routes.ts).

**Still open:** handlers are unchanged (intentionally) — the next-level cleanup is
splitting the big modules further (`musicGeneration.ts` is still ~1,300 lines) and
extracting service logic out of handler bodies. Codacy flags pre-existing
handler complexity (Lizard NLOC/CCN warnings) — inherited, not introduced.

---

## WHAT SHIPPED THIS SESSION (all on main, deployed)

### Loop packs
- Surveyed `D:\samopleshopfullyloops` — **47 Cymatics packs, 9,517 WAVs** (~6,475
  loops, ~1,944 one-shots; drums-heavy; deep melodic; light-but-mislabeled chords;
  vocals ~247, FX ~293, perc ~180).
- Built **24 loop packs** (`server/data/loop-packs/*.json` + audio in
  `server/Assets/loop-packs/`): 4 MusicRadar + 6 + 14 Cymatics, gaps filled. Curated
  by key+BPM+vibe (Cymatics construction kits = pre-matched).
- **Wired all 18 presets** to a best-match pack (`loopPackId` in
  `QuickStartPresets.ts`). NOTE: Loops Mode **locks tempo to the pack BPM**.

### Organism generator upgrades
- **Drums:** Cymatics Bang kit is PRIMARY; synth fallback REMOVED — voices scan
  forward through real Cymatics sample variations, silent only if exhausted.
- **Bass:** Cymatics 808 Classic as 808 fallback.
- **Texture → Synth Pads/Keys:** comps the Conductor's voicing through a Cymatics keys
  sample. UI "Texture" → "Synth Pads" (JSON key stays `texture`).
- Melody/Chord NOT swapped (Cymatics are loop stems, not pitched multisamples).

### Arrangement / groove (the "slow, empty, pauses" fix)
- Root: TWO copies of the section form (the "doubles") — client
  `ProducerArrangement` templates AND server `composer.ts`
  `DEFAULT_SECTION_SKELETON`. **Presets run PLAN mode → the SERVER skeleton is what
  plays.** (My first fix scaled the client template — did nothing. Corrected at the
  server.)
- Reworked the server skeleton for FREESTYLING: every section keeps a groove (density
  floor ≥0.45), **no section sits drums/bass `out`**, intro short (2 bars). Build/drop
  come from ADDING energy/leading on a constant pocket, not cutting to silence.
- Trimmed melody phrase breath (Lead rest 6→3 sixteenths).
- Loops follow the arrangement: loop player → `loopGain` node ramped by
  `applyArrangementMultiplier` (GeneratorBase).

### WebEar (the sellable product)
- WebEar = paid MCP gateway: gives a text-only AI "ears" to debug audio. Published npm
  package **`webear` v1.2.4** (`tools/audio-debug-mcp-publish/`); backend at
  codedswitch.com (`server/routes/webearRelay.ts` MCP-SSE, `server/routes/mcpApi.ts`
  HTTP). Billed via credits.
- `analyze` = pure DSP (free). `describe` = multimodal audio model.
- **Switched `describe` OpenAI → Gemini-first** (`server/services/audioDescribe.ts`):
  Gemini free tier primary, OpenAI fallback. Tries a LIST of Gemini model names
  (Google retires them fast — 1.5-flash AND 2.0-flash both 404'd in a day; now tries
  2.5-flash, flash-latest, 2.5-flash-lite, 2.0-flash-001). Env: `GEMINI_AUDIO_MODEL`.
- **Requires `GEMINI_API_KEY` in Railway Variables** (user added it + credits).
- Economics: in production, customers' credits cover the API cost; the user only pays
  for testing (~$0 via free DSP analyze + Gemini free tier). **No GPU** (Qwen2-Audio
  self-host rejected — too expensive). Ollama CANNOT do describe (no audio input).
- npm `homepage` → `codedswitch.com/developer` (the funnel).
- `scripts/webear-stats.ts` (`npm run webear-stats`, needs DATABASE_URL): real funnel
  — keys issued, activation rate, active keys, paying users, credits spent. **npm
  downloads (~1000/3mo) are bot-inflated vanity.** Not yet run (Railway CLI won't auth
  non-interactively — user must `railway login` in a real terminal first).

### Conductor / musicMind — clarified for the user (no code change)
- **musicMind IS built** (`server/services/musicMind.ts`): curated genre×section
  chord-progression matrix (the harmonic brain). (I wrongly implied it wasn't —
  corrected. The UNbuilt part is an optional LLM enrichment layer on top.)
- The Conductor directs: key, chords, the **actual voiced notes** (bass=root,
  chords=voiced inner, melody=complements guide tones), roles (who plays), dynamics,
  the duet, the clock. It does NOT dictate rhythms — players improvise rhythm within
  the harmony. Voicing + voice-leading shipped (Part 3).
- **Subdivisions:** half/quarter/eighth/sixteenth + dotted + 32nds (hat rolls) — yes.
  **NO triplets** (16th grid + swing). Trap triplet hats = main gap.

---

## FRONT-DOOR FIXES (SWE-2 session, UNCOMMITTED local work)

Context: user is about to market (founder story + demo video), so the paths a
stranger hits first were audited. Two live bugs found + fixed:

- **Stripe subscription checkout → 404.** `server/services/stripe.ts:14` and
  `server/routes/credits.ts` send Stripe customers to `/billing/success` and
  `/billing/cancel`; the client only had exact-match `/billing` → `/pricing`
  plus the NotFound catch-all — paying users landed on the 404 page. Webhook
  still provisions the sub server-side, so it was a UX/trust loss, not lost
  revenue. Credit purchases were unaffected (`/credits/success` is a real page).
  FIX: new `client/src/pages/billing-success.tsx` + `billing-cancel.tsx`
  (same design language as credits-*, but subscription-branded — success
  refetches `/api/subscription-status` after 2s and shows the tier), routes
  registered in `App.tsx` inside `ProtectedRoute`.
- **`POST /api/songs/auto-master` never existed.** `AudioToolRouter.tsx`
  "AI Auto Fix" POSTs `{songUrl, songName}` to it; the handler only ever lived
  in the dead `routes/index.ts` and even there just returned a Grok *text plan*
  — it never processed audio. Users got a fake "started" toast then a 404.
  FIX: real implementation in `server/routes/songs.ts` — resolves `songUrl`
  via `resolveLocalAudioPath` (objects-dir containment + exists check), runs
  `masterAudioFile` (loudnorm to -16 LUFS / TP -1.5 + dynaudnorm + head/tail
  fades → mp3), writes `objects/masters/auto-master-*.mp3`, returns
  `{success, fixesApplied, fixedAudioUrl, downloadUrl, explanation}` matching
  the client's expected shape. Gated by `requireCredits(CREDIT_COSTS.
  AUDIO_MASTERING)` (8 credits) and **deducts after success** via
  `req.creditService.deductCredits`.

**Pre-existing bug found, NOT fixed:** `audio.ts` `/audio/export-master` uses
`requireCredits` (balance check, 402s broke users) but **never calls
deductCredits** — a free bypass wearing a paid gate. Likely other routes have
the same pattern — worth an audit of `requireCredits` users lacking a deduct.

Verified: `npm run check` clean; ESLint 0 errors on touched files (4
pre-existing `any` warnings in App.tsx, untouched lines); Codacy clean on the
new pages — only inherited Lizard complexity warnings elsewhere. Live cold test
(www.codedswitch.com): `/` 200, `/organism` 200, `POST /api/demo/perceive`
400 "No audio file provided" (endpoint reachable unauthenticated — the old
prod 401 is gone), JS bundle 200, `/api/subscription-status` guest → 200
free-tier JSON. **NOT deployed** — pushes to main auto-ship to Railway prod;
left for the user.

---

## STILL-OPEN / NEXT (priority order)

0. **Audit `requireCredits` routes that never deduct** — `/audio/export-master`
   confirmed free-bypass; grep `requireCredits(` vs `deductCredits` across
   `server/routes/` to find the rest.
1. **Fix slow loop load + inverted button state** (the root chaos).
2. **Chase the drift** — make the "badass" sound last.
3. **Rebuild Freeze mode** — non-laggy, actually evolving, doesn't kill the live sound.
4. **Fix remaining clipping** — peak still slightly over 0 dBFS. Check the separate
   `toDestination()` paths that bypass `MasterBus`'s safety limiter:
   `MelodicLoopPlayer.ts`, `AceStemLayer.ts`, `ExpressiveEngine.ts` — their sum can
   exceed 0 dBFS.
5. **Resume the loops+AI brainstorm** → LoopArranger (variants + FX garnish + hybrid +
   musicMind key link). Add an `fx`/`oneshots` pool to the pack format.
6. **Triplet support** for trap.
7. (From prior session, still valid) **Cross-phrase melody memory** — carry the
   previous phrase's ending pitch + contour so the lead CONTINUES instead of resetting
   to home register; a recurring motif that develops across sections. Extend
   `melody/voiceLeading.ts`; don't build a new brain.

---

## KEY FILES MAP

- Song artifact: `shared/arrangement.ts` (`ArrangementPlan`, `ArrangementSection`,
  `SectionOrchestration`).
- Composer (writes plans, server): `server/services/composer.ts`
  (`DEFAULT_SECTION_SKELETON` — THIS is what plays in plan mode; Ollama→Grok→
  deterministic).
- Harmonic brain: `server/services/musicMind.ts` (`getProgressionForSection`).
- Conductor: `client/src/organism/conductor/Conductor.ts` (`loadSection`,
  `currentVoicing`, `setKey`); voicing in `conductor/voicing.ts`, duet in
  `conductor/duet.ts`.
- Orchestrator: `client/src/organism/generators/GeneratorOrchestrator.ts`
  (`loadLoopPack`/`clearLoopPack` ~1689; `applyArrangement` ~1417; section listener
  ~238; `onFrame` ~1125).
- Director / skeleton (client): `client/src/organism/state/ProducerArrangement.ts`
  (the OTHER copy of the section form) + `MusicalDirector.ts`.
- Generators: `client/src/organism/generators/{Drum,Bass,Melody,Chord,Texture}Generator.ts`
  + `GeneratorBase.ts` (`applyArrangementMultiplier`, `loopGain`). Loop methods:
  `loadLoop` / `setLoopMode` on each.
- Mix: `client/src/organism/mix/MixEngine.ts`, `mix/channels/MasterBus.ts` (the
  master limiter + safetyClip).
- Provider / toggles: `client/src/features/organism/OrganismProvider.tsx`
  (`songModeEnabled`, `loopsModeEnabled`, `setLoopsModeEnabled`); context in
  `OrganismContext.tsx`; UI pills in `OrganismCommandCenter.tsx`.
- Presets: `client/src/features/organism/QuickStartPresets.ts` (`loopPackId` per
  preset).
- WebEar: `server/services/audioDescribe.ts`, `server/routes/webearRelay.ts`,
  `server/routes/mcpApi.ts`, `tools/audio-debug-mcp-publish/`,
  `scripts/webear-stats.ts`.

---

## CONVENTIONS / GOTCHAS / DON'T

- Railway auto-deploys from `origin/main` = production releases. Every push ships.
- `npm run check` before every commit; keep vitest green. Dev: `npm run dev`. Shell is
  PowerShell: `$env:X="y"; cmd`.
- The user's #1 enemy is **duplicate/competing systems** ("the doubles that haunt
  us"). Search existing specs/plans/code first; EXTEND, don't duplicate. The 18-bar
  section "double" (client template vs server skeleton) is exactly this.
- **Don't change Organism audio blind** — capture + measure with WebEar.
- Don't "fix" the loop by removing repetition (tried before — repetition is the
  "rhyme"; the fix is repetition that DEVELOPS + a real build).
- Don't add UI switches the user didn't ask for. Don't push feature branches to main.
