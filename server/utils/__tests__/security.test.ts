import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * resolveAudioPath is the resolver behind five routes — create voice, voice
 * convert, duet, extract pitch and pitch correct — and it knew exactly one url
 * form: /api/internal/uploads/. A song uploaded through the Song Uploader has a
 * /api/songs/converted/ url and no other, so every one of those five features
 * answered "Invalid or missing objectKey/fileUrl" for the app's most common
 * input. Same root cause as the transcribe and voiceprint bugs, five more
 * places.
 */

let root: string;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-objects-'));
  process.env.LOCAL_OBJECTS_DIR = root;
  fs.mkdirSync(path.join(root, 'converted'), { recursive: true });
  fs.mkdirSync(path.join(root, 'stems'), { recursive: true });
  fs.mkdirSync(path.join(root, 'voices'), { recursive: true });
  fs.writeFileSync(path.join(root, 'converted', 'abc.mp3'), 'audio');
  fs.writeFileSync(path.join(root, 'stems', 'vocals.wav'), 'audio');
  fs.writeFileSync(path.join(root, 'voices', 'take.wav'), 'audio');
});

async function load() {
  return import('../security');
}

describe('resolveAudioPath — every url form, not just uploads', () => {
  it('resolves a converted song url', async () => {
    const { resolveAudioPath } = await load();
    expect(resolveAudioPath({ fileUrl: '/api/songs/converted/abc' }, root)).toBe(
      fs.realpathSync(path.join(root, 'converted', 'abc.mp3')),
    );
  });

  it('resolves a stem url', async () => {
    const { resolveAudioPath } = await load();
    expect(resolveAudioPath({ fileUrl: '/api/stems/vocals.wav' }, root)).toBe(
      fs.realpathSync(path.join(root, 'stems', 'vocals.wav')),
    );
  });

  it('still resolves an uploads url', async () => {
    const { resolveAudioPath } = await load();
    expect(resolveAudioPath({ fileUrl: '/api/internal/uploads/voices/take.wav' }, root)).toBe(
      fs.realpathSync(path.join(root, 'voices', 'take.wav')),
    );
  });

  it('still resolves a bare objectKey, which is a storage key and not a url', async () => {
    const { resolveAudioPath } = await load();
    expect(resolveAudioPath({ objectKey: 'voices/take.wav' }, root)).toBe(
      fs.realpathSync(path.join(root, 'voices', 'take.wav')),
    );
  });

  it('returns a candidate path for a file that is not there, so callers can answer 404', async () => {
    // The five call sites all do `if (!targetPath) 400` then
    // `if (!existsSync) 404`. Returning null for an absent file would collapse
    // those two answers into one and turn every 404 into a 400.
    const { resolveAudioPath } = await load();
    expect(resolveAudioPath({ fileUrl: '/api/songs/converted/not-here' }, root)).toBe(
      path.resolve(root, 'converted', 'not-here.mp3'),
    );
  });

  it('refuses traversal out of the objects directory', async () => {
    const { resolveAudioPath } = await load();
    expect(
      resolveAudioPath({ fileUrl: '/api/internal/uploads/../../../etc/passwd' }, root),
    ).toBeNull();
    expect(resolveAudioPath({ objectKey: '../../../etc/passwd' }, root)).toBeNull();
  });

  it('refuses an external url', async () => {
    const { resolveAudioPath } = await load();
    expect(resolveAudioPath({ fileUrl: 'https://evil.example.com/x.mp3' }, root)).toBeNull();
  });
});
