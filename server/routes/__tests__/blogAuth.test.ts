import { describe, it, expect, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import type { AddressInfo } from "node:net";
import { MemStorage } from "../../storage";
import { createBlogRouter } from "../blog";

/**
 * The /blog is the site's official, public, SEO-indexed blog. Product review
 * (2026-10-07): POST /api/blog/posts accepted any signed-in user and honoured
 * `isPublished: true` — any free account could publish to the brand's blog.
 * Writing is owner-only.
 */

let storage: MemStorage;

async function post(user: { id?: string; owner?: boolean }, body: unknown) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (user.id) (req as any).userId = user.id;
    if (user.owner) (req as any).isOwner = true;
    next();
  });
  app.use("/api/blog", createBlogRouter(storage));
  const server = await new Promise<any>((r) => { const s = app.listen(0, () => r(s)); });
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/api/blog/posts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  server.close();
  return res.status;
}

const article = {
  title: "Hello", slug: "hello", excerpt: "Hi", content: "Body", category: "news", isPublished: true,
};

describe("POST /api/blog/posts", () => {
  beforeEach(() => {
    storage = new MemStorage();
  });

  it("refuses a regular signed-in user", async () => {
    expect(await post({ id: "free-user" }, article)).toBe(403);
  });

  it("lets the owner publish", async () => {
    expect(await post({ id: "owner-user", owner: true }, article)).toBe(201);
  });
});
