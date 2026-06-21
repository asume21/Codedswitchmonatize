import { describe, expect, it } from 'vitest'
import { Conductor } from '../Conductor'
import type { ArrangementPlan } from '@shared/arrangement'

describe('Conductor', () => {
  it('publishes a structured score frame for the band', () => {
    const conductor = new Conductor({ key: 'C', subGenre: 'trap' })
    const frame = conductor.getScoreFrame()

    expect(frame).toMatchObject({
      bar: 0,
      bpm: 90,
      section: 'intro',
      key: 'C',
      rootPitchClass: 0,
      scale: 'minor',
      subGenre: 'trap',
      mood: 'focused',
      chordIndex: 0,
      energy: 0,
      density: 0,
      groove: 'straight',
    })
    expect(frame.currentChord.symbol).toBe('Cm')
    expect(frame.nextChord.symbol).toBe('Ab')
    expect(frame.progression.map(chord => chord.symbol)).toEqual(['Cm', 'Ab', 'Bb', 'Cm'])
    expect(frame.scaleIntervals).toEqual([0, 2, 3, 5, 7, 8, 10])
    expect(frame.aceStep.promptTags).toEqual(expect.arrayContaining([
      'trap',
      'focused',
      '90 bpm',
      'instrumental',
      'professional mix',
    ]))
  })

  it('updates score context without corrupting harmonic state', () => {
    const conductor = new Conductor({ key: 'D', subGenre: 'boom-bap' })

    conductor.updateScoreContext({
      bar: 12.8,
      bpm: 141.2,
      section: 'verse',
      energy: 1.4,
      density: -0.2,
      groove: 'boom-bap',
      mood: 'melancholic',
    })

    const frame = conductor.getScoreFrame()
    expect(frame.bar).toBe(12)
    expect(frame.bpm).toBe(141)
    expect(frame.section).toBe('verse')
    expect(frame.energy).toBe(1)
    expect(frame.density).toBe(0)
    expect(frame.groove).toBe('boom-bap')
    expect(frame.mood).toBe('melancholic')
    expect(frame.key).toBe('D')
    expect(frame.currentChord.symbol).toBe('Dm7')
    expect(frame.aceStep).toMatchObject({
      genre: 'boom-bap',
      mood: 'melancholic',
      bpm: 141,
      section: 'verse',
    })
  })

  it('moves current and next chord through the same score frame', () => {
    const conductor = new Conductor({ key: 'C', subGenre: 'trap' })

    conductor.advanceChord()
    const frame = conductor.getScoreFrame()

    expect(frame.chordIndex).toBe(1)
    expect(frame.currentChord.symbol).toBe('Ab')
    expect(frame.nextChord.symbol).toBe('Bb')
  })

  describe('Phase 4 — bank picker + key tracking', () => {
    it('bumps progressionVersion when picking a new bank progression', () => {
      const conductor = new Conductor({ key: 'C', subGenre: 'trap' })
      conductor.setMode('heat')
      const before = conductor.getProgressionVersion()
      conductor.pickNewProgression()
      expect(conductor.getProgressionVersion()).toBeGreaterThan(before)
    })

    it('does NOT bump progressionVersion on advanceChord (only on replacement)', () => {
      const conductor = new Conductor({ key: 'C', subGenre: 'trap' })
      const before = conductor.getProgressionVersion()
      conductor.advanceChord()
      conductor.advanceChord()
      expect(conductor.getProgressionVersion()).toBe(before)
    })

    it('honours progression lock — pickNewProgression is a no-op when locked', () => {
      const conductor = new Conductor({ key: 'C', subGenre: 'trap' })
      conductor.setMode('heat')
      conductor.pickNewProgression()
      const locked = conductor.getProgressionVersion()
      conductor.lockProgression()
      conductor.pickNewProgression()
      expect(conductor.getProgressionVersion()).toBe(locked)
      conductor.unlockProgression()
      conductor.pickNewProgression()
      expect(conductor.getProgressionVersion()).toBeGreaterThan(locked)
    })

    it('setKeyByPitchClass transposes the active progression', () => {
      const conductor = new Conductor({ key: 'C', subGenre: 'trap' })
      const cRoot = conductor.currentChord().rootMidi
      conductor.setKeyByPitchClass(5)  // F
      const fRoot = conductor.currentChord().rootMidi
      expect(conductor.getKey()).toBe('F')
      expect(((fRoot - cRoot) % 12 + 12) % 12).toBe(5)
    })

    it('setKeyByPitchClass re-voices a bank progression in the new key', () => {
      const conductor = new Conductor({ key: 'C', subGenre: 'trap' })
      conductor.setMode('smoke')
      conductor.pickNewProgression()  // lastBankSignature is set
      const beforeMidi = conductor.currentChord().rootMidi
      conductor.setKeyByPitchClass(7)  // G
      const afterMidi = conductor.currentChord().rootMidi
      expect(((afterMidi - beforeMidi) % 12 + 12) % 12).toBe(7)
    })

    it('fires onChordChange listeners on advance and on pickNewProgression', () => {
      const conductor = new Conductor({ key: 'C', subGenre: 'trap' })
      conductor.setMode('heat')
      let calls = 0
      conductor.onChordChange(() => { calls++ })
      conductor.advanceChord()
      conductor.pickNewProgression()
      expect(calls).toBe(2)
    })
  })

  describe('Phase 5 — ArrangementPlan consumer', () => {
    function makePlan(overrides: Partial<ArrangementPlan> = {}): ArrangementPlan {
      return {
        id: 'test-plan',
        key: 'A',
        bpm: 140,
        subGenre: 'trap',
        mood: 'dark',
        acePrompt: 'trap, dark, 140 bpm',
        sections: [
          { name: 'intro', bars: 4, progression: ['i', 'VI', 'VII', 'i'], energy: 0.3, density: 0.2 },
          { name: 'verse', bars: 8, progression: ['i', 'iv', 'V', 'i'], energy: 0.6, density: 0.5 },
          { name: 'drop',  bars: 8, progression: ['i', 'bVI', 'bVII', 'i'], energy: 0.9, density: 0.85 },
        ],
        ...overrides,
      }
    }

    it('loadPlan switches to plan mode and loads section 0', () => {
      const conductor = new Conductor({ key: 'C', subGenre: 'boom-bap' })
      const plan = makePlan()
      conductor.loadPlan(plan)
      expect(conductor.getActivePlan()).toBe(plan)
      expect(conductor.getActiveSectionIndex()).toBe(0)
      expect(conductor.getKey()).toBe('A')
      expect(conductor.getSubGenre()).toBe('trap')
    })

    it('loadPlan applies the first section progression in the plan key', () => {
      const conductor = new Conductor()
      conductor.loadPlan(makePlan())
      // Plan key = A (PC 9), section 0 = i (minor tonic) → A3 minor.
      // chordFromRoman voices at octave 4 (MIDI 60 baseline), so A4 minor.
      const chord = conductor.currentChord()
      // A pitch class is 9; rootMidi = 60 + 9 = 69.
      expect(chord.rootMidi % 12).toBe(9)
      expect(chord.intervals).toEqual([0, 3, 7])  // minor triad from lowercase i
    })

    it('loadSection swaps progression and bumps progressionVersion', () => {
      const conductor = new Conductor()
      conductor.loadPlan(makePlan())
      const v0 = conductor.getProgressionVersion()
      conductor.loadSection(1)
      expect(conductor.getActiveSectionIndex()).toBe(1)
      expect(conductor.getProgressionVersion()).toBeGreaterThan(v0)
    })

    it('loadSection is a no-op when no plan is loaded', () => {
      const conductor = new Conductor()
      const v0 = conductor.getProgressionVersion()
      conductor.loadSection(0)
      expect(conductor.getProgressionVersion()).toBe(v0)
      expect(conductor.getActivePlan()).toBeNull()
    })

    it('loadSection rejects out-of-range indices', () => {
      const conductor = new Conductor()
      conductor.loadPlan(makePlan())
      const v0 = conductor.getProgressionVersion()
      conductor.loadSection(99)
      expect(conductor.getActiveSectionIndex()).toBe(0)
      expect(conductor.getProgressionVersion()).toBe(v0)
    })

    it('clearPlan returns to jam mode but keeps last progression playing', () => {
      const conductor = new Conductor()
      conductor.loadPlan(makePlan())
      const beforeChord = conductor.currentChord()
      conductor.clearPlan()
      expect(conductor.getActivePlan()).toBeNull()
      // Audio shouldn't glitch — same progression keeps sounding until the
      // next pickNewProgression() (which the Orchestrator's jam-mode branch
      // would now fire on section change).
      expect(conductor.currentChord()).toEqual(beforeChord)
    })

    it('onChordChange fires on loadPlan and loadSection', () => {
      const conductor = new Conductor()
      let calls = 0
      conductor.onChordChange(() => { calls++ })
      conductor.loadPlan(makePlan())   // 1
      conductor.loadSection(1)          // 2
      conductor.loadSection(2)          // 3
      expect(calls).toBe(3)
    })
  })

  it('comps lush genres with a wider (spread) voicing than boom-bap (V4)', () => {
    const span = (v: { inner: number[] }) => Math.max(...v.inner) - Math.min(...v.inner)
    const lofi = new Conductor({ key: 'C', subGenre: 'lo-fi' })       // → spread
    const boomBap = new Conductor({ key: 'C', subGenre: 'boom-bap' }) // → close
    expect(span(lofi.currentVoicing())).toBeGreaterThan(span(boomBap.currentVoicing()))
  })

  it('keeps the spread voicing through advanceChord (V4)', () => {
    const lofi = new Conductor({ key: 'C', subGenre: 'lo-fi' })
    const closeSpanBoom = (() => {
      const b = new Conductor({ key: 'C', subGenre: 'boom-bap' })
      b.advanceChord()
      return Math.max(...b.currentVoicing().inner) - Math.min(...b.currentVoicing().inner)
    })()
    lofi.advanceChord()
    const v = lofi.currentVoicing()
    expect(Math.max(...v.inner) - Math.min(...v.inner)).toBeGreaterThan(closeSpanBoom)
  })

  it('voices the current chord and voice-leads on advanceChord (V1)', () => {
    const conductor = new Conductor({ key: 'C', subGenre: 'trap' })
    const pcOf = (m: number) => ((m % 12) + 12) % 12

    const chord0 = conductor.currentChord()
    const v0 = conductor.currentVoicing()
    expect(pcOf(v0.bass)).toBe(pcOf(chord0.rootMidi))  // bass tracks the root
    expect(v0.inner.length).toBeGreaterThan(0)

    const chord0PCs = new Set(chord0.intervals.map((i) => pcOf(chord0.rootMidi + i)))
    conductor.advanceChord()
    const chord1 = conductor.currentChord()
    const v1 = conductor.currentVoicing()
    expect(pcOf(v1.bass)).toBe(pcOf(chord1.rootMidi))

    // Common tones between the two chords are HELD at the same MIDI note.
    const chord1PCs = new Set(chord1.intervals.map((i) => pcOf(chord1.rootMidi + i)))
    for (const p of [...chord0PCs].filter((x) => chord1PCs.has(x))) {
      const held = v0.inner.find((n) => pcOf(n) === p)
      if (held !== undefined) expect(v1.inner).toContain(held)
    }
  })
})
