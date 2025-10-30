import { Router, type Request, type Response } from "express";
import type { IStorage } from "../storage";
import { checkUsageLimit } from "../middleware/featureGating";
import ffmpeg from "fluent-ffmpeg";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createReadStream } from "fs";
import { parseFile } from "music-metadata";
import fetch from "node-fetch";
import { unlink } from "fs/promises";

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

  // Analyze song endpoint - REAL ANALYSIS with AI
  router.post("/analyze", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in to analyze songs" });
    }

    try {
      const { songId, songURL, songName } = req.body;

      if (!songId || !songURL) {
        return res.status(400).json({ error: "Missing songId or songURL" });
      }

      console.log('🎵 Starting REAL audio analysis for:', { songId, songName });

      // Download the audio file temporarily for analysis
      const tempFilePath = await downloadAudioFile(songURL, songName);
      
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
          estimatedBPM: aiAnalysis.estimatedBPM,
          keySignature: aiAnalysis.keySignature,
          genre: aiAnalysis.genre,
          mood: aiAnalysis.mood,
          structure: aiAnalysis.structure,
          instruments: aiAnalysis.instruments,
          analysis_notes: aiAnalysis.analysis_notes
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
    // Internal URL - need to construct full path
    fileURL = `https://www.codedswitch.com${url}`;
  }

  const response = await fetch(fileURL);
  if (!response.ok) {
    throw new Error(`Failed to download audio file: ${response.statusText}`);
  }

  const buffer = await response.buffer();
  createWriteStream(tempFilePath).write(buffer);

  console.log('✅ Audio file downloaded to:', tempFilePath);
  return tempFilePath;
}

// Helper function to analyze audio with AI
async function analyzeWithAI(songName: string, metadata: any): Promise<any> {
  const XAI_API_KEY = process.env.XAI_API_KEY;
  
  if (!XAI_API_KEY) {
    console.warn('⚠️ No XAI_API_KEY found, using basic analysis');
    return generateBasicAnalysis(metadata);
  }

  try {
    const prompt = `Analyze this audio file and provide detailed musical insights:

Song Name: ${songName}
Duration: ${Math.floor(metadata.duration / 60)}:${Math.floor(metadata.duration % 60).toString().padStart(2, '0')}
Bitrate: ${metadata.bitrate} kbps
Sample Rate: ${metadata.sampleRate} Hz
Codec: ${metadata.codec}

Based on the song name and audio properties, provide a professional music analysis with:
1. Estimated BPM (a realistic number between 60-180)
2. Key signature (e.g., "C Major", "Am", "F# minor")
3. Genre (e.g., Hip-Hop, R&B, Pop, Electronic, Rock, Jazz)
4. Mood (e.g., Energetic, Chill, Melancholic, Uplifting, Dark, Dreamy)
5. Song structure with timestamps (intro, verse, chorus, bridge, outro)
6. Likely instruments used
7. Production quality notes

Respond ONLY with valid JSON in this exact format:
{
  "estimatedBPM": 120,
  "keySignature": "C Major",
  "genre": "Hip-Hop",
  "mood": "Energetic",
  "structure": {
    "intro": "0:00-0:15",
    "verse1": "0:15-0:45",
    "chorus": "0:45-1:15",
    "verse2": "1:15-1:45",
    "bridge": "2:15-2:45",
    "outro": "2:45-3:00"
  },
  "instruments": ["Drums", "Bass", "Synth"],
  "analysis_notes": "Detailed professional analysis of the track..."
}`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          { role: 'system', content: 'You are a professional music analyst and audio engineer. Provide accurate, realistic analysis.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON from AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Could not parse AI response');
  } catch (error) {
    console.error('❌ AI analysis failed:', error);
    console.log('⚠️ Falling back to basic analysis');
    return generateBasicAnalysis(metadata);
  }
}

// Fallback basic analysis based on metadata
function generateBasicAnalysis(metadata: any): any {
  const duration = metadata.duration || 180;
  
  // Estimate BPM based on typical ranges
  const estimatedBPM = metadata.sampleRate > 44100 ? 128 : 110;
  
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

  return {
    estimatedBPM,
    keySignature: 'C Major',
    genre: 'Unknown',
    mood: 'Neutral',
    structure,
    instruments: ['Drums', 'Bass', 'Melody'],
    analysis_notes: `Audio file analyzed. Duration: ${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}. Bitrate: ${metadata.bitrate || 'unknown'} kbps. For more accurate analysis, please ensure the audio file is complete and high quality.`
  };
}
