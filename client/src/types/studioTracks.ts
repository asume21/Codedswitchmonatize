export type TrackKind = 'beat' | 'piano' | 'midi' | 'audio' | 'aux';

export type TrackType = 'audio' | 'midi' | 'beat' | 'aux' | 'lyrics';

export interface TrackPayload {
  type: TrackType;
  source: string;
  volume: number;
  pan: number;
  bpm: number;
  notes?: any[];
  audioUrl?: string;
  instrument?: string;
  color?: string;
  pattern?: any;
  data?: any;
  // Extended properties for various track types
  startTime?: number;
  duration?: number;
  packId?: string;
  samples?: any[];
  key?: string;
  genre?: string;
  [key: string]: any; // Allow additional properties
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
};

export function createTrackPayload(overrides: Partial<TrackPayload> = {}): TrackPayload {
  return {
    ...DEFAULT_TRACK_PAYLOAD,
    ...overrides,
  };
}
