import { describe, it, expect } from "vitest";
import { buildQueryUrl } from "../queryClient";

/**
 * Regression: queryKey.join("/") double-slashed any segment that already began
 * with one, so /api/voice-convert/jobs//<id> 404'd on every single-job poll.
 * The list endpoint was unaffected (its segment starts with "?"), so jobs were
 * visible but their progress could never be fetched — a running job looked hung.
 */
describe("buildQueryUrl", () => {
  it("does not double-slash a leading-slash segment", () => {
    expect(buildQueryUrl(["/api/voice-convert/jobs", "/abc-123"]))
      .toBe("/api/voice-convert/jobs/abc-123");
  });

  it("appends a query string without inserting a slash", () => {
    expect(buildQueryUrl(["/api/voice-convert/jobs", "?limit=20"]))
      .toBe("/api/voice-convert/jobs?limit=20");
  });

  it("drops empty segments instead of leaving a trailing slash", () => {
    expect(buildQueryUrl(["/api/voice-convert/jobs", ""]))
      .toBe("/api/voice-convert/jobs");
  });

  it("joins plain segments with exactly one slash", () => {
    expect(buildQueryUrl(["/api/songs", "42", "stems"])).toBe("/api/songs/42/stems");
  });

  it("leaves a single segment untouched", () => {
    expect(buildQueryUrl(["/api/health"])).toBe("/api/health");
  });
});
