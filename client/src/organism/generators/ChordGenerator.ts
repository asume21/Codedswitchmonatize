// Section 04 — Chord Generator
//
// 5th generator in the Organism — plays chord progressions using pad/keys
// synth voices. Picks from the 176-progression bank based on mood×mode matching.
// Broadcasts the current chord so Bass and Melody can target chord tones.

import * as Tone from 'tone'
import { GeneratorBase }  from './GeneratorBase'
import { GeneratorName }  from './types'
import type { PhysicsState }  from '../physics/types'
import { OrganismMode }       from '../physics/types'
import type { OrganismState } from '../state/types'
import { OState }             from '../state/types'
import { voiceChord, type ChordEvent } from './patterns/ChordProgressionBank'
import { getConductor, type ParsedChord } from '../conductor/Conductor'
import { createSoundfontSampler, createMultisampleSampler, type LoadableSampler } from '../instruments/SamplerUtils'
import { getTechnique, DEFAULT_TECHNIQUE_ID, defaultTechniqueForMode } from '../techniques/library'
import type { TechniqueContext } from '../techniques/types'
import { getLivePartStart, quantizeGridTime } from './CompositionClock'
import {
  conformChordToInstrument,
  selectInstrumentPerformer,
  type InstrumentPerformerId,
  type InstrumentPerformerProfile,
} from '../performers'

export enum ChordBehavior {
  Silent  = 'silent',    // Dormant / Awakening — no chords
  Pad     = 'pad',       // Breathing — long sustained chords (whole notes)
  Rhythm  = 'rhythm',    // Flow — rhythmic chord hits (half/quarter notes)
  Stab    = 'stab',      // High energy — short staccato stabs
}

const MODE_SWING: Record<string, number> = {
  heat: 0.20, gravel: 0.22, smoke: 0.55, ice: 0.48, glow: 0.38,
}

const MODE_OCTAVES: Record<string, number> = {
  heat: 3, gravel: 3, smoke: 3, ice: 4, glow: 4,
}

export class ChordGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth:   Tone.PolySynth | LoadableSampler
  // Fallback synth — always available for instant playback while CDN samplers load
  private fallbackSynth: Tone.PolySynth
  private chorus:  Tone.Chorus
  private reverb:  Tone.Reverb
  private dryBus:  Tone.Gain
  private reverbSend: Tone.Gain
  private reverbReturnHP: Tone.Filter
  private part:    Tone.Part | null = null
  private hasStartedPlayback: boolean = false

  // Musical state — Phase 4: Conductor owns the progression and chord index.
  // ChordGenerator is a performer: reads conductor.currentChord() at render
  // time and rebuilds its Part on every chord-change event (dirty-flag pattern,
  // matches Bass/Melody). It no longer picks, rotates, or locks progressions.
  private currentBehavior:    ChordBehavior = ChordBehavior.Silent
  private rootPitchClass:     number = 0     // synced from ScaleSnapEngine
  private currentMode:        string = 'glow'
  private conductorChordDirty: boolean = false
  private unsubscribeConductor: (() => void) | null = null
  // Tracks the last progression-replacement we rendered. Compared against
  // conductor.getProgressionVersion() on each chord-change event to decide
  // whether the Part actually needs a rebuild (vs. a benign advance).
  private lastProgressionVersion: number = -1
  private currentSwing:       number = 0.35
  private currentPerformer:   InstrumentPerformerProfile | null = null
  private explicitPerformerId: InstrumentPerformerId | null = null
  private lastPerformerEnergy: number = 0.5
  // Section technique override — controls playing style per arrangement section.
  // null = fall back to mode default. User's explicit override (techniqueOverridden) wins.
  private sectionTechniqueId: string | null = null

  // Reactive state
  private volumeMultiplier: number = 1.0

  // Active technique — controls how chord notes are distributed over time.
  // Defaults to block-chord (simultaneous notes) for backward compatibility.
  private currentTechniqueId: string = DEFAULT_TECHNIQUE_ID

  // Tracks whether the technique was explicitly set by a warm-up phrase or
  // external caller. When false, mode changes auto-update the technique to
  // the new mode's default (e.g. heat → guitar-muted-stab). When true, the
  // user/warmup intent is preserved across mode drift.
  private techniqueOverridden: boolean = false
  // Remember the last mode we saw, so we only re-apply defaults on actual change
  private lastModeForTechnique: string | null = null

  /**
   * Change the active playing technique (rebuilds the Part on next tick).
   * Explicit calls mark the technique as "overridden" — mode changes will
   * no longer auto-swap it. Pass markAsOverride=false for mode-driven defaults.
   */
  setTechnique(techniqueId: string, markAsOverride: boolean = true): void {
    if (!getTechnique(techniqueId)) {
      console.warn(`[ChordGenerator] Unknown technique: ${techniqueId}`)
      return
    }
    if (markAsOverride) this.techniqueOverridden = true
    if (this.currentTechniqueId === techniqueId) return
    this.currentTechniqueId = techniqueId
    // Rebuild on next tick so new technique takes effect at the next chord
    this.lastRebuildTime = -Infinity
    this.rebuildPart()
  }

  /**
   * Clear the override flag so mode changes can auto-select a default technique.
   * Called when leaving Dormant / starting fresh.
   */
  resetTechniqueOverride(): void {
    this.techniqueOverridden = false
    this.lastModeForTechnique = null
  }

  getTechnique(): string {
    return this.currentTechniqueId
  }

  setPerformerEnergy(energy: number): void {
    this.lastPerformerEnergy = energy
  }

  setInstrumentPerformer(instrumentId: InstrumentPerformerId | null): void {
    this.explicitPerformerId = instrumentId
    this.applyVoice(this.currentMode)
    this.rebuildPart()
  }

  // When true, a real multisample instrument owns the chord voice and applyVoice
  // (performer/soundfont) is suppressed so it isn't overwritten on rebuilds.
  private multisampleActive = false

  /**
   * Swap the chord voice to a real note-mapped multisample instrument (e.g. a
   * Soulful Keys e-piano for keys styles), so the organism comps the harmony with
   * a real recorded instrument. Pass null to revert to the performer/soundfont.
   */
  setMultisampleInstrument(noteUrls: Record<string, string> | null): void {
    if (!noteUrls) {
      if (!this.multisampleActive) return
      this.multisampleActive = false
      this.applyVoice(this.currentMode)   // rebuild the performer voice
      return
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
      oldSynth.releaseAll()
      oldSynth.disconnect()
    } catch { /* */ }
    this.pendingOldSynth = oldSynth
    this.pendingSynthDispose = setTimeout(() => {
      try { oldSynth.dispose() } catch { /* */ }
      this.pendingOldSynth = null
      this.pendingSynthDispose = null
    }, 100)

    this.synth = createMultisampleSampler(noteUrls, { attack: 0.01, release: 0.6 }, -8)
    this.synth.connect(this.chorus)
    this.multisampleActive = true
  }

  // Tracked synth dispose timer
  private pendingSynthDispose: ReturnType<typeof setTimeout> | null = null
  private pendingOldSynth: Tone.PolySynth | LoadableSampler | null = null
  private lastOutputGain:   number = 0

  // ─── Dynamic Global Voices ──────────────────────────────────
  private static readonly GLOBAL_VOICES: Array<{
    name: string; type: 'FM' | 'Synth' | 'Sampler'; options: any; presetId?: string
    volume: number; chorusWet: number; reverbDecay: number
    modes: string[] // which modes this instrument heavily favors
  }> = [
    // Trap / Heat
    { name: 'Dark Pad', type: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 20 },
      envelope: { attack: 0.4, decay: 0.8, sustain: 0.6, release: 1.5 },
    }, volume: -16, chorusWet: 0.3, reverbDecay: 1.5, modes: ['heat', 'gravel'] },
    { name: 'Brass Synth', type: 'Synth', options: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.08, decay: 0.3, sustain: 0.75, release: 0.25 },
    }, volume: -14, chorusWet: 0.1, reverbDecay: 0.8, modes: ['heat'] },

    // Boom Bap / Gravel
    { name: 'Jazz Horns', type: 'Sampler', presetId: 'trumpet', options: {
      envelope: { attack: 0.05, release: 0.3 }
    }, volume: -12, chorusWet: 0.2, reverbDecay: 1.0, modes: ['gravel'] },

    // Neo-Soul / Smoke
    { name: 'Warm Rhodes', type: 'Sampler', presetId: 'electric_piano_1', options: {
      envelope: { attack: 0.005, release: 0.8 }
    }, volume: -8, chorusWet: 0.45, reverbDecay: 1.5, modes: ['smoke', 'gravel'] },

    // Cloud Rap / Ice
    { name: 'Choir Aahs', type: 'Sampler', presetId: 'choir_aahs', options: {
      envelope: { attack: 0.3, release: 1.5 }
    }, volume: -8, chorusWet: 0.5, reverbDecay: 2.5, modes: ['ice'] },
    { name: 'Harp', type: 'Sampler', presetId: 'orchestral_harp', options: {
      envelope: { attack: 0.01, release: 1.5 }
    }, volume: -5, chorusWet: 0.55, reverbDecay: 3.0, modes: ['ice'] },

    // R&B / Glow
    { name: 'Acoustic Piano', type: 'Sampler', presetId: 'acoustic_grand_piano', options: {
      envelope: { attack: 0.005, release: 1.5 }
    }, volume: -8, chorusWet: 0.3, reverbDecay: 1.5, modes: ['glow', 'smoke'] },
    { name: 'String Ensemble', type: 'Sampler', presetId: 'string_ensemble_1', options: {
      envelope: { attack: 0.4, release: 1.5 }
    }, volume: -6, chorusWet: 0.4, reverbDecay: 2.0, modes: ['glow'] },

    // Guitars — fingerpicked, funk chunks, trap rock
    { name: 'Nylon Guitar', type: 'Sampler', presetId: 'acoustic_guitar_nylon', options: {
      envelope: { attack: 0.005, release: 0.6 }
    }, volume: -8, chorusWet: 0.15, reverbDecay: 1.2, modes: ['ice', 'glow', 'smoke'] },
    { name: 'Clean Guitar', type: 'Sampler', presetId: 'electric_guitar_clean', options: {
      envelope: { attack: 0.005, release: 0.4 }
    }, volume: -10, chorusWet: 0.2, reverbDecay: 0.8, modes: ['smoke', 'glow', 'gravel'] },
    { name: 'Distortion Guitar', type: 'Sampler', presetId: 'distortion_guitar', options: {
      envelope: { attack: 0.005, release: 0.3 }
    }, volume: -14, chorusWet: 0.1, reverbDecay: 0.6, modes: ['heat', 'gravel'] },

    // Bowed low strings — warm chord bed, jazz / cinematic
    { name: 'Cello', type: 'Sampler', presetId: 'cello', options: {
      envelope: { attack: 0.15, release: 1.2 }
    }, volume: -6, chorusWet: 0.2, reverbDecay: 2.0, modes: ['smoke', 'gravel', 'glow'] },

    // Mallet — boom-bap / Madlib aesthetic, lo-fi stabs
    { name: 'Vibraphone', type: 'Sampler', presetId: 'vibraphone', options: {
      envelope: { attack: 0.005, release: 1.5 }
    }, volume: -8, chorusWet: 0.3, reverbDecay: 2.0, modes: ['smoke', 'ice'] },
    { name: 'Marimba', type: 'Sampler', presetId: 'marimba', options: {
      envelope: { attack: 0.005, release: 0.6 }
    }, volume: -7, chorusWet: 0.2, reverbDecay: 1.2, modes: ['ice', 'smoke'] },

    // Tenor brass — section pads, low/warm horns
    { name: 'Trombone Section', type: 'Sampler', presetId: 'trombone', options: {
      envelope: { attack: 0.06, release: 0.4 }
    }, volume: -11, chorusWet: 0.15, reverbDecay: 1.0, modes: ['gravel', 'heat'] },
    { name: 'French Horn', type: 'Sampler', presetId: 'french_horn', options: {
      envelope: { attack: 0.1, release: 0.8 }
    }, volume: -9, chorusWet: 0.2, reverbDecay: 1.5, modes: ['glow', 'smoke'] },

    // Exotic / sample-flip flavor
    { name: 'Sitar', type: 'Sampler', presetId: 'sitar', options: {
      envelope: { attack: 0.005, release: 1.0 }
    }, volume: -8, chorusWet: 0.4, reverbDecay: 1.8, modes: ['ice', 'smoke'] },
  ]

  constructor() {
    super(GeneratorName.Chord)

    this.output = new Tone.Gain(1)

    this.synth = this.buildDefaultSynth()
    this.fallbackSynth = this.buildDefaultSynth()

    // FX chain: synth → chorus → dry bus → output
    //                           → reverb send → reverb → HP → output
    this.chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 4, depth: 0.5, wet: 0.35 })
    this.dryBus = new Tone.Gain(0.75)
    this.reverbSend = new Tone.Gain(0.12)
    this.reverb = new Tone.Reverb({ decay: 2.0, wet: 1.0 })
    this.reverbReturnHP = new Tone.Filter({ type: 'highpass', frequency: 250, rolloff: -12 })

    this.synth.connect(this.chorus)
    this.fallbackSynth.connect(this.chorus)
    this.chorus.connect(this.dryBus)
    this.chorus.connect(this.reverbSend)
    this.dryBus.connect(this.output)
    this.reverbSend.connect(this.reverb)
    this.reverb.connect(this.reverbReturnHP)
    this.reverbReturnHP.connect(this.output)

    this.chorus.start()
    this.setOutputLevel(0)

    // Phase 4 — listen to Conductor for chord-change events. The Orchestrator
    // calls conductor.advanceChord() on every bar tick and pickNewProgression()
    // on section change. We just set a dirty flag; the actual Part rebuild
    // happens on the next processFrame so we're never building Tone.Parts
    // inside the audio-thread callback that fired the listener (the bug that
    // killed Phase 4 attempt ea4e43e).
    this.unsubscribeConductor = getConductor().onChordChange(() => {
      this.conductorChordDirty = true
    })
  }

  private buildDefaultSynth(): Tone.PolySynth {
    // 8 voices ran out under rolled-chord technique (4-note chord × 1.5s release
    // × overlap into next chord = up to 16 simultaneous voices). Raised to 16 so
    // sustained pads + rolled chords stop dropping notes mid-arpeggio.
    return new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 16,
      harmonicity: 2,
      modulationIndex: 0.8,
      oscillator:    { type: 'sine' },
      modulation:    { type: 'triangle' },
      envelope:      { attack: 0.3, decay: 1.0, sustain: 0.5, release: 2.0 },
      modulationEnvelope: { attack: 0.1, decay: 0.5, sustain: 0.3, release: 1.5 },
    } as any)
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    this.currentMode = physics.mode.toString()
    this.currentSwing = MODE_SWING[this.currentMode] ?? 0.35

    // Technique priority (highest → lowest):
    //   1. User explicit override (techniqueOverridden=true) — never touched here
    //   2. Section technique (sectionTechniqueId) — arrangement automation
    //   3. Mode default — fires only on mode change when no section override
    if (!this.techniqueOverridden) {
      if (this.sectionTechniqueId !== null) {
        if (this.currentTechniqueId !== this.sectionTechniqueId) {
          this.setTechnique(this.sectionTechniqueId, /* markAsOverride */ false)
        }
      } else if (this.currentMode !== this.lastModeForTechnique) {
        const modeDefault = this.currentPerformer?.defaultTechnique ?? defaultTechniqueForMode(this.currentMode)
        if (modeDefault !== this.currentTechniqueId) {
          this.setTechnique(modeDefault, /* markAsOverride */ false)
        }
        this.lastModeForTechnique = this.currentMode
      }
    }

    const newBehavior = this.getChordBehavior(organism)

    if (newBehavior !== this.currentBehavior) {
      this.currentBehavior = newBehavior
      const rebuilt = this.rebuildPart()
      if (rebuilt) this.conductorChordDirty = false
    } else if (this.conductorChordDirty) {
      // Conductor's chord changed (bar-tick advance OR pickNewProgression).
      // Single-bar Part architecture means we always need to rebuild — the
      // running Part loops the previous chord forever otherwise. Throttle in
      // rebuildPart keeps this from going wild at extreme BPMs.
      const rebuilt = this.rebuildPart()
      if (rebuilt) this.conductorChordDirty = false
    }

    const targetLevel = this.computeTargetLevel(organism)
    this.activityLevel += this.smoothingCoeff(150) * (targetLevel - this.activityLevel)
    this.setOutputLevel(this.activityLevel)
  }

  private enabled: boolean = true

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.reset()
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
    if (!this.enabled) return
    this.currentMode = physics.mode.toString()

    if (to === OState.Dormant) {
      this.stopPart()
      this.activityLevel = 0
      this.currentBehavior = ChordBehavior.Silent
      return
    }

    if (to === OState.Awakening) {
      this.currentBehavior = ChordBehavior.Silent
      this.applyVoice(this.currentMode)
      return
    }

    if (to === OState.Breathing || to === OState.Flow) {
      this.currentBehavior = to === OState.Breathing ? ChordBehavior.Pad : ChordBehavior.Rhythm
      this.rebuildPart()
    }
  }

  reset(): void {
    this.stopPart()
    this.activityLevel = 0
    this.currentBehavior = ChordBehavior.Silent
    this.hasStartedPlayback = false
    this.lastRebuildTime = -Infinity
    this.sectionTechniqueId = null
    this.setOutputLevel(0)
  }

  /** Phase 4: lock/unlock live on the Conductor — these forward for backward
   *  compatibility with the OrganismProvider toggle. */
  lockProgression(): void {
    getConductor().lockProgression()
  }

  unlockProgression(): void {
    getConductor().unlockProgression()
  }

  /**
   * Subscribe to chord changes. Phase 4 delegates to the Conductor — the
   * generator no longer owns its own listener list. We translate
   * ParsedChord → ChordEvent so callers using the legacy shape don't break.
   */
  onChordChange(listener: (chord: ChordEvent, rootPitchClass: number) => void): () => void {
    const conductor = getConductor()
    return conductor.onChordChange((parsed) => {
      const keyPC = conductor.getKeyPitchClass()
      const rootOffset = (((parsed.rootMidi - 60) - keyPC) % 12 + 12) % 12
      listener(
        { intervals: parsed.intervals, rootOffset, label: parsed.symbol },
        keyPC,
      )
    })
  }

  /** Translated read of the Conductor's current chord in ChordEvent shape. */
  getCurrentChord(): ChordEvent | null {
    const conductor = getConductor()
    const parsed = conductor.currentChord()
    if (!parsed) return null
    const keyPC = conductor.getKeyPitchClass()
    return {
      intervals:  parsed.intervals,
      rootOffset: (((parsed.rootMidi - 60) - keyPC) % 12 + 12) % 12,
      label:      parsed.symbol,
    }
  }

  getRootPitchClass(): number {
    return this.rootPitchClass
  }

  setRootPitchClass(pitchClass: number): void {
    this.rootPitchClass = ((pitchClass % 12) + 12) % 12
  }

  applyVolumeMultiplier(multiplier: number): void {
    this.volumeMultiplier = Math.max(0, multiplier)
    this.setOutputLevel(this.activityLevel)
  }

  /**
   * Phase 4 — delegates to the Conductor. The Orchestrator already calls
   * `conductor.pickNewProgression()` on section change, so this stays as a
   * compatibility wrapper for OrganismProvider's manual "new progression"
   * button. The dirty flag will cause our own Part to rebuild on the next
   * frame via the chord-change listener we set up in the constructor.
   */
  pickNewProgression(): void {
    getConductor().pickNewProgression()
  }

  private getChordBehavior(organism: OrganismState): ChordBehavior {
    switch (organism.current) {
      case OState.Dormant:
      case OState.Awakening:
        return ChordBehavior.Silent
      case OState.Breathing:
        return ChordBehavior.Pad
      case OState.Flow:
        return organism.flowDepth > 0.7 ? ChordBehavior.Stab : ChordBehavior.Rhythm
    }
  }

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:   return 0
      case OState.Awakening: return 0.05 * organism.awakeningProgress
      case OState.Breathing: return 0.45 * organism.breathingWarmth
      case OState.Flow:      return 0.55 + (0.25 * organism.flowDepth)
    }
  }

  private lastRebuildTime: number = -Infinity
  private static readonly MIN_REBUILD_INTERVAL_MS = 500

  private rebuildPart(): boolean {
    const now = performance.now()
    if (now - this.lastRebuildTime < ChordGenerator.MIN_REBUILD_INTERVAL_MS) return false
    this.lastRebuildTime = now

    if (this.currentBehavior === ChordBehavior.Silent) {
      this.stopPart()
      return true
    }

    // Phase 4: render a single-bar loop for the Conductor's CURRENT chord.
    // The Orchestrator advances the Conductor on every bar tick — generators
    // play the chord they're told, no internal multi-bar scheduling. This
    // keeps Pad locked to Bass and Melody (which are also chord-by-chord
    // performers) regardless of progression length. The previous multi-bar
    // render with `barsPerChord = floor(4/chordCount)` only happened to align
    // for 4-chord progressions; 2/8-chord progressions drifted by one chord
    // per bar relative to Bass.
    const conductor = getConductor()
    const parsedCurrent = conductor.currentChord()
    const parsedNext    = conductor.nextChord()
    if (!parsedCurrent) {
      this.stopPart()
      return true
    }
    const keyPC = conductor.getKeyPitchClass()
    const toEvent = (p: ParsedChord): ChordEvent => ({
      intervals:  p.intervals,
      rootOffset: (((p.rootMidi - 60) - keyPC) % 12 + 12) % 12,
      label:      p.symbol,
    })
    const currentChord = toEvent(parsedCurrent)
    const nextChord    = toEvent(parsedNext)
    this.lastProgressionVersion = conductor.getProgressionVersion()
    const voicingRootPC = keyPC
    const octave = MODE_OCTAVES[this.currentMode] ?? 4

    interface ChordPartEvent {
      time: string
      notes: string[]
      dur: string
      vel: number
      chordIdx: number
    }

    const midiNotes = voiceChord(currentChord, voicingRootPC, octave)
    const noteStrings = midiNotes.map((m) => Tone.Frequency(m, 'midi').toNote())

    const events: ChordPartEvent[] = []

    switch (this.currentBehavior) {
      case ChordBehavior.Pad: {
        events.push({ time: '0:0:0', notes: noteStrings, dur: '1m', vel: 0.55, chordIdx: 0 })
        break
      }
      case ChordBehavior.Rhythm: {
        events.push({ time: '0:0:0', notes: noteStrings, dur: '2n', vel: 0.58, chordIdx: 0 })
        events.push({ time: '0:2:0', notes: noteStrings, dur: '2n', vel: 0.48, chordIdx: 0 })
        break
      }
      case ChordBehavior.Stab: {
        const swungSub = 2 + this.currentSwing
        events.push({ time: '0:0:0',                          notes: noteStrings, dur: '8n', vel: 0.65, chordIdx: 0 })
        events.push({ time: `0:1:${swungSub.toFixed(2)}`,     notes: noteStrings, dur: '8n', vel: 0.50, chordIdx: 0 })
        events.push({ time: '0:2:0',                          notes: noteStrings, dur: '8n', vel: 0.58, chordIdx: 0 })
        // Pickup to the next chord — Conductor.nextChord() makes this work
        // even though we only render one bar at a time. The pickup falls on
        // the swung "and" of beat 4.
        const nextMidi = voiceChord(nextChord, voicingRootPC, octave)
        const nextNotes = nextMidi.map((m) => Tone.Frequency(m, 'midi').toNote())
        events.push({ time: `0:3:${swungSub.toFixed(2)}`, notes: nextNotes, dur: '16n', vel: 0.42, chordIdx: 0 })
        break
      }
    }

    const loopBars = 1

    const quantizedEvents = events.map(event => ({
      ...event,
      time: quantizeGridTime(event.time, loopBars),
    }))

    const startAt = getLivePartStart(this.hasStartedPlayback)

    // Seamless handoff: keep old Part playing until the new one starts.
    const transport = Tone.getTransport()
    const oldPart = this.part
    if (oldPart) {
      if (transport.state === 'started' && this.hasStartedPlayback && typeof startAt === 'number' && startAt > 0) {
        oldPart.stop(startAt)
        // startAt is a TransportTime (see CompositionClock.getLivePartStart).
        // Real-time until the Transport reaches it = startAt − transport.seconds.
        const msUntilStart = (startAt - transport.seconds) * 1000
        window.setTimeout(() => oldPart.dispose(), Math.max(50, msUntilStart + 100))
      } else {
        oldPart.stop()
        oldPart.dispose()
      }
    }
    this.part = null

    this.part = new Tone.Part((time, event: ChordPartEvent) => {
      // Phase 4: chord-change events come from the Conductor (driven by the
      // Orchestrator's bar tick). The audio callback no longer writes to any
      // shared state — it only renders sound.

      const vel = Math.min(1, Math.max(0.1, event.vel + (Math.random() - 0.5) * 0.08))

      // Use sampler only if fully loaded; otherwise use fallback PolySynth
      const voice = this.isSamplerReady() ? this.synth : this.fallbackSynth
      const playableNotes = this.currentPerformer
        ? conformChordToInstrument(event.notes, this.currentPerformer)
        : event.notes

      // ── Technique dispatch ─────────────────────────────────────────
      // Instead of firing all chord notes simultaneously (block-chord), the
      // active technique returns per-note events with time offsets, allowing
      // guitar-strum, piano-roll, Alberti patterns, etc. Falls back to
      // simultaneous play when the default block-chord technique is active.
      const technique = getTechnique(this.currentTechniqueId)
      if (technique && this.currentTechniqueId !== DEFAULT_TECHNIQUE_ID) {
        const tempo = Tone.getTransport().bpm.value || 90
        const chordDurationSec = Tone.Time(event.dur).toSeconds()
        const ctx: TechniqueContext = {
          barIndex:         event.chordIdx,
          beatPosition:     0,
          swing:            this.currentSwing,
          energy:           Math.max(0, Math.min(1, vel)),
          mode:             this.currentMode as any,
          tempo,
          chordDurationSec,
        }
        const scheduled = technique.schedule(playableNotes, ctx)
        for (const n of scheduled) {
          const noteVel = Math.min(1, Math.max(0.05, n.velocity * vel / 0.6))
          // Clamp to ≥0: the first event of a freshly-started Part can compute
          // a float-negative absolute time (e.g. -1.6e-11), which Tone rejects
          // with "value must be within [0, Infinity]" and silences the voice.
          voice.triggerAttackRelease(n.note, n.duration, Math.max(0, time + n.timeOffset), noteVel)
        }
      } else {
        // Legacy block-chord path: fire all notes simultaneously
        voice.triggerAttackRelease(playableNotes, event.dur, Math.max(0, time), vel)
      }
    }, quantizedEvents)

    this.part.loop = true
    this.part.loopEnd = `${loopBars}m`
    this.part.start(startAt)
    this.hasStartedPlayback = true
    return true
  }

  /**
   * Called by the orchestrator on each arrangement section change.
   * Changes the chord playing TECHNIQUE to match the section's energy —
   * the chord instrument stays constant (it IS the beat's harmonic signature).
   *
   *   intro/breakdown → sustained pad (spacious, emotional, held notes)
   *   verse           → rolled chord  (gentle arpeggio, rhythmic but airy)
   *   build/drop/drop2 → mode default (punchy stab or block chord)
   */
  onSectionChange(sectionName: string, aiTechnique?: string): void {
    // Phase 4: progression rotation moved to the Orchestrator (which calls
    // conductor.pickNewProgression() on section boundaries — see
    // GeneratorOrchestrator.applyArrangement). This method now only handles
    // the playing TECHNIQUE per section — the chord instrument stays constant
    // (it IS the beat's harmonic signature):
    //   intro/breakdown → sustained pad
    //   verse           → rolled chord
    //   build/drop/drop2 → mode default (punchy stab)
    if (aiTechnique) {
      const techniqueMap: Record<string, string | null> = {
        pad:    'piano-sustained-pad',
        rolled: 'piano-rolled-chord',
        stab:   null,
      }
      this.sectionTechniqueId = (aiTechnique in techniqueMap) ? techniqueMap[aiTechnique] : null
    } else if (sectionName === 'intro' || sectionName === 'breakdown') {
      this.sectionTechniqueId = 'piano-sustained-pad'
    } else if (sectionName === 'verse') {
      this.sectionTechniqueId = 'piano-rolled-chord'
    } else {
      this.sectionTechniqueId = null
    }
  }

  private applyVoice(mode: string): void {
    // When a real multisample instrument is locked in (e.g. a keys style using a
    // Soulful Keys e-piano), don't let the performer/soundfont path overwrite it.
    if (this.multisampleActive) return
    {
    const performer = selectInstrumentPerformer({
      role: 'chord',
      mode,
      energy: this.activityLevel,
      explicitId: this.explicitPerformerId ?? undefined,
    })
    this.currentPerformer = performer
    if (!this.techniqueOverridden) {
      this.currentTechniqueId = performer.defaultTechnique
      this.lastModeForTechnique = mode
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
      oldSynth.releaseAll()
      oldSynth.disconnect()
    } catch { /* */ }

    this.pendingOldSynth = oldSynth
    this.pendingSynthDispose = setTimeout(() => {
      try { oldSynth.dispose() } catch { /* */ }
      this.pendingOldSynth = null
      this.pendingSynthDispose = null
    }, 100)

    this.synth = createSoundfontSampler(
      performer.samplerPreset,
      performer.envelope,
      performer.volume,
    )
    this.synth.connect(this.chorus)
    this.chorus.wet.rampTo(performer.family === 'bowed' ? 0.42 : 0.25, 0.5)
    this.reverb.decay = performer.family === 'bowed' ? 2.2 : 1.2

    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.debug(`Chord performer: ${performer.name} (${mode})`)
    }
    }
  }

  private stopPart(): void {
    if (this.part) {
      this.part.stop()
      this.part.dispose()
      this.part = null
    }
    try {
      this.synth.volume.cancelScheduledValues(Tone.now())
      this.synth.releaseAll()
    } catch { /* */ }
  }

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier * Math.min(2.0, this.volumeMultiplier)
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    const linear = db === -Infinity ? 0 : Math.pow(10, db / 20)
    if (Math.abs(linear - this.lastOutputGain) < 0.008) return
    this.lastOutputGain = linear
    this.output.gain.cancelScheduledValues(Tone.now())
    this.output.gain.rampTo(linear, 0.35)
  }

  /** Check if the current synth is a sampler AND has finished loading */
  private isSamplerReady(): boolean {
    if (this.synth instanceof Tone.PolySynth) return false
    return (this.synth as LoadableSampler).isLoaded === true
  }

  dispose(): void {
    this.stopPart()
    this.unsubscribeConductor?.()
    this.unsubscribeConductor = null
    if (this.pendingSynthDispose) {
      clearTimeout(this.pendingSynthDispose)
      this.pendingSynthDispose = null
    }
    if (this.pendingOldSynth) {
      try { this.pendingOldSynth.disconnect() } catch { /* */ }
      try { this.pendingOldSynth.dispose() } catch { /* */ }
      this.pendingOldSynth = null
    }
    this.synth.dispose()
    this.fallbackSynth.dispose()
    this.chorus.dispose()
    this.dryBus.dispose()
    this.reverbSend.dispose()
    this.reverbReturnHP.dispose()
    this.reverb.dispose()
    this.output.dispose()
  }
}
