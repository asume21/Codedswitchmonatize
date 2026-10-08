/**
 * Export stems: one file per track, delivered as a single zip.
 *
 * "Export stems" used to download ONE MIDI file of every track and skip audio
 * entirely (product review M7). Now each audio track is rendered on its own
 * to WAV (same bounce engine as the master), each instrument track goes out
 * as its own MIDI file (no offline instrument render yet — see Target vs.
 * Shipped), and everything lands in one zip so the browser doesn't block a
 * burst of downloads.
 */
import { zipSync } from 'fflate';
import { bounceMaster } from '@/lib/freezeBounce';
import { exportTracksToMidi } from '@/lib/midiExport';

export interface StemSource {
  name: string;
  ext: 'wav' | 'mid';
}

/** "01 Lead Vocal.wav" … — numbered (keeps order, makes names unique) and filesystem-safe. */
export function stemFileNames(stems: StemSource[]): string[] {
  const width = Math.max(2, String(stems.length).length);
  return stems.map((s, i) => {
    // Drop an audio/MIDI extension the name already carries ("clap.wav" → "clap").
    const base = (s.name || 'Track').replace(/\.(wav|mp3|webm|ogg|m4a|aac|flac|mid|midi)$/i, '');
    const safe = base.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'Track';
    return `${String(i + 1).padStart(width, '0')} ${safe}.${s.ext}`;
  });
}

export function buildStemsZip(files: Array<{ fileName: string; data: Uint8Array }>): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const f of files) {
    // WAV barely compresses; store it. MIDI is tiny either way.
    entries[f.fileName] = [f.data, { level: f.fileName.endsWith('.wav') ? 0 : 6 }];
  }
  return zipSync(entries);
}

interface ExportableTrack {
  id: string;
  name: string;
  audioUrl?: string;
  notes?: unknown[];
  volume?: number;
  pan?: number;
  startBar?: number;
  lengthBars?: number;
  muted?: boolean;
  kind?: string;
}

/** Render every track and return the zip (null if there is nothing to export). */
export async function exportStemsZip(tracks: ExportableTrack[], bpm: number): Promise<Uint8Array | null> {
  const secondsPerBar = (60 / bpm) * 4;
  const sources: Array<{ track: ExportableTrack; ext: 'wav' | 'mid' }> = [];
  for (const t of tracks) {
    if (t.audioUrl) sources.push({ track: t, ext: 'wav' });
    else if ((t.notes?.length ?? 0) > 0) sources.push({ track: t, ext: 'mid' });
  }
  if (sources.length === 0) return null;

  const names = stemFileNames(sources.map((s) => ({ name: s.track.name, ext: s.ext })));
  const files: Array<{ fileName: string; data: Uint8Array }> = [];
  for (let i = 0; i < sources.length; i++) {
    const { track, ext } = sources[i];
    if (ext === 'wav') {
      // Rendered with its own volume/pan and start offset, so stems line up
      // when dropped back into any DAW at bar 1.
      const endBars = (track.startBar ?? 0) + (track.lengthBars ?? 8);
      const { blob } = await bounceMaster(
        [{
          trackId: track.id,
          audioUrl: track.audioUrl!,
          volume: track.volume ?? 0.8,
          pan: track.pan ?? 0,
          startTimeSeconds: (track.startBar ?? 0) * secondsPerBar,
        }],
        Math.max(1, endBars * secondsPerBar) + 0.5,
      );
      files.push({ fileName: names[i], data: new Uint8Array(await blob.arrayBuffer()) });
    } else {
      files.push({ fileName: names[i], data: exportTracksToMidi([track as any], { bpm, projectName: track.name }) });
    }
  }
  return buildStemsZip(files);
}
