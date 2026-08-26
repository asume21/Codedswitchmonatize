import { describe, it, expect } from "vitest";
import { buildInstrumentalFilter, buildRemixFilter } from "../pipelineRunner";

/**
 * Regression: these filters used amix's `weights` and `normalize` options,
 * which the production image (node:20-bullseye → Debian ffmpeg 4.3) does not
 * have. ffmpeg refused the whole graph with "Error initializing complex
 * filters. Option not found", killing four production jobs on 2026-08-21/22 at
 * the final step — after stem separation and the paid voice conversion had
 * already succeeded.
 *
 * Verified equivalent by measurement, not assertion: rendering the same two
 * inputs through `amix=…:normalize=0` and through `amix=…,volume=2` produced
 * BYTE-IDENTICAL wav output on ffmpeg 8.
 */
const VERSION_LOCKED = /\bweights\s*=|\bnormalize\s*=/;

describe("ffmpeg filter graphs", () => {
  it("builds the instrumental mix without version-locked amix options", () => {
    const filter = buildInstrumentalFilter(3);
    expect(filter).not.toMatch(VERSION_LOCKED);
    expect(filter).toContain("amix=inputs=3:duration=longest");
    // amix scales by 1/inputs; volume=inputs restores the plain sum.
    expect(filter).toContain("volume=3");
    expect(filter).toContain("[0:a][1:a][2:a]");
    expect(filter).toContain("[out]");
  });

  it("compensates by exactly the input count", () => {
    expect(buildInstrumentalFilter(1)).toContain("volume=1");
    expect(buildInstrumentalFilter(4)).toContain("volume=4");
  });

  it("builds the remix without version-locked amix options", () => {
    const parts = buildRemixFilter();
    expect(parts.join(";")).not.toMatch(VERSION_LOCKED);
    const mix = parts.find((p) => p.includes("amix"))!;
    expect(mix).toContain("amix=inputs=2:duration=longest");
    expect(mix).toContain("volume=2");
    expect(mix).toContain("[out]");
  });

  it("keeps the vocal treatment chain intact", () => {
    const vocal = buildRemixFilter().find((p) => p.startsWith("[1:a]"))!;
    expect(vocal).toContain("highpass=f=85");
    expect(vocal).toContain("acompressor");
    expect(vocal).toContain("equalizer=f=6500");
  });
});

/**
 * Regression: a 2-stem separation returned a vocals stem whose loudest peak was
 * -50.8 dBFS (mean -75.7) — silence — while `other` held the whole mix.
 * ElevenLabs converted that silence into a full-level (0.0 dBFS) hallucinated
 * voice, which got mixed over the beat. The job reported "done" and billed for
 * it; what the user heard was passages jumping high-pitched and dropping out.
 *
 * Thresholds checked against the real files: silent stem -50.8, good stem -0.1.
 */
import { isEffectivelySilent, SILENT_STEM_PEAK_DB } from "../pipelineRunner";

describe("silent vocal stem guard", () => {
  it("rejects the real silent stem and accepts real audio", () => {
    expect(isEffectivelySilent(-50.8)).toBe(true);   // the actual failing stem
    expect(isEffectivelySilent(-75.7)).toBe(true);
    expect(isEffectivelySilent(-0.1)).toBe(false);   // the actual good stem
    expect(isEffectivelySilent(0.0)).toBe(false);
  });

  it("treats digital silence as silent", () => {
    expect(isEffectivelySilent(-Infinity)).toBe(true);
    expect(isEffectivelySilent(NaN)).toBe(true);
  });

  it("puts the threshold between the two observed cases", () => {
    expect(SILENT_STEM_PEAK_DB).toBeLessThan(-40 + 0.001);
    expect(SILENT_STEM_PEAK_DB).toBeGreaterThan(-50.8); // above the silent stem
    expect(SILENT_STEM_PEAK_DB).toBeLessThan(-0.1);     // below any real vocal
  });
});
