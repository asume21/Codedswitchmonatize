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

  // CONTAINMENT. `url` is client-supplied — voice-convert jobs take sourceUrl
  // straight from the request body — so "/api/internal/uploads/../../../etc/
  // passwd" resolves outside the objects directory unless it is checked. The
  // resolved file is then handed to stem separation and UPLOADED to Replicate /
  // ElevenLabs, which turns an arbitrary file read into arbitrary exfiltration.
  //
  // The two route copies this function replaced did guard themselves; the
  // jobQueue copy never did, and extracting it unchanged would have spread the
  // hole rather than removed it. Every branch is contained here, once.
  const contain = (candidate: string): string | null => {
    if (!isInsideObjectsDir(candidate)) return null;
    if (options.allowMissing) return candidate;
    if (!fs.existsSync(candidate)) return null;
    // Re-check after resolving symlinks: a link INSIDE the objects dir can
    // still point outside it, and the containment test above only sees the
    // link's own path.
    try {
      const real = fs.realpathSync(candidate);
      return isInsideObjectsDir(real) ? real : null;
    } catch {
      return null;
    }
  };

  if (url.startsWith('/api/internal/uploads/')) {
    const relative = decodeURIComponent(url.replace('/api/internal/uploads/', ''));
    return contain(path.resolve(root, relative));
  }

  if (url.startsWith('/api/stems/')) {
    const fileName = path.basename(decodeURIComponent(url.replace('/api/stems/', '')));
    return contain(path.resolve(root, 'stems', fileName));
  }

  if (url.includes('/api/songs/converted/')) {
    const fileId = url.split('/api/songs/converted/')[1];
    if (!fileId) return null;
    return contain(path.resolve(root, 'converted', `${safeSegment(fileId)}.mp3`));
  }

  // Absolute paths are accepted ONLY inside the objects directory. The previous
  // jobQueue implementation accepted any absolute path a caller sent, which
  // from an HTTP body is simply "read me that file". Internal callers that pass
  // real object paths are unaffected.
  if (path.isAbsolute(url)) return contain(path.resolve(url));

  return null;
}

/** True when the path sits inside the objects directory — traversal guard.
 *  Compares WITH a trailing separator so a sibling directory whose name merely
 *  starts with the root ("/dataEVIL" against "/data") cannot pass. */
export function isInsideObjectsDir(candidate: string): boolean {
  const root = path.resolve(objectsDir());
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  const resolved = path.resolve(candidate);
  return resolved === root || resolved.startsWith(rootWithSep);
}

export type ClassifiedAudioPath =
  | { path: string }
  | { error: 'missing' }
  | { error: 'unsupported' };

/**
 * Same resolution, but distinguishing the two reasons it can fail — which the
 * HTTP routes need and jobQueue did not.
 *
 * The speech-correction routes answer 400 for a URL form they do not
 * understand and 404 for a form they DO understand whose file is absent.
 * resolveLocalAudioPath returns null for both, so migrating the routes onto it
 * directly would have turned every "file not found" into "unsupported url".
 *
 * A contained path — traversal, or an absolute path outside the objects
 * directory — reports 'unsupported', never 'missing'. 'missing' would be an
 * existence oracle: it would tell a caller probing for /etc/passwd whether the
 * escape landed on a real file. Rejected forms must look identical to forms we
 * never understood.
 */
export function classifyLocalAudioPath(
  url: string | null | undefined,
): ClassifiedAudioPath {
  const resolved = resolveLocalAudioPath(url);
  if (resolved) return { path: resolved };
  return resolveLocalAudioPath(url, { allowMissing: true })
    ? { error: 'missing' }
    : { error: 'unsupported' };
}
