import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { TrackClip } from '@/types/studioTracks';
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
  | { type: 'SET_SYNCED'; isSynced: boolean };

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
      const response = await apiRequest('POST', '/api/tracks', {
        projectId: state.currentProjectId,
        name: track.name,
        type: payload.type || (track.kind === 'audio' ? 'audio' : track.kind === 'beat' ? 'beat' : 'midi'),
        audioUrl: payload.audioUrl || '',
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
      });
      
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
  }), [state.tracks, state.currentProjectId, state.isLoading, state.isSynced, addTrack, updateTrack, removeTrack, setTracks, clearTracks, setProjectId, loadTracksFromServer, saveTrackToServer]);

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
