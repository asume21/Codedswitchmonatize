# Runtime Environment Variable Audit — CodedSwitch Studio

Scope: server/, Dockerfile*, docker-entrypoint.sh, esbuild.config.js, railway.json.
Read-only audit. `server/index.prod.ts` confirmed as the production entrypoint
(esbuild.config.js `entryPoints: ['server/index.prod.ts']`, Dockerfile `CMD ["node", "dist/index.cjs"]`).
`server/index.ts` is dev-only.

Ranked by blast radius (data loss / auth first).

---

## Finding 1 — DATABASE_URL missing in production silently degrades to in-memory storage (data loss)

**Variable name:** `DATABASE_URL` (and its alias `DATABASE_PUBLIC_URL`)

**Every file:line that reads or sets it:**
- `server/index.ts:89` — inside `validateEnv()`: if both `DATABASE_URL` and `DATABASE_PUBLIC_URL` are unset in production, pushes to a `missing[]` list that triggers `logger.fatal(...)` + `process.exit(1)` (index.ts:94-105). **This function only runs in dev**, since `server/index.ts` is not the production entrypoint.
- `server/index.prod.ts:128` — `const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;`
- `server/index.prod.ts:129,148-150` — `const hasDatabase = Boolean(databaseUrl && databaseUrl.length > 0)`; if false: `console.log('⚠️ DATABASE_URL not set - using MemoryStore (not recommended for production)')` — warning only, no exit.
- `server/index.prod.ts:211-213` — `const storage: IStorage = databaseUrl ? new DatabaseStorage() : new MemStorage();` — the actual user/credits/songs storage backend, not just sessions.
- `server/db.ts:15` and `server/migrations/runMigrations.ts:9` also read the same `DATABASE_URL || DATABASE_PUBLIC_URL` pair, independently of index.prod.ts.

**Which environment breaks and how:** Production only. `index.prod.ts` has hard `process.exit(1)` guards for `SESSION_SECRET` and `AUTH_TOKEN_SECRET` (lines 16-23) but **no equivalent guard for `DATABASE_URL`**. If the variable is ever unset or mistyped in the Railway service config (a redeploy, a variable-name typo, a service recreated without copying vars), the app boots successfully, passes the healthcheck, and silently runs on `MemStorage` — an in-process Map that is wiped on every restart/redeploy.

**Observable symptom:** App works normally after deploy; users can sign up, buy credits, upload songs. On the *next* restart/redeploy (including a routine Railway redeploy), every user, credit balance, session, and song record created since the last restart with a real DB connection is gone — but the process never crashed and no alert fired, only a `console.log` line easily lost in Railway's log stream. This is the exact production gap the project's own `index.prod.ts:69-75` comments describe fixing for `LOCAL_OBJECTS_DIR` — the same class of dev-only protection never ported to prod — but it is still open for `DATABASE_URL`.

**Confidence: HIGH** (verified by direct code read of both index.ts and index.prod.ts; the fail-fast exists in the file that doesn't run, and is absent from the file that does).

---

## Finding 2 — VITE_* client env vars: only VITE_GOOGLE_CLIENT_ID survives the Docker build; other VITE_ vars are silently dead in production regardless of Railway config

**Variable names:** `VITE_GA_MEASUREMENT_ID`, `VITE_ENABLE_DESKTOP_BRIDGE`, `VITE_WEBEAR_API_KEY` (contrast: `VITE_GOOGLE_CLIENT_ID`, which works)

**Every file:line:**
- `Dockerfile:19` — `ARG VITE_GOOGLE_CLIENT_ID` is the **only** VITE_ ARG declared before the build step.
- `Dockerfile:20` — `RUN VITE_GOOGLE_CLIENT_ID="$VITE_GOOGLE_CLIENT_ID" npm run build` — only this one var is passed into the Vite build environment.
- `.dockerignore:6` — `.env` is excluded from the Docker build context, so the local `.env` (which does define `VITE_GA_MEASUREMENT_ID`, `VITE_WEBEAR_API_KEY`, `VITE_ENABLE_DESKTOP_BRIDGE` — see `.env:36,53,60`) never reaches the image either.
- `client/src/App.tsx:182` and `client/src/lib/analytics.ts:11,43` read `import.meta.env.VITE_GA_MEASUREMENT_ID` with only a `console.warn` fallback (analytics.ts:13-16) — no server-side substitute.
- `client/src/contexts/DesktopBridgeContext.tsx:26` reads `import.meta.env.VITE_ENABLE_DESKTOP_BRIDGE === 'true'` — no server-side substitute; the feature simply cannot be toggled on in production no matter what is set in the Railway dashboard, because Vite bakes `import.meta.env.VITE_*` at build time and the Dockerfile never forwards this variable into the `npm run build` step.
- `client/src/lib/webnerveBridge.ts:88`, `webeyeBridge.ts:80`, `weblogBridge.ts:138`, `websenseBridge.ts:89`, `webshieldBridge.ts:80`, `audioDebugBridge.ts:168` all read `VITE_WEBEAR_API_KEY` first but fall back to a per-user, auth-gated `/api/webear-keys/reveal` server endpoint — this one degrades gracefully, so it is **not** broken, just inconsistent with the others (worth noting, not a bug).

**Which environment breaks and how:** Production only. Setting `VITE_GA_MEASUREMENT_ID` or `VITE_ENABLE_DESKTOP_BRIDGE` in the Railway service's environment variables has **zero effect** on the deployed app, because Railway's Dockerfile builder only forwards variables into the build stage that are explicitly declared with `ARG <NAME>` before the `RUN npm run build` line, and only `VITE_GOOGLE_CLIENT_ID` is declared. This matches the Dockerfile's own comment (`Dockerfile:17-18`): *"Railway Dockerfile builds require ARG declarations before build-time variables are visible here."* — the comment was applied for one variable but not propagated to the others that were added later.

**Observable symptom:** Google Analytics never initializes in production (silent `console.warn`, no user-visible error) even if `VITE_GA_MEASUREMENT_ID` is set in Railway; Desktop Bridge feature-flag can never be turned on for the deployed site no matter what the Railway dashboard says, while it works locally via `.env`.

**Confidence: HIGH** (Dockerfile ARG/RUN lines and .dockerignore read directly; behavior is deterministic given how Vite + Docker builder args interact).

---

## Finding 3 — MusicGen local fallback gated on PRIVATE_OBJECT_DIR, a Replit-only var never set on Railway

**Variable name:** `PRIVATE_OBJECT_DIR`

**Every file:line:**
- `server/objectStorage.ts:40-48` — `ObjectStorageService.getPrivateObjectDir()` throws `"PRIVATE_OBJECT_DIR not set..."` if unset; this class authenticates via a **Replit sidecar** (`server/objectStorage.ts:5,8-24`, `REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106"`), which does not exist on Railway.
- `server/services/local-musicgen.ts:5,38,41,555` — `localMusicGenService` (the local fallback generator) instantiates `new ObjectStorageService()` and calls `getObjectEntityUploadURL()`, which depends on the above.
- `server/services/unifiedMusicService.ts:612-614` — explicit guard: `if (!process.env.PRIVATE_OBJECT_DIR) { throw new Error("Music provider temporarily unavailable. Please configure PRIVATE_OBJECT_DIR to enable fallback."); }` before calling the local fallback when the primary Replicate MusicGen call fails.
- This code path is live: `unifiedMusicService` is imported and called from `server/routes.ts:46,2964,4281,4292`, `server/routes/audio.ts`, `server/routes/astutely.ts`, `server/routes/packs.ts`, `server/routes/lyrics.ts`.

**Which environment breaks and how:** Production (Railway). `PRIVATE_OBJECT_DIR` is a Replit Object Storage concept (confirmed dead on Railway per prior project notes: `ObjectStorageService` uses the Replit sidecar). It is never set in the Railway environment. Whenever the primary Replicate MusicGen call fails or times out, every caller of `unifiedMusicService.generateTrack/generateFullSong/generateSamplePack` (beat generation, packs, astutely fallback) surfaces the literal string *"Music provider temporarily unavailable. Please configure PRIVATE_OBJECT_DIR to enable fallback."* to the end user instead of falling back to local generation — an error message that references a variable that will never exist in this deployment target.

**Observable symptom:** Works most of the time (Replicate succeeds); the moment Replicate is slow/down, users see a confusing "configure PRIVATE_OBJECT_DIR" error instead of a working local-generation fallback, in production only (dev machines don't hit this because REPLICATE_API_TOKEN failures are rarer locally / devs may have the var set from Replit-era config).

**Confidence: MEDIUM-HIGH** (code path confirmed live and wired exactly as described; did not reproduce an actual Replicate failure at runtime, so the "how often this fires" is inferred from control flow, not observed).

---

## Finding 4 — MUSICGEN_URL / MUSICGEN_SIDECAR_URL: different defaults and reversed precedence in two resolvers (currently dormant)

**Variable names:** `MUSICGEN_URL`, `MUSICGEN_SIDECAR_URL`

**Every file:line:**
- `server/routes/stemGeneration.ts:20-24`:
  ```
  const MUSICGEN_URL = (
    process.env.MUSICGEN_SIDECAR_URL?.trim() ||
    process.env.MUSICGEN_URL?.trim() ||
    "http://localhost:8001"
  )...
  ```
  Precedence: `MUSICGEN_SIDECAR_URL` first, `MUSICGEN_URL` second, default port **8001**.
- `server/services/backingTrack.ts:7-22`:
  ```
  const DEFAULT_MUSICGEN_GENERATE_URL = "http://localhost:5005/generate";
  function resolveMusicGenGenerateUrl() {
    const configuredUrl = process.env.MUSICGEN_URL?.trim();
    const sidecarUrl = process.env.MUSICGEN_SIDECAR_URL?.trim();
    if (configuredUrl) return configuredUrl;
    if (sidecarUrl) return `${sidecarUrl...}/generate`;
    return DEFAULT_MUSICGEN_GENERATE_URL;
  }
  ```
  Precedence: `MUSICGEN_URL` first, `MUSICGEN_SIDECAR_URL` second, default port **5005** — the opposite precedence order and a different default port from stemGeneration.ts.

**Which environment breaks and how:** If only `MUSICGEN_SIDECAR_URL` is set (matching stemGeneration.ts's naming), `backingTrack.ts` ignores it correctly (falls through to it) — but if *both* are set to different values (e.g. two different sidecars, or a migration where the var name is being renamed), `stemGeneration.ts` and `backingTrack.ts` would resolve to two different servers from the same two env vars. With neither set, they point at two different local ports (8001 vs 5005) by default.

**Currently dormant:** `backingTrack.ts`'s only caller is `server/routes/aiAudio.ts`, which `server/routes/README_LEGACY.md:1` explicitly documents as **not mounted** by the running server ("legacy route definitions ... not mounted by the running server. The live API surface is defined in server/routes.ts"). So this drift cannot fire today. It becomes a live landmine the moment `aiAudio.ts`/`backingTrack.ts` is remounted or its resolver logic is copied elsewhere — exactly the shape of bug the OLLAMA_MODEL example describes.

**Confidence: MEDIUM** (drift itself is HIGH confidence/verified by direct read; blast radius is currently zero because the call site is dead code, confirmed via README_LEGACY.md and grep for other importers).

---

## Checked and found consistent (no action needed)

- **OLLAMA_MODEL** — already fixed. `server/services/localAI.ts:36` exports `OLLAMA_DEFAULT_MODEL`, and `server/services/grok.ts:1,14` now imports and uses it instead of an independent default (comment at grok.ts:11-13 documents the fix). `docker-entrypoint.sh:38` and `Dockerfile.ollama:31` both default to the same `llama3.2:3b`. All four resolution points now agree.
- **LOCAL_OBJECTS_DIR** — already fixed. `server/index.prod.ts:76-82` now sets it explicitly at boot (mirroring `server/index.ts:18-29`), with a comment documenting the exact bug this closes. Consumers in `songs.ts`, `social.ts`, `stemSeparation.ts`, `speechCorrection.ts`, `lyricVideo.ts` all use the same `process.env.LOCAL_OBJECTS_DIR || join(process.cwd(), 'objects')` fallback consistently.
- **DATA_ROOT** — `localStorageService.ts:16` has its own independent default separate from the `path.resolve("data")` used for static-serving in both index.ts and index.prod.ts, which *would* be a drift bug (files saved to one path, served from another) — but every live call site of `new LocalStorageService()` with no explicit root (`arrangement.ts`, `aiSong.ts`, `aiMusic.ts`, `aiLyrics.ts`, `backingTrack.ts`) traces back to unmounted/legacy routes per `README_LEGACY.md`. No currently-reachable code is affected.
- **ACE_STEP_WORKER_URL** — consistent `http://127.0.0.1:8008` default across `aceStep.ts`, `aceStepService.ts`, `runpodService.ts`.
- **GEMINI_MODEL** — consistent `'gemini-flash-latest'` default in `composer.ts:431` and `conductorBrain.ts:44`.
- **SUNO_API_KEY / SUNO_API_TOKEN** — consistently read as a pair (`key || token`) in `sunoApi.ts`, `sunoApiService.ts`, `aiProviderManager.ts`, `ai.ts`, `packGenerator.ts`.
- **AUTH_TOKEN_SECRET, SESSION_SECRET** — both fail-fast (`process.exit(1)`) in `index.prod.ts:16-23` and `jwt.ts:5-9`; no silent fallback in production (dev-only fallback strings are correctly gated behind `NODE_ENV !== 'production'` checks).
- **ENABLE_DEV_AUTO_LOGIN / DEV_USER_ID** — `middleware/auth.ts:66-73` structurally cannot activate in production (`isProduction` literal check, not just the flag), with an explicit comment explaining why. Confirmed safe.
- **AUDIO_ANALYSIS_API_URL, RVC_API_URL** — both default to `localhost` but self-report via an explicit `console.warn` when unset in production (`audioAnalysis.ts:16-18`, `voiceLibrary.ts:12`) rather than failing silently — acceptable, not reported as a finding.
- **CORS allow-list (`CORS_ALLOWED_ORIGINS`)** — exists only in `index.ts` (dev). Verified this is *not* a production gap: `index.prod.ts` serves the built client and the API from the same Express process/origin (`index.prod.ts:297-431`, `express.static(distPath)`), so cross-origin CORS handling is legitimately unnecessary in production and correctly dev-only.
- **STRIPE_PRICE_ID_PRO_MEMBERSHIP / STRIPE_PRICE_ID_PRO** fallback pair — identical resolution in `services/stripe.ts:12` and `services/credits.ts:52`.
- **APP_URL** required-in-production pattern — duplicated identically (not diverging) in `services/stripe.ts:9-11` and `routes/credits.ts:14-16` (both throw at import time if unset in production); `middleware/auth.ts:138-141` has a softer log-only fallback for the same var but is unreachable with APP_URL truly unset in prod since the app would already have crashed at import time via stripe.ts. Not a live bug.
- **GOOGLE_CLIENT_ID** (server) vs **VITE_GOOGLE_CLIENT_ID** (client) — two separate required vars by OAuth design, both explicitly ARG'd through the Dockerfile and checked with clear failure modes (`auth.ts:159-162` returns 501, not a silent fallback). Per prior project notes this pairing already shipped and works.

---

## Method note

Grepped every `process.env.[A-Z_]+` in `server/**/*.ts` (excluding tests), grouped by variable name, and cross-referenced `server/index.ts` vs `server/index.prod.ts` line-by-line for anything present in one and absent from the other. For each candidate drift, traced actual callers via grep to confirm the code path is reachable from a mounted route before ranking severity, rather than reporting based on variable name alone.
