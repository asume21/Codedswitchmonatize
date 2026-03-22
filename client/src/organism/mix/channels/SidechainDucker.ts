// Section 06 — Sidechain Ducker
//
// Gain-envelope sidechain: when triggered (by a kick hit), the gain drops
// rapidly and then recovers over a configurable release time.
// Produces that classic hip-hop "pumping" effect on the bass channel.

import * as Tone from 'tone'

export interface SidechainConfig {
  depthDb:      number   // how many dB to duck (negative, e.g. -6)
  attackMs:     number   // how fast the duck engages (e.g. 2)
  releaseMs:    number   // how fast the gain recovers (e.g. 120)
  holdMs:       number   // how long to hold at full duck before releasing (e.g. 30)
}

const DEFAULT_SIDECHAIN: SidechainConfig = {
  depthDb:    -6,
  attackMs:   2,
  releaseMs:  120,
  holdMs:     30,
}

export class SidechainDucker {
  readonly node: Tone.Gain
  private config: SidechainConfig

  constructor(config?: Partial<SidechainConfig>) {
    this.config = { ...DEFAULT_SIDECHAIN, ...config }
    this.node = new Tone.Gain(1)
  }

  /**
   * Trigger a duck event — call this from the DrumGenerator on every kick hit.
   * Uses Tone.js scheduling so it's sample-accurate relative to the kick.
   *
   * @param time — the Tone.js scheduled time of the kick hit
   */
  trigger(time: number): void {
    const { depthDb, attackMs, releaseMs, holdMs } = this.config
    const duckedGain = Tone.dbToGain(depthDb)
    const attackSec  = attackMs / 1000
    const holdSec    = holdMs / 1000
    const releaseSec = releaseMs / 1000

    // Cancel any in-progress envelope to prevent overlap glitches
    this.node.gain.cancelScheduledValues(time)

    // Ramp down to ducked level
    this.node.gain.setValueAtTime(this.node.gain.value, time)
    this.node.gain.linearRampToValueAtTime(duckedGain, time + attackSec)

    // Hold at ducked level
    this.node.gain.setValueAtTime(duckedGain, time + attackSec + holdSec)

    // Release back to unity
    this.node.gain.linearRampToValueAtTime(1, time + attackSec + holdSec + releaseSec)
  }

  /** Update sidechain parameters at runtime. */
  updateConfig(partial: Partial<SidechainConfig>): void {
    this.config = { ...this.config, ...partial }
  }

  /** Get current config (for UI display). */
  getConfig(): Readonly<SidechainConfig> {
    return { ...this.config }
  }

  dispose(): void {
    this.node.dispose()
  }
}
