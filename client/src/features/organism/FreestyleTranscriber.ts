/**
 * FREESTYLE TRANSCRIBER
 *
 * Runs the Web Speech API (SpeechRecognition) in continuous mode alongside
 * the Organism's mic input to capture freestyle lyrics in real-time.
 *
 * - Detects pauses between phrases and auto-breaks into lines
 * - Timestamps each line relative to session start
 * - Emits callbacks with the latest transcription state
 * - Supports copy/export of captured lyrics
 *
 * Browser support: Chrome/Edge (full), Firefox/Safari (not supported).
 */

// Web Speech API type augmentation for cross-browser support
interface SpeechRecognitionCompat extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventCompat) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventCompat) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionEventCompat {
  resultIndex: number
  results: SpeechRecognitionResultListCompat
}

interface SpeechRecognitionResultListCompat {
  length: number
  [index: number]: SpeechRecognitionResultCompat
}

interface SpeechRecognitionResultCompat {
  isFinal: boolean
  length: number
  [index: number]: { transcript: string; confidence: number }
}

interface SpeechRecognitionErrorEventCompat {
  error: string
  message: string
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionCompat

export interface TranscriptionLine {
  text:      string
  startTime: number   // ms relative to session start
  endTime:   number   // ms relative to session start
  barNumber: number   // increments per detected line
}

export interface TranscriptionState {
  lines:          TranscriptionLine[]
  currentInterim: string
  isActive:       boolean
  isSupported:    boolean
}

export type TranscriptionCallback = (state: TranscriptionState) => void

const INITIAL_STATE: TranscriptionState = {
  lines:          [],
  currentInterim: '',
  isActive:       false,
  isSupported:    false,
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const win = window as unknown as Record<string, unknown>
  const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition
  if (typeof Ctor === 'function') return Ctor as unknown as SpeechRecognitionConstructor
  return null
}

export class FreestyleTranscriber {
  private recognition: SpeechRecognitionCompat | null = null
  private supported: boolean = false
  private active: boolean = false
  private sessionStartTime: number = 0
  private lineCounter: number = 0
  private currentLineStart: number = 0

  private state: TranscriptionState = { ...INITIAL_STATE }
  private callbacks: Set<TranscriptionCallback> = new Set()

  constructor() {
    const Ctor = getSpeechRecognitionCtor()

    if (!Ctor) {
      this.supported = false
      this.state.isSupported = false
      return
    }

    this.supported = true
    this.state.isSupported = true

    const recognition = new Ctor()
    recognition.lang            = 'en-US'
    recognition.continuous      = true
    recognition.interimResults  = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event: SpeechRecognitionEventCompat) => {
      this.handleResult(event)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEventCompat) => {
      // 'no-speech' and 'aborted' are normal during freestyle pauses
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.warn('[FreestyleTranscriber] Speech error:', event.error)
    }

    recognition.onend = () => {
      // Auto-restart if we're still supposed to be active
      // (SpeechRecognition stops after silence in some browsers)
      if (this.active && this.recognition) {
        try {
          this.recognition.start()
        } catch {
          // Already started — ignore
        }
      }
    }

    this.recognition = recognition
  }

  /** Subscribe to transcription state updates. */
  subscribe(callback: TranscriptionCallback): () => void {
    this.callbacks.add(callback)
    return () => { this.callbacks.delete(callback) }
  }

  /** Start transcribing. Call after the organism starts. */
  start(): void {
    if (!this.supported || !this.recognition || this.active) return

    this.active = true
    this.sessionStartTime = performance.now()
    this.lineCounter = 0
    this.currentLineStart = 0
    this.state = {
      lines:          [],
      currentInterim: '',
      isActive:       true,
      isSupported:    true,
    }

    try {
      this.recognition.start()
    } catch {
      // Already started
    }

    this.emit()
  }

  /** Stop transcribing. */
  stop(): void {
    if (!this.active) return
    this.active = false

    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {
        // Already stopped
      }
    }

    this.state.isActive = false
    this.emit()
  }

  /** Reset all captured lines. */
  reset(): void {
    this.stop()
    this.state = {
      lines:          [],
      currentInterim: '',
      isActive:       false,
      isSupported:    this.supported,
    }
    this.lineCounter = 0
    this.emit()
  }

  /** Get the current transcription state. */
  getState(): TranscriptionState {
    return this.state
  }

  /** Get all captured lyrics as a single string. */
  getLyricsText(): string {
    return this.state.lines.map((l) => l.text).join('\n')
  }

  /** Export lyrics as a downloadable .txt file. */
  exportLyrics(filename: string = 'freestyle-lyrics.txt'): void {
    const text = this.state.lines
      .map((l, i) => `[${this.formatTime(l.startTime)}] Bar ${i + 1}: ${l.text}`)
      .join('\n')

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Copy lyrics to clipboard. */
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

  // ── Private ───────────────────────────────────────────────────────

  private handleResult(event: SpeechRecognitionEventCompat): void {
    const now = performance.now() - this.sessionStartTime

    let interimText = ''
    let finalText = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const transcript = result[0].transcript.trim()

      if (result.isFinal) {
        finalText += transcript + ' '
      } else {
        interimText += transcript
      }
    }

    // Commit final text as a new line
    if (finalText.trim()) {
      this.lineCounter++
      this.state.lines.push({
        text:      finalText.trim(),
        startTime: this.currentLineStart,
        endTime:   now,
        barNumber: this.lineCounter,
      })
      this.currentLineStart = now
    }

    this.state.currentInterim = interimText
    this.emit()
  }

  private emit(): void {
    const snapshot = { ...this.state, lines: [...this.state.lines] }
    this.callbacks.forEach((cb) => cb(snapshot))
  }

  private formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }
}
