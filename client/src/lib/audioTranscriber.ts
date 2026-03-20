/**
 * Client-side audio transcriber
 *
 * Decodes an audio URL in the browser and runs it through the organism's
 * existing PitchDetector (YIN) and OnsetDetector (HFC) engines to produce
 * editable patterns for Piano Roll and Beat Maker — no server, no API cost.
 *
 * Output is dispatched via the existing astutely:generated event so Piano Roll
 * and Beat Maker pick it up through their normal paths.
 */

import { PitchDetector } from '../organism/analysis/algorithms/PitchDetector'
import { OnsetDetector } from '../organism/analysis/algorithms/OnsetDetector'

const FRAME_SIZE  = 2048
const HOP_SIZE    = 512   // overlap between frames

// Frequency band boundaries for drum classification (Hz)
const KICK_MAX_HZ  = 250
const SNARE_MIN_HZ = 250
const SNARE_MAX_HZ = 4000
const HAT_MIN_HZ   = 4000

interface TranscribedNote {
  id:        string
  pitch:     number   // MIDI note number
  startStep: number   // 16th-note step index
  duration:  number   // in steps
  velocity:  number
  trackType: 'melody' | 'drums' | 'bass' | 'chords'
}

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${++_idCounter}`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hzToMidi(hz: number): number {
  return Math.round(12 * Math.log2(hz / 440) + 69)
}

function secondsToStep(seconds: number, bpm: number): number {
  const secondsPerStep = 60 / bpm / 4  // 16th note
  return Math.round(seconds / secondsPerStep)
}

/**
 * Build a frequency-band power array from a time-domain frame.
 * Returns [kickPower, snarePower, hatPower].
 */
function bandPowers(
  frame: Float32Array,
  sampleRate: number,
): [number, number, number] {
  // Simple DFT magnitude for 3 bands — fast enough for offline processing
  const n = frame.length
  const binHz = sampleRate / n

  let kick = 0, snare = 0, hat = 0

  for (let k = 1; k < n / 2; k++) {
    // Real part of DFT bin k
    let re = 0, im = 0
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n
      re += frame[t] * Math.cos(angle)
      im -= frame[t] * Math.sin(angle)
    }
    const mag = Math.sqrt(re * re + im * im) / n
    const hz  = k * binHz

    if (hz < KICK_MAX_HZ)                         kick  += mag * mag
    else if (hz < SNARE_MAX_HZ)                    snare += mag * mag
    else if (hz >= HAT_MIN_HZ && hz < sampleRate / 2) hat += mag * mag
  }

  return [kick, snare, hat]
}

// ── Main transcription function ───────────────────────────────────────────────

export interface TranscribeResult {
  notes:  TranscribedNote[]
  bpm:    number
}

/**
 * Fetch an audio URL, decode it, and extract melody + drum patterns.
 * Returns notes in the same format as astutelyToNotes() so the existing
 * astutely:generated event path handles everything downstream.
 */
export async function transcribeAudioUrl(
  audioUrl: string,
  bpm: number,
  onProgress?: (pct: number) => void,
): Promise<TranscribeResult> {
  // 1. Fetch + decode
  onProgress?.(0)
  const response = await fetch(audioUrl)
  if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`)
  const arrayBuffer = await response.arrayBuffer()

  const ctx    = new AudioContext()
  const buffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  const sampleRate  = buffer.sampleRate
  const channelData = buffer.getChannelData(0)  // mono (left channel)
  const totalFrames = Math.floor((channelData.length - FRAME_SIZE) / HOP_SIZE)

  onProgress?.(10)

  // 2. Init detectors
  const pitchDetector = new PitchDetector(sampleRate, FRAME_SIZE, 80, 2000)

  // Three onset detectors tuned to each drum frequency band
  // Lower threshold = more sensitive; tuned empirically
  const kickOnset  = new OnsetDetector(sampleRate, FRAME_SIZE, 0.012)
  const snareOnset = new OnsetDetector(sampleRate, FRAME_SIZE, 0.018)
  const hatOnset   = new OnsetDetector(sampleRate, FRAME_SIZE, 0.025)

  // 3. Frame-by-frame analysis
  const melodyPitches: Array<{ timeS: number; midi: number; confidence: number }> = []
  const drumOnsets:    Array<{ timeS: number; type: 'kick' | 'snare' | 'hihat' }> = []

  for (let i = 0; i < totalFrames; i++) {
    const offset = i * HOP_SIZE
    const frame  = channelData.slice(offset, offset + FRAME_SIZE)
    const timeS  = offset / sampleRate
    const nowMs  = timeS * 1000

    // Pitch (melody)
    const pitch = pitchDetector.process(frame)
    if (pitch.confidence > 0.5 && pitch.pitch > 0) {
      melodyPitches.push({ timeS, midi: pitch.midi, confidence: pitch.confidence })
    }

    // Drum onsets per band
    const [kickPow, snarePow, hatPow] = bandPowers(frame, sampleRate)

    // Build per-band frequency arrays for the onset detectors
    const kickFreq  = new Float32Array(FRAME_SIZE / 2).fill(kickPow)
    const snareFreq = new Float32Array(FRAME_SIZE / 2).fill(snarePow)
    const hatFreq   = new Float32Array(FRAME_SIZE / 2).fill(hatPow)

    if (kickOnset.process(kickFreq, nowMs).detected)   drumOnsets.push({ timeS, type: 'kick' })
    if (snareOnset.process(snareFreq, nowMs).detected) drumOnsets.push({ timeS, type: 'snare' })
    if (hatOnset.process(hatFreq, nowMs).detected)     drumOnsets.push({ timeS, type: 'hihat' })

    // Report progress from 10% → 90%
    if (i % 200 === 0) onProgress?.(10 + Math.round((i / totalFrames) * 80))
  }

  onProgress?.(90)

  // 4. Convert pitch frames → melody notes (merge consecutive same-pitch frames)
  const melodyNotes: TranscribedNote[] = []
  let   run: typeof melodyPitches[0] | null = null
  let   runStart = 0

  for (let i = 0; i < melodyPitches.length; i++) {
    const p = melodyPitches[i]
    if (!run) { run = p; runStart = p.timeS; continue }

    const sameNote  = Math.abs(p.midi - run.midi) <= 1  // ±1 semitone tolerance
    const gapOk     = p.timeS - run.timeS < 0.12        // gap < 120 ms → same note

    if (sameNote && gapOk) {
      run = p  // extend run
    } else {
      // Commit the run as a note
      const startStep = secondsToStep(runStart, bpm)
      const endStep   = secondsToStep(run.timeS, bpm)
      const duration  = Math.max(1, endStep - startStep)
      if (duration >= 1) {
        melodyNotes.push({
          id:        uid('mel'),
          pitch:     run.midi,
          startStep,
          duration,
          velocity:  Math.round(run.confidence * 80 + 40),
          trackType: 'melody',
        })
      }
      run = p; runStart = p.timeS
    }
  }

  // 5. Convert drum onsets → drum notes (MIDI pitch per GM standard)
  const DRUM_PITCH: Record<string, number> = { kick: 36, snare: 38, hihat: 42 }
  const drumNotes: TranscribedNote[] = drumOnsets.map(o => ({
    id:        uid('drm'),
    pitch:     DRUM_PITCH[o.type] ?? 38,
    startStep: secondsToStep(o.timeS, bpm),
    duration:  1,
    velocity:  90,
    trackType: 'drums' as const,
  }))

  onProgress?.(100)

  return {
    notes: [...melodyNotes, ...drumNotes],
    bpm,
  }
}
