import type { TranscriptionCallback, TranscriptionLine, TranscriptionState } from './FreestyleTranscriber'

type StreamProvider = () => MediaStream | null

const INITIAL_STATE: TranscriptionState = {
  lines: [],
  currentInterim: '',
  isActive: false,
  isSupported: false,
}

function getBestMimeType(): string {
  const options = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]

  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export class LiveFreestyleTranscriber {
  private recorder: MediaRecorder | null = null
  private readonly callbacks: Set<TranscriptionCallback> = new Set()
  private readonly getStream: StreamProvider
  private readonly supported: boolean
  private active = false
  private transcribing = false
  private sessionStartTime = 0
  private lineCounter = 0
  private lastText = ''
  private state: TranscriptionState = { ...INITIAL_STATE }
  private lastEmitTime = 0
  private emitPending: ReturnType<typeof setTimeout> | null = null
  private readonly emitThrottleMs = 80

  constructor(getStream: StreamProvider) {
    this.getStream = getStream
    this.supported = typeof MediaRecorder !== 'undefined' && typeof fetch === 'function'
    this.state.isSupported = this.supported
  }

  subscribe(callback: TranscriptionCallback): () => void {
    this.callbacks.add(callback)
    return () => { this.callbacks.delete(callback) }
  }

  start(): void {
    if (!this.supported || this.active) return

    const stream = this.getStream()
    if (!stream) {
      this.state = {
        ...this.state,
        currentInterim: 'Mic stream is not ready for transcription yet.',
        isActive: false,
      }
      this.emit()
      return
    }

    this.active = true
    this.sessionStartTime = performance.now()
    this.lineCounter = 0
    this.lastText = ''
    this.state = {
      lines: [],
      currentInterim: '',
      isActive: true,
      isSupported: true,
    }

    const mimeType = getBestMimeType()
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

    this.recorder.ondataavailable = (event) => {
      if (!this.active || !event.data || event.data.size < 1024) return
      void this.transcribeChunk(event.data)
    }

    this.recorder.onerror = () => {
      this.state.currentInterim = 'Live transcription recorder failed.'
      this.emit()
    }

    this.recorder.start(12000)
    this.emit()
  }

  stop(): void {
    this.active = false

    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.requestData()
        this.recorder.stop()
      } catch {
        // Recorder may already be stopping.
      }
    }

    this.recorder = null
    this.state.isActive = false
    this.state.currentInterim = ''
    this.emit()
  }

  reset(): void {
    this.stop()
    this.transcribing = false
    this.lineCounter = 0
    this.lastText = ''
    this.state = {
      lines: [],
      currentInterim: '',
      isActive: false,
      isSupported: this.supported,
    }
    this.emit()
  }

  getState(): TranscriptionState {
    return this.state
  }

  getLyricsText(): string {
    return this.state.lines.map((line) => line.text).join('\n')
  }

  exportLyrics(filename: string = 'freestyle-lyrics.txt'): void {
    const text = this.state.lines
      .map((line, index) => `[${this.formatTime(line.startTime)}] Bar ${index + 1}: ${line.text}`)
      .join('\n')

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async copyLyrics(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(this.getLyricsText())
      return true
    } catch {
      return false
    }
  }

  isSupported(): boolean {
    return this.supported
  }

  private async transcribeChunk(blob: Blob): Promise<void> {
    if (this.transcribing) return
    this.transcribing = true
    this.state.currentInterim = 'Transcribing...'
    this.emit()

    try {
      const form = new FormData()
      form.append('audio', new File([blob], `organism-live-${Date.now()}.webm`, { type: blob.type || 'audio/webm' }))

      const response = await fetch('/api/organism/live-transcribe', {
        method: 'POST',
        body: form,
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.message || data?.error || `Transcription failed (${response.status})`)
      }

      const data = await response.json()
      const text = String(data.text || data.transcription?.text || '').trim()
      if (text && text.toLowerCase() !== this.lastText.toLowerCase()) {
        this.commitLine(text)
        this.lastText = text
      }
      this.state.currentInterim = ''
    } catch (error) {
      this.state.currentInterim = error instanceof Error ? error.message : 'Live transcription failed.'
    } finally {
      this.transcribing = false
      this.emit()
    }
  }

  private commitLine(text: string): void {
    const now = performance.now() - this.sessionStartTime
    this.lineCounter += 1
    const line: TranscriptionLine = {
      text,
      startTime: Math.max(0, now - 12000),
      endTime: now,
      barNumber: this.lineCounter,
    }
    this.state.lines = [...this.state.lines, line]
  }

  private emit(): void {
    const now = performance.now()
    const elapsed = now - this.lastEmitTime

    if (elapsed >= this.emitThrottleMs) {
      this.lastEmitTime = now
      if (this.emitPending) {
        clearTimeout(this.emitPending)
        this.emitPending = null
      }
      this.emitSnapshot()
    } else if (!this.emitPending) {
      this.emitPending = setTimeout(() => {
        this.emitPending = null
        this.lastEmitTime = performance.now()
        this.emitSnapshot()
      }, this.emitThrottleMs - elapsed)
    }
  }

  private emitSnapshot(): void {
    const snapshot = { ...this.state, lines: [...this.state.lines] }
    this.callbacks.forEach((callback) => callback(snapshot))
  }

  private formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }
}
