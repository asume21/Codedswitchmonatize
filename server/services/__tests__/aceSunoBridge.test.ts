import { describe, expect, it } from 'vitest'
import {
  aceTaskId,
  isAceTaskId,
  rawAceJobId,
  aceJobToSunoStatusData,
  aceJobToSunoTracks,
} from '../aceSunoBridge'
import type { AceStepJob } from '../aceStepService'

const doneJob: AceStepJob = {
  jobId: 'j9',
  status: 'done',
  outputUrl: '/api/ai-music/audio/j9.wav',
  durationS: 120,
}

describe('aceSunoBridge', () => {
  it('round-trips the ace: taskId prefix', () => {
    const id = aceTaskId('abc-123')
    expect(id).toBe('ace:abc-123')
    expect(isAceTaskId(id)).toBe(true)
    expect(isAceTaskId('suno-task-1')).toBe(false)
    expect(rawAceJobId(id)).toBe('abc-123')
  })

  it('maps a done job to a Suno SUCCESS record with sunoData tracks', () => {
    const data = aceJobToSunoStatusData(doneJob, 'My Song')
    expect(data.status).toBe('SUCCESS')
    const track = data.response.sunoData[0]
    expect(track.audioUrl).toBe('/api/ai-music/audio/j9.wav')
    expect(track.audio_url).toBe('/api/ai-music/audio/j9.wav')
    expect(track.duration).toBe(120)
    expect(track.title).toBe('My Song')
  })

  it('maps queued/running to PENDING and error to FAILED', () => {
    expect(aceJobToSunoStatusData({ jobId: 'j', status: 'queued' }, 't').status).toBe('PENDING')
    expect(aceJobToSunoStatusData({ jobId: 'j', status: 'running' }, 't').status).toBe('PENDING')
    const failed = aceJobToSunoStatusData({ jobId: 'j', status: 'error', error: 'boom' }, 't')
    expect(failed.status).toBe('FAILED')
    expect(failed.errorMessage).toBe('boom')
  })

  it('produces a waitForResult-style tracks array', () => {
    const tracks = aceJobToSunoTracks(doneJob, 'My Song')
    expect(tracks).toHaveLength(1)
    expect(tracks[0].streamAudioUrl).toBe('/api/ai-music/audio/j9.wav')
  })
})
