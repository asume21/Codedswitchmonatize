import type { AnalysisFrame, AnalysisFrameCallback } from '../analysis/types'

export type InputSourceType = 'mic' | 'midi' | 'audioFile' | 'autoGenerate'

export interface InputSourceConfig {
  type: InputSourceType
  /** For audioFile mode — the File or URL to play */
  audioFile?: File | string
  /** For autoGenerate mode — base BPM for the autonomous curve */
  autoBpm?: number
  /** For autoGenerate mode — energy profile: 'chill' | 'medium' | 'intense' */
  autoEnergy?: 'chill' | 'medium' | 'intense'
}

/**
 * Common contract for all Organism input sources.
 * Each source produces AnalysisFrame objects at ~43 fps (1024-sample frames at 44100 Hz)
 * and pushes them to subscribers, exactly like AudioAnalysisEngine.
 */
export interface InputSource {
  start(): Promise<void>
  stop(): void
  subscribe(callback: AnalysisFrameCallback): () => void
  isRunning(): boolean
  getLastFrame(): AnalysisFrame | null
}
