// Section 06 — Mix Engine Types

export interface ChannelEQConfig {
  highpassHz:    number   // highpass cutoff (default 20 = off)
  lowShelfHz:    number   // low shelf frequency
  lowShelfGain:  number   // low shelf gain dB
  midHz:         number   // mid peaking frequency
  midGain:       number   // mid peaking gain dB
  midQ:          number   // mid peaking Q
  highShelfHz:   number   // high shelf frequency
  highShelfGain: number   // high shelf gain dB
}

export interface ChannelConfig {
  name:          string
  pan:           number
  gainDb:        number
  compThresholdDb: number
  compRatio:     number
  compAttackMs:  number
  compReleaseMs: number
  compKneeDb:    number
  eq?:           Partial<ChannelEQConfig>
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
      eq: { highpassHz: 30, midHz: 300, midGain: -2, midQ: 0.8 },  // scoop low-mid mud
    },
    bass: {
      name: 'bass', pan: 0, gainDb: -2,
      compThresholdDb: -20, compRatio: 5, compAttackMs: 10,
      compReleaseMs: 150, compKneeDb: 4,
      eq: { highShelfHz: 2000, highShelfGain: -6 },  // roll off highs — bass stays below 2kHz
    },
    melody: {
      name: 'melody', pan: 0.15, gainDb: -4,
      compThresholdDb: -24, compRatio: 3, compAttackMs: 20,
      compReleaseMs: 200, compKneeDb: 8,
      eq: { highpassHz: 120 },  // keep melody out of bass territory
    },
    texture: {
      name: 'texture', pan: 0, gainDb: -14,
      compThresholdDb: -30, compRatio: 2, compAttackMs: 50,
      compReleaseMs: 500, compKneeDb: 10,
      eq: { highpassHz: 200, highShelfHz: 6000, highShelfGain: -3 },  // bandpass texture
    },
  },
  master: {
    gainDb: -3,              // pull master down 3dB — headroom for transients
    limiterThreshDb: -2.0,   // slightly harder limiter ceiling
    limiterLookaheadMs: 5,
    saturationAmount: 0.04,  // was 0.15 — subtle warmth only, not distortion
  },
  meterIntervalMs: 250,
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
