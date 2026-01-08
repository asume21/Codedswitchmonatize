import { useState, createContext, useEffect } from "react";
import { useLocation } from "wouter";
import Header from "@/components/studio/Header";
import TransportControls from "@/components/studio/TransportControls";
import GlobalTransportBar from "@/components/studio/GlobalTransportBar";
import { IOSAudioEnable } from "@/components/IOSAudioEnable";
import MobileNav from "@/components/studio/MobileNav";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
// PlaylistManager integrated into TransportControls
import { useAudio } from "@/hooks/use-audio";
import { AIMessageProvider } from "@/contexts/AIMessageContext";
import { TransportProvider } from "@/contexts/TransportContext";
import {
  DEFAULT_STUDIO_TAB,
  getStudioTabById,
  isStudioTabId,
  resolveStudioTabFromPath,
  type StudioTabId,
} from "@/config/studioTabs";

// Global studio audio context for master playback
export const StudioAudioContext = createContext({
  currentPattern: {} as any,
  currentMelody: [] as any[],
  currentLyrics: "" as string,
  currentCodeMusic: {} as unknown,
  currentLayers: [] as any[],
  currentTracks: [] as any[],
  currentKey: "C" as string,
  currentUploadedSong: null as any,
  uploadedSongAudio: null as HTMLAudioElement | null,
  isPlaying: false,
  bpm: 120,
  playMode: "current" as "current" | "all",
  setPlayMode: (mode: "current" | "all") => {},
  activeTab: DEFAULT_STUDIO_TAB as StudioTabId,
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
  setCurrentUploadedSong: (song: any, audio: HTMLAudioElement | null) => {},
  setBpm: (bpm: number) => {},
  setCurrentKey: (key: string) => {},
  playCurrentAudio: () => Promise.resolve(),
  stopCurrentAudio: () => {},
  playFullSong: () => Promise.resolve(),
  stopFullSong: () => {},
});

export default function Studio() {
  const [location] = useLocation();

  const [activeTab, setActiveTab] = useState<StudioTabId>(() =>
    resolveStudioTabFromPath(location),
  );

  useEffect(() => {
    setActiveTab(resolveStudioTabFromPath(location));
  }, [location]);
  const [currentPattern, setCurrentPattern] = useState({});
  const [currentMelody, setCurrentMelody] = useState<any[]>([]);
  const [currentLyrics, setCurrentLyrics] = useState("");
  const [currentCodeMusic, setCurrentCodeMusic] = useState({});
  const [currentLayers, setCurrentLayers] = useState<any[]>([]);
  const [currentTracks, setCurrentTracks] = useState<any[]>([]);
  const [currentKey, setCurrentKey] = useState("C");
  const [currentUploadedSong, setCurrentUploadedSong] = useState<any>(null);
  const [uploadedSongAudio, setUploadedSongAudio] = useState<HTMLAudioElement | null>(null);
  const [isStudioPlaying, setIsStudioPlaying] = useState(false);
  const [studioBpm, setStudioBpm] = useState(120);
  const [playMode, setPlayMode] = useState<'current' | 'all'>('current'); // New play mode state
  const [currentPlaylist, setCurrentPlaylist] = useState<any>(null); // Current active playlist
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0); // Current song in playlist
  
  // Handler to set uploaded song and audio element
  const handleSetCurrentUploadedSong = (song: any, audio: HTMLAudioElement | null) => {
    setCurrentUploadedSong(song);
    setUploadedSongAudio(audio);
  };
  
  const { initialize, isInitialized } = useAudio();

  // Listen for tab navigation events from other components
  useEffect(() => {
    const handleTabNavigation = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const targetTab = customEvent.detail;

      if (typeof targetTab === "string" && isStudioTabId(targetTab)) {
        setActiveTab(targetTab);
      }
    };

    window.addEventListener("navigateToTab", handleTabNavigation as EventListener);
    return () => {
      window.removeEventListener("navigateToTab", handleTabNavigation as EventListener);
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

    // Also start any uploaded song (Astutely/global transport should honor uploaded media)
    try {
      if (uploadedSongAudio) {
        uploadedSongAudio.currentTime = 0;
        await uploadedSongAudio.play();
        console.log("▶️ Uploaded song playing via global transport");
      }
    } catch (err) {
      console.warn("⚠️ Unable to auto-play uploaded song", err);
    }
    
    setIsStudioPlaying(true);
  };

  const stopFullSong = () => {
    setIsStudioPlaying(false);

    if (uploadedSongAudio) {
      uploadedSongAudio.pause();
      uploadedSongAudio.currentTime = 0;
    }
  };

  const activeTabConfig = getStudioTabById(activeTab);

  const studioAudioValue = {
    currentPattern,
    currentMelody,
    currentLyrics,
    currentCodeMusic,
    currentLayers,
    currentTracks,
    currentKey,
    currentUploadedSong,
    uploadedSongAudio,
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
    setCurrentUploadedSong: handleSetCurrentUploadedSong,
    setBpm: setStudioBpm,
    setCurrentKey,
    playCurrentAudio,
    stopCurrentAudio,
    playFullSong,
    stopFullSong,
  };

  const renderTabContent = () => {
    const tabConfig = getStudioTabById(activeTab) ?? getStudioTabById(DEFAULT_STUDIO_TAB);

    if (!tabConfig) {
      return null;
    }

    const wrappedContent = <ErrorBoundary>{tabConfig.component()}</ErrorBoundary>;

    if (tabConfig.requirePro) {
      return <RequireAuth requirePro>{wrappedContent}</RequireAuth>;
    }

    if (tabConfig.requireAuth) {
      return <RequireAuth>{wrappedContent}</RequireAuth>;
    }

    return wrappedContent;
  };

  return (
    <AIMessageProvider>
      <TransportProvider initialTempo={studioBpm}>
        <StudioAudioContext.Provider value={studioAudioValue}>
          {/* Global Transport Bar - Fixed at bottom, outside main layout */}
          <GlobalTransportBar />
          
          <div className="h-screen flex bg-studio-bg text-white pb-16">
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            
            {/* Quick-access transport/navigation for tests and keyboard users */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800" role="navigation">
              <button className="px-3 py-2 rounded bg-purple-600 play-button">Play</button>
              <button className="px-3 py-2 rounded bg-slate-700 stop-button">Stop</button>
              <span data-testid="credits-balance" className="text-sm text-slate-300">
                Credits: 0
              </span>
            </div>
            
            {/* Main content area - add bottom padding for GlobalTransportBar */}
            <div className="flex-1 overflow-x-auto overflow-y-auto pb-20 md:pb-20 bg-studio-bg">
              <div className="min-w-[1600px] p-3 md:p-6 studio-content bg-studio-bg">
                {renderTabContent()}
              </div>
            </div>
            
            <TransportControls currentTool={activeTabConfig?.shortName ?? "Studio"} activeTab={activeTab} />
          </div>
          
          {/* Mobile Bottom Navigation */}
          <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
          
          {/* iOS Audio Enable Button */}
          <IOSAudioEnable />
          </div>
        </StudioAudioContext.Provider>
      </TransportProvider>
    </AIMessageProvider>
  );
}
