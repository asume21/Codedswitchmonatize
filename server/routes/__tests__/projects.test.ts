import { describe, it, expect, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import type { AddressInfo } from "node:net";
import { MemStorage } from "../../storage";
import { createProjectRoutes } from "../projects";

/**
 * Product review M1/M2 (2026-10-07): the studio could never save to the user's
 * account — File→Save wrote localStorage + a downloaded .json, and the client's
 * projectManager called /api/projects, an endpoint that never existed. These
 * pin the account-backed project API: owner-only, summaries in the list.
 */

let storage: MemStorage;

async function call(
  userId: string | null,
  method: string,
  path: string,
  body?: unknown,
) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userId) (req as any).userId = userId;
    next();
  });
  app.use("/api/projects", createProjectRoutes(storage));
  const server = await new Promise<any>((r) => { const s = app.listen(0, () => r(s)); });
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/api/projects${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  server.close();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const beat = { tracks: [{ id: "t1", name: "Drums", notes: [{ step: 0 }] }], bpm: 92 };

describe("/api/projects", () => {
  beforeEach(() => {
    storage = new MemStorage();
  });

  it("creates a project owned by the caller and opens it again", async () => {
    const created = await call("alice", "POST", "", { name: "Night Drive", data: beat });
    expect(created.status).toBe(201);
    expect(created.body.project.name).toBe("Night Drive");

    const opened = await call("alice", "GET", `/${created.body.project.id}`);
    expect(opened.status).toBe(200);
    expect(opened.body.project.data).toEqual(beat);
  });

  it("lists only the caller's projects, as summaries without the heavy data", async () => {
    await call("alice", "POST", "", { name: "Mine", data: beat });
    await call("bob", "POST", "", { name: "Bob's", data: beat });

    const list = await call("alice", "GET", "");
    expect(list.status).toBe(200);
    expect(list.body.projects.map((p: any) => p.name)).toEqual(["Mine"]);
    expect(list.body.projects[0].data).toBeUndefined();
    expect(list.body.projects[0].updatedAt).toBeTruthy();
  });

  it("updates the caller's own project", async () => {
    const { body } = await call("alice", "POST", "", { name: "v1", data: beat });
    const updated = await call("alice", "PUT", `/${body.project.id}`, {
      name: "v2",
      data: { ...beat, bpm: 140 },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.project.name).toBe("v2");
    expect(updated.body.project.data.bpm).toBe(140);
  });

  it("hides another user's project: open, update and delete all 404", async () => {
    const { body } = await call("alice", "POST", "", { name: "Private", data: beat });
    const id = body.project.id;

    expect((await call("bob", "GET", `/${id}`)).status).toBe(404);
    expect((await call("bob", "PUT", `/${id}`, { name: "pwned", data: {} })).status).toBe(404);
    expect((await call("bob", "DELETE", `/${id}`)).status).toBe(404);

    const stillThere = await call("alice", "GET", `/${id}`);
    expect(stillThere.body.project.name).toBe("Private");
  });

  it("deletes the caller's own project", async () => {
    const { body } = await call("alice", "POST", "", { name: "Gone", data: beat });
    expect((await call("alice", "DELETE", `/${body.project.id}`)).status).toBe(200);
    expect((await call("alice", "GET", `/${body.project.id}`)).status).toBe(404);
  });

  it("rejects a project with no name", async () => {
    const res = await call("alice", "POST", "", { name: "  ", data: beat });
    expect(res.status).toBe(400);
  });

  it("requires a signed-in user", async () => {
    expect((await call(null, "GET", "")).status).toBe(401);
  });
});
