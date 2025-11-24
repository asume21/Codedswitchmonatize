import { useCallback, useMemo } from 'react';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import type { TrackClip } from '@/types/studioTracks';

export type StudioTrackType = 'audio' | 'midi' | 'beat' | 'aux' | 'lyrics';

export interface StudioTrack extends TrackClip {
  type: StudioTrackType;
  instrument?: string;
  notes: any[];
  audioUrl?: string;
  source?: string;
  color?: string;
  volume: number;
  pan: number;
  data: any;
}

export interface StudioTrackInput {
  id?: string;
  name: string;
  kind?: TrackClip['kind'];
  type?: StudioTrackType;
  instrument?: string;
  notes?: any[];
  audioUrl?: string;
  source?: string;
  color?: string;
  volume?: number;
  pan?: number;
  data?: any;
  lengthBars?: number;
  startBar?: number;
  muted?: boolean;
  solo?: boolean;
  payload?: Record<string, unknown>;
}

const EXTRA_PAYLOAD_KEYS = [
  'type',
  'instrument',
  'notes',
  'audioUrl',
  'source',
  'color',
  'volume',
  'pan',
  'data',
  'pattern',
] as const;

function buildPayload(existing: TrackClip | undefined, updates: Partial<StudioTrack>) {
  const payload = { ...(existing?.payload ?? {}) };

  EXTRA_PAYLOAD_KEYS.forEach((key) => {
    const value = (updates as any)[key];
    if (value !== undefined) {
      (payload as any)[key] = value;
    }
  });

  if (updates.payload) {
    Object.assign(payload, updates.payload);
  }

  return payload;
}

export function useTracks() {
  const { tracks, addTrack, updateTrack, removeTrack, clearTracks } = useTrackStore();

  const normalized = useMemo<StudioTrack[]>(() => (
    tracks.map((track) => ({
      ...track,
      id: track.id,
      name: track.name,
      kind: track.kind,
      lengthBars: track.lengthBars,
      startBar: track.startBar,
      muted: track.muted ?? false,
      solo: track.solo ?? false,
      payload: track.payload,
      type: (track.payload?.type as StudioTrackType) ?? (track.kind === 'audio' ? 'audio' : track.kind === 'beat' ? 'beat' : 'midi'),
      instrument: track.payload?.instrument as string | undefined,
      notes: (track.payload?.notes as any[]) ?? [],
      audioUrl: track.payload?.audioUrl as string | undefined,
      source: track.payload?.source as string | undefined,
      color: track.payload?.color as string | undefined,
      volume: typeof track.payload?.volume === 'number' ? track.payload.volume : 0.8,
      pan: typeof track.payload?.pan === 'number' ? track.payload.pan : 0,
      data: track.payload?.data ?? track.payload ?? {},
    }))
  ), [tracks]);

  const addStudioTrack = useCallback((track: StudioTrackInput) => {
    const id = track.id ?? (crypto.randomUUID ? crypto.randomUUID() : `track-${Date.now()}`);
    const payload = buildPayload(undefined, track);

    addTrack({
      id,
      name: track.name ?? 'Track',
      kind: track.kind ?? (track.type === 'audio' ? 'audio' : track.type === 'beat' ? 'beat' : 'piano'),
      lengthBars: track.lengthBars ?? 4,
      startBar: track.startBar ?? 0,
      muted: track.muted ?? false,
      solo: track.solo ?? false,
      payload,
    });

    return id;
  }, [addTrack]);

  const updateStudioTrack = useCallback((id: string, updates: Partial<StudioTrack>) => {
    const existing = tracks.find((track) => track.id === id);
    const payload = buildPayload(existing, updates);

    updateTrack(id, {
      name: updates.name,
      lengthBars: updates.lengthBars,
      startBar: updates.startBar,
      muted: updates.muted,
      solo: updates.solo,
      payload,
    });
  }, [tracks, updateTrack]);

  return {
    tracks: normalized,
    addTrack: addStudioTrack,
    updateTrack: updateStudioTrack,
    removeTrack,
    clearTracks,
  };
}
