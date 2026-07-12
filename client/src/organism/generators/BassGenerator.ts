// Section 04 — Bass Generator

import * as Tone from 'tone'
import type { LoopClip } from '@shared/loopPack'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName, BassBehavior } from './types'
import type { ScheduledNote } from './types'
import {
  getBassBehavior,
  getBassFilterCutoff,
  getBassBehaviorFromSubGenre,
  setBassChordQuality,
  buildBassNotes,
  shouldEnableSlide,
  getPortamentoTime,
  getBassSwing,
}                              from './patterns/BassPatternLibrary'
import { buildFreeplayBassNotes } from './freeplay/BassImproviser'
import { hashString, mulberry32, getSessionSalt } from './freeplay/utils'
import type { HipHopSubGenre } from '../state/MusicalState'
import { getLivePartStart, livePartStartOffset, msUntilTransportTime, quantizeGridTime } from './CompositionClock'
// ChordProgressionBank is no longer a direct dependency — Bass reads its
// root via the Conductor's chord-change events (Phase 4).
import type { PhysicsState }   from '../physics/types'
import { OrganismMode }        from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'
import { createMultisampleSampler, type LoadableSampler } from '../instruments/SamplerUtils'
import { createNeumannBassSampler } from '../instruments/NeumannBassSampler'
import { Real808BassSampler, findBass808Sample } from '../instruments/Real808BassSampler'
import { getRealInstrumentNotes } from '../instruments/realInstruments'
import {
  applyArticulation,
  DEFAULT_ARTICULATION_ID,
  defaultBassArticulation,
} from '../techniques/articulations'
import type { ArticulationContext } from '../techniques/types'
import {
  conformNoteToInstrument,
  selectInstrumentPerformer,
  type InstrumentPerformerId,
  type InstrumentPerformerProfile,
} from '../performers'
import { getConductor } from '../conductor/Conductor'
import { applyGroovePocket } from './groove'

export class BassGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth:      Tone.MonoSynth | LoadableSampler
  private filter:     Tone.Filter
  private monoSub:    Tone.Filter      
  private compressor: Tone.Compressor
  private distortion: Tone.Distortion
  private part:       Tone.Part | null = null
  private hasStartedPlayback: boolean = false

  // Expression & Modulation
  private lfo:        Tone.LFO
  private lfoGain:    Tone.Gain

  // Musical state — rootMidi is now sourced from the Conductor (Phase 2 wiring).
  // The Conductor owns harmonic state; bass reads its root from it instead of
  // picking randomly. setCurrentChord() remains as an external override path
  // until Phase 4 folds ChordProgressionBank routing into Conductor.
  private rootMidi:        number       = 36
  private currentBehavior: BassBehavior = BassBehavior.Breathe

  // ── Freeplay (spec 2026-07-02) — improvise from the live chord instead of
  // reading BassPatternLibrary. Default ON; the styles dropdown is the opt-out.
  private freeplayEnabled = true
  private chordIntervals: number[] = [0, 3, 7]
  private kickAnchors: number[] = []
  private groovePocket: number[] = Array(16).fill(0)
  setGroovePocket(pocket: number[]): void { this.groovePocket = [...pocket] }

  private unsubscribeConductor: (() => void) | null = null
  // Set by the Conductor's onChordChange listener; consumed on the next
  // processFrame so rebuildPart never runs inside a Tone.js audio-thread
  // callback (Phase 4 prep — matches Melody's scaleDirty pattern).
  private conductorChordDirty: boolean = false

  private chordRootPitchClass: number | null = null
  private tonicPitchClass: number = 0

  // Physics cache
  private currentPocket: number = 0
  private currentMode: OrganismMode = OrganismMode.Glow
  private currentOrganismState: OState = OState.Breathing
  private currentSubGenre: HipHopSubGenre | null = null
  private lastFilterCutoff: number = 350
  private lastOutputGain: number = 0

  private pendingSynthDispose: ReturnType<typeof setTimeout> | null = null
  private pendingOldSynth: Tone.MonoSynth | LoadableSampler | null = null
  // Fallback synth used while a CDN sampler is loading
  private fallbackSynth: Tone.MonoSynth

  // Sub-reinforcement layer — a clean sine an octave-low under the bass so ANY
  // style can have low-end weight (not just trap's 808). Level set per style via
  // setSubLevel(); 808 styles use 0 (the 808 already IS the sub).
  private subSynth!: Tone.MonoSynth
  private subGain!: Tone.Gain
  private currentSubLevel: number = 0

  private isCurrentVoiceSampler: boolean = false
  private currentPerformer: InstrumentPerformerProfile | null = null
  private explicitPerformerId: InstrumentPerformerId | null = null

  // Real recorded 808 bass sample — loaded from the premium private kit when
  // available. Falls back to the synthesised 808 MonoSynth until loading finishes.
  private real808Sampler: Real808BassSampler | null = null
  // True only while the current voice is an 808 mode. The 808 sampler loads
  // async; this flag (plus voiceGeneration) guards against a late load landing
  // on a voice that has since switched away from 808 (would play an 808 sample
  // over an acoustic/electric style).
  private use808Active: boolean = false
  // Bumped on every voice switch (applyBassPreset). A pending 808 load captures
  // this token and bails if the voice changed while its kit fetch was in flight.
  private voiceGeneration: number = 0
  private currentVoiceKey: string | null = null
  private glideRate: number = 0.15 // default 150ms

  // Loop playback (_loopPlayer / _loopMode / loadLoop / setLoopMode / swapLoop)
  // is centralized in GeneratorBase.

  // Articulation — per-note transform. Defaults to 'none' (legacy behavior).
  private currentArticulationId: string = DEFAULT_ARTICULATION_ID
  private articulationOverridden: boolean = false
  private lastModeForArticulation: string = ''

  setArticulation(articulationId: string, markAsOverride: boolean = true): void {
    // Automatic callers (reactive style shifts, section style presets) must
    // not stomp an explicit user pick — the UI dropdown "snapping back".
    if (!markAsOverride && this.articulationOverridden) return
    this.currentArticulationId = articulationId
    if (markAsOverride) this.articulationOverridden = true
  }

  resetArticulationOverride(): void {
    this.articulationOverridden = false
  }

  getArticulation(): string {
    return this.currentArticulationId
  }

  setGlideRate(rate: number): void {
    this.glideRate = Math.max(0.01, Math.min(1.0, rate))
  }

  getGlideRate(): number {
    return this.glideRate
  }

  setInstrumentPerformer(instrumentId: InstrumentPerformerId | null): void {
    this.explicitPerformerId = instrumentId
    this.applyBassPreset()
    if (this.lastOutputGain > 0) this.rebuildPart()
  }

  setSubGenre(subGenre: HipHopSubGenre): void {
    this.currentSubGenre = subGenre
    const nextBehavior = this.resolveBassBehavior(this.currentOrganismState)
    if (nextBehavior !== this.currentBehavior) {
      this.currentBehavior = nextBehavior
      if (this.part || this.lastOutputGain > 0) {
        this.lastRebuildTime = -Infinity
        this.rebuildPart()
      }
    }
  }

  // ─── Dynamic Global Voices ──────────────────────────────────
  private static readonly GLOBAL_VOICES = [
    // 808s (Heat / Ice)
    { name: 'Classic 808', type: 'Mono', oscType: 'sine', Q: 1, octaves: 0.5, attack: 0.001, decay: 1.0, sustain: 0.5, release: 1.5, distWet: 0.02, volume: -5, tags: ['electronic', '808'] },
    { name: 'Hard 808', type: 'Mono', oscType: 'sine', Q: 1.5, octaves: 0.8, attack: 0.001, decay: 0.9, sustain: 0.5, release: 1.2, distWet: 0.15, volume: -6, tags: ['electronic', '808', 'aggressive'] },
    
    // Acoustic/Electric (Gravel / Smoke)
    { name: 'Upright Bass', type: 'Sampler', presetId: 'acoustic_bass', attack: 0.05, release: 0.8, volume: 2, distWet: 0, tags: ['acoustic', 'warm'] },
    { name: 'Electric Bass', type: 'Sampler', presetId: 'electric_bass_finger', attack: 0.02, release: 0.5, volume: 1, distWet: 0, tags: ['electric', 'warm'] },
    { name: 'Fretless Bass', type: 'Sampler', presetId: 'fretless_bass', attack: 0.05, release: 0.6, volume: 0, distWet: 0, tags: ['electric', 'warm', 'smooth'] },

    // General Synths
    { name: 'Fat Saw Sub', type: 'Mono', oscType: 'fatsawtooth', Q: 3, octaves: 2.0, attack: 0.005, decay: 0.25, sustain: 0.8, release: 0.3, distWet: 0.20, volume: -7, tags: ['electronic'] },
    { name: 'Smooth Sub', type: 'Mono', oscType: 'fatsawtooth', Q: 1.5, octaves: 1.2, attack: 0.015, decay: 0.35, sustain: 0.7, release: 0.4, distWet: 0.05, volume: -6, tags: ['electronic', 'smooth'] },
  ]

  constructor() {
    super(GeneratorName.Bass)

    this.output     = new Tone.Gain(1)
    this.filter     = new Tone.Filter(350, 'lowpass')
    this.monoSub    = new Tone.Filter({ type: 'lowpass', frequency: 120, rolloff: -24 })
    // Bass still needs compression for sustain consistency, but 6:1 was choking
    // 808 sub fundamentals. -14/3:1 keeps low-end tight without flattening the
    // pluck/attack envelope — the ChannelStrip comp picks up the rest.
    this.compressor = new Tone.Compressor({ threshold: -14, ratio: 3, attack: 0.005, release: 0.12 })
    this.distortion = new Tone.Distortion({ distortion: 0.08, wet: 0.2 })

    // LFO for filter "wobble" / emotional oscillation
    this.lfoGain = new Tone.Gain(0)
    this.lfo = new Tone.LFO({
      type: 'sine',
      min: -1,
      max: 1,
      frequency: 0
    }).start()
    
    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.filter.frequency)

    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'fatsawtooth', spread: 15, count: 2 },
      filter:     { Q: 3, type: 'lowpass', rolloff: -24 },
      envelope:   { attack: 0.005, decay: 0.25, sustain: 0.8, release: 0.3 },
      filterEnvelope: {
        attack:        0.04,
        decay:         0.15,
        sustain:       0.35,
        release:       0.15,
        baseFrequency: 80,
        octaves:       2.0,
      },
    })
    this.synth.volume.value = -7

    this.synth.connect(this.filter)
    this.filter.connect(this.monoSub)
    this.monoSub.connect(this.distortion)
    this.distortion.connect(this.compressor)
    this.compressor.connect(this.output)

    // Fallback synth — always available for instant playback while samplers load
    this.fallbackSynth = new Tone.MonoSynth({
      oscillator: { type: 'fatsawtooth', spread: 15, count: 2 },
      filter:     { Q: 3, type: 'lowpass', rolloff: -24 },
      envelope:   { attack: 0.005, decay: 0.25, sustain: 0.8, release: 0.3 },
      filterEnvelope: {
        attack: 0.04, decay: 0.15, sustain: 0.35, release: 0.15,
        baseFrequency: 80, octaves: 2.0,
      },
    })
    this.fallbackSynth.volume.value = -7
    this.fallbackSynth.connect(this.filter)

    // Sub layer — pure sine, routed CLEAN to output (no bass filter/distortion)
    // so it stays a tight fundamental. Gain starts at 0; setSubLevel() opens it
    // per style. This is what lets us "add sub to anything".
    this.subSynth = new Tone.MonoSynth({
      oscillator:     { type: 'sine' },
      envelope:       { attack: 0.008, decay: 0.22, sustain: 0.9, release: 0.25 },
      filter:         { type: 'lowpass', frequency: 160, rolloff: -24 },
      filterEnvelope: { attack: 0.005, decay: 0.1, sustain: 1, release: 0.2, baseFrequency: 70, octaves: 1 },
    })
    this.subSynth.volume.value = -2
    this.subGain = new Tone.Gain(0)
    this.subSynth.connect(this.subGain)
    this.subGain.connect(this.output)

    this.setOutputLevel(0)

    // Phase 2 — lock to the Conductor. Initial root comes from the Conductor's
    // current chord, and we subscribe so any future advanceChord/setProgression
    // call moves the bass with the harmony. Until the Orchestrator advances the
    // Conductor on its bar tick, this just seeds a sensible starting root.
    const conductor = getConductor()
    this.rootMidi = this.currentBassRoot()
    this.unsubscribeConductor = conductor.onChordChange((chord) => {
      // Push the chord QUALITY before the same-root early-return — patterns
      // must play the chord's actual third/seventh (a minor-pent bass over
      // the progression's major chords is the "off notes" clash).
      this.chordIntervals = chord.intervals
      setBassChordQuality(chord.intervals)
      const newRoot = this.currentBassRoot()
      if (newRoot === this.rootMidi) return
      this.rootMidi = newRoot
      this.chordRootPitchClass = chord.rootMidi % 12
      // Defer rebuild to the next processFrame. Calling rebuildPart() here
      // would run new Tone.Part(...).start() inside the audio-thread callback
      // that fired this listener (Phase 4 attempt ea4e43e showed audible drift).
      this.conductorChordDirty = true
    })
  }

  // Map a chord's root MIDI (Conductor parses at octave 4 → MIDI 60+) into the
  // bass register MIDI 33-48. Drops by octaves rather than clamping so the
  // pitch class is preserved.
  private bassRootFromMidi(midi: number): number {
    let root = midi
    while (root > 48) root -= 12
    while (root < 33) root += 12
    return Math.max(33, Math.min(48, root))
  }

  // Conductor Part 3 V3 — the bass plays the SAME root the voicing engine
  // assigned (root in the bass register), so the low end agrees with the comp
  // instead of each player dropping the chord symbol into its own octave. The
  // voicing is computed on advanceChord BEFORE chord-change listeners fire, so
  // it's always fresh here; bassRootFromMidi is kept only as a defensive clamp.
  private currentBassRoot(): number {
    return this.bassRootFromMidi(getConductor().currentVoicing().bass)
  }

  // The root this phrase RESOLVES INTO. The orchestrator advances the chord on
  // the last bar of every 4-bar phrase, so this is where the harmony is headed —
  // it tells the improviser whether there is a chord change worth walking into.
  private nextBassRoot(): number {
    return this.bassRootFromMidi(getConductor().nextVoicing().bass)
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    if (this._loopMode) return
    this.currentPocket = physics.pocket
    this.currentMode   = physics.mode
    this.currentOrganismState = organism.current

    // Apply mode-default articulation unless explicitly overridden.
    const modeStr = physics.mode.toString()
    if (!this.articulationOverridden && modeStr !== this.lastModeForArticulation) {
      this.currentArticulationId = this.currentPerformer?.defaultBassArticulation ?? defaultBassArticulation(modeStr)
      this.lastModeForArticulation = modeStr
    }

    const newBehavior = this.resolveBassBehavior(organism.current)

    if (newBehavior !== this.currentBehavior) {
      this.currentBehavior = newBehavior
      const rebuilt = this.rebuildPart(physics)
      // The behavior-change rebuild already used the latest rootMidi, so the
      // pending conductor flag is satisfied — clearing avoids a redundant
      // rebuild on the same frame.
      if (rebuilt) this.conductorChordDirty = false
    } else if (this.conductorChordDirty && this.lastOutputGain > 0) {
      const rebuilt = this.rebuildPart(physics)
      if (rebuilt) this.conductorChordDirty = false
    }

    // Only duck filter if we are using a MonoSynth (samplers bypass the filter entirely)
    if (!this.isCurrentVoiceSampler) {
      const cutoff = getBassFilterCutoff(physics.mode, physics.pocket)
      if (Math.abs(cutoff - this.lastFilterCutoff) > 15) {
        this.filter.frequency.cancelScheduledValues(Tone.now())
        this.filter.frequency.rampTo(cutoff, 0.4)
        this.lastFilterCutoff = cutoff
      }
    }

    // Composer's role caps activity; reactive curve adds feel under the ceiling.
    const targetLevel = this.computeTargetLevel(organism) * this.roleCeiling()
    this.activityLevel += this.smoothingCoeff(100) * (targetLevel - this.activityLevel)
    this.setOutputLevel(this.activityLevel)

    // Filter LFO — subtle "breathing" warmth as flow deepens. The original
    // 6Hz × 200Hz depth was textbook dubstep wobble (the bass sounded like
    // it was drowning at high flow). Capped to 1.5Hz × 35Hz — slow enough
    // to feel like a breath, narrow enough to keep pitch perception intact.
    const flowIntensity = organism.flowDepth
    const lfoRate  = flowIntensity * 1.5   // 0 → 1.5 Hz (breath, not wobble)
    const lfoDepth = flowIntensity * 35    // 0 → 35 Hz (warmth, not sweep)

    this.lfo.frequency.rampTo(lfoRate, 0.5)
    this.lfoGain.gain.rampTo(lfoDepth, 0.5)
  }

  private enabled: boolean = true

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.reset()
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
    if (!this.enabled) return
    if (to === OState.Dormant) {
      this.stopPart()
      this.activityLevel = 0
      return
    }

    if (to === OState.Awakening) {
      this.stopPart()
      // Phase 4: Conductor is the only chord source. The legacy setCurrentChord
      // override path was removed when the Orchestrator's chord-bridge was
      // replaced with a Conductor subscription.
      this.rootMidi = this.currentBassRoot()
      this.currentMode     = physics.mode
      this.currentOrganismState = to
      // Swing comes from the orchestrator's sub-genre sync (setBassSwingFromSubGenre)
      // so bass locks to the DRUM grid. The old per-transition setBassSwing(mode)
      // call stomped it with the mode table — bass then swung by a different
      // amount than drums (e.g. trap drums 0.20 vs glow mode 0.38).
      this.currentBehavior = this.resolveBassBehavior(to)
      this.applyBassPreset()
      this.rebuildPart(physics)
      return
    }

    this.rootMidi = this.currentBassRoot()
    this.currentMode = physics.mode
    this.currentOrganismState = to
    this.currentBehavior = this.resolveBassBehavior(to)
    this.applyBassPreset()
    this.rebuildPart(physics)
  }

  reset(): void {
    this.stopPart()
    this.activityLevel   = 0
    this.currentBehavior = BassBehavior.Breathe
    this.currentOrganismState = OState.Breathing
    this.currentSubGenre = null
    this.currentPocket   = 0
    this.hasStartedPlayback = false
    this.lastRebuildTime = -Infinity
    this.setOutputLevel(0)
  }

  /** Rebuild the performer voice (e.g. after real samples finish loading). */
  refreshVoice(): void {
    this.applyBassPreset()
  }

  private applyBassPreset(): void {
    const performer = selectInstrumentPerformer({
      role: 'bass',
      mode: this.currentMode.toString(),
      energy: this.activityLevel,
      explicitId: this.explicitPerformerId ?? undefined,
    })
    this.currentPerformer = performer
    if (!this.articulationOverridden) {
      this.currentArticulationId = performer.defaultBassArticulation
      this.lastModeForArticulation = this.currentMode.toString()
    }

    if (this.pendingSynthDispose) {
      clearTimeout(this.pendingSynthDispose)
      this.pendingSynthDispose = null
      if (this.pendingOldSynth) {
        try { this.pendingOldSynth.disconnect() } catch { /* */ }
        try { this.pendingOldSynth.dispose() } catch { /* */ }
        this.pendingOldSynth = null
      }
    }

    const oldSynth = this.synth
    try {
      oldSynth.volume.cancelScheduledValues(Tone.now())
      if (oldSynth instanceof Tone.MonoSynth) {
         oldSynth.triggerRelease()
      } else {
         oldSynth.releaseAll()
      }
      oldSynth.disconnect()
    } catch { /* */ }

    this.pendingOldSynth = oldSynth
    this.pendingSynthDispose = setTimeout(() => {
      try { oldSynth.dispose() } catch { /* */ }
      this.pendingOldSynth = null
      this.pendingSynthDispose = null
    }, 100)

    // Use the 808 sub for trap/drill — by SUB-GENRE, not just mode. Violin/
    // orchestral trap runs in "Glow" mode but is still trap and MUST have an 808
    // (otherwise it falls back to the acoustic Neumann bass = the mid-range
    // "grunt" with no sub). A tuned sine-sub IS how a real 808 is made.
    const modeStr = this.currentMode.toString()
    const sg = (this.currentSubGenre ?? '').toLowerCase()
    const use808 = !this.explicitPerformerId &&
      (modeStr === 'heat' || modeStr === 'gravel' || sg === 'trap' || sg === 'drill' || sg === 'bounce')
    const realNotes = use808 ? null : getRealInstrumentNotes(performer)
    const nextVoiceKey = use808
      ? '808:synth'
      : realNotes
        ? `real:${performer.realInstrument}`
        : `neumann:${performer.id}`

    // Add sub to ANY style: 808 styles already ARE the sub (level 0 to avoid
    // doubling/mud); every other style gets a sine sub under its bass voice.
    this.setSubLevel(use808 ? 0 : 0.5)

    // Same voice already active: keep the current sampler/synth alive and only
    // retune the lightweight state around it. This avoids dropping back to the
    // fallback synth just because the organism re-entered the same mode/state.
    if (nextVoiceKey === this.currentVoiceKey) {
      this.use808Active = use808
      this.isCurrentVoiceSampler = !use808
      this.distortion.wet.rampTo(performer.id === 'bass-synth' ? 0.12 : 0, 0.1)
      try { this.synth.volume.rampTo(performer.volume ?? 0, 0.1) } catch { /* */ }
      return
    }

    // Each actual voice switch invalidates any in-flight async 808 load.
    this.voiceGeneration++

    if (use808) {
      // Modern 808: prefer a real recorded 808 bass sample when the premium kit
      // provides one. The synth 808 stays as the live fallback while the sample
      // streams in, so the beat never goes silent during cold-start.
      const isSlide = this.currentBehavior === BassBehavior.Slide808 || this.currentBehavior === BassBehavior.Trap
      
      // Saturated synth-808 path: warm triangle wave run through custom distortion
      // for mid-range harmonic presence on small speakers, filtered to stay smooth.
      const s808Dist = new Tone.Distortion({ distortion: 0.38, wet: 0.45 })
      const s808 = new Tone.MonoSynth({
        oscillator: { type: 'triangle' },
        filter:     { Q: 1.0, type: 'lowpass', rolloff: -12 },
        envelope:   {
          attack:  0.002,
          decay:   1.0,
          sustain: 0.05,
          // 1.8s release rang "flubby" once the 808 dropped into the true sub
          // octave (36-65Hz fundamentals decay slower perceptually) and its
          // tail smeared into the next kick. Tightened after the sub-octave fix.
          release: 1.1,
        },
        filterEnvelope: {
          attack: 0.002,
          decay:  0.35,
          sustain: 0.0,
          release: 0.45,
          baseFrequency: 60,
          octaves: 3.0,
        },
        portamento: isSlide ? 0.10 : 0.04,
      })
      s808.volume.value = -5.5
      s808.connect(s808Dist)
      s808Dist.connect(this.compressor)
      
      const originalDispose = s808.dispose.bind(s808)
      s808.dispose = () => {
        s808Dist.dispose()
        return originalDispose()
      }

      this.synth = s808
      this.isCurrentVoiceSampler = false
      this.use808Active = true
      this.currentVoiceKey = nextVoiceKey

      // Kick off the real 808 sampler load. If the kit has no bass808 sample or
      // the fetch fails, the synth 808 above remains the active voice.
      this.loadReal808Sampler(this.voiceGeneration)
      return
    }

    // Leaving an 808 mode: dispose any real sampler so the next bass voice isn't
    // polluted by a lingering 808 tail.
    this.use808Active = false
    this.disposeReal808Sampler()

    this.isCurrentVoiceSampler = true
    if (realNotes) {
      const multisampleSynth = createMultisampleSampler(realNotes, performer.envelope, performer.volume ?? 0)
      multisampleSynth.connect(this.compressor)
      this.synth = multisampleSynth
    } else {
      // Use Neumann bass samples for bass performers without a mapped real
      // multisample catalog entry — still a better fallback than thin GM bass.
      const neumannSynth = createNeumannBassSampler()
      neumannSynth.volume.value = performer.volume ?? 0
      neumannSynth.connect(this.compressor)
      this.synth = neumannSynth as unknown as LoadableSampler
    }
    this.currentVoiceKey = nextVoiceKey
    this.distortion.wet.rampTo(performer.id === 'bass-synth' ? 0.12 : 0, 0.1)

    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.debug(`Bass performer: ${performer.name} (${this.currentMode})${realNotes ? ' — real multisample' : ' — Neumann sampler'}`)
    }
  }

  private volumeMultiplier: number = 1.0

  // setCurrentChord(chord, rootPC) was removed in Phase 4 — Conductor is the
  // sole chord source. The orchestrator no longer bridges chord events from
  // ChordGenerator; Bass reads its root via the conductor.onChordChange
  // subscription in the constructor.

  applyVolumeMultiplier(multiplier: number): void {
    this.volumeMultiplier = Math.max(0, multiplier)
    this.setOutputLevel(this.activityLevel)
  }

  /**
   * Load the real recorded 808 bass sample from the premium kit.
   * @param generation the voiceGeneration captured at call time; if the voice
   *   switches (use808 → !use808, or another 808 reload) while the kit fetch is
   *   in flight, this load is stale and must not assign/keep the sampler.
   */
  private async loadReal808Sampler(generation: number): Promise<void> {
    if (this.real808Sampler) return
    const sample = await findBass808Sample()
    // Bail if the voice changed while the kit fetch was in flight.
    if (!sample || generation !== this.voiceGeneration || !this.use808Active) return
    // Route through the bass compressor (like the synth 808 on line ~446), NOT
    // straight to output — otherwise the real 808's hot recorded transients hit
    // the mix bus undynamically and stack with the kick into master clipping.
    const sampler = new Real808BassSampler(this.compressor)
    await sampler.load(sample)
    // Re-check after the (async) sample decode: the voice may have switched
    // during load. If so, drop this sampler instead of leaving it active.
    if (generation !== this.voiceGeneration || !this.use808Active) {
      sampler.dispose()
      return
    }
    this.real808Sampler = sampler
  }

  private disposeReal808Sampler(): void {
    if (this.real808Sampler) {
      this.real808Sampler.dispose()
      this.real808Sampler = null
    }
  }

  /**
   * Set the sub-reinforcement layer level (0–1). Lets ANY style add low-end
   * weight independent of its bass voice. Trap/drill (808) styles use 0 — the
   * 808 already provides the sub. Exposed so a profile/preset/user can dial it.
   */
  setSubLevel(level: number): void {
    this.currentSubLevel = Math.max(0, Math.min(1, level))
    if (this.subGain) this.subGain.gain.rampTo(this.currentSubLevel, 0.1)
  }

  getSubLevel(): number {
    return this.currentSubLevel
  }

  /** Drop a note to its octave-1 pitch class for true sub-bass reinforcement. */
  private toSubNote(note: string | number): string | null {
    const name = typeof note === 'number' ? Tone.Frequency(note).toNote() : note
    const pc = String(name).replace(/-?\d+$/, '')
    if (!/^[A-G][#b]?$/.test(pc)) return null
    return `${pc}1`
  }

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:   return 0
      case OState.Awakening: return 0.12 * organism.awakeningProgress
      case OState.Breathing: return 0.60 * organism.breathingWarmth
      case OState.Flow:      return 0.80 + (0.18 * organism.flowDepth)
    }
  }

  private lastRebuildTime: number = -Infinity
  private static readonly MIN_REBUILD_INTERVAL_MS = 500

  private resolveBassBehavior(organismState: OState): BassBehavior {
    if (this.currentSubGenre) {
      return getBassBehaviorFromSubGenre(this.currentSubGenre, organismState.toString())
    }
    return getBassBehavior(this.currentMode, organismState)
  }

  private rebuildPart(physics?: PhysicsState): boolean {
    if (this._loopMode) return false
    const now = performance.now()
    if (now - this.lastRebuildTime < BassGenerator.MIN_REBUILD_INTERVAL_MS) return false
    this.lastRebuildTime = now

    const notes = this.generateNotes(physics ?? ({ density: 0.5 } as any))
    if (notes.length === 0) {
      this.stopPart()
      return true
    }

    const events = notes.map(n => ({
      time: quantizeGridTime(n.time),
      note: n.pitch,
      dur:  n.duration,
      vel:  n.velocity,
    }))
    this.emitNoteEvents(events)

    const startAt = getLivePartStart(this.hasStartedPlayback)

    // Seamless handoff: keep the old Part playing until the new one starts.
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
    }
    this.part = null

    // Bass used to sit 20ms behind the grid for hip-hop pocket feel, but
    // when stacked against sampler/synth load-latency micro-jitter the
    // cumulative offset read as "loose, not pocketed." Locked to zero so
    // every generator fires on the same Transport tick. Per-genre lay-back
    // can come back later as a deliberate per-subgenre setting.
    const LAY_BACK_SEC = 0

    let lastNoteEndTime = 0
    let lastNoteFreq = 0

    this.part = new Tone.Part((time, event) => {
      const pocketVelocity = event.vel * Math.max(0.35, 1 - this.currentPocket * 0.45)
      const voice = this.getActiveVoice()
      const timeStr = String(event.time ?? '0:0:0')
      const parts = timeStr.split(':')
      const beat = parseFloat(parts[1] ?? '0')
      const sub  = parseFloat(parts[2] ?? '0')
      const sixteenthPos = Math.floor(beat * 4 + sub) % 16
      const scheduledTime = time + LAY_BACK_SEC + applyGroovePocket(0, sixteenthPos, this.groovePocket)
      let playableNote = this.currentPerformer
        ? conformNoteToInstrument(event.note, this.currentPerformer)
        : event.note

      // 808 register correction: the shared bass register (MIDI 33-48,
      // 55-130Hz) sits an octave above where real 808s live, so 808 styles
      // produced almost no energy in the 20-80Hz sub band (measured 1.8% vs
      // ~32% in reference beats) — and the sine sub layer is off for 808s by
      // design. Drop 808 notes one octave, floored at D1 (36.7Hz), so the
      // fundamental lands in the true sub range.
      if (this.use808Active) {
        const midi = Tone.Frequency(playableNote).toMidi()
        if (midi >= 38) playableNote = Tone.Frequency(midi - 12, 'midi').toNote()
      }

      const noteFreq = Tone.Frequency(playableNote).toFrequency()

      // Sub layer — reinforce the fundamental in octave 1 so the style has weight.
      // Once per note (independent of articulation); skipped when level is 0.
      if (this.currentSubLevel > 0) {
        const subNote = this.toSubNote(playableNote)
        if (subNote) {
          try { this.subSynth.triggerAttackRelease(subNote, event.dur, Math.max(0, scheduledTime), pocketVelocity) }
          catch { /* monophonic retrigger race — safe to drop */ }
        }
      }

      // Fast-path: default articulation skips the transform.
      if (this.currentArticulationId === DEFAULT_ARTICULATION_ID) {
        const isOverlap = lastNoteEndTime > 0 && scheduledTime < lastNoteEndTime
        if (isOverlap && voice instanceof Tone.MonoSynth) {
          // Slide the frequency using Tone's audio-rate scheduling (smooth glide, no envelope retrigger)
          voice.frequency.cancelScheduledValues(scheduledTime)
          voice.frequency.setValueAtTime(lastNoteFreq, scheduledTime)
          voice.frequency.rampTo(noteFreq, this.glideRate, scheduledTime)
        } else {
          // Normal attack
          voice.triggerAttackRelease(playableNote, event.dur, Math.max(0, scheduledTime), pocketVelocity)
        }

        const durSec = Tone.Time(event.dur).toSeconds()
        lastNoteEndTime = scheduledTime + durSec
        lastNoteFreq = noteFreq
        return
      }

      const isDownbeat = sixteenthPos % 4 === 0

      const artCtx: ArticulationContext = {
        tempo: Tone.getTransport().bpm.value || 90,
        energy: Math.max(0, Math.min(1, pocketVelocity)),
        isDownbeat,
        sixteenthPos,
      }

      const scheduled = applyArticulation(
        this.currentArticulationId,
        playableNote,
        event.dur,
        pocketVelocity,
        artCtx
      )
      for (const n of scheduled) {
        // Clamp to ≥0 — a float-negative time throws Tone's "[0, Infinity]".
        const t = Math.max(0, scheduledTime + n.timeOffset)
        // Articulations can emit notes with equal/decreasing times; on the
        // monophonic synth Tone throws "Start time must be strictly greater
        // than previous start time". Dropping the collision is correct — a
        // mono voice can't sound both — same precedent as the subSynth above.
        try { voice.triggerAttackRelease(n.note, n.duration, t, n.velocity) }
        catch { /* monophonic retrigger collision — safe to drop */ }
      }
    }, events)

    this.part.loop      = true
    this.part.loopEnd   = '4m'
    // Phase-aligned: continue the 4-bar pattern from the current musical bar
    // instead of restarting at bar 0 on every chord-change rebuild.
    this.part.start(startAt, livePartStartOffset(startAt, 4))
    this.hasStartedPlayback = true
    return true
  }

  private generateNotes(physics: PhysicsState): ScheduledNote[] {
    const slideActive = shouldEnableSlide(this.currentBehavior)
    const portTime = getPortamentoTime(this.currentBehavior)
    if (this.use808Active && this.real808Sampler?.isLoaded()) {
      this.real808Sampler.setPortamento(slideActive ? portTime : 0)
    } else if (!this.isCurrentVoiceSampler) {
      try {
        (this.synth as Tone.MonoSynth).portamento = slideActive ? portTime : 0
      } catch { /* */ }
    }

    if (this.freeplayEnabled) {
      const seed = hashString(`bass:${this.currentSectionName}:${this.currentSubGenre ?? 'none'}`)
      return buildFreeplayBassNotes({
        rootMidi: this.rootMidi,
        nextRootMidi: this.nextBassRoot(),
        chordIntervals: this.chordIntervals,
        bars: 4,
        swing: getBassSwing(),
        subGenre: (this.currentSubGenre ?? 'boom-bap') as string,
        energy: physics.density,
        density: physics.density,
        sectionName: this.currentSectionName,
        motifSeed: seed,
        kickTimes16ths: this.kickAnchors,
        // LOCKED LOOP (2026-07-11): the seed is a pure function of the SECTION —
        // no per-rebuild counter. Rebuilds fire constantly (every chord change,
        // every state transition), and an incrementing counter meant each one
        // re-rolled the bassline into different notes. That was the drift: a beat
        // that sounds right, then quietly rewrites itself out from under you.
        // Same section => byte-identical line, every cycle. The SECTION is the
        // unit of change, not the bar.
        rng: mulberry32(seed + getSessionSalt()),
      })
    }

    return buildBassNotes(this.currentBehavior, this.rootMidi, physics.density)
  }

  /** Freeplay on/off. Rebuild immediately so the switch is audible. */
  setFreeplay(enabled: boolean): void {
    if (this.freeplayEnabled === enabled) return
    this.freeplayEnabled = enabled
    if (this.lastOutputGain > 0) this.rebuildPart()
  }

  /** Kick onset slots (absolute 16ths, 0..63) from the current drum pattern. */
  setKickAnchors(slots: number[]): void {
    this.kickAnchors = slots
  }

  private startSubBassRise(): void {
    this.stopPart()
    const subMidi = Math.max(28, this.rootMidi - 12)
    const subRoot = Tone.Frequency(subMidi, 'midi').toNote()

    if (this.use808Active && this.real808Sampler?.isLoaded()) {
      this.real808Sampler.triggerAttackRelease(subRoot, '2m', Tone.now(), 0.01)
    } else if (!this.isCurrentVoiceSampler) {
      (this.synth as Tone.MonoSynth).triggerAttack(subRoot, Tone.now(), 0.01)
      this.synth.volume.rampTo(-14, 2)
    } else {
       // Samplers do not support sustained infinite attacks well, use a long dummy note
       this.synth.triggerAttackRelease(subRoot, '2m', Tone.now(), 0.01)
       this.synth.volume.rampTo(-8, 2)
    }
  }

  /** Public so the orchestrator can hard-cut the part on a live preset swap
   *  (see GeneratorOrchestrator.cutActivePartsForSwap). Otherwise internal. */
  stopPart(): void {
    if (this.part) {
      this.part.stop()
      this.part.dispose()
      this.part = null
    }
    
    try {
      this.synth.volume.cancelScheduledValues(Tone.now())
      if (this.synth instanceof Tone.MonoSynth) {
        this.synth.triggerRelease()
      } else {
        this.synth.releaseAll()
      }
    } catch { /* */ }
  }

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier * this.volumeMultiplier
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    const linear = db === -Infinity ? 0 : Math.pow(10, db / 20)
    if (Math.abs(linear - this.lastOutputGain) < 0.008) return
    this.lastOutputGain = linear
    this.output.gain.cancelScheduledValues(Tone.now())
    this.output.gain.rampTo(linear, 0.35)
  }

  /** Check if the current voice is ready for note scheduling.
   *  MonoSynth (isCurrentVoiceSampler=false) is always ready.
   *  CDN Sampler returns true only after its samples finish loading. */
  private isSamplerReady(): boolean {
    if (!this.isCurrentVoiceSampler) return true  // MonoSynth is always ready
    return (this.synth as LoadableSampler).isLoaded === true
  }

  /** Return the best available bass voice: real 808 sampler > loaded sampler > synth > fallback. */
  private getActiveVoice(): Tone.MonoSynth | LoadableSampler | Real808BassSampler {
    if (this.use808Active && this.real808Sampler?.isLoaded()) return this.real808Sampler
    return this.isSamplerReady() ? this.synth : this.fallbackSynth
  }

  dispose(): void {
    this.disposeLoopPlayback()
    this.stopPart()
    if (this.unsubscribeConductor) {
      this.unsubscribeConductor()
      this.unsubscribeConductor = null
    }
    if (this.pendingSynthDispose) {
      clearTimeout(this.pendingSynthDispose)
      this.pendingSynthDispose = null
    }
    if (this.pendingOldSynth) {
      try { this.pendingOldSynth.disconnect() } catch { /* */ }
      try { this.pendingOldSynth.dispose() } catch { /* */ }
      this.pendingOldSynth = null
    }
    this.lfo.dispose()
    this.lfoGain.dispose()
    this.synth.dispose()
    this.fallbackSynth.dispose()
    this.disposeReal808Sampler()
    this.subSynth.dispose()
    this.subGain.dispose()
    this.filter.dispose()
    this.monoSub.dispose()
    this.compressor.dispose()
    this.distortion.dispose()
    this.output.dispose()
  }
}
