// Section 06 — Mix Engine Types

/** The five generator roles the mix engine gives dedicated channel strips. */
export type MixRole = 'drum' | 'bass' | 'melody' | 'texture' | 'chord'

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
      // summing; +1 keeps the kick authoritative while the master headroom and
      // true-ceiling shaper still prevent hard clipping.
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
      // +2 (was -4): the real 808/sub measured weak — only 9.5% of energy in the
      // 20-80 Hz sub band (trap wants the sub forward, just under the kick). Add a
      // controlled low shelf so the gut-punch comes from sub, not midrange gain.
      name: 'bass', pan: 0, gainDb: 2,
      // Punch tuning (2026-06-22): 5:1 smoothed the 808 into a sustained mid-rangey
      // "grunt" (prod captures: sub 14% vs lowMid 30%). Ease to 3:1 + faster release so
      // the sub breathes and sits under the kick instead of filling the mud zone.
      compThresholdDb: -20, compRatio: 3, compAttackMs: 10,
      compReleaseMs: 120, compKneeDb: 4,
      // Low-mid scoop added 2026-07-10 (fire-beats bench baseline: full-mix lowMid 39%
      // vs sub 10% — mud-forward, not sub-forward). The bass body at ~300 Hz was piling
      // into the mud zone with no cut; -4 dB there moves the balance toward sub without
      // touching the +4 sub shelf. Testing against baseline-trap-seed42.
      eq: { highpassHz: 20, lowShelfHz: 62, lowShelfGain: 4, midHz: 300, midGain: -4, midQ: 1.0, highShelfHz: 2000, highShelfGain: -7 },  // sub lift + low-mid mud scoop; HP only removes inaudible rumble
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
      // MEASURED 2026-07-12: soloed pads were -59 dB against drums at -21 — the
      // pad bed, which is meant to BE the harmonic colour, was ~35 dB below the
      // band and effectively inaudible. It loses level three times over (role
      // ceiling -> activity, pad gain, then this channel), so the -9 dB cut here
      // was the last straw. Lifted to +2. Re-measure with the fire-beats bench
      // (soloed texture RMS) if you touch this.
      name: 'texture', pan: 0, gainDb: 2,
      compThresholdDb: -30, compRatio: 2, compAttackMs: 50,
      compReleaseMs: 500, compKneeDb: 10,
      eq: { highpassHz: 160, midHz: 450, midGain: -2, midQ: 1.0, highShelfHz: 7000, highShelfGain: -1 },  // warm pad bed; keep mud controlled without stripping the body
    },
    chord: {
      // Harmony/keys carry the hook; keep them forward enough to be the idea,
      // while the high-pass and master headroom stop them from crowding the 808.
      // MEASURED 2026-07-12: soloed chords were -43 dB against drums at -21 —
      // ~22 dB below the band. The user's core insight is that the CHORDS ARE
      // THE HOOK, and they have never actually been audible. +3 -> +10.
      name: 'chord', pan: -0.16, gainDb: 10,
      compThresholdDb: -22, compRatio: 3, compAttackMs: 30,
      compReleaseMs: 250, compKneeDb: 8,
      eq: { highpassHz: 150, midHz: 500, midGain: -3, midQ: 1.0, highShelfHz: 6000, highShelfGain: -1 },  // fuller keys with the low-mid boxiness still scooped
    },
  },
  master: {
    gainDb: -12,             // extra headroom for keys/pads-forward balance; avoids leaning on the final clipper
    limiterThreshDb: -4.5,   // catch transients earlier before the true-ceiling shaper
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
