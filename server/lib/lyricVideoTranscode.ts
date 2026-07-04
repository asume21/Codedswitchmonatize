// Pure ffmpeg argument builder for lyric-video WebM → MP4 transcoding.
// Kept side-effect-free (no fs, no ffmpeg process) so the compatibility-critical
// flags can be unit-tested without running ffmpeg — mirroring how
// lyricVideoTiming.ts is split from its React component.

/**
 * Output options for transcoding the browser-recorded WebM (VP8/9 + Opus) into
 * an MP4 that actually plays on iOS / Instagram / TikTok — not just Chrome.
 *
 * The three non-negotiable flags:
 *   - `-pix_fmt yuv420p`  → QuickTime/Safari/most social apps refuse yuv444.
 *   - `-movflags +faststart` → moves the moov atom to the front so the file
 *     starts playing before it's fully downloaded (streaming/social preview).
 *   - `-c:a aac` → MP4's expected audio codec (source is Opus).
 */
export function buildTranscodeArgs(): string[] {
  return [
    '-c:v libx264',
    '-pix_fmt yuv420p',
    '-preset veryfast',
    '-crf 20',
    '-movflags +faststart',
    '-c:a aac',
    '-b:a 192k',
  ];
}
