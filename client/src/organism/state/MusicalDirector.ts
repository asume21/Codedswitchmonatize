// Section 04 — Musical Director
//
// The central brain of the Organism's musical intelligence.
// Reads physics + organism state every frame, updates the unified
// MusicalState, and issues directives to all generators.
//
// This replaces the scattered decision logic that was spread across
// each generator. The director makes ALL musical decisions:
//   - Which sub-genre to use
//   - What groove parameters to set
//   - When to mutate patterns
//   - When to drop instruments for breathing room
//   - How to react to voice energy
//   - How to coordinate bass, drums, melody, and chords

import type { PhysicsState } from '../physics/types'
import { OrganismMode } from '../physics/types'
import type { OrganismState } from '../state/types'
import { OState } from '../state/types'
import { BassBehavior, MelodyBehavior } from '../generators/types'
import {
  type MusicalState,
  type HipHopSubGenre,
  type ArrangementSection,
  MODE_SUBGENRES,
  SUBGENRE_GROOVES,
  SUBGENRE_BPM,
  createDefaultMusicalState,
} from './MusicalState'
import {
  getBassBehaviorFromSubGenre,
  shouldEnableSlide,
  getPortamentoTime,
  getBassFilterCutoffFromSubGenre,
} from '../generators/patterns/BassPatternLibrary'
import { getMelodyBehavior } from '../generators/patterns/MelodyPatternLibrary'
import type { ChordEvent } from '../generators/patterns/ChordProgressionBank'

// ── Arrangement Template ──────────────────────────────────────────────
// 28-bar cycle with per-instrument multipliers AND dropout flags.

interface ArrangementSlot {
  name: ArrangementSection
  bars: number
  drums:   number
  bass:    number
  melody:  number
  chord:   number
  texture: number
  // Instrument dropout — which instruments should be silent for space
  drumDropout:  boolean
  bassDropout:  boolean
  melodyDropout: boolean
}

const ARRANGEMENT: ArrangementSlot[] = [
  { name: 'intro',     bars: 4, drums: 1.0, bass: 0.0, melody: 0.0, chord: 0.4, texture: 0, drumDropout: false, bassDropout: true,  melodyDropout: true  },
  { name: 'verse',     bars: 4, drums: 1.0, bass: 1.0, melody: 0.0, chord: 0.8, texture: 0, drumDropout: false, bassDropout: false, melodyDropout: true  },
  { name: 'build',     bars: 4, drums: 1.0, bass: 1.0, melody: 0.8, chord: 1.0, texture: 0, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.0, bass: 1.0, melody: 1.0, chord: 1.0, texture: 0, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 2, drums: 0.4, bass: 0.7, melody: 0.0, chord: 0.6, texture: 0, drumDropout: false, bassDropout: false, melodyDropout: true  },
  { name: 'verse2',    bars: 4, drums: 1.0, bass: 1.0, melody: 0.6, chord: 0.9, texture: 0, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.0, bass: 1.0, melody: 1.0, chord: 1.0, texture: 0, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'outro',     bars: 2, drums: 0.5, bass: 0.5, melody: 0.0, chord: 0.3, texture: 0, drumDropout: false, bassDropout: false, melodyDropout: true  },
]

const ARRANGEMENT_TOTAL_BARS = ARRANGEMENT.reduce((sum, s) => sum + s.bars, 0)

// ── Sub-genre classification from physics ─────────────────────────────

function classifySubGenre(mode: OrganismMode, energy: number, density: number): HipHopSubGenre {
  const candidates = MODE_SUBGENRES[mode.toString()] ?? ['chill']

  // Use energy + density to pick from candidates:
  // High energy → pick more aggressive sub-genres (later in list)
  // Low energy → pick mellow sub-genres (earlier in list)
  const biasedIndex = Math.min(
    candidates.length - 1,
    Math.floor((energy * 0.6 + density * 0.4) * candidates.length)
  )
  return candidates[biasedIndex]
}

// ── Melody behavior from director context ─────────────────────────────

function computeMelodyBehavior(voiceActive: boolean, flowDepth: number, dropout: boolean): MelodyBehavior {
  if (dropout) return MelodyBehavior.Rest
  return getMelodyBehavior('heat', voiceActive, flowDepth)
}

// ── Root MIDI from pitch class ────────────────────────────────────────

const ROOT_POOL_BY_OCTAVE = [33, 36, 38, 40, 41, 43, 45, 48]  // A1–C3

function rootMidiFromPitchClass(pitchClass: number): number {
  // Find the closest note in bass range with the given pitch class
  // Default octave 2 (C2 = 36)
  const baseMidi = 24 + pitchClass  // octave 1
  // Clamp to bass range
  if (baseMidi < 33) return baseMidi + 12
  if (baseMidi > 48) return baseMidi - 12
  return baseMidi
}

// ══════════════════════════════════════════════════════════════════════
//  MUSICAL DIRECTOR
// ══════════════════════════════════════════════════════════════════════

export class MusicalDirector {
  private state: MusicalState = createDefaultMusicalState()
  private lastArrangementBar = -1
  private lastSubGenre: HipHopSubGenre = 'chill'
  private subGenreLockBars = 0  // don't change sub-genre too often

  // ── Change listeners ────────────────────────────────────────────
  private subGenreChangeListeners: Array<(subGenre: HipHopSubGenre) => void> = []
  private sectionChangeListeners: Array<(section: ArrangementSection, slot: ArrangementSlot) => void> = []
  private mutationListeners: Array<() => void> = []

  // ── Public API ──────────────────────────────────────────────────

  /** Get the current unified musical state (read-only snapshot) */
  getState(): Readonly<MusicalState> {
    return this.state
  }

  /**
   * Main frame update — called by GeneratorOrchestrator every throttled frame.
   * Reads physics + organism state and updates the unified MusicalState.
   * Returns true if a pattern rebuild is needed (sub-genre or section changed).
   */
  update(physics: PhysicsState, organism: OrganismState, currentBar: number): boolean {
    let needsRebuild = false

    this.state.frameIndex = physics.frameIndex
    this.state.timestamp = physics.timestamp
    this.state.mode = physics.mode
    this.state.tempo = physics.pulse > 0 ? physics.pulse : this.state.tempo
    this.state.energy = physics.presence * 0.6 + physics.density * 0.4
    this.state.density = physics.density
    this.state.voiceActive = physics.voiceActive
    this.state.flowDepth = organism.flowDepth

    // ── Sub-genre classification ──────────────────────────────────
    if (this.subGenreLockBars <= 0) {
      const newSubGenre = classifySubGenre(physics.mode, this.state.energy, physics.density)
      if (newSubGenre !== this.lastSubGenre) {
        this.lastSubGenre = newSubGenre
        this.state.subGenre = newSubGenre
        this.state.groove = { ...SUBGENRE_GROOVES[newSubGenre] }
        this.subGenreLockBars = 8  // don't change again for 8 bars
        needsRebuild = true

        // Notify listeners
        for (const cb of this.subGenreChangeListeners) cb(newSubGenre)
      }
    }

    // ── Arrangement section ───────────────────────────────────────
    if (currentBar !== this.lastArrangementBar) {
      this.lastArrangementBar = currentBar
      if (this.subGenreLockBars > 0) this.subGenreLockBars--
      this.state.barsSinceLastMutation++

      // Mutation probability increases over time — prevents staleness
      this.state.mutationProbability = Math.min(0.8,
        this.state.barsSinceLastMutation / 32
      )

      // Find current arrangement section
      const cycleBar = currentBar % ARRANGEMENT_TOTAL_BARS
      let accumulated = 0
      let slot = ARRANGEMENT[0]
      for (const s of ARRANGEMENT) {
        if (cycleBar < accumulated + s.bars) {
          slot = s
          break
        }
        accumulated += s.bars
      }

      if (slot.name !== this.state.section) {
        this.state.section = slot.name
        this.state.sectionBar = 0
        needsRebuild = true

        // Notify section change listeners
        for (const cb of this.sectionChangeListeners) cb(slot.name, slot)

        // Check for pattern mutation on section change
        if (Math.random() < this.state.mutationProbability) {
          this.state.barsSinceLastMutation = 0
          this.state.mutationProbability = 0
          for (const cb of this.mutationListeners) cb()
        }
      } else {
        this.state.sectionBar++
      }

      // Update arrangement-driven dropout flags
      this.state.drums.dropout = slot.drumDropout
      this.state.bass.dropout = slot.bassDropout
      this.state.melody.dropout = slot.melodyDropout

      // Fill request on last bar of each section
      const barsIntoSection = cycleBar - accumulated
      this.state.drums.fillRequested = (barsIntoSection === slot.bars - 1)
    }

    // ── Per-engine directives ─────────────────────────────────────

    // Drums
    this.state.drums.subGenre = this.state.subGenre
    this.state.drums.hatDensityMult = 1.0  // base — reactive layer overrides
    this.state.drums.kickVelocityMult = 1.0

    // Bass
    const bassState = organism.current.toString()
    const bassBehavior = getBassBehaviorFromSubGenre(this.state.subGenre, bassState)
    this.state.bass.behavior = bassBehavior
    this.state.bass.slideEnabled = shouldEnableSlide(bassBehavior)
    this.state.bass.portamentoTime = getPortamentoTime(bassBehavior)
    this.state.bass.filterCutoff = getBassFilterCutoffFromSubGenre(this.state.subGenre, physics.pocket)
    this.state.bass.rootMidi = rootMidiFromPitchClass(this.state.rootPitchClass)

    // Melody
    this.state.melody.behavior = computeMelodyBehavior(
      physics.voiceActive, organism.flowDepth, this.state.melody.dropout
    )

    return needsRebuild
  }

  /**
   * Handle state transition — called when organism state changes
   * (Dormant → Awakening → Breathing → Flow)
   */
  onStateTransition(to: OState, physics: PhysicsState): void {
    // On awakening: pick initial sub-genre and groove
    if (to === OState.Awakening) {
      const subGenre = classifySubGenre(physics.mode, 0.3, 0.2)
      this.state.subGenre = subGenre
      this.lastSubGenre = subGenre
      this.state.groove = { ...SUBGENRE_GROOVES[subGenre] }
      this.subGenreLockBars = 4

      // Reset mutation tracking
      this.state.barsSinceLastMutation = 0
      this.state.mutationProbability = 0
    }

    // On flow: allow sub-genre to adapt more freely
    if (to === OState.Flow) {
      this.subGenreLockBars = Math.min(this.subGenreLockBars, 2)
    }
  }

  /**
   * Chord change notification — updates the unified state so all
   * generators can access chord information.
   */
  setCurrentChord(chord: ChordEvent, rootPitchClass: number): void {
    this.state.rootPitchClass = rootPitchClass
    this.state.currentChordIntervals = chord.intervals
    this.state.currentChordRootOffset = chord.rootOffset
    this.state.currentChordLabel = chord.label
    this.state.melody.chordTones = chord.intervals

    // Update bass root from chord
    this.state.bass.rootMidi = rootMidiFromPitchClass(
      (rootPitchClass + chord.rootOffset) % 12
    )
  }

  /** Set detected scale from ScaleSnapEngine */
  setScale(rootPitchClass: number, intervals: number[]): void {
    this.state.rootPitchClass = rootPitchClass
    this.state.scaleIntervals = intervals
  }

  /** Apply self-listen gain correction */
  setSelfListenCorrection(correction: number): void {
    this.state.selfListenGainCorrection = correction
  }

  /**
   * Apply reactive behavior multipliers — called by the reactive engine
   * or performer state processor.
   */
  applyReactiveMultipliers(multipliers: {
    hatDensityMult?: number
    kickVelocityMult?: number
    bassVolumeMult?: number
    melodyVolumeMult?: number
    melodyPitchOffset?: number
    textureVolumeMult?: number
    chordVolumeMult?: number
  }): void {
    if (multipliers.hatDensityMult !== undefined)
      this.state.drums.hatDensityMult = multipliers.hatDensityMult
    if (multipliers.kickVelocityMult !== undefined)
      this.state.drums.kickVelocityMult = multipliers.kickVelocityMult
    if (multipliers.bassVolumeMult !== undefined)
      this.state.bass.volumeMult = multipliers.bassVolumeMult
    if (multipliers.melodyVolumeMult !== undefined)
      this.state.melody.volumeMult = multipliers.melodyVolumeMult
    if (multipliers.melodyPitchOffset !== undefined)
      this.state.melody.pitchOffsetSemitones = multipliers.melodyPitchOffset
    if (multipliers.textureVolumeMult !== undefined)
      this.state.texture.volumeMult = multipliers.textureVolumeMult
    if (multipliers.chordVolumeMult !== undefined)
      this.state.chords.volumeMult = multipliers.chordVolumeMult
  }

  /** Force a specific sub-genre (from Astutely bridge command) */
  forceSubGenre(subGenre: HipHopSubGenre): void {
    this.state.subGenre = subGenre
    this.lastSubGenre = subGenre
    this.state.groove = { ...SUBGENRE_GROOVES[subGenre] }
    this.subGenreLockBars = 16  // lock for longer when forced
    for (const cb of this.subGenreChangeListeners) cb(subGenre)
  }

  // ── Event subscriptions ─────────────────────────────────────────

  /** Subscribe to sub-genre changes. Returns unsubscribe function. */
  onSubGenreChange(cb: (subGenre: HipHopSubGenre) => void): () => void {
    this.subGenreChangeListeners.push(cb)
    return () => {
      this.subGenreChangeListeners = this.subGenreChangeListeners.filter(c => c !== cb)
    }
  }

  /** Subscribe to arrangement section changes. Returns unsubscribe function. */
  onSectionChange(cb: (section: ArrangementSection, slot: ArrangementSlot) => void): () => void {
    this.sectionChangeListeners.push(cb)
    return () => {
      this.sectionChangeListeners = this.sectionChangeListeners.filter(c => c !== cb)
    }
  }

  /** Subscribe to pattern mutation events. Returns unsubscribe function. */
  onMutation(cb: () => void): () => void {
    this.mutationListeners.push(cb)
    return () => {
      this.mutationListeners = this.mutationListeners.filter(c => c !== cb)
    }
  }

  /** Reset to default state */
  reset(): void {
    this.state = createDefaultMusicalState()
    this.lastArrangementBar = -1
    this.lastSubGenre = 'chill'
    this.subGenreLockBars = 0
  }

  dispose(): void {
    this.subGenreChangeListeners = []
    this.sectionChangeListeners = []
    this.mutationListeners = []
  }
}
