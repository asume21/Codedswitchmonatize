# Source-of-Truth / Persistence Audit — 2026-08-02

Read-only audit. No source files modified. Scope: facts that outlive a single function
call — who owns them, and whether what's read back matches what was written.

Findings ranked by blast radius (money/data loss first).

---

## Finding 1 — Credit deductions that bypass the ledger entirely

**The fact in question:** "How much did the user's credit balance change, and why" — i.e.
`users.credits` (the balance) vs the `credit_transactions` table (the audit ledger that is
supposed to explain every balance change).

**Every writer:**
- `server/services/credits.ts:170-201` (`CreditService.deductCredits`) — the sanctioned
  path. Calls `storage.atomicDeductCredits` (an atomic `UPDATE ... WHERE credits >= amount`,
  `server/storage.ts:2054-2066`) **and then** `storage.logCreditTransaction(transaction)`
  (`credits.ts:196`) so the ledger always gets a row.
- `server/routes.ts:958` — `POST /api/beats/generate`: `await storage.updateUserCredits(req.userId!, -BEAT_COST)`.
- `server/routes.ts:1231` — `POST /api/melody/generate` (Replicate melody path): `await storage.updateUserCredits(req.userId!, -MELODY_COST)`.
- `storage.updateUserCredits` itself (`server/storage.ts:2041-2052`, DB impl; `server/storage.ts:524-535`, MemStorage impl) does **only** the balance UPDATE
  (`credits: GREATEST(0, COALESCE(credits,10) + delta)`) — it never calls
  `logCreditTransaction`. No `CreditTransaction` row is ever created for these two routes.

**Reader:** `CreditService.getTransactionHistory` / `getUsageStats`
(`server/services/credits.ts:240-246, 370-389`), surfaced to the user via any credit-history
UI, and used by `hasUsedTrialCredits` (`server/middleware/trialCredits.ts:56-61`) to decide
trial-credit eligibility by scanning transaction reasons.

**How they can disagree:** User generates a beat or a Replicate melody paying with credits.
`storage.updateUserCredits` silently subtracts from `users.credits` with no corresponding
ledger row. `users.credits` (the balance) and `SUM(credit_transactions.amount)` (what the
ledger says the balance should be, and what the transaction-history UI shows) now permanently
diverge by the cost of every beat/melody generated through these two routes. This is on top
of `updateUserCredits`'s `GREATEST(0, ...)` floor, which — unlike `atomicDeductCredits`'s
`WHERE credits >= amount` guard — never rejects an under-funded deduct; these two routes
happen to pre-check `userCredits >= BEAT_COST`/`MELODY_COST` before calling it (routes.ts:894,
~1229 area), so today an overdraft isn't reachable through them, but the missing ledger entry
still is.

**Observable symptom:** User's credit balance drops after generating a beat or melody, but
their transaction history / credit-usage screen doesn't show a matching deduction — the
numbers don't add up, and support has no ledger row to explain the missing credits.

**Confidence: HIGH** (both call sites and both storage implementations read and quoted above).

---

## Finding 2 — Bass-render audio saved to a path nothing serves and nothing persists

**The fact in question:** the audio file backing a `bass-render` Track's `audioUrl`.

**Writer:** `server/routes/audio.ts:606,622` (inside `POST /music/generate-bass`,
route registered at `server/routes/audio.ts:551`):
```
const uploadsDir = path.join(process.cwd(), "server", "uploads");
const renderResult = await renderBassToWav(bassNotes.map(...), uploadsDir, {...});
const audioUrl = `/uploads/${renderResult.fileName}`;
```
`renderBassToWav` (`server/services/bassRenderer.ts:162`) writes the WAV file under
`server/uploads/` (confirmed by grep — this directory is distinct from
`LOCAL_OBJECTS_DIR`/the Railway volume, and distinct from `server/routes/audio.ts`'s own
`mastersDir`/`tempDir` writers which correctly go through `/api/internal/uploads/...`).
The resulting `audioUrl: "/uploads/<file>.wav"` is stored on the Track via
`storage.createTrack(...)` (`audio.ts:624`).

**Reader:** whatever later tries to play/export that track's `audioUrl`. There is **no**
`express.static` or route mount for the bare `/uploads` prefix anywhere in the server
(confirmed: only `/data`, `/assets`, `/api/reference-beats`, `/api/stems`, `/api/samples`,
and `/api/internal/uploads/*` are mounted, in `server/index.ts` / `server/index.prod.ts` /
`server/routes.ts`).

**How they can disagree:** the URL that gets persisted to the track/project (and would be
saved into a project's JSON via `projectManager.saveProject`) points at a path the server
never serves — a 404 on first playback, not eventually. Independently, `server/uploads/` is
also outside the Railway volume mount, so even if it were served, the file would vanish on
the next deploy.

**Observable symptom:** user generates a bass line via the AI Bass Generator; the render
"succeeds" (200 response, track created), but the returned `audioUrl` 404s immediately —
the bass track is silent/unplayable from the moment it's created, and if a session/project
was saved with that URL, it stays broken forever (even after a fix, since the stored URL
is baked in).

**Confidence: HIGH** (writer, path construction, and absence of any matching static mount
all confirmed by direct grep across `server/index.ts`, `server/index.prod.ts`, `server/routes.ts`).

---

## Finding 3 — Two generators race to fill the same one-shot localStorage handoff slot

**The fact in question:** the `astutely-generated` localStorage key, used as a one-shot
handoff from an AI generator to whichever of Piano Roll / Beat Maker mounts next.

**Every writer:**
- `client/src/components/studio/AILoopGenerator.tsx:232-237` — writes
  `{ notes, bpm, channelMapping, timestamp }` after generating a loop.
- `client/src/components/studio/ProAudioGenerator.tsx:845` — writes a differently-shaped
  `astPayload` (built earlier in the same function, ~line 839) after a Pro Audio generation.

**Reader:** `client/src/components/studio/VerticalPianoRoll.tsx:879-891`, on mount only:
reads the key, applies it if `Date.now() - data.timestamp < 5 * 60 * 1000`, then
unconditionally `localStorage.removeItem('astutely-generated')` regardless of which writer's
payload it was.

**How they can disagree:** if a user (or the AI orchestrating both, e.g. via Astutely chat)
triggers a loop generation and a Pro Audio generation within the same ~5 minutes before the
Piano Roll tab has mounted, the second writer overwrites the first writer's payload
outright — there's no merge, no queue, just last-write-wins on a single key. Whichever
generation happened first is silently dropped; VerticalPianoRoll only ever sees (and then
deletes) the most recent one.

**Observable symptom:** user generates a loop, then generates something via Pro Audio
before switching to Piano Roll — the loop's notes never appear; only the Pro Audio result
loads, with no error or indication the first generation was lost.

**Confidence: HIGH** for the two writers and single reader (file:line quoted above).
**MEDIUM** on real-world frequency — requires two generations within the 5-minute window
before Piano Roll mounts, which is a plausible but not universal user flow.

---

## Checked and found single-sourced (do not re-audit)

- **Atomic credit purchase/grant path** (`server/services/credits.ts` `addCredits` →
  `storage.grantCreditsAtomic`, `server/storage.ts:2089+`): balance UPDATE + ledger INSERT
  wrapped in one DB transaction; Stripe webhook dedup via `hasProcessedPaymentIntent` /
  `tryClaimStripeEvent`. Single writer, transactionally consistent.
- **`atomicDeductCredits` / `requireCredits` middleware path**
  (`server/middleware/requireCredits.ts`, `server/storage.ts:2054-2066`): the sanctioned
  deduct path used by routes that go through `requireCredits(cost, storage)` +
  `deductCredits(req, reason)` is atomic and always ledgers. Only the two direct
  `storage.updateUserCredits` call sites (Finding 1) bypass it.
- **`LOCAL_OBJECTS_DIR` resolution**: already fixed this session
  (`server/index.prod.ts:136-150`) — prod now sets it identically to dev before any route
  reads it. Not re-flagged.
- **`saveProject`/`loadProject` round-trip** (`client/src/lib/projectManager.ts:218-273`):
  server is the source of truth; `LOCAL_DRAFT_KEY` is explicitly a save-first/offline-backup
  copy, not a competing owner, and `loadProject` always prefers the server response.
- **`ExportStudio.tsx`'s separate `codedswitch_projects` localStorage save path**
  (`client/src/components/studio/ExportStudio.tsx:282-284`) writes to a third, server-blind
  localStorage key that would compete with `projectManager`'s server-backed saves — but the
  component is not imported/mounted anywhere else in the app (`grep` found only its own
  file), so it is unreachable dead code today, not a live divergence. Worth deleting, not
  worth ledgering as a live bug.
- **`StudioSessionContext`'s debounced auto-save effect vs. `performSave`/`forceSave`**
  (`client/src/contexts/StudioSessionContext.tsx:206-226` and `:318-350`): both write the
  same `STORAGE_KEY` payload, but both are derived from the same in-memory state on every
  call — redundant writers, not disagreeing ones. No divergence possible.
