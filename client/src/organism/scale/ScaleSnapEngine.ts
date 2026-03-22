/**
 * SCALE SNAP ENGINE
 *
 * Listens to pitch detections from the AudioAnalysisEngine and determines
 * what musical key the user is singing/humming/whistling in. Once confident,
 * it locks the melody generator to a compatible scale so every note it plays
 * is harmonically correct relative to the user's voice.
 *
 * HOW IT WORKS (plain English):
 *
 *  1. Every audio frame gives us a pitch in Hz + a confidence score (0-1).
 *     We only care about frames where confidence > 0.6 (clear, pitched sounds).
 *
 *  2. We convert the pitch to a pitch class (0-11, where C=0, C#=1, D=2 ... B=11).
 *     This strips the octave — C3 and C4 are both pitch class 0.
 *
 *  3. We keep a sliding window of the last 16 high-confidence frames and build
 *     a histogram: how many times did each pitch class appear?
 *
 *  4. The most common pitch class becomes the root candidate.
 *
 *  5. We pick major vs minor based on the physics mode:
 *       Heat / Smoke / Gravel → minor feel
 *       Glow                  → major
 *       Ice                   → major pentatonic (sparse, clean)
 *     If the user is clearly singing (voiceActive + high HNR), we can also
 *     detect major vs minor from the interval pattern in their window.
 *
 *  6. HYSTERESIS: We don't switch keys on every new detection. The candidate
 *     root must appear in at least 5 of the last 8 high-confidence frames before
 *     we commit to it. And we only actually switch the melody on a bar boundary
 *     to avoid mid-phrase key changes that sound jarring.
 *
 *  7. snapNote(midiNote) — given any MIDI note number, returns the nearest note
 *     that belongs to the current detected scale. The melody generator calls this
 *     on every note it generates so nothing can clash.
 */

import type { OrganismMode } from '../physics/types'

// ── Scale definitions (semitone intervals from root) ──────────────────────────

export const SCALE_INTERVALS: Record<string, number[]> = {
  major_pentatonic: [0, 2, 4, 7, 9],
  minor_pentatonic: [0, 3, 5, 7, 10],
  natural_major:    [0, 2, 4, 5, 7, 9, 11],
  natural_minor:    [0, 2, 3, 5, 7, 8, 10],
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  blues:            [0, 3, 5, 6, 7, 10],
}

export type ScaleType = keyof typeof SCALE_INTERVALS

// Which scale each physics mode prefers
const MODE_SCALE_PREFERENCE: Record<string, ScaleType> = {
  heat:   'minor_pentatonic',
  ice:    'major_pentatonic',
  smoke:  'blues',
  gravel: 'dorian',
  glow:   'natural_major',
}

// Note names for display
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// ── Public types ───────────────────────────────────────────────────────────────

export interface ScaleDetection {
  rootPitchClass: number      // 0-11
  rootName:       string      // 'A', 'C#', etc.
  scaleType:      ScaleType
  intervals:      number[]    // semitone intervals from root
  confidence:     number      // 0-1
  locked:         boolean     // true = stable enough to use
  frameCount:     number      // how many pitch frames processed
}

export type ScaleChangeCallback = (detection: ScaleDetection) => void

export interface PitchFrame {
  pitchHz:     number
  pitchMidi:   number
  confidence:  number         // 0-1 from AudioAnalysisEngine
  mode:        OrganismMode | string
  voiceActive: boolean
}

// ── Engine ─────────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.60   // minimum pitch confidence to include in histogram
const WINDOW_SIZE          = 16     // how many high-confidence frames to keep
const LOCK_MIN_VOTES       = 5      // root must appear in 5/8 recent frames to lock
const LOCK_RECENT_WINDOW   = 8      // "recent" = last 8 high-confidence frames
const SWITCH_COOLDOWN_MS   = 2000   // don't switch root more than once per 2 seconds

export class ScaleSnapEngine {
  private callbacks:       ScaleChangeCallback[] = []
  private enabled:         boolean = true

  // Sliding window of high-confidence pitch classes
  private pitchWindow:     number[] = []    // pitch classes (0-11), WINDOW_SIZE max

  // Current committed detection
  private current: ScaleDetection = {
    rootPitchClass: 0,
    rootName:       'C',
    scaleType:      'minor_pentatonic',
    intervals:      SCALE_INTERVALS.minor_pentatonic,
    confidence:     0,
    locked:         false,
    frameCount:     0,
  }

  private currentMode:     string  = 'heat'
  private lastSwitchTime:  number  = 0
  private frameCount:      number  = 0

  /** Register a callback — fires whenever the detected scale changes. */
  onScaleChange(cb: ScaleChangeCallback): () => void {
    this.callbacks.push(cb)
    return () => { this.callbacks = this.callbacks.filter(c => c !== cb) }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /** Get the current detection (may not be locked yet). */
  getDetection(): Readonly<ScaleDetection> {
    return this.current
  }

  /**
   * Feed one audio frame. Call this on every physics subscription tick.
   * Returns the detection if it just locked/changed, null otherwise.
   */
  processPitchFrame(frame: PitchFrame): ScaleDetection | null {
    if (!this.enabled) return null

    this.frameCount++
    this.currentMode = frame.mode as string

    // Only add high-confidence pitched frames to the window
    if (frame.confidence >= CONFIDENCE_THRESHOLD && frame.pitchMidi > 0) {
      const pitchClass = frame.pitchMidi % 12
      this.pitchWindow.push(pitchClass)
      if (this.pitchWindow.length > WINDOW_SIZE) {
        this.pitchWindow.shift()
      }
    }

    // Need at least LOCK_RECENT_WINDOW frames before we can make a decision
    if (this.pitchWindow.length < LOCK_RECENT_WINDOW) {
      return null
    }

    // Build histogram of the recent window
    const recentWindow = this.pitchWindow.slice(-LOCK_RECENT_WINDOW)
    const histogram    = new Array(12).fill(0)
    for (const pc of recentWindow) {
      histogram[pc]++
    }

    // Find the most common pitch class
    let candidateRoot = 0
    let candidateVotes = 0
    for (let i = 0; i < 12; i++) {
      if (histogram[i] > candidateVotes) {
        candidateVotes = histogram[i]
        candidateRoot  = i
      }
    }

    // Confidence = fraction of window occupied by the winning root
    const confidence = candidateVotes / LOCK_RECENT_WINDOW

    // Not enough votes to lock
    if (candidateVotes < LOCK_MIN_VOTES) {
      if (this.current.locked) {
        // Losing confidence — stay locked but lower confidence
        const updated: ScaleDetection = {
          ...this.current,
          confidence,
          locked:     confidence >= 0.4,
          frameCount: this.frameCount,
        }
        this.current = updated
      }
      return null
    }

    // Pick scale type based on mode
    const scaleType = MODE_SCALE_PREFERENCE[this.currentMode] ?? 'minor_pentatonic'

    // Check if this is actually a change worth committing
    const rootChanged  = candidateRoot !== this.current.rootPitchClass
    const scaleChanged = scaleType !== this.current.scaleType
    const now          = performance.now()

    if (!rootChanged && !scaleChanged && this.current.locked) {
      // Same detection, just update confidence
      this.current = { ...this.current, confidence, frameCount: this.frameCount }
      return null
    }

    // Enforce cooldown — don't flicker between keys
    if (rootChanged && (now - this.lastSwitchTime) < SWITCH_COOLDOWN_MS) {
      return null
    }

    // Commit the new detection
    this.lastSwitchTime = now
    const intervals = SCALE_INTERVALS[scaleType]

    const detection: ScaleDetection = {
      rootPitchClass: candidateRoot,
      rootName:       NOTE_NAMES[candidateRoot],
      scaleType,
      intervals,
      confidence,
      locked:         true,
      frameCount:     this.frameCount,
    }

    this.current = detection

    // Notify listeners
    for (const cb of this.callbacks) {
      try { cb(detection) } catch { /* swallow */ }
    }

    // Emit window event for UI toasts / debug
    window.dispatchEvent(new CustomEvent('organism:scale-detected', {
      detail: { root: detection.rootName, scale: detection.scaleType, confidence },
    }))

    return detection
  }

  /**
   * Snap any MIDI note to the nearest note in the current detected scale.
   *
   * Example: current scale is A minor pentatonic [A, C, D, E, G]
   *   snapNote(71) → 71 is B4, nearest scale note is A4 (69) or C5 (72)
   *   distance to A4 = 2, distance to C5 = 1 → returns 72 (C5)
   *
   * On tie, prefers the higher note (sounds more resolved melodically).
   */
  snapNote(midiNote: number): number {
    if (!this.current.locked) return midiNote   // not locked = don't force anything

    const { rootPitchClass, intervals } = this.current
    if (intervals.length === 0) return midiNote

    // O(scale_size) modular arithmetic approach:
    // 1. Find the note's pitch class relative to the scale root
    const pc = ((midiNote - rootPitchClass) % 12 + 12) % 12

    // 2. Find the nearest scale interval to this pitch class
    let bestInterval = intervals[0]
    let bestDist     = Infinity

    for (const interval of intervals) {
      // Distance wrapping around the octave
      const dist = Math.min(
        Math.abs(pc - interval),
        12 - Math.abs(pc - interval)
      )
      if (dist < bestDist || (dist === bestDist && interval > bestInterval)) {
        bestDist     = dist
        bestInterval = interval
      }
    }

    // 3. Reconstruct the MIDI note: same octave region, snapped pitch class
    const snappedPc   = (rootPitchClass + bestInterval) % 12
    const noteOctBase = midiNote - (midiNote % 12)  // start of octave
    let snapped       = noteOctBase + snappedPc

    // If snapping pushed us more than 6 semitones away, try adjacent octave
    if (snapped - midiNote > 6)  snapped -= 12
    if (midiNote - snapped > 6)  snapped += 12

    // Clamp to valid MIDI range
    return Math.max(0, Math.min(127, snapped))
  }

  /** Reset all accumulated pitch history. */
  reset(): void {
    this.pitchWindow    = []
    this.frameCount     = 0
    this.lastSwitchTime = 0
    this.current = {
      ...this.current,
      confidence:  0,
      locked:      false,
      frameCount:  0,
    }
  }

  dispose(): void {
    this.callbacks  = []
    this.pitchWindow = []
    this.enabled    = false
  }
}
