// Section 04 — Drum Generator

import * as Tone from 'tone'
import { orgLog }             from '../../lib/perf/organismLog'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName, DrumInstrument } from './types'
import type { DrumHit }       from './types'
import {
  getDrumKit,
  buildDrumPattern,
}                              from './patterns/DrumPatternLibrary'
import { getLivePartStart, livePartStartOffset, msUntilTransportTime, quantizeGridTime } from './CompositionClock'
import { SampledDrumKit }       from './SampledDrumKit'
import type { PhysicsState }   from '../physics/types'
import { OrganismMode }        from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'
import { getConductor }        from '../conductor/Conductor'

const GENRE_VELOCITY_PROFILES: Record<string, (velocity: number) => number> = {
  'latin': (v: number) => v < 0.6 ? v * 0.7 : v,
  'jazz': (v: number) => v < 0.6 ? v * 0.7 : v,
  'lo-fi': (v: number) => v < 0.6 ? v * 0.75 : v,
  'chill': (v: number) => v < 0.6 ? v * 0.75 : v,
  'west-coast': (v: number) => v < 0.6 ? v * 0.8 : v,
  'rock': (v: number) => v * 0.3 + 0.7,
  'edm': (v: number) => v * 0.2 + 0.8,
  'trap': (v: number) => v * 0.25 + 0.75,
  'drill': (v: number) => v * 0.2 + 0.8,
  'phonk': (v: number) => v * 0.15 + 0.85,
  'default': (v: number) => v,
}

export class DrumGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  // Kick: sub layer + click transient
  private kickSub:   Tone.MembraneSynth | null = null
  private kickClick: Tone.NoiseSynth | null = null
  private kickBus:   Tone.Gain | null = null
  private kickDist:  Tone.Distortion | null = null

  // Snare: noise body + tonal ring
  private snareBody: Tone.NoiseSynth | null = null
  private snareTone: Tone.MembraneSynth | null = null
  private snareBus:  Tone.Gain | null = null

  // Hat: closed (short decay) + open (long decay) — NoiseSynth + highpass sounds
  // far more like real hi-hats than MetalSynth's FM screech which reads as techno.
  private hat:        Tone.NoiseSynth | null = null
  private hatOpen:    Tone.NoiseSynth | null = null
  private hatFilter:  Tone.Filter | null = null

  // Perc: bandpass noise
  private perc:       Tone.NoiseSynth | null = null
  private percFilter: Tone.Filter | null = null

  // Master drum bus
  private compressor: Tone.Compressor | null = null
  private sampleBus: Tone.Gain | null = null
  private sampledKit: SampledDrumKit | null = null

  private part: Tone.Part | null = null
  private breakFillPart: Tone.Part | null = null
  private microFillPart: Tone.Part | null = null
  private hasStartedPlayback: boolean = false

  // Physics cache
  private currentBounce:   number = 0
  private currentPresence: number = 0
  private currentPocket:   number = 0

  // Kit preset — timbre varies per pattern rebuild for sound variety
  private currentKickNote: string = 'C1'

  // Reactive multipliers (Section 05)
  private hatDensityMult:      number = 1.0
  private kickVelocityMult:    number = 1.0

  // Sidechain callback — fired on every kick hit so the bass channel can duck
  private onKickTrigger: ((time: number) => void) | null = null

  // Track last kick time for hat-on-kick ducking
  private lastKickTime: number = 0
  private lastOutputGain: number = 0
  private currentSubGenre: string = ''
  swingAmount: number = 0

  // Per-voice last-trigger time. Monophonic Tone synths (MembraneSynth, NoiseSynth,
  // MetalSynth) require every new trigger time to be ≥ the previous one on that voice.
  // Humanization jitter can go negative, so we clamp each voice's next time here.
  private lastTriggerByVoice: Map<string, number> = new Map()

  constructor() {
    super(GeneratorName.Drum)

    this.output     = new Tone.Gain(1)
    // Near-transparent drum bus comp. The signal already hits the ChannelStrip
    // compressor and then the MasterBus glue comp — three compressors in series
    // (was -24/2.4 here) was squashing kick/snare transients flat. -8 threshold,
    // 1.4:1 ratio means this only catches the loudest peaks for safety.
    this.compressor = new Tone.Compressor({ threshold: -8, ratio: 1.4, attack: 0.012, release: 0.18 })
    this.compressor.connect(this.output)
    this.sampleBus = new Tone.Gain(1.0)
    this.sampleBus.connect(this.compressor)
    this.sampledKit = new SampledDrumKit(this.sampleBus)

    // ── Kick: sub + click layered ──
    this.kickBus  = new Tone.Gain(0.85)
    // Remove kick distortion — saturator on master bus is sufficient
    this.kickDist = new Tone.Distortion({ distortion: 0.0, wet: 0.0 })
    this.kickBus.connect(this.kickDist)
    this.kickDist.connect(this.compressor)

    this.kickSub = new Tone.MembraneSynth({
      pitchDecay:  0.06,
      octaves:     2.5,
      oscillator:  { type: 'sine' },
      envelope:    { attack: 0.001, decay: 0.32, sustain: 0.0, release: 0.22 },
    })
    this.kickSub.volume.value = -6
    this.kickSub.connect(this.kickBus)

    this.kickClick = new Tone.NoiseSynth({
      noise:    { type: 'white' },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
    })
    this.kickClick.volume.value = -10  // louder click for transient definition on small speakers
    this.kickClick.connect(this.kickBus)

    // ── Snare: body + tonal ring ──
    this.snareBus = new Tone.Gain(0.9)
    this.snareBus.connect(this.compressor)

    this.snareBody = new Tone.NoiseSynth({
      noise:    { type: 'pink' },
      // decay 0.08 (was 0.15): a 150ms unfiltered noise tail read as a "woosh"
      // wash instead of a boom-bap crack. Tighter tail = snap, not sweep.
      envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
    })
    this.snareBody.volume.value = -12  // was -9: cut the washy noise body further toward a crack
    this.snareBody.connect(this.snareBus)

    this.snareTone = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves:    2,           // was 4
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.001, decay: 0.1, sustain: 0, release: 0.08 },
    })
    this.snareTone.volume.value = -15  // was -12
    this.snareTone.connect(this.snareBus)

    // ── Hat: white NoiseSynth + highpass — natural hi-hat snap without FM screeching ──
    this.hatFilter = new Tone.Filter({ frequency: 8000, type: 'highpass', Q: 0.4 })
    this.hatFilter.connect(this.compressor)

    this.hat = new Tone.NoiseSynth({
      noise:    { type: 'white' },
      envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.01 },
    })
    this.hat.volume.value = -20
    this.hat.connect(this.hatFilter)

    // Open hat — a SHORT "tss", not a long sweep. decay 0.12 (was 0.22): the
    // 220ms white-noise tail read as an off-beat "woosh" in boom-bap (the user's
    // off-beat woosh). Shorter tail = a hat tick that breathes without sweeping.
    this.hatOpen = new Tone.NoiseSynth({
      noise:    { type: 'white' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.04 },
    })
    this.hatOpen.volume.value = -22
    this.hatOpen.connect(this.hatFilter)

    // ── Perc: bandpass noise for rim/shaker ──
    this.percFilter = new Tone.Filter({ frequency: 2000, type: 'bandpass', Q: 1.5 })
    this.percFilter.connect(this.compressor)

    this.perc = new Tone.NoiseSynth({
      noise:    { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0 },
    })
    this.perc.volume.value = -22
    this.perc.connect(this.percFilter)

    this.setOutputLevel(0)
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    this.currentBounce   = physics.bounce
    this.currentPresence = physics.presence
    this.currentPocket   = physics.pocket

    // Composer's role caps activity; reactive curve adds feel under the ceiling.
    const targetLevel = this.computeTargetLevel(organism) * this.roleCeiling()
    this.activityLevel += this.smoothingCoeff(80) * (targetLevel - this.activityLevel)
    this.setOutputLevel(this.activityLevel)
  }

  // Tunable micro-timing and groove settings
  private lazySnareMinMs: number = 5
  private lazySnareMaxMs: number = 15
  private hatCyclicPattern: number[] = [1.0, 0.4, 0.75, 0.5]
  private hatShuffleMinPct: number = 1.5
  private hatShuffleMaxPct: number = 3.0

  /** Forward genre target to the sampled kit so it can re-rank voice pools by profile. */
  setGenreTarget(subGenre: string): void {
    this.currentSubGenre = subGenre
    this.sampledKit!.setGenreTarget(subGenre)

    const sg = subGenre.toLowerCase()
    if (sg.includes('jazz') || sg.includes('latin') || sg.includes('funk')) {
      this.swingAmount = 0.08
    } else if (sg.includes('edm') || sg.includes('rock')) {
      this.swingAmount = 0
    } else if (sg.includes('boom-bap')) {
      this.swingAmount = 0.05
    } else if (sg.includes('lo-fi') || sg.includes('chill')) {
      this.swingAmount = 0.04
    } else {
      this.swingAmount = 0.02
    }
  }

  private enabled: boolean = true

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.reset()
    } else if (this.patternLocked && this.lockedHits.length > 0) {
      // onStateTransition returns early when pattern is locked, so rebuild
      // directly from the saved hits so the Part resumes immediately.
      this.rebuildPart(this.lockedHits)
    }
  }

  setLazySnareRange(minMs: number, maxMs: number): void {
    this.lazySnareMinMs = Math.max(0, minMs)
    this.lazySnareMaxMs = Math.max(minMs, maxMs)
  }

  setHatCyclicPattern(pattern: number[]): void {
    if (pattern.length > 0) {
      this.hatCyclicPattern = [...pattern]
    }
  }

  setHatShuffleRange(minPct: number, maxPct: number): void {
    this.hatShuffleMinPct = Math.max(0, minPct)
    this.hatShuffleMaxPct = Math.max(minPct, maxPct)
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
    if (!this.enabled) return
    if (to === OState.Dormant) {
      this.stopPart()
      this.activityLevel = 0
      return
    }

    // Apply the same rebuild throttle as loadGeneratedPattern — state transitions
    // and processFrame can both trigger rebuilds in the same cycle window.
    const now = performance.now()
    if (now - this.lastRebuildTime < DrumGenerator.MIN_REBUILD_INTERVAL_MS) return

    if (to === OState.Awakening) {
      this.stopPart()
      this.currentPhysicsMode = physics.mode
      const kit     = getDrumKit(physics.mode)
      const pattern = buildDrumPattern(kit, physics.mode)
      this.rebuildPart(pattern.hits)
      return
    }

    // Breathing or Flow → rebuild pattern from current mode
    // Skip if pattern is locked — user has frozen the groove
    if (this.patternLocked) return
    this.currentPhysicsMode = physics.mode
    const kit     = getDrumKit(physics.mode)
    const pattern = buildDrumPattern(kit, physics.mode)
    this.rebuildPart(pattern.hits)
  }

  reset(): void {
    this.stopPart()
    this.activityLevel   = 0
    this.currentBounce   = 0
    this.currentPresence = 0
    this.currentPocket   = 0
    this.hasStartedPlayback = false
    this.lastRebuildTime = 0  // clear throttle so next onStateTransition always rebuilds
    this.lastTriggerByVoice.clear()
    this.lastBroadcastSig  = ''
    this.lastBroadcastTime = 0
    this.setOutputLevel(0)
  }

  // ── Pattern lock ─────────────────────────────────────────────────
  // When locked, the drum pattern is frozen — physics/state transitions
  // no longer rebuild it. The user can still tweak individual parameters
  // (hat density, kick velocity, tempo) without losing the groove.

  private patternLocked = false
  private lockedHits: DrumHit[] = []
  private currentHits: DrumHit[] = []   // snapshot updated by rebuildPart

  lockPattern(): DrumHit[] {
    this.patternLocked = true
    // Use the snapshot stored by rebuildPart — no Tone.js internal access needed
    this.lockedHits = [...this.currentHits]
    return this.lockedHits
  }

  unlockPattern(): void {
    this.patternLocked = false
    this.lockedHits = []
  }

  isPatternLocked(): boolean { return this.patternLocked }

  getLockedHits(): DrumHit[] { return this.lockedHits }

  // ── Reactive mutation methods (Section 05) ────────────────────────

  setHatDensityMultiplier(multiplier: number): void {
    this.hatDensityMult = Math.max(0, multiplier)
  }

  setKickVelocityMultiplier(multiplier: number): void {
    this.kickVelocityMult = Math.max(0, multiplier)
  }

  // ── Private ──────────────────────────────────────────────────────

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:   return 0
      case OState.Awakening: return 0.25 * organism.awakeningProgress
      case OState.Breathing: return 0.56 * organism.breathingWarmth
      // 0.88 (was 0.78): the drums NEVER reached full level even in Flow, and
      // after the serial compressor stack there was no makeup gain anywhere —
      // the beat sat quiet against any reference, which reads as amateur before
      // the notes are even judged. Master headroom (-9 dB) + the -0.3 dBFS
      // WaveShaper ceiling absorb the increase safely.
      case OState.Flow:      return 0.88
      default:               return 0
    }
  }

  // Rebuild throttle — prevent rapid Part rebuilds from flooding the audio scheduler.
  // The MusicalDirector can trigger rebuilds on sub-genre changes, mutations, AND
  // state transitions. Without a throttle, these can pile up in the same frame.
  private lastRebuildTime: number = 0
  private static readonly MIN_REBUILD_INTERVAL_MS = 500

  /** Load an AI-generated pattern externally (Gap 2 — generative patterns).
   *  Honors `this.enabled` so MusicalDirector sub-genre changes and pattern
   *  mutations cannot force-inject drums while the user has soloed them off. */
  loadGeneratedPattern(hits: DrumHit[], force = false): void {
    if (!this.enabled) return
    const now = performance.now()
    if (!force && now - this.lastRebuildTime < DrumGenerator.MIN_REBUILD_INTERVAL_MS) return
    this.lastRebuildTime = now
    this.rawHits = hits
    this.rebuildPart(hits)
  }

  setSectionDensity(density: number): void {
    const prev = this.sectionDensity
    this.sectionDensity = Math.max(0, Math.min(1.5, density))
    const tierOf = (d: number) => d >= 0.75 ? 2 : d >= 0.45 ? 1 : 0
    if (tierOf(prev) !== tierOf(this.sectionDensity) && this.rawHits.length > 0 && !this.patternLocked) {
      this.rebuildPart(this.rawHits)
    }
  }

  /** Immediate audition hit for voice/WOW interactions. Disabled when the user
   *  has soloed drums off — vocal WOW shots must not bypass the mute. */
  triggerImmediateHit(instrument: DrumInstrument, velocity = 0.75): void {
    if (!this.enabled) return
    const time = Tone.now() + 0.018
    this.triggerDrum(instrument, time, Math.max(0.2, Math.min(1, velocity)), velocity)
  }

  /**
   * Section-impact hit — schedules a "drop boom" at the given AudioContext time.
   * Layers a low sub-octave kick (G0, long decay) under a brief noise burst to
   * give the entry into drop/drop2 sections the cinematic *thump* listeners
   * associate with a real producer drop. Honors the mute (this.enabled) so a
   * soloed-off kit can't be revived by section changes.
   *
   * @param time AudioContext.currentTime to schedule the hit at (default: next ~18ms)
   * @param velocity 0-1, default 0.95 — drops should be loud
   */
  triggerImpact(time?: number, velocity = 0.95): void {
    if (!this.enabled) return
    const at = time ?? Tone.now() + 0.018
    const vel = Math.max(0.5, Math.min(1, velocity))

    // Sub boom — drop the kick an octave below the current preset and stretch
    // its decay. We re-use kickSub rather than allocating a new voice so the
    // hit goes through the existing kick → kickBus → compressor signal chain.
    const subTime = this.clampTime('kickSub', at)
    this.kickSub!.triggerAttackRelease('G0', '2n', subTime, vel)
    // Click layer for transient definition on small speakers.
    this.triggerNoise('kickClick', this.kickClick!, '16n', at, vel * 0.55)
    // Hi-frequency splash — re-use the open-hat NoiseSynth via a longer release.
    // It already routes through the high-pass filter so it reads as cymbal-like.
    const hatTime = this.clampTime('hatOpen', at + 0.002)
    this.hatOpen!.triggerAttackRelease('4n', hatTime, vel * 0.7)

    this.lastKickTime = subTime
    if (this.onKickTrigger) this.onKickTrigger(subTime)
  }

  // ── Kit presets — deterministic per mode so the groove keeps one body ──

  private static readonly KIT_PRESETS = [
    // Classic — warm boom-bap feel
    { kickNote: 'C1',  kickPitchDecay: 0.05, kickVol: -6,  snareDecay: 0.15, snareVol: -9,  hatDecay: 0.05, hatVol: -19, hatResonance: 3400, percDecay: 0.07, percVol: -21 },
    // Punchy — tighter transients, brighter hat
    { kickNote: 'D1',  kickPitchDecay: 0.03, kickVol: -5,  snareDecay: 0.10, snareVol: -8,  hatDecay: 0.03, hatVol: -19, hatResonance: 3800, percDecay: 0.05, percVol: -20 },
    // Lo-fi / dusty — deep kick, long snare, muffled hat
    { kickNote: 'A#0', kickPitchDecay: 0.08, kickVol: -8,  snareDecay: 0.22, snareVol: -11, hatDecay: 0.08, hatVol: -22, hatResonance: 2600, percDecay: 0.10, percVol: -23 },
    // Hard — higher pitch kick, crispy hat, tight snare
    { kickNote: 'E1',  kickPitchDecay: 0.04, kickVol: -5,  snareDecay: 0.12, snareVol: -8,  hatDecay: 0.04, hatVol: -20, hatResonance: 3600, percDecay: 0.06, percVol: -21 },
    // Deep 808 — very sub-heavy kick, dry snare snap, minimal hat
    { kickNote: 'G0',  kickPitchDecay: 0.09, kickVol: -5,  snareDecay: 0.08, snareVol: -8,  hatDecay: 0.025, hatVol: -22, hatResonance: 4200, percDecay: 0.04, percVol: -24 },
    // Crispy Trap — short punchy kick, sharp snare, sparkly hat
    { kickNote: 'F1',  kickPitchDecay: 0.02, kickVol: -5,  snareDecay: 0.09, snareVol: -7,  hatDecay: 0.025, hatVol: -20, hatResonance: 3900, percDecay: 0.04, percVol: -20 },
    // Vinyl — wide pitch decay, long dusty snare, rolled-off hat
    { kickNote: 'B0',  kickPitchDecay: 0.10, kickVol: -7,  snareDecay: 0.28, snareVol: -12, hatDecay: 0.10, hatVol: -23, hatResonance: 2300, percDecay: 0.12, percVol: -24 },
  ] as const

  // Map physics modes to one grounded kit preset. Random kit swaps were making
  // the drummer sound like it changed rooms whenever the pattern rebuilt.
  // Indices match KIT_PRESETS array: 0=Classic, 1=Punchy, 2=Lo-fi, 3=Hard, 4=Deep808, 5=CrispyTrap, 6=Vinyl
  private static readonly MODE_KIT_MAP: Record<string, number> = {
    [OrganismMode.Heat]:   1,
    [OrganismMode.Gravel]: 0,
    [OrganismMode.Smoke]:  0,
    [OrganismMode.Ice]:    2,
    [OrganismMode.Glow]:   0,
  }

  private currentPhysicsMode: OrganismMode = OrganismMode.Glow
  private sectionDensity: number = 1.0
  private rawHits: DrumHit[] = []
  private grooveSnareLagMs: number[] = Array(16).fill(0)
  private grooveHatShiftPct: number[] = []

  private buildGrooveTemplate(): void {
    // Generate static humanization offsets per 16th-slot
    this.grooveHatShiftPct = Array.from({ length: 16 }, () => (Math.random() - 0.5) * 1.5)
    this.grooveSnareLagMs  = Array.from({ length: 16 }, () => Math.random() * 8)
  }

  private applyKitPreset(): void {
    const idx    = DrumGenerator.MODE_KIT_MAP[this.currentPhysicsMode] ?? 0
    const preset = DrumGenerator.KIT_PRESETS[idx]
    this.sampledKit!.setKeyRoot(getConductor().getKeyPitchClass())
    this.sampledKit!.setMode(this.currentPhysicsMode)
    this.currentKickNote          = preset.kickNote
    this.kickSub!.pitchDecay       = preset.kickPitchDecay
    this.kickSub!.volume.rampTo(preset.kickVol, 0.3)
    this.snareBody!.envelope.decay = preset.snareDecay
    this.snareBody!.volume.rampTo(preset.snareVol, 0.3)
    this.hat!.envelope.decay       = preset.hatDecay
    this.hat!.volume.rampTo(preset.hatVol, 0.3)
    this.perc!.envelope.decay      = preset.percDecay
    this.perc!.volume.rampTo(preset.percVol, 0.3)
  }

  private rebuildPart(hits: DrumHit[]): void {
    this.applyKitPreset()
    
    // Section density thinning: sparse sections (intro, breakdown) keep the
    // essential kick/snare backbeat and filter out hats and perc entirely.
    const thinned = hits.filter(h => {
      if (this.sectionDensity >= 0.75) return true                 // drop/build: full pattern
      if (this.sectionDensity >= 0.45) return h.instrument !== DrumInstrument.Perc  // verse: no fills
      // intro/breakdown (< 0.45): keep only Kick and Snare for the sparse backbeat
      return h.instrument === DrumInstrument.Kick || h.instrument === DrumInstrument.Snare
    })

    const quantizedHits = thinned.map(h => ({
      ...h,
      time: quantizeGridTime(h.time),
    }))
    this.currentHits = [...quantizedHits]   // snapshot for lockPattern()
    this.broadcastToBeatMaker(quantizedHits)

    // Groove template — stable per-slot offsets, NOT per-event randomness.
    if (this.grooveHatShiftPct.length === 0) this.buildGrooveTemplate()

    let finalHits = [...quantizedHits]
    if (this.isSoloMode) {
      const soloSnareGhosts: DrumHit[] = []
      for (const h of quantizedHits) {
        if (h.instrument === DrumInstrument.Snare) {
          const parts = h.time.split(':')
          const bar = parts[0]
          const beat = parseInt(parts[1] ?? '0', 10)
          if (beat >= 1) {
            soloSnareGhosts.push({ instrument: DrumInstrument.Snare, time: `${bar}:${beat - 1}:2.00`, velocity: 0.28 })
          }
          if (beat <= 2) {
            soloSnareGhosts.push({ instrument: DrumInstrument.Snare, time: `${bar}:${beat}:2.00`, velocity: 0.22 })
          }
        }
      }
      finalHits = [...quantizedHits, ...soloSnareGhosts]
    }

    this.emitDrumEvents(finalHits)

    const events = finalHits.map(h => {
      const parts = h.time.split(':')
      const beat = parseInt(parts[1] ?? '0', 10)
      const sub = parseFloat(parts[2] ?? '0')

      let microShift = 0

      // 1. Lazy Snare: backbeats (2 and 4) land late by the template's lag
      if (h.instrument === DrumInstrument.Snare && (beat === 1 || beat === 3) && sub === 0) {
        microShift = (this.grooveSnareLagMs[beat] ?? 0) / 1000
      }

      // 2. Hat shuffle: off-beat 16ths pushed late by the template's per-slot
      //    percentage of a 16th — the same slot always lands the same amount late.
      if (h.instrument === DrumInstrument.Hat) {
        const sixteenthPos = Math.floor(beat * 4 + sub) % 16
        const shiftPct = (this.grooveHatShiftPct[sixteenthPos] ?? 0) / 100
        if (shiftPct > 0) {
          const bpm = Tone.getTransport().bpm.value || 120
          const sixteenthDurationSec = 60 / (bpm * 4)
          microShift = shiftPct * sixteenthDurationSec
        }
        if (sixteenthPos % 2 === 1) {
          microShift += this.swingAmount
        }
      }

      return {
        time:       h.time,
        instrument: h.instrument,
        velocity: h.velocity,
        microShift,
      }
    })

    const startAt = getLivePartStart(this.hasStartedPlayback)

    const transport = Tone.getTransport()
    const oldPart = this.part
    if (oldPart) {
      if (transport.state === 'started' && this.hasStartedPlayback && startAt !== 0) {
        oldPart.stop(startAt)
        const msUntilStart = msUntilTransportTime(startAt)
        window.setTimeout(() => oldPart.dispose(), Math.max(50, msUntilStart + 250))
      } else {
        try { oldPart.stop() } catch { }
        oldPart.dispose()
      }
      this.lastTriggerByVoice.clear()
    }
    this.part = null

    this.part = new Tone.Part((time, event) => {
      const vel = this.applyDynamics(event.instrument, event.velocity, time)
      // Pattern velocity picks the voice (open vs closed hat); dynamics-adjusted
      // velocity sets loudness — so a kick-duck can't flip an open hat closed.
      this.triggerDrum(event.instrument, time + (event.microShift ?? 0), vel, event.velocity)
    }, events)

    this.part.loop    = true
    this.part.loopEnd = '4m'
    this.part.start(startAt, livePartStartOffset(startAt, 4))
    this.hasStartedPlayback = true
  }

  private lastBroadcastSig: string = ''
  private lastBroadcastTime: number = 0
  private static readonly MIN_BROADCAST_INTERVAL_MS = 500

  private broadcastToBeatMaker(hits: DrumHit[]): void {
    const sig = hits.map(h => `${h.instrument}@${h.time}:${h.velocity.toFixed(2)}`).join('|')
    const now = performance.now()
    if (sig === this.lastBroadcastSig) return
    if (now - this.lastBroadcastTime < DrumGenerator.MIN_BROADCAST_INTERVAL_MS) return
    this.lastBroadcastSig  = sig
    this.lastBroadcastTime = now

    const STEPS = 64 
    const instToId: Record<string, string> = {
      [DrumInstrument.Kick]:  'kick',
      [DrumInstrument.Snare]: 'snare',
      [DrumInstrument.Hat]:   'hihat',
      [DrumInstrument.Perc]:  'perc',
    }

    const trackMap: Record<string, { active: boolean; velocity: number }[]> = {
      kick:  Array.from({ length: STEPS }, () => ({ active: false, velocity: 100 })),
      snare: Array.from({ length: STEPS }, () => ({ active: false, velocity: 100 })),
      hihat: Array.from({ length: STEPS }, () => ({ active: false, velocity: 100 })),
      perc:  Array.from({ length: STEPS }, () => ({ active: false, velocity: 100 })),
    }

    for (const h of hits) {
      const id = instToId[h.instrument]
      if (!id || !trackMap[id]) continue
      const parts = h.time.split(':')
      const bar  = parseInt(parts[0] ?? '0', 10)
      const beat = parseInt(parts[1] ?? '0', 10)
      const sub  = Math.floor(parseFloat(parts[2] ?? '0'))
      const step = bar * 16 + beat * 4 + sub
      if (step >= 0 && step < STEPS) {
        trackMap[id][step] = { active: true, velocity: Math.round(h.velocity * 127) }
      }
    }

    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('ai:loadBeatPattern', {
      detail: {
        tracks: Object.entries(trackMap).map(([id, pattern]) => ({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          pattern,
        })),
        bpm: Tone.getTransport().bpm.value,
        source: 'organism',
        silent: true,
      },
    }))
  }

  private applyDynamics(instrument: DrumInstrument, baseVelocity: number, time: number): number {
    let vel = baseVelocity

    const profile = GENRE_VELOCITY_PROFILES[this.currentSubGenre.toLowerCase()] || GENRE_VELOCITY_PROFILES['default']
    vel = profile(vel)

    if (instrument === DrumInstrument.Kick) {
      vel *= (1 + this.currentBounce * 0.5) * this.kickVelocityMult
    }

    if (instrument === DrumInstrument.Hat) {
      const msSinceKick = (time - this.lastKickTime) * 1000
      const kickDuck = (msSinceKick >= 0 && msSinceKick < 80) ? Math.max(0.35, msSinceKick / 80) : 1.0
      vel *= kickDuck * this.hatDensityMult
    }

    if (this.isSoloMode) {
      // Accent solo hits and add subtle natural humanized random variance
      if (instrument === DrumInstrument.Snare || instrument === DrumInstrument.Kick) {
        vel = vel * 1.15
      }
      vel += (Math.random() - 0.5) * 0.08
    }

    return Math.min(1, Math.max(0, vel))
  }

  private clampTime(voice: string, t: number): number {
    const now = Tone.now()
    const last = this.lastTriggerByVoice.get(voice) ?? 0
    const safeBase = Math.max(t, now + 0.002)
    const safe = safeBase > last + 0.001 ? safeBase : last + 0.001
    this.lastTriggerByVoice.set(voice, safe)
    return safe
  }

  private triggerNoise(
    voice: string,
    synth: Tone.NoiseSynth,
    duration: Tone.Unit.Time,
    time: number,
    velocity: number,
  ): void {
    const t = this.clampTime(voice, time)
    try {
      synth.triggerAttackRelease(duration, t, velocity)
    } catch (err) {
      if (err instanceof Error && err.message.includes('Start time must be strictly greater')) return
      throw err
    }
  }

  private triggerDrum(instrument: DrumInstrument, time: number, velocity: number, voiceVelocity: number): void {
    const t = Math.max(0, time)

    const sampledVoice = instrument === DrumInstrument.Hat && voiceVelocity > 0.55 ? 'sampleHatOpen' : `sample${instrument}`
    const sampledTime = this.clampTime(sampledVoice, t)
    if (this.sampledKit!.trigger(instrument, sampledTime, velocity, voiceVelocity)) {
      if (instrument === DrumInstrument.Kick) {
        this.lastKickTime = sampledTime
        if (this.onKickTrigger) this.onKickTrigger(sampledTime)
      }
      return
    }

    switch (instrument) {
      case DrumInstrument.Kick: {
        const tSub = this.clampTime('kickSub', t)
        this.kickSub!.triggerAttackRelease(this.currentKickNote, '8n', tSub, velocity)
        this.triggerNoise('kickClick', this.kickClick!, '32n', t, velocity * 0.6)
        this.lastKickTime = tSub
        if (this.onKickTrigger) this.onKickTrigger(tSub)
        break
      }
      case DrumInstrument.Snare: {
        const tTone = this.clampTime('snareTone', t)
        this.triggerNoise('snareBody', this.snareBody!, '8n', t, velocity)
        this.snareTone!.triggerAttackRelease('E3', '16n', tTone, velocity * 0.7)
        break
      }
      case DrumInstrument.Hat:
        if (voiceVelocity > 0.55) {
          const tOpen = this.clampTime('hatOpen', t)
          this.hatOpen!.triggerAttackRelease('32n', tOpen, velocity * 0.85)
        } else {
          const tHat = this.clampTime('hat', t)
          this.hat!.triggerAttackRelease('32n', tHat, velocity)
        }
        break
      case DrumInstrument.Perc: {
        this.triggerNoise('perc', this.perc!, '16n', t, velocity)
        break
      }
    }
  }

  stopPart(): void {
    this.clearBarEndBreakFill()
    this.clearMicroFill()
    if (this.part) {
      this.part.stop()
      this.part.dispose()
      this.part = null
    }
    this.lastTriggerByVoice.clear()
  }

  private _microFillEventIds: number[] = []

  triggerMicroFill(time: number, fillIndex: number): void {
    this.clearMicroFill()
    const transport = Tone.getTransport()
    const bpm  = transport.bpm.value || 120
    const beat = 60 / bpm
    const s16  = beat / 4
    const s32  = beat / 8

    const ids: number[] = []
    const sched = (dt: number, instr: DrumInstrument, vel: number) => {
      ids.push(transport.scheduleOnce(t => this.triggerDrum(instr, t, vel, vel), time + dt))
    }

    switch (fillIndex % 3) {
      case 0: 
        sched(0,       DrumInstrument.Hat,   0.55)
        sched(s32,     DrumInstrument.Hat,   0.63)
        sched(s32 * 2, DrumInstrument.Hat,   0.71)
        sched(s32 * 3, DrumInstrument.Hat,   0.80)
        break
      case 1:
        {
          const ghostSnareTime = Math.max(Tone.now() + 0.005, time - s16)
          ids.push(transport.scheduleOnce(t => this.triggerDrum(DrumInstrument.Snare, t, 0.22, 0.22), ghostSnareTime))
          sched(0,    DrumInstrument.Snare, 0.75)
        }
        break
      case 2:
        sched(beat,       DrumInstrument.Kick, 0.80)
        sched(beat + s16, DrumInstrument.Kick, 0.55)
        break
    }

    this._microFillEventIds = ids
  }

  clearMicroFill(): void {
    this._microFillEventIds.forEach(id => Tone.getTransport().clear(id))
    this._microFillEventIds = []
  }

  triggerBarEndBreakFill(time: number): void {
    this.clearBarEndBreakFill()

    const bpm = Tone.getTransport().bpm.value || 120
    const beatDurationSec = 60 / bpm
    const step32ndSec = beatDurationSec / 8

    const events = Array.from({ length: 16 }, (_, i) => ({
      time: i * step32ndSec,
      velocity: i % 2 === 0 ? 0.75 : 0.4
    }))

    this.breakFillPart = new Tone.Part((hitTime, event) => {
      this.triggerDrum(DrumInstrument.Hat, time + hitTime, event.velocity, event.velocity)
    }, events)

    this.breakFillPart.start(time)
  }

  clearBarEndBreakFill(): void {
    if (this.breakFillPart) {
      try { this.breakFillPart.stop() } catch { }
      try { this.breakFillPart.dispose() } catch { }
      this.breakFillPart = null
    }
  }

  setKickTriggerCallback(cb: ((time: number) => void) | null): void {
    this.onKickTrigger = cb
  }

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier
    const linear = shaped <= 0.0001 ? 0 : shaped
    if (Math.abs(linear - this.lastOutputGain) < 0.008) return
    this.lastOutputGain = linear
    this.output.gain.cancelScheduledValues(Tone.now())
    this.output.gain.rampTo(linear, 0.35)
  }

  dispose(): void {
    this.stopPart()
    this.kickSub?.dispose()
    this.kickClick?.dispose()
    this.kickBus?.dispose()
    this.kickDist?.dispose()
    this.snareBody?.dispose()
    this.snareTone?.dispose()
    this.snareBus?.dispose()
    this.hat?.dispose()
    this.hatOpen?.dispose()
    this.hatFilter?.dispose()
    this.perc?.dispose()
    this.percFilter?.dispose()
    this.sampledKit?.dispose()
    this.sampleBus?.dispose()
    this.compressor?.dispose()
    this.output.dispose()

    this.kickSub = null
    this.kickClick = null
    this.kickBus = null
    this.kickDist = null
    this.snareBody = null
    this.snareTone = null
    this.snareBus = null
    this.hat = null
    this.hatOpen = null
    this.hatFilter = null
    this.perc = null
    this.percFilter = null
    this.sampledKit = null
    this.sampleBus = null
    this.compressor = null
  }
}
