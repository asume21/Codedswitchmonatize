import { createContext, useContext, useRef, useState, useCallback, useEffect, type ReactNode } from 'react';

interface AudioSource {
  id: string;
  type: 'file' | 'buffer' | 'stream';
  url?: string;
  buffer?: AudioBuffer;
  name: string;
}

declare global {
  interface WindowEventMap {
    'globalAudio:load': CustomEvent<{ name: string; url: string; type?: string; autoplay?: boolean }>;
    'globalAudio:addToPlaylist': CustomEvent<{ name: string; url: string; type?: string; autoplay?: boolean }>;
    'globalAudio:play': CustomEvent<void>;
    'globalAudio:pause': CustomEvent<void>;
    'globalAudio:stop': CustomEvent<void>;
    'globalAudio:next': CustomEvent<void>;
    'globalAudio:prev': CustomEvent<void>;
    'globalAudio:setElement': CustomEvent<{ element: HTMLAudioElement; name: string }>;
  }
}

interface GlobalAudioContextValue {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  currentSource: AudioSource | null;
  playlist: AudioSource[];
  currentIndex: number;

  play: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;

  loadAudioFile: (file: File) => Promise<void>;
  loadAudioUrl: (url: string, name?: string) => Promise<void>;
  loadAudioBuffer: (buffer: AudioBuffer, name?: string) => void;
  addToPlaylistUrl: (url: string, name?: string, autoplay?: boolean) => Promise<void>;
  addToPlaylistBuffer: (buffer: AudioBuffer, name?: string, autoplay?: boolean) => void;

  audioContext: AudioContext | null;
  masterGain: GainNode | null;
}

const GlobalAudioContext = createContext<GlobalAudioContextValue | undefined>(undefined);

export function GlobalAudioProvider({ children }: { children: ReactNode }) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [currentSource, setCurrentSource] = useState<AudioSource | null>(null);
  const [playlist, setPlaylist] = useState<AudioSource[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextConstructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error('Web Audio API not supported in this browser');
      }
      audioContextRef.current = new AudioContextConstructor();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

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

  const setSourceFromBuffer = useCallback(
    (buffer: AudioBuffer, source: AudioSource, autoplay: boolean) => {
      audioBufferRef.current = buffer;
      setDuration(buffer.duration);
      setCurrentSource(source);
      pauseTimeRef.current = 0;
      setCurrentTime(0);
      if (autoplay) {
        setTimeout(() => play(), 10);
      }
    },
    [],
  );

  const play = useCallback(() => {
    const ctx = getAudioContext();
    const buffer = audioBufferRef.current;
    if (!buffer || !masterGainRef.current) return;

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* ignore */ }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(masterGainRef.current);
    const offset = pauseTimeRef.current % buffer.duration;
    source.start(0, offset);
    startTimeRef.current = ctx.currentTime;
    sourceNodeRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
      if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
        setTimeout(() => next(), 10);
      } else {
        pauseTimeRef.current = 0;
        setCurrentTime(0);
      }
    };
  }, [currentIndex, getAudioContext, playlist.length]);

  const pause = useCallback(() => {
    if (sourceNodeRef.current && isPlaying) {
      try { sourceNodeRef.current.stop(); } catch { /* ignore */ }
      if (audioContextRef.current) {
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        pauseTimeRef.current += elapsed;
      }
    }
    setIsPlaying(false);
  }, [isPlaying]);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* ignore */ }
    }
    pauseTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const seek = useCallback(
    (time: number) => {
      const wasPlaying = isPlaying;
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch { /* ignore */ }
      }
      pauseTimeRef.current = Math.max(0, Math.min(time, duration));
      setCurrentTime(pauseTimeRef.current);
      if (wasPlaying) {
        setTimeout(() => play(), 10);
      }
    },
    [duration, isPlaying, play],
  );

  const setVolume = useCallback((vol: number) => {
    const clampedVol = Math.max(0, Math.min(1, vol));
    setVolumeState(clampedVol);
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = clampedVol;
    }
  }, []);

  const jumpToIndex = useCallback(
    (idx: number, autoplay = true) => {
      if (idx < 0 || idx >= playlist.length) return;
      const target = playlist[idx];
      setCurrentIndex(idx);
      if (target.buffer) {
        setSourceFromBuffer(target.buffer, target, autoplay);
      } else if (target.url) {
        void (async () => {
          const ctx = getAudioContext();
          const res = await fetch(target.url!);
          const arr = await res.arrayBuffer();
          const buf = await ctx.decodeAudioData(arr);
          const updated = { ...target, buffer: buf, type: 'buffer' as const };
          setPlaylist(prev => prev.map((p, i) => (i === idx ? updated : p)));
          setSourceFromBuffer(buf, updated, autoplay);
        })();
      }
    },
    [getAudioContext, playlist, setSourceFromBuffer],
  );

  const next = useCallback(() => {
    const idx = currentIndex + 1;
    if (idx < playlist.length) {
      jumpToIndex(idx, true);
    } else {
      stop();
    }
  }, [currentIndex, jumpToIndex, playlist.length, stop]);

  const previous = useCallback(() => {
    const idx = currentIndex - 1;
    if (idx >= 0) {
      jumpToIndex(idx, true);
    } else {
      seek(0);
    }
  }, [currentIndex, jumpToIndex, seek]);

  const loadAudioFile = useCallback(async (file: File) => {
    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    const src: AudioSource = { id: crypto.randomUUID(), type: 'buffer', buffer, name: file.name };
    setPlaylist([src]);
    setCurrentIndex(0);
    setSourceFromBuffer(buffer, src, false);
  }, [getAudioContext, setSourceFromBuffer]);

  const loadAudioUrl = useCallback(async (url: string, name?: string) => {
    const ctx = getAudioContext();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    const src: AudioSource = { id: crypto.randomUUID(), type: 'buffer', buffer, url, name: name || 'Audio' };
    setPlaylist([src]);
    setCurrentIndex(0);
    setSourceFromBuffer(buffer, src, false);
  }, [getAudioContext, setSourceFromBuffer]);

  const loadAudioBuffer = useCallback((buffer: AudioBuffer, name?: string) => {
    const ctx = getAudioContext();
    const src: AudioSource = { id: crypto.randomUUID(), type: 'buffer', buffer, name: name || 'Buffer' };
    setPlaylist([src]);
    setCurrentIndex(0);
    setSourceFromBuffer(buffer, src, false);
    ctx.resume();
  }, [getAudioContext, setSourceFromBuffer]);

  const addToPlaylistUrl = useCallback(async (url: string, name?: string, autoplay = false) => {
    const ctx = getAudioContext();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    const src: AudioSource = { id: crypto.randomUUID(), type: 'buffer', buffer, url, name: name || 'Audio' };
    setPlaylist(prev => {
      const nextList = [...prev, src];
      if (autoplay) {
        const idx = nextList.length - 1;
        setCurrentIndex(idx);
        setSourceFromBuffer(buffer, src, true);
      }
      return nextList;
    });
  }, [getAudioContext, setSourceFromBuffer]);

  const addToPlaylistBuffer = useCallback((buffer: AudioBuffer, name?: string, autoplay = false) => {
    const ctx = getAudioContext();
    const src: AudioSource = { id: crypto.randomUUID(), type: 'buffer', buffer, name: name || 'Buffer' };
    setPlaylist(prev => {
      const nextList = [...prev, src];
      if (autoplay) {
        const idx = nextList.length - 1;
        setCurrentIndex(idx);
        setSourceFromBuffer(buffer, src, true);
      }
      return nextList;
    });
    ctx.resume();
  }, [getAudioContext, setSourceFromBuffer]);

  useEffect(() => {
    const handleVolumeChange = (e: CustomEvent<{ volume: number }>) => setVolume(e.detail.volume);
    const handleLoad = (e: CustomEvent<{ name: string; url: string; type?: string; autoplay?: boolean }>) => {
      const { name, url, autoplay } = e.detail;
      loadAudioUrl(url, name).then(() => {
        if (autoplay) play();
      }).catch(err => console.error('Failed to load global audio:', err));
    };
    const handleAdd = (e: CustomEvent<{ name: string; url: string; type?: string; autoplay?: boolean }>) => {
      const { name, url, autoplay } = e.detail;
      addToPlaylistUrl(url, name, autoplay).catch(err => console.error('Failed to add global audio:', err));
    };
    const handlePlay = () => play();
    const handlePause = () => pause();
    const handleStop = () => stop();
    const handleNext = () => next();
    const handlePrev = () => previous();
    const handleSetElement: EventListener = (event) => {
      const e = event as CustomEvent<{ element: HTMLAudioElement; name: string }>;
      if (!e.detail?.element) return;
      (async () => {
        try {
          const audioEl = e.detail.element;
          const ctx = getAudioContext();
          const response = await fetch(audioEl.src);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          const src: AudioSource = { id: crypto.randomUUID(), type: 'buffer', buffer, name: e.detail.name };
          setPlaylist([src]);
          setCurrentIndex(0);
          setSourceFromBuffer(buffer, src, false);
        } catch (err) {
          console.error('Failed to set element for global audio:', err);
        }
      })();
    };

    window.addEventListener('globalAudio:volume', handleVolumeChange as EventListener);
    window.addEventListener('globalAudio:load', handleLoad as EventListener);
    window.addEventListener('globalAudio:addToPlaylist', handleAdd as EventListener);
    window.addEventListener('globalAudio:play', handlePlay as EventListener);
    window.addEventListener('globalAudio:pause', handlePause as EventListener);
    window.addEventListener('globalAudio:stop', handleStop as EventListener);
    window.addEventListener('globalAudio:next', handleNext as EventListener);
    window.addEventListener('globalAudio:prev', handlePrev as EventListener);
    window.addEventListener('globalAudio:setElement', handleSetElement);

    return () => {
      window.removeEventListener('globalAudio:volume', handleVolumeChange as EventListener);
      window.removeEventListener('globalAudio:load', handleLoad as EventListener);
      window.removeEventListener('globalAudio:addToPlaylist', handleAdd as EventListener);
      window.removeEventListener('globalAudio:play', handlePlay as EventListener);
      window.removeEventListener('globalAudio:pause', handlePause as EventListener);
      window.removeEventListener('globalAudio:stop', handleStop as EventListener);
      window.removeEventListener('globalAudio:next', handleNext as EventListener);
      window.removeEventListener('globalAudio:prev', handlePrev as EventListener);
      window.removeEventListener('globalAudio:setElement', handleSetElement);
    };
  }, [addToPlaylistUrl, getAudioContext, loadAudioUrl, next, pause, play, previous, setVolume, stop, setSourceFromBuffer]);

  return (
    <GlobalAudioContext.Provider
      value={{
        isPlaying,
        currentTime,
        duration,
        volume,
        currentSource,
        playlist,
        currentIndex,
        play,
        pause,
        stop,
        next,
        previous,
        seek,
        setVolume,
        loadAudioFile,
        loadAudioUrl,
        loadAudioBuffer,
        addToPlaylistUrl,
        addToPlaylistBuffer,
        audioContext: audioContextRef.current,
        masterGain: masterGainRef.current,
      }}
    >
      {children}
    </GlobalAudioContext.Provider>
  );
}

export function useGlobalAudio() {
  const ctx = useContext(GlobalAudioContext);
  if (!ctx) throw new Error('useGlobalAudio must be used within a GlobalAudioProvider');
  return ctx;
}
