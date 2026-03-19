// Section 06 — Mix Engine Types

export interface ChannelConfig {
  name:          string
  pan:           number
  gainDb:        number
  compThresholdDb: number
  compRatio:     number
  compAttackMs:  number
  compReleaseMs: number
  compKneeDb:    number
}

export interface MixConfig {
  channels: {
    drum:    ChannelConfig
    bass:    ChannelConfig
    melody:  ChannelConfig
    texture: ChannelConfig
  }
  master: {
    gainDb:         number
    limiterThreshDb: number
    limiterLookaheadMs: number
    saturationAmount: number
  }
  meterIntervalMs: number
}

export const DEFAULT_MIX_CONFIG: MixConfig = {
  channels: {
    drum: {
      name: 'drum', pan: 0, gainDb: 0,
      compThresholdDb: -18, compRatio: 4, compAttackMs: 5,
      compReleaseMs: 80, compKneeDb: 6,
    },
    bass: {
      name: 'bass', pan: 0, gainDb: -2,
      compThresholdDb: -20, compRatio: 5, compAttackMs: 10,
      compReleaseMs: 150, compKneeDb: 4,
    },
    melody: {
      name: 'melody', pan: 0.15, gainDb: -4,
      compThresholdDb: -24, compRatio: 3, compAttackMs: 20,
      compReleaseMs: 200, compKneeDb: 8,
    },
    texture: {
      name: 'texture', pan: 0, gainDb: -6,
      compThresholdDb: -30, compRatio: 2, compAttackMs: 50,
      compReleaseMs: 500, compKneeDb: 10,
    },
  },
  master: {
    gainDb: 0,
    limiterThreshDb: -1.0,
    limiterLookaheadMs: 5,
    saturationAmount: 0.15,
  },
  meterIntervalMs: 100,
}

// ── Metering ─────────────────────────────────────────────────────────

export interface ChannelMeter {
  name:    string
  peakDb:  number
  rmsDb:   number
}

export interface MixMeterReading {
  channels:  Record<string, ChannelMeter>
  masterPeakDb: number
  masterRmsDb:  number
  timestamp: number
}

export type MeterCallback = (reading: MixMeterReading) => void
