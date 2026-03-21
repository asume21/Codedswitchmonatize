/**
 * DROP DETECTOR
 *
 * Monitors audio energy from the PhysicsEngine and detects "drop" moments:
 * a buildup of energy followed by a sudden spike or release. When detected,
 * it triggers a beat drop — forcing the state machine to Flow with max
 * energy and optionally regenerating patterns for impact.
 *
 * Detection algorithm:
 *  1. Maintain a rolling window of energy readings (bounce * density * presence)
 *  2. Compute the moving average and standard deviation
 *  3. A drop is detected when:
 *     a. Energy rises above (mean + threshold * stddev) for buildupFrames
 *     b. Then energy spikes even higher OR the rapper suddenly stops (silence)
 *  4. Emit a drop event with intensity (how far above the threshold)
 *
 * Configurable:
 *  - thresholdMultiplier: how many stddevs above mean counts as buildup (default 1.5)
 *  - buildupMinFrames: minimum consecutive high-energy frames for buildup (default 8)
 *  - windowSize: rolling window size for stats (default 60)
 *  - cooldownMs: minimum time between drops (default 8000)
 *  - enabled: on/off toggle
 */

export interface DropDetectorConfig {
  thresholdMultiplier:  number   // stddev multiplier (default 1.5)
  buildupMinFrames:     number   // min frames of rising energy (default 8)
  windowSize:           number   // rolling window size (default 60)
  cooldownMs:           number   // min time between drops (default 8000)
}

export interface DropEvent {
  intensity:   number   // 0-1, how strong the drop is
  buildupMs:   number   // how long the buildup lasted
  timestamp:   number
  dropCount:   number   // total drops this session
}

export type DropCallback = (event: DropEvent) => void

const DEFAULT_CONFIG: DropDetectorConfig = {
  thresholdMultiplier: 1.5,
  buildupMinFrames:    8,
  windowSize:          60,
  cooldownMs:          12000,
}

export class DropDetector {
  private config:          DropDetectorConfig
  private callbacks:       DropCallback[] = []
  private enabled:         boolean = true
  private energyWindow:    number[] = []
  private buildupCount:    number = 0
  private buildupStart:    number = 0
  private lastDropTime:    number = 0
  private dropCount:       number = 0
  private inBuildup:       boolean = false

  constructor(config?: Partial<DropDetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Register a callback for drop events. Returns unsubscribe function. */
  onDrop(cb: DropCallback): () => void {
    this.callbacks.push(cb)
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== cb)
    }
  }

  /** Enable or disable drop detection. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.buildupCount = 0
      this.inBuildup = false
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /** Update config at runtime. */
  updateConfig(partial: Partial<DropDetectorConfig>): void {
    this.config = { ...this.config, ...partial }
  }

  /**
   * Feed a physics state snapshot. Call this on every physics update.
   * 
   * @param bounce  - 0-1, current bounce value
   * @param density - 0-1, current density value
   * @param presence - 0-1, current presence value
   */
  processFrame(bounce: number, density: number, presence: number): DropEvent | null {
    if (!this.enabled) return null

    const now = performance.now()

    // Compute composite energy
    const energy = (bounce * 0.4 + density * 0.35 + presence * 0.25)

    // Add to rolling window
    this.energyWindow.push(energy)
    if (this.energyWindow.length > this.config.windowSize) {
      this.energyWindow.shift()
    }

    // Need enough data for statistics
    if (this.energyWindow.length < 10) return null

    // Compute mean and stddev
    const mean = this.energyWindow.reduce((a, b) => a + b, 0) / this.energyWindow.length
    const variance = this.energyWindow.reduce((a, b) => a + (b - mean) ** 2, 0) / this.energyWindow.length
    const stddev = Math.sqrt(variance)

    // Threshold for "high energy"
    const threshold = mean + this.config.thresholdMultiplier * stddev

    if (energy > threshold) {
      if (!this.inBuildup) {
        this.inBuildup = true
        this.buildupStart = now
        this.buildupCount = 0
      }
      this.buildupCount++

      // Check if buildup is long enough to trigger a drop
      if (this.buildupCount >= this.config.buildupMinFrames) {
        // Check cooldown
        if (now - this.lastDropTime < this.config.cooldownMs) return null

        // Calculate intensity: how far above threshold (normalized 0-1)
        const maxPossible = 1 - threshold
        const intensity = maxPossible > 0
          ? Math.min(1, (energy - threshold) / maxPossible)
          : 1

        const buildupMs = now - this.buildupStart
        this.dropCount++
        this.lastDropTime = now
        this.inBuildup = false
        this.buildupCount = 0

        const event: DropEvent = {
          intensity,
          buildupMs,
          timestamp: now,
          dropCount: this.dropCount,
        }

        // Emit window event
        window.dispatchEvent(new CustomEvent('organism:drop-detected', {
          detail: event,
        }))

        // Fire callbacks
        for (const cb of this.callbacks) {
          try { cb(event) } catch { /* swallow */ }
        }

        return event
      }
    } else {
      // Energy dropped below threshold — reset buildup
      if (this.inBuildup && this.buildupCount >= this.config.buildupMinFrames / 2) {
        // Partial buildup that released — could be a natural drop moment
        // Only trigger if we had significant buildup
        if (this.buildupCount >= this.config.buildupMinFrames * 0.75) {
          if (now - this.lastDropTime >= this.config.cooldownMs) {
            const buildupMs = now - this.buildupStart
            const intensity = Math.min(1, this.buildupCount / (this.config.buildupMinFrames * 2))
            this.dropCount++
            this.lastDropTime = now

            const event: DropEvent = {
              intensity,
              buildupMs,
              timestamp: now,
              dropCount: this.dropCount,
            }

            window.dispatchEvent(new CustomEvent('organism:drop-detected', {
              detail: event,
            }))

            for (const cb of this.callbacks) {
              try { cb(event) } catch { /* swallow */ }
            }

            this.inBuildup = false
            this.buildupCount = 0
            return event
          }
        }
      }

      this.inBuildup = false
      this.buildupCount = 0
    }

    return null
  }

  /** Get the current drop count for this session. */
  getDropCount(): number {
    return this.dropCount
  }

  /** Reset all state. */
  reset(): void {
    this.energyWindow = []
    this.buildupCount = 0
    this.buildupStart = 0
    this.inBuildup = false
    this.lastDropTime = 0
    this.dropCount = 0
  }

  /** Clean up. */
  dispose(): void {
    this.callbacks = []
    this.reset()
    this.enabled = false
  }
}
