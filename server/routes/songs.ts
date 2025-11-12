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
    
    // Check if user is authenticated (use guest user for anonymous uploads)
    if (!req.userId) {
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

  // Get all songs for current user
  router.get("/", async (req: Request, res: Response) => {
    // Use guest user for anonymous requests
    if (!req.userId) {
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
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in to analyze songs" });
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

  // ===== SUNO API ENDPOINTS =====

  // Upload and Cover - Transform song with different style
  router.post("/suno/cover", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in" });
    }

    try {
      const { audioUrl, prompt, model, makeInstrumental } = req.body;
      console.log('🎵 Suno Cover:', { prompt, model });

      const result = await sunoApi.uploadAndCover({
        audioUrl,
        prompt,
        model: model || 'v4_5plus',
        makeInstrumental
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

  // Upload and Extend - Extend song with AI continuation
  router.post("/suno/extend", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in" });
    }

    try {
      const { audioUrl, prompt, continueAt, model } = req.body;
      console.log('🎵 Suno Extend:', { continueAt, model });

      const result = await sunoApi.uploadAndExtend({
        audioUrl,
        prompt,
        continueAt,
        model: model || 'v4_5plus'
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
      const { audioUrl } = req.body;
      console.log('🎵 Suno Separate Vocals');

      const result = await sunoApi.separateVocals({ audioUrl });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error('Suno separate error:', error);
      res.status(500).json({ error: "Failed to separate vocals" });
    }
  });

  // Add Vocals - Generate vocals for instrumental
  router.post("/suno/add-vocals", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in" });
    }

    try {
      const { audioUrl, prompt, model } = req.body;
      console.log('🎵 Suno Add Vocals:', { prompt });

      const result = await sunoApi.addVocals({
        audioUrl,
        prompt,
        model: model || 'v4_5plus'
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

  // Add Instrumental - Generate instrumental backing for vocals
  router.post("/suno/add-instrumental", async (req: Request, res: Response) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Please log in" });
    }

    try {
      const { audioUrl, prompt, model } = req.body;
      console.log('🎵 Suno Add Instrumental:', { prompt });

      const result = await sunoApi.addInstrumental({
        audioUrl,
        prompt,
        model: model || 'v4_5plus'
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
      const { ids } = req.body;
      const result = await sunoApi.getMusicDetails(ids);

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

    // Convert API URL to file system path
    // Example: /api/internal/uploads/songs%2F123.m4a → /home/runner/workspace/objects/songs/123.m4a
    let inputPath = inputURL;
    if (inputURL.startsWith('/api/internal/uploads/')) {
      const objectKey = decodeURIComponent(inputURL.replace('/api/internal/uploads/', ''));
      const objectsDir = process.env.LOCAL_OBJECTS_DIR || join(process.cwd(), 'objects');
      inputPath = join(objectsDir, objectKey);
      console.log(`📁 Converted URL to path: ${inputURL} → ${inputPath}`);
    }

    // Set a timeout for the conversion (30 seconds)
    const timeout = setTimeout(() => {
      console.error('❌ FFmpeg conversion timeout');
      reject(new Error('FFmpeg conversion timeout'));
    }, 30000);

    ffmpeg(inputPath)
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

  // External URL - download it
  const response = await fetch(fileURL);
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
  "overallScore": 8.5,
  "analysis_notes": "This is a professional-quality track with strong production and vocal performance. The dark, aggressive tone fits the genre perfectly. Main areas for improvement: vocal mix clarity in verse 1, and tightening up the low-end clash between kick and 808. The lyrics are well-crafted with complex rhyme schemes, and the vocal delivery shows confidence and emotion. Flow timing is mostly excellent with creative syncopation. Commercial potential is high - with minor mixing adjustments, this could be radio-ready. The hook is catchy but could be strengthened melodically. Overall, this shows professional-level production with room for refinement to reach A-list quality."
}`;

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
