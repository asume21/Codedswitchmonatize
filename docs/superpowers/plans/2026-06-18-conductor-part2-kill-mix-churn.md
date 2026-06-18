# Conductor Part 2 — Kill the Mix Churn (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Stop the per-frame volume churn so the Organism plays a steady, already-mastered bed. The MixEngine (with its existing limiter) becomes the sole mix authority; the three reactive volume "meddlers" are removed.

**Architecture:** Generators output at a fixed base level → `MixEngine` channel strips (tuned `DEFAULT_MIX_CONFIG`) → master limiter → destination. Section dynamics keep coming from Part 1's `applyArrangementMultiplier` (conducted, on bar boundaries). No new limiter, no new mix type. Self-listen analyzer kept as read-only ears.

**Tech Stack:** TypeScript, Tone.js, Vitest. All changes in `client/src/organism/`.

**Spec:** `docs/superpowers/specs/2026-06-18-conductor-directs-the-band.md` (Part 2).

---

## Files

- Modify: `client/src/organism/generators/GeneratorOrchestrator.ts` — remove the three volume-writing reactive paths + orphaned fields; simplify setters.
- Modify: `client/src/organism/reactive/ReactiveBehaviorEngine.ts:171-175` — stop calling `applyReactiveMultipliers`.
- Modify: `client/src/organism/reactive/__tests__/ReactiveBehaviorEngine.test.ts` — drop the `applyReactiveMultipliers` expectations.
- Modify: `client/src/features/organism/OrganismProvider.tsx:450-459` — keep the self-listen report broadcast; the orchestrator call becomes read-only (no code change needed if Task 2 makes `applySelfListenReport` a no-op writer, but keep the broadcast).
- Test: `client/src/organism/generators/__tests__/GeneratorOrchestrator.mixchurn.test.ts` (new).

---

## Pass A — Stop the churn (fast, audible win)

### Task 1: Failing test — reactive methods must NOT change generator volume

**Files:**
- Test: `client/src/organism/generators/__tests__/GeneratorOrchestrator.mixchurn.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { GeneratorOrchestrator } from '../GeneratorOrchestrator'

// Spy helper: capture applyVolumeMultiplier calls on every generator.
function spyVolume(orch: any) {
  const spies: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const gen of ['drum', 'bass', 'melody', 'texture', 'chord']) {
    const s = vi.fn()
    orch[gen].applyVolumeMultiplier = s
    spies[gen] = s
  }
  return spies
}

describe('GeneratorOrchestrator — no per-frame volume writes', () => {
  it('applyReactiveMultipliers does not move any generator volume', () => {
    const orch = new GeneratorOrchestrator()
    const spies = spyVolume(orch)
    orch.applyReactiveMultipliers({ bassVolumeMultiplier: 0.5, melodyVolumeMultiplier: 1.4 })
    expect(spies.bass).not.toHaveBeenCalled()
    expect(spies.melody).not.toHaveBeenCalled()
    expect(spies.texture).not.toHaveBeenCalled()
  })

  it('applySelfListenReport does not move any generator volume', () => {
    const orch = new GeneratorOrchestrator()
    const spies = spyVolume(orch)
    orch.applySelfListenReport({
      isSilent: false, needsVolumeReduction: true, needsVolumeBoost: false,
      clippingPercent: 1, rmsDb: -10, spectralCentroidHz: 800, hasDcOffset: false, dcOffset: 0,
      bandEnergy: { sub: 0.4, bass: 0.4, lowMid: 0.3, highMid: 0.2, high: 0.1 },
    } as any)
    expect(spies.bass).not.toHaveBeenCalled()
    expect(spies.melody).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run, verify it FAILS**

Run: `npx vitest run client/src/organism/generators/__tests__/GeneratorOrchestrator.mixchurn.test.ts`
Expected: FAIL — both methods currently call `applyVolumeMultiplier`.

### Task 2: Make the three reactive methods stop writing volume

**Files:**
- Modify: `client/src/organism/generators/GeneratorOrchestrator.ts`

- [ ] **Step 1: `applyReactiveMultipliers` (~:721-750) — drop volume entirely.** Keep only the drum hat/kick performance writes if desired, but for the steady bed make it a no-op:

```ts
// Replace the whole method body with:
applyReactiveMultipliers(_output: {
  hatDensityMultiplier?: number
  kickVelocityMultiplier?: number
  bassVolumeMultiplier?: number
  melodyPitchOffsetSemitones?: number
  melodyVolumeMultiplier?: number
  textureVolumeMultiplier?: number
}): void {
  // Part 2: the live mix is owned by MixEngine (mastered, with limiter).
  // The per-frame reactive volume path is removed — it fought the channel
  // strips and oscillated ("everyone in their own direction"). No-op.
}
```

- [ ] **Step 2: `applySelfListenReport` (~:614-681) — keep clip logging, remove all volume/multiplier mutation.** Remove the `selfListenGainCorrection` block (~621-632), the `reactive*Multiplier` band-balancing (~642-668), and the trailing `this.drum.setHatDensityMultiplier(...)`/`setKickVelocityMultiplier(...)` that depend on them. Keep the early `if (report.isSilent) return` and the dev-only frequency-balance `console.debug` diagnostics. Net: the analyzer/report still flows (broadcast happens in the provider), but nothing touches audio.

- [ ] **Step 3: `applyPerformerState` (~:556-608) — remove the volume writes.** Delete the melody volume write (`melodyTarget` → `this.melody.applyVolumeMultiplier(melodyTarget)`, ~586-593) and the breathing texture writes (`this.texture.applyVolumeMultiplier(...)`, ~595-602). Keep kick-velocity and hat-density performance shaping (those are playing, not mixing) — but they must no longer reference reactive volume fields (see Pass B).

- [ ] **Step 4: Run the new test — verify PASS**

Run: `npx vitest run client/src/organism/generators/__tests__/GeneratorOrchestrator.mixchurn.test.ts`
Expected: PASS.

### Task 3: Stop ReactiveBehaviorEngine from driving volume

**Files:**
- Modify: `client/src/organism/reactive/ReactiveBehaviorEngine.ts:171-175`
- Modify: `client/src/organism/reactive/__tests__/ReactiveBehaviorEngine.test.ts`

- [ ] **Step 1: `applyToOrchestrator` — remove the call.** Replace the body so it no longer calls `this.orchestrator.applyReactiveMultipliers(output)`. If `output` carries non-volume behavior still wanted, route only that; otherwise make `applyToOrchestrator` a no-op and add a comment pointing to this plan.

- [ ] **Step 2: Update the engine test** — remove/adjust the `expect(orch.applyReactiveMultipliers).toHaveBeenCalled()` assertions (lines ~74, 100, 106, 118, 125) to reflect that volume is no longer driven here.

- [ ] **Step 3: Run the reactive suite — verify PASS**

Run: `npx vitest run client/src/organism/reactive`
Expected: PASS.

### Task 4: Full suite + typecheck, then commit Pass A

- [ ] **Step 1:** `npx vitest run` → all green.
- [ ] **Step 2:** `npx tsc --noEmit` → clean (Pass A leaves the now-unused reactive fields in place; that's fine until Pass B).
- [ ] **Step 3: Commit**

```bash
git add client/src/organism
git commit -m "fix(organism): stop per-frame volume churn — MixEngine owns the mix (Part 2A)"
```

- [ ] **Step 4: By-ear acceptance (the real test).** Play lo-fi; over 60+ s no instrument self-swells/ducks; the mix sits where MixEngine puts it. Swap presets; balance applies once and holds.

---

## Pass B — Remove the corpses (true deletion, no gating)

### Task 5: Delete the orphaned reactive volume state and simplify setters

**Files:**
- Modify: `client/src/organism/generators/GeneratorOrchestrator.ts`

- [ ] **Step 1: Delete fields (~:65-74)** — `reactiveHatDensityMultiplier`, `reactiveKickVelocityMultiplier`, `reactiveBassVolumeMultiplier`, `reactiveMelodyVolumeMultiplier`, `reactiveTextureVolumeMultiplier`, `selfListenGainCorrection`.

- [ ] **Step 2: Simplify the volume setters (~:685-719)** so they no longer multiply by the deleted fields. Example:

```ts
setBassVolumeMultiplier(multiplier: number): void {
  this.bassVolumeMultiplier = Math.max(0, multiplier)
  this.bass.applyVolumeMultiplier(this.bassVolumeMultiplier)
}
setMelodyVolumeMultiplier(multiplier: number): void {
  this.melodyVolumeMultiplier = Math.max(0, multiplier)
  this.melody.applyVolumeMultiplier(this.melodyVolumeMultiplier)
}
setTextureVolumeMultiplier(multiplier: number): void {
  this.textureVolumeMultiplier = Math.max(0, multiplier)
  this.texture.applyVolumeMultiplier(this.textureEnabled ? this.textureVolumeMultiplier : 0)
}
```

- [ ] **Step 3: Fix the drum hat/kick setters (~:685-693)** so `setHatDensityMultiplier`/`setKickVelocityMultiplier` and the `applyPerformerState` kick/hat writes reference only `this.hatDensityMultiplier`/`this.kickVelocityMultiplier` (drop the deleted `reactive*` factors).

- [ ] **Step 4: `director.setSelfListenCorrection`** — if the Conductor/director had a `selfListenGainCorrection` consumer (was set at ~:632), remove that sync call and the unused director method if nothing else uses it. Grep first: `grep -rn setSelfListenCorrection client/src`.

- [ ] **Step 5:** `npx tsc --noEmit` → clean (this surfaces every remaining reference to the deleted fields — fix each).
- [ ] **Step 6:** `npx vitest run` → all green.
- [ ] **Step 7: Commit**

```bash
git add client/src/organism
git commit -m "refactor(organism): delete orphaned reactive volume fields (Part 2B)"
```

---

## Self-review notes

- **Spec coverage:** deletions (Task 2,3,5) cover the three meddlers + fields; self-listen kept read-only (Task 2 step 2 keeps report/diagnostics, removes writes); limiter untouched (already exists); section dynamics untouched (`applyArrangementMultiplier`, Part 1). ✓
- **No new types/limiter** — matches corrected spec. ✓
- **Risk:** drum kick/hat performance shaping is retained but de-coupled from reactive volume fields (Task 5 step 3) — verify by ear that drums still groove (note-level humanization is separate and untouched).
- **Out of scope (later):** richer Conductor→MixEngine channel automation; the intermittent hot-swap stacking; Part 3 duet.
