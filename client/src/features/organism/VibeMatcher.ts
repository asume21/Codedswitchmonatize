/**
 * VIBE MATCHER
 *
 * Analyzes the current physics state + BPM and classifies the beat into
 * a human-readable genre/vibe label. When the vibe changes significantly,
 * it emits an announcement event that the UI can display as a toast or overlay.
 *
 * Genre classification rules (based on BPM + physics characteristics):
 *  - Trap:     BPM 130-160, high bounce, high density
 *  - Boom Bap: BPM 80-100, medium bounce, low swing
 *  - Lo-fi:    BPM 70-90, low bounce, low density, high pocket
 *  - Drill:    BPM 135-145, high density, low swing
 *  - R&B:      BPM 60-80, medium bounce, high pocket, high swing
 *  - Funk:     BPM 95-115, high swing, high bounce
 *  - House:    BPM 118-132, medium density, steady bounce
 *  - Ambient:  BPM < 80, low density, low bounce
 *  - Hype:     BPM > 150, high everything
 *  - Chill:    BPM 65-85, low density, medium pocket
 *
 * Each classification has a confidence score. The matcher uses hysteresis
 * to avoid rapid label switching.
 */

export interface VibeClassification {
  genre:       string       // e.g. "Trap", "Lo-fi", "Boom Bap"
  subLabel:    string       // e.g. "Dark Trap", "Smooth Lo-fi"
  confidence:  number       // 0-1
  bpm:         number
  energy:      'low' | 'medium' | 'high'
  mood:        'dark' | 'chill' | 'hype' | 'smooth' | 'gritty'
}

export interface VibeChangeEvent {
  previous:    VibeClassification | null
  current:     VibeClassification
  timestamp:   number
  changeCount: number
}

export type VibeCallback = (event: VibeChangeEvent) => void

interface GenreRule {
  genre:     string
  bpmMin:    number
  bpmMax:    number
  bounceMin: number
  bounceMax: number
  densityMin: number
  densityMax: number
  swingMin:  number
  swingMax:  number
  pocketMin: number
  pocketMax: number
  mood:      'dark' | 'chill' | 'hype' | 'smooth' | 'gritty'
}

const GENRE_RULES: GenreRule[] = [
  {
    genre: 'Trap',
    bpmMin: 130, bpmMax: 160,
    bounceMin: 0.5, bounceMax: 1.0,
    densityMin: 0.5, densityMax: 1.0,
    swingMin: 0.0, swingMax: 0.5,
    pocketMin: 0.0, pocketMax: 1.0,
    mood: 'dark',
  },
  {
    genre: 'Boom Bap',
    bpmMin: 85, bpmMax: 100,       // tightened: was 80-100, now 85-100 to separate from Lo-fi
    bounceMin: 0.3, bounceMax: 0.7,
    densityMin: 0.2, densityMax: 0.6,
    swingMin: 0.0, swingMax: 0.4,
    pocketMin: 0.3, pocketMax: 0.8,
    mood: 'gritty',
  },
  {
    genre: 'Lo-fi',
    bpmMin: 70, bpmMax: 85,        // tightened: was 70-90, now 70-85
    bounceMin: 0.1, bounceMax: 0.4,
    densityMin: 0.1, densityMax: 0.35,
    swingMin: 0.2, swingMax: 0.8,
    pocketMin: 0.5, pocketMax: 1.0,
    mood: 'chill',
  },
  {
    genre: 'Drill',
    bpmMin: 135, bpmMax: 148,      // widened slightly: was 135-145
    bounceMin: 0.3, bounceMax: 0.7,
    densityMin: 0.6, densityMax: 1.0,
    swingMin: 0.0, swingMax: 0.3,
    pocketMin: 0.0, pocketMax: 0.5,
    mood: 'dark',
  },
  {
    genre: 'R&B',
    bpmMin: 55, bpmMax: 70,        // tightened: was 60-85, now 55-70 (slow groove zone)
    bounceMin: 0.2, bounceMax: 0.6,
    densityMin: 0.2, densityMax: 0.5,
    swingMin: 0.4, swingMax: 1.0,
    pocketMin: 0.5, pocketMax: 1.0,
    mood: 'smooth',
  },
  {
    genre: 'Funk',
    bpmMin: 100, bpmMax: 118,      // tightened: was 95-115, now 100-118 to avoid Boom Bap overlap
    bounceMin: 0.5, bounceMax: 1.0,
    densityMin: 0.3, densityMax: 0.7,
    swingMin: 0.5, swingMax: 1.0,
    pocketMin: 0.3, pocketMax: 0.8,
    mood: 'hype',
  },
  {
    genre: 'House',
    bpmMin: 118, bpmMax: 132,
    bounceMin: 0.3, bounceMax: 0.7,
    densityMin: 0.3, densityMax: 0.7,
    swingMin: 0.1, swingMax: 0.5,
    pocketMin: 0.2, pocketMax: 0.7,
    mood: 'hype',
  },
  {
    genre: 'Ambient',
    bpmMin: 40, bpmMax: 55,        // tightened: was 40-80, now 40-55 (very slow = ambient)
    bounceMin: 0.0, bounceMax: 0.3,
    densityMin: 0.0, densityMax: 0.3,
    swingMin: 0.0, swingMax: 1.0,
    pocketMin: 0.0, pocketMax: 1.0,
    mood: 'chill',
  },
  {
    genre: 'Hype',
    bpmMin: 155, bpmMax: 220,      // raised min: was 150, now 155 to separate from Trap
    bounceMin: 0.6, bounceMax: 1.0,
    densityMin: 0.6, densityMax: 1.0,
    swingMin: 0.0, swingMax: 0.5,
    pocketMin: 0.0, pocketMax: 0.5,
    mood: 'hype',
  },
  {
    genre: 'Chill',
    bpmMin: 60, bpmMax: 75,        // tightened: was 65-85, now 60-75 (distinct from Lo-fi)
    bounceMin: 0.1, bounceMax: 0.35,
    densityMin: 0.1, densityMax: 0.35,
    swingMin: 0.1, swingMax: 0.6,
    pocketMin: 0.3, pocketMax: 0.8,
    mood: 'chill',
  },
]

const SUB_LABELS: Record<string, Record<string, string>> = {
  Trap:       { dark: 'Dark Trap',      chill: 'Melodic Trap',   hype: 'Hard Trap',      smooth: 'Smooth Trap',   gritty: 'Grimy Trap' },
  'Boom Bap': { dark: 'Underground',    chill: 'Jazz Rap',       hype: 'Battle Rap',     smooth: 'Soulful Boom',  gritty: 'Raw Boom Bap' },
  'Lo-fi':    { dark: 'Dark Lo-fi',     chill: 'Smooth Lo-fi',   hype: 'Upbeat Lo-fi',   smooth: 'Dreamy Lo-fi',  gritty: 'Dusty Lo-fi' },
  Drill:      { dark: 'UK Drill',       chill: 'Melodic Drill',  hype: 'Chicago Drill',  smooth: 'NY Drill',      gritty: 'Brooklyn Drill' },
  'R&B':      { dark: 'Dark R&B',       chill: 'Bedroom R&B',    hype: 'Uptempo R&B',    smooth: 'Silk R&B',      gritty: 'Alternative R&B' },
  Funk:       { dark: 'Psychedelic Funk',chill: 'Smooth Funk',    hype: 'Party Funk',     smooth: 'Soul Funk',     gritty: 'Dirty Funk' },
  House:      { dark: 'Dark House',     chill: 'Deep House',     hype: 'Tech House',     smooth: 'Soulful House', gritty: 'Acid House' },
  Ambient:    { dark: 'Dark Ambient',   chill: 'Zen Ambient',    hype: 'Glitch Ambient', smooth: 'Dream Ambient', gritty: 'Noise Ambient' },
  Hype:       { dark: 'Rage',           chill: 'Festival',       hype: 'Mosh Pit',       smooth: 'EDM',           gritty: 'Hardcore' },
  Chill:      { dark: 'Downtempo',      chill: 'Easy Listening', hype: 'Feel Good',      smooth: 'Smooth Vibes',  gritty: 'Indie Chill' },
}

function computeEnergy(bounce: number, density: number): 'low' | 'medium' | 'high' {
  const e = (bounce + density) / 2
  if (e < 0.33) return 'low'
  if (e < 0.66) return 'medium'
  return 'high'
}

function scoreRule(rule: GenreRule, bpm: number, bounce: number, density: number, swing: number, pocket: number): number {
  let score = 0
  let maxScore = 5

  // BPM fit (most important)
  if (bpm >= rule.bpmMin && bpm <= rule.bpmMax) {
    const center = (rule.bpmMin + rule.bpmMax) / 2
    const range = (rule.bpmMax - rule.bpmMin) / 2
    score += 1 - Math.abs(bpm - center) / (range * 1.5)
  } else {
    // Penalize heavily for out-of-range BPM
    const dist = bpm < rule.bpmMin ? rule.bpmMin - bpm : bpm - rule.bpmMax
    score -= dist / 50
  }

  // Bounce fit
  if (bounce >= rule.bounceMin && bounce <= rule.bounceMax) {
    score += 1
  } else {
    score -= 0.3
  }

  // Density fit
  if (density >= rule.densityMin && density <= rule.densityMax) {
    score += 1
  } else {
    score -= 0.3
  }

  // Swing fit
  if (swing >= rule.swingMin && swing <= rule.swingMax) {
    score += 1
  } else {
    score -= 0.2
  }

  // Pocket fit
  if (pocket >= rule.pocketMin && pocket <= rule.pocketMax) {
    score += 1
  } else {
    score -= 0.2
  }

  return Math.max(0, score / maxScore)
}

export class VibeMatcher {
  private callbacks:       VibeCallback[] = []
  private enabled:         boolean = true
  private currentVibe:     VibeClassification | null = null
  private changeCount:     number = 0
  private hysteresisFrames: number = 0
  private pendingGenre:    string | null = null
  private readonly hysteresisThreshold: number = 90  // frames (~2s at 43fps) before accepting genre change

  /** Register a callback for vibe change events. Returns unsubscribe function. */
  onVibeChange(cb: VibeCallback): () => void {
    this.callbacks.push(cb)
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== cb)
    }
  }

  /** Enable or disable vibe matching. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /** Get the current vibe classification. */
  getCurrentVibe(): VibeClassification | null {
    return this.currentVibe
  }

  /**
   * Feed current physics + BPM. Call on every physics update.
   * Returns the current classification (may not trigger a change event).
   */
  processFrame(bpm: number, bounce: number, density: number, swing: number, pocket: number): VibeClassification {
    // Score all genre rules
    let bestGenre = GENRE_RULES[0]
    let bestScore = -Infinity

    for (const rule of GENRE_RULES) {
      const score = scoreRule(rule, bpm, bounce, density, swing, pocket)
      if (score > bestScore) {
        bestScore = score
        bestGenre = rule
      }
    }

    const confidence = Math.max(0, Math.min(1, bestScore))
    const energy = computeEnergy(bounce, density)
    const mood = bestGenre.mood
    const subLabel = SUB_LABELS[bestGenre.genre]?.[mood] ?? bestGenre.genre

    const classification: VibeClassification = {
      genre: bestGenre.genre,
      subLabel,
      confidence,
      bpm: Math.round(bpm),
      energy,
      mood,
    }

    // Hysteresis: only change genre if the new genre persists for N frames
    if (this.currentVibe && classification.genre !== this.currentVibe.genre) {
      if (this.pendingGenre === classification.genre) {
        this.hysteresisFrames++
      } else {
        this.pendingGenre = classification.genre
        this.hysteresisFrames = 1
      }

      if (this.hysteresisFrames >= this.hysteresisThreshold) {
        // Genre change confirmed
        const previous = this.currentVibe
        this.currentVibe = classification
        this.changeCount++
        this.pendingGenre = null
        this.hysteresisFrames = 0

        if (this.enabled) {
          const event: VibeChangeEvent = {
            previous,
            current: classification,
            timestamp: performance.now(),
            changeCount: this.changeCount,
          }

          window.dispatchEvent(new CustomEvent('organism:vibe-change', {
            detail: event,
          }))

          for (const cb of this.callbacks) {
            try { cb(event) } catch { /* swallow */ }
          }
        }
      }

      // Return current classification even if genre hasn't officially changed
      return classification
    } else {
      this.pendingGenre = null
      this.hysteresisFrames = 0
    }

    if (!this.currentVibe) {
      // First classification
      this.currentVibe = classification
      this.changeCount = 1

      if (this.enabled) {
        const event: VibeChangeEvent = {
          previous: null,
          current: classification,
          timestamp: performance.now(),
          changeCount: this.changeCount,
        }

        window.dispatchEvent(new CustomEvent('organism:vibe-change', {
          detail: event,
        }))

        for (const cb of this.callbacks) {
          try { cb(event) } catch { /* swallow */ }
        }
      }
    } else {
      // Update confidence/energy/bpm without changing genre
      this.currentVibe = { ...this.currentVibe, confidence, bpm: Math.round(bpm), energy }
    }

    return classification
  }

  /** Reset all state. */
  reset(): void {
    this.currentVibe = null
    this.changeCount = 0
    this.hysteresisFrames = 0
    this.pendingGenre = null
  }

  /** Clean up. */
  dispose(): void {
    this.callbacks = []
    this.reset()
    this.enabled = false
  }
}
