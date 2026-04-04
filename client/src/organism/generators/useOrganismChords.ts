// Hook: useOrganismChords
//
// Subscribes to the Organism's ChordGenerator via the bridge event system.
// Any component can use this to display or react to the current chord progression.

import { useState, useEffect } from 'react'

export interface OrganismChordState {
  /** Current chord's Roman numeral label (e.g. "IV", "vi", "bVIIM") */
  currentLabel: string | null
  /** Current chord's semitone intervals from chord root */
  currentIntervals: number[]
  /** Current chord root offset from tonic (semitones) */
  currentRootOffset: number
  /** Tonic pitch class (0=C, 1=C#, ... 11=B) */
  rootPitchClass: number
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * Subscribe to real-time chord changes from the Organism's ChordGenerator.
 * Returns the current chord label, intervals, and key information.
 */
export function useOrganismChords(): OrganismChordState {
  const [state, setState] = useState<OrganismChordState>({
    currentLabel: null,
    currentIntervals: [],
    currentRootOffset: 0,
    rootPitchClass: 0,
  })

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as Record<string, unknown>
      setState({
        currentLabel:       d.label as string,
        currentIntervals:   d.intervals as number[],
        currentRootOffset:  d.rootOffset as number,
        rootPitchClass:     d.rootPitchClass as number,
      })
    }

    window.addEventListener('organism:chord-change', handler)
    return () => window.removeEventListener('organism:chord-change', handler)
  }, [])

  return state
}

/**
 * Get note name from pitch class (0-11).
 */
export function pitchClassName(pc: number): string {
  return NOTE_NAMES[((pc % 12) + 12) % 12]
}
