import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * The containment tests matter more than the happy path here.
 *
 * `sourceUrl` arrives in the body of a voice-convert job request, and whatever
 * this function returns is read from disk and UPLOADED to Replicate/ElevenLabs.
 * A resolver that escapes the objects directory is therefore not "arbitrary
 * file read" — it is arbitrary file exfiltration, with the app doing the
 * sending. Flagged by security review on the first version of this file, which
 * inherited jobQueue's unguarded behaviour.
 */

let root: string;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'objects-'));
  process.env.LOCAL_OBJECTS_DIR = root;
  fs.mkdirSync(path.join(root, 'converted'), { recursive: true });
  fs.mkdirSync(path.join(root, 'stems'), { recursive: true });
  fs.writeFileSync(path.join(root, 'converted', '123.mp3'), 'audio');
  fs.writeFileSync(path.join(root, 'stems', 'vocals.wav'), 'audio');
});

async function load() {
  return import('../audioPathResolver');
}

describe('resolveLocalAudioPath — legitimate forms', () => {
  it('resolves a converted song URL, the form every upload has', async () => {
    const { resolveLocalAudioPath } = await load();
    expect(resolveLocalAudioPath('/api/songs/converted/123')).toBe(
      fs.realpathSync(path.join(root, 'converted', '123.mp3')),
    );
  });

  it('resolves a stem URL', async () => {
    const { resolveLocalAudioPath } = await load();
    expect(resolveLocalAudioPath('/api/stems/vocals.wav')).toBe(
      fs.realpathSync(path.join(root, 'stems', 'vocals.wav')),
    );
  });

  it('returns null for a file that is not there, rather than a bad path', async () => {
    const { resolveLocalAudioPath } = await load();
    expect(resolveLocalAudioPath('/api/songs/converted/does-not-exist')).toBeNull();
  });

  it('returns null for an unrecognised form', async () => {
    const { resolveLocalAudioPath } = await load();
    expect(resolveLocalAudioPath('https://evil.example.com/x.mp3')).toBeNull();
    expect(resolveLocalAudioPath('')).toBeNull();
    expect(resolveLocalAudioPath(null)).toBeNull();
  });
});

describe('resolveLocalAudioPath — containment', () => {
  it('refuses traversal out of the objects directory', async () => {
    const { resolveLocalAudioPath } = await load();
    for (const attack of [
      '/api/internal/uploads/../../../../etc/passwd',
      '/api/internal/uploads/..%2F..%2F..%2Fetc%2Fpasswd',
      '/api/internal/uploads/subdir/../../../secrets.env',
    ]) {
      expect(resolveLocalAudioPath(attack, { allowMissing: true })).toBeNull();
    }
  });

  it('refuses an absolute path outside the objects directory', async () => {
    const { resolveLocalAudioPath } = await load();
    const outside = path.join(os.tmpdir(), 'not-an-object.txt');
    fs.writeFileSync(outside, 'secret');
    expect(resolveLocalAudioPath(outside)).toBeNull();
  });

  it('still accepts an absolute path INSIDE the objects directory', async () => {
    const { resolveLocalAudioPath } = await load();
    const inside = path.join(root, 'converted', '123.mp3');
    expect(resolveLocalAudioPath(inside)).toBe(fs.realpathSync(inside));
  });

  it('does not treat a sibling with the same prefix as inside', async () => {
    const { isInsideObjectsDir } = await load();
    expect(isInsideObjectsDir(`${root}EVIL/file.mp3`)).toBe(false);
    expect(isInsideObjectsDir(path.join(root, 'ok.mp3'))).toBe(true);
    expect(isInsideObjectsDir(root)).toBe(true);
  });
});

/**
 * The routes need one more thing than jobQueue did: they answer 400 for a URL
 * form they do not understand and 404 for a form they DO understand whose file
 * is absent. resolveLocalAudioPath returns null for both, so migrating the
 * routes onto it would have collapsed those two answers into one.
 */
describe('classifyLocalAudioPath — 400-vs-404 for the routes', () => {
  it('returns the resolved path when the file is there', async () => {
    const { classifyLocalAudioPath } = await load();
    expect(classifyLocalAudioPath('/api/songs/converted/123')).toEqual({
      path: fs.realpathSync(path.join(root, 'converted', '123.mp3')),
    });
  });

  it('reports a known form with no file as missing, not unsupported', async () => {
    const { classifyLocalAudioPath } = await load();
    expect(classifyLocalAudioPath('/api/songs/converted/nope')).toEqual({
      error: 'missing',
    });
  });

  it('reports an external URL as unsupported', async () => {
    const { classifyLocalAudioPath } = await load();
    expect(classifyLocalAudioPath('https://evil.example.com/x.mp3')).toEqual({
      error: 'unsupported',
    });
  });

  it('reports an absent url as unsupported', async () => {
    const { classifyLocalAudioPath } = await load();
    expect(classifyLocalAudioPath(null)).toEqual({ error: 'unsupported' });
    expect(classifyLocalAudioPath('')).toEqual({ error: 'unsupported' });
  });

  it('reports a traversal attempt as unsupported, never as missing', async () => {
    // 'missing' would be an existence oracle: it would tell a caller probing
    // /etc/passwd whether the escape reached a real file. Contained paths must
    // be indistinguishable from a form we never understood.
    const { classifyLocalAudioPath } = await load();
    expect(classifyLocalAudioPath('/api/internal/uploads/../../../../etc/passwd')).toEqual({
      error: 'unsupported',
    });
  });

  it('reports an absolute path outside the objects directory as unsupported', async () => {
    const { classifyLocalAudioPath } = await load();
    const outside = path.join(os.tmpdir(), 'classify-outside.txt');
    fs.writeFileSync(outside, 'secret');
    expect(classifyLocalAudioPath(outside)).toEqual({ error: 'unsupported' });
  });
});
