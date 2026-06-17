# Master Duplicate Kill-List — the complete inventory

_2026-06-17. The app launch is blocked by DUPLICATE/competing systems and hidden
duplicate UI elements ("doubles that haunt us") that break already-built features.
Goal: ONE accounting of every duplicate, so they're eliminated methodically — not
discovered piecemeal over months. Winner = the one to keep; everything else dies.
Measured live (window.__orgDebug + AudioNode.connect probe + import tracing)._

**Rule for execution:** delete losers ONE at a time, verify behavior unchanged
(tsc + `npm run test:unit` + the live path still works), commit. Never bundle.
Confidence tags: ✅CONFIRMED · 🔶STRONG (verify root dead) · ❓NEEDS-TRACE.

---

## Category 1 — Audio engines / sound sources
| Duplicate | Where | Status | Verdict |
|---|---|---|---|
| GeneratorOrchestrator (Tone.js generators) | `organism/generators/` | ✅ live (the AI band) | **WINNER** for the Organism |
| Legacy studio engine | `lib/audioEngine.ts` (431L) + `hooks/use-audio.ts` (240L) + `lib/audio.ts` | ✅ live; ~10 studio components consume it | Coexists w/ Organism — decide: one engine or clearly-separated roles |
| **OrganismV2LoopPlayer** | `organism/v2/OrganismV2LoopPlayer.ts` | ✅ FOSSIL — instantiated, `.stop()`/`.setMasterGain()`/status-subscribed, but **play method NEVER called** → makes no sound | **DELETE** (separate the dead player from `v2Status` UI state first — §4) |
| Melody source #1 — synth MelodyGenerator | `organism/generators/MelodyGenerator.ts` | ✅ live | **WINNER** (real-instrument lead) |
| Melody source #2 — MelodicLoopPlayer | `organism/loops/MelodicLoopPlayer.ts` | ✅ live, routes to melody channel; mostly parked (USE_CHOP_LAYER/USE_LOOP_LEAD=false) | Demote to texture or delete — melody-doubles decision |
| Sample/instrument LOADING | `organism/instruments/SamplerUtils.ts` | ✅ CONSOLIDATED — single path | **NOT a double** (good) |

## Category 2 — Transports & clocks
| Duplicate | Where | Status | Verdict |
|---|---|---|---|
| `Tone.Transport` start/stop callers | 10 files: App, GlobalTransportBar, MakeSurface, VerticalPianoRoll, TransportContext, CountInEngine, OrganismProvider, use-audio, audioEngine, packAudioSynthesizer | 🔶 sprawl vs "TransportContext = sole owner" rule | **TransportContext = WINNER**; route every other caller through it (or gate so only one drives the singleton) |
| Transport UI — `GlobalTransportBar` | studio chrome (StudioShell) | ✅ live | **WINNER** |
| Transport UI — `TransportControls` | only via `DAWLayoutWorkspace` (legacy tabs) | 🔶 dies with studioTabs subtree | **DELETE** (with §6) |
| Organism Start panel | OrganismProvider | ✅ live, second play button on /studio/mix | Make it DRIVE TransportContext, not a parallel clock |
| Schedulers | `arrangementScheduler`, `pianoRollScheduler`, transport bar, TransportContext | ❓ confirm one owns scheduling | TransportContext owns lifecycle per architecture |

## Category 3 — Mixers (THREE live)
| Duplicate | Where | Status | Verdict |
|---|---|---|---|
| `ProfessionalMixer` | UnifiedStudioWorkspace (5 importers) | ✅ live, main | **WINNER** |
| `MixerWithBuses` | StudioWindowRenderer (pop-out windows) — live | ✅ live in a 2nd surface | **MERGE into ProfessionalMixer** or make pop-out reuse it |
| `Mixer` | studioTabs (legacy flat tabs) | 🔶 dies with studioTabs | **DELETE** (with §6) |
| Mix authority | MixEngine `setChannelGainDb` vs per-generator multipliers vs `professionalAudio`/`astutelyMixerBridge` | 🔶 inconsistent (some faders dead) | **MixEngine channel strips = WINNER**; remove per-generator gain path |

## Category 4 — State / sources of truth
| Duplicate | Where | Status | Verdict |
|---|---|---|---|
| Track/note store #1 | `stores/useStudioStore.ts` (zustand): `tracks: Record<GeneratorType,StudioNote[]>` + `currentTracks: any[]` + `currentMelody`/`pendingMelodyNotes` | ✅ live | candidate **WINNER** (the "one document" spine) |
| Track/note store #2 | `contexts/TrackStoreContext.tsx`: `tracks: TrackClip[]` (+ server save/load) | ✅ live, DIFFERENT shape | reconcile to ONE track model |
| Multiple note buckets inside useStudioStore | `tracks` vs `currentTracks` vs `currentMelody` vs `pendingMelodyNotes` | 🔶 several note arrays | collapse to one |
| Session contexts ×3 | `StudioSessionContext`, `SongWorkSessionContext`, `SessionDestinationContext` | ❓ overlap? | trace; collapse overlap |
| `v2Status` state | OrganismProvider (set ~1707/1852) drives "Live Generator" UI panel | ⚠️ may be repurposed to show orchestrator status, separate from dead v2 player | keep the status display, cut the dead player it implies |

## Category 5 — Duplicate UI components / surfaces
| Duplicate | Where | Status | Verdict |
|---|---|---|---|
| Workspace shells: `UnifiedStudioWorkspace` vs `DAWLayoutWorkspace` vs legacy `studioTabs` tabs | StudioShell mounts UnifiedStudioWorkspace; studioTabs still in App/Sidebar/MobileNav | 🔶 TWO navigation/surface systems coexist | **UnifiedStudioWorkspace = WINNER**; retire studioTabs flat-tab system + DAWLayoutWorkspace |
| `MobileStudioLayout` | inside UnifiedStudioWorkspace | ✅ live mobile variant (portrait Mix = few buttons), no legacy-tab deps | **KEEP** |
| `DawArrangementView` | rendered by UnifiedStudioWorkspace | ✅ live (timeline) | **KEEP** |
| Beat makers: `BeatLab` (container) + `ProBeatMaker` (its 'pro' tab) | UnifiedStudioWorkspace | ✅ live, nested (not rival) | **KEEP both** (container + tab) |
| Two transport bars on one screen (`/studio/mix`) | GlobalTransportBar (bottom) + Organism Start (panel) | ✅ user-visible double | see §2 |
| `MelodyComposerV2` (implies a V1) | — | ❓ trace V1 | delete V1 if present |

## Category 6 — The legacy `studioTabs` subtree (✅ CONFIRMED DEAD — safe delete)
RESOLVED 2026-06-17 by live render tracing:
- `/studio/:surface*` → `StudioShell` → `UnifiedStudioWorkspace` (App.tsx:309 comment:
  "StudioShell owns the 4-surface routing MAKE/MIX/SHARE/LIBRARY"). All old routes
  (/beat-studio, /unified-studio, /music-studio, …) REDIRECT away.
- `Sidebar` rendered NOWHERE. `MobileNav` rendered NOWHERE. Both DEAD.
- `studioTabs.tsx` appears in App.tsx only in a COMMENT; its only importers are the dead
  Sidebar + MobileNav. ORPHANED.
- `MobileStudioLayout` = the LIVE mobile variant, but it lives INSIDE UnifiedStudioWorkspace
  and does NOT use studioTabs/old tabs → **KEEP** (confirmed real; user: "mobile mostly
  mirrors desktop except the Mix studio in portrait = a few buttons").
**ACTION (safe):** delete `studioTabs.tsx` + `Sidebar.tsx` + `MobileNav.tsx` +
`Mixer.tsx` + `DAWLayoutWorkspace.tsx` + `TransportControls.tsx` (TransportControls is
imported only by DAWLayoutWorkspace). Before deleting `MelodyComposerV2` and other
studioTabs-listed components, verify each isn't ALSO imported by a live file (e.g.
ProfessionalMixer/BeatLab/VerticalPianoRoll/LyricLab/SongUploader/AIAssistant ARE live
elsewhere — keep those). This is the single biggest line-reduction in the app, zero
user-facing change.

## Category 7 — Generation / AI paths
| Duplicate | Where | Verdict |
|---|---|---|
| `AIProviderSelector` dropdowns (MusicGen/Suno/Grok/OpenAI/Local) vs Organism vs ACE-Step | AstutelyChatbot panels, OrganismCommandCenter, ACE render | clarify: editable-notes generation vs audio render vs live band — name one path per output type |

---

## Recommended kill order (lowest risk → highest leverage)
1. ✅ **DONE** **v2 fossil** (§1) — deleted player + whole organism/v2/ dir, kept v2Status display. (commit)
2. ✅ **DONE** **studioTabs subtree** (§6) — deleted studioTabs+Sidebar+MobileNav+Mixer+DAWLayoutWorkspace+TransportControls (−2424 lines) + 7 orphaned tools it exposed (−3416 lines). (2 commits)
   — KEPT in-tree: MIDIController, CodeTranslator, MusicToCode (near-term intent).
   — DELETED orphans recoverable from git: MelodyComposerV2, OutputSequencer, SongStructureManager, DynamicLayering, GranularEngine, WavetableOscillator, PerformanceMetrics.
3. ⬜ **Mixer consolidation** (§3) — pop-out reuses ProfessionalMixer; remove per-generator gain path. (MERGE — needs care)
4. ⬜ **Transport consolidation** (§2) — all callers through TransportContext; Organism Start drives it. (MERGE)
5. ⬜ **State reconciliation** (§4) — one track model (the spine for the AI-uses-tools vision). (MERGE — design decision)
6. ⬜ **Melody-doubles decision** (§1) — which lead source wins. (DECISION)

**Run 2026-06-17 tally:** 14 files deleted, ~5,840 lines, 431 tests green throughout, zero
user-facing change. Remaining items (3-6) shift from "delete dead weight" (done) to "merge
LIVE duplicates" — riskier, need decisions, not pure deletes.

Each step: delete → tsc + test:unit + live-path check → commit. Then re-audit to confirm
the category is truly closed. When the list is exhausted, the app is consolidated and
launch-ready; THEN new ideas (AI-uses-all-tools, pads, pluckable instruments) build on
the single spine.
