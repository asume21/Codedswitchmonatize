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

  // Hat: filtered metal
  private hat:       Tone.MetalSynth
  private hatFilter: Tone.Filter

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

  // Reactive multipliers (Section 05)
  private hatDensityMult:      number = 1.0
  private kickVelocityMult:    number = 1.0

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
      pitchDecay:  0.05,
      octaves:     4,          // was 8 — 8 octaves causes massive low-end impulse overload
      oscillator:  { type: 'sine' },
      envelope:    { attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.5 },
    })
    this.kickSub.volume.value = -6   // was -3
    this.kickSub.connect(this.kickBus)

    this.kickClick = new Tone.NoiseSynth({
      noise:    { type: 'white' },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
    })
    this.kickClick.volume.value = -14  // was -10
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
      modulationIndex: 8,      // was 18 — the main source of harsh noise
      resonance:       4000,   // was 5500
      octaves:         0.5,    // was 1.0
    })
    this.hat.volume.value = -14  // was -8
    this.hat.connect(this.hatFilter)

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

    if (to === OState.Awakening) {
      this.stopPart()
      this.startSubKickRise()
      return
    }

    // Breathing or Flow → rebuild pattern from current mode
    // Skip if pattern is locked — user has frozen the groove
    if (this.patternLocked) return
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

  lockPattern(): DrumHit[] {
    this.patternLocked = true
    // Snapshot the current hits from the running Part
    this.lockedHits = this.part
      ? (this.part as any)._events?.map((e: any) => ({
          time:       e.time,
          instrument: e.value?.instrument ?? e.value,
          velocity:   e.value?.velocity   ?? 0.8,
        })) ?? []
      : []
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

  /** Load an AI-generated pattern externally (Gap 2 — generative patterns). */
  loadGeneratedPattern(hits: DrumHit[]): void {
    this.rebuildPart(hits)
  }

  private rebuildPart(hits: DrumHit[]): void {
    this.stopPart()

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
    this.part.start(0)

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

    // Pocket → duck hats during voice presence + reactive density multiplier
    if (instrument === DrumInstrument.Hat) {
      vel *= Math.max(0.3, 1 - this.currentPresence * 0.4) * this.hatDensityMult
    }

    return Math.min(1, Math.max(0, vel))
  }

  private triggerDrum(instrument: DrumInstrument, time: number, velocity: number): void {
    switch (instrument) {
      case DrumInstrument.Kick:
        this.kickSub.triggerAttackRelease('C1', '8n', time, velocity)
        this.kickClick.triggerAttackRelease('32n', time, velocity * 0.6)
        break
      case DrumInstrument.Snare:
        this.snareBody.triggerAttackRelease('8n', time, velocity)
        this.snareTone.triggerAttackRelease('E3', '16n', time, velocity * 0.7)
        break
      case DrumInstrument.Hat:
        this.hat.triggerAttackRelease('32n', time, velocity)
        break
      case DrumInstrument.Perc:
        this.perc.triggerAttackRelease('16n', time, velocity)
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

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    this.output.gain.rampTo(Math.pow(10, db / 20), 0.1)
  }
}
