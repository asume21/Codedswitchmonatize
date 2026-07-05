import { describe, expect, it } from 'vitest';
import {
  alignTimedWordsToTranscript,
  buildLyricVideoLines,
  findActiveLyricLine,
  findNextLyricLine,
  normalizeTimedWords,
  resolveLyricLineTiming,
  snapTimeToBeat,
} from '../lyricVideoTiming';

describe('lyricVideoTiming', () => {
  it('applies speed to correct drift, then offset', () => {
    const line = { id: 'l', text: 'a', start: 10, end: 12, words: [] };
    // speed 1.05 stretches the timeline; offset -0.5 shifts earlier.
    const resolved = resolveLyricLineTiming(line, { offsetSec: -0.5, speed: 1.05 });
    expect(resolved.displayStart).toBeCloseTo(10 * 1.05 - 0.5, 5); // 10.0
    expect(resolved.displayEnd).toBeCloseTo(12 * 1.05 - 0.5, 5); // 12.1
  });

  it('clamps speed to a minimum of 0.1 when unset, 0, negative, or invalid', () => {
    const line = { id: 'l', text: 'a', start: 8, end: 9, words: [] };
    expect(resolveLyricLineTiming(line, {}).displayStart).toBeCloseTo(8, 5);
    expect(resolveLyricLineTiming(line, { speed: 0 }).displayStart).toBeCloseTo(0.8, 5);
    expect(resolveLyricLineTiming(line, { speed: -2.5 }).displayStart).toBeCloseTo(0.8, 5);
  });

  it('keeps every transcript word even when Whisper dropped some (missing-words bug)', () => {
    // Whisper's word array is missing "brown", but the transcript has it.
    const aligned = alignTimedWordsToTranscript('the quick brown fox', [
      { text: 'the', start: 0, end: 0.4 },
      { text: 'quick', start: 1, end: 1.4 },
      { text: 'fox', start: 3, end: 3.4 },
    ]);
    expect(aligned.map((w) => w.text)).toEqual(['the', 'quick', 'brown', 'fox']);
    // matched words keep real timing
    expect(aligned[0].start).toBeCloseTo(0, 5);
    expect(aligned[3].start).toBeCloseTo(3, 5);
    // the dropped word gets a time between its neighbors (1 → 3)
    expect(aligned[2].start).toBeGreaterThan(1);
    expect(aligned[2].start).toBeLessThan(3);
  });

  it('zips timing 1:1 when transcript and timings match, ignoring punctuation', () => {
    const aligned = alignTimedWordsToTranscript('Hello world,', [
      { text: 'hello', start: 0, end: 0.5 },
      { text: 'world', start: 1, end: 1.5 },
    ]);
    expect(aligned.map((w) => w.text)).toEqual(['Hello', 'world,']);
    expect(aligned[1].start).toBeCloseTo(1, 5);
  });

  it('falls back to timings when transcript is empty, and to [] when no timings', () => {
    const timed = [{ text: 'a', start: 0, end: 0.3 }];
    expect(alignTimedWordsToTranscript('', timed)).toEqual(timed);
    expect(alignTimedWordsToTranscript('some words here', [])).toEqual([]);
  });

  it('keeps a repeated phrase in its own real occurrence when Whisper drops the middle repeat (repeated-chorus bug)', () => {
    // Lyrics repeat the phrase 3x; Whisper only caught the 1st and 3rd repeats
    // (the middle repeat's audio was missed entirely). Every word in the
    // triplet is textually identical, so a naive alignment can tie-break
    // into matching the LAST transcript repeat to the timed words that
    // really belong to the middle gap, leaving the middle repeat's words
    // with no real timing (previously they collapsed to 0.00).
    const transcript = 'one two three one two three one two three';
    const timed = [
      { text: 'one', start: 0.0, end: 0.2 },
      { text: 'two', start: 0.2, end: 0.4 },
      { text: 'three', start: 0.4, end: 0.6 },
      { text: 'one', start: 2.0, end: 2.2 },
      { text: 'two', start: 2.2, end: 2.4 },
      { text: 'three', start: 2.4, end: 2.6 },
    ];
    const aligned = alignTimedWordsToTranscript(transcript, timed);

    // First repeat keeps its own real timing.
    expect(aligned[0].start).toBeCloseTo(0.0, 5);
    expect(aligned[2].start).toBeCloseTo(0.4, 5);
    // Middle (dropped) repeat interpolates strictly between the two anchors,
    // rather than collapsing to 0 or stealing the last repeat's timing.
    expect(aligned[3].start).toBeGreaterThan(aligned[2].start);
    expect(aligned[5].start).toBeLessThan(2.0);
    // Last repeat keeps its own real timing — not stolen by the middle one.
    expect(aligned[6].start).toBeCloseTo(2.0, 5);
    expect(aligned[8].start).toBeCloseTo(2.4, 5);
  });

  it('handles all-unstamped words in normalizeTimedWords', () => {
    expect(normalizeTimedWords([
      { word: 'hello' }, // missing start/end
      { text: 'world' }, // missing start/end
    ])).toEqual([]);
  });

  it('handles single word alignments', () => {
    const aligned = alignTimedWordsToTranscript('hello', [
      { text: 'hello', start: 1.5, end: 1.8 }
    ]);
    expect(aligned).toEqual([{ text: 'hello', start: 1.5, end: 1.8 }]);
  });

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

  it('findActiveLyricLine and findNextLyricLine find correct lines with binary search', () => {
    const lines = [
      { id: '1', text: 'first line', start: 1, end: 5, words: [] },
      { id: '2', text: 'second line', start: 5, end: 10, words: [] },
      { id: '3', text: 'third line', start: 10, end: 15, words: [] },
    ];
    // Active line checks
    expect(findActiveLyricLine(lines, 3)?.id).toBe('1');
    expect(findActiveLyricLine(lines, 5)?.id).toBe('2');
    expect(findActiveLyricLine(lines, 0.5)).toBeNull();
    expect(findActiveLyricLine(lines, 20)).toBeNull();

    // Next line checks
    expect(findNextLyricLine(lines, 0)?.id).toBe('1');
    expect(findNextLyricLine(lines, 3)?.id).toBe('2');
    expect(findNextLyricLine(lines, 5)?.id).toBe('3');
    expect(findNextLyricLine(lines, 12)).toBeNull();
  });
});
