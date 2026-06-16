/**
 * ACE↔Suno bridge — lets the existing /api/songs/suno/* client flow carry
 * ACE-Step jobs without any client changes. ACE taskIds wear an `ace:` prefix;
 * the status endpoint maps ACE job states into the Suno record-info shape the
 * client already parses (status SUCCESS/PENDING/FAILED + response.sunoData).
 */
import type { AceStepJob } from './aceStepService'

export function aceTaskId(jobId: string): string {
  return `ace:${jobId}`
}

export function isAceTaskId(taskId: unknown): taskId is string {
  return typeof taskId === 'string' && taskId.startsWith('ace:')
}

export function rawAceJobId(taskId: string): string {
  return taskId.slice('ace:'.length)
}

interface SunoLikeTrack {
  id: string
  title: string
  audioUrl?: string
  audio_url?: string
  streamAudioUrl?: string
  stream_audio_url?: string
  duration?: number
  tags: string
}

export function aceJobToSunoTracks(job: AceStepJob, title: string): SunoLikeTrack[] {
  const url = job.outputUrl
  if (!url) return []
  return [{
    id: job.jobId,
    title,
    audioUrl: url,
    audio_url: url,
    streamAudioUrl: url,
    stream_audio_url: url,
    duration: job.durationS,
    tags: 'ace-step',
  }]
}

export function aceJobToSunoStatusData(job: AceStepJob, title: string): {
  taskId: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  errorMessage?: string
  response: { sunoData: SunoLikeTrack[] }
} {
  const status = job.status === 'done' ? 'SUCCESS'
    : job.status === 'error' ? 'FAILED'
    : 'PENDING'
  return {
    taskId: aceTaskId(job.jobId),
    status,
    ...(job.error ? { errorMessage: job.error } : {}),
    response: { sunoData: status === 'SUCCESS' ? aceJobToSunoTracks(job, title) : [] },
  }
}
