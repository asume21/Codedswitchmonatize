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
    chord:   ChannelConfig
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
      // Drums LEAD the hip-hop mix. Live captures (2026-06-12) measured the
      // bass channel ~17 dB hotter than drums — completely inverted; the beat
      // had no authority. +8 here with the bass pulled down restores the
      // producer hierarchy: kick/snare in front, bass just underneath.
      // +6 (not +8): kick transients at +8 spiked past the master limiter's
      // soft ceiling → 0.2% sample clipping on every kick.
      name: 'drum', pan: 0, gainDb: 6,
      compThresholdDb: -18, compRatio: 4, compAttackMs: 5,
      compReleaseMs: 80, compKneeDb: 6,
      eq: { highpassHz: 30, midHz: 300, midGain: -2, midQ: 0.8 },  // scoop low-mid mud
    },
    bass: {
      // The bass synths run hot upstream — measured dominating the whole mix.
      // Sits BEHIND the kick, not on top of it.
      name: 'bass', pan: 0, gainDb: -4,
      compThresholdDb: -20, compRatio: 5, compAttackMs: 10,
      compReleaseMs: 150, compKneeDb: 4,
      eq: { highpassHz: 24, highShelfHz: 2000, highShelfGain: -6 },  // HP at 24Hz keeps the 808 sub (was 35 = cut the sub); roll off highs
    },
    melody: {
      name: 'melody', pan: 0.15, gainDb: 8,
      compThresholdDb: -18, compRatio: 2, compAttackMs: 20,
      compReleaseMs: 200, compKneeDb: 8,
      eq: { highpassHz: 120, midHz: 250, midGain: -2, midQ: 1.2, highShelfHz: 8000, highShelfGain: 2 },  // gentler HP + lighter mud scoop + presence
    },
    texture: {
      name: 'texture', pan: 0, gainDb: -14,
      compThresholdDb: -30, compRatio: 2, compAttackMs: 50,
      compReleaseMs: 500, compKneeDb: 10,
      eq: { highpassHz: 400, highShelfHz: 6000, highShelfGain: -3 },  // HP at 400Hz kills hum; bandpass texture
    },
    chord: {
      // Harmony supports — it never competes with the kick or the lead.
      name: 'chord', pan: -0.10, gainDb: 3,
      compThresholdDb: -22, compRatio: 3, compAttackMs: 30,
      compReleaseMs: 250, compKneeDb: 8,
      eq: { highpassHz: 200, midHz: 500, midGain: -3, midQ: 1.0, highShelfHz: 6000, highShelfGain: -2 },  // HP to avoid bass mud; scoop 500Hz; tame highs
    },
  },
  master: {
    gainDb: -3,              // headroom: Tone.Limiter is a soft ceiling, kick transients at -2 still clipped ~0.02% of samples
    limiterThreshDb: -3.0,   // softer ceiling — prevents clicking from fast limiting
    limiterLookaheadMs: 5,
    saturationAmount: 0.02,  // minimal warmth — less harmonic buildup
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
