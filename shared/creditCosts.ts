/**
 * Credit costs — single source of truth shared by server (deduction) and
 * client (pre-action badges). Keep this in sync with PRICING_CALCULATOR.md.
 * Numbers are based on actual API cost × 2.5 margin.
 */
export const CREDIT_COSTS = {
  // Tier 1: Suno (Premium AI) - Most Expensive
  SONG_GENERATION: 125,
  SONG_EXTENSION: 80,
  CUSTOM_VOCALS: 110,
  STEM_SEPARATION: 19,

  // Tier 2: MusicGen (Advanced AI)
  BEAT_GENERATION: 5,
  MELODY_GENERATION: 5,
  INSTRUMENTAL_GENERATION: 8,
  GENRE_BLENDING: 10,
  DRUM_GENERATION: 3,

  // Tier 3: Grok/OpenAI (Text AI)
  LYRICS_GENERATION: 4,
  LYRICS_ANALYSIS: 2,
  RHYME_SUGGESTIONS: 1,
  SONG_ANALYSIS: 2,
  CODE_TRANSLATION: 2,

  // Tier 4: Audio Processing
  AI_MIXING: 7,
  AUDIO_MASTERING: 8,
  TRANSCRIPTION: 5,
  AI_ENHANCEMENT: 6,

  // Tier 5: Voice Conversion (cloud mode only — BYO keys = 0 credits)
  VOICE_CONVERT_2STEM: 30,
  VOICE_CONVERT_4STEM: 38,
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;

/** Human-readable labels for UI surfaces (tooltips, badges). */
export const CREDIT_OPERATION_LABELS: Record<CreditOperation, string> = {
  SONG_GENERATION: "Generate full song",
  SONG_EXTENSION: "Extend song",
  CUSTOM_VOCALS: "Custom vocals",
  STEM_SEPARATION: "Stem separation",
  BEAT_GENERATION: "Generate beat",
  MELODY_GENERATION: "Generate melody",
  INSTRUMENTAL_GENERATION: "Generate instrumental",
  GENRE_BLENDING: "Blend genres",
  DRUM_GENERATION: "Generate drums",
  LYRICS_GENERATION: "Generate lyrics",
  LYRICS_ANALYSIS: "Analyze lyrics",
  RHYME_SUGGESTIONS: "Rhyme suggestions",
  SONG_ANALYSIS: "Analyze song",
  CODE_TRANSLATION: "Translate code",
  AI_MIXING: "AI mixing",
  AUDIO_MASTERING: "Audio mastering",
  TRANSCRIPTION: "Transcribe audio",
  AI_ENHANCEMENT: "AI enhancement",
  VOICE_CONVERT_2STEM: "Voice convert (2-stem)",
  VOICE_CONVERT_4STEM: "Voice convert (4-stem)",
};
