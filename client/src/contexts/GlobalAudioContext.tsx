import { createContext, useContext, useRef, useState, useCallback, useEffect, type ReactNode } from 'react';

interface AudioSource {
  id: string;
  type: 'file' | 'buffer' | 'stream';
  url?: string;
  buffer?: AudioBuffer;
  name: string;
}

// Custom event types for global audio communication
declare global {
  interface WindowEventMap {
    'globalAudio:load': CustomEvent<{ name: string; url: string; type?: string; autoplay?: boolean }>;
    'globalAudio:play': CustomEvent<void>;
    'globalAudio:pause': CustomEvent<void>;
    'globalAudio:stop': CustomEvent<void>;
    'globalAudio:setElement': CustomEvent<{ element: HTMLAudioElement; name: string }>;
  }
}

interface GlobalAudioContextValue {
  // Audio state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  currentSource: AudioSource | null;
  
  // Controls
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  
  // Load audio
  loadAudioFile: (file: File) => Promise<void>;
  loadAudioUrl: (url: string, name?: string) => Promise<void>;
  loadAudioBuffer: (buffer: AudioBuffer, name?: string) => void;
  
  // Web Audio API access
  audioContext: AudioContext | null;
  masterGain: GainNode | null;
}

const GlobalAudioContext = createContext<GlobalAudioContextValue | undefined>(undefined);

export function GlobalAudioProvider({ children }: { children: ReactNode }) {
  // Refs for Web Audio API (persist across renders)
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [currentSource, setCurrentSource] = useState<AudioSource | null>(null);

  // Initialize AudioContext lazily (needs user interaction)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
    }
    
    // Resume if suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  }, []);

  // Update current time while playing
  useEffect(() => {
    let animationId: number;
    
    const updateTime = () => {
      if (isPlaying && audioContextRef.current) {
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        setCurrentTime(pauseTimeRef.current + elapsed);
        animationId = requestAnimationFrame(updateTime);
      }
    };
    
    if (isPlaying) {
      animationId = requestAnimationFrame(updateTime);
    }
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isPlaying]);

  // Play
  const play = useCallback(() => {
    const ctx = getAudioContext();
    const buffer = audioBufferRef.current;
    
    if (!buffer || !masterGainRef.current) return;
    
    // Stop existing source
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch { /* ignore - source may already be stopped */ }
    }
    
    // Create new source
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(masterGainRef.current);
    
    // Start from pause position
    const offset = pauseTimeRef.current % buffer.duration;
    source.start(0, offset);
    
    startTimeRef.current = ctx.currentTime;
    sourceNodeRef.current = source;
    setIsPlaying(true);
    
    // Handle end
    source.onended = () => {
      if (isPlaying) {
        setIsPlaying(false);
        pauseTimeRef.current = 0;
        setCurrentTime(0);
      }
    };
  }, [getAudioContext, isPlaying]);

  // Pause
  const pause = useCallback(() => {
    if (sourceNodeRef.current && isPlaying) {
      try {
        sourceNodeRef.current.stop();
      } catch { /* ignore - source may already be stopped */ }
      
      // Save current position
      if (audioContextRef.current) {
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        pauseTimeRef.current += elapsed;
      }
    }
    setIsPlaying(false);
  }, [isPlaying]);

  // Stop
  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch { /* ignore - source may already be stopped */ }
    }
    pauseTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  // Seek
  const seek = useCallback((time: number) => {
    const wasPlaying = isPlaying;
    
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch { /* ignore - source may already be stopped */ }
    }
    
    pauseTimeRef.current = Math.max(0, Math.min(time, duration));
    setCurrentTime(pauseTimeRef.current);
    
    if (wasPlaying) {
      // Small delay to let stop complete
      setTimeout(() => play(), 10);
    }
  }, [isPlaying, duration, play]);

  // Set volume
  const setVolume = useCallback((vol: number) => {
    const clampedVol = Math.max(0, Math.min(1, vol));
    setVolumeState(clampedVol);
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = clampedVol;
    }
  }, []);

  // Load audio from File
  const loadAudioFile = useCallback(async (file: File) => {
    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    audioBufferRef.current = audioBuffer;
    pauseTimeRef.current = 0;
    setDuration(audioBuffer.duration);
    setCurrentTime(0);
    setCurrentSource({
      id: `file-${Date.now()}`,
      type: 'file',
      name: file.name,
    });
  }, [getAudioContext]);

  // Load audio from URL
  const loadAudioUrl = useCallback(async (url: string, name?: string) => {
    const ctx = getAudioContext();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    audioBufferRef.current = audioBuffer;
    pauseTimeRef.current = 0;
    setDuration(audioBuffer.duration);
    setCurrentTime(0);
    setCurrentSource({
      id: `url-${Date.now()}`,
      type: 'file',
      url,
      name: name || url.split('/').pop() || 'Audio',
    });
  }, [getAudioContext]);

  // Load audio from buffer
  const loadAudioBuffer = useCallback((buffer: AudioBuffer, name?: string) => {
    audioBufferRef.current = buffer;
    pauseTimeRef.current = 0;
    setDuration(buffer.duration);
    setCurrentTime(0);
    setCurrentSource({
      id: `buffer-${Date.now()}`,
      type: 'buffer',
      buffer,
      name: name || 'Audio Buffer',
    });
  }, []);

  // Listen for global audio events from other components
  useEffect(() => {
    const handleLoad = async (e: CustomEvent<{ name: string; url: string; type?: string; autoplay?: boolean }>) => {
      try {
        await loadAudioUrl(e.detail.url, e.detail.name);
        if (e.detail.autoplay) {
          setTimeout(() => play(), 100);
        }
      } catch (err) {
        console.error('GlobalAudio: Failed to load audio', err);
      }
    };

    const handlePlay = () => play();
    const handlePause = () => pause();
    const handleStop = () => stop();

    // Add listeners - use type assertion for custom events
    window.addEventListener('globalAudio:load', handleLoad as unknown as (e: Event) => void);
    window.addEventListener('globalAudio:play', handlePlay);
    window.addEventListener('globalAudio:pause', handlePause);
    window.addEventListener('globalAudio:stop', handleStop);

    return () => {
      window.removeEventListener('globalAudio:load', handleLoad as unknown as (e: Event) => void);
      window.removeEventListener('globalAudio:play', handlePlay);
      window.removeEventListener('globalAudio:pause', handlePause);
      window.removeEventListener('globalAudio:stop', handleStop);
    };
  }, [loadAudioUrl, play, pause, stop]);

  const value: GlobalAudioContextValue = {
    isPlaying,
    currentTime,
    duration,
    volume,
    currentSource,
    play,
    pause,
    stop,
    seek,
    setVolume,
    loadAudioFile,
    loadAudioUrl,
    loadAudioBuffer,
    audioContext: audioContextRef.current,
    masterGain: masterGainRef.current,
  };

  return (
    <GlobalAudioContext.Provider value={value}>
      {children}
    </GlobalAudioContext.Provider>
  );
}

export function useGlobalAudio() {
  const context = useContext(GlobalAudioContext);
  if (!context) {
    throw new Error('useGlobalAudio must be used within a GlobalAudioProvider');
  }
  return context;
}

// Export for direct access to singleton audio context
export { GlobalAudioContext };
