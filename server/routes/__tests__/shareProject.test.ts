import { describe, it, expect, vi } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import type { AddressInfo } from "node:net";
import { createSocialRoutes } from "../social";

// Product review S5: share-project never checked that you own the project.
async function share(userId: string, storage: any) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => { (req as any).userId = userId; next(); });
  app.use("/api/social", createSocialRoutes(storage));
  const server = await new Promise<any>((r) => { const s = app.listen(0, () => r(s)); });
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/api/social/share-project`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId: "proj-1", sharedWithUserId: "friend" }),
  });
  server.close();
  return res.status;
}

describe("POST /api/social/share-project", () => {
  const storageFor = () => ({
    getProject: async (id: string) => (id === "proj-1" ? { id, userId: "alice" } : undefined),
    createProjectShare: vi.fn(async () => ({ id: "share-1" })),
  });

  it("refuses to share someone else's project", async () => {
    const storage = storageFor();
    expect(await share("mallory", storage)).toBe(404);
    expect(storage.createProjectShare).not.toHaveBeenCalled();
  });

  it("shares your own project", async () => {
    const storage = storageFor();
    expect(await share("alice", storage)).toBe(200);
    expect(storage.createProjectShare).toHaveBeenCalledWith("proj-1", "alice", "friend", "view");
  });
});
