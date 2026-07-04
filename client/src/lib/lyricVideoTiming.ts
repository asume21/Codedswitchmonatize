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
  /** Scales all timestamps to correct drift (start syncs via offset, end via speed). */
  speed?: number;
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

function safeSpeed(speed?: number) {
  return Number.isFinite(speed) && speed! > 0 ? speed! : 1;
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

const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/gi, '');

/**
 * Make the (complete, user-editable) transcript the authoritative word list and
 * attach Whisper timings to it. Every transcript word survives; words Whisper
 * matched keep their real time; words it dropped get a time interpolated from
 * their timed neighbours. Fixes on-screen words going missing when Whisper's
 * per-word array omits words the transcript still has.
 */
export function alignTimedWordsToTranscript(
  transcript: string,
  timedWords: TimedLyricWord[],
): TimedLyricWord[] {
  const tokens = transcript.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return timedWords;
  if (timedWords.length === 0) return [];

  const slots: Array<{ text: string; start?: number; end?: number }> = tokens.map((text) => ({ text }));

  // Greedy in-order match: assign each timed word to the next transcript token
  // whose normalized text equals it. Unmatched transcript tokens stay untimed.
  let j = 0;
  for (let i = 0; i < slots.length && j < timedWords.length; i += 1) {
    if (normalizeToken(slots[i].text) === normalizeToken(timedWords[j].text)) {
      slots[i].start = timedWords[j].start;
      slots[i].end = timedWords[j].end;
      j += 1;
    }
  }

  // If tokenization diverged too much to match anything, spread timings evenly.
  if (!slots.some((slot) => slot.start !== undefined)) {
    const n = slots.length;
    const m = timedWords.length;
    slots.forEach((slot, i) => {
      const k = n === 1 ? 0 : Math.round((i * (m - 1)) / (n - 1));
      slot.start = timedWords[k].start;
      slot.end = timedWords[k].end;
    });
  }

  const firstStart = slots.find((slot) => slot.start !== undefined)?.start ?? 0;
  const lastEnd = [...slots].reverse().find((slot) => slot.end !== undefined)?.end ?? firstStart + 0.35;

  // Interpolate untimed runs between the surrounding timed anchors.
  let i = 0;
  while (i < slots.length) {
    if (slots[i].start !== undefined) {
      i += 1;
      continue;
    }
    let k = i;
    while (k < slots.length && slots[k].start === undefined) k += 1;
    const before = i > 0 ? slots[i - 1] : undefined;
    const after = k < slots.length ? slots[k] : undefined;
    const startAnchor = before?.end ?? before?.start ?? firstStart;
    const endAnchor = after?.start ?? lastEnd;
    const count = k - i;
    for (let g = 0; g < count; g += 1) {
      const frac = (g + 1) / (count + 1);
      const start = Math.max(0, startAnchor + (endAnchor - startAnchor) * frac);
      slots[i + g].start = start;
      slots[i + g].end = start + Math.max(0.12, (endAnchor - startAnchor) / (count + 1));
    }
    i = k;
  }

  return slots.map((slot) => ({
    text: slot.text,
    start: slot.start ?? 0,
    end: slot.end !== undefined && slot.end > (slot.start ?? 0) ? slot.end : (slot.start ?? 0) + 0.35,
  }));
}

export function buildLyricVideoLines({
  words,
  transcript = '',
  wordsPerLine = DEFAULT_WORDS_PER_LINE,
  bpm = DEFAULT_BPM,
}: LyricVideoLineOptions): LyricVideoLine[] {
  const groupSize = clampInt(wordsPerLine, 1, 12);
  // The transcript is the complete word list; align Whisper timings onto it so
  // no spoken word is dropped from the screen.
  const timedWords = transcript.trim()
    ? alignTimedWordsToTranscript(transcript, normalizeTimedWords(words))
    : normalizeTimedWords(words);

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
  { offsetSec = 0, bpm = DEFAULT_BPM, snapToBeat = false, speed = 1 }: LyricTimingOptions = {},
): ResolvedLyricVideoLine {
  const s = safeSpeed(speed);
  const rawStart = line.start * s + offsetSec;
  const clampedStart = Math.max(0, rawStart);
  const displayStart = snapToBeat ? snapTimeToBeat(clampedStart, bpm) : clampedStart;
  const timingShift = displayStart - rawStart;
  const displayEnd = Math.max(displayStart + 0.35, line.end * s + offsetSec + timingShift);

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
