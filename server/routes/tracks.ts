// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { resolveLocalAudioPath } from "../services/audioPathResolver";
import crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { LOCAL_OBJECTS_DIR, sendError } from "./common";
import type { IStorage } from "../storage";

export function createTrackRoutes(storage: IStorage) {
  const router = Router();
  // ============================================
  // TRACKS API - Single source of truth for all audio
  // ============================================

  // Get all tracks for a project
  router.get("/api/tracks/project/:projectId", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const tracks = await storage.getProjectTracks(projectId);
      res.json({ success: true, tracks });
    } catch (err: any) {
      console.error("Get project tracks error:", err);
      sendError(res, 500, err?.message || "Failed to get tracks");
    }
  });

  // Get all tracks for current user
  router.get("/api/tracks", requireAuth(), async (req: Request, res: Response) => {
    try {
      const tracks = await storage.getUserTracks(req.userId!);
      res.json({ success: true, tracks });
    } catch (err: any) {
      console.error("Get user tracks error:", err);
      sendError(res, 500, err?.message || "Failed to get tracks");
    }
  });

  // Get single track
  router.get("/api/tracks/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const track = await storage.getTrack(req.params.id);
      if (!track) {
        return sendError(res, 404, "Track not found");
      }
      res.json({ success: true, track });
    } catch (err: any) {
      console.error("Get track error:", err);
      sendError(res, 500, err?.message || "Failed to get track");
    }
  });

  // Create a new track
  router.post("/api/tracks", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { projectId, name, type, audioUrl, position, duration, volume, pan, color, effects, metadata } = req.body;
      
      if (!name || !type) {
        return sendError(res, 400, "name and type are required");
      }
      
      // audioUrl is only required for audio/vocal/recording tracks
      if ((type === 'audio' || type === 'vocal' || type === 'recording') && !audioUrl) {
        return sendError(res, 400, "audioUrl is required for audio tracks");
      }

      const track = await storage.createTrack(req.userId!, projectId || null, {
        name,
        type,
        audioUrl,
        position: position || 0,
        duration,
        volume: volume ?? 100,
        pan: pan ?? 0,
        muted: false,
        solo: false,
        color,
        effects,
        metadata,
      });

      res.json({ success: true, track });
    } catch (err: any) {
      console.error("Create track error:", err);
      sendError(res, 500, err?.message || "Failed to create track");
    }
  });

  // Update a track
  router.patch("/api/tracks/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Verify track exists and belongs to user
      const existing = await storage.getTrack(id);
      if (!existing) {
        return sendError(res, 404, "Track not found");
      }
      if (existing.userId !== req.userId) {
        return sendError(res, 403, "Not authorized to update this track");
      }

      const track = await storage.updateTrack(id, updates);
      res.json({ success: true, track });
    } catch (err: any) {
      console.error("Update track error:", err);
      sendError(res, 500, err?.message || "Failed to update track");
    }
  });

  // Delete a track
  router.delete("/api/tracks/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify track exists and belongs to user
      const existing = await storage.getTrack(id);
      if (!existing) {
        return sendError(res, 404, "Track not found");
      }
      if (existing.userId !== req.userId) {
        return sendError(res, 403, "Not authorized to delete this track");
      }

      await storage.deleteTrack(id);
      res.json({ success: true, message: "Track deleted" });
    } catch (err: any) {
      console.error("Delete track error:", err);
      sendError(res, 500, err?.message || "Failed to delete track");
    }
  });

  // ============================================
  // MIX/EXPORT - Combine all tracks into one file
  // ============================================

  router.post("/api/tracks/mix", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { projectId, trackIds } = req.body;
      
      // Get tracks to mix
      let tracksToMix: any[] = [];
      if (projectId) {
        tracksToMix = await storage.getProjectTracks(projectId);
      } else if (trackIds && Array.isArray(trackIds)) {
        const results = await Promise.all(trackIds.map((id: string) => storage.getTrack(id)));
        tracksToMix = results.filter(Boolean) as any[];
      }

      if (tracksToMix.length === 0) {
        return sendError(res, 400, "No tracks to mix");
      }

      // Filter out muted tracks
      const activeTracks = tracksToMix.filter(t => !t.muted);
      if (activeTracks.length === 0) {
        return sendError(res, 400, "All tracks are muted");
      }

      // Build ffmpeg command to mix all tracks
      const ffmpeg = require("fluent-ffmpeg");
      const outputFilename = `mix_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.mp3`;
      const outputPath = path.join(LOCAL_OBJECTS_DIR, outputFilename);

      // Create complex filter for mixing with volume control
      let inputs: string[] = [];
      let filterParts: string[] = [];
      
      for (let i = 0; i < activeTracks.length; i++) {
        const track = activeTracks[i];
        // Shared resolver: this knew only uploads and /objects/, so a track
        // sourced from a converted song or a separated stem resolved to nothing
        // and was silently dropped from the mix — a quietly WRONG render rather
        // than an error.
        const audioPath = resolveLocalAudioPath(track.audioUrl) || '';

        if (!audioPath) {
          console.warn(`Track file not found or unsupported url: ${track.audioUrl}`);
          continue;
        }
        
        inputs.push(audioPath);
        const vol = (track.volume || 100) / 100;
        filterParts.push(`[${i}:a]volume=${vol}[a${i}]`);
      }

      if (inputs.length === 0) {
        return sendError(res, 400, "No valid audio files found");
      }

      // Mix all tracks
      const mixFilter = inputs.length > 1 
        ? filterParts.join(';') + ';' + filterParts.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${inputs.length}:duration=longest[out]`
        : `[0:a]volume=1[out]`;

      await new Promise<void>((resolve, reject) => {
        let cmd = ffmpeg();
        inputs.forEach(input => cmd = cmd.input(input));
        
        cmd
          .complexFilter(mixFilter, 'out')
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err: any) => reject(err))
          .run();
      });

      const mixUrl = `/api/internal/uploads/${outputFilename}`;
      
      res.json({ 
        success: true, 
        url: mixUrl,
        message: `Mixed ${inputs.length} tracks successfully`
      });
    } catch (err: any) {
      console.error("Mix tracks error:", err);
      sendError(res, 500, err?.message || "Failed to mix tracks");
    }
  });

  return router;
}
