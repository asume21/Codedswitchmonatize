/**
 * server/routes/projects.ts
 * Account-backed studio projects — mounted at /api/projects.
 *
 * Before this existed the studio could not save to a user's account at all
 * (product review M1/M2, 2026-10-07): File→Save wrote localStorage plus a
 * downloaded .json, and client/src/lib/projectManager.ts called these
 * endpoints, which 404'd. `data` is the studio's full project snapshot,
 * stored opaquely.
 *
 * Every lookup is owner-scoped. Another user's project answers 404 rather
 * than 403 so ids can't be probed for existence.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { IStorage } from "../storage";

const projectBody = z.object({
  name: z.string().trim().min(1).max(200),
  data: z.unknown().refine((d) => d !== undefined, "data is required"),
});

export function createProjectRoutes(storage: IStorage) {
  const router = Router();

  router.use((req: Request, res: Response, next) => {
    if (!req.userId) return res.status(401).json({ error: "Authentication required" });
    next();
  });

  async function ownProject(req: Request) {
    const project = await storage.getProject(req.params.id);
    return project && project.userId === req.userId ? project : undefined;
  }

  router.get("/", async (req: Request, res: Response) => {
    try {
      const projects = await storage.getUserProjects(req.userId!);
      const summaries = projects
        .map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
      res.json({ projects: summaries });
    } catch (err) {
      console.error("List projects error:", err);
      res.status(500).json({ error: "Failed to list projects" });
    }
  });

  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const project = await ownProject(req);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json({ project });
    } catch (err) {
      console.error("Get project error:", err);
      res.status(500).json({ error: "Failed to load project" });
    }
  });

  router.post("/", async (req: Request, res: Response) => {
    const parsed = projectBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid project", details: parsed.error.errors });
    }
    try {
      const project = await storage.createProject(req.userId!, {
        name: parsed.data.name,
        data: parsed.data.data,
      });
      res.status(201).json({ project });
    } catch (err) {
      console.error("Create project error:", err);
      res.status(500).json({ error: "Failed to save project" });
    }
  });

  router.put("/:id", async (req: Request, res: Response) => {
    const parsed = projectBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid project", details: parsed.error.errors });
    }
    try {
      if (!(await ownProject(req))) return res.status(404).json({ error: "Project not found" });
      const project = await storage.updateProject(req.params.id, {
        name: parsed.data.name,
        data: parsed.data.data,
      });
      res.json({ project });
    } catch (err) {
      console.error("Update project error:", err);
      res.status(500).json({ error: "Failed to save project" });
    }
  });

  router.delete("/:id", async (req: Request, res: Response) => {
    try {
      if (!(await ownProject(req))) return res.status(404).json({ error: "Project not found" });
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete project error:", err);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  return router;
}
