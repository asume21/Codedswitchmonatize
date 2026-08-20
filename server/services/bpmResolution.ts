/**
 * Tempo resolution for generation prompts.
 *
 * WHY THIS EXISTS
 * musicgen-looper takes a `bpm` parameter AND reads the prompt text. When the
 * two disagree it generates audio at the tempo the text implies, then fails to
 * slice a loop at the tempo the parameter demands:
 *
 *   ValueError: Failed to generate a loop in the requested 120.0 bpm.
 *
 * That is exactly what shipped: /api/packs/generate never forwarded the user's
 * tempo, so the service used its own `bpm = 120` default and appended ", 120
 * bpm" to a prompt that already read "90 BPM". Runs either failed outright or
 * — worse — succeeded at 120 when the user asked for 90, producing packs at a
 * tempo that did not match their session.
 *
 * Rule: ONE tempo, taken from the user, used for both the parameter and the
 * prompt. A tempo written into the prompt is the most explicit statement of
 * intent available, so it wins.
 */

/** Outside this range a number is not a musical tempo anyone asked for. */
const MIN_BPM = 20
const MAX_BPM = 300

/** Caller default of last resort, matching the looper's own documented default. */
const DEFAULT_BPM = 120

/**
 * Pull an explicit tempo out of prompt text: "90 BPM", "75bpm", "at 140 bpm".
 * Requires the literal "bpm" so bare numbers ("808 bass", "3 chords") are never
 * mistaken for a tempo.
 */
export function bpmFromPrompt(prompt: string): number | null {
  const match = /(\d{1,3})\s*bpm\b/i.exec(prompt ?? '')
  if (!match) return null

  const value = Number.parseInt(match[1], 10)
  if (!Number.isFinite(value) || value < MIN_BPM || value > MAX_BPM) return null
  return value
}

/**
 * The single tempo to use for a generation.
 *
 * Precedence: tempo stated in the prompt → tempo requested by the caller →
 * {@link DEFAULT_BPM}. Never returns a value that contradicts the prompt.
 */
export function resolveBpm(prompt: string, requestedBpm?: number): number {
  const fromPrompt = bpmFromPrompt(prompt)
  if (fromPrompt !== null) return fromPrompt

  if (
    typeof requestedBpm === 'number' &&
    Number.isFinite(requestedBpm) &&
    requestedBpm >= MIN_BPM &&
    requestedBpm <= MAX_BPM
  ) {
    return Math.round(requestedBpm)
  }

  return DEFAULT_BPM
}

/**
 * Build the per-variation prompt.
 *
 * Appends the tempo ONLY when the prompt does not already state one — appending
 * a second tempo is what broke generation. The seed keeps variations distinct
 * without a timestamp, which added entropy to no purpose.
 */
export function buildVariationPrompt(
  prompt: string,
  variation: string,
  bpm: number,
  seed: number,
): string {
  const parts = [prompt, `${variation} style`]
  if (bpmFromPrompt(prompt) === null) parts.push(`${bpm} bpm`)
  parts.push(`session ${seed}`)
  return parts.join(', ')
}
