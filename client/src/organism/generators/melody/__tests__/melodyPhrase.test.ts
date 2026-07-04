import { describe, expect, it } from 'vitest'
import {
  isStrongBeat,
  nearestChordDegree,
  resolveDegreeForBeat,
  resolveDegreeComplementing,
  contourOffset,
  cadenceStep,
  phraseNeedsContourFallback,
  constrainPhraseLength,
  PhraseMemory,
  generatePhraseSteps,
} from '../melodyPhrase'

describe('isStrongBeat', () => {
  it('is true on beat 1 and beat 3 downbeats, false elsewhere by default', () => {
    expect(isStrongBeat(0)).toBe(true)   // bar:0 beat:0 sub:0
    expect(isStrongBeat(8)).toBe(true)   // beat:2 sub:0
    expect(isStrongBeat(4)).toBe(false)  // beat:1 sub:0
    expect(isStrongBeat(2)).toBe(false)  // off-16th
  })

  it('handles custom beatsPerBar time signatures', () => {
    expect(isStrongBeat(0, 3)).toBe(true)   // bar:0 beat:0 sub:0
    expect(isStrongBeat(8, 3)).toBe(true)   // bar:0 beat:2 sub:0
    expect(isStrongBeat(4, 3)).toBe(false)  // bar:0 beat:1 sub:0
    expect(isStrongBeat(12, 3)).toBe(true)  // bar:1 beat:0 sub:0
  })
})

describe('nearestChordDegree', () => {
  const chordDegs = [0, 2, 4] // root/3rd/5th scale degrees, 7-note scale
  
  it('snaps to the nearest chord tone', () => {
    expect(nearestChordDegree(3, chordDegs, 7)).toBe(2) // 3 -> nearest chord deg (2 or 4) -> 2
    expect(nearestChordDegree(1, chordDegs, 7)).toBe(0)
  })

  it('implements wrap-around distance across scale boundaries', () => {
    // Scale degree 6 is next to 0 in a 7-note scale (distance 1, not 6)
    // When deg = 6, chordDegs = [0], scaleLen = 7: should snap to 7 (which is degree 0 in next octave)
    expect(nearestChordDegree(6, [0], 7)).toBe(7)
    // When deg = 0, chordDegs = [6], scaleLen = 7: should snap to -1 (degree 6 in previous octave)
    expect(nearestChordDegree(0, [6], 7)).toBe(-1)
  })

  it('handles negative inputs and boundaries', () => {
    expect(nearestChordDegree(-1, [0], 7)).toBe(0)
    expect(nearestChordDegree(-6, [0], 7)).toBe(-7)
  })
})

describe('resolveDegreeForBeat', () => {
  const chordDegs = [0, 2, 4]
  it('snaps to the nearest chord tone on strong beats', () => {
    expect(resolveDegreeForBeat(3, chordDegs, 7, true)).toBe(2)
    expect(resolveDegreeForBeat(1, chordDegs, 7, true)).toBe(0)
  })
  it('leaves the degree untouched on weak beats (passing tones allowed)', () => {
    expect(resolveDegreeForBeat(3, chordDegs, 7, false)).toBe(3)
  })
  it('preserves octave region when snapping', () => {
    expect(resolveDegreeForBeat(10, chordDegs, 7, true)).toBe(9) // 10 = oct1+deg3 -> oct1+deg2 = 9
  })
})

describe('resolveDegreeComplementing', () => {
  // Cmaj7 over a 7-note scale: chord degrees root/3rd/5th/7th = [0, 2, 4, 6].
  // The comp's guide tones are the 3rd (deg 2) and 7th (deg 6), so the melody
  // should LEAN toward the remaining tones: root/5th = [0, 4].
  const chordDegs = [0, 2, 4, 6]
  const preferred = [0, 4]

  it('biases a strong beat toward a COMPLEMENT tone when one is no further away', () => {
    expect(resolveDegreeComplementing(3, chordDegs, preferred, 7, true)).toBe(4)
  })

  it('STILL allows a guide tone when the line lands squarely on it (soft, not banned)', () => {
    expect(resolveDegreeComplementing(2, chordDegs, preferred, 7, true)).toBe(2)
  })

  it('the penalty dial controls how hard it avoids guide tones', () => {
    expect(resolveDegreeComplementing(2, chordDegs, preferred, 7, true, 0)).toBe(2)
    expect(resolveDegreeComplementing(2, chordDegs, preferred, 7, true, 10)).toBe(0)
  })

  it('preserves octave region when redirecting to a complement tone', () => {
    expect(resolveDegreeComplementing(10, chordDegs, preferred, 7, true)).toBe(11) // oct1 + 5th
  })

  it('leaves weak beats untouched so guide tones still pass through', () => {
    expect(resolveDegreeComplementing(2, chordDegs, preferred, 7, false)).toBe(2)
  })

  it('falls back to the full chord-tone set when there is no complement tone', () => {
    expect(resolveDegreeComplementing(3, [2, 6], [], 7, true)).toBe(2)
  })
})

describe('contourOffset', () => {
  it('peaks near 2/3 through the phrase and is ~0 at the ends', () => {
    expect(contourOffset(0, 3)).toBe(0)
    expect(contourOffset(1, 3)).toBe(0)
    expect(contourOffset(0.66, 3)).toBeGreaterThan(contourOffset(0.2, 3))
  })
})

describe('cadenceStep', () => {
  it('lands on the chord root (index 0, chord tone) held long', () => {
    const s = cadenceStep()
    expect(s.index).toBe(0)
    expect(s.isChordTone).toBe(true)
    expect(s.dur16ths).toBeGreaterThanOrEqual(4)
  })
})

describe('phraseNeedsContourFallback', () => {
  it('catches phrases that get stuck on one pitch with only token variation', () => {
    expect(phraseNeedsContourFallback(['C4', 'C4', 'C4', 'C4', 'D4'])).toBe(true)
    expect(phraseNeedsContourFallback(['C4', 'D4', 'C4', 'C4', 'C4', 'C4', 'C4'])).toBe(true)
  })

  it('leaves a real melodic contour alone', () => {
    expect(phraseNeedsContourFallback(['C4', 'D4', 'E4', 'G4', 'E4', 'D4', 'C4'])).toBe(false)
  })
})

describe('constrainPhraseLength', () => {
  it('constrains lengths to align with beatsPerBar', () => {
    // 4 beats per bar = 16 sixteenths per bar
    expect(constrainPhraseLength(30, 4)).toBe(32) // rounds to 2 bars (32 steps)
    expect(constrainPhraseLength(5, 4)).toBe(16)  // minimum 1 bar (16 steps)
    
    // 3 beats per bar = 12 sixteenths per bar
    expect(constrainPhraseLength(20, 3)).toBe(24) // rounds to 2 bars (24 steps)
    expect(constrainPhraseLength(2, 3)).toBe(12)  // minimum 1 bar (12 steps)
  })
})

describe('PhraseMemory', () => {
  it('stores, recalls, and varies phrases to form ABA/AABB patterns', () => {
    const memory = new PhraseMemory()
    const phraseA = { id: 'A', degrees: [0, 1, 2], steps: [] }
    const phraseB = { id: 'B', degrees: [3, 4, 5], steps: [] }
    
    memory.remember(phraseA)
    expect(memory.getLast()?.id).toBe('A')
    
    memory.remember(phraseB)
    expect(memory.getLast()?.id).toBe('B')
    
    // ABA pattern checks:
    expect(memory.getVariation(0, 'ABA')?.id).toBe('A')
    expect(memory.getVariation(1, 'ABA')?.id).toBe('B')
    expect(memory.getVariation(2, 'ABA')?.id).toBe('A')
    
    // AABB pattern checks:
    expect(memory.getVariation(0, 'AABB')?.id).toBe('A')
    expect(memory.getVariation(1, 'AABB')?.id).toBe('A')
    expect(memory.getVariation(2, 'AABB')?.id).toBe('B')
    expect(memory.getVariation(3, 'AABB')?.id).toBe('B')
  })
})

describe('generatePhraseSteps', () => {
  it('generates a new phrase structure aligned to bar boundaries', () => {
    const phrase = generatePhraseSteps(30, 4)
    expect(phrase.steps.reduce((sum, s) => sum + s.dur16ths, 0)).toBe(32)
  })
  
  it('uses memory to recall and vary structures', () => {
    const memory = new PhraseMemory()
    const phrase1 = generatePhraseSteps(32, 4, memory, 'ABA')
    expect(memory.getAll()).toHaveLength(1)
    
    // Index 1 (second call) in ABA pattern generates B (new phrase because memory only has A)
    const phrase2 = generatePhraseSteps(32, 4, memory, 'ABA')
    expect(memory.getAll()).toHaveLength(2)
    expect(phrase2.id).not.toBe(phrase1.id)
    
    // Index 2 (third call) in ABA pattern recalls A
    const phrase3 = generatePhraseSteps(32, 4, memory, 'ABA')
    expect(phrase3.id).toBe(phrase1.id)
  })
})
