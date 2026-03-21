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
    this.mappings = customMappings ?? DEFAULT_TRIGGER_MAPPINGS
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
    return `cmd:${action.command}`
  }
}
