// Section 04 — Drum Generator

import * as Tone from 'tone'
import type { LoopClip } from '@shared/loopPack'
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
import { mulberry32, hashString, getSessionSalt } from './freeplay/utils'
import type { PhysicsState }   from '../physics/types'
import { OrganismMode }        from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'
import { getConductor }        from '../conductor/Conductor'

export class DrumGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  // Kick: sub layer + click transient
  private kickSub:   Tone.MembraneSynth
  private kickClick: Tone.NoiseSynth
  private kickBus:   Tone.Gain
  private kickDist:  Tone.Distortion

  // Snare: noise body + tonal ring
  private snareBody: Tone.NoiseSynth
  private snareTone: Tone.MembraneSynth
  private snareBus:  Tone.Gain

  // Hat: closed (short decay) + open (long decay) — NoiseSynth + highpass sounds
  // far more like real hi-hats than MetalSynth's FM screech which reads as techno.
  private hat:        Tone.NoiseSynth
  private hatOpen:    Tone.NoiseSynth
  private hatFilter:  Tone.Filter

  // Perc: bandpass noise
  private perc:       Tone.NoiseSynth
  private percFilter: Tone.Filter

  // Master drum bus
  private compressor: Tone.Compressor
  private sampleBus: Tone.Gain
  private sampledKit: SampledDrumKit

  private part: Tone.Part | null = null
  private breakFillPart: Tone.Part | null = null
  private microFillPart: Tone.Part | null = null
  private hasStartedPlayback: boolean = false

  // Loop playback (_loopPlayer / _loopMode / loadLoop / setLoopMode / swapLoop)
  // is centralized in GeneratorBase.

  // Physics cache
  private currentBounce:   number = 0
  private currentPresence: number = 0
  private currentPocket:   number = 0

  // Kit preset — timbre varies per pattern rebuild for sound variety
  private currentKickNote: string = 'C1'

  // Reactive multipliers (Section 05)
  private hatDensityMult:      number = 1.0
  private kickVelocityMult:    number = 1.0

  // Section density — drives hit thinning so an intro actually sounds sparse
  // rather than playing the full drop pattern at low volume. Set by the
  // orchestrator from the ProducerArrangement drums multiplier.
  private sectionDensity: number = 1.0

  // Sidechain callback — fired on every kick hit so the bass channel can duck
  private onKickTrigger: ((time: number) => void) | null = null

  // Track last kick time for hat-on-kick ducking
  private lastKickTime: number = 0
  private lastOutputGain: number = 0

  // Per-voice last-trigger time. Monophonic Tone synths (MembraneSynth, NoiseSynth,
  // MetalSynth) require every new trigger time to be ≥ the previous one on that voice.
  // Humanization jitter can go negative, so we clamp each voice's next time here.
  private lastTriggerByVoice: Map<string, number> = new Map()

  // Subscribe to conductor chord changes so we can accent beat 1 of each
  // new harmonic cycle — the musical "arrival" moment that makes the kit
  // feel like it's playing WITH the harmony, not beside it.
  private unsubConductor: (() => void) | null = null

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

    // Chord-change kick accent: on every advanceChord() call (fires one bar before
    // the chord lands at barNumber % 4 === 3), schedule a strong kick on the
    // downbeat of the landing bar. This is the head-nod moment — kick + bass root
    // arriving together on the new chord. The accent is additive (one-shot on top
    // of the looping pattern) so it doesn't require a Part rebuild.
    this.unsubConductor = getConductor().onChordChange(() => {
      // Keep the kick tuned to the song key (cheap — no-ops when unchanged).
      this.sampledKit.setKeyRoot(getConductor().getKeyPitchClass())
      const transport = Tone.getTransport()
      if (transport.state !== 'started') return
      // Chord fires 1 bar early (barNumber % 4 === 3); landing is next bar.
      // Use the transport position to compute the exact next-bar downbeat.
      const pos = String(transport.position)
      const bar = parseInt(pos.split(':')[0], 10) || 0
      const landingBar = `${bar + 1}:0:0`
      transport.scheduleOnce((audioTime) => {
        this.triggerDrum(DrumInstrument.Kick, audioTime, 0.95)
      }, landingBar)
    })
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    if (this._loopMode) return
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
  private hatShuffleMinPct: number = 1.5
  private hatShuffleMaxPct: number = 3.0

  // ── Groove template (the pocket) ──────────────────────────────────
  // Per-16th-slot micro-timing offsets that are STABLE across bars and
  // rebuilds — like an MPC groove template. The previous per-event
  // Math.random() jitter re-rolled every hit on every rebuild: uncorrelated
  // noise reads as a sloppy drummer, while the SAME slot always landing the
  // same few ms late reads as a human pocket.
  private grooveHatShiftPct: number[] = []   // shuffle push per 16th slot (off-16ths only)
  private grooveSnareLagMs:  number[] = []   // lazy-snare lag per beat (0..3)

  private buildGrooveTemplate(): void {
    const rng = mulberry32(hashString(`groove:${this.currentPhysicsMode}`) + getSessionSalt())
    this.grooveHatShiftPct = Array.from({ length: 16 }, (_, slot) =>
      slot % 2 === 1
        ? this.hatShuffleMinPct + rng() * (this.hatShuffleMaxPct - this.hatShuffleMinPct)
        : 0,
    )
    this.grooveSnareLagMs = Array.from({ length: 4 }, () =>
      this.lazySnareMinMs + rng() * (this.lazySnareMaxMs - this.lazySnareMinMs),
    )
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
    this.buildGrooveTemplate()
  }

  setHatShuffleRange(minPct: number, maxPct: number): void {
    this.hatShuffleMinPct = Math.max(0, minPct)
    this.hatShuffleMaxPct = Math.max(minPct, maxPct)
    this.buildGrooveTemplate()
  }

  setSectionDensity(density: number): void {
    const prev = this.sectionDensity
    this.sectionDensity = Math.max(0, Math.min(1.5, density))
    // If the density tier changed (skeleton ↔ verse ↔ full) and we have a
    // previously-built pattern, re-apply the filter immediately rather than
    // waiting for the next physics-state transition to trigger rebuildPart.
    const tierOf = (d: number) => d >= 0.75 ? 2 : d >= 0.45 ? 1 : 0
    if (tierOf(prev) !== tierOf(this.sectionDensity) && this.rawHits.length > 0 && !this.patternLocked) {
      this.rebuildPart(this.rawHits)
    }
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
    if (this._loopMode) return
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
  // Unfiltered hits from the last pattern build — kept so setSectionDensity()
  // can re-filter and re-schedule without needing a full physics-state rebuild.
  private rawHits: DrumHit[] = []

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
    this.rebuildPart(hits)
  }

  /** Immediate audition hit for voice/WOW interactions. Disabled when the user
   *  has soloed drums off — vocal WOW shots must not bypass the mute. */
  triggerImmediateHit(instrument: DrumInstrument, velocity = 0.75): void {
    if (!this.enabled) return
    const time = Tone.now() + 0.018
    this.triggerDrum(instrument, time, Math.max(0.2, Math.min(1, velocity)))
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
    this.kickSub.triggerAttackRelease('G0', '2n', subTime, vel)
    // Click layer for transient definition on small speakers.
    this.triggerNoise('kickClick', this.kickClick, '16n', at, vel * 0.55)
    // Hi-frequency splash — re-use the open-hat NoiseSynth via a longer release.
    // It already routes through the high-pass filter so it reads as cymbal-like.
    const hatTime = this.clampTime('hatOpen', at + 0.002)
    this.hatOpen.triggerAttackRelease('4n', hatTime, vel * 0.7)

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

  /** Forward genre target to the sampled kit so it can re-rank voice pools by profile. */
  setGenreTarget(subGenre: string): void {
    this.sampledKit.setGenreTarget(subGenre)
  }

  private applyKitPreset(): void {
    const idx    = DrumGenerator.MODE_KIT_MAP[this.currentPhysicsMode] ?? 0
    const preset = DrumGenerator.KIT_PRESETS[idx]
    this.sampledKit.setMode(this.currentPhysicsMode)
    this.buildGrooveTemplate()  // pocket is seeded per mode — stable until mode changes
    this.currentKickNote          = preset.kickNote
    this.kickSub.pitchDecay       = preset.kickPitchDecay
    this.kickSub.volume.rampTo(preset.kickVol, 0.3)
    this.snareBody.envelope.decay = preset.snareDecay
    this.snareBody.volume.rampTo(preset.snareVol, 0.3)
    this.hat.envelope.decay       = preset.hatDecay
    this.hat.volume.rampTo(preset.hatVol, 0.3)
    this.perc.envelope.decay      = preset.percDecay
    this.perc.volume.rampTo(preset.percVol, 0.3)
  }

  private rebuildPart(hits: DrumHit[]): void {
    if (this._loopMode) return
    this.applyKitPreset()

    // Preserve unfiltered hits so setSectionDensity() can re-filter on section
    // changes without waiting for a full physics-state pattern rebuild.
    this.rawHits = [...hits]

    // Section density thinning: sparse sections (intro, breakdown) keep the
    // essential kick/snare/hat backbeat and only drop percussive fills. Removing
    // snares made intros sound like a broken metronome instead of a beat.
    const thinned = hits.filter(h => {
      if (this.sectionDensity >= 0.75) return true                 // drop/build: full pattern
      if (this.sectionDensity >= 0.45) return h.instrument !== DrumInstrument.Perc  // verse: no fills
      return h.instrument !== DrumInstrument.Perc                  // intro/breakdown: no fills, keep backbeat
    })

    const quantizedHits = thinned.map(h => ({
      ...h,
      time: quantizeGridTime(h.time),
    }))
    this.currentHits = [...quantizedHits]   // snapshot for lockPattern()
    this.emitDrumEvents(quantizedHits)

    // Groove template — stable per-slot offsets, NOT per-event randomness.
    // NOTE: velocities pass through untouched. The pattern sources (freeplay
    // improviser / authored library) already shape hat velocities; the old
    // hatCyclicPattern multiply here was a SECOND attenuation that crushed
    // 16th-infill hats to near-zero (0.22 pattern vel × 0.4 cycle = inaudible).
    if (this.grooveHatShiftPct.length === 0) this.buildGrooveTemplate()

    const events = quantizedHits.map(h => {
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
      }

      return {
        time:       h.time,
        instrument: h.instrument,
        velocity:   h.velocity,
        microShift,
      }
    })

    const startAt = getLivePartStart(this.hasStartedPlayback)

    // Seamless handoff: schedule the old Part to stop exactly when the new one
    // starts, so there is no silence gap between section changes. If the
    // transport is not running (or this is the very first build), stop
    // immediately as there is nothing audible to preserve.
    const transport = Tone.getTransport()
    const oldPart = this.part
    if (oldPart) {
      if (transport.state === 'started' && this.hasStartedPlayback && startAt !== 0) {
        oldPart.stop(startAt)
        // startAt is a ticks TransportTime (see CompositionClock.getLivePartStart).
        // Dispose only AFTER the boundary, generously padded — disposing early
        // destroys the incoming part's handoff window; disposing late is free.
        const msUntilStart = msUntilTransportTime(startAt)
        window.setTimeout(() => oldPart.dispose(), Math.max(50, msUntilStart + 250))
      } else {
        // Transport "now" can float-round to ~-2e-10 right after Transport.stop();
        // Tone rejects negative times with an uncaught RangeError that aborts the
        // whole preset-swap chain. dispose() below still unschedules everything.
        try { oldPart.stop() } catch { /* negative-time rounding — dispose handles it */ }
        oldPart.dispose()
      }
      this.lastTriggerByVoice.clear()
    }
    this.part = null

    this.part = new Tone.Part((time, event) => {
      const vel = this.applyDynamics(event.instrument, event.velocity)
      // Pattern velocity picks the voice (open vs closed hat); dynamics-adjusted
      // velocity sets loudness — so a kick-duck can't flip an open hat closed.
      this.triggerDrum(event.instrument, time + (event.microShift ?? 0), vel, event.velocity)
    }, events)

    this.part.loop    = true
    this.part.loopEnd = '4m'
    // Phase-aligned: continue the 4-bar pattern from the current musical bar
    // instead of restarting at bar 0 on every rebuild.
    this.part.start(startAt, livePartStartOffset(startAt, 4))
    this.hasStartedPlayback = true
    orgLog('drum:part-started', {
      hits: events.length,
      startGrid: '1m',
      startAt: typeof startAt === 'number' ? Number(startAt.toFixed(3)) : startAt,
      transportState: Tone.getTransport().state,
      transportPos:   Tone.getTransport().position,
      ctxState:       Tone.getContext().state,
    })

    // Gap 3 — mirror current pattern into ProBeatMaker for visual display
    this.broadcastToBeatMaker(quantizedHits)
  }

  // Broadcast dedup — avoids spamming React with identical beat-grid events.
  // Rebuilds can fire on physics changes that produce the exact same hits.
  private lastBroadcastSig: string = ''
  private lastBroadcastTime: number = 0
  private static readonly MIN_BROADCAST_INTERVAL_MS = 500

  /**
   * Converts organism drum hits to the ProBeatMaker step format and dispatches
   * 'ai:loadBeatPattern' so the Beat Maker tab shows what the Organism is playing.
   */
  private broadcastToBeatMaker(hits: DrumHit[]): void {
    // Cheap pattern fingerprint — if identical to last broadcast, skip.
    const sig = hits.map(h => `${h.instrument}@${h.time}:${h.velocity.toFixed(2)}`).join('|')
    const now = performance.now()
    if (sig === this.lastBroadcastSig) return
    if (now - this.lastBroadcastTime < DrumGenerator.MIN_BROADCAST_INTERVAL_MS) return
    this.lastBroadcastSig  = sig
    this.lastBroadcastTime = now

    const STEPS = 64 // 4 bars × 16 steps per bar
    // DrumInstrument 'hat' → ProBeatMaker track id 'hihat'
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
      // Parse "bar:beat:sub" — sub may have swing decimal e.g. "0:1:1.35"
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

  private applyDynamics(instrument: DrumInstrument, baseVelocity: number): number {
    let vel = baseVelocity

    // Bounce → boost kick + reactive multiplier
    if (instrument === DrumInstrument.Kick) {
      vel *= (1 + this.currentBounce * 0.5) * this.kickVelocityMult
    }

    // Duck hats when kick fires (sidechain-style groove breathing)
    // Uses time-based proximity to last kick hit rather than voice presence
    if (instrument === DrumInstrument.Hat) {
      const now = Tone.now()
      const msSinceKick = (now - this.lastKickTime) * 1000
      // Fast duck near kick, recover over ~80ms
      const kickDuck = msSinceKick < 80 ? Math.max(0.35, msSinceKick / 80) : 1.0
      vel *= kickDuck * this.hatDensityMult
    }

    return Math.min(1, Math.max(0, vel))
  }

  // Enforce monotonic scheduling per voice. Monophonic Tone synths throw when
  // a new event lands before the previous one on the same voice's timeline.
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
      if (err instanceof Error && err.message.includes('Start time must be strictly greater')) {
        console.warn('[Organism] dropped drum noise hit with invalid schedule time', {
          voice,
          requestedTime: time,
          clampedTime: t,
          now: Tone.now(),
        })
        return
      }
      throw err
    }
  }

  private triggerDrum(instrument: DrumInstrument, time: number, velocity: number, voiceVelocity = velocity): void {
    const t = Math.max(0, time)

    const sampledVoice = instrument === DrumInstrument.Hat && voiceVelocity > 0.55 ? 'sampleHatOpen' : `sample${instrument}`
    const sampledTime = this.clampTime(sampledVoice, t)
    if (this.sampledKit.trigger(instrument, sampledTime, velocity, voiceVelocity)) {
      if (instrument === DrumInstrument.Kick) {
        this.lastKickTime = sampledTime
        if (this.onKickTrigger) this.onKickTrigger(sampledTime)
      }
      return
    }

    // All Cymatics sample slots exhausted for this voice — go silent.
    // Synth oscillator fallback intentionally removed: a missing hit in a
    // hip-hop track is far less disruptive than a MembraneSynth/NoiseSynth thump
    // that reads as the wrong kit entirely. The merged primary+fallback pool in
    // SampledDrumKit means this path is only reached when every committed WAV
    // for this voice has permanently 404'd (server misconfiguration), which
    // should never happen in normal operation.
    //
    // Sidechain state still updates on silent kicks so bass-ducking stays
    // phase-consistent — prevents a "pop" from the bass un-ducking unexpectedly.
    //
    // NOTE: kickSub, kickClick, snareBody, snareTone, hat, hatOpen, perc synth
    // voices are retained — they are used exclusively by triggerImpact() for
    // the section-drop "cinematic thump" effect, NOT as drum-kit fallbacks.
    if (instrument === DrumInstrument.Kick) {
      this.lastKickTime = t
      if (this.onKickTrigger) this.onKickTrigger(t)
    }
  }

  private startSubKickRise(): void {
    // Very soft kick pulse during awakening
    this.kickSub.volume.rampTo(-24, 2)
  }

  /** Public so the orchestrator can hard-cut the part on a live preset swap
   *  (see GeneratorOrchestrator.cutActivePartsForSwap). Otherwise internal. */
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

  triggerBarEndBreakFill(time: number): void {
    this.clearBarEndBreakFill()

    const bpm = Tone.getTransport().bpm.value || 120
    const beatDurationSec = 60 / bpm
    const step32ndSec = beatDurationSec / 8

    // Generate 16 steps of 32nd notes (for 2 beats total break duration)
    const events = Array.from({ length: 16 }, (_, i) => ({
      time: i * step32ndSec,
      velocity: i % 2 === 0 ? 0.75 : 0.4 // bouncy hi-hat pattern
    }))

    this.breakFillPart = new Tone.Part((hitTime, event) => {
      // Trigger a closed hi-hat hit on the grid
      this.triggerDrum(DrumInstrument.Hat, time + hitTime, event.velocity)
    }, events)

    this.breakFillPart.start(time)
  }

  clearBarEndBreakFill(): void {
    if (this.breakFillPart) {
      try { this.breakFillPart.stop() } catch { /* */ }
      try { this.breakFillPart.dispose() } catch { /* */ }
      this.breakFillPart = null
    }
  }

  /**
   * Trigger a 1-beat micro-fill at `time` (audio-clock seconds).
   * Fires on beat 3 of every 4th bar to break up the loop feeling without
   * a full section break. Three types rotate so consecutive 4-bar marks
   * each have a different character:
   *   0 — hat stutter  (4× 32nd closed hats: "tss tss tss tss")
   *   1 — ghost snare  (quiet ghost on the "and" of beat 2 → normal snare on beat 3)
   *   2 — kick echo    (extra kick on the "and" of beat 4 — trap stuttered kick)
   */
  triggerMicroFill(time: number, fillIndex: number): void {
    this.clearMicroFill()
    const transport = Tone.getTransport()
    const bpm  = transport.bpm.value || 120
    const beat = 60 / bpm
    const s16  = beat / 4
    const s32  = beat / 8

    // Schedule individual hits via scheduleOnce — avoids Tone.Part generic typing.
    // IDs are stored so clearMicroFill can cancel them if the fill fires early.
    const ids: number[] = []
    const sched = (dt: number, instr: DrumInstrument, vel: number) => {
      ids.push(transport.scheduleOnce(t => this.triggerDrum(instr, t, vel), time + dt))
    }

    switch (fillIndex % 3) {
      case 0: // hat stutter — 4 rapid 32nd hats, crescendo into beat 4
        sched(0,       DrumInstrument.Hat,   0.55)
        sched(s32,     DrumInstrument.Hat,   0.63)
        sched(s32 * 2, DrumInstrument.Hat,   0.71)
        sched(s32 * 3, DrumInstrument.Hat,   0.80)
        break
      case 1: // ghost snare — whisper on "and" of beat 2, accent on beat 3
        sched(-s16, DrumInstrument.Snare, 0.22)
        sched(0,    DrumInstrument.Snare, 0.75)
        break
      case 2: // kick echo — double kick on beat 4 + a 16th later (trap stutter)
        sched(beat,       DrumInstrument.Kick, 0.80)
        sched(beat + s16, DrumInstrument.Kick, 0.55)
        break
    }

    this._microFillEventIds = ids
  }

  private _microFillEventIds: number[] = []

  clearMicroFill(): void {
    const transport = Tone.getTransport()
    for (const id of this._microFillEventIds) {
      try { transport.clear(id) } catch { /* */ }
    }
    this._microFillEventIds = []
    if (this.microFillPart) {
      try { this.microFillPart.stop() } catch { /* */ }
      try { this.microFillPart.dispose() } catch { /* */ }
      this.microFillPart = null
    }
  }

  /** Register a callback fired on every kick hit — used for sidechain ducking. */
  setKickTriggerCallback(cb: ((time: number) => void) | null): void {
    this.onKickTrigger = cb
  }


  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    const linear = db === -Infinity ? 0 : Math.pow(10, db / 20)
    if (Math.abs(linear - this.lastOutputGain) < 0.008) return
    this.lastOutputGain = linear
    this.output.gain.cancelScheduledValues(Tone.now())
    this.output.gain.rampTo(linear, 0.35)
  }

  dispose(): void {
    this.unsubConductor?.()
    this.disposeLoopPlayback()
    this.stopPart()
    this.kickSub.dispose()
    this.kickClick.dispose()
    this.kickBus.dispose()
    this.kickDist.dispose()
    this.snareBody.dispose()
    this.snareTone.dispose()
    this.snareBus.dispose()
    this.hat.dispose()
    this.hatOpen.dispose()
    this.hatFilter.dispose()
    this.perc.dispose()
    this.percFilter.dispose()
    this.sampledKit.dispose()
    this.sampleBus.dispose()
    this.compressor.dispose()
    this.output.dispose()
  }
}
