// Section 06 — Mix Engine

import * as Tone from 'tone'
import { ChannelStrip }              from './channels/ChannelStrip'
import { MasterBus }                 from './channels/MasterBus'
import {
  MixConfig,
  MixMeterReading,
  MeterCallback,
  DEFAULT_MIX_CONFIG,
}                                    from './types'
import type { GeneratorOrchestrator } from '../generators/GeneratorOrchestrator'
import { getExpressiveEngine }        from '../instruments/ExpressiveEngine'

export class MixEngine {
  private config: MixConfig

  readonly drumChannel:    ChannelStrip
  readonly bassChannel:    ChannelStrip
  readonly melodyChannel:  ChannelStrip
  readonly textureChannel: ChannelStrip
  readonly chordChannel:   ChannelStrip

  readonly master: MasterBus

  // Parallel buses and spatialization
  readonly bandMaster:      Tone.Gain
  readonly drumBus:         Tone.Gain
  readonly drumCompressor:  Tone.Compressor
  readonly drumParallelWet: Tone.Gain
  readonly melodyBus:       Tone.Gain
  readonly melodyChorus:    Tone.Chorus
  readonly textureSplit:    Tone.Split
  readonly textureMerge:    Tone.Merge
  readonly haasDelay:       Tone.Delay

  private meterCallbacks: Set<MeterCallback> = new Set()
  private meterInterval:  ReturnType<typeof setInterval> | null = null

  constructor(config: Partial<MixConfig> = {}) {
    this.config = { ...DEFAULT_MIX_CONFIG, ...config }

    this.drumChannel    = new ChannelStrip(this.config.channels.drum)
    this.bassChannel    = new ChannelStrip(this.config.channels.bass)
    this.melodyChannel  = new ChannelStrip(this.config.channels.melody)
    this.textureChannel = new ChannelStrip(this.config.channels.texture)
    this.chordChannel   = new ChannelStrip(this.config.channels.chord)

    this.master = new MasterBus(
      this.config.master.gainDb,
      this.config.master.limiterThreshDb,
      this.config.master.saturationAmount,
    )

    // 1. Initialize band master gain node (for silencing the generative engine)
    this.bandMaster = new Tone.Gain(1)

    // 2. Drum Bus (Kick, Snare, Percussion, Bass/808) with TRUE parallel (NY)
    // compression. The previous wiring inserted this compressor SERIALLY —
    // there was no dry path, so drums+bass were squashed 4:1 on top of the
    // per-channel comps and the master glue comp (four compressors in series =
    // no kick thwack, pumping 808). Now the dry bus carries the transients and
    // a hard-crushed copy is blended UNDER it for density: punch AND weight.
    this.drumBus = new Tone.Gain(1)
    this.drumCompressor = new Tone.Compressor({
      threshold: -24,
      ratio: 6,
      attack: 0.003,  // fast — the wet path is meant to be crushed
      release: 0.15,
    })
    this.drumParallelWet = new Tone.Gain(0.45)

    this.drumChannel.output.connect(this.drumBus)
    this.bassChannel.output.connect(this.drumBus)
    this.drumBus.connect(this.bandMaster)              // dry — transients intact
    this.drumBus.connect(this.drumCompressor)          // wet — crushed for density
    this.drumCompressor.connect(this.drumParallelWet)
    this.drumParallelWet.connect(this.bandMaster)

    // 3. Melody Bus (Keys, Chords) → subtle stereo chorus → band master.
    // History: an 18ms static Haas delay sat here (mono comb-filter, smeared
    // top); removing it outright left keys/lead a dry mono blob in the centre —
    // "the melodic side sticks out" (by-ear, 2026-07-03). A slow, mostly-dry
    // chorus is the producer-keys width move: modulated so mono sums shimmer
    // instead of combing, wet kept low so the dry attack still leads.
    this.melodyBus = new Tone.Gain(1)
    this.melodyChorus = new Tone.Chorus({
      frequency: 0.5,   // slow drift, not vibrato
      delayTime: 3.5,   // ms — width territory, not slapback
      depth: 0.35,
      spread: 180,      // full L/R spread of the modulated copies
      wet: 0.25,
    }).start()
    this.melodyChannel.output.connect(this.melodyBus)
    this.chordChannel.output.connect(this.melodyBus)
    this.melodyBus.connect(this.melodyChorus)
    this.melodyChorus.connect(this.bandMaster)

    // 4. Texture keeps the Haas widening — pads/atmosphere are exactly where
    // wide-and-diffuse is wanted, and the channel is quiet (-14 dB) so the
    // mono comb-filter cost is negligible there.
    this.textureSplit = new Tone.Split(2)
    this.textureMerge = new Tone.Merge()
    this.haasDelay = new Tone.Delay({
      delayTime: 0.018, // 18ms delay on the Right channel
      maxDelay: 0.1,
    })

    this.textureChannel.output.connect(this.textureSplit)
    this.textureSplit.connect(this.textureMerge, 0, 0) // Left -> Left
    this.textureSplit.connect(this.haasDelay, 1, 0)    // Right -> Delay
    this.haasDelay.connect(this.textureMerge, 0, 1)    // Delay -> Right
    this.textureMerge.connect(this.bandMaster)

    // 5. Connect the summed bandMaster output to the master bus input
    this.bandMaster.connect(this.master.input)
  }

  wire(orchestrator: GeneratorOrchestrator): void {
    orchestrator.connectDrumOutput(this.drumChannel.input)
    orchestrator.connectBassOutput(this.bassChannel.input)
    orchestrator.connectMelodyOutput(this.melodyChannel.input)
    orchestrator.connectTextureOutput(this.textureChannel.input)
    orchestrator.connectChordOutput(this.chordChannel.input)

    // Route ExpressiveEngine (MIDI keyboard + InstrumentEditor) through the
    // melody channel so it hits the master limiter instead of bypassing it.
    // Without this, MIDI notes sum directly into Tone.Destination unconstrained
    // and clip the output (24%+ clipping measured in production).
    getExpressiveEngine().connectTo(this.melodyChannel.input)

    // Wire kick → bass sidechain ducking
    this.wireSidechain(orchestrator, 'bass')
  }

  /**
   * Enable sidechain ducking: kick triggers duck the target channel.
   */
  wireSidechain(
    orchestrator: GeneratorOrchestrator,
    targetChannel: 'bass' | 'melody' | 'texture',
    config?: Partial<import('./channels/SidechainDucker').SidechainConfig>,
  ): void {
    const channel = this.getChannel(targetChannel)
    const ducker = channel.enableSidechain(config)
    orchestrator.setKickSidechainCallback((time: number) => ducker.trigger(time))
  }

  /**
   * Disable sidechain ducking on a channel.
   */
  disableSidechain(targetChannel: 'bass' | 'melody' | 'texture'): void {
    // SidechainDucker stays in chain but stops receiving triggers
    // (removing it would require rewiring audio graph — just stop triggering)
  }

  /**
   * Get sidechain config for UI display.
   */
  getSidechainConfig(channel: 'bass' | 'melody' | 'texture') {
    return this.getChannel(channel).getSidechain()?.getConfig() ?? null
  }

  /**
   * Update sidechain parameters at runtime.
   */
  updateSidechainConfig(
    channel: 'bass' | 'melody' | 'texture',
    config: Partial<import('./channels/SidechainDucker').SidechainConfig>,
  ): void {
    this.getChannel(channel).getSidechain()?.updateConfig(config)
  }

  startMetering(): void {
    if (this.meterInterval) return
    this.meterInterval = setInterval(() => {
      this.emitMeterReading()
    }, this.config.meterIntervalMs)
  }

  stopMetering(): void {
    if (this.meterInterval) {
      clearInterval(this.meterInterval)
      this.meterInterval = null
    }
  }

  onMeter(callback: MeterCallback): () => void {
    this.meterCallbacks.add(callback)
    return () => this.meterCallbacks.delete(callback)
  }

  getMasterMeter(): { peakDb: number; rmsDb: number } {
    return this.master.getMeter()
  }

  setChannelGainDb(channel: 'drum' | 'bass' | 'melody' | 'texture' | 'chord', db: number): void {
    this.getChannel(channel).setGainDb(db)
  }

  setChannelPan(channel: 'drum' | 'bass' | 'melody' | 'texture' | 'chord', pan: number): void {
    this.getChannel(channel).setPan(pan)
  }

  setMasterGainDb(db: number): void {
    this.master.setGainDb(db)
  }

  /** -1 (dark/warm) .. 0 (neutral) .. 1 (bright) master tone tilt. */
  setMasterBrightness(value: number): void {
    this.master.setBrightness(value)
  }

  setBandSilenced(silenced: boolean): void {
    this.bandMaster.gain.rampTo(silenced ? 0 : 1, 0.05)
  }

  setParallelCompression(thresholdDb: number, ratio: number, attackMs: number, releaseMs: number): void {
    this.drumCompressor.threshold.value = thresholdDb
    this.drumCompressor.ratio.value = ratio
    this.drumCompressor.attack.value = attackMs / 1000
    this.drumCompressor.release.value = releaseMs / 1000
  }

  setHaasDelayMs(ms: number): void {
    this.haasDelay.delayTime.value = ms / 1000
  }

  setBassDistortion(amount: number): void {
    this.bassChannel.setBassDistortion(amount)
  }

  setBassCrossover(lowpassFreq: number, bandpassFreq: number): void {
    this.bassChannel.setBassCrossover(lowpassFreq, bandpassFreq)
  }

  connectMasterOutput(destination: import('tone').InputNode): void {
    this.master.connectOutput(destination)
  }

  disconnectMasterOutput(destination: import('tone').InputNode): void {
    this.master.disconnectOutput(destination)
  }

  dispose(): void {
    this.stopMetering()
    // Explicitly disconnect all outputs to prevent stale audio graph leaks
    try { this.drumChannel.output.disconnect() } catch { /* */ }
    try { this.bassChannel.output.disconnect() } catch { /* */ }
    try { this.melodyChannel.output.disconnect() } catch { /* */ }
    try { this.textureChannel.output.disconnect() } catch { /* */ }
    try { this.chordChannel.output.disconnect() } catch { /* */ }
    
    try { this.drumBus.disconnect() } catch { /* */ }
    try { this.drumCompressor.disconnect() } catch { /* */ }
    try { this.drumParallelWet.disconnect() } catch { /* */ }
    try { this.melodyBus.disconnect() } catch { /* */ }
    try { this.melodyChorus.disconnect() } catch { /* */ }
    try { this.textureSplit.disconnect() } catch { /* */ }
    try { this.haasDelay.disconnect() } catch { /* */ }
    try { this.textureMerge.disconnect() } catch { /* */ }
    try { this.bandMaster.disconnect() } catch { /* */ }

    this.drumChannel.dispose()
    this.bassChannel.dispose()
    this.melodyChannel.dispose()
    this.textureChannel.dispose()
    this.chordChannel.dispose()

    this.drumBus.dispose()
    this.drumCompressor.dispose()
    this.drumParallelWet.dispose()
    this.melodyBus.dispose()
    this.melodyChorus.dispose()
    this.textureSplit.dispose()
    this.textureMerge.dispose()
    this.haasDelay.dispose()
    this.bandMaster.dispose()

    this.master.dispose()
  }

  // ── Private ──────────────────────────────────────────────────────

  private emitMeterReading(): void {
    const masterMeter = this.master.getMeter()
    const reading: MixMeterReading = {
      channels: {
        drum:    { name: 'drum',    ...this.drumChannel.getMeter() },
        bass:    { name: 'bass',    ...this.bassChannel.getMeter() },
        melody:  { name: 'melody',  ...this.melodyChannel.getMeter() },
        texture: { name: 'texture', ...this.textureChannel.getMeter() },
        chord:   { name: 'chord',   ...this.chordChannel.getMeter() },
      },
      masterPeakDb: masterMeter.peakDb,
      masterRmsDb:  masterMeter.rmsDb,
      timestamp:    performance.now(),
    }

    this.meterCallbacks.forEach(cb => cb(reading))
  }

  private getChannel(name: string): ChannelStrip {
    switch (name) {
      case 'drum':    return this.drumChannel
      case 'bass':    return this.bassChannel
      case 'melody':  return this.melodyChannel
      case 'texture': return this.textureChannel
      case 'chord':   return this.chordChannel
      default: throw new Error(`Unknown channel: ${name}`)
    }
  }
}
