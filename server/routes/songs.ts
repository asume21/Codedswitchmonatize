import { Router, type Request, type Response } from "express";
import type { IStorage } from "../storage";
import { checkUsageLimit } from "../middleware/featureGating";

export function createSongRoutes(storage: IStorage) {
  const router = Router();

  // Song upload endpoint - saves uploaded song metadata to database
  router.post("/upload", async (req: Request, res: Response) => {
    // Debug logging
    console.log('🔍 Song upload attempt:');
    console.log('  - req.userId:', req.userId);
    console.log('  - req.session:', req.session);
    console.log('  - req.session?.userId:', req.session?.userId);
    console.log('  - cookies:', req.headers.cookie);
    
    // Check if user is authenticated
    if (!req.userId) {
      console.error('❌ Song upload failed: User not authenticated');
      console.error('   Session exists?', !!req.session);
      console.error('   Session userId?', req.session?.userId);
      return res.status(401).json({ error: "Please activate your account to upload songs" });
    }
    
    try {
      const { songURL, name, fileSize, format } = req.body;
      
      if (!songURL || !name) {
        return res.status(400).json({ error: "Missing required fields: songURL and name" });
      }

      console.log('🎵 Saving song to database:', { name, songURL });

      // Create song using storage method
      const newSong = await storage.createSong(req.userId!, {
        name,
        originalUrl: songURL,
        accessibleUrl: songURL, // Same as original for local storage
        fileSize: fileSize || 0,
        format: format || 'audio',
      });

      // Increment upload count for usage tracking
      await storage.incrementUserUsage(req.userId!, 'uploads');

      console.log('✅ Song saved successfully:', newSong.id);

      res.json(newSong);
    } catch (error) {
      console.error('Song upload error:', error);
      res.status(500).json({
        error: "Failed to save song",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get all songs for current user
  router.get("/", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in to view songs" });
    }
    
    try {
      const songs = await storage.getUserSongs(req.userId!);
      res.json(songs);
    } catch (error) {
      console.error('Failed to fetch songs:', error);
      res.status(500).json({ error: "Failed to fetch songs" });
    }
  });

  return router;
}
