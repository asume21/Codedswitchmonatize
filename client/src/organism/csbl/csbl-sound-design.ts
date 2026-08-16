/**
 * csbl-sound-design.ts — CSBL Section 8, and the boundary that keeps it honest.
 *
 * WHY THIS IS A REGISTRY AND NOT A DSP MODULE
 *
 * Section 8 of the spec is a bare list of ~20 words — `punch`, `warmth`,
 * `sub_boost`, `width` — with no semantics, no ranges and no owner. Implementing
 * them as new DSP would have been the single most destructive commit available:
 * nearly every one of those words ALREADY has an implementation here.
 *
 *     punch / transient   drum bus compAttackMs, DrumGenerator
 *     warmth / body       channel lowShelfGain / midGain
 *     sub_boost           bass channel lowShelfGain: 4
 *     width / shimmer     MixEngine
 *     humanize            groove.ts
 *     glide               BassGenerator portamento, Real808BassSampler
 *     detune              ExpressiveEngine
 *
 * Most of those live in the mix, in `mix/types.ts` — the most carefully tuned
 * file in the repo, where every value carries a measured justification and three
 * are EAR-VALIDATED by blind A/B. A CSBL line writing into it would make CSBL a
 * second mix authority, which is this project's #1 recurring defect (spec 13.7,
 * "the doubles that haunt us").
 *
 * So the rule here is narrow and deliberate:
 *
 *   A param is ROUTED only if it has a SOURCE-LEVEL owner — an instrument or
 *   generator knob, never a mix bus knob. Everything else is declared and
 *   REFUSED, loudly, naming the owner that already exists.
 *
 * Refusing is a feature. Before this file the parser accepted `{punch: 0.8}`,
 * parsed it, and threw it away: the user heard no change and got no error. Three
 * AI/diagnostic paths in this repo already fail that way (spec 13.7 #2).
 */

/** One Section 8 parameter and, crucially, who owns it. */
export interface CsblSoundParamSpec {
  name: string
  /** Roles that accept it. `'*'` means any role. */
  roles: readonly string[] | '*'
  min: number
  max: number
  /** False when the spec declares it but no source-level owner exists yet. */
  routed: boolean
  /** Where it takes effect — or, when unrouted, who already owns the concept. */
  owner: string
}

const UNIVERSAL = '*' as const

/**
 * Section 8 in full. The `routed` flag is the whole point: the list stays
 * complete so the language is documented, while only the params with a verified
 * source-level owner can actually be used.
 */
export const CSBL_SOUND_PARAMS: readonly CsblSoundParamSpec[] = [
  // ── routed: verified source-level owners ────────────────────────────
  {
    name: 'humanize', roles: UNIVERSAL, min: 0, max: 1, routed: true,
    // buildHumanizeTemplate() hardcodes +/-9ms and +/-9%. This scales both.
    // Targets a MEASURED gap: our onset timing SD is 6.0ms against 8.6ms in
    // audio/reference-beats — we are too precise, not too sloppy (spec 13.8).
    owner: 'generators/groove.ts buildHumanizeTemplate',
  },
  {
    name: 'velocity', roles: UNIVERSAL, min: 0, max: 1, routed: true,
    owner: 'DrumHit.velocity / CsblBassStep.velocity',
  },
  {
    name: 'glide', roles: ['bass'], min: 0, max: 1, routed: true,
    // The pattern's `>` already sets glide as a BOOLEAN; this supplies the rate.
    owner: 'BassGenerator portamento (csbl-compiler-bass emits the flag)',
  },

  // ── declared, not routed: the mix already owns these ─────────────────
  { name: 'punch',        roles: ['kick'],   min: 0, max: 1, routed: false, owner: 'drum channel compAttackMs/compRatio (mix owns it)' },
  { name: 'transient',    roles: ['kick'],   min: 0, max: 1, routed: false, owner: 'drum channel compressor (mix owns it)' },
  { name: 'body',         roles: ['kick'],   min: 0, max: 1, routed: false, owner: 'drum channel EQ midGain (mix owns it)' },
  { name: 'saturation',   roles: ['kick'],   min: 0, max: 1, routed: false, owner: 'master saturationAmount (mix owns it)' },
  { name: 'sub_boost',    roles: ['bass'],   min: 0, max: 1, routed: false, owner: 'bass channel EQ lowShelfGain (mix owns it)' },
  { name: 'distortion',   roles: ['bass'],   min: 0, max: 1, routed: false, owner: 'no source-level owner yet' },
  { name: 'shimmer',      roles: ['melody'], min: 0, max: 1, routed: false, owner: 'MixEngine (mix owns it)' },
  { name: 'spread',       roles: ['melody'], min: 0, max: 1, routed: false, owner: 'channel pan (mix owns it)' },
  { name: 'voicing',      roles: ['chords'], min: 0, max: 1, routed: false, owner: 'Conductor voicing.ts — harmony authority, not a knob' },
  { name: 'warmth',       roles: ['chords'], min: 0, max: 1, routed: false, owner: 'chord channel EQ (mix owns it)' },
  { name: 'pad_depth',    roles: ['chords'], min: 0, max: 1, routed: false, owner: 'TextureGenerator (no param seam yet)' },
  { name: 'stereo_spread',roles: ['chords'], min: 0, max: 1, routed: false, owner: 'channel pan (mix owns it)' },

  // Universal words from Section 8 with no source-level seam today.
  { name: 'detune',    roles: UNIVERSAL, min: 0, max: 1, routed: false, owner: 'instruments/ExpressiveEngine (no CSBL seam yet)' },
  { name: 'drive',     roles: UNIVERSAL, min: 0, max: 1, routed: false, owner: 'master saturationAmount (mix owns it)' },
  { name: 'reverb',    roles: UNIVERSAL, min: 0, max: 1, routed: false, owner: 'mix sends (mix owns it)' },
  { name: 'delay',     roles: UNIVERSAL, min: 0, max: 1, routed: false, owner: 'mix sends (mix owns it)' },
  { name: 'wobble',    roles: UNIVERSAL, min: 0, max: 1, routed: false, owner: 'no owner yet' },
  { name: 'width',     roles: UNIVERSAL, min: 0, max: 1, routed: false, owner: 'MixEngine (mix owns it)' },
  { name: 'attack',    roles: UNIVERSAL, min: 0, max: 1, routed: false, owner: 'per-instrument envelope (no CSBL seam yet)' },
  { name: 'release',   roles: UNIVERSAL, min: 0, max: 1, routed: false, owner: 'per-instrument envelope (no CSBL seam yet)' },
  { name: 'cutoff',    roles: UNIVERSAL, min: 0, max: 1, routed: false, owner: 'per-instrument filter (no CSBL seam yet)' },
  { name: 'resonance', roles: UNIVERSAL, min: 0, max: 1, routed: false, owner: 'per-instrument filter (no CSBL seam yet)' },
]

export type CsblSoundParams = Record<string, number>

export type CsblSoundResult =
  | { ok: true; params: CsblSoundParams }
  | { ok: false; error: string }

function acceptsRole(spec: CsblSoundParamSpec, role: string): boolean {
  return spec.roles === UNIVERSAL || spec.roles.includes(role)
}

/** Every param a role can actually USE — routed only, so the UI never offers a
 *  control that is guaranteed to error. Same principle as a6af7ed5: do not
 *  offer an instrument that cannot play the role. */
export function soundParamsForRole(role: string): CsblSoundParamSpec[] {
  const r = role.toLowerCase()
  return CSBL_SOUND_PARAMS.filter((p) => p.routed && acceptsRole(p, r))
}

/**
 * Validate the `{k: v}` block the parser already produces. Collects EVERY
 * problem rather than stopping at the first, because these arrive as a batch
 * from one typed line and fixing them one error at a time is miserable.
 */
export function validateSoundParams(
  role: string,
  raw: Record<string, number>,
): CsblSoundResult {
  const r = role.toLowerCase()
  const errors: string[] = []
  const params: CsblSoundParams = {}

  for (const [name, value] of Object.entries(raw ?? {})) {
    const spec = CSBL_SOUND_PARAMS.find((p) => p.name === name)

    if (!spec) {
      const known = soundParamsForRole(r).map((p) => p.name)
      errors.push(
        `Unknown sound param "${name}". Available for ${r}: ` +
        `${known.length ? known.join(', ') : '(none routed yet)'}.`,
      )
      continue
    }

    if (!acceptsRole(spec, r)) {
      const scope = spec.roles === UNIVERSAL ? 'any role' : spec.roles.join('/')
      errors.push(`Sound param "${name}" applies to ${scope}, not ${r}.`)
      continue
    }

    if (!spec.routed) {
      errors.push(
        `Sound param "${name}" is declared in CSBL Section 8 but is not routed yet — ` +
        `it is already owned by ${spec.owner}. Change it there, not here, ` +
        `or CSBL becomes a second authority over it.`,
      )
      continue
    }

    if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
      errors.push(
        `Sound param "${name}" must be between ${spec.min} and ${spec.max} (got ${value}).`,
      )
      continue
    }

    params[name] = value
  }

  return errors.length ? { ok: false, error: errors.join(' ') } : { ok: true, params }
}
