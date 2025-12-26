import React, { lazy, Suspense, type JSX } from "react";

// Lazy load all studio components for code splitting
// This dramatically reduces initial bundle size
const AIAssistant = lazy(() => import("@/components/studio/AIAssistant"));
const AIBassGenerator = lazy(() => import("@/components/studio/AIBassGenerator"));
const AudioToolsPage = lazy(() => import("@/components/studio/AudioToolsPage"));
const BeatLab = lazy(() => import("@/components/studio/BeatLab"));
const CodeToMusicStudioV2 = lazy(() => import("@/components/studio/CodeToMusicStudioV2"));
const CodeTranslator = lazy(() => import("@/components/studio/CodeTranslator"));
const DAWLayoutWorkspace = lazy(() => import("@/components/studio/DAWLayoutWorkspace"));
const DynamicLayering = lazy(() => import("@/components/studio/DynamicLayering"));
const LyricLab = lazy(() => import("@/components/studio/LyricLab"));
const MelodyComposerV2 = lazy(() => import("@/components/studio/MelodyComposerV2"));
const Mixer = lazy(() => import("@/components/studio/Mixer"));
const MusicToCode = lazy(() => import("@/components/studio/MusicToCode"));
const PackGenerator = lazy(() => import("@/components/producer/PackGenerator"));
const ProfessionalMixer = lazy(() => import("@/components/studio/ProfessionalMixer"));
const SongUploader = lazy(() => import("@/components/studio/SongUploader"));
const UnifiedMusicStudio = lazy(() => import("@/components/studio/UnifiedMusicStudio"));
const UnifiedStudioWorkspace = lazy(() => import("@/components/studio/UnifiedStudioWorkspace"));
const VulnerabilityScanner = lazy(() => import("@/components/studio/VulnerabilityScanner"));
const GranularEngine = lazy(() => import("@/components/producer/GranularEngine"));
const OutputSequencer = lazy(() => import("@/components/producer/OutputSequencer"));
const WavetableOscillator = lazy(() => import("@/components/producer/WavetableOscillator"));
const MIDIController = lazy(() => import("@/components/studio/MIDIController").then(m => ({ default: m.MIDIController })));
const PerformanceMetrics = lazy(() => import("@/components/studio/PerformanceMetrics").then(m => ({ default: m.PerformanceMetrics })));
const SongStructureManager = lazy(() => import("@/components/studio/SongStructureManager").then(m => ({ default: m.SongStructureManager })));
// Deprecated: CodeBeat page is routed separately; keep lazy import commented to avoid unused warning
// const CodeBeatStudio = lazy(() => import("@/pages/codebeat-studio"));
const MasterMultiTrackPlayer = lazy(() => import("@/components/studio/MasterMultiTrackPlayer"));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

// Wrapper to add Suspense to lazy components
type SuspendedComponent = React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>;
const withSuspense = (Component: SuspendedComponent) => (props: Record<string, unknown> = {}) => (
  <Suspense fallback={<LoadingFallback />}>
    <Component {...props} />
  </Suspense>
);

export type StudioTabId =
  | "translator"
  | "beatmaker"
  | "melody"
  | "multitrack"
  | "unified-studio"
  | "daw-layout"
  | "audio-tools"
  | "codebeat"
  | "musiccode"
  | "assistant"
  | "uploader"
  | "security"
  | "lyrics"
  | "musicmixer"
  | "professionalmixer"
  | "mixer"
  | "layers"
  | "midi"
  | "metrics"
  | "advanced-sequencer"
  | "granular-engine"
  | "wavetable-oscillator"
  | "pack-generator"
  | "song-structure"
  | "bass-generator";

export interface StudioTabConfig {
  id: StudioTabId;
  label: string;
  shortName: string;
  icon: string;
  description?: string;
  routes?: string[];
  requireAuth?: boolean;
  requirePro?: boolean;
  component: () => JSX.Element;
}

export const DEFAULT_STUDIO_TAB: StudioTabId = "unified-studio";

export const STUDIO_TABS: StudioTabConfig[] = [
  {
    id: "unified-studio",
    label: "🎵 DAW",
    shortName: "DAW",
    icon: "fas fa-star",
    description: "Main DAW workspace with Timeline, Piano Roll, Lyrics, AI Generation",
    routes: ["/", "/studio", "/unified-studio"],
    component: withSuspense(UnifiedStudioWorkspace),
  },
  {
    id: "multitrack",
    label: "🎛️ Multi-Track",
    shortName: "Multi-Track",
    icon: "fas fa-layer-group",
    description: "Layer multiple audio tracks with waveform editing",
    routes: ["/multitrack", "/multi-track", "/music-studio", "/multitrack-studio"],
    component: withSuspense(MasterMultiTrackPlayer),
  },
  {
    id: "daw-layout",
    label: "🎚️ DAW Layout",
    shortName: "DAW Layout",
    icon: "fas fa-sliders-h",
    description: "Custom DAW workspace with instruments, effects, and timeline",
    routes: ["/daw-layout"],
    component: withSuspense(DAWLayoutWorkspace),
  },
  {
    id: "translator",
    label: "Code Translator",
    shortName: "Code Translator",
    icon: "fas fa-code",
    description: "Convert code between languages",
    routes: ["/code-translator"],
    component: withSuspense(CodeTranslator),
  },
  {
    id: "beatmaker",
    label: "Beat Lab",
    shortName: "Beat Lab",
    icon: "fas fa-flask",
    description: "Create beats with generator, editor, samples, and CodeBeat",
    routes: ["/beat-studio"],
    component: withSuspense(BeatLab),
  },
  {
    id: "bass-generator",
    label: "🎸 Bass Generator",
    shortName: "Bass",
    icon: "fas fa-guitar",
    description: "Interactive bass keyboard with AI bass line generation",
    routes: ["/bass-generator", "/bass"],
    component: withSuspense(AIBassGenerator),
  },
  {
    id: "melody",
    label: "Melody Composer",
    shortName: "Melody Composer",
    icon: "fas fa-music",
    description: "Compose musical melodies",
    routes: ["/melody-composer"],
    component: withSuspense(MelodyComposerV2),
  },
  {
    id: "audio-tools",
    label: "Audio Tools",
    shortName: "Audio Tools",
    icon: "fas fa-sliders-h",
    description: "EQ, Compressor, Reverb, and more",
    routes: ["/audio-tools"],
    component: withSuspense(AudioToolsPage),
  },
  {
    id: "uploader",
    label: "Song Uploader",
    shortName: "Song Uploader",
    icon: "fas fa-upload",
    description: "Upload and analyze songs",
    routes: ["/song-uploader"],
    component: withSuspense(SongUploader),
  },
  {
    id: "codebeat",
    label: "Code to Music V2",
    shortName: "Code to Music",
    icon: "fas fa-exchange-alt",
    description: "Turn code into harmonic music with the four chords algorithm",
    routes: ["/codebeat-studio", "/code-to-music-studio"],
    component: withSuspense(CodeToMusicStudioV2),
  },
  {
    id: "musiccode",
    label: "Music to Code",
    shortName: "Music to Code",
    icon: "fas fa-code-branch",
    description: "Convert music back to code",
    routes: ["/music-to-code"],
    requireAuth: true,
    component: withSuspense(MusicToCode),
  },
  {
    id: "layers",
    label: "Dynamic Layering",
    shortName: "Dynamic Layering",
    icon: "fas fa-layer-group",
    description: "AI-powered instrument layering",
    requireAuth: true,
    component: withSuspense(DynamicLayering),
  },
  {
    id: "assistant",
    label: "AI Assistant",
    shortName: "AI Assistant",
    icon: "fas fa-robot",
    description: "AI-powered music help & song uploads",
    routes: ["/ai-assistant"],
    requireAuth: true,
    component: withSuspense(AIAssistant),
  },
  {
    id: "security",
    label: "Security Scanner",
    shortName: "Security Scanner",
    icon: "fas fa-shield-alt",
    description: "Scan code for vulnerabilities",
    routes: ["/vulnerability-scanner"],
    requireAuth: true,
    component: withSuspense(VulnerabilityScanner),
  },
  {
    id: "lyrics",
    label: "Lyric Lab",
    shortName: "Lyric Lab",
    icon: "fas fa-microphone",
    description: "Write and edit song lyrics",
    routes: ["/lyric-lab"],
    requireAuth: true,
    component: withSuspense(LyricLab),
  },
  {
    id: "musicmixer",
    label: "Music Studio",
    shortName: "Music Studio",
    icon: "fas fa-sliders-h",
    description: "Unified music studio with all advanced tools",
    routes: ["/music-studio"],
    requirePro: true,
    component: withSuspense(UnifiedMusicStudio),
  },
  {
    id: "professionalmixer",
    label: "Pro Console",
    shortName: "Professional Console",
    icon: "fas fa-mixing-board",
    description: "World-class professional mixing console",
    routes: ["/pro-console"],
    requirePro: true,
    component: withSuspense(ProfessionalMixer),
  },
  {
    id: "mixer",
    label: "Track Mixer",
    shortName: "Track Mixer",
    icon: "fas fa-sliders-v",
    description: "Mix and master individual tracks",
    routes: ["/mix-studio"],
    requirePro: true,
    component: withSuspense(Mixer),
  },
  {
    id: "pack-generator",
    label: "Pack Generator",
    shortName: "Pack Generator",
    icon: "fas fa-box",
    description: "AI-powered sample pack creation",
    routes: ["/pack-generator"],
    requireAuth: true,
    component: withSuspense(PackGenerator),
  },
  {
    id: "advanced-sequencer",
    label: "Advanced Sequencer",
    shortName: "Advanced Sequencer",
    icon: "fas fa-th-large",
    description: "Professional multi-layered sequencer",
    routes: ["/advanced-sequencer"],
    requireAuth: true,
    component: withSuspense(OutputSequencer),
  },
  {
    id: "granular-engine",
    label: "Granular Engine",
    shortName: "Granular Engine",
    icon: "fas fa-atom",
    description: "Advanced texture manipulation",
    routes: ["/granular-engine"],
    requireAuth: true,
    component: withSuspense(GranularEngine),
  },
  {
    id: "wavetable-oscillator",
    label: "Wavetable Synth",
    shortName: "Wavetable Synth",
    icon: "fas fa-wave-square",
    description: "Wavetable synthesis engine",
    routes: ["/wavetable-oscillator"],
    requireAuth: true,
    component: withSuspense(WavetableOscillator),
  },
  {
    id: "midi",
    label: "MIDI Controller",
    shortName: "MIDI Controller",
    icon: "fas fa-piano",
    description: "Connect physical MIDI controllers",
    routes: ["/midi-controller"],
    component: withSuspense(MIDIController),
  },
  {
    id: "metrics",
    label: "Performance Metrics",
    shortName: "Performance Metrics",
    icon: "fas fa-chart-line",
    description: "AI music generation analytics",
    component: withSuspense(PerformanceMetrics),
  },
  {
    id: "song-structure",
    label: "Song Structure Manager",
    shortName: "Song Structure",
    icon: "fas fa-project-diagram",
    description: "Arrange and manage song sections",
    routes: ["/song-structure"],
    requirePro: true,
    component: withSuspense(SongStructureManager),
  },
];

const TAB_BY_ID = new Map(STUDIO_TABS.map((tab) => [tab.id, tab]));
const ROUTE_ENTRIES = STUDIO_TABS.flatMap((tab) =>
  (tab.routes ?? []).map((route) => ({
    route: route.toLowerCase(),
    id: tab.id,
  }))
).sort((a, b) => b.route.length - a.route.length);

export function getStudioTabById(id: StudioTabId) {
  return TAB_BY_ID.get(id);
}

export function isStudioTabId(value: string): value is StudioTabId {
  return TAB_BY_ID.has(value as StudioTabId);
}

export function resolveStudioTabFromPath(path: string): StudioTabId {
  const normalized = (path || "/").toLowerCase();

  if (normalized === "/" || normalized === "/studio") {
    return DEFAULT_STUDIO_TAB;
  }

  const match = ROUTE_ENTRIES.find(({ route }) => normalized.startsWith(route));
  return match?.id ?? DEFAULT_STUDIO_TAB;
}
