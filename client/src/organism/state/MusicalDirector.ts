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
  getProducerArrangementTotalBars,
  type ProducerArrangementSlot,
  getProducerArrangementSlot,
} from './ProducerArrangement'
import {
  getBassBehaviorFromSubGenre,
  shouldEnableSlide,
  getPortamentoTime,
  getBassFilterCutoffFromSubGenre,
} from '../generators/patterns/BassPatternLibrary'
import { getMelodyBehavior } from '../generators/patterns/MelodyPatternLibrary'
import type { ChordEvent } from '../generators/patterns/ChordProgressionBank'

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
  private isGrooveLocked = false // Story Mode: lock the rhythm once in Flow

  // ── Change listeners ────────────────────────────────────────────
  private subGenreChangeListeners: Array<(subGenre: HipHopSubGenre) => void> = []
  private sectionChangeListeners: Array<(section: ArrangementSection, slot: ProducerArrangementSlot) => void> = []
  private mutationListeners: Array<() => void> = []

  // ── Public API ──────────────────────────────────────────────────

  /** Set Story Mode (Groove Lock) status */
  setGrooveLocked(locked: boolean): void {
    this.isGrooveLocked = locked
  }

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
    this.state.arrangementTotalBars = getProducerArrangementTotalBars()

    // ── Sub-genre classification ──────────────────────────────────
    // STORY MODE: If groove is locked or we're in Flow state, freeze the
    // sub-genre entirely so the core rhythm doesn't shift mid-performance.
    // Audit 2026-04-30 fix: previous condition `&& subGenre !== 'chill'`
    // let chill drift away from chill mid-lock — clearly not the intent.
    const isFlow = organism.current === OState.Flow
    const shouldSkipGenreShift = this.isGrooveLocked || isFlow

    if (this.subGenreLockBars <= 0 && !shouldSkipGenreShift) {
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

      // Keep Flow performance stable. Random drum mutation during playback can
      // make the beat feel like it forgets its own pocket.
      if (isFlow || this.isGrooveLocked) {
        this.state.mutationProbability = 0
      } else {
        this.state.mutationProbability = Math.min(0.6,
          this.state.barsSinceLastMutation / 48
        )
      }

      const { slot, sectionBar } = getProducerArrangementSlot(currentBar)

      if (slot.name !== this.state.section) {
        this.state.section = slot.name
        this.state.sectionBar = 0
        needsRebuild = true

        // Advance section-local state before listeners run so callbacks rebuild
        // from the completed Conductor decision, not the previous section.
        this.state.drums.variantIndex = (this.state.drums.variantIndex + 1)
        this.state.drums.dropout = slot.drumDropout
        this.state.bass.dropout = slot.bassDropout
        this.state.melody.dropout = slot.melodyDropout
        this.state.drums.fillRequested = (sectionBar === slot.bars - 1)

        // Notify section change listeners after state is complete.
        for (const cb of this.sectionChangeListeners) cb(slot.name, slot)

        // Check for pattern mutation on section change
        if (!isFlow && !this.isGrooveLocked && Math.random() < this.state.mutationProbability) {
          this.state.barsSinceLastMutation = 0
          this.state.mutationProbability = 0
          for (const cb of this.mutationListeners) cb()
        }
      } else {
        this.state.sectionBar++

        // Section masks are intentional song structure. Groove lock freezes
        // the pattern pocket, but it should not flatten the arrangement into a
        // loop.
        this.state.drums.dropout = slot.drumDropout
        this.state.bass.dropout = slot.bassDropout
        this.state.melody.dropout = slot.melodyDropout

        // Fill request on last bar of each section
        this.state.drums.fillRequested = (sectionBar === slot.bars - 1)
      }
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

  // applyReactiveMultipliers was deleted (Part 2): it wrote state.*.volumeMult
  // which nothing read — MixEngine owns the mix now. Per-frame reactive volume
  // was the churn Part 2 removed. Had zero callers.

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
  onSectionChange(cb: (section: ArrangementSection, slot: ProducerArrangementSlot) => void): () => void {
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
