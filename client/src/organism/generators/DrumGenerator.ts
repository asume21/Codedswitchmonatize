// Section 04 — Drum Generator

import * as Tone from 'tone'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName, DrumInstrument } from './types'
import type { DrumHit }       from './types'
import {
  getDrumKit,
  buildDrumPattern,
}                              from './patterns/DrumPatternLibrary'
import type { PhysicsState }   from '../physics/types'
import { OrganismMode }        from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'

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

  // Hat: closed (short decay) + open (long decay)
  private hat:        Tone.MetalSynth
  private hatOpen:    Tone.MetalSynth
  private hatFilter:  Tone.Filter

  // Perc: bandpass noise
  private perc:       Tone.NoiseSynth
  private percFilter: Tone.Filter

  // Master drum bus
  private compressor: Tone.Compressor

  private part: Tone.Part | null = null

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

  // Micro-timing humanization — adds ±jitter to each hit for human feel
  // Ghost notes (low velocity) get more jitter — real drummers don't lock ghosts to the grid
  private readonly humanizeJitterMs: number = 22  // ±22ms

  // Track last kick time for hat-on-kick ducking
  private lastKickTime: number = 0
  private lastOutputGain: number = 0

  constructor() {
    super(GeneratorName.Drum)

    this.output     = new Tone.Gain(1)
    // Lighter drum bus compression — master bus handles the glue
    this.compressor = new Tone.Compressor({ threshold: -24, ratio: 3, attack: 0.008, release: 0.2 })
    this.compressor.connect(this.output)

    // ── Kick: sub + click layered ──
    this.kickBus  = new Tone.Gain(0.85)
    // Remove kick distortion — saturator on master bus is sufficient
    this.kickDist = new Tone.Distortion({ distortion: 0.0, wet: 0.0 })
    this.kickBus.connect(this.kickDist)
    this.kickDist.connect(this.compressor)

    this.kickSub = new Tone.MembraneSynth({
      pitchDecay:  0.09,       // slower pitch glide for 808 sub sweep
      octaves:     4,          // was 8 — 8 octaves causes massive low-end impulse overload
      oscillator:  { type: 'sine' },
      envelope:    { attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.3 },  // tightened envelope to eliminate sub-bass bleed
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
      envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
    })
    this.snareBody.volume.value = -9   // was -6
    this.snareBody.connect(this.snareBus)

    this.snareTone = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves:    2,           // was 4
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.001, decay: 0.1, sustain: 0, release: 0.08 },
    })
    this.snareTone.volume.value = -15  // was -12
    this.snareTone.connect(this.snareBus)

    // ── Hat: tamed MetalSynth + bandpass to kill screech ──
    // Bandpass instead of highpass so we keep the snap but cut the FM screech
    this.hatFilter = new Tone.Filter({ frequency: 8000, type: 'bandpass', Q: 0.8 })
    this.hatFilter.connect(this.compressor)

    this.hat = new Tone.MetalSynth({
      envelope:        { attack: 0.001, decay: 0.05, release: 0.006 },
      harmonicity:     5.1,
      modulationIndex: 8,
      resonance:       4000,
      octaves:         0.5,
    })
    this.hat.volume.value = -14
    this.hat.connect(this.hatFilter)

    // Open hat — longer decay gives the "tsss" tail for hi-hat breathing
    this.hatOpen = new Tone.MetalSynth({
      envelope:        { attack: 0.001, decay: 0.22, release: 0.08 },
      harmonicity:     5.1,
      modulationIndex: 8,
      resonance:       4000,
      octaves:         0.5,
    })
    this.hatOpen.volume.value = -16
    this.hatOpen.connect(this.hatFilter)

    // ── Perc: bandpass noise for rim/shaker ──
    this.percFilter = new Tone.Filter({ frequency: 2000, type: 'bandpass', Q: 1.5 })
    this.percFilter.connect(this.compressor)

    this.perc = new Tone.NoiseSynth({
      noise:    { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0 },
    })
    this.perc.volume.value = -18   // was -14
    this.perc.connect(this.percFilter)

    this.setOutputLevel(0)
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    this.currentBounce   = physics.bounce
    this.currentPresence = physics.presence
    this.currentPocket   = physics.pocket

    const targetLevel = this.computeTargetLevel(organism)
    this.activityLevel += this.smoothingCoeff(80) * (targetLevel - this.activityLevel)
    this.setOutputLevel(this.activityLevel)
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
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
      // Commit the full beat immediately — don't make the listener wait.
      // The activity level ramps up naturally so it still fades in; no silent "figuring out" period.
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
      case OState.Breathing: return 0.65 * organism.breathingWarmth
      case OState.Flow:      return 0.92
    }
  }

  // Rebuild throttle — prevent rapid Part rebuilds from flooding the audio scheduler.
  // The MusicalDirector can trigger rebuilds on sub-genre changes, mutations, AND
  // state transitions. Without a throttle, these can pile up in the same frame.
  private lastRebuildTime: number = 0
  private static readonly MIN_REBUILD_INTERVAL_MS = 500

  /** Load an AI-generated pattern externally (Gap 2 — generative patterns). */
  loadGeneratedPattern(hits: DrumHit[]): void {
    const now = performance.now()
    if (now - this.lastRebuildTime < DrumGenerator.MIN_REBUILD_INTERVAL_MS) return
    this.lastRebuildTime = now
    this.rebuildPart(hits)
  }

  // ── Kit presets — timbre variations applied on pattern rebuild ────────

  private static readonly KIT_PRESETS = [
    // Classic — warm boom-bap feel
    { kickNote: 'C1',  kickPitchDecay: 0.05, kickVol: -6,  snareDecay: 0.15, snareVol: -9,  hatDecay: 0.05, hatVol: -14, hatResonance: 4000, percDecay: 0.07, percVol: -18 },
    // Punchy — tighter transients, brighter hat
    { kickNote: 'D1',  kickPitchDecay: 0.03, kickVol: -5,  snareDecay: 0.10, snareVol: -8,  hatDecay: 0.03, hatVol: -12, hatResonance: 5000, percDecay: 0.05, percVol: -16 },
    // Lo-fi / dusty — deep kick, long snare, muffled hat
    { kickNote: 'A#0', kickPitchDecay: 0.08, kickVol: -8,  snareDecay: 0.22, snareVol: -11, hatDecay: 0.08, hatVol: -17, hatResonance: 3000, percDecay: 0.10, percVol: -20 },
    // Hard — higher pitch kick, crispy hat, tight snare
    { kickNote: 'E1',  kickPitchDecay: 0.04, kickVol: -4,  snareDecay: 0.12, snareVol: -7,  hatDecay: 0.04, hatVol: -13, hatResonance: 4500, percDecay: 0.06, percVol: -17 },
    // Deep 808 — very sub-heavy kick, dry snare snap, minimal hat
    { kickNote: 'G0',  kickPitchDecay: 0.12, kickVol: -3,  snareDecay: 0.08, snareVol: -7,  hatDecay: 0.02, hatVol: -18, hatResonance: 6000, percDecay: 0.04, percVol: -22 },
    // Crispy Trap — short punchy kick, sharp snare, sparkly hat
    { kickNote: 'F1',  kickPitchDecay: 0.02, kickVol: -5,  snareDecay: 0.09, snareVol: -6,  hatDecay: 0.025, hatVol: -11, hatResonance: 5500, percDecay: 0.04, percVol: -15 },
    // Vinyl — wide pitch decay, long dusty snare, rolled-off hat
    { kickNote: 'B0',  kickPitchDecay: 0.10, kickVol: -7,  snareDecay: 0.28, snareVol: -12, hatDecay: 0.10, hatVol: -19, hatResonance: 2500, percDecay: 0.12, percVol: -21 },
  ] as const

  // Map physics modes to appropriate kit preset indices
  // Indices match KIT_PRESETS array: 0=Classic, 1=Punchy, 2=Lo-fi, 3=Hard, 4=Deep808, 5=CrispyTrap, 6=Vinyl
  private static readonly MODE_KIT_MAP: Record<string, number[]> = {
    [OrganismMode.Heat]:   [4, 5, 3],     // Deep 808, Crispy Trap, Hard
    [OrganismMode.Gravel]: [4, 3, 1],     // Deep 808, Hard, Punchy
    [OrganismMode.Smoke]:  [0, 6, 2],     // Classic, Vinyl, Lo-fi (boom-bap kits)
    [OrganismMode.Ice]:    [2, 6, 0],     // Lo-fi, Vinyl, Classic
    [OrganismMode.Glow]:   [2, 0, 6],     // Lo-fi, Classic, Vinyl
  }

  private currentPhysicsMode: OrganismMode = OrganismMode.Glow

  private applyKitPreset(): void {
    const kitIndices = DrumGenerator.MODE_KIT_MAP[this.currentPhysicsMode] ?? [0]
    const idx    = kitIndices[Math.floor(Math.random() * kitIndices.length)]
    const preset = DrumGenerator.KIT_PRESETS[idx]
    this.currentKickNote          = preset.kickNote
    this.kickSub.pitchDecay       = preset.kickPitchDecay
    this.kickSub.volume.rampTo(preset.kickVol, 0.3)
    this.snareBody.envelope.decay = preset.snareDecay
    this.snareBody.volume.rampTo(preset.snareVol, 0.3)
    this.hat.envelope.decay       = preset.hatDecay
    this.hat.volume.rampTo(preset.hatVol, 0.3)
    this.hat.resonance            = preset.hatResonance
    this.perc.envelope.decay      = preset.percDecay
    this.perc.volume.rampTo(preset.percVol, 0.3)
  }

  private rebuildPart(hits: DrumHit[]): void {
    this.stopPart()
    this.applyKitPreset()
    this.currentHits = [...hits]   // snapshot for lockPattern()

    const events = hits.map(h => ({
      time:       h.time,
      instrument: h.instrument,
      velocity:   h.velocity,
    }))

    this.part = new Tone.Part((time, event) => {
      const vel = this.applyDynamics(event.instrument, event.velocity)
      this.triggerDrum(event.instrument, time, vel)
    }, events)

    this.part.loop    = true
    this.part.loopEnd = '4m'
    // Start 150ms in the future so the audio thread has time to prepare.
    // Using start(0) fires ALL past events as an instant burst if Transport
    // is already running, causing massive crackling. Previous 50ms was too tight.
    this.part.start('+0.15')

    // Gap 3 — mirror current pattern into ProBeatMaker for visual display
    this.broadcastToBeatMaker(hits)
  }

  /**
   * Converts organism drum hits to the ProBeatMaker step format and dispatches
   * 'ai:loadBeatPattern' so the Beat Maker tab shows what the Organism is playing.
   */
  private broadcastToBeatMaker(hits: DrumHit[]): void {
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

  private triggerDrum(instrument: DrumInstrument, time: number, velocity: number): void {
    // Micro-timing humanization: ghost notes (low vel) get more timing drift than
    // downbeats (high vel) — mimics a real drummer who locks kicks/snares but floats ghosts
    const isGhost = velocity < 0.4
    const jitterRange = isGhost ? this.humanizeJitterMs : this.humanizeJitterMs * 0.3
    const jitterSec = ((Math.random() * 2 - 1) * jitterRange) / 1000
    const t = Math.max(0, time + jitterSec)

    switch (instrument) {
      case DrumInstrument.Kick:
        this.kickSub.triggerAttackRelease(this.currentKickNote, '8n', t, velocity)
        this.kickClick.triggerAttackRelease('32n', t, velocity * 0.6)
        this.lastKickTime = t
        // Fire sidechain callback so bass channel ducks on kick
        if (this.onKickTrigger) this.onKickTrigger(t)
        break
      case DrumInstrument.Snare:
        this.snareBody.triggerAttackRelease('8n', t, velocity)
        this.snareTone.triggerAttackRelease('E3', '16n', t, velocity * 0.7)
        break
      case DrumInstrument.Hat:
        if (velocity > 0.55) {
          // Accented = open hat (longer decay gives breath and swing feel)
          this.hatOpen.triggerAttackRelease('32n', t, velocity * 0.85)
        } else {
          // Ghost/quiet = tight closed hat
          this.hat.triggerAttackRelease('32n', t, velocity)
        }
        break
      case DrumInstrument.Perc:
        this.perc.triggerAttackRelease('16n', t, velocity)
        break
    }
  }

  private startSubKickRise(): void {
    // Very soft kick pulse during awakening
    this.kickSub.volume.rampTo(-24, 2)
  }

  private stopPart(): void {
    if (this.part) {
      this.part.stop()
      this.part.dispose()
      this.part = null
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
    this.compressor.dispose()
    this.output.dispose()
  }
}
