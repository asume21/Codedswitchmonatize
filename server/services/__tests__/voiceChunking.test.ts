import { describe, it, expect } from "vitest";
import {
  planChunks, parseSilences,
  DEFAULT_MAX_SECONDS, DEFAULT_MIN_SECONDS,
} from "../voiceChunking";

/**
 * The whole vocal stem used to go to ElevenLabs in one request. Measured
 * against the user's own source stem, the converted vocal was clean for ~1:55
 * of a 2:57 track and then ran up to 2.24x brighter than the source, almost
 * continuously to the end. Chunking keeps each request short enough to stay
 * stable.
 *
 * Coverage must be exact: the pieces are reassembled on the original timeline,
 * so any gap or overlap slides the vocal against the beat.
 */
const covers = (chunks: {start:number;end:number}[], total: number) => {
  expect(chunks[0].start).toBeCloseTo(0, 6);
  expect(chunks[chunks.length - 1].end).toBeCloseTo(total, 6);
  for (let i = 1; i < chunks.length; i++) {
    expect(chunks[i].start).toBeCloseTo(chunks[i - 1].end, 6);
  }
};

describe("planChunks", () => {
  it("leaves a short vocal as a single chunk", () => {
    const c = planChunks(40, []);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ start: 0, end: 40 });
  });

  it("splits the real 2:57 track and covers it exactly", () => {
    const total = 176.82;
    // a gap every ~8s, like bar lines in a rap vocal
    const silences = Array.from({ length: 22 }, (_, i) => ({ start: i * 8 + 7.6, end: i * 8 + 8.1 }));
    const chunks = planChunks(total, silences);
    expect(chunks.length).toBeGreaterThan(1);
    covers(chunks, total);
    for (const ch of chunks) {
      expect(ch.end - ch.start).toBeLessThanOrEqual(DEFAULT_MAX_SECONDS + 1e-6);
      expect(ch.cutAtSilence).toBe(true);
    }
  });

  it("never emits a chunk shorter than the minimum", () => {
    const total = 95;
    const silences = [{ start: 29.5, end: 30.5 }, { start: 59.5, end: 60.5 }, { start: 93.9, end: 94.1 }];
    const chunks = planChunks(total, silences);
    covers(chunks, total);
    for (const ch of chunks) expect(ch.end - ch.start).toBeGreaterThanOrEqual(DEFAULT_MIN_SECONDS);
  });

  it("still cuts when there is no usable silence, and says so", () => {
    const chunks = planChunks(150, []);   // one unbroken sustained passage
    covers(chunks, 150);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((c) => !c.cutAtSilence)).toBe(true);
    for (const ch of chunks) expect(ch.end - ch.start).toBeLessThanOrEqual(DEFAULT_MAX_SECONDS + 1e-6);
  });

  it("prefers the silence nearest the target, not merely the first one", () => {
    // usable silences at 10s and 29s; target is 30s
    const chunks = planChunks(120, [{ start: 9.8, end: 10.2 }, { start: 28.8, end: 29.2 }]);
    expect(chunks[0].end).toBeCloseTo(29, 1);
  });

  it("handles a zero or negative duration without looping", () => {
    expect(planChunks(0, [])).toEqual([]);
    expect(planChunks(-5, [])).toEqual([]);
  });
});

describe("parseSilences", () => {
  it("pairs ffmpeg silencedetect output", () => {
    const stderr = [
      "[silencedetect @ 0x1] silence_start: 12.5",
      "[silencedetect @ 0x1] silence_end: 13.1 | silence_duration: 0.6",
      "[silencedetect @ 0x1] silence_start: 40.25",
      "[silencedetect @ 0x1] silence_end: 41.0 | silence_duration: 0.75",
    ].join("\n");
    expect(parseSilences(stderr)).toEqual([
      { start: 12.5, end: 13.1 },
      { start: 40.25, end: 41.0 },
    ]);
  });

  it("treats a leading silence_end with no start as starting at zero", () => {
    expect(parseSilences("silence_end: 2.0 | silence_duration: 2.0")).toEqual([{ start: 0, end: 2.0 }]);
  });

  it("returns nothing for output with no silence", () => {
    expect(parseSilences("size=100KiB time=00:01:00.00")).toEqual([]);
  });
});
