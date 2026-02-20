import { Router, Request, Response } from 'express';
import { unifiedMusicService } from '../services/unifiedMusicService';
import { makeAICall, getAIProviderStatus, performAIProviderSelfTest } from '../services/grok';
import { localAI, makeLocalAICall } from '../services/localAI';
import { getGenreSpec } from '../ai/knowledge/genreDatabase';
import { sanitizePrompt, validateAIOutput } from '../ai/safety/aiSafeguards';
import { enhancePromptWithMusicTheory, getProgressionsForGenre } from '../ai/knowledge/musicTheory';
import { buildAstutelyPrompt } from '../ai/prompts/astutelyPrompt';
import { logPromptStart, logPromptResult } from '../ai/utils/promptLogger';
import { generateAstutelyFallback } from '../../shared/astutelyFallback';
import { resolveGenerationConstraints } from '@shared/aiProviderCapabilities';
import { sunoApiService } from '../services/sunoApiService';
import { recordAIGenerationMetric } from '../services/aiRouteMetrics';
import { astutelyDiagnostics } from '../services/astutelyDiagnostics';
import { extractJSON, mergePartialWithFallback } from '../ai/utils/robustJsonParser';
import { generatePerTrack } from '../ai/strategies/perTrackGeneration';
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
    const safePrompt = sanitizePrompt(prompt);
    const promptPackage = buildAstutelyPrompt(style, safePrompt, {
      tempo: normalizedTempo,
      timeSignature: normalizedTimeSignature,
      key: normalizedKey,
      tracks: normalizedTracks,
    });
    const { systemPrompt, userPrompt, metadata } = promptPackage;
    const genreSpec = getGenreSpec(style);

    console.log(`🤖 Astutely generating for: ${style} (genre: ${metadata.genreName || 'unknown'}, theory: ${metadata.progressionCount} progs)`);
    const promptHash = logPromptStart(systemPrompt, { feature: 'astutely-beat', style });
    const startTime = Date.now();
    const allWarnings: string[] = [];

    // ── Helper: attempt an AI call, extract JSON robustly, validate ──
    async function tryAIProvider(
      providerName: string,
      callFn: () => Promise<any>,
    ): Promise<{ parsed: any; validation: ReturnType<typeof validateAIOutput> } | null> {
      const callStart = Date.now();
      try {
        const response = await callFn();
        const rawContent = response.choices?.[0]?.message?.content || '';

        if (providerName.includes('Local')) {
          astutelyDiagnostics.recordLocalAIAttempt(true, { requestId, durationMs: Date.now() - callStart });
        } else {
          astutelyDiagnostics.recordCloudAIAttempt(true, { requestId, durationMs: Date.now() - callStart });
        }

        // Robust JSON extraction — handles markdown fences, trailing commas, truncated output
        const extracted = extractJSON(rawContent);
        if (!extracted.success) {
          astutelyDiagnostics.recordJSONParseError({
            requestId,
            rawResponse: rawContent,
            error: extracted.warnings.join('; '),
            provider: providerName,
          });
          allWarnings.push(`${providerName}: JSON extraction failed (${extracted.method})`);
          return null;
        }
        if (extracted.warnings.length) {
          allWarnings.push(...extracted.warnings.map(w => `${providerName}: ${w}`));
        }

        const parsed = extracted.data;
        if (!parsed.timeSignature && normalizedTimeSignature) parsed.timeSignature = normalizedTimeSignature;
        if (!parsed.bpm && normalizedTempo) parsed.bpm = normalizedTempo;
        parsed._aiSource = providerName;

        // Validate
        const validation = validateAIOutput(parsed, style);
        if (validation.warnings.length) {
          allWarnings.push(...validation.warnings.map(w => `${providerName} validation: ${w}`));
        }

        if (!validation.isValid) {
          astutelyDiagnostics.recordValidationFailure({
            requestId,
            errors: validation.errors,
            warnings: validation.warnings,
            provider: providerName,
            style,
          });
        }

        return { parsed, validation };
      } catch (err: any) {
        const durationMs = Date.now() - callStart;
        if (providerName.includes('Local')) {
          astutelyDiagnostics.recordLocalAIAttempt(false, { requestId, error: err.message, durationMs });
        } else {
          astutelyDiagnostics.recordCloudAIAttempt(false, { requestId, error: err.message, durationMs });
        }
        allWarnings.push(`${providerName} call failed: ${err.message}`);
        return null;
      }
    }

    // ── COLLABORATION MODEL: Phi3 is the rapper, Grok is the sound engineer ──
    // Phi3 goes first — lays down the raw creative idea (free, fast, local).
    // Then Grok steps in and fills whatever Phi3 couldn't handle (the polish).
    // Together they make the child — the final track.
    let finalOutput: any = null;
    let aiSource = 'astutely-fallback';
    let usedFallback = false;
    const trackFields = ['drums', 'bass', 'chords', 'melody'] as const;
    const trackMinItems: Record<string, number> = { drums: 4, bass: 2, chords: 2, melody: 2 };

    // Step 1: Phi3 creates first (the artist)
    console.log('🎤 Step 1: Phi3 lays down the raw idea...');
    const phi3Result = await tryAIProvider('Phi3 (Local)', () =>
      makeLocalAICall(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        { format: 'json', temperature: 1.0 },
      ),
    );

    // See what Phi3 gave us
    const phi3Data = phi3Result?.parsed || {};
    const phi3Valid = phi3Result?.validation.isValid && phi3Result.validation.sanitizedOutput;
    const phi3Tracks: string[] = [];
    const phi3Missing: string[] = [];

    for (const field of trackFields) {
      const arr = phi3Valid ? (phi3Result!.validation.sanitizedOutput as any)?.[field] : phi3Data[field];
      if (Array.isArray(arr) && arr.length >= trackMinItems[field]) {
        phi3Tracks.push(field);
      } else {
        phi3Missing.push(field);
      }
    }

    if (phi3Valid && phi3Missing.length === 0) {
      // Phi3 nailed it solo — full valid output, no help needed
      finalOutput = phi3Result!.validation.sanitizedOutput;
      aiSource = 'Phi3 (Local) — solo';
      console.log('✅ Phi3 nailed it solo! All 4 tracks valid.');
    } else {
      // Step 2: Grok steps in as the sound engineer — fills what Phi3 missed
      const phi3Got = phi3Tracks.length > 0 ? phi3Tracks.join(', ') : 'nothing usable';
      const phi3Needs = phi3Missing.length > 0 ? phi3Missing.join(', ') : 'nothing';
      console.log(`🎤 Phi3 delivered: [${phi3Got}] — needs help with: [${phi3Needs}]`);
      console.log('🎛️ Step 2: Grok (sound engineer) stepping in to help...');

      const grokResult = await tryAIProvider('Grok-3 (Cloud)', () =>
        makeAICall(
          [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          { response_format: { type: 'json_object' }, temperature: 1.0, top_p: 0.95 },
        ),
      );

      const grokData = grokResult?.parsed || {};
      const grokValid = grokResult?.validation.isValid && grokResult.validation.sanitizedOutput;

      // Now MERGE: Phi3's tracks + Grok's tracks = the child
      const sources: string[] = [];
      const child: any = {
        style,
        bpm: phi3Data.bpm || grokData.bpm,
        key: phi3Data.key || grokData.key,
        timeSignature: phi3Data.timeSignature || grokData.timeSignature,
        instruments: phi3Data.instruments || grokData.instruments,
      };

      const phi3Source = phi3Valid ? phi3Result!.validation.sanitizedOutput : phi3Data;
      const grokSource = grokValid ? grokResult!.validation.sanitizedOutput : grokData;

      for (const field of trackFields) {
        const phi3Arr = (phi3Source as any)?.[field];
        const grokArr = (grokSource as any)?.[field];
        const phi3Len = Array.isArray(phi3Arr) ? phi3Arr.length : 0;
        const grokLen = Array.isArray(grokArr) ? grokArr.length : 0;

        // Phi3 gets priority — it's the artist. Grok only fills gaps.
        if (phi3Len >= trackMinItems[field]) {
          child[field] = phi3Arr;
          sources.push(`${field}:Phi3(${phi3Len})`);
        } else if (grokLen >= trackMinItems[field]) {
          child[field] = grokArr;
          sources.push(`${field}:Grok(${grokLen})`);
        } else if (phi3Len > 0) {
          child[field] = phi3Arr;
          sources.push(`${field}:Phi3(${phi3Len}*)`);
        } else if (grokLen > 0) {
          child[field] = grokArr;
          sources.push(`${field}:Grok(${grokLen}*)`);
        }
      }

      // Fill any remaining gaps with fallback
      const fallback = generateAstutelyFallback(style, {
        tempo: normalizedTempo ?? genreSpec?.bpmRange?.[0],
        key: normalizedKey ?? genreSpec?.preferredKeys?.[0],
        timeSignature: normalizedTimeSignature ?? { numerator: 4, denominator: 4 },
        prompt: safePrompt,
        fallbackReason: 'collab_fill',
      });
      const { merged, filledFields } = mergePartialWithFallback(child, fallback as any);
      finalOutput = merged;

      if (filledFields.length) {
        sources.push(`fallback:[${filledFields.join(',')}]`);
        usedFallback = true;
      }

      const hasPhi3 = sources.some(s => s.includes('Phi3'));
      const hasGrok = sources.some(s => s.includes('Grok'));
      if (hasPhi3 && hasGrok) {
        aiSource = `Astutely Collab [${sources.join(', ')}]`;
      } else if (hasGrok) {
        aiSource = `Grok-3 (Cloud) [${sources.join(', ')}]`;
      } else if (hasPhi3) {
        aiSource = `Phi3 (Local) [${sources.join(', ')}]`;
      } else {
        aiSource = `Fallback [${sources.join(', ')}]`;
        usedFallback = true;
      }

      allWarnings.push(`Collab: ${sources.join(', ')}`);
      console.log(`🎨 The child: ${sources.join(', ')}`);
    }

    // Step 3: Per-track mode if both AIs failed to produce anything usable
    if (!finalOutput) {
      console.log('🎯 Step 3: Per-track mode — one simple track at a time...');
      const effectiveBpm = normalizedTempo ?? genreSpec?.bpmRange?.[0] ?? 120;
      const effectiveKey = normalizedKey ?? genreSpec?.preferredKeys?.[0] ?? 'C';
      const defaultInstruments = { bass: 'electric_bass_finger', chords: 'acoustic_grand_piano', melody: 'flute', drumKit: 'default' };

      try {
        const perTrackResult = await generatePerTrack({
          style,
          bpm: effectiveBpm,
          key: effectiveKey,
          userHint: safePrompt,
          requestId,
          instruments: defaultInstruments,
        });

        if (perTrackResult.tracksFromAI.length > 0) {
          const fallback = generateAstutelyFallback(style, {
            tempo: effectiveBpm,
            key: effectiveKey,
            timeSignature: normalizedTimeSignature ?? { numerator: 4, denominator: 4 },
            prompt: safePrompt,
            fallbackReason: 'per_track_partial',
          });

          const { merged, filledFields } = mergePartialWithFallback(
            {
              drums: perTrackResult.drums,
              bass: perTrackResult.bass,
              chords: perTrackResult.chords,
              melody: perTrackResult.melody,
              bpm: effectiveBpm,
              key: effectiveKey,
              style,
              instruments: perTrackResult.instruments,
            },
            fallback as any,
          );

          finalOutput = merged;
          const aiTracks = perTrackResult.tracksFromAI.join(', ');
          const failedTracks = filledFields.join(', ') || 'none';
          aiSource = `Per-track [${aiTracks}]${filledFields.length ? ` + fallback [${failedTracks}]` : ''}`;
          usedFallback = filledFields.length > 0;
          if (filledFields.length) {
            allWarnings.push(`Per-track: AI [${aiTracks}], fallback [${failedTracks}]`);
          }
        }
      } catch (perTrackErr: any) {
        allWarnings.push(`Per-track failed: ${perTrackErr.message}`);
      }
    }

    // Step 4: Full fallback if absolutely everything failed
    if (!finalOutput) {
      console.log('🛟 Step 4: Full fallback — all strategies exhausted');
      finalOutput = generateAstutelyFallback(style, {
        tempo: normalizedTempo ?? genreSpec?.bpmRange?.[0],
        key: normalizedKey ?? genreSpec?.preferredKeys?.[0],
        timeSignature: normalizedTimeSignature ?? { numerator: 4, denominator: 4 },
        prompt: safePrompt,
        fallbackReason: 'all_ai_failed',
      });
      aiSource = 'astutely-fallback';
      usedFallback = true;
      allWarnings.push('All strategies failed — used full fallback');
    }

    const durationMs = Date.now() - startTime;
    logPromptResult(promptHash, {
      feature: 'astutely-beat',
      style,
      provider: aiSource,
      durationMs,
      warnings: allWarnings,
    });

    // Ensure required fields
    finalOutput.bpm = finalOutput.bpm ?? normalizedTempo ?? metadata.tempo ?? (genreSpec ? genreSpec.bpmRange[0] : 120);
    finalOutput.timeSignature = finalOutput.timeSignature ?? normalizedTimeSignature ?? { numerator: 4, denominator: 4 };
    finalOutput.key = finalOutput.key ?? normalizedKey ?? metadata.key ?? (genreSpec ? genreSpec.preferredKeys[0] : 'C Minor');

    finalOutput.meta = {
      ...(finalOutput.meta ?? {}),
      usedFallback,
      warnings: [...new Set(allWarnings)],
      aiSource,
      requestId,
      durationMs,
    };

    // Record to diagnostics + metrics
    astutelyDiagnostics.recordGeneration({
      requestId,
      style,
      provider: aiSource,
      durationMs,
      usedFallback,
      warnings: allWarnings,
    });

    recordAIGenerationMetric({
      route: '/api/astutely',
      requestedProvider: null,
      effectiveProvider: aiSource,
      outcome: usedFallback ? 'fallback' : 'success',
      latencyMs: Date.now() - routeStartedAt,
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log(`🤖 ASTUTELY RESULT: ${aiSource} (${durationMs}ms, ${usedFallback ? 'FALLBACK' : 'AI'})`);
    if (allWarnings.length) console.log(`⚠️ Warnings: ${allWarnings.join(' | ')}`);
    console.log('═══════════════════════════════════════════════════════');

    return res.json(finalOutput);

  } catch (error: any) {
    const durationMs = Date.now() - routeStartedAt;
    console.error('Astutely route-level error:', error);

    astutelyDiagnostics.recordEndpointMiss({
      endpoint: 'POST /api/astutely',
      error: error.message,
      requestId,
    });

    logPromptResult('unknown', {
      feature: 'astutely-beat',
      style,
      provider: 'error-fallback',
      durationMs,
      warnings: [error.message],
    });

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
      latencyMs: durationMs,
    });

    (fallbackResult as any).meta = {
      ...((fallbackResult as any).meta ?? {}),
      requestId,
      usedFallback: true,
      routeError: error.message,
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

// Astutely self-diagnostics — reports what's happening under the hood
router.get('/astutely/diagnostics', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const errorsOnly = req.query.errors === 'true';

    if (errorsOnly) {
      return res.json({
        success: true,
        errors: astutelyDiagnostics.getRecentErrors(limit),
      });
    }

    return res.json({
      success: true,
      ...astutelyDiagnostics.getSummary(limit),
    });
  } catch (error: any) {
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
