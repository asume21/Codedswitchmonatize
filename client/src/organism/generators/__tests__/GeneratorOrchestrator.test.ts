/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import type { OrganismState, TransitionEvent, OrganismStateCallback, TransitionEventCallback } from '../../state/types'
import type { PhysicsStateCallback } from '../../physics/types'
import { createToneMock, mockToneStart, mockTransportStart, mockTransportStop } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { GeneratorOrchestrator } from '../GeneratorOrchestrator'
import { useStudioStore } from '../../../stores/useStudioStore'

// ── Mock PhysicsEngine & StateMachine ───────────────────────────────

function createMockPhysicsEngine() {
  const callbacks = new Set<PhysicsStateCallback>()
  return {
    subscribe: vi.fn((cb: PhysicsStateCallback) => {
      callbacks.add(cb)
      return () => callbacks.delete(cb)
    }),
    registerGeneratorLevel: vi.fn(),
    _emit(state: PhysicsState) {
      callbacks.forEach(cb => cb(state))
    },
  }
}

function createMockStateMachine() {
  const stateCallbacks = new Set<OrganismStateCallback>()
  const transitionCallbacks = new Set<TransitionEventCallback>()
  return {
    subscribe: vi.fn((cb: OrganismStateCallback) => {
      stateCallbacks.add(cb)
      return () => stateCallbacks.delete(cb)
    }),
    onTransition: vi.fn((cb: TransitionEventCallback) => {
      transitionCallbacks.add(cb)
      return () => transitionCallbacks.delete(cb)
    }),
    _emitState(state: OrganismState) {
      stateCallbacks.forEach(cb => cb(state))
    },
    _emitTransition(event: TransitionEvent) {
      transitionCallbacks.forEach(cb => cb(event))
    },
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0, presence: 0, density: 0.3,
    mode: OrganismMode.Smoke, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: 1000, frameIndex: 43, voiceActive: false,
    ...overrides,
  }
}

function makeOrganism(overrides: Partial<OrganismState> = {}): OrganismState {
  return {
    current: OState.Breathing, previous: OState.Awakening,
    framesInState: 100, msInState: 2300, barsInState: 2,
    awakeningProgress: 1, breathingWarmth: 0.6, flowDepth: 0,
    syllabicDensity: 1.5, cadenceLockBars: 0, cadenceLockAchieved: false,
    silenceDurationMs: 0, lastTransitionPhysics: null,
    timestamp: 1000, frameIndex: 43,
    ...overrides,
  }
}

describe('GeneratorOrchestrator', () => {
  let orchestrator: GeneratorOrchestrator
  let mockPhysics: ReturnType<typeof createMockPhysicsEngine>
  let mockStateMachine: ReturnType<typeof createMockStateMachine>

  beforeEach(() => {
    vi.clearAllMocks()
    orchestrator = new GeneratorOrchestrator()
    mockPhysics = createMockPhysicsEngine()
    mockStateMachine = createMockStateMachine()
  })

  it('wire() connects physics and state machine without errors', () => {
    expect(() => {
      orchestrator.wire(
        mockPhysics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
        mockStateMachine as unknown as import('../../state/StateMachine').StateMachine,
      )
    }).not.toThrow()

    expect(mockPhysics.subscribe).toHaveBeenCalledOnce()
    expect(mockStateMachine.subscribe).toHaveBeenCalledOnce()
    expect(mockStateMachine.onTransition).toHaveBeenCalledOnce()
  })

  it('start() resolves and sets Tone.js Transport running', async () => {
    await orchestrator.start()

    expect(mockToneStart).toHaveBeenCalled()
    expect(mockTransportStart).toHaveBeenCalled()
  })

  it('pushes kick anchors from the drum pattern to the bass on start', async () => {
    const spy = vi.spyOn((orchestrator as any).bass, 'setKickAnchors')
    await orchestrator.start(90)
    expect(spy).toHaveBeenCalled()
    const slots = spy.mock.calls[spy.mock.calls.length - 1][0] as number[]
    expect(slots.length).toBeGreaterThan(0)
    expect(slots).toContain(0)   // every sub-genre pattern kicks on beat 1
  })

  it('pushes the drum groove pocket to bass, chord, and melody on start', async () => {
    const pocket = Array.from({ length: 16 }, (_, i) => i / 1000)
    vi.spyOn((orchestrator as any).drum, 'getGroovePocket').mockReturnValue(pocket)
    const bassSpy = vi.spyOn((orchestrator as any).bass, 'setGroovePocket')
    const chordSpy = vi.spyOn((orchestrator as any).chord, 'setGroovePocket')
    const melodySpy = vi.spyOn((orchestrator as any).melody, 'setGroovePocket')

    await orchestrator.start(90)

    expect(bassSpy).toHaveBeenCalledWith(pocket)
    expect(chordSpy).toHaveBeenCalledWith(pocket)
    expect(melodySpy).toHaveBeenCalledWith(pocket)
  })

  it('freeplay drum patterns keep the genre skeleton (loud snares present)', async () => {
    const spy = vi.spyOn((orchestrator as any).drum, 'loadGeneratedPattern')
    await orchestrator.start(90)   // startup sub-genre is boom-bap (commit 9d9eb4fc)
    const hits = spy.mock.calls[spy.mock.calls.length - 1][0] as Array<{ instrument: string; time: string; velocity: number }>
    const snareSlots = hits
      .filter(h => h.instrument === 'snare' && h.velocity > 0.4 && h.time.startsWith('0:'))
      .map(h => { const [, beat, sub] = h.time.split(':').map(parseFloat); return beat * 4 + Math.floor(sub) })
    // boom-bap skeleton snares (2 and 4). If the harness starts on another
    // sub-genre, assert that genre's SKELETONS entry instead — don't delete.
    expect(snareSlots).toContain(4)
    expect(snareSlots).toContain(12)
  })

  it('start(bpm) preserves the explicit preset tempo', async () => {
    const tone = await import('tone')

    await orchestrator.start(140)

    expect(tone.getTransport().bpm.value).toBe(140)
    expect(useStudioStore.getState().bpm).toBe(140)
  })

  it('all 5 generators receive processFrame calls while running', async () => {
    orchestrator.wire(
      mockPhysics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
      mockStateMachine as unknown as import('../../state/StateMachine').StateMachine,
    )
    // Frames only drive generators while running — a wired-but-stopped
    // orchestrator ignores them (see the stop() suite at the end of this file).
    await orchestrator.start()

    // Emit organism state first so onFrame has it
    const organism = makeOrganism()
    mockStateMachine._emitState(organism)

    // Then emit physics — this triggers onFrame
    const physics = makePhysics()
    mockPhysics._emit(physics)

    // registerGeneratorLevel should be called 5 times (one per generator)
    expect(mockPhysics.registerGeneratorLevel).toHaveBeenCalledTimes(5)
  })

  it('getOutput() returns GeneratorOutput with all 5 reports', () => {
    orchestrator.wire(
      mockPhysics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
      mockStateMachine as unknown as import('../../state/StateMachine').StateMachine,
    )

    const organism = makeOrganism()
    mockStateMachine._emitState(organism)
    mockPhysics._emit(makePhysics())

    const output = orchestrator.getOutput()
    expect(output).not.toBeNull()
    expect(output!.drum).toBeDefined()
    expect(output!.bass).toBeDefined()
    expect(output!.melody).toBeDefined()
    expect(output!.texture).toBeDefined()
    expect(output!.chord).toBeDefined()
    expect(output!.drum.name).toBe('drum')
    expect(output!.bass.name).toBe('bass')
    expect(output!.melody.name).toBe('melody')
    expect(output!.texture.name).toBe('texture')
    expect(output!.chord.name).toBe('chord')
  })

  it('reset() zeros all generators and clears lastPhysics', async () => {
    await orchestrator.start()
    orchestrator.reset()

    // reset() calls stop(), but stop() must NOT stop Tone.Transport 
    // to preserve studio playback (piano roll, etc.)
    expect(mockTransportStop).not.toHaveBeenCalled()

    // After reset, getOutput returns null (no lastPhysics)
    expect(orchestrator.getOutput()).toBeNull()
  })

  it('transition event to FLOW → all generators receive onStateTransition(FLOW)', async () => {
    orchestrator.wire(
      mockPhysics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
      mockStateMachine as unknown as import('../../state/StateMachine').StateMachine,
    )
    await orchestrator.start()

    // Need lastPhysics to be set
    const organism = makeOrganism()
    mockStateMachine._emitState(organism)
    const physics = makePhysics()
    mockPhysics._emit(physics)

    // Emit transition event
    const event: TransitionEvent = {
      from: OState.Breathing,
      to: OState.Flow,
      transition: 'BREATHING_TO_FLOW' as import('../../state/types').OTransition,
      timestamp: 2000,
      physicsSnapshot: physics,
    }
    mockStateMachine._emitTransition(event)

    // Should not throw — all generators received the transition
    expect(mockPhysics.registerGeneratorLevel).toHaveBeenCalled()
  })

  it('density > 0.85 triggers thinning on texture generator', async () => {
    orchestrator.wire(
      mockPhysics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
      mockStateMachine as unknown as import('../../state/StateMachine').StateMachine,
    )
    await orchestrator.start()

    const organism = makeOrganism({ current: OState.Flow, flowDepth: 1 })
    mockStateMachine._emitState(organism)

    // Emit physics with high density
    const physics = makePhysics({ density: 0.9 })
    mockPhysics._emit(physics)

    // No error means thinning was set successfully
    expect(mockPhysics.registerGeneratorLevel).toHaveBeenCalled()
  })

  // REQUIREMENT CHANGED 2026-08-16. This used to assert the pad stayed audible
  // through the intro, because the old INTRO_STACK opened with THREE parts
  // (chords + melody + pad). The user asked for the opposite: "i want it to only
  // be one generator and then within maybe 10-15 sec get all five going". So the
  // contract is now "exactly one role sounds on the first bar" — which for four
  // of the five possible leads means the pad is silent there, deliberately.
  it('progressive intro opens with exactly ONE generator', async () => {
    const tone = await import('tone')
    tone.getTransport().position = '0:0:0'
    const spies = {
      drum:    vi.spyOn((orchestrator as any).drum,    'applyArrangementMultiplier'),
      bass:    vi.spyOn((orchestrator as any).bass,    'applyArrangementMultiplier'),
      chord:   vi.spyOn((orchestrator as any).chord,   'applyArrangementMultiplier'),
      melody:  vi.spyOn((orchestrator as any).melody,  'applyArrangementMultiplier'),
      texture: vi.spyOn((orchestrator as any).texture, 'applyArrangementMultiplier'),
    }

    ;(orchestrator as any).running = true
    ;(orchestrator as any).applyArrangement()

    const audible = Object.entries(spies)
      .filter(([, s]) => s.mock.calls.length > 0 && s.mock.calls[0][0] > 0)
      .map(([role]) => role)

    expect(audible).toHaveLength(1)
  })

  it('disabling progressive intro restores texture with the rest of the band (jam mode)', () => {
    // Only meaningful in JAM mode. With the arrangement running (now the default),
    // the section slots own the part multipliers — snapping them all back to 1.0
    // here would fight the arrangement, and the next bar tick would overwrite it
    // anyway. The restore is deliberately guarded on `!arrangementEnabled`.
    orchestrator.setArrangementEnabled(false)
    const textureSpy = vi.spyOn((orchestrator as any).texture, 'applyArrangementMultiplier')

    orchestrator.setProgressiveIntroEnabled(false)

    expect(textureSpy).toHaveBeenCalledWith(1)
  })

  it('leaving song mode restores the drum PATTERN, not just its volume', () => {
    // Gain and density are two different controls. A sparse section lowers the
    // gain AND thins the pattern (below 0.45 the filter keeps only kick+snare,
    // stripping every hat). setArrangementEnabled(false) restored the gain and
    // left the density stranded, so jam mode inherited a kick+snare skeleton
    // forever — captured live as arr:1 with sectionDensity:0.30, 96 raw hits
    // reaching the Part as 31 events.
    orchestrator.setArrangementEnabled(true)
    const gainSpy = vi.spyOn((orchestrator as any).drum, 'applyArrangementMultiplier')
    const densitySpy = vi.spyOn((orchestrator as any).drum, 'setSectionDensity')

    // A breakdown/intro section thinned the kit on its way past.
    ;(orchestrator as any).drum.setSectionDensity(0.3)
    densitySpy.mockClear()

    orchestrator.setArrangementEnabled(false)

    expect(gainSpy).toHaveBeenCalledWith(1.0)
    expect(densitySpy).toHaveBeenCalledWith(1.0)
  })

  it('beat mode holds the pocket through a ducking section but still moves the melodic parts', async () => {
    const tone = await import('tone')
    tone.getTransport().position = '0:0:0'   // intro — the sparsest slot
    const drumGain = vi.spyOn((orchestrator as any).drum, 'applyArrangementMultiplier')
    const drumDensity = vi.spyOn((orchestrator as any).drum, 'setSectionDensity')
    const bassGain = vi.spyOn((orchestrator as any).bass, 'applyArrangementMultiplier')
    const chordGain = vi.spyOn((orchestrator as any).chord, 'applyArrangementMultiplier')

    ;(orchestrator as any).running = true
    orchestrator.setArrangementEnabled(true)
    orchestrator.setBeatModeEnabled(true)
    drumGain.mockClear(); drumDensity.mockClear(); bassGain.mockClear(); chordGain.mockClear()
    ;(orchestrator as any).applyArrangement()

    // The floor does not move: full gain AND full pattern (no hat stripping).
    expect(drumGain).toHaveBeenLastCalledWith(1)
    expect(drumDensity).toHaveBeenLastCalledWith(1)
    expect(bassGain).toHaveBeenLastCalledWith(1)
    // ...but the section is still expressed — chords follow the slot, so a
    // drop still feels like a drop. Beat Mode is "announce and hold", not "flat".
    expect(chordGain).toHaveBeenCalled()
    expect(chordGain.mock.calls.at(-1)?.[0]).toBeLessThanOrEqual(1)
  })

  it('beat mode off leaves the producer arc exactly as it was', async () => {
    const tone = await import('tone')
    tone.getTransport().position = '0:0:0'
    const drumDensity = vi.spyOn((orchestrator as any).drum, 'setSectionDensity')

    ;(orchestrator as any).running = true
    orchestrator.setArrangementEnabled(true)
    drumDensity.mockClear()
    ;(orchestrator as any).applyArrangement()

    // Default is off — the intro slot still thins the kit as it always did.
    expect(orchestrator.isBeatModeEnabled()).toBe(false)
    expect(drumDensity.mock.calls.at(-1)?.[0]).toBeLessThan(1)
  })

  it('re-enabling texture restores the section level immediately, not at the next section', async () => {
    // The cutout: while texture is disabled, every applyArrangement pass writes 0
    // into the arrangement multiplier. Re-enabling restored only the VOLUME
    // multiplier, so the pad stayed silent at arrangement 0 until the next
    // section change — up to 16 bars — while the UI reported texture as on.
    const tone = await import('tone')
    tone.getTransport().position = '0:0:0'
    ;(orchestrator as any).running = true
    orchestrator.setArrangementEnabled(true)
    ;(orchestrator as any).applyArrangement()

    const sectionLevel = (orchestrator as any).lastTextureArrangementMultiplier
    expect(sectionLevel).toBeGreaterThan(0)

    const textureSpy = vi.spyOn((orchestrator as any).texture, 'applyArrangementMultiplier')

    // Disabling does not zero it directly — the NEXT arrangement pass does,
    // because it writes `textureEnabled ? mult : 0`.
    orchestrator.setTextureEnabled(false)
    tone.getTransport().position = '4:0:0'   // new bar, or the pass is skipped
    ;(orchestrator as any).applyArrangement()
    expect(textureSpy).toHaveBeenLastCalledWith(0)

    // Re-enabling must put the section's level back NOW, not at the next
    // section boundary.
    orchestrator.setTextureEnabled(true)
    expect(textureSpy).toHaveBeenLastCalledWith(sectionLevel)
  })

  it('does NOT play instrumental answer licks unless Melody + Chords is featured', () => {
    // The ghost second melody: triggerAnswerLick puts 3 ascending chord tones an
    // octave up on the MELODY'S OWN voice, outside its phrase Part, on a fixed
    // shape that ignores what the melody was asked to play. It shared the vocal
    // duet's flag (default true, setter never called anywhere), and the
    // instrumental path is gated off only WHILE an MC is active — so with nobody
    // rapping it fired constantly. Reported by ear as "underneath it I hear the
    // old way it used to play, dum dum dum each a higher octave".
    const lickSpy = vi.spyOn((orchestrator as any).melody, 'triggerAnswerLick')

    expect((orchestrator as any).instrumentalDuetEnabled).toBe(false)
    ;(orchestrator as any).maybeAnswerMelodyRest(false)
    expect(lickSpy).not.toHaveBeenCalled()

    // Asking for the duet explicitly turns it on...
    orchestrator.setFeaturedPerformance('melody-chords')
    expect((orchestrator as any).instrumentalDuetEnabled).toBe(true)

    // ...and it turns back off with the feature, rather than leaking onward.
    orchestrator.setFeaturedPerformance('none')
    expect((orchestrator as any).instrumentalDuetEnabled).toBe(false)
  })

  it('jam arrangement defaults drums, bass, and the chord hook to lead roles', async () => {
    const tone = await import('tone')
    tone.getTransport().position = '0:0:0'
    const drumRoleSpy = vi.spyOn((orchestrator as any).drum, 'setRole')
    const bassRoleSpy = vi.spyOn((orchestrator as any).bass, 'setRole')
    const chordRoleSpy = vi.spyOn((orchestrator as any).chord, 'setRole')

    ;(orchestrator as any).running = true
    orchestrator.setArrangementEnabled(true)
    ;(orchestrator as any).applyArrangement()

    expect(drumRoleSpy).toHaveBeenLastCalledWith('lead')
    expect(bassRoleSpy).toHaveBeenLastCalledWith('lead')
    // Chords-as-the-hook flip: the chord seat leads in jam mode.
    expect(chordRoleSpy).toHaveBeenLastCalledWith('lead')
  })

  it('features melody + chords through existing roles while rhythm/texture support', async () => {
    const tone = await import('tone')
    tone.getTransport().position = '0:0:0'
    const roleSpies = {
      drum: vi.spyOn((orchestrator as any).drum, 'setRole'),
      bass: vi.spyOn((orchestrator as any).bass, 'setRole'),
      melody: vi.spyOn((orchestrator as any).melody, 'setRole'),
      chord: vi.spyOn((orchestrator as any).chord, 'setRole'),
      texture: vi.spyOn((orchestrator as any).texture, 'setRole'),
    }

    orchestrator.setFeaturedPerformance('melody-chords')
    ;(orchestrator as any).running = true
    ;(orchestrator as any).applyArrangement()

    expect(roleSpies.melody).toHaveBeenLastCalledWith('lead')
    expect(roleSpies.chord).toHaveBeenLastCalledWith('lead')
    expect(roleSpies.drum).toHaveBeenLastCalledWith('support')
    expect(roleSpies.bass).toHaveBeenLastCalledWith('support')
    expect(roleSpies.texture).toHaveBeenLastCalledWith('support')
    expect(orchestrator.getFeaturedPerformance()).toBe('melody-chords')
    expect(orchestrator.isArrangementEnabled()).toBe(true)
    expect((orchestrator as any).melody.getPartDebug().featured).toBe(true)
    expect((orchestrator as any).chord.getVoiceDebug().leadPocketed).toBe(true)
    expect((orchestrator as any).texture.getPadDebug().leadPocketed).toBe(true)
  })

  it('routes texture instrument assignment through the existing generator', () => {
    const textureSpy = vi.spyOn((orchestrator as any).texture, 'setInstrumentPerformer')
    orchestrator.setInstrumentPerformer('texture', 'choir')
    expect(textureSpy).toHaveBeenCalledWith('choir')
  })

  it('refreshInstrumentVoices re-applies bass, chord, and melody voices', () => {
    const bassSpy = vi.spyOn((orchestrator as any).bass, 'refreshVoice').mockImplementation(() => {})
    const chordSpy = vi.spyOn((orchestrator as any).chord, 'refreshVoice').mockImplementation(() => {})
    const melodySpy = vi.spyOn((orchestrator as any).melody, 'refreshVoice').mockImplementation(() => {})

    orchestrator.refreshInstrumentVoices()

    expect(bassSpy).toHaveBeenCalledOnce()
    expect(chordSpy).toHaveBeenCalledOnce()
    expect(melodySpy).toHaveBeenCalledOnce()
  })
})

// ── Loop Pack tests ──────────────────────────────────────────────────

import type { LoopPack } from '@shared/loopPack'

function makeTestPack(): LoopPack {
  const clip = (id: string) => ({ id, url: `https://cdn.test/${id}.wav`, bars: 4 })
  return {
    id: 'test-pack', genre: 'hip-hop', bpm: 95, key: 'Am', label: 'Test Pack',
    loops: {
      drums:   [clip('d1')],
      bass:    [clip('b1')],
      melody:  [clip('m1')],
      chords:  [clip('c1')],
      texture: [clip('t1')],
    },
  }
}

describe('GeneratorOrchestrator — loop pack', () => {
  it('loadLoopPack calls loadLoop on each generator with the first clip', async () => {
    const orch = new GeneratorOrchestrator()
    // Actual field names: drum, bass, melody, chord (not chords), texture
    const spyDrum    = vi.spyOn((orch as any).drum,    'loadLoop').mockResolvedValue(undefined)
    const spyBass    = vi.spyOn((orch as any).bass,    'loadLoop').mockResolvedValue(undefined)
    const spyMelody  = vi.spyOn((orch as any).melody,  'loadLoop').mockResolvedValue(undefined)
    const spyChord   = vi.spyOn((orch as any).chord,   'loadLoop').mockResolvedValue(undefined)
    const spyTexture = vi.spyOn((orch as any).texture, 'loadLoop').mockResolvedValue(undefined)
    vi.spyOn((orch as any).drum,    'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).bass,    'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).melody,  'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).chord,   'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).texture, 'setLoopMode').mockImplementation(() => {})

    const pack = makeTestPack()
    await orch.loadLoopPack(pack)

    expect(spyDrum).toHaveBeenCalledWith(pack.loops.drums[0])
    expect(spyBass).toHaveBeenCalledWith(pack.loops.bass[0])
    expect(spyMelody).toHaveBeenCalledWith(pack.loops.melody[0])
    expect(spyChord).toHaveBeenCalledWith(pack.loops.chords[0])
    expect(spyTexture).toHaveBeenCalledWith(pack.loops.texture[0])
  })

  it('loadLoopPack sets Transport bpm to pack.bpm', async () => {
    const tone = await import('tone')
    const orch = new GeneratorOrchestrator()
    ;['drum', 'bass', 'melody', 'chord', 'texture'].forEach(g => {
      vi.spyOn((orch as any)[g], 'loadLoop').mockResolvedValue(undefined)
      vi.spyOn((orch as any)[g], 'setLoopMode').mockImplementation(() => {})
    })
    await orch.loadLoopPack(makeTestPack())
    expect(tone.getTransport().bpm.value).toBe(95)
    expect(useStudioStore.getState().bpm).toBe(95)
  })

  it('clearLoopPack unloads loop playback resources on all generators', () => {
    const orch = new GeneratorOrchestrator()
    const spies = ['drum', 'bass', 'melody', 'chord', 'texture'].map(g =>
      vi.spyOn((orch as any)[g], 'unloadLoopPlayback').mockImplementation(() => {})
    )
    orch.clearLoopPack()
    spies.forEach(spy => expect(spy).toHaveBeenCalledOnce())
  })

  it('forceSubGenre does not randomize the transport tempo', async () => {
    const tone = await import('tone')
    const orch = new GeneratorOrchestrator()
    useStudioStore.getState().setBpm(144)

    orch.forceSubGenre('trap' as any)

    expect(tone.getTransport().bpm.value).toBe(144)
    expect(useStudioStore.getState().bpm).toBe(144)
  })

  it('emits generator note events when a generated drum pattern is loaded', async () => {
    const orch = new GeneratorOrchestrator()
    const events: import('../../session/types').GeneratorEvent[] = []
    orch.onGeneratorEvent((event) => events.push(event))

    orch.loadGeneratedDrumPattern([
      { instrument: 'kick' as any, time: '0:0:0', velocity: 0.8 },
      { instrument: 'snare' as any, time: '0:1:0', velocity: 0.7 },
    ], true)
    // force=true defers the rebuild through setTimeout(0) (the TANK BUILD yield
    // in DrumGenerator.loadGeneratedPattern) — let it run before asserting.
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      generator: 'drum',
      eventType: 'note_on',
      pitch: 36,
    })
  })
})

// ── Hybrid: per-row source switches (switches, not modes) ────────────
// Band leads, chosen rows run pack loops as beds. Loops Mode is just all
// five rows on 'loop'; the hybrid is any mix. See the loop-pack spec's
// Hybrid Implementation section.

describe('GeneratorOrchestrator — hybrid row switches', () => {
  function mockLoopPlumbing(orch: GeneratorOrchestrator) {
    const spies: Record<string, { loadLoop: any; setLoopMode: any }> = {}
    for (const g of ['drum', 'bass', 'melody', 'chord', 'texture']) {
      spies[g] = {
        loadLoop:    vi.spyOn((orch as any)[g], 'loadLoop').mockResolvedValue(undefined),
        setLoopMode: vi.spyOn((orch as any)[g], 'setLoopMode').mockImplementation(() => {}),
      }
    }
    return spies
  }

  it('loadLoopPack with loopRows flips ONLY those rows to loop mode', async () => {
    const orch = new GeneratorOrchestrator()
    const spies = mockLoopPlumbing(orch)

    await orch.loadLoopPack(makeTestPack(), ['texture'])

    expect(spies.texture.setLoopMode).toHaveBeenCalledWith(true, 95)
    for (const g of ['drum', 'bass', 'melody', 'chord']) {
      expect(spies[g].setLoopMode).not.toHaveBeenCalled()
    }
    expect(orch.getRowSources()).toEqual({
      drums: 'band', bass: 'band', melody: 'band', chords: 'band', texture: 'loop',
    })
    // Baseline clips still load for every row so a later flip is instant.
    for (const g of ['drum', 'bass', 'melody', 'chord', 'texture']) {
      expect(spies[g].loadLoop).toHaveBeenCalledOnce()
    }
  })

  it('setRowSource flips a single row live after a hybrid load', async () => {
    const orch = new GeneratorOrchestrator()
    const spies = mockLoopPlumbing(orch)
    await orch.loadLoopPack(makeTestPack(), ['texture'])

    expect(orch.setRowSource('drums', 'loop')).toBe(true)
    expect(spies.drum.setLoopMode).toHaveBeenCalledWith(true, 95)
    expect(orch.getRowSources().drums).toBe('loop')

    expect(orch.setRowSource('drums', 'band')).toBe(true)
    expect(spies.drum.setLoopMode).toHaveBeenLastCalledWith(false)
    expect(orch.getRowSources().drums).toBe('band')
  })

  it('setRowSource("loop") refuses when no pack is loaded', () => {
    const orch = new GeneratorOrchestrator()
    mockLoopPlumbing(orch)
    expect(orch.setRowSource('texture', 'loop')).toBe(false)
    expect(orch.getRowSources().texture).toBe('band')
  })

  it('setRowSource("loop") refuses a row the pack has no clip for — live band keeps playing', async () => {
    const orch = new GeneratorOrchestrator()
    const spies = mockLoopPlumbing(orch)
    // Pack with NO bass clip (the real-world "this pack has no bass loop" case).
    const pack = makeTestPack()
    pack.loops.bass = []
    await orch.loadLoopPack(pack, ['texture'])

    // Flip must be rejected, and the live bass must NOT be stopped into silence.
    expect(orch.setRowSource('bass', 'loop')).toBe(false)
    expect(orch.getRowSources().bass).toBe('band')
    expect(spies.bass.setLoopMode).not.toHaveBeenCalledWith(true, expect.anything())
  })

  it('restores the pre-lock BPM when the last loop row flips back to band', async () => {
    const orch = new GeneratorOrchestrator()
    mockLoopPlumbing(orch)
    useStudioStore.getState().setBpm(144)

    await orch.loadLoopPack(makeTestPack(), ['texture'])
    expect(useStudioStore.getState().bpm).toBe(95)

    orch.setRowSource('texture', 'band')
    expect(useStudioStore.getState().bpm).toBe(144)
  })

  it('applyScene only touches rows sourced to loop', async () => {
    const orch = new GeneratorOrchestrator()
    mockLoopPlumbing(orch)
    const pack = makeTestPack()
    await orch.loadLoopPack(pack, ['texture'])

    const commitSpies: Record<string, any> = {}
    const muteSpies: Record<string, any> = {}
    for (const g of ['drum', 'bass', 'melody', 'chord', 'texture']) {
      vi.spyOn((orch as any)[g], 'preloadNextLoop').mockResolvedValue(undefined)
      commitSpies[g] = vi.spyOn((orch as any)[g], 'commitNextLoopAt').mockImplementation(() => {})
      muteSpies[g]   = vi.spyOn((orch as any)[g], 'setLoopMute').mockImplementation(() => {})
    }

    await orch.applyScene(pack, {
      drums: 'd1', bass: 'b1', melody: null, chords: null, texture: 't1',
    })

    // texture (loop row): scene owns it. Loading a pack records clip[0] as the
    // current scene, so an identical clip id is unchanged — mute state still set.
    expect(muteSpies.texture).toHaveBeenCalledWith(false)
    // band rows: the live generator owns them — the scene must not touch them.
    for (const g of ['drum', 'bass', 'melody', 'chord']) {
      expect(commitSpies[g]).not.toHaveBeenCalled()
      expect(muteSpies[g]).not.toHaveBeenCalled()
    }
  })
})

// ── Sample Leads: the band HEARS the loop ────────────────────────────

import { getSampleCell, setSampleCell, cellFromOnsetGrid } from '../freeplay/songCell'
import { getConductor } from '../../conductor/Conductor'

describe('GeneratorOrchestrator — sample leads', () => {
  function makeMusicalPack(): LoopPack {
    const pack = makeTestPack()
    pack.loops.chords[0].musical = {
      keyGuess: 'Am',
      chordPerBar: ['Am', 'F', 'C', 'G'],
      onsetGrid: [1, 0, 0, 0.6, 0, 0, 0.8, 0, 0.9, 0, 0, 0.5, 0, 0, 0.7, 0],
      analyzedAt: new Date().toISOString(),
    }
    return pack
  }

  function mockPlumbing(orch: GeneratorOrchestrator) {
    for (const g of ['drum', 'bass', 'melody', 'chord', 'texture']) {
      vi.spyOn((orch as any)[g], 'loadLoop').mockResolvedValue(undefined)
      vi.spyOn((orch as any)[g], 'setLoopMode').mockImplementation(() => {})
    }
    vi.spyOn((orch as any).drum, 'loadGeneratedPattern').mockImplementation(() => {})
    vi.spyOn((orch as any).melody, 'setRole').mockImplementation(() => {})
  }

  beforeEach(() => { setSampleCell(null) })

  it('cellFromOnsetGrid: slots from hits, accents from strongest, downbeat anchored', () => {
    const cell = cellFromOnsetGrid([0, 0, 0, 0.6, 0, 0, 0.8, 0, 0.9, 0, 0, 0.5, 0, 0, 0.2, 0])
    expect(cell.slots).toContain(0)          // anchored even though grid[0]=0
    expect(cell.slots).toEqual([0, 3, 6, 8, 11])
    expect(cell.accents).toEqual([3, 6, 8])  // three strongest, sorted
    expect(cell.gaps).not.toContain(6)
    expect(cell.gaps).toContain(14)          // 0.2 is below the hit threshold
  })

  it('setSampleLead feeds the loop DNA to conductor + song cell and marks melody support', async () => {
    const orch = new GeneratorOrchestrator()
    mockPlumbing(orch)
    const conductor = getConductor()
    const keySpy  = vi.spyOn(conductor, 'setKey')
    const progSpy = vi.spyOn(conductor, 'setProgression')
    const lockSpy = vi.spyOn(conductor, 'lockProgression')

    await orch.loadLoopPack(makeMusicalPack(), ['chords'])
    expect(orch.setSampleLead('chords')).toBe(true)

    expect(keySpy).toHaveBeenCalledWith('A')            // 'Am' → root 'A'
    expect(progSpy).toHaveBeenCalledWith(['Am', 'F', 'C', 'G'])
    expect(lockSpy).toHaveBeenCalled()
    expect(getSampleCell()).not.toBeNull()
    expect(getSampleCell()!.slots).toContain(6)
    expect((orch as any).melody.setRole).toHaveBeenCalledWith('support')
    expect(orch.getSampleLeadRow()).toBe('chords')
  })

  it('setSampleLead refuses rows without musical data or not sourced to loop', async () => {
    const orch = new GeneratorOrchestrator()
    mockPlumbing(orch)
    await orch.loadLoopPack(makeMusicalPack(), ['chords'])
    expect(orch.setSampleLead('melody')).toBe(false)  // sourced to band
    orch.setRowSource('bass', 'loop')
    expect(orch.setSampleLead('bass')).toBe(false)    // no musical data
    expect(getSampleCell()).toBeNull()
  })

  it('releasing sample lead clears the cell and unlocks the progression', async () => {
    const orch = new GeneratorOrchestrator()
    mockPlumbing(orch)
    const conductor = getConductor()
    const unlockSpy = vi.spyOn(conductor, 'unlockProgression')
    await orch.loadLoopPack(makeMusicalPack(), ['chords'])
    orch.setSampleLead('chords')

    expect(orch.setSampleLead(null)).toBe(true)
    expect(getSampleCell()).toBeNull()
    expect(unlockSpy).toHaveBeenCalled()
    expect(orch.getSampleLeadRow()).toBeNull()
  })

  it('flipping the sample row back to band releases sample leads', async () => {
    const orch = new GeneratorOrchestrator()
    mockPlumbing(orch)
    await orch.loadLoopPack(makeMusicalPack(), ['chords'])
    orch.setSampleLead('chords')

    orch.setRowSource('chords', 'band')
    expect(orch.getSampleLeadRow()).toBeNull()
    expect(getSampleCell()).toBeNull()
  })
})

// ── Preset swap: clean cut (no stacking) ─────────────────────────────
// A live preset swap must silence the OUTGOING preset's parts immediately
// rather than letting them ride the section-change handoff (which keeps them
// for ~1-2 bars and makes the old + new presets audibly stack). swapSubGenre
// is the dedicated live-swap entry, so the clean cut lives there.

describe('GeneratorOrchestrator — preset swap clean cut', () => {
  it('swapSubGenre hard-cuts every generator part before rebuilding', () => {
    const orch = new GeneratorOrchestrator()
    const spies = ['drum', 'bass', 'melody', 'chord', 'texture'].map(g =>
      vi.spyOn((orch as any)[g], 'stopPart').mockImplementation(() => {})
    )

    // No bpm arg — setBpm uses Transport.bpm.rampTo which the Tone mock omits,
    // and BPM is not what this test covers. The clean cut runs regardless.
    orch.swapSubGenre('boom-bap' as any)

    // All five (including the keys/pad texture) get cut so neither a Tone.Part
    // loop nor a sustained pad voicing survives into the new preset.
    spies.forEach(spy => expect(spy).toHaveBeenCalledOnce())
  })
})

// ── Stop must actually stop ──────────────────────────────────────────
// stop() silences every generator, but the orchestrator stays subscribed to
// the PhysicsEngine and the StateMachine — both of which are owned by
// OrganismProvider and keep running after the user hits Stop. Neither
// subscription consulted `running`, so the very next frame/transition
// re-drove the generators: onFrame -> texture.processFrame re-raised padGain,
// and onTransition -> texture.onStateTransition called startPadLoop(), which
// re-scheduled the pad chords on the Transport. Symptom: the keys/pad kept
// playing after Stop, and ONLY the texture volume slider could silence them
// (the pad chain is padGain -> padWidener, not the `gain` node hardSilence
// zeroes).

describe('GeneratorOrchestrator — stop() ignores late engine events', () => {
  // NOTE: do NOT emit a physics frame during setup. onFrame throttles to
  // MIN_FRAME_INTERVAL_MS, so a warm-up frame makes the post-stop frame return
  // early on the throttle and the test passes whether or not stop() works.
  function wired() {
    const orch = new GeneratorOrchestrator()
    const physics = createMockPhysicsEngine()
    const stateMachine = createMockStateMachine()
    orch.wire(
      physics as unknown as import('../../physics/PhysicsEngine').PhysicsEngine,
      stateMachine as unknown as import('../../state/StateMachine').StateMachine,
    )
    stateMachine._emitState(makeOrganism())
    return { orch, physics, stateMachine }
  }

  it('does not drive the texture generator on a physics frame after stop()', () => {
    const { orch, physics } = wired()
    orch.stop()

    const spy = vi.spyOn((orch as any).texture, 'processFrame')
    physics._emit(makePhysics({ timestamp: 9000, frameIndex: 99 }))

    expect(spy).not.toHaveBeenCalled()
  })

  it('does not re-arm the pad loop on a state transition after stop()', () => {
    const { orch, stateMachine } = wired()
    orch.stop()

    const spy = vi.spyOn((orch as any).texture, 'onStateTransition')
    stateMachine._emitTransition({
      from: OState.Breathing,
      to: OState.Flow,
      transition: 'BREATHING_TO_FLOW' as import('../../state/types').OTransition,
      timestamp: 9000,
      physicsSnapshot: makePhysics({ timestamp: 9000 }),
    })

    expect(spy).not.toHaveBeenCalled()
  })
})

// ── Rhythm-section glue survives long sections ───────────────────────
// buildDrumHits now builds a whole SECTION (the locked 4-bar core tiled to the
// section's live length). extractKickSlots returns ABSOLUTE slots (bar*16+...),
// so a 16-bar pattern yields anchors up to 255 — but the bass and chords build
// 4-BAR phrases and only understand slots 0-63. Anchors must come from the core
// cycle, which the tiled bars merely repeat.
describe('GeneratorOrchestrator — kick anchors stay within the 4-bar phrase', () => {
  it('shares core-cycle kick anchors even when the section is 16 bars', () => {
    const orch = new GeneratorOrchestrator()
    const bassSpy = vi.spyOn((orch as any).bass, 'setKickAnchors')
    const chordSpy = vi.spyOn((orch as any).chord, 'setKickAnchors')

    ;(orch as any).currentSectionBars = 16
    const hits = (orch as any).buildDrumHits('trap', 0)

    expect(hits.length).toBeGreaterThan(0)
    expect(Math.max(...hits.map(hit => Number(hit.time.split(':')[0])))).toBe(15)

    // The followers only ever hear one 4-bar phrase of kicks.
    for (const spy of [bassSpy, chordSpy]) {
      const anchors = spy.mock.calls[spy.mock.calls.length - 1][0] as number[]
      expect(anchors.length).toBeGreaterThan(0)
      expect(Math.max(...anchors)).toBeLessThan(64)
    }
  })
})
