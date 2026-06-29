import { SessionRecorder }    from './SessionRecorder'
import { buildSessionDNA }    from './SessionDNA'
import { exportToMidi }       from './MidiExporter'
import { AudioExporter }      from './AudioExporter'
import {
  DEFAULT_CAPTURE_CONFIG,
}                             from './types'
import type {
  CaptureConfig,
  GeneratorEvent,
  SessionDNA,
  CaptureCallback,
}                             from './types'
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import type { TransitionEvent } from '../state/types'

export class CaptureEngine {
  private readonly config:   CaptureConfig
  private readonly recorder: SessionRecorder
  private readonly audio:    AudioExporter

  private userId:    string = 'anonymous'
  private callbacks: Set<CaptureCallback> = new Set()
  private lastDNA:   SessionDNA | null    = null

  constructor(config: Partial<CaptureConfig> = {}) {
    this.config   = { ...DEFAULT_CAPTURE_CONFIG, ...config }
    this.recorder = new SessionRecorder(this.config)
    this.audio    = new AudioExporter()
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  setUserId(userId: string): void { this.userId = userId }

  startSession(): void {
    this.recorder.start()
  }

  recordFrame(physics: PhysicsState, organism: OrganismState): void {
    this.recorder.recordFrame(physics, organism)
  }

  recordTransition(event: TransitionEvent): void {
    this.recorder.recordTransition(event)
  }

  recordGeneratorEvent(event: GeneratorEvent): void {
    this.recorder.recordGeneratorEvent(event)
  }

  // ── Capture trigger ───────────────────────────────────────────────

  async capture(): Promise<SessionDNA> {
    const data = this.recorder.getData()
    const dna  = buildSessionDNA(this.userId, data)
    this.lastDNA = dna

    this.callbacks.forEach(cb => cb(dna))

    void this.saveToServer(dna)

    return dna
  }

  exportMidi(): ReturnType<typeof exportToMidi> | null {
    if (!this.lastDNA) return null
    return exportToMidi(
      this.lastDNA.generatorEvents,
      this.lastDNA.sessionId,
      this.lastDNA.avgPulse
    )
  }

  downloadMidi(): void {
    const result = this.exportMidi()
    if (!result) return
    const url = URL.createObjectURL(result.blob)
    const a   = document.createElement('a')
    a.href    = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async downloadStems(): Promise<void> {
    if (!this.lastDNA) return
    const result = await this.audio.stop(this.lastDNA.sessionId)

    for (const [name, blob] of Object.entries(result.stems)) {
      if (!blob) continue
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `organism-${name}-${this.lastDNA.sessionId}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  onCapture(callback: CaptureCallback): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  getLastDNA(): SessionDNA | null { return this.lastDNA }

  stop(): void {
    // no-op for now — capture engine is passive
  }

  reset(): void {
    this.recorder.reset()
    this.lastDNA = null
  }

  // ── Private ───────────────────────────────────────────────────────

  private async saveToServer(dna: SessionDNA): Promise<void> {
    try {
      const response = await fetch('/api/organism/sessions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(dna),
      })
      if (!response.ok) {
        if (response.status >= 500) throw new Error(`Session sync failed: ${response.status}`)
        return
      }
    } catch {
      console.warn("⚠️ Session sync paused: Server Offline")
    }
  }
}
