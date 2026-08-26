/**
 * Loop generation planning — how long to ask ACE-Step for, and where to cut.
 *
 * TWO FINDINGS THIS ENCODES, both confirmed by ear on 2026-08-20:
 *
 * 1. A loop must be a whole number of bars. The old code asked for a flat 8
 *    seconds no matter the tempo; at 90 BPM that is 12 beats — three bars —
 *    so every "loop" was cut off mid-phrase and could never actually loop.
 *
 * 2. ACE-Step is a SONG model, not a loop model. Asked for a 4-bar clip
 *    directly (10.67s at 90 BPM) it produced artifacting the user described as
 *    "an annoying high pitch dolphin". The identical prompt and seed at 21.33s
 *    sounded good. Below roughly 20 seconds the diffusion has too few latent
 *    frames to resolve.
 *
 * So: generate LONG enough to sound good, then slice the requested loop out of
 * the middle. Never ask the model for a short clip.
 */

/** Below this, ACE-Step artifacts instead of resolving. Established by ear. */
export const MIN_SAFE_SECONDS = 20

/** The model's own hard ceiling. */
const MAX_MODEL_SECONDS = 240

/**
 * Extra seconds requested beyond the musical target.
 *
 * ACE-Step quantises to its own latent grid and always lands slightly SHORT:
 * asked for 21.333s it returns 21.269s. Without slack a bar-aligned cut at the
 * midpoint runs off the end and ffmpeg silently returns a short file — measured
 * at 63.8ms under, about a tenth of a beat at 90 BPM, which makes the loop
 * drift on every repeat. With slack the cut is sample-exact (measured 0.00ms).
 */
export const REQUEST_PADDING_SECONDS = 2

/** Assumed 4/4. Bar counts elsewhere in the app carry the same assumption. */
const BEATS_PER_BAR = 4

/** Length of a run of bars at a tempo, in seconds. */
export function barsToSeconds(bars: number, bpm: number): number {
  return bars * BEATS_PER_BAR * (60 / bpm)
}

export interface LoopPlan {
  /** Bars to ask the model for — always a whole multiple of loopBars. */
  generateBars: number
  /** The musical length being planned around. */
  generateSeconds: number
  /** What to actually ask the model for — generateSeconds plus slack. */
  requestSeconds: number
  /** Bar offset the loop is cut from. */
  startBar: number
  /** Seconds offset the loop is cut from. */
  startSeconds: number
  /** Length of the delivered loop. */
  loopSeconds: number
  /** Bars in the delivered loop. */
  loopBars: number
}

/**
 * Plan a generation that yields a clean `loopBars`-long loop.
 *
 * Doubles the generated length until it clears {@link MIN_SAFE_SECONDS}, which
 * keeps it a whole multiple of the loop length so every cut lands on a bar
 * line. Cuts from the midpoint rather than the start: generations open with a
 * fade-in or a sparse intro, and the middle is where the groove has settled.
 */
export function planLoopGeneration({
  bpm,
  loopBars = 4,
  minSeconds = MIN_SAFE_SECONDS,
}: {
  bpm: number
  loopBars?: number
  minSeconds?: number
}): LoopPlan {
  const loopSeconds = barsToSeconds(loopBars, bpm)

  // Double rather than add, so the total stays a whole multiple of loopBars and
  // the midpoint cut is itself bar-aligned.
  let generateBars = loopBars
  while (
    barsToSeconds(generateBars, bpm) < minSeconds &&
    barsToSeconds(generateBars * 2, bpm) <= MAX_MODEL_SECONDS
  ) {
    generateBars *= 2
  }

  const generateSeconds = barsToSeconds(generateBars, bpm)

  // Midpoint, rounded down to a whole number of loop lengths, and never so far
  // in that the loop would run past the end of the generation.
  const maxStartBar = generateBars - loopBars
  const midpointBar = Math.floor(generateBars / 2 / loopBars) * loopBars
  const startBar = Math.max(0, Math.min(midpointBar, maxStartBar))

  return {
    generateBars,
    generateSeconds,
    requestSeconds: Math.min(generateSeconds + REQUEST_PADDING_SECONDS, MAX_MODEL_SECONDS),
    startBar,
    startSeconds: barsToSeconds(startBar, bpm),
    loopSeconds,
    loopBars,
  }
}
