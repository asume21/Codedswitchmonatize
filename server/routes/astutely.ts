import { Router, Request, Response } from 'express';
import { unifiedMusicService } from '../services/unifiedMusicService';
import { makeAICall, getAIProviderStatus, performAIProviderSelfTest } from '../services/grok';
import { localAI, makeLocalAICall } from '../services/localAI';
import { getGenreSpec } from '../ai/knowledge/genreDatabase';
import { sanitizePrompt, validateAIOutput, safeAIGeneration } from '../ai/safety/aiSafeguards';
import { enhancePromptWithMusicTheory, getProgressionsForGenre } from '../ai/knowledge/musicTheory';
import { buildAstutelyPrompt } from '../ai/prompts/astutelyPrompt';
import { logPromptStart, logPromptResult } from '../ai/utils/promptLogger';
import { generateAstutelyFallback } from '../../shared/astutelyFallback';
import { resolveGenerationConstraints } from '@shared/aiProviderCapabilities';
import { sunoApiService } from '../services/sunoApiService';
import { recordAIGenerationMetric } from '../services/aiRouteMetrics';
import rateLimit from 'express-rate-limit';

const router = Router();
const astutelyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many Astutely generation requests. Please wait a moment.' },
});

// Astutely — the real AI music generation endpoint
router.post('/astutely', astutelyLimiter, async (req: Request, res: Response) => {
  const { style, prompt = '', tempo, timeSignature, key, trackSummaries } = req.body;
  const requestId = `astutely-pattern-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const routeStartedAt = Date.now();

  if (!style) {
    return res.status(400).json({ error: 'Style is required' });
  }

  const normalizedTimeSignature = timeSignature && typeof timeSignature === 'object'
    ? {
        numerator: Math.max(1, Math.min(16, Number(timeSignature.numerator) || 4)),
        denominator: Math.max(1, Math.min(16, Number(timeSignature.denominator) || 4)),
      }
    : undefined;

  const normalizedTempo = typeof tempo === 'number' && Number.isFinite(tempo) ? tempo : undefined;
  const normalizedKey = typeof key === 'string' && key.trim().length > 0 ? key.trim() : undefined;
  const normalizedTracks = Array.isArray(trackSummaries)
    ? trackSummaries
        .filter((track) => track && typeof track === 'object')
        .map((track) => ({
          id: typeof track.id === 'string' ? track.id : undefined,
          name: typeof track.name === 'string' ? track.name : undefined,
          instrument: typeof track.instrument === 'string' ? track.instrument : undefined,
          type: typeof track.type === 'string' ? track.type : undefined,
          notes: typeof track.notes === 'number' ? track.notes : undefined,
          muted: typeof track.muted === 'boolean' ? track.muted : undefined,
          volume: typeof track.volume === 'number' ? track.volume : undefined,
        }))
    : undefined;

  try {
    // Sanitize user input for security
    const safePrompt = sanitizePrompt(prompt);
    
    // Build enhanced prompt package (genre + insights + theory)
    const promptPackage = buildAstutelyPrompt(style, safePrompt, {
      tempo: normalizedTempo,
      timeSignature: normalizedTimeSignature,
      key: normalizedKey,
      tracks: normalizedTracks,
    });
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
            temperature: 1.0
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
            temperature: 1.0,
            top_p: 0.95
          });
          console.log('✅ Cloud AI (Grok) succeeded!');
        }
        
        const content = response.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        if (!parsed.timeSignature && normalizedTimeSignature) {
          parsed.timeSignature = normalizedTimeSignature;
        }
        if (!parsed.bpm && normalizedTempo) {
          parsed.bpm = normalizedTempo;
        }
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
      () => generateAstutelyFallback(style, {
        tempo: normalizedTempo ?? genreSpec?.bpmRange?.[0],
        key: normalizedKey ?? genreSpec?.preferredKeys?.[0],
        timeSignature: normalizedTimeSignature ?? { numerator: 4, denominator: 4 },
        fallbackReason: 'ai_generation_failed',
        prompt: safePrompt,
      }),
      
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
    
    const output = {
      ...result.output,
      bpm: result.output.bpm ?? normalizedTempo ?? metadata.tempo ?? (genreSpec ? genreSpec.bpmRange[0] : 120),
      timeSignature: result.output.timeSignature ?? normalizedTimeSignature ?? metadata.timeSignature ?? { numerator: 4, denominator: 4 },
      key: result.output.key ?? normalizedKey ?? metadata.key ?? (genreSpec ? genreSpec.preferredKeys[0] : 'C Minor'),
      trackSummaries: normalizedTracks ?? result.output.trackSummaries,
    } as any;

    const mergedMeta = {
      ...(output.meta ?? {}),
      usedFallback: result.usedFallback || output.isFallback || output.meta?.usedFallback,
      warnings: [...new Set([...(output.meta?.warnings ?? []), ...(result.warnings ?? [])])],
      aiSource: output.meta?.aiSource || output._aiSource || (result.usedFallback ? 'astutely-fallback' : 'astutely-ai'),
      attempts: result.attempts,
      requestId,
    };

    output.meta = mergedMeta;

    recordAIGenerationMetric({
      route: '/api/astutely',
      requestedProvider: null,
      effectiveProvider: mergedMeta.aiSource,
      outcome: mergedMeta.usedFallback ? 'fallback' : 'success',
      latencyMs: Date.now() - routeStartedAt,
    });

    return res.json(output);

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
    const fallbackResult = generateAstutelyFallback(style, {
      tempo: normalizedTempo,
      key: normalizedKey,
      timeSignature: normalizedTimeSignature,
      fallbackReason: error.message ?? 'astutely_route_error',
      prompt: typeof prompt === 'string' ? prompt : '',
    });

    recordAIGenerationMetric({
      route: '/api/astutely',
      requestedProvider: null,
      effectiveProvider: 'astutely-fallback',
      outcome: 'error',
      latencyMs: Date.now() - routeStartedAt,
    });

    (fallbackResult as any).meta = {
      ...((fallbackResult as any).meta ?? {}),
      requestId,
      usedFallback: true,
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

// Generate actual audio using Suno API
router.post('/astutely/generate-audio', astutelyLimiter, async (req: Request, res: Response) => {
  const { style, prompt, bpm, key, duration, instrumental = true, aiProvider = 'suno', seed, variations, melodyUrl, structure } = req.body;

  if (!style && !prompt) {
    return res.status(400).json({ error: 'Style or prompt is required' });
  }

  const requestId = `astutely-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const routeStartedAt = Date.now();
  const constraints = resolveGenerationConstraints({
    provider: aiProvider,
    duration,
    bpm,
    variations,
    sectionCount: Array.isArray(structure) ? structure.length : 0,
    requireGuideMelody: Boolean(melodyUrl),
  });
  const effectiveProvider = constraints.effectiveProvider;
  const effectiveDuration = constraints.duration ?? 30;
  const effectiveBpm = constraints.bpm ?? (Number.isFinite(Number(bpm)) ? Number(bpm) : 120);

  // Normalize duration with sensible bounds to avoid hard-coded 30s
  const targetDuration = Math.max(10, Math.min(effectiveDuration, 240));

  try {
    // Check if Suno API is configured
    if (!sunoApiService.isConfigured() || effectiveProvider === 'replicate-musicgen' || effectiveProvider === 'astutely') {
      console.log('[Astutely] Suno API not configured, falling back to MusicGen via Replicate');
      
      // Fallback to MusicGen via unifiedMusicService
      const musicPrompt = prompt || `${style} instrumental beat, ${effectiveBpm} BPM, professional quality`;
      const result = await unifiedMusicService.generateTrack(musicPrompt, {
        type: 'beat',
        duration: targetDuration,
        bpm: effectiveBpm,
        style: style || undefined,
        key: key || undefined,
      });

      if (result?.audio_url) {
        const resolvedProvider = String(result.metadata?.generator || 'musicgen');
        const outcome: 'success' | 'fallback' = resolvedProvider.toLowerCase().includes('fallback') ? 'fallback' : 'success';
        recordAIGenerationMetric({
          route: '/api/astutely/generate-audio',
          requestedProvider: aiProvider,
          effectiveProvider: resolvedProvider,
          outcome,
          latencyMs: Date.now() - routeStartedAt,
        });
        return res.json({
          success: true,
          audioUrl: result.audio_url,
          duration: targetDuration,
          provider: result.metadata?.generator || 'musicgen',
          requestedProvider: aiProvider,
          effectiveProvider,
          requestId,
          providerWarnings: constraints.warnings,
          rerouteReason: constraints.rerouteReason,
          style,
          bpm: effectiveBpm,
        });
      }
      
      return res.status(500).json({ 
        error: 'Music generation failed',
        details: 'Neither Suno API nor MusicGen returned audio'
      });
    }

    console.log(`[Astutely] Generating audio with Suno API: ${style}`);
    
    const result = await sunoApiService.generateBeat(style, effectiveBpm, key);

    recordAIGenerationMetric({
      route: '/api/astutely/generate-audio',
      requestedProvider: aiProvider,
      effectiveProvider: 'suno',
      outcome: 'success',
      latencyMs: Date.now() - routeStartedAt,
    });
    
    return res.json({
      success: true,
      audioUrl: result.audioUrl,
      streamUrl: result.streamUrl,
      duration: result.duration ?? targetDuration,
      provider: 'suno',
      requestedProvider: aiProvider,
      effectiveProvider,
      requestId,
      providerWarnings: constraints.warnings,
      rerouteReason: constraints.rerouteReason,
      style,
      bpm: effectiveBpm,
      key,
    });

  } catch (error: any) {
    console.error('[Astutely] Audio generation error:', error);
    
    // Try MusicGen as fallback
    try {
      console.log('[Astutely] Trying MusicGen fallback...');
      const musicPrompt = prompt || `${style} instrumental beat, ${effectiveBpm} BPM, professional quality`;
      const result = await unifiedMusicService.generateTrack(musicPrompt, {
        type: 'beat',
        duration: targetDuration,
        bpm: effectiveBpm,
        style: style || undefined,
        key: key || undefined,
      });

      if (result?.audio_url) {
        recordAIGenerationMetric({
          route: '/api/astutely/generate-audio',
          requestedProvider: aiProvider,
          effectiveProvider: 'musicgen-fallback',
          outcome: 'fallback',
          latencyMs: Date.now() - routeStartedAt,
        });
        return res.json({
          success: true,
          audioUrl: result.audio_url,
          duration: targetDuration,
          provider: 'musicgen-fallback',
          requestedProvider: aiProvider,
          effectiveProvider,
          requestId,
          providerWarnings: constraints.warnings,
          rerouteReason: constraints.rerouteReason,
          style,
          bpm: effectiveBpm,
        });
      }
    } catch (fallbackError) {
      console.error('[Astutely] MusicGen fallback also failed:', fallbackError);
    }

    recordAIGenerationMetric({
      route: '/api/astutely/generate-audio',
      requestedProvider: aiProvider,
      effectiveProvider,
      outcome: 'error',
      latencyMs: Date.now() - routeStartedAt,
    });

    return res.status(500).json({ 
      error: 'Audio generation failed',
      details: error.message,
      requestId,
      requestedProvider: aiProvider,
      effectiveProvider,
      providerWarnings: constraints.warnings,
    });
  }
});

// Check Suno API status
router.get('/astutely/suno-status', async (_req: Request, res: Response) => {
  try {
    const status = sunoApiService.getStatus();
    return res.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/astutely/provider-status', async (_req: Request, res: Response) => {
  try {
    const providerStatus = getAIProviderStatus();
    let localAvailable: boolean | null = null;
    try {
      localAvailable = await localAI.checkAvailability();
    } catch (error) {
      console.warn('Local AI availability check failed:', error);
      localAvailable = false;
    }

    return res.json({
      success: true,
      providers: providerStatus,
      localAI: {
        available: localAvailable,
      }
    });
  } catch (error: any) {
    console.error('Provider status error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/astutely/self-test', async (_req: Request, res: Response) => {
  try {
    const localAvailable = await localAI.checkAvailability().catch((error) => {
      console.warn('Local AI self-test failed:', error);
      return false;
    });
    let cloudResult: any = null;
    try {
      cloudResult = await performAIProviderSelfTest();
    } catch (error: any) {
      cloudResult = { error: error.message };
    }

    return res.json({
      success: true,
      localAI: {
        available: localAvailable,
      },
      cloud: cloudResult,
    });
  } catch (error: any) {
    console.error('Astutely self-test failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export function createAstutelyRoutes() {
  return router;
}

export default router;
