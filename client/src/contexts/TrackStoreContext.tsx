import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { TrackClip, ArrangementClip } from '@/types/studioTracks';
import { apiRequest } from '@/lib/queryClient';

interface TrackStoreState {
  tracks: TrackClip[];
  currentProjectId: string | null;
  isLoading: boolean;
  isSynced: boolean;
}

const initialState: TrackStoreState = {
  tracks: [],
  currentProjectId: null,
  isLoading: false,
  isSynced: true,
};

type Action =
  | { type: 'ADD_TRACK'; track: TrackClip }
  | { type: 'UPDATE_TRACK'; id: string; updates: Partial<TrackClip> }
  | { type: 'REMOVE_TRACK'; id: string }
  | { type: 'SET_TRACKS'; tracks: TrackClip[] }
  | { type: 'CLEAR_TRACKS' }
  | { type: 'SET_PROJECT_ID'; projectId: string | null }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_SYNCED'; isSynced: boolean }
  // ─── Clip-level actions ──────────────────────────────────────────
  | { type: 'ADD_CLIP'; trackId: string; clip: ArrangementClip }
  | { type: 'UPDATE_CLIP'; trackId: string; clipId: string; updates: Partial<ArrangementClip> }
  | { type: 'REMOVE_CLIP'; trackId: string; clipId: string }
  | { type: 'MOVE_CLIP'; fromTrackId: string; toTrackId: string; clipId: string; newStartBeat?: number };

function trackReducer(state: TrackStoreState, action: Action): TrackStoreState {
  switch (action.type) {
    case 'ADD_TRACK':
      return {
        ...state,
        tracks: [...state.tracks, action.track],
        isSynced: false,
      };
    case 'UPDATE_TRACK':
      return {
        ...state,
        tracks: state.tracks.map((track) =>
          track.id === action.id ? { ...track, ...action.updates } : track
        ),
        isSynced: false,
      };
    case 'REMOVE_TRACK':
      return {
        ...state,
        tracks: state.tracks.filter((track) => track.id !== action.id),
        isSynced: false,
      };
    case 'SET_TRACKS':
      return {
        ...state,
        tracks: [...action.tracks],
        isSynced: true,
      };
    case 'CLEAR_TRACKS':
      return { ...initialState, currentProjectId: state.currentProjectId };
    case 'SET_PROJECT_ID':
      return { ...state, currentProjectId: action.projectId };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_SYNCED':
      return { ...state, isSynced: action.isSynced };

    // ─── Clip-level reducers ──────────────────────────────────────
    case 'ADD_CLIP':
      return {
        ...state,
        tracks: state.tracks.map((track) =>
          track.id === action.trackId
            ? { ...track, clips: [...(track.clips ?? []), action.clip] }
            : track
        ),
        isSynced: false,
      };
    case 'UPDATE_CLIP':
      return {
        ...state,
        tracks: state.tracks.map((track) =>
          track.id === action.trackId
            ? {
                ...track,
                clips: (track.clips ?? []).map((c) =>
                  c.id === action.clipId ? { ...c, ...action.updates } : c
                ),
              }
            : track
        ),
        isSynced: false,
      };
    case 'REMOVE_CLIP':
      return {
        ...state,
        tracks: state.tracks.map((track) =>
          track.id === action.trackId
            ? { ...track, clips: (track.clips ?? []).filter((c) => c.id !== action.clipId) }
            : track
        ),
        isSynced: false,
      };
    case 'MOVE_CLIP': {
      let clipToMove: ArrangementClip | undefined;
      // Remove from source track
      const tracksAfterRemove = state.tracks.map((track) => {
        if (track.id !== action.fromTrackId) return track;
        const clips = track.clips ?? [];
        clipToMove = clips.find((c) => c.id === action.clipId);
        return { ...track, clips: clips.filter((c) => c.id !== action.clipId) };
      });
      if (!clipToMove) return state;
      // Adjust start position if specified
      if (action.newStartBeat !== undefined) {
        const duration = clipToMove.endBeat - clipToMove.startBeat;
        clipToMove = { ...clipToMove, startBeat: action.newStartBeat, endBeat: action.newStartBeat + duration };
      }
      // Add to destination track
      const finalClip = clipToMove;
      return {
        ...state,
        tracks: tracksAfterRemove.map((track) =>
          track.id === action.toTrackId
            ? { ...track, clips: [...(track.clips ?? []), finalClip] }
            : track
        ),
        isSynced: false,
      };
    }
    default:
      return state;
  }
}

export interface TrackStoreContextValue {
  tracks: TrackClip[];
  currentProjectId: string | null;
  isLoading: boolean;
  isSynced: boolean;
  addTrack: (track: TrackClip) => void;
  updateTrack: (id: string, updates: Partial<TrackClip>) => void;
  removeTrack: (id: string) => void;
  setTracks: (tracks: TrackClip[]) => void;
  clearTracks: () => void;
  setProjectId: (projectId: string | null) => void;
  loadTracksFromServer: (projectId?: string) => Promise<void>;
  saveTrackToServer: (track: TrackClip) => Promise<string | null>;
  // ─── Clip-level operations ──────────────────────────────────────
  addClip: (trackId: string, clip: ArrangementClip) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<ArrangementClip>) => void;
  removeClip: (trackId: string, clipId: string) => void;
  moveClip: (fromTrackId: string, toTrackId: string, clipId: string, newStartBeat?: number) => void;
}

const TrackStoreContext = createContext<TrackStoreContextValue | undefined>(undefined);

export function TrackStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(trackReducer, initialState);

  const addTrack = useCallback((track: TrackClip) => {
    dispatch({ type: 'ADD_TRACK', track });
  }, []);

  const updateTrack = useCallback((id: string, updates: Partial<TrackClip>) => {
    dispatch({ type: 'UPDATE_TRACK', id, updates });
  }, []);

  const removeTrack = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TRACK', id });
  }, []);

  const setTracks = useCallback((tracks: TrackClip[]) => {
    dispatch({ type: 'SET_TRACKS', tracks });
  }, []);

  const clearTracks = useCallback(() => {
    dispatch({ type: 'CLEAR_TRACKS' });
  }, []);

  const setProjectId = useCallback((projectId: string | null) => {
    dispatch({ type: 'SET_PROJECT_ID', projectId });
  }, []);

  // ─── Clip-level callbacks ──────────────────────────────────────
  const addClip = useCallback((trackId: string, clip: ArrangementClip) => {
    dispatch({ type: 'ADD_CLIP', trackId, clip });
  }, []);

  const updateClip = useCallback((trackId: string, clipId: string, updates: Partial<ArrangementClip>) => {
    dispatch({ type: 'UPDATE_CLIP', trackId, clipId, updates });
  }, []);

  const removeClip = useCallback((trackId: string, clipId: string) => {
    dispatch({ type: 'REMOVE_CLIP', trackId, clipId });
  }, []);

  const moveClip = useCallback((fromTrackId: string, toTrackId: string, clipId: string, newStartBeat?: number) => {
    dispatch({ type: 'MOVE_CLIP', fromTrackId, toTrackId, clipId, newStartBeat });
  }, []);

  const loadTracksFromServer = useCallback(async (projectId?: string) => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    try {
      const pid = projectId || state.currentProjectId;
      const endpoint = pid ? `/api/tracks/project/${pid}` : '/api/tracks';
      const response = await apiRequest('GET', endpoint);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.tracks)) {
        const convertedTracks: TrackClip[] = data.tracks.map((t: any) => ({
          id: t.id,
          name: t.name,
          kind: t.type === 'beat' ? 'beat' : t.type === 'audio' || t.type === 'vocal' || t.type === 'recording' ? 'audio' : 'piano',
          lengthBars: Math.ceil((t.duration || 4000) / 1000),
          startBar: Math.floor((t.position || 0) / 1000),
          muted: t.muted || false,
          solo: t.solo || false,
          payload: {
            type: t.type,
            audioUrl: t.audioUrl,
            volume: (t.volume || 100) / 100,
            pan: (t.pan || 0) / 100,
            color: t.color,
            effects: t.effects,
            metadata: t.metadata,
            notes: [],
          },
        }));
        dispatch({ type: 'SET_TRACKS', tracks: convertedTracks });
      }
    } catch (error) {
      console.error('Failed to load tracks from server:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, [state.currentProjectId]);

  const saveTrackToServer = useCallback(async (track: TrackClip): Promise<string | null> => {
    try {
      const payload = track.payload || {};
      const trackType = payload.type || (track.kind === 'audio' ? 'audio' : track.kind === 'beat' ? 'beat' : 'midi');
      
      const requestBody: any = {
        projectId: state.currentProjectId,
        name: track.name,
        type: trackType,
        position: (track.startBar || 0) * 1000,
        duration: (track.lengthBars || 4) * 1000,
        volume: Math.round((payload.volume || 0.8) * 100),
        pan: Math.round((payload.pan || 0) * 100),
        color: payload.color,
        effects: payload.effects,
        metadata: {
          notes: payload.notes,
          instrument: payload.instrument,
          bpm: payload.bpm,
          source: payload.source,
        },
      };
      
      // Only include audioUrl if it exists (for audio/vocal tracks)
      if (payload.audioUrl) {
        requestBody.audioUrl = payload.audioUrl;
      }
      
      const response = await apiRequest('POST', '/api/tracks', requestBody);
      
      const data = await response.json();
      if (data.success && data.track) {
        dispatch({ type: 'SET_SYNCED', isSynced: true });
        return data.track.id;
      }
      return null;
    } catch (error) {
      console.error('Failed to save track to server:', error);
      return null;
    }
  }, [state.currentProjectId]);

  const value = useMemo<TrackStoreContextValue>(() => ({
    tracks: state.tracks,
    currentProjectId: state.currentProjectId,
    isLoading: state.isLoading,
    isSynced: state.isSynced,
    addTrack,
    updateTrack,
    removeTrack,
    setTracks,
    clearTracks,
    setProjectId,
    loadTracksFromServer,
    saveTrackToServer,
    addClip,
    updateClip,
    removeClip,
    moveClip,
  }), [state.tracks, state.currentProjectId, state.isLoading, state.isSynced, addTrack, updateTrack, removeTrack, setTracks, clearTracks, setProjectId, loadTracksFromServer, saveTrackToServer, addClip, updateClip, removeClip, moveClip]);

  return (
    <TrackStoreContext.Provider value={value}>
      {children}
    </TrackStoreContext.Provider>
  );
}

export function useTrackStore() {
  const context = useContext(TrackStoreContext);
  if (!context) {
    throw new Error('useTrackStore must be used within a TrackStoreProvider');
  }
  return context;
}
