/**
 * Mix the project's audio tracks down to one WAV.
 *
 * Shared by File → Export Audio and ASTUTELY's "Master my song", so there is
 * one bounce, not two copies. Instrument (note) tracks are not rendered
 * offline yet; they are reported back so callers can say so instead of
 * silently leaving them out (Target vs. Shipped, docs/product-review.md).
 */
import { bounceMaster } from '@/lib/freezeBounce';
import type { StudioTrack } from '@/hooks/useTracks';

export interface ProjectBounce {
  blob: Blob;
  url: string;
  audioTrackCount: number;
  /** Note tracks that are NOT in the WAV (no offline instrument render yet). */
  noteTracks: StudioTrack[];
}

export async function bounceProjectAudio(tracks: StudioTrack[], bpm: number): Promise<ProjectBounce | null> {
  const audioTracks = tracks.filter((t) => t.audioUrl && !t.muted);
  const noteTracks = tracks.filter((t) => !t.audioUrl && (t.notes?.length ?? 0) > 0);
  if (audioTracks.length === 0) return null;

  const secondsPerBar = (60 / bpm) * 4;
  const maxBars = Math.max(...audioTracks.map((t) => (t.startBar ?? 0) + (t.lengthBars ?? 8)));
  const durationSeconds = Math.max(4, maxBars * secondsPerBar) + 1;

  const { url, blob } = await bounceMaster(
    audioTracks.map((t) => ({
      trackId: t.id,
      audioUrl: t.audioUrl!,
      volume: t.volume ?? 0.8,
      pan: t.pan ?? 0,
      startTimeSeconds: (t.startBar ?? 0) * secondsPerBar,
    })),
    durationSeconds,
  );
  return { blob, url, audioTrackCount: audioTracks.length, noteTracks };
}
