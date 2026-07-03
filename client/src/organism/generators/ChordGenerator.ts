// Section 04 — Chord Generator
//
// 5th generator in the Organism — plays chord progressions using pad/keys
// synth voices. Picks from the 176-progression bank based on mood×mode matching.
// Broadcasts the current chord so Bass and Melody can target chord tones.

import * as Tone from 'tone'
import { buildFreeplayCompPlan } from './freeplay/ChordImproviser'
import { hashString, mulberry32, getSessionSalt } from './freeplay/utils'
import type { LoopClip } from '@shared/loopPack'
import { GeneratorBase }  from './GeneratorBase'
import { GeneratorName }  from './types'
import type { PhysicsState }  from '../physics/types'
import { OrganismMode }       from '../physics/types'
import type { OrganismState } from '../state/types'
import { OState }             from '../state/types'
import { type ChordEvent } from './patterns/ChordProgressionBank'
import { getConductor } from '../conductor/Conductor'
import { createSoundfontSampler, createMultisampleSampler, type LoadableSampler } from '../instruments/SamplerUtils'
import { getRealInstrumentNotes } from '../instruments/realInstruments'
import { getTechnique, DEFAULT_TECHNIQUE_ID, defaultTechniqueForMode } from '../techniques/library'
import type { TechniqueContext } from '../techniques/types'
import { getLivePartStart, livePartStartOffset, msUntilTransportTime, quantizeGridTime } from './CompositionClock'
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

// Fallback only — the orchestrator pushes the sub-genre swing (the band's
// single groove source) via setSwing() on start and every sub-genre change.
// Scaled to the same musical range as DrumPatternLibrary's SWING table.
const MODE_SWING: Record<string, number> = {
  heat: 0.10, gravel: 0.11, smoke: 0.28, ice: 0.24, glow: 0.19,
}

// Chords live an octave below the lead — octave 3 voicings (C3–G4) are the
// hip-hop/R&B register. That register now lives in the Conductor's voicing
// engine (conductor/voicing.ts), which ChordGenerator reads via currentVoicing().
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

  // ── Freeplay (spec 2026-07-02) ── comp plans instead of a fixed technique.
  private freeplayEnabled = true
  private freeplayCallCounter = 0

  /** Zeroed on every organism start so a pinned freeplay seed replays exactly. */
  resetFreeplayCounter(): void { this.freeplayCallCounter = 0 }

  // Kick onset slots from the current drum pattern (absolute 16ths), pushed by
  // the orchestrator after every drum rebuild — same channel the bass uses.
  // Freeplay comping reads these to sit in the pockets BETWEEN the kicks.
  private kickAnchors: number[] = []

  setKickAnchors(slots: number[]): void {
    this.kickAnchors = [...slots]
  }

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
    // Automatic callers (reactive style shifts, section style presets) must
    // not stomp an explicit user pick — the UI dropdown "snapping back".
    if (!markAsOverride && this.techniqueOverridden) return
    if (markAsOverride) this.techniqueOverridden = true
    if (this.currentTechniqueId === techniqueId) return
    this.currentTechniqueId = techniqueId
    // Rebuild on next tick so new technique takes effect at the next chord
    this.lastRebuildTime = -Infinity
    this.rebuildPart()
  }

  /** Freeplay on/off. Entering freeplay resets to the default (humanised
   *  block) renderer so a stale technique doesn't restyle the comp plan. */
  setFreeplay(enabled: boolean): void {
    if (this.freeplayEnabled === enabled) return
    this.freeplayEnabled = enabled
    if (enabled) this.currentTechniqueId = DEFAULT_TECHNIQUE_ID
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

  // Set by the orchestrator on every sub-genre change so chords swing by the
  // SAME amount as the drum pattern (one band, one pocket).
  private subGenreSwing: number | null = null

  setSwing(amount: number): void {
    this.subGenreSwing = Math.max(0, Math.min(1, amount))
  }

  setInstrumentPerformer(instrumentId: InstrumentPerformerId | null): void {
    this.explicitPerformerId = instrumentId
    // An explicit user pick must beat the keys-style multisample lock —
    // otherwise applyVoice() early-returns and the CHORDS instrument dropdown
    // silently does nothing on most presets (every keys style locks the
    // e-piano via setMultisampleInstrument).
    if (instrumentId) this.multisampleActive = false
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
    if (this._loopMode) return
    this.currentMode = physics.mode.toString()
    // Sub-genre swing (pushed by the orchestrator, matches the DRUM grid) wins;
    // the mode table is only the fallback before the first sub-genre sync.
    this.currentSwing = this.subGenreSwing ?? MODE_SWING[this.currentMode] ?? 0.35

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

    // Composer's role caps activity; reactive curve adds feel under the ceiling.
    const targetLevel = this.computeTargetLevel(organism) * this.roleCeiling()
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
    if (this._loopMode) return false
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
    if (!parsedCurrent) {
      this.stopPart()
      return true
    }
    // Part 3 V2: the Conductor owns the voicing now — voice-led, common tones
    // held — instead of ChordGenerator restacking the chord root-position. One
    // coordinated voicing for the whole band.
    this.lastProgressionVersion = conductor.getProgressionVersion()

    interface ChordPartEvent {
      time: string
      notes: string[]
      dur: string
      vel: number
      chordIdx: number
    }

    const midiNotes = conductor.currentVoicing().inner
    const noteStrings = midiNotes.map((m) => Tone.Frequency(m, 'midi').toNote())

    const events: ChordPartEvent[] = []

    if (this.freeplayEnabled) {
      // Energy from the current behavior — the behavior resolver already maps
      // organism state to intensity, so reuse it instead of a second signal.
      const energy = this.currentBehavior === ChordBehavior.Pad ? 0.3
        : this.currentBehavior === ChordBehavior.Stab ? 0.85 : 0.6
      const seed = hashString(`chord:${this.currentSectionName}`)
      const plan = buildFreeplayCompPlan({
        rootMidi: 60, chordIntervals: parsedCurrent.intervals ?? [0, 4, 7],
        // 2 bars: bar 1 states the comp motif, bar 2 develops it (variation +
        // mid-bar push). The old 1-bar loop hit the SAME three slots every bar
        // of the whole section — the "still repetitive" chord layer. Notes stay
        // the current voicing throughout, so the 2-bar plan is chord-safe: a
        // chord change rebuilds the part at the boundary exactly as before.
        bars: 2,
        swing: this.currentSwing,
        subGenre: 'none',
        energy,
        density: energy,
        sectionName: this.currentSectionName,
        motifSeed: seed,
        kickTimes16ths: this.kickAnchors,
        rng: mulberry32(seed + getSessionSalt() + this.freeplayCallCounter++),
      })
      for (const ev of plan) {
        const notes = ev.useNextVoicing
          ? conductor.nextVoicing().inner.map((m) => Tone.Frequency(m, 'midi').toNote())
          : noteStrings
        events.push({ time: ev.time, notes, dur: ev.dur, vel: ev.vel, chordIdx: 0 })
      }
    } else {
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
          // Sub 2 is the STRAIGHT eighth — 16th-note swing (the band's
          // convention, subs 1/3 delayed) never moves it. The old
          // `2 + swing` pushed every chord off-beat ~35ms late against drums
          // that play the same eighth straight: 8th-swing against a 16th-swing
          // band, a constant subtle drag on the "and" of beats 2 and 4.
          events.push({ time: '0:0:0', notes: noteStrings, dur: '8n', vel: 0.65, chordIdx: 0 })
          events.push({ time: '0:1:2', notes: noteStrings, dur: '8n', vel: 0.50, chordIdx: 0 })
          events.push({ time: '0:2:0', notes: noteStrings, dur: '8n', vel: 0.58, chordIdx: 0 })
          // Pickup to the next chord — Conductor.nextChord() makes this work
          // even though we only render one bar at a time. The pickup sits on
          // the swung last 16th (sub 3 + band swing) leading into the downbeat.
          const nextMidi = conductor.nextVoicing().inner
          const nextNotes = nextMidi.map((m) => Tone.Frequency(m, 'midi').toNote())
          events.push({ time: `0:3:${(3 + this.currentSwing).toFixed(2)}`, notes: nextNotes, dur: '16n', vel: 0.42, chordIdx: 0 })
          break
        }
      }
    }

    // Freeplay comps a 2-bar statement/development cycle; authored behaviors
    // keep their original 1-bar loop.
    const loopBars = this.freeplayEnabled ? 2 : 1

    const quantizedEvents = events.map(event => ({
      ...event,
      time: quantizeGridTime(event.time, loopBars),
    }))
    this.emitNoteEvents(
      quantizedEvents.flatMap(event =>
        event.notes.map(note => ({
          time: event.time,
          note,
          dur: event.dur,
          vel: event.vel,
        })),
      ),
    )

    const startAt = getLivePartStart(this.hasStartedPlayback)

    // Seamless handoff: keep old Part playing until the new one starts.
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
        // Humanised block-chord path: micro-strum note arrivals (lowest to highest)
        // and apply velocity variation so it sounds like a human pianist.
        const sortedNotes = [...playableNotes].sort((a, b) => {
          try {
            return Tone.Frequency(a).toMidi() - Tone.Frequency(b).toMidi()
          } catch {
            return 0
          }
        })

        sortedNotes.forEach((note, index) => {
          // Stagger: 12ms to 24ms delay per note, rolling upward
          const strumDelay = index * (0.012 + Math.random() * 0.008)
          // Velocity spread: scale base velocity, random fluctuation +/- 0.08,
          // and accent the bass/root note (index === 0) for solidity.
          const randomShift = (Math.random() - 0.5) * 0.16
          const baseScale = index === 0 ? 1.05 : 0.92
          const noteVel = Math.min(1.0, Math.max(0.1, vel * baseScale + randomShift))

          voice.triggerAttackRelease(note, event.dur, Math.max(0, time + strumDelay), noteVel)
        })
      }
    }, quantizedEvents)

    this.part.loop = true
    this.part.loopEnd = `${loopBars}m`
    // Phase-aligned like drums/bass: the 2-bar statement/development cycle
    // stays locked to the band's bar count, so the development bar (with its
    // push) consistently answers the drums' bar-B kicks instead of drifting
    // to whichever bar the rebuild happened on.
    this.part.start(startAt, livePartStartOffset(startAt, loopBars))
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

  /** Rebuild the performer voice (e.g. after real samples finish loading). */
  refreshVoice(): void {
    this.applyVoice(this.currentMode)
  }

  /**
   * Conductor Duet — punctuate a gap with a short stab of the CURRENT voicing.
   * A one-shot (outside the looping comp Part) the Conductor cues when the MC
   * breathes, so the band answers harmonically without stepping on the flow.
   * Uses the active comp voice + the same voicing the band is on, so the stab
   * sits right inside the harmony.
   */
  triggerAnswerStab(time: number, velocity: number): void {
    const inner = getConductor().currentVoicing().inner
    if (inner.length === 0) return
    const notes = inner.map((m) => Tone.Frequency(m, 'midi').toNote())
    const playable = this.currentPerformer
      ? conformChordToInstrument(notes, this.currentPerformer)
      : notes
    const voice = this.isSamplerReady() ? this.synth : this.fallbackSynth
    const vel = Math.max(0.05, Math.min(1, velocity))
    try { voice.triggerAttackRelease(playable, '8n', Math.max(0, time), vel) }
    catch { /* voice not ready / negative time — drop the answer, never throw */ }
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

    // Prefer the real recorded multisample (e.g. Sonatina strings) over the thin
    // GM soundfont when it's available on disk; GM is the graceful fallback.
    const realNotes = getRealInstrumentNotes(performer)
    this.synth = realNotes
      ? createMultisampleSampler(realNotes, performer.envelope, performer.volume)
      : createSoundfontSampler(performer.samplerPreset, performer.envelope, performer.volume)
    this.synth.connect(this.chorus)
    this.chorus.wet.rampTo(performer.family === 'bowed' ? 0.42 : 0.25, 0.5)
    this.reverb.decay = performer.family === 'bowed' ? 2.2 : 1.2

    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.debug(`Chord performer: ${performer.name} (${mode})`)
    }
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

  // Loop playback (_loopPlayer / _loopMode / loadLoop / setLoopMode / swapLoop)
  // is centralized in GeneratorBase.


  dispose(): void {
    this.disposeLoopPlayback()
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
