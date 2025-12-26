import { Router, Request, Response } from 'express';
import { unifiedMusicService } from '../services/unifiedMusicService';
import { makeAICall } from '../services/grok';

const router = Router();

// Generate Lyrics Text
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { theme, genre, mood, complexity } = req.body;
    
    if (!theme) return res.status(400).json({ error: "Theme is required" });

    const response = await makeAICall([
      {
        role: "system",
        content: `You are a professional songwriter. Write complete song lyrics.`
      },
      {
        role: "user",
        content: `Write ${genre} lyrics about "${theme}" with a ${mood} mood. Complexity: ${complexity || 5}/10. Include [Verse], [Chorus] tags.`
      }
    ], { temperature: 0.8 });

    res.json({ content: response.choices[0].message.content });
  } catch (error: any) {
    console.error('Lyrics generation error:', error);
    res.status(500).json({ error: 'Failed to generate lyrics' });
  }
});

// Get Rhymes
router.post('/rhymes', async (req: Request, res: Response) => {
  try {
    const { word } = req.body;
    if (!word) return res.status(400).json({ error: "Word required" });

    const response = await makeAICall([
      {
        role: "system",
        content: `Return JSON object with 'rhymes': string[]`
      },
      { role: "user", content: `Rhymes for "${word}"` }
    ], { response_format: { type: "json_object" } });

    const data = JSON.parse(response.choices[0].message.content || "{}");
    res.json({ rhymes: data.rhymes || [] });
  } catch (error) {
    res.json({ rhymes: [] }); // Fail gracefully
  }
});

// Generate Music from Lyrics (Audio)
router.post('/generate-music', async (req: Request, res: Response) => {
  try {
    const { lyrics, genre, mood, title } = req.body;
    
    if (!lyrics) return res.status(400).json({ error: "Lyrics required" });

    console.log('🎵 Lyric Lab: Generating music from lyrics...');
    
    // Use UnifiedMusicService (Suno/Bark for full song or MusicGen for backing)
    // Assuming we want a full song structure if lyrics are provided
    const result = await unifiedMusicService.generateFullSong(
      `Song based on lyrics: ${lyrics.substring(0, 100)}...`,
      {
        genre: genre || 'pop',
        mood: mood || 'emotional',
        duration: 30, // Preview length
        vocals: true
      }
    );

    res.json({
      success: true,
      title: title || 'Generated Song',
      audioUrl: result.audio_url || result.audioUrl, // Handle variation in response
      genre,
      mood
    });

  } catch (error: any) {
    console.error('Lyric music generation error:', error);
    res.status(500).json({ error: 'Failed to generate music' });
  }
});

// Generate Beat from Lyrics - Uses Astutely-style AI generation for consistency
router.post('/generate-beat', async (req: Request, res: Response) => {
  try {
    const { lyrics, genre } = req.body;
    
    console.log(`🎵 Lyric Lab: Generating beat pattern for genre: ${genre}`);
    
    // Use same AI approach as Astutely for consistent MIDI output
    const response = await makeAICall([
      {
        role: "system",
        content: `You are a music producer. Analyze the lyrics mood and generate a matching beat pattern.
Return ONLY valid JSON:
{
  "style": "${genre || 'pop'}",
  "bpm": 120,
  "key": "C Minor",
  "drums": [{"step": 0, "type": "kick"}, {"step": 4, "type": "snare"}],
  "bass": [{"step": 0, "note": 36, "duration": 2}],
  "chords": [{"step": 0, "notes": [60, 63, 67], "duration": 16}],
  "melody": [{"step": 0, "note": 72, "duration": 1}]
}
Match the beat to the lyrics mood. Use 64 steps (4 bars).`
      },
      { 
        role: "user", 
        content: `Create a ${genre || 'pop'} beat for these lyrics: "${(lyrics || '').substring(0, 100)}..."` 
      }
    ], {
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const content = response.choices?.[0]?.message?.content || '{}';
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      // Fallback pattern
      result = {
        style: genre || 'pop',
        bpm: 120,
        key: "C Major",
        drums: [
          { step: 0, type: "kick" }, { step: 4, type: "snare" },
          { step: 8, type: "kick" }, { step: 12, type: "snare" }
        ],
        bass: [{ step: 0, note: 36, duration: 4 }],
        chords: [{ step: 0, notes: [60, 64, 67], duration: 16 }],
        melody: [],
        isFallback: true
      };
    }

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate beat' });
  }
});

// Analyze Lyrics
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { lyrics } = req.body;
    const response = await makeAICall([
      { role: "system", content: "Analyze lyrics. Return JSON with 'sentiment', 'themes', 'suggestions'." },
      { role: "user", content: `Analyze: ${lyrics}` }
    ], { response_format: { type: "json_object" } });
    
    const analysis = JSON.parse(response.choices[0].message.content || "{}");
    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

export function createLyricsRoutes() {
  return router;
}
