import { INSTRUMENT_PERFORMERS, INSTRUMENT_PERFORMERS_BY_ID } from './InstrumentRegistry'
import type {
  InstrumentPerformerId,
  InstrumentPerformerProfile,
  PerformerRole,
  PerformerSelectionContext,
} from './types'

const NOTE_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
}

const PC_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const DEFAULT_BY_ROLE: Record<PerformerRole, InstrumentPerformerId> = {
  lead: 'piano',
  bass: 'bass-electric',
  chord: 'piano',
  texture: 'strings',
}

const MODE_ROLE_DEFAULTS: Partial<Record<string, Partial<Record<PerformerRole, InstrumentPerformerId[]>>>> = {
  heat: {
    // Brass remains available explicitly, but no longer becomes the automatic
    // identity of a Trap beat; the captured trumpet-like riff read as dated GM.
    lead: ['piano', 'rhodes', 'guitar-clean', 'violin'],
    bass: ['bass-synth', 'bass-electric'],
    chord: ['rhodes', 'piano', 'guitar-clean', 'strings'],
  },
  gravel: {
    // boom-bap: keys, horns — and violin/strings, the classic sampled-loop
    // flavour (RZA/Nas-era string leads). Violin was absent from this pool
    // entirely, making it unreachable in boom-bap except by explicit pick.
    lead: ['piano', 'sax', 'rhodes', 'violin'],
    bass: ['bass-synth', 'bass-electric'],
    chord: ['piano', 'rhodes', 'guitar-nylon', 'strings'],
  },
  smoke: {
    lead: ['sax', 'clarinet', 'violin', 'guitar-nylon'],
    bass: ['bass-upright', 'bass-electric'],
    chord: ['rhodes', 'piano', 'guitar-nylon'],
  },
  ice: {
    lead: ['harp', 'violin', 'sitar', 'flute'],
    bass: ['bass-synth', 'bass-electric'],
    chord: ['harp', 'strings', 'guitar-nylon'],
  },
  glow: {
    lead: ['violin', 'guitar-nylon', 'clarinet', 'flute'],
    bass: ['bass-electric', 'bass-upright'],
    chord: ['rhodes', 'strings', 'guitar-nylon'],
  },
}

// Per-start variety seed. The scoring below is deterministic, so without it
// the SAME instrument won every start ("the melody is violin every time").
// Reseeded by the orchestrator on each cold start: stable WITHIN a session
// (mode changes don't churn instruments mid-beat), different ACROSS starts.
let performerSessionSeed = Math.random() * 1000

export function reseedPerformerSelection(): void {
  performerSessionSeed = Math.random() * 1000
}

function seededJitter(profileId: string): number {
  let h = performerSessionSeed
  for (let i = 0; i < profileId.length; i++) h = (h * 31 + profileId.charCodeAt(i)) % 9973
  return (h / 9973) * 3   // 0..3 — reorders near-tied candidates, not the field
}

/** Seeded 0..1 roll keyed by a string — stable within a session like the jitter. */
function seededRoll(key: string): number {
  let h = performerSessionSeed
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 9973
  return h / 9973
}

/** How often a start ignores the mode's preferred pool entirely and gives every
 *  role-capable instrument a fair roll. ANY instrument can be in ANY genre —
 *  the genre lives in HOW it's played (skeletons, swing, comping idiom,
 *  articulations), not the timbre. Without this, the +12 preference bonus made
 *  the pools de facto gates: a violin boom-bap or marimba trap could never
 *  happen organically. */
const WILDCARD_CHANCE = 0.08

// Auto still gets occasional color, but only from voices that can carry a
// credible record-ready core. Every instrument remains available explicitly.
const AUTO_TASTE_SAFE_BY_ROLE: Partial<Record<PerformerRole, ReadonlySet<InstrumentPerformerId>>> = {
  lead: new Set(['piano', 'rhodes', 'guitar-nylon', 'guitar-clean', 'violin', 'cello', 'flute', 'clarinet', 'sax']),
  chord: new Set(['piano', 'rhodes', 'guitar-nylon', 'guitar-clean', 'strings', 'choir', 'organ']),
}

/**
 * Can this instrument actually hold this role? ONE rule, used by the automatic
 * selector AND by the UI dropdown, so the two can never disagree.
 *
 * THE CHORD ROLE MUST BE ABLE TO SOUND A CHORD (2026-08-05, re-broken 2026-08-09).
 * conformChordToInstrument collapses a chord to its single top note when the
 * profile is polyphony:'mono'. Five monophonic instruments — violin, cello,
 * trumpet, trombone, french-horn — declare the 'chord' role, so landing on one
 * DELETES the harmony: one note per hit until the instrument changes.
 *
 * The original fix filtered only the automatic candidate list, and the dropdown
 * kept offering all five. The user picked one and heard it immediately: "back to
 * one note sally". Fixing the router alone would have silently overridden his
 * choice, which is worse — a control that lies. The instrument simply must not
 * be offered for a role it cannot play.
 *
 * A trumpet cannot comp chords; that is a category error, not a voicing choice.
 * They stay fully available for the LEAD role, where a single line is the point.
 */
export function canPerformRole(
  profile: InstrumentPerformerProfile,
  role: PerformerSelectionContext['role'],
): boolean {
  if (!profile.roles.includes(role)) return false
  if (role === 'chord' && profile.polyphony === 'mono') return false
  return true
}

export function selectInstrumentPerformer(ctx: PerformerSelectionContext): InstrumentPerformerProfile {
  if (ctx.explicitId) {
    const explicit = INSTRUMENT_PERFORMERS_BY_ID.get(ctx.explicitId)
    if (explicit && canPerformRole(explicit, ctx.role)) return explicit
  }

  // See canPerformRole — THE CHORD ROLE MUST BE ABLE TO SOUND A CHORD (2026-08-05).
  // conformChordToInstrument collapses a chord to its single top note when the
  // profile is polyphony:'mono'. Five monophonic instruments — violin, cello,
  // trumpet, trombone, french-horn — declared the 'chord' role, so whenever the
  // selector landed on one (mode pool, or the 18% wildcard) the harmony was
  // DELETED: one note per hit until the instrument changed. Measured: trombone
  // was picked for chords in gravel mode. The user heard exactly that — "all I
  // kept hearing was one note each time, like a kid using his finger on a
  // piano" — and it is why the chords never sounded like chords no matter how
  // they were voiced.
  //
  // A trumpet cannot comp chords; that is a category error, not a voicing
  // choice. They stay fully available for the LEAD role, where a single line is
  // the point. (If we later want brass on the harmony it should be an
  // arpeggiation or a section patch, not a silently-collapsed block.)
  const allCandidates = INSTRUMENT_PERFORMERS.filter(profile => canPerformRole(profile, ctx.role))
  const modePool = MODE_ROLE_DEFAULTS[ctx.mode]?.[ctx.role]
  const preferred = modePool ?? [DEFAULT_BY_ROLE[ctx.role]]
  // Wildcard start: the preferred pool becomes advisory, not a gate — the mild
  // energy/brightness/mode-bias scoring below still keeps the pick sensible.
  // Scope: lead/chord only (instrument COLOR lives there; the low-end is
  // structural genre identity), and only when the mode actually has a pool —
  // an unknown mode keeps its stable piano default.
  const wildcard = modePool !== undefined
    && (ctx.role === 'lead' || ctx.role === 'chord')
    && seededRoll(`wildcard:${ctx.role}:${ctx.mode}`) < WILDCARD_CHANCE
  const safeWildcardIds = AUTO_TASTE_SAFE_BY_ROLE[ctx.role]
  const candidates = wildcard && safeWildcardIds
    ? allCandidates.filter(profile => safeWildcardIds.has(profile.id))
    : allCandidates
  let best = candidates[0] ?? INSTRUMENT_PERFORMERS_BY_ID.get(DEFAULT_BY_ROLE[ctx.role])!
  let bestScore = -Infinity

  for (const profile of candidates) {
    let score = 0
    const preferredIdx = preferred.indexOf(profile.id)
    if (!wildcard && preferredIdx >= 0) score += 12 - preferredIdx
    if (profile.modeBias.includes(ctx.mode)) score += 4
    if (ctx.energy > 0.7 && profile.tags.includes('aggressive')) score += 3
    if (ctx.energy < 0.35 && (profile.tags.includes('warm') || profile.tags.includes('air'))) score += 2
    if ((ctx.brightness ?? 0.5) > 0.65 && (profile.family === 'wind' || profile.family === 'brass')) score += 1
    if (profile.id === DEFAULT_BY_ROLE[ctx.role]) score += 0.5
    score += seededJitter(profile.id)

    if (score > bestScore) {
      bestScore = score
      best = profile
    }
  }

  return best
}

export function noteToMidi(note: string | number): number | null {
  if (typeof note === 'number') return Number.isFinite(note) ? note : null
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note)
  if (!match) return null
  const pc = NOTE_TO_PC[match[1]]
  const octave = Number.parseInt(match[2], 10)
  if (pc == null || !Number.isFinite(octave)) return null
  return (octave + 1) * 12 + pc
}

export function midiToNote(midi: number): string {
  const rounded = Math.round(midi)
  const pc = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  return `${PC_TO_NOTE[pc]}${octave}`
}

export function conformMidiToRange(midi: number, profile: InstrumentPerformerProfile): number {
  const [min, max] = profile.range
  let shifted = midi
  while (shifted < min) shifted += 12
  while (shifted > max) shifted -= 12
  return Math.max(min, Math.min(max, shifted))
}

export function conformNoteToInstrument(
  note: string | number,
  profile: InstrumentPerformerProfile,
): string | number {
  const midi = noteToMidi(note)
  if (midi == null) return note
  const conformed = conformMidiToRange(midi, profile)
  return typeof note === 'number' ? conformed : midiToNote(conformed)
}

export function conformChordToInstrument(
  notes: string[],
  profile: InstrumentPerformerProfile,
): string[] {
  const conformed = notes
    .map(note => conformNoteToInstrument(note, profile))
    .filter((note): note is string => typeof note === 'string')

  if (profile.polyphony === 'mono') {
    const top = conformed
      .map(note => ({ note, midi: noteToMidi(note) ?? -Infinity }))
      .sort((a, b) => b.midi - a.midi)[0]
    return top ? [top.note] : conformed.slice(0, 1)
  }

  const deduped: string[] = []
  for (const note of conformed) {
    if (!deduped.includes(note)) deduped.push(note)
  }
  return deduped.slice(0, profile.family === 'plucked' ? 4 : 6)
}
