import { Router, Request, Response } from 'express';
import { unifiedMusicService } from '../services/unifiedMusicService';
import { makeAICall } from '../services/grok';
import { getGenreSpec, getGenresByMood } from '../ai/knowledge/genreDatabase';
import { getProgressionsForGenre, getScalesForMood } from '../ai/knowledge/musicTheory';
import { sanitizePrompt, validateAIOutput, safeAIGeneration } from '../ai/safety/aiSafeguards';

const router = Router();

// Generate Lyrics Text - Enhanced with Genre Database + Music Theory
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { theme, genre, mood, complexity } = req.body;
    
    if (!theme) return res.status(400).json({ error: "Theme is required" });

    // Sanitize input for security
    const safeTheme = sanitizePrompt(theme);
    
    // Get genre specifications for authentic lyrics
    const genreSpec = getGenreSpec(genre || 'pop');
    const progressions = getProgressionsForGenre(genre || 'pop');
    
    // Build enhanced system prompt with genre knowledge
    let systemPrompt = `You are a professional songwriter with deep knowledge of ${genre || 'pop'} music.`;
    
    if (genreSpec) {
      systemPrompt += `

🎯 GENRE SPECIFICATIONS FOR ${genreSpec.name.toUpperCase()}:
- Mood: ${genreSpec.mood}
- Reference Artists: ${genreSpec.referenceArtists.join(', ')}
- Style: Write lyrics that would fit artists like ${genreSpec.referenceArtists[0]}
- Avoid themes/language that don't fit ${genreSpec.name}`;
    }
    
    if (progressions.length > 0) {
      systemPrompt += `

🎼 MUSICAL CONTEXT:
- Common progressions: ${progressions.slice(0, 2).map(p => p.name).join(', ')}
- Mood of progressions: ${progressions[0]?.mood || 'emotional'}
- Write lyrics that flow naturally with these musical structures`;
    }

    systemPrompt += `

Write complete, authentic ${genre || 'pop'} lyrics. Include [Verse], [Chorus], [Bridge] tags.`;

    console.log(`✨ Enhanced Lyrics: Using ${genreSpec?.name || genre} specifications`);

    const response = await makeAICall([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Write ${genre} lyrics about "${safeTheme}" with a ${mood} mood. Complexity: ${complexity || 5}/10.`
      }
    ], { temperature: 0.85 });

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

// Generate Beat from Lyrics - Enhanced with FULL Intelligence System
router.post('/generate-beat', async (req: Request, res: Response) => {
  try {
    const { lyrics, genre } = req.body;
    const safeGenre = genre || 'pop';
    
    // Get genre specifications for authentic beat generation
    const genreSpec = getGenreSpec(safeGenre);
    const progressions = getProgressionsForGenre(safeGenre);
    
    console.log(`🎵 Lyric Lab: Generating beat with FULL intelligence for: ${genreSpec?.name || safeGenre}`);
    
    // Build enhanced system prompt with genre knowledge
    let systemPrompt = `You are an expert music producer. Analyze the lyrics mood and generate a matching beat pattern.`;
    
    if (genreSpec) {
      systemPrompt += `

🎯 GENRE SPECIFICATIONS FOR ${genreSpec.name.toUpperCase()}:
- BPM Range: ${genreSpec.bpmRange[0]}-${genreSpec.bpmRange[1]} (MUST be within this range)
- Preferred Keys: ${genreSpec.preferredKeys.join(', ')}
- Bass Style: ${genreSpec.bassStyle}
- Drum Pattern: ${genreSpec.drumPattern}
- Chord Style: ${genreSpec.chordStyle}
- Mood: ${genreSpec.mood}`;
    }
    
    if (progressions.length > 0) {
      systemPrompt += `

🎼 RECOMMENDED CHORD PROGRESSIONS:
${progressions.slice(0, 2).map(p => `- ${p.name}: ${p.pattern.join(" → ")}`).join('\n')}`;
    }

    systemPrompt += `

Return ONLY valid JSON:
{
  "style": "${safeGenre}",
  "bpm": ${genreSpec?.bpmRange[0] || 120},
  "key": "${genreSpec?.preferredKeys[0] || 'C Minor'}",
  "drums": [{"step": 0, "type": "kick"}, {"step": 4, "type": "snare"}],
  "bass": [{"step": 0, "note": 36, "duration": 2}],
  "chords": [{"step": 0, "notes": [60, 63, 67], "duration": 16}],
  "melody": [{"step": 0, "note": 72, "duration": 1}]
}
Match the beat to the lyrics mood. Use 64 steps (4 bars). Follow genre specifications EXACTLY.`;

    const response = await makeAICall([
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: `Create a ${safeGenre} beat for these lyrics: "${(lyrics || '').substring(0, 100)}..."` 
      }
    ], {
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const content = response.choices?.[0]?.message?.content || '{}';
    let result;
    try {
      result = JSON.parse(content);
      // Validate and sanitize output
      const validation = validateAIOutput(result, safeGenre);
      if (validation.sanitizedOutput) {
        result = validation.sanitizedOutput;
      }
    } catch (e) {
      // Genre-aware fallback pattern
      const fallbackBPM = genreSpec?.bpmRange[0] || 120;
      const fallbackKey = genreSpec?.preferredKeys[0] || "C Major";
      result = {
        style: safeGenre,
        bpm: fallbackBPM,
        key: fallbackKey,
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
