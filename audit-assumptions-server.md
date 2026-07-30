# Server/Shared Unverified-Assumptions Audit

Scope: `server/**`, `shared/**`, `client/public/robots.txt` (read-only cross-check).
Method: read `server/index.ts` (dev entry) and `server/index.prod.ts` (prod entry) in full,
confirmed via `esbuild.config.js` (`entryPoints: ['server/index.prod.ts']`) and
`Dockerfile`/`railway.json` (`CMD node dist/index.cjs`, built from that same esbuild config)
that **`server/index.prod.ts` is the only file that actually runs in production** —
`server/index.ts` only runs under `npm run dev:server` (`tsx server/index.ts`, `NODE_ENV=development`).
This matters: several protective checks live in the file that never runs in prod.

---

## Finding 1 — MemStorage fallback guard exists only in the dev file; the real prod entrypoint has none

**File:line:** `server/index.prod.ts:211-213` vs `server/index.ts:372-380`

**The assumption:** `server/index.ts` carries an explicit, heavily commented guard:
```
// Defense-in-depth: validateEnv() already exits in production if no DB URL
// is set, but guard here too so any future refactor that loosens boot-time
// validation cannot silently fall back to MemStorage in prod (which wipes
// auth/credits on every restart).
if (isProduction && !hasDatabaseUrl) { ...; process.exit(1); }
```
The comment asserts this defense-in-depth exists for the production boot path.

**Why it is not guaranteed:** `server/index.ts` never runs in production (confirmed above).
The actual prod entrypoint, `server/index.prod.ts`, has no such guard:
```js
const storage: IStorage = databaseUrl
  ? new DatabaseStorage()
  : new MemStorage();
```
with only a `console.log('⚠️ DATABASE_URL not set - using MemoryStore (not recommended for production)')`
warning (line 149) — no `process.exit`. The "defense-in-depth" the comment describes is dead code
protecting a code path that is never deployed; the deployed file has zero protection at this point.
(`index.prod.ts` does hard-`process.exit` on missing `SESSION_SECRET`/`AUTH_TOKEN_SECRET` at
lines 16-23, so *some* boot validation exists — just not for `DATABASE_URL`.)

**Observable symptom:** If `DATABASE_URL`/`DATABASE_PUBLIC_URL` is ever unset on the Railway
prod deploy (e.g. a variable reference breaks, a new service is provisioned without it copied
over), production silently boots on `MemStorage` instead of refusing to start. Every session,
user, and credit transaction lives only in process memory and is wiped on the next restart/redeploy
— exactly the "catastrophic... actively wrong" scenario `index.ts`'s comment warns about, except
it is the un-audited entrypoint (`index.prod.ts`) that would actually let it happen.

**Confidence: HIGH** — read both files directly, and confirmed which one ships via `esbuild.config.js` and `Dockerfile`.

---

## Finding 2 — Stripe env-var fail-fast (`validateEnv`) only runs in the file that is never deployed

**File:line:** `server/index.ts:81-131` (the whole `validateEnv()` function) vs `server/index.prod.ts:16-29`

**The assumption:** `index.ts` documents hard requirements enforced at boot in production:
`SESSION_SECRET`, `AUTH_TOKEN_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`DATABASE_URL`/`DATABASE_PUBLIC_URL` — with `STRIPE_WEBHOOK_SECRET` called out as
"webhook signature verification (silent corruption of credit ledger if missing)".

**Why it is not guaranteed:** This whole function lives in `index.ts`, which is dev-only.
`index.prod.ts` — the file that actually boots production — only checks `SESSION_SECRET` and
`AUTH_TOKEN_SECRET` (lines 16-23) and only *warns* (does not exit) if `APP_URL` is missing
(line 24-26). It never checks `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `DATABASE_URL` at
boot at all.

**Observable symptom:** A production deploy missing `STRIPE_WEBHOOK_SECRET` will boot
successfully (contrary to what the `index.ts` comment describes as the system's behavior) and
only fail later, silently, the first time a real Stripe webhook arrives — the exact "silent
corruption of credit ledger" scenario the comment says is being prevented. Same for
`STRIPE_SECRET_KEY`: revenue routes will 500 at request time instead of the deploy failing fast
at boot.

**Confidence: HIGH**

---

## Finding 3 — No CORS middleware at all in the production entrypoint

**File:line:** `server/index.ts:197-265` (full CORS origin allow-list + preflight handler) vs `server/index.prod.ts` (no equivalent anywhere — confirmed via grep for `CORS|Access-Control|Origin`, only hit was the unrelated `crossOriginEmbedderPolicy: false` helmet option)

**The assumption:** Implicit — `index.ts` builds a real CORS layer (`CORS_ALLOWED_ORIGINS` env
parsing, per-origin `Access-Control-Allow-Origin`/`-Credentials`/`-Methods`/`-Headers`, OPTIONS
preflight short-circuit). Nothing in `index.prod.ts` reproduces any part of it, and there is no
comment anywhere explaining the omission as deliberate.

**Why it is not guaranteed:** Same-origin browser traffic against the SPA (served from
`dist/client` by the same process) doesn't need CORS headers, so this may have been fine by
accident. But the project explicitly advertises a public "Developers — Music generation API"
page (`OG_OVERRIDES["/developers"]` in `index.prod.ts:332-336`, "Build with the CodedSwitch
API... straightforward REST endpoints") and `CORS_ALLOWED_ORIGINS` is read in `index.ts` as if
it's a real deployable knob. In production that env var is read by nothing.

**Observable symptom:** Any browser-based cross-origin API consumer (third-party site, a
separately-hosted frontend, a local dev tool hitting the prod API from `http://localhost:*`)
gets no `Access-Control-Allow-Origin` header from production and is blocked by the browser CORS
check — even though the exact same request works against the dev server (`index.ts`), and even
though setting `CORS_ALLOWED_ORIGINS` in Railway's env vars has no effect because production
never reads it.

**Confidence: HIGH** for "no CORS code exists in index.prod.ts"; MEDIUM for real-world impact
severity (depends on whether any current consumer actually needs cross-origin browser access —
server-to-server API calls are unaffected by CORS).

---

## Finding 4 — Production session cookie never gets a `domain`; dev sets one from `APP_URL`

**File:line:** `server/index.ts:294-312` (`cookieConfig`, sets `domain: url.hostname` from `APP_URL` when `isProduction`) vs `server/index.prod.ts:160-165` (`cookie: { sameSite: "none", httpOnly: true, maxAge, secure: true }` — no `domain` key at all)

**The assumption:** `index.ts`'s cookie block explicitly computes a `domain` "for production
cookies to allow cross-origin requests," implying production cookies need/get a domain
attribute matching `APP_URL`'s hostname.

**Why it is not guaranteed:** That logic exists only in the dev file. `index.prod.ts` hardcodes
the cookie object with no `domain` field, so Express/express-session will default it to the
exact `Host` header of whatever request set the cookie (host-only cookie), not an
explicitly-scoped domain. Given `index.prod.ts` also does a `codedswitch.com` → `www.codedswitch.com`
301 redirect (line 256-262) before any route runs, this pairing looks intentional in practice
(canonical host is always `www.codedswitch.com`, so a host-only cookie already matches) — but
nothing states that on purpose, and if `APP_URL`/canonical host ever changes, or a subdomain
needs to share the session, this file has no mechanism to set one, while `index.ts` looks like
it does.

**Observable symptom:** Low likelihood under current single-canonical-domain deploy, but any
future feature relying on the session cookie being visible across a subdomain (e.g.
`api.codedswitch.com` calling `www.codedswitch.com`, or a staging subdomain) will work if tested
against `index.ts`'s cookie logic mentally, then fail in real production because the deployed
cookie has no `domain` attribute.

**Confidence: MEDIUM** — the divergence itself is HIGH confidence (verified by reading both
cookie blocks); the practical impact is speculative since the current architecture may not need
cross-subdomain cookies today.

---

## Finding 5 — `/api/reference-beats` is double-covered in prod, single-covered in dev (not a bug, but the inline comment overclaims parity)

**File:line:** `server/index.prod.ts:225` allowlist entry vs `server/index.ts` allowlist (no `/api/reference-beats` entry)

**The assumption:** `index.prod.ts:238-241` comment says: "This list and the one in
`server/index.ts` must agree except where a difference is deliberate and commented
(`/api/audio-debug` is dev-only by design; `/api/reference-beats` and `/api/sample-profiles`
ride express.static mounts in dev)." This frames `/api/reference-beats` being on the prod list
but absent from dev's list as accounted-for.

**Why it is not guaranteed / correction:** Checked directly — `index.prod.ts` *also* mounts
`express.static` for `/api/reference-beats` (line 108, registered before `requireAuthExcept` at
line 219), identically to dev (`index.ts:150`). So in both dev and prod, static
already intercepts and answers `/api/reference-beats` requests before the auth middleware is
ever reached; the entry on the prod allowlist is inert/redundant, not filling a gap that dev
closes differently. This is not a functional bug (the route is public in both environments
either way) but the comment's stated reason for the asymmetry ("rides static mounts in dev")
implies prod does NOT have that static mount, which is false — prod has it too.

**Observable symptom:** None currently (behavior is identical, public, in both environments).
This is a documentation-accuracy issue, flagged because the audit brief calls out this exact
line as a "verify it's actually true" comment.

**Confidence: HIGH** for the factual claim (both files do mount static for this path); the
"bug" here is purely that the explanatory comment is inaccurate, not a behavioral difference.

---

## Checked and found sound

- `/api/samples` divergence: dev (`index.ts`) mounts `express.static` for the sample library in
  addition to the allowlist entry; prod (`index.prod.ts`) has no such static mount for samples
  and relies solely on the allowlist + route-level handling. This matches what both files'
  comments claim ("prod has no static mount") — verified true by direct read, no static mount
  for `sampleLibraryPath`/`/api/samples` exists in `index.prod.ts`.
- `/api/sample-profiles` and `/api/audio-debug` dev/prod list differences are commented and
  accurate per the audit brief's own example — not re-reported.
- `requireAuthExcept` (`server/middleware/auth.ts:99-114`) genuinely does a `req.path.startsWith(prefix)`
  check and is mounted after `currentUser`, matching its doc comment ("Mount AFTER currentUser()
  so req.userId is already set") — confirmed both files mount `currentUser` immediately before
  `requireAuthExcept` in the same `(async () => {...})()` block, in that order.
- Spot-checked webear relay routes' "self-authenticates via wbr_ bearer keys" claim
  (`server/routes/webearRelay.ts`) — multiple handlers do check `rawKey?.startsWith('wbr_')`
  before proceeding. Not exhaustively verified for every one of the 6 web* relay prefixes
  (webeye/websense/webnerve/webshield/weblog) individually — spot check only, LOW confidence on
  the other five specifically.
- `robots.txt` `Disallow` list vs. the `/api/*` blanket-auth allowlist: no conflicts observed —
  robots.txt disallows crawling of gated pages (`/dashboard`, `/settings`, etc.) and all of
  `/api/`, which is a superset of (not narrower than) what's actually auth-gated. No case found
  where robots.txt allows crawling something that's actually private.
- `LOCAL_OBJECTS_DIR` resolution logic itself (the historical bug from the audit brief) — now
  present and consistent in both files (`index.ts:20-24`, `index.prod.ts:76-79`), with
  `index.prod.ts` carrying a comment explicitly cross-referencing `index.ts` and the exact
  downstream call sites (`songs.ts:108,417,488`). This was already fixed and is sound now.
