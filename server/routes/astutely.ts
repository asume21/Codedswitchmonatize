import { Router, Request, Response } from 'express';
import { unifiedMusicService } from '../services/unifiedMusicService';
import { makeAICall } from '../services/grok';
import { localAI, makeLocalAICall } from '../services/localAI';
import { getGenreSpec } from '../ai/knowledge/genreDatabase';
import { sanitizePrompt, validateAIOutput, safeAIGeneration } from '../ai/safety/aiSafeguards';
import { enhancePromptWithMusicTheory, getProgressionsForGenre } from '../ai/knowledge/musicTheory';
import { orchestrateRequest, executeApprovedAction } from '../ai/orchestrator/astutelyOrchestrator';
import { SuggestedAction, ProjectState } from '../ai/tools/astutelyTools';

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
    
    // Get genre specifications for enhanced intelligence
    const genreSpec = getGenreSpec(style);
    
    // Build enhanced system prompt with genre knowledge
    let systemPrompt = `You are Astutely, an expert AI music producer with deep knowledge of music theory and production.

Generate a full beat arrangement (drums, bass, chords, melody) that is AUTHENTIC to the genre.`;

    if (genreSpec) {
      console.log(`✨ Enhanced AI: Using ${genreSpec.name} specifications (${genreSpec.bpmRange[0]}-${genreSpec.bpmRange[1]} BPM)`);
      systemPrompt += `

🎯 GENRE SPECIFICATIONS FOR ${genreSpec.name.toUpperCase()}:
- BPM Range: ${genreSpec.bpmRange[0]}-${genreSpec.bpmRange[1]} (MUST be within this range)
- Preferred Keys: ${genreSpec.preferredKeys.join(', ')}
- Bass Style: ${genreSpec.bassStyle}
- Drum Pattern: ${genreSpec.drumPattern}
- Chord Style: ${genreSpec.chordStyle}
- Mood: ${genreSpec.mood}
- Essential Instruments: ${genreSpec.instruments.join(', ')}
- Avoid: ${genreSpec.avoidInstruments.join(', ')}
- Production Tips: ${genreSpec.productionTips.join('. ')}
- Reference Artists: ${genreSpec.referenceArtists.join(', ')}

You MUST follow these specifications exactly to create an authentic ${genreSpec.name} beat.`;
    }

    // Add music theory knowledge
    const progressions = getProgressionsForGenre(style);
    if (progressions.length > 0) {
      console.log(`🎼 Music Theory: Found ${progressions.length} recommended chord progressions for ${style}`);
      systemPrompt += `

🎼 MUSIC THEORY - RECOMMENDED CHORD PROGRESSIONS:`;
      progressions.slice(0, 3).forEach(prog => {
        systemPrompt += `
- ${prog.name}: ${prog.pattern.join(" → ")}
  Mood: ${prog.mood}
  Example: ${prog.examples[0]}`;
      });
      
      systemPrompt += `

Use these proven chord progressions to create musically sophisticated arrangements.
Apply voice leading principles: move by smallest intervals, resolve leading tones, maintain common tones.`;
    }

    systemPrompt += `

Return ONLY valid JSON matching this structure:
{
  "style": "${style}",
  "bpm": 128,
  "key": "C Minor",
  "drums": [{"step": 0, "type": "kick"}, {"step": 4, "type": "snare"}],
  "bass": [{"step": 0, "note": 36, "duration": 2}],
  "chords": [{"step": 0, "notes": [60, 63, 67], "duration": 16}],
  "melody": [{"step": 0, "note": 72, "duration": 1}]
}
Ensure patterns are musical, authentic to the genre, use proper voice leading, and use 64 steps (4 bars).`;

    console.log(`🤖 Astutely generating with FULL intelligence (Genre + Music Theory) for: ${style}`);
    
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
            { role: "user", content: `Generate a ${style} beat. ${safePrompt}` }
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
            { role: "user", content: `Generate a ${style} beat. ${safePrompt}` }
          ], {
            response_format: { type: "json_object" },
            temperature: 0.8
          });
          console.log('✅ Cloud AI (Grok) succeeded!');
        }
        
        const content = response.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        
        // Add metadata about which AI was used
        parsed._aiSource = usedLocal ? 'local' : 'cloud';
        
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
    }
    if (result.warnings.length > 0) {
      console.warn('⚠️ Warnings:', result.warnings);
    }
    
    return res.json(result.output);

  } catch (error: any) {
    console.error('Astutely AI error, using fallback:', error);
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

// ============================================
// AI-FIRST ARCHITECTURE ENDPOINTS
// User-first design: AI suggests, user approves
// ============================================

/**
 * Chat with Astutely - returns suggestions for user to approve
 * POST /api/astutely/chat
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, projectState, conversationHistory } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Default project state if not provided
    const state: ProjectState = projectState || {
      bpm: 120,
      key: 'C Major',
      timeSignature: '4/4',
      isPlaying: false,
      currentPosition: 0,
      tracks: []
    };
    
    const result = await orchestrateRequest({
      message,
      projectState: state,
      conversationHistory: conversationHistory || []
    });
    
    return res.json(result);
  } catch (error: any) {
    console.error('Astutely chat error:', error);
    return res.status(500).json({ 
      error: 'Chat failed', 
      message: error.message,
      success: false 
    });
  }
});

/**
 * Execute an approved action
 * POST /api/astutely/execute
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { action, projectState } = req.body;
    
    if (!action || !action.toolName) {
      return res.status(400).json({ error: 'Action with toolName is required' });
    }
    
    const state: ProjectState = projectState || {
      bpm: 120,
      key: 'C Major',
      timeSignature: '4/4',
      isPlaying: false,
      currentPosition: 0,
      tracks: []
    };
    
    const result = await executeApprovedAction(action as SuggestedAction, state);
    
    return res.json(result);
  } catch (error: any) {
    console.error('Astutely execute error:', error);
    return res.status(500).json({ 
      error: 'Execution failed', 
      message: error.message,
      success: false 
    });
  }
});

/**
 * Get available tools (for UI to show capabilities)
 * GET /api/astutely/tools
 */
router.get('/tools', async (req: Request, res: Response) => {
  const { ASTUTELY_TOOLS } = await import('../ai/tools/astutelyTools');
  
  // Group tools by category
  const toolsByCategory: Record<string, any[]> = {};
  for (const tool of ASTUTELY_TOOLS) {
    if (!toolsByCategory[tool.category]) {
      toolsByCategory[tool.category] = [];
    }
    toolsByCategory[tool.category].push({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    });
  }
  
  return res.json({
    categories: Object.keys(toolsByCategory),
    tools: toolsByCategory,
    totalTools: ASTUTELY_TOOLS.length
  });
});

export function createAstutelyRoutes() {
  return router;
}

export default router;
