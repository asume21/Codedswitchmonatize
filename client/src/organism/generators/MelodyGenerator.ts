// Section 04 — Melody Generator

import * as Tone from 'tone'
import type { LoopClip } from '@shared/loopPack'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName, MelodyBehavior } from './types'
import type { ScheduledNote } from './types'
import {
  MODE_SCALES,
  PHRASE_LENGTHS,
  MODE_OCTAVES,
  getMelodyBehavior,
  HIP_HOP_MOTIFS,
  type MelodyMotif,
}                             from './patterns/MelodyPatternLibrary'
// ChordProgressionBank is no longer a direct dependency — Melody pulls
// scale + chord-tones via the Conductor (Phase 4 wiring in constructor).
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import { OState }             from '../state/types'
import { createSoundfontSampler, createMultisampleSampler, type LoadableSampler } from '../instruments/SamplerUtils'
import { getRealInstrumentNotes } from '../instruments/realInstruments'
import {
  applyArticulation,
  DEFAULT_ARTICULATION_ID,
  defaultMelodyArticulation,
} from '../techniques/articulations'
import type { ArticulationContext } from '../techniques/types'
import { getLivePartStart, livePartStartOffset, msUntilTransportTime, quantizeGridTime } from './CompositionClock'
import {
  conformNoteToInstrument,
  midiToNote,
  noteToMidi,
  selectInstrumentPerformer,
  type InstrumentPerformerId,
  type InstrumentPerformerProfile,
} from '../performers'
import { getConductor } from '../conductor/Conductor'
import { developMotif, pickPhraseVariations } from './melody/melodyMotif'
import { isStrongBeat, resolveDegreeComplementing, contourOffset, cadenceStep } from './melody/melodyPhrase'
import { assignMelodyVoice } from './melody/melodyVoice'
import { shapeGuitarDynamics, planGuitarArticulations, developGuitarPhrase } from './melody/guitarPerformance'
import { applyVoiceLeading } from './melody/voiceLeading'
import { selectMotifBankKey } from './melody/motifSelection'
import { extractBusySlots16ths } from './freeplay/utils'

const normalizePitchClass = (pitchClass: number): number =>
  ((Math.round(pitchClass) % 12) + 12) % 12

export function snapNoteToScale(
  note: string | number,
  rootPitchClass: number,
  scaleIntervals: number[],
  pitchOffsetSemitones = 0,
): string | number {
  const midi = noteToMidi(note)
  if (midi == null || scaleIntervals.length === 0) return note

  const root = normalizePitchClass(rootPitchClass + pitchOffsetSemitones)
  const allowed = new Set(scaleIntervals.map(interval => normalizePitchClass(root + interval)))
  if (allowed.has(normalizePitchClass(midi))) return note

  for (let delta = 1; delta <= 6; delta++) {
    const lower = midi - delta
    if (allowed.has(normalizePitchClass(lower))) {
      return typeof note === 'number' ? lower : midiToNote(lower)
    }

    const upper = midi + delta
    if (allowed.has(normalizePitchClass(upper))) {
      return typeof note === 'number' ? upper : midiToNote(upper)
    }
  }

  return note
}

export class MelodyGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth: Tone.PolySynth | LoadableSampler
  private part:  Tone.Part | null = null
  // Fallback synth — always available for instant playback while CDN samplers load
  private fallbackSynth: Tone.PolySynth
  private hasStartedPlayback: boolean = false

  // Expression & Phrasing — Tone.Vibrato sits inline in the audio chain so it
  // works for both PolySynth and Sampler sources (PolySynth does not expose a
  // connectable detune AudioParam at the top level).
  private vibrato: Tone.Vibrato

  // Reactive state (Section 05)
  private pitchOffsetSemitones: number = 0
  private volumeMultiplier:     number = 1.0
  private lastOutputGain:       number = 0

  // Musical state
  private rootPitchClass:  number         = 0    // 0-11, detected by ScaleSnapEngine
  private currentBehavior: MelodyBehavior = MelodyBehavior.Rest
  private lastBehavior:    MelodyBehavior = MelodyBehavior.Rest
  private currentScale:    number[]       = MODE_SCALES.glow
  private scaleDirty:      boolean        = false // rebuild phrase on next behavior cycle

  // Periodic phrase refresh — without this, the Tone.Part loop plays the same
  // motif indefinitely whenever behavior and section sit still (most of the
  // time on the guest demo). A scheduled repeat flips phraseDirty every
  // PHRASE_REFRESH_BARS so processFrame regenerates fresh notes on cadence.
  private phraseDirty:          boolean = false
  private phraseRefreshEventId: number | null = null

  // The ONE motif the current section commits to. Developed (transpose/invert/
  // augment) across the phrase instead of swapping to a different bank entry —
  // that "motif salad" was why the line never cohered into a recognizable tune.
  // Persists across phrase refreshes WITHIN a section (the idea recurs);
  // onSectionChange() nulls it so the next section commits to a fresh motif.
  private currentSectionMotif: MelodyMotif | null = null
  // Set by onSectionChange: bias the chorus/hook to a contrasting bank.
  private preferredMotifBankKey: string | null = null
  // Cross-phrase continuity: the MIDI pitch of the final note in the last phrase.
  // Used to pick the starting octave of the next phrase so the lead doesn't jump
  // back to a fixed home register — it picks up near where it left off.
  // Cleared on section change so each section is a fresh musical thought.
  private lastPhraseFinalMidi: number | null = null
  // Per-bar 16th slots (0..15) the CURRENT melody loop occupies. The
  // orchestrator pulls this and pushes it to the chords before every chord
  // rebuild — same band-awareness channel as the drum's kick anchors.
  private busySlots16ths: number[] = []
  // Section instrument hand-off (piano verse -> strings chorus) is BUILT but OFF
  // by default: timbre variety only pays off once the LINE is good, and we don't
  // want to debug a jumping voice while the note logic is still settling.
  private melodySectionHandoffEnabled = false

  // Chord-awareness — chord tones (pitch classes 0-11) to target on strong beats.
  // Sourced from the Conductor (Phase 3 wiring); the legacy setCurrentChord
  // external API stays as an override path.
  private currentChordTones: number[] = []
  // Conductor Part 3 V3 — the comp's guide tones (3rd & 7th, pitch classes 0-11).
  // The melody COMPLEMENTS these on strong beats (leans on root/5th/extensions)
  // so the lead doesn't mud-double the colour the chords are already stating.
  private currentGuideTones: number[] = []
  private unsubscribeConductor: (() => void) | null = null
  // Tracks the last conductor progression version we rebuilt for. Used to
  // distinguish a chord ADVANCE (same key, same progression) from a key/scale
  // CHANGE (sub-genre swap, key change, new progression). Chord advances do not
  // warrant a phrase rebuild — the running loop keeps playing through them.
  private lastProgressionVersion: number = -1

  // Physics cache
  private currentPresence: number  = 0
  private voiceActive:     boolean = false
  private flowDepth:       number  = 0

  // Current voice name for debugging/display
  private currentVoiceName: string = 'Default FM'
  private currentPerformer: InstrumentPerformerProfile | null = null
  private explicitPerformerId: InstrumentPerformerId | null = null
  private currentModeName: string = 'glow'

  // Tracked synth dispose timer — prevents zombie synth accumulation
  // Cache of loaded samplers keyed by voice ("real:<id>" / "gm:<preset>"). Once a
  // real instrument (e.g. SSO_Violins1) loads it stays loaded and is reused
  // instantly on the next voice change, so the synth fallback never has to cover
  // a re-download. This is what keeps the REAL instrument playing the lead.
  private samplerCache: Map<string, LoadableSampler> = new Map()
  private currentVoiceKey: string | null = null

  // Fallback only — the orchestrator pushes the sub-genre swing (the band's
  // single groove source) via setSwing() on start and every sub-genre change.
  // Scaled to the same musical range as DrumPatternLibrary's SWING table.
  private static readonly MODE_SWING: Record<string, number> = {
    heat: 0.10, gravel: 0.11, smoke: 0.28, ice: 0.24, glow: 0.19,
  }
  private currentSwing: number = 0.35

  // Rebuild throttle — prevent rapid Part rebuilds from overlapping.
  private lastRebuildTime: number = -Infinity
  private static readonly MIN_REBUILD_INTERVAL_MS = 600
  private static readonly LEAD_GAIN_BOOST_DB = 5
  // Refresh the phrase every N bars while playing. 8 bars lets a motif develop
  // and repeat before fresh material arrives — shorter values caused audible hard
  // resets that interrupted the listener's sense of a continuous melody.
  private static readonly PHRASE_REFRESH_BARS = 8

  // Behavior debounce — require behavior to be stable for 2 consecutive frames
  private pendingBehavior: MelodyBehavior | null = null
  private pendingBehaviorFrames: number = 0
  private static readonly BEHAVIOR_DEBOUNCE_FRAMES = 2

  // Articulation — per-note transform applied on each Tone.Part callback.
  // Defaults to 'none' (identity pass-through), preserving legacy behavior.
  private currentArticulationId: string = DEFAULT_ARTICULATION_ID
  private articulationOverridden: boolean = false
  private lastModeForArticulation: string = ''

  // ── Emotional Intent ─────────────────────────────────────────────
  // Layered on top of scale/mode selection. `null` is neutral (no overrides).
  // 'sad' / 'melancholy': natural-minor bias, velocity clamped 0.4-0.6, legato.
  // 'beautiful' / 'lush': chord-tone bias toward 7ths and 9ths, soft velocity.
  // The orchestrator handles cross-generator routing (e.g. piano-rolled-chord
  // technique for 'beautiful'); this field shapes single-note melody output.
  static readonly NATURAL_MINOR: number[]  = [0, 2, 3, 5, 7, 8, 10]
  static readonly HARMONIC_MINOR: number[] = [0, 2, 3, 5, 7, 8, 11]
  private emotionalIntent: 'sad' | 'beautiful' | null = null

  setEmotionalIntent(intent: 'sad' | 'beautiful' | null): void {
    if (this.emotionalIntent === intent) return
    this.emotionalIntent = intent
    if (intent === 'sad') {
      // Force natural minor against the current root so phrases inherit the
      // melancholy tonality on the next rebuild.
      this.currentScale = MelodyGenerator.NATURAL_MINOR
    }
    this.scaleDirty = true                       // rebuild on next processFrame
    this.lastRebuildTime = -Infinity             // clear 600ms throttle — user
                                                 // emotional commits must take
                                                 // effect immediately, not get
                                                 // silently consumed by a recent
                                                 // chord-change-triggered rebuild
  }

  getEmotionalIntent(): 'sad' | 'beautiful' | null {
    return this.emotionalIntent
  }

  /** Set articulation. markAsOverride=true locks out mode-default auto-apply. */
  setArticulation(articulationId: string, markAsOverride: boolean = true): void {
    // Automatic callers (reactive style shifts, section style presets) must
    // not stomp an explicit user pick — the UI dropdown "snapping back".
    if (!markAsOverride && this.articulationOverridden) return
    this.currentArticulationId = articulationId
    if (markAsOverride) this.articulationOverridden = true
  }

  /** Clear override so mode defaults can drive articulation again. */
  resetArticulationOverride(): void {
    this.articulationOverridden = false
  }

  getArticulation(): string {
    return this.currentArticulationId
  }

  // ─── Dynamic Global Voices ──────────────────────────────────
  private static readonly GLOBAL_VOICES: Array<{
    name: string; type: 'FM' | 'Synth' | 'Mono' | 'Sampler'; options: any; presetId?: string
    volume: number; chorusWet: number; reverbDecay: number; delayFeedback: number
    tags: string[]
  }> = [
    // Aggressive Trap/Drill
    { name: 'Trap Lead', type: 'FM', options: {
      harmonicity: 3, modulationIndex: 6, oscillator: { type: 'sine' }, modulation: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 },
      modulationEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.3 },
    }, volume: -8, chorusWet: 0.15, reverbDecay: 0.5, delayFeedback: 0.08, tags: ['aggressive', 'electronic'] },
    { name: 'Eerie Bell', type: 'FM', options: {
      harmonicity: 5.07, modulationIndex: 12, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.8, sustain: 0.1, release: 1.5 },
      modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0.1, release: 1.0 },
    }, volume: -10, chorusWet: 0.2, reverbDecay: 1.2, delayFeedback: 0.15, tags: ['dark', 'electronic'] },
    
    // Boom Bap / Soulful
    { name: 'Acoustic Piano', type: 'Sampler', presetId: 'acoustic_grand_piano', options: {
      envelope: { attack: 0.005, release: 0.8 }
    }, volume: -5, chorusWet: 0.1, reverbDecay: 1.0, delayFeedback: 0.05, tags: ['acoustic', 'warm', 'soulful'] },
    { name: 'Saxophone', type: 'Sampler', presetId: 'alto_sax', options: {
      envelope: { attack: 0.04, release: 0.25 }
    }, volume: -6, chorusWet: 0.25, reverbDecay: 1.5, delayFeedback: 0.1, tags: ['acoustic', 'warm', 'dark'] },
    
    // Lo-Fi / Cloud Rap
    { name: 'Music Box', type: 'Sampler', presetId: 'marimba', options: {
      envelope: { attack: 0.001, release: 0.8 }
    }, volume: -3, chorusWet: 0.4, reverbDecay: 2.0, delayFeedback: 0.2, tags: ['ethereal', 'chill'] },
    { name: 'Glass Pad', type: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 30 },
      envelope: { attack: 1.5, decay: 1.0, sustain: 0.85, release: 3.0 },
    }, volume: -12, chorusWet: 0.6, reverbDecay: 3.0, delayFeedback: 0.2, tags: ['ethereal', 'dark', 'electronic'] },

    // R&B / Pop Rap
    { name: 'Nylon Guitar', type: 'Sampler', presetId: 'acoustic_guitar_nylon', options: {
      envelope: { attack: 0.005, release: 0.5 }
    }, volume: -4, chorusWet: 0.2, reverbDecay: 1.5, delayFeedback: 0.15, tags: ['acoustic', 'chill', 'soulful'] },
    { name: 'Clean Air', type: 'FM', options: {
      harmonicity: 1, modulationIndex: 0.2, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 1.0, decay: 1.0, sustain: 1.0, release: 3.0 },
    }, volume: -15, chorusWet: 0.4, reverbDecay: 5.0, delayFeedback: 0.3, tags: ['chill', 'ethereal'] },

    // Bowed strings — solo violin (Drake/Alchemist soul), expressive cello.
    // Pro-violin envelope: longer bow-on-string attack (~200ms) + sustained
    // 1.5s release tail = legato phrasing instead of staccato note-stabs.
    // Higher chorusWet (~0.45) adds the lush ensemble shimmer real solo
    // violins get in studio production via stereo doubling.
    { name: 'Solo Violin', type: 'Sampler', presetId: 'violin', options: {
      envelope: { attack: 0.20, release: 1.5 }
    }, volume: 1, chorusWet: 0.45, reverbDecay: 2.5, delayFeedback: 0.12, tags: ['acoustic', 'soulful', 'warm'] },
    { name: 'Cello Lead', type: 'Sampler', presetId: 'cello', options: {
      envelope: { attack: 0.22, release: 1.8 }
    }, volume: 0, chorusWet: 0.40, reverbDecay: 2.8, delayFeedback: 0.10, tags: ['acoustic', 'dark', 'soulful'] },

    // Winds — Future Hendrix flute, jazz-rap clarinet, cinematic oboe
    { name: 'Flute', type: 'Sampler', presetId: 'flute', options: {
      envelope: { attack: 0.04, release: 0.3 }
    }, volume: -5, chorusWet: 0.3, reverbDecay: 1.5, delayFeedback: 0.15, tags: ['acoustic', 'ethereal', 'chill'] },
    { name: 'Clarinet', type: 'Sampler', presetId: 'clarinet', options: {
      envelope: { attack: 0.05, release: 0.35 }
    }, volume: -7, chorusWet: 0.2, reverbDecay: 1.2, delayFeedback: 0.1, tags: ['acoustic', 'warm', 'dark'] },
    { name: 'Oboe', type: 'Sampler', presetId: 'oboe', options: {
      envelope: { attack: 0.06, release: 0.4 }
    }, volume: -8, chorusWet: 0.2, reverbDecay: 1.5, delayFeedback: 0.1, tags: ['acoustic', 'dark', 'soulful'] },

    // Brass leads — solo trumpet, trombone, french horn
    { name: 'Trumpet Lead', type: 'Sampler', presetId: 'trumpet', options: {
      envelope: { attack: 0.03, release: 0.25 }
    }, volume: -7, chorusWet: 0.2, reverbDecay: 1.2, delayFeedback: 0.1, tags: ['acoustic', 'aggressive', 'soulful'] },
    { name: 'Trombone Lead', type: 'Sampler', presetId: 'trombone', options: {
      envelope: { attack: 0.06, release: 0.3 }
    }, volume: -8, chorusWet: 0.15, reverbDecay: 1.0, delayFeedback: 0.08, tags: ['acoustic', 'warm', 'dark'] },
    { name: 'French Horn Lead', type: 'Sampler', presetId: 'french_horn', options: {
      envelope: { attack: 0.1, release: 0.6 }
    }, volume: -8, chorusWet: 0.2, reverbDecay: 1.5, delayFeedback: 0.1, tags: ['acoustic', 'warm', 'soulful'] },

    // Guitar leads — clean and distorted single-note lines
    { name: 'Clean Guitar Lead', type: 'Sampler', presetId: 'electric_guitar_clean', options: {
      envelope: { attack: 0.005, release: 0.3 }
    }, volume: -8, chorusWet: 0.25, reverbDecay: 1.0, delayFeedback: 0.12, tags: ['acoustic', 'warm', 'chill'] },
    { name: 'Dist Guitar Lead', type: 'Sampler', presetId: 'distortion_guitar', options: {
      envelope: { attack: 0.005, release: 0.25 }
    }, volume: -12, chorusWet: 0.1, reverbDecay: 0.8, delayFeedback: 0.1, tags: ['aggressive', 'electronic'] },

    // Mallet & keys leads
    { name: 'Vibes Lead', type: 'Sampler', presetId: 'vibraphone', options: {
      envelope: { attack: 0.005, release: 1.2 }
    }, volume: -5, chorusWet: 0.3, reverbDecay: 1.8, delayFeedback: 0.15, tags: ['ethereal', 'chill', 'soulful'] },
    { name: 'Rhodes Lead', type: 'Sampler', presetId: 'electric_piano_1', options: {
      envelope: { attack: 0.005, release: 0.6 }
    }, volume: -6, chorusWet: 0.4, reverbDecay: 1.2, delayFeedback: 0.1, tags: ['warm', 'soulful', 'chill'] },

    // Cascading & exotic
    { name: 'Harp Lead', type: 'Sampler', presetId: 'orchestral_harp', options: {
      envelope: { attack: 0.005, release: 1.2 }
    }, volume: -5, chorusWet: 0.45, reverbDecay: 2.5, delayFeedback: 0.2, tags: ['ethereal', 'chill'] },
    { name: 'Sitar Lead', type: 'Sampler', presetId: 'sitar', options: {
      envelope: { attack: 0.005, release: 0.8 }
    }, volume: -7, chorusWet: 0.4, reverbDecay: 1.5, delayFeedback: 0.18, tags: ['ethereal', 'dark'] },
  ]

  private reverb:          Tone.Reverb
  private delay:           Tone.FeedbackDelay
  private chorus:          Tone.Chorus
  private dryBus:          Tone.Gain
  private delaySend:       Tone.Gain
  private reverbSend:      Tone.Gain
  private delayReturnHP:   Tone.Filter
  private reverbReturnHP:  Tone.Filter

  constructor() {
    super(GeneratorName.Melody)

    this.output = new Tone.Gain(1)

    // Baseline lifted from -9 to -5 dB (~4 dB hotter, ~58% louder perceived).
    // The lower trim left solo leads sounding thin once drums were muted, since
    // there is no master compressor in the generator graph to make up gain.
    // The MixEngine master limiter handles any clipping downstream.
    this.synth = this.buildDefaultSynth()
    this.synth.volume.value = this.boostLeadGainDb(-5)

    // Fallback synth — always connected, used when a sampler hasn't loaded yet
    this.fallbackSynth = this.buildDefaultSynth()
    this.fallbackSynth.volume.value = this.boostLeadGainDb(-5)

    // Vibrato — inline pitch modulation between synths and chorus. Depth is
    // ramped from setPerformerFeatures based on performer energy.
    this.vibrato = new Tone.Vibrato({ frequency: 5, depth: 0 })

    this.chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.4, wet: 0.3 })

    // Dry bus lifted from 0.80 to 1.0 (+1.9 dB) so the unwet melody sits at
    // unity through the wet/dry sum. Send levels unchanged — the wet returns
    // come back through their own filters and have their own perceived loudness.
    this.dryBus     = new Tone.Gain(1.0)
    this.delaySend  = new Tone.Gain(0.10)
    this.reverbSend = new Tone.Gain(0.08)
    this.delay  = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.12, wet: 1.0 })
    this.reverb = new Tone.Reverb({ decay: 0.8, wet: 1.0 })

    this.delayReturnHP  = new Tone.Filter({ type: 'highpass', frequency: 300, rolloff: -12 })
    this.reverbReturnHP = new Tone.Filter({ type: 'highpass', frequency: 250, rolloff: -12 })

    this.synth.connect(this.vibrato)
    this.fallbackSynth.connect(this.vibrato)
    this.vibrato.connect(this.chorus)
    this.chorus.connect(this.dryBus)
    this.chorus.connect(this.delaySend)
    this.chorus.connect(this.reverbSend)
    this.dryBus.connect(this.output)
    this.delaySend.connect(this.delay)
    this.delay.connect(this.delayReturnHP)
    this.delayReturnHP.connect(this.output)
    this.reverbSend.connect(this.reverb)
    this.reverb.connect(this.reverbReturnHP)
    this.reverbReturnHP.connect(this.output)

    this.chorus.start()
    this.setOutputLevel(0)

    // Phase 3 — lock to the Conductor. Initial key/scale/chord-tones come from
    // the Conductor at construction (no rebuild needed — there is no part
    // yet), and every chord change re-syncs them so melody picks idiomatic
    // passing notes and lands chord tones on strong beats. The 'sad'
    // emotional override still wins over the Conductor's scale — it's a
    // deliberate user intent.
    this.syncFromConductor(false)
    this.lastProgressionVersion = getConductor().getProgressionVersion()
    this.unsubscribeConductor = getConductor().onChordChange(() => {
      this.syncFromConductor(true)
    })
  }

  private syncFromConductor(triggerRebuild: boolean): void {
    const conductor = getConductor()
    this.rootPitchClass = conductor.getKeyPitchClass()
    if (this.emotionalIntent !== 'sad') {
      this.currentScale = conductor.scaleIntervals()
    }
    // Conductor returns chord tones as MIDI notes (e.g. [60, 63, 67, 70] for
    // Cm7). Melody matches in pitch classes (0-11), octave-invariant.
    const tones = conductor.chordTones()
    const pcs: number[] = []
    for (const midi of tones) {
      const pc = ((midi % 12) + 12) % 12
      if (!pcs.includes(pc)) pcs.push(pc)
    }
    this.currentChordTones = pcs
    // Guide tones (3rd & 7th) the comp is voicing — collapsed to pitch classes so
    // the melody can prefer their COMPLEMENT on strong beats.
    const guidePcs: number[] = []
    for (const midi of conductor.currentVoicing().guideTones) {
      const pc = ((midi % 12) + 12) % 12
      if (!guidePcs.includes(pc)) guidePcs.push(pc)
    }
    this.currentGuideTones = guidePcs
    // Only rebuild when the KEY or SCALE changes (sub-genre swap, explicit key
    // change, new progression). A plain chord advance (advanceChord) increments
    // the chord index but does NOT bump progressionVersion — the running phrase
    // keeps playing through it so the melody builds continuously over the beat
    // rather than hard-resetting every 2 bars.
    const progressionVersion = conductor.getProgressionVersion()
    const progressionChanged = progressionVersion !== this.lastProgressionVersion
    if (triggerRebuild && progressionChanged) {
      this.lastProgressionVersion = progressionVersion
      this.scaleDirty = true
    }
  }

  private buildDefaultSynth(): Tone.PolySynth {
    // 6 voices dropped notes when ornaments (trill/grace) overlapped a sustained
    // legato phrase. 12 covers the realistic worst case without bloating CPU.
    // Warm flute/cello-like fallback. harmonicity:1 (unison FM) + low modulationIndex
    // eliminates the metallic OPL2 sidebands. High sustain keeps notes singing
    // instead of ping-decay chiptune. Only plays while the real sampler is loading.
    return new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 12,
      harmonicity: 1,
      modulationIndex: 0.25,
      oscillator:    { type: 'sine' },
      modulation:    { type: 'sine' },
      envelope:      { attack: 0.15, decay: 0.5, sustain: 0.80, release: 2.5 },
      modulationEnvelope: { attack: 0.2, decay: 0.8, sustain: 0.4, release: 1.5 },
    } as any)
  }

  private boostLeadGainDb(db: number): number {
    return Math.min(2, db + MelodyGenerator.LEAD_GAIN_BOOST_DB)
  }

  private lastPerformerEnergy: number = 0.5
  private lastPerformerBrightness: number = 0.5
  private lastPerformerSyllabicRate: number = 4
  // Section behavior override — set by arrangement to control melody density per section.
  // null = use normal getMelodyBehavior() logic
  private sectionBehavior: MelodyBehavior | null = null

  setPerformerFeatures(energy: number, brightness: number, syllabicRate: number): void {
    this.lastPerformerEnergy = energy
    this.lastPerformerBrightness = brightness
    this.lastPerformerSyllabicRate = syllabicRate
  }

  // Set by the orchestrator on every sub-genre change so the melody swings by
  // the SAME amount as the drum pattern (one band, one pocket).
  private subGenreSwing: number | null = null

  setSwing(amount: number): void {
    this.subGenreSwing = Math.max(0, Math.min(1, amount))
  }

  // Per-start phrase variety — rolled by the orchestrator on each cold start
  // so two sessions over the same progression don't play identical phrases.
  private sessionSeed: number = Math.floor(Math.random() * 97)

  // Advances every string-performance phrase so the dynamic peak + breath slots
  // shift between phrases (slice 1 of the violin performer).
  private phraseCounter: number = 0

  // Advances every guitar-performance phrase — drives M2.6 slice 3 call-and-answer
  // (even = statement, odd = sparser answer).
  private guitarPhraseCounter: number = 0

  reseed(): void {
    this.sessionSeed = Math.floor(Math.random() * 97)
  }

  setInstrumentPerformer(instrumentId: InstrumentPerformerId | null): void {
    this.explicitPerformerId = instrumentId
    this.applyModeVoice(this.currentModeName)
    if (this.lastOutputGain > 0) this.scaleDirty = true
  }

  /**
   * Called by the orchestrator on each arrangement section change.
   * Sets the melody behavior (density) appropriate for the section.
   *
   * Previously verses forced Behavior.Hint ("sparse fills only — leaves
   * space for the rapper") which was correct for rap-with-vocals but felt
   * broken when the user is *not* actively rapping — melody just disappears.
   *
   * New approach: let getMelodyBehavior() decide for every section. It
   * already responds to voice activity (drops density when the rapper is
   * talking) and flow depth, so vocals get their space dynamically rather
   * than via a blanket per-section override.
   *
   * The lead instrument DOES NOT change — it is the signature of the beat.
   */
  onSectionChange(_sectionName: string, behaviorOverride?: MelodyBehavior): void {
    if (behaviorOverride) {
      this.sectionBehavior = behaviorOverride
    } else {
      // Let normal getMelodyBehavior() logic run for every section —
      // responds to voice activity, flow depth, and physics mode.
      this.sectionBehavior = null
    }
    
    // Force a fresh phrase rebuild on every section change so the melody
    // doesn't loop the same phrase across the whole arrangement.
    this.scaleDirty = true
    this.lastRebuildTime = -Infinity // bypass throttle for section changes

    // New section -> commit to a FRESH motif. Chorus/hook gets a deliberately
    // contrasting bank (fills = bigger, more active) so the song has shape
    // section-to-section; everything else uses the smoother ostinato/arp banks.
    this.currentSectionMotif = null
    // Clear cross-phrase continuity so the new section opens with a deliberate
    // register choice (octave selected by mode hash) rather than continuing from
    // wherever the previous section's phrase happened to land.
    this.lastPhraseFinalMidi = null
    const isHook = /chorus|hook|drop/i.test(_sectionName)
    this.preferredMotifBankKey = isHook ? 'fills' : null  // null = existing default choice

    // Optional instrument hand-off between sections (default OFF).
    if (this.melodySectionHandoffEnabled) {
      const voice = assignMelodyVoice(_sectionName, this.sessionSeed, this.availablePerformerIds())
      if (voice && voice !== this.explicitPerformerId) this.setInstrumentPerformer(voice)
    }
  }

  /** Performer ids the melody may hand off to. Stub returns the current one only
   *  until a richer catalog is wired; keeps hand-off safe + deterministic. */
  private availablePerformerIds(): InstrumentPerformerId[] {
    return this.explicitPerformerId ? [this.explicitPerformerId] : []
  }

  /**
   * Intelligently picks from GLOBAL_VOICES based on performer features
   * (Aggressive rap = 808s/pianos, softer = rhodes/pads)
   */
  /** Rebuild the performer voice (e.g. after real samples finish loading). */
  refreshVoice(): void {
    this.applyModeVoice(this.currentModeName)
  }

  /**
   * Conductor Duet — answer the MC with a short ascending lick (call-and-response)
   * cued in the gap after a phrase. A one-shot on the active lead voice, OUTSIDE
   * the looping phrase Part, built from the current chord tones so it agrees with
   * the harmony. Lifted an octave for a bright "answer" register that sits above
   * the comp. Never throws — a not-ready voice just drops the lick.
   */
  triggerAnswerLick(time: number, velocity: number): void {
    const tones = getConductor().chordTones()   // MIDI, ~octave 4
    if (tones.length === 0) return
    const voice = this.isSamplerReady() ? this.synth : this.fallbackSynth
    const vel = Math.max(0.1, Math.min(1, velocity))
    let eighth = 0.25
    try { eighth = Tone.Time('8n').toSeconds() } catch { /* keep default */ }
    // Up to 3 chord tones, ascending, an octave up — each an 8th apart, building
    // toward the top note as the answer's accent.
    const pick = tones.slice(0, 3).map((m) => m + 12)
    pick.forEach((m, i) => {
      const raw = Tone.Frequency(m, 'midi').toNote()
      const note = this.currentPerformer ? conformNoteToInstrument(raw, this.currentPerformer) : raw
      try {
        voice.triggerAttackRelease(note, '8n', Math.max(0, time + i * eighth), vel * (0.85 + i * 0.06))
      } catch { /* not ready / collision — drop this note of the lick */ }
    })
  }

  private applyModeVoice(mode: string): void {
    {
    const performer = selectInstrumentPerformer({
      role: 'lead',
      mode,
      energy: this.lastPerformerEnergy,
      brightness: this.lastPerformerBrightness,
      explicitId: this.explicitPerformerId ?? undefined,
    })
    this.currentPerformer = performer
    this.currentVoiceName = performer.name

    if (!this.articulationOverridden) {
      this.currentArticulationId = performer.defaultLeadArticulation
      this.lastModeForArticulation = mode
    }

    // Resolve the desired voice. Prefer the real recorded multisample (e.g.
    // Sonatina violin) over the thin GM soundfont; GM is the graceful fallback.
    const realNotes = getRealInstrumentNotes(performer)
    const voiceKey  = realNotes ? `real:${performer.realInstrument}` : `gm:${performer.samplerPreset}`
    const targetVol = this.boostLeadGainDb(performer.volume)

    // Family-dependent FX always track the current performer.
    this.chorus.wet.rampTo(performer.family === 'wind' || performer.family === 'bowed' ? 0.28 : 0.18, 0.5)
    this.reverb.decay = performer.family === 'wind' || performer.family === 'bowed' ? 1.6 : 1.0
    this.delay.feedback.rampTo(performer.family === 'plucked' ? 0.12 : 0.08, 0.5)

    // Same instrument already active → just retrim and bail. Recreating the
    // sampler would re-download it and leave the silent fallback synth playing
    // in the gap — the exact reason mode wiggles dropped the real instrument to
    // a synth. No churn when the instrument hasn't actually changed.
    if (voiceKey === this.currentVoiceKey && this.samplerCache.has(voiceKey)) {
      this.synth.volume.rampTo(targetVol, 0.1)
      return
    }

    const oldSynth = this.synth
    try {
      oldSynth.volume.cancelScheduledValues(Tone.now())
      oldSynth.releaseAll()
      oldSynth.disconnect()
    } catch { /* */ }
    // Dispose the previous voice only if it is NOT a cached sampler we keep
    // alive for reuse (the initial default PolySynth is not cached → disposed).
    const oldIsCached = this.samplerCache.get(this.currentVoiceKey ?? '') === oldSynth
    if (!oldIsCached) {
      setTimeout(() => { try { oldSynth.dispose() } catch { /* */ } }, 100)
    }

    // Reuse the cached, already-loaded sampler when we have one — instant real
    // instrument, no reload gap. Only build (and load) a voice the first time.
    let voice = this.samplerCache.get(voiceKey) ?? null
    if (voice) {
      voice.volume.value = targetVol
    } else {
      voice = realNotes
        ? createMultisampleSampler(realNotes, performer.envelope, targetVol)
        : createSoundfontSampler(performer.samplerPreset, performer.envelope, targetVol)
      this.samplerCache.set(voiceKey, voice)
    }
    this.synth = voice
    this.currentVoiceKey = voiceKey
    this.synth.connect(this.vibrato)

    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.debug(`Melody performer: ${performer.name} [${voiceKey}]`)
    }
    }
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    if (this._loopMode) return
    this.currentPresence = physics.presence
    this.voiceActive     = physics.voiceActive
    this.flowDepth       = organism.flowDepth
    // Sub-genre swing (pushed by the orchestrator, matches the DRUM grid) wins;
    // the mode table is only the fallback before the first sub-genre sync.
    this.currentSwing    = this.subGenreSwing ?? MelodyGenerator.MODE_SWING[physics.mode.toString()] ?? 0.35
    this.currentModeName = physics.mode.toString()

    // Auto-apply mode-default articulation if user/warmup hasn't overridden it.
    const modeStr = physics.mode.toString()
    if (!this.articulationOverridden && modeStr !== this.lastModeForArticulation) {
      this.currentArticulationId = defaultMelodyArticulation(modeStr)
      this.lastModeForArticulation = modeStr
    }

    // Section behavior overrides normal behavior logic so the arrangement
    // can enforce Rest in intro/breakdown and Hint in verse regardless of
    // voice energy — the drums and space ARE the arrangement in those sections.
    const newBehavior = this.sectionBehavior !== null
      ? this.sectionBehavior
      : getMelodyBehavior(physics.mode, physics.voiceActive, organism.flowDepth)

    let shouldRebuild = false
    if (newBehavior !== this.currentBehavior) {
      if (this.pendingBehavior === newBehavior) {
        this.pendingBehaviorFrames++
        if (this.pendingBehaviorFrames >= MelodyGenerator.BEHAVIOR_DEBOUNCE_FRAMES) {
          this.lastBehavior    = this.currentBehavior
          this.currentBehavior = newBehavior
          this.pendingBehavior = null
          this.pendingBehaviorFrames = 0
          shouldRebuild = true
        }
      } else {
        this.pendingBehavior = newBehavior
        this.pendingBehaviorFrames = 1
      }
    } else {
      this.pendingBehavior = null
      this.pendingBehaviorFrames = 0
    }

    // Defer scaleDirty clear until rebuildPhrase reports success. Without this
    // guard, the 600ms throttle inside rebuildPhrase can silently consume a
    // user-initiated scale/intent change: scaleDirty gets cleared here, then
    // rebuildPhrase early-returns due to throttle, and the signal is lost
    // forever — the melody keeps playing the old scale's pre-baked notes.
    const scaleWasDirty  = this.scaleDirty
    const phraseWasDirty = this.phraseDirty
    if (scaleWasDirty)  shouldRebuild = true
    if (phraseWasDirty) shouldRebuild = true

    if (shouldRebuild) {
      const rebuilt = this.rebuildPhrase(physics, organism)
      if (rebuilt && scaleWasDirty)  this.scaleDirty  = false
      if (rebuilt && phraseWasDirty) this.phraseDirty = false
    }

    // Composer's role caps activity; reactive curve adds feel under the ceiling.
    const targetLevel = this.computeTargetLevel(organism, newBehavior) * this.roleCeiling()
    this.activityLevel += this.smoothingCoeff(100) * (targetLevel - this.activityLevel)
    this.setOutputLevel(this.activityLevel)

    // Update Phrasing: Vibrato depth scales with performer energy.
    // Tone.Vibrato.depth is 0–1; cap around 0.06 so high energy adds breath
    // without sounding seasick.
    this.vibrato.depth.rampTo(this.lastPerformerEnergy * 0.06, 0.4)
  }

  private enabled: boolean = true

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.reset()
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
    if (!this.enabled) return
    if (to === OState.Dormant || to === OState.Awakening) {
      this.stopPart()
      this.activityLevel = 0
      return
    }
    if (to === OState.Breathing || to === OState.Flow) {
      this.currentScale = MODE_SCALES[physics.mode] ?? MODE_SCALES.glow
      
      // Only re-apply voice if the mode has changed to prevent glitchy 
      // audio dropouts during rapid state transitions.
      const newMode = physics.mode.toString()
      if (newMode !== this.currentModeName || !this.synth) {
        this.applyModeVoice(newMode)
      }

      // Immediately build a phrase so melody plays from beat 1.
      // Without this, processFrame's debounce delays the first notes by 3+ frames.
      const startBehavior = to === OState.Flow ? MelodyBehavior.Lead : MelodyBehavior.Hint
      
      // Always clear throttle and rebuild if we are entering a behavior that 
      // should produce sound, or if we are currently silent.
      if (this.currentBehavior !== startBehavior || this.part === null) {
        this.currentBehavior = startBehavior
        this.lastRebuildTime = -Infinity // clear throttle so rebuild goes through
        this.rebuildPhrase(physics, {
          current: to,
          flowDepth: to === OState.Flow ? 0.5 : 0,
          breathingWarmth: 0.8,
        } as any)
      }
    }
  }

  reset(): void {
    this.stopPart()
    this.activityLevel   = 0
    this.currentBehavior = MelodyBehavior.Rest
    this.currentScale    = MODE_SCALES.glow
    this.hasStartedPlayback = false
    this.lastRebuildTime = -Infinity
    this.sectionBehavior = null
    this.lastNoteEndSec  = 0
    this.setOutputLevel(0)
  }

  // ── Instrumental Duet signal ─────────────────────────────────────────
  // Audio-clock time (seconds) when the melody's most recent note ends.
  // 0 = the melody hasn't played yet this run (orchestrator ignores it).
  private lastNoteEndSec = 0

  getLastNoteEndSec(): number { return this.lastNoteEndSec }

  applyPitchOffset(semitones: number): void {
    this.pitchOffsetSemitones = Math.round(semitones)
  }

  setRootAndScale(rootPitchClass: number, intervals: number[]): void {
    const newRoot  = ((rootPitchClass % 12) + 12) % 12
    const changed  = newRoot !== this.rootPitchClass
                  || JSON.stringify(intervals) !== JSON.stringify(this.currentScale)
    if (!changed) return
    this.rootPitchClass = newRoot
    this.currentScale   = intervals
    this.scaleDirty     = true
  }

  // setCurrentChord(chord, rootPC) was removed in Phase 4 — Conductor is the
  // sole chord source. Melody reads its scale, key, and chord-tones via the
  // conductor.onChordChange subscription in the constructor (syncFromConductor).

  applyVolumeMultiplier(multiplier: number): void {
    this.volumeMultiplier = Math.max(0, multiplier)
    this.setOutputLevel(this.activityLevel)
  }

  private computeTargetLevel(organism: OrganismState, behavior: MelodyBehavior): number {
    if (organism.current === OState.Dormant)   return 0
    if (organism.current === OState.Awakening) return 0
    if (behavior === MelodyBehavior.Rest)      return 0

    switch (behavior) {
      case MelodyBehavior.Hint:    return 0.35 * organism.breathingWarmth
      case MelodyBehavior.Respond: return 0.60 + (0.15 * organism.flowDepth)
      case MelodyBehavior.Lead:    return 0.75 + (0.20 * organism.flowDepth)
      default:                     return 0
    }
  }

  /**
   * Build and schedule the next melodic phrase.
   *
   * Returns `true` if the rebuild executed (phrase committed, or intentional
   * Rest stop). Returns `false` ONLY when the 600ms throttle blocked execution
   * — `processFrame` uses this to preserve `scaleDirty` so user-initiated
   * emotional/scale changes are not silently consumed by the throttle race.
   *
   * The seamless handoff (oldPart.stop(startAt) → new part.start(startAt))
   * guarantees the previous Tone.Part is fully stopped and disposed before
   * the new one fires its first event — there is no event overlay on a
   * running buffer.
   */
  private rebuildPhrase(physics: PhysicsState, _organism: OrganismState): boolean {
    if (this._loopMode) return false
    const now = performance.now()
    if (now - this.lastRebuildTime < MelodyGenerator.MIN_REBUILD_INTERVAL_MS) {
      return false   // throttled — caller should preserve any pending dirty flags
    }
    this.lastRebuildTime = now

    if (this.currentBehavior === MelodyBehavior.Rest) {
      this.stopPart()
      return true    // intentional stop — dirty flags can be cleared (stopPart clears busy slots)
    }

    const lengths = PHRASE_LENGTHS[this.currentBehavior]
    if (!lengths || lengths.length === 0) return true

    const selectedLength = lengths[Math.floor(Math.random() * lengths.length)]
    // Leads play ≥4-bar phrases (64 sixteenths). The chord cycle is 4 bars
    // (advanceChord fires at barNumber % 4 === 3 → lands on bar 4). Aligning
    // phrases to the chord cycle means the melody starts a new idea exactly
    // when the harmony changes — the fundamental unit of musical coherence.
    // A 2-bar phrase would start mid-cycle 50% of the time, making the melody
    // feel disconnected from the harmony even though both are in the same key.
    let phraseLength = this.currentBehavior === MelodyBehavior.Lead
      ? Math.max(64, selectedLength)
      : selectedLength
    // Bowed strings: same 4-bar minimum so violin/cello phrases align with
    // chord cycles and breathe at the same time as the harmony shifts.
    if (this.isBowedString()) phraseLength = Math.max(64, phraseLength)
    let notes          = this.generatePhrase(phraseLength, physics)

    // Pro-instruments M2.5 slice 1: a real string player breathes + shapes
    // dynamics. Gated to bowed strings (violin/cello) so other leads are untouched.
    if (this.isBowedString()) {
      // §4 Voice-leading FIRST (what to play): keep the line mostly stepwise and
      // in a sane register so it sings instead of zig-zagging high↔low across
      // octaves. Pitch classes (harmony) are preserved — only octaves move.
      // ~MIDI 55 (G3) floor, ~MIDI 81 (A5, ≈880Hz) ceiling = a singing violin
      // register with no shrieking highs. THEN shape dynamics on the smoothed line.
      notes = applyVoiceLeading(notes, { maxLeapSemitones: 5, floorMidi: 55, ceilingMidi: 81 })
      this.applyStringPerformance(notes)
    }

    // Pro-instruments M2.6 — the Guitar Player. Gated to guitar voices so other
    // leads are untouched. Order matters: develop the LINE first (what to play),
    // then shape dynamics (how loud) — articulations (how to play) come below.
    if (this.isGuitar()) {
      // Slice 3: call-and-answer development — odd phrases answer the statement
      // with more space so consecutive phrases don't loop identically.
      notes = developGuitarPhrase(notes, this.guitarPhraseCounter++)
      // Slice 1: arch swell + downbeat picking accents (non-destructive velocity).
      notes = shapeGuitarDynamics(notes)
    }

    // Pro-instruments M2.6 slice 2: guitar idiom, per note. Choose a note-based
    // ornament per note (bend into peaks, hammer-on stepwise, release at the end)
    // — applied via the existing articulation engine, no audio-chain change.
    // Computed AFTER dynamics so accent velocities drive the bend choice.
    const guitarArtIds = this.isGuitar() ? planGuitarArticulations(notes) : null

    if (notes.length === 0) {
      this.busySlots16ths = []
      return true
    }

    const startAt = getLivePartStart(this.hasStartedPlayback)

    // Seamless handoff: schedule old Part to stop exactly when the new one
    // starts so there is no silence gap on section changes. If transport is
    // not running (first build), stop the old part immediately.
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

    const loopBars = Math.max(1, Math.ceil(phraseLength / 16))

    const events = notes.map((n, i) => ({
      time: quantizeGridTime(n.time, loopBars),
      note: n.pitch,
      dur: n.duration,
      vel: n.velocity,
      art: guitarArtIds ? guitarArtIds[i] : undefined,
    }))
    this.busySlots16ths = extractBusySlots16ths(events)
    this.emitNoteEvents(events)

    this.part = new Tone.Part((time, event) => {
      // Instrumental Duet signal: when this note ENDS, the melody may be
      // resting — the orchestrator watches this to cue chord answers into the
      // rests between motifs (see conductor/duet.ts planInstrumentalAnswer).
      try {
        this.lastNoteEndSec = Math.max(this.lastNoteEndSec, time + Tone.Time(event.dur).toSeconds())
      } catch { /* malformed duration — skip the signal, never the note */ }

      const presenceDuck = Math.max(0.3, 1 - this.currentPresence * 0.5)
      const voice = this.isSamplerReady() ? this.synth : this.fallbackSynth
      const finalVel = event.vel * presenceDuck
      const playableNote = this.currentPerformer
        ? conformNoteToInstrument(event.note, this.currentPerformer)
        : event.note

      // Guitar (M2.6 slice 2): a per-note idiomatic ornament overrides the global
      // articulation. Non-guitar leads keep their single currentArticulationId.
      const artId = (event.art as string | undefined) ?? this.currentArticulationId

      // Slice 2 — expressive vibrato. Done at the top so it applies on BOTH the
      // fast-path and the articulation path (violin runs legato-slur, not default).
      if (this.isBowedString()) this.shapeVibrato(event.dur, Math.max(0, time))

      // Fast-path: default articulation skips the transform for zero overhead.
      if (artId === DEFAULT_ARTICULATION_ID) {
        voice.triggerAttackRelease(playableNote, event.dur, Math.max(0, time), finalVel)
        return
      }

      // Decode sixteenthPos from event.time (bar:beat:sub) for articulation context.
      const timeStr = String(event.time ?? '0:0:0')
      const parts = timeStr.split(':')
      const beat = parseFloat(parts[1] ?? '0')
      const sub  = parseFloat(parts[2] ?? '0')
      const sixteenthPos = Math.floor(beat * 4 + sub) % 16
      const isDownbeat = sixteenthPos % 4 === 0

      const artCtx: ArticulationContext = {
        tempo: Tone.getTransport().bpm.value || 90,
        energy: Math.max(0, Math.min(1, finalVel)),
        isDownbeat,
        sixteenthPos,
      }

      const scheduled = applyArticulation(
        artId,
        playableNote,
        event.dur,
        finalVel,
        artCtx
      )
      for (const n of scheduled) {
        const note = this.conformArticulatedNote(n.note)
        // Clamp to ≥0 — float-negative times (and pre-beat offsets) throw
        // Tone's "value must be within [0, Infinity]" and silence the voice.
        const t = Math.max(0, time + n.timeOffset)
        voice.triggerAttackRelease(note, n.duration, t, n.velocity)
      }
    }, events)

    this.part.loop    = true
    this.part.loopEnd = `${loopBars}m`
    // Phase-aligned: continue multi-bar phrases from the current musical bar
    // instead of restarting at bar 0 on every chord-change rebuild.
    this.part.start(startAt, livePartStartOffset(startAt, loopBars))
    this.hasStartedPlayback = true

    // Schedule periodic phrase refreshes once per generator lifetime. The
    // existing Tone.Part loop keeps audio continuous; this just flips a flag
    // so the NEXT processFrame rebuilds fresh motifs. Without this, behavior
    // and section can sit still indefinitely and the melody plays the same
    // notes forever.
    if (this.phraseRefreshEventId === null) {
      const refreshInterval = `${MelodyGenerator.PHRASE_REFRESH_BARS}m`
      this.phraseRefreshEventId = Tone.getTransport().scheduleRepeat(
        () => { this.phraseDirty = true },
        refreshInterval,
        refreshInterval,
      )
    }
    return true
  }

  /** True when the current lead voice is a bowed string (violin / cello / viola). */
  private isBowedString(): boolean {
    return /violin|cello|viola|string/i.test(this.currentVoiceName)
  }

  /** True when the current lead voice is a guitar (nylon / clean / distortion). */
  private isGuitar(): boolean {
    return /guitar|nylon/i.test(this.currentVoiceName)
  }

  /**
   * Pro-instruments spec M2.5, slice 2 — expressive vibrato.
   *
   * A real violinist doesn't vibrate every note evenly: fast passing notes are
   * dead-straight, and on a held note the vibrato BLOOMS IN shortly after the
   * bow lands (delayed onset) and widens with the note's length. Drives the
   * shared Tone.Vibrato depth signal per note at the scheduled audio time.
   */
  private shapeVibrato(dur: Tone.Unit.Time, time: number): void {
    const depth = this.vibrato.depth
    let durSec = 0.25
    try { durSec = Tone.Time(dur).toSeconds() } catch { /* keep default */ }

    try {
      depth.cancelScheduledValues(time)
      if (durSec < 0.22) {
        // Fast passing note — straight tone, no vibrato.
        depth.setValueAtTime(0.012, time)
      } else {
        // Sustained note — straight attack, then vibrato blooms in and widens
        // with length (capped so it stays musical, not seasick).
        const target = Math.min(0.35, 0.16 + durSec * 0.12)
        const bloomAt = time + Math.min(0.35, durSec * 0.45)
        depth.setValueAtTime(0.02, time)
        depth.linearRampToValueAtTime(target, bloomAt)
      }
    } catch { /* signal busy / negative time — skip this note's vibrato shaping */ }
  }

  /**
   * Pro-instruments spec M2.5, slice 1 — the violin/string PERFORMER.
   *
   * A real string player does NOT play every slot at a flat dynamic and never
   * rests. This mutates the phrase in place to add the two most audible human
   * traits, and shifts them every phrase (phraseCounter) so consecutive phrases
   * don't feel identical:
   *   • velocity ARC — crescendo toward a phrase peak (~2/3 through), then ease
   *     back at the cadence, instead of a flat dynamic.
   *   • BREATH — drop a few weak interior notes to open space so the line lands
   *     and rings rather than filling every bar.
   * (Legato note-ring + vibrato/rubato are slice 2; idea-development is slice 3.)
   */
  private applyStringPerformance(notes: ScheduledNote[]): void {
    const n = notes.length
    if (n < 3) return
    this.phraseCounter++

    // DEVELOPMENT — a real soloist states an idea, then answers it / varies it /
    // builds on it; they don't replay it. Each phrase commits to a different
    // CHARACTER so a recurring motif is genuinely re-cast, not looped:
    //   0 statement  — as written, mid register, lightly thinned
    //   1 answer     — leaps an octave up, airier (more rests) = a question answered
    //   2 variation  — drops an octave, breathier, lower/darker restatement
    //   3 climb      — denser & driving, fewer rests, pushing to a peak
    const character = this.phraseCounter % 4

    // Register shift recasts the actual melodic line (conformNoteToInstrument in
    // the Part callback keeps it inside the violin's range).
    const octaveShift = character === 1 ? 12 : character === 2 ? -12 : 0
    if (octaveShift !== 0) {
      for (let i = 0; i < n; i++) {
        try { notes[i].pitch = Tone.Frequency(notes[i].pitch).transpose(octaveShift).toNote() }
        catch { /* leave the pitch as-is if it can't be parsed */ }
      }
    }

    // Velocity ARC — crescendo toward a drifting peak, ease at the cadence.
    const peak = 0.58 + 0.12 * ((this.phraseCounter % 3) / 2)
    for (let i = 0; i < n; i++) {
      const pos = i / (n - 1)
      const g = pos <= peak
        ? 0.78 + 0.22 * (pos / peak)
        : 1.0 - 0.20 * ((pos - peak) / (1 - peak))
      notes[i].velocity = Math.max(0.05, Math.min(1, notes[i].velocity * g))
    }

    // BREATH — rest weak interior notes (never the first/last). Density varies by
    // character: the answer is airy, the climb is driving.
    const dropMod = character === 1 ? 3 : character === 3 ? 6 : 4  // smaller = more rests
    const kept: ScheduledNote[] = []
    for (let i = 0; i < n; i++) {
      const interior = i > 0 && i < n - 1
      const weak = notes[i].velocity < 0.55
      const restHere = interior && weak && ((i + this.phraseCounter) % dropMod === 0)
      if (!restHere) kept.push(notes[i])
    }
    if (kept.length >= 2 && kept.length < n) {
      notes.length = 0
      notes.push(...kept)
    }
  }

  private conformArticulatedNote(note: string | number): string | number {
    if (!this.currentPerformer) return note

    const pitch = this.currentPerformer.family === 'wind'
      ? snapNoteToScale(note, this.rootPitchClass, this.currentScale, this.pitchOffsetSemitones)
      : note

    return conformNoteToInstrument(pitch, this.currentPerformer)
  }

  private generatePhrase(length16ths: number, physics: PhysicsState): ScheduledNote[] {
    const notes: ScheduledNote[] = []
    const octaves = MODE_OCTAVES[physics.mode] ?? [4, 5]

    // Cross-phrase continuity: pick the octave that puts the root nearest to where
    // the previous phrase ended. Without this every phrase restarts from the same
    // home register regardless of where the melody had climbed or descended —
    // the "gets something going then starts over" feeling the user heard.
    // Falls back to the deterministic mode hash if no previous phrase exists yet.
    let octave: number
    if (this.lastPhraseFinalMidi !== null) {
      const refMidi = this.lastPhraseFinalMidi
      octave = octaves.reduce((best, oct) => {
        const bestDist = Math.abs(12 * best + this.rootPitchClass - refMidi)
        const thisDist = Math.abs(12 * oct  + this.rootPitchClass - refMidi)
        return thisDist < bestDist ? oct : best
      }, octaves[0])
    } else {
      const modeHash = physics.mode.toString().length
      octave = octaves[0] + (modeHash % (octaves[1] - octaves[0] + 1))
    }
    
    const isHint  = this.currentBehavior === MelodyBehavior.Hint
    const velocityEnergy = this.voiceActive
      ? this.lastPerformerEnergy
      : Math.max(0.75, this.lastPerformerEnergy)

    // CALL & RESPONSE: Deterministic selection based on chord root and absolute
    // bar, mixed with a per-start session seed — pure (root, bar) seeding made
    // every cold start play the EXACT same phrase note-for-note.
    const currentBar = getConductor().getScoreFrame().bar
    const chordSeed = (this.rootPitchClass + (this.currentChordTones[0] ?? 0) + currentBar + this.sessionSeed) % 10
    
    // Singing leads (violin/cello/wind/brass) draw from the lyrical bank — in
    // auto AND live — instead of bell arps. Non-lyrical leads keep the existing
    // arps/fills/ostinatos behavior. (preferredMotifBankKey = chorus/hook override.)
    const bankKey = selectMotifBankKey({
      family: this.currentPerformer?.family,
      voiceActive: this.voiceActive,
      preferredBankKey:
        this.preferredMotifBankKey && HIP_HOP_MOTIFS[this.preferredMotifBankKey]
          ? this.preferredMotifBankKey
          : null,
      chordSeed,
    })
    const motifBank: MelodyMotif[] = HIP_HOP_MOTIFS[bankKey] ?? HIP_HOP_MOTIFS.ostinatos
    
    // Map `this.currentChordTones` (0-11 pitch classes) to scale indices dynamically
    const chordDegs: number[] = []
    if (this.currentChordTones.length > 0) {
      for (let d = 0; d < this.currentScale.length; d++) {
        const pc = (this.rootPitchClass + this.currentScale[d]) % 12
        if (this.currentChordTones.includes(pc)) {
          chordDegs.push(d)
        }
      }
    }
    // Fallback if no chord info: use 0, 2, 4 (root, 3rd, 5th of scale)
    if (chordDegs.length === 0) {
      chordDegs.push(0, 2, 4)
    }

    // 'beautiful' intent: bias chord-tone selection toward 7ths (degree 6)
    // and 9ths (degree 8 — i.e. the 2nd up an octave). These tensions are
    // what give Maj7 / min9 voicings their lush character. We append rather
    // than replace so the existing chord-tone framework is preserved.
    if (this.emotionalIntent === 'beautiful') {
      chordDegs.push(6, 8)
    }

    // Conductor Part 3 V3 — the comp's guide tones (3rd/7th) as scale degrees, so
    // the melody can prefer their COMPLEMENT (root/5th/extensions) on strong beats
    // and stop mud-doubling the colour the chords already state. 'beautiful' intent
    // is the deliberate exception — it leans INTO the lush 7th/9th, so leave its
    // preferred set wide open (no complement filtering).
    const guideDegs: number[] = []
    if (this.emotionalIntent !== 'beautiful' && this.currentGuideTones.length > 0) {
      for (let d = 0; d < this.currentScale.length; d++) {
        const pc = (this.rootPitchClass + this.currentScale[d]) % 12
        if (this.currentGuideTones.includes(pc)) guideDegs.push(d)
      }
    }
    const preferredDegs = chordDegs.filter((d) => !guideDegs.includes(d))

    const performer = this.currentPerformer
    const isBowedLead = performer?.family === 'bowed'
    const melodicOctave = isBowedLead
      ? Math.min(octaves[1], Math.max(octaves[0], (performer?.preferredOctave ?? octave + 1) - 1))
      : octave

    const degreeToPitch = (degIndex: number, transposeOct: number = 0): string => {
      const normDeg = ((degIndex % this.currentScale.length) + this.currentScale.length) % this.currentScale.length
      const octMidiOffset = Math.floor(degIndex / this.currentScale.length) * 12
      const semitone = this.currentScale[normDeg]
      const midi = ((melodicOctave + transposeOct) * 12) + 12 + semitone + octMidiOffset + this.rootPitchClass + this.pitchOffsetSemitones
      return Tone.Frequency(midi, 'midi').toNote()
    }

    const renderMotif = (m: MelodyMotif, cursorStart: number, transposeOct: number, forceResolve = false) => {
      const out: ScheduledNote[] = []
      let c = cursorStart
      for (const step of m.steps) {
        if (c >= length16ths) break
        
        let degIndex = 0
        if (step.isChordTone) {
           // Map 0,1,2 to actual scale degrees of the current chord tones.
           // Normalised modulo so inverted motifs (negative step.index) still
           // land on a valid chord tone instead of reading off the array (NaN).
           const len = chordDegs.length
           const chordToneIndex = ((step.index % len) + len) % len
           const octOffset = Math.floor(step.index / len)
           degIndex = chordDegs[chordToneIndex] + (octOffset * this.currentScale.length)
        } else {
           // Just a relative scale degree
           degIndex = chordDegs[0] + step.index
        }

        // Phrase arc: bias the line upward toward a single climax ~2/3 in —
        // but NEVER the cadence note, which must land "home", not on the curve.
        const posFraction = length16ths > 0 ? c / length16ths : 0
        if (!forceResolve) degIndex += contourOffset(posFraction, 2)
        // Make a note that lands on a downbeat — OR the forced cadence — a CHORD
        // TONE (stable), leaving passing/neighbour tones for the off-beats. V3:
        // among the chord tones, prefer the ones that COMPLEMENT the comp's guide
        // tones so the lead and the chords spell the harmony together.
        degIndex = resolveDegreeComplementing(degIndex, chordDegs, preferredDegs, this.currentScale.length, forceResolve || isStrongBeat(c))

        const pitch = degreeToPitch(degIndex, transposeOct)
        
        // Rhythmic-density contrast ("fast bottom, slow top"): drums carry the
        // 8th/16th momentum; the melody carries emotion and SPACE. When nobody
        // is rapping, the lead sings in longer values (one notch toward legato)
        // instead of competing with the hats — same mapping the 'sad' intent
        // always used. With a live vocalist the melody keeps its tighter
        // rhythmic feel since it's a backing texture there.
        //
        // EXCEPT sustained families (bowed/wind/brass): their samples already
        // ring at full level for the whole duration, so stretched durations
        // OVERLAP — the previous note's tail re-emerges when the new note
        // ends ("the violin goes back to the previous note mid-phrase").
        // Decaying instruments (keys/pluck) get the stretch; sustainers keep
        // natural motif lengths and let the bow do the singing.
        const sustainedFamily = this.currentPerformer?.family === 'bowed'
          || this.currentPerformer?.family === 'wind'
          || this.currentPerformer?.family === 'brass'
        const sadLegato = (this.emotionalIntent === 'sad'
          || (!this.voiceActive && this.currentBehavior === MelodyBehavior.Lead))
          && !sustainedFamily
        const durStr = sadLegato
          ? (step.dur16ths <= 1 ? '8n'
            : step.dur16ths <= 2 ? '8n.'
            : step.dur16ths <= 3 ? '4n'
            : step.dur16ths <= 4 ? '4n.'
            : step.dur16ths <= 6 ? '2n'
            : '2n.')
          : (step.dur16ths <= 1 ? '16n'
            : step.dur16ths <= 2 ? '8n'
            : step.dur16ths <= 3 ? '8n.'
            : step.dur16ths <= 4 ? '4n'
            : step.dur16ths <= 6 ? '4n.'
            : '2n')

        const bar  = Math.floor(c / 16)
        const beat = Math.floor((c % 16) / 4)
        const sub  = c % 4
        // Swing the off-16ths (subs 1/3) by the band's shared amount — the
        // melody computed currentSwing for years but never applied it, so its
        // syncopated notes landed STRAIGHT (early) against the swung drums
        // and bass: a persistent subtle "off" feel on every off-beat.
        const swungSub = (sub === 1 || sub === 3) ? sub + this.currentSwing : sub
        const time = `${bar}:${beat}:${swungSub.toFixed(2)}`

        const accentBase = sub === 0 ? 0.78 : sub === 2 ? 0.60 : 0.42

        // Deterministic velocity seeded by position and energy
        const seed = (bar * 16) + (beat * 4) + sub
        const hash = Math.sin(seed * 9.87) * 1000
        const pseudoRand = hash - Math.floor(hash)

        let vel = Math.min(1, Math.max(0.22, (accentBase * velocityEnergy) + (pseudoRand - 0.5) * 0.12))

        // Emotional-intent velocity shaping. Applied after the deterministic
        // hash so the per-position pseudo-random texture is preserved, just
        // mapped into a different dynamic range.
        if (this.emotionalIntent === 'sad') {
          // Clamp to [0.4, 0.6] for the soft, contained dynamics of a
          // melancholy phrase. Width 0.2 keeps subtle accents alive.
          vel = 0.4 + (pseudoRand * 0.2)
        } else if (this.emotionalIntent === 'beautiful') {
          // Lush ceiling at 0.7, floor at 0.45 — soft and singing, never harsh.
          vel = 0.45 + (pseudoRand * 0.25)
        }

        out.push({ pitch, duration: durStr, velocity: vel, time })
        c += step.dur16ths
      }
      return { out, newCursor: c }
    }

    let cursor = 0
    let phraseIndex = 0
    // Space between motifs IS the musical statement — but a beat-and-a-half
    // gap after every short motif left the lead breathing more than playing.
    // Trimmed so the line stays present and continuous: Lead gets ~3/4 beat of
    // air, Respond a beat, Hint stays sparser (1.5 beats) since it's meant to
    // be a background suggestion, not a lead.
    const restLen = isHint ? 6 : this.currentBehavior === MelodyBehavior.Respond ? 4 : 3
    const maxIterations = Math.max(4, Math.ceil(length16ths / 2))

    // Commit to ONE motif for this section (picked once), then DEVELOP it across
    // the phrase — state the theme, then vary it (transpose / invert / augment).
    // This replaces the old "motif salad" that grabbed a different bank entry
    // every iteration, so nothing ever recurred and the line never cohered.
    if (!this.currentSectionMotif) {
      this.currentSectionMotif = motifBank[chordSeed % motifBank.length]
    }
    const baseMotif = this.currentSectionMotif
    const variations = pickPhraseVariations(this.sessionSeed + chordSeed, maxIterations)

    while (cursor < length16ths && phraseIndex < maxIterations) {
      const variation = variations[phraseIndex] ?? 'identity'
      const transposeAmount = variation === 'transpose' ? 1 + (chordSeed % 3) : 0
      const motif = developMotif(baseMotif, variation, transposeAmount)
      const transposeOct = this.currentBehavior === MelodyBehavior.Lead && phraseIndex % 4 === 3 ? 1 : 0
      const result = renderMotif(motif, cursor, transposeOct)

      notes.push(...result.out)

      const nextCursor = result.newCursor + restLen
      if (nextCursor <= cursor) break
      cursor = nextCursor
      phraseIndex += 1
    }

    if (this.currentBehavior === MelodyBehavior.Lead && notes.length <= 3 && length16ths >= 12) {
      // Answer with a VARIATION of the same committed motif (call-and-response on
      // one idea), not a different bank entry — keeps the section coherent.
      const answerMotif = developMotif(baseMotif, 'invert', 0)
      notes.push(...renderMotif(answerMotif, Math.floor(length16ths / 2), 0).out)
    }

    // Cadence: end the sentence on the chord root, held — a "period" so the
    // phrase resolves instead of just stopping when the bar runs out.
    // forceResolve=true so it lands on a chord tone (home), never on the contour.
    {
      const cad = cadenceStep(4)
      const cadCursor = Math.max(0, length16ths - cad.dur16ths)
      const cadResult = renderMotif({ name: 'cadence', steps: [cad] }, cadCursor, 0, true)
      notes.push(...cadResult.out)
    }

    // Safety net: if the generated phrase collapsed to a single pitch (motif
    // step.index aligned with chordDegs[0] for every step, or chord-tone
    // mapping returned only the root), fall back to a deterministic 4-bar
    // minor contour. Without this guard the listener can hear the engine
    // stuck on a single repeating note while the rest of the mix keeps moving.
    const uniquePitches = new Set(notes.map(n => n.pitch))
    if (uniquePitches.size <= 1) {
      return this.defaultMinorContour(length16ths, melodicOctave)
    }

    // Record where this phrase lands so the NEXT phrase can start near here
    // instead of jumping back to the fixed home register.
    const lastNote = notes[notes.length - 1]
    if (lastNote) {
      try {
        this.lastPhraseFinalMidi = Tone.Frequency(lastNote.pitch).toMidi()
      } catch { /* non-critical */ }
    }

    return notes
  }

  /**
   * Deterministic 4-bar (or shorter) minor contour:
   *   root – ♭3 – 5 – ♭7 – 5 – ♭3 – root
   * Used when the motif renderer collapses to a single repeated pitch.
   * Always plays in natural minor relative to the current rootPitchClass so
   * the contour fits with whatever harmony the chord generator is on.
   */
  private defaultMinorContour(length16ths: number, octave: number): ScheduledNote[] {
    const minor = MelodyGenerator.NATURAL_MINOR    // [0, 2, 3, 5, 7, 8, 10]
    const degreePattern = [0, 2, 4, 6, 4, 2, 0]    // 1-♭3-5-♭7-5-♭3-1
    const notes: ScheduledNote[] = []
    const stepSpacing = Math.max(4, Math.floor(length16ths / degreePattern.length))

    for (let i = 0; i < degreePattern.length; i++) {
      const c = i * stepSpacing
      if (c >= length16ths) break
      const deg = degreePattern[i]
      const semitone = minor[deg % minor.length] + Math.floor(deg / minor.length) * 12
      const midi = (octave * 12) + 12 + semitone + this.rootPitchClass + this.pitchOffsetSemitones
      const pitch = Tone.Frequency(midi, 'midi').toNote()
      const bar  = Math.floor(c / 16)
      const beat = Math.floor((c % 16) / 4)
      const sub  = c % 4
      notes.push({
        pitch,
        duration: '4n',
        velocity: this.emotionalIntent === 'sad' ? 0.5 : 0.6,
        time: `${bar}:${beat}:${sub}`,
      })
    }
    return notes
  }

  /** Public so the orchestrator can hard-cut the part on a live preset swap
   *  (see GeneratorOrchestrator.cutActivePartsForSwap). Otherwise internal. */
  /** Per-bar slots the current melody loop occupies — the orchestrator relays
   *  this to the chords (see GeneratorOrchestrator.syncLeadBusyToChords). */
  getBusySlots16ths(): number[] {
    return this.busySlots16ths
  }

  stopPart(): void {
    this.busySlots16ths = []
    if (this.part) {
      this.part.stop()
      this.part.dispose()
      this.part = null
    }
    if (this.phraseRefreshEventId !== null) {
      try { Tone.getTransport().clear(this.phraseRefreshEventId) } catch { /* */ }
      this.phraseRefreshEventId = null
    }
    this.phraseDirty = false
    try {
      this.synth.volume.cancelScheduledValues(Tone.now())
      this.synth.releaseAll()
    } catch { /* */ }
  }

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier * Math.min(2, this.volumeMultiplier)
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
    if (this.unsubscribeConductor) {
      this.unsubscribeConductor()
      this.unsubscribeConductor = null
    }
    // Dispose every cached sampler (includes the currently-active this.synth
    // when it's a cached voice), then clear the cache.
    for (const s of this.samplerCache.values()) {
      try { s.dispose() } catch { /* */ }
    }
    this.samplerCache.clear()
    this.currentVoiceKey = null
    this.vibrato.dispose()
    try { this.synth.dispose() } catch { /* already disposed via cache */ }
    this.fallbackSynth.dispose()
    this.chorus.dispose()
    this.dryBus.dispose()
    this.delaySend.dispose()
    this.reverbSend.dispose()
    this.delayReturnHP.dispose()
    this.reverbReturnHP.dispose()
    this.delay.dispose()
    this.reverb.dispose()
    this.output.dispose()
  }
}
