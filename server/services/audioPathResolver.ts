import fs from 'fs';
import path from 'path';

/**
 * ONE place that knows how an audio URL maps to a file on disk.
 *
 * This logic existed in three copies — the speech-correction /transcribe route,
 * the /voiceprint route, and jobQueue.resolveInputPath — and each copy knew a
 * different subset of the URL forms:
 *
 *   /api/internal/uploads/…   uploads         all three
 *   /api/stems/…              separated stems jobQueue only
 *   /api/songs/converted/…    uploaded songs  transcribe only
 *   absolute path             direct          jobQueue only
 *
 * A song uploaded through the Song Uploader has a CONVERTED url, so the two
 * copies that had never heard of that form both failed on the app's most common
 * input: voiceprint answered 400 "use original audio", and voice-conversion jobs
 * died with "Could not resolve source audio file path". Same cause, different
 * message, days apart.
 *
 * Adding the missing branch to each copy would have left the next caller to
 * rediscover it. One function instead, so a new URL form is learned everywhere
 * at once.
 */

/** Where uploaded objects live. Set by index.ts at boot; falls back for tests. */
function objectsDir(): string {
  return process.env.LOCAL_OBJECTS_DIR
    || (fs.existsSync('/data') ? '/data' : path.resolve(process.cwd(), 'objects'));
}

/** Keep a URL segment safe to use as a filename — same rule the routes used. */
function safeSegment(segment: string): string {
  return decodeURIComponent(segment).replace(/[^a-zA-Z0-9-_.]/g, '_');
}

export interface ResolveOptions {
  /** Return the candidate path even when the file is not on disk yet. Callers
   *  that want to answer 404-vs-400 themselves use this; the default is to
   *  return null unless the file actually exists. */
  allowMissing?: boolean;
}

/**
 * Map an audio URL (or absolute path) to a local file path.
 * Returns null when the form is unrecognised, or when the file is absent and
 * `allowMissing` was not set.
 */
export function resolveLocalAudioPath(
  url: string | null | undefined,
  options: ResolveOptions = {},
): string | null {
  if (!url) return null;
  const root = objectsDir();
  const exists = (candidate: string): string | null =>
    options.allowMissing || fs.existsSync(candidate) ? candidate : null;

  if (url.startsWith('/api/internal/uploads/')) {
    const relative = decodeURIComponent(url.replace('/api/internal/uploads/', ''));
    return exists(path.resolve(root, relative));
  }

  if (url.startsWith('/api/stems/')) {
    const fileName = path.basename(decodeURIComponent(url.replace('/api/stems/', '')));
    return exists(path.resolve(root, 'stems', fileName));
  }

  if (url.includes('/api/songs/converted/')) {
    const fileId = url.split('/api/songs/converted/')[1];
    if (!fileId) return null;
    return exists(path.resolve(root, 'converted', `${safeSegment(fileId)}.mp3`));
  }

  if (path.isAbsolute(url)) return exists(url);

  return null;
}

/** True when the path sits inside the objects directory — traversal guard. */
export function isInsideObjectsDir(candidate: string): boolean {
  const root = path.resolve(objectsDir());
  return path.resolve(candidate).startsWith(root);
}
