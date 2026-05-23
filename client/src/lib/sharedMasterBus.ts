/**
 * SharedMasterBus — opt-in final mastering stage shared by every audio engine
 * that explicitly connects into it.
 *
 * Design choice (post-incident, 2026-05-21): this bus does NOT intercept
 * `Tone.Destination`. An earlier attempt to disconnect Tone's destination and
 * reroute it through here broke `Tone.Part` scheduling for the Organism, while
 * one-shot triggers (impact hits, gain ramps) kept playing. To keep the audio
 * path robust we now treat SharedMasterBus as an opt-in node:
 *
 *   • Engines that want unified mastering connect to `SharedMasterBus.input`
 *     or `.inputNode` from the end of their own chain.
 *   • Engines that don't (or that use `.toDestination()` directly) still reach
 *     the speakers via Tone's native destination — no silent failures.
 *
 * Each engine continues to own its primary EQ/comp/limiter; the shared bus is
 * deliberately near-transparent and acts as a final safety stage that catches
 * the SUM of all engines so they cooperate instead of fighting.
 *
 * Signal chain inside this bus:
 *   input → low-shelf → narrow 200Hz notch → gentle high-shelf →
 *           soft glue comp → ultra-light saturator → -1dBFS limiter →
 *           tap → analyser → audioContext.destination
 */

import * as Tone from 'tone'

let instance: SharedMasterBus | null = null

export class SharedMasterBus {
  /** Any AudioNode or Tone source may connect here. */
  readonly input: Tone.Gain

  // EQ stage — kept gentle since each engine has already EQ'd its own channels.
  private readonly lowShelf:  Tone.Filter
  private readonly midCut:    Tone.Filter
  private readonly highShelf: Tone.Filter

  // Dynamics stage — barely audible glue + brick-wall safety limiter.
  private readonly glueComp:  Tone.Compressor
  private readonly saturator: Tone.Distortion
  private readonly limiter:   Tone.Limiter

  // Tap for metering / debug capture without breaking the limiter→destination edge.
  private readonly tap:       Tone.Gain
  private readonly analyser:  Tone.Analyser

  constructor() {
    this.input     = new Tone.Gain(1)

    // Final-stage EQ tuned for "catch and clean up the sum", not "tone shaping".
    // Each per-engine master already has the same recipe at full strength.
    this.lowShelf  = new Tone.Filter({ type: 'lowshelf',  frequency: 45,    gain: -6.0 })
    this.midCut    = new Tone.Filter({ type: 'peaking',   frequency: 200,   gain: -0.75, Q: 2.0 })
    this.highShelf = new Tone.Filter({ type: 'highshelf', frequency: 10000, gain: -0.25 })

    // Mostly transparent glue compressor — only catches the loudest program peaks.
    this.glueComp  = new Tone.Compressor({
      threshold: -10,
      ratio:     1.2,
      attack:    0.008,
      release:   0.15,
      knee:      10,
    })

    // Sub-audible saturator — 0.02 wet adds a hint of harmonic warmth.
    this.saturator = new Tone.Distortion({ distortion: 0.2, wet: 0.02 })

    // Final safety limiter at -1 dBFS true peak. This is the ONE hard ceiling
    // that catches the sum of every engine connected to this bus.
    this.limiter   = new Tone.Limiter(-1)

    this.tap       = new Tone.Gain(1)
    this.analyser  = new Tone.Analyser('waveform', 256)

    // Signal chain.
    this.input.chain(
      this.lowShelf,
      this.midCut,
      this.highShelf,
      this.glueComp,
      this.saturator,
      this.limiter,
      this.tap,
      this.analyser,
    )
    // `chain()` doesn't connect the last node to anything — wire the analyser
    // directly to the hardware destination so audio reaches the speakers.
    this.analyser.connect(Tone.getContext().rawContext.destination)
  }

  /** Plain AudioNode handle for raw Web Audio sources (drum synth, etc). */
  get inputNode(): AudioNode {
    // Tone.Gain wraps a GainNode; cast through unknown to satisfy TS.
    return (this.input as unknown as { input: AudioNode }).input
  }

  /** Read peak / RMS for level meters. */
  getMeter(): { peakDb: number; rmsDb: number } {
    const values = this.analyser.getValue() as Float32Array
    let peak  = 0
    let sumSq = 0
    for (let i = 0; i < values.length; i++) {
      const abs = Math.abs(values[i])
      if (abs > peak) peak = abs
      sumSq += values[i] * values[i]
    }
    const rms = Math.sqrt(sumSq / values.length)
    return {
      peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
      rmsDb:  rms  > 0 ? 20 * Math.log10(rms)  : -Infinity,
    }
  }

  /** Tap point for debug capture (audio-debug MCP) — sits after the limiter. */
  getDebugTap(): Tone.Gain { return this.tap }

  dispose(): void {
    this.input.dispose()
    this.lowShelf.dispose()
    this.midCut.dispose()
    this.highShelf.dispose()
    this.glueComp.dispose()
    this.saturator.dispose()
    this.limiter.dispose()
    this.tap.dispose()
    this.analyser.dispose()
  }
}

/**
 * Returns the singleton shared master bus, creating it on first call.
 * MUST be called only after `getAudioContext()` has been invoked at least
 * once — Tone.js needs its context configured before we build Tone nodes.
 */
export function getSharedMasterBus(): SharedMasterBus {
  if (!instance) instance = new SharedMasterBus()
  return instance
}

/**
 * Construct the singleton at a deterministic point in the boot sequence
 * (called from `getAudioContext()` right after `Tone.setContext`). Does NOT
 * touch `Tone.Destination` — engines opt in by connecting their final node to
 * `SharedMasterBus.input` or `.inputNode`.
 */
export function installSharedMasterBus(): SharedMasterBus {
  const bus = getSharedMasterBus()
  console.log('🎛️ SharedMasterBus installed')
  return bus
}
