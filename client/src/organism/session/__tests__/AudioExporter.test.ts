import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AudioExporter } from '../AudioExporter'

// Both MediaStream and MediaRecorder are browser-only APIs.
// We must use regular function constructors (not arrow) so `new` works.
vi.stubGlobal('MediaStream', function MediaStreamStub() {
  // no-op
})

vi.stubGlobal('MediaRecorder', function MediaRecorderStub(this: Record<string, unknown>) {
  this.state = 'inactive'
  this.ondataavailable = null
  this.onstop = null

  this.start = vi.fn().mockImplementation(() => {
    this.state = 'recording'
    setTimeout(() => {
      const cb = this.ondataavailable as ((e: { data: Blob }) => void) | null
      if (cb) cb({ data: new Blob(['audio-data'], { type: 'audio/webm' }) })
    }, 5)
  })

  this.stop = vi.fn().mockImplementation(() => {
    this.state = 'inactive'
    setTimeout(() => {
      const cb = this.onstop as (() => void) | null
      if (cb) cb()
    }, 5)
  })
})

function makeMockDestination(): MediaStreamAudioDestinationNode {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream: new (MediaStream as any)(),
  } as unknown as MediaStreamAudioDestinationNode
}

describe('AudioExporter', () => {
  let exporter: AudioExporter

  beforeEach(() => {
    exporter = new AudioExporter()
  })

  it('start() creates MediaRecorder for each source node', () => {
    const nodes = {
      drum: makeMockDestination(),
      bass: makeMockDestination(),
    }
    exporter.start(nodes)
    expect(exporter.isRecording()).toBe(true)
  })

  it('isRecording() is true after start(), false after stop()', async () => {
    const nodes = { drum: makeMockDestination() }
    exporter.start(nodes)
    expect(exporter.isRecording()).toBe(true)

    const result = await exporter.stop('test-session')
    expect(exporter.isRecording()).toBe(false)
    expect(result.sessionId).toBe('test-session')
  })

  it('stop() resolves with StemExportResult containing all keys', async () => {
    const nodes = {
      drum: makeMockDestination(),
      bass: makeMockDestination(),
      melody: makeMockDestination(),
      texture: makeMockDestination(),
      master: makeMockDestination(),
    }
    exporter.start(nodes)
    const result = await exporter.stop('sess-123')
    expect(result.stems).toHaveProperty('drum')
    expect(result.stems).toHaveProperty('bass')
    expect(result.stems).toHaveProperty('melody')
    expect(result.stems).toHaveProperty('texture')
    expect(result.stems).toHaveProperty('master')
  })

  it('calling stop() without start() → returns null stems (no crash)', async () => {
    const result = await exporter.stop('no-session')
    expect(result.stems.drum).toBeNull()
    expect(result.stems.bass).toBeNull()
    expect(result.stems.melody).toBeNull()
    expect(result.stems.texture).toBeNull()
    expect(result.stems.master).toBeNull()
  })
})
