import { useCallback, useMemo, useEffect } from 'react';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import type { TrackClip, TrackPayload, TrackType } from '@/types/studioTracks';
import { DEFAULT_TRACK_PAYLOAD } from '@/types/studioTracks';
import { useToast } from '@/hooks/use-toast';

export type StudioTrackType = TrackType;

export interface StudioTrack extends TrackClip {
  type: StudioTrackType;
  instrument?: string;
  notes: any[];
  audioUrl?: string;
  source: string;
  color?: string;
  volume: number;
  pan: number;
  bpm: number;
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
  bpm?: number;
  data?: any;
  lengthBars?: number;
  startBar?: number;
  muted?: boolean;
  solo?: boolean;
  payload?: Partial<TrackPayload>;
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
  'bpm',
  'data',
  'pattern',
] as const;

function buildPayload(existing: TrackClip | undefined, updates: Partial<StudioTrack>, isNew: boolean = false): TrackPayload {
  const base = isNew ? { ...DEFAULT_TRACK_PAYLOAD } : { ...(existing?.payload ?? DEFAULT_TRACK_PAYLOAD) };
  const payload = { ...base } as TrackPayload;

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
  const { 
    tracks, 
    addTrack, 
    updateTrack, 
    removeTrack, 
    clearTracks,
    loadTracksFromServer,
    saveTrackToServer,
    currentProjectId,
    isLoading,
    isSynced,
    setProjectId,
  } = useTrackStore();
  const { toast } = useToast();

  const normalized = useMemo<StudioTrack[]>(() => (
    tracks.map((track) => {
      const p = track.payload ?? {};
      return {
        ...track,
        id: track.id,
        name: track.name,
        kind: track.kind,
        lengthBars: track.lengthBars,
        startBar: track.startBar,
        muted: track.muted ?? false,
        solo: track.solo ?? false,
        payload: track.payload,
        type: (p.type as StudioTrackType) ?? (track.kind === 'audio' ? 'audio' : track.kind === 'beat' ? 'beat' : 'midi'),
        instrument: p.instrument as string | undefined,
        notes: (p.notes as any[]) ?? [],
        audioUrl: p.audioUrl as string | undefined,
        source: (p.source as string) ?? 'unknown',
        color: p.color as string | undefined,
        volume: typeof p.volume === 'number' ? p.volume : 0.8,
        pan: typeof p.pan === 'number' ? p.pan : 0,
        bpm: typeof p.bpm === 'number' ? p.bpm : 120,
        data: p.data ?? p ?? {},
      };
    })
  ), [tracks]);

  const addStudioTrack = useCallback((track: StudioTrackInput) => {
    const id = track.id ?? (crypto.randomUUID ? crypto.randomUUID() : `track-${Date.now()}`);
    
    const inferredType: StudioTrackType = track.type ?? (track.kind === 'audio' ? 'audio' : track.kind === 'beat' ? 'beat' : 'midi');
    
    const trackWithDefaults: Partial<StudioTrack> = {
      type: inferredType,
      instrument: track.instrument,
      notes: track.notes ?? [],
      audioUrl: track.audioUrl,
      source: track.source ?? 'unknown',
      color: track.color,
      volume: track.volume ?? 0.8,
      pan: track.pan ?? 0,
      bpm: track.bpm ?? 120,
      data: track.data,
    };
    
    if (track.payload) {
      Object.assign(trackWithDefaults, track.payload);
    }
    
    const payload = buildPayload(undefined, trackWithDefaults, true);

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
    const payload = buildPayload(existing, updates, false);

    updateTrack(id, {
      name: updates.name,
      lengthBars: updates.lengthBars,
      startBar: updates.startBar,
      muted: updates.muted,
      solo: updates.solo,
      payload,
    });
  }, [tracks, updateTrack]);

  const addAndSaveTrack = useCallback(async (track: StudioTrackInput): Promise<string> => {
    const id = addStudioTrack(track);
    
    const trackClip: TrackClip = {
      id,
      name: track.name ?? 'Track',
      kind: track.kind ?? (track.type === 'audio' ? 'audio' : track.type === 'beat' ? 'beat' : 'piano'),
      lengthBars: track.lengthBars ?? 4,
      startBar: track.startBar ?? 0,
      muted: track.muted ?? false,
      solo: track.solo ?? false,
      payload: {
        type: track.type ?? 'midi',
        audioUrl: track.audioUrl,
        volume: track.volume ?? 0.8,
        pan: track.pan ?? 0,
        notes: track.notes ?? [],
        instrument: track.instrument,
        bpm: track.bpm ?? 120,
        source: track.source ?? 'generated',
        color: track.color,
      },
    };
    
    const serverId = await saveTrackToServer(trackClip);
    if (serverId) {
      toast({ title: '✅ Track Saved', description: `"${track.name}" saved to your library` });
    }
    
    return id;
  }, [addStudioTrack, saveTrackToServer, toast]);

  const loadTracks = useCallback(async (projectId?: string) => {
    await loadTracksFromServer(projectId);
    toast({ title: '📂 Tracks Loaded', description: 'Your tracks have been loaded' });
  }, [loadTracksFromServer, toast]);

  return {
    tracks: normalized,
    addTrack: addStudioTrack,
    addAndSaveTrack,
    updateTrack: updateStudioTrack,
    removeTrack,
    clearTracks,
    loadTracks,
    saveTrack: saveTrackToServer,
    currentProjectId,
    setProjectId,
    isLoading,
    isSynced,
  };
}
