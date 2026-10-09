import { describe, it, expect } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import { createSocialRoutes } from "../social";

// Product review S3: a shared Organism session had no page of its own. The
// public endpoint serves one session (no sign-in), 404 for anything else.
async function get(storage: any, id: string) {
  const app = express();
  app.use("/api/social", createSocialRoutes(storage));
  const server = await new Promise<any>((r) => { const s = app.listen(0, () => r(s)); });
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/api/social/session/${id}`);
  const body = await res.json();
  server.close();
  return { status: res.status, body };
}

describe("GET /api/social/session/:id", () => {
  const session = { id: "p1", title: "Organism Session — 92 BPM", content: "{}", mediaUrl: "/objects/organism-sessions/x.webm", username: "asume21", createdAt: new Date().toISOString() };

  it("serves a shared session without signing in", async () => {
    const res = await get({ getPublicOrganismSession: async (id: string) => (id === "p1" ? session : undefined) }, "p1");
    expect(res.status).toBe(200);
    expect(res.body.session).toMatchObject({ id: "p1", username: "asume21", mediaUrl: session.mediaUrl });
  });

  it("404s for an unknown or non-session post", async () => {
    const res = await get({ getPublicOrganismSession: async () => undefined }, "nope");
    expect(res.status).toBe(404);
  });
});
