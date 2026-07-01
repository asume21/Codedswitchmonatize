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
      // +1 (was +4): WebEar capture (2026-06-29) still measured +3.6 dBFS / 3.68%
      // clipping with drum +4 and master -6. The drum bus is the hottest path before
      // summing; each dB here adds directly to transient headroom needed. +1 keeps
      // kick authoritative without slamming the limiter above its -0.3 dBFS ceiling.
      name: 'drum', pan: 0, gainDb: 1,
      // Punch tuning (2026-06-22): live prod captures (Cypher + Violin Trap) measured
      // crest factor 3.3-3.7 and "no clear beat" — 4:1 @ 5ms was squashing the kick/snare
      // transient into the bed (low crest = no thwack). Ease to 2:1 and slow the attack to
      // 20ms so the hit punches THROUGH before the comp clamps. Glue, not squash.
      compThresholdDb: -18, compRatio: 2, compAttackMs: 20,
      compReleaseMs: 80, compKneeDb: 6,
      eq: { highpassHz: 30, midHz: 300, midGain: -2, midQ: 0.8 },  // scoop low-mid mud
    },
    bass: {
      // 0 (was -4): the real 808/sub measured weak — only 9.5% of energy in the
      // 20-80 Hz sub band (trap wants the sub forward, just under the kick). -4
      // was burying it; bring it to unity so the 808 has authority.
      name: 'bass', pan: 0, gainDb: 0,
      // Punch tuning (2026-06-22): 5:1 smoothed the 808 into a sustained mid-rangey
      // "grunt" (prod captures: sub 14% vs lowMid 30%). Ease to 3:1 + faster release so
      // the sub breathes and sits under the kick instead of filling the mud zone.
      compThresholdDb: -20, compRatio: 3, compAttackMs: 10,
      compReleaseMs: 120, compKneeDb: 4,
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
    gainDb: -9,              // -9 (was -6): drum channel at +1 + master at -9 gives ~8 dB of headroom before the WaveShaper ceiling at -0.3 dBFS
    limiterThreshDb: -3.0,   // -3 dBFS ceiling: wider window for the DynamicsCompressorNode attack so transients don't overshoot into the WaveShaper
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
