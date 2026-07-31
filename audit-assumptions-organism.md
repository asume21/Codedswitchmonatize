# Unverified-assumption audit — client/src/organism/**

Scope: `client/src/organism/**` (generators, conductor, mix, state, instruments, performers, loops,
freeplay). Read-only audit; no source files modified.

---

## 1. Chord volume is silently reset to 1.0 when Melody-Only mode is toggled off — the user's mixer setting is discarded

**File:line:** `client/src/organism/generators/GeneratorOrchestrator.ts:1097-1133` (`setMelodyOnly`), specifically line 1126 (`this.chord.applyVolumeMultiplier(1.0)`), vs. `setChordVolumeMultiplier` at line 1297-1299.

**The assumption:** That restoring "the chord's normal volume" after Melody-Only mode means `1.0`.

**Why it is not guaranteed:** Unlike melody/bass/texture, the orchestrator does NOT keep a
`chordVolumeMultiplier` field mirroring what the user set via `setChordVolumeMultiplier()`
(`GeneratorOrchestrator.ts:1297`, wired to the mixer's chord-volume slider at
`client/src/features/organism/OrganismProvider.tsx:2578-2579` and `:2764`). That call goes straight
through to `ChordGenerator.applyVolumeMultiplier`, which overwrites `ChordGenerator.volumeMultiplier`
(`ChordGenerator.ts:520-521`) — the orchestrator never remembers the value. When `setMelodyOnly(true)`
runs it forces `this.chord.applyVolumeMultiplier(0.5)` (line 1116), and when `setMelodyOnly(false)`
runs it "restores" with a hardcoded `1.0` (line 1126) — not whatever the user had dialed the chord
mixer slider to. Compare with melody, which is restored correctly via the orchestrator's own
`this.melodyVolumeMultiplier` field (line 1125), and bass, whose volume field is untouched by
Melody-Only in the first place. `ChordGenerator.volumeMultiplier` directly scales the audible comp
level (`ChordGenerator.ts:958`: `level * this.arrangementMultiplier * Math.min(2.0, this.volumeMultiplier)`),
so this is audible, not cosmetic.

**Observable symptom:** User pulls the chord/keys mixer fader down (e.g. to 0.3) to sit chords under
a vocal, then flips Melody-Only on and back off (a documented freestyle workflow —
`setMelodyOnly` is wired to a UI toggle at `OrganismProvider.tsx:3656` and to `astutelyOrganismBridge.ts:183`).
The chords jump back to full (1.0×) volume with no further action from the user — their mix choice is
silently lost until they touch the chord slider again.

**Confidence: HIGH** — traced the full call path from UI slider → orchestrator → generator, and
confirmed the generator has no other source of truth than the last `applyVolumeMultiplier` call.

---

## 2. Toggling Texture off then back on permanently silences the texture generator until the volume slider is touched again

**File:line:** `client/src/organism/generators/GeneratorOrchestrator.ts:1074-1080` (`setTextureEnabled`).

**The assumption:** That `this.texture.setEnabled(enabled)` alone is enough to bring the texture
generator back to audible when re-enabled — mirroring the intent of the sibling method
`setTextureVolumeMultiplier` (line 982-987), which correctly gates on `this.textureEnabled`.

**Why it is not guaranteed:**
```ts
setTextureEnabled(enabled: boolean): void {
  this.textureEnabled = enabled
  this.texture.setEnabled(enabled)
  if (!enabled) {
    this.texture.applyVolumeMultiplier(0)
  }
}
```
On disable, this zeroes `TextureGenerator.textureVolumeMultiplier` via `applyVolumeMultiplier(0)`
(`TextureGenerator.ts:467-476`), which directly scales `bedGain`/`padGain` (`TextureGenerator.ts:346`,
`:390`). On re-enable (`enabled === true`), nothing calls `applyVolumeMultiplier` again —
`TextureGenerator.setEnabled(true)` (`TextureGenerator.ts:312-318`) only flips the `enabled` flag and,
on the disable branch, ramps `this.gain` to 0; it does not restore any multiplier on enable. So
`TextureGenerator.textureVolumeMultiplier` stays permanently at `0` after the first disable, and
`processFrame` keeps computing `... * this.textureVolumeMultiplier` = 0 forever, even though
`this.enabled` is now `true` and the generator otherwise runs normally (loop players start, riser
bed schedules, etc.). This is the exact same bug class already fixed once in
`setTextureVolumeMultiplier` (which does check `this.textureEnabled`) but was not applied to this
sibling function.

**Observable symptom:** User disables the Texture/pads layer, then re-enables it (via the same toggle
or `set-texture-enabled` event handled in `OrganismProvider.tsx:2583`). The UI shows texture as "on,"
loop players and pad triggers fire, but no sound comes out — silent until the user separately drags
the texture volume slider (which calls `setTextureVolumeMultiplier` and finally restores the
multiplier).

**Confidence: HIGH** — read `setEnabled`, `applyVolumeMultiplier`, and `processFrame` in
`TextureGenerator.ts` in full; confirmed no other code path re-primes `textureVolumeMultiplier` after
a disable/enable cycle.

---

## 3. `savedDrumMult` / `savedBassMult` imply a save-and-restore contract that is never read back

**File:line:** `client/src/organism/generators/GeneratorOrchestrator.ts:1094-1095, 1102-1103`

**The assumption:** The field names and the comment "Save current multipliers so we can restore them
later" (line 1101) imply `setMelodyOnly(false)` restores drum/bass volume from these saved values.

**Why it is not guaranteed:** `savedDrumMult` and `savedBassMult` are written in the `enabled===true`
branch (lines 1102-1103) and never read anywhere else in the file (verified via full-file grep — no
other reference exists). The actual mute/restore for drum and bass during Melody-Only mode is done
entirely through `applyArrangementMultiplier(0)` / `applyArrangementMultiplier(1.0)`, a completely
separate gain-multiplier chain from `applyVolumeMultiplier`. It happens that this doesn't currently
cause an audible bug, because Melody-Only mode never calls `bass.applyVolumeMultiplier` or
`drum`'s equivalent — but the fields are dead weight that assert a guarantee ("your volume mult will
be restored") that no code path honors. If a future change starts muting drum/bass via their volume
multiplier during Melody-Only (as texture and chord already are), it would inherit this same silent
non-restoration bug.

**Observable symptom:** None today (dead code) — flagged because the naming asserts a contract the
code doesn't fulfill, which is exactly the shape that produced findings #1 and #2 above.

**Confidence: MEDIUM** — confirmed via grep that the fields are never read; did not find any current
runtime path where their absence causes an audible symptom.

---

## Checked and found sound (do not re-audit these)

- **`DrumGenerator.rebuildPart` loop-mode guard** (`DrumGenerator.ts:496-505`): the comment "Loop mode
  owns this row: NEVER build the live part here" IS enforced — `rebuildPart` early-returns via
  `stopPart()` when `this._loopMode` is true.
- **`GeneratorOrchestrator.arrangementEnabled` must start `false`** (`GeneratorOrchestrator.ts:159`,
  `start():510`): verified `setArrangementEnabled(true)` is the only path that flips the flag and it
  forwards to `MusicalDirector`; the field is not set to `true` anywhere else (including no stray
  default in a subclass or React effect that races `start()`).
- **`GeneratorBase.loopGainTarget()` "single source of truth"** (`GeneratorBase.ts:170-174`): confirmed
  `arrangementMultiplier * _loopVolumeGate`, gated by `loopMuted`, is the only place loop gain is
  computed from these three inputs — no other function in `GeneratorBase.ts` bypasses it to write
  loop gain directly.
- **`BassImproviser.ts` chord-third fix**: `const third = ctx.chordIntervals.includes(4) &&
  !ctx.chordIntervals.includes(3) ? 4 : 3` (line 107) correctly derives the real chord third instead
  of the previous hardcoded `5` — verified this value is what's actually used in both the walking
  contour (`hitContour`, line 117) and the harmony-change walk (line 199), not a stale/unused
  variable.
- **`BassGenerator` / `ChordGenerator` gain chains**: both compute final level as
  `level * arrangementMultiplier * volumeMultiplier` consistently (`BassGenerator.ts:901`,
  `ChordGenerator.ts:958`) — no divergent gain path found in either file.
