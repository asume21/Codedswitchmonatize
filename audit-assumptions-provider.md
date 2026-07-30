# Unverified-Assumption Audit — OrganismProvider / lib / contexts lane

Scope: `client/src/features/organism/**`, `client/src/lib/**`, `client/src/contexts/**`.
Read-only. Method: read the actual code paths, not just comments; only report what I could
directly verify by tracing calls.

---

## Finding 1 — `set-generator-volume` (texture/chord) bypasses the exact state the
already-fixed texture-solo bug depends on — the bug recurs through an unpatched channel

**File:line**: `client/src/features/organism/OrganismProvider.tsx:2559-2581` (command handler),
compared against `OrganismProvider.tsx:1231-1249` (`applyStablePlaybackDefaults`) and
`OrganismProvider.tsx:3648-3653` (`setTextureVolume`, the "correct" path).

**The assumption**: `applyStablePlaybackDefaults()` — called at 5 sites (silent-start recovery
line 1220, `quickStart` line 1673, `swapPreset` line 1807, `start()` line 1342, and
recording-lock-engaged line 3209) — trusts `textureVolumeRef.current` to be the live, current
texture volume:
```ts
orchestr.setTextureVolumeMultiplier(textureEnabledRef.current ? textureVolumeRef.current : 0)
```
The comment directly above this line documents that this exact line was already patched once
(the Solo-then-preset-swap bug: "two independent answers to 'should texture be heard'"). The
fix assumes `textureVolumeRef` is always kept in sync with whatever last set the audible
texture volume.

**Why it is not guaranteed**: `textureVolumeRef.current` is written in exactly ONE place —
`setTextureVolume()` (line 3648-3653), the function exposed to `OrganismCommandCenter`'s UI
slider/solo logic. But there is a second, live, AI-driven write path that sets the engine's
texture (and chord) volume WITHOUT touching that ref or the React state:

```ts
// line 2559-2581, handleCommand('set-generator-volume')
} else if (generator === 'texture') {
  orch.setTextureVolumeMultiplier(v)          // engine updated
  // — no setTextureVolumeState(v), no textureVolumeRef.current = v —
} else if (generator === 'chord') {
  orch.setChordVolumeMultiplier(v)            // engine updated
  // — no setChordVolumeState(v), no mixRef.setChannelGainDb('chord', …) —
}
```
This handler is reachable from `client/src/lib/astutelyOrganismBridge.ts:175-176`
(`setGeneratorVolume(generator, volume)` → `this.dispatch('set-generator-volume', …)`), i.e.
the Astutely AI brain can — and by design does — turn texture down/up as part of its mix
decisions, live, mid-session.

The same bypass exists in the voice/warmup path at `OrganismProvider.tsx:2757-2764`
(`mood.instrumentFocus`), which also calls `orch.setTextureVolumeMultiplier(focus.texture)`
and `orch.setChordVolumeMultiplier(focus.chord)` directly, for the same reason.

**Observable symptom**: Astutely (or a warmup voice phrase) turns texture down to 0 for a
mix reason. `textureVolumeRef.current` stays at its last UI-set value (default 1.0). The very
next preset swap, silent-start recovery, or "Record" press — any of the 5
`applyStablePlaybackDefaults()` call sites — resurrects the pad/texture layer back to full
volume, silently undoing the AI's mix decision, with the UI showing no change at all (no
state setter ran, so the texture slider/toggle never updated either way). This is the same
audible symptom as the already-fixed bug ("phantom instrument reappears"), just triggered
through the AI-brain/voice channel instead of the Solo button.

**Confidence: HIGH** — traced both the write site and the stale-read site; confirmed the
bridge caller exists and is wired into a live AI feature, not dead code.

---

## Finding 2 — Chord volume is two disjoint mechanisms that nothing reconciles

**File:line**: `OrganismProvider.tsx:3643-3646` (`setChordVolume`, the UI/slider path) vs.
`OrganismProvider.tsx:2578-2579` / `2764` (`orch.setChordVolumeMultiplier`, the AI/voice path).

**The assumption**: implicit — that "chord volume" is one number the UI, AI, and voice
commands all agree on.

**Why it is not guaranteed**: `setChordVolume()` (the function actually exposed on the
context and driven by the mixer UI / Solo) only ever writes the MIX CHANNEL gain:
```ts
setChordVolume: (v: number) => {
  setChordVolumeState(v)
  mixRef.current?.setChannelGainDb('chord', CHORD_BASE_DB + 20 * Math.log10(...))
  orchestrRef.current?.setChordEnabled(v > 0)
}
```
It never calls `orch.setChordVolumeMultiplier(...)`. Conversely, the AI/voice paths
(`set-generator-volume`, `mood-signal.warmup`) only ever call
`orch.setChordVolumeMultiplier(...)` and never touch the mix channel gain. There is no
`chordVolumeRef` anywhere in the file, so no code path reads back or reconciles the
orchestrator-internal multiplier against the channel-strip gain the user actually sees on
the fader. Unlike texture, this one isn't even resurrected/reset by
`applyStablePlaybackDefaults()` — once the AI/voice sets the orchestrator's chord multiplier
low, nothing in this file ever restores it, since the file has no concept that value exists.

**Observable symptom**: chord fader shows a normal level (e.g. 100%) and the mix channel gain
matches, but the chords are quiet or absent because the orchestrator-internal multiplier was
left at a low value by an earlier AI/voice adjustment — moving the chord slider only ever
changes the channel gain, never that multiplier, so the user cannot fix it from the UI at all
short of a full stop/restart (which resets the orchestrator instance).

**Confidence: MEDIUM** — fully verified within this lane (both write sites, no reconciling
read). What I could not verify (out of lane): whether `GeneratorOrchestrator`/`ChordGenerator`
itself resets the internal multiplier to a default on `start()`/subgenre swap, which would
mask the symptom in the common case (fresh preset) but not on a hot `swapPreset` mid-session.

---

## Finding 3 — `getSharedMasterBus()`'s "must be called after `getAudioContext()`" invariant is unenforced, and the caller its own module doc promises no longer exists

**File:line**: `client/src/lib/sharedMasterBus.ts:131-139` vs. `client/src/lib/audioContext.ts:1-4`.

**The assumption**: `sharedMasterBus.ts` states:
```
* MUST be called only after `getAudioContext()` has been invoked at least
* once — Tone.js needs its context configured before we build Tone nodes.
```
and `installSharedMasterBus()`'s own doc comment says it's "called from `getAudioContext()`
right after `Tone.setContext`."

**Why it is not guaranteed**: `getAudioContext()` (`audioContext.ts:31-86`) does not call
`installSharedMasterBus()` or `getSharedMasterBus()` anywhere in its body. Its file-top comment
even says so explicitly: "SharedMasterBus is intentionally NOT installed at boot... bypassed in
the audio path right now." A repo-wide search inside `client/src` found zero other callers of
`getSharedMasterBus`/`installSharedMasterBus` at all. Nothing currently enforces the ordering
constraint the comment describes, because nothing currently calls the function it's attached
to — but the comment is a live trap for the next person who wires it in following the doc's
own instructions, since the doc names an integration point (`getAudioContext()`) that no
longer calls it.

**Observable symptom**: none today (dead code path). If a future feature calls
`getSharedMasterBus()` directly (as the doc invites) before any `getAudioContext()` call has
happened on that page, `new Tone.Gain(...)` etc. constructs against whatever context Tone
defaulted to at import time, not the shared 'playback'-latency context — silently reintroducing
the dual-audio-thread crackle problem `getAudioContext()`'s own comments describe fixing.

**Confidence: MEDIUM** — confirmed via grep that no caller exists in `client/src`; did not
check `server/` (irrelevant, client-only module) or whether a caller was recently deleted.

---

## Checked and found sound

- `TransportContext.tsx:279-301` — the exact "kill switch stops Transport without telling
  TransportContext" scenario described in the task brief as a past bug is now guarded: a
  `globalAudio:stopAll` listener (added specifically for this) syncs `storeStop()` /
  scheduler stop whenever `killAllAudio()` fires from any entry point (nav button, Ctrl+Shift+K,
  or `TransportContext.stop()` itself). Verified the listener is registered on mount and the
  event is dispatched from `globalAudioKillSwitch.ts:128-129`.
- `client/src/lib/audioContext.ts:16-29` (`peekAudioContext`) — the passive/non-creating read
  the file's own comment contrasts against `getAudioContext()`'s side effect. Verified it truly
  only returns the module-level `sharedContext` variable with no construction.
- `MELODY_BASE_DB` / `CHORD_BASE_DB` derivation (`OrganismProvider.tsx:34-39`) — comment
  documents a prior "hardcoded constant silently overrode DEFAULT_MIX_CONFIG" bug; verified the
  current code derives both constants from `DEFAULT_MIX_CONFIG.channels.*.gainDb` rather than
  retyping them, so that specific drift can't recur.
- `handleSolo()` in `OrganismCommandCenter.tsx:427-454` — uses the canonical `setTextureVolume`/
  `setBassVolume`/etc. setters (not raw orchestrator calls), so it correctly keeps
  `textureVolumeRef` in sync; Finding 1 is a different, still-open channel, not this one.
- `applyStablePlaybackDefaults()`'s arrangement-enabled write (`orchestr.setArrangementEnabled
  (songModeEnabledRef.current)`) — verified `songModeEnabledRef.current` IS kept in sync, via
  the single write site `setSongModeEnabled()` (`OrganismProvider.tsx:3685-3688`); no second
  bypass path was found for song-mode the way one exists for texture/chord volume.
