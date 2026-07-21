# Codebeat Code-to-Music Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Codebeat from a walled-garden code→music toy into a code-fronted composer that emits the Organism's `ArrangementPlan`, so pasted code becomes a beat the live AI band produces in the studio.

**Architecture:** Two pure functions on the server — `analyzeCodeStructure` (code → `CodeFingerprint`) and `composeArrangementFromCode` (`CodeFingerprint` → `ArrangementPlan`) — feed the existing `Conductor.loadPlan()`. The client Codebeat UI is rebuilt to send code, show the derived skeleton, and hand the plan to the Organism via `getConductor().loadPlan(plan)`. No second music engine is built; the mapping produces the same artifact the Claude composer already emits.

**Tech Stack:** TypeScript, Express, Vitest (server unit tests), React (client), the existing `shared/arrangement.ts` contract + `client/src/organism` Conductor.

## Global Constraints

- All mapping logic MUST be deterministic: identical `{ code, language }` → byte-identical `ArrangementPlan`. Use the existing `hashString` from `server/services/codeToMusic/noteMapping.ts` for all pseudo-randomness. No `Math.random`, no `Date.now`, no timestamps inside the mapping.
- Every emitted plan MUST pass `validateArrangementPlan` (shared/arrangement.ts:413) before it leaves the route.
- Section names MUST be from the 7 valid `ArrangementSectionName` values only: `'intro' | 'verse' | 'build' | 'drop' | 'breakdown' | 'drop2' | 'outro'`.
- `key` MUST be a valid key (present in `NOTE_TO_SEMITONE`); `bpm` in [40, 220]; each section `bars` in [1, 64]; `energy`/`density` in [0, 1]; `progression` non-empty roman numerals.
- Motif scores MUST pass through `sanitizeSectionScore(raw, key, progression)` (shared/arrangement.ts:112) — same trust boundary the Claude scores use.
- Unit test command: `npm run test:unit` (vitest run). Run a single file with `npx vitest run <path>`.
- Reuse existing code: `parseCodeStructure`, `getCodeStatistics` (codeParser.ts), `hashString` (noteMapping.ts). Do NOT duplicate them.

---

## File Structure

- **Create** `shared/types/codeFingerprint.ts` — `CodeFingerprint` interface (shared so client can type the skeleton summary).
- **Create** `server/services/codebeat/analyzeCodeStructure.ts` — code → `CodeFingerprint`.
- **Create** `server/services/codebeat/composeArrangementFromCode.ts` — `CodeFingerprint` → `ArrangementPlan`.
- **Create** `server/services/codebeat/__tests__/analyzeCodeStructure.test.ts`
- **Create** `server/services/codebeat/__tests__/composeArrangementFromCode.test.ts`
- **Modify** `server/routes.ts:2615` — repoint `/api/code-to-music` to the new pipeline.
- **Delete** the duplicate `/api/code-to-music` handler in `server/routes/index.ts:339`.
- **Create** `client/src/components/studio/CodebeatStudio.tsx` — rebuilt UI.
- **Modify** `client/src/components/studio/UnifiedStudioWorkspace.tsx` — F6 → `setActiveView('code-to-music')`; render `CodebeatStudio` at the (currently dead) `activeView === 'code-to-music'` mount; drop the `CodeToMusicStudioV2` import.
- **Modify** `client/src/components/studio/surfaces/AstutelySurface.tsx` — replace the `CodeToMusicStudioV2` mount in the codebeat tab with `CodebeatStudio`.
- **Delete** `client/src/components/studio/CodeToMusicStudioV2.tsx` after both mounts are migrated.

---

## Task 1: `CodeFingerprint` shared type

**Files:**
- Create: `shared/types/codeFingerprint.ts`

**Interfaces:**
- Consumes: `CodeElement` from `shared/types/codeToMusic.ts` (type: `'class' | 'function' | 'variable' | 'loop' | 'conditional' | 'import' | 'return'`, `name`, `line`, `nestingLevel`).
- Produces: `CodeFingerprint`, `CodeUnit` — consumed by Tasks 2 and 3.

- [ ] **Step 1: Create the type file**

```typescript
// shared/types/codeFingerprint.ts
// The structural read of a source file, produced by analyzeCodeStructure and
// consumed by composeArrangementFromCode. Purely structural — no music here.

/** One top-level code unit (function/class) — becomes a song section. */
export interface CodeUnit {
  name: string;
  /** How many times this unit's name appears elsewhere (call/reference count).
   *  The highest-referenced unit becomes the hook/chorus. */
  references: number;
  /** Lines of code spanned (approx) — longer unit = longer section. */
  span: number;
  /** Max loop-nesting depth inside this unit — drives density. */
  maxNesting: number;
  /** Count of conditional branches inside — drives energy variation. */
  branches: number;
  /** Count of loops inside — drives groove intensity. */
  loops: number;
}

export interface CodeFingerprint {
  language: string;
  totalLines: number;
  /** 1-10, reused from getCodeStatistics/parseCodeStructure. */
  complexity: number;
  mood: 'happy' | 'sad' | 'neutral' | 'energetic' | 'chill';
  /** Ordered top-level units (functions/classes). May be empty for trivial code. */
  units: CodeUnit[];
  /** All identifier names in source order — seeds the motif. */
  identifiers: string[];
  /** Total loop count across the whole file. */
  totalLoops: number;
  /** Total branch (if/switch) count across the whole file. */
  totalBranches: number;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: PASS (no errors introduced).

- [ ] **Step 3: Commit**

```bash
git add shared/types/codeFingerprint.ts
git commit -m "feat(codebeat): CodeFingerprint shared type"
```

---

## Task 2: `analyzeCodeStructure` (code → CodeFingerprint)

**Files:**
- Create: `server/services/codebeat/analyzeCodeStructure.ts`
- Test: `server/services/codebeat/__tests__/analyzeCodeStructure.test.ts`

**Interfaces:**
- Consumes: `parseCodeStructure(code, language): ParsedCode` and `getCodeStatistics(parsed)` from `server/services/codeToMusic/codeParser.ts`; `CodeElement` from `shared/types/codeToMusic.ts`; `CodeFingerprint`, `CodeUnit` from Task 1.
- Produces: `analyzeCodeStructure(code: string, language: string): CodeFingerprint` — consumed by Task 3 and Task 5 (route).

- [ ] **Step 1: Write the failing test**

```typescript
// server/services/codebeat/__tests__/analyzeCodeStructure.test.ts
import { describe, it, expect } from 'vitest';
import { analyzeCodeStructure } from '../analyzeCodeStructure';

const SAMPLE = `function main() {
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      helper(i);
    }
  }
}
function helper(x) {
  return x * 2;
}`;

describe('analyzeCodeStructure', () => {
  it('extracts top-level units with the most-referenced first as hook candidate', () => {
    const fp = analyzeCodeStructure(SAMPLE, 'javascript');
    expect(fp.units.length).toBeGreaterThanOrEqual(2);
    const names = fp.units.map(u => u.name);
    expect(names).toContain('main');
    expect(names).toContain('helper');
  });

  it('counts loops and branches across the file', () => {
    const fp = analyzeCodeStructure(SAMPLE, 'javascript');
    expect(fp.totalLoops).toBeGreaterThanOrEqual(1);
    expect(fp.totalBranches).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic — same input yields deeply equal output', () => {
    const a = analyzeCodeStructure(SAMPLE, 'javascript');
    const b = analyzeCodeStructure(SAMPLE, 'javascript');
    expect(a).toEqual(b);
  });

  it('never throws on empty code and returns a minimal fingerprint', () => {
    const fp = analyzeCodeStructure('', 'javascript');
    expect(fp.units).toEqual([]);
    expect(fp.identifiers).toEqual([]);
    expect(fp.totalLines).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/services/codebeat/__tests__/analyzeCodeStructure.test.ts`
Expected: FAIL with "Cannot find module '../analyzeCodeStructure'".

- [ ] **Step 3: Write the implementation**

```typescript
// server/services/codebeat/analyzeCodeStructure.ts
import { parseCodeStructure, getCodeStatistics } from '../codeToMusic/codeParser';
import type { CodeElement } from '../../../shared/types/codeToMusic';
import type { CodeFingerprint, CodeUnit } from '../../../shared/types/codeFingerprint';

/**
 * Analyze source code into a purely structural CodeFingerprint.
 * Deterministic: same (code, language) → deeply equal output. No music here.
 */
export function analyzeCodeStructure(code: string, language: string): CodeFingerprint {
  const parsed = parseCodeStructure(code, language);
  const stats = getCodeStatistics(parsed);

  const elements = parsed.elements;
  const identifiers = elements
    .map(e => e.name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  const totalLoops = elements.filter(e => e.type === 'loop').length;
  const totalBranches = elements.filter(e => e.type === 'conditional').length;

  // Top-level units = functions and classes at nestingLevel 0 (fallback: any
  // function/class if none are at depth 0, e.g. everything is indented).
  const unitElements = elements.filter(e => e.type === 'function' || e.type === 'class');
  const topLevel = unitElements.filter(e => e.nestingLevel === 0);
  const chosen = topLevel.length > 0 ? topLevel : unitElements;

  const units: CodeUnit[] = chosen.map((unit, idx) => {
    // Span: lines until the next unit starts (or end of file).
    const nextUnit = chosen[idx + 1];
    const endLine = nextUnit ? nextUnit.line : parsed.totalLines + 1;
    const span = Math.max(1, endLine - unit.line);

    // References: how many times this unit's name appears among all identifiers,
    // minus its own declaration (min 0).
    const references = Math.max(0, identifiers.filter(n => n === unit.name).length - 1);

    // Elements physically inside this unit's line range.
    const inside = elements.filter(e => e.line > unit.line && e.line < endLine);
    const loops = inside.filter(e => e.type === 'loop').length;
    const branches = inside.filter(e => e.type === 'conditional').length;
    const maxNesting = inside.reduce((m, e) => Math.max(m, e.nestingLevel || 0), 0);

    return { name: unit.name, references, span, maxNesting, branches, loops };
  });

  return {
    language,
    totalLines: parsed.totalLines,
    complexity: parsed.complexity,
    mood: (parsed.mood ?? 'neutral') as CodeFingerprint['mood'],
    units,
    identifiers,
    totalLoops,
    totalBranches,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/services/codebeat/__tests__/analyzeCodeStructure.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/types/codeFingerprint.ts server/services/codebeat/analyzeCodeStructure.ts server/services/codebeat/__tests__/analyzeCodeStructure.test.ts
git commit -m "feat(codebeat): analyzeCodeStructure — code to structural fingerprint"
```

---

## Task 3: `composeArrangementFromCode` (CodeFingerprint → ArrangementPlan)

**Files:**
- Create: `server/services/codebeat/composeArrangementFromCode.ts`
- Test: `server/services/codebeat/__tests__/composeArrangementFromCode.test.ts`

**Interfaces:**
- Consumes: `CodeFingerprint`, `CodeUnit` (Task 1); `analyzeCodeStructure` (Task 2, for the test); `hashString` from `server/services/codeToMusic/noteMapping.ts`; `ArrangementPlan`, `ArrangementSection`, `ArrangementSectionName`, `sanitizeSectionScore`, `validateArrangementPlan`, `NOTE_TO_SEMITONE` from `shared/arrangement.ts`; `GENRE_CONFIGS` from `server/services/codeToMusic/genreConfigs.ts`.
- Produces: `composeArrangementFromCode(fp: CodeFingerprint, opts?: { genre?: string }): ArrangementPlan` — consumed by Task 5 (route).

- [ ] **Step 1: Confirm the exact names to import**

Run: `grep -nE "export (const|function|interface) (hashString|sanitizeSectionScore|ScoreNote|GENRE_CONFIGS)" shared/arrangement.ts server/services/codeToMusic/noteMapping.ts server/services/codeToMusic/genreConfigs.ts`
Expected: `hashString` in noteMapping.ts; `sanitizeSectionScore` + `ScoreNote` in arrangement.ts; `GENRE_CONFIGS` in genreConfigs.ts. The composer does NOT import `NOTE_TO_SEMITONE` — it never needs it because keys come from the hardcoded bare-note `KEY_POOL`/`MINOR_KEYS` (all guaranteed valid), and minor-ness comes from the progression.

- [ ] **Step 2: Write the failing test**

```typescript
// server/services/codebeat/__tests__/composeArrangementFromCode.test.ts
import { describe, it, expect } from 'vitest';
import { analyzeCodeStructure } from '../analyzeCodeStructure';
import { composeArrangementFromCode } from '../composeArrangementFromCode';
import { validateArrangementPlan } from '../../../../shared/arrangement';

const SAMPLE = `function render() {
  for (let i = 0; i < 8; i++) {
    if (visible(i)) { draw(i); }
  }
}
function visible(i) { return i > 2; }
function draw(i) { return i; }`;

describe('composeArrangementFromCode', () => {
  it('emits a plan that passes validateArrangementPlan', () => {
    const fp = analyzeCodeStructure(SAMPLE, 'javascript');
    const plan = composeArrangementFromCode(fp, { genre: 'hiphop' });
    expect(validateArrangementPlan(plan)).toBeNull();
  });

  it('is deterministic — same fingerprint yields deeply equal plan', () => {
    const fp = analyzeCodeStructure(SAMPLE, 'javascript');
    const a = composeArrangementFromCode(fp, { genre: 'hiphop' });
    const b = composeArrangementFromCode(fp, { genre: 'hiphop' });
    expect(a).toEqual(b);
  });

  it('maps the most-referenced unit to a drop (hook) section', () => {
    const fp = analyzeCodeStructure(SAMPLE, 'javascript');
    const plan = composeArrangementFromCode(fp, { genre: 'hiphop' });
    expect(plan.sections.some(s => s.name === 'drop')).toBe(true);
  });

  it('always produces at least one section even for empty code', () => {
    const fp = analyzeCodeStructure('', 'javascript');
    const plan = composeArrangementFromCode(fp, { genre: 'pop' });
    expect(plan.sections.length).toBeGreaterThanOrEqual(1);
    expect(validateArrangementPlan(plan)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/services/codebeat/__tests__/composeArrangementFromCode.test.ts`
Expected: FAIL with "Cannot find module '../composeArrangementFromCode'".

- [ ] **Step 4: Write the implementation**

```typescript
// server/services/codebeat/composeArrangementFromCode.ts
import { hashString } from '../codeToMusic/noteMapping';
import { GENRE_CONFIGS } from '../codeToMusic/genreConfigs';
import {
  sanitizeSectionScore,
  type ArrangementPlan,
  type ArrangementSection,
  type ArrangementSectionName,
  type ScoreNote,
} from '../../../shared/arrangement';
import type { CodeFingerprint, CodeUnit } from '../../../shared/types/codeFingerprint';

// Keys are BARE NOTE NAMES only — NOTE_TO_SEMITONE (what validateArrangementPlan
// checks) contains 'C','G','Bb'… but NOT 'Am'/'Em'. Minor quality is expressed
// through the PROGRESSION (lowercase roman numerals), never the key string —
// this matches scalePitchClasses(key, progression), which reads minor-ness from
// the progression's first numeral.
const KEY_POOL = ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb', 'E'];
// Minor-leaning tonal centers (still bare notes; MINOR_PROG makes them minor).
const MINOR_KEYS = ['A', 'E', 'D', 'C'];
// Minor-ish moods lean to minor progressions.
const MINOR_PROG = ['i', 'VI', 'III', 'VII'];
const MAJOR_PROG = ['I', 'V', 'vi', 'IV'];
const TENSION_PROG = ['i', 'iv', 'V', 'i'];

/** Deterministic pick from an array by hash. */
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Map complexity (1-10) to a bpm nudge around the genre base. */
function bpmForCode(fp: CodeFingerprint, baseBpm: number): number {
  const nudge = Math.round((fp.complexity - 5) * 2); // -8..+10
  return Math.max(40, Math.min(220, baseBpm + nudge));
}

/** Build the identifier motif: 2-4 in-key notes hashed from names. */
function motifNotes(fp: CodeFingerprint): ScoreNote[] {
  const names = fp.identifiers.slice(0, 4);
  if (names.length === 0) return [];
  return names.map((name, i): ScoreNote => {
    const h = hashString(name);
    return {
      slot: i * 4,                    // one note per beat, first bar
      midi: 60 + (h % 24),            // sanitizer snaps to key + clamps register
      durSlots: 2,
      vel: 0.6 + (h % 30) / 100,      // 0.60..0.89
    };
  });
}

function sectionFromUnit(
  unit: CodeUnit,
  name: ArrangementSectionName,
  progression: string[],
): ArrangementSection {
  // Density from nesting, energy from branches+loops — clamped to [0,1].
  const density = Math.max(0.1, Math.min(1, 0.3 + unit.maxNesting * 0.2));
  const energy = Math.max(0.1, Math.min(1, 0.3 + (unit.branches + unit.loops) * 0.15));
  const bars = Math.max(4, Math.min(16, Math.round(unit.span / 2) * 4 || 4));
  return { name, bars, progression, energy, density };
}

/**
 * Compose a deterministic ArrangementPlan from a code fingerprint.
 * The most-referenced unit becomes the drop (hook); others map to
 * verse/build/breakdown by order. Always emits intro + at least one body.
 */
export function composeArrangementFromCode(
  fp: CodeFingerprint,
  opts?: { genre?: string },
): ArrangementPlan {
  const genreKey = (opts?.genre ?? 'pop').toLowerCase();
  const genre = GENRE_CONFIGS[genreKey] ?? GENRE_CONFIGS['pop'];

  // Deterministic global seed from the whole fingerprint.
  const seed = hashString(
    `${fp.language}:${fp.totalLines}:${fp.complexity}:${fp.identifiers.join(',')}`,
  );

  const minorish = fp.mood === 'sad' || fp.mood === 'chill' || fp.complexity > 6;
  const key = minorish ? pick(MINOR_KEYS, seed) : pick(KEY_POOL, seed);
  const bodyProg = minorish ? MINOR_PROG : MAJOR_PROG;
  const bpm = bpmForCode(fp, genre.bpm);

  // Rank units by references (desc), stable by original order for ties.
  const ranked = fp.units
    .map((u, i) => ({ u, i }))
    .sort((a, b) => (b.u.references - a.u.references) || (a.i - b.i))
    .map(x => x.u);

  const sections: ArrangementSection[] = [];
  // Intro.
  sections.push({ name: 'intro', bars: 4, progression: bodyProg, energy: 0.2, density: 0.15 });

  if (ranked.length === 0) {
    // Trivial code: a single verse loop so the band always has something.
    sections.push({ name: 'verse', bars: 8, progression: bodyProg, energy: 0.5, density: 0.4 });
  } else {
    const hook = ranked[0];
    const rest = ranked.slice(1, 4); // cap body sections for a tight arrangement

    // Verse(s) from the non-hook units.
    rest.forEach((u, idx) => {
      const name: ArrangementSectionName = idx === 0 ? 'verse' : idx === 1 ? 'build' : 'breakdown';
      const prog = name === 'build' ? TENSION_PROG : bodyProg;
      sections.push(sectionFromUnit(u, name, prog));
    });

    // The hook → drop, carrying the identifier motif as its score.
    const dropProg = bodyProg;
    const rawMotif = motifNotes(fp);
    const drop = sectionFromUnit(hook, 'drop', dropProg);
    if (rawMotif.length >= 4) {
      const sanitized = sanitizeSectionScore({ melody: rawMotif }, key, dropProg);
      if (sanitized) drop.score = sanitized;
    }
    sections.push(drop);
  }

  // Outro.
  sections.push({ name: 'outro', bars: 4, progression: bodyProg, energy: 0.2, density: 0.15 });

  return {
    id: `codebeat-${seed}`,
    key,
    bpm,
    subGenre: genre.name,
    mood: fp.mood,
    sections,
    acePrompt: `${genre.name} beat generated from ${fp.language} code, ${fp.mood} mood, ${fp.units.length} sections`,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/services/codebeat/__tests__/composeArrangementFromCode.test.ts`
Expected: PASS (4 tests). If the "drop" test fails because empty/rest ordering differs, confirm `ranked[0]` maps to `'drop'` — it always pushes a drop when `ranked.length > 0`.

- [ ] **Step 6: Commit**

```bash
git add server/services/codebeat/composeArrangementFromCode.ts server/services/codebeat/__tests__/composeArrangementFromCode.test.ts
git commit -m "feat(codebeat): composeArrangementFromCode — fingerprint to ArrangementPlan"
```

---

## Task 4: Remove the duplicate API route

**Files:**
- Modify: `server/routes/index.ts` (delete the `/api/code-to-music` handler around line 339)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing — this is a deletion so only `server/routes.ts` defines the route.

- [ ] **Step 1: Confirm which file is mounted**

Run: `grep -nE "registerRoutes|from ['\"]\./routes['\"]" server/index.ts`
Expected: `server/index.ts` imports `registerRoutes` from `./routes` (i.e. `routes.ts`). This confirms `routes/index.ts` is the dead copy.

- [ ] **Step 2: Delete the duplicate handler**

Open `server/routes/index.ts`, find the `app.post("/api/code-to-music", ...)` block near line 339, and delete the entire handler (from `app.post(` through its closing `});`). Remove any now-unused import of `convertCodeToMusic`/`convertCodeToMusicEnhanced` in that file.

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: PASS. If an unused-import error appears, remove that import line.

- [ ] **Step 4: Commit**

```bash
git add server/routes/index.ts
git commit -m "fix(codebeat): remove duplicate /api/code-to-music route"
```

---

## Task 5: Repoint the live route to the new pipeline

**Files:**
- Modify: `server/routes.ts:2615` (the `/api/code-to-music` handler)

**Interfaces:**
- Consumes: `analyzeCodeStructure` (Task 2), `composeArrangementFromCode` (Task 3), `validateArrangementPlan` from `shared/arrangement`.
- Produces: HTTP `POST /api/code-to-music` → `{ success: true, plan: ArrangementPlan, fingerprint: CodeFingerprint }`.

- [ ] **Step 1: Add imports near the top of server/routes.ts**

Find the existing `import { convertCodeToMusic, convertCodeToMusicEnhanced } from "./services/codeToMusic";` (line ~52) and add below it:

```typescript
import { analyzeCodeStructure } from "./services/codebeat/analyzeCodeStructure";
import { composeArrangementFromCode } from "./services/codebeat/composeArrangementFromCode";
import { validateArrangementPlan } from "../shared/arrangement";
```

- [ ] **Step 2: Replace the handler body at routes.ts:2615**

Replace the existing handler with:

```typescript
  app.post("/api/code-to-music", aiLimiter, requireAuth(), async (req: Request, res: Response) => {
    try {
      const { code = '', language = 'javascript', genre = 'pop' } = req.body;
      console.log(`🎵 Codebeat: ${language} code → ArrangementPlan (genre: ${genre})`);

      const fingerprint = analyzeCodeStructure(String(code), String(language));
      const plan = composeArrangementFromCode(fingerprint, { genre: String(genre) });

      const problem = validateArrangementPlan(plan);
      if (problem) {
        return sendError(res, 422, `Generated plan invalid: ${problem}`);
      }

      res.json({ success: true, plan, fingerprint });
    } catch (error: any) {
      console.error("❌ Codebeat error:", error);
      sendError(res, 500, error?.message || "Failed to convert code to music");
    }
  });
```

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Manual smoke test (server running)**

Run: `curl -s -X POST http://localhost:4000/api/code-to-music -H "Content-Type: application/json" -d '{"code":"function main(){ for(let i=0;i<8;i++){ if(i>2){ draw(i); } } } function draw(x){ return x; }","language":"javascript","genre":"hiphop"}'`
Expected: JSON with `"success":true`, a `plan` containing `sections` including a `drop`, and a `fingerprint`. (Auth may require a session cookie; if 401, test via the UI in Task 7 instead.)

- [ ] **Step 5: Commit**

```bash
git add server/routes.ts
git commit -m "feat(codebeat): route emits ArrangementPlan from code"
```

---

## Task 6: `CodebeatStudio` client component

**Files:**
- Create: `client/src/components/studio/CodebeatStudio.tsx`

**Interfaces:**
- Consumes: `POST /api/code-to-music` → `{ success, plan, fingerprint }`; `getConductor` from `client/src/organism/conductor/Conductor` (exported at Conductor.ts:856); `apiRequest` from `@/lib/queryClient`; `useToast` from `@/hooks/use-toast`; `CodeFingerprint` from `shared/types/codeFingerprint`; `ArrangementPlan` from `shared/arrangement`.
- Produces: default-exported `CodebeatStudio` React component — mounted by Task 7.

- [ ] **Step 1: Create the component**

```tsx
// client/src/components/studio/CodebeatStudio.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getConductor } from '../../organism/conductor/Conductor';
import type { CodeFingerprint } from '../../../../shared/types/codeFingerprint';
import type { ArrangementPlan } from '../../../../shared/arrangement';
import { Code, Wand2, Play } from 'lucide-react';

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust'];
const GENRES = ['pop', 'rock', 'hiphop', 'edm', 'rnb', 'country', 'jazz', 'lofi'];

const PLACEHOLDER = `function main() {
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) beat(i);
  }
}
function beat(x) { return x * 2; }`;

export default function CodebeatStudio() {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [genre, setGenre] = useState('hiphop');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<ArrangementPlan | null>(null);
  const [fingerprint, setFingerprint] = useState<CodeFingerprint | null>(null);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await apiRequest('POST', '/api/code-to-music', {
        code: code || PLACEHOLDER,
        language,
        genre,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Generation failed');
      setPlan(data.plan);
      setFingerprint(data.fingerprint);
      toast({ title: 'Skeleton ready', description: `${data.plan.sections.length} sections in ${data.plan.key} @ ${data.plan.bpm} BPM` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Codebeat failed', description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  const playWithBand = () => {
    if (!plan) return;
    try {
      const conductor = getConductor();
      conductor.loadPlan(plan);
      toast({ title: '🎸 Playing with the band', description: 'The Organism is performing your code.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not start the band', description: err?.message });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code className="h-4 w-4" /> Your Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder={PLACEHOLDER}
            className="min-h-[240px] font-mono text-sm"
          />
          <div className="flex gap-2">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={busy} className="w-full">
            <Wand2 className="mr-2 h-4 w-4" /> {busy ? 'Analyzing…' : 'Generate Skeleton'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="h-4 w-4" /> The Skeleton</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!plan && <p className="text-sm text-muted-foreground">Generate to see your code's musical shape.</p>}
          {plan && fingerprint && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{plan.key}</Badge>
                <Badge variant="outline">{plan.bpm} BPM</Badge>
                <Badge variant="outline">{plan.subGenre}</Badge>
                <Badge variant="outline">{fingerprint.mood}</Badge>
                <Badge variant="outline">complexity {fingerprint.complexity}</Badge>
              </div>
              <div className="space-y-1">
                {plan.sections.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded border border-border/40 px-2 py-1 text-xs">
                    <span className="font-semibold uppercase tracking-wide">{s.name}</span>
                    <span className="text-muted-foreground">{s.bars} bars · energy {s.energy.toFixed(2)}{s.score ? ' · ♪ motif' : ''}</span>
                  </div>
                ))}
              </div>
              <Button onClick={playWithBand} className="w-full">
                <Play className="mr-2 h-4 w-4" /> Play with the band
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: PASS. If `apiRequest`'s signature differs, match the existing usage in `CodeToMusicStudioV2.tsx` (it uses `apiRequest('POST', url, body)`).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/studio/CodebeatStudio.tsx
git commit -m "feat(codebeat): CodebeatStudio UI — skeleton view + play with the band"
```

---

## Task 7: Mount CodebeatStudio in place; retire CodeToMusicStudioV2

**Files:**
- Modify: `client/src/components/studio/UnifiedStudioWorkspace.tsx` (import at line ~25; F6 menu action at line ~3448; the `activeView === 'code-to-music'` mount at line ~4503/4523)
- Modify: `client/src/components/studio/surfaces/AstutelySurface.tsx` (import at line ~36; mount at line ~345)
- Delete: `client/src/components/studio/CodeToMusicStudioV2.tsx`

**Interfaces:**
- Consumes: `CodebeatStudio` (Task 6).
- Produces: Codebeat reachable in-place as `activeView === 'code-to-music'` and in the ASTUTELY codebeat tab.

- [ ] **Step 1: Swap the import in UnifiedStudioWorkspace**

Change line ~25 from:
```typescript
const CodeToMusicStudioV2 = React.lazy(() => import('./CodeToMusicStudioV2'));
```
to:
```typescript
const CodebeatStudio = React.lazy(() => import('./CodebeatStudio'));
```

- [ ] **Step 2: Repoint F6 to open in place (no cross-surface navigate)**

Find the View-menu Codebeat button (line ~3448):
```typescript
<button onClick={menuAction(() => navigate('/studio/ai?tool=codebeat'))} ...>
```
Change to:
```typescript
<button onClick={menuAction(() => setActiveView('code-to-music'))} ...>
```

- [ ] **Step 3: Render CodebeatStudio at the (now live) mount**

At line ~4503 replace the `activeView === 'code-to-music'` block's `<CodeToMusicStudioV2 />` with `<CodebeatStudio />` (keep the surrounding Suspense/lazy wrapper).

- [ ] **Step 4: Swap the ASTUTELY surface mount**

In `AstutelySurface.tsx`, change the import (line ~36):
```typescript
const CodeToMusicStudioV2 = React.lazy(() => import('../CodeToMusicStudioV2'));
```
to:
```typescript
const CodebeatStudio = React.lazy(() => import('../CodebeatStudio'));
```
and the mount (line ~345) `<CodeToMusicStudioV2 />` → `<CodebeatStudio />`.

- [ ] **Step 5: Delete the old component**

Run: `git rm client/src/components/studio/CodeToMusicStudioV2.tsx`

- [ ] **Step 6: Verify nothing else imports the old component**

Run: `grep -rn "CodeToMusicStudioV2" client/src`
Expected: no results. If any remain, repoint them to `CodebeatStudio` or remove.

- [ ] **Step 7: Typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/studio/UnifiedStudioWorkspace.tsx client/src/components/studio/surfaces/AstutelySurface.tsx
git commit -m "feat(codebeat): mount CodebeatStudio in place, retire CodeToMusicStudioV2"
```

---

## Task 8: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS, including the two new codebeat test files.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Drive it in the browser (dev server running)**

1. Open the MIX studio.
2. View menu → Codebeat (F6). Expected: Codebeat opens **in place** (no jump to ASTUTELY).
3. Paste a function with a loop and an if. Click **Generate Skeleton**. Expected: skeleton shows sections (a `drop`), key, BPM, a `♪ motif` marker on the drop.
4. Click **Play with the band**. Expected: the Organism starts and audio plays in the studio.
5. Generate the same code twice. Expected: identical key/BPM/sections (determinism).

- [ ] **Step 4: Confirm the doubles are gone**

Run: `grep -rn "CodeToMusicStudioV2" client/src ; grep -rnc "app.post(\"/api/code-to-music\"" server/routes.ts server/routes/index.ts`
Expected: no `CodeToMusicStudioV2` matches; the route defined in exactly one file.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test(codebeat): end-to-end verification fixes"
```

---

## Notes for the implementer

- **Determinism is the whole point** — if a test flakes, look for `Math.random`/`Date.now` sneaking in. Everything seeds off `hashString`.
- **The Organism is not rebuilt** — Codebeat only produces an `ArrangementPlan` and calls `getConductor().loadPlan(plan)`. If the band doesn't play, debug the Organism/transport separately; the plan handoff is the only new client wiring.
- **v2 (out of scope):** faithfulness↔fire dial, AI enhancement of the motif, a separately-audible "code melody" layer. Do not build these now.
