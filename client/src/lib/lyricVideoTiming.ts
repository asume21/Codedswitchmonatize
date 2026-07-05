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
  words?: TimedLyricWord[] | unknown[];
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
const UNTIMED_LINE_BEATS = 4;

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safeBpm(bpm?: number) {
  return Number.isFinite(bpm) && bpm! > 0 ? bpm! : DEFAULT_BPM;
}

function safeSpeed(speed?: number) {
  const s = Number.isFinite(speed) ? speed! : 1;
  return Math.max(0.1, s);
}

function chunkWords(words: string[], wordsPerLine: number) {
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    chunks.push(words.slice(i, i + wordsPerLine));
  }
  return chunks;
}

/**
 * Normalizes an untyped list of timed words, filtering out invalid items
 * and sorting them by start time.
 *
 * @param input - The raw, untrusted input array of timed words.
 * @returns A validated and sorted array of TimedLyricWord objects.
 */
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

const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Aligns Whisper timed words to the transcript tokens using a dynamic programming-based
 * alignment (Needleman-Wunsch with token matching). Every transcript word survives;
 * matched words keep their real time; unmatched words get an interpolated time.
 *
 * @param transcript - The authoritative full text transcript.
 * @param timedWords - The timed words from the transcription source.
 * @returns A list of timed words aligned to the transcript.
 */
export function alignTimedWordsToTranscript(
  transcript: string,
  timedWords: TimedLyricWord[],
): TimedLyricWord[] {
  const tokens = transcript.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return timedWords;
  if (timedWords.length === 0) return [];

  const slots: Array<{ text: string; start?: number; end?: number }> = tokens.map((text) => ({ text }));

  const N = tokens.length;
  const M = timedWords.length;

  // Create DP table
  const dp: number[][] = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(0));

  // Scaled so a genuine match/mismatch/gap decision (always a multiple of
  // SCALE apart) can never be flipped by the tie-break term below.
  const SCALE = 1000;
  const GAP_TOKEN = -1 * SCALE;
  const GAP_TIMED = -1 * SCALE;
  const MATCH_SCORE = 2 * SCALE;
  const MISMATCH_SCORE = -2 * SCALE;

  // Lyrics repeat constantly (choruses, hooks, ad-libs), so identical words
  // routinely tie for the same total score across many different pairings.
  // Without a tie-break, backtracking can match a *later* transcript
  // repeat to an *earlier* timed word, leaving a real occurrence with no
  // timestamp at all. This term (always < 1, so it never outweighs a real
  // score difference) nudges ties toward the pairing whose relative
  // position in each sequence lines up, i.e. the order-preserving match.
  const positionSkew = (i: number, j: number) => Math.abs((i - 1) / N - (j - 1) / M);

  // Initialize borders
  for (let i = 1; i <= N; i++) {
    dp[i][0] = i * GAP_TOKEN;
  }
  for (let j = 1; j <= M; j++) {
    dp[0][j] = j * GAP_TIMED;
  }

  // Fill DP table
  for (let i = 1; i <= N; i++) {
    const token = normalizeToken(tokens[i - 1]);
    for (let j = 1; j <= M; j++) {
      const timed = normalizeToken(timedWords[j - 1].text);
      const matchScore = token === timed
        ? MATCH_SCORE - positionSkew(i, j)
        : MISMATCH_SCORE;

      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + matchScore,
        dp[i - 1][j] + GAP_TOKEN,
        dp[i][j - 1] + GAP_TIMED
      );
    }
  }

  // Backtrack to find alignment
  let i = N;
  let j = M;
  const matchedSlots: { [key: number]: number } = {};

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const token = normalizeToken(tokens[i - 1]);
      const timed = normalizeToken(timedWords[j - 1].text);
      const matchScore = token === timed
        ? MATCH_SCORE - positionSkew(i, j)
        : MISMATCH_SCORE;

      const scoreDiag = dp[i - 1][j - 1] + matchScore;
      const scoreUp = dp[i - 1][j] + GAP_TOKEN;
      const currentScore = dp[i][j];
      
      if (currentScore === scoreDiag) {
        if (token === timed) {
          matchedSlots[i - 1] = j - 1;
        }
        i--;
        j--;
      } else if (currentScore === scoreUp) {
        i--;
      } else {
        j--;
      }
    } else if (i > 0) {
      i--;
    } else {
      j--;
    }
  }

  // Assign matched timings
  for (let idx = 0; idx < tokens.length; idx++) {
    if (matchedSlots[idx] !== undefined) {
      const matchedWord = timedWords[matchedSlots[idx]];
      slots[idx].start = matchedWord.start;
      slots[idx].end = matchedWord.end;
    }
  }

  // If tokenization diverged too much to match anything, spread timings evenly.
  if (!slots.some((slot) => slot.start !== undefined)) {
    const n = slots.length;
    const m = timedWords.length;
    slots.forEach((slot, idx) => {
      const k = n === 1 ? 0 : Math.round((idx * (m - 1)) / (n - 1));
      slot.start = timedWords[k].start;
      slot.end = timedWords[k].end;
    });
  }

  const firstStart = slots.find((slot) => slot.start !== undefined)?.start ?? 0;
  const lastEnd = [...slots].reverse().find((slot) => slot.end !== undefined)?.end ?? firstStart + 0.35;

  // Interpolate untimed runs between the surrounding timed anchors.
  let idx = 0;
  while (idx < slots.length) {
    if (slots[idx].start !== undefined) {
      idx += 1;
      continue;
    }
    let k = idx;
    while (k < slots.length && slots[k].start === undefined) k += 1;
    const before = idx > 0 ? slots[idx - 1] : undefined;
    const after = k < slots.length ? slots[k] : undefined;
    const startAnchor = before?.end ?? before?.start ?? firstStart;
    const endAnchor = after?.start ?? lastEnd;
    const count = k - idx;
    for (let g = 0; g < count; g += 1) {
      const frac = (g + 1) / (count + 1);
      const start = Math.max(0, startAnchor + (endAnchor - startAnchor) * frac);
      slots[idx + g].start = start;
      slots[idx + g].end = start + Math.max(0.12, (endAnchor - startAnchor) / (count + 1));
    }
    idx = k;
  }

  return slots.map((slot) => ({
    text: slot.text,
    start: slot.start ?? 0,
    end: slot.end !== undefined && slot.end > (slot.start ?? 0) ? slot.end : (slot.start ?? 0) + 0.35,
  }));
}

/**
 * Chunks a list of timed words or plain transcript text into lyric lines.
 *
 * @param options - Config options including words, transcript, wordsPerLine, and bpm.
 * @returns An array of LyricVideoLine objects.
 */
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

  const secondsPerLine = Math.max(1.6, (60 / safeBpm(bpm)) * UNTIMED_LINE_BEATS);

  return chunkWords(plainWords, groupSize).map((chunk, index) => ({
    id: `manual-${index}`,
    text: chunk.join(' '),
    start: index * secondsPerLine,
    end: (index + 1) * secondsPerLine,
    words: [],
  }));
}

/**
 * Snaps a time in seconds to the nearest beat based on BPM.
 *
 * @param seconds - The time in seconds to snap.
 * @param bpm - The BPM used to calculate beat length.
 * @returns The snapped time in seconds.
 */
export function snapTimeToBeat(seconds: number, bpm = DEFAULT_BPM) {
  const beatLength = 60 / safeBpm(bpm);
  return Math.max(0, Math.round(Math.max(0, seconds) / beatLength) * beatLength);
}

/**
 * Resolves the display start and end times for a lyric line, applying speed, offset, and snapping.
 *
 * @param line - The lyric line to resolve.
 * @param options - Timing options including offsetSec, bpm, snapToBeat, and speed.
 * @returns The resolved lyric line timing.
 */
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

/**
 * Finds the currently active lyric line for a given time using binary search.
 *
 * @param lines - The list of lyric lines, sorted by start time.
 * @param currentTime - The current playback time in seconds.
 * @param options - Timing options to resolve line times.
 * @returns The active resolved lyric line, or null if none is active.
 */
export function findActiveLyricLine(
  lines: LyricVideoLine[],
  currentTime: number,
  options?: LyricTimingOptions,
): ResolvedLyricVideoLine | null {
  let low = 0;
  let high = lines.length - 1;
  let candidateIdx = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const resolved = resolveLyricLineTiming(lines[mid], options);
    if (resolved.displayStart <= currentTime) {
      candidateIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (candidateIdx !== -1) {
    const resolved = resolveLyricLineTiming(lines[candidateIdx], options);
    if (currentTime < resolved.displayEnd) {
      return resolved;
    }
  }
  return null;
}

/**
 * Finds the next lyric line that starts after the given time using binary search.
 *
 * @param lines - The list of lyric lines, sorted by start time.
 * @param currentTime - The current playback time in seconds.
 * @param options - Timing options to resolve line times.
 * @returns The next resolved lyric line, or null if none exists.
 */
export function findNextLyricLine(
  lines: LyricVideoLine[],
  currentTime: number,
  options?: LyricTimingOptions,
): ResolvedLyricVideoLine | null {
  let low = 0;
  let high = lines.length - 1;
  let resultIdx = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const resolved = resolveLyricLineTiming(lines[mid], options);
    if (resolved.displayStart > currentTime) {
      resultIdx = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return resultIdx !== -1 ? resolveLyricLineTiming(lines[resultIdx], options) : null;
}
