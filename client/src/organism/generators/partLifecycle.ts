import type * as Tone from 'tone'

/**
 * The ONE way a generator retires a Tone.Part.
 *
 * Tone's Part.stop() throws "Value must be within [0, Infinity]" when the
 * transport position rounds a hair below zero (seen: -1.93e-12). Four generators
 * wrote `part.stop(); part.dispose(); this.part = null`, so that throw skipped
 * dispose() — the old Part stayed alive and kept scheduling notes on the
 * Transport while the next start or preset swap built a NEW one on top of it.
 * Every swap that hit the rounding error left another orphan playing: doubled
 * notes, growing voice and node work on the audio thread, stalls that worsen over
 * a session. Three other sites had already patched this with their own try/catch
 * ("negative-time rounding — dispose handles it"); this is that precedent, once.
 *
 * Teardown must be total, so it never throws and dispose() always runs.
 * Usage: `this.part = retirePart(this.part)`.
 */
export function retirePart(part: Tone.Part<any> | null | undefined): null {
  if (!part) return null
  try {
    part.stop()
  } catch (err) {
    // The known rounding case is expected; anything else is worth a trace, but
    // still must not stop the dispose below.
    if (!(err instanceof RangeError)) console.warn('[retirePart] Part.stop threw', err)
  }
  try {
    part.dispose()
  } catch (err) {
    console.warn('[retirePart] Part.dispose threw', err)
  }
  return null
}
