import { Router, Request, Response } from 'express';
import { unifiedMusicService } from '../services/unifiedMusicService';
import { makeAICall } from '../services/grok';
import { localAI, makeLocalAICall } from '../services/localAI';
import { getGenreSpec } from '../ai/knowledge/genreDatabase';
import { sanitizePrompt, validateAIOutput, safeAIGeneration } from '../ai/safety/aiSafeguards';
import { enhancePromptWithMusicTheory, getProgressionsForGenre } from '../ai/knowledge/musicTheory';
import { buildAstutelyPrompt } from '../ai/prompts/astutelyPrompt';
import { logPromptStart, logPromptResult } from '../ai/utils/promptLogger';

const router = Router();

// Astutely — the real AI music generation endpoint
router.post('/astutely', async (req: Request, res: Response) => {
  const { style, prompt = '' } = req.body;

  if (!style) {
    return res.status(400).json({ error: 'Style is required' });
  }

  try {
    // Sanitize user input for security
    const safePrompt = sanitizePrompt(prompt);
    
    // Build enhanced prompt package (genre + insights + theory)
    const promptPackage = buildAstutelyPrompt(style, safePrompt);
    const { systemPrompt, userPrompt, metadata } = promptPackage;
    const genreSpec = getGenreSpec(style);
    const progressions = getProgressionsForGenre(style);

    if (metadata.genreName) {
      console.log(`✨ Enhanced AI: Using ${metadata.genreName} specifications`);
    }
    if (metadata.hasInsights) {
      console.log('🧠 Genre insights attached to prompt');
    }
    if (metadata.progressionCount > 0) {
      console.log(`🎼 Music Theory: Added ${metadata.progressionCount} chord progressions`);
    }

    console.log(`🤖 Astutely generating with FULL intelligence (Genre + Music Theory) for: ${style}`);
    const promptHash = logPromptStart(systemPrompt, { feature: 'astutely-beat', style });
    const startTime = Date.now();
    
    // Use safe AI generation with failsafes
    const result = await safeAIGeneration(
      // AI generation function with local-first, cloud fallback
      async () => {
        let response;
        let usedLocal = false;
        
        // Try local AI first
        try {
          console.log('🖥️ Attempting local AI generation...');
          response = await makeLocalAICall([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ], {
            format: 'json',
            temperature: 0.8
          });
          usedLocal = true;
          console.log('✅ Local AI succeeded!');
        } catch (localError) {
          console.log('⚠️ Local AI failed, falling back to cloud (Grok)...');
          // Fallback to cloud API
          response = await makeAICall([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ], {
            response_format: { type: "json_object" },
            temperature: 0.8
          });
          console.log('✅ Cloud AI (Grok) succeeded!');
        }
        
        const content = response.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        const duration = Date.now() - startTime;
        logPromptResult(promptHash, {
          feature: 'astutely-beat',
          style,
          provider: usedLocal ? 'Phi3 (Local)' : 'Grok-3 (Cloud)',
          durationMs: duration,
        });
        
        // Add metadata about which AI was used
        const aiSource = usedLocal ? 'Phi3 (Local)' : 'Grok-3 (Cloud)';
        parsed._aiSource = aiSource;
        
        // Log prominently which AI was used
        console.log('═══════════════════════════════════════════════════════');
        console.log(`🤖 ASTUTELY AI SOURCE: ${aiSource}`);
        console.log('═══════════════════════════════════════════════════════');
        
        return parsed;
      },
      
      // Validator
      (output) => validateAIOutput(output, style),
      
      // Fallback generator
      () => {
        const fallbackBPM = genreSpec ? genreSpec.bpmRange[0] : 120;
        const fallbackKey = genreSpec ? genreSpec.preferredKeys[0] : "C Minor";
        
        return {
          style,
          bpm: fallbackBPM,
          key: fallbackKey,
          drums: [
            { step: 0, type: "kick" }, { step: 4, type: "snare" },
            { step: 8, type: "kick" }, { step: 12, type: "snare" },
            { step: 16, type: "kick" }, { step: 20, type: "snare" },
            { step: 24, type: "kick" }, { step: 28, type: "snare" },
            { step: 2, type: "hihat" }, { step: 6, type: "hihat" },
            { step: 10, type: "hihat" }, { step: 14, type: "hihat" }
          ],
          bass: [
            { step: 0, note: 36, duration: 4 },
            { step: 16, note: 36, duration: 4 },
            { step: 32, note: 38, duration: 4 },
            { step: 48, note: 36, duration: 4 }
          ],
          chords: [
            { step: 0, notes: [60, 63, 67], duration: 16 },
            { step: 16, notes: [58, 62, 65], duration: 16 },
            { step: 32, notes: [55, 58, 62], duration: 16 },
            { step: 48, notes: [53, 57, 60], duration: 16 }
          ],
          melody: [
            { step: 0, note: 72, duration: 2 },
            { step: 4, note: 74, duration: 2 },
            { step: 8, note: 75, duration: 4 },
            { step: 16, note: 72, duration: 2 }
          ],
          isFallback: true
        };
      },
      
      // Config
      { maxRetries: 3, fallbackEnabled: true }
    );
    
    // Log results
    if (result.usedFallback) {
      console.warn('⚠️ AI generation failed, used fallback');
      logPromptResult(promptHash, {
        feature: 'astutely-beat',
        style,
        provider: 'fallback-template',
        durationMs: Date.now() - startTime,
        warnings: result.warnings,
      });
    }
    if (result.warnings.length > 0) {
      console.warn('⚠️ Warnings:', result.warnings);
    }
    
    return res.json(result.output);

  } catch (error: any) {
    console.error('Astutely AI error, using fallback:', error);
    logPromptResult('unknown', {
      feature: 'astutely-beat',
      style,
      provider: 'error-fallback',
      durationMs: 0,
      warnings: [error.message]
    });
    // Return fallback pattern instead of error - Astutely should always work
    const fallbackResult = {
      style,
      bpm: 120,
      key: "C Minor",
      drums: [
        { step: 0, type: "kick" }, { step: 4, type: "snare" },
        { step: 8, type: "kick" }, { step: 12, type: "snare" },
        { step: 16, type: "kick" }, { step: 20, type: "snare" },
        { step: 24, type: "kick" }, { step: 28, type: "snare" },
        { step: 2, type: "hihat" }, { step: 6, type: "hihat" },
        { step: 10, type: "hihat" }, { step: 14, type: "hihat" }
      ],
      bass: [
        { step: 0, note: 36, duration: 4 },
        { step: 16, note: 36, duration: 4 },
        { step: 32, note: 38, duration: 4 },
        { step: 48, note: 36, duration: 4 }
      ],
      chords: [
        { step: 0, notes: [60, 63, 67], duration: 16 },
        { step: 16, notes: [58, 62, 65], duration: 16 },
        { step: 32, notes: [55, 58, 62], duration: 16 },
        { step: 48, notes: [53, 57, 60], duration: 16 }
      ],
      melody: [
        { step: 0, note: 72, duration: 2 },
        { step: 4, note: 74, duration: 2 },
        { step: 8, note: 75, duration: 4 },
        { step: 16, note: 72, duration: 2 }
      ],
      isFallback: true,
      fallbackReason: error.message
    };
    
    return res.json(fallbackResult);
  }
});

// Check prediction status
router.get('/astutely/status/:predictionId', async (req: Request, res: Response) => {
  return res.json({ 
    success: true, 
    status: 'succeeded', 
    error: null 
  });
});

export function createAstutelyRoutes() {
  return router;
}

export default router;
