/**
 * Vocal-booth takes, kept outside the component.
 *
 * StudioShell unmounts every surface it isn't showing, so takes held in
 * StudioVocalRecorder's useState vanished the moment you switched from MAKE to
 * any other surface — your best take, gone, no warning (product review K2).
 * This store lives for the whole page session (it holds Blobs, so it is not
 * persisted; "+ MIX" uploads a take when you want to keep it for good).
 */
import { useCallback } from 'react';
import { create } from 'zustand';
import type { VocalTake } from './StudioVocalRecorder';

interface BoothTakesState {
  byTrack: Record<string, VocalTake[]>;
  set: (trackId: string, takes: VocalTake[]) => void;
}

const useBoothTakesStore = create<BoothTakesState>()((set) => ({
  byTrack: {},
  set: (trackId, takes) => set((s) => ({ byTrack: { ...s.byTrack, [trackId]: takes } })),
}));

const EMPTY: VocalTake[] = [];

/** Drop-in for `useState<VocalTake[]>` that survives the component unmounting. */
export function useBoothTakes(trackId: string) {
  const takes = useBoothTakesStore((s) => s.byTrack[trackId] ?? EMPTY);
  const setTakes = useCallback(
    (next: VocalTake[] | ((prev: VocalTake[]) => VocalTake[])) => {
      const store = useBoothTakesStore.getState();
      const prev = store.byTrack[trackId] ?? EMPTY;
      store.set(trackId, typeof next === 'function' ? next(prev) : next);
    },
    [trackId],
  );
  return [takes, setTakes] as const;
}
