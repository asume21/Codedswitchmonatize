export interface AnalysisFrame {
  timestamp: number
  frameIndex: number
  sampleRate: number
  rms: number
  rmsRaw: number
  pitch: number
  pitchConfidence: number
  pitchMidi: number
  pitchCents: number
  spectralCentroid: number
  hnr: number
  spectralFlux: number
  onsetDetected: boolean
  onsetStrength: number
  onsetTimestamp: number
  voiceActive: boolean
  voiceConfidence: number
  rawBuffer?: Float32Array
}

export interface AnalysisConfig {
  sampleRate: number
  frameSize: number
  smoothingAttackMs: number
  smoothingReleaseMs: number
  pitchMinHz: number
  pitchMaxHz: number
  onsetThreshold: number
  voiceActivityThreshold: number
  noiseGateThreshold: number
  debugMode: boolean
}

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  sampleRate: 44100,
  frameSize: 1024,
  smoothingAttackMs: 30,
  smoothingReleaseMs: 200,
  pitchMinHz: 60,
  pitchMaxHz: 1200,
  onsetThreshold: 0.3,
  voiceActivityThreshold: 0.03,
  noiseGateThreshold: 0.02,
  debugMode: false,
}

export type AnalysisFrameCallback = (frame: AnalysisFrame) => void
