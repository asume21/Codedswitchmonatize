import { useEffect, useMemo, useRef } from 'react';
import { AudioPremixCache } from '@/lib/audioPremix';

export interface UsePremixedAudioOptions {
  cacheKey: string;
  urls: string[];
  volume?: number;
  loop?: boolean;
}

export function usePremixedAudio({ cacheKey, urls, volume = 1, loop = false }: UsePremixedAudioOptions) {
  const cacheRef = useRef(new AudioPremixCache());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const prepare = useMemo(() => {
    return async () => {
      if (!urls.length) return null;
      const premixUrl = await cacheRef.current.getOrCreate(cacheKey, urls);
      const playbackUrl = premixUrl ?? urls[0];

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.crossOrigin = 'anonymous';
      }

      audioRef.current.src = playbackUrl;
      audioRef.current.loop = loop;
      audioRef.current.volume = volume;
      return audioRef.current;
    };
  }, [cacheKey, urls, loop, volume]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      cacheRef.current.clear();
    };
  }, []);

  return {
    prepareAudio: prepare,
    stop: () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    },
  };
}
