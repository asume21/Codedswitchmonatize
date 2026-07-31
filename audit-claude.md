# Duplicate & Competing Systems Audit — Claude (independent pass)

Date: 2026-07-29. Written WITHOUT reading `audit-codex.md`, to keep the two passes independent.
Scope per shared prompt: organism, audio-clock ownership, server dev/prod divergence, studio UI.
Excluded: node_modules, dist, .venv, private/ace-step, .claude/worktrees.

---

## 1. Auth allowlist is duplicated dev-vs-prod and has already drifted — `/api/demo` is public in dev but AUTH-GATED in prod

- **Files:** `server/index.ts:396` (`requireAuthExcept([...])`, 24 entries) and
  `server/index.prod.ts:209` (`requireAuthExcept([...])`, 24 entries)
- **Which wins:** Neither shadows the other — they are *different files for different
  environments*. That is the problem: two hand-maintained copies of one security-relevant
  list, with nothing enforcing that they agree.
- **Verified drift** (full-array extraction, not a line window):
  - Public in **dev** only → auth-gated in prod: `/api/demo`, `/api/audio-debug`
  - Public in **prod** only → auth-gated in dev: `/api/reference-beats`, `/api/sample-profiles`
- **Observable symptom:** `/organism` is the public no-login guest demo. Any guest call to
  `/api/demo` works perfectly on localhost and returns **401 in production**. This is the
  identical failure class already recorded in memory (the neumann-bass 401 that silently
  downgraded to thin synth bass) — a 401 that degrades rather than crashes is invisible
  until someone listens. Conversely `/api/audio-debug` being prod-gated will break the
  audio-debug capture path against prod.
- **Confidence: HIGH** (both arrays parsed in full and diffed programmatically).
- **Fix shape:** hoist ONE exported `PUBLIC_API_PREFIXES` array into a shared module and
  import it from both entrypoints. Delete both inline copies.

## 2. Four unguarded writers to the authoritative song-cell style; the "jam mode only" writer has no guard

- **Files:** `client/src/organism/generators/GeneratorOrchestrator.ts` lines **220, 476, 1520, 1949**
  → all call `setSongCellStyle()` (`client/src/organism/generators/freeplay/songCell.ts:67`)
- **Mechanism:** `setSongCellStyle` is the *authoritative* style key — per the variety fix
  (9ff407c9) a call with a **different** style re-rolls the salt, i.e. regenerates the beat.
  Lines 220 and 476 are boot/start seeding and are correctly sequenced. The conflict is:
  - **1520** — inside `onSubGenreChange`, writes the raw `subGenre`. Its comment reads
    *"Jam mode (no arrangement): this is the band's style"* — but I read the surrounding
    block (1496–1525) and there is **no `if` guarding it**. It runs in song/arrangement mode too.
  - **1949** — per-section scoring, writes `aiOverride?.subGenre ?? musicalState.subGenre`.
  When `AIDirector` has supplied an override (`AIDirector.ts:153` →
  `setNextSectionDirective`), 1949 publishes the **AI's** sub-genre while 1520 publishes the
  **physics classifier's** sub-genre. The mode classifier drives sub-genre changes from
  physics continuously, so both can fire within one section with different values.
- **Observable symptom:** the salt re-rolls mid-section and the whole band's cell key changes
  underneath a section that is supposed to be a locked loop — beat/feel shifts partway
  through, or the cohesion break returns (generators forking to different cells). This is a
  regression path back into the exact bug fixed by 6791c490.
- **Confidence: MEDIUM-HIGH.** Confirmed: no guard at 1520; the two expressions can yield
  different values. Not confirmed by runtime trace that both fire in one section — worth a
  console probe before changing behavior.
- **Fix shape:** make the intent in the comment real — guard 1520 with the same
  `!arrangementActive` condition its comment claims, so per-section (1949) is the sole
  writer whenever an arrangement is running.

## 3. `server/routes/index.ts` — a second `registerRoutes` that Node resolution silently discards, carrying endpoint mounts that exist nowhere else

- **Files:** `server/routes.ts:256` (active) vs `server/routes/index.ts:26` (legacy).
  Both `server/index.ts:9` and `server/index.prod.ts:5` import from `"./routes"`.
- **Which wins & why:** Node/TS module resolution prefers the **file** `./routes.ts` over the
  **directory** `./routes/index.ts`. So `routes.ts` always wins; `routes/index.ts` is
  unreachable. Its header already says "LEGACY … not mounted", so this is a *labelled*
  fossil, not a hidden trap — severity reduced accordingly.
- **The real cost:** it mounts `/api/billing`, `/api/ai/lyrics`, `/api/ai/song`,
  `/api/ai/audio`, `/api/ai/music`, `/api/music`. I grepped `server/routes.ts` for those
  mounts — **zero matches** — and grepped the whole client for calls to them — **zero
  matches**. So these are not "broken", they are features that no longer exist anywhere,
  with a dead file still implying they do.
- **Observable symptom:** none at runtime. Cost is entirely developer-facing: the file is a
  live-looking decoy (it imports real services), and anyone "fixing billing" could edit it
  for hours with no effect.
- **Confidence: HIGH.**
- **Fix shape:** delete `server/routes/index.ts`, or rename to `routes/_legacy.ts.bak` so
  module resolution can never pick it up and no one mistakes it for live code.

## 4. SEO/indexing config is spread across four lists that must agree, with nothing enforcing it

- **Files:**
  - `client/public/robots.txt:11-20` — `Disallow` rules
  - `client/src/hooks/useCanonical.ts:17-27` — `NO_INDEX_PATHS`
  - `server/routes.ts:280-289` — sitemap URL list
  - `server/index.prod.ts:287` — `OG_OVERRIDES` (per-route metadata)
- **Mechanism:** no shared constant; four hand-maintained lists. The invariant is genuinely
  subtle and is documented only as a prose comment in `useCanonical.ts:13-15`: a path that
  is `Disallow`ed in robots.txt is **never fetched**, so a `noindex` tag on that same path is
  silently useless. The two lists must be mutually exclusive, not identical.
- **Observable symptom:** this has already fired — the GSC 2026-07-11 state (7 indexed / 33
  not) is cited in `server/routes.ts:273`. Current state is consistent, but any new public
  route requires remembering all four places.
- **Confidence: HIGH** (that it is unenforced duplication; the lists are currently in sync).
- **Fix shape:** a single `shared/publicRoutes.ts` describing each public route once
  (path, title, description, indexable) that robots.txt generation, the sitemap, and
  OG_OVERRIDES all derive from. Add a unit test asserting robots-Disallow ∩ NO_INDEX_PATHS = ∅.

## 5. `client/dist/sitemap.xml` — stale shadowed duplicate (FIXED during this session)

- **Files:** `client/dist/sitemap.xml` (deleted) vs `server/routes.ts:257` (`GET /sitemap.xml`)
- **Which won:** the dynamic route — registered at `index.prod.ts:230` **before**
  `express.static` at `index.prod.ts:346`; Express matches in registration order.
- **Symptom:** none served, but the stale file listed `/studio`, `/social-hub`,
  `/vulnerability-scanner`, `/sample-library` — the exact login-walled pages that caused the
  original indexing problem — so anyone reading it would draw the wrong conclusion.
- **Confidence: HIGH.** Untracked build artifact; deleted.

---

## Checked and found CLEAN (recording so the second pass isn't re-litigated)

- **AudioContext singleton** — no `new AudioContext()` anywhere in `client/src` except
  `client/src/lib/websenseBridge.ts:242` (`new AudioContextClass()`, a probe named `dummy`).
  **NOT verified** — flagging as an open question, not a finding. An ESLint AST-selector
  guard for this invariant is documented in `AUDIT_2026-04-30.md:302`.
- **`Tone.Transport.start/stop` ownership** — zero executable call sites outside
  TransportContext; the only matches in `client/src` are comments/docstrings. Invariant holds.
- **`AIDirector` vs `conductor/Conductor`** — *not* a double. `AIDirector.ts:11` imports
  `getConductor`; it is a section-lookahead layer feeding the Conductor, not a rival brain.
- **`/api/ai/next-section`** — endpoint exists (`server/routes/ai.ts:58`). AIDirector's
  silent fallback is not masking a missing route.
- **`client/src/organism/` vs `client/src/features/organism/`** — legitimate engine/UI split.

## Confidence note

Findings 1, 3, 4, 5 are HIGH — each verified by reading the code and confirming the deciding
mechanism (module resolution, middleware order, or a programmatic diff). Finding 2 is
MEDIUM-HIGH: the missing guard is confirmed, the runtime interleaving is not. My first pass
at finding 1 used approximate line windows and produced a **wrong** diff (falsely flagging
`/api/auth`, `/api/health`, `/api/subscription-status`); the numbers above come from
full-array extraction. Worth knowing when comparing against the other pass.
