import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { TrackClip } from '@/types/studioTracks';

interface TrackStoreState {
  tracks: TrackClip[];
}

const initialState: TrackStoreState = {
  tracks: [],
};

type Action =
  | { type: 'ADD_TRACK'; track: TrackClip }
  | { type: 'UPDATE_TRACK'; id: string; updates: Partial<TrackClip> }
  | { type: 'REMOVE_TRACK'; id: string }
  | { type: 'SET_TRACKS'; tracks: TrackClip[] }
  | { type: 'CLEAR_TRACKS' };

function trackReducer(state: TrackStoreState, action: Action): TrackStoreState {
  switch (action.type) {
    case 'ADD_TRACK':
      return {
        ...state,
        tracks: [...state.tracks, action.track],
      };
    case 'UPDATE_TRACK':
      return {
        ...state,
        tracks: state.tracks.map((track) =>
          track.id === action.id ? { ...track, ...action.updates } : track
        ),
      };
    case 'REMOVE_TRACK':
      return {
        ...state,
        tracks: state.tracks.filter((track) => track.id !== action.id),
      };
    case 'SET_TRACKS':
      return {
        ...state,
        tracks: [...action.tracks],
      };
    case 'CLEAR_TRACKS':
      return initialState;
    default:
      return state;
  }
}

export interface TrackStoreContextValue {
  tracks: TrackClip[];
  addTrack: (track: TrackClip) => void;
  updateTrack: (id: string, updates: Partial<TrackClip>) => void;
  removeTrack: (id: string) => void;
  setTracks: (tracks: TrackClip[]) => void;
  clearTracks: () => void;
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

  const value = useMemo<TrackStoreContextValue>(() => ({
    tracks: state.tracks,
    addTrack,
    updateTrack,
    removeTrack,
    setTracks,
    clearTracks,
  }), [state.tracks, addTrack, updateTrack, removeTrack, setTracks, clearTracks]);

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
