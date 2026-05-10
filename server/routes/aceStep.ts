/**
 * ACE-Step routes — text-to-music generation
 *
 * GET  /api/ai-music/status          — ACE-Step worker health check
 * POST /api/ai-music/generate        — Ollama builds style prompt → ACE-Step job
 * GET  /api/ai-music/job/:jobId      — poll job status
 * GET  /api/ai-music/audio/:filename — serve generated WAV
 */

import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { isWorkerReady, submitGeneration, pollJob, AceStepRequest } from '../services/aceStepService'
import { ensureWorkerReady, jobCompleted } from '../services/runpodService'
import { makeAICall } from '../services/grok'

const OUTPUT_DIR = path.resolve(process.cwd(), 'private', 'ace-step', 'output')

// ── Prompt builder — Ollama/Grok generates ACE-Step style tags ────────────────
async function buildAceStepPrompt(opts: {
  genre: string
  mood: string
  bpm: number
  section: string
  extraHints?: string
}): Promise<string> {
  const { genre, mood, bpm, section, extraHints = '' } = opts

  const systemPrompt =
    'You are an expert music producer. Given a genre, mood, tempo, and song section, ' +
    'output a concise comma-separated list of style/mood tags that ACE-Step can use to generate music. ' +
    'Focus on: genre tags, instrument tags, energy tags, tempo feel tags, mood tags. ' +
    'Output ONLY the comma-separated tag list — no explanation, no JSON, no extra text. ' +
    'Example: "trap, hip-hop, 808 bass, dark, minor, aggressive, heavy kick, vinyl hi-hats"'

  const userPrompt = [
    `Genre: ${genre}`,
    `Mood: ${mood}`,
    `BPM: ${bpm}`,
    `Section: ${section}`,
    extraHints ? `Additional context: ${extraHints}` : '',
    '',
    'Generate the ACE-Step style tags:',
  ].filter(Boolean).join('\n')

  try {
    const result = await makeAICall(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 120, temperature: 0.7 },
    )
    const tags = (result as any)?.choices?.[0]?.message?.content?.trim() ?? ''
    if (tags.length > 5) return tags
  } catch (err) {
    console.error('[aceStep] buildAceStepPrompt AI call failed:', err)
  }

  // Deterministic fallback per sub-genre
  const fallbacks: Record<string, string> = {
    trap:       'trap, hip-hop, 808 bass, dark, minor, aggressive, heavy kick, vinyl hi-hats',
    'boom-bap': 'boom bap, hip-hop, jazz samples, boom, kick snare, classic, 90s, vinyl crackle',
    drill:      'uk drill, hip-hop, dark, minor, sliding 808, trap hi-hats, aggressive, cold',
    'r&b-soul': 'r&b, soul, smooth, warm, piano, bass guitar, vocals, lush, groove',
    afrobeats:  'afrobeats, african, percussion, upbeat, warm bass, rhythmic, dance, vibrant',
  }
  return fallbacks[genre.toLowerCase()] ?? `${genre}, hip-hop, ${mood}, ${bpm} bpm`
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
      } = req.body as {
        genre?: string; mood?: string; bpm?: number; section?: string
        lyrics?: string; audioDuration?: number; inferStep?: number
        seed?: number; extraHints?: string; prompt?: string
      }

      const prompt = rawPrompt
        ? rawPrompt
        : await buildAceStepPrompt({ genre, mood, bpm, section, extraHints })

      // Wake the pod if stopped (waits up to 2 min for model load)
      await ensureWorkerReady()

      const jobReq: AceStepRequest = { prompt, lyrics, audioDuration, inferStep, seed }
      const jobId = await submitGeneration(jobReq)

      res.json({ jobId, prompt })
    } catch (err: any) {
      console.error('[aceStep] /generate error:', err)
      res.status(502).json({ error: err.message })
    }
  })

  // Poll job status — resets idle timer when job completes
  router.get('/job/:jobId', async (req: Request, res: Response) => {
    try {
      const job = await pollJob(req.params.jobId)
      if (job.status === 'done' || job.status === 'error') jobCompleted()
      res.json(job)
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  })

  // Serve generated audio (path traversal safe)
  router.get('/audio/:filename', (req: Request, res: Response) => {
    const filename = path.basename(req.params.filename)
    if (!filename.endsWith('.wav') && !filename.endsWith('.mp3')) {
      res.status(400).json({ error: 'Invalid file type' })
      return
    }
    const filePath = path.join(OUTPUT_DIR, filename)
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Audio file not found' })
      return
    }
    res.sendFile(filePath)
  })

  return router
}
