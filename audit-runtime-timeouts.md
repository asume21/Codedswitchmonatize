# Runtime Timeout/Interval/Retry Audit — 2026-07-30

Read-only audit. No source files were modified.

## Finding 1 — Conductor brain fallback chain can take ~2x the client's abort budget

**Files:**
- `client/src/organism/AIDirector.ts:39` — `const FETCH_TIMEOUT_MS = 15000`
- `server/services/conductorBrain.ts:79` — `const OLLAMA_CONSULT_TIMEOUT_MS = Number(process.env.OLLAMA_CONSULT_TIMEOUT_MS) || 12000`
- `server/services/conductorBrain.ts:144-164` — sequential try/catch: Ollama consult (up to `OLLAMA_CONSULT_TIMEOUT_MS`), and **only if that branch throws**, a second consult to Gemini using the **same** `OLLAMA_CONSULT_TIMEOUT_MS` as its own budget (`geminiConsult(system, user, OLLAMA_CONSULT_TIMEOUT_MS)` at line 158).

**The numbers, quoted:**
```
server/services/conductorBrain.ts:77-79
// MUST stay below AIDirector's FETCH_TIMEOUT_MS (15s) so the server returns the
// deterministic scaffold itself rather than the client aborting blind.
const OLLAMA_CONSULT_TIMEOUT_MS = Number(process.env.OLLAMA_CONSULT_TIMEOUT_MS) || 12000

server/services/conductorBrain.ts:144-164
if (!conductorIsCold('ollama')) {
  try {
    raw = await localAI.chat(..., { timeoutMs: OLLAMA_CONSULT_TIMEOUT_MS })   // up to 12000ms
    ...
  } catch (e) { ... }                                                         // cools ollama, falls through
}
if (!raw && !conductorIsCold('gemini')) {
  try {
    raw = await geminiConsult(system, user, OLLAMA_CONSULT_TIMEOUT_MS)        // up to another 12000ms
    ...
  } catch (e) { ... }
}
```

**Why they contradict:** The comment at conductorBrain.ts:77-78 states a single-brain invariant ("MUST stay below AIDirector's FETCH_TIMEOUT_MS (15s)") that was true when there was one brain. A second brain (Gemini) was added as a sequential fallback that only runs after Ollama's own attempt has already burned up to its full 12000ms budget. Worst case (both services reachable-but-slow, e.g. both take ~11-12s before actually failing or just barely missing internally): `12000ms (Ollama) + 12000ms (Gemini) ≈ 24000ms`, which is **9000ms past** the client's 15000ms `FETCH_TIMEOUT_MS`. `localAI.chat()` (`server/services/localAI.ts:174-221`) makes a single attempt with no internal retry (confirmed — no retry loop in `chat()`, unlike the older `generate()` method which does retry), so each branch really is capped near its stated timeout, not lower — this is exactly a "12s + 12s can exceed a 15s deadline" arithmetic bug, the same class as the calibration example, reintroduced when the second brain was added.

**What would be observed in production:** When Ollama is reachable but answers slowly (e.g., cold-loading close to its 12s cap) and then errors out (network blip, malformed JSON, anything hitting the catch), the server moves on to consult Gemini for up to another 12s. By the time Gemini would have answered, AIDirector on the client has already aborted at 15s and silently fallen back to the hardcoded arrangement (`.catch(err => console.warn(...))` in `AIDirector.ts:131`). The section directive that Gemini spent CPU/quota computing is thrown away — same wasted-work / "answer arrives after the caller gave up" pattern as the original bug, except now triggered by the *combination* of two sequential consults rather than one being too short. It will look like "the AI conductor randomly doesn't apply" specifically when Ollama is flaky (not simply down — cleanly-down is fast and skips to Gemini well within budget).

**Confidence: HIGH** — both numbers and the sequential control flow are directly confirmed by reading conductorBrain.ts lines 128-166; the client abort behavior is confirmed in AIDirector.ts lines 140-156.

---

## Finding 2 — Stale comment in localAI.ts still cites the old (already-fixed) 6s/8s conductor budget

**File:** `server/services/localAI.ts:31-34`

**The numbers, quoted:**
```
* 3b, not 7b/8b, is a deliberate choice recorded in Dockerfile.ollama: "llama3.2:3b
* (2GB Q4) — safe within 8GB RAM". It also has to answer a JSON consult inside
* conductorBrain's 6s budget (client aborts at 8s), which a 7B on CPU will not
* reliably do.
```
vs. the actual current values: `conductorBrain.ts:79` → 12000ms budget, `AIDirector.ts:39` → 15000ms client abort.

**Why they contradict:** This comment documents the *previous* generation of the same bug (the one called out explicitly in the task's calibration example, already fixed by widening 6000→12000 and 8000→15000). The comment was never updated when those constants changed, so a reader tuning the Ollama model size today reasons from a stale 6s/8s budget instead of the real 12s/15s one.

**What would be observed in production:** No direct runtime effect (it's a comment), but it is a live trap for the next person who resizes the model or budget based on "what does the code say the deadline is" — they'll under- or over-provision relative to the real 12s window.

**Confidence: HIGH** for the mismatch itself (both numbers directly read); **MEDIUM** on production relevance since it's documentation, not executable logic.

---

## Finding 3 — aiMusic.ts drums route races a 10s cap against a call whose own client is configured for 30-35s

**Files:**
- `server/routes/aiMusic.ts:10` — `const AI_TIMEOUT_MS = 10000; // Hard cap AI latency so routes never hang`
- `server/routes/aiMusic.ts:141-145` — `Promise.race([aiPromise, timeoutPromise])`, timeout rejects at `AI_TIMEOUT_MS` (10000ms)
- `server/services/grok.ts:23-24` — `const AI_TIMEOUT_MS = 30000` (client-level timeout passed to every OpenAI/Grok/Ollama SDK client) and `const AI_RESPONSE_DEADLINE_MS = 35000`
- `aiMusic.ts` → `callAI()` (`server/services/aiGateway.ts:70`) → `makeAICall()` in `grok.ts`, which uses the 30000/35000ms budgets, not the local 10000ms.

**Why they contradict:** The `/drums` route's own local `AI_TIMEOUT_MS` (10s) is a *different, unrelated* constant from `grok.ts`'s identically-named `AI_TIMEOUT_MS` (30s) that actually governs the underlying HTTP client. `Promise.race` only abandons the *route's* promise at 10s — it does not cancel the in-flight `callAI()` request, which keeps running against its real 30s/35s ceiling. Any AI call that takes between 10s and 30s will be silently discarded by the route and replaced with the hardcoded fallback pattern, even though the real client was never going to time out.

**What would be observed in production:** `/api/ai-music/drums` (if ever wired to a client — see note below) would fall back to the default four-on-the-floor pattern far more often than the AI provider's actual failure rate suggests, for any response landing in the very plausible 10-30s window for a cold/loaded model. Wasted provider spend on requests whose results are thrown away.

**Note on exposure:** `server/routes/aiMusic.ts` is **not mounted** in `server/routes.ts` (grepped for `routes/aiMusic` and found no import/`app.use` anywhere) — the actual `/api/ai-music/*` path in production is served by `server/routes/aceStep.ts` instead. This finding is real but currently **dormant/unreachable** unless something changes to mount this router. Ranked lower for that reason.

**Confidence: MEDIUM** — the contradiction in the code is HIGH confidence, but production impact is LOW/unknown because the router appears unmounted.

---

## Finding 4 — Disabled generative-pattern cooldown comment doesn't match its own literal or the surrounding comments

**File:** `client/src/features/organism/OrganismProvider.tsx:758-764`

**The numbers, quoted:**
```
758  // Cooldown: only generate a new pattern at most once every 30 seconds
759  // to avoid toast/pattern spam from rapid section changes.
...
764  const PATTERN_GEN_COOLDOWN_MS = 16_000   // ~1 full 4-bar loop at 90 BPM
```

**Why they contradict:** Three numbers describing "how often this can fire" disagree: the paragraph comment says 30 seconds, the inline comment says "~1 full 4-bar loop at 90 BPM," and the literal is 16000ms. The actual duration of 4 bars at 90 BPM (4/4 time) is `4 bars × 4 beats × (60/90)s = 16 × 0.667s ≈ 10.7s` — not 16s, and neither matches the "30 seconds" in the paragraph above it.

**What would be observed in production:** None currently — `ENABLE_GENERATIVE_DRUM_PATTERNS = false` (line 762) gates this whole code path off, so it cannot fire. Flagging because if this feature is re-enabled without re-deriving the number, the cooldown will neither match its own comment nor the musical unit ("1 loop") it claims to represent.

**Confidence: HIGH** on the arithmetic mismatch; **LOW** production relevance (feature is dead-flagged off).

---

## Checked and found consistent

- `client/src/organism/generators/{Bass,Chord,Drum,Melody}Generator.ts` `MIN_REBUILD_INTERVAL_MS = 900` — matches its own test comments and assertions exactly (e.g. `BassGenerator.test.ts:136-138`, `ChordGenerator.test.ts:103`, `DrumGenerator.test.ts:380-394`). This matches the task's calibration example, but it has already been fixed and is currently correct.
- `client/src/organism/input/AutoGenerateSource.ts:79` `FRAME_INTERVAL_MS = 100` (10fps) — its test (`AutoGenerateSource.test.ts:27-33`) explicitly derives `FRAME_MS = 100` and comments on the prior 30fps/50ms-per-tick bug; now consistent. Also already fixed.
- `client/src/organism/input/MidiInputSource.ts:49` `FRAME_INTERVAL_MS = 23` (~43fps) — referenced correctly elsewhere (`OrganismProvider.tsx:3073` comment "Instead of feeding every frame (~43fps)...").
- `client/src/organism/generators/GeneratorOrchestrator.ts:78` `MIN_FRAME_INTERVAL_MS = 70` (~14fps) — comment math checks out (1000/70 ≈ 14.3fps).
- `client/src/features/organism/OrganismProvider.tsx:572` `ORGANISM_UI_INTERVAL_MS = 1000` — the accompanying comment's math (120ms render / 500ms → 24%, /1000ms → 12%) is internally consistent and was clearly derived from real profiling.
- `client/src/features/organism/OrganismProvider.tsx:3076` `PHYSICS_FEED_INTERVAL_MS = 150` (~6-7fps) — comment says "~6fps," close enough to be non-contradictory.
- Client render-poll chain: `OrganismCommandCenter.tsx:306` `RENDER_TRACK_POLL_TIMEOUT_MS = 10 * 60 * 1000` (10 min) matches server `server/services/aceStepService.ts:16` `POLL_TIMEOUT_MS = 600_000` (10 min) — same budget on both sides, no cross-boundary mismatch.
- Client render-poll interval `OrganismCommandCenter.tsx:858` (`}, 2000)`) with an 8-consecutive-failure abort (line 814) — comment says "~16s," and `8 × 2000ms = 16000ms` exactly.
- `server/services/aceStepService.ts` request-level timeouts (10s submit, 5s poll) vs. `server/services/runpodServerlessService.ts` (20s submit, 10s poll) — each is a single bounded HTTP call inside the 10-minute outer poll loop; no cascading-deadline issue since none of these are chained sequentially against a shorter outer caller deadline the way Finding 1 is.
- Guest demo timer `OrganismProvider.tsx:3296-3309` — plain 1000ms countdown ticking `guestSecondsRemaining`, matches the 60s guest-demo product behavior noted in project memory; no contradiction.
- `server/db.ts:25-26` — `idle_timeout: 20`, `connect_timeout: 10` (seconds) — unrelated, independent DB pool settings, no paired constant elsewhere to contradict.

## Ranking (most likely to be silently firing in production right now)

1. **Finding 1** (conductorBrain sequential fallback exceeding AIDirector's abort budget) — HIGH confidence, directly on the live jam-mode AI-conductor path, will degrade specifically when Ollama is flaky rather than cleanly down.
2. **Finding 2** (stale comment) — HIGH confidence as a mismatch, but documentation-only.
3. **Finding 3** (aiMusic.ts drums race) — HIGH confidence in the code, but the router is currently unmounted, so likely not reachable today.
4. **Finding 4** (generative-pattern cooldown) — HIGH confidence in the arithmetic, but the feature flag is off.
