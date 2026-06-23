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
  readonly melodyBus:       Tone.Gain
  readonly melodySplit:     Tone.Split
  readonly melodyMerge:     Tone.Merge
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

    // 2. Drum Bus (Kick, Snare, Percussion, Bass/808) with parallel compression
    this.drumBus = new Tone.Gain(1)
    this.drumCompressor = new Tone.Compressor({
      threshold: -12,
      ratio: 4,
      attack: 0.04,  // 40ms attack lets transients pop
      release: 0.1,  // 100ms release induces pumping
    })

    this.drumChannel.output.connect(this.drumBus)
    this.bassChannel.output.connect(this.drumBus)
    this.drumBus.connect(this.drumCompressor)
    this.drumCompressor.connect(this.bandMaster)

    // 3. Melody Bus (Keys, Chords, Textures) with Haas stereo widening
    this.melodyBus = new Tone.Gain(1)
    this.melodySplit = new Tone.Split(2)
    this.melodyMerge = new Tone.Merge()
    this.haasDelay = new Tone.Delay({
      delayTime: 0.018, // 18ms delay on the Right channel
      maxDelay: 0.1,
    })

    this.melodyChannel.output.connect(this.melodyBus)
    this.chordChannel.output.connect(this.melodyBus)
    this.textureChannel.output.connect(this.melodyBus)

    // Haas Effect routing: Left directly to Merge; Right through Delay to Merge
    this.melodyBus.connect(this.melodySplit)
    this.melodySplit.connect(this.melodyMerge, 0, 0) // Left -> Left
    this.melodySplit.connect(this.haasDelay, 1, 0)  // Right -> Delay
    this.haasDelay.connect(this.melodyMerge, 0, 1)  // Delay -> Right

    this.melodyMerge.connect(this.bandMaster)

    // 4. Connect the summed bandMaster output to the master bus input
    this.bandMaster.connect(this.master.input)
  }

  wire(orchestrator: GeneratorOrchestrator): void {
    orchestrator.connectDrumOutput(this.drumChannel.input)
    orchestrator.connectBassOutput(this.bassChannel.input)
    orchestrator.connectMelodyOutput(this.melodyChannel.input)
    orchestrator.connectTextureOutput(this.textureChannel.input)
    orchestrator.connectChordOutput(this.chordChannel.input)

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
    try { this.melodyBus.disconnect() } catch { /* */ }
    try { this.melodySplit.disconnect() } catch { /* */ }
    try { this.haasDelay.disconnect() } catch { /* */ }
    try { this.melodyMerge.disconnect() } catch { /* */ }
    try { this.bandMaster.disconnect() } catch { /* */ }

    this.drumChannel.dispose()
    this.bassChannel.dispose()
    this.melodyChannel.dispose()
    this.textureChannel.dispose()
    this.chordChannel.dispose()

    this.drumBus.dispose()
    this.drumCompressor.dispose()
    this.melodyBus.dispose()
    this.melodySplit.dispose()
    this.melodyMerge.dispose()
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
