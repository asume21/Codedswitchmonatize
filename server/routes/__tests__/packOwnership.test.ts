import { describe, it, expect, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import type { AddressInfo } from "node:net";
import { MemStorage } from "../../storage";
import { createLibraryRoutes } from "../library";

/**
 * Product review L3 (2026-10-07): sample_packs had no owner and no list
 * endpoint — a pack "saved to library" could never be found again by anyone.
 */
let storage: MemStorage;

async function call(userId: string, method: string, path: string, body?: unknown) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => { (req as any).userId = userId; next(); });
  app.use("/", createLibraryRoutes(storage));
  const server = await new Promise<any>((r) => { const s = app.listen(0, () => r(s)); });
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  server.close();
  return { status: res.status, body: json };
}

const pack = (title: string) => ({
  id: `p-${title}`, title, description: "d", bpm: 92, key: "Am", genre: "trap", generator: "ace-step",
  samples: [{ id: "s1", name: "loop", type: "loop", duration: 4, url: "/x.wav" }],
  metadata: { mood: "dark" },
});

describe("saved packs belong to their owner", () => {
  beforeEach(() => { storage = new MemStorage(); });

  it("lists only the caller's packs, reopenable with bpm/key/samples", async () => {
    expect((await call("alice", "POST", "/api/packs/save", { pack: pack("Night") })).status).toBe(200);
    await call("bob", "POST", "/api/packs/save", { pack: pack("Bobs") });

    const mine = await call("alice", "GET", "/api/packs/mine");
    expect(mine.status).toBe(200);
    expect(mine.body.packs.map((p: any) => p.title)).toEqual(["Night"]);
    expect(mine.body.packs[0]).toMatchObject({ bpm: 92, key: "Am", genre: "trap" });
    expect(mine.body.packs[0].samples).toHaveLength(1);
  });
});
