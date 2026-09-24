// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { insertPlaylistSchema } from "@shared/schema";
import { z } from "zod";
import { sendError } from "./common";
import type { IStorage } from "../storage";

export function createPlaylistRoutes(storage: IStorage) {
  const router = Router();
  const updatePlaylistSchema = insertPlaylistSchema.partial();
  const addSongSchema = z.object({ songId: z.string() });

  // Playlist endpoints
  router.get("/api/playlists", requireAuth(), async (req: Request, res: Response) => {
    try {
      const playlists = await storage.getUserPlaylists(req.userId!);
      res.json(playlists);
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to fetch playlists");
    }
  });

  router.post("/api/playlists", requireAuth(), async (req: Request, res: Response) => {
    try {
      const parsed = insertPlaylistSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload" });
      }
      const playlist = await storage.createPlaylist(req.userId!, parsed.data);
      res.status(201).json(playlist);
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to create playlist");
    }
  });

  router.get(
    "/api/playlists/:id/songs",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params as any;
                if (!id) return sendError(res, 400, "Missing playlist id");
        const playlist = await storage.getPlaylist(id);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });
        if (playlist.userId !== req.userId)
          return res.status(403).json({ message: "Forbidden" });
        const items = await storage.getPlaylistSongs(id);
        res.json(items);
      } catch (err: any) {
                sendError(res, 500, err?.message || "Failed to fetch playlist songs");
      }
    },
  );

  router.post(
    "/api/playlists/:id/songs",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params as any;
        const body = addSongSchema.safeParse(req.body || {});
                if (!body.success) return sendError(res, 400, "Invalid payload");
        const playlist = await storage.getPlaylist(id);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });
        if (playlist.userId !== req.userId)
          return res.status(403).json({ message: "Forbidden" });
        const song = await storage.getSong(body.data.songId);
                if (!song || song.userId !== req.userId) return sendError(res, 404, "Song not found");
        const ps = await storage.addSongToPlaylist(id, body.data.songId);
        res.status(201).json({ ...ps, song });
      } catch (err: any) {
                sendError(res, 500, err?.message || "Failed to add song to playlist");
      }
    },
  );

  router.delete(
    "/api/playlists/:id/songs/:songId",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { id, songId } = req.params as any;
        const playlist = await storage.getPlaylist(id);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });
        if (playlist.userId !== req.userId)
          return res.status(403).json({ message: "Forbidden" });
        await storage.removeSongFromPlaylist(id, songId);
        res.status(204).end();
      } catch (err: any) {
        res
          .status(500)
          .json({ success: false, message: err?.message || "Failed to remove song from playlist" });
      }
    },
  );

  router.put("/api/playlists/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const playlist = await storage.getPlaylist(id);
      if (!playlist) return res.status(404).json({ message: "Playlist not found" });
      if (playlist.userId !== req.userId)
        return res.status(403).json({ message: "Forbidden" });
      const parsed = updatePlaylistSchema.safeParse(req.body || {});
            if (!parsed.success) return sendError(res, 400, "Invalid payload");
            if (Object.keys(parsed.data).length === 0) return sendError(res, 400, "No fields to update");
      const updated = await storage.updatePlaylist(id, parsed.data as any);
      res.json(updated);
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to update playlist");
    }
  });

  router.delete("/api/playlists/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const playlist = await storage.getPlaylist(id);
      if (!playlist) return res.status(404).json({ message: "Playlist not found" });
      if (playlist.userId !== req.userId)
        return res.status(403).json({ message: "Forbidden" });
      await storage.deletePlaylist(id);
      res.status(204).end();
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to delete playlist");
    }
  });

  return router;
}
