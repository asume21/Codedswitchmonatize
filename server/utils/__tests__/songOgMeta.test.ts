import { describe, it, expect } from 'vitest';
import { songOgMeta } from '../songOgMeta';

// Product review S4: a shared /s/:id link showed the generic site title and
// no image. Each public song gets its own card text.
describe('songOgMeta', () => {
  it('names the song and the artist', () => {
    expect(songOgMeta({ name: 'Night Drive', isPublic: true }, 'asume21')).toEqual({
      title: 'Night Drive — asume21 | CodedSwitch',
      description: 'Listen to "Night Drive" by asume21. Made on CodedSwitch.',
    });
  });

  it('has no card for a private or missing song', () => {
    expect(songOgMeta({ name: 'Secret', isPublic: false }, 'x')).toBeNull();
    expect(songOgMeta(undefined, 'x')).toBeNull();
  });

  it('falls back when the artist or title is blank, and caps long titles', () => {
    const meta = songOgMeta({ name: '   ', isPublic: true }, '');
    expect(meta?.title).toBe('Untitled song — a CodedSwitch artist | CodedSwitch');
    const long = songOgMeta({ name: 'x'.repeat(200), isPublic: true }, 'a');
    expect(long!.title.length).toBeLessThanOrEqual(120);
  });
});
