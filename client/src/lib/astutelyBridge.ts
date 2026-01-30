import { astutelyGenerate, astutelyToNotes, type AstutelyGenerateOptions, type AstutelyResult } from '@/lib/astutelyEngine';

export const ASTUTELY_CHANNEL_MAPPING: Record<'drums' | 'bass' | 'chords' | 'melody', string> = {
  drums: 'track-astutely-drums',
  bass: 'track-astutely-bass',
  chords: 'track-astutely-chords',
  melody: 'track-astutely-melody'
};

export interface AstutelyPatternPayload {
  notes: ReturnType<typeof astutelyToNotes>;
  bpm: number;
  key: string;
  style: string;
  timestamp: number;
  channelMapping: Record<string, string>;
  meta?: AstutelyResult['meta'];
  isFallback?: boolean;
  fallbackReason?: string;
}

export async function requestAstutelyPattern(options: AstutelyGenerateOptions) {
  const result = await astutelyGenerate(options);
  const notes = astutelyToNotes(result);
  const payload: AstutelyPatternPayload = {
    notes,
    bpm: result.bpm,
    key: result.key,
    style: result.style,
    timestamp: Date.now(),
    channelMapping: ASTUTELY_CHANNEL_MAPPING,
    meta: result.meta,
    isFallback: result.isFallback,
    fallbackReason: result.fallbackReason,
  };

  broadcastAstutelyPattern(payload);

  return {
    result,
    notes,
    payload
  };
}

export function broadcastAstutelyPattern(payload: AstutelyPatternPayload) {
  window.dispatchEvent(new CustomEvent('astutely:generated', { detail: payload }));
  try {
    localStorage.setItem('astutely-generated', JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to persist Astutely payload', error);
  }
}

const GENRE_TO_STYLE: Record<string, string> = {
  'hip-hop': 'Drake smooth',
  trap: 'Travis Scott rage',
  pop: 'The Weeknd dark',
  electronic: 'Future bass',
  house: 'Future bass',
  techno: 'Future bass',
  jazz: 'Lo-fi chill',
  'lo-fi': 'Lo-fi chill',
  ambient: 'Lo-fi chill',
  rock: 'Latin trap',
  funk: 'Afrobeats bounce',
  rnb: 'The Weeknd dark',
  'r&b': 'The Weeknd dark',
  latin: 'Latin trap',
  afrobeats: 'Afrobeats bounce'
};

export function mapGenreToAstutelyStyle(genre: string, fallback: string = 'Drake smooth') {
  if (!genre) return fallback;
  const normalized = genre.trim().toLowerCase();
  return GENRE_TO_STYLE[normalized] || fallback;
}
