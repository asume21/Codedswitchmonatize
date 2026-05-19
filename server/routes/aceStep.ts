/**
 * ACE-Step routes — text-to-music generation
 *
 * GET  /api/ai-music/status          — ACE-Step worker health check
 * POST /api/ai-music/generate        — Ollama/local prompt tags → ACE-Step job
 * GET  /api/ai-music/job/:jobId      — poll job status
 * GET  /api/ai-music/audio/:filename — serve generated WAV
 */

import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { isWorkerReady, submitGeneration, pollJob, AceStepRequest, AceStepTaskType, AceStepTrackName } from '../services/aceStepService'
import { ensureWorkerReady, jobCompleted } from '../services/runpodService'
import { isServerlessConfigured, getServerlessEndpointId } from '../services/runpodServerlessService'
import { localAI } from '../services/localAI'

const OUTPUT_DIR = path.resolve(process.cwd(), 'private', 'ace-step', 'output')
const WORKER_URL = (process.env.ACE_STEP_WORKER_URL || 'http://127.0.0.1:8008').replace(/\/$/, '')

interface AcePromptOptions {
  genre: string
  mood: string
  bpm: number
  section: string
  extraHints?: string
}

const cleanAceTag = (value: unknown) =>
  String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\w\s&'./+-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)

const cleanAcePrompt = (value: unknown) =>
  String(value ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["{}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .split(',')
    .map(cleanAceTag)
    .filter(Boolean)
    .slice(0, 18)
    .join(', ')

// ── Prompt builder — local deterministic ACE-Step style tags ─────────────────
function buildDeterministicAceStepPrompt(opts: AcePromptOptions): string {
  const { genre, mood, bpm, section, extraHints = '' } = opts

  const tagPresets: Record<string, string[]> = {
    trap: ['trap', 'hip-hop', '808 bass', 'heavy kick', 'vinyl hi-hats', 'minor'],
    'boom-bap': ['boom bap', 'hip-hop', 'jazz samples', 'kick snare', 'classic', 'vinyl crackle'],
    'boom bap': ['boom bap', 'hip-hop', 'jazz samples', 'kick snare', 'classic', 'vinyl crackle'],
    drill: ['uk drill', 'hip-hop', 'sliding 808', 'trap hi-hats', 'aggressive', 'cold'],
    'r&b': ['r&b', 'soul', 'smooth', 'warm piano', 'bass guitar', 'lush groove'],
    'r&b-soul': ['r&b', 'soul', 'smooth', 'warm piano', 'bass guitar', 'lush groove'],
    afrobeats: ['afrobeats', 'african percussion', 'upbeat', 'warm bass', 'rhythmic', 'dance'],
    afrobeat: ['afrobeat', 'african percussion', 'upbeat', 'warm bass', 'rhythmic', 'dance'],
    'lo-fi': ['lo-fi hip-hop', 'dusty drums', 'warm keys', 'soft bass', 'laid back'],
    'west-coast': ['west coast hip-hop', 'funk bass', 'laid back', 'bounce', 'clean drums'],
    'dirty-south': ['dirty south hip-hop', '808 bass', 'clap snare', 'anthemic', 'heavy drums'],
    phonk: ['phonk', 'cowbell melody', 'distorted 808', 'dark', 'driving drums'],
    'jersey-club': ['jersey club', 'club kick', 'chopped rhythm', 'high energy', 'dance'],
    bounce: ['bounce', 'new orleans rhythm', 'call and response', 'energetic', 'drums'],
    reggaeton: ['reggaeton', 'dembow rhythm', 'latin percussion', 'warm bass', 'dance'],
    chill: ['chill hip-hop', 'soft drums', 'warm keys', 'smooth bass', 'relaxed'],
    'hip-hop': ['hip-hop', 'punchy drums', 'clean low end', 'wide stereo', 'instrumental'],
  }

  const genreKey = cleanAceTag(genre).toLowerCase()
  const normalizedGenreKey = genreKey.replace(/\s+/g, '-')
  const extraTags = extraHints
    .split(/[,;\n]/)
    .map(cleanAceTag)
    .filter(Boolean)
    .slice(0, 4)

  const tags = [
    ...(tagPresets[genreKey] ?? tagPresets[normalizedGenreKey] ?? [cleanAceTag(genre), 'hip-hop']),
    cleanAceTag(mood),
    `${Number.isFinite(bpm) ? Math.round(bpm) : 90} bpm`,
    cleanAceTag(section),
    'reference-level instrumental beat',
    'professional mix',
    'no vocals',
    ...extraTags,
  ].filter(Boolean)

  return [...new Set(tags)].join(', ')
}

async function buildAceStepPrompt(opts: AcePromptOptions): Promise<string> {
  const deterministicPrompt = buildDeterministicAceStepPrompt(opts)
  const { genre, mood, bpm, section, extraHints = '' } = opts

  try {
    const content = await localAI.chat(
      [
        {
          role: 'system',
          content:
            'You write concise ACE-Step text-to-music prompts. Return only comma-separated prompt tags. ' +
            'No explanation, no JSON, no markdown. Focus on genre, drums, bass, instruments, energy, mix, and mood. ' +
            'Do not include vocals unless the user explicitly asks for vocals.',
        },
        {
          role: 'user',
          content: [
            `Genre: ${genre}`,
            `Mood: ${mood}`,
            `BPM: ${bpm}`,
            `Section: ${section}`,
            extraHints ? `Context: ${extraHints}` : '',
            `Fallback tags to improve: ${deterministicPrompt}`,
          ].filter(Boolean).join('\n'),
        },
      ],
      { temperature: 0.45 },
    )

    const prompt = cleanAcePrompt(content)
    if (prompt.length > 12) {
      console.log('[aceStep] Built ACE prompt with local Ollama')
      return prompt
    }
  } catch (err) {
    console.warn('[aceStep] Local Ollama prompt builder unavailable; using deterministic ACE tags:', err)
  }

  return deterministicPrompt
}

// ── Route factory ─────────────────────────────────────────────────────────────
export function createAceStepRoutes(): Router {
  const router = Router()

  // Worker health
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const ready = await isWorkerReady()
      res.json({
        ready,
        backend: isServerlessConfigured() ? 'runpod-serverless' : 'worker',
        endpointId: getServerlessEndpointId(),
        workerUrl: process.env.ACE_STEP_WORKER_URL ?? 'http://127.0.0.1:8008',
      })
    } catch (err: any) {
      res.json({ ready: false, error: err.message })
    }
  })

  // Submit generation job
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const {
        genre = 'trap',
        mood = 'dark',
        bpm = 90,
        section = 'verse',
        lyrics,
        audioDuration = 30,
        inferStep = 25,
        seed,
        extraHints,
        prompt: rawPrompt,
        taskType,
        trackName,
      } = req.body as {
        genre?: string; mood?: string; bpm?: number; section?: string
        lyrics?: string; audioDuration?: number; inferStep?: number
        seed?: number; extraHints?: string; prompt?: string
        taskType?: AceStepTaskType; trackName?: AceStepTrackName
      }

      if (taskType === 'lego' && !trackName) {
        res.status(400).json({ error: 'trackName is required when taskType is "lego"' })
        return
      }

      const prompt = rawPrompt
        ? rawPrompt
        : await buildAceStepPrompt({ genre, mood, bpm, section, extraHints })

      // Wake the legacy pod if stopped. Serverless endpoints scale themselves.
      await ensureWorkerReady()

      const jobReq: AceStepRequest = {
        prompt, lyrics, audioDuration, inferStep, seed,
        taskType, trackName,
        bpm: taskType === 'text2music' || !taskType ? bpm : undefined,
      }
      const jobId = await submitGeneration(jobReq)

      res.json({ jobId, prompt, taskType: taskType ?? 'text2music', trackName })
    } catch (err: any) {
      console.error('[aceStep] /generate error:', err)
      res.status(502).json({ error: err.message })
    }
  })

  // Poll job status — resets idle timer when job completes
  router.get('/job/:jobId', async (req: Request, res: Response) => {
    try {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store',
      })
      const job = await pollJob(req.params.jobId)
      if (job.status === 'done' || job.status === 'error') jobCompleted()
      res.json({
        ...job,
        // Keep both shapes while older clients are still deployed.
        output_url: job.outputUrl,
        duration_s: job.durationS,
        generation_s: job.generationS,
        job_id: job.jobId,
        task_type: job.taskType,
        track_name: job.trackName,
      })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  })

  // Serve generated audio (path traversal safe). Prefer a local file when the
  // worker runs beside Express; otherwise proxy the file from the RunPod worker.
  router.get('/audio/:filename', async (req: Request, res: Response) => {
    const filename = path.basename(req.params.filename)
    if (!filename.endsWith('.wav') && !filename.endsWith('.mp3')) {
      res.status(400).json({ error: 'Invalid file type' })
      return
    }
    const filePath = path.join(OUTPUT_DIR, filename)
    if (!fs.existsSync(filePath)) {
      try {
        const workerAudio = await fetch(`${WORKER_URL}/audio/${encodeURIComponent(filename)}`, {
          signal: AbortSignal.timeout(30_000),
        })
        if (!workerAudio.ok) {
          res.status(workerAudio.status).json({ error: 'Audio file not found' })
          return
        }
        const contentType = workerAudio.headers.get('content-type') ?? 'audio/wav'
        const arrayBuffer = await workerAudio.arrayBuffer()
        res.setHeader('Content-Type', contentType)
        res.setHeader('Cache-Control', 'private, max-age=3600')
        res.send(Buffer.from(arrayBuffer))
      } catch (err: any) {
        res.status(502).json({ error: err.message ?? 'Audio proxy failed' })
      }
      return
    }
    res.sendFile(filePath)
  })

  return router
}
