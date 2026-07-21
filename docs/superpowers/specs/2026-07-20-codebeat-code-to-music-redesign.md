# Codebeat: Code-to-Music Redesign — "skeleton + fire"

**Date:** 2026-07-20
**Status:** Design approved (mapping + architecture); scope decisions made by lead.
**Supersedes:** the existing `CodeToMusicStudioV2` walled-garden feature.

---

## 1. Problem & Vision

Codebeat (code → music) already exists but is a **walled garden**: paste code →
generate → preview in a self-contained player → download a JSON blob. Its output
never reaches the studio the user produces and performs in. It is also buried
(reachable only via ASTUTELY → Codebeat tab, or MIX → View → Codebeat F6, all of
which `navigate('/studio/ai?tool=codebeat')`), and carries duplication debt (a
dead in-workspace mount + a duplicate API route).

**Vision — "skeleton + fire" (two-stage):**

1. **Skeleton (faithful):** the user's code is analyzed into a musical
   *fingerprint* and mapped — level-by-level — into an `ArrangementPlan` plus a
   deterministic motif seeded from the code's identifiers. Same code → same song,
   legibly. "That's literally my code, I can hear its shape."
2. **Fire (musical):** the plan is handed to **the Organism** (the existing live
   AI band — Conductor + generators + Claude-composed scores), which *produces*
   it into a real beat with a pocket, in the studio, ready to rap over.

**Why only CodedSwitch can do this:** a code→music toy is a weekend project.
Code→music that (a) maps program *structure* faithfully, (b) seeds a motif from
the user's own identifiers, and (c) hands it to a live AI band inside a full
performance studio — requires everything CodedSwitch already is. The mapping is
the front door; the Organism is the moat.

## 2. Core Architectural Insight

The Organism already accepts an `ArrangementPlan` as its input contract:
`Conductor.loadPlan(plan: ArrangementPlan)` (client/src/organism/conductor/
Conductor.ts:665). The Claude composer already turns a *text prompt* into an
`ArrangementPlan` (server/services/composer.ts).

**Codebeat is therefore a second front-end to the band we already built** — a
"composer" whose input is *code* instead of a text prompt. It emits the *same*
`ArrangementPlan` artifact. **No second music engine is built.** This directly
honors the repo's standing rule against duplicate/competing systems ("the doubles
that haunt us").

```
YOUR CODE
   │  Stage 1: CodeAnalyzer
   ▼
CodeFingerprint  { structure, loops, branches, names, complexity, nesting }
   │  Stage 2: CodeArrangementComposer  (the mapping)
   ▼
ArrangementPlan  (+ per-section SectionScore motif from identifiers)
   │  = the SAME contract Claude's composer emits
   ▼
Conductor.loadPlan(plan)   ← already exists
   ▼
THE ORGANISM performs it → beat in the studio → user raps over it
```

## 3. The Mapping (code hierarchy → music hierarchy)

Both code and music are hierarchies of structure + repetition. The old engine
mapped at the finest grain (one line = one note), discarding structure and
producing a noodly note-stream. The redesign maps **level-to-level**: each code
concept becomes the musical concept it is genuinely analogous to.

| Code feature | Musical result | Rationale |
|---|---|---|
| Whole program (size, complexity) | Key, tempo, mode | Complex/large → faster, darker mode; small/clean → mellow, brighter. (Keeps the existing complexity→scale-mode logic.) |
| Top-level functions / classes | Song **sections** | The biggest / most-referenced function becomes the **hook/chorus** — the main thing in code becomes the main thing in the beat. |
| Loops (`for`/`while`) | The **groove** (drum & bass loop feel); nested loops → layered polyrhythm / higher density | A code loop *is* a musical loop — source of the pocket. |
| Conditionals (`if/else`, `switch`) | **Tension & release** — section energy variation, turnaround moments | Branches are decision points → where a beat moves rather than sitting static. |
| Identifiers (function + key variable names) | The **motif/hook** — a short 2–4 note phrase, deterministically hashed to in-key pitches | The legible fingerprint: the user's actual names live in the melody. Same code → same hook. |
| Nesting depth | Layer count / density | Deep nesting → more stacked instruments; flat code → sparse. |
| State changes / assignments | Harmonic movement (bass + chord changes) | Harmony moves when program state moves. |

**Determinism is mandatory:** all hashing uses the existing `hashString`
(noteMapping.ts) style pure function so identical code always yields an identical
plan. This is what makes the skeleton "faithful."

## 4. Components (each: one job, testable in isolation)

### 4.1 `CodeAnalyzer` (server) — extends the existing parser
- **Input:** `{ code, language }`.
- **Output:** `CodeFingerprint` — extends today's `ParsedCode` with structural
  fields: ordered top-level units, per-unit reference/call count (to find the
  "hook" unit), loop nesting map, branch points, identifier list, aggregate
  complexity + mood (reuse existing computations).
- **Reuses:** `codeParser.ts` regex element extraction and `getCodeStatistics`.
- **Pure function.** Unit-tested against fixture code in several languages.

### 4.2 `CodeArrangementComposer` (server/shared) — the mapping, NEW
- **Input:** `CodeFingerprint`, plus optional `{ subGenre?, variation? }`.
- **Output:** a valid `ArrangementPlan` (shared/arrangement.ts) whose:
  - `key`/`bpm`/`mood`/`subGenre` derive from whole-program metrics;
  - `sections[]` derive from top-level units (hook unit → chorus, energy/density
    from loops/branches/nesting), using Roman-numeral `progression`s;
  - each section may carry a `score.melody` (`SectionScore`) — the motif from
    identifiers — run through the existing `sanitizeSectionScore` so pitches snap
    to key and counts are clamped (same trust boundary Claude's scores use).
- **Pure + deterministic.** Unit-tested: same input → byte-identical plan;
  output always passes `validateArrangementPlan`.

### 4.3 `CodebeatStudio` (client) — rebuilt UI, replaces CodeToMusicStudioV2
- Paste code, pick language + genre, generate.
- Shows the derived **skeleton** (section map, detected hook, key/bpm) so the
  legibility is visible — the user sees their code's shape before hearing it.
- **"Play with the band"** primary action → sends the plan to the Organism via
  `loadPlan` and starts it, landing in the studio timeline. No self-contained
  player, no JSON download (both retired).
- Lives as a **first-class studio view** (`activeView === 'code-to-music'`),
  lighting up the currently-dead in-workspace mount, reached **in-place** from
  MIX (F6 becomes `setActiveView('code-to-music')`, no cross-surface navigate).

### 4.4 API — single route
- Keep `POST /api/code-to-music` in `server/routes.ts` (the mounted one).
- **Delete** the duplicate in `server/routes/index.ts`.
- Response returns the `ArrangementPlan` (+ the fingerprint summary for the
  skeleton display), instead of the old `MusicData` blob.

## 5. Data Flow (end to end)

1. `CodebeatStudio` POSTs `{ code, language, genre }` → `/api/code-to-music`.
2. Route calls `CodeAnalyzer` → `CodeArrangementComposer` → validated
   `ArrangementPlan` + fingerprint summary.
3. Client renders the skeleton summary; on "Play with the band", calls the
   Organism's `loadPlan(plan)` and starts transport.
4. Conductor consumes the plan exactly as it consumes a Claude/Ollama plan;
   generators (incl. Claude-score path for the motif) perform it; audio lands on
   the studio timeline the user already produces/raps over.

## 6. Debt Removed (part of this work, not separate refactoring)

- Retire `CodeToMusicStudioV2.tsx` and its walled-garden pieces (self-contained
  preview player, JSON export, note-per-line mapper) — replaced by
  `CodebeatStudio`.
- Delete the unreachable second mount and the duplicate `/api/code-to-music`
  route (one component, one route, one path).
- Keep `TranslatorOverlay` (code→**code** language translation) untouched — it is
  a different feature; only names collide.

## 7. Error Handling

- **Unparseable / empty code:** analyzer returns a minimal fingerprint;
  composer still emits a valid short plan (never throws to the user). Surface a
  toast ("Not much structure found — made a short loop from it").
- **Plan validation failure:** if `validateArrangementPlan` rejects, the route
  returns 422 with the reason; UI shows it and does not hand a bad plan to the
  band.
- **Organism not started:** "Play with the band" starts the Organism if idle
  (defensive start, matching existing generator behavior).

## 8. Testing

- `CodeAnalyzer`: fixture code per language → asserts structural extraction
  (hook detection, loop nesting, branch count).
- `CodeArrangementComposer`: determinism (same code → identical plan);
  `validateArrangementPlan` always passes; motif scores survive
  `sanitizeSectionScore`.
- Integration: `POST /api/code-to-music` returns a plan the Conductor's
  `loadPlan` accepts without error.
- Retain/port relevant cases from the existing
  `codeToMusic/__tests__` suites.

## 9. Scope

**v1 (this spec):** the mapping (CodeAnalyzer + CodeArrangementComposer →
ArrangementPlan), Organism wiring via `loadPlan`, rebuilt in-place studio view,
skeleton display, and the debt removal above. Deterministic core — no AI call
required.

**Deferred to v2 (explicitly out of scope):**
- The **faithfulness↔fire dial** (user-controlled per generation).
- **AI enhancement** of the plan (Grok/Gemini elaborating the motif) — the
  existing `aiEnhancer` can be revived later behind the same route.
- Turning the "code melody" into a separately audible layer alongside the
  produced beat (v1 folds the motif into the section `score`).

## 10. Success Criteria

- Paste real code → within one action, the Organism is playing a beat whose
  structure visibly and audibly reflects that code (hook section = main
  function; groove from loops; motif from names).
- Same code twice → same beat.
- Reachable in-place from the studio without a surface teleport.
- Exactly one code-to-music component and one route remain.
