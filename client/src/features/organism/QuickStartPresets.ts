/**
 * QUICK START PRESETS
 *
 * Pre-configured physics snapshots that let the Organism skip the cold start
 * (Dormant → Awakening → Breathing) and jump straight into beat generation.
 *
 * Each preset defines:
 *  - A synthetic PhysicsState snapshot (as if the user had been freestyling for 30s)
 *  - A target BPM
 *  - A target OrganismMode
 *  - A human-readable label and genre tag
 *
 * The Organism remains fully reactive after quick start — it just skips the warm-up.
 */

import { OrganismMode } from '../../organism/physics/types'
import type { PhysicsState } from '../../organism/physics/types'
import type { HipHopSubGenre } from '../../organism/state/MusicalState'

export interface QuickStartPreset {
  id:          string
  label:       string
  genre:       string
  bpm:         number
  mode:        OrganismMode
  subGenre?:   HipHopSubGenre
  allowedTemplateIds?: string[]
  allowedStyleIds?:    string[]
  energy:      'low' | 'medium' | 'high'
  icon:        string
  physics:     PhysicsState
  loopPackId?: string    // ID of the LoopPack to load when Loops Mode is ON
}

function makePhysics(overrides: Partial<PhysicsState> & { mode: OrganismMode; pulse: number }): PhysicsState {
  const beatDurationMs = 60000 / overrides.pulse
  return {
    bounce:              overrides.bounce   ?? 0.5,
    swing:               overrides.swing    ?? 0.3,
    pocket:              overrides.pocket   ?? 0.4,
    presence:            overrides.presence ?? 0.6,
    density:             overrides.density  ?? 0.5,
    mode:                overrides.mode,
    pulse:               overrides.pulse,
    beatDurationMs,
    sixteenthDurationMs: beatDurationMs / 4,
    swungSixteenthMs:    (beatDurationMs / 4) * (overrides.swing ?? 0.3) * 2,
    timestamp:           performance.now(),
    frameIndex:          0,
    voiceActive:         false,
  }
}

export const QUICK_START_PRESETS: QuickStartPreset[] = [
  {
    id:       'ref-lucid-dreams-80',
    label:    'Lucid',
    genre:    'Reference / Melodic Emo Trap',
    bpm:      80,
    mode:     OrganismMode.Glow,
    subGenre: 'chill',
    allowedTemplateIds: ['storytelling', 'slow-burn', 'classic', 'bridge-heavy'],
    energy:   'low',
    icon:     '✨',
    physics: makePhysics({
      mode:     OrganismMode.Glow,
      pulse:    80,
      bounce:   0.38,
      swing:    0.50,
      pocket:   0.62,
      presence: 0.42,
      density:  0.32,
    }),
  },
  {
    id:       'ref-dababy-140',
    label:    'DaBaby',
    genre:    'Reference / Bounce Trap',
    bpm:      140,
    mode:     OrganismMode.Heat,
    subGenre: 'trap',
    allowedTemplateIds: ['trap-tag', 'hook-heavy', 'dropfirst', 'classic'],
    energy:   'high',
    icon:     '🔥',
    physics: makePhysics({
      mode:     OrganismMode.Heat,
      pulse:    140,
      bounce:   0.72,
      swing:    0.18,
      pocket:   0.34,
      presence: 0.74,
      density:  0.58,
    }),
  },
  {
    id:       'ref-violin-trap-130',
    label:    'Violin Trap',
    genre:    'Reference / Orchestral Trap',
    bpm:      130,
    mode:     OrganismMode.Glow,
    subGenre: 'trap',
    allowedTemplateIds: ['storytelling', 'slow-burn', 'classic', 'bridge-heavy'],
    energy:   'medium',
    icon:     '🎻',
    physics: makePhysics({
      mode:     OrganismMode.Glow,
      pulse:    130,
      bounce:   0.58,
      swing:    0.24,
      pocket:   0.44,
      presence: 0.62,
      density:  0.50,
    }),
  },
  {
    id:       'ref-weekend-110',
    label:    'Weekend',
    genre:    'Reference / R&B Pop Trap',
    bpm:      110,
    mode:     OrganismMode.Glow,
    subGenre: 'bounce',
    allowedTemplateIds: ['storytelling', 'classic', 'bridge-heavy', 'slow-burn'],
    energy:   'medium',
    icon:     '❄️',
    physics: makePhysics({
      mode:     OrganismMode.Glow,
      pulse:    110,
      bounce:   0.56,
      swing:    0.32,
      pocket:   0.52,
      presence: 0.54,
      density:  0.42,
    }),
  },
  {
    id:       'ref-alt-pop-120',
    label:    'Ref 05',
    genre:    'Reference / Alt Pop Trap',
    bpm:      120,
    mode:     OrganismMode.Glow,
    subGenre: 'afrobeat',
    allowedTemplateIds: ['classic', 'hook-heavy', 'back-and-forth', 'storytelling'],
    energy:   'medium',
    icon:     '〰',
    physics: makePhysics({
      mode:     OrganismMode.Glow,
      pulse:    120,
      bounce:   0.62,
      swing:    0.34,
      pocket:   0.48,
      presence: 0.58,
      density:  0.46,
    }),
  },
  {
    id:       'ref-dark-pocket-96',
    label:    'Ref 06',
    genre:    'Reference / Dark Pocket',
    bpm:      96,
    mode:     OrganismMode.Smoke,
    subGenre: 'west-coast',
    allowedTemplateIds: ['storytelling', 'bridge-heavy', 'slow-burn', 'classic'],
    energy:   'medium',
    icon:     '◌',
    physics: makePhysics({
      mode:     OrganismMode.Smoke,
      pulse:    96,
      bounce:   0.50,
      swing:    0.46,
      pocket:   0.60,
      presence: 0.50,
      density:  0.38,
    }),
  },
  {
    id:     'trap-140',
    label:  'Trap 144',
    genre:  'Trap / Hard',
    bpm:    144,
    mode:   OrganismMode.Heat,
    subGenre: 'trap',
    allowedTemplateIds: ['trap-tag', 'hook-heavy', 'dropfirst', 'classic'],
    energy: 'high',
    icon:   '🔥',
    physics: makePhysics({
      mode:     OrganismMode.Heat,
      pulse:    144,
      bounce:   0.7,
      swing:    0.15,
      pocket:   0.3,
      presence: 0.7,
      density:  0.58,
    }),
  },
  {
    id:     'melodic-trap-136',
    label:  'Melodic Trap',
    genre:  'Melodic / Reference',
    bpm:    136,
    mode:   OrganismMode.Glow,
    subGenre: 'trap',
    allowedTemplateIds: ['storytelling', 'slow-burn', 'classic', 'bridge-heavy'],
    energy: 'medium',
    icon:   '🎻',
    physics: makePhysics({
      mode:     OrganismMode.Glow,
      pulse:    136,
      bounce:   0.52,
      swing:    0.18,
      pocket:   0.42,
      presence: 0.55,
      density:  0.5,
    }),
  },
  {
    id:     'lofi-85',
    label:  'Lo-fi',
    genre:  'Lo-fi / Chill',
    bpm:    85,
    mode:   OrganismMode.Ice,
    subGenre: 'chill',
    allowedTemplateIds: ['lofi-loop', 'storytelling', 'slow-burn', 'bridge-heavy'],
    allowedStyleIds:    ['lofi-warm', 'lofi-tape-echo', 'lofi-keys-bounce', 'cloud-floaty', 'jazz-rap', 'boombap-classic'],
    energy: 'low',
    icon:   '❄️',
    physics: makePhysics({
      mode:     OrganismMode.Ice,
      pulse:    85,
      bounce:   0.3,
      swing:    0.55,
      pocket:   0.6,
      presence: 0.35,
      density:  0.3,
    }),
  },
  {
    id:     'boombap-90',
    label:  'Boom-bap',
    genre:  'hip-hop',
    bpm:    90,
    mode:   OrganismMode.Smoke,
    subGenre: 'boom-bap',
    allowedTemplateIds: ['storytelling', 'classic', 'bridge-heavy', 'slow-burn'],
    loopPackId: 'hip-hop-classic',
    energy: 'medium',
    icon:   '💨',
    physics: makePhysics({
      mode:     OrganismMode.Smoke,
      pulse:    90,
      bounce:   0.55,
      swing:    0.45,
      pocket:   0.5,
      presence: 0.55,
      density:  0.45,
    }),
  },
  {
    id:     'drill-140',
    label:  'Drill 144',
    genre:  'Drill / Dark',
    bpm:    144,
    mode:   OrganismMode.Gravel,
    subGenre: 'drill',
    allowedTemplateIds: ['trap-tag', 'hook-heavy', 'dropfirst', 'classic'],
    energy: 'high',
    icon:   '⚡',
    physics: makePhysics({
      mode:     OrganismMode.Gravel,
      pulse:    144,
      bounce:   0.65,
      swing:    0.1,
      pocket:   0.25,
      presence: 0.7,
      density:  0.6,
    }),
  },
  {
    id:     'chill-75',
    label:  'Chill',
    genre:  'Chill / Melodic',
    bpm:    75,
    mode:   OrganismMode.Glow,
    subGenre: 'chill',
    allowedTemplateIds: ['lofi-loop', 'storytelling', 'slow-burn', 'bridge-heavy'],
    allowedStyleIds:    ['lofi-warm', 'lofi-tape-echo', 'lofi-keys-bounce', 'cloud-floaty', 'jazz-rap', 'boombap-classic', 'soulful-ballad', 'rnb-late-night'],
    energy: 'low',
    icon:   '✨',
    physics: makePhysics({
      mode:     OrganismMode.Glow,
      pulse:    75,
      bounce:   0.25,
      swing:    0.5,
      pocket:   0.65,
      presence: 0.3,
      density:  0.25,
    }),
  },
  {
    id:     'funk-100',
    label:  'Funk',
    genre:  'Funk / Groove',
    bpm:    100,
    mode:   OrganismMode.Smoke,
    subGenre: 'west-coast',
    allowedTemplateIds: ['back-and-forth', 'classic', 'hook-heavy', 'bridge-heavy'],
    allowedStyleIds:    ['west-coast-funky', 'funk-muted-pocket', 'funk-bounce-keys', 'funk-guitar-roll', 'boombap-pocket'],
    energy: 'medium',
    icon:   '🎸',
    physics: makePhysics({
      mode:     OrganismMode.Smoke,
      pulse:    100,
      bounce:   0.6,
      swing:    0.6,
      pocket:   0.55,
      presence: 0.6,
      density:  0.5,
    }),
  },

  // ── Cypher: stripped-back freestyle loop ────────────────────────────
  // Designed for freestyling OVER, not producing alongside.
  // Differs from boombap-90 by: lower density (0.25 vs 0.45), higher pocket
  // (0.7 — locked loop feel), lower presence (0.45 — beat recedes for voice).
  // Chord generator stays sparse; melody is nearly absent. Pure drums+bass
  // pocket with vinyl texture. 2-bar loop that hypnotizes.
  {
    id:     'cypher-90',
    label:  'Cypher',
    genre:  'Cypher / Freestyle',
    bpm:    90,
    mode:   OrganismMode.Smoke,
    subGenre: 'chill',
    allowedTemplateIds: ['cypher-flow', 'storytelling', 'minimal-jam'],
    allowedStyleIds:    ['cypher-stripped', 'cypher-call-response', 'boombap-pocket'],
    energy: 'medium',
    icon:   '🎤',
    physics: makePhysics({
      mode:     OrganismMode.Smoke,
      pulse:    90,
      bounce:   0.5,
      swing:    0.55,    // Boom-bap swing, head-nod pocket
      pocket:   0.7,     // High pocket = tight loop feel
      presence: 0.45,    // Low presence = beat sits back for the rapper
      density:  0.25,    // Sparse — just drums + bass + occasional Rhodes hit
    }),
  },

  // ── Storytelling: cinematic, piano-led, contemplative ───────────────
  // Slower (80 BPM), moodier, jazz-inflected chord voicings. The chord
  // generator runs in Pad behavior (long sustained chords). Drums are
  // dusty and reverberant. Strings pad in background. Voice is lead.
  // Think Nas "N.Y. State of Mind", Kendrick "Sing About Me", J. Cole.
  {
    id:     'storytelling-80',
    label:  'Story',
    genre:  'Storytelling / Narrative',
    bpm:    80,
    mode:   OrganismMode.Smoke,
    subGenre: 'chill',
    allowedTemplateIds: ['storytelling', 'slow-burn', 'bridge-heavy', 'classic'],
    allowedStyleIds:    ['story-piano-roll', 'story-strings-pad', 'story-pizzicato', 'story-narrative', 'lofi-warm', 'lofi-tape-echo', 'cloud-floaty', 'boombap-pocket'],
    energy: 'low',
    icon:   '📖',
    physics: makePhysics({
      mode:     OrganismMode.Smoke,
      pulse:    80,
      bounce:   0.35,    // Lower bounce = more contemplative, less head-nod
      swing:    0.55,    // Jazzy swing, spacious
      pocket:   0.55,    // Medium pocket — room for voice to bend time
      presence: 0.35,    // Very low presence = cinematic, voice-forward
      density:  0.2,     // Extremely sparse — piano pad + drums + upright bass
    }),
  },

  // ── REAL BEAT PRESETS ─────────────────────────────────────────────────
  // These presets are tuned to push the existing generator architecture to
  // its realistic ceiling: a coherent, genre-authentic beat that sounds like
  // a real producer's demo. They use the strongest arrangement templates,
  // the best style presets, and physics values chosen for the genre.

  // ── Real Beat: Trap ───────────────────────────────────────────────────
  // Modern 140 BPM trap. Hard 808, tight hats, sparse melody hook. The
  // sub-genre forces Slide808 bass behavior, trap drum patterns, and the
  // trap-tag arrangement gives a verse → verse → hook → breakdown → hook arc.
  {
    id:     'real-beat-trap-140',
    label:  'Real Beat: Trap',
    genre:  'Real Beat / Trap',
    bpm:    140,
    mode:   OrganismMode.Heat,
    subGenre: 'trap',
    allowedTemplateIds: ['trap-tag', 'hook-heavy', 'dropfirst'],
    allowedStyleIds:    ['trap-aggressive', 'trap-bounce-hook', 'trap-melodic'],
    energy: 'high',
    icon:   '🔥',
    physics: makePhysics({
      mode:     OrganismMode.Heat,
      pulse:    140,
      bounce:   0.72,
      swing:    0.12,
      pocket:   0.32,
      presence: 0.78,
      density:  0.60,
    }),
  },

  // ── Real Beat: Boom-bap ───────────────────────────────────────────────
  // Classic 90 BPM boom-bap. Dusty drums, walking bass, jazzy chords, and a
  // melody that stays out of the rapper's way. Uses storytelling/cypher-flow
  // templates so the form is voice-first, not hook-heavy.
  {
    id:     'real-beat-boombap-90',
    label:  'Real Beat: Boom-bap',
    genre:  'Real Beat / Boom-bap',
    bpm:    90,
    mode:   OrganismMode.Smoke,
    subGenre: 'boom-bap',
    allowedTemplateIds: ['storytelling', 'cypher-flow', 'classic'],
    allowedStyleIds:    ['boombap-classic', 'boombap-pocket', 'jazz-rap'],
    energy: 'medium',
    icon:   '💿',
    physics: makePhysics({
      mode:     OrganismMode.Smoke,
      pulse:    90,
      bounce:   0.58,
      swing:    0.52,
      pocket:   0.62,
      presence: 0.55,
      density:  0.42,
    }),
  },

  // ── Real Beat: Drill ──────────────────────────────────────────────────
  // Dark 144 BPM drill. Sliding 808s, off-beat snare ghosting, sharp stabs.
  // The drill-slide-hook style brings the signature downbeat bass drop and
  // a sparse hook melody that lets the vocal be the main event.
  {
    id:     'real-beat-drill-144',
    label:  'Real Beat: Drill',
    genre:  'Real Beat / Drill',
    bpm:    144,
    mode:   OrganismMode.Gravel,
    subGenre: 'drill',
    allowedTemplateIds: ['trap-tag', 'dropfirst', 'classic'],
    allowedStyleIds:    ['drill-relentless', 'drill-slide-hook', 'trap-aggressive'],
    energy: 'high',
    icon:   '⚡',
    physics: makePhysics({
      mode:     OrganismMode.Gravel,
      pulse:    144,
      bounce:   0.68,
      swing:    0.10,
      pocket:   0.28,
      presence: 0.80,
      density:  0.62,
    }),
  },
]

/** Look up a preset by id, returns undefined if not found. */
export function getQuickStartPreset(id: string): QuickStartPreset | undefined {
  return QUICK_START_PRESETS.find(p => p.id === id)
}
