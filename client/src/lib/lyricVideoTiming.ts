export interface TimedLyricWord {
  text: string;
  start: number;
  end: number;
}

export interface LyricVideoLine {
  id: string;
  text: string;
  start: number;
  end: number;
  words: TimedLyricWord[];
}

export interface LyricVideoLineOptions {
  words?: unknown;
  transcript?: string;
  wordsPerLine?: number;
  bpm?: number;
}

export interface LyricTimingOptions {
  offsetSec?: number;
  bpm?: number;
  snapToBeat?: boolean;
}

export interface ResolvedLyricVideoLine extends LyricVideoLine {
  displayStart: number;
  displayEnd: number;
  timingShift: number;
}

const DEFAULT_WORDS_PER_LINE = 6;
const DEFAULT_BPM = 120;
const FALLBACK_LINE_BEATS = 4;

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safeBpm(bpm?: number) {
  return Number.isFinite(bpm) && bpm! > 0 ? bpm! : DEFAULT_BPM;
}

function chunkWords(words: string[], wordsPerLine: number) {
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    chunks.push(words.slice(i, i + wordsPerLine));
  }
  return chunks;
}

export function normalizeTimedWords(input: unknown): TimedLyricWord[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((entry): TimedLyricWord | null => {
      const item = entry as Record<string, unknown>;
      const text = String(item.word ?? item.text ?? '').trim();
      const start = Number(item.start);
      const end = Number(item.end);

      if (!text || !Number.isFinite(start)) return null;

      return {
        text,
        start: Math.max(0, start),
        end: Number.isFinite(end) && end > start ? end : start + 0.35,
      };
    })
    .filter((word): word is TimedLyricWord => Boolean(word))
    .sort((a, b) => a.start - b.start);
}

export function buildLyricVideoLines({
  words,
  transcript = '',
  wordsPerLine = DEFAULT_WORDS_PER_LINE,
  bpm = DEFAULT_BPM,
}: LyricVideoLineOptions): LyricVideoLine[] {
  const groupSize = clampInt(wordsPerLine, 1, 12);
  const timedWords = normalizeTimedWords(words);

  if (timedWords.length > 0) {
    return chunkWords(timedWords.map((word) => word.text), groupSize).map((chunk, index) => {
      const startIndex = index * groupSize;
      const lineWords = timedWords.slice(startIndex, startIndex + chunk.length);
      const first = lineWords[0];
      const last = lineWords[lineWords.length - 1];

      return {
        id: `timed-${index}-${first.start.toFixed(2)}`,
        text: lineWords.map((word) => word.text).join(' '),
        start: first.start,
        end: Math.max(last.end, first.start + 0.35),
        words: lineWords,
      };
    });
  }

  const plainWords = transcript.trim().split(/\s+/).filter(Boolean);
  if (plainWords.length === 0) return [];

  const secondsPerLine = Math.max(1.6, (60 / safeBpm(bpm)) * FALLBACK_LINE_BEATS);

  return chunkWords(plainWords, groupSize).map((chunk, index) => ({
    id: `manual-${index}`,
    text: chunk.join(' '),
    start: index * secondsPerLine,
    end: (index + 1) * secondsPerLine,
    words: [],
  }));
}

export function snapTimeToBeat(seconds: number, bpm = DEFAULT_BPM) {
  const beatLength = 60 / safeBpm(bpm);
  return Math.max(0, Math.round(Math.max(0, seconds) / beatLength) * beatLength);
}

export function resolveLyricLineTiming(
  line: LyricVideoLine,
  { offsetSec = 0, bpm = DEFAULT_BPM, snapToBeat = false }: LyricTimingOptions = {},
): ResolvedLyricVideoLine {
  const rawStart = line.start + offsetSec;
  const clampedStart = Math.max(0, rawStart);
  const displayStart = snapToBeat ? snapTimeToBeat(clampedStart, bpm) : clampedStart;
  const timingShift = displayStart - rawStart;
  const displayEnd = Math.max(displayStart + 0.35, line.end + offsetSec + timingShift);

  return {
    ...line,
    displayStart,
    displayEnd,
    timingShift,
  };
}

export function findActiveLyricLine(
  lines: LyricVideoLine[],
  currentTime: number,
  options?: LyricTimingOptions,
): ResolvedLyricVideoLine | null {
  for (const line of lines) {
    const resolved = resolveLyricLineTiming(line, options);
    if (currentTime >= resolved.displayStart && currentTime < resolved.displayEnd) {
      return resolved;
    }
  }
  return null;
}

export function findNextLyricLine(
  lines: LyricVideoLine[],
  currentTime: number,
  options?: LyricTimingOptions,
): ResolvedLyricVideoLine | null {
  for (const line of lines) {
    const resolved = resolveLyricLineTiming(line, options);
    if (resolved.displayStart > currentTime) return resolved;
  }
  return null;
}
