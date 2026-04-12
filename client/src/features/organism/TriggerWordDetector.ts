/**
 * TRIGGER WORD DETECTOR
 *
 * Listens to the FreestyleTranscriber's interim/final text and scans for
 * trigger phrases that map to actions:
 *
 *  - "let's go hard"  → quick start trap-140
 *  - "chill vibes"    → quick start lofi-85
 *  - "boom bap"       → quick start boombap-90
 *  - "drill time"     → quick start drill-140
 *  - "smooth"         → quick start chill-75
 *  - "funk it up"     → quick start funk-100
 *
 * The detector uses fuzzy matching (Levenshtein distance) so that slight
 * mispronunciations or speech recognition errors still trigger correctly.
 *
 * Integration:
 *  - OrganismProvider subscribes to transcription updates
 *  - When a trigger is detected, it fires the corresponding quickStart
 *  - Each trigger has a cooldown (default 5s) to prevent rapid re-triggering
 */

export interface TriggerMapping {
  phrases:   string[]        // canonical phrases (lowercased)
  action:    TriggerAction
  cooldownMs: number         // minimum ms between triggers
}

export type TriggerAction =
  | { type: 'quick-start';  presetId: string }
  | { type: 'command';      command: string; value?: string | number }
  | { type: 'mood-signal';  mood: MoodSignal }

/**
 * Which instruments to spotlight when the organism starts.
 * Values are volume multipliers applied to each generator.
 * Omitted keys default to 1.0 (no change).
 */
export interface InstrumentFocus {
  bass?:     number
  melody?:   number
  hats?:     number
  kick?:     number
  texture?:  number
  chord?:    number
}

export interface MoodSignal {
  /** Energy level the phrase implies (0-1). 0.8+ = hype, 0.3- = chill */
  energy: number
  /** Preferred sub-genre, if the phrase strongly implies one */
  preferredSubGenre?: string
  /** Intent category — helps the director decide what to adjust */
  intent: 'warmup' | 'hype' | 'chill' | 'aggro' | 'vibing' | 'transition' | 'adlib'
  /** When present, tells the orchestrator which instruments to spotlight on startup */
  instrumentFocus?: InstrumentFocus
}

export interface TriggerEvent {
  matchedPhrase:  string
  spokenText:     string
  action:         TriggerAction
  confidence:     number     // 0-1, how close the match was
  timestamp:      number
}

export type TriggerCallback = (event: TriggerEvent) => void

const DEFAULT_TRIGGER_MAPPINGS: TriggerMapping[] = [
  {
    phrases:    ['let\'s go hard', 'lets go hard', 'go hard', 'turn up'],
    action:     { type: 'quick-start', presetId: 'trap-140' },
    cooldownMs: 5000,
  },
  {
    phrases:    ['chill vibes', 'chill mode', 'keep it chill', 'lo-fi', 'lofi'],
    action:     { type: 'quick-start', presetId: 'lofi-85' },
    cooldownMs: 5000,
  },
  {
    phrases:    ['boom bap', 'boombap', 'old school', 'classic hip hop'],
    action:     { type: 'quick-start', presetId: 'boombap-90' },
    cooldownMs: 5000,
  },
  {
    phrases:    ['drill time', 'drill mode', 'go drill', 'dark mode'],
    action:     { type: 'quick-start', presetId: 'drill-140' },
    cooldownMs: 5000,
  },
  {
    phrases:    ['smooth', 'keep it smooth', 'melodic', 'glow up'],
    action:     { type: 'quick-start', presetId: 'chill-75' },
    cooldownMs: 5000,
  },
  {
    phrases:    ['funk it up', 'funky', 'get funky', 'groove'],
    action:     { type: 'quick-start', presetId: 'funk-100' },
    cooldownMs: 5000,
  },
  // On-the-fly voice commands
  {
    phrases:    ['switch it up', 'change it up', 'flip it'],
    action:     { type: 'command', command: 'shuffle' },
    cooldownMs: 3000,
  },
  {
    phrases:    ['faster', 'speed up', 'pick it up'],
    action:     { type: 'command', command: 'bpm-up', value: 10 },
    cooldownMs: 2000,
  },
  {
    phrases:    ['slower', 'slow down', 'bring it down'],
    action:     { type: 'command', command: 'bpm-down', value: 10 },
    cooldownMs: 2000,
  },
  {
    phrases:    ['drop', 'drop it', 'here we go'],
    action:     { type: 'command', command: 'drop' },
    cooldownMs: 4000,
  },
  {
    phrases:    ['strip it back', 'just drums', 'break it down'],
    action:     { type: 'command', command: 'strip' },
    cooldownMs: 3000,
  },
  {
    phrases:    ['bring it back', 'full beat', 'everything'],
    action:     { type: 'command', command: 'restore' },
    cooldownMs: 3000,
  },
]

// ── Ad-lib & Phrase Intelligence ─────────────────────────────────────────
// Common rapper vocal patterns that signal energy, mood, and intent.
// These are softer than explicit commands — they nudge the MusicalDirector
// rather than force-switching presets. Grouped by intent category.

const ADLIB_TRIGGER_MAPPINGS: TriggerMapping[] = [
  // ── WARMUP — Cypher/Storytelling aesthetic ──────────────────────────
  // Hip-hop cyphers + storytelling beats live on SPARSENESS, not layers.
  // Warm-up phrases subtract instruments rather than adding them — the
  // highlighted element becomes relatively louder because everything else
  // gets dimmed. Rule: no instrument goes above 1.15x on warm-up.
  //
  // Texture always stays on at 0.3+ (vinyl crackle / tape hiss = the glue).

  // ── CYPHER ENTRIES — Drums + Bass only, nothing melodic ─────────────

  // "Yo yo yo" → Classic cypher opener. Upright bass + boom-bap drums.
  { phrases: ['yo yo yo', 'yo yo', 'yoo yoo'],
    action: { type: 'mood-signal', mood: { energy: 0.4, intent: 'warmup',
      instrumentFocus: { bass: 1.1, kick: 1.0, hats: 0.9, melody: 0.0, chord: 0.0, texture: 0.3 } } }, cooldownMs: 8000 },

  // "1-2 1-2" / "check check" → Mic check: drums ONLY, vinyl hiss
  { phrases: ['1 2 1 2', 'one two one two', 'check check', 'check the mic', 'mic check', 'testing testing', 'test test'],
    action: { type: 'mood-signal', mood: { energy: 0.3, intent: 'warmup',
      instrumentFocus: { hats: 1.1, kick: 1.0, bass: 0.0, melody: 0.0, chord: 0.0, texture: 0.4 } } }, cooldownMs: 8000 },

  // "Yeah yeah" → Head-nod cypher: drums + bass, no melody
  { phrases: ['yeah yeah', 'yea yea', 'ya ya'],
    action: { type: 'mood-signal', mood: { energy: 0.5, intent: 'warmup',
      instrumentFocus: { bass: 1.1, kick: 1.0, hats: 0.95, melody: 0.2, chord: 0.4, texture: 0.3 } } }, cooldownMs: 6000 },

  // "Uh huh uh huh" → Head-nod + sparse Rhodes stabs every 2 bars
  { phrases: ['uh huh uh huh', 'uh huh', 'mmhmm mmhmm', 'mhm mhm'],
    action: { type: 'mood-signal', mood: { energy: 0.45, intent: 'warmup',
      instrumentFocus: { bass: 1.1, kick: 1.0, hats: 0.85, chord: 0.6, melody: 0.2, texture: 0.3 } } }, cooldownMs: 8000 },

  // "Ay ay ay" / "ey ey" → Percussive cypher entry: drums + bass
  { phrases: ['ay ay ay', 'ey ey ey', 'ay ay', 'ey ey'],
    action: { type: 'mood-signal', mood: { energy: 0.55, intent: 'warmup',
      instrumentFocus: { hats: 1.0, kick: 1.0, bass: 0.9, melody: 0.2, chord: 0.3, texture: 0.3 } } }, cooldownMs: 6000 },

  // "Aye aye aye" / "woah woah" → Bass-led head-nod starter
  { phrases: ['aye aye aye', 'woah woah', 'whoa whoa', 'hold up hold up'],
    action: { type: 'mood-signal', mood: { energy: 0.45, intent: 'warmup',
      instrumentFocus: { bass: 1.1, kick: 1.0, hats: 0.85, melody: 0.2, chord: 0.3, texture: 0.3 } } }, cooldownMs: 7000 },

  // "Word word" / "real talk" → Confident cypher: full boom-bap loop minus melody
  { phrases: ['word word', 'word up', 'real real', 'true true', 'real talk'],
    action: { type: 'mood-signal', mood: { energy: 0.5, intent: 'warmup',
      instrumentFocus: { bass: 1.1, kick: 1.0, hats: 0.9, melody: 0.2, chord: 0.4, texture: 0.3 } } }, cooldownMs: 8000 },

  // "Tick tick" / "bap bap" → Drums-only percussion mimicry
  { phrases: ['tick tick', 'tick tock', 'bap bap bap', 'bap bap', 'uh uh uh', 'ts ts ts'],
    action: { type: 'mood-signal', mood: { energy: 0.4, intent: 'warmup',
      instrumentFocus: { hats: 1.1, kick: 1.0, bass: 0.0, melody: 0.0, chord: 0.0, texture: 0.3 } } }, cooldownMs: 6000 },

  // "Ok ok" / "okay okay" → Balanced sparse warm start
  { phrases: ['ok ok', 'okay okay'],
    action: { type: 'mood-signal', mood: { energy: 0.4, intent: 'warmup',
      instrumentFocus: { bass: 0.7, kick: 0.8, hats: 0.7, melody: 0.3, chord: 0.5, texture: 0.3 } } }, cooldownMs: 6000 },

  // "Right right" / "bet bet" → Cypher confidence: drums + bass
  { phrases: ['right right', 'bet bet', 'say less', 'say word'],
    action: { type: 'mood-signal', mood: { energy: 0.45, intent: 'warmup',
      instrumentFocus: { kick: 0.95, hats: 0.9, bass: 0.85, melody: 0.3, chord: 0.5, texture: 0.3 } } }, cooldownMs: 6000 },

  // "Lets get it" → Revised: cypher drums + bass energy (NOT stadium hype)
  { phrases: ['lets get it', 'let\'s get it', 'you already know', 'already know', 'we in here', 'we here'],
    action: { type: 'mood-signal', mood: { energy: 0.6, intent: 'warmup',
      instrumentFocus: { bass: 1.0, kick: 1.0, hats: 0.95, melody: 0.3, chord: 0.4, texture: 0.3 } } }, cooldownMs: 6000 },

  // "About to go down" → Revised: energetic cypher, not maxed arena vibe
  { phrases: ['its about to go down', 'it\'s about to go down', 'about to go down', 'about to pop off'],
    action: { type: 'mood-signal', mood: { energy: 0.7, intent: 'warmup',
      instrumentFocus: { bass: 1.1, kick: 1.1, hats: 1.0, melody: 0.4, chord: 0.5, texture: 0.3 } } }, cooldownMs: 8000 },

  // ── STORYTELLING ENTRIES — Piano/Rhodes forward, cinematic sparseness ─

  // "Let me paint the picture" → Storytelling classic: piano pad + soft drums
  { phrases: ['let me paint the picture', 'paint the picture', 'paint a picture', 'paint this picture'],
    action: { type: 'mood-signal', mood: { energy: 0.4, intent: 'warmup', preferredSubGenre: 'boom-bap',
      instrumentFocus: { chord: 1.1, texture: 0.7, bass: 0.7, kick: 0.6, hats: 0.5, melody: 0.4 } } }, cooldownMs: 10000 },

  // "Let me tell you" / "tell you a story" → Storytelling piano lead
  { phrases: ['let me tell you', 'tell you a story', 'tell a story', 'let me tell ya'],
    action: { type: 'mood-signal', mood: { energy: 0.4, intent: 'warmup', preferredSubGenre: 'boom-bap',
      instrumentFocus: { chord: 1.1, melody: 0.5, texture: 0.7, bass: 0.7, kick: 0.6, hats: 0.5 } } }, cooldownMs: 10000 },

  // "Back in the day" → Nostalgic soul sample vibe: Rhodes + dusty drums
  { phrases: ['back in the day', 'back when', 'back in the days', 'remember when'],
    action: { type: 'mood-signal', mood: { energy: 0.4, intent: 'warmup', preferredSubGenre: 'boom-bap',
      instrumentFocus: { chord: 1.0, texture: 0.9, bass: 0.8, kick: 0.7, hats: 0.65, melody: 0.4 } } }, cooldownMs: 10000 },

  // "Come with me" / "take you on a journey" → Storytelling opener
  { phrases: ['come with me', 'take you back', 'take a journey', 'come on a journey', 'let me take you'],
    action: { type: 'mood-signal', mood: { energy: 0.35, intent: 'warmup', preferredSubGenre: 'boom-bap',
      instrumentFocus: { chord: 1.1, texture: 0.8, bass: 0.6, kick: 0.5, hats: 0.4, melody: 0.5 } } }, cooldownMs: 10000 },

  // "Picture this" / "imagine" → Cinematic storytelling: strings + piano
  { phrases: ['picture this', 'imagine this', 'imagine that', 'visualize'],
    action: { type: 'mood-signal', mood: { energy: 0.35, intent: 'warmup',
      instrumentFocus: { chord: 1.1, texture: 1.0, melody: 0.4, bass: 0.6, kick: 0.5, hats: 0.4 } } }, cooldownMs: 10000 },

  // "Once upon a time" / "story time" → Classic storytelling setup
  { phrases: ['once upon a time', 'story time', 'storytime', 'gather round'],
    action: { type: 'mood-signal', mood: { energy: 0.3, intent: 'warmup', preferredSubGenre: 'boom-bap',
      instrumentFocus: { chord: 1.1, texture: 0.9, bass: 0.5, kick: 0.4, hats: 0.4, melody: 0.4 } } }, cooldownMs: 10000 },

  // "Close your eyes" → Immersive cinematic
  { phrases: ['close your eyes', 'close ya eyes', 'close them eyes', 'picture it'],
    action: { type: 'mood-signal', mood: { energy: 0.3, intent: 'warmup',
      instrumentFocus: { chord: 1.1, texture: 1.0, melody: 0.3, bass: 0.5, kick: 0.4, hats: 0.3 } } }, cooldownMs: 10000 },

  // "Talk to me" / "come on now" → Storytelling piano lead with melody fill
  { phrases: ['talk to me', 'come on now', 'sing to me', 'play something'],
    action: { type: 'mood-signal', mood: { energy: 0.45, intent: 'warmup',
      instrumentFocus: { chord: 1.1, melody: 0.6, texture: 0.7, bass: 0.7, kick: 0.5, hats: 0.5 } } }, cooldownMs: 8000 },

  // "Ok yea ok lets go" → Storytelling entry: piano + drums delayed
  { phrases: ['ok yea ok lets go', 'ok yeah ok lets go', 'ok ok lets go', 'alright lets go', 'alright alright', 'aight aight'],
    action: { type: 'mood-signal', mood: { energy: 0.45, intent: 'warmup',
      instrumentFocus: { chord: 1.1, melody: 0.4, texture: 0.5, bass: 0.7, kick: 0.6, hats: 0.5 } } }, cooldownMs: 8000 },

  // "La la la" / "na na na" → Lo-fi storytelling: melody-forward but sparse
  { phrases: ['la la la', 'la la', 'na na na', 'na na', 'da da da'],
    action: { type: 'mood-signal', mood: { energy: 0.35, intent: 'warmup', preferredSubGenre: 'lo-fi',
      instrumentFocus: { melody: 1.0, chord: 0.9, texture: 0.7, bass: 0.5, hats: 0.4, kick: 0.4 } } }, cooldownMs: 8000 },

  // "Ooh ooh" / "hmm hmm" → Hummed storytelling warm-up
  { phrases: ['ooh ooh', 'oooh oooh', 'hmm hmm', 'mmm mmm', 'sing it'],
    action: { type: 'mood-signal', mood: { energy: 0.35, intent: 'warmup', preferredSubGenre: 'lo-fi',
      instrumentFocus: { melody: 1.0, chord: 0.9, texture: 0.7, bass: 0.4, hats: 0.3, kick: 0.3 } } }, cooldownMs: 8000 },

  // ── HYPE — Rapper is building energy, wants the beat to match ────────
  // Signal: boost energy, increase hat density, consider trap/drill
  { phrases: ['let\'s go', 'lets go', 'here we go', 'come on'],
    action: { type: 'mood-signal', mood: { energy: 0.8, intent: 'hype' } }, cooldownMs: 4000 },
  { phrases: ['turn up', 'turn it up', 'crank it', 'louder'],
    action: { type: 'mood-signal', mood: { energy: 0.9, intent: 'hype' } }, cooldownMs: 4000 },
  { phrases: ['gang gang', 'gang', 'squad', 'mob'],
    action: { type: 'mood-signal', mood: { energy: 0.85, preferredSubGenre: 'trap', intent: 'hype' } }, cooldownMs: 5000 },
  { phrases: ['sheesh', 'sheeesh', 'god damn', 'goddamn'],
    action: { type: 'mood-signal', mood: { energy: 0.85, intent: 'hype' } }, cooldownMs: 5000 },
  { phrases: ['aye', 'ayy', 'ayyy', 'ay ay'],
    action: { type: 'mood-signal', mood: { energy: 0.75, intent: 'hype' } }, cooldownMs: 3000 },
  { phrases: ['fire', 'that\'s fire', 'heat', 'flames'],
    action: { type: 'mood-signal', mood: { energy: 0.8, preferredSubGenre: 'trap', intent: 'hype' } }, cooldownMs: 5000 },
  { phrases: ['go crazy', 'go stupid', 'get crazy', 'wild out'],
    action: { type: 'mood-signal', mood: { energy: 0.95, intent: 'hype' } }, cooldownMs: 4000 },
  { phrases: ['no cap', 'on god', 'on my mama', 'real talk'],
    action: { type: 'mood-signal', mood: { energy: 0.7, intent: 'hype' } }, cooldownMs: 5000 },

  // ── AGGRO — Aggressive energy, wants dark/hard beat ──────────────────
  // Signal: switch to drill/phonk, increase distortion, darker filter
  { phrases: ['run it', 'run that', 'run it back'],
    action: { type: 'mood-signal', mood: { energy: 0.85, preferredSubGenre: 'drill', intent: 'aggro' } }, cooldownMs: 4000 },
  { phrases: ['pull up', 'we outside', 'slide', 'sliding'],
    action: { type: 'mood-signal', mood: { energy: 0.8, preferredSubGenre: 'drill', intent: 'aggro' } }, cooldownMs: 5000 },
  { phrases: ['brr', 'brrr', 'grr', 'grrr', 'skrt', 'skrrt'],
    action: { type: 'mood-signal', mood: { energy: 0.9, preferredSubGenre: 'phonk', intent: 'aggro' } }, cooldownMs: 3000 },
  { phrases: ['bow bow', 'bang bang', 'boom boom', 'pow pow'],
    action: { type: 'mood-signal', mood: { energy: 0.9, preferredSubGenre: 'drill', intent: 'aggro' } }, cooldownMs: 4000 },
  { phrases: ['talk to em', 'talk to them', 'tell em', 'watch this'],
    action: { type: 'mood-signal', mood: { energy: 0.75, intent: 'aggro' } }, cooldownMs: 5000 },

  // ── CHILL — Rapper wants to pull back, go mellow ─────────────────────
  // Signal: reduce energy, open filter, consider lo-fi/chill
  { phrases: ['chill chill', 'easy', 'take it easy', 'relax'],
    action: { type: 'mood-signal', mood: { energy: 0.25, preferredSubGenre: 'chill', intent: 'chill' } }, cooldownMs: 5000 },
  { phrases: ['vibe', 'vibes', 'vibing', 'feel this'],
    action: { type: 'mood-signal', mood: { energy: 0.35, preferredSubGenre: 'lo-fi', intent: 'chill' } }, cooldownMs: 5000 },
  { phrases: ['smooth', 'keep it smooth', 'nice and easy'],
    action: { type: 'mood-signal', mood: { energy: 0.3, preferredSubGenre: 'lo-fi', intent: 'chill' } }, cooldownMs: 5000 },
  { phrases: ['mellow', 'laid back', 'lay back', 'cruise'],
    action: { type: 'mood-signal', mood: { energy: 0.25, preferredSubGenre: 'chill', intent: 'chill' } }, cooldownMs: 5000 },
  { phrases: ['hold up', 'wait', 'hold on', 'pause'],
    action: { type: 'mood-signal', mood: { energy: 0.2, intent: 'chill' } }, cooldownMs: 4000 },

  // ── VIBING — Rapper is locked into the groove, don't change ──────────
  // Signal: maintain current energy, boost confidence in current sub-genre
  { phrases: ['that\'s it', 'right there', 'keep that', 'don\'t change'],
    action: { type: 'mood-signal', mood: { energy: 0.6, intent: 'vibing' } }, cooldownMs: 8000 },
  { phrases: ['you know what i mean', 'know what i\'m saying', 'feel me', 'nah mean'],
    action: { type: 'mood-signal', mood: { energy: 0.55, intent: 'vibing' } }, cooldownMs: 6000 },
  { phrases: ['for real', 'straight up', 'facts', 'period'],
    action: { type: 'mood-signal', mood: { energy: 0.6, intent: 'vibing' } }, cooldownMs: 5000 },
  { phrases: ['woo', 'wooo', 'woop', 'whoo'],
    action: { type: 'mood-signal', mood: { energy: 0.7, intent: 'vibing' } }, cooldownMs: 4000 },

  // ── TRANSITION — Rapper is signaling a change is coming ──────────────
  // Signal: prepare for section change, maybe switch pattern variant
  { phrases: ['switch', 'switch up', 'change', 'new vibe'],
    action: { type: 'mood-signal', mood: { energy: 0.6, intent: 'transition' } }, cooldownMs: 4000 },
  { phrases: ['now watch', 'listen', 'listen up', 'pay attention'],
    action: { type: 'mood-signal', mood: { energy: 0.7, intent: 'transition' } }, cooldownMs: 5000 },
  { phrases: ['ready', 'you ready', 'get ready', 'brace yourself'],
    action: { type: 'mood-signal', mood: { energy: 0.75, intent: 'transition' } }, cooldownMs: 5000 },

  // ── ADLIB (filler) — Common ad-libs that signal general engagement ───
  // Signal: rapper is active and flowing — small energy nudge
  { phrases: ['uhh', 'uh uh', 'uh huh', 'mmm'],
    action: { type: 'mood-signal', mood: { energy: 0.5, intent: 'adlib' } }, cooldownMs: 3000 },
  { phrases: ['what', 'what what', 'say what'],
    action: { type: 'mood-signal', mood: { energy: 0.65, intent: 'adlib' } }, cooldownMs: 3000 },
  { phrases: ['bruh', 'bro', 'man', 'dawg', 'dog'],
    action: { type: 'mood-signal', mood: { energy: 0.5, intent: 'adlib' } }, cooldownMs: 4000 },
  { phrases: ['yuh', 'yah', 'yup', 'yes sir', 'yessir'],
    action: { type: 'mood-signal', mood: { energy: 0.6, intent: 'adlib' } }, cooldownMs: 3000 },
  { phrases: ['swear', 'i swear', 'swear to god', 'deadass'],
    action: { type: 'mood-signal', mood: { energy: 0.65, intent: 'adlib' } }, cooldownMs: 5000 },

  // ── Genre-specific ad-libs ───────────────────────────────────────────
  { phrases: ['west side', 'westside', 'west coast', 'g funk'],
    action: { type: 'mood-signal', mood: { energy: 0.7, preferredSubGenre: 'west-coast', intent: 'hype' } }, cooldownMs: 6000 },
  { phrases: ['bounce', 'bounce bounce', 'make it bounce'],
    action: { type: 'mood-signal', mood: { energy: 0.75, preferredSubGenre: 'bounce', intent: 'hype' } }, cooldownMs: 5000 },
  { phrases: ['dale', 'suavemente', 'reggaeton'],
    action: { type: 'mood-signal', mood: { energy: 0.7, preferredSubGenre: 'reggaeton', intent: 'hype' } }, cooldownMs: 6000 },
]

/**
 * Compute Levenshtein distance between two strings.
 * Used for fuzzy phrase matching against speech recognition output.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return dp[m][n]
}

/**
 * Check if `spoken` fuzzy-matches `phrase`.
 * Returns a confidence score 0-1 (1 = exact match).
 *
 * Strategy: slide a window of `phrase.length ± 3` chars across
 * `spoken` and find the lowest edit distance.
 */
function fuzzyMatch(spoken: string, phrase: string): number {
  const s = spoken.toLowerCase().trim()
  const p = phrase.toLowerCase().trim()

  // Exact substring match
  if (s.includes(p)) return 1.0

  // Window scan for best fuzzy match
  const pLen = p.length
  const tolerance = Math.max(3, Math.floor(pLen * 0.3))
  let bestDist = Infinity

  for (let winLen = Math.max(1, pLen - tolerance); winLen <= pLen + tolerance && winLen <= s.length; winLen++) {
    for (let start = 0; start <= s.length - winLen; start++) {
      const window = s.slice(start, start + winLen)
      const dist = levenshtein(window, p)
      if (dist < bestDist) bestDist = dist
    }
  }

  // Confidence: 1 - (distance / phrase length), clamped to [0, 1]
  const confidence = Math.max(0, 1 - bestDist / pLen)
  return confidence
}

export class TriggerWordDetector {
  private mappings:   TriggerMapping[]
  private lastFired:  Map<string, number> = new Map()
  private callbacks:  TriggerCallback[] = []
  private enabled:    boolean = true

  /** Minimum confidence to fire a trigger (0-1). */
  private threshold:  number = 0.75

  constructor(customMappings?: TriggerMapping[]) {
    // Merge explicit command triggers with ad-lib phrase intelligence.
    // Ad-libs come AFTER commands so explicit triggers take priority
    // during fuzzy matching (first best-match wins on equal confidence).
    this.mappings = customMappings ?? [...DEFAULT_TRIGGER_MAPPINGS, ...ADLIB_TRIGGER_MAPPINGS]
  }

  /** Register a callback for trigger events. Returns an unsubscribe function. */
  onTrigger(cb: TriggerCallback): () => void {
    this.callbacks.push(cb)
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== cb)
    }
  }

  /** Enable or disable detection without destroying the instance. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /** Set the minimum confidence threshold (0-1). */
  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold))
  }

  /**
   * Feed text from the transcriber. Call this on every interim/final result.
   *
   * The detector scans the last ~30 chars of the text against all trigger
   * phrases, picks the best match above threshold, and fires if not on cooldown.
   */
  processText(text: string): TriggerEvent | null {
    if (!this.enabled || !text) return null

    const now = performance.now()
    const scanWindow = text.slice(-50).toLowerCase()

    let bestEvent: TriggerEvent | null = null
    let bestConfidence = 0

    for (const mapping of this.mappings) {
      for (const phrase of mapping.phrases) {
        // Pre-filter: skip phrases that are way longer than the scan window
        // (they can't match above threshold if length ratio is too extreme)
        if (phrase.length > scanWindow.length * 2) continue
        // Quick exact substring check before expensive fuzzy match
        if (scanWindow.includes(phrase)) {
          const confidence = 1.0
          if (confidence > bestConfidence) {
            const key = this.actionKey(mapping.action)
            const lastTime = this.lastFired.get(key) ?? 0
            if (now - lastTime < mapping.cooldownMs) continue
            bestConfidence = confidence
            bestEvent = {
              matchedPhrase: phrase, spokenText: scanWindow,
              action: mapping.action, confidence, timestamp: now,
            }
          }
          continue
        }

        const confidence = fuzzyMatch(scanWindow, phrase)

        if (confidence >= this.threshold && confidence > bestConfidence) {
          // Check cooldown
          const key = this.actionKey(mapping.action)
          const lastTime = this.lastFired.get(key) ?? 0
          if (now - lastTime < mapping.cooldownMs) continue

          bestConfidence = confidence
          bestEvent = {
            matchedPhrase: phrase,
            spokenText:    scanWindow,
            action:        mapping.action,
            confidence,
            timestamp:     now,
          }
        }
      }
    }

    if (bestEvent) {
      const key = this.actionKey(bestEvent.action)
      this.lastFired.set(key, now)

      for (const cb of this.callbacks) {
        try { cb(bestEvent) } catch { /* swallow callback errors */ }
      }
    }

    return bestEvent
  }

  /** Add a custom trigger mapping at runtime. */
  addMapping(mapping: TriggerMapping): void {
    this.mappings.push(mapping)
  }

  /** Remove all mappings for a given action type + command/presetId. */
  removeMapping(actionKey: string): void {
    this.mappings = this.mappings.filter(m => this.actionKey(m.action) !== actionKey)
  }

  /** Reset all cooldowns. */
  resetCooldowns(): void {
    this.lastFired.clear()
  }

  /** Clean up. */
  dispose(): void {
    this.callbacks = []
    this.lastFired.clear()
    this.enabled = false
  }

  private actionKey(action: TriggerAction): string {
    if (action.type === 'quick-start') return `qs:${action.presetId}`
    if (action.type === 'mood-signal') return `mood:${action.mood.intent}`
    return `cmd:${action.command}`
  }
}
