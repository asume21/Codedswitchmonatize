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
      // +4 (was +6): audio-debug capture (2026-06-19, Real Beat: Trap) measured
      // +3.6 dBFS peak / 7.7% clipping — drum +6 with master only -3 puts a kick
      // sample at +3 dBFS BEFORE summing, and Tone.Limiter's 3ms attack lets that
      // transient through. +4 with master -6 gives the loudest kick real headroom.
      name: 'drum', pan: 0, gainDb: 4,
      compThresholdDb: -18, compRatio: 4, compAttackMs: 5,
      compReleaseMs: 80, compKneeDb: 6,
      eq: { highpassHz: 30, midHz: 300, midGain: -2, midQ: 0.8 },  // scoop low-mid mud
    },
    bass: {
      // 0 (was -4): the real 808/sub measured weak — only 9.5% of energy in the
      // 20-80 Hz sub band (trap wants the sub forward, just under the kick). -4
      // was burying it; bring it to unity so the 808 has authority.
      name: 'bass', pan: 0, gainDb: 0,
      compThresholdDb: -20, compRatio: 5, compAttackMs: 10,
      compReleaseMs: 150, compKneeDb: 4,
      eq: { highpassHz: 24, highShelfHz: 2000, highShelfGain: -6 },  // HP at 24Hz keeps the 808 sub (was 35 = cut the sub); roll off highs
    },
    melody: {
      // +3 (was +8): melody was the hottest channel, making the beat midrange-
      // heavy (mid 32%, centroid ~3 kHz) and un-trap-like. In hip-hop the lead is
      // an accent over drums+808, not the loudest element. Pulled back to sit under.
      name: 'melody', pan: 0.15, gainDb: 3,
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
    gainDb: -6,              // -6 (was -3): real headroom so the sum + kick transients don't slam Tone.Limiter past 0 dBFS (measured +3.6 dBFS / 7.7% clipping at -3)
    limiterThreshDb: -1.0,   // ceiling just under 0 dBFS; with the lower input level the soft limiter no longer overshoots into clipping
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
