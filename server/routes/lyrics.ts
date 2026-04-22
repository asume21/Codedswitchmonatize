import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireCredits } from '../middleware/requireCredits';
import { CREDIT_COSTS } from '../services/credits';
import type { IStorage } from '../storage';
import { unifiedMusicService } from '../services/unifiedMusicService';
import { makeAICall } from '../services/grok';
import { getGenreSpec } from '../ai/knowledge/genreDatabase';
import { getProgressionsForGenre } from '../ai/knowledge/musicTheory';
import { sanitizePrompt, validateAIOutput } from '../ai/safety/aiSafeguards';

// Shared beat fallback — matches router output shape (richer than inline stub format)
function buildBeatFallback(genreKey: string) {
  const genreSpec = getGenreSpec(genreKey);
  return {
    style: genreKey,
    bpm: genreSpec?.bpmRange?.[0] || 120,
    key: genreSpec?.preferredKeys?.[0] || 'C Major',
    drums: [
      { step: 0, type: 'kick' },
      { step: 4, type: 'snare' },
      { step: 8, type: 'kick' },
      { step: 12, type: 'snare' },
    ],
    bass: [{ step: 0, note: 36, duration: 4 }],
    chords: [{ step: 0, notes: [60, 64, 67], duration: 16 }],
    melody: [],
    isFallback: true,
  };
}

function buildAnalysisFallback(lyrics: string) {
  const wordCount = lyrics ? lyrics.split(/\s+/).length : 0;
  return {
    analysis: {
      sentiment: wordCount > 0 ? 'neutral' : 'unknown',
      themes: wordCount > 0 ? ['inspiration', 'ambition'] : [],
      suggestions: [
        'Add more descriptive imagery to strengthen the narrative.',
        'Introduce a contrasting bridge section to keep listeners engaged.',
      ],
      stats: {
        wordCount,
        lineCount: lyrics ? lyrics.split(/\n/).length : 0,
      },
      isFallback: true,
    },
  };
}

export function createLyricsRoutes(storage: IStorage) {
  const router = Router();

  // ── CRUD: save / fetch user lyrics ─────────────────────────────────────────
  // Migrated from server/routes.ts inline handlers (were reachable — no router /
  // handler shadowed them). No credits required for CRUD.

  router.post('/', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { title, content, genre, rhymeScheme } = req.body;

      if (!title || !content) {
        return res.status(400).json({ error: 'Missing required fields: title and content' });
      }

      const newLyric = await storage.createLyrics(req.userId!, {
        title,
        content,
        genre: genre || 'Unknown',
        rhymeScheme: rhymeScheme || 'AABB',
      });

      console.log('✅ Lyrics saved:', title);
      res.json(newLyric);
    } catch (error) {
      console.error('❌ Save lyrics error:', error);
      res.status(500).json({ error: 'Failed to save lyrics' });
    }
  });

  router.get('/', requireAuth(), async (req: Request, res: Response) => {
    try {
      const lyrics = await storage.getUserLyrics(req.userId!);
      res.json(lyrics);
    } catch (error) {
      console.error('❌ Get lyrics error:', error);
      res.status(500).json({ error: 'Failed to fetch lyrics' });
    }
  });

  // ── Paid endpoints — now protected by requireCredits ───────────────────────
  // PRE-FIX: These four paths matched the router below, shadowing the inline
  // handlers at server/routes.ts:4548/4826/4912/5022 that HAD requireCredits.
  // Net effect in production: credit-bypass on rhymes/analyze/generate/generate-beat.
  // POST-FIX: middleware attached here; handlers deduct on success.

  // Generate Lyrics Text — Enhanced with Genre Database + Music Theory
  router.post(
    '/generate',
    requireAuth(),
    requireCredits(CREDIT_COSTS.LYRICS_GENERATION, storage),
    async (req: Request, res: Response) => {
      try {
        const { theme, genre, mood, complexity } = req.body;

        if (!theme) return res.status(400).json({ error: 'Theme is required' });

        const safeTheme = sanitizePrompt(theme);
        const genreSpec = getGenreSpec(genre || 'pop');
        const progressions = getProgressionsForGenre(genre || 'pop');

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
- Common progressions: ${progressions.slice(0, 2).map((p) => p.name).join(', ')}
- Mood of progressions: ${progressions[0]?.mood || 'emotional'}
- Write lyrics that flow naturally with these musical structures`;
        }

        systemPrompt += `

Write complete, authentic ${genre || 'pop'} lyrics. Include [Verse], [Chorus], [Bridge] tags.`;

        console.log(`✨ Enhanced Lyrics: Using ${genreSpec?.name || genre} specifications`);

        const response = await makeAICall(
          [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Write ${genre} lyrics about "${safeTheme}" with a ${mood} mood. Complexity: ${complexity || 5}/10.`,
            },
          ],
          { temperature: 0.85 },
        );

        // Deduct credits only after successful generation
        if (req.creditService && req.creditCost) {
          await req.creditService.deductCredits(
            req.userId!,
            req.creditCost,
            'Lyrics generation',
            { theme, genre, mood },
          );
        }

        res.json({ content: response.choices[0].message.content });
      } catch (error: any) {
        console.error('Lyrics generation error:', error);
        res.status(500).json({ error: 'Failed to generate lyrics' });
      }
    },
  );

  // Get Rhymes
  router.post(
    '/rhymes',
    requireAuth(),
    requireCredits(CREDIT_COSTS.RHYME_SUGGESTIONS, storage),
    async (req: Request, res: Response) => {
      try {
        const { word } = req.body;
        if (!word) return res.status(400).json({ error: 'Word required' });

        const response = await makeAICall(
          [
            {
              role: 'system',
              content: `Return JSON object with 'rhymes': string[]`,
            },
            { role: 'user', content: `Rhymes for "${word}"` },
          ],
          { response_format: { type: 'json_object' } },
        );

        const data = JSON.parse(response.choices[0].message.content || '{}');

        if (req.creditService && req.creditCost) {
          await req.creditService.deductCredits(
            req.userId!,
            req.creditCost,
            'Rhyme suggestions',
            { word },
          );
        }

        res.json({ rhymes: data.rhymes || [] });
      } catch (error) {
        // Fail-soft: no credits deducted (deduct call above only runs on success)
        res.json({ rhymes: [] });
      }
    },
  );

  // Generate Music from Lyrics (Audio)
  // NOTE: no credit gate here historically — preserving existing behavior.
  // If this is revenue-negative, add requireCredits in a follow-up slice.
  router.post('/generate-music', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { lyrics, genre, mood, title } = req.body;

      if (!lyrics) return res.status(400).json({ error: 'Lyrics required' });

      console.log('🎵 Lyric Lab: Generating music from lyrics...');

      const result = await unifiedMusicService.generateFullSong(
        `Song based on lyrics: ${lyrics.substring(0, 100)}...`,
        {
          genre: genre || 'pop',
          mood: mood || 'emotional',
          duration: 30,
          vocals: true,
        },
      );

      res.json({
        success: true,
        title: title || 'Generated Song',
        audioUrl: result.audio_url || result.audioUrl,
        genre,
        mood,
      });
    } catch (error: any) {
      console.error('Lyric music generation error:', error);
      res.status(500).json({ error: 'Failed to generate music' });
    }
  });

  // Generate Beat from Lyrics — Enhanced with FULL Intelligence System
  router.post(
    '/generate-beat',
    requireAuth(),
    requireCredits(CREDIT_COSTS.BEAT_GENERATION, storage),
    async (req: Request, res: Response) => {
      try {
        const { lyrics, genre, complexity } = req.body;
        const safeGenre = genre || 'pop';

        const genreSpec = getGenreSpec(safeGenre);
        const progressions = getProgressionsForGenre(safeGenre);

        console.log(
          `🎵 Lyric Lab: Generating beat with FULL intelligence for: ${genreSpec?.name || safeGenre}`,
        );

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
${progressions.slice(0, 2).map((p) => `- ${p.name}: ${p.pattern.join(' → ')}`).join('\n')}`;
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

        let result;
        let usedFallback = false;
        try {
          const response = await makeAICall(
            [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `Create a ${safeGenre} beat for these lyrics: "${(lyrics || '').substring(0, 100)}..."`,
              },
            ],
            {
              response_format: { type: 'json_object' },
              temperature: 0.7,
            },
          );

          const content = response.choices?.[0]?.message?.content || '{}';
          result = JSON.parse(content);

          const validation = validateAIOutput(result, safeGenre);
          if (validation.sanitizedOutput) {
            result = validation.sanitizedOutput;
          }
        } catch (aiError) {
          console.warn('Beat generation AI unavailable, using fallback:', aiError);
          result = buildBeatFallback(safeGenre);
          usedFallback = true;
        }

        // Deduct credits only if real AI generation succeeded (don't charge for fallback)
        if (!usedFallback && req.creditService && req.creditCost) {
          await req.creditService.deductCredits(
            req.userId!,
            req.creditCost,
            'Beat generation from lyrics',
            { genre: safeGenre, complexity },
          );
        }

        res.json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate beat' });
      }
    },
  );

  // Analyze Lyrics
  router.post(
    '/analyze',
    requireAuth(),
    requireCredits(CREDIT_COSTS.LYRICS_ANALYSIS, storage),
    async (req: Request, res: Response) => {
      try {
        const { lyrics, genre, songId } = req.body;
        if (!lyrics || typeof lyrics !== 'string' || !lyrics.trim()) {
          return res.status(400).json({ error: 'Lyrics are required for analysis' });
        }

        let analysis;
        let usedFallback = false;
        try {
          const response = await makeAICall(
            [
              {
                role: 'system',
                content:
                  "Analyze lyrics. Return JSON with 'sentiment', 'themes', 'suggestions'.",
              },
              { role: 'user', content: `Analyze: ${lyrics}` },
            ],
            { response_format: { type: 'json_object' } },
          );
          analysis = JSON.parse(response.choices[0].message.content || '{}');
        } catch (aiError) {
          console.warn('Lyric analysis AI unavailable, using fallback:', aiError);
          usedFallback = true;
          return res.json(buildAnalysisFallback(lyrics));
        }

        if (songId && req.userId) {
          try {
            await storage.saveLyricsAnalysis(req.userId, {
              songId,
              content: lyrics,
              analysis,
            });
          } catch (persistErr) {
            console.warn('⚠️ Could not persist lyrics analysis:', persistErr);
          }
        }

        if (!usedFallback && req.creditService && req.creditCost) {
          await req.creditService.deductCredits(
            req.userId!,
            req.creditCost,
            'Lyrics analysis',
            { genre },
          );
        }

        res.json({ analysis });
      } catch (error) {
        console.error('Lyric analysis failed:', error);
        res.json(buildAnalysisFallback(req.body?.lyrics || ''));
      }
    },
  );

  return router;
}
