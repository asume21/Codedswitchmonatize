/**
 * ACE-first adapter — the single seam through which every music generation
 * point tries our own ACE-Step worker BEFORE falling back to its existing
 * provider (Replicate/Suno/JASCO/MusicGen sidecar).
 *
 * Contract: NEVER throws. Any failure — endpoint down, queue timeout, job
 * error, no-audio completion — logs one structured line and returns null so
 * the call site silently proceeds with its fallback.
 *
 * Spec: docs/superpowers/specs/2026-06-12-ace-everywhere-design.md
 */
import { isWorkerReady, generateAndWait, type AceStepRequest } from './aceStepService'

export interface AceFirstResult {
  /** URL the client can stream — local /api/ai-music/audio/* or remote. */
  url: string
  /** Path on this server's disk when the audio was saved locally. */
  localPath?: string
  durationS?: number
}

export async function tryAceFirst(req: AceStepRequest, label: string): Promise<AceFirstResult | null> {
  try {
    if (!(await isWorkerReady())) {
      console.log(`[aceFirst] ${label} fell back: worker not ready`)
      return null
    }

    const job = await generateAndWait(req)
    if (!job.outputUrl) {
      console.log(`[aceFirst] ${label} fell back: job ${job.jobId} completed without audio`)
      return null
    }

    console.log(`[aceFirst] ${label} rendered by ACE-Step: ${job.outputUrl} (${job.durationS ?? '?'}s)`)
    return { url: job.outputUrl, localPath: job.outputPath, durationS: job.durationS }
  } catch (err) {
    console.log(`[aceFirst] ${label} fell back: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}
