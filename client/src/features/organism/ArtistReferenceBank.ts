/**
 * ArtistReferenceBank
 *
 * Rule-based fallback interpreter for the Natural Language Vibe feature.
 * Used when the AI endpoint (/api/organism/interpret-vibe) is unavailable.
 *
 * No async calls, no external dependencies — deterministic and instant.
 * Covers artist references, genre keywords, and energy/mood modifiers.
 */

export interface VibeParams {
  bpm:            number
  mode:           'heat' | 'ice' | 'smoke' | 'gravel' | 'glow'
  subGenre:       string
  energy:         number
  swing:          number
  bounce:         number
  density:        number
  interpretation: string
  confidence:     number
  // Optional instrument overrides — null means "keep current / Auto"
  instrumentLead?:  string | null
  instrumentBass?:  string | null
  instrumentChord?: string | null
  // Emotional intent shapes melody dynamics and scale (sad = minor, beautiful = lush 7ths)
  emotionalIntent?: 'sad' | 'beautiful' | null
  // Progressive intro: instruments enter one at a time (melody → chords → bass → drums)
  // instead of all at once. True for reflective/storytelling/emotional moods.
  progressiveIntro?: boolean
}

// ── Artist reference map ───────────────────────────────────────────────────
// Each entry captures the musical DNA of that artist's signature sound.
// Parameters derived from their most iconic production style.

const ARTIST_REFS: Array<{ keys: string[]; params: VibeParams }> = [
  {
    keys: ['tupac', '2pac', 'pac'],
    params: { bpm: 90, mode: 'gravel', subGenre: 'west-coast', energy: 0.60, swing: 0.55, bounce: 0.50, density: 0.40,
      interpretation: 'West coast boom-bap — soulful, heavy swing, 90 BPM', confidence: 0.92 },
  },
  {
    keys: ['eminem', 'slim shady', 'marshall'],
    params: { bpm: 105, mode: 'heat', subGenre: 'boom-bap', energy: 0.80, swing: 0.45, bounce: 0.60, density: 0.60,
      interpretation: 'Detroit boom-bap — aggressive, driving, 105 BPM', confidence: 0.92 },
  },
  {
    keys: ['drake', 'drizzy'],
    params: { bpm: 80, mode: 'glow', subGenre: 'chill', energy: 0.40, swing: 0.60, bounce: 0.40, density: 0.30,
      interpretation: 'Drake vibes — smooth, melodic, chill, 80 BPM', confidence: 0.92 },
  },
  {
    keys: ['kendrick', 'kdot', 'kendrick lamar'],
    params: { bpm: 88, mode: 'gravel', subGenre: 'boom-bap', energy: 0.65, swing: 0.65, bounce: 0.55, density: 0.50,
      interpretation: 'Kendrick conscious boom-bap — complex, soulful, 88 BPM', confidence: 0.92 },
  },
  {
    keys: ['travis', 'travis scott', 'la flame', 'cactus jack'],
    params: { bpm: 140, mode: 'ice', subGenre: 'trap', energy: 0.80, swing: 0.30, bounce: 0.70, density: 0.70,
      interpretation: 'Travis trap — atmospheric, hypnotic, 140 BPM', confidence: 0.92 },
  },
  {
    keys: ['j cole', 'jcole', 'cole'],
    params: { bpm: 85, mode: 'glow', subGenre: 'boom-bap', energy: 0.55, swing: 0.60, bounce: 0.50, density: 0.40,
      interpretation: 'J Cole boom-bap — thoughtful, warm, 85 BPM', confidence: 0.90 },
  },
  {
    keys: ['future', 'future hendrix', 'freebandz'],
    params: { bpm: 130, mode: 'ice', subGenre: 'trap', energy: 0.75, swing: 0.35, bounce: 0.65, density: 0.65,
      interpretation: 'Future trap — hazy, melodic, dark, 130 BPM', confidence: 0.90 },
  },
  {
    keys: ['nas', 'nasty nas'],
    params: { bpm: 92, mode: 'gravel', subGenre: 'boom-bap', energy: 0.60, swing: 0.50, bounce: 0.45, density: 0.45,
      interpretation: 'Nas classic boom-bap — raw, lyrical, 92 BPM', confidence: 0.90 },
  },
  {
    keys: ['21 savage', '21savage', 'savage'],
    params: { bpm: 140, mode: 'heat', subGenre: 'trap', energy: 0.75, swing: 0.30, bounce: 0.60, density: 0.65,
      interpretation: '21 Savage trap — dark, minimal, hard, 140 BPM', confidence: 0.88 },
  },
  {
    keys: ['pop smoke', 'pop'],
    params: { bpm: 140, mode: 'gravel', subGenre: 'drill', energy: 0.85, swing: 0.25, bounce: 0.70, density: 0.70,
      interpretation: 'UK drill — heavy, dark, menacing, 140 BPM', confidence: 0.90 },
  },
  {
    keys: ['chief keef', 'keef'],
    params: { bpm: 145, mode: 'gravel', subGenre: 'drill', energy: 0.90, swing: 0.20, bounce: 0.75, density: 0.75,
      interpretation: 'Chicago drill — hard, relentless, 145 BPM', confidence: 0.90 },
  },
  {
    keys: ['gunna', 'wunna', 'drip or drown'],
    params: { bpm: 142, mode: 'ice', subGenre: 'trap', energy: 0.70, swing: 0.30, bounce: 0.65, density: 0.60,
      interpretation: 'Gunna drip trap — smooth, cool, 142 BPM', confidence: 0.88 },
  },
  {
    keys: ['lil baby', 'lilbaby'],
    params: { bpm: 142, mode: 'heat', subGenre: 'trap', energy: 0.78, swing: 0.28, bounce: 0.65, density: 0.65,
      interpretation: 'Lil Baby trap — melodic, energetic, 142 BPM', confidence: 0.88 },
  },
  {
    keys: ['polo g', 'polo'],
    params: { bpm: 138, mode: 'ice', subGenre: 'trap', energy: 0.72, swing: 0.30, bounce: 0.60, density: 0.55,
      interpretation: 'Polo G melodic trap — introspective, 138 BPM', confidence: 0.88 },
  },
  {
    keys: ['rod wave', 'rodwave'],
    params: { bpm: 80, mode: 'glow', subGenre: 'chill', energy: 0.45, swing: 0.55, bounce: 0.40, density: 0.35,
      interpretation: 'Rod Wave emotional — slow, soulful, 80 BPM', confidence: 0.88 },
  },
  {
    keys: ['playboi carti', 'carti', 'opium'],
    params: { bpm: 140, mode: 'ice', subGenre: 'trap', energy: 0.85, swing: 0.20, bounce: 0.80, density: 0.75,
      interpretation: 'Carti trap — hypnotic, bouncy, 140 BPM', confidence: 0.88 },
  },
]

// ── Genre keyword map ──────────────────────────────────────────────────────
// Matched in order — first match wins.

const GENRE_REFS: Array<{ keys: string[]; partial: Partial<VibeParams> & { interpretation: string } }> = [
  {
    keys: ['uk drill', 'ukdrill'],
    partial: { bpm: 140, mode: 'gravel', subGenre: 'drill', energy: 0.88, swing: 0.22, bounce: 0.72, density: 0.72,
      interpretation: 'UK drill — dark, heavy, 140 BPM', confidence: 0.85 },
  },
  {
    keys: ['chicago drill', 'chi drill'],
    partial: { bpm: 145, mode: 'gravel', subGenre: 'drill', energy: 0.90, swing: 0.20, bounce: 0.75, density: 0.75,
      interpretation: 'Chicago drill — relentless, 145 BPM', confidence: 0.85 },
  },
  {
    keys: ['drill'],
    partial: { bpm: 145, mode: 'gravel', subGenre: 'drill', energy: 0.87, swing: 0.22, bounce: 0.72, density: 0.72,
      interpretation: 'Drill — dark, offbeat hats, 145 BPM', confidence: 0.82 },
  },
  {
    keys: ['phonk'],
    partial: { bpm: 130, mode: 'heat', subGenre: 'phonk', energy: 0.80, swing: 0.40, bounce: 0.70, density: 0.70,
      interpretation: 'Phonk — Memphis dark, cowbell, 130 BPM', confidence: 0.83 },
  },
  {
    keys: ['boom bap', 'boom-bap', 'boomba'],
    partial: { bpm: 90, mode: 'smoke', subGenre: 'boom-bap', energy: 0.60, swing: 0.60, bounce: 0.50, density: 0.45,
      interpretation: 'Classic boom-bap — heavy swing, 90 BPM', confidence: 0.83 },
  },
  {
    keys: ['west coast', 'westcoast', 'g-funk', 'gfunk'],
    partial: { bpm: 90, mode: 'gravel', subGenre: 'west-coast', energy: 0.60, swing: 0.55, bounce: 0.50, density: 0.40,
      interpretation: 'West coast G-funk — soulful bounce, 90 BPM', confidence: 0.83 },
  },
  {
    keys: ['lo-fi', 'lofi', 'lo fi', 'chillhop'],
    partial: { bpm: 78, mode: 'ice', subGenre: 'lo-fi', energy: 0.35, swing: 0.65, bounce: 0.35, density: 0.30,
      interpretation: 'Lo-fi beats — dusty, warm, 78 BPM', confidence: 0.83 },
  },
  {
    keys: ['dirty south', 'dirtysouth', 'crunk'],
    partial: { bpm: 100, mode: 'smoke', subGenre: 'dirty-south', energy: 0.72, swing: 0.45, bounce: 0.65, density: 0.65,
      interpretation: 'Dirty south — heavy bass, call-response, 100 BPM', confidence: 0.83 },
  },
  {
    keys: ['trap'],
    partial: { bpm: 140, mode: 'heat', subGenre: 'trap', energy: 0.75, swing: 0.30, bounce: 0.65, density: 0.65,
      interpretation: 'Trap — 808s, hats, 140 BPM', confidence: 0.80 },
  },
  {
    keys: ['chill', 'relaxed', 'laid back', 'laid-back'],
    partial: { bpm: 80, mode: 'glow', subGenre: 'chill', energy: 0.35, swing: 0.50, bounce: 0.40, density: 0.30,
      interpretation: 'Chill — sparse, atmospheric, 80 BPM', confidence: 0.80,
      emotionalIntent: 'beautiful', progressiveIntro: true },
  },
  // ── Mood / emotion keywords ────────────────────────────────────────────────
  {
    keys: ['reflective', 'self-reflective', 'introspective', 'contemplative'],
    partial: { bpm: 80, mode: 'glow', subGenre: 'chill', energy: 0.30, swing: 0.52, bounce: 0.35, density: 0.25,
      interpretation: 'Reflective — quiet, introspective, starts with a melody and builds slowly', confidence: 0.83,
      emotionalIntent: 'sad', progressiveIntro: true },
  },
  {
    keys: ['melancholy', 'melancholic'],
    partial: { bpm: 72, mode: 'smoke', subGenre: 'boom-bap', energy: 0.28, swing: 0.50, bounce: 0.33, density: 0.25,
      interpretation: 'Melancholy — dark, cinematic, minor key, builds from piano', confidence: 0.83,
      emotionalIntent: 'sad', progressiveIntro: true },
  },
  {
    keys: ['sad beat', 'emotional beat', 'heartbreak', 'grief'],
    partial: { bpm: 75, mode: 'smoke', subGenre: 'chill', energy: 0.28, swing: 0.55, bounce: 0.32, density: 0.22,
      interpretation: 'Emotional — slow, heavy, minor key', confidence: 0.82,
      emotionalIntent: 'sad', progressiveIntro: true },
  },
  {
    keys: ['upbeat', 'feel good', 'feelgood', 'positive', 'happy beat', 'bright'],
    partial: { bpm: 115, mode: 'glow', subGenre: 'bounce', energy: 0.70, swing: 0.38, bounce: 0.68, density: 0.55,
      interpretation: 'Upbeat — bright, positive, major key, punchy groove', confidence: 0.80,
      emotionalIntent: 'beautiful', progressiveIntro: true },
  },
  {
    keys: ['storytelling', 'story beat', 'narrative', 'poetic'],
    partial: { bpm: 92, mode: 'smoke', subGenre: 'west-coast', energy: 0.55, swing: 0.52, bounce: 0.48, density: 0.42,
      interpretation: 'Storytelling — deep groove, narrative feel, builds into the bars', confidence: 0.82,
      emotionalIntent: 'sad', progressiveIntro: true },
  },
  {
    keys: ['epic', 'dramatic', 'grand', 'orchestral beat', 'cinematic beat'],
    partial: { bpm: 100, mode: 'glow', subGenre: 'afrobeat', energy: 0.72, swing: 0.35, bounce: 0.60, density: 0.52,
      interpretation: 'Epic — cinematic, builds dramatically from strings', confidence: 0.82,
      emotionalIntent: 'beautiful', progressiveIntro: true },
  },
  {
    keys: ['beautiful', 'lush', 'gorgeous', 'beautiful beat'],
    partial: { bpm: 85, mode: 'glow', subGenre: 'chill', energy: 0.42, swing: 0.48, bounce: 0.42, density: 0.35,
      interpretation: 'Beautiful — lush, warm, 7th and 9th chord colors, builds gently', confidence: 0.82,
      emotionalIntent: 'beautiful', progressiveIntro: true },
  },
  {
    keys: ['fire beat', 'freestyle beat', 'hard beat', 'banger'],
    partial: { bpm: 95, mode: 'smoke', subGenre: 'boom-bap', energy: 0.75, swing: 0.45, bounce: 0.65, density: 0.58,
      interpretation: 'Fire beat — hard-hitting, builds fast into a full groove', confidence: 0.82 },
  },
]

// ── Mood modifiers ─────────────────────────────────────────────────────────
// These stack on top of whatever base was matched.
// Numeric values are deltas (+ or -).

interface MoodMod {
  bpmDelta?:     number
  energyDelta?:  number
  swingDelta?:   number
  bounceDelta?:  number
  densityDelta?: number
  mode?:         VibeParams['mode']
}

const MOOD_MODS: Array<{ keys: string[]; mod: MoodMod }> = [
  { keys: ['fired up', 'fire', 'lit', 'hype', 'hyped'],  mod: { energyDelta: 0.15, densityDelta: 0.10, bounceDelta: 0.10 } },
  { keys: ['aggressive', 'aggro'],                       mod: { energyDelta: 0.20, densityDelta: 0.15, bounceDelta: 0.10 } },
  { keys: ['hard'],                                      mod: { energyDelta: 0.12, densityDelta: 0.10 } },
  { keys: ['dark'],                                      mod: { energyDelta: -0.10, mode: 'gravel' } },
  { keys: ['icy', 'cold', 'frozen', 'ice'],              mod: { mode: 'ice', energyDelta: -0.05 } },
  { keys: ['drip'],                                      mod: { mode: 'ice', energyDelta: 0.05 } },
  { keys: ['raw', 'gritty'],                             mod: { mode: 'gravel', energyDelta: 0.08 } },
  { keys: ['smooth'],                                    mod: { energyDelta: -0.08, swingDelta: 0.10 } },
  { keys: ['punchy'],                                    mod: { bounceDelta: 0.15, densityDelta: 0.10 } },
  { keys: ['story beat', 'story', 'cinematic'],          mod: { bpmDelta: -15, densityDelta: -0.15, swingDelta: 0.10 } },
  { keys: ['soulful'],                                   mod: { swingDelta: 0.15, mode: 'smoke' } },
  { keys: ['melodic'],                                   mod: { mode: 'glow', energyDelta: -0.05 } },
  { keys: ['faster', 'fast', 'double time'],             mod: { bpmDelta: 20 } },
  { keys: ['slower', 'slow', 'half time'],               mod: { bpmDelta: -20 } },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)) }
function clampBpm(v: number): number { return Math.max(60, Math.min(200, v)) }

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Rule-based fallback interpreter.
 *
 * Scans free-text for artist names, genre terms, and mood descriptors.
 * Returns a VibeParams object ready to apply to the organism.
 * Always returns a valid result — falls back to a default if nothing matches.
 */
export function interpretVibeRuleBased(text: string): VibeParams {
  const normalized = normalizeText(text)

  // 1. Check artist references first (highest confidence)
  for (const { keys, params } of ARTIST_REFS) {
    if (keys.some(k => normalized.includes(k))) {
      return applyMoodMods(normalized, { ...params })
    }
  }

  // 2. Genre keyword match
  let base: VibeParams = {
    bpm: 90, mode: 'heat', subGenre: 'trap',
    energy: 0.65, swing: 0.45, bounce: 0.60, density: 0.60,
    interpretation: 'Hip-hop beat', confidence: 0.50,
  }

  for (const { keys, partial } of GENRE_REFS) {
    if (keys.some(k => normalized.includes(k))) {
      base = { ...base, ...partial }
      break
    }
  }

  // 3. Instrument recognition — "play violin", "use piano", "sax melody", etc.
  // Maps natural-language phrases to performer IDs (from InstrumentRegistry).
  // "lead" role = melody voice; "bass" role = bass voice; "chord" role = pad/chord voice.
  const INSTRUMENT_MAP: Array<{ keys: string[]; id: string; role: 'lead' | 'bass' | 'chord' }> = [
    { keys: ['violin'],                                   id: 'violin',           role: 'lead'  },
    { keys: ['cello'],                                    id: 'cello',            role: 'lead'  },
    { keys: ['flute'],                                    id: 'flute',            role: 'lead'  },
    { keys: ['clarinet'],                                 id: 'clarinet',         role: 'lead'  },
    { keys: ['sax', 'saxophone', 'alto sax'],             id: 'sax',              role: 'lead'  },
    { keys: ['trumpet', 'horn'],                          id: 'trumpet',          role: 'lead'  },
    { keys: ['harp'],                                     id: 'harp',             role: 'lead'  },
    { keys: ['sitar'],                                    id: 'sitar',            role: 'lead'  },
    { keys: ['piano', 'grand piano', 'acoustic piano'],   id: 'piano',            role: 'lead'  },
    { keys: ['rhodes', 'electric piano', 'rhodes piano'], id: 'rhodes',           role: 'lead'  },
    { keys: ['nylon guitar', 'classical guitar', 'acoustic guitar'], id: 'guitar-nylon', role: 'lead' },
    { keys: ['clean guitar', 'electric guitar'],          id: 'guitar-clean',     role: 'lead'  },
    { keys: ['distortion guitar', 'dist guitar', 'rock guitar', 'metal guitar'], id: 'guitar-distorted', role: 'lead' },
    { keys: ['strings', 'string ensemble', 'orchestra'],  id: 'strings',          role: 'chord' },
    { keys: ['upright bass', 'stand up bass', 'double bass', 'acoustic bass'], id: 'bass-upright', role: 'bass' },
    { keys: ['synth bass', '808 bass'],                   id: 'bass-synth',       role: 'bass'  },
    { keys: ['electric bass', 'bass guitar', 'bass'],     id: 'bass-electric',    role: 'bass'  },
  ]

  let instrumentLead: string | null | undefined
  let instrumentBass: string | null | undefined
  let instrumentChord: string | null | undefined

  for (const { keys, id, role } of INSTRUMENT_MAP) {
    if (keys.some(k => normalized.includes(k))) {
      if (role === 'lead'  && instrumentLead  === undefined) instrumentLead  = id
      if (role === 'bass'  && instrumentBass  === undefined) instrumentBass  = id
      if (role === 'chord' && instrumentChord === undefined) instrumentChord = id
    }
  }

  if (instrumentLead  !== undefined) base.instrumentLead  = instrumentLead
  if (instrumentBass  !== undefined) base.instrumentBass  = instrumentBass
  if (instrumentChord !== undefined) base.instrumentChord = instrumentChord

  // 4. Stack mood modifiers
  return applyMoodMods(normalized, base)
}

function applyMoodMods(normalized: string, base: VibeParams): VibeParams {
  let bpmDelta = 0
  const result = { ...base }

  for (const { keys, mod } of MOOD_MODS) {
    if (keys.some(k => normalized.includes(k))) {
      if (mod.bpmDelta     !== undefined) bpmDelta           += mod.bpmDelta
      if (mod.energyDelta  !== undefined) result.energy       = clamp01(result.energy  + mod.energyDelta)
      if (mod.swingDelta   !== undefined) result.swing        = clamp01(result.swing   + mod.swingDelta)
      if (mod.bounceDelta  !== undefined) result.bounce       = clamp01(result.bounce  + mod.bounceDelta)
      if (mod.densityDelta !== undefined) result.density      = clamp01(result.density + mod.densityDelta)
      if (mod.mode         !== undefined) result.mode         = mod.mode
    }
  }

  result.bpm = clampBpm(result.bpm + bpmDelta)
  return result
}
