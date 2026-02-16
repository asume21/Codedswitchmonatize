# CodedSwitch App — Complete File Map

Every file that makes the app work, organized by system.

---

## PAGES (what users see)

| File | What it is |
|---|---|
| `client/src/pages/landing.tsx` | Landing/home page |
| `client/src/pages/login.tsx` | Login page |
| `client/src/pages/signup.tsx` | Signup/registration page |
| `client/src/pages/activate.tsx` | Account activation page |
| `client/src/pages/dashboard.tsx` | User dashboard after login |
| `client/src/pages/studio.tsx` | Main studio page — loads the DAW workspace |
| `client/src/pages/pro-audio.tsx` | Pro Audio Generator page (Suno/MusicGen) |
| `client/src/pages/settings.tsx` | User settings/preferences |
| `client/src/pages/social-hub.tsx` | Social feed — discover/share music |
| `client/src/pages/user-profile.tsx` | Public user profile page |
| `client/src/pages/public-song.tsx` | Public song sharing page |
| `client/src/pages/buy-credits.tsx` | Credit purchase page |
| `client/src/pages/credits-success.tsx` | Payment success confirmation |
| `client/src/pages/credits-cancel.tsx` | Payment cancelled page |
| `client/src/pages/Subscribe.tsx` | Subscription page |
| `client/src/pages/design-playground.tsx` | Layout playground/customizer |
| `client/src/pages/vulnerability-scanner.tsx` | Security scanner page |
| `client/src/pages/sitemap-page.tsx` | Sitemap |
| `client/src/pages/not-found.tsx` | 404 page |
| `client/src/pages/ai-assistant.tsx` | AI assistant page entry |
| `client/src/pages/test-piano-roll.tsx` | Piano roll test page |
| `client/src/pages/TestCircular.tsx` | Circular dependency test |

---

## ASTUTELY (AI Beat Brain)

| File | What it does |
|---|---|
| `client/src/lib/astutelyEngine.ts` | **THE BRAIN** — core generation logic. Takes style/prompt/tempo/key, calls AI, returns drum/bass/chord/melody patterns |
| `client/src/lib/astutelyBridge.ts` | **Bridge** — connects engine output to studio timeline tracks |
| `server/routes/astutely.ts` | **Server API** — backend endpoints the engine calls for AI generation |
| `server/ai/prompts/astutelyPrompt.ts` | **Prompt templates** — the text sent to AI models that shapes what gets generated |
| `shared/astutelyFallback.ts` | **Fallback patterns** — offline safety beats when no AI provider is reachable |
| `client/src/components/ai/AstutelyPanel.tsx` | **Beat Gen Panel** — the modal UI with style grid, song library, generate button |
| `client/src/components/ai/AstutelyChatbot.tsx` | **Chat interface** — conversational Astutely mode |
| `client/src/components/astutely/AstutelyControls.tsx` | **Inline controls** — smaller Astutely controls embedded in studio |
| `client/src/styles/astutely-theme.css` | **Theme** — visual styling for Astutely components |

---

## STUDIO / DAW (the music workspace)

| File | What it does |
|---|---|
| `client/src/components/studio/UnifiedStudioWorkspace.tsx` | **Main studio workspace** — the top-level DAW layout that holds everything (203KB, biggest file) |
| `client/src/components/studio/ProfessionalStudio.tsx` | **Pro studio view** — professional DAW interface |
| `client/src/components/studio/MasterMultiTrackPlayer.tsx` | **Multi-track player** — plays/manages all tracks together (183KB) |
| `client/src/components/studio/VerticalPianoRoll.tsx` | **Piano roll** — note editing grid (107KB) |
| `client/src/components/studio/LyricLab.tsx` | **Lyrics editor** — write/edit/generate lyrics |
| `client/src/components/studio/ProBeatMaker.tsx` | **Beat maker** — drum machine / beat creation |
| `client/src/components/studio/ProfessionalMixer.tsx` | **Mixer** — channel strips, EQ, effects |
| `client/src/components/studio/Mixer.tsx` | **Simple mixer** — basic mixing interface |
| `client/src/components/studio/MixStudio.tsx` | **Mix studio** — mixing workspace |
| `client/src/components/studio/MixerStudio.tsx` | **Mixer studio** — another mixing view |
| `client/src/components/studio/MusicMixer.tsx` | **Music mixer** — music-focused mixing |
| `client/src/components/studio/ProAudioGenerator.tsx` | **Pro Audio** — AI song generation (Suno/MusicGen/Stable Audio) |
| `client/src/components/studio/SongUploader.tsx` | **Song uploader** — upload songs to library (113KB) |
| `client/src/components/studio/SongUploadPanel.tsx` | **Upload panel** — simpler upload UI |
| `client/src/components/studio/TransportControls.tsx` | **Transport** — play/stop/record/tempo controls |
| `client/src/components/studio/GlobalTransportBar.tsx` | **Global transport bar** — persistent transport at top |
| `client/src/components/studio/DAWLayoutWorkspace.tsx` | **DAW layout** — panel arrangement for the workspace |
| `client/src/components/studio/DAWMultiTrackPianoRoll.tsx` | **Multi-track piano roll** — piano roll across tracks |
| `client/src/components/studio/WaveformVisualizer.tsx` | **Waveform display** — audio waveform rendering |
| `client/src/components/studio/TrackWaveformLane.tsx` | **Track lane** — individual track waveform |
| `client/src/components/studio/TrackControls.tsx` | **Track controls** — mute/solo/volume per track |
| `client/src/components/studio/StepGrid.tsx` | **Step grid** — step sequencer grid |
| `client/src/components/studio/InstrumentLibrary.tsx` | **Instrument browser** — pick instruments |
| `client/src/components/studio/SampleBrowser.tsx` | **Sample browser** — browse audio samples |
| `client/src/components/studio/LoopLibrary.tsx` | **Loop library** — browse/use loops |
| `client/src/components/studio/ExportStudio.tsx` | **Export** — export/download finished tracks |
| `client/src/components/studio/Header.tsx` | **Studio header** — top bar in studio |
| `client/src/components/studio/MTPHeader.tsx` | **MTP header** — multi-track player header |
| `client/src/components/studio/MTPHeaderContainer.tsx` | **MTP header container** — wraps MTP header |
| `client/src/components/studio/InspectorPanel.tsx` | **Inspector** — property inspector for selected items |
| `client/src/components/studio/KeyScaleSelector.tsx` | **Key/scale picker** — musical key selection |
| `client/src/components/studio/PlaybackControls.tsx` | **Playback** — basic play/pause controls |
| `client/src/components/studio/PianoKeys.tsx` | **Piano keys** — visual piano keyboard |
| `client/src/components/studio/PianoRollPreview.tsx` | **Piano roll preview** — small preview of notes |
| `client/src/components/studio/GridOverlay.tsx` | **Grid overlay** — visual grid lines |
| `client/src/components/studio/StudioMenuBar.tsx` | **Menu bar** — file/edit/view menus |
| `client/src/components/studio/Sidebar.tsx` | **Sidebar** — studio side panel |
| `client/src/components/studio/MobileNav.tsx` | **Mobile nav** — mobile navigation |
| `client/src/components/studio/MobileStudioLayout.tsx` | **Mobile layout** — mobile-optimized studio |
| `client/src/components/studio/SplitLayoutRenderer.tsx` | **Split layout** — split-pane rendering |
| `client/src/components/studio/WorkflowSelector.tsx` | **Workflow picker** — choose studio workflow |
| `client/src/components/studio/SessionStatusIndicators.tsx` | **Session status** — connection/save indicators |
| `client/src/components/studio/SubscriptionButton.tsx` | **Subscribe button** — upgrade CTA |
| `client/src/components/studio/PerformanceMetrics.tsx` | **Performance** — CPU/memory/latency display |
| `client/src/components/studio/TunerModal.tsx` | **Tuner** — instrument tuner |

---

## AI TOOLS (studio AI features)

| File | What it does |
|---|---|
| `client/src/components/studio/AIAssistant.tsx` | **AI Assistant** — general AI helper in studio |
| `client/src/components/studio/FloatingAIAssistant.tsx` | **Floating AI** — draggable AI assistant |
| `client/src/components/studio/AIArrangementBuilder.tsx` | **AI Arrangement** — auto-arrange song sections |
| `client/src/components/studio/AIBassGenerator.tsx` | **AI Bass** — generate bass lines |
| `client/src/components/studio/AILoopGenerator.tsx` | **AI Loops** — generate audio loops |
| `client/src/components/studio/AIMasteringCard.tsx` | **AI Mastering** — auto-master tracks |
| `client/src/components/studio/AIStemSeparation.tsx` | **AI Stems** — separate vocals/drums/bass/other |
| `client/src/components/studio/AIVocalMelody.tsx` | **AI Vocal Melody** — generate vocal melodies |
| `client/src/components/studio/AudioAnalysisPanel.tsx` | **Audio Analysis** — analyze uploaded audio |
| `client/src/components/studio/AudioDetector.tsx` | **Audio Detection** — detect BPM/key/genre |
| `client/src/components/studio/SongAnalysisPanel.tsx` | **Song Analysis** — detailed song analysis |
| `client/src/components/studio/SongStructureManager.tsx` | **Structure Manager** — manage song sections |
| `client/src/components/studio/CodeToMusic.tsx` | **Code to Music** — convert code to music |
| `client/src/components/studio/CodeToMusicStudio.tsx` | **Code to Music Studio** — full code-music workspace |
| `client/src/components/studio/CodeToMusicStudioV2.tsx` | **Code to Music V2** — updated version |
| `client/src/components/studio/CodeTranslator.tsx` | **Code Translator** — translate between code formats |
| `client/src/components/studio/MusicToCode.tsx` | **Music to Code** — convert music to code |
| `client/src/components/studio/MusicGenerationPanel.tsx` | **Music Gen Panel** — music generation UI |
| `client/src/components/studio/MelodyComposerV2.tsx` | **Melody Composer** — compose melodies |
| `client/src/components/studio/ChordProgressionDisplay.tsx` | **Chord Display** — show chord progressions |
| `client/src/components/studio/ModularChordProgression.tsx` | **Modular Chords** — modular chord builder |
| `client/src/components/studio/Arpeggiator.tsx` | **Arpeggiator** — arpeggiate chords |
| `client/src/components/studio/DynamicLayering.tsx` | **Dynamic Layering** — layer sounds dynamically |
| `client/src/components/studio/HybridWorkflow.tsx` | **Hybrid Workflow** — combined workflow mode |
| `client/src/components/studio/VocalRecordingTrack.tsx` | **Vocal Recording** — record vocals |
| `client/src/components/studio/VoiceConversion.tsx` | **Voice Conversion** — AI voice transformation |
| `client/src/components/studio/LyricsFocusMode.tsx` | **Lyrics Focus** — distraction-free lyrics mode |
| `client/src/components/studio/PlaylistManager.tsx` | **Playlist Manager** — manage playlists |
| `client/src/components/studio/AudioToolsPage.tsx` | **Audio Tools** — audio utility tools |
| `client/src/components/studio/AudioEngineTest.tsx` | **Engine Test** — test audio engine |
| `client/src/components/studio/AudioTrainingUpload.tsx` | **Training Upload** — upload training data |
| `client/src/components/studio/BeatLab.tsx` | **Beat Lab** — beat experimentation |
| `client/src/components/studio/UnifiedMusicStudio.tsx` | **Unified Studio** — combined studio view |
| `client/src/components/studio/PluginHub.tsx` | **Plugin Hub** — browse/manage plugins |
| `client/src/components/studio/VulnerabilityScanner.tsx` | **Vuln Scanner** — security scanning |
| `client/src/components/studio/RecommendationCard.tsx` | **Recommendations** — AI suggestions |

---

## PRODUCER TOOLS

| File | What it does |
|---|---|
| `client/src/components/producer/StepSequencer.tsx` | **Step sequencer** — grid-based beat programming |
| `client/src/components/producer/OutputSequencer.tsx` | **Output sequencer** — sequence outputs |
| `client/src/components/producer/PackGenerator.tsx` | **Pack generator** — create sample packs |
| `client/src/components/producer/BasslineGenerator.tsx` | **Bassline generator** — create bass patterns |
| `client/src/components/producer/GranularEngine.tsx` | **Granular synth** — granular synthesis engine |
| `client/src/components/producer/WavetableOscillator.tsx` | **Wavetable synth** — wavetable synthesis |
| `client/src/components/sequencer/Sequencer.tsx` | **Sequencer** — main sequencer component |

---

## AUDIO ENGINE (client-side)

| File | What it does |
|---|---|
| `client/src/lib/audio.ts` | **Main audio library** — core audio playback/processing (95KB) |
| `client/src/lib/professionalAudio.ts` | **Pro audio** — professional audio processing chain |
| `client/src/lib/realisticAudio.ts` | **Realistic audio** — realistic instrument synthesis (58KB) |
| `client/src/lib/advancedAudio.ts` | **Advanced audio** — advanced audio features |
| `client/src/lib/audioEngine.ts` | **Audio engine** — Web Audio API engine |
| `client/src/lib/audioContext.ts` | **Audio context** — shared AudioContext management |
| `client/src/lib/audioAnalyzer.ts` | **Audio analyzer** — frequency/waveform analysis |
| `client/src/lib/audioDetection.ts` | **Audio detection** — BPM/key/onset detection |
| `client/src/lib/audioRouter.ts` | **Audio router** — route audio between nodes |
| `client/src/lib/audioPremix.ts` | **Audio premix** — pre-mix audio cache |
| `client/src/lib/mixEngine.ts` | **Mix engine** — mixing/effects processing |
| `client/src/lib/packAudioSynthesizer.ts` | **Pack synth** — synthesize sample pack audio |
| `client/src/lib/musicTheory.ts` | **Music theory** — scales, chords, intervals, key detection |
| `client/src/lib/midiExport.ts` | **MIDI export** — export notes to MIDI files |
| `client/src/lib/midiImport.ts` | **MIDI import** — import MIDI files |
| `client/src/lib/stemExport.ts` | **Stem export** — export individual stems |
| `client/src/lib/sequencer.ts` | **Sequencer lib** — sequencer utilities |

---

## APP INFRASTRUCTURE (client)

| File | What it does |
|---|---|
| `client/src/App.tsx` | **App root** — routing, providers, top-level layout |
| `client/src/main.tsx` | **Entry point** — React DOM render |
| `client/src/index.css` | **Global styles** — Tailwind + custom CSS |
| `client/src/lib/queryClient.ts` | **API client** — React Query + fetch wrapper |
| `client/src/lib/api.ts` | **API helpers** — additional API utilities |
| `client/src/lib/aiAdapters.ts` | **AI adapters** — client-side AI provider adapters |
| `client/src/lib/openai.ts` | **OpenAI client** — OpenAI API integration |
| `client/src/lib/analytics.ts` | **Analytics** — usage tracking |
| `client/src/lib/adsense.ts` | **AdSense** — ad integration |
| `client/src/lib/eventBus.ts` | **Event bus** — cross-component event system |
| `client/src/lib/globalSystems.ts` | **Global systems** — app-wide system initialization |
| `client/src/lib/performanceSettings.ts` | **Performance** — performance tuning settings |
| `client/src/lib/studioRouter.ts` | **Studio router** — studio panel routing |
| `client/src/lib/toolNavigation.ts` | **Tool nav** — tool/panel navigation |
| `client/src/lib/trackClone.ts` | **Track clone** — duplicate tracks |
| `client/src/lib/UndoManager.ts` | **Undo/redo** — undo system |
| `client/src/lib/LicenseGuard.tsx` | **License guard** — feature gating by license |
| `client/src/lib/utils.ts` | **Utilities** — shared utility functions |

---

## CONTEXTS (shared state)

| File | What it does |
|---|---|
| `client/src/contexts/AuthContext.tsx` | **Auth state** — logged-in user, tokens |
| `client/src/contexts/GlobalAudioContext.tsx` | **Global audio** — app-wide audio state |
| `client/src/contexts/TransportContext.tsx` | **Transport** — play/stop/tempo/position state |
| `client/src/contexts/StudioSessionContext.tsx` | **Studio session** — current studio session data |
| `client/src/contexts/TrackStoreContext.tsx` | **Track store** — all tracks and their data |
| `client/src/contexts/InstrumentContext.tsx` | **Instruments** — selected instrument state |
| `client/src/contexts/SessionDestinationContext.tsx` | **Session destination** — audio routing destination |
| `client/src/contexts/SongWorkSessionContext.tsx` | **Song work session** — current song editing session |
| `client/src/contexts/AIMessageContext.tsx` | **AI messages** — AI chat message state |

---

## HOOKS

| File | What it does |
|---|---|
| `client/src/hooks/use-auth.ts` | **Auth hook** — login/logout/user |
| `client/src/hooks/use-audio.ts` | **Audio hook** — audio playback controls |
| `client/src/hooks/use-midi.ts` | **MIDI hook** — MIDI device input/output (30KB) |
| `client/src/hooks/use-toast.ts` | **Toast hook** — notification toasts |
| `client/src/hooks/useTracks.ts` | **Tracks hook** — track CRUD operations |
| `client/src/hooks/use-computer-keyboard.ts` | **Keyboard hook** — keyboard shortcuts |
| `client/src/hooks/use-media-query.ts` | **Media query hook** — responsive breakpoints |
| `client/src/hooks/use-mobile.tsx` | **Mobile hook** — mobile detection |
| `client/src/hooks/use-analytics.tsx` | **Analytics hook** — track events |
| `client/src/hooks/usePluginManager.tsx` | **Plugin hook** — manage plugins |
| `client/src/hooks/usePremixedAudio.ts` | **Premix hook** — premixed audio cache |

---

## PRESENCE ENGINE (living UI)

| File | What it does |
|---|---|
| `client/src/components/presence/presenceEngine.ts` | **Engine** — core presence/mood detection |
| `client/src/components/presence/signalCollector.ts` | **Signal collector** — gather user interaction signals |
| `client/src/components/presence/signalInterpreter.ts` | **Signal interpreter** — interpret signals into mood |
| `client/src/components/presence/aiBridge.ts` | **AI bridge** — connect presence to AI systems |
| `client/src/components/presence/PresenceContext.tsx` | **Context** — shared presence state |
| `client/src/components/presence/LivingGlyph.tsx` | **Living Glyph** — animated presence indicator |
| `client/src/components/presence/GlobalLivingGlyph.tsx` | **Global glyph** — app-wide glyph |
| `client/src/components/presence/PresenceAmbientLight.tsx` | **Ambient light** — mood-reactive background |
| `client/src/components/presence/StudioPresenceWrapper.tsx` | **Studio wrapper** — presence in studio context |
| `client/src/components/presence/LivingGlyph.css` | **Glyph styles** — glyph animations |
| `client/src/components/presence/types.ts` | **Types** — presence type definitions |
| `client/src/components/presence/index.ts` | **Exports** — barrel exports |

---

## SOCIAL

| File | What it does |
|---|---|
| `client/src/components/social/SocialDiscovery.tsx` | **Discovery feed** — browse public songs |
| `client/src/components/social/ProjectSharing.tsx` | **Project sharing** — share projects |
| `client/src/components/social/CommentsSystem.tsx` | **Comments** — comment on songs |
| `client/src/components/social/UserProfile.tsx` | **Profile** — user profile component |

---

## LAYOUT / NAVIGATION

| File | What it does |
|---|---|
| `client/src/components/layout/CodedSwitchFlow.tsx` | **Main flow** — app-wide layout/navigation flow (67KB) |
| `client/src/components/layout/GlobalNav.tsx` | **Global nav** — top navigation bar |
| `client/src/components/layout/navigation.tsx` | **Navigation** — nav links/routing |
| `client/src/components/layout/sidebar.tsx` | **Sidebar** — app sidebar |
| `client/src/components/layout/AutoHideSidebar.tsx` | **Auto-hide sidebar** — collapsible sidebar |
| `client/src/components/layout/PluginManager.tsx` | **Plugin manager** — manage installed plugins |

---

## PLAYGROUND (layout customization)

| File | What it does |
|---|---|
| `client/src/components/playground/LayoutManager.tsx` | **Layout manager** — save/load custom layouts |
| `client/src/components/playground/FreeformLayoutEditor.tsx` | **Freeform editor** — drag-and-drop layout |
| `client/src/components/playground/PanelContainer.tsx` | **Panel container** — resizable panel wrapper |
| `client/src/components/playground/layoutConversion.ts` | **Layout conversion** — convert layout formats |

---

## SHARED COMPONENTS

| File | What it does |
|---|---|
| `client/src/components/ErrorBoundary.tsx` | **Error boundary** — catch React errors |
| `client/src/components/GlobalAudioPlayer.tsx` | **Global player** — persistent audio player |
| `client/src/components/IOSAudioEnable.tsx` | **iOS audio fix** — unlock audio on iOS |
| `client/src/components/ObjectUploader.tsx` | **Object uploader** — upload files to storage |
| `client/src/components/SimpleFileUploader.tsx` | **File uploader** — simple file upload |
| `client/src/components/UserAccountMenu.tsx` | **Account menu** — user dropdown menu |
| `client/src/components/auth/RequireAuth.tsx` | **Auth guard** — protect routes |
| `client/src/components/ai/AstroHUD.tsx` | **Astro HUD** — AI heads-up display |
| `client/src/components/ui/` | **UI primitives** — buttons, inputs, cards, etc. (shadcn/ui) |

---

## SERVER — CORE

| File | What it does |
|---|---|
| `server/index.ts` | **Server entry** — Express app setup, middleware, start |
| `server/index.prod.ts` | **Production entry** — production server config |
| `server/vite.ts` | **Vite integration** — dev server with Vite HMR |
| `server/routes.ts` | **Main routes** — all API endpoints (186KB, biggest server file) |
| `server/storage.ts` | **Storage layer** — database operations (66KB) |
| `server/db.ts` | **Database** — Drizzle ORM connection |
| `server/objectStorage.ts` | **Object storage** — file upload/download (S3/local) |
| `server/guestUser.ts` | **Guest user** — anonymous user handling |

---

## SERVER — ROUTES (modular)

| File | What it does |
|---|---|
| `server/routes/index.ts` | **Route index** — registers all route modules |
| `server/routes/auth.ts` | **Auth routes** — login/signup/logout/session |
| `server/routes/songs.ts` | **Song routes** — CRUD songs, upload, analysis (61KB) |
| `server/routes/audio.ts` | **Audio routes** — audio processing endpoints (38KB) |
| `server/routes/astutely.ts` | **Astutely routes** — AI beat generation API |
| `server/routes/ai.ts` | **AI routes** — general AI endpoints |
| `server/routes/aiAudio.ts` | **AI audio routes** — AI audio generation |
| `server/routes/aiLyrics.ts` | **AI lyrics routes** — lyrics generation |
| `server/routes/aiMusic.ts` | **AI music routes** — music generation |
| `server/routes/aiSong.ts` | **AI song routes** — full song generation |
| `server/routes/credits.ts` | **Credits routes** — credit balance/purchase |
| `server/routes/billing.ts` | **Billing routes** — payment/subscription |
| `server/routes/keys.ts` | **Keys routes** — API key management |
| `server/routes/lyrics.ts` | **Lyrics routes** — lyrics CRUD |
| `server/routes/mix.ts` | **Mix routes** — mixing endpoints |
| `server/routes/music.ts` | **Music routes** — music endpoints |
| `server/routes/packs.ts` | **Packs routes** — sample pack endpoints |
| `server/routes/samples.ts` | **Samples routes** — sample endpoints |
| `server/routes/social.ts` | **Social routes** — social features |
| `server/routes/user.ts` | **User routes** — user profile/settings |
| `server/routes/vulnerability.ts` | **Vuln routes** — security scanning |

---

## SERVER — MIDDLEWARE

| File | What it does |
|---|---|
| `server/middleware/auth.ts` | **Auth middleware** — verify JWT tokens |
| `server/middleware/featureGating.ts` | **Feature gating** — enable/disable features by tier |
| `server/middleware/inputValidation.ts` | **Input validation** — sanitize/validate request data |
| `server/middleware/rateLimiting.ts` | **Rate limiting** — prevent API abuse |
| `server/middleware/requireCredits.ts` | **Credit check** — ensure user has enough credits |
| `server/middleware/tierEnforcement.ts` | **Tier enforcement** — enforce subscription limits |

---

## SERVER — SERVICES (business logic)

| File | What it does |
|---|---|
| `server/services/unifiedMusicService.ts` | **Unified music** — multi-provider music generation cascade (Suno/MusicGen/Stable Audio) |
| `server/services/grok.ts` | **Grok AI** — xAI Grok integration (lyrics, analysis) |
| `server/services/gemini.ts` | **Gemini AI** — Google Gemini integration |
| `server/services/localAI.ts` | **Local AI** — local Phi3/Ollama integration |
| `server/services/local-musicgen.ts` | **Local MusicGen** — local MusicGen model |
| `server/services/sunoApi.ts` | **Suno API** — Suno music generation |
| `server/services/sunoApiService.ts` | **Suno service** — Suno API wrapper |
| `server/services/aiProviderManager.ts` | **AI provider manager** — route to best available AI |
| `server/services/aiGateway.ts` | **AI gateway** — unified AI request gateway |
| `server/services/aiCache.ts` | **AI cache** — cache AI responses |
| `server/services/professionalAudioGenerator.ts` | **Pro audio gen** — server-side audio generation |
| `server/services/musicgen-from-structure.ts` | **MusicGen structure** — generate from song structure |
| `server/services/ai-structure-generator.ts` | **Structure gen** — AI song structure generation |
| `server/services/ai-structure-grok.ts` | **Structure Grok** — Grok-based structure generation |
| `server/services/stemSeparation.ts` | **Stem separation** — AI stem separation (Demucs) |
| `server/services/audioAnalysis.ts` | **Audio analysis** — BPM/key/genre detection |
| `server/services/audio.ts` | **Audio service** — audio processing utilities |
| `server/services/advancedLyricAnalyzer.ts` | **Lyric analyzer** — deep lyric analysis |
| `server/services/bassGenerator.ts` | **Bass generator** — generate bass patterns |
| `server/services/bassRenderer.ts` | **Bass renderer** — render bass to audio |
| `server/services/patternGenerator.ts` | **Pattern gen** — generate musical patterns |
| `server/services/chord-progressions.ts` | **Chord progressions** — generate chord sequences |
| `server/services/arrangement.ts` | **Arrangement** — auto-arrange songs |
| `server/services/backingTrack.ts` | **Backing track** — generate backing tracks |
| `server/services/codeToMusic.ts` | **Code to music** — convert code to music |
| `server/services/chatMusician.ts` | **Chat musician** — conversational music AI |
| `server/services/credits.ts` | **Credits service** — credit balance management |
| `server/services/stripe.ts` | **Stripe** — payment processing |
| `server/services/email.ts` | **Email** — send emails |
| `server/services/fileSecurity.ts` | **File security** — scan uploaded files |
| `server/services/jobManager.ts` | **Job manager** — background job queue |
| `server/services/keyGenerator.ts` | **Key generator** — generate API keys |
| `server/services/localSampleLibrary.ts` | **Sample library** — manage local samples |
| `server/services/localStorageService.ts` | **Local storage** — server-side file storage |
| `server/services/mixPreview.ts` | **Mix preview** — generate mix previews |
| `server/services/packGenerator.ts` | **Pack generator** — create sample packs |
| `server/services/speechCorrection.ts` | **Speech correction** — fix speech-to-text |
| `server/services/transcriptionService.ts` | **Transcription** — audio transcription |
| `server/services/voiceLibrary.ts` | **Voice library** — manage voice models |
| `server/services/jascoMusic.ts` | **Jasco music** — Jasco integration |

---

## SERVER — AI

| File | What it does |
|---|---|
| `server/ai/prompts/astutelyPrompt.ts` | **Astutely prompts** — AI prompt templates for beat generation |
| `server/ai/safety/aiSafeguards.ts` | **AI safeguards** — content filtering, safety checks |

---

## SHARED (used by both client and server)

| File | What it does |
|---|---|
| `shared/schema.ts` | **Database schema** — all table definitions (Drizzle ORM) |
| `shared/studioTypes.ts` | **Studio types** — shared TypeScript types for studio |
| `shared/tiers.ts` | **Tier definitions** — subscription tier features/limits |
| `shared/astutelyFallback.ts` | **Astutely fallback** — offline beat patterns |

---

## CONFIG FILES

| File | What it does |
|---|---|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config |
| `vite.config.ts` | Vite dev server config |
| `vite.config.prod.ts` | Vite production build config |
| `tailwind.config.ts` | Tailwind CSS config |
| `drizzle.config.ts` | Database migration config |
| `eslint.config.js` | Linting rules |
| `postcss.config.js` | PostCSS config |
| `railway.json` | Railway deployment config |
| `netlify.toml` | Netlify deployment config |
| `render.yaml` | Render deployment config |
| `Dockerfile.ollama` | Docker config for local AI |
| `playwright.config.ts` | E2E test config |
