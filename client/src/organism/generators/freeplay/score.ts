// client/src/organism/generators/freeplay/score.ts
// Helpers for performing Claude-composed SectionScores (shared/arrangement.ts).
// The score grid is 16th-note slots over 4 bars (slot 0..63).

/** Map a duration in 16th-slots to the nearest Tone.js notation string.
 *  Exact for the common values; rounds down for odd in-between lengths so a
 *  written note never bleeds past the next one. */
export function slotsToDur(slots: number): string {
  const n = Math.max(1, Math.round(slots))
  if (n >= 32) return '2m'
  if (n >= 24) return '1m.'
  if (n >= 16) return '1m'
  if (n >= 12) return '2n.'
  if (n >= 8)  return '2n'
  if (n >= 6)  return '4n.'
  if (n >= 4)  return '4n'
  if (n >= 3)  return '8n.'
  if (n >= 2)  return '8n'
  return '16n'
}

/**
 * Comp ONE hit of a held chord like a player, not a stamp.
 *
 * The Conductor voices each chord (voice-led, common tones held). But the comp
 * used to play that IDENTICAL block on every hit — 8-15 stamps of the same four
 * notes per chord — which is the "robotic / blocky" sound: no movement WITHIN a
 * held chord. This varies WHICH voiced tones sound (and their octave) per hit so
 * a static block becomes motion, WITHOUT inventing any harmony: every returned
 * note is one of the Conductor's voiced tones, at most shifted an octave.
 *
 * Deterministic in `hitIndex` so the locked loop stays byte-identical each cycle.
 * The 4-cycle: full stack → drop the lowest voice (lighter) → MOVE THE TOP up to
 * the next chord tone (an octave of an inner voice, so the ear hears the top line
 * step up — the audible part of a comp) → shell (bottom + top two). Downbeat hits
 * (hitIndex 0) always get the full statement.
 *
 * Moving the TOP matters: the Conductor's voicing is a wide drop voicing, so
 * shuffling inner/low voices under a fixed top note is nearly inaudible — a comp
 * only sounds alive when the top voice actually walks.
 */
export function compVoicingForHit(inner: number[], hitIndex: number): number[] {
  if (inner.length < 3) return inner
  const v = [...inner].sort((a, b) => a - b)   // low → high
  switch (((hitIndex % 4) + 4) % 4) {
    case 1: return v.slice(1)                          // lighter — drop lowest voice
    case 2: return [...v.slice(1), v[1] + 12]          // top moves UP (octave of 2nd voice on top)
    case 3: return [v[0], v[v.length - 2], v[v.length - 1]]        // shell — bottom + top two
    default: return v                                  // statement — full stack
  }
}

// ─────────────────────────────────────────────────────────────────────
// NOTE SCORING — deriving a note's dynamics from its musical JOB.
//
// The generators mostly work by lookup: a pattern table says which slots fire and
// a contour table says which pitch. Velocity was the one thing genuinely left to
// chance — `jitterVel(0.9, rng)` — so every note came out at roughly the same
// loudness with random wobble on top. Random wobble is not dynamics; a part sounds
// PLAYED when its loudness follows what the note is doing.
//
// So instead of picking a number, state each note's job and add up what those jobs
// imply. Every term below is one reason a real player would lean in or ease off,
// and each is independently defensible — which is the difference between a note
// that is loud and a note that is loud FOR A REASON.
//
// Pure and deterministic: no Tone, no clock, no Math.random. The same note in the
// same musical position always gets the same weight, so a locked section repeats
// identically (a beat is ~6 sections, each a perfect loop) while DIFFERENT
// positions differ. Variety comes from position, not from dice.
// ─────────────────────────────────────────────────────────────────────

export interface NoteJobContext {
  /** 0..15 slot within the bar. */
  slot: number
  /** Bar index within the phrase, and the phrase length in bars. */
  bar: number
  bars: number
  /** Absolute kick slots for the phrase — landing WITH the kick is an accent. */
  kickSlots?: number[]
  /** Slots (0..15) the lead occupies — the bass eases off so it isn't fighting. */
  leadBusy?: number[]
  /** 0..1 section energy: a verse should not hit like a drop. */
  energy?: number
  /** True when this note is the phrase's final resolution. */
  isResolution?: boolean
}

/** Clamp to the usable velocity window — never silent, never clipped. */
function clampVel(v: number): number {
  return Math.max(0.25, Math.min(1, v))
}

/**
 * Velocity for a bass note, derived from the jobs it is doing.
 *
 * Terms, each a reason a player would change their touch:
 *  - DOWNBEAT is the anchor. The bar's identity; it gets the weight.
 *  - WITH THE KICK the two read as one instrument, so the accent belongs there.
 *    Off the kick, the note is a connector and steps back.
 *  - UNDER A BUSY LEAD the bass makes room. This is the mix decision made at the
 *    note level: it keeps the centre clear without any live ducking, which is the
 *    thing records do and dynamic ducking does not.
 *  - ENERGY scales the whole thing by section, so a verse and a drop differ in
 *    touch and not just in note count.
 *  - RESOLUTION lands. A phrase that ends at the same weight it ran at never
 *    sounds like it arrived.
 *  - LATE IN THE PHRASE leans in slightly — a natural push toward the turnaround.
 */
export function bassVelocityForJob(ctx: NoteJobContext): number {
  const isDownbeat = ctx.slot === 0
  const onKick = (ctx.kickSlots ?? []).includes(ctx.bar * 16 + ctx.slot)
  const underLead = (ctx.leadBusy ?? []).includes(ctx.slot)
  const energy = ctx.energy ?? 0.6

  let v = 0.62                        // a connector note: present, not asserting
  if (isDownbeat)      v += 0.18      // anchor the bar
  if (onKick)          v += 0.10      // lock with the kick as one instrument
  else if (!isDownbeat) v -= 0.04     // off the grid's anchor points, step back
  if (underLead)       v -= 0.09      // leave the centre for the lead / vocal
  if (ctx.isResolution) v += 0.08     // land the phrase

  // Push gently toward the end of the phrase (0 at the start, +0.05 at the last bar).
  if (ctx.bars > 1) v += 0.05 * (ctx.bar / (ctx.bars - 1))

  // Section energy scales touch around the middle rather than replacing it, so a
  // low-energy section is softer everywhere without flattening the accents.
  v *= 0.78 + 0.36 * energy

  return clampVel(v)
}
