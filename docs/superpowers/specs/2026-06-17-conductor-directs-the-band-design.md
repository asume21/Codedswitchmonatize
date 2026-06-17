# The Conductor Directs the Band — arrangement-brain consolidation (Approach A)

_2026-06-17. The live Organism sounds like "everyone in their own direction" because
there are TWO arrangement brains and the wrong one wins. This spec makes the composed
plan the single authority over WHO PLAYS, HOW HARD, and WHO LEADS each section, demotes
the reactive per-frame system to a humanizer, and makes conducting the default._

## The problem (root cause, verified 2026-06-16/17)

Two systems decide how the band plays, every moment:

1. **Reactive brain (wins):** each generator runs `computeTargetLevel(organism)` ~60×/s
   and sets its own activity purely from physics `OState`
   (Dormant/Awakening/Breathing/Flow). It does NOT read the arrangement section. So
   every instrument plays full-time whenever the organism is in Flow — five soloists.
2. **Composed brain (barely heard):** `ArrangementPlan` sections carry only `energy` +
   `density` numbers, applied as VOLUME multipliers (`applyArrangementMultiplier`). The
   server composer literally comments "drums OUT" / "full band" per section
   (`server/services/composer.ts:72-77`) but encodes that intent as a low `density`
   number that merely turns a part DOWN, never tells a generator to sit out, support,
   or lead.

Result: load a plan (Song Mode) → chords + volumes shift ("starts to change") → the
reactive brain immediately re-asserts the same full-time texture ("sounds the same").
Song Mode also defaults OFF, so most sessions never even get the plan.

## The fix (Approach A)

Give each plan section an explicit **per-instrument orchestration directive**, make
generators OBEY it, demote the reactive function to a fallback + humanizer, and turn
conducting on by default.

### 1. Data: add orchestration to the section (`shared/arrangement.ts`)

```ts
export type InstrumentRole = 'lead' | 'support' | 'out'

/** Per-instrument direction for a section. Absent instrument = 'support'
 *  at the section's energy (back-compat with plans that predate this field). */
export interface SectionOrchestration {
  drums:   InstrumentRole
  bass:    InstrumentRole
  chord:   InstrumentRole
  melody:  InstrumentRole
  texture: InstrumentRole
}

// Added to ArrangementSection (optional for back-compat):
//   orchestration?: SectionOrchestration
```

Semantics (the directive each generator obeys):
- **`out`** → target activity 0 (the part sits out — real arrangement silence, not just quiet).
- **`support`** → plays at a restrained level scaled by section `energy` (the bed).
- **`lead`** → plays forward/foreground; at most one or two instruments lead a section.

`energy`/`density` are KEPT — they shape *how hard* support/lead play; `orchestration`
adds the categorical *whether/role* the reactive brain never had.

### 2. Generators obey the directive (`GeneratorBase` + each generator)

Add to the arrangement seam (alongside `applyArrangementMultiplier`):

```ts
// GeneratorBase
setRole(role: InstrumentRole): void   // stores this.role (default 'support')
```

`computeTargetLevel` changes from "physics decides" to "directive decides, physics
humanizes within it":

```ts
// Conceptual — per generator, in computeTargetLevel(organism):
//   if (this.role === 'out') return 0
//   const ceiling = this.role === 'lead' ? 1.0 : 0.6   // role sets the ceiling
//   const reactive = <existing OState-based value>       // 0..1 feel within the ceiling
//   return ceiling * reactive
```

So the composer sets the ceiling (who plays / how forward), the reactive OState curve
adds living feel UNDER that ceiling. When no plan is loaded, role defaults to
`'support'` and behavior ≈ today (jam mode unchanged).

The melody generator already has a section-behavior override
(`onSectionChange`/`setSectionBehavior`); `lead` maps to its Lead behavior,
`support` to Hint/Respond, `out` to Rest — reuse it, don't add a parallel path.

### 3. Orchestrator applies the directive on section entry
(`GeneratorOrchestrator.applyArrangement`, ~`:1466-1474`)

Where it currently calls `applyArrangementMultiplier(section.x)` for each generator,
ALSO call `setRole(section.orchestration?.x ?? 'support')`. One call site, five
generators. The volume multiplier path stays (energy/density still shape level).

### 4. Composer emits orchestration (`server/services/composer.ts`)

Each section already knows its character; encode it explicitly instead of via density:
- `intro`: chord+melody+bass support, drums **out**, melody/chord can **lead**.
- `verse`: full band, melody/vocal **lead**, others **support**.
- `build`: everyone **support** rising; drums building.
- `drop`/`drop2`: full band, drums+bass **lead**.
- `breakdown`: drums **out**, one instrument **lead**, rest sparse/**support**.
Default-fill any section the LLM/template omits so a plan ALWAYS has orchestration.

### 5. Conducting on by default (`OrganismProvider`)

`songModeEnabled` default `true` (was `false`, `OrganismProvider.tsx:337`), and the
quickStart path composes + loads a plan on start. Provide the toggle still (jam mode =
plan off), but the band conducts itself out of the box. Guest/demo path included.

## Architecture / isolation

- The role→level math lives in ONE pure helper, `roleCeiling(role)`, in a new
  `client/src/organism/generators/arrangementRole.ts` (pure, unit-tested), used
  identically by every generator so behavior can't drift between instruments.
- `SectionOrchestration` lives in `shared/arrangement.ts` next to the section it
  belongs to (server composer + client generators both import it).
- This SUBORDINATES the reactive system rather than deleting it: jam mode (no plan)
  is unchanged; the reactive curve still provides feel under the role ceiling.

## What this does NOT do (out of scope — next consolidation)

- No bar-by-bar call-and-response / space-trading between instruments (Approach B).
- Does not touch the melody/loop-player triple (separate consolidation).
- Does not unify the mix-path doubles (channel strips vs multipliers — separate).
- Does not collapse the mode/Director/style authorities (separate).

These are tracked as the remaining "competing systems" — this spec fixes the ONE that
produces "everyone in their own direction."

## Error handling

- Section with no `orchestration` → every role defaults to `'support'` (today's feel,
  minus the full-time-everyone problem only where the composer sets `out`/`lead`).
- Unknown role string → treated as `'support'` (never throws).
- No plan loaded → `setRole` never called; generators keep default `'support'`; jam
  mode behaves as before.
- Conducting-on-by-default must not regress the guest demo: if compose fails
  (`composeForPreset` rejects), fall back to jam mode silently (one log line).

## Testing

- `arrangementRole.roleCeiling`: `out`→0, `support`→0.6, `lead`→1.0 (pure unit test).
- `validateArrangementPlan` accepts plans with and without `orchestration`.
- Generator: with role `'out'`, `computeTargetLevel` returns 0 regardless of OState;
  with `'lead'` it returns the full reactive value; with `'support'` the scaled value.
- Composer (server): every emitted section has a full `orchestration` (no missing
  instruments); intro has `drums: 'out'`, drop has `drums:'lead'`+`bass:'lead'`.
- Orchestrator: on section entry, each generator's role matches the section directive.
- Full suite stays green (`npm run test:unit`), `npm run check` clean.
- By-ear: start the Organism (conducting now default). Intro should have NO drums;
  the drop should hit full; verse should feel like melody leading over a support bed;
  breakdown should strip back. The band should sound ARRANGED, not five reactors.
