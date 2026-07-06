// Section 04 — Melody Generator

import * as Tone from 'tone'
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
import { selectMotifBankKey } from './melody/motifSelection'
import { planGuitarArticulations, developGuitarPhrase } from './melody/guitarPerformance'
import { buildFreeplayMelodyNotes, clearMelodyMotifs } from './freeplay/MelodyImproviser'
import { extractBusySlots16ths, getSessionSalt, hashString, mulberry32 } from './freeplay/utils'
import {
  getPerformerExpressionConfig,
  isSustainedPitch,
  shapePerformanceDynamics,
  applyBreathAndRests,
  phraseCharacterOf,
  developPhraseCharacter,
  type PhraseCharacter,
} from './melody/performerExpression'
import { applyVoiceLeading } from './melody/voiceLeading'

const normalizePitchClass = (pitchClass: number): number =>
  ((Math.round(pitchClass) % 12) + 12) % 12

export function snapNoteToScale(
  note: string | number,
  rootPitchClass: number,
  scaleIntervals: number[],
  pitchOffsetSemitones = 0,
  preferredDirection?: 'up' | 'down' | 'ascending' | 'descending',
): string | number {
  const midi = noteToMidi(note)
  if (midi == null || scaleIntervals.length === 0) return note

  const root = normalizePitchClass(rootPitchClass + pitchOffsetSemitones)
  const allowed = new Set(scaleIntervals.map(interval => normalizePitchClass(root + interval)))
  if (allowed.has(normalizePitchClass(midi))) return note

  for (let delta = 1; delta <= 6; delta++) {
    const lower = midi - delta
    const upper = midi + delta
    const lowerAllowed = allowed.has(normalizePitchClass(lower))
    const upperAllowed = allowed.has(normalizePitchClass(upper))

    if (lowerAllowed && upperAllowed) {
      if (preferredDirection === 'up' || preferredDirection === 'ascending') {
        return typeof note === 'number' ? upper : midiToNote(upper)
      } else if (preferredDirection === 'down' || preferredDirection === 'descending') {
        return typeof note === 'number' ? lower : midiToNote(lower)
      }
      const preferUpper = (midi % 2 === 0)
      const selected = preferUpper ? upper : lower
      return typeof note === 'number' ? selected : midiToNote(selected)
    }

    if (lowerAllowed) {
      return typeof note === 'number' ? lower : midiToNote(lower)
    }

    if (upperAllowed) {
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
  private busySlots16ths: number[] = []
  private lastNoteEndSec: number = 0
  // Set by onSectionChange: bias the chorus/hook to a contrasting bank.
  private preferredMotifBankKey: string | null = null
  // ── Freeplay (2026-07-04) ── melody now uses the shared improviser by
  // default. The authored HIP_HOP_MOTIFS renderer remains available as a
  // fallback/style source via setFreeplay(false).
  private freeplayEnabled = true
  private freeplayPhraseCounter = 0
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

  // Caching mapped chord degrees (Performance 19)
  private cachedChordDegs: number[] = []
  private cachedPreferredDegs: number[] = []

  // PRNG state (Quality 35)
  private rngState: number = 12345

  private seedRng(seed: number): void {
    this.rngState = seed === 0 ? 12345 : seed
  }

  private nextRandom(): number {
    this.rngState = (1664525 * this.rngState + 1013904223) % 4294967296
    return this.rngState / 4294967296
  }

  private updateChordDegreesCache(): void {
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
    // and 9ths (degree 8 — i.e. the 2nd up an octave).
    if (this.emotionalIntent === 'beautiful') {
      chordDegs.push(6, 8)
    }

    const guideDegs: number[] = []
    if (this.emotionalIntent !== 'beautiful' && this.currentGuideTones.length > 0) {
      for (let d = 0; d < this.currentScale.length; d++) {
        const pc = (this.rootPitchClass + this.currentScale[d]) % 12
        if (this.currentGuideTones.includes(pc)) guideDegs.push(d)
      }
    }
    const preferredDegs = chordDegs.filter((d) => !guideDegs.includes(d))

    this.cachedChordDegs = chordDegs
    this.cachedPreferredDegs = preferredDegs
  }

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
      this.currentScale = [...MelodyGenerator.NATURAL_MINOR]
    }
    this.scaleDirty = true                       // rebuild on next processFrame
    this.lastRebuildTime = -Infinity             // clear 600ms throttle — user
                                                 // emotional commits must take
                                                 // effect immediately, not get
                                                 // silently consumed by a recent
                                                 // chord-change-triggered rebuild
    this.updateChordDegreesCache()
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
    this.seedRng(this.sessionSeed)

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
      this.currentScale = [...conductor.scaleIntervals()]
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

    this.updateChordDegreesCache()

    // Authored-motif mode keeps the legacy behavior: rebuild only when the KEY
    // or SCALE changes (sub-genre swap, explicit key change, new progression).
    //
    // Freeplay mode is generated from the current live chord, so a plain chord
    // advance must schedule a fresh phrase at the next boundary. Otherwise the
    // melody keeps targeting the previous chord while harmony has moved.
    const progressionVersion = conductor.getProgressionVersion()
    const progressionChanged = progressionVersion !== this.lastProgressionVersion
    if (progressionChanged) {
      this.lastProgressionVersion = progressionVersion
    }
    if (triggerRebuild && (progressionChanged || this.freeplayEnabled)) {
      this.scaleDirty = true
      if (this.freeplayEnabled) this.lastRebuildTime = -Infinity
    }
  }

  private buildDefaultSynth(): Tone.PolySynth {
    // 6 voices dropped notes when ornaments (trill/grace) overlapped a sustained
    // legato phrase. 12 covers the realistic worst case without bloating CPU.
    return new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 12,
      harmonicity: 2,
      modulationIndex: 1.5,
      oscillator:    { type: 'sine' },
      modulation:    { type: 'triangle' },
      envelope:      { attack: 0.08, decay: 0.3, sustain: 0.35, release: 1.2 },
      modulationEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.3, release: 0.8 },
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

  /** Zeroed on every organism start so a pinned freeplay seed replays the same take. */
  resetFreeplayCounter(): void {
    this.freeplayPhraseCounter = 0
    clearMelodyMotifs()
  }

  /** Freeplay on/off. Rebuild immediately so the switch is audible. */
  setFreeplay(enabled: boolean): void {
    if (this.freeplayEnabled === enabled) return
    this.freeplayEnabled = enabled
    this.currentSectionMotif = null
    this.scaleDirty = true
    this.lastRebuildTime = -Infinity
  }

  // Per-start phrase variety — rolled by the orchestrator on each cold start
  // so two sessions over the same progression don't play identical phrases.
  private sessionSeed: number = Math.floor(Math.random() * 97)

  // Advances every string-performance phrase so the dynamic peak + breath slots
  // shift between phrases (slice 1 of the violin performer).
  private phraseCounter: number = 0
  // Cross-phrase voice-leading continuity (2026-07-06 addendum): the previous
  // phrase's last note, threaded in as the fold seed so the next phrase
  // continues instead of resetting; and the previous phrase's character, so
  // rebuildPhrase can place the deliberate rule-break on "answer" phrases.
  private lastPhraseEndMidi: number | null = null
  private lastPhraseCharacter: PhraseCharacter | null = null

  // Advances every guitar-performance phrase — drives M2.6 slice 3 call-and-answer
  // (even = statement, odd = sparser answer).
  private guitarPhraseCounter: number = 0

  reseed(): void {
    this.sessionSeed = Math.floor(Math.random() * 97)
    this.seedRng(this.sessionSeed)
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
    this.setSectionName(_sectionName)
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
    const isHook = /chorus|hook|drop/i.test(_sectionName)
    this.preferredMotifBankKey = isHook ? 'fills' : null  // null = existing default choice

    // Optional instrument hand-off between sections (default OFF).
    if (this.melodySectionHandoffEnabled) {
      const voice = assignMelodyVoice(_sectionName, this.sessionSeed, this.availablePerformerIds())
      if (voice && voice !== this.explicitPerformerId) this.setInstrumentPerformer(voice)
    }
  }

  /** Performer ids the melody may hand off to. Stub returns the current one only
   *  until a richer catalog is wired; keeps hand-off safe + repeatable. */
  private availablePerformerIds(): InstrumentPerformerId[] {
    return this.explicitPerformerId ? [this.explicitPerformerId] : []
  }

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
      this.currentScale = [...(MODE_SCALES[physics.mode] ?? MODE_SCALES.glow)]
      this.updateChordDegreesCache()
      
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
    this.currentScale    = [...MODE_SCALES.glow]
    this.hasStartedPlayback = false
    this.lastRebuildTime = -Infinity
    this.sectionBehavior = null
    this.setOutputLevel(0)
    this.updateChordDegreesCache()
  }

  applyPitchOffset(semitones: number): void {
    this.pitchOffsetSemitones = Math.round(semitones)
  }

  setRootAndScale(rootPitchClass: number, intervals: number[]): void {
    const newRoot  = ((rootPitchClass % 12) + 12) % 12
    const changed  = newRoot !== this.rootPitchClass
                  || JSON.stringify(intervals) !== JSON.stringify(this.currentScale)
    if (!changed) return
    this.rootPitchClass = newRoot
    this.currentScale   = [...intervals]
    this.scaleDirty     = true
    this.updateChordDegreesCache()
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
    const now = performance.now()
    if (now - this.lastRebuildTime < MelodyGenerator.MIN_REBUILD_INTERVAL_MS) {
      return false   // throttled — caller should preserve any pending dirty flags
    }
    this.lastRebuildTime = now

    if (this.currentBehavior === MelodyBehavior.Rest) {
      this.stopPart()
      return true    // intentional stop — dirty flags can be cleared
    }

    const lengths = PHRASE_LENGTHS[this.currentBehavior]
    if (!lengths || lengths.length === 0) return true

    const currentBar = getConductor().getScoreFrame().bar
    const seedVal = this.sessionSeed + this.rootPitchClass + (this.currentChordTones[0] ?? 0) + currentBar
    const lengthHash = Math.sin(seedVal * 12.34) * 1000
    const lengthRand = lengthHash - Math.floor(lengthHash)
    const selectedLength = lengths[Math.floor(lengthRand * lengths.length)]
    // Leads play ≥2-bar phrases (32 sixteenths). A 1-bar phrase replays identical
    // once before the PHRASE_REFRESH_BARS=2 refresh — the "short loop" feel. Two
    // bars fills with a developing statement→answer idea (the motif-chaining below)
    // that lines up with the 2-bar chord cycle. Same fix the bowed strings already
    // had; now applied to guitar and every other lead.
    let phraseLength = this.currentBehavior === MelodyBehavior.Lead
      ? Math.max(32, selectedLength)
      : selectedLength
    let notes          = this.generatePhrase(phraseLength, physics)
    if (this.isSoloMode) {
      notes = this.applySoloistEmbellishments(notes, physics)
    }

    // Pro-instruments Slice 4: EVERY lead family gets the shared breathe/arc/
    // develop performance pass, tuned per family via performerExpression.ts.
    // Guitar additionally gets its own idiom-specific line development below
    // (call-and-answer thinning + picking accents) before the shared pass —
    // order matters: develop the LINE first (what to play), THEN shape the
    // shared dynamics/breath (how loud/where to rest), THEN articulations
    // (how to play) below.
    if (this.isGuitar()) {
      notes = developGuitarPhrase(notes, this.guitarPhraseCounter++)
    }
    notes = this.applyPerformerExpression(notes)

    // Cross-phrase voice-leading (2026-06-16 spec §4, wired in 2026-07-06 — the
    // module existed and was unit-tested but was never called from here). Runs
    // LAST, after developPhraseCharacter's ±12-semitone register recast above,
    // so it smooths the final register-shifted line rather than being undone
    // by that recast. seedMidi threads in the previous phrase's last note so
    // the line continues instead of resetting every phrase; breakAt allows one
    // deliberate leap on "answer" phrases (a real reach, not smoothed away).
    {
      const octaves = MODE_OCTAVES[physics.mode] ?? [4, 5]
      const floorMidi = octaves[0] * 12 + 12
      const ceilingMidi = (octaves[1] * 12 + 12) + 11
      const maxLeapSemitones = isSustainedPitch(this.currentPerformer?.family) ? 4 : 7
      const breakAt = this.lastPhraseCharacter === 1 ? Math.floor(notes.length * 0.66) : null

      notes = applyVoiceLeading(notes, {
        maxLeapSemitones,
        floorMidi,
        ceilingMidi,
        seedMidi: this.lastPhraseEndMidi,
        breakAt,
      })

      if (notes.length > 0) {
        const lastMidi = noteToMidi(notes[notes.length - 1].pitch)
        if (lastMidi != null) this.lastPhraseEndMidi = lastMidi
      }
    }

    // Pro-instruments M2.6 slice 2: guitar idiom, per note. Choose a note-based
    // ornament per note (bend into peaks, hammer-on stepwise, release at the end)
    // — applied via the existing articulation engine, no audio-chain change.
    // Computed AFTER dynamics so accent velocities drive the bend choice.
    const guitarArtIds = this.isGuitar() ? planGuitarArticulations(notes) : null

    if (notes.length === 0) return true

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

    this.part = new Tone.Part((time, event) => {
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
      if (isSustainedPitch(this.currentPerformer?.family)) this.shapeVibrato(event.dur, Math.max(0, time))

      // Fast-path: default articulation skips the transform for zero overhead.
      if (artId === DEFAULT_ARTICULATION_ID) {
        const t = Math.max(0, time)
        voice.triggerAttackRelease(playableNote, event.dur, t, finalVel)
        this.lastNoteEndSec = t + Tone.Time(event.dur).toSeconds()
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
        this.lastNoteEndSec = t + Tone.Time(n.duration).toSeconds()
      }
    }, (() => {
      const events = notes.map((n, i) => ({ time: quantizeGridTime(n.time, loopBars), note: n.pitch, dur: n.duration, vel: n.velocity, art: guitarArtIds ? guitarArtIds[i] : undefined }));
      this.busySlots16ths = extractBusySlots16ths(events);
      return events;
    })())

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
    return this.currentPerformer?.family === 'bowed'
  }

  /** True when the current lead voice is a guitar (nylon / clean / distortion). Guitar
   *  ornamentation (planGuitarArticulations) is idiom-specific, not shared expression,
   *  so it stays keyed on the actual voice name rather than the broader 'plucked' family
   *  (which also covers harp/pizzicato — those should NOT get guitar bends/hammer-ons). */
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
    const depthCap = getPerformerExpressionConfig(this.currentPerformer?.family).vibratoDepthCap
    if (depthCap === null) return // this family doesn't vibrato (plucked/keyboard/synth)

    const depth = this.vibrato.depth
    let durSec = 0.25
    try { durSec = Tone.Time(dur).toSeconds() } catch { /* keep default */ }

    // Intense vibrato for soloists
    this.vibrato.frequency.value = this.isSoloMode ? 6.5 : 5.0

    try {
      depth.cancelScheduledValues(time)
      if (durSec < 0.22) {
        // Fast passing note — straight tone, no vibrato.
        depth.setValueAtTime(0.012, time)
      } else {
        // Sustained note — straight attack, then vibrato blooms in and widens
        // with length (capped per-family so it stays musical, not seasick;
        // soloed leads get a proportionally wider, faster-blooming vibrato —
        // same 0.48/0.35 ratio the original bowed-only solo boost used).
        const target = this.isSoloMode
          ? Math.min(depthCap * 1.37, 0.22 + durSec * 0.15)
          : Math.min(depthCap, 0.16 + durSec * 0.12)
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
  /**
   * Pro-instruments spec M2.5/Slice 4 — the shared lead PERFORMER pass. Runs
   * for any family via performerExpression.ts; per-family tuning comes from
   * getPerformerExpressionConfig(). Mutates in place is NOT done — this
   * reassigns the array reference the caller passed by returning the shaped
   * result, mirroring guitarPerformance's non-destructive contract.
   */
  private applyPerformerExpression(notes: ScheduledNote[]): ScheduledNote[] {
    const n = notes.length
    if (n < 3) {
      this.lastPhraseCharacter = null
      return notes
    }
    this.phraseCounter++

    const family = this.currentPerformer?.family
    const config = getPerformerExpressionConfig(family)
    const character = phraseCharacterOf(this.phraseCounter)
    this.lastPhraseCharacter = character

    // DEVELOPMENT — recast register per character (no-op if this family doesn't recast).
    let shaped = developPhraseCharacter(notes, character, config.octaveRecastEnabled)

    // Velocity ARC — crescendo toward a drifting peak, ease at the cadence. The peak
    // drifts slightly per phrase (same "not identical every time" feel as before).
    const peak = Math.min(0.85, config.peakPosition + 0.12 * ((this.phraseCounter % 3) / 2) - 0.08)
    shaped = shapePerformanceDynamics(shaped, { peakPosition: peak, downbeatAccent: config.downbeatAccent })

    // BREATH — rest weak interior notes (never first/last). Density varies by
    // character (answer is airy, climb is driving) and by family (config.restDensityMultiplier).
    const dropMod = (character === 1 ? 3 : character === 3 ? 6 : 4) * config.restDensityMultiplier
    this.seedRng(this.sessionSeed + this.phraseCounter)
    shaped = applyBreathAndRests(shaped, { dropMod, rng: () => this.nextRandom() })

    return shaped
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
    
    // Stable octave based on mode hash.
    const modeHash = physics.mode.toString().length
    const octave  = octaves[0] + (modeHash % (octaves[1] - octaves[0] + 1))
    
    const isHint  = this.currentBehavior === MelodyBehavior.Hint
    const velocityEnergy = this.voiceActive
      ? this.lastPerformerEnergy
      : Math.max(0.75, this.lastPerformerEnergy)

    // CALL & RESPONSE: selection based on chord root and absolute bar, mixed
    // with a per-start session seed. Pure (root, bar) seeding made every cold
    // start play the exact same phrase note-for-note.
    const currentBar = getConductor().getScoreFrame().bar
    const chordSeed = (this.rootPitchClass + (this.currentChordTones[0] ?? 0) + currentBar + this.sessionSeed) % 10
    
    // Performance 19: Cache chord tones mapping
    const chordDegs = this.cachedChordDegs
    const preferredDegs = this.cachedPreferredDegs

    const performer = this.currentPerformer
    const isBowedLead = performer?.family === 'bowed'
    const melodicOctave = isBowedLead
      ? Math.min(octaves[1], Math.max(octaves[0], (performer?.preferredOctave ?? octave + 1) - 1))
      : octave

    if (this.freeplayEnabled) {
      const conductor = getConductor()
      const score = conductor.getScoreFrame()
      const chord = score.currentChord ?? conductor.currentChord()
      const behavior = this.currentBehavior === MelodyBehavior.Hint
        ? 'hint'
        : this.currentBehavior === MelodyBehavior.Respond ? 'respond' : 'lead'
      const seed = hashString(`melody:${this.currentSectionName}:${score.subGenre}:${behavior}`)

      return buildFreeplayMelodyNotes({
        rootMidi: chord.rootMidi,
        chordIntervals: chord.intervals ?? [0, 3, 7],
        bars: Math.max(1, Math.ceil(length16ths / 16)),
        swing: this.currentSwing,
        subGenre: score.subGenre,
        energy: Math.max(0.2, Math.min(1, velocityEnergy)),
        density: behavior === 'lead'
          ? Math.max(0.58, Math.min(0.95, 0.58 + this.flowDepth * 0.35))
          : behavior === 'respond' ? 0.48 : 0.22,
        sectionName: this.currentSectionName,
        motifSeed: seed,
        kickTimes16ths: [],
        rng: mulberry32(seed + getSessionSalt() + this.freeplayPhraseCounter++),
        scaleIntervals: this.currentScale,
        keyPitchClass: this.rootPitchClass,
        chordDegrees: chordDegs,
        preferredDegrees: preferredDegs,
        octave: melodicOctave,
        pitchOffsetSemitones: this.pitchOffsetSemitones,
        length16ths,
        behavior,
        performerFamily: performer?.family,
        emotionalIntent: this.emotionalIntent,
      })
    }

    // Authored fallback: singing families (bowed/wind/brass/keyboard) route to
    // the 'lyrical' bank instead of the arp/fill banks, which read as finger
    // exercises on instruments expected to carry a tune. preferredBankKey
    // (chorus/hook contrast) still overrides everything.
    const motifBankKey = selectMotifBankKey({
      family: this.currentPerformer?.family,
      voiceActive: this.voiceActive,
      preferredBankKey: this.preferredMotifBankKey,
      chordSeed,
    })
    const motifBank: MelodyMotif[] = HIP_HOP_MOTIFS[motifBankKey] ?? HIP_HOP_MOTIFS.ostinatos

    const degreeToPitch = (degIndex: number, transposeOct: number = 0): string => {
      if (this.currentScale.length === 0) return 'C4'
      const normDeg = ((degIndex % this.currentScale.length) + this.currentScale.length) % this.currentScale.length
      const octMidiOffset = Math.floor(degIndex / this.currentScale.length) * 12
      const semitone = this.currentScale[normDeg]
      const midi = ((melodicOctave + transposeOct) * 12) + 12 + semitone + octMidiOffset + this.rootPitchClass + this.pitchOffsetSemitones
      return Tone.Frequency(midi, 'midi').toNote()
    }

    // Quality 29: Leap recovery states
    let lastMidi: number | null = null
    let leapDirection: 'up' | 'down' | null = null

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

        // Leap recovery bias application
        if (leapDirection === 'up') {
          degIndex -= 1
        } else if (leapDirection === 'down') {
          degIndex += 1
        }

        const pitch = degreeToPitch(degIndex, transposeOct)
        const midi = noteToMidi(pitch)

        leapDirection = null
        if (midi !== null && lastMidi !== null) {
          const interval = midi - lastMidi
          if (interval > 4) {
            leapDirection = 'up'
          } else if (interval < -4) {
            leapDirection = 'down'
          }
        }
        if (midi !== null) {
          lastMidi = midi
        }
        
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

        // Repeatable velocity texture seeded by position and energy.
        const seed = (bar * 16) + (beat * 4) + sub
        const hash = Math.sin(seed * 9.87) * 1000
        const pseudoRand = hash - Math.floor(hash)

        let vel = Math.min(1, Math.max(0.22, (accentBase * velocityEnergy) + (pseudoRand - 0.5) * 0.12))

        // Emotional-intent velocity shaping. Applied after the position hash
        // so the per-position pseudo-random texture is preserved, just
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
    // Space between motifs IS the musical statement — a lead that never
    // breathes reads as noise against a busy drum pattern. Lead phrases get a
    // beat and a half of air; Respond gets a beat and a half; Hint two beats.
    const restLen = isHint ? 8 : this.currentBehavior === MelodyBehavior.Respond ? 6 : 6
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
    // mapping returned only the root), fall back to a stable 4-bar
    // minor contour. Without this guard the listener can hear the engine
    // stuck on a single repeating note while the rest of the mix keeps moving.
    const uniquePitches = new Set(notes.map(n => n.pitch))
    if (uniquePitches.size <= 1) {
      return this.defaultMinorContour(length16ths, melodicOctave)
    }

    return notes
  }

  /**
   * Stable 4-bar (or shorter) minor contour:
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
      const normDeg = ((deg % minor.length) + minor.length) % minor.length
      const semitone = minor[normDeg] + Math.floor(deg / minor.length) * 12
      const midi = (octave * 12) + 12 + semitone + this.rootPitchClass + this.pitchOffsetSemitones
      const pitch = Tone.Frequency(midi, 'midi').toNote()
      const bar  = Math.floor(c / 16)
      const beat = Math.floor((c % 16) / 4)
      const sub  = c % 4
      const swungSub = (sub === 1 || sub === 3) ? sub + this.currentSwing : sub
      notes.push({
        pitch,
        duration: '4n',
        velocity: this.emotionalIntent === 'sad' ? 0.5 : 0.6,
        time: `${bar}:${beat}:${swungSub.toFixed(2)}`,
      })
    }
    return notes
  }

  // Matches GeneratorBase's `abstract stopPart(): void` — must not be private,
  // since GeneratorOrchestrator calls it directly on generator instances.
  stopPart(): void {
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
    this.busySlots16ths = []
    try {
      this.synth.volume.cancelScheduledValues(Tone.now())
      this.synth.releaseAll()
    } catch { /* */ }
  }

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier * Math.min(2, this.volumeMultiplier)
    const linear = shaped <= 0.0001 ? 0 : shaped
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

  getBusySlots16ths(): number[] {
    return this.busySlots16ths
  }

  /** Band-awareness: absolute audio-clock time (seconds, comparable to
   *  Tone.now()) the most recently triggered note ends. 0 = hasn't played yet. */
  getLastNoteEndSec(): number {
    return this.lastNoteEndSec
  }

  private applySoloistEmbellishments(notes: ScheduledNote[], physics: PhysicsState): ScheduledNote[] {
    const embellished: ScheduledNote[] = []
    const scale = this.currentScale
    if (scale.length === 0) return notes

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i]
      const midi = noteToMidi(String(n.pitch))
      if (midi === null) {
        embellished.push(n)
        continue
      }

      // Check duration in 16ths
      let dur16ths = 1
      if (n.duration.endsWith('m')) {
        dur16ths = parseFloat(n.duration) * 16
      } else {
        const denom = parseFloat(n.duration.replace('n', '').replace('.', '')) || 4
        const dotMultiplier = n.duration.endsWith('.') ? 1.5 : 1.0
        dur16ths = (16 / denom) * dotMultiplier
      }

      const parts = n.time.split(':')
      const bar = parseInt(parts[0] ?? '0', 10)
      const beat = parseInt(parts[1] ?? '0', 10)
      const sub = parseFloat(parts[2] ?? '0')

      // 1. Trills: for long notes (>= 4 sixteenths), 50% probability
      const hash = Math.sin(bar * 7.1 + beat * 3.2 + sub) * 1000
      const randVal = hash - Math.floor(hash)
      
      if (dur16ths >= 4 && randVal < 0.5) {
        // Alternate main note and note above
        const upperMidi = snapNoteToScale(midi + 2, this.rootPitchClass, scale, this.pitchOffsetSemitones, 'up')
        const upperPitch = typeof upperMidi === 'number' ? midiToNote(upperMidi) : upperMidi
        
        for (let j = 0; j < dur16ths; j++) {
          const isUpper = j % 2 === 1
          const stepSub = sub + j
          const stepBar = bar + Math.floor((beat + Math.floor(stepSub / 4)) / 4)
          const stepBeat = (beat + Math.floor(stepSub / 4)) % 4
          const stepSubGrid = stepSub % 4
          const stepTime = `${stepBar}:${stepBeat}:${stepSubGrid.toFixed(2)}`
          
          embellished.push({
            pitch: isUpper ? upperPitch : n.pitch,
            duration: '16n',
            velocity: n.velocity * (isUpper ? 0.85 : 1.0),
            time: stepTime
          })
        }
        continue
      }

      // 2. Grace notes: for medium-to-long notes, 70% probability
      if (dur16ths >= 2 && randVal >= 0.3) {
        const lowerMidi = snapNoteToScale(midi - 2, this.rootPitchClass, scale, this.pitchOffsetSemitones, 'down')
        const lowerPitch = typeof lowerMidi === 'number' ? midiToNote(lowerMidi) : lowerMidi
        
        // Grace note on original time, dur 32n
        embellished.push({
          pitch: lowerPitch,
          duration: '32n',
          velocity: n.velocity * 0.7,
          time: n.time
        })
        
        // Shift main note late by 32n (0.5 of a sixteenth)
        const mainSub = sub + 0.5
        const mainBar = bar + Math.floor((beat + Math.floor(mainSub / 4)) / 4)
        const mainBeat = (beat + Math.floor(mainSub / 4)) % 4
        const mainSubGrid = mainSub % 4
        const mainTime = `${mainBar}:${mainBeat}:${mainSubGrid.toFixed(2)}`
        
        embellished.push({
          pitch: n.pitch,
          duration: n.duration,
          velocity: n.velocity,
          time: mainTime
        })
        continue
      }

      // Default: keep original note
      embellished.push(n)
    }

    // Apply legato overlaps for adjacent close notes
    if (this.isBowedString() || this.isGuitar()) {
      for (let i = 0; i < embellished.length - 1; i++) {
        const curr = embellished[i]
        const next = embellished[i + 1]
        const currMidi = noteToMidi(String(curr.pitch))
        const nextMidi = noteToMidi(String(next.pitch))
        if (currMidi !== null && nextMidi !== null && Math.abs(currMidi - nextMidi) <= 2) {
          if (curr.duration.endsWith('n')) {
            curr.duration = curr.duration + '.'
          }
        }
      }
    }

    return embellished
  }

  dispose(): void {
    this.stopPart()
    if (this.unsubscribeConductor) {
      this.unsubscribeConductor()
      this.unsubscribeConductor = null
    }
    // Dispose every cached sampler (includes the currently-active this.synth
    // when it's a cached voice), then clear the cache.
    const cachedSamplers = new Set(this.samplerCache.values())
    for (const s of cachedSamplers) {
      try { s.dispose() } catch { /* */ }
    }
    this.samplerCache.clear()
    this.currentVoiceKey = null
    try { this.vibrato.dispose() } catch { /* */ }
    if (!cachedSamplers.has(this.synth as any)) {
      try { this.synth.dispose() } catch { /* */ }
    }
    try { this.fallbackSynth.dispose() } catch { /* */ }
    try { this.chorus.dispose() } catch { /* */ }
    try { this.dryBus.dispose() } catch { /* */ }
    try { this.delaySend.dispose() } catch { /* */ }
    try { this.reverbSend.dispose() } catch { /* */ }
    try { this.delayReturnHP.dispose() } catch { /* */ }
    try { this.reverbReturnHP.dispose() } catch { /* */ }
    try { this.delay.dispose() } catch { /* */ }
    try { this.reverb.dispose() } catch { /* */ }
    try { this.output.dispose() } catch { /* */ }
  }
}
