/**
 * Project inbox — the ONE way any surface sends something into the MIX project.
 *
 * Before 2026-10-07 MAKE, ASTUTELY and LIBRARY handed results to MIX with
 * window CustomEvents. StudioShell unmounts every surface it isn't showing, so
 * MIX's listeners didn't exist when those events fired: Organism takes and
 * captures, Astutely bass lines, library samples… all silently dropped while a
 * toast claimed success (product review K1/A1/L2). Inside MIX the same event had
 * two receivers and imported notes twice.
 *
 * Producers call `sendToProject(item)` from anywhere (no provider needed — this
 * is a plain store, so even app-level providers can use it). MIX drains the
 * inbox when it mounts and whenever items arrive while it's open, and confirms
 * each arrival itself. Persisted, so an item survives navigation and reloads
 * (audio is uploaded first — see lib/uploadAudio — so its URL survives too).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { OrganismSnapshot } from '@/stores/useStudioStore';

export type InboxItem =
  | {
      kind: 'notes';
      /** Astutely-style notes (trackType: drums|bass|melody|chords …). */
      notes: any[];
      bpm?: number;
      key?: string;
      source: string;
    }
  | { kind: 'snapshot'; snapshot: OrganismSnapshot }
  | {
      kind: 'audio';
      audioUrl: string;
      name: string;
      bpm?: number;
      bars?: number;
      /** Where the clip starts on the timeline (default bar 0). */
      startBar?: number;
      /** Stable id so re-sending the same take doesn't duplicate the track. */
      trackId: string;
      color?: string;
      source: string;
    };

export type InboxEntry = InboxItem & { inboxId: string; sentAt: number };

interface ProjectInboxState {
  items: InboxEntry[];
  send: (item: InboxItem) => void;
  remove: (inboxIds: string[]) => void;
}

const MAX_ITEMS = 50;

export const useProjectInbox = create<ProjectInboxState>()(
  persist(
    (set) => ({
      items: [],
      send: (item) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              ...item,
              inboxId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              sentAt: Date.now(),
            } as InboxEntry,
          ].slice(-MAX_ITEMS),
        })),
      remove: (inboxIds) =>
        set((state) => ({ items: state.items.filter((i) => !inboxIds.includes(i.inboxId)) })),
    }),
    {
      name: 'codedswitch-project-inbox',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Send something into the MIX project. Works from any surface or provider. */
export function sendToProject(item: InboxItem): void {
  useProjectInbox.getState().send(item);
}
