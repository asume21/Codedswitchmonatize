import type { ArrangementSection } from './MusicalState'

export interface ProducerArrangementSlot {
  name: ArrangementSection
  bars: number
  drums: number
  bass: number
  melody: number
  chord: number
  texture: number
  energy: number
  drumDropout: boolean
  bassDropout: boolean
  melodyDropout: boolean
}

// One producer-grade 64-bar beat form shared by the director and the audio
// multipliers. Keeping this in one place prevents UI state and audible state
// from drifting apart.
//
// At ~90 BPM this cycle runs ~2:50 before any section repeats; at 120 BPM
// ~2:08. The second pass through verse/build/drop reuses the same section
// names so per-section behavior (melody.onSectionChange, chord technique,
// drop FX) still fires — but state.drums.variantIndex keeps incrementing,
// so the patterns themselves naturally vary between iterations.
export const PRODUCER_ARRANGEMENT: ProducerArrangementSlot[] = [
  { name: 'intro',     bars: 4,  drums: 0.45, bass: 0.58, melody: 0.65, chord: 0.82, texture: 0, energy: 0.35, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 8,  drums: 0.78, bass: 0.94, melody: 0.72, chord: 0.72, texture: 0, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'build',     bars: 4,  drums: 0.90, bass: 0.98, melody: 0.85, chord: 0.80, texture: 0, energy: 0.82, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 8,  drums: 1.00, bass: 1.00, melody: 0.95, chord: 0.80, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 4,  drums: 0.52, bass: 0.68, melody: 0.60, chord: 0.86, texture: 0, energy: 0.42, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4,  drums: 1.00, bass: 1.00, melody: 1.00, chord: 0.88, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  // Second pass — variantIndex has advanced so patterns differ from the first.
  { name: 'verse',     bars: 8,  drums: 0.80, bass: 0.94, melody: 0.78, chord: 0.74, texture: 0, energy: 0.65, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'build',     bars: 4,  drums: 0.92, bass: 0.98, melody: 0.88, chord: 0.82, texture: 0, energy: 0.85, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 8,  drums: 1.00, bass: 1.00, melody: 1.00, chord: 0.82, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  // Outro fades the energy down so the loop wrap into intro feels intentional.
  { name: 'outro',     bars: 12, drums: 0.40, bass: 0.55, melody: 0.55, chord: 0.78, texture: 0, energy: 0.30, drumDropout: false, bassDropout: false, melodyDropout: false },
]

export const PRODUCER_ARRANGEMENT_TOTAL_BARS = PRODUCER_ARRANGEMENT.reduce(
  (sum, section) => sum + section.bars,
  0,
)

export function getProducerArrangementSlot(barNumber: number): {
  slot: ProducerArrangementSlot
  cycleBar: number
  sectionBar: number
} {
  const safeBar = Math.max(0, Math.floor(Number.isFinite(barNumber) ? barNumber : 0))
  const cycleBar = safeBar % PRODUCER_ARRANGEMENT_TOTAL_BARS
  let accumulated = 0
  for (const slot of PRODUCER_ARRANGEMENT) {
    if (cycleBar < accumulated + slot.bars) {
      return { slot, cycleBar, sectionBar: cycleBar - accumulated }
    }
    accumulated += slot.bars
  }
  return { slot: PRODUCER_ARRANGEMENT[0], cycleBar: 0, sectionBar: 0 }
}
