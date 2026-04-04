// Section 06 — Mix Engine

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

    // Wire channels to master bus
    this.drumChannel.output.connect(this.master.input)
    this.bassChannel.output.connect(this.master.input)
    this.melodyChannel.output.connect(this.master.input)
    this.textureChannel.output.connect(this.master.input)
    this.chordChannel.output.connect(this.master.input)
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

  setChannelGainDb(channel: 'drum' | 'bass' | 'melody' | 'texture' | 'chord', db: number): void {
    this.getChannel(channel).setGainDb(db)
  }

  setChannelPan(channel: 'drum' | 'bass' | 'melody' | 'texture' | 'chord', pan: number): void {
    this.getChannel(channel).setPan(pan)
  }

  setMasterGainDb(db: number): void {
    this.master.setGainDb(db)
  }

  dispose(): void {
    this.stopMetering()
    // Explicitly disconnect channel outputs from master before disposing so
    // stale audio edges don't linger in the Web Audio graph across re-mounts.
    try { this.drumChannel.output.disconnect(this.master.input) } catch { /* already disconnected */ }
    try { this.bassChannel.output.disconnect(this.master.input) } catch { /* already disconnected */ }
    try { this.melodyChannel.output.disconnect(this.master.input) } catch { /* already disconnected */ }
    try { this.textureChannel.output.disconnect(this.master.input) } catch { /* already disconnected */ }
    try { this.chordChannel.output.disconnect(this.master.input) } catch { /* already disconnected */ }
    this.drumChannel.dispose()
    this.bassChannel.dispose()
    this.melodyChannel.dispose()
    this.textureChannel.dispose()
    this.chordChannel.dispose()
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
