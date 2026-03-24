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

  readonly master: MasterBus

  private meterCallbacks: Set<MeterCallback> = new Set()
  private meterInterval:  ReturnType<typeof setInterval> | null = null

  constructor(config: Partial<MixConfig> = {}) {
    this.config = { ...DEFAULT_MIX_CONFIG, ...config }

    this.drumChannel    = new ChannelStrip(this.config.channels.drum)
    this.bassChannel    = new ChannelStrip(this.config.channels.bass)
    this.melodyChannel  = new ChannelStrip(this.config.channels.melody)
    this.textureChannel = new ChannelStrip(this.config.channels.texture)

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
  }

  wire(orchestrator: GeneratorOrchestrator): void {
    orchestrator.connectDrumOutput(this.drumChannel.input)
    orchestrator.connectBassOutput(this.bassChannel.input)
    orchestrator.connectMelodyOutput(this.melodyChannel.input)
    orchestrator.connectTextureOutput(this.textureChannel.input)
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

  setChannelGainDb(channel: 'drum' | 'bass' | 'melody' | 'texture', db: number): void {
    this.getChannel(channel).setGainDb(db)
  }

  setChannelPan(channel: 'drum' | 'bass' | 'melody' | 'texture', pan: number): void {
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
    this.drumChannel.dispose()
    this.bassChannel.dispose()
    this.melodyChannel.dispose()
    this.textureChannel.dispose()
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
      default: throw new Error(`Unknown channel: ${name}`)
    }
  }
}
