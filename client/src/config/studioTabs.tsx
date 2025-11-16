import type { JSX } from "react";

import AIAssistant from "@/components/studio/AIAssistant";
import AudioToolsPage from "@/components/studio/AudioToolsPage";
import BeatMaker from "@/components/studio/BeatMaker";
import CodeToMusicStudioV2 from "@/components/studio/CodeToMusicStudioV2";
import CodeTranslator from "@/components/studio/CodeTranslator";
import DAWLayoutWorkspace from "@/components/studio/DAWLayoutWorkspace";
import DynamicLayering from "@/components/studio/DynamicLayering";
import LyricLab from "@/components/studio/LyricLab";
import MelodyComposerV2 from "@/components/studio/MelodyComposerV2";
import Mixer from "@/components/studio/Mixer";
import MusicToCode from "@/components/studio/MusicToCode";
import PackGenerator from "@/components/producer/PackGenerator";
import ProfessionalMixer from "@/components/studio/ProfessionalMixer";
import SongUploader from "@/components/studio/SongUploader";
import UnifiedMusicStudio from "@/components/studio/UnifiedMusicStudio";
import UnifiedStudioWorkspace from "@/components/studio/UnifiedStudioWorkspace";
import VulnerabilityScanner from "@/components/studio/VulnerabilityScanner";
import GranularEngine from "@/components/producer/GranularEngine";
import OutputSequencer from "@/components/producer/OutputSequencer";
import WavetableOscillator from "@/components/producer/WavetableOscillator";
import { MIDIController } from "@/components/studio/MIDIController";
import { PerformanceMetrics } from "@/components/studio/PerformanceMetrics";
import { SongStructureManager } from "@/components/studio/SongStructureManager";
import CodeBeatStudio from "@/pages/codebeat-studio";

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
  | "song-structure";

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
    label: "🎵 Unified Studio",
    shortName: "Unified Studio",
    icon: "fas fa-star",
    description: "Complete DAW with Timeline, Piano Roll, Lyrics, AI Generation",
    routes: ["/", "/studio", "/unified-studio"],
    component: () => <UnifiedStudioWorkspace />,
  },
  {
    id: "daw-layout",
    label: "🎚️ DAW Layout",
    shortName: "DAW Layout",
    icon: "fas fa-layer-group",
    description: "Custom DAW workspace with instruments, effects, and timeline",
    routes: ["/daw-layout"],
    component: () => <DAWLayoutWorkspace />,
  },
  {
    id: "translator",
    label: "Code Translator",
    shortName: "Code Translator",
    icon: "fas fa-code",
    description: "Convert code between languages",
    routes: ["/code-translator"],
    component: () => <CodeTranslator />,
  },
  {
    id: "beatmaker",
    label: "Beat Maker",
    shortName: "Beat Maker",
    icon: "fas fa-drum",
    description: "Create drum patterns and beats",
    routes: ["/beat-studio"],
    component: () => <BeatMaker />,
  },
  {
    id: "melody",
    label: "Melody Composer",
    shortName: "Melody Composer",
    icon: "fas fa-music",
    description: "Compose musical melodies",
    routes: ["/melody-composer"],
    component: () => <MelodyComposerV2 />,
  },
  {
    id: "multitrack",
    label: "Multi-Track Studio",
    shortName: "Multi-Track Studio",
    icon: "fas fa-layer-group",
    description: "Layer multiple instrument tracks",
    component: () => <CodeBeatStudio />,
  },
  {
    id: "audio-tools",
    label: "Audio Tools",
    shortName: "Audio Tools",
    icon: "fas fa-sliders-h",
    description: "EQ, Compressor, Reverb, and more",
    routes: ["/audio-tools"],
    component: () => <AudioToolsPage />,
  },
  {
    id: "uploader",
    label: "Song Uploader",
    shortName: "Song Uploader",
    icon: "fas fa-upload",
    description: "Upload and analyze songs",
    routes: ["/song-uploader"],
    component: () => <SongUploader />,
  },
  {
    id: "codebeat",
    label: "Code to Music V2",
    shortName: "Code to Music",
    icon: "fas fa-exchange-alt",
    description: "Turn code into harmonic music with the four chords algorithm",
    routes: ["/codebeat-studio", "/code-to-music-studio"],
    component: () => <CodeToMusicStudioV2 />,
  },
  {
    id: "musiccode",
    label: "Music to Code",
    shortName: "Music to Code",
    icon: "fas fa-code-branch",
    description: "Convert music back to code",
    routes: ["/music-to-code"],
    requireAuth: true,
    component: () => <MusicToCode />,
  },
  {
    id: "layers",
    label: "Dynamic Layering",
    shortName: "Dynamic Layering",
    icon: "fas fa-layer-group",
    description: "AI-powered instrument layering",
    requireAuth: true,
    component: () => <DynamicLayering />,
  },
  {
    id: "assistant",
    label: "AI Assistant",
    shortName: "AI Assistant",
    icon: "fas fa-robot",
    description: "AI-powered music help & song uploads",
    routes: ["/ai-assistant"],
    requireAuth: true,
    component: () => <AIAssistant />,
  },
  {
    id: "security",
    label: "Security Scanner",
    shortName: "Security Scanner",
    icon: "fas fa-shield-alt",
    description: "Scan code for vulnerabilities",
    routes: ["/vulnerability-scanner"],
    requireAuth: true,
    component: () => <VulnerabilityScanner />,
  },
  {
    id: "lyrics",
    label: "Lyric Lab",
    shortName: "Lyric Lab",
    icon: "fas fa-microphone",
    description: "Write and edit song lyrics",
    routes: ["/lyric-lab"],
    requireAuth: true,
    component: () => <LyricLab />,
  },
  {
    id: "musicmixer",
    label: "Music Studio",
    shortName: "Music Studio",
    icon: "fas fa-sliders-h",
    description: "Unified music studio with all advanced tools",
    routes: ["/music-studio"],
    requirePro: true,
    component: () => <UnifiedMusicStudio />,
  },
  {
    id: "professionalmixer",
    label: "Pro Console",
    shortName: "Professional Console",
    icon: "fas fa-mixing-board",
    description: "World-class professional mixing console",
    routes: ["/pro-console"],
    requirePro: true,
    component: () => <ProfessionalMixer />,
  },
  {
    id: "mixer",
    label: "Track Mixer",
    shortName: "Track Mixer",
    icon: "fas fa-sliders-v",
    description: "Mix and master individual tracks",
    routes: ["/mix-studio"],
    requirePro: true,
    component: () => <Mixer />,
  },
  {
    id: "pack-generator",
    label: "Pack Generator",
    shortName: "Pack Generator",
    icon: "fas fa-box",
    description: "AI-powered sample pack creation",
    routes: ["/pack-generator"],
    requireAuth: true,
    component: () => <PackGenerator />,
  },
  {
    id: "advanced-sequencer",
    label: "Advanced Sequencer",
    shortName: "Advanced Sequencer",
    icon: "fas fa-th-large",
    description: "Professional multi-layered sequencer",
    routes: ["/advanced-sequencer"],
    requireAuth: true,
    component: () => <OutputSequencer />,
  },
  {
    id: "granular-engine",
    label: "Granular Engine",
    shortName: "Granular Engine",
    icon: "fas fa-atom",
    description: "Advanced texture manipulation",
    routes: ["/granular-engine"],
    requireAuth: true,
    component: () => <GranularEngine />,
  },
  {
    id: "wavetable-oscillator",
    label: "Wavetable Synth",
    shortName: "Wavetable Synth",
    icon: "fas fa-wave-square",
    description: "Wavetable synthesis engine",
    routes: ["/wavetable-oscillator"],
    requireAuth: true,
    component: () => <WavetableOscillator />,
  },
  {
    id: "midi",
    label: "MIDI Controller",
    shortName: "MIDI Controller",
    icon: "fas fa-piano",
    description: "Connect physical MIDI controllers",
    routes: ["/midi-controller"],
    component: () => <MIDIController />,
  },
  {
    id: "metrics",
    label: "Performance Metrics",
    shortName: "Performance Metrics",
    icon: "fas fa-chart-line",
    description: "AI music generation analytics",
    component: () => <PerformanceMetrics />,
  },
  {
    id: "song-structure",
    label: "Song Structure Manager",
    shortName: "Song Structure",
    icon: "fas fa-project-diagram",
    description: "Arrange and manage song sections",
    routes: ["/song-structure"],
    requirePro: true,
    component: () => <SongStructureManager />,
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
