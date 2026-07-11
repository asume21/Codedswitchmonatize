# UI Inventory — CodedSwitch Studio

Design-handoff document. Exhaustive listing of every screen/surface, grouped
by area. For each page/component: file path, route, purpose, and every
interactive control with its label, default/options, and the state it
reads/writes.

**Status: COMPLETE** — consolidated from the prior research passes into the repo copy.

## Table of Contents

- [Organism](#organism)
- [Recording Booth](#recording-booth)
- [Lyric Video](#lyric-video)
- [MIX Surface](#mix-surface)
- [AI / Effects](#ai--effects)
- [DAW Panels — Group A](#daw-panels--group-a)
- [DAW Panels — Group B](#daw-panels--group-b)
- [Auth / Dashboard / Billing / Settings](#auth--dashboard--billing--settings)
- [Social Hub / Utility](#social-hub--utility)

---

## Organism

### client/src/features/organism/GlobalOrganismWrapper.tsx

**Route:** global — mounted around the entire routing tree in `App.tsx` (`<GlobalOrganismWrapper>...</GlobalOrganismWrapper>` wraps everything, line 220–372).

**Purpose:** Lazily boots the heavy `OrganismProvider` (Tone.js + generator engines, ~300KB+) only once `activate()` is called, so landing/login/signup never download the audio engine. Exposes `useOrganismActivation()` (isActivated/activate) and `useOrganismSafe()` (nullable context read) to the rest of the app. Also mounts `OrganismDebugOverlay` once activated.

**Full control inventory:** This file renders no interactive controls itself — it is a provider/activation shell (Suspense + Context.Provider). No buttons, inputs, or toggles appear in its JSX.

### client/src/features/organism/InputSourceSelector.tsx

**Route:** Not directly routed; rendered as a child inside `OrganismCommandCenter` (`<InputSourceSelector current={inputSource} onChange={setInputSource} disabled={isRunning||isStarting} autoEnergy={autoEnergy} onAutoEnergyChange={setAutoEnergy} />`, OrganismCommandCenter.tsx line ~2223), which itself is reachable at `/organism` (via OrganismGuestPage) and inside MAKE surface (MakeSurface.tsx).

**Purpose:** Lets the user pick which live input feeds the Organism (mic / MIDI / audio file / auto-generate) and, when Auto is selected, its target energy level.

**Full control inventory:**
- 4 source buttons in a 2x2 grid, each icon + label, reading `current` (`InputSourceType` from `useOrganism()` via parent) and calling `onChange`:
  - "🎤 Mic" (value `mic`) — tooltip "Speak, rap, freestyle — the organism reacts to your voice"
  - "🎹 MIDI" (value `midi`) — tooltip "Play keys or pads — velocity & notes drive the organism"
  - "📁 Audio File" (value `audioFile`) — tooltip "Drop in a beat, vocal, or loop — the organism reacts to it"; clicking opens the hidden file input
  - "🤖 Auto" (value `autoGenerate`) — tooltip "Creates a beat on its own — no mic needed"
  - All disabled when `disabled` prop is true (bound to `isRunning || isStarting` in the parent)
- Hidden file input (`type="file"`, `accept="audio/*"`) — triggered via ref by the Audio File button; on change calls `onChange('audioFile', file)` and resets value. Local state: `selectedFile` (`useState<File|null>(null)`).
- File name display (read-only text, not a control) shown only when `current === 'audioFile'` and a file is selected.
- 3 energy buttons (only visible when `current === 'autoGenerate'`): "Chill" (`#60a5fa`), "Medium" (`#fbbf24`), "Intense" (`#ef4444`) — default `autoEnergy` prop default is `'medium'`; reads/writes via `autoEnergy` prop / `onAutoEnergyChange` callback (backed by `setAutoEnergy` in OrganismContext).
- Description text line (read-only) showing the selected source's `desc`.

### client/src/features/organism/OrganismCommandCenter.tsx

**Route:** `/organism` (via `OrganismGuestPage`), and also mounted inside MAKE surface at `client/src/components/studio/surfaces/MakeSurface.tsx:140` (`<OrganismCommandCenter />`), i.e. inside the studio workspace's MAKE tab. This is the canonical, single Organism control surface reused in both places.

**Purpose:** The full Organism control panel — style/preset picker, live vibe/voice command bar, beat-shape sliders, playing-style (chord technique/articulation) pickers, feature toggles, instrument assignment + volumes, multi-take recorder ("Build a Track"), report card, and session sharing. Reads/writes almost entirely through `useOrganism()` / `useOrganismPhysics()` from `OrganismContext`.

**Full control inventory** (in JSX order):

*Header bar:*
- "START ENGINE" / "STOP" button — toggles `start()`/`stop()`; disabled while `startLocked` (`isStarting || countingIn`); label shows "STARTING..." while `isStarting`.
- Vibe/voice text input (placeholder: `Try "play violin sad melody", "lo-fi piano chill", or "dark drill vibe"...`) — on Enter, runs `triggerDetectorRef.current.processText(text)` then `interpretVibe(text)`; clears itself.
- 4 quick-vibe suggestion buttons: "+ Bad Day" ("I'm having a bad day, play something moody"), "+ Hype Me Up" ("Give me something high energy and aggressive"), "+ Lofi Chill" ("Lo-fi chill piano beat for late night"), "+ Sad Violin" ("Play violin, slow and sad melody") — each calls `interpretVibe(text)` directly.

*Live Generator panel:*
- "Generator Master" slider — `SliderRow`, range 0.35–2.5 step 0.05, reads/writes local state `v2Gain` (default 1.45), calls `setV2MasterGain` via `handleV2Gain`.
- Playback Mode 3-way segmented control: "Live Band" (`live`), "ACE Stems" (`ace`), "Layered" (`both`) — reads `aceHybridMode`, writes via `setAceHybridMode`.

*Top status row:*
- Record button ("REC"/"⏺ REC" — text shows "REC" both states) — toggles `startRecording()`/`stopRecording()` based on `isRecording`.
- "Render Track" button — states: idle "Render Track", booting "⏳ Waking GPU…", generating "🎵 Rendering…", done "✓ Download", error "↺ Retry" — calls `handleRender()`; disabled while booting/generating. Backed by local state machine `renderState`.
- Live/Rendered reference toggle (2 buttons, shown only once `renderAudioUrl` exists): "Live Organism" / "Rendered Ref" — writes local `referenceMode`.
- Rendered-audio `<audio controls>` player + "↓ WAV" download link + "×" dismiss button (clears all render state).

*Voice command ("Vibe Command") row:*
- 🎤 round mic button — toggles browser SpeechRecognition via `toggleListening`; disabled if `!hasSpeechRecognition` (tooltip "Speech recognition requires Chrome"); local state `isListening`.
- "✕ Clear" small button — clears `vibeText`/`vibeStatus` (shown only when text present and not listening/interpreting).

*Style picker:*
- "🖐 5 FINGERS" / "■ STOP" button (shown only while `isRunning`) — starts/stops "Five Fingers of Death" preset-cycling demo (`startFfod`/`stopFfod`); disabled while `isStarting`.
- Preset grid (3-col, one button per entry in `quickStartPresets` from context) — each shows icon/label/BPM, calls `swapPreset(preset.id)`; disabled while `isStarting`. Hidden during count-in.
- Count-in visual (4 numbered circles 1–4, read-only, highlights `countInBeat`).
- (Cold-start only, `!isRunning`):
  - "Preset:" `<select>` — options = all `quickStartPresets` (icon + label + BPM); local state `triggerPresetId`, default = first preset's id.
  - "🎙 Count-In Start" button — calls `countInStart(triggerPresetId)`; label switches to "Listening… beat N" while counting in; disabled while `startLocked`.
  - "🎯 Sound Trigger" button — toggles `armSoundTrigger(triggerPresetId)` / `disarmSoundTrigger()`; label "Armed — make a sound!" when armed; disabled while `isStarting && !soundTriggerArmed`.

*Visualizer:* embeds `<OrganismVisualizer />` (documented separately below) — no additional controls here.

*"Organism Thinking" panel:*
- "CLEAR" button — calls `clearWowMomentLog()`.
- 3 read-only engine-active badges: Drums / Bass / Harmony (from `wowMoment.engines`), not interactive.
- Scrolling log pane (`wowMoment.logs`), read-only.

*Right column — pinned transport bar:*
- Flow meter (read-only, `FlowMeter` component, shows `flowDepth`).
- "▶ Start" / "⏹ Stop" button — same as header start/stop.
- "⏺ REC" button — same recording toggle as above.
- "💾" button — calls `capture()` (capture session DNA); tooltip "Capture session DNA".

*Drums section:*
- "FREEPLAY"/"MANUAL" pill toggle — `toggleDrumFreeplay`; tooltip "Drums improvise around the genre skeleton"; local state `drumFreeplay` (default `true`).
- "S" solo button for drums — `handleSolo('drums')`.
- "Hat density" slider (`SliderRow`, 0–2 step 0.05 default range, bound to `hatDensity`/`setHatDensity`).
- "Kick vel." slider (same range, `kickVelocity`/`setKickVelocity`).
- "Drums vol." slider (same range, `drumsVolume`/`setDrumsVolume`).

*Beat seed section:*
- Seed value display (read-only text, `beatSeed`).
- "🔒 PINNED" / "🔓 RANDOM" toggle button — `toggleSeedPin`; local state `seedPinned` (init from `isSeedPinned()`).
- Numeric-only text input (placeholder "enter a seed to replay a beat…") — local state `seedInput`; Enter key triggers `applySeedInput`.
- "SET" button — calls `applySeedInput()` (parses `seedInput`, calls `setFreeplaySeed(n)`); disabled when input empty.

*Mode + BPM section:*
- BPM number input (min 40, max 220) — local state `bpmInput`, defaults to displayed `currentBpm`; commits on blur or Enter via `commitBpm()` which calls `orchestrator.setBpm()` and `useStudioStore.setBpm()`.
- 5 mode buttons: "Heat" (`#f87171`), "Ice" (`#93c5fd`), "Smoke" (`#d1d5db`), "Gravel" (`#fbbf24`), "Glow" (`#6ee7b7`) — each calls `applyMode(key)` → `physicsEngine.lockMode(...)`.
- "Auto" button — `applyMode(null)` → `physicsEngine.unlockMode()`. Local state `lockedMode` (default `null`).

*Playing Style section:*
- "AUTO SHIFTS"/"MANUAL" pill toggle — `toggleStyleShifts`; local state `styleShifts` (default `true`); tooltip "Auto style-shifts — reactive engine adapts technique based on rapper energy".
- "Chords" `<select>` — local state `chordTech` (default `'freeplay'`); options: Freeplay (improvise), then optgroups Piano (Block Chord, Rolled Chord, Alberti 1-5-3-5, Sustained Pad), Guitar (Strum Down, Strum Up, Arpeggio Rolled, Muted Stab), Strings (Pizzicato, Legato, Tremolo, Staccato), Brass (Stab, Swell, Fanfare, Section Pad), Wind (Legato, Scalar Run, Staccato, Trill) — calls `applyChordTech(id)`.
- "AUTO" reset button next to Chords — `resetChordTech()` (calls `orchestrator.resetChordTechniqueOverride()`); disabled when already on freeplay.
- "Melody" `<select>` — local state `melodyArt` (default `'none'`); options: Straight, Legato Slur, Staccato Pop, Grace-Note Flick, Trill Ornament, Scoop Up, Fall Off, Double Tap, Octave Echo, Delayed Echo — calls `applyMelodyArt(id)`.
- "AUTO" reset button next to Melody — `resetMelodyArt()`.
- "Bass" `<select>` — local state `bassArt` (default `'freeplay'`); options: Freeplay (improvise), Straight, Slide-Up, Ghost Note, Octave Jump, Walking Step, Pickup, Muted Pulse, Octave Walk, Drop Slide, Dub Sustain — calls `applyBassArt(id)`.
- "AUTO" reset button next to Bass — `resetBassArt()`; disabled when on freeplay.

*Input source section:* embeds `<InputSourceSelector>` (documented above), plus:
- "MONITOR"/"ON" toggle button (Capture Monitor) — calls `handleMicMonitorToggle`; bound to `micMonitoringEnabled`/`setMicMonitoringEnabled`; disabled when `micMonitorBlocked` (running with non-mic input) or `isStarting`.

*Features section — 9 `PillToggle` pills:*
- "React to Voice" — `reactToVoiceEnabled`/`setReactToVoiceEnabled`.
- "Song Mode" — `songModeEnabled`/`setSongModeEnabled`.
- "Loops" (only shown if no active preset or preset has `loopPackId`) — `loopsModeEnabled`/`setLoopsModeEnabled`, with `loading={isLoopsLoading}`.
- "Cadence Lock" — `cadenceLockEnabled`/`setCadenceLockEnabled`.
- "Call + Response" — `callResponseEnabled`/`setCallResponseEnabled`.
- "Drop Detector" — `dropDetectorEnabled`/`setDropDetectorEnabled`.
- "Vibe Match" — `vibeMatchEnabled`/`setVibeMatchEnabled`.
- "Story Mode" — `isPatternLocked`/`toggleStoryMode`.
- "Melody Focus" — `melodyFocusEnabled`/`setMelodyFocusEnabled`.

*"Build a Track" (multi-take) section:*
- Text input (placeholder `e.g. "sad violin" or "upbeat guitar"`) — local state `takeLabel`; Enter triggers `handleRecordTake()` (if not recording).
- Bars `<select>` — local state `takeBars` (default 32); options: 4, 8, 16, 32, 64 bars.
- "Record N bars (Xs)" button / "Recording…" — calls `handleRecordTake()`; disabled while `isRecording`.
- "Stop Take" button (shown only while recording with a bars total) — calls `cancelTakeRecording()`.
- "Reset" button (shown only when takes exist) — `handleClearTakes()` (clears takes + unlocks chord progression).
- Per-take row (repeated for each item in `takes`): "↓ Beat" download link, "↓ Mic" download link (only if `vocalUrl` present), inline `<audio controls>` for beat, inline `<audio controls>` for vocal (if present), "+ DAW" button — calls `handleSendToArrangement(take)` (dispatches `organism:take-ready` CustomEvent).

*Instruments section — 3 `InstrumentSelect` blocks (Lead/Bass/Chords), each containing:*
- "S" solo button — `handleSolo('lead'|'bass'|'chord')`.
- Volume readout text (read-only, e.g. "1.00×").
- `<select>` — options "Off", "Auto", then all `INSTRUMENT_PERFORMERS` filtered by role — value derived from `volume===0 ? 'off' : (value ?? 'auto')`; writes via `onChange`/`onVolumeChange` → `setOrganismInstrument(role, id)` / `setMelodyVolume`/`setBassVolume`/`setChordVolume`.
- Volume slider (range 0–2 step 0.05) — same volume setters.

*Lyrics/Report/Share section:*
- Live lyrics pane (read-only, shown when `inputSource==='mic'` and `transcription.isSupported`).
- Report Card block (shown when `lastReport && !isRunning`):
  - "Refresh" button — calls `generateReport()`.
  - Grade/score/stats display (read-only).
- Share Session block (shown when `!isRunning && (lastSessionDNA || lastReport)`):
  - Caption `<textarea>` (placeholder "Describe your session… (optional)") — local state `shareCaption`.
  - "↑ Share to Feed" / "Sharing…" button — calls `handleShare()` → `shareSession(shareCaption)`; disabled while `isSharingSession`.
  - "Save →" link button — navigates to `/signup`.
  - "View in Social Hub →" link (after share confirmed) — navigates to `lastSharedPostUrl` or `/social-hub`.
- Last Session DNA read-only summary block (shown when no report but DNA exists).

*Guest nudge banner* (shown when `isGuestNudgeVisible`):
- "Sign Up Free" link button → `/signup`.
- "✕" dismiss button — `dismissGuestNudge()`.

*Nested component:* renders `<VoiceMonitorWindow open={micMonitoringEnabled} onClose={...} />` at the end (documented below).

### client/src/features/organism/OrganismDebugOverlay.tsx

**Route:** global — mounted inside `GlobalOrganismWrapper` once activated (`<OrganismProvider>{children}<OrganismDebugOverlay /></OrganismProvider>`), so it appears on every route once the Organism engine has been activated. Dev-only — returns `null` when `!import.meta.env.DEV`, so it never renders in production builds.

**Purpose:** Fixed bottom-left HUD showing live engine vitals (state, transport, presence/bounce, per-generator on/level/output) sourced from the `organism:debug` CustomEvent (~4Hz), for diagnosing silent-audio bugs.

**Full control inventory:**
- Click anywhere on the header row ("🩺 ORGANISM" title + ▾/▸ indicator) — toggles `open` state (`useState(true)`), collapsing/expanding the panel. This is the only interactive element; everything else in the body is read-only telemetry text (state, transport/bar, mode/subGenre, section, presence, bounce, voiceActive, flow/density, dest vol dB, and 5 generator rows: drum/bass/melody/chord/texture).

### client/src/features/organism/OrganismGuestPage.tsx

**Route:** `/organism` (public guest demo route, wired directly in `App.tsx` line 331: `<Route path="/organism"><OrganismGuestPage /></Route>`, lazy-loaded).

**Purpose:** Public unauthenticated landing surface for the Organism — activates the engine on mount, renders the full `OrganismCommandCenter`, and layers guest-only UI (trial banner, "talk to it" coaching modal, WOW console, lock overlay) on top when the user isn't authenticated.

**Full control inventory** (guest-only overlays; `OrganismCommandCenter`'s controls are documented in its own section above):

*GuestTrialBanner* (top banner, shown pre-auth):
- "Start Voice Trial" button (shown only if `!hasStarted`) — calls `startVoiceTrial()` (does `Tone.start()`, sets `inputSource` to `mic`, `micMonitoringEnabled=false`, flags a pending trial start); disabled while `startingVoice`; label "Starting" while pending.
- "Save Your Session" link button → `/signup`.
- Read-only countdown text: `${seconds}s free` / "Trial ended" (from `guestSecondsRemaining`/`isGuestLocked`).

*TalkToOrganismCoach* (centered modal, shown only pre-start and pre-lock):
- "Start Talking to It" / "Opening Mic" button — same `startVoiceTrial()` as above; disabled while `startingVoice || isStarting`.
- Read-only instructional text/steps ("1. Allow mic", "2. Say rhythm", "3. Watch logs") and mode/seconds status line.

*WowLiveConsole* (bottom-right console, desktop only — `isMobile` check hides it):
- "Stop" button (when `isRunning`) — `organism.stop()`.
- "Play" button (when not running) — `organism.quickStart(playPresetId)`; disabled if no preset id available.
- Mic Input level bar (read-only, derived from `analysisEngine.getLastFrame()`/`performerState`/`physicsState`, polled every 100ms via local state `micSignal`).
- Computer Output level bar (read-only, from `selfListenReport`).
- 3 read-only engine-active badges: Drums/Bass/Harmony (`wowMoment.engines`).
- Scrolling log pane (read-only, `wowMoment.logs`).
- Master volume slider (range 0–200, step 1, default 100) — local state `masterVol`; `onChange` calls `handleVolumeChange` which sets `Tone.getDestination().volume.value` directly (100=0dB unity, 200=+6dB, 0=-60dB/mute). This is the only control in this file that writes directly to Tone.js rather than through `OrganismContext`.

*GuestLockOverlay* (full-screen modal, shown when `organism.isGuestLocked`):
- "Sign Up Free" link button → `/signup`.
- "Already have an account? Log in" link button → `/login`.

### client/src/features/organism/OrganismModeIndicator.tsx

**Route:** ORPHANED — not imported anywhere in the codebase. Grep for `OrganismModeIndicator` across `client/src` returns only the file's own definition; no consumer exists. Dead code — likely superseded by the mode badge inline inside `OrganismVisualizer`/`OrganismCommandCenter`.

**Purpose (from code):** Would render a small pill badge showing the current physics `mode` (Heat/Ice/Smoke/Gravel/Glow) with a colored dot, reading `useOrganism()` (`isRunning`) and `useOrganismPhysics()` (`physicsState`). Returns `null` if not running or no physics state.

**Full control inventory:** None — this component renders no interactive elements at all (read-only badge), and since it's unreferenced, it is not part of any shipped surface.

### client/src/features/organism/OrganismVisualizer.tsx

**Route:** Not directly routed; embedded inside `OrganismCommandCenter`'s left column (`<OrganismVisualizer />`), so it appears wherever `OrganismCommandCenter` does: `/organism` and MAKE surface.

**Purpose:** Read-only physics/telemetry visualization — state/mode badges, BPM, 5 physics bars (Bounce/Swing/Pocket/Presence/Density), flow-depth progress bar, and per-channel level meters (drum/bass/melody/texture/chord + master), sourced from `useOrganismPhysics()`.

**Full control inventory:** None. Every element in this component is a read-only display (badges, progress bars, level meters) — there are no buttons, inputs, selects, or toggles in its JSX return block.

### client/src/features/organism/QuickStartPanel.tsx

**Route:** ORPHANED — not imported anywhere. Grep for `QuickStartPanel` in `client/src` (and repo-wide) finds only its own file. It appears to be an earlier/standalone version of the preset-picker + count-in + sound-trigger UI that was later folded directly into `OrganismCommandCenter` (which duplicates this exact logic inline — same `countInStart`/`armSoundTrigger`/`triggerPresetId` pattern).

**Purpose (from code):** Would show a preset grid for instant beat start, plus a "Count-In Start" (say "1 2 3 4", beat drops on the 1) and "Sound Trigger" (any loud sound fires the beat) control, reading `useOrganism()`.

**Full control inventory (unused, documented for completeness):**
- Active-preset badge (read-only, shown while `isRunning`).
- Count-in visual (4 read-only numbered circles, highlights `countInBeat`).
- Preset grid buttons — one per `quickStartPresets` entry, calls `swapPreset(preset.id)`; disabled while `isStarting`.
- "Preset:" `<select>` (cold-start only) — local state `triggerPresetId`, default first preset id.
- "🎙 Count-In Start" button — `countInStart(triggerPresetId)`; disabled while `startLocked`.
- "🎯 Sound Trigger" button — toggles `armSoundTrigger(triggerPresetId)`/`disarmSoundTrigger()`; disabled while `isStarting && !soundTriggerArmed`.

### client/src/features/organism/VoiceMonitorWindow.tsx

**Route:** Not directly routed; rendered at the bottom of `OrganismCommandCenter`'s JSX (`<VoiceMonitorWindow open={micMonitoringEnabled} onClose={...} />`), so available anywhere `OrganismCommandCenter` mounts, but only visually appears when `open` (`micMonitoringEnabled`) is true.

**Purpose:** Floating fixed-position "Capture Monitor" window — a live oscilloscope-style canvas waveform of the mic input plus level/rate/brightness stats, sourced from `useOrganism()` (`analysisEngine`, `performerState`) and `useOrganismPhysics()`.

**Full control inventory:**
- "x" close button (top-right, `aria-label="Close voice monitor"`) — calls the `onClose` prop (wired to `setMicMonitoringEnabled(false)` in the parent).
- Canvas waveform display — read-only, animated via `requestAnimationFrame`, not interactive.
- 3 `MonitorStat` read-only tiles: "Level" (%), "Rate" (per-second), "Bright" (%) — no interactivity.

### client/src/organism/analysis/AnalysisDebugView.tsx

**Route:** ORPHANED — not imported/rendered anywhere in `client/src` (confirmed via Grep; only the two physics/state-machine debug views showed any repo-wide hits, and those too are unreferenced outside their own files).

**Purpose (from code):** A raw devtool for the audio-analysis engine (`useAudioAnalysis` hook) — dumps `lastFrame` fields (rms, pitch, onset, spectral centroid, HNR, voiceActive) as JSON.

**Full control inventory (unused, documented for completeness):**
- "Start"/"Stop" button — toggles `start()`/`stop()` from `useAudioAnalysis()`.

### client/src/organism/physics/PhysicsDebugView.tsx

**Route:** ORPHANED — not imported anywhere; only self-referenced.

**Purpose (from code):** Devtool that renders a `PhysicsState` prop as a colored mode badge + JSON dump (pulse, bounce, swing, pocket, presence, density, beat/16th durations). Takes `state` as a prop rather than reading context directly, so it was presumably meant to be wired into some debug harness that never materialized (or was superseded by `OrganismVisualizer`'s inline physics bars).

**Full control inventory:** None — pure read-only display, no interactive elements at all.

### client/src/organism/state/StateMachineDebugView.tsx

**Route:** ORPHANED — not imported anywhere; only self-referenced.

**Purpose (from code):** Devtool that renders `OrganismState`/`TransitionEvent` props as a colored state badge + transition line + JSON dump (barsInState, silenceDurationMs, awakeningProgress, breathingWarmth, flowDepth, syllabicDensity, cadenceLockBars/Achieved).

**Full control inventory:** None — pure read-only display, no interactive elements.

---

## Recording Booth

### client/src/pages/recording-booth.tsx

**Route:** `/recording-booth`, wrapped in `ProtectedRoute` + `AppLayout` (`client/src/App.tsx` line ~332: `<Route path="/recording-booth"><ProtectedRoute><AppLayout><RecordingBoothPage /></AppLayout></ProtectedRoute></Route>`). Lazy-loaded via `React.lazy(() => import("@/pages/recording-booth"))`.

**Purpose:** A standalone, freestyle-first "pick a beat → record → export" flow — lets a user play a reference beat (quick beats / their own songs / the Organism AI engine / an uploaded file), record vocals over it with count-in, and download/mix/send takes to the Studio Mixer.

**Full control inventory:**

1. **Source tabs** (button row) — labels "Quick Beats" / "My Songs" / "Organism AI" / "Upload Beat", each with an icon (`Zap`, `Music`, `Radio`, `AudioLines`). Reads/writes `const [beatSource, setBeatSource] = useState<BeatSource>('quick-beats')` via `switchSource(src)` handler (blocked while `isRecording`).

2. **Quick Beats grid** (visible when `beatSource === 'quick-beats'`) — 6 preset cards from `QUICK_BEATS` const (`Lucid Dreams` 80bpm, `Rain On Me` 140bpm, `Orchestral Trap` 130bpm, `The Weekend` 110bpm, `Reference 05` 120bpm, `Reference 06` 96bpm). Each card is a button toggling play/stop; reads `selectedBeat` / `isBeatPlaying` state, writes via `playQuickBeat(beat)` / `stopQuickBeat()`.
   - "Generate Similar" button (shown when a beat is selected) — icon `Cpu`, disabled while `isRecording`; calls `generateAiBeatFromReference(selectedBeat)`, which switches to Organism mode using `beat.organismPresetId`.

3. **My Songs list** (visible when `beatSource === 'my-songs'`) — one button-row per song from `useQuery<Song[]>(['/api/songs'])`; toggles playback via `toggleSong(song)`, writes `selectedSong` / `isBeatPlaying`. Empty state shows a link to `/studio`.

4. **Organism AI panel** (visible when `beatSource === 'organism'`):
   - Preset grid — buttons from `organism.quickStartPresets`, disabled while `isOrganismStarting`; onClick `handleOrganismPreset(preset.id)`; reads `organism.activePresetId`/`isRunning`/`isStarting`.
   - "Stop Organism" button (shown when running) — icon `Square`; calls `stopOrganism()` (`organism.stop()` + `setIsBeatPlaying(false)`).
   - **Generator Mix sliders** (shown when running) — 4 sliders: "Drums" (`organism.drumsVolume` → `organism.setDrumsVolume`), "Bass" (`bassVolume`/`setBassVolume`), "Melody" (`melodyVolume`/`setMelodyVolume`), "Chords" (`chordVolume`/`setChordVolume`). Each: `min={0} max={200} step={1}`, value displayed as `Math.round(value*100)`.

5. **Upload Beat panel** (visible when `beatSource === 'upload'`):
   - Drag/drop-style file input (hidden `<input type="file" accept="audio/*">` inside a styled `<label>`) — `onChange={handleBeatFileUpload}`, writes `uploadedBeatUrl` / `uploadedBeatName`, auto-plays via `playUploadedBeat`.
   - "Preview"/"Stop" button (shown once a file is uploaded) — toggles `isBeatPlaying`, calls `playUploadedBeat(uploadedBeatUrl)` / `stopUploadedBeat()`.

6. **Beat volume slider** (shown whenever `isBeatPlaying`) — `Slider value={[beatVolume*100]} min={0} max={100} step={1}` → `setBeatVolume(v/100)`; default `beatVolume = 0.8`. Flanked by `VolumeX`/`Volume2` icons and a numeric readout.

7. **Mic enable button** (shown when `micPermission !== 'granted'`) — icon `Mic`, label "Click to enable microphone" / "Requesting..."; calls `requestMicPermission()`, writes `micPermission` state (`'unknown'|'granted'|'denied'|'requesting'`).

8. **VU Meter** — 20-bar level display (`vuBars`), reads `inputLevel` state (0–1, driven by `startVuMeter`/analyser RMS), color-coded green/yellow/red by threshold. Read-only display, not a control.

9. **Count-in toggle** (shown when idle) — two buttons "Off" / "4 Beats", reads/writes `const [countInBeats, setCountInBeats] = useState<4|0>(4)`.

10. **REC button** — single big button, label "Record" (icon `Circle`) / "Stop Recording" (icon `Square`) toggling on `isRecording`; disabled while `countingIn` or (`beatSource==='organism' && !isOrganismRunning`); calls `startRecord()` / `stopRecord()`. `startRecord` triggers a metronome count-in (`Tone.MetalSynth`) before calling `doRecord()` if `countInBeats > 0`.

11. **Elapsed time readout** (shown while recording) — formatted `formatMs(elapsed)`, read-only, driven by `elapsed` state ticked every 100ms.

12. **Countdown display** (shown while `countingIn`) — large pulsing number, reads `countBeat` state.

13. **Takes list** (per take in `takes: LocalTake[]`):
    - Play/Pause icon button — toggles `playingTakeId`, calls `playTake(take)`.
    - Delete (trash) icon button — calls `deleteTake(take.id)`.
    - "Vocals" download button (icon `Mic`) — `downloadTrack(take.vocalUrl, ...)`.
    - "Beat" download button (icon `AudioLines`, shown only if `take.beatUrl` exists) — `downloadTrack(take.beatUrl, ...)`.
    - "Mix → WAV" button (icon `Merge`) — disabled while `isMixing === take.id`; calls `mixAndDownload(take)` (mixes vocal+beat blobs via OfflineAudioContext, downloads WAV).
    - "Send to Mixer" button (icon `Merge`, purple) — disabled while `isMixing === take.id`; calls `sendToStudio(take)` (uploads vocal/beat as WAV to `/api/objects/upload` + `/api/songs/upload`, then navigates to `/studio?tab=mixer`).

State summary of key variables: `beatSource`, `selectedBeat`, `selectedSong`, `isBeatPlaying`, `beatVolume` (default 0.8), `micPermission`, `isRecording`, `countingIn`, `countInBeats` (default 4), `countBeat`, `elapsed`, `takes`, `playingTakeId`, `inputLevel`, `isMixing`, `uploadedBeatUrl`, `uploadedBeatName`.

*Note (this session): as of tonight, `playQuickBeat`, `toggleSong`, and `playUploadedBeat` also register their gain node with `registerAudioDebugSource` (client/src/lib/audioDebugBridge.ts) so WebEar's capture tap can hear beats played from this page — previously these three playback paths bypassed WebEar's tap entirely (silent captures despite audible playback).*

---

### client/src/components/studio/StudioVocalRecorder.tsx

**Route:** Not directly routed — rendered as a panel from two parent components:
- `client/src/components/studio/surfaces/MakeSurface.tsx` (line 147) — the MAKE surface (studio's live-performance home), passed `trackId`/`trackName`/`trackColor`/`bpm`/`isTransportPlaying`/`isArmed`/`onTakesChange`.
- `client/src/components/studio/VerticalPianoRoll.tsx` (line 3396) — embedded per-track inside the piano roll for vocal tracks.

**Purpose:** DAW-quality vocal recording panel with live waveform, RMS/peak metering, click track, count-in, multi-take management and WAV export; auto-arms/records in sync with the global transport.

**Full control inventory:**

1. **Header expand/collapse toggle** — chevron icon button (`ChevronDown`/`ChevronUp`), reads/writes `const [showSettings, setShowSettings] = useState(false)`.
2. **Header status readout** (not interactive) — shows "COUNT IN n" / elapsed time / take count, driven by `isCountingIn`, `countInRemaining`, `isRecording`, `elapsedMs`, `takes.length`.
3. **Settings panel** (shown when `showSettings`):
   - "Count-in bars" button group — options `0` ("Off"), `1`, `2`, `4`; reads/writes `const [countInBars, setCountInBars] = useState(2)`.
   - "Latency offset" slider — `min={-200} max={200} step={1}`, reads/writes `const [latencyMs, setLatencyMs] = useState(0)`; readout `${latencyMs}ms`.
   - "Input gain" slider — `min={0} max={3} step={0.05}`, reads/writes `const [inputGain, setInputGain] = useState(1.0)`; readout as percent.
   - "Options" toggle buttons (3): "Click" (icon `Clock`) → `const [clickEnabled, setClickEnabled] = useState(true)`; "Monitor" (icon `Headphones`) → `const [monitorEnabled, setMonitorEnabled] = useState(false)`; "Dub" (icon `Circle`) → `const [overdubMode, setOverdubMode] = useState(false)` (state exists but not yet wired into recording logic beyond the toggle itself).
4. **VU Meter** (`VUMeter` sub-component) — non-interactive RMS/peak bar with clip color states; reads `rmsLevel`, `peakLevel`, `clipping` state (via `startMeterLoop` analyser loop).
5. **Record button** — circular button, icon `Circle` (idle/armed) / `Square` (recording); calls `handleRecord()` which branches on `isRecording`/`isCountingIn`/`countInBars` to start mic setup, optional click-track count-in (`scheduleClickTrack`), then `beginCapture()` (MediaRecorder start).
6. **Clip indicator** (read-only, shown when `clipping`) — `AlertTriangle` icon + "CLIP" text.
7. **Live waveform canvas** (`WaveformCanvas`) — read-only visualization of `liveWaveform` while recording/counting in, or `selectedTake.waveformPoints` otherwise.
8. **Takes list** (per take in `takes: VocalTake[]`, newest first):
   - Row click — selects take: writes `selectedTakeId`.
   - Play/Pause icon button — toggles `playingTakeId`, calls `playTake(take)`.
   - Mini waveform thumbnail (read-only).
   - Clip status icon (`AlertTriangle` if `take.peakDb > -1`, else `CheckCircle2`) — read-only.
   - Download icon button — calls `downloadTake(take)` (re-encodes to WAV via `encodeWav`, triggers browser download).
   - Delete (trash) icon button — calls `deleteTake(take.id)`.

State summary: `takes`, `selectedTakeId`, `playingTakeId`, `isRecording`, `isCountingIn`, `countInRemaining`, `elapsedMs`, `countInBars` (default 2), `latencyMs` (default 0), `clickEnabled` (default true), `monitorEnabled` (default false), `inputGain` (default 1.0), `showSettings` (default false), `overdubMode` (default false), `rmsLevel`, `peakLevel`, `clipping`, `liveWaveform`. Also auto-record effect: when `isArmed && isTransportPlaying` and not already recording/counting-in, calls `handleRecord()` automatically (transport-synced arming), and auto-stops when transport stops.

---

## Lyric Video

### client/src/components/studio/LyricVideoMaker.tsx

**Route:** Not directly routed — rendered from `client/src/components/studio/surfaces/MakeSurface.tsx` (line 120, `<LyricVideoMaker />`), the MAKE surface tab of `/studio` (via `StudioShell` → `MakeSurface`). No other import sites found (Grep for `LyricVideoMaker` across `client/src` returns only its own definition and the MakeSurface import/usage).

**Purpose:** Canvas-based karaoke-style lyric video creator — uploads/syncs an audio track to a transcript (via speech-to-text), renders animated lyric lines onto a `<canvas>` in real time, and lets the user record/export the canvas+audio as MP4 or share it directly to the Social Hub feed.

**Full control inventory:**

1. **Canvas preview** (1280×720) — read-only rendering surface (`renderLyricFrame`).
2. **Native `<audio>` element** — `controls` attribute (browser-native transport UI: play/pause/seek/volume), `src={uploadedAudio?.url}`; `onLoadedMetadata` writes `duration`; `onPlay`/`onPause`/`onEnded` sync `isPreviewing` + draw loop.
3. **Play/Pause button** — icon `Play`/`Pause`, label "Play"/"Pause"; disabled if `!canPreview || isExporting`; calls `isPreviewing ? pausePreview() : startPreview()`; reads/writes `const [isPreviewing, setIsPreviewing] = useState(false)`.
4. **Reset button** (icon-only, `RotateCcw`, title "Reset") — disabled if `!canPreview || isExporting`; calls `resetPreview()` (pauses, seeks to 0, redraws frame 0).
5. **Export button** — icon `Download`, label "Export"/"Exporting"; disabled if `!canPreview || !lines.length || isExporting || isSharing`; calls `exportVideo()` (records canvas+audio to WebM via `recordToWebm()`, POSTs to `/api/lyric-video/transcode` for MP4, triggers browser download). Writes `isExporting`, `renderStatus`, `lastExport`.
6. **Share to Feed button** — icon `Share2`, label "Share to Feed"/"Sharing", title "Post this lyric video to the Social Hub feed"; disabled if `!canPreview || !lines.length || isExporting || isSharing`; calls `shareToFeed()` (records WebM, POSTs to `/api/lyric-video/share`). Writes `isSharing`, `renderStatus`.
7. **Time readout** (read-only) — `formatTime(audioRef.current?.currentTime)` / `formatTime(duration)`.
8. **Download MP4 link** (shown after export, when `lastExport` set and no active `renderStatus`) — icon `Download`, anchor with `download={lastExport.filename}`.
9. **Upload button** (`SimpleFileUploader` wrapper) — icon `Upload`, label "Upload"; accepts `audio/*,.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac,.opus`, max 100MB; `onGetUploadParameters={getUploadParameters}` (POSTs `/api/objects/upload`), `onComplete={handleUploadComplete}` writes `uploadedAudio`, resets `lyricsText`/`timedWords`/`duration`/`lastExport`.
10. **Sync button** — icon `FileText` (pulses while `isTranscribing`), label "Sync"/"Syncing"; disabled unless `canSync` (`uploadedAudio` present and not already transcribing); calls `transcribeForSync()` (POSTs `/api/speech-correction/transcribe`), writes `lyricsText`, `timedWords`, and pushes to `useStudioStore.setCurrentLyrics` + `studioSession.createLyricsVersion`.
11. **"Sync" offset control** — numeric `<Input type="number">` (id `lyric-offset`) + `Slider` (`min={-2000} max={2000} step={25}`), both bound to `const [offsetMs, setOffsetMs] = useState(0)`. Helper text: "− earlier · + later — drag negative if lyrics lag your vocal".
12. **"Speed" control** — numeric `<Input type="number">` (id `lyric-speed`, clamped 80–120) + `Slider` (`min={80} max={120} step={1}`), both bound to `const [speedPct, setSpeedPct] = useState(100)`. Helper text about fixing drift over the song length.
13. **"Words" per line** — numeric `<Input type="number" min={1} max={12}>` (id `words-per-line`), bound to `const [wordsPerLine, setWordsPerLine] = useState(6)`.
14. **"Size" (font size)** — numeric `<Input type="number" min={40} max={120}>` (id `font-size`), bound to `const [fontSize, setFontSize] = useState(82)`.
15. **"Reveal" mode buttons** (3) — "Line" / "Build" / "One word"; bound to `const [revealMode, setRevealMode] = useState<'line'|'build'|'word'>('line')`.
16. **"Font" buttons** (4) — "Inter" / "Impact" / "Serif" / "Mono"; bound to `const [fontKey, setFontKey] = useState<FontKey>('Inter')` (maps to `FONT_FAMILIES`).
17. **"Animation" buttons** (4) — "None" / "Fade" / "Pop" / "Slide"; bound to `const [animStyle, setAnimStyle] = useState<'none'|'fade'|'pop'|'slide'>('fade')`.
18. **"Show next line" checkbox** — bound to `const [showNextLine, setShowNextLine] = useState(false)`.
19. **"Snap lines to beat" checkbox** — bound to `const [snapToBeat, setSnapToBeat] = useState(false)` (defaults OFF — comment notes beat-snapping shifts word highlights and causes lag).
20. **Transcript textarea** (id `lyric-video-transcript`) — bound to `const [lyricsText, setLyricsText] = useState('')`; placeholder "Synced lyrics appear here."
21. **Uploaded filename display** (read-only, shown when `uploadedAudio` set) — `uploadedAudio.name`.
22. **Header badges** (read-only) — BPM badge (`Math.round(tempo)` from `useTransport()`), "N lines" badge (`lines.length`), "WebM" label with `Video` icon.

State summary: `uploadedAudio`, `lyricsText`, `timedWords`, `isTranscribing`, `isPreviewing`, `isExporting`, `isSharing`, `renderStatus`, `lastExport`, `duration`, `offsetMs` (0), `snapToBeat` (false), `wordsPerLine` (6), `fontSize` (82), `showNextLine` (false), `revealMode` ('line'), `speedPct` (100), `fontKey` ('Inter'), `animStyle` ('fade').

*Note (this session): as of tonight, this component's alignment fix in `lyricVideoTiming.ts` (`alignTimedWordsToTranscript`) prevents repeated lyric lines/choruses from stealing each other's Whisper timestamps — no UI changes, purely a timing-accuracy fix under the hood.*

---

### client/src/components/studio/LyricLab.tsx

**Route:** Not directly routed — rendered from `client/src/components/studio/UnifiedStudioWorkspace.tsx` in two places: line 3279 (`{activeView === 'lyrics' && <LyricLab />}`) and line 4500 (a second unconditional `<LyricLab />` render, likely a side-panel/duplicate placement). `UnifiedStudioWorkspace` itself is lazy-loaded and rendered from `client/src/components/studio/StudioShell.tsx` (line 159) as the MIX/legacy-surface content — so it is still live/reachable, not orphaned, despite CLAUDE.md's note that the lyrics "home" moved to the MAKE surface. It is the "Song Doctor · Lyric Lab" full editor (distinct from `LyricVideoMaker`), covering writing/analysis/rhymes/metaphors rather than video export.

**Purpose:** Full-featured lyric-writing workspace — text editor with undo/redo, rhyme finder (API + Datamuse fallback), metaphor dictionary, AI-based lyric analysis (credits-gated), song-structure navigation, and save/export/import of lyrics.

**Full control inventory:**

**Header:**
1. "Import" button (icon font-awesome `fa-file-import`) — calls `importLyrics()` (file picker `.txt,.lrc,.md`, reads file text, auto-structures into sections via `autoStructureLyrics`, writes `content` state and `setCurrentLyrics`).
2. "Export" button (icon `fa-file-export`) — disabled if `!content.trim()`; calls `exportLyrics()` (builds a `.txt` blob and downloads).
3. "Start Audio"/"Audio Ready" button (icon `fa-power-off`) — disabled once `isInitialized`; calls `initialize()` from `useAudio()`.

**Song upload panel:** `<SongUploadPanel onSongUploaded={handleSongUploaded} onTranscriptionComplete={...}>` (separate component, not expanded here) — feeds `title`, `content` (via `autoStructureLyrics`), and creates a work session.

**Session banner** (shown when `currentSession` set) — "End Session" button, clears `currentSession` via `setCurrentSessionId(null)`.

**Lyric Editor panel:**
4. Lyrics-version `Select` dropdown (shown if `studioSession.lyricsVersions.length > 0`) — options are each version's `label`; bound to `studioSession.activeLyricsVersionId`, `onValueChange={studioSession.setActiveLyricsVersionId}`.
5. "Snapshot" icon button (`fa-code-branch`) — calls `studioSession.createLyricsVersion({content, source:'manual', label:'Snapshot'})`.
6. Word/line count readout (read-only) — `wordCount`, `lineCount`.
7. Undo icon button (`fa-undo`) — disabled if `undoStack.length===0`; calls `handleUndo()`.
8. Redo icon button (`fa-redo`) — disabled if `redoStack.length===0`; calls `handleRedo()`.
9. Spell-check icon button (`fa-spell-check`) — decorative only, no `onClick` handler wired.
10. Title `<Input>` — bound to `const [title, setTitle] = useState("My Awesome Track")`.
11. Main lyrics `<Textarea>` (aria-label "Lyric editor") — bound to `const [content, setContent] = useState(DEFAULT_LYRIC_TEMPLATE or localStorage)`; `onSelect`/`onKeyUp`/`onClick`/`onScroll` all call `handleTextareaSelect` (tracks selection, auto-fetches rhymes for words ≥3 chars after 350ms debounce).
12. Selection info panel (read-only) — shows char/line count and quoted selected text when a selection exists.
13. Rhyme suggestion chips (shown when `rhymeSuggestions.length>0`) — each is a button inserting the word via `insertRhyme(word)` → `insertAtSelection`.

**Song Structure panel:**
14. "Intro" / "Verse 1" / "Pre-Chorus" / "Chorus" row buttons — each calls `goToSection(name)`, writes `activeSection` and scrolls/positions the textarea caret to that section marker.
15. "+ Add Section" `Select` — options `Verse 3`/`Bridge`/`Outro`/`Hook`/`Ad-lib`; `onValueChange={addSection}` appends a new `[SectionName]` block to `content`.

**Rhyme Scheme panel:**
16. Radio button group (native `<input type="radio" name="rhyme">`) — 4 options from `rhymeSchemes` (`AABB`, `ABAB`, `ABCB`, `FREE`); bound to `const [rhymeScheme, setRhymeScheme] = useState("ABAB")`.

**Generated Music Status panel** (shown when `hasGeneratedMusic`):
17. "View Beat" button — dispatches `CustomEvent('navigateToTab', {detail:'beatmaker'})`.
18. "View Melody" button — dispatches `CustomEvent('navigateToTab', {detail:'melody'})`.

**AI Generation panel:**
19. Theme `<Input>` — bound to `const [theme, setTheme] = useState("technology, coding")`.
20. Genre `Select` — 6 options (Hip-Hop/Pop/Rock/R&B/Country/Electronic); bound to `const [genre, setGenre] = useState("hip-hop")`.
21. Mood `Select` — 5 options (Upbeat/Melancholic/Energetic/Romantic/Introspective); bound to `const [mood, setMood] = useState("upbeat")`.
22. "Lyric Complexity" `Slider` — `min={1} max={10} step={1}`, bound to `const [lyricComplexity, setLyricComplexity] = useState([5])`.
23. "Beat Complexity" `Slider` — `min={1} max={10} step={1}`, bound to `const [beatComplexity, setBeatComplexity] = useState([5])`.
24. "Analyze Lyrics (uses credits)" button (icon `fa-chart-line`/spinner) — disabled if pending or `!content.trim()`; calls `analyzeLyricsMutation.mutate(...)` (POST `/api/lyrics/analyze`); on 401/402 opens the credits `Dialog`.
25. "Master Full Song" button (icon `fa-sliders-h`/spinner) — disabled if pending or no pattern/melody; calls `masterSongMutation.mutate(...)` (POST `/api/master`).

**Metaphor Dictionary panel:**
26. "Clear" button (icon `Sparkles`) — resets `metaphorQuery` and `metaphorTag`.
27. Metaphor search `<Input>` — bound to `const [metaphorQuery, setMetaphorQuery] = useState("")`.
28. Tag `Badge` chips (dynamic, from all `metaphors` tags) — toggle `const [metaphorTag, setMetaphorTag] = useState<string|null>(null)`.
29. Per-entry "Insert" button — calls `insertMetaphor(entry)` → `insertAtSelection(entry.term)`.
30. Per-entry "Copy" button — `navigator.clipboard.writeText(entry.term)`.

**Rhyme Dictionary panel:**
31. Word `<Input>` (Enter key triggers search) — bound to `currentWord` state; search icon button (`fa-search`) — disabled while pending; calls `handleFindRhymes()` → `rhymeMutation.mutate({word})`.

**Lyric Analysis panel** — read-only computed stats (Tempo Suggestion by genre, Syllable Density, Rhythm Style) from `content`/`genre`.

**Word Bank panel** — dynamic chip buttons from `derivedWordBank` (computed from theme/mood/genre); each calls `handleWordBankInsert(word)` → `insertAtSelection`.

**Save Lyrics panel:**
32. "Save Lyrics" button (icon `fa-save`/spinner) — disabled if pending or `!content.trim()`; calls `handleSave()` → `saveLyricsMutation.mutate({title, content, genre, rhymeScheme})` (POST `/api/lyrics`).

**Analysis Results modal** (shown when `showAnalysis && analysis`):
33. Close "×" icon button — `setShowAnalysis(false)`.
34. "Close" button (footer) — same.
35. "Copy Analysis" button — copies `JSON.stringify(analysis)` to clipboard.
(Remaining modal content — score bars, stats, themes, flow analysis, AI insights, strengths/weaknesses — is read-only display.)

**Credits Dialog** (shown when `creditsDialogOpen`):
36. "Close" button — `setCreditsDialogOpen(false)`.
37. "Go to Login"/"Manage Plan & Credits" button — navigates to `/login` or `/billing` depending on `creditsDialogReason`.

State summary: `title`, `content` (persisted to `localStorage['lyricLabCurrentLyrics']`), `undoStack`/`redoStack`, `genre`, `rhymeScheme`, `theme`, `mood`, `currentWord`, `rhymeSuggestions`, `metaphorQuery`, `metaphorTag`, `hasGeneratedMusic`, `lyricComplexity` ([5]), `beatComplexity` ([5]), `analysis`, `showAnalysis`, `creditsDialogOpen`, `creditsDialogReason`, `activeSection` ('verse 1'), `lastSelection`.

---

### client/src/components/studio/LyricsFocusMode.tsx

**Route:** Not directly routed — lazy-imported and rendered from `client/src/components/studio/UnifiedStudioWorkspace.tsx` (line 4605, `<LyricsFocusMode ... />`), which is reachable via `StudioShell` (line 159). It is a full-screen modal/overlay ("focus mode"), not a persistent tab — triggered conditionally from within `UnifiedStudioWorkspace`.

**Purpose:** A distraction-free, full-screen lyric-writing modal organized by song sections (Intro/Verse/Pre-Chorus/Chorus/Bridge/Outro), with an inline Grok-powered AI lyric generator; also feeds lyric-mood text into the Organism's trigger-detector pipeline before generation so the live beat engine can react to mood before the AI round-trip completes.

**Full control inventory:**

1. **"Save Lyrics" button** (header, icon `Save`) — calls `handleSave()`, which joins all `sections` into a single formatted lyrics string and calls the `onSave(fullLyrics, sections)` prop callback.
2. **"Close" button** (header, icon `X`) — calls the `onClose()` prop callback.
3. **Section-type add buttons** (left panel, 6 buttons: Intro/Verse/Pre-Chorus/Chorus/Bridge/Outro) — each calls `addSection(type)`, appending a new entry to `const [sections, setSections] = useState<LyricsSection[]>([...])` and selecting it.
4. **Section list items** (left panel, one row per section in `sections`) — clicking a row calls `setSelectedSection(section.id)`; each row also has a small "×" delete button (icon `X`) calling `deleteSection(section.id)` (blocked with a toast if it's the last remaining section).
5. **Timestamp `<Input type="number">`** (center panel) — bound to the currently-selected section's `timestamp` field; `onChange` updates `sections` via `setSections(...)`.
6. **Lyrics `<Textarea>`** (center panel) — bound to `currentSection?.content`; `onChange` calls `updateSection(selectedSection, value)`.
7. **AI prompt `<Textarea>`** (right panel, "Describe your song") — bound to `const [aiPrompt, setAiPrompt] = useState('')`; disabled while `isGenerating`.
8. **"Generate Lyrics" button** (right panel, icon `Sparkles`, includes a `CreditBadge operation="LYRICS_GENERATION"`) — disabled if `isGenerating || !aiPrompt.trim()`; calls `handleAIGenerate()`, which first feeds `aiPrompt` through `organism.triggerDetectorRef.current.processText(aiPrompt)` if available, then POSTs `/api/lyrics/generate` and parses the response into `sections` by detecting `[Verse]`/`[Chorus]`/etc. markers.
9. **Rhyme Helper `<Input>`** (right panel, "Word to rhyme...") — placeholder-only; bound to no state (`value` not set/controlled) and has no `onChange`/search handler wired — effectively decorative/non-functional in this component (helper text below just says "Type a word to get rhyme suggestions" with no backing logic).

State summary: `sections` (array of `{id, type, content, timestamp}`, default one empty `verse` section), `selectedSection`, `isGenerating`, `aiPrompt`.

---

## MIX Surface

### client/src/components/studio/UnifiedStudioWorkspace.tsx

**Route:** `/studio/mix` (via `client/src/components/studio/StudioShell.tsx`, `SurfaceRouter`). `StudioShell` parses `/studio/<surface>` from the wouter location and lazily mounts `UnifiedStudioWorkspace` when `surface === 'mix'`; redirects `/studio` → `/studio/mix` (`DEFAULT_SURFACE`). Supports a pop-out mode via `?popout=<view>` query param (opens a specific internal tab in its own `window.open` browser window) and a deep-link `?tab=<view>` param, both read at mount from `URLSearchParams`/`sessionStorage.getItem('studio:activeView')`.

**Purpose:** The DAW-style production shell for the MIX surface — a single large component (~5,150 lines) that owns a top menu bar, transport controls, a tab strip switching between 10 internal "views" (arrangement, beat-lab, piano-roll, mixer, ai-studio, lyrics, song-uploader, code-to-music, audio-tools, multitrack), plus ~15 modal dialogs for session/arrangement settings (grid, tempo map, time signature, key signature, markers, insert/delete time, keyboard shortcuts, about). It also owns track CRUD, undo/redo history, MIDI settings, and per-track effects-chain state, all backed by `useStudioStore` (Zustand), `useTracks`, and `useTransport`.

Child view components (`DawArrangementView`, `BeatLab`, `VerticalPianoRoll`, `ProfessionalMixer`, `AIMasteringCard`, `AIArrangementBuilder`, `AIVocalMelody`, `AIStemSeparation`, `AIAssistant`, `LyricLab`, `SongUploader`, `CodeToMusicStudioV2`, `AudioToolsPage`, `MasterMultiTrackPlayer`, `SpectrumAnalyzer`, `ReferenceTrackAB`, `InstrumentLibrary`, `SampleBrowser`, `InspectorPanel`, `AudioDetector`, `AstutelyChatbot`, `EQPlugin`/`CompressorPlugin`/`NoiseGatePlugin`, `WorkflowSelector`, `StudioWindowRenderer`, `WindowLauncher`, `UndoRedoControls`, `StudioListenPanel`, `DesktopBridgeToggle`) are rendered here but documented elsewhere per scope — this section only records which tab/condition mounts them and the props passed.

#### Top Bar (always visible)
- **Title** "CodedSwitch" — static text, hidden below `sm` breakpoint.
- **`DesktopBridgeToggle`** — child component (documented elsewhere), rendered inline.
- **Menu bar** (each item toggles an open/closed dropdown keyed by `openMenu` state (`useState<string|null>`), closed on outside-click):
  - **File ▼** — New Project (Ctrl+N, `handleNewProject`), Open Project… (Ctrl+O, `handleLoadProject`), Save Project (Ctrl+S, `handleSaveProject`), Import Audio… (Ctrl+I, sets `activeView='song-uploader'`), Export Audio… (Ctrl+E, `handleExport`).
  - **Edit ▼** — Undo (Ctrl+Z, `handleUndo`), Redo (Ctrl+Y, `handleRedo`), Cut (Ctrl+X, `handleCut`), Copy (Ctrl+C, `handleCopy`), Paste (Ctrl+V, `handlePaste`), Delete (Del, `handleDelete`), Select All (Ctrl+A, `handleSelectAll`).
  - **View ▼** — checkmarked radio-style items writing `activeView` state (Arrangement F1, Beat Lab F2, Piano Roll F3, Mixer F4, AI Studio F5, Code to Music F6 (`data-testid="tab-code-to-music"`), Lyrics F7, Audio Tools F8, Upload F9); toggles: Instrument Library (Ctrl+1 → `instrumentsExpanded` bool), Sample Browser (Ctrl+2 → `showSampleBrowser` bool), Inspector (Ctrl+3 → `showInspector` bool); actions: Zoom In/Out/Fit (Ctrl+/Ctrl-/Ctrl+0 → `handleZoomIn/Out/ToFit`, back `zoom` state), Full Screen (F11, `handleToggleFullScreen`), Focus Mode toggle (Ctrl+Shift+F → `focusModeEnabled` bool).
  - **Create ▼** — New MIDI Track (Ctrl+Shift+T, `handleNewMIDITrack`), New Audio Track (Ctrl+T, `handleNewAudioTrack`), New Instrument Track (`handleNewInstrumentTrack`), New Return Track (`handleNewReturnTrack`), Insert Audio Effect… (`handleInsertEffect('EQ','audio')`), Insert MIDI Effect… (`handleInsertEffect('Compressor','midi')`), Insert Instrument… (`handleInsertEffect('Reverb','midi')`), New Send (`handleNewSend`), New Bus (`handleNewBus`), Empty Clip (Ctrl+Shift+M, `handleInsertClip('Empty Clip')`), Recording Clip (`handleInsertClip('Recording Clip', true)`).
  - **Arrange ▼** — Insert/Delete/Duplicate Time… (Ctrl+Shift+I / Ctrl+Shift+Del / Ctrl+Shift+D, each opens `showInsertTimeDialog` with `timeDialogMode` set), Loop Selection (Ctrl+L, `handleLoopSelection`), Set Loop Length… (`handleSetLoopLength(4)`), Add Marker (M, `handleAddMarker`), Marker List… (opens `showMarkerListDialog`), Snap to Grid toggle (Ctrl+G → `snapToGridEnabled`), Show Grid toggle (G → `showGrid`), Grid Settings… (opens `showGridSettingsDialog`), Tempo Map… (opens `showTempoMapDialog`), Time Signature… (opens `showTimeSignatureDialog`), Key Signature… (opens `showKeySignatureDialog`).
  - **Mix ▼** — Normalize (Ctrl+Shift+N, `handleNormalize`), Reverse (Ctrl+R, `handleReverse`), Fade In (`handleFadeIn`), Fade Out (`handleFadeOut`), Bounce to Audio (Ctrl+B, `handleBounceToAudio`), Freeze Track (`handleFreezeTrack`), Flatten Track (`handleFlattenTrack`), Group Tracks (Ctrl+G, `handleGroupTracks`), Ungroup Tracks (Ctrl+Shift+G, `handleUngroupTracks`), Solo All Tracks (`handleSoloAll`), Mute All Tracks (`handleMuteAll`), Unsolo All (`handleUnsoloAll`), Unmute All (`handleUnmuteAll`), Reset All Faders (`handleResetFaders`), Reset All Pan (`handleResetPan`).
  - **More ▼** — Tuner (Ctrl+Shift+U, `handleTuner`), Metronome toggle (C → `metronomeEnabled`, `handleMetronome`), Click Track Settings… (`handleClickTrackSettings`), Spectrum/Chord/BPM Detector (opens `showAudioDetector`), Reset Layout (Ctrl+Alt+R, `handleResetLayout`), Show Instrument Library toggle (`instrumentsExpanded`), Full Screen (F11), Focus Mode toggle (`focusModeEnabled`), Keyboard Shortcuts (?, opens `showKeyboardShortcuts`), Documentation (opens `/docs` in new tab), About CodedSwitch (opens `showAboutDialog`).
  - **MIDI ▼** — status pill (Connected/Disconnected, reads `midiConnected`); "Connect MIDI Controller" button (`initializeMIDI()`) or "Refresh Devices" button (`refreshMIDIDevices()`) depending on connection state; connected-device list (read-only, `midiDevices`); active-notes indicator (read-only, `midiActiveNotes`); **MIDI Volume slider** (0–100, step 1, default derived from `midiSettings.midiVolume * 100` else 30 — writes `updateMIDISettings({ midiVolume })`); **Current Instrument** `<select>` (options grouped by category from `AVAILABLE_INSTRUMENTS`, value = `globalInstrument.currentInstrument` or `midiSettings.currentInstrument`, default `'piano'` — writes both `updateMIDISettings({ currentInstrument })` and `globalInstrument.setCurrentInstrument(inst)`); **Sustain Pedal** switch (default on, `midiSettings.sustainPedal !== false` → `updateMIDISettings({ sustainPedal })`); **Pitch Bend** switch (default on → `updateMIDISettings({ pitchBend })`); **Modulation** switch (default on → `updateMIDISettings({ modulation })`); **Auto-Connect** switch (default on → `updateMIDISettings({ autoConnect })`).
- **Right side of top bar**: `StudioListenPanel`, `UndoRedoControls`, `WindowLauncher` — all child components, documented elsewhere.

#### Transport Bar (row below top bar, always visible)
- **Play/Pause button** — label + icon toggle by `transportPlaying` (from `useTransport()`); calls `pauseTransport()`/`startTransport()`.
- **Rec/Stop Rec button** — toggles `getTimelineRecorder()` recording; on stop, calls `addTrack(name, 'audio')` and dispatches a `timeline-recording-complete` custom event.
- **Stop button** — `stopTransport()` + `seek(0)`.
- **Bar/Beat readout** — read-only text, derived from `playheadPosition`/`position` (studio store `position`).
- **Tempo slider** — range 40–200, step 1, value = `tempo` (from `useTransport()`) — writes `setTransportTempo(value)`; adjacent numeric readout "`{tempo}` BPM".
- **Loop switch** — `loop.enabled` (from `useTransport()`) → `setLoop({ enabled })`; readout "Bars `{loop.start+1}`-`{loop.end}`"; **Loop-length dropdown** (`DropdownMenu`) button labeled "`N`-Bar" opens menu with options 1/2/4/8 bars, each sets `setLoop({ enabled: true, start: loop.start, end: loop.start + bars })`.

#### DAW-Style Tab Bar
Horizontally scrollable row of `Button`s, each setting `activeView` (state, persisted to `sessionStorage['studio:activeView']` and URL `?tab=`):
- **Arrange** → `'arrangement'`
- **Beats** → `'beat-lab'` (also resets `beatLabTab` to `'pro'`)
- **Pack Generator** → `'beat-lab'` + `beatLabTab='pack-generator'`
- **Piano** → `'piano-roll'`
- **Mixer** → `'mixer'`
- **Multi-Track** → `'multitrack'`
- **AI Studio** → `'ai-studio'`
- **Code to Music** → `'code-to-music'` (`data-testid="tab-code-to-music"`)
- **Lyrics** → `'lyrics'`
- **Tools** → `'audio-tools'`
- **Upload** → `'song-uploader'`

Right-side of tab bar:
- **Snap indicator** — read-only text showing `snapToGridEnabled` On/Off.
- **Astutely Core button** — opens `showAstutely` (mounts `AstutelyChatbot` via portal).
- **Generate button** — toggles `showMusicGen` (mounts `ProAudioGenerator` overlay).
- **Workflow button** (`data-testid="button-change-workflow"`) — opens `showWorkflowSelector` dialog (mounts `WorkflowSelector`).
- **Pop-out button** (icon only) — `window.open('/studio?popout=' + activeView, ...)`.
- **Master Volume slider** — range 0–100, step 1, value = `masterVolume * 100` (default 0.7 → 70%) — writes `setMasterVolume` + `setMIDIMasterVolume`; numeric readout.

Below the tab bar: a horizontal **scroll-position range input** (only rendered when tabs overflow, `tabScrollMax > 0`) synced to `tabScrollRef.current.scrollLeft`.

A **Global BPM Strip** always visible below the tabs: duplicate Tempo slider (range 40–200, step 1) bound to the same `tempo`/`setTransportTempo`.

#### View-switch bodies (conditionally rendered by `activeView`, child components documented elsewhere)
- `'arrangement'` → `DawArrangementView` (props: `onOpenEditor`, `onAddTrack`); also shows a **"Save Beat" button** when any track has `audioUrl` (`saveBeatMix()`, disabled while `isBouncing`).
- `'beat-lab'` → `BeatLab` (props: `initialTab={beatLabTab}`, `isActive`) — kept always-mounted (`display:none` toggle) so listeners survive tab switches.
- `'piano-roll'` → `VerticalPianoRoll` (props: `tracks`, `selectedTrack`, `isPlaying`, `currentTime`, `onPlayNote`, `onPlayNoteOff`, `onNotesChange`) — also always-mounted; shows a placeholder message instead if the selected track is an audio track.
- `'mixer'` → `ProfessionalMixer` + `SpectrumAnalyzer` (props: `width=560 height=180`) + `ReferenceTrackAB`.
- `'ai-studio'` → `AIMasteringCard` (props: `peakLevel`, `rmsLevel`, `frequencyData` from `useMasteringAnalyzer()`), `AIArrangementBuilder` (props: `currentBpm`, `currentKey="C"`, `tracks`, `onApplySection`), `AIVocalMelody` (props: `currentKey="C"`, `currentBpm`), `AIStemSeparation`, `AIAssistant`.
- `'lyrics'` → header with **"Focus Mode" button** (opens `showLyricsFocus` → mounts `LyricsFocusMode` overlay with `onSave={handleLyricsSaved}`), then `LyricLab`.
- `'song-uploader'` → `SongUploader`.
- `'code-to-music'` → a `Card` wrapping a nested `Tabs`/`TabsList`/`TabsTrigger` ("Code to Music" tab) / `TabsContent` → `CodeToMusicStudioV2`.
- `'audio-tools'` → `AudioToolsPage`.
- `'multitrack'` → `MasterMultiTrackPlayer`.
- **"Back to Studio" floating button** — shown whenever `activeView !== 'arrangement'`; sets `activeView='arrangement'`.
- Left panel `InstrumentLibrary` (shown when `instrumentsExpanded`), left panel `SampleBrowser` (shown when `showSampleBrowser`), right panel `InspectorPanel` (shown when `showInspector`, prop `selectedTrackId={selectedTrack}`) — all child components.

#### Dialogs rendered directly in this file (all `Dialog`/`DialogContent`/`DialogTitle` from shadcn)
- **Waveform Editor dialog** (`showWaveformEditor`) — rendered via `renderWaveformEditor()` helper; title "Waveform Editor · `{track.name}`" (not traced further — internal to the helper, contains trim controls per earlier code around line 1885).
- **Workflow Selector dialog** (`showWorkflowSelector`) — wraps `WorkflowSelector` (props `onSelectWorkflow={handleSelectWorkflow}`, `onSkip={handleSkipWorkflow}`).
- **Audio Effects dialog** (`effectsDialogOpen`) — conditionally renders `EQPlugin` / `CompressorPlugin` / `NoiseGatePlugin` based on `activeEffectTool`, each passed `audioUrl` of the selected track and `onClose`.
- **Insert/Delete/Duplicate Time dialog** (`showInsertTimeDialog`) — title varies by `timeDialogMode`; **Bars** number input (`insertTimeBars` state, min 1) + inline validation error (`insertTimeError`); Cancel / action button (`handleApplyTimeDialog`).
- **Grid Settings dialog** (`showGridSettingsDialog`) — **Division** `<select>` (options `['1','1/2','1/4','1/8','1/16','1/32']`, draft state `gridDivisionDraft`); **Triplet Grid** switch (`gridTripletDraft`); Cancel / Save (`handleSaveGridSettings` writes `gridSettings`).
- **Tempo Map dialog** (`showTempoMapDialog`) — **BPM (20-400)** number input (`tempoMap` state); Cancel / Save (`handleSaveTempoMap`, clamps 20–400, writes session settings + `setTransportTempo`).
- **Time Signature dialog** (`showTimeSignatureDialog`) — **Numerator** / **Denominator** number inputs (`timeSignatureDraft`); Cancel / Save (`handleSaveTimeSignature`).
- **Key Signature dialog** (`showKeySignatureDialog`) — **Key** `<select>` (options from `keySignatures` array, 12 keys); Cancel / Save (`handleSaveKeySignature`).
- **Marker List dialog** (`showMarkerListDialog`) — read-only list of markers each with a **Delete button** (`handleDeleteMarker`); Close button.
- **Keyboard Shortcuts dialog** (`showKeyboardShortcuts`, `data-testid="dialog-keyboard-shortcuts"`) — static reference table only, no inputs.
- **About dialog** (`showAboutDialog`, `data-testid="dialog-about"`) — static text only.
- **Audio Detector dialog** (`showAudioDetector`) — wraps `AudioDetector` (props `onClose`, `onChordDetected`, `onBPMDetected`).
- **AstutelyChatbot** (`showAstutely`) — rendered via `createPortal` into `document.body` (props `onClose`, `onBeatGenerated={handleAstutelyResult}`).
- **AI Arrangement Builder overlay** (`showAIArrange`) — portal-rendered full-screen modal wrapping `AIArrangementBuilder` (props `currentBpm`, `currentKey="C"`, `tracks`, `onClose`, `onApplySection`); backdrop click and X button both close it.
- **Music Gen overlay** (`showMusicGen`) — full-screen modal wrapping `ProAudioGenerator`; Close button.
- **UpgradeModal** (`showLicenseModal`, from `useLicenseGate()`) — props `onClose`, `onUpgrade={startUpgrade}`.

#### Floating Transport Bar (draggable, shown only in `'piano-roll'`/`'arrangement'` views)
Position persisted to `localStorage['studio:floatingTransport:pos']`; collapsed state to `localStorage['studio:floatingTransport:collapsed']`.
- **Drag handle button** (Cable icon) — pointer-drag updates `transportBarPos {x,y}`.
- **Expand/Collapse button** — toggles `transportBarCollapsed`.
- When expanded:
  - **Play/Pause** (round button) — `transportPlaying` → `pauseTransport()`/`startTransport()`.
  - **Stop** (round button) — `stopTransport()` + `seek(0)`.
  - **Record Arm** (round button) — `toggleRecordArm()`; visual state reflects `recorderState.isRecording` / `isRecordArmed`.
  - **Bar/Beat readout** — read-only, same derivation as top transport bar.
  - **Loop toggle** (round button) — `setLoop({ enabled: !loop.enabled })`.
  - **Clear button** — `stopTransport()` + `seek(0)` + `setTracks([])` (clears all tracks).
  - **BPM readout** — read-only `tempo`.
  - **Volume slider** — range 0–100, step 1, same `masterVolume` state as top bar.

### Other MIX-area surface files
No dedicated `surfaces/` sub-component exists for MIX — only `client/src/components/studio/surfaces/MakeSurface.tsx` exists in that directory (covered by the MAKE-surface agent). The MIX surface is `UnifiedStudioWorkspace.tsx` itself, mounted directly by `StudioShell`'s `SurfaceRouter` with no wrapper/props (`<UnifiedStudioWorkspace />`, no props passed).

---

## Auth / Dashboard / Billing / Settings

### client/src/pages/login.tsx
**Route:** `/login`
**Purpose:** Password + Google sign-in for existing users; on success stores the auth token, seeds the subscription-status query cache, and redirects to `/dashboard`.

**Controls:**
- Card header: Music icon badge, title "Welcome Back", subtitle "Sign in to your CodedSwitch account"
- Form (`onSubmit={handleSubmit}`):
  - **Email** — `Input#email` (`name="email"`, `type="email"`, `autoComplete="email"`), placeholder `you@example.com`, required, disabled while loading. Reads/writes `formData.email` (useState `formData`)
  - **Password** — `Input#password` (`type="password"`), placeholder `••••••••`, required, disabled while loading. Reads/writes `formData.password`
- **Sign In** button — `type="submit"`, full width, blue; label toggles to a spinner + "Signing in..." while `isLoading` is true, otherwise "Sign In"
- `GoogleSignInButton` component ("Continue with Google" — Google Identity Services), `onSuccess`/`onError` wired to `completeLogin`/toast
- Footer link text: "Don't have an account? Sign up" — anchor to `/signup`
- State: `formData` (`{email, password}`), `isLoading` (boolean), no client-side validation beyond HTML `required`; errors surface via toast ("Login Failed" / server message or "Invalid email or password" / "Could not reach the server...")

### client/src/pages/signup.tsx
**Route:** `/signup`
**Purpose:** New account registration (email/username/password) with an optional Pro activation key, plus Google sign-up; posts to `/api/auth/register` then optionally `/api/keys/activate`.

**Controls:**
- Card header: Music icon badge, title "Create Account", subtitle "Join CodedSwitch and start creating music"
- Form (`onSubmit={handleSubmit}`):
  - **Email** — `Input#email` (`type="email"`), placeholder `you@example.com`, required, disabled while loading. State: `formData.email`
  - **Username** — `Input#username` (`type="text"`), placeholder `musicmaker`, NOT required, disabled while loading, helper text "Optional - we'll use your email if blank". State: `formData.username`
  - **Password** — `Input#password` (`type="password"`), placeholder `••••••••`, required, helper text "At least 8 characters". State: `formData.password`. Client validation: must be ≥8 chars (toast "Password too short" otherwise)
  - **Confirm Password** — `Input#confirmPassword` (`type="password"`), placeholder `••••••••`, required. State: `formData.confirmPassword`. Client validation: must match `password` (toast "Passwords don't match" otherwise)
  - **Activation Key** (optional, in a bordered sub-section) — `Input#activationKey` (`type="text"`, monospace), placeholder `PRO-XXXXXXXX-XXXXXXXX-XXXXXXXX`, uppercases input on change, helper text "Keys start with your tier (PRO/BASIC/TRIAL). Enter it now or upgrade later." State: `formData.activationKey`
- **Create Account** button — `type="submit"`, full width, blue; shows spinner + "Creating account..." while `isLoading`, else "Create Account"
- `GoogleSignInButton` — inline `onSuccess` stores token/userId, toasts "Welcome back!" or "Account created!", navigates to `/dashboard`; `onError` toasts "Google sign-in failed"
- Footer link: "Already have an account? Sign in" — anchor to `/login`
- State: `formData` (`{email, username, password, confirmPassword, activationKey}`), `isLoading` (boolean)

### client/src/pages/dashboard.tsx
**Route:** `/dashboard` (wrapped in `ProtectedRoute`, no `AppLayout`)
**Purpose:** Post-login landing/home hub — shows account stats, four primary "hero" feature launchers, recent songs, and a grid of secondary tool shortcuts.

**Controls / sections:**
- Header: "Dashboard" title, "Your creative workspace" subtitle; tier `Badge` (shows Star icon if `isPro`, text = `subscription.tier` uppercased, from `useAuth()`)
- **Stats row** (4 read-only `Card`s, all query-driven, no interactive controls):
  - Credits — from `/api/credits/balance` (`useQuery`); shows `∞` if `isOwner`, else numeric balance or `--`; if low (`<10` and not owner) shows a clickable "Low — top up" text link to `/settings`
  - Songs — `stats.totalSongs` from `/api/user/stats`
  - Followers — `stats.followers` / "Following {n}"
  - Level — `stats.level`
- **"Start Creating" hero cards** (4, each a `Link`-wrapped `Card` with a "Launch"-style CTA `Button`, label/title/desc/icon/color are hard-coded per card, not stateful):
  1. "WOW Mode" / "Organism AI" → `/organism`, CTA "Launch Organism"
  2. "Record + AI" / "Recording Booth" → `/recording-booth`, CTA "Enter Booth"
  3. "AI Brain" / "Astutely" → `/studio/mix?modal=assistant`, CTA "Talk to Astutely"
  4. "Community" / "Social Hub" → `/social-hub`, CTA "Open Social Hub"
- **"Your Songs" card**: "View All" `Button` (ghost, links to `/social-hub`); if no songs, shows empty state with "Go to Studio" `Button` (outline, links to `/studio`); otherwise lists up to 5 `songs` (from `/api/songs`) each row-clickable-styled but not an actual button (name, genre/key/BPM or format, duration via `formatDuration`, relative time via `timeAgo`)
- **"More Tools" grid** — 7 `ToolCard`s (each a `Link`-wrapped `Card`, non-form): Full Studio (`/studio`), Lyric Lab (`/lyric-lab`), Voice Convert (`/voice-convert`), AI Assistant (`/studio/mix?modal=assistant`), Code Scanner (`/vulnerability-scanner`), Sample Library (`/sample-library`), Upgrade (`/pricing`)
- **Upgrade CTA card** (only rendered `!isPro`): "Upgrade to Pro" text + **Upgrade** `Button` linking to `/settings`
- Data/state: three `useQuery` calls (`/api/credits/balance`, `/api/user/stats`, `/api/songs`); no local form state — page is read-only/navigational

### client/src/pages/pricing.tsx
**Route:** `/pricing` (also the redirect target of `/billing`, `/buy-credits`, `/credits`, `/subscribe`)
**Purpose:** Subscription tier selection and one-time credit-pack purchase; kicks off Stripe checkout via mutations that redirect to `data.url`.

**Controls:**
- **Back** button (ghost, ArrowLeft icon) → `navigate("/")`
- Header: "Simple, Transparent Pricing" title, "Start free with 10 credits. Upgrade when you're ready." subtitle; if authenticated, shows a pill with current credit balance (`creditData.balance`)
- **Membership tier cards** (3, from static `membershipTiers` array — Creator $9.99, Pro $29.99 "Most Popular"/highlighted, Studio $79.99 "Enterprise"), each showing price, monthly credits, rollover max, a feature checklist, and a **Subscribe** `Button`:
  - Label: `Subscribe to {tier.name}` if authenticated, else "Sign Up to Subscribe"; while `purchasing === tier.key` shows spinner + "Processing…"
  - `onClick` → `handleMembership(tier.key)`: if not authenticated, `navigate("/signup")`; else sets `purchasing` state and fires `membershipMutation` (`POST /api/credits/membership-checkout`)
- **One-time credit packs** section (4 packs, static `creditPacks` array — Starter 100/$4.99, Popular 500/$19.99 "Popular" 20% off, Pro 1000/$34.99 "Best Value" 30% off, Enterprise 5000/$149.99 40% off), each an entire `<button>` card:
  - `onClick` → `handlePack(pack.key)`, same signup-gate logic, fires `packMutation` (`POST /api/credits/purchase-checkout`); disabled + spinner while `purchasing === pack.key`
- **Credit usage breakdown** (read-only list from static `creditUsage` array): Full Song Generation (25), Beat Generation (5), Lyrics Generation (4), Instrumental (8), Melody Generation (5), Lyrics Analysis (2)
- Footer text: "Cancel anytime · No setup fees · Secure checkout via Stripe"
- State: `purchasing` (string|null, tracks which tier/pack key is mid-checkout), `creditData` via `useQuery(["/api/credits/balance"])` (enabled only when authenticated), two `useMutation`s as above

### client/src/pages/settings.tsx
**Route:** `/settings` (wrapped in `ProtectedRoute` + `AppLayout`)
**Purpose:** Tabbed account/app preferences center — general/account info, audio engine, appearance, performance, privacy, and billing summary; settings persist to `localStorage` under `codedswitch-settings` (no dedicated backend save endpoint) plus a live performance-settings helper.

**Header:** Settings icon badge, "Settings" title, "Customize your CodedSwitch experience" subtitle; tier `Badge` (`{tier} {Active if hasActiveSubscription}` or "Guest" if not authenticated)

**Tabs** (`Tabs defaultValue="general"`, 6 `TabsTrigger`s: General/User icon, Audio/Volume2, Appearance/Palette, Performance/Cpu, Privacy/Shield, Billing/CreditCard):

**General tab:**
- **Display Name** — `Input#displayName`, default `"CodedSwitch User"`. State: `settings.displayName`
- **Email** — `Input#email` (`type="email"`), default `"user@example.com"`. State: `settings.email`
- **Language** — `Select#language`, options English(`en`, default)/Spanish(`es`)/French(`fr`)/German(`de`)/Japanese(`ja`). State: `settings.language`
- **Timezone** — `Select#timezone`, options UTC(default)/Pacific Time(`PST`)/Eastern Time(`EST`)/Central Time(`CST`)/Mountain Time(`MST`). State: `settings.timezone`
- **AI Provider Settings** — `AIProviderSelector` component, default value `"replicate-musicgen"`. State: `aiProviderSetting` (local useState, not part of `settings`)

**Audio tab:**
- **Master Volume** — `Slider`, range 0–100 step 1, default `80`, live label shows `{value}%`. State: `settings.masterVolume`
- **Latency Mode** — `Select#latency`, options Ultra Low (2ms)/Low (5ms, default)/Normal (10ms)/Safe (20ms). State: `settings.latency`
- **Buffer Size** — `Select#bufferSize`, options 128/256/512(default)/1024/2048 samples. State: `settings.bufferSize`
- **Sample Rate** — `Select#sampleRate`, options 44.1/48(default)/88.2/96/192 kHz. State: `settings.sampleRate`
- **Auto-play generated content** — `Switch#auto-play`, default `true`, helper "Automatically play audio after generation". State: `settings.autoPlay`
- **High quality audio** — `Switch#high-quality`, default `true`, helper "Use maximum quality for audio processing". State: `settings.highQuality`
- **MIDI device support** — `Switch#midi-support`, default `true`, helper "Enable MIDI input/output devices". State: `settings.midiSupport`

**Appearance tab:**
- **Theme** — 3 toggle `Button`s: Light (Sun icon), Dark (Moon icon, default), Auto (Monitor icon); active variant highlighted. State: `settings.theme`
- **Enable animations** — `Switch#animations`, default `true`. State: `settings.animations`
- **Compact view** — `Switch#compact-view`, default `false`. State: `settings.compactView`
- **Audio visualizer** — `Switch#visualizer`, default `true`, helper "Show waveforms and spectrum analyzer". State: `settings.visualizer`

**Performance tab:**
- **GPU acceleration** — `Switch#gpu`, disabled if `!gpuSupported` (shows "Not available on this device"). State: `settings.gpuAcceleration` (from `DEFAULT_PERFORMANCE_PREFS`)
- **Multi-threading** — `Switch#multi-thread`, disabled if `!multiThreadSupported` (single-core detected). State: `settings.multiThreading`
- **Cache Size** — `Select#cacheSize`, options 256 MB/512 MB/1 GB/2 GB/4 GB. State: `settings.cacheSize`
- Read-only "System Information" panel: CPU Cores, Memory (GB), Platform, GPU availability, WebGL support — all from `detectPerformanceEnvironment()` (`systemInfo` state, no inputs)

**Privacy tab:**
- **Save projects locally** — `Switch#save-locally`, default `true`. State: `settings.saveLocally`
- **Share usage analytics** — `Switch#analytics`, default `false`. State: `settings.analytics`
- **Auto-scan code** — `Switch#auto-scan`, default `true`, helper "Check for vulnerabilities automatically". State: `settings.autoScan`
- **Clear Cache** button (outline) — `onClick` toasts "Cache cleared"
- **Export My Data** button (outline) — `onClick` toasts "Data exported"
- **Delete Account** button (outline, red text) — `onClick` toasts "Account deletion... contact support" (destructive variant); no actual delete logic wired

**Billing tab:**
- Read-only summary card: subscription tier name, active/inactive text + `Badge`, credit balance (`isAuthenticated ? creditBalance : 'Sign in'`), last usage reset date
- **Manage Billing & Pricing** button (outline) — `onClick` → `setLocation('/pricing')`
- **Invoices & Payment Methods** button (outline) — `onClick` toasts "Use Manage Billing to view invoices..." then navigates to `/pricing`
- Read-only "Usage This Month" tiles: Music Generations (`subscription.monthlyGenerations`), Monthly Uploads (`subscription.monthlyUploads`)

**Sticky footer (all tabs):**
- **Reset to Defaults** button (outline) — `onClick={handleReset}`, resets `settings` state to `DEFAULT_SETTINGS` and re-applies default performance prefs; toasts "Settings reset"
- **Cancel** button (outline) — no `onClick` handler wired (visual only)
- **Save Changes** button (gradient) — `onClick={handleSave}`, writes `settings` to `localStorage['codedswitch-settings']`, applies performance settings, toasts "Settings saved"

Top-level state: `settings` (single object, useState, seeded from `DEFAULT_SETTINGS` merged with `localStorage` or `loadPerformanceSettings()` on mount), `systemInfo` (`PerformanceEnvironment | null`), `aiProviderSetting` (string, separate from `settings`).

### client/src/pages/vulnerability-scanner.tsx
**Route:** `/vulnerability-scanner` (wrapped in `ProtectedRoute`)
**Purpose:** AI-powered code security scanner — paste/type code, scan for vulnerabilities (XSS, SQL injection, hardcoded secrets, etc.) via `/api/vulnerability/scan`, and browse categorized results. Doesn't fit Auth/Dashboard/Billing/Settings cleanly, included here per scope note.

**Controls:**
- Header: Shield icon badge, "Vulnerability Scanner" title, "AI-powered security analysis for your code" subtitle
- If NOT authenticated: an `Alert` — "Please sign in to use the vulnerability scanner. This feature requires authentication to track your scan history and provide personalized recommendations."
- **Code Scanner card:**
  - `Textarea#code-input`, label "Enter Code to Scan" (with FileText icon), placeholder "Paste your code here or type it directly...", min-height 300px, monospace. State: `code` (useState, default `''`)
  - **Scan Code** button — `onClick={handleScan}`; disabled if `isScanning` or code is empty/whitespace; shows spinner + "Scanning..." while `isScanning`, else Shield icon + "Scan Code". Guards: empty code → toast "No Code"; not authenticated → toast "Sign In Required" + redirect to `/login`
  - **Clear** button (outline) — `onClick={() => setCode('')}`
  - **Load Example** button (outline) — `onClick` fills `code` with a canned vulnerable-code snippet (eval/XSS, SQL injection, hardcoded password)
- **Scan results** (rendered when `scanResult` is set, from `useMutation` → `POST /api/vulnerability/scan`):
  - Summary tiles: Critical / High / Medium / Low counts (`scanResult.summary`)
  - Per-issue cards: severity `Badge`, type, optional CWE `Badge`, title, description, line/column, code snippet, suggested fix — all read-only, driven by `scanResult.issues`
- Empty state (code entered but not yet scanned, no result): "Ready to Scan" placeholder text
- **About This Scanner card** (static, read-only): supported languages list (JS/TS, Python, Java, C#, PHP, Go) and detection categories list (Input Validation, Authentication Issues, Data Exposure, Code Quality, Best Practices)
- State: `code` (string), `isScanning` (boolean), `scanResult` (`ScanResult | null`); one `useMutation` for the scan call
- Note: minor pre-existing bug in code — the `medium` case in `getSeverityColor` is missing a `return` (falls through to `default`), so medium-severity issue cards render with the default gray border/background instead of yellow.

---

## Social Hub / Utility

### client/src/pages/social-hub.tsx
**Route:** `/social-hub` (wrapped in `ProtectedRoute` + `AppLayout`)
**Purpose:** The community feature — a tabbed social network for producers: activity feed, DM chat, collab invites, blog, discovery, and personal analytics. Renders a gated public preview (feed-only + signup CTA) when unauthenticated.

**Top-level structure** (`SocialHub` default export, state: `activeTab: TabId` default `'feed'`):
- Header: title, subtitle, "Open Studio" button (`Link` to `/studio`, hidden on mobile).
- Tab bar (`TABS` array, 7 tabs): Feed, Connections, Chat, Collabs, Blog, Discover, Analytics — each a button setting `activeTab`. Chat tab shows an unread-count badge (`unreadData.unreadCount`, poll every 10s via `/api/social/chat/unread`); Collabs tab shows a pending-invite-count badge (`inviteCountData.count`, poll 15s via `/api/social/collab-invites/count`).
- Unauthenticated view: header + Sign In / Sign Up Free buttons (`setLocation('/login')` / `/signup`), read-only `FeedTab`, and a sticky bottom CTA banner linking to `/organism` ("Try Organism Free").

**FeedTab** (`isAuthenticated` prop):
- Composer: `Textarea` (`postContent` state, placeholder "Share what you're working on..."), 3 post-type toggle buttons — Status / Beat / Project (`postType` state, icons `PenLine`/`Music`/`Code`) — and a "Post" `Button` (disabled if empty or `shareMutation.isPending`) that POSTs to `/api/social/share` with `{platform:'codedswitch', content, type, title:'', url: origin}`.
- Quick Stats Bar: 4 tiles — Posts / Views / Likes / Comments, read from `feedData.stats` (`GET /api/social/posts`).
- Posts feed: each post renders like/comment/share buttons (authenticated) reading `post.likes/comments/shares` (buttons are display-only, no mutation wired) or read-only counts (unauthenticated). Beat/project posts show a fake waveform + play button (non-functional `<button>`, no audio wired). `organism-session` type posts render via `OrganismSessionCard` (separate component: play/pause toggle on audio/video, "Try Organism →" `Link` button, like/comment counts).
- Empty state: "Discover Producers" button (visual only, no navigation wired to Discover tab click handler shown).

**ConnectionsTab:**
- Grid of `PLATFORMS` (Discord, Twitter/X, Instagram, YouTube, Facebook) — each card shows Connected/Offline `Badge` (from `GET /api/social/connections`), and per-platform button: Discord → external link "Join Discord" (`https://discord.gg/AWcVpBVf`); others → "Connect" (`POST /api/social/connect {platform}`) or "Disconnect" (`DELETE /api/social/connect/:platform`) depending on connection state.
- "Quick Share" section (visible only if ≥1 platform connected): 4 buttons — Share Beat / Share Melody / Code→Music / Share Project — each calls `connectMutation.mutate(firstConnectedPlatform)` (placeholder wiring, reuses connect mutation rather than an actual share action).

**ChatTab:**
- Conversation list (left, `GET /api/social/chat/conversations`, refetch 5s) — click sets `selectedConv`/`selectedUserId`; shows unread-count badge per conversation.
- Message thread (right, `GET /api/social/chat/conversation/:userId`, refetch 3s): message bubbles, `Input` (`msgInput` state, Enter-to-send), Send `Button` (icon-only) → `POST /api/social/chat/send {recipientId, content}`.

**CollabsTab:**
- "Pending Invites Received" (`GET /api/social/collab-invites/received`): each invite has Accept/Decline buttons → `PUT /api/social/collab-invite/:id/respond {status:'accepted'|'declined'}`.
- "Sent Invites" list (read-only, `GET /api/social/collab-invites/sent`), shows type + status badges.
- "Shared With Me" list (`GET /api/social/shared-with-me`) — permission badge (admin/edit/view icons).
- "People You Follow" grid (`GET /api/social/following`).

**BlogTab:** Mini blog preview (`GET /api/blog/posts`, first 6), "View Full Blog" button → `Link` to `/blog`; each post card links to `/blog/:slug`.

**DiscoverTab:**
- `GET /api/social/discover?limit=20`; producer cards with deterministic (hash-based) gradient/genre-tags/role generated client-side from name.
- Per-card "Follow" button → `POST /api/social/follow/:userId`; "Collab" button opens Invite Dialog.
- Invite Dialog (`Dialog`, state `inviteTarget`, `inviteType: 'jam'|'project'|'feedback'` default `'jam'`, `inviteMessage` string): `Select` for collab type (Jam Session / Project Collab / Get Feedback), `Textarea` for optional message (maxLength 500), Cancel / Send Invite buttons → `POST /api/social/collab-invite {toUserId, type, message}`.

**AnalyticsTab:** Read-only stat tiles — Followers/Following (`/api/social/stats`), Posts/Unread (`/api/social/posts` + `/api/social/chat/unread`); Engagement block (Views/Likes/Comments/Shared Projects); Connected Platforms count vs `PLATFORMS.length` with per-platform icon indicator.

---

### client/src/pages/DemoPage.tsx
**Route:** `/demo`
**Purpose:** Public marketing/demo page for the "AI Perception Platform" (WebEar) — lets a visitor share tab audio and get a live AI-generated audio analysis, plus promotes the other "senses" (WebEye, WebSense, etc.) and MCP setup.
**Controls:**
- Capture-length `<select>` (`captureSeconds` state, default `5`; options 3/5/10/15s).
- "Perceive" button (`onClick={runPerception}`, disabled while `requesting`/`capturing`/`analyzing`; label changes per `captureState: 'idle'|'requesting'|'capturing'|'analyzing'|'done'|'error'`). Flow: `getDisplayMedia` (audio+video, drops video tracks) → `MediaRecorder` records `captureSeconds` → POSTs blob to `/api/demo/perceive` → sets `result: PerceptionResult`.
- Results block (conditionally rendered): 4 `MetricCard`s (BPM, Loudness dBFS, Peak dBFS, Clipping %), 5 `BandBar`s (Sub/Bass/Low Mid/Mid/High), AI description text block, or a "locked" gated card with "Sign up free →" link (`/signup`) if `result.descriptionGated`.
- Sensor grid: 6 static cards (WebEar, WebEye, WebSense, WebNerve, WebShield, WebLog), display-only.
- MCP config code block (static, shows `window.location.origin`), "Open Studio →" link (`/studio`) and "Read Docs" link (`/docs/ai-perception`).

---

### client/src/pages/Subscribe.tsx
**Route: not routed / orphaned.** No `<Route>` in `App.tsx` references `Subscribe.tsx`; the `/subscribe` path is instead a plain `<Redirect to="/pricing">`. Dead file.
**Purpose (as written):** Stripe checkout tier-picker (Basic $10/mo vs Pro $39.99/mo).
**Controls:** Basic tier card (click → `setSelectedTier('basic')`), Pro tier card (click → `setSelectedTier('pro')`, default selected), "Subscribe to CodedSwitch {tier}" button → calls `useLicenseGate().startUpgrade()` (loading spinner state `isLoading`).

---

### client/src/pages/TestCircular.tsx
**Route: not routed / orphaned.** No `<Route>` references it. Dead file (dev/QA harness).
**Purpose (as written):** Runs and displays "circular translation" (code→music→code) accuracy tests.
**Controls:** "Run Circular Translation Tests" button (`onClick={runTests}`, disabled while `isRunning`) → `POST /api/test-circular-translation`; results render as summary card (Total/Passed/Average Accuracy, `Progress` bar) plus per-test cards (pass/fail icon, original vs regenerated code, similarity score, errors list).

---

### client/src/pages/activate.tsx
**Route:** `/activate`
**Purpose:** License-key activation form (post-payment or manual key entry) that unlocks tier access.
**Controls:** `Input id="activation-key"` (uppercased on change, placeholder `PRO-XXXXXXXX-...`, state `activationKey`), submit `Button` ("Activate", disabled while `isActivating`) → `POST /api/keys/activate {activationKey}`, redirects to `/` on success. Static checklist (unlimited generations, advanced studio, song analysis). Footer link "Get access" → `/pricing`.

---

### client/src/pages/ai-assistant.tsx
**Route: effectively orphaned.** `App.tsx`'s `/ai-assistant` route is a `<Redirect to="/studio/mix?modal=assistant">` (comment explicitly notes the overlay replaced this page) — the component `AIAssistantPage` in this file (thin wrapper rendering `<AIAssistant/>` from `@/components/studio/AIAssistant`) is never reached by any route.

---

### client/src/pages/blog.tsx
**Route:** `/blog`
**Purpose:** Public blog index — searchable/filterable article list with a featured post.
**Controls:** Search `Input` (`searchQuery` state, filters title/excerpt), category filter buttons — "All Posts" + `categories` array (Tutorial, Music Production, AI Music, Beat Making, Tips & Tricks) (`selectedCategory` state, single-select). Featured post card shown only when no search/filter active, "Read Article" button → `/blog/:slug`. Grid of post cards (each links to `/blog/:slug`), each showing category badge, date, read-time, views, tags.

### client/src/pages/blog/[slug].tsx
**Route:** `/blog/:slug`
**Purpose:** Individual blog article reader with share tools and related-article suggestions.
**Controls:** "Back to Blog" button → `/blog`. Share buttons: Twitter/Facebook/LinkedIn (open share-intent popups via `window.open`) and a generic Share2 "copy link" button (`navigator.clipboard.writeText`, toasts "Link copied!"). Related-articles grid (links to their `/blog/:slug`). Bottom CTA "Start Creating Free" → `/studio`. Not-found state renders its own "Back to Blog" button.

---

### client/src/pages/buy-credits.tsx
**Route:** `/buy-credits`
**Purpose:** Credit-pack and membership-tier purchase page (Stripe checkout redirect).
**Controls:** "Back to Studio" button → `/`. `Tabs` (`TabsList` default `"one-time"`): "One-Time Purchase" vs "Monthly Membership".
- One-Time tab: 4 `creditPackages` cards (Starter 100/$4.99, Popular 500/$19.99 "Popular" badge, Pro 1000/$34.99 "Best Value" badge, Enterprise 5000/$149.99) — each "Buy Now" button → `purchaseMutation` → `POST /api/credits/purchase-checkout {packageKey}`, redirects to Stripe `data.url`.
- Subscription tab: 3 `membershipTiers` cards (Creator $9.99/mo·200cr "Most Popular", Pro $29.99/mo·750cr "Best Value", Studio $79.99/mo·2500cr "Enterprise") — each "Subscribe Now" button → `membershipMutation` → `POST /api/credits/membership-checkout {tierKey}`.
- Static "How Credits Work" info card (credit costs per generation type).
- Current balance `Badge` reads `GET /api/credits/balance`.

---

### client/src/pages/credits-cancel.tsx
**Route:** `/credits/cancel`
**Purpose:** Stripe checkout-cancelled confirmation page.
**Controls:** "Try Again" button → `setLocation('/buy-credits')`; "Back to Studio" button → `setLocation('/')`.

### client/src/pages/credits-success.tsx
**Route:** `/credits/success`
**Purpose:** Stripe checkout-success confirmation, shows updated credit balance.
**Controls:** Auto-refetches `GET /api/credits/balance` after a 2s delay (webhook settle time). "Start Creating" button → `/`; "Buy More Credits" button → `/buy-credits`.

---

### client/src/pages/daw-layout.tsx
**Route:** `/daw-layout`
**Purpose:** Public/indexable marketing landing page for the "Online DAW" feature (Beat Maker, Piano Roll, Arrangement, AI composition). Purely static.
**Controls:** Nav: "Log in" (`/login`), "Try Free" (`/signup`). Hero: "Open the DAW" (`/signup`), "Log In" (`/login`). 4 static feature cards (no interactivity). Bottom CTA "Start for Free" (`/signup`). Footer links Home/Studio/Pricing.

### client/src/pages/mix-studio.tsx
**Route:** `/mix-studio`
**Purpose:** Public landing page for the "Online Mix Studio" (mixer/FX/AI mastering). Static, same structural pattern as daw-layout.
**Controls:** Nav Log in/Try Free, Hero "Open Mix Studio"/"Log In", 4 static feature cards, CTA "Start Mixing Free", footer links — all `Link`s to `/login`, `/signup`, `/`, `/studio`, `/pricing`.

### client/src/pages/pro-audio.tsx
**Route:** `/pro-audio`
**Purpose:** Public landing page for AI text-to-music generation (ACE-Step). Same static pattern.
**Controls:** Nav Log in/Try Free; Hero "Generate Your First Track" (`/signup`), "See Live Demo" (`/organism`); 4 static feature cards; CTA "Create Free Account" (`/signup`); footer links.

### client/src/pages/song-structure.tsx
**Route:** `/song-structure`
**Purpose:** Public landing page for a song-arrangement/structure-builder feature. Same static pattern.
**Controls:** Nav Log in/Try Free; Hero "Build Your Song Structure" (`/signup`), "Log In" (`/login`); 4 static feature cards; CTA "Get Started Free" (`/signup`); footer links.

---

### client/src/pages/not-found.tsx
**Route:** catch-all `<Route component={NotFound} />` (matches any unmatched path; also used as fallback for lazy-import failures across the app).
**Purpose:** Generic 404 page. No interactive controls — static card with "404 Page Not Found" and a hint message.

---

### client/src/pages/onboarding.tsx
**Route:** `/onboarding` (wrapped in `ProtectedRoute`)
**Purpose:** 3-step first-run onboarding wizard collecting genre/goal/experience preferences before entering the studio.
**Controls:** Progress bar (`step` state 0–2) + "Skip for now" link → `setLocation('/studio')`.
- Step 1 (Genre): 8 toggle buttons from `GENRES` (Hip-Hop/Rap, Electronic/EDM, Pop, Rock/Alternative, R&B/Soul, Lo-Fi/Chill, Classical/Orchestral, Other/Experimental) — multi-select, `selectedGenres: string[]`.
- Step 2 (Goals): 6 toggle buttons from `GOALS` (Make beats & instrumentals, Write & produce full songs, Use AI to generate music, Mix & master tracks, Collaborate with other artists, Learn music production) — multi-select, `selectedGoals: string[]`.
- Step 3 (Experience): 3 radio-style buttons from `EXPERIENCE` (Beginner/Intermediate/Advanced) — single-select, `experience: string`.
- Nav: "Back" button (disabled on step 0), "Next" button (disabled until current step's selection non-empty) on steps 0–1, "Launch Studio" button on step 2 → `handleComplete()`: `POST /api/auth/onboarding {genres, goals, experience}`, invalidates `/api/subscription-status`, navigates to `/studio` regardless of success/failure.

---

### client/src/pages/public-song.tsx
**Route:** `/s/:id`
**Purpose:** Public, unauthenticated shareable song player page (no login required) for a single uploaded/generated song.
**Controls:** Fetches `GET /api/songs/public/:id` on mount. Audio player: seek `<input type="range">` (`currentTime`/`duration` state, `onChange` seeks `audioRef.current.currentTime`), Play/Pause circular button (`togglePlay`), "Share" button (`handleShare` — uses `navigator.share` if available, else clipboard-copy + `alert`). Bottom CTA "Try CodedSwitch Free" → `window.location.href = '/signup'`. Error/not-found state has "Go to CodedSwitch" button → `/`.

---

### client/src/pages/sample-library.tsx
**Route:** `/sample-library` (wrapped in `ProtectedRoute` + `AppLayout`)
**Purpose:** Dedicated full-page sample browser (search/filter/preview/add-to-project), separate from any in-studio sample panel.
**Controls:** Search `<input>` (`searchQuery` state, filters by name/category/subcategory). Category `<select>` (`selectedCategory` state, default `'all'`, options populated from `data.categories`). Per-sample card: Preview button (Play/Pause icon toggle, `handlePreview` — plays via `new Audio()`, `playingUrl` state tracks currently-playing url) and Add button (`Plus` icon, `handleAddSample` — dispatches `window.dispatchEvent('sample-library:add-sample')` and persists to `sessionStorage.pendingSamples` for the Studio to pick up). "Retry" button shown if library fails to load (`loadSampleLibrary()` re-fetch of `GET /api/sample-library`).

---

### client/src/pages/sitemap-page.tsx
**Route:** `/sitemap`
**Purpose:** Static human-readable sitemap of the whole app, grouped into 6 sections (Core Pages, Studio & Music Tools, AI & Tools, Social & Community, Billing & Credits, Technical). All entries are plain navigation links (`Link` for internal routes, `<a target="_blank">` for external/technical entries like `/sitemap.xml` and `/api/health`). No form controls — pure link directory. Notably lists `/subscribe`, `/billing`, `/credits` as if live destinations even though those all redirect to `/pricing` in `App.tsx`.

---

### client/src/pages/test-piano-roll.tsx
**Route: not routed / orphaned.** No `<Route>` in `App.tsx` references `test-piano-roll.tsx`. (The real piano roll is reached through `StudioShell`'s MIX surface; the legacy `/piano-roll` route redirects to `/`, not to this file.) Dead file — a standalone wrapper around `VerticalPianoRoll` with a "Back to Home" button (→ `/`), reads `workSessionId` from pending navigation payload or `?sessionId=` query param.

---

### client/src/pages/user-profile.tsx
**Route:** `/profile` (wrapped in `ProtectedRoute` + `AppLayout`; component name `UserProfile`)
**Purpose:** Authenticated user's public-facing profile page — stats, achievements, bio editing, quick actions.
**Controls:**
- "Edit Profile" / "Cancel" toggle button (`isEditing` state) in header.
- Bio section (only in edit mode): `Input id="profile-display-name"` (writes on every keystroke directly via `updateProfileMutation.mutate`), `Input id="profile-email"` (disabled, read-only), `Input id="profile-bio"` (same live-mutate-per-keystroke pattern). "Save Changes" button (`handleSave` → `PUT /api/user/profile {displayName, bio, socialLinks}`) and "Cancel" button (exits edit mode).
- Social link buttons (Twitter/Instagram/YouTube) — display-only, shown conditionally if `profile.socialLinks.X` present, no click handler (just links visually, `size sm` buttons with icons).
- Stats Overview: 4 static readout tiles (Total Shares, Total Views, Credits, Rating).
- Achievements grid: maps `profile.achievements` (array of strings) into badge tiles.
- "Recent Creations" list: 4 hardcoded mock entries (Beat/Melody/Code→Music/Project) each with a non-functional "Share" button.
- Quick Actions: "Share Profile" (`/social-hub`), "Create Beat" (`/studio`), "Edit Profile" (`setIsEditing(true)`), "Settings" (`/settings`), "Buy Credits" (`/buy-credits`), "Billing" (`/billing` — which itself redirects to `/pricing`).
- Unauthenticated gate: "Sign In" (`/login`) / "Sign Up" (`/signup`) buttons.

---

### client/src/pages/voice-convert.tsx
**Route:** `/voice-convert` (wrapped in `ProtectedRoute` + `AppLayout`)
**Purpose:** AI voice-conversion pipeline UI — submit a song for stem-separation + voice conversion + pitch correction, track job progress, manage BYO API keys.
**Controls:** Top-level `Tabs` (`activeTab` state, default `"convert"`) with 4 triggers: Convert, Voice Training, Jobs (shows live pending-job count badge), API Keys.
- **Convert tab:** `ServiceHealthPanel` (read-only service status grid: cloud/RVC readiness badges, per-service Wifi/WifiOff icon, `GET` via `useServicesHealth`). Form: `Input` Voice ID (`voiceId`), `Input` Source Audio URL (`sourceUrl`), `Select` Stem Mode (`stemMode`: `2` "2-Stem Standard" / `4` "4-Stem Pro", default 2), `Select` Provider (`provider`: `replicate-rvc` "RVC Cloud" default / `elevenlabs` / `rvc` "RVC (Local)" disabled if `!rvcAvailable`), `Switch` Pitch Correction (`pitchCorrect`, disabled if audio-analysis service offline). Execution Mode toggle (2 custom buttons: "BYO Keys" free vs "Cloud" costs credits, `executionMode` state default `"cloud"`) with live cost preview (`useCostCheck`, auto-refires on stemMode/executionMode change) and a "Buy Credits" inline link (→ `/buy-credits`) if insufficient balance, or an "API Keys" tab-switch link if BYO selected. "Start Conversion" button (`handleSubmit`, validates voiceId+sourceUrl non-empty, disabled if insufficient cloud credits) → `submitJob` → on success switches to Jobs tab and selects the new job.
- **Voice Training tab:** embeds `<VoiceRecorder>` component; `onVoiceCloned` callback auto-fills `voiceId` and switches back to Convert tab.
- **Jobs tab:** job list (`JobCard` per job — click to select, `isSelected` highlight, inline "play" link button if `remixUrl` present and done) + `JobDetailPanel` for `selectedJobId` (live via SSE `useJobSSE`: stage `Progress` bar, stem mode/provider/execution/pitch-correct readout, error `Alert`, final remix `<audio controls>`, intermediate-output badges for vocal stem / instrumental / converted vocal / pitch-corrected).
- **API Keys tab:** `ApiKeyVault` — `Select` service (`elevenlabs` default / `replicate`), `Input type="password"` API key with show/hide eye-icon toggle button (`showKey` state), "Save Key" button (`handleStore` → `storeKey` mutation), per-stored-key row with a Trash2 delete button (`handleDelete` → `deleteKey` mutation), validity indicator (Valid/Invalid text per key).

---

## Orphan tally (from Social Hub / Utility research pass)

Files that exist under `client/src/pages/` but are **not reachable via any route** in `App.tsx` (confirmed by full read of the routing table):

1. `client/src/pages/Subscribe.tsx` — `/subscribe` redirects to `/pricing` instead of rendering this component.
2. `client/src/pages/TestCircular.tsx` — no route at all.
3. `client/src/pages/ai-assistant.tsx` — `/ai-assistant` is a hard `<Redirect>` to the `/studio/mix?modal=assistant` overlay; this file's `AIAssistantPage` component is never rendered.
4. `client/src/pages/test-piano-roll.tsx` — no route at all (`/piano-roll` redirects to `/`, not to this file).

Note: `buy-credits.tsx` IS live at `/buy-credits`; only the alternate paths `/billing`, `/credits`, `/subscribe` redirect to `/pricing` and never touch `Subscribe.tsx` or a separate "billing" component (there is no separate billing.tsx file).

---

## DAW Panels — Group A

### MasterMultiTrackPlayer.tsx

**File path:** `client/src/components/studio/MasterMultiTrackPlayer.tsx`

**Route/trigger:** Lazy-loaded (`React.lazy`) in `UnifiedStudioWorkspace.tsx:45` and rendered at `UnifiedStudioWorkspace.tsx:4554-4561` when `activeView === 'multitrack'` (the **MIX** surface's "Multi-Track" tab). Wrapped in `React.Suspense`.

**Purpose:** A timeline-based multi-track audio/MIDI mixer — loads audio files or MIDI regions from the library/Beat Lab/Melody Composer/Piano Roll onto draggable, resizable, per-track lanes with waveform display, and supports mix preview render + WAV export.

#### Header (via child `MTPHeaderContainer.tsx`, rendered inline at top of the component)
- **Menu bar** — `<StudioMenuBar {...menuHandlers} />` (separate file, not expanded)
- **Project Name** input (`#mtpc-project-name`) → `projectName` / `setProjectName`
- **BPM** number input (`#mtpc-tempo`) → `tempo` / `setTempo`
- **Key** text input (`#mtpc-key`) → `projectKey` / `setProjectKey`
- **TS** (time signature) text input (`#mtpc-time-sig`) → `timeSignature` / `setTimeSignature`
- **Metronome On/Off** toggle button → `metronomeOn` / `setMetronomeOn`
- **Record / Stop (mm:ss)** button (icon swaps `Mic`↔`StopCircle`) → `isRecording`, calls `startRecording()` / `stopRecording()`, shows `recordingTimeLabel`
- **Mixer** toggle button → `showMixer` via `onToggleMixer`
- **Load Audio Files** button (opens hidden `<input type="file" accept="audio/*" multiple>` `#audio-upload`) → `handleFileUpload`
- **Add Track** button → opens Add-Track dialog (`showAddTrack` / `setShowAddTrack`)
- **Band Template** button → `applyTemplate('band')`
- **Podcast Template** button → `applyTemplate('podcast')`
- **Add Track dialog** (`Dialog open={showAddTrack}`):
  - Quick-template buttons: **Band Template**, **Podcast Template** (same handlers)
  - `Tabs` (`activeSourceTab` / `setActiveSourceTab`) with 4 triggers: **Library**, **Beat Lab**, **Melody**, **Piano Roll**
    - Library tab: per-song **Add** button → `loadFromLibrary(song)` (from `librarySongs` query), closes dialog
    - Beat Lab tab: **Create Empty Beat Track** → `onAddEmptyTrack('Beat Track','beat')`; **Open Beat Lab** → `onOpenBeatLab()`
    - Melody tab: **Create Empty Melody Track** → `onAddEmptyTrack('Melody Track','melody')`; **Open Melody Composer** → `onOpenMelody()`
    - Piano Roll tab: **Create Empty Track** → `onAddEmptyTrack('Piano Roll Track','audio')`; **Open Piano Roll** → `onOpenPianoRoll()`
  - Quick Add row: **Vocal Track** button → `onAddEmptyTrack('Vocal Track','vocal')`; **Upload Audio File** button → hidden file input `#quick-upload` → `handleFileUpload`

#### Transport bar (pinned, inline JSX)
- **Skip back 5s** button (`SkipBack` icon) → `stopPlayback()`, decrements `pauseTimeRef`/`currentTime`
- **Play/Pause** button (`Play`/`Pause` icon, disabled when no tracks) → `playTracks()` / `pausePlayback()`, reflects `isPlaying`
- **Stop** button (`Square` icon) → `stopPlayback()`
- **Skip forward 5s** button (`SkipForward` icon) → increments `pauseTimeRef`/`currentTime`, capped at `duration`
- **Loop** toggle button (`Repeat` icon) → `loop` / `setLoop`
- **Punch in/out** toggle button (`RepeatIcon`) → `punch.enabled`; when enabled, reveals:
  - **In** number input → `punch.in`
  - **Out** number input → `punch.out`
- **Time display** (read-only) — `formatTime(currentTime)} / {formatTime(duration)`
- **Tempo** number input (`#mmtp-tempo`, min 40 max 200) → `tempo` / `setTempo`
- **Master** volume `Slider` (0–100) → `masterVolume` / `setMasterVolume`
- **Timeline** scrubber bar (progress fill only, not draggable in this snippet) — reflects `currentTime`/`duration`

#### Mix Preview & Master bar
- **Mix Preview / Pause / Resume / Stop** buttons (state-dependent: `previewStatus` idle/playing/paused/loading) → `handleMixPreview()`, `pauseMixPreview()`, `stopMixPreview()`
- **Export WAV** button → `exportProjectToWav()`
- **Quality** `Select` (Fast / High) → `renderQuality` / `setRenderQuality`
- **Status** text (read-only) — `previewStatus`, plus progress % when 0<`previewProgress`<100
- **Limiter Thresh / Release / Ceiling** number inputs (`#mmtp-lim-thresh/-release/-ceiling`) → `masterLimiter.threshold` / `.release` / `.ceiling`
- **Preview** native `<audio controls>` element (shown when `previewUrl` set)
- **View** toggle button (`Sliders` icon) → `viewSettings.showViewSettings`

#### View Settings panel (conditional on `viewSettings.showViewSettings`)
- **Compact Mode** checkbox → `viewSettings.compactMode`
- **Hide Channel Strip** checkbox → `viewSettings.collapsedHeaders`
- **Waveform Only** checkbox → `viewSettings.showWaveformOnly`
- **Track Height** `Slider` (60–300, step 10) → `viewSettings.trackHeight`
- **Mini** preset button → sets `trackHeight:60, compactMode:true, showWaveformOnly:true`
- **Normal** preset button → `trackHeight:120, compactMode:false, showWaveformOnly:false`
- **Large** preset button → `trackHeight:200, compactMode:false, showWaveformOnly:false`

#### Channel Controls strip (per track, shown when tracks exist and `!collapsedHeaders`)
Per track: track name (read-only), a small level meter (RMS + peak bars, read-only from `channelMeters[track.id]`), then:
- **M** (mute) icon button → `toggleMute(track.id)`, reflects `track.muted`
- **S** (solo) icon button → `toggleSolo(track.id)`, reflects `track.solo`
- **A** (hall send) toggle icon button → `toggleSendLevel(track.id, 'A')`, active when `track.sendA > -50`
- **B** (delay send) toggle icon button → `toggleSendLevel(track.id, 'B')`, active when `track.sendB > -50`

#### Empty-state (no tracks)
- **Add Your First Track** label/button → triggers hidden `<input type="file" accept="audio/*" multiple>` `#audio-upload-empty` → `handleFileUpload`

#### Per-track lane (mapped over `tracks`, each wrapped in a resizable `<Resizable axis="y">` card)
- Row is `draggable` for reordering → `handleTrackDragStart/Over/Leave/Drop/End`
- **Drag handle** (`GripVertical`, decorative grab affordance)
- Track color stripe (visual only)
- Track name (click to `toggleRegionSelection(track.id)`)
- **Kind** `Select` (vocal/drums/bass/synth/guitar/keys/fx/other) → `updateTrackKind(track.id, v)` — appears twice: a header instance (hidden in compact mode, values include `other`) and a controls-row instance (no `other`, also calls `updateTrackSends` with kind defaults)
- **Split at playhead** button (`Scissors`, tooltip "Split at playhead (S)") → `splitRegionAtPlayhead(track.id)`
- **Duplicate track** button (`Plus`) → `duplicateTrack(track.id)`
- **Bounce MIDI to audio** button (`Wand2`, shown only for MIDI tracks with notes) → `bounceTrackToAudio(track.id)`
- **Track color** `<input type="color">` → `updateTrackColor(track.id, value)`
- **Delete track** button (`Trash2`) → `deleteTrack(track.id)`
- Waveform region (draggable horizontally) → `handleRegionMouseDown/Move/Up`; embeds `<TrackWaveform>` (in-file helper component) with its own click-to-seek and trim-handle dragging (`onTrimChange` wired but not passed here, so trim handles are visual-only in this call site)
- MIDI note lane (when `track.midiNotes.length`) — read-only piano-roll-style visualization with velocity-colored blocks and a velocity bar strip; click toggles region selection
- Empty-track placeholder: contextual **Open Beat Lab** / **Open Melody Composer** / **Start Recording** button depending on `track.trackType`, plus **Upload Audio** button/hidden file input (`#track-upload-{id}`)
- **Mute (M)** / **Solo (S)** icon buttons (duplicated from channel strip, per-lane) → `toggleMute` / `toggleSolo`
- **Volume** `Slider` (0–100) → `updateTrackVolume(track.id, v)`, shows `{track.volume}%`
- **Pan** `Slider` (-100–100, displayed as -100..100 mapped to ±1) → `updateTrackPan(track.id, v/100)`, shows L/C/R
- **Send A** `Slider` (-60–12 dB) → `updateTrackSends(track.id, v, track.sendB)`
- **Send B** `Slider` (-60–12 dB) → `updateTrackSends(track.id, track.sendA, v)`
- **Fade In** `Slider` (0–200, step 5, ms) → `updateTrackFade(track.id, v/100, fadeOut)`
- **Fade Out** `Slider` (0–200, step 5, ms) → `updateTrackFade(track.id, fadeIn, v/100)`
- **Waveform** button → opens waveform editor dialog for that track (`setWaveformEditorTrack`, `setWaveformAudio`)
- Bottom edge drag handle for row height resize (native `Resizable` `onResize` → sets `track.height`)

#### Footer stats bar (read-only)
- Track count, total duration, "Professional Multi-Track Mixing" label

#### Modals
- **Waveform Editor** `Dialog` — embeds `<WaveformVisualizer showControls>` (separate file) with `onVolumePointsChange` → `updateTrackVolumePoints(trackId, points)`
- **Mixer** panel (conditional `showMixer`) — embeds `<ProfessionalMixer />` (separate large file, not expanded here)
- **Tuner** `<TunerModal open={showTuner} onClose freq={tunerFreq} setFreq={setTunerFreq}>` (separate file)
- **Project Settings** `BaseDialog` (`showProjectSettingsModal`) — duplicate text inputs for Project Name / BPM / Key / Time Signature / Limiter Threshold / Release / Ceiling, all bound to the same state as the main toolbar (`#mmtp-dlg-*` ids)

#### Embedded sub-panels not expanded (own files)
`StudioMenuBar`, `WaveformVisualizer`, `ProfessionalMixer`, `TunerModal`, `GridOverlay` (renders timeline grid lines behind the track list, driven by `zoomLevel`/`showGrid`/`duration`).

---

### VerticalPianoRoll.tsx

**File path:** `client/src/components/studio/VerticalPianoRoll.tsx`

**Route/trigger:** Imported directly (not lazy) at `UnifiedStudioWorkspace.tsx:25`. Rendered twice:
- Mobile layout (`UnifiedStudioWorkspace.tsx:3276`) when the mobile "piano" tab is active.
- Desktop **MIX** surface (`UnifiedStudioWorkspace.tsx:4402-4439`), always mounted (`display:none/flex` toggle) so MIDI listeners survive tab switches, active when `activeView === 'piano-roll'`. Shows an "Audio Track Selected" placeholder instead of the grid if the selected track is an audio track.

**Purpose:** A step-based, multi-track MIDI piano-roll editor with live MIDI-keyboard input, chord/scale tooling, quantize/velocity/takes recording workflow, and an embedded vocal-take recorder for audio tracks.

#### Top toolbar (inline JSX)
- **Draw tool** button (`Pencil`) → `setPianoRollTool('draw')`
- **Select tool** button (`MousePointer2`) → `setPianoRollTool('select')`
- **Erase tool** button (`Eraser`) → `setPianoRollTool('erase')`
  *(note: `pianoRollTool` type also allows `'slice'`, but no button sets it — dead tool option)*
- **REC** button (`Circle`) → toggles `isRecording` via `handleRecord()`; label shows `REC • MIDI` / `REC • KEYS` when active
- **Q** (quantize-on-record) toggle button → `quantizeOnRecord` / `setQuantizeOnRecord`
- **Quantize grid** `<select>` (shown only when `quantizeOnRecord`) → `snapValue` / `setSnapValue`; options 1/1(4), 1/2(2), 1/4(1), 1/8(0.5), 1/16(0.25), 1/32(0.125)
- **VEL** button → toggles `showVelocityEditor`
- **TAKES (n)** button (shown only when `midiTakes.length > 0`) → toggles `showTakes`
- Key/progression status badge (read-only) — `currentKey` + `selectedProgression.name`
- **SUSTAIN** button (`Waves`) → toggles `liveSustainEnabled`
- **ARP** button (`Zap`) → toggles `liveArpEnabled`
- **MIDI** button (`Plug2`, shows green/red connection dot) → toggles `showMidiPanel`; dot reflects `midiConnected`
- **IMPORT** button (`FolderOpen`) → `importMIDI()` (opens `.mid` file picker)
- **EXPORT** button (`Download`) → `exportMIDI()`
- **LOOP** button (`Sparkles`) → toggles `showAILoopGenerator`

#### MIDI Takes panel (conditional `showTakes && midiTakes.length > 0`)
Per take: name, note count, timestamp, **Load** button (loads `take.notes` onto selected track) and **✕** delete button → filters `midiTakes`

#### Live Key Feel panel (conditional `liveSustainEnabled || liveArpEnabled`)
- **Release** `Slider` (20–1200ms, step 10, disabled unless `liveSustainEnabled`) → `liveReleaseMs` / `setLiveReleaseMs`
- Embedded `<Arpeggiator>` child component (separate file) when `liveArpEnabled` — receives `enabled`, `onEnabledChange=setLiveArpEnabled`, `bpm`, `activeNotes=liveArpNotes`, `instrument`; internal controls not expanded here

#### MIDI Interface panel (conditional `showMidiPanel`)
- **Close** button (`X`) → `setShowMidiPanel(false)`
- **MIDI Channel** `<select>` → `midiChannel` / `setMidiChannel`; options "All Channels" (0) + "Channel 1"–"Channel 16"
- Live Notes monitor (read-only, lists `midiActiveNotes`)
- "How To Record" help text (read-only)

#### Key/Scale + Chord row
- `keyScaleSelector` (memoized) → embeds `<KeyScaleSelector currentKey onKeyChange={handleKeyChange} selectedProgression onProgressionChange={handleProgressionChange} chordProgressions={CHORD_PROGRESSIONS}>` (separate file, not expanded)
- `chordProgressionDisplay` (memoized) → embeds `<ChordProgressionDisplay progression currentKey currentChordIndex onChordClick={handleChordClick} chordInversion>` (separate file, not expanded)

#### AI Loop Generator overlay (conditional `showAILoopGenerator`)
Embeds `<AILoopGenerator currentBpm={bpm} currentKey currentScale="minor" onClose={() => setShowAILoopGenerator(false)}>` (separate file, not expanded; `currentScale` is hardcoded to `'minor'` here)

#### Track Overview sidebar (conditional `showTrackOverview`)
- Embeds `<TrackControls tracks selectedTrack={selectedTrackIndex} onTrackSelect={handleTrackSelect} onVolumeChange={handleVolumeChange} onMuteToggle={handleMuteToggle} onInstrumentChange={handleInstrumentChange} showTrackList={false}>` (separate file — provides the actual volume/mute/instrument controls for the selected track, not expanded here)
- Per-track row (mapped): click → `setSelectedTrackIndex(idx)`
  - **Record-arm** circular button (`Circle`) → `toggleArm(track.id)` (adds/removes from `armedTracks` Set)
  - Vocal icon (`Mic2`, read-only) shown if `track.type === 'audio'`
  - Track name (read-only)
  - Mute status dot (read-only, reflects `track.muted`)
- **+ Add Vocal Track** button → pushes a new `type:'audio'` track into `tracks` and selects it

#### Grid area
- If selected track is `type === 'audio'`: renders `<StudioVocalRecorder>` (documented separately under Recording Booth group — internals skipped here; embedded with `trackId`, `trackName`, `trackColor="#a855f7"`, `bpm`, `isTransportPlaying={isPlaying}`, `isArmed`, `onTakesChange`)
- Otherwise renders three embedded editing panels (own files, not expanded):
  - `<PianoKeys>` — vertical virtual keyboard (`onKeyClick=addNote`, `onPlayNote=handlePianoKeyPlay`, `onPlayNoteOff=handleNoteOff`, `arpEnabled=liveArpEnabled`)
  - `<StepGrid>` — the main note-editing canvas (step/pitch grid; wires note add/remove/resize/move/copy/select, box-selection, snap/tool state, ghost notes, playhead click → `setCurrentStep`)
  - `<VelocityLane>` (conditional `showVelocityEditor && selectedTrack`) — per-note velocity editor bars

#### Notable dead/unused code (worth flagging to design)
- A memoized `playbackControls` element (built from `<PlaybackControls>` with play/stop/record/BPM/metronome/count-in/chord-mode props) is computed but **never rendered** in the returned JSX — leftover from before transport moved to the app-level chrome (the toolbar comment confirms: "transport now lives in the persistent studio chrome").
- Many `useState` fields (`arpeggioMode`, `arpeggioSpeed`, `humanizeAmount`, `transposeAmount`, `strumMode`, `swingAmount`, `scaleSnapEnabled`, `showNoteNames`, `loopStart/loopEnd/loopEnabled/loopNotes`, `automationLane`, `foldViewEnabled`, `horizontalZoom`/`verticalZoom`, `noteProbability`, `legatoMode`, `portamentoEnabled`, `noteRepeatEnabled`/`noteRepeatRate`, `mixerPanelOpen`, `browserPanelOpen`, `inspectorPanelOpen`) exist in state but have no corresponding control rendered in this file's JSX — likely planned/half-wired "pro" features.

---

## AI / Effects

### AIAssistant.tsx

**File path:** `client/src/components/studio/AIAssistant.tsx`

**Route/trigger:** Lazy-loaded in `UnifiedStudioWorkspace.tsx` and rendered directly inside the **AI Studio** surface (`activeView === 'ai-studio'`) plus the mobile `ai` tab. This is the full-page assistant, not the floating overlay.

**Purpose:** Chat-first AI workbench for music-production and coding help, with song upload, uploaded-song playback/analysis, quick prompt shortcuts, and transcript export.

**Controls:**
- Header buttons: **Clear Chat** (`clearChat()`), **Export** (`exportChatTranscript()`), **Start Audio** / disabled **Audio Ready** (`initialize()`; disabled after `isInitialized`).
- Upload block:
  - `<AIProviderSelector>` (`aiProvider` / `setAiProvider`)
  - **Upload Audio File** (`<ObjectUploader>`; 1 file, 50MB max) -> `handleUploadComplete()` / upload mutation
  - Upload spinner/status line while `uploadSongMutation.isPending`
- Chat transcript pane:
  - Read-only message bubbles from `messages`
  - Inline `<RecommendationList>` under AI messages when `message.recommendations` exists
  - Animated typing indicator while `chatMutation.isPending`
- Composer row:
  - Chat `<Input>` (`inputMessage`, Enter handled by `handleKeyPress`, disabled while pending)
  - Decorative mic icon button in the input adornment (no click handler)
  - Send button (paper-plane) -> `handleSendMessage()`, disabled when pending or blank
- Uploaded Songs card (shown when `songs.length > 0`):
  - Per-song **Play/Pause** toggle -> `playSong(song)` / pauses current `audioElement`
  - Per-current-song **Stop** button -> `stopSong()`
  - **Delete** button -> confirm dialog then `deleteSongMutation.mutate(song.id)`
  - **Analyze** button -> `analyzeSong(song)`
- Quick Actions list (4 buttons) -> set canned prompt and auto-send:
  - `Generate Beat Pattern`
  - `Optimize My Code`
  - `Compose Melody`
  - `Security Analysis`
- "Recent Suggestions" block is read-only sample content, not interactive.

### AIArrangementBuilder.tsx

**File path:** `client/src/components/studio/AIArrangementBuilder.tsx`

**Route/trigger:** Mounted as one of the AI Studio cards in `UnifiedStudioWorkspace.tsx` when `activeView === 'ai-studio'`.

**Purpose:** Generates a song arrangement plan from the current track list, then previews or applies section-by-section mute/volume states back onto the timeline.

**Controls:**
- Read-only track chips for the incoming `tracks` prop; warning banner if no tracks exist.
- Inputs:
  - **BPM** number input (`bpm`)
  - **Key** `<Select>` (`key`)
  - **Genre** `<Select>` (`genre`)
  - **Mood** `<Select>` (`mood`)
  - **Duration** range input (`duration`, 2-6 minutes)
- Primary CTA: **Arrange N Tracks** / **Generate Arrangement** -> `generateArrangement()`
- Result state (after generation):
  - Read-only **Total Length** (`arrangement.totalBars`)
  - Clickable **Sections** list: each section button -> `previewSection(i)` and highlights `activeSection`
  - Active-section **Track Mix** preview: read-only per-track active/muted state and volume bars
  - Read-only **Transitions** badges
  - Read-only **Production Tips** bullet list
  - **Apply Full Arrangement to Timeline** -> `applyFullArrangement()`

### AIVocalMelody.tsx

**File path:** `client/src/components/studio/AIVocalMelody.tsx`

**Route/trigger:** Mounted as one of the AI Studio cards in `UnifiedStudioWorkspace.tsx` when `activeView === 'ai-studio'`.

**Purpose:** Generates a vocal-topline melody from pasted lyrics plus key/BPM/mood/range constraints, optionally using current Organism chord context.

**Controls:**
- **Lyrics** `<Textarea>` (`lyrics`)
- **Key** `<Select>` (`key`)
- **BPM** number `<Input>` (`bpm`)
- **Mood** `<Select>` (`mood`)
- **Vocal Range** `<Select>` (`vocalRange`)
- Primary CTA: **Generate Vocal Melody** / **Composing Melody...** -> `generateMelody()`
- Result state:
  - Read-only **Singability** score
  - Read-only **Range** summary
  - Read-only **Melody Preview** syllable badges (first 16 notes, then `+n more`)
  - Read-only **Performance Tips**
  - **Add to Piano Roll** button (only if `onApplyMelody` prop exists) -> `onApplyMelody(result.notes)`

### AIStemSeparation.tsx

**File path:** `client/src/components/studio/AIStemSeparation.tsx`

**Route/trigger:** Mounted as one of the AI Studio cards in `UnifiedStudioWorkspace.tsx` when `activeView === 'ai-studio'`. Also receives routed songs from `SongUploader` through `sessionStorage`.

**Purpose:** Splits an uploaded song into stems, then optionally runs a second pipeline that clones the vocal stem with an ElevenLabs voice, renders a remix preview, and fetches mastering guidance.

**Controls:**
- Routed-state banners:
  - Tip banner when no `audioUrl` yet
  - "Song loaded" banner when a routed/uploaded source exists
- **Stem Count** `<Select>` (`stemCount`: 2 / 4 / 5)
- **ElevenLabs Voice ID** `<Input>` (`voiceId`)
- **Separate Stems** / loading state -> `startSeparation()`
- **Clone Vocal + Remix + Master Plan** / loading state -> `runCloneRemixMaster()`
- Read-only `pipelineStatus` box when any pipeline step is running/finished
- Separated-stems list (shown when `stems` exists):
  - Per stem **Play/Stop** button -> `playStem(name, url)`
  - Per stem **Download** link button
- **Send to Astutely for AI Remix** -> `sendToAstutely()`
- Optional result blocks:
  - **Cloned Vocal Stem** `<audio controls>` + download link
  - **Remix Preview** `<audio controls>` + download link
  - **Mastering Guidance** text block (overall score, top issues, quick fixes)

### AIMasteringCard.tsx

**File path:** `client/src/components/studio/AIMasteringCard.tsx`

**Route/trigger:** Mounted as one of the AI Studio cards in `UnifiedStudioWorkspace.tsx` when `activeView === 'ai-studio'`.

**Purpose:** Lightweight AI mastering-analysis card driven by peak/RMS/frequency props from `useMasteringAnalyzer()`.

**Controls:**
- **Genre** `<Select>` (`genre`)
- **Target LUFS** `Slider` (`targetLoudness`)
- **Analyze Mix** / **Analyzing Mix...** -> `analyzeMix()`
- Result state:
  - Read-only **Mix Score**
  - Read-only **Loudness**, **EQ Suggestions**, **Dynamics**
  - Read-only **Issues Found** list
  - Read-only **Quick Fixes** list
  - Optional **Apply Suggestions to Master Chain** button -> `onApplySuggestion('mastering', analysis)`

### AILoopGenerator.tsx

**File path:** `client/src/components/studio/AILoopGenerator.tsx`

**Route/trigger:** Overlay card inside `VerticalPianoRoll.tsx`; shown when the piano-roll toolbar's **LOOP** button toggles `showAILoopGenerator`.

**Purpose:** Rapid loop ideation tool for melody/drums/bass/chords and full-loop generation, with local library/archive management.

**Controls:**
- Rapid synthesis buttons:
  - **Melody**
  - **Drums**
  - **Bass**
  - **Chords**
  - All call `generateQuickContent(type)` and reflect `generatingType`
- Setting controls:
  - **Genre** `<Select>` (`genre`)
  - **Key** `<Select>` (`key`)
  - **Scale** `<Select>` (`scale`)
  - **BPM** `Slider` (`bpm`)
  - **Complexity** `Slider` (`complexity`)
  - **Arrangement Length** `Slider` (`bars`, 1-8)
- Engine-subsystem toggles:
  - **Drums**, **Bass**, **Chords**, **Melody** (`include*` booleans)
- Primary CTA: **Generate Full Sequence** / **Neural Rendering...** -> `generateFullLoop()`
- Library/archive row:
  - **Archive Loop** -> `setShowSaveDialog(true)`
  - **Neural Archive (n)** -> toggles `showLibrary`
- Save dialog:
  - **Archive Identifier** `<Input>` (`loopName`)
  - **Sync** -> `saveToLibrary()`
  - **X** close button -> `setShowSaveDialog(false)`
- Archive list (shown when `showLibrary`):
  - Per-loop **favorite** heart button -> `toggleFavorite(loop.id)`
  - **Recall** -> `loadFromLibrary(loop)`
  - **Delete** -> `deleteFromLibrary(loop.id)`

### AudioToolsPage.tsx

**File path:** `client/src/components/studio/AudioToolsPage.tsx`

**Route/trigger:** Lazy-loaded in `UnifiedStudioWorkspace.tsx` and rendered when `activeView === 'audio-tools'`.

**Purpose:** Thin wrapper around the audio-processing router, sourcing audio either from the current Studio song or from a locally loaded file.

**Controls:**
- No direct tool controls beyond its wrapper state.
- Read-only header showing the currently active source name when present.
- Embeds `<AudioToolRouter songUrl songName onAudioLoad={handleLocalAudioLoad}>`, which contains the actual processing controls documented below.

### client/src/components/studio/effects/AudioToolRouter.tsx

**Route/trigger:** Rendered inside `AudioToolsPage.tsx`, and also in `SongUploader.tsx` when that page flips into `showAudioTools` mode for the selected uploaded song.

**Purpose:** Entry router for the standalone audio-processing tools suite: load audio, preview it, auto-master it, open a specific effect tool, or route the source to Lyric Lab / Piano Roll.

**Controls:**
- Top source row:
  - **Load audio file** -> hidden file input -> `handleFileUpload()`
  - **Play/Pause** -> `handlePlayPause()`
  - **Stop** -> `handleStop()`
  - Read-only source badge / hint text
- **AI Auto Fix - Mix & Master Automatically** -> `handleAutoFix()`
- Read-only **AI Recommendations** block when `recommendations.length > 0`
- Tool grid buttons -> `setActiveTool(tool.type)` for:
  - `Equalizer`
  - `Compressor`
  - `Deesser`
  - `Reverb`
  - `Limiter`
  - `Noise Gate`
  - `Delay / Echo`
  - `Chorus / Flanger`
  - `Saturation / Distortion`
- Route-to-other-tools buttons:
  - **Open in Lyric Lab** -> `handleOpenInLyricLab()`
  - **Open in Piano Roll** -> `handleOpenInPianoRoll()`
- Tool-open state:
  - **Back to Tool Selection** button -> `setActiveTool(null)`
  - Selected plugin component fills the panel until closed

### EffectsChainPanel.tsx

**File path:** `client/src/components/studio/EffectsChainPanel.tsx`

**Route/trigger:** Rendered by `StudioWindowRenderer.tsx` when a floating Studio window has `type === 'effects-chain'`. Distinct from the simpler EQ/Compressor/NoiseGate modal in `UnifiedStudioWorkspace`.

**Purpose:** Per-track effect-chain editor with drag reorder, bypass, presets, parameter sliders, and add/remove/reset controls.

**Controls:**
- Per-effect row:
  - Drag handle (`GripVertical`) -> drag reorder (`handleDragStart/Over/End`)
  - Power button -> enable/bypass (`handleToggleEffect`)
  - Header button -> expand/collapse parameter panel
  - Reset button -> `handleResetEffect()`
  - Remove button -> `handleRemoveEffect()`
- Expanded effect panel:
  - Optional **Load preset...** `<Select>` -> `handleLoadPreset()`
  - One `Slider` per parameter range -> `handleParamChange(effectId, param, value)`
- Footer **Add Effect** `<Select>` -> `handleAddEffect(type)` from `EFFECT_DEFINITIONS`

### FloatingAIAssistant.tsx

**File path:** `client/src/components/studio/FloatingAIAssistant.tsx`

**Route/trigger:** **Currently not live.** `UnifiedStudioWorkspace.tsx` still imports it, but the render block at lines ~4576-4579 is commented out with "TEMPORARILY DISABLED - React hooks error on mobile."

**Purpose (as written):** Draggable/minimizable floating assistant overlay with a compact chat transcript and composer.

**Controls (if re-enabled):**
- Minimized state: **AI Assistant** launcher button -> restore full card
- Header buttons: **Minimize** -> `setIsMinimized(true)`, **Close** -> `onClose()`
- Chat `<Textarea>` (`input`, Enter sends / Shift+Enter newline)
- Send button -> `handleSend()`

---

## DAW Panels — Group B

### BeatLab.tsx

**File path:** `client/src/components/studio/BeatLab.tsx`

**Route/trigger:** Rendered in `UnifiedStudioWorkspace.tsx` whenever `activeView === 'beat-lab'` (desktop and mobile). Acts as the tab shell around several beat-oriented tools.

**Purpose:** Beat-creation hub that wraps the full drum sequencer, AI bass generator, loop library, and pack generator, and auto-routes resulting material into the Studio timeline.

**Controls:**
- Header route buttons:
  - **Mixer** icon -> `handleRoute('mixer')`
  - **Audio Tools** icon -> `handleRoute('audio-tools')`
  - **Save / Export** icon -> `handleRoute('uploader')`
- Main tab bar (`activeTab`):
  - **Pro Beat Maker**
  - **Bass Studio**
  - **Loop Library**
  - **Pack Generator**
- Tab contents:
  - `Pro Beat Maker` -> embeds `<ProBeatMaker isActive onPatternChange>`
  - `Bass Studio` -> embeds `<AIBassGenerator>`; generated notes are added to timeline via `addTrack(...)`
  - `Loop Library` -> embeds `<LoopLibrary>`
  - `Pack Generator` -> embeds `<PackGenerator>`

### ProBeatMaker.tsx

**File path:** `client/src/components/studio/ProBeatMaker.tsx`

**Route/trigger:** Mounted inside `BeatLab.tsx` on the **Pro Beat Maker** tab.

**Purpose:** Full drum-machine / step-sequencer surface with A/B variations, swing/groove/humanize, kit selection, MIDI learn, per-step parameters, and routing into the main timeline.

**Controls:**
- Header variation toggle: **A** / **B** -> `switchVariation('A'|'B')`
- Main transport/kit row:
  - **Play / Stop** -> toggles `isPlaying`
  - **Click** metronome toggle -> `metronomeOn`; when enabled exposes metronome-volume `Slider`
  - **Tap** tempo button -> `handleTapTempo()`
  - **Kit** `<Select>` (`selectedKit`) -> `changeKit()`
  - **Genre** `<Select>` (`selectedGenre`) for preset vocabulary
- Pattern utility row:
  - **Seq Length** `<Select>` (`patternLength`: 8/16/32/64)
  - **Random** -> `randomize()`
  - **Clear** -> `clearAll()`
  - **Undo** / **Redo**
  - **Fill** -> `generateFill()`
  - **Accent** -> `applyAccentPattern()`
  - **Export WAV** -> `exportBeatAsAudio()`
  - **Humanize** `Slider` (`humanize`) + **Inject** -> `applyHumanize()`
- Global processing lane:
  - **Master Gain** knob + meter + fader (`masterVol`)
  - **Temporal Swing** `Slider` (`swing`)
  - **Backbeat Groove** `Slider` (`groove`)
  - **Global Tempo** numeric input (`bpm`)
  - **MIDI Interface** toggle -> `setShowMidiMappingPanel(...)`
- MIDI Interface panel (conditional):
  - Per-drum **MIDI Learn** buttons -> arm `midiLearnMode` for that track
  - **Cancel Learn Mode**
  - Read-only **Current Mappings** list
  - Read-only **Active Notes** pills
- Selected-step popup (right-click a step):
  - **Velocity** `Slider`
  - **Probability** `Slider`
  - **Flam Unit** toggle button
  - **Burst Roll** `<Select>` (`0/2/3/4`)
  - **Shift Pitch** `Slider`
  - **X** close button
- Sequencer grid:
  - Per-track mini controls: **Pan** `Slider`, **M** mute, **S** solo, **Gain** `Slider`
  - Step cells: left click toggles active step; right click opens selected-step editor
  - Per-track hover actions: **Copy Pattern**, **Paste Pattern**
- Footer route buttons:
  - **DE-MULTIPLEX TO TIMELINE** -> saves drum notes into timeline/store and returns to `/studio`
  - **CROSS-ROUTE TO MIXER** -> dispatches `navigateToTab('mixer')`

### DawArrangementView.tsx

**File path:** `client/src/components/studio/DawArrangementView.tsx`

**Route/trigger:** Rendered as the desktop **Arrangement** view inside `UnifiedStudioWorkspace.tsx` when `activeView === 'arrangement'`.

**Purpose:** Timeline/clip arranger for Studio tracks, with zoom, loop-ruler, clip drag/resize, per-track mini-mixer strips, and an inline lower split that opens the piano roll for the selected track.

**Controls:**
- Top toolbar:
  - **Zoom out** button
  - Zoom range input (`zoom`)
  - **Zoom in** button
  - `<UndoRedoToolbar>`
  - **Add Track** -> `onAddTrack('New Track', 'midi')`
  - **Loop** toggle -> enables loop mode, then drag on ruler to set region
  - **Export Stems** -> `exportStems()`
- Empty arrangement CTA row (when no tracks/clips in view):
  - **Add Melody**
  - **Record Vocal**
- Ruler lane:
  - Drag on ruler while loop mode is enabled -> sets `loop.start` / `loop.end`
  - `SectionMarkers` embedded for section placement/editing
- Per-track sticky header:
  - Click color strip -> hidden color picker
  - Double-click name -> rename inline `<input>`
  - Hover buttons: **M**, **S**, **Open in editor**, **FX / EQ strip**, **Automation lane**, **Delete**
- Expanded FX strip per track:
  - **Vol**, **Pan**, **Hall**, **Delay**, **Lo EQ**, **Hi EQ** range inputs
- Clip lane:
  - Double-click empty space -> create new 4-bar clip
  - Click / Shift-click -> select clips
  - Drag clip body -> move
  - Drag right resize handle -> resize
  - Double-click clip -> `openEditor(track)`
  - Right-click clip -> context menu
- Inline lower editor pane (when `editorTrackId` is set):
  - **Open in full tab** button
  - **Close editor** button
  - Embedded `<VerticalPianoRoll selectedTrack={editorTrackId}>`
- Clip context menu:
  - **Copy**
  - **Paste**
  - Additional clip actions continue below this snippet in-file

### ProfessionalMixer.tsx

**File path:** `client/src/components/studio/ProfessionalMixer.tsx`

**Route/trigger:** Rendered directly when `activeView === 'mixer'`, also reachable via `StudioWindowRenderer` for floating windows, and reused by `MasterMultiTrackPlayer` as an embedded panel.

**Purpose:** Multi-channel mixing console with live meters, channel strips, send/return routing, sidechain ducking, master output, AI mix/remix panel, and spectrum/analyzer views.

**Controls:**
- Header:
  - Transport **Play / Stop** toggle button (`isPlaying`)
  - Initialization fallback state: **Retry** / **Continue Anyway** if the audio engine times out
- Main tab bar (`activeTab`):
  - **CHANNELS**
  - **BUS / SENDS**
  - **MASTER**
  - **AI MIXING**
  - **SPECTRUM**
- Channels tab:
  - Per-channel strip:
    - Select strip by clicking it
    - **PAN** `Slider`
    - **MUTE** button
    - **SOLO** button
    - Vertical **volume fader** `Slider`
    - Read-only RMS/peak meters
- Bus / Sends tab:
  - Per-send return card:
    - **Return** `Slider`
    - **Wetness** `Slider`
  - Per-channel send-assignment cards:
    - One `Slider` per assigned send
  - `SidechainControl` instances per non-drum channel:
    - enable/disable sidechain
    - source selection
    - attack/release/depth/etc. controls live inside the child component
- Master tab:
  - **Master Gain** `Slider`
  - Read-only master RMS/PEAK meters and stat tiles
  - Read-only DSP cards for compressor/limiter settings (current sliders are display-only in this snippet)
- AI Mixing tab:
  - **Upload Separated Stems** -> hidden multi-file input
  - Optional **Clear** stems button
  - Prompt `<Textarea>` (`aiPrompt`)
  - **GENERATE MASTER MIX** / **REMIX STEMS** -> `handleAIMix()`
  - Mix preview block:
    - native `<audio controls>`
    - **Play/Pause**
    - **Stop**
    - **Render Mixed Bounce**
    - **Download Mix**
- Spectrum tab:
  - Read-only analyzer canvas and stats (rendered lower in the file)

### SongUploader.tsx

**File path:** `client/src/components/studio/SongUploader.tsx`

**Route/trigger:** Lazy-loaded in `UnifiedStudioWorkspace.tsx` and rendered when `activeView === 'song-uploader'`.

**Purpose:** Uploads existing songs into a user library, then layers analysis, transcription, lyrics workflows, stem-routing, public sharing, Suno transforms, speech-correction, and Audio Tools handoff on top of each song.

**Controls:**
- Top upload row:
  - **Upload Song** (`<SimpleFileUploader>`) -> upload + `uploadSongMutation`
  - Read-only uploaded-song count badge
  - Selected-song banner with embedded `<WaveformVisualizer showControls>`
- Special `showAudioTools` mode:
  - **← Back to Song Library**
  - Embedded `<AudioToolRouter>` for the selected analyzed song
- Speech Correction card:
  - **Select song** `<Select>` (`speechSongId`)
  - **Word Transcribe** -> `runSpeechTranscribe()`
  - **Preview Regen** -> `runSpeechPreview()`
  - **Commit** -> `runSpeechCommit()`
  - **Edit Transcript** `<Textarea>` (`speechTranscript`)
  - Read-only original/preview `<audio controls>` players
- Per-song action row:
  - **Load**
  - **Analyze**
  - **Transcribe**
  - **Transcribe + Analyze**
  - **Analyze Lyrics**
  - **Add to Tracks**
  - **Separate Stems** -> routes to `AIStemSeparation`
  - **Download**
  - **Delete**
  - **Public / Private** toggle
  - **Copy Share Link** (public songs only)
  - **Suno AI** action `<Select>`:
    - `Cover (Transform Style)`
    - `Extend Song`
    - `Separate Vocals`
    - `Add AI Vocals`
    - `Add AI Instrumental`
  - **Open Tools** (only after current song analysis exists)
- Inline content under a song:
  - Read-only metadata (size, upload date, duration, status)
  - **Transcribed Lyrics** block with **Copy** and **Send to Lyrics Tab**
  - **Analysis Results** block with **Expand / Collapse**
  - Expanded read-only analysis/lyrics metrics, rewrite suggestions, audience-fit blocks, etc.
- Suno prompt modal (for all Suno actions except instant `separate`):
  - Prompt `<Input>` varies by action (`cover` / `extend` / `add-vocals` / `add-instrumental`)
  - **AI Model** `<Select>` (`sunoModel`)
  - **Cancel**
  - **Generate with Suno**

### ProAudioGenerator.tsx

**File path:** `client/src/components/studio/ProAudioGenerator.tsx`

**Route/trigger:** Not a primary tab anymore. It is still mounted in `UnifiedStudioWorkspace.tsx` as the modal/overlay shown by `showMusicGen`, with a top-right **Close** button owned by the workspace shell.

**Purpose:** Reference-beat generator for ACE-Step style prompt-to-instrumental rendering, with quick-start recipes, advanced prompt controls, and a result player/library handoff.

**Controls:**
- Quick Start recipe grid -> `applyRecipe(recipe)`
- Accordion form:
  - **Basics**
    - **Describe your reference beat** `<Textarea>` (`songDescription`)
    - **Genre** `<Select>`
    - **Mood** `<Select>`
    - Read-only **Render Engine** panel (`ACE-Step instrumental`)
    - **Duration** `Slider`
    - **BPM** `Slider`
    - **Key** `<Select>`
    - **Generate 3 options** `Switch`
  - **Sound & Instruments**
    - Per-instrument `Checkbox` grid
    - **Style (optional)** `<Input>`
    - Disabled **Vocals** switch (instrumental-only)
  - **Advanced**
    - Disabled **Arrangement Structure** `<Select>`
    - **Variations** `<Select>`
    - **Seed** numeric `<Input>` + **Randomize** / **Clear**
    - Disabled **Melody Guide URL** `<Input>`
    - Disabled **Stem Separation / Stem Import / Require Stems** switches
- Metrics / warnings:
  - **Refresh** AI Generation Metrics
  - Read-only provider-cap and request-meta warning blocks
- Primary CTA:
  - **Render Reference Beat** / **Render 3 ACE Options** -> `generateMutation.mutate()`
- Result state:
  - Play/pause player button + seek `Slider`
  - **Download**
  - **Save to Library**
  - **Copy Link**
  - **Edit in Piano Roll**
  - **Generate Another**
  - Variation-picker buttons when multiple outputs exist
