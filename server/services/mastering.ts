import ffmpeg from "fluent-ffmpeg";

/**
 * ONE definition of "mastered" for the whole app.
 *
 * This chain existed as two identical copies — routes.ts polishGeneratedAudio()
 * and unifiedMusicService — and voice conversion had none of it, so a converted
 * remix came out at whatever level the mix happened to land on while generated
 * audio came out normalised. Same product, two different loudnesses.
 *
 * Filter order matters and is not arbitrary:
 *   loudnorm    normalise to a target loudness with a true-peak ceiling
 *   dynaudnorm  even out remaining level swings between sections
 *   afade       0.3s in / 0.5s out, so a hard start or cut ending does not click
 */

export interface MasteringOptions {
  /** Integrated loudness target in LUFS. -16 suits streaming playback. */
  targetLufs?: number;
  /** Loudness range in LU. */
  loudnessRange?: number;
  /** True-peak ceiling in dBTP — headroom so lossy encoding cannot clip. */
  truePeak?: number;
  /** Total duration in seconds; required to place the fade-out. */
  durationSeconds?: number;
  /** Set false to skip the fades (e.g. a loop that must butt-join seamlessly). */
  fades?: boolean;
}

export const MASTERING_DEFAULTS = {
  targetLufs: -16,
  loudnessRange: 11,
  truePeak: -1.5,
  fadeInSeconds: 0.3,
  fadeOutSeconds: 0.5,
} as const;

/**
 * Build the filter list. Pure, so the chain can be asserted in tests without
 * running ffmpeg.
 */
export function buildMasteringFilters(options: MasteringOptions = {}): string[] {
  const target = options.targetLufs ?? MASTERING_DEFAULTS.targetLufs;
  const lra = options.loudnessRange ?? MASTERING_DEFAULTS.loudnessRange;
  const tp = options.truePeak ?? MASTERING_DEFAULTS.truePeak;

  const filters = [`loudnorm=I=${target}:LRA=${lra}:TP=${tp}`, "dynaudnorm"];

  if (options.fades === false) return filters;

  filters.push(`afade=t=in:st=0:d=${MASTERING_DEFAULTS.fadeInSeconds}`);

  // A fade-out needs to know where the end is. Without a duration, skip it
  // rather than guess — a fade placed at the wrong second would mute real audio.
  const duration = options.durationSeconds;
  if (typeof duration === "number" && Number.isFinite(duration) && duration > 1) {
    const start = Math.max(0, duration - MASTERING_DEFAULTS.fadeOutSeconds - 0.25);
    filters.push(`afade=t=out:st=${start}:d=${MASTERING_DEFAULTS.fadeOutSeconds}`);
  }

  return filters;
}

/** Duration in seconds, or 0 when it cannot be read. */
export function probeDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return resolve(0);
      const d = Number(data?.format?.duration);
      resolve(Number.isFinite(d) ? d : 0);
    });
  });
}

/** Master `inputPath` into `outputPath`. Reads the duration itself when not given. */
export async function masterAudioFile(
  inputPath: string,
  outputPath: string,
  options: MasteringOptions = {},
): Promise<void> {
  const durationSeconds =
    options.durationSeconds ?? (await probeDurationSeconds(inputPath));
  const filters = buildMasteringFilters({ ...options, durationSeconds });

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(filters)
      .audioCodec("libmp3lame")
      .audioBitrate("192k")
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(outputPath);
  });
}
