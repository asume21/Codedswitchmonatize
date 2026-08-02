# Audio Runtime Ownership & Lifecycle Audit

Scope: live `AudioContext`, `Tone.Transport`, Organism generator, piano-roll, and global-stop paths. Findings are ranked by user-visible impact. No application code was changed for this audit.

## Findings

1. **Pause is synchronously overwritten by the global Stop-All listener**

   - **Files + line numbers:** `client/src/contexts/TransportContext.tsx:250-258`, `client/src/contexts/TransportContext.tsx:291-300`, `client/src/stores/useStudioStore.ts:248-258`, `client/src/App.tsx:236-242`
   - **Which one wins at runtime, and the precise mechanism that decides:** `TransportProvider` is mounted around the full app. Its `pause()` calls `storePause()` and `Tone.getTransport().pause()`, then dispatches `globalAudio:stopAll`. `dispatchEvent()` invokes listeners synchronously; the same provider has registered `syncStoppedState` for that event. Before `pause()` returns, that listener calls `storeStop()` and stops both schedulers. `storeStop()` wins over `storePause()` because it runs second and resets `position` to zero (or the enabled loop start).
   - **Observable symptom:** Clicking Pause does not preserve the current playhead for a later resume. The UI and scheduler reset like Stop, so the next Play restarts at zero/loop start instead of resuming.
   - **Confidence: HIGH**

2. **Organism rebuild timers survive Stop and full generator disposal**

   - **Files + line numbers:** `client/src/organism/generators/GeneratorOrchestrator.ts:390-420`, `client/src/organism/generators/GeneratorOrchestrator.ts:564-603`, `client/src/organism/generators/GeneratorOrchestrator.ts:669-700`, `client/src/organism/generators/GeneratorOrchestrator.ts:748-785`, `client/src/features/organism/OrganismProvider.tsx:809-840`, `client/src/features/organism/OrganismProvider.tsx:1390-1427`, `client/src/organism/generators/BassGenerator.ts:374-405`, `client/src/organism/generators/MelodyGenerator.ts:756-790`, `client/src/organism/generators/ChordGenerator.ts:439-460`, `client/src/organism/generators/TextureGenerator.ts:403-419`
   - **Which one wins at runtime, and the precise mechanism that decides:** A state transition and `regenerateAll()` queue 50–280 ms `setTimeout` callbacks that call generator rebuild methods. Neither `stop()` nor `dispose()` retains or clears those timeout IDs. Stop resets the generators, and provider teardown disposes their Tone nodes, but an already-queued callback still runs afterward because it is in the JavaScript timer queue. The callback has no disposed/running guard; the generators remain enabled and their transition methods rebuild Tone parts or restart texture sources.
   - **Observable symptom:** Stopping immediately after an Organism transition, or unmounting while one is pending, can recreate generator work after the user stopped. With a studio-owned transport already running this can produce unintended Organism notes/texture; otherwise it leaves newly rebuilt parts behind for a later play, creating ghost playback and avoidable scheduler work.
   - **Confidence: HIGH**

3. **Audio-context recovery swaps out the live Tone clock without rebuilding its graph**

   - **Files + line numbers:** `client/src/lib/audioContext.ts:31-85`, `client/src/lib/audioContext.ts:99-171`, `client/src/lib/audioContext.ts:173-190`, `client/src/lib/audioContext.ts:192-239`
   - **Which one wins at runtime, and the precise mechanism that decides:** `getAudioContext()` installs `sharedContext` as Tone's context. After `contextResumeAttempts` reaches three, `resumeAudioContext()` closes that same live context, sets `sharedContext = null`, and calls `getAudioContext()` to install a new Tone context. The new context becomes the singleton returned to future callers, but existing Tone nodes/gains/parts remain attached to the closed old context; none are rebuilt or migrated. `startAudioHealthMonitor()` also starts an interval per context without keeping a handle, so the old monitor continues polling the closed context after each recovery.
   - **Observable symptom:** After repeated resume failures, the transport can appear running on the new shared context while the already-created Organism/studio graph is silent until a full graph reinitialization. Repeated recoveries also leave extra 500 ms health-monitor intervals running against closed contexts.
   - **Confidence: HIGH**

## Checked and deliberately not reported

- `client/src/lib/websenseBridge.ts` now calls `peekAudioContext()` rather than creating or initializing a context during telemetry capture; this no longer conflicts with the shared-context invariant.
- The only live `AudioContext` construction found is the shared factory in `client/src/lib/audioContext.ts`. The other matches are `OfflineAudioContext` instances used for rendering/export, not competing live playback clocks.
- `TransportContext` now listens for `globalAudio:stopAll` and stops its RAF, piano-roll scheduler, and arrangement scheduler. That closes the previously possible direct Kill-All UI/state desynchronization. The remaining problem is that `pause()` sends that full-stop event itself.
