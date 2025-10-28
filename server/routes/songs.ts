import { Router, type Request, type Response } from "express";
import type { IStorage } from "../storage";
import { checkUsageLimit } from "../middleware/featureGating";
import ffmpeg from "fluent-ffmpeg";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createReadStream } from "fs";

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
      let { songURL, name, fileSize, format, duration } = req.body;
      
      if (!songURL || !name) {
        return res.status(400).json({ error: "Missing required fields: songURL and name" });
      }

      console.log('🎵 Saving song to database:', { name, songURL, format });

      // Convert non-MP3 formats to MP3 for browser compatibility
      let finalURL = songURL;
      const lowerFormat = format?.toLowerCase() || '';
      const lowerURL = songURL.toLowerCase();
      
      if (lowerFormat !== 'mp3' && !lowerURL.endsWith('.mp3')) {
        console.log(`🔄 Converting ${lowerFormat || 'unknown'} to MP3...`);
        try {
          finalURL = await convertToMp3(songURL);
          console.log('✅ Conversion complete:', finalURL);
          format = 'mp3';
        } catch (conversionError) {
          console.warn('⚠️ Conversion failed, using original:', conversionError);
          // Fall back to original URL if conversion fails
        }
      }

      // Create song using storage method
      const newSong = await storage.createSong(req.userId!, {
        name,
        originalUrl: songURL,
        accessibleUrl: finalURL, // Use converted URL if available
        fileSize: fileSize || 0,
        format: format || 'audio',
        duration: duration || null,
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

  // Serve converted audio files
  router.get("/converted/:fileId", (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;
      const tempDir = join(tmpdir(), 'codedswitch-conversions');
      const filePath = join(tempDir, `${fileId}.mp3`);

      // Security: ensure file is in temp directory
      if (!filePath.startsWith(tempDir)) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const stream = createReadStream(filePath);
      stream.pipe(res);
    } catch (error) {
      console.error('Error serving converted file:', error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  return router;
}

// Helper function to convert any audio format to MP3
async function convertToMp3(inputURL: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempDir = join(tmpdir(), 'codedswitch-conversions');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const fileId = Date.now().toString();
    const outputPath = join(tempDir, `${fileId}.mp3`);

    ffmpeg(inputURL)
      .toFormat('mp3')
      .on('error', (err: Error) => {
        console.error('FFmpeg error:', err);
        reject(err);
      })
      .on('end', () => {
        console.log('✅ FFmpeg conversion finished');
        // Return a URL that can be served by the browser
        const serveURL = `/api/songs/converted/${fileId}`;
        resolve(serveURL);
      })
      .save(outputPath);
  });
}
