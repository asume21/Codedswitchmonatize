/**
 * ORGANISM BRIDGE
 *
 * Connects the Organism engine's real-time state to the Living Glyph
 * and Presence Engine. Listens for organism:* window events emitted
 * by OrganismProvider and translates them into presence:* events that
 * drive the Living Glyph's visual state, pulse, and glow.
 *
 * Organism state → Glyph state mapping:
 *   Dormant    → wave             (undefined potential)
 *   Awakening  → superposition    (building, ambiguous)
 *   Breathing  → breathing-torus  (steady flow)
 *   Flow       → spiral-helix     (momentum / energy)
 *
 * Organism mode → Glyph hue bias:
 *   heat   → warm hue shift (+20)
 *   ice    → cool hue shift (-30)
 *   smoke  → desaturated
 *   gravel → earthy shift (+10)
 *   glow   → neutral (no shift)
 */

import type { GlyphState, PulseParameters, PulseMode } from './types'

interface OrganismPhysicsDetail {
  bounce:   number
  swing:    number
  presence: number
  pocket:   number
  density:  number
  mode:     string
}

interface OrganismStateDetail {
  current:          string
  previous:         string | null
  flowDepth:        number
  breathingWarmth:  number
  cadenceLockBars:  number
}

const ORGANISM_TO_GLYPH: Record<string, GlyphState> = {
  DORMANT:   'wave',
  AWAKENING: 'superposition',
  BREATHING: 'breathing-torus',
  FLOW:      'spiral-helix',
}

const MODE_HUE_BIAS: Record<string, number> = {
  heat:   20,
  ice:    -30,
  smoke:  0,
  gravel: 10,
  glow:   0,
}

export class OrganismBridge {
  private static instance: OrganismBridge | null = null

  private active: boolean = false
  private lastGlyphState: GlyphState = 'wave'
  private lastPhysics: OrganismPhysicsDetail | null = null

  // Bound handlers for cleanup
  private handlePhysicsUpdate: (e: Event) => void
  private handleStateChange:   (e: Event) => void
  private handleStarted:       () => void
  private handleStopped:       () => void

  private constructor() {
    this.handlePhysicsUpdate = this.onPhysicsUpdate.bind(this)
    this.handleStateChange   = this.onStateChange.bind(this)
    this.handleStarted       = this.onStarted.bind(this)
    this.handleStopped       = this.onStopped.bind(this)
  }

  static getInstance(): OrganismBridge {
    if (!OrganismBridge.instance) {
      OrganismBridge.instance = new OrganismBridge()
    }
    return OrganismBridge.instance
  }

  /** Start listening for organism events. */
  connect(): void {
    if (this.active) return
    this.active = true

    window.addEventListener('organism:physics-update', this.handlePhysicsUpdate)
    window.addEventListener('organism:state-change',   this.handleStateChange)
    window.addEventListener('organism:started',        this.handleStarted)
    window.addEventListener('organism:stopped',        this.handleStopped)
  }

  /** Stop listening and reset. */
  disconnect(): void {
    if (!this.active) return
    this.active = false

    window.removeEventListener('organism:physics-update', this.handlePhysicsUpdate)
    window.removeEventListener('organism:state-change',   this.handleStateChange)
    window.removeEventListener('organism:started',        this.handleStarted)
    window.removeEventListener('organism:stopped',        this.handleStopped)

    this.lastPhysics = null
    this.lastGlyphState = 'wave'
  }

  isActive(): boolean {
    return this.active
  }

  // ── Event handlers ──────────────────────────────────────────────────

  private onPhysicsUpdate(e: Event): void {
    const detail = (e as CustomEvent<OrganismPhysicsDetail>).detail
    if (!detail) return
    this.lastPhysics = detail

    // Map physics metrics → pulse parameters
    const pulse = this.computePulse(detail)
    window.dispatchEvent(new CustomEvent('presence:pulse-update', {
      detail: { parameters: pulse },
    }))
  }

  private onStateChange(e: Event): void {
    const detail = (e as CustomEvent<OrganismStateDetail>).detail
    if (!detail) return

    const targetGlyph = ORGANISM_TO_GLYPH[detail.current] ?? 'wave'

    if (targetGlyph !== this.lastGlyphState) {
      const previousState = this.lastGlyphState
      this.lastGlyphState = targetGlyph

      window.dispatchEvent(new CustomEvent('presence:state-change', {
        detail: {
          state:         targetGlyph,
          previousState,
          reason:        `organism:${detail.current}`,
        },
      }))
    }

    // When organism is in Flow, show AI overlay as 'generating'
    const overlay = detail.current === 'FLOW' ? 'generating'
                  : detail.current === 'BREATHING' ? 'analyzing'
                  : 'idle'
    window.dispatchEvent(new CustomEvent('presence:ai-overlay', {
      detail: { overlay },
    }))
  }

  private onStarted(): void {
    // Organism just started — transition glyph out of wave if still there
    if (this.lastGlyphState === 'wave') {
      this.lastGlyphState = 'superposition'
      window.dispatchEvent(new CustomEvent('presence:state-change', {
        detail: {
          state:         'superposition',
          previousState: 'wave',
          reason:        'organism:started',
        },
      }))
    }
  }

  private onStopped(): void {
    // Organism stopped — return glyph to wave
    const previousState = this.lastGlyphState
    this.lastGlyphState = 'wave'
    window.dispatchEvent(new CustomEvent('presence:state-change', {
      detail: {
        state:         'wave',
        previousState,
        reason:        'organism:stopped',
      },
    }))

    window.dispatchEvent(new CustomEvent('presence:ai-overlay', {
      detail: { overlay: 'idle' },
    }))
  }

  // ── Pulse computation ───────────────────────────────────────────────

  private computePulse(physics: OrganismPhysicsDetail): PulseParameters {
    // bounce → pulse frequency (0.5–3 Hz)
    const frequency = 0.5 + physics.bounce * 2.5

    // presence → amplitude (0.1–0.8)
    const amplitude = 0.1 + physics.presence * 0.7

    // density → brightness (0.3–1.0)
    const brightness = 0.3 + physics.density * 0.7

    // Determine pulse mode based on energy
    let mode: PulseMode = 'slow'
    const energy = (physics.bounce + physics.presence + physics.density) / 3
    if (energy > 0.7)      mode = 'fast'
    else if (energy > 0.4) mode = 'medium'
    else if (energy > 0.2) mode = 'subtle'
    else                   mode = 'slow'

    // If swing is erratic (near extremes), use erratic mode
    if (physics.swing > 0.8 || physics.swing < 0.2) {
      mode = 'erratic'
    }

    return { frequency, amplitude, brightness, mode }
  }

  /** Returns the hue bias for the current organism mode. */
  getHueBias(): number {
    if (!this.lastPhysics) return 0
    return MODE_HUE_BIAS[this.lastPhysics.mode] ?? 0
  }
}
