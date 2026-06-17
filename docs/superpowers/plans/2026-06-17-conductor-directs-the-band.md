# The Conductor Directs the Band — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the composed `ArrangementPlan` the single authority over who plays / how hard / who leads per section, demote the reactive per-frame system to a humanizer under that authority, and make conducting the default.

**Architecture:** Each section gains a per-instrument `SectionOrchestration` (lead/support/out). A pure `roleCeiling(role)` helper turns a role into an activity ceiling (out→0, support→0.6, lead→1.0). Each generator multiplies its existing reactive `computeTargetLevel` by `this.roleCeiling()` at the one call site in `processFrame`, so the composer sets the ceiling and physics adds feel underneath. The orchestrator sets each generator's role on section entry; the server composer emits orchestration; conducting defaults on.

**Tech Stack:** TypeScript, Vitest (`npm run test:unit`), Tone.js (generators only).

**Spec:** `docs/superpowers/specs/2026-06-17-conductor-directs-the-band-design.md`

**Verified seams:**
- `shared/arrangement.ts:25` `ArrangementSection` (has `name,bars,progression,energy,density,groove?,style?`); `validateArrangementPlan` ~`:278`.
- `GeneratorBase` (`client/src/organism/generators/GeneratorBase.ts:8`): has `protected activityLevel`, `protected arrangementMultiplier`, `applyArrangementMultiplier` (`:18`), `constructor(name)` (`:14`). `computeTargetLevel` is per-generator, NOT in base.
- Uniform call site in each generator's `processFrame`: `const targetLevel = this.computeTargetLevel(...)` then `this.activityLevel += this.smoothingCoeff(N) * (targetLevel - this.activityLevel)`. Lines: Drum `:170`, Bass `:292`, Chord `:379`, Melody `:621` (2-arg: `computeTargetLevel(organism, newBehavior)`), Texture `:121`.
- Orchestrator apply site: `GeneratorOrchestrator.ts:1466-1474` (`applyArrangementMultiplier` per generator: `this.drum/bass/melody/texture/chord`).
- Server composer sections: `server/services/composer.ts:78-83` (slot table) + `:128-138` (section build).
- `songModeEnabled` default: `OrganismProvider.tsx:337` (`useState(false)`); compose path `:1690`,`:1835`.

---

## File Structure

- **Create** `client/src/organism/generators/arrangementRole.ts` — pure `roleCeiling` (+ re-export `InstrumentRole`). Tested.
- **Modify** `shared/arrangement.ts` — add `InstrumentRole`, `SectionOrchestration`, optional `orchestration?` on `ArrangementSection`; validation stays permissive.
- **Modify** `client/src/organism/generators/GeneratorBase.ts` — `role` field + `setRole` + protected `roleCeiling()`.
- **Modify** the 5 generators — multiply target by `this.roleCeiling()` at the call site.
- **Modify** `client/src/organism/generators/GeneratorOrchestrator.ts` — `setRole` per generator on section apply.
- **Modify** `server/services/composer.ts` — emit `orchestration` per section (+ default-fill).
- **Modify** `client/src/features/organism/OrganismProvider.tsx` — `songModeEnabled` default `true` + silent jam fallback if compose fails.

---

## Task 1: Pure `roleCeiling` helper

**Files:**
- Create: `client/src/organism/generators/arrangementRole.ts`
- Test: `client/src/organism/generators/__tests__/arrangementRole.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { roleCeiling } from '../arrangementRole'

describe('roleCeiling', () => {
  it('out silences the part', () => { expect(roleCeiling('out')).toBe(0) })
  it('support is a restrained ceiling', () => { expect(roleCeiling('support')).toBe(0.6) })
  it('lead is the full ceiling', () => { expect(roleCeiling('lead')).toBe(1.0) })
  it('unknown/undefined defaults to support (never throws)', () => {
    expect(roleCeiling(undefined)).toBe(0.6)
    expect(roleCeiling('bogus' as never)).toBe(0.6)
  })
})
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

Run: `npx vitest run client/src/organism/generators/__tests__/arrangementRole.test.ts`

- [ ] **Step 3: Implement**

```ts
// arrangementRole.ts
import type { InstrumentRole } from '../../../../shared/arrangement'
export type { InstrumentRole }

/** A section role -> activity ceiling. The composer sets the ceiling; the
 *  generator's reactive curve adds feel underneath it. Defaults to 'support'. */
export function roleCeiling(role: InstrumentRole | undefined): number {
  switch (role) {
    case 'out':     return 0
    case 'lead':    return 1.0
    case 'support': return 0.6
    default:        return 0.6
  }
}
```

> NOTE: confirm the relative path to `shared/arrangement.ts` from this file with `tsc`. The repo aliases `shared` in some places — if `import ... from '@shared/arrangement'` is the project convention (check other client imports: `grep -rn "from ['\"]@shared/arrangement" client/src | head`), use that instead of the relative path.

- [ ] **Step 4: Run — expect PASS (4 tests)**

- [ ] **Step 5: Commit**

```bash
git add client/src/organism/generators/arrangementRole.ts client/src/organism/generators/__tests__/arrangementRole.test.ts
git commit -m "feat(arrange): pure roleCeiling helper (out/support/lead -> activity ceiling)"
```

---

## Task 2: Section orchestration type + permissive validation

**Files:**
- Modify: `shared/arrangement.ts` (types near `:25`; validation near `:278`)
- Test: `shared/__tests__/arrangement.test.ts` (create if absent; else add to existing — `grep -rn "validateArrangementPlan" shared` to find the existing suite)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { validateArrangementPlan, type ArrangementPlan } from '../arrangement'

const planNoOrch: ArrangementPlan = {
  id: 't', key: 'C', bpm: 90, subGenre: 'boom-bap', mood: 'dark', acePrompt: '',
  sections: [{ name: 'verse', bars: 4, progression: ['i','VI'], energy: 0.6, density: 0.5 }],
}

describe('orchestration', () => {
  it('plans WITHOUT orchestration still validate (back-compat)', () => {
    expect(validateArrangementPlan(planNoOrch)).toBeNull()
  })
  it('plans WITH a full orchestration validate', () => {
    const p = structuredClone(planNoOrch)
    p.sections[0].orchestration = { drums:'out', bass:'support', chord:'support', melody:'lead', texture:'support' }
    expect(validateArrangementPlan(p)).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`orchestration` not on the type → tsc/test error)

Run: `npx vitest run shared/__tests__/arrangement.test.ts`

- [ ] **Step 3: Implement — add types + leave validation permissive**

In `shared/arrangement.ts`, above `ArrangementSection`:

```ts
export type InstrumentRole = 'lead' | 'support' | 'out'

/** Per-instrument direction for a section. Absent instrument or absent
 *  orchestration = 'support' at the section's energy (back-compat). */
export interface SectionOrchestration {
  drums:   InstrumentRole
  bass:    InstrumentRole
  chord:   InstrumentRole
  melody:  InstrumentRole
  texture: InstrumentRole
}
```

Add to `ArrangementSection`:

```ts
  /** Who plays / how forward, per instrument, this section. Optional for
   *  back-compat; absent = every instrument 'support'. */
  orchestration?: SectionOrchestration
```

Validation: do NOT require `orchestration`. (Optional hardening — only if every
field is present, each must be one of lead/support/out; skip if it complicates the
existing validator. The permissive default is the requirement.)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add shared/arrangement.ts shared/__tests__/arrangement.test.ts
git commit -m "feat(arrange): SectionOrchestration type (lead/support/out), optional + back-compat"
```

---

## Task 3: GeneratorBase gains role + roleCeiling

**Files:**
- Modify: `client/src/organism/generators/GeneratorBase.ts`

- [ ] **Step 1: Add import, field, setter, and protected ceiling accessor**

After the existing imports, import the helper + type:

```ts
import { roleCeiling, type InstrumentRole } from './arrangementRole'
```

Inside the class, near `protected arrangementMultiplier` (`:11`):

```ts
  /** Composer-assigned role for the current section. Default 'support' so a
   *  generator with no plan loaded behaves like today (jam mode). */
  protected role: InstrumentRole = 'support'

  setRole(role: InstrumentRole): void { this.role = role }

  /** Activity ceiling for the current role — generators multiply their
   *  reactive target by this so the composer caps who plays / how forward. */
  protected roleCeiling(): number { return roleCeiling(this.role) }
```

- [ ] **Step 2: Run type check**

Run: `npm run check`
Expected: tsc clean (no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add client/src/organism/generators/GeneratorBase.ts
git commit -m "feat(arrange): GeneratorBase role + roleCeiling (default support = today's behavior)"
```

---

## Task 4: Generators obey the role ceiling at the call site

**Files (one edit each, identical pattern):**
- Modify: `DrumGenerator.ts:170`, `BassGenerator.ts:292`, `ChordGenerator.ts:379`, `TextureGenerator.ts:121`, `MelodyGenerator.ts:621`

- [ ] **Step 1: Drum/Bass/Chord/Texture — multiply target by the ceiling**

For Drum (`:170`), Bass (`:292`), Chord (`:379`): change
```ts
    const targetLevel = this.computeTargetLevel(organism)
```
to
```ts
    // Composer's role caps activity; reactive curve adds feel under the ceiling.
    const targetLevel = this.computeTargetLevel(organism) * this.roleCeiling()
```

For Texture (`:121`): change
```ts
    let targetLevel = this.computeTargetLevel(organism)
```
to
```ts
    let targetLevel = this.computeTargetLevel(organism) * this.roleCeiling()
```

- [ ] **Step 2: Melody (`:621`) — same, preserving its 2-arg call**

Change
```ts
    const targetLevel = this.computeTargetLevel(organism, newBehavior)
```
to
```ts
    const targetLevel = this.computeTargetLevel(organism, newBehavior) * this.roleCeiling()
```

> Melody also has a section-behavior path (`setSectionBehavior`/`onSectionChange`). The
> ceiling multiplication is sufficient for this plan: role `'out'` → ceiling 0 → silent.
> Do NOT add a parallel behavior mapping here (avoid a new double); behavior stays
> driven by its existing logic, level is capped by role.

- [ ] **Step 3: Type check + existing generator suites**

Run: `npm run check && npx vitest run client/src/organism/generators/__tests__/`
Expected: tsc clean; all generator suites green (default role 'support' = ceiling 0.6; existing tests don't assert absolute target levels — confirm. If a test asserts an absolute Flow level e.g. `0.78`, it now sees `0.78*0.6`. If so, that test must set the generator's role to 'lead' first via `setRole('lead')`, or assert the ratio; update it accordingly — do NOT weaken the ceiling).

- [ ] **Step 4: Commit**

```bash
git add client/src/organism/generators/DrumGenerator.ts client/src/organism/generators/BassGenerator.ts client/src/organism/generators/ChordGenerator.ts client/src/organism/generators/TextureGenerator.ts client/src/organism/generators/MelodyGenerator.ts
git commit -m "feat(arrange): generators cap activity by composer role (out=silent, lead=full)"
```

---

## Task 5: Orchestrator assigns roles on section entry

**Files:**
- Modify: `client/src/organism/generators/GeneratorOrchestrator.ts:1466-1474`

- [ ] **Step 1: After the `applyArrangementMultiplier` block, assign roles**

Immediately after the existing five `applyArrangementMultiplier(...)` calls (~`:1474`):

```ts
    // Composer roles: who plays / how forward this section. Absent orchestration
    // (old plans / jam mode) defaults every instrument to 'support' so behavior
    // matches today minus the full-time-everyone problem.
    const orch = section.orchestration
    this.drum.setRole(orch?.drums ?? 'support')
    this.bass.setRole(orch?.bass ?? 'support')
    this.melody.setRole(orch?.melody ?? 'support')
    this.chord.setRole(orch?.chord ?? 'support')
    this.texture.setRole(orch?.texture ?? 'support')
```

> `section` here is the `getProducerArrangementSlot(barNumber).slot`. Confirm it carries
> `orchestration` through from the plan: the slot type is `ProducerArrangementSlot`
> (`client/src/organism/state/ProducerArrangement.ts`). If the slot does NOT include
> `orchestration`, add an optional `orchestration?: SectionOrchestration` to
> `ProducerArrangementSlot` and populate it in `slotFromPlanSection` (same file, the
> function that maps a `PlanSection` to a slot — `grep -n slotFromPlanSection`). This is
> the plan→slot bridge; without it the directive never reaches the orchestrator.

- [ ] **Step 2: If needed, thread orchestration through the slot**

In `client/src/organism/state/ProducerArrangement.ts`, add to `ProducerArrangementSlot`:
```ts
  orchestration?: import('../../../../shared/arrangement').SectionOrchestration
```
and in `slotFromPlanSection(section)` include:
```ts
    orchestration: section.orchestration,
```

- [ ] **Step 3: Type check + orchestrator suite**

Run: `npm run check && npx vitest run client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts`
Expected: tsc clean; suite green.

- [ ] **Step 4: Commit**

```bash
git add client/src/organism/generators/GeneratorOrchestrator.ts client/src/organism/state/ProducerArrangement.ts
git commit -m "feat(arrange): orchestrator assigns per-instrument roles from the plan section"
```

---

## Task 6: Composer emits orchestration per section

**Files:**
- Modify: `server/services/composer.ts` (slot table `:78-83`, section build `:128-138`)
- Test: `server/services/__tests__/composer.test.ts` (exists per repo)

- [ ] **Step 1: Write the failing test**

Add to `server/services/__tests__/composer.test.ts`:

```ts
it('every emitted section has a full orchestration', async () => {
  const plan = await composeArrangement({ prompt: 'dark trap 140' }) // use the suite's existing call
  for (const s of plan.sections) {
    expect(s.orchestration).toBeDefined()
    for (const k of ['drums','bass','chord','melody','texture'] as const) {
      expect(['lead','support','out']).toContain(s.orchestration![k])
    }
  }
})
it('intro has drums out; drop has drums and bass leading', async () => {
  const plan = await composeArrangement({ prompt: 'dark trap 140' })
  const intro = plan.sections.find(s => s.name === 'intro')
  const drop  = plan.sections.find(s => s.name === 'drop')
  if (intro) expect(intro.orchestration!.drums).toBe('out')
  if (drop)  { expect(drop.orchestration!.drums).toBe('lead'); expect(drop.orchestration!.bass).toBe('lead') }
})
```

> Match the suite's existing compose entrypoint name/signature (`grep -n "compose" server/services/__tests__/composer.test.ts`); use that instead of `composeArrangement` if it differs.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run server/services/__tests__/composer.test.ts`

- [ ] **Step 3: Implement — a per-section-name orchestration default + fill**

Add near the slot table (`:78`):

```ts
const SECTION_ORCHESTRATION: Record<ArrangementSectionName, SectionOrchestration> = {
  intro:     { drums:'out',     bass:'support', chord:'lead',    melody:'support', texture:'support' },
  verse:     { drums:'support', bass:'support', chord:'support', melody:'lead',    texture:'support' },
  build:     { drums:'support', bass:'support', chord:'support', melody:'support', texture:'support' },
  drop:      { drums:'lead',    bass:'lead',    chord:'support', melody:'support', texture:'support' },
  drop2:     { drums:'lead',    bass:'lead',    chord:'support', melody:'support', texture:'support' },
  breakdown: { drums:'out',     bass:'support', chord:'support', melody:'lead',    texture:'support' },
  outro:     { drums:'support', bass:'support', chord:'lead',    melody:'support', texture:'out'     },
}
```

Where each section object is built (`:134-138`), add:

```ts
      orchestration: SECTION_ORCHESTRATION[slot.name] ?? {
        drums:'support', bass:'support', chord:'support', melody:'support', texture:'support',
      },
```

Import `SectionOrchestration` + `ArrangementSectionName` from `shared/arrangement` at the top if not already.

> If the composer also has an LLM/Ollama path that emits sections, default-fill there
> too: after parsing the LLM JSON, for any section missing `orchestration`, set it from
> `SECTION_ORCHESTRATION[name]` (or the all-support fallback). A plan must NEVER ship a
> section without orchestration.

- [ ] **Step 4: Run — expect PASS; full server check**

Run: `npx vitest run server/services/__tests__/composer.test.ts && npm run check`

- [ ] **Step 5: Commit**

```bash
git add server/services/composer.ts server/services/__tests__/composer.test.ts
git commit -m "feat(arrange): composer emits per-section orchestration (intro drums out, drop full)"
```

---

## Task 7: Conducting on by default

**Files:**
- Modify: `client/src/features/organism/OrganismProvider.tsx:337` (+ compose paths `:1690`,`:1835`)

- [ ] **Step 1: Flip the default**

Change `:337`:
```ts
  const [songModeEnabled,     setSongModeEnabledState]     = useState(false)
```
to
```ts
  // Conducting on by default — the band loads a composed arrangement on start so
  // it plays as an arranged ensemble, not five reactors. Toggle off = jam mode.
  const [songModeEnabled,     setSongModeEnabledState]     = useState(true)
```

And update the ref initializer if it mirrors the state (`grep -n "songModeEnabledRef = useRef" OrganismProvider.tsx` → set initial to `true`).

- [ ] **Step 2: Ensure compose failure falls back to jam silently**

At the compose call sites (`:1690`, `:1835`), the pattern is
`if (songModeEnabledRef.current) void composeForPreset(preset).then(plan => { ... orchestr.loadArrangementPlan(plan) })`.
Add a `.catch` so a failed compose doesn't break start:

```ts
      if (songModeEnabledRef.current) void composeForPreset(preset)
        .then(plan => { /* existing: store + orchestr.loadArrangementPlan(plan) */ })
        .catch(err => { orgLog('compose:failed-jam-fallback', { err: String(err) }) })
```

(Keep the existing `.then` body; only ADD the `.catch`. If a `.catch` already exists, leave it.)

- [ ] **Step 3: Type check + the provider/organism suite**

Run: `npm run check && npx vitest run client/src/features/organism/__tests__/`
Expected: tsc clean; suites green. If a test asserts `songModeEnabled === false` initial state, update it to `true` (the default deliberately changed).

- [ ] **Step 4: Commit**

```bash
git add client/src/features/organism/OrganismProvider.tsx
git commit -m "feat(arrange): conducting on by default (compose+load plan on start; jam fallback)"
```

---

## Task 8: Full verification

**Files:** none.

- [ ] **Step 1: Full unit suite** — `npm run test:unit` → all green.
- [ ] **Step 2: Type check** — `npm run check` → clean.
- [ ] **Step 3: By-ear in the running app** — `npm run dev` (5001/4001), start the Organism (conducting now default). Confirm: intro has NO drums; verse = melody leading over a support bed; build rises; drop hits full (drums+bass forward); breakdown strips drums. The band should sound ARRANGED, not five reactors. Toggle Song Mode OFF → confirm jam mode still works (all 'support', today's behavior).
- [ ] **Step 4: Commit any test adjustments**

```bash
git add -A && git commit -m "test(arrange): verify conductor-directs-the-band suite green"
```

---

## Self-Review (completed)

- **Spec coverage:** §1 type → Task 2; §2 generators obey → Tasks 3,4; §3 orchestrator applies → Task 5; §4 composer emits → Task 6; §5 conducting default → Task 7; pure helper → Task 1; testing → each task + Task 8. ✔
- **Placeholders:** none — real code in every step. Three explicit "confirm against current code" notes (shared import alias, slot threading, composer entrypoint name) each carry a concrete grep + fallback that still compiles. ✔
- **Type consistency:** `InstrumentRole`/`SectionOrchestration` defined in `shared/arrangement.ts` (Task 2) → consumed by `arrangementRole.ts` (Task 1, may need reordering: if Task 1 runs first it imports a type that lands in Task 2 — SEE ORDERING NOTE), `GeneratorBase` (Task 3), orchestrator (Task 5), composer (Task 6). `roleCeiling`/`setRole`/`role` consistent across Tasks 1,3,4,5. ✔
- **ORDERING NOTE:** Task 1 imports `InstrumentRole` from `shared/arrangement.ts`, which Task 2 adds. Do **Task 2 before Task 1** (or add the `InstrumentRole` type in Task 2's step first). Recommended execution order: **2 → 1 → 3 → 4 → 5 → 6 → 7 → 8.**
