import { describe, expect, it } from 'vitest';
import {
  buildLyricVideoLines,
  findActiveLyricLine,
  normalizeTimedWords,
  resolveLyricLineTiming,
  snapTimeToBeat,
} from '../lyricVideoTiming';

describe('lyricVideoTiming', () => {
  it('normalizes OpenAI word timestamp shapes', () => {
    expect(normalizeTimedWords([
      { word: ' hello ', start: 0.2, end: 0.6 },
      { text: 'world', start: 0.7 },
      { text: '', start: 1 },
      { text: 'bad' },
    ])).toEqual([
      { text: 'hello', start: 0.2, end: 0.6 },
      { text: 'world', start: 0.7, end: 1.0499999999999998 },
    ]);
  });

  it('groups timed words into display lines', () => {
    const lines = buildLyricVideoLines({
      words: [
        { text: 'one', start: 0, end: 0.2 },
        { text: 'two', start: 0.3, end: 0.6 },
        { text: 'three', start: 0.8, end: 1.1 },
      ],
      wordsPerLine: 2,
    });

    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('one two');
    expect(lines[0].start).toBe(0);
    expect(lines[0].end).toBe(0.6);
    expect(lines[1].text).toBe('three');
  });

  it('falls back to BPM-paced manual lyrics when there are no word timestamps', () => {
    const lines = buildLyricVideoLines({
      transcript: 'alpha beta gamma delta',
      wordsPerLine: 2,
      bpm: 120,
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ text: 'alpha beta', start: 0, end: 2 });
    expect(lines[1]).toMatchObject({ text: 'gamma delta', start: 2, end: 4 });
  });

  it('snaps line starts to the active beat grid', () => {
    expect(snapTimeToBeat(1.11, 120)).toBe(1);
    expect(snapTimeToBeat(1.31, 120)).toBe(1.5);

    const line = {
      id: 'line',
      text: 'bar',
      start: 1.31,
      end: 2,
      words: [],
    };

    expect(resolveLyricLineTiming(line, { bpm: 120, snapToBeat: true })).toMatchObject({
      displayStart: 1.5,
      displayEnd: 2.19,
    });
  });

  it('finds the active line after offset and beat snap', () => {
    const lines = buildLyricVideoLines({
      words: [
        { text: 'late', start: 0.9, end: 1.2 },
        { text: 'line', start: 1.3, end: 1.6 },
      ],
      wordsPerLine: 2,
    });

    expect(findActiveLyricLine(lines, 1.0, { offsetSec: 0, bpm: 120, snapToBeat: true })?.text).toBe('late line');
    expect(findActiveLyricLine(lines, 0.4, { offsetSec: 0, bpm: 120, snapToBeat: true })).toBeNull();
  });
});
