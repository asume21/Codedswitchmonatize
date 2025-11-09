import { useState, createContext, useContext, useEffect } from "react";
import type { JSX } from "react";
import { useLocation } from "wouter";
import Header from "@/components/studio/Header";
import Sidebar from "@/components/studio/Sidebar";
import TransportControls from "@/components/studio/TransportControls";
import CodeTranslator from "@/components/studio/CodeTranslator";
import BeatMaker from "@/components/studio/BeatMaker";
import BeatStudio from "@/pages/beat-studio";
import MelodyComposer from "@/components/studio/MelodyComposer";
import MelodyComposerV2 from "@/components/studio/MelodyComposerV2";
import CodeToMusic from "@/components/studio/CodeToMusic";
import MusicToCode from "@/components/studio/MusicToCode";
import AIAssistant from "@/components/studio/AIAssistant";
import SongUploader from "@/components/studio/SongUploader";
import AudioToolsPage from "@/components/studio/AudioToolsPage";
import UnifiedStudioWorkspace from "@/components/studio/UnifiedStudioWorkspace";
import VulnerabilityScanner from "@/components/studio/VulnerabilityScanner";
import LyricLab from "@/components/studio/LyricLab";
import MusicMixer from "@/components/studio/MusicMixer";
import UnifiedMusicStudio from "@/components/studio/UnifiedMusicStudio";
import ProfessionalStudio from "@/components/studio/ProfessionalStudio";
import Mixer from "@/components/studio/Mixer";
import DynamicLayering from "@/components/studio/DynamicLayering";
import { MIDIController } from "@/components/studio/MIDIController";
import { PerformanceMetrics } from "@/components/studio/PerformanceMetrics";
import OutputSequencer from "@/components/producer/OutputSequencer";
import GranularEngine from "@/components/producer/GranularEngine";
import { WavetableOscillator } from "@/components/producer/WavetableOscillator";
import PackGenerator from "@/components/producer/PackGenerator";
import ProfessionalMixer from "@/components/studio/ProfessionalMixer";
import { SongStructureManager } from "@/components/studio/SongStructureManager";
import CodeBeatStudio from "@/pages/codebeat-studio";
import { IOSAudioEnable } from "@/components/IOSAudioEnable";
import MobileNav from "@/components/studio/MobileNav";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
// PlaylistManager integrated into TransportControls
import { useAudio } from "@/hooks/use-audio";
import { AIMessageProvider } from "@/contexts/AIMessageContext";

// Global studio audio context for master playback
export const StudioAudioContext = createContext({
  currentPattern: {} as any,
  currentMelody: [] as any[],
  currentLyrics: "" as string,
  currentCodeMusic: {} as unknown,
  currentLayers: [] as any[],
  currentTracks: [] as any[],
  currentKey: "C" as string,
  isPlaying: false,
  bpm: 120,
  playMode: 'current' as 'current' | 'all',
  setPlayMode: (mode: 'current' | 'all') => {},
  activeTab: 'beatmaker' as string,
  currentPlaylist: null as any,
  setCurrentPlaylist: (playlist: any) => {},
  currentPlaylistIndex: 0 as number,
  setCurrentPlaylistIndex: (index: number) => {},
  setCurrentPattern: (pattern: any) => {},
  setCurrentMelody: (melody: any[]) => {},
  setCurrentLyrics: (lyrics: string) => {},
  setCurrentCodeMusic: (music: any) => {},
  setCurrentLayers: (layers: any[]) => {},
  setCurrentTracks: (tracks: any[]) => {},
  setBpm: (bpm: number) => {},
  setCurrentKey: (key: string) => {},
  playCurrentAudio: () => Promise.resolve(),
  stopCurrentAudio: () => {},
  playFullSong: () => Promise.resolve(),
  stopFullSong: () => {},
});

type Tab = "translator" | "beatmaker" | "melody" | "multitrack" | "unified-studio" | "audio-tools" | "codebeat" | "musiccode" | "assistant" | "uploader" | "security" | "lyrics" | "musicmixer" | "professionalmixer" | "mixer" | "layers" | "midi" | "metrics" | "advanced-sequencer" | "granular-engine" | "wavetable-oscillator" | "pack-generator" | "song-structure";

const tabAccess: Partial<Record<Tab, { requireAuth?: boolean; requirePro?: boolean }>> = {
  assistant: { requireAuth: true },
  security: { requireAuth: true },
  lyrics: { requireAuth: true },
  musicmixer: { requirePro: true },
  professionalmixer: { requirePro: true },
  mixer: { requirePro: true },
  layers: { requireAuth: true },
  "advanced-sequencer": { requireAuth: true },
  "granular-engine": { requireAuth: true },
  "wavetable-oscillator": { requireAuth: true },
  "pack-generator": { requireAuth: true },
  "song-structure": { requirePro: true },
  codebeat: { requireAuth: true },
  musiccode: { requireAuth: true },
};

export default function Studio() {
  const [location] = useLocation();
  
  // Determine active tab based on current route
  const getTabFromRoute = (path: string): Tab => {
    const routeMap: Record<string, Tab> = {
      '/unified-studio': 'unified-studio',
      '/code-translator': 'translator',
      '/beat-studio': 'beatmaker',
      '/melody-composer': 'melody',
      '/codebeat-studio': 'codebeat',
      '/music-studio': 'musicmixer',
      '/pro-console': 'professionalmixer',
      '/song-uploader': 'uploader',
      '/ai-assistant': 'assistant',
      '/vulnerability-scanner': 'security',
      '/lyric-lab': 'lyrics',
      '/mix-studio': 'mixer',
      '/midi-controller': 'midi',
      '/pack-generator': 'pack-generator',
      '/advanced-sequencer': 'advanced-sequencer',
      '/granular-engine': 'granular-engine',
      '/wavetable-oscillator': 'wavetable-oscillator',
      '/song-structure': 'song-structure'
    };
    
    const matchedRoute = Object.keys(routeMap).find(route => path.includes(route));
    return matchedRoute ? routeMap[matchedRoute] : 'beatmaker';
  };

  const [activeTab, setActiveTab] = useState<Tab>(() => getTabFromRoute(location));
  
  // Update active tab when route changes
  useEffect(() => {
    setActiveTab(getTabFromRoute(location));
  }, [location]);
  const [currentPattern, setCurrentPattern] = useState({});
  const [currentMelody, setCurrentMelody] = useState<any[]>([]);
  const [currentLyrics, setCurrentLyrics] = useState("");
  const [currentCodeMusic, setCurrentCodeMusic] = useState({});
  const [currentLayers, setCurrentLayers] = useState<any[]>([]);
  const [currentTracks, setCurrentTracks] = useState<any[]>([]);
  const [currentKey, setCurrentKey] = useState("C");
  const [isStudioPlaying, setIsStudioPlaying] = useState(false);
  const [studioBpm, setStudioBpm] = useState(120);
  const [playMode, setPlayMode] = useState<'current' | 'all'>('current'); // New play mode state
  const [currentPlaylist, setCurrentPlaylist] = useState<any>(null); // Current active playlist
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0); // Current song in playlist
  
  const { initialize, isInitialized } = useAudio();

  // Listen for tab navigation events from other components
  useEffect(() => {
    const handleTabNavigation = (event: CustomEvent) => {
      const targetTab = event.detail as Tab;
      setActiveTab(targetTab);
    };

    window.addEventListener('navigateToTab', handleTabNavigation as EventListener);
    return () => {
      window.removeEventListener('navigateToTab', handleTabNavigation as EventListener);
    };
  }, []);

  const playCurrentAudio = async () => {
    if (!isInitialized) {
      await initialize();
    }
    
    console.log(`🎵 Playing current tool only: ${activeTab}`);
    
    // Play only the content from the current active tab
    switch (activeTab) {
      case "beatmaker":
        console.log("🎵 Playing beat pattern only:", currentPattern);
        // Beat pattern will be handled by the transport controls via sequencer
        break;
      case "melody":
        console.log("🎵 Playing melody only:", currentMelody);
        // Melody playback - would trigger melody composer's play function
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('playCurrentMelody'));
        }
        break;
      case "codebeat":
        console.log("🎵 Playing code-to-music only:", currentCodeMusic);
        break;
      case "lyrics":
        console.log("🎵 Playing lyrics only:", currentLyrics);
        // Could trigger text-to-speech or backing track
        break;
      case "assistant":
        console.log("🎵 Playing uploaded song:", currentPlaylist);
        // Play current playlist or current song in playlist
        if (currentPlaylist && currentPlaylist.songs && currentPlaylist.songs.length > 0) {
          const currentSong = currentPlaylist.songs[currentPlaylistIndex];
          console.log("🎵 Playing playlist song:", currentSong);
        }
        break;
      default:
        console.log("🎵 Playing default audio for:", activeTab);
        break;
    }
    
    setIsStudioPlaying(true);
  };

  const stopCurrentAudio = () => {
    setIsStudioPlaying(false);
  };

  const getActiveToolName = (tab: Tab): string => {
    const toolNames: Record<Tab, string> = {
      "translator": "Code Translator",
      "beatmaker": "Beat Maker", 
      "melody": "Melody Composer",
      "multitrack": "Multi-Track Studio",
      "unified-studio": "Unified Studio",
      "audio-tools": "Audio Tools",
      "codebeat": "Code to Music",
      "musiccode": "Music to Code",
      "assistant": "AI Assistant",
      "uploader": "Song Uploader",
      "security": "Security Scanner",
      "lyrics": "Lyric Lab",
      "musicmixer": "Music Studio",
      "professionalmixer": "Professional Audio Console",
      "mixer": "Mixer",
      "layers": "Dynamic Layering",
      "midi": "MIDI Controller",
      "metrics": "Performance Metrics",
      "advanced-sequencer": "Advanced Sequencer",
      "granular-engine": "Granular Engine",
      "wavetable-oscillator": "Wavetable Oscillator",
      "pack-generator": "Pack Generator",
      "song-structure": "Song Structure Manager"
    };
    return toolNames[tab] || "Beat Maker";
  };

  const playFullSong = async () => {
    if (!isInitialized) {
      await initialize();
    }
    
    console.log("🎵 Playing ALL tools combined:");
    console.log("- Beat Pattern:", currentPattern);
    console.log("- Melody:", currentMelody);
    console.log("- Lyrics:", currentLyrics);
    console.log("- Code Music:", currentCodeMusic);
    console.log("- Layers:", currentLayers);
    
    // Trigger all tools to play simultaneously, including playlist if available
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('playAllTools', {
        detail: {
          pattern: currentPattern,
          melody: currentMelody,
          lyrics: currentLyrics,
          codeMusic: currentCodeMusic,
          layers: currentLayers,
          playlist: currentPlaylist,
          playlistIndex: currentPlaylistIndex,
          bpm: studioBpm
        }
      }));
    }
    
    setIsStudioPlaying(true);
  };

  const stopFullSong = () => {
    setIsStudioPlaying(false);
  };

  const studioAudioValue = {
    currentPattern,
    currentMelody,
    currentLyrics,
    currentCodeMusic,
    currentLayers,
    currentTracks,
    currentKey,
    isPlaying: isStudioPlaying,
    bpm: studioBpm,
    playMode,
    setPlayMode,
    activeTab,
    currentPlaylist,
    setCurrentPlaylist,
    currentPlaylistIndex,
    setCurrentPlaylistIndex,
    setCurrentPattern,
    setCurrentMelody,
    setCurrentLyrics,
    setCurrentCodeMusic,
    setCurrentLayers,
    setCurrentTracks,
    setBpm: setStudioBpm,
    setCurrentKey,
    playCurrentAudio,
    stopCurrentAudio,
    playFullSong,
    stopFullSong,
  };

  const renderTabContent = () => {
    const componentMap: Record<Tab, JSX.Element> = {
      translator: <CodeTranslator />,
      beatmaker: <BeatMaker />,
      melody: <MelodyComposerV2 />,
      multitrack: <CodeBeatStudio />,
      "unified-studio": <UnifiedStudioWorkspace />,
      "audio-tools": <AudioToolsPage />,
      codebeat: <CodeToMusic />,
      musiccode: <MusicToCode />,
      assistant: <AIAssistant />,
      uploader: <SongUploader />,
      security: <VulnerabilityScanner />,
      lyrics: <LyricLab />,
      musicmixer: <UnifiedMusicStudio />,
      professionalmixer: <ProfessionalMixer />,
      mixer: <Mixer />,
      layers: <DynamicLayering />,
      midi: <MIDIController />,
      metrics: <PerformanceMetrics />,
      "advanced-sequencer": <OutputSequencer />,
      "granular-engine": <GranularEngine />,
      "wavetable-oscillator": <WavetableOscillator />,
      "pack-generator": <PackGenerator />,
      "song-structure": <SongStructureManager />
    };

    const content = componentMap[activeTab] || <BeatMaker />;
    const access = tabAccess[activeTab];
    
    // Wrap content in ErrorBoundary to prevent crashes
    const wrappedContent = <ErrorBoundary>{content}</ErrorBoundary>;
    
    if (!access) {
      return wrappedContent;
    }

    if (access.requirePro) {
      return <RequireAuth requirePro>{wrappedContent}</RequireAuth>;
    }

    if (access.requireAuth) {
      return <RequireAuth>{wrappedContent}</RequireAuth>;
    }

    return wrappedContent;
  };

  return (
    <AIMessageProvider>
      <StudioAudioContext.Provider value={studioAudioValue}>
        <div className="h-screen flex bg-studio-bg text-white">
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            
            <div className="flex-1 overflow-x-auto overflow-y-auto pb-16 md:pb-0 bg-studio-bg">
              <div className="min-w-[1600px] p-3 md:p-6 studio-content bg-studio-bg">
                {renderTabContent()}
              </div>
            </div>
            
            <TransportControls currentTool={getActiveToolName(activeTab)} activeTab={activeTab} />
          </div>
          
          {/* Mobile Bottom Navigation */}
          <MobileNav activeTab={activeTab} onTabChange={(tab: string) => setActiveTab(tab as Tab)} />
          
          {/* iOS Audio Enable Button */}
          <IOSAudioEnable />
        </div>
      </StudioAudioContext.Provider>
    </AIMessageProvider>
  );
}
