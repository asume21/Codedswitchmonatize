/**
 * StylePresets — curated combinations of (drum pattern + chord technique +
 * bass articulation + melody articulation) that the composer picks from.
 *
 * Lives in shared/ because both the server-side composer (writes style id
 * into ArrangementSection) and the client-side Conductor + generators (look
 * up the bundle by id at runtime) need to agree on the bank. Single source
 * of truth.
 *
 * Design principle: cohesive music = curated taste, not random combinatorics.
 * Without this layer, the composer (or jam mode) has to pick each layer
 * independently — 20 chord techniques × 5 melody articulations × 4 bass
 * articulations × ~14 drum sub-genres = thousands of combos, most of which
 * sound terrible. This bank holds the ones that actually work together.
 *
 * Seed bank — expand as the user finds combos that sound right.
 */

export type StyleMood = 'dark' | 'warm' | 'energetic' | 'melancholic' | 'cool' | 'triumphant'

export interface StylePreset {
  id:                 string         // 'lofi-warm', 'trap-aggressive', etc.
  label:              string         // Human-readable for UI
  /** HipHopSubGenre key from the client drum pattern library. */
  drumPattern:        string
  /** Technique id from client/src/organism/techniques/library.ts */
  chordTechnique:     string
  /** Articulation id from client/src/organism/techniques/articulations.ts */
  bassArticulation:   string
  /** Articulation id from client/src/organism/techniques/articulations.ts */
  melodyArticulation: string
  fitsMood:           StyleMood[]
  fitsEnergy:         { min: number; max: number }
}

// ─────────────────────────────────────────────────────────────────────
// SEED BANK
// ─────────────────────────────────────────────────────────────────────
// Add new entries here as the user identifies combos that work.
// Keep entries small and well-tagged so the picker can find the right
// preset cheaply.

export const STYLE_PRESETS: StylePreset[] = [
  // ── Lo-fi / chill — slow, contemplative, melodic
  {
    id:                 'lofi-warm',
    label:              'Lo-fi Warm',
    drumPattern:        'chill',
    chordTechnique:     'piano-alberti',
    bassArticulation:   'bass-walking-step',
    melodyArticulation: 'grace-flick',
    fitsMood:           ['warm', 'melancholic', 'cool'],
    fitsEnergy:         { min: 0.0, max: 0.45 },
  },

  // ── Lo-fi tape echo — soft sustained keys with delayed lead movement
  {
    id:                 'lofi-tape-echo',
    label:              'Lo-fi Tape Echo',
    drumPattern:        'chill',
    chordTechnique:     'piano-sustained-pad',
    bassArticulation:   'bass-dub-sustain',
    melodyArticulation: 'delayed-echo',
    fitsMood:           ['cool', 'warm', 'melancholic'],
    fitsEnergy:         { min: 0.0, max: 0.50 },
  },

  // ── Lo-fi keys bounce — rolled chords, pickup bass, gentle lead flicks
  {
    id:                 'lofi-keys-bounce',
    label:              'Lo-fi Keys Bounce',
    drumPattern:        'chill',
    chordTechnique:     'piano-rolled-chord',
    bassArticulation:   'bass-pickup',
    melodyArticulation: 'scoop-up',
    fitsMood:           ['cool', 'warm'],
    fitsEnergy:         { min: 0.20, max: 0.60 },
  },

  // ── Trap — punchy, high energy
  {
    id:                 'trap-aggressive',
    label:              'Trap Aggressive',
    drumPattern:        'trap',
    chordTechnique:     'piano-block-chord',
    bassArticulation:   'bass-octave-jump',
    melodyArticulation: 'staccato-pop',
    fitsMood:           ['energetic', 'dark', 'triumphant'],
    fitsEnergy:         { min: 0.65, max: 1.0 },
  },

  // ── Trap bounce — punchy chords, octave bass movement, repeated hook lead
  {
    id:                 'trap-bounce-hook',
    label:              'Trap Bounce Hook',
    drumPattern:        'trap',
    chordTechnique:     'guitar-muted-stab',
    bassArticulation:   'bass-octave-walk',
    melodyArticulation: 'double-tap',
    fitsMood:           ['energetic', 'triumphant'],
    fitsEnergy:         { min: 0.60, max: 1.0 },
  },

  // ── R&B / smooth — silky, legato
  {
    id:                 'rnb-smooth',
    label:              'R&B Smooth',
    drumPattern:        'bounce',
    chordTechnique:     'piano-sustained-pad',
    bassArticulation:   'bass-slide-up',
    melodyArticulation: 'legato-slur',
    fitsMood:           ['warm', 'cool'],
    fitsEnergy:         { min: 0.35, max: 0.70 },
  },

  // ── R&B late-night — held chords, sustained low end, falling lead phrase
  {
    id:                 'rnb-late-night',
    label:              'R&B Late Night',
    drumPattern:        'bounce',
    chordTechnique:     'brass-section-pad',
    bassArticulation:   'bass-dub-sustain',
    melodyArticulation: 'fall-off',
    fitsMood:           ['warm', 'melancholic', 'cool'],
    fitsEnergy:         { min: 0.25, max: 0.65 },
  },

  // ── Boom-bap — classic, jazzy
  {
    id:                 'boombap-classic',
    label:              'Boom-bap Classic',
    drumPattern:        'chill',
    chordTechnique:     'piano-rolled-chord',
    bassArticulation:   'bass-walking-step',
    melodyArticulation: 'grace-flick',
    fitsMood:           ['warm', 'cool', 'melancholic'],
    fitsEnergy:         { min: 0.35, max: 0.65 },
  },

  // ── Boom-bap pocket — stabbed keys with pickup bass and scoop lead
  {
    id:                 'boombap-pocket',
    label:              'Boom-bap Pocket',
    drumPattern:        'chill',
    chordTechnique:     'piano-block-chord',
    bassArticulation:   'bass-pickup',
    melodyArticulation: 'scoop-up',
    fitsMood:           ['cool', 'warm'],
    fitsEnergy:         { min: 0.35, max: 0.70 },
  },

  // ── Drill — relentless, ghosting bass, sharp leads
  {
    id:                 'drill-relentless',
    label:              'Drill Relentless',
    drumPattern:        'trap',  // drill uses trap-style pattern with shifted accents
    chordTechnique:     'piano-block-chord',
    bassArticulation:   'bass-ghost-note',
    melodyArticulation: 'staccato-pop',
    fitsMood:           ['dark', 'energetic'],
    fitsEnergy:         { min: 0.7, max: 1.0 },
  },

  // ── Drill slide hook — dark stabs with a downbeat bass drop
  {
    id:                 'drill-slide-hook',
    label:              'Drill Slide Hook',
    drumPattern:        'trap',
    chordTechnique:     'strings-staccato',
    bassArticulation:   'bass-drop-slide',
    melodyArticulation: 'fall-off',
    fitsMood:           ['dark', 'energetic'],
    fitsEnergy:         { min: 0.65, max: 1.0 },
  },

  // ── Phonk — dark, distorted, brass stabs
  {
    id:                 'phonk-dark',
    label:              'Phonk Dark',
    drumPattern:        'trap',
    chordTechnique:     'brass-stab',
    bassArticulation:   'bass-octave-jump',
    melodyArticulation: 'staccato-pop',
    fitsMood:           ['dark', 'energetic'],
    fitsEnergy:         { min: 0.65, max: 1.0 },
  },

  // ── Jazz-rap — piano alberti, walking bass, grace flicks
  {
    id:                 'jazz-rap',
    label:              'Jazz Rap',
    drumPattern:        'chill',
    chordTechnique:     'piano-alberti',
    bassArticulation:   'bass-walking-step',
    melodyArticulation: 'grace-flick',
    fitsMood:           ['warm', 'cool'],
    fitsEnergy:         { min: 0.3, max: 0.6 },
  },

  // ── Cinematic — strings ensemble, melancholy
  {
    id:                 'cinematic-strings',
    label:              'Cinematic Strings',
    drumPattern:        'chill',
    chordTechnique:     'strings-legato',
    bassArticulation:   'bass-slide-up',
    melodyArticulation: 'trill-ornament',
    fitsMood:           ['melancholic', 'triumphant'],
    fitsEnergy:         { min: 0.4, max: 0.8 },
  },

  // ── Cypher — stripped, drums+bass only, for freestyling
  {
    id:                 'cypher-stripped',
    label:              'Cypher Stripped',
    drumPattern:        'chill',
    chordTechnique:     'piano-block-chord',     // minimal hits, voice owns the foreground
    bassArticulation:   'bass-walking-step',
    melodyArticulation: 'grace-flick',
    fitsMood:           ['cool', 'dark'],
    fitsEnergy:         { min: 0.35, max: 0.65 },
  },

  // ── Cypher call — simple keys with repeated lead answers
  {
    id:                 'cypher-call-response',
    label:              'Cypher Call Response',
    drumPattern:        'chill',
    chordTechnique:     'piano-block-chord',
    bassArticulation:   'bass-muted-pulse',
    melodyArticulation: 'double-tap',
    fitsMood:           ['cool', 'dark'],
    fitsEnergy:         { min: 0.35, max: 0.70 },
  },

  // ── Afrobeat — bright guitar arpeggios, sliding bass
  {
    id:                 'afrobeat-bright',
    label:              'Afrobeat Bright',
    drumPattern:        'afrobeat',
    chordTechnique:     'guitar-arp-rolled',
    bassArticulation:   'bass-slide-up',
    melodyArticulation: 'grace-flick',
    fitsMood:           ['warm', 'triumphant', 'energetic'],
    fitsEnergy:         { min: 0.5, max: 0.9 },
  },

  // ── Melodic trap — alberti chords with trap drums
  {
    id:                 'trap-melodic',
    label:              'Trap Melodic',
    drumPattern:        'trap',
    chordTechnique:     'piano-alberti',
    bassArticulation:   'bass-octave-jump',
    melodyArticulation: 'legato-slur',
    fitsMood:           ['melancholic', 'cool', 'warm'],
    fitsEnergy:         { min: 0.5, max: 0.85 },
  },

  // ── West-coast funk — Rhodes block chords, walking bass, grace flicks
  {
    id:                 'west-coast-funky',
    label:              'West-coast Funky',
    drumPattern:        'west-coast',
    chordTechnique:     'piano-rolled-chord',
    bassArticulation:   'bass-walking-step',
    melodyArticulation: 'grace-flick',
    fitsMood:           ['warm', 'cool'],
    fitsEnergy:         { min: 0.45, max: 0.75 },
  },

  // ── Funk pocket — muted chord chops, ghosted bass, clipped lead
  {
    id:                 'funk-muted-pocket',
    label:              'Funk Muted Pocket',
    drumPattern:        'west-coast',
    chordTechnique:     'guitar-muted-stab',
    bassArticulation:   'bass-ghost-note',
    melodyArticulation: 'staccato-pop',
    fitsMood:           ['warm', 'cool', 'energetic'],
    fitsEnergy:         { min: 0.45, max: 0.85 },
  },

  // ── Funk bounce — brighter chords, octave bass movement, horn-like lead
  {
    id:                 'funk-bounce-keys',
    label:              'Funk Bounce Keys',
    drumPattern:        'west-coast',
    chordTechnique:     'piano-rolled-chord',
    bassArticulation:   'bass-octave-jump',
    melodyArticulation: 'grace-flick',
    fitsMood:           ['warm', 'energetic'],
    fitsEnergy:         { min: 0.50, max: 0.90 },
  },

  // ── Funk guitar roll — plucked arps with a walking low end
  {
    id:                 'funk-guitar-roll',
    label:              'Funk Guitar Roll',
    drumPattern:        'west-coast',
    chordTechnique:     'guitar-arp-rolled',
    bassArticulation:   'bass-walking-step',
    melodyArticulation: 'staccato-pop',
    fitsMood:           ['cool', 'warm'],
    fitsEnergy:         { min: 0.40, max: 0.75 },
  },

  // ── Soulful ballad — sustained pad, slide bass, ornament leads
  {
    id:                 'soulful-ballad',
    label:              'Soulful Ballad',
    drumPattern:        'bounce',
    chordTechnique:     'piano-sustained-pad',
    bassArticulation:   'bass-slide-up',
    melodyArticulation: 'trill-ornament',
    fitsMood:           ['melancholic', 'warm'],
    fitsEnergy:         { min: 0.25, max: 0.6 },
  },

  // ── Cloud rap — sustained pads, slide bass, floating leads
  {
    id:                 'cloud-floaty',
    label:              'Cloud Floaty',
    drumPattern:        'chill',
    chordTechnique:     'piano-sustained-pad',
    bassArticulation:   'bass-slide-up',
    melodyArticulation: 'legato-slur',
    fitsMood:           ['cool', 'warm', 'melancholic'],
    fitsEnergy:         { min: 0.2, max: 0.55 },
  },

  // ── Bounce — guitar arpeggios over bounce drums
  {
    id:                 'bounce-bright',
    label:              'Bounce Bright',
    drumPattern:        'bounce',
    chordTechnique:     'guitar-arp-rolled',
    bassArticulation:   'bass-octave-jump',
    melodyArticulation: 'staccato-pop',
    fitsMood:           ['energetic', 'triumphant', 'warm'],
    fitsEnergy:         { min: 0.55, max: 0.9 },
  },

  // ── Orchestral trap — strings pizzicato, octave bass, staccato pop
  {
    id:                 'orchestral-trap',
    label:              'Orchestral Trap',
    drumPattern:        'trap',
    chordTechnique:     'strings-pizzicato',
    bassArticulation:   'bass-octave-jump',
    melodyArticulation: 'staccato-pop',
    fitsMood:           ['dark', 'triumphant', 'energetic'],
    fitsEnergy:         { min: 0.7, max: 1.0 },
  },

  // ── Story mode — sparse, narrative, voice-forward
  {
    id:                 'story-narrative',
    label:              'Story Narrative',
    drumPattern:        'chill',
    chordTechnique:     'piano-sustained-pad',
    bassArticulation:   'bass-walking-step',
    melodyArticulation: 'grace-flick',           // sparse, but never silent when soloed
    fitsMood:           ['melancholic', 'cool'],
    fitsEnergy:         { min: 0.2, max: 0.5 },
  },

  // ── Story piano — emotional rolled chords with a real lead thread
  {
    id:                 'story-piano-roll',
    label:              'Story Piano Roll',
    drumPattern:        'chill',
    chordTechnique:     'piano-rolled-chord',
    bassArticulation:   'bass-walking-step',
    melodyArticulation: 'grace-flick',
    fitsMood:           ['melancholic', 'cool', 'warm'],
    fitsEnergy:         { min: 0.20, max: 0.60 },
  },

  // ── Story strings — sustained cinematic bed, smooth melody line
  {
    id:                 'story-strings-pad',
    label:              'Story Strings Pad',
    drumPattern:        'chill',
    chordTechnique:     'strings-legato',
    bassArticulation:   'bass-walking-step',
    melodyArticulation: 'legato-slur',
    fitsMood:           ['melancholic', 'triumphant', 'cool'],
    fitsEnergy:         { min: 0.25, max: 0.70 },
  },

  // ── Story pizzicato — plucked string pulse with ornamented lead
  {
    id:                 'story-pizzicato',
    label:              'Story Pizzicato',
    drumPattern:        'chill',
    chordTechnique:     'strings-pizzicato',
    bassArticulation:   'bass-walking-step',
    melodyArticulation: 'grace-flick',
    fitsMood:           ['melancholic', 'dark', 'cool'],
    fitsEnergy:         { min: 0.35, max: 0.75 },
  },
]

// ─────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────

const PRESETS_BY_ID = new Map(STYLE_PRESETS.map(p => [p.id, p]))

export function getStylePreset(id: string): StylePreset | null {
  return PRESETS_BY_ID.get(id) ?? null
}

/**
 * Pick the best-fitting StylePreset for a section's energy + mood + subGenre.
 *
 * Scoring (higher = better fit):
 *   +2  if the preset's drumPattern matches the requested subGenre
 *   +2  if the preset's mood list contains the requested mood
 *   +1  if the requested energy falls inside the preset's fitsEnergy range
 *
 * Ties broken by declaration order (first entry wins). Falls back to the
 * first preset if no positive matches — the bank is never empty.
 */
export function pickStylePreset(opts: {
  energy:   number
  mood:     string
  subGenre: string
  candidates?: StylePreset[]
}): StylePreset | null {
  const pool = opts.candidates && opts.candidates.length > 0
    ? opts.candidates
    : STYLE_PRESETS
  if (pool.length === 0) return null

  let bestScore = -Infinity
  let best:      StylePreset | null = null

  for (const preset of pool) {
    let score = 0
    if (preset.drumPattern === opts.subGenre) score += 2
    if (preset.fitsMood.includes(opts.mood as StyleMood)) score += 2
    if (opts.energy >= preset.fitsEnergy.min && opts.energy <= preset.fitsEnergy.max) score += 1
    if (score > bestScore) {
      bestScore = score
      best      = preset
    }
  }

  return best ?? pool[0]
}

export function listStylePresetIds(): string[] {
  return STYLE_PRESETS.map(p => p.id)
}
