import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import type { AddressInfo } from "node:net";
import type { IStorage } from "../../storage";
import { requireAuthExcept } from "../../middleware/auth";

/**
 * Regression: /api/voice-convert/jobs/:id/stream is consumed by an EventSource,
 * which cannot read a JSON body. The browser aborts the connection with
 * "MIME type application/json is not text/event-stream" and fires onerror with
 * no status and no message — so a JSON 404/403/500, or the old shortcut that
 * returned an already-finished job as JSON, was invisible to the client.
 *
 * Every outcome must therefore arrive inside the SSE envelope.
 */

const subscribers: Array<(u: any) => void> = [];

vi.mock("../../services/jobQueue", () => ({
  jobQueue: {
    subscribe: (_jobId: string, cb: (u: any) => void) => {
      subscribers.push(cb);
      return () => {};
    },
  },
}));

const { createVoiceConvertRoutes, VOICE_CONVERT_STREAM_PATTERN } = await import("../voiceConvert");

function makeApp(job: any, userId: string | null = "user-1") {
  const storage = {
    getVoiceConvertJob: async () => job,
  } as unknown as IStorage;

  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userId) (req as any).userId = userId;
    next();
  });
  app.use("/api/voice-convert", createVoiceConvertRoutes(storage));
  return app;
}

/** Reads the whole stream; safe because every case under test ends the stream. */
async function readAll(app: express.Express, onOpen?: () => Promise<void> | void) {
  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/api/voice-convert/jobs/job-1/stream`);
  const contentType = res.headers.get("content-type") || "";
  const status = res.status;
  if (onOpen) await onOpen();
  const body = await res.text();
  server.close();
  const events = body
    .split("\n\n")
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice(6)));
  return { status, contentType, events };
}

beforeEach(() => {
  subscribers.length = 0;
});

describe("voice-convert job stream", () => {
  it("reports an unauthenticated caller as an SSE event, never a JSON 401", async () => {
    // requireAuth() would answer with a JSON 401, which an EventSource cannot
    // read — it aborts on the MIME type with no status and no message.
    const { status, contentType, events } = await readAll(makeApp(null, null));
    expect(status).toBe(200);
    expect(contentType).toContain("text/event-stream");
    expect(events).toEqual([{ status: "failed", error: "Unauthorized" }]);
  });

  it("reports a missing job as an SSE event, never JSON", async () => {
    const { status, contentType, events } = await readAll(makeApp(null));
    expect(status).toBe(200);
    expect(contentType).toContain("text/event-stream");
    expect(events).toEqual([{ status: "failed", error: "Job not found" }]);
  });

  it("reports another user's job as an SSE event, never JSON", async () => {
    const job = { id: "job-1", userId: "someone-else", status: "processing" };
    const { contentType, events } = await readAll(makeApp(job));
    expect(contentType).toContain("text/event-stream");
    expect(events).toEqual([{ status: "failed", error: "Forbidden" }]);
  });

  it("sends an already-finished job as one final event, then closes", async () => {
    const job = {
      id: "job-1",
      userId: "user-1",
      status: "done",
      remixUrl: "https://example.com/remix.wav",
      completedAt: "2026-08-21T00:00:00.000Z",
    };
    const { contentType, events } = await readAll(makeApp(job));
    expect(contentType).toContain("text/event-stream");
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("done");
    expect(events[0].remixUrl).toBe("https://example.com/remix.wav");
  });

  it("streams the initial state, then live updates, and ends on done", async () => {
    const job = { id: "job-1", userId: "user-1", status: "processing" };
    const { contentType, events } = await readAll(makeApp(job), async () => {
      // Wait for the route to subscribe, then push an update through.
      for (let i = 0; i < 50 && subscribers.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 10));
      }
      subscribers[0]?.({
        status: "done",
        remixUrl: "https://example.com/out.wav",
        error: null,
        completedAt: "2026-08-21T00:00:00.000Z",
      });
    });

    expect(contentType).toContain("text/event-stream");
    expect(events[0]).toEqual({ status: "processing" });
    expect(events[1].status).toBe("done");
    expect(events[1].remixUrl).toBe("https://example.com/out.wav");
  });
});

/**
 * Regression: the route's SSE error envelope above is unreachable in the real
 * app. requireAuthExcept() runs as global middleware BEFORE the router and
 * answers a JSON 401 for any /api path not in its allowlist — so an
 * unauthenticated EventSource still got a contentless onerror, exactly the bug
 * the route-level work set out to kill.
 *
 * It cannot be allowlisted by prefix: requireAuthExcept matches with
 * startsWith, but the path needing exemption is a SUFFIX
 * (/jobs/<id>/stream). Allowlisting "/api/voice-convert/jobs" would expose
 * every job route, including other users' jobs. Hence a pattern, exported from
 * the route module so this test guards the value production actually uses.
 *
 * Exempting the gate is safe: the handler does its own auth, and still fails
 * CLOSED on privilege — no userId means Unauthorized, and a job belonging to
 * someone else means Forbidden.
 */
describe("voice-convert stream behind the global auth gate", () => {
  function makeGatedApp(job: any, userId: string | null) {
    const storage = { getVoiceConvertJob: async () => job } as unknown as IStorage;
    const app = express();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (userId) (req as any).userId = userId;
      next();
    });
    app.use(requireAuthExcept(["/api/auth", VOICE_CONVERT_STREAM_PATTERN]));
    app.use("/api/voice-convert", createVoiceConvertRoutes(storage));
    return app;
  }

  it("the exported pattern matches the real stream path and nothing broader", () => {
    expect(VOICE_CONVERT_STREAM_PATTERN.test("/api/voice-convert/jobs/abc-123/stream")).toBe(true);
    // Must NOT exempt the rest of the job API — that would leak other users' jobs.
    expect(VOICE_CONVERT_STREAM_PATTERN.test("/api/voice-convert/jobs/abc-123")).toBe(false);
    expect(VOICE_CONVERT_STREAM_PATTERN.test("/api/voice-convert/jobs")).toBe(false);
    expect(VOICE_CONVERT_STREAM_PATTERN.test("/api/voice-convert/jobs/a/b/stream")).toBe(false);
  });

  it("reaches the handler unauthenticated, so the failure arrives as an SSE event", async () => {
    const { status, contentType, events } = await readAll(makeGatedApp(null, null));
    expect(status).toBe(200);
    expect(contentType).toContain("text/event-stream");
    expect(events).toEqual([{ status: "failed", error: "Unauthorized" }]);
  });

  it("still streams normally for the job's owner", async () => {
    const job = { id: "job-1", userId: "user-1", status: "done", remixUrl: "https://x/y.wav" };
    const { status, contentType, events } = await readAll(makeGatedApp(job, "user-1"));
    expect(status).toBe(200);
    expect(contentType).toContain("text/event-stream");
    expect(events[0].status).toBe("done");
  });
});
