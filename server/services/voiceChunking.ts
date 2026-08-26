/**
 * Splitting a long vocal into pieces before ElevenLabs speech-to-speech.
 *
 * The whole stem used to go up in ONE request. ElevenLabs accepts up to 300s so
 * a 3-minute track is legal, but the voice conditioning DRIFTS across a long
 * clip: measured against the user's own source stem, the converted vocal was
 * clean for the first ~1:55 and then ran up to 2.24x brighter than the source
 * — audibly "high pitched" — almost continuously to the end. Re-running gave a
 * different, worse result, so it is not deterministic either.
 *
 * Shorter pieces keep each request inside the range the model stays stable in.
 *
 * Cuts land in SILENCE wherever possible. A cut in the middle of a word is
 * audible; a cut in the gap between bars is not. Rap vocals have gaps at nearly
 * every bar line, so a usable silence is almost always within reach — but when
 * one is not (a long sustained passage), a hard cut at the target is still
 * better than letting the clip run long enough to drift.
 */

export interface SilenceInterval {
  /** seconds */
  start: number;
  /** seconds */
  end: number;
}

export interface Chunk {
  /** seconds */
  start: number;
  /** seconds */
  end: number;
  /** true when this cut landed in detected silence rather than mid-audio */
  cutAtSilence: boolean;
}

export interface ChunkPlanOptions {
  /** Preferred chunk length. */
  targetSeconds?: number;
  /** Never exceed this — the drift ceiling, not an API limit. */
  maxSeconds?: number;
  /** Never produce a chunk shorter than this; tiny clips convert badly. */
  minSeconds?: number;
}

export const DEFAULT_TARGET_SECONDS = 30;
export const DEFAULT_MAX_SECONDS = 45;
export const DEFAULT_MIN_SECONDS = 8;

/**
 * Plan the cut points for one audio file.
 *
 * Chunks are contiguous and cover [0, totalDuration] exactly — no gaps, no
 * overlap — so reassembly on the original timeline is a plain concatenation and
 * the vocal stays locked to the beat.
 */
export function planChunks(
  totalDuration: number,
  silences: SilenceInterval[],
  options: ChunkPlanOptions = {},
): Chunk[] {
  const target = options.targetSeconds ?? DEFAULT_TARGET_SECONDS;
  const max = options.maxSeconds ?? DEFAULT_MAX_SECONDS;
  const min = options.minSeconds ?? DEFAULT_MIN_SECONDS;

  if (!(totalDuration > 0)) return [];
  // Short enough to convert whole — the drift only shows up over long clips,
  // and one request is both cheaper and seam-free.
  if (totalDuration <= max) {
    return [{ start: 0, end: totalDuration, cutAtSilence: true }];
  }

  // Midpoint of a silence is the safest instant to cut: furthest from the audio
  // on either side of it.
  const midpoints = silences
    .map((s) => (s.start + s.end) / 2)
    .filter((m) => Number.isFinite(m))
    .sort((a, b) => a - b);

  const chunks: Chunk[] = [];
  let cursor = 0;

  while (cursor < totalDuration) {
    const remaining = totalDuration - cursor;
    if (remaining <= max) {
      chunks.push({ start: cursor, end: totalDuration, cutAtSilence: true });
      break;
    }

    const earliest = cursor + min;
    const latest = cursor + max;
    const ideal = cursor + target;

    let cut = -1;
    let bestDistance = Infinity;
    for (const m of midpoints) {
      if (m <= earliest) continue;
      if (m >= latest) break;
      const d = Math.abs(m - ideal);
      if (d < bestDistance) { bestDistance = d; cut = m; }
    }

    const cutAtSilence = cut > 0;
    if (!cutAtSilence) cut = ideal;

    // Never strand a final sliver shorter than `min`: absorb it instead.
    if (totalDuration - cut < min) {
      chunks.push({ start: cursor, end: totalDuration, cutAtSilence });
      break;
    }

    chunks.push({ start: cursor, end: cut, cutAtSilence });
    cursor = cut;
  }

  return chunks;
}

/** Parse ffmpeg `silencedetect` stderr into intervals. */
export function parseSilences(ffmpegStderr: string): SilenceInterval[] {
  const starts: number[] = [];
  const out: SilenceInterval[] = [];
  const re = /silence_(start|end):\s*(-?[\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ffmpegStderr)) !== null) {
    const value = parseFloat(m[2]);
    if (!Number.isFinite(value)) continue;
    if (m[1] === "start") starts.push(value);
    else {
      const start = starts.pop();
      // An `end` with no matching `start` means the file opened in silence.
      out.push({ start: start ?? 0, end: value });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
