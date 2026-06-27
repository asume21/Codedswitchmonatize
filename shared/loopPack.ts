/**
 * A WebEar "profile card" for a single loop: what the AI knows about it before
 * arranging. Generated offline (once) by `scripts/profile-loops.ts` — WebEar
 * LISTENS to the loop (Gemini multimodal `describe`) and MEASURES it (DSP
 * `analyzePcm`). The loop arranger reads this to pick loops that fit each
 * section, instead of always grabbing clip[0]. Optional: a clip with no profile
 * falls back to today's behavior, so unprofiled packs keep working.
 */
export interface LoopProfile {
  /** Plain-English read from WebEar's listen (e.g. "dark, heavy 808 trap kit"). */
  description: string
  /** 0–1 — how hard it hits (normalized RMS loudness). */
  energy: number
  /** 0–1 — dark (0) to bright (1) (normalized spectral centroid). */
  brightness: number
  /** 0–1 — sparse (0) to busy (1) (normalized onset density). */
  busyness: number
  /** Frequency-band energy fractions (sum ≈ 1). */
  bands: { sub: number; bass: number; lowMid: number; highMid: number; high: number }
  /** Raw reference metrics, for debugging / re-derivation without re-listening. */
  metrics: { rmsDb: number; spectralCentroidHz: number; estimatedBpm: number | null; onsetCount: number }
  /** ISO timestamp this profile was generated. Presence ⇒ "already profiled". */
  profiledAt: string
}

export interface LoopClip {
  id:       string
  url:      string
  bars:     number
  label?:   string
  /** WebEar profile — present once the loop has been listened to + measured. */
  profile?: LoopProfile
}

export interface LoopPack {
  id:     string
  genre:  string
  bpm:    number
  key:    string
  label:  string
  loops: {
    drums:   LoopClip[]
    bass:    LoopClip[]
    melody:  LoopClip[]
    chords:  LoopClip[]
    texture: LoopClip[]
  }
}
