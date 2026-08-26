import { describe, it, expect } from "vitest";
import { buildMasteringFilters, MASTERING_DEFAULTS } from "../mastering";

/**
 * This chain lived as two identical copies (routes.ts polishGeneratedAudio and
 * unifiedMusicService) while voice conversion had none — the same product
 * shipped at two different loudnesses. One definition now; these assert it.
 */
describe("buildMasteringFilters", () => {
  it("normalises to the streaming target with true-peak headroom", () => {
    const f = buildMasteringFilters({ durationSeconds: 180 });
    expect(f[0]).toBe("loudnorm=I=-16:LRA=11:TP=-1.5");
    expect(f).toContain("dynaudnorm");
  });

  it("keeps loudnorm before dynaudnorm", () => {
    const f = buildMasteringFilters({ durationSeconds: 60 });
    expect(f.findIndex((x) => x.startsWith("loudnorm")))
      .toBeLessThan(f.findIndex((x) => x === "dynaudnorm"));
  });

  it("places the fade-out relative to the real end", () => {
    const f = buildMasteringFilters({ durationSeconds: 100 });
    const out = f.find((x) => x.includes("t=out"))!;
    const start = Number(out.match(/st=([\d.]+)/)![1]);
    expect(start).toBeGreaterThan(98);
    expect(start).toBeLessThan(100);
    expect(start + MASTERING_DEFAULTS.fadeOutSeconds).toBeLessThanOrEqual(100);
  });

  it("omits the fade-out when the duration is unknown, rather than guessing", () => {
    // A fade placed at a guessed second would mute real audio.
    const f = buildMasteringFilters({});
    expect(f.some((x) => x.includes("t=out"))).toBe(false);
    expect(f.some((x) => x.includes("t=in"))).toBe(true);
  });

  it("skips both fades when asked", () => {
    const f = buildMasteringFilters({ durationSeconds: 180, fades: false });
    expect(f.some((x) => x.startsWith("afade"))).toBe(false);
    expect(f).toEqual(["loudnorm=I=-16:LRA=11:TP=-1.5", "dynaudnorm"]);
  });

  it("honours custom targets", () => {
    const f = buildMasteringFilters({ targetLufs: -14, loudnessRange: 9, truePeak: -1 });
    expect(f[0]).toBe("loudnorm=I=-14:LRA=9:TP=-1");
  });
});
