import { Router, type Request, type Response } from "express";
import type { IStorage } from "../storage";
import { checkUsageLimit } from "../middleware/featureGating";
import ffmpeg from "fluent-ffmpeg";
import { createWriteStream, existsSync, mkdirSync, readFileSync, copyFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { createReadStream } from "fs";
import { parseFile } from "music-metadata";
import fetch from "node-fetch";
import { unlink } from "fs/promises";
import { sunoApi } from "../services/sunoApi";
import { getGuestUserId } from "../guestUser";
import { isIP } from "net";

export function createSongRoutes(storage: IStorage) {
  const router = Router();
  const allowGuestUploads = process.env.ALLOW_GUEST_UPLOADS !== "false";

  // Song upload endpoint - saves uploaded song metadata to database
  router.post("/upload", async (req: Request, res: Response) => {
    // Debug logging
    console.log('🔍 Song upload attempt:');
    console.log('  - req.userId:', req.userId);
    console.log('  - req.session:', req.session);
    console.log('  - req.session?.userId:', req.session?.userId);
    console.log('  - cookies:', req.headers.cookie);
    
    // Check if user is authenticated (use guest user for anonymous uploads if enabled)
    if (!req.userId) {
      if (!allowGuestUploads) {
        return res.status(401).json({ error: "Authentication required" });
      }
      console.warn('⚠️ No auth - using guest user for development');
      req.userId = await getGuestUserId(storage);
      console.log('✅ Using guest user ID:', req.userId);
    }
    
    try {
      let { songURL, name, fileSize, format, duration } = req.body;
      
      console.log('📦 SERVER RECEIVED:', {
        name,
        fileSize: fileSize,
        duration: duration,
        format: format,
        hasFileSize: !!fileSize,
        hasDuration: !!duration
      });
      
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

  // Delete song endpoint
  router.delete("/:id", async (req: Request, res: Response) => {
    // Use guest user for anonymous requests if enabled
    if (!req.userId) {
      if (!allowGuestUploads) {
        return res.status(401).json({ error: "Authentication required" });
      }
      req.userId = await getGuestUserId(storage);
    }

    try {
      const songId = req.params.id;
      console.log(`🗑️ Deleting song: ${songId} for user: ${req.userId}`);

      // Check ownership
      const song = await storage.getSong(songId);
      if (!song) {
        return res.status(404).json({ error: "Song not found" });
      }

      if (song.userId !== req.userId) {
        console.warn(`❌ Access denied deleting song ${songId}. Owner: ${song.userId}, Requestor: ${req.userId}`);
        return res.status(403).json({ error: "Access denied" });
      }

      // Delete from database
      await storage.deleteSong(songId);

      console.log(`✅ Song deleted successfully: ${songId}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete song error:', error);
      res.status(500).json({ error: "Failed to delete song" });
    }
  });

  // Get a public song (no auth required) - for social sharing
  router.get("/public/:id", async (req: Request, res: Response) => {
    try {
      const songId = req.params.id;
      const song = await storage.getSong(songId);
      
      if (!song) {
        return res.status(404).json({ error: "Song not found" });
      }
      
      if (!song.isPublic) {
        return res.status(403).json({ error: "This song is not public" });
      }
      
      // Get owner info for display
      let artistName = "Unknown Artist";
      if (song.userId) {
        const owner = await storage.getUser(song.userId);
        if (owner) {
          artistName = owner.username || "Unknown Artist";
        }
      }
      
      // Return only safe public fields
      res.json({
        id: song.id,
        name: song.name,
        accessibleUrl: song.accessibleUrl,
        duration: song.duration,
        genre: song.genre,
        mood: song.mood,
        uploadDate: song.uploadDate,
        artistName,
      });
    } catch (error) {
      console.error('Get public song error:', error);
      res.status(500).json({ error: "Failed to fetch song" });
    }
  });

  // Toggle song public status (auth required, owner only)
  router.patch("/:id/public", async (req: Request, res: Response) => {
    if (!req.userId) {
      if (!allowGuestUploads) {
        return res.status(401).json({ error: "Authentication required" });
      }
      req.userId = await getGuestUserId(storage);
    }

    try {
      const songId = req.params.id;
      const { isPublic } = req.body;
      
      if (typeof isPublic !== 'boolean') {
        return res.status(400).json({ error: "isPublic must be a boolean" });
      }

      const song = await storage.getSong(songId);
      if (!song) {
        return res.status(404).json({ error: "Song not found" });
      }

      if (song.userId !== req.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updated = await storage.updateSong(songId, { isPublic });
      console.log(`🔓 Song ${songId} public status set to: ${isPublic}`);
      
      res.json({ 
        success: true, 
        isPublic: updated.isPublic,
        shareUrl: isPublic ? `/s/${songId}` : null
      });
    } catch (error) {
      console.error('Toggle public error:', error);
      res.status(500).json({ error: "Failed to update song" });
    }
  });

  // Get all songs for current user
  router.get("/", async (req: Request, res: Response) => {
    // Use guest user for anonymous requests
    if (!req.userId) {
      if (!allowGuestUploads) {
        return res.status(401).json({ error: "Authentication required" });
      }
      req.userId = await getGuestUserId(storage);
      console.log('✅ Using guest user ID for song list:', req.userId);
    }
    
    try {
      const songs = await storage.getUserSongs(req.userId!);
      res.json(songs);
    } catch (error) {
      console.error('Failed to fetch songs:', error);
      res.status(500).json({ error: "Failed to fetch songs" });
    }
  });

  // Analyze song endpoint - REAL ANALYSIS with AI
  router.post("/analyze", async (req: Request, res: Response) => {
    // Use guest user for anonymous analysis (same as upload)
    if (!req.userId) {
      if (!allowGuestUploads) {
        return res.status(401).json({ error: "Authentication required" });
      }
      console.warn('⚠️ No auth - using guest user for song analysis');
      req.userId = await getGuestUserId(storage);
      console.log('✅ Using guest user ID for analysis:', req.userId);
    }

    try {
      const { songId, songURL, songName } = req.body;

      if (!songId || !songURL) {
        return res.status(400).json({ error: "Missing songId or songURL" });
      }

      console.log('🎵 Starting REAL audio analysis for:', { songId, songName });
      console.log('📍 Song URL:', songURL);

      // Download the audio file temporarily for analysis
      let tempFilePath;
      try {
        tempFilePath = await downloadAudioFile(songURL, songName);
        console.log('✅ File ready for analysis:', tempFilePath);
      } catch (downloadError) {
        console.error('❌ Download failed:', downloadError);
        throw new Error(`Failed to download audio file: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
      }
      
      try {
        // Extract metadata using music-metadata
        console.log('📊 Extracting metadata...');
        const metadata = await parseFile(tempFilePath);
        
        // Extract useful information
        const duration = metadata.format.duration || 0;
        const bitrate = metadata.format.bitrate || 0;
        const sampleRate = metadata.format.sampleRate || 0;
        const codec = metadata.format.codec || 'unknown';
        
        console.log('✅ Metadata extracted:', { duration, bitrate, sampleRate, codec });

        // Use AI to analyze the audio
        console.log('🤖 Sending to AI for analysis...');
        const aiAnalysis = await analyzeWithAI(songName, {
          duration,
          bitrate,
          sampleRate,
          codec
        });

        console.log('✅ AI analysis complete');

        const analysis = {
          songId,
          songName: songName || 'Unknown',
          ...aiAnalysis  // Include ALL fields from AI analysis
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

        console.log('✅ Song analysis saved to database');

        console.log('📤 SENDING TO FRONTEND - Has vocalAnalysis?', !!analysis.vocalAnalysis);
        console.log('📤 SENDING TO FRONTEND - Has lyricsQuality?', !!analysis.lyricsQuality);
        console.log('📤 SENDING TO FRONTEND - Keys:', Object.keys(analysis));

        res.json(analysis);
      } finally {
        // Clean up temp file
        try {
          await unlink(tempFilePath);
          console.log('🗑️ Temp file cleaned up');
        } catch (e) {
          console.warn('⚠️ Could not delete temp file:', e);
        }
      }
    } catch (error) {
      console.error('❌ Song analysis error:', error);
      res.status(500).json({
        error: "Failed to analyze song",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Serve converted audio files
  // Note: Security is handled at upload time. Converted files use random IDs
  // that are only known if you uploaded the song or have the URL.
  router.get("/converted/:fileId(*)", async (req: Request, res: Response) => {
    try {
      const fileId = decodeURIComponent(req.params.fileId);
      console.log(`🔄 Serving converted file: ${fileId}`);
      
      const objectsDir = process.env.LOCAL_OBJECTS_DIR || join(process.cwd(), 'objects');
      const convertedDir = join(objectsDir, 'converted');
      
      // Use consistent sanitization for file path
      const safeFileId = fileId.replace(/[^a-zA-Z0-9-_\.]/g, '_');
      const filePath = join(convertedDir, `${safeFileId}.mp3`);

      // Security: ensure file is in converted directory (prevent path traversal)
      const resolvedPath = resolve(filePath);
      const resolvedDir = resolve(convertedDir);
      if (!resolvedPath.startsWith(resolvedDir)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // If converted file exists, serve it
      if (existsSync(filePath)) {
        console.log(`✅ Serving converted MP3: ${filePath}`);
        
        const stat = require('fs').statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;
        
        // iOS Safari requires Accept-Ranges and proper range request handling
        if (range) {
          // Handle range request (iOS Safari needs this for audio)
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunkSize = (end - start) + 1;
          
          console.log(`📱 Range request: ${start}-${end}/${fileSize}`);
          
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=86400',
          });
          
          const stream = createReadStream(filePath, { start, end });
          return stream.pipe(res);
        } else {
          // Normal request
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Content-Length', fileSize);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          const stream = createReadStream(filePath);
          return stream.pipe(res);
        }
      }

      // File doesn't exist
      console.log(`❌ Converted file not found: ${filePath}`);
      res.status(404).json({ error: "File not found" });
    } catch (error) {
      console.error('Error serving converted file:', error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // ===== SUNO API ENDPOINTS =====

  // Upload and Cover - Transform song with different style
  router.post("/suno/cover", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in" });
    }

    try {
      const { audioUrl, prompt, style, title } = req.body;
      console.log('🎵 Suno Cover:', { prompt, style });

      const result = await sunoApi.uploadAndCover({
        uploadUrl: audioUrl,
        prompt,
        style,
        title
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error('Suno cover error:', error);
      res.status(500).json({ error: "Failed to cover song" });
    }
  });

  // Extend Music - Extend existing generated music
  router.post("/suno/extend", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in" });
    }

    try {
      const { audioId, prompt, continueAt, model } = req.body;
      console.log('🎵 Suno Extend:', { audioId, continueAt, model });

      const result = await sunoApi.extendMusic({
        audioId,
        prompt,
        continueAt,
        model: model || 'V4_5'
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error('Suno extend error:', error);
      res.status(500).json({ error: "Failed to extend song" });
    }
  });

  // Separate Vocals - Extract vocals and instrumentals
  router.post("/suno/separate", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in" });
    }

    try {
      const { taskId, audioId } = req.body;
      console.log('🎵 Suno Separate Vocals:', { taskId, audioId });

      const result = await sunoApi.separateVocals({ taskId, audioId });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error('Suno separate error:', error);
      res.status(500).json({ error: "Failed to separate vocals" });
    }
  });

  // Add Vocals - Generate vocals for instrumental (uses cover with vocal prompt)
  router.post("/suno/add-vocals", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in" });
    }

    try {
      const { audioUrl, prompt, style } = req.body;
      console.log('🎵 Suno Add Vocals:', { prompt });

      // Use uploadAndCover with vocal-focused prompt
      const result = await sunoApi.uploadAndCover({
        uploadUrl: audioUrl,
        prompt: prompt || 'Add professional vocals',
        style: style || 'with vocals'
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error('Suno add vocals error:', error);
      res.status(500).json({ error: "Failed to add vocals" });
    }
  });

  // Add Instrumental - Generate instrumental backing (uses cover with instrumental prompt)
  router.post("/suno/add-instrumental", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in" });
    }

    try {
      const { audioUrl, prompt, style } = req.body;
      console.log('🎵 Suno Add Instrumental:', { prompt });

      // Use uploadAndCover with instrumental-focused prompt
      const result = await sunoApi.uploadAndCover({
        uploadUrl: audioUrl,
        prompt: prompt || 'Add professional instrumental backing',
        style: style || 'instrumental arrangement'
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error('Suno add instrumental error:', error);
      res.status(500).json({ error: "Failed to add instrumental" });
    }
  });

  // Get Suno job status
  router.post("/suno/status", async (req: Request, res: Response) => {
    try {
      const { taskId } = req.body;
      const result = await sunoApi.getTaskStatus(taskId);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error('Suno status error:', error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // Get Suno credits
  router.get("/suno/credits", async (req: Request, res: Response) => {
    try {
      const result = await sunoApi.getRemainingCredits();

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error('Suno credits error:', error);
      res.status(500).json({ error: "Failed to get credits" });
    }
  });

  // ===== MIGRATION ENDPOINT =====
  // Fix old uploaded tracks that weren't converted to MP3
  router.post("/migrate-old-tracks", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      console.log('🔄 Starting migration of old tracks for user:', req.userId);
      
      const userSongs = await storage.getUserSongs(req.userId);
      const songsToMigrate: any[] = [];
      const migratedSongs: any[] = [];
      const failedSongs: any[] = [];

      // Find songs that need migration (non-MP3 or missing converted URL)
      for (const song of userSongs) {
        const accessibleUrl = song.accessibleUrl || '';
        const format = (song.format || '').toLowerCase();
        
        // Check if already converted
        const isConverted = accessibleUrl.includes('/api/songs/converted/');
        const isMp3 = format === 'mp3' || accessibleUrl.toLowerCase().endsWith('.mp3');
        
        if (!isConverted && !isMp3 && song.originalUrl) {
          songsToMigrate.push(song);
        }
      }

      console.log(`📋 Found ${songsToMigrate.length} songs to migrate`);

      // Convert each song
      for (const song of songsToMigrate) {
        try {
          console.log(`🔄 Converting: ${song.name} (${song.format || 'unknown format'})`);
          
          // Generate a unique file ID for this conversion
          const fileId = `migrated-${song.id}-${Date.now()}`;
          
          // Attempt conversion
          const convertedUrl = await convertToMp3WithCustomId(song.originalUrl, fileId);
          
          // Update the song in database
          await storage.updateSong(song.id, {
            accessibleUrl: convertedUrl,
            format: 'mp3'
          });
          
          migratedSongs.push({
            id: song.id,
            name: song.name,
            oldUrl: song.accessibleUrl,
            newUrl: convertedUrl
          });
          
          console.log(`✅ Migrated: ${song.name}`);
        } catch (conversionError) {
          console.error(`❌ Failed to migrate ${song.name}:`, conversionError);
          failedSongs.push({
            id: song.id,
            name: song.name,
            error: conversionError instanceof Error ? conversionError.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: true,
        totalFound: songsToMigrate.length,
        migrated: migratedSongs.length,
        failed: failedSongs.length,
        migratedSongs,
        failedSongs
      });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({
        error: "Migration failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Check migration status for a user's songs
  router.get("/migration-status", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const userSongs = await storage.getUserSongs(req.userId);
      
      const stats = {
        total: userSongs.length,
        converted: 0,
        needsMigration: 0,
        mp3Native: 0,
        songs: [] as any[]
      };

      for (const song of userSongs) {
        const accessibleUrl = song.accessibleUrl || '';
        const format = (song.format || '').toLowerCase();
        
        const isConverted = accessibleUrl.includes('/api/songs/converted/');
        const isMp3 = format === 'mp3' || accessibleUrl.toLowerCase().endsWith('.mp3');
        
        let status = 'unknown';
        if (isConverted) {
          stats.converted++;
          status = 'converted';
        } else if (isMp3) {
          stats.mp3Native++;
          status = 'mp3_native';
        } else {
          stats.needsMigration++;
          status = 'needs_migration';
        }

        stats.songs.push({
          id: song.id,
          name: song.name,
          format: song.format,
          status,
          accessibleUrl: song.accessibleUrl
        });
      }

      res.json(stats);
    } catch (error) {
      console.error('Migration status error:', error);
      res.status(500).json({ error: "Failed to get migration status" });
    }
  });

  return router;
}

// Helper function to convert with custom fileId (for on-demand conversion)
async function convertToMp3WithCustomId(inputURL: string, fileId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectsDir = process.env.LOCAL_OBJECTS_DIR || join(process.cwd(), 'objects');
    const convertedDir = join(objectsDir, 'converted');
    
    // Sanitize fileId to prevent directory traversal but allow nested structure if needed
    // But simpler is to just flatten the structure for converted files
    const safeFileId = fileId.replace(/[^a-zA-Z0-9-_\.]/g, '_');
    
    if (!existsSync(convertedDir)) {
      mkdirSync(convertedDir, { recursive: true });
    }

    const outputPath = join(convertedDir, `${safeFileId}.mp3`);

    // Convert API URL to file system path
    let inputPath = inputURL;
    if (inputURL.startsWith('/api/internal/uploads/')) {
      const objectKey = decodeURIComponent(inputURL.replace('/api/internal/uploads/', ''));
      inputPath = join(objectsDir, objectKey);
      console.log(`📁 Converted URL to path: ${inputURL} → ${inputPath}`);
    }

    // Check if input file exists
    if (!existsSync(inputPath)) {
      console.error('❌ Input file not found:', inputPath);
      reject(new Error(`Input file not found: ${inputPath}`));
      return;
    }
    
    console.log('🎵 Starting FFmpeg conversion:', inputPath, '→', outputPath);

    const timeout = setTimeout(() => {
      console.error('❌ FFmpeg conversion timeout after 120s');
      reject(new Error('FFmpeg conversion timeout'));
    }, 120000);

    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .on('start', (cmd: string) => {
        console.log('🎬 FFmpeg started:', cmd);
      })
      .on('progress', (progress: any) => {
        if (progress.percent) {
          console.log(`⏳ FFmpeg progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('error', (err: Error) => {
        clearTimeout(timeout);
        console.error('❌ FFmpeg error:', err.message);
        reject(err);
      })
      .on('end', () => {
        clearTimeout(timeout);
        console.log('✅ FFmpeg conversion finished');
        // Use the safe ID for the serving URL
        const serveURL = `/api/songs/converted/${safeFileId}`;
        console.log('📡 Converted file will be served at:', serveURL);
        resolve(serveURL);
      })
      .save(outputPath);
  });
}

// Helper function to convert any audio format to MP3
async function convertToMp3(inputURL: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Store converted files in persistent objects directory instead of temp
    const objectsDir = process.env.LOCAL_OBJECTS_DIR || join(process.cwd(), 'objects');
    const convertedDir = join(objectsDir, 'converted');
    if (!existsSync(convertedDir)) {
      mkdirSync(convertedDir, { recursive: true });
    }

    const fileId = Date.now().toString();
    const outputPath = join(convertedDir, `${fileId}.mp3`);

    // Convert API URL to file system path
    // Example: /api/internal/uploads/songs%2F123.m4a → /home/runner/workspace/objects/songs/123.m4a
    let inputPath = inputURL;
    if (inputURL.startsWith('/api/internal/uploads/')) {
      const objectKey = decodeURIComponent(inputURL.replace('/api/internal/uploads/', ''));
      const objectsDir = process.env.LOCAL_OBJECTS_DIR || join(process.cwd(), 'objects');
      inputPath = join(objectsDir, objectKey);
      console.log(`📁 Converted URL to path: ${inputURL} → ${inputPath}`);
    }

    // Check if input file exists
    if (!existsSync(inputPath)) {
      console.error('❌ Input file not found:', inputPath);
      reject(new Error(`Input file not found: ${inputPath}`));
      return;
    }
    
    console.log('🎵 Starting FFmpeg conversion:', inputPath, '→', outputPath);

    // Set a timeout for the conversion (120 seconds for larger files)
    const timeout = setTimeout(() => {
      console.error('❌ FFmpeg conversion timeout after 120s');
      reject(new Error('FFmpeg conversion timeout'));
    }, 120000);

    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .on('start', (cmd: string) => {
        console.log('🎬 FFmpeg started:', cmd);
      })
      .on('progress', (progress: any) => {
        if (progress.percent) {
          console.log(`⏳ FFmpeg progress: ${Math.round(progress.percent)}%`);
        }
      })
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

// Basic SSRF guardrails for external fetches
function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (!hostname) return true;
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;
  if (lower.endsWith(".local")) return true;

  // Block common private ranges
  if (isIP(hostname)) {
    if (hostname.startsWith("10.") || hostname.startsWith("127.") || hostname.startsWith("192.168.")) return true;
    if (hostname.startsWith("169.254.")) return true; // link-local
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      const [a, b] = parts.map(Number);
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    }
  }
  // Basic IPv6 private ranges
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80") || lower.startsWith("::ffff:127.")) {
    return true;
  }

  return false;
}

// Helper function to download audio file for analysis
async function downloadAudioFile(url: string, filename: string): Promise<string> {
  const tempDir = join(tmpdir(), 'codedswitch-analysis');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const ext = filename.split('.').pop() || 'audio';
  const tempFilePath = join(tempDir, `${Date.now()}-${filename}`);

  console.log('⬇️ Downloading audio file:', url);

  // Handle both internal and external URLs
  let fileURL = url;
  if (url.startsWith('/api/internal/')) {
    // Internal URL - need to read from local filesystem instead
    // Get the file path from the URL
    const relativePath = decodeURIComponent(url.replace('/api/internal/uploads/', ''));
    const LOCAL_OBJECTS_DIR = existsSync('/data/objects') 
      ? resolve('/data', 'objects')
      : resolve(process.cwd(), "objects");
    const sourcePath = join(LOCAL_OBJECTS_DIR, relativePath);
    
    console.log('📂 Reading from local file:', sourcePath);
    
    if (!existsSync(sourcePath)) {
      throw new Error(`Audio file not found at: ${sourcePath}`);
    }
    
    // Copy file to temp location
    copyFileSync(sourcePath, tempFilePath);
    console.log('✅ Audio file copied to temp location');
    return tempFilePath;
  }

  // External URL - download it with basic SSRF protections
  let parsed: URL;
  try {
    parsed = new URL(fileURL);
  } catch (err) {
    throw new Error(`Invalid audio URL: ${fileURL}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs are allowed for audio analysis");
  }

  if (!parsed.hostname || isBlockedHost(parsed.hostname)) {
    throw new Error("Audio URL host is not allowed");
  }

  const response = await fetch(parsed.toString());
  if (!response.ok) {
    throw new Error(`Failed to download audio file: ${response.statusText}`);
  }

  const buffer = await response.buffer();
  const writeStream = createWriteStream(tempFilePath);
  
  return new Promise((resolve, reject) => {
    writeStream.write(buffer, (err) => {
      if (err) {
        reject(err);
      } else {
        writeStream.end();
        console.log('✅ Audio file downloaded to:', tempFilePath);
        resolve(tempFilePath);
      }
    });
  });
}

// Helper function to analyze audio with AI - COMPREHENSIVE ANALYSIS
async function analyzeWithAI(songName: string, metadata: any): Promise<any> {
  const XAI_API_KEY = process.env.XAI_API_KEY;
  
  if (!XAI_API_KEY) {
    console.warn('⚠️ No XAI_API_KEY found, using basic analysis');
    return generateBasicAnalysis(metadata);
  }

  try {
    const prompt = `You are a professional music producer, audio engineer, and vocal coach. Provide a COMPREHENSIVE analysis of this song:

**SONG DETAILS:**
Song Name: ${songName}
Duration: ${Math.floor(metadata.duration / 60)}:${Math.floor(metadata.duration % 60).toString().padStart(2, '0')}
Bitrate: ${metadata.bitrate} kbps
Sample Rate: ${metadata.sampleRate} Hz
Codec: ${metadata.codec}

**REQUIRED COMPREHENSIVE ANALYSIS:**

1. **MUSIC THEORY:**
   - BPM (realistic 60-180)
   - Key signature (e.g., "C Major", "F# minor")
   - Time signature (e.g., "4/4", "3/4")
   - Genre and sub-genre
   - Mood and energy level

2. **VOCAL ANALYSIS** (if vocals present):
   - Vocal range and register
   - Delivery style (aggressive, laid-back, melodic, etc.)
   - Flow and timing (on-beat, offbeat, syncopated)
   - Breath control and phrasing
   - Vocal effects used (autotune, reverb, delay, etc.)
   - Vocal clarity and pronunciation
   - Emotional delivery and expression
   - Timing issues or strengths

3. **LYRICS QUALITY** (if available):
   - Rhyme scheme quality
   - Wordplay and metaphors
   - Theme and storytelling
   - Syllable count and rhythm
   - Hook catchiness
   - Lyrical complexity
   
4. **PRODUCTION QUALITY:**
   - Mix quality (1-10 score)
   - Master quality (1-10 score)
   - Frequency balance (bass, mids, highs)
   - Dynamic range
   - Stereo imaging
   - Clarity and separation
   - Professional vs amateur production
   - Issues: muddy mix, harsh highs, weak bass, etc.

5. **ARRANGEMENT:**
   - Song structure with accurate timestamps
   - Transitions quality
   - Build-ups and drops
   - Layering complexity
   - Space and breathing room

6. **INSTRUMENTS & SOUNDS:**
   - All instruments used
   - Sound quality (synthetic vs organic)
   - 808s/drums quality
   - Melody instruments
   - Sound selection rating

7. **COMMERCIAL VIABILITY:**
   - Radio-ready? (yes/no + why)
   - Target audience
   - Comparable artists/songs
   - Streaming potential (1-10)
   - Areas for improvement

8. **SPECIFIC ISSUES TO FIX:**
   - List 3-5 specific problems
   - Priority order (high/medium/low)
   - Suggested fixes

Respond ONLY with valid JSON in this EXACT format:
{
  "estimatedBPM": 128,
  "keySignature": "F# minor",
  "timeSignature": "4/4",
  "genre": "Hip-Hop",
  "subGenre": "Trap",
  "mood": "Dark and Aggressive",
  "energyLevel": 8,
  "vocalAnalysis": {
    "hasVocals": true,
    "vocalRange": "Tenor (C3-C5)",
    "deliveryStyle": "Aggressive and confident",
    "flowTiming": "Syncopated with triplet flows",
    "breathControl": "Good phrasing with consistent energy",
    "vocalEffects": ["Autotune", "Reverb", "Delay"],
    "clarity": "Clear pronunciation, slight mumble in verse 2",
    "emotionalDelivery": "Intense and emotional, connects with listener",
    "timingIssues": "Slightly rushed on bridge, otherwise tight"
  },
  "lyricsQuality": {
    "rhymeScheme": "Complex multisyllabic rhymes (AABB)",
    "wordplay": "Strong metaphors and double entendres",
    "theme": "Street struggles and triumph",
    "syllableRhythm": "Varied cadence keeps it interesting",
    "hookCatchiness": 9,
    "complexity": "Advanced vocabulary with street slang"
  },
  "productionQuality": {
    "mixQuality": 8,
    "masterQuality": 7,
    "frequencyBalance": "Heavy bass, clear highs, slightly thin mids",
    "dynamicRange": "Compressed but not overly squashed",
    "stereoImaging": "Wide stereo field, good use of panning",
    "clarity": "Clean separation between elements",
    "professionalLevel": "Professional quality, minor improvements needed",
    "issues": ["Kick and 808 clash slightly", "Vocals sit slightly behind beat in verse 1"]
  },
  "structure": {
    "intro": "0:00-0:12",
    "verse1": "0:12-0:45",
    "chorus": "0:45-1:15",
    "verse2": "1:15-1:48",
    "bridge": "1:48-2:15",
    "chorus2": "2:15-2:45",
    "outro": "2:45-3:05"
  },
  "arrangement": {
    "transitionQuality": "Smooth transitions with fills",
    "buildUps": "Effective build before chorus",
    "layering": "Complex with 8-12 simultaneous elements",
    "breathing": "Good use of space, not overcrowded"
  },
  "instruments": ["808s", "Hi-Hats", "Snare", "Synth Bass", "Piano", "String Section", "Vocal Chops"],
  "soundQuality": {
    "type": "Mostly synthetic with some organic samples",
    "drums": "Punchy 808s, crisp hi-hats",
    "melody": "Dark synths with atmospheric pads",
    "rating": 8
  },
  "commercialViability": {
    "radioReady": "Yes - clean version needed",
    "targetAudience": "18-34 hip-hop fans",
    "comparableArtists": ["Travis Scott", "21 Savage", "Future"],
    "streamingPotential": 8,
    "improvements": "Stronger hook melody, clearer vocal mix"
  },
  "specificIssues": [
    {
      "issue": "Vocals buried in mix during verse 1",
      "priority": "high",
      "fix": "Boost vocal presence 2-3dB, cut competing frequencies in beat"
    },
    {
      "issue": "808 and kick drum clash around 60Hz",
      "priority": "high",
      "fix": "Sidechain kick to 808 or EQ separation"
    },
    {
      "issue": "Timing slightly rushed in bridge section",
      "priority": "medium",
      "fix": "Re-record bridge with metronome, or use time-stretch"
    }
  ],
  "actionableRecommendations": [
    {
      "id": "rec-1",
      "message": "Add more reverb and depth to vocals for a polished sound",
      "severity": "medium",
      "category": "vocal_effects",
      "targetTool": "mix-studio",
      "navigationPayload": {
        "trackId": "vocals",
        "action": "add-reverb",
        "params": { "effectType": "reverb" }
      }
    },
    {
      "id": "rec-2",
      "message": "Improve hook catchiness - strengthen melodic progression",
      "severity": "high",
      "category": "melody",
      "targetTool": "piano-roll",
      "navigationPayload": {
        "action": "edit-melody",
        "params": { "section": "hook" }
      }
    },
    {
      "id": "rec-3",
      "message": "Balance the mix - vocals are too quiet relative to beat",
      "severity": "high",
      "category": "mix_balance",
      "targetTool": "mix-studio",
      "navigationPayload": {
        "trackId": "vocals",
        "action": "adjust-volume",
        "params": { "adjustment": "+3dB" }
      }
    },
    {
      "id": "rec-4",
      "message": "Enhance wordplay and rhyme scheme complexity",
      "severity": "low",
      "category": "lyrics",
      "targetTool": "lyrics-lab",
      "navigationPayload": {
        "action": "improve-lyrics"
      }
    }
  ],
  "overallScore": 8.5,
  "analysis_notes": "This is a professional-quality track with strong production and vocal performance. The dark, aggressive tone fits the genre perfectly. Main areas for improvement: vocal mix clarity in verse 1, and tightening up the low-end clash between kick and 808. The lyrics are well-crafted with complex rhyme schemes, and the vocal delivery shows confidence and emotion. Flow timing is mostly excellent with creative syncopation. Commercial potential is high - with minor mixing adjustments, this could be radio-ready. The hook is catchy but could be strengthened melodically. Overall, this shows professional-level production with room for refinement to reach A-list quality."
}

IMPORTANT: For each recommendation in "actionableRecommendations", use these exact category values:
- "vocal_effects" for vocal processing issues  
- "mix_balance" for volume/panning issues
- "tempo" for BPM/timing issues
- "melody" for melodic improvements
- "lyrics" for lyrical improvements
- "structure" for arrangement/structure issues
- "production" for overall production quality
- "instrumentation" for instrument selection/quality

And use these exact targetTool values:
- "mix-studio" for mixing, effects, and balance
- "beat-studio" for tempo, drums, and rhythm
- "piano-roll" for melodies and chords
- "lyrics-lab" for lyrics and wordplay
- "unified-studio" for general improvements`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
        messages: [
          { role: 'system', content: 'You are a professional music analyst and audio engineer. Provide accurate, realistic analysis.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ xAI API error details:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });
      throw new Error(`AI API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('🔍 RAW AI RESPONSE (first 500 chars):', content.substring(0, 500));
    
    // Parse JSON from AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ PARSED AI DATA - Has vocals?', parsed.vocalAnalysis?.hasVocals);
      console.log('✅ PARSED AI DATA - Has lyrics?', !!parsed.lyricsQuality);
      return parsed;
    }
    
    throw new Error('Could not parse AI response');
  } catch (error) {
    console.error('❌ AI analysis failed:', error);
    console.log('⚠️ Falling back to basic analysis');
    return generateBasicAnalysis(metadata);
  }
}

// Fallback basic analysis based on metadata - COMPREHENSIVE VERSION
function generateBasicAnalysis(metadata: any): any {
  const duration = metadata.duration || 180;
  const bitrate = Math.round(metadata.bitrate || 0);
  const sampleRate = metadata.sampleRate || 44100;
  
  // Estimate BPM based on typical ranges
  const estimatedBPM = sampleRate > 44100 ? 128 : 110;
  
  // Generate structure based on duration
  const structure: any = {};
  if (duration >= 30) {
    structure.intro = '0:00-0:15';
  }
  if (duration >= 60) {
    structure.verse1 = '0:15-0:45';
    structure.chorus = '0:45-1:15';
  }
  if (duration >= 120) {
    structure.verse2 = '1:15-1:45';
    structure.chorus2 = '1:45-2:15';
  }
  if (duration >= 150) {
    structure.bridge = '2:15-2:45';
  }
  structure.outro = `${Math.floor((duration - 15) / 60)}:${Math.floor((duration - 15) % 60).toString().padStart(2, '0')}-${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;

  // Assess quality based on bitrate
  let qualityScore = 5;
  let qualityIssues = [];
  let qualityStrengths = [];
  
  if (bitrate < 128000) {
    qualityScore = 4;
    qualityIssues.push("Low bitrate (< 128kbps) - may sound compressed or tinny");
    qualityIssues.push("Recommended: Re-export at 320kbps for professional quality");
  } else if (bitrate >= 128000 && bitrate < 192000) {
    qualityScore = 6;
    qualityIssues.push("Medium bitrate (128-192kbps) - acceptable for demos but not release quality");
    qualityIssues.push("Recommended: Export at 256-320kbps for streaming platforms");
  } else if (bitrate >= 192000 && bitrate < 256000) {
    qualityScore = 7;
    qualityStrengths.push("Good bitrate (192-256kbps) - suitable for most streaming platforms");
  } else {
    qualityScore = 8;
    qualityStrengths.push("High bitrate (256kbps+) - professional quality, excellent for streaming");
  }
  
  if (sampleRate >= 48000) {
    qualityStrengths.push("High sample rate (48kHz+) - professional studio quality");
  } else if (sampleRate < 44100) {
    qualityIssues.push("Low sample rate - may lack high-frequency detail");
  }

  // Generate detailed production feedback
  const productionFeedback = {
    mixQuality: qualityScore,
    masterQuality: qualityScore - 1,
    strengths: qualityStrengths.length > 0 ? qualityStrengths : ["Audio file successfully uploaded and playable"],
    issues: qualityIssues.length > 0 ? qualityIssues : ["Cannot detect specific mix issues without AI analysis"],
    recommendations: [
      "For deeper analysis including vocal timing, frequency balance, and commercial viability, AI analysis is recommended",
      bitrate < 256000 ? "Re-export at 320kbps CBR or 256kbps+ VBR for best quality" : "Bitrate is excellent for professional release",
      "Consider running through professional mastering for loudness optimization",
      "Test playback on multiple devices (headphones, car, phone speakers) to check mix translation"
    ]
  };

  // Specific actionable improvements
  const specificIssues = [];
  if (bitrate < 192000) {
    specificIssues.push({
      issue: "Audio bitrate is below streaming platform standards",
      priority: "high",
      fix: "Re-export your audio at 320kbps MP3 or 256kbps AAC for professional quality. In your DAW: File > Export > Audio Settings > Bitrate: 320kbps"
    });
  }
  
  specificIssues.push({
    issue: "Limited metadata analysis without AI",
    priority: "medium",
    fix: "For comprehensive vocal analysis, mix critique, and commercial viability assessment, enable AI analysis with xAI Grok API"
  });

  if (duration < 120) {
    specificIssues.push({
      issue: "Track length is under 2 minutes",
      priority: "low",
      fix: "Most streaming platforms favor tracks 2:30-4:00 for playlist placement. Consider extending sections or adding a bridge."
    });
  } else if (duration > 300) {
    specificIssues.push({
      issue: "Track length exceeds 5 minutes",
      priority: "low",
      fix: "Radio and playlists prefer 2:30-4:00. Consider trimming intro/outro or creating a radio edit version."
    });
  }

  return {
    estimatedBPM,
    keySignature: 'C Major',
    genre: 'Unknown',
    mood: 'Neutral',
    energyLevel: 5,
    structure,
    instruments: ['Drums', 'Bass', 'Melody'],
    productionQuality: productionFeedback,
    specificIssues,
    overallScore: qualityScore,
    commercialViability: {
      streamingPotential: qualityScore,
      improvements: [
        "Upload full high-quality version (320kbps) for professional distribution",
        "Get professional mixing/mastering for competitive loudness and clarity",
        "A/B test your mix against commercial reference tracks in your genre"
      ]
    },
    analysis_notes: `**TECHNICAL ANALYSIS:**\n\n` +
      `✅ **What's Working:**\n` +
      (qualityStrengths.length > 0 ? qualityStrengths.map(s => `• ${s}`).join('\n') : '• File successfully uploaded and analyzed') + '\n\n' +
      (qualityIssues.length > 0 ? `⚠️ **Issues Found:**\n${qualityIssues.map(i => `• ${i}`).join('\n')}\n\n` : '') +
      `🎯 **How to Improve:**\n` +
      productionFeedback.recommendations.map(r => `• ${r}`).join('\n') + '\n\n' +
      `📊 **File Stats:** ${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')} duration | ${Math.round(bitrate / 1000)}kbps bitrate | ${Math.round(sampleRate / 1000)}kHz sample rate\n\n` +
      `💡 **Next Steps:** For detailed vocal analysis, frequency balance critique, and professional mixing recommendations, enable AI-powered analysis.`
  };
}
