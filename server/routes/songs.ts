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
          console.warn('   Error details:', conversionError instanceof Error ? conversionError.message : conversionError);
          // Fall back to original URL if conversion fails
          finalURL = songURL;
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

  // Analyze song endpoint
  router.post("/analyze", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in to analyze songs" });
    }

    try {
      const { songId, songURL, songName } = req.body;

      if (!songId) {
        return res.status(400).json({ error: "Missing songId" });
      }

      console.log('🎵 Analyzing song:', { songId, songName });

      // Generate mock analysis (replace with real audio analysis later)
      const analysis = {
        songId,
        songName: songName || 'Unknown',
        estimatedBPM: Math.floor(Math.random() * (140 - 80 + 1)) + 80,
        keySignature: ['C', 'D', 'E', 'F', 'G', 'A', 'B'][Math.floor(Math.random() * 7)] + ['', 'm'][Math.floor(Math.random() * 2)],
        genre: ['Hip-Hop', 'R&B', 'Pop', 'Electronic', 'Rock', 'Jazz'][Math.floor(Math.random() * 6)],
        mood: ['Energetic', 'Chill', 'Melancholic', 'Uplifting', 'Dark', 'Dreamy'][Math.floor(Math.random() * 6)],
        structure: {
          intro: '0:00-0:15',
          verse1: '0:15-0:45',
          chorus: '0:45-1:15',
          verse2: '1:15-1:45',
          chorus2: '1:45-2:15',
          bridge: '2:15-2:45',
          outro: '2:45-3:00'
        },
        instruments: ['Drums', 'Bass', '808s', 'Synth', 'Piano', 'Vocals'].slice(0, Math.floor(Math.random() * 4) + 2),
        analysis_notes: `This track has a strong rhythmic foundation with layered melodic elements. The production quality is professional, with clear separation between instruments. The mix is well-balanced with good stereo imaging.`
      };

      // Update song in database with analysis
      await storage.updateSongAnalysis(songId, {
        estimatedBPM: analysis.estimatedBPM,
        keySignature: analysis.keySignature,
        genre: analysis.genre,
        mood: analysis.mood,
        structure: analysis.structure,
        instruments: analysis.instruments,
        analysisNotes: analysis.analysis_notes
      });

      console.log('✅ Song analysis complete:', songName);

      res.json(analysis);
    } catch (error) {
      console.error('Song analysis error:', error);
      res.status(500).json({
        error: "Failed to analyze song",
        message: error instanceof Error ? error.message : "Unknown error"
      });
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

    // Set a timeout for the conversion (30 seconds)
    const timeout = setTimeout(() => {
      console.error('❌ FFmpeg conversion timeout');
      reject(new Error('FFmpeg conversion timeout'));
    }, 30000);

    ffmpeg(inputURL)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .on('error', (err: Error) => {
        clearTimeout(timeout);
        console.error('❌ FFmpeg error:', err.message);
        reject(err);
      })
      .on('end', () => {
        clearTimeout(timeout);
        console.log('✅ FFmpeg conversion finished');
        // Return a URL that can be served by the browser
        // Use relative URL so it works in any environment
        const serveURL = `/api/songs/converted/${fileId}`;
        console.log('📡 Converted file will be served at:', serveURL);
        resolve(serveURL);
      })
      .save(outputPath);
  });
}
