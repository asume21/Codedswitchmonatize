// Conductor Part 3 — the Duet (musical call-and-response).
//
// The band answers the MC in the GAPS of the flow: when the performer breathes
// or ends a phrase, the Conductor cues a short musical reply — a lead lick or a
// comp stab — that lands on the beat. "Conversation in the music, not the
// faders." This is the DECISION layer (pure); the orchestrator executes the cue.
//
// Division of labour (no doubles): the WOW layer (useWowMoments) owns DRUM
// MIMICRY — it echoes the performer's beatbox onsets into drum hits WHILE they
// happen. The Duet owns the HARMONIC/MELODIC REPLY — the band's own idea, played
// back AFTER the phrase. Different layer, different moment; they don't overlap.

import type { PerformerState } from '../audio/types'

/** What the band plays back. 'phrase' = a lead lick; 'stab' = a comp punctuation. */
export type DuetAnswer = 'phrase' | 'stab'

export interface DuetCue {
  answer: DuetAnswer
  /** 0–1 trigger velocity for the answer, scaled from performer energy. */
  velocity: number
}

export interface DuetContext {
  /** breathingNow from the PREVIOUS frame — so the cue fires on the rising edge
   *  of the gap (the moment the MC stops), not on every frame of the silence. */
  wasBreathing: boolean
  /** ms since the last answer fired — throttle so the band answers once per gap. */
  msSinceLastAnswer: number
  /** Minimum spacing between answers (ms). Default 1500 — one reply per breath. */
  minGapMs?: number
}

/**
 * Decide the band's musical answer to the MC, or null if now is not the moment.
 * Pure: same inputs → same cue. The orchestrator owns the timing/throttle state
 * and passes it in via `ctx`.
 */
export function planAnswer(performer: PerformerState, ctx: DuetContext): DuetCue | null {
  // Never answer over an active phrase — the flow keeps the floor.
  if (performer.isInPhrase) return null
  // Fire once, on the rising edge of the breath (the moment the MC just stopped).
  const gapJustOpened = performer.breathingNow && !ctx.wasBreathing
  if (!gapJustOpened) return null
  // One reply per gap window — don't pile answers into a flurry of short breaths.
  if (ctx.msSinceLastAnswer < (ctx.minGapMs ?? 1500)) return null

  const energy = Math.max(0, Math.min(1, performer.energy))
  // A lively bar earns a melodic lick back; a calm gap gets a soft comp stab.
  const answer: DuetAnswer = energy >= 0.45 ? 'phrase' : 'stab'
  const velocity = Math.max(0.3, Math.min(0.95, 0.4 + energy * 0.5))
  return { answer, velocity }
}

// ── Instrumental Duet — the band answers ITSELF ─────────────────────────────
//
// The vocal Duet above only fires on an MC's breath gaps: in pure listening
// mode nothing converses. Here the MELODY plays the MC's role — its committed
// rests between motifs ARE the call gaps — and the chords answer with a stab
// in the pocket the melody left. Same DuetCue, same executeDuetCue path in the
// orchestrator (quantized to the next 8th); this is a third CUE SOURCE into
// the existing engine, not a rival system.

export interface InstrumentalDuetContext {
  /** Seconds since the melody's last note ended (transport running). */
  melodyRestSec: number
  /** Seconds per beat at the current tempo. */
  beatSec: number
  /** Quiet-state from the PREVIOUS frame — answers fire on the rising edge of
   *  the rest, the moment the melody's phrase lands, not on every silent frame. */
  wasQuiet: boolean
  /** ms since the last instrumental answer — throttle. */
  msSinceLastAnswer: number
  /** An MC is actively performing — the vocal Duet owns the conversation. */
  voiceActive: boolean
  /** Optional section name so song mode can answer more intentionally. */
  section?: string
  /** Minimum spacing between answers (ms). Default 2500. */
  minGapMs?: number
}

/** The melody counts as resting after a beat-and-a-quarter of silence — long
 *  enough to be a deliberate phrase-end, not the space between two 8th notes. */
export function melodyIsQuiet(restSec: number, beatSec: number): boolean {
  return restSec > beatSec * 1.25
}

/**
 * Decide the chords' answer to a melody rest, or null if now is not the moment.
 * Pure: same inputs → same cue. The orchestrator owns edge/throttle state.
 */
export function planInstrumentalAnswer(ctx: InstrumentalDuetContext): DuetCue | null {
  if (ctx.voiceActive) return null
  const quiet = melodyIsQuiet(ctx.melodyRestSec, ctx.beatSec)
  if (!quiet || ctx.wasQuiet) return null   // rising edge only
  const section = (ctx.section ?? '').toLowerCase()
  const sectionGapMs = section === 'drop' || section === 'drop2' || section === 'chorus' || section === 'hook'
    ? 1800
    : section === 'breakdown' || section === 'intro'
      ? 3200
      : (ctx.minGapMs ?? 2500)
  if (ctx.msSinceLastAnswer < sectionGapMs) return null
  // In song mode, longer gaps in the hook/drop deserve an actual melodic answer;
  // intro/breakdown stays more restrained and answers with a stab.
  if (section === 'drop' || section === 'drop2' || section === 'chorus' || section === 'hook') {
    const phraseVelocity = Math.max(0.42, Math.min(0.8, 0.5 + (ctx.melodyRestSec / Math.max(0.01, ctx.beatSec)) * 0.08))
    return { answer: 'phrase', velocity: phraseVelocity }
  }
  // The melody is the one resting — answering with a lead lick would fill its
  // own silence. The chords punctuate instead: a soft comp stab in the pocket.
  return { answer: 'stab', velocity: 0.55 }
}
