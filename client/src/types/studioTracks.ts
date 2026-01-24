export type TrackKind = 'beat' | 'piano' | 'midi' | 'audio' | 'aux';

export type TrackType = 'audio' | 'midi' | 'beat' | 'aux' | 'lyrics';

export interface TrackPayload {
  type: TrackType;
  source: string;
  volume: number;
  pan: number;
  bpm: number;
  notes?: TrackNote[];
  audioUrl?: string;
  instrument?: string;
  color?: string;
  pattern?: unknown;
  data?: unknown;
  sendA?: number;
  sendB?: number;
  sendLevels?: Record<string, number>;
  // Extended properties for various track types
  startTime?: number;
  duration?: number;
  packId?: string;
  samples?: SampleInfo[];
  key?: string;
  genre?: string;
  [key: string]: unknown; // Allow additional properties
}

export interface TrackNote {
  id?: string;
  step?: number;
  length?: number;
  velocity?: number;
  note?: string;
  octave?: number;
  [key: string]: unknown;
}

export interface SampleInfo {
  id?: string;
  name?: string;
  url?: string;
  startTime?: number;
  duration?: number;
  gain?: number;
  pan?: number;
  [key: string]: unknown;
}

export interface TrackClip {
  id: string;
  kind: TrackKind;
  name: string;
  lengthBars: number;
  startBar: number;
  muted?: boolean;
  solo?: boolean;
  payload: TrackPayload;
}

export const DEFAULT_TRACK_PAYLOAD: TrackPayload = {
  type: 'midi',
  source: 'unknown',
  volume: 0.8,
  pan: 0,
  bpm: 120,
  notes: [],
  sendA: -60,
  sendB: -60,
  sendLevels: {},
};

export function createTrackPayload(overrides: Partial<TrackPayload> = {}): TrackPayload {
  return {
    ...DEFAULT_TRACK_PAYLOAD,
    ...overrides,
  };
}
