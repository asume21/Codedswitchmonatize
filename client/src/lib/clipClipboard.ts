/**
 * clipClipboard — Module-level clipboard for arrangement clips.
 *
 * Stores structured clip data for copy/paste operations within the
 * DawArrangementView. Uses module state (not system clipboard) because
 * clips contain complex structured data.
 */

import type { ArrangementClip } from '@/types/studioTracks';

interface ClipboardState {
  clips: ArrangementClip[];
  baseBeat: number;       // leftmost beat of the copied region (for relative pasting)
  sourceTrackId: string;  // track the clips were copied from
}

let clipboard: ClipboardState | null = null;

/** Copy clips to the clipboard. baseBeat is the reference point for relative pasting. */
export function copyClips(clips: ArrangementClip[], baseBeat: number, sourceTrackId: string) {
  clipboard = {
    clips: clips.map(c => ({ ...c })),  // deep-ish copy
    baseBeat,
    sourceTrackId,
  };
}

/** Paste clips at a target beat position, optionally on a different track. Returns new clips with fresh IDs. */
export function pasteClips(targetBeat: number, targetTrackId?: string): { clips: ArrangementClip[]; trackId: string } | null {
  if (!clipboard || clipboard.clips.length === 0) return null;

  const offset = targetBeat - clipboard.baseBeat;
  const newClips = clipboard.clips.map(c => {
    const duration = c.endBeat - c.startBeat;
    return {
      ...c,
      id: crypto.randomUUID(),
      startBeat: c.startBeat + offset,
      endBeat: c.startBeat + offset + duration,
    };
  });

  return {
    clips: newClips,
    trackId: targetTrackId ?? clipboard.sourceTrackId,
  };
}

/** Check if the clipboard has content. */
export function hasClipboardContent(): boolean {
  return clipboard !== null && clipboard.clips.length > 0;
}

/** Clear the clipboard. */
export function clearClipboard() {
  clipboard = null;
}

/** Get the clipboard state (for UI indicators). */
export function getClipboardState(): ClipboardState | null {
  return clipboard;
}
