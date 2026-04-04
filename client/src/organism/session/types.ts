import type { OrganismMode } from '../physics/types'

// ── Event log entry — one per frame ──────────────────────────────────

export interface PhysicsSnapshot {
  frameIndex: number
  timestamp:  number
  pulse:      number
  bounce:     number
  swing:      number
  pocket:     number
  presence:   number
  density:    number
  mode:       OrganismMode
  voiceActive: boolean
}

export interface StateSnapshot {
  frameIndex:  number
  timestamp:   number
  state:       string   // OState enum value
  flowDepth:   number
  syllabicDensity: number
}

export interface GeneratorEvent {
  frameIndex:   number
  timestamp:    number
  generator:    'drum' | 'bass' | 'melody' | 'texture' | 'chord'
  eventType:    'note_on' | 'note_off' | 'pattern_change' | 'behavior_change'
  pitch?:       number    // MIDI note number
  velocity?:    number    // 0–127
  durationMs?:  number
  meta?:        string    // behavior name, pattern name, etc.
}

export interface TransitionSnapshot {
  frameIndex: number
  timestamp:  number
  from:       string
  to:         string
  physicsAtTransition: PhysicsSnapshot
}

// ── Session DNA — the compressed session summary ───────────────────

export interface SessionDNA {
  // Identity
  sessionId:    string    // uuid
  userId:       string    // CodedSwitch user id
  createdAt:    number    // Unix timestamp ms
  durationMs:   number    // total session length

  // Musical fingerprint
  dominantMode:       OrganismMode
  modeDistribution:   Record<OrganismMode, number>  // % of session in each mode
  avgPulse:           number    // mean BPM over session
  pulseRange:         [number, number]  // [min, max] BPM
  avgBounce:          number
  avgSwing:           number
  avgPresence:        number
  avgDensity:         number

  // Flow metrics
  timeInFlowMs:       number    // total ms in FLOW state
  flowPercentage:     number    // % of session in FLOW
  longestFlowStreak:  number    // longest continuous FLOW duration ms
  transitionCount:    number    // total state transitions
  cadenceLockEvents:  number    // how many times cadence lock was achieved

  // Voice fingerprint
  avgSyllabicDensity: number    // mean syllables/beat when voice active
  pitchCenter:        number    // Hz — median voiced pitch
  energyProfile:      'hot' | 'warm' | 'cool' | 'cold'  // derived from avgPresence

  // Raw timelines (compressed — sampled every 10 frames)
  physicsTimeline:    PhysicsSnapshot[]
  stateTimeline:      StateSnapshot[]
  transitions:        TransitionSnapshot[]

  // Generator events (for MIDI export)
  generatorEvents:    GeneratorEvent[]
}

// ── Capture config ────────────────────────────────────────────────────

export interface CaptureConfig {
  // How many bars to freeze on capture trigger
  captureBars:          number    // default 8

  // Max session length before auto-snapshot (minutes)
  autoSnapshotMinutes:  number    // default 10

  // Physics/state sampling rate (every N frames)
  timelineSampleRate:   number    // default 10 (every 10 frames = ~4.3 per second)

  // Max generator events to store in memory
  maxGeneratorEvents:   number    // default 10000

  // Audio stem recording
  enableStemRecording:  boolean   // default false (high memory cost)
  stemSampleRate:       number    // default 44100
}

export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  captureBars:          8,
  autoSnapshotMinutes:  10,
  timelineSampleRate:   10,
  maxGeneratorEvents:   10000,
  enableStemRecording:  false,
  stemSampleRate:       44100,
}

export type CaptureCallback = (dna: SessionDNA) => void
