// Section 04 — Texture Generator → Synth Pads / Keys
//
// Originally a pure noise/air texture bed. It is now a SYNTH PADS / KEYS player:
// it comps the Conductor's current chord voicing with a real recorded Cymatics
// keys sample (pitch-shifted by Tone.Sampler), layered over the original — now
// subliminal — noise air-bed. The loop-pack JSON key stays `texture` for
// backward compatibility; only the audible voice and UI label changed. Loop
// mode and the section riser are unchanged.

import * as Tone from 'tone'
import type { LoopClip } from '@shared/loopPack'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName }      from './types'
import { TEXTURE_BY_MODE }    from './patterns/TexturePatternLibrary'
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import { OState }             from '../state/types'
import { createMultisampleSampler, createSoundfontSampler, type LoadableSampler } from '../instruments/SamplerUtils'
import { getConductor }       from '../conductor/Conductor'
import { getRealInstrumentNotes, realInstrumentsReady } from '../instruments/realInstruments'

type TextureVoiceSpec = {
  key: string
  kind: 'real' | 'soundfont'
  instrumentId: string
  attack: number
  release: number
  volume: number
}

const TEXTURE_VOICE_BY_MODE: Record<string, TextureVoiceSpec> = {
  heat:   { key: 'rhodes',  kind: 'real',      instrumentId: 'SK_ElPiano01',        attack: 0.01, release: 2.8, volume: -6 },
  gravel: { key: 'rhodes',  kind: 'real',      instrumentId: 'SK_ElPiano01',        attack: 0.01, release: 2.8, volume: -6 },
  smoke:  { key: 'rhodes',  kind: 'real',      instrumentId: 'SK_ElPiano01',        attack: 0.02, release: 3.0, volume: -6 },
  glow:   { key: 'strings', kind: 'real',      instrumentId: 'VSCO2_StringSection', attack: 0.18, release: 3.6, volume: -4 },
  ice:    { key: 'strings', kind: 'real',      instrumentId: 'VSCO2_StringSection', attack: 0.22, release: 4.0, volume: -4 },
}

const TEXTURE_VOICE_FALLBACK: Record<string, TextureVoiceSpec> = {
  rhodes:  { key: 'rhodes',  kind: 'soundfont', instrumentId: 'electric_piano_1',  attack: 0.01, release: 2.8, volume: -6 },
  strings: { key: 'strings', kind: 'soundfont', instrumentId: 'string_ensemble_1', attack: 0.18, release: 3.6, volume: -4 },
}

export class TextureGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private noiseSource: Tone.Noise
  private highpass:    Tone.Filter      // keeps pink noise out of sub/bass range
  private filter:      Tone.Filter
  private reverb:      Tone.Reverb
  private gain:        Tone.Gain

  // ── Riser sub-chain ────────────────────────────────────────────────
  // Separate noise + bandpass + gain so we can fire upward sweeps at section
  // boundaries without disturbing the steady-state texture bed. Output joins
  // `this.output` so it inherits the same channel-strip routing.
  private riserNoise:  Tone.Noise
  private riserFilter: Tone.Filter
  private riserGain:   Tone.Gain
  private riserStarted: boolean = false

  // Thinning state (responds to DensityComputer.thinningRequested)
  private thinningActive: boolean = false
  private noiseStarted:   boolean = false
  private enabled:        boolean = false  // controlled by orchestrator textureEnabled toggle

  // ── Synth Pads / Keys voice ────────────────────────────────────────
  // A real recorded Cymatics keys sample comps the Conductor's chord voicing.
  // This is the audible voice of the generator now; the noise bed above is kept
  // as subliminal air. Loop mode bypasses this (the _loopMode guard).
  private padSampler: LoadableSampler
  private padReverb:  Tone.Reverb
  private padGain:    Tone.Gain
  // Stereo widener — the reference study's "pad wide, hook center" rule. The
  // bed spreads across the field so the center stays clear for the chord
  // animator + lead. Mid-side matrix: cheap DSP, safe to add to the pad chain.
  private padWidener: Tone.StereoWidener
  private padEventId: number | null = null
  private textureVolumeMultiplier: number = 1.0
  private padVolumeMultiplier: number = 1.0
  private lastPadGain: number = 0
  private activeVoiceKey: string | null = null
  private currentModeKey: string = 'glow'

  // Section-aware bed character (set by onSectionChange). The pad is the BED,
  // not the animator — so section-awareness shapes how it SITS (velocity, hold
  // length), never a rhythmic gesture. intro/breakdown: the pad leads (fuller,
  // longer washes); verse: tucked under the chord animator; build: swelling.
  private sectionPadVelocity: number = 0.52
  private sectionPadHoldBars: number = 1
  private padLoopBar: number = 0

  // Ramp dedup — skip scheduling redundant ramps when values haven't changed
  private lastOutputGain:    number = 0
  private lastFilterFreq:    number = 600
  private lastReverbWet:     number = 0.25

  constructor() {
    super(GeneratorName.Texture)

    this.noiseSource = new Tone.Noise('pink')
    this.highpass    = new Tone.Filter({ type: 'highpass', frequency: 400, rolloff: -24 })  // hard cut below 400Hz — no hum
    this.filter      = new Tone.Filter(600, 'lowpass')    // start moderate, opens as organism warms up
    this.reverb      = new Tone.Reverb({ decay: 1.0, wet: 0.25 })  // short tail, low wet to prevent wash buildup
    this.gain        = new Tone.Gain(0)

    this.output = new Tone.Gain(1)

    // Signal chain: noise → highpass → lowpass → reverb → gain → output
    this.noiseSource.connect(this.highpass)
    this.highpass.connect(this.filter)
    this.filter.connect(this.reverb)
    this.reverb.connect(this.gain)
    this.gain.connect(this.output)

    // Riser sub-chain: white noise → resonant bandpass → gain → output.
    // Starts silent; triggerRiser() opens the gain and sweeps the filter freq.
    this.riserNoise  = new Tone.Noise('white')
    this.riserFilter = new Tone.Filter({ type: 'bandpass', frequency: 200, Q: 3.5 })
    this.riserGain   = new Tone.Gain(0)
    this.riserNoise.connect(this.riserFilter)
    this.riserFilter.connect(this.riserGain)
    this.riserGain.connect(this.output)

    // Synth-pad/keys chain: sampler → lush reverb → padGain → output. Unlike the
    // old stretched one-shot, this uses the same sample-backed sources as the
    // other generators: real multisamples when the catalog is ready, otherwise
    // the self-hosted soundfonts.
    // Convolution reverb cost scales with IR length. The 3.5s tail (added with
    // pads-by-default) was the heaviest always-on node in the generator stack
    // and the AI-ear localized crackle to "reverb tails"; 1.8s keeps a lush
    // bed while roughly halving this node's audio-thread cost.
    this.padReverb  = new Tone.Reverb({ decay: 1.8, wet: 0.3 })
    this.padGain    = new Tone.Gain(0)
    this.padWidener = new Tone.StereoWidener(0.65)
    this.padSampler = this.createPadSamplerForMode(this.currentModeKey)
    this.padSampler.connect(this.padReverb)
    this.padReverb.connect(this.padGain)
    this.padGain.connect(this.padWidener)
    this.padWidener.connect(this.output)

    // Do NOT start noise here — defer until organism leaves Dormant
    // this.noiseSource.start()
  }

  // ── Synth-pad chord loop ───────────────────────────────────────────
  // Comps the Conductor's current voicing every bar with a long, soft pad
  // swell. Reads the live voicing at callback time so it always agrees with the
  // band's harmony. Scheduled on the Transport so it stays grid-locked.
  private startPadLoop(): void {
    if (this.padEventId !== null) return
    this.padLoopBar = 0
    this.padEventId = Tone.getTransport().scheduleRepeat((time) => {
      if (this._loopMode || !this.enabled) return
      if (this.padSampler.isLoaded !== true) return
      const bar = this.padLoopBar++
      // Multi-bar holds: on a 2-bar wash, re-attack only on even bars and let
      // the sustained voicing ring through the odd bar (no releaseAll then).
      const hold = Math.max(1, this.sectionPadHoldBars)
      if (bar % hold !== 0) return
      const inner = getConductor().currentVoicing().inner
      if (!inner.length) return
      const lifted = inner.map((m) => Math.min(84, m + 12))
      const top = lifted[lifted.length - 1]
      const voiced = top != null && top <= 72
        ? [...lifted, top + 12]
        : lifted
      const notes = [...new Set(voiced)].map((m) => Tone.Frequency(m, 'midi').toNote())
      try {
        this.padSampler.releaseAll(time)
        this.padSampler.triggerAttackRelease(notes, `${hold}m`, time, this.sectionPadVelocity)
      } catch { /* sampler not ready / retrigger race — skip this bar */ }
    }, '1m', '0:0:0')
  }

  /**
   * Section-aware bed character. The pad is the BED under the chord animator,
   * so this shapes how it SITS — velocity and wash length — not rhythm.
   *   intro / breakdown → the pad leads: fuller, 2-bar washes
   *   verse            → tucked under the animator: softer, 1-bar
   *   build            → swelling forward
   *   drop / hook      → present but not competing with the busy animator
   * Called from the orchestrator's section-change stagger (after chord).
   */
  onSectionChange(sectionName: string): void {
    const n = sectionName.toLowerCase()
    if (n.includes('intro') || n.includes('break')) {
      this.sectionPadVelocity = 0.6
      this.sectionPadHoldBars = 2
    } else if (n.includes('build')) {
      this.sectionPadVelocity = 0.58
      this.sectionPadHoldBars = 1
    } else if (n.includes('drop') || n.includes('hook') || n.includes('chorus')) {
      this.sectionPadVelocity = 0.5
      this.sectionPadHoldBars = 1
    } else {
      // verse / default — tuck under the chord animator
      this.sectionPadVelocity = 0.46
      this.sectionPadHoldBars = 1
    }
  }

  private stopPadLoop(): void {
    if (this.padEventId !== null) {
      try { Tone.getTransport().clear(this.padEventId) } catch { /* */ }
      this.padEventId = null
    }
    try { this.padSampler.releaseAll() } catch { /* */ }
    this.lastPadGain = 0
    this.padGain.gain.cancelScheduledValues(Tone.now())
    this.padGain.gain.rampTo(0, 0.4)
  }

  private voiceSpecForMode(modeKey: string): TextureVoiceSpec {
    const preferred = TEXTURE_VOICE_BY_MODE[modeKey] ?? TEXTURE_VOICE_BY_MODE.glow
    if (preferred.kind === 'real') {
      const realNotes = getRealInstrumentNotes({ realInstrument: preferred.instrumentId })
      if (realNotes) return preferred
    }
    return TEXTURE_VOICE_FALLBACK[preferred.key] ?? TEXTURE_VOICE_FALLBACK.strings
  }

  private createPadSamplerForMode(modeKey: string): LoadableSampler {
    const spec = this.voiceSpecForMode(modeKey)
    this.activeVoiceKey = `${spec.kind}:${spec.instrumentId}`
    const envelope = { attack: spec.attack, release: spec.release }

    if (spec.kind === 'real') {
      const realNotes = getRealInstrumentNotes({ realInstrument: spec.instrumentId })
      if (realNotes) return createMultisampleSampler(realNotes, envelope, spec.volume)
    }

    return createSoundfontSampler(spec.instrumentId, envelope, spec.volume)
  }

  private swapPadVoice(modeKey: string): void {
    const nextSpec = this.voiceSpecForMode(modeKey)
    const nextVoiceKey = `${nextSpec.kind}:${nextSpec.instrumentId}`
    if (nextVoiceKey === this.activeVoiceKey) return

    const oldSampler = this.padSampler
    try { oldSampler.releaseAll() } catch { /* */ }
    try { oldSampler.disconnect() } catch { /* */ }

    this.padSampler = this.createPadSamplerForMode(modeKey)
    this.padSampler.connect(this.padReverb)

    try { oldSampler.dispose() } catch { /* */ }
  }

  /**
   * Schedule a filter-sweep riser that peaks at `peakAt` (AudioContext time).
   * Default behavior: start now, ramp up over `durationSec` so the peak lands
   * `durationSec` from now. Used by GeneratorOrchestrator at the start of a
   * `build` section so the noise sweep climaxes exactly when the `drop` enters.
   *
   * The riser tails off quickly after the peak so it doesn't smear the drop's
   * impact hit. Safe to call repeatedly — the riser sub-chain is independent
   * of the steady-state texture bed.
   */
  triggerRiser(durationSec: number, peakAt?: number): void {
    if (!this.enabled) return
    const startAt = Tone.now() + 0.02
    const peak = peakAt ?? startAt + durationSec
    // Start the noise source lazily — it runs forever after but is gated by
    // riserGain, which sits at 0 except during sweeps.
    if (!this.riserStarted) {
      this.riserNoise.start()
      this.riserStarted = true
    }
    // Filter freq: 200Hz → 8kHz exponential sweep into the drop.
    this.riserFilter.frequency.cancelScheduledValues(startAt)
    this.riserFilter.frequency.setValueAtTime(200, startAt)
    this.riserFilter.frequency.exponentialRampToValueAtTime(8000, peak)
    // Gain: silent → -10dB ramp to peak, then quick tail-off so the drop hits clean.
    const peakGain = Math.pow(10, -10 / 20)  // -10 dB
    this.riserGain.gain.cancelScheduledValues(startAt)
    this.riserGain.gain.setValueAtTime(0, startAt)
    this.riserGain.gain.linearRampToValueAtTime(peakGain, peak)
    this.riserGain.gain.linearRampToValueAtTime(0, peak + 0.15)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.activityLevel = 0
      this.gain.gain.rampTo(0, 0.3)
      this.stopPadLoop()
    }
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    if (this._loopMode) return
    // Hard gate — when disabled, skip all processing.
    // Gain was already ramped to 0 in setEnabled(false) — don't re-ramp
    // here, as it cancels the in-progress ramp and creates a discontinuity.
    if (!this.enabled) return

    const modeName = physics.mode.toString()
    if (modeName !== this.currentModeKey) {
      this.currentModeKey = modeName
      this.swapPadVoice(modeName)
    }
    const layer    = TEXTURE_BY_MODE[modeName]
    if (!layer) return

    // Target level based on state + density thinning.
    // Composer's role caps activity; reactive curve adds feel under the ceiling.
    let targetLevel = this.computeTargetLevel(organism) * this.roleCeiling()
    if (this.thinningActive) targetLevel *= 0.4   // organism breathing out

    this.activityLevel += this.smoothingCoeff(130) * (targetLevel - this.activityLevel)

    // Apply gain (texture is always soft — max -12 dB)
    const shaped = this.activityLevel
      * layer.gainLevel
      * this.arrangementMultiplier
      * this.textureVolumeMultiplier
    const db = shaped <= 0
      ? -Infinity
      : 20 * Math.log10(Math.max(0.0001, shaped))
    const linear = db === -Infinity ? 0 : Math.pow(10, db / 20)
    // Threshold of 0.008 (~0.07dB) prevents physics micro-drift from
    // restarting ramps every frame. Previous threshold of 0.001 was too tight.
    if (Math.abs(linear - this.lastOutputGain) > 0.008) {
      this.lastOutputGain = linear
      this.gain.gain.cancelScheduledValues(Tone.now())
      this.gain.gain.rampTo(linear, 0.5)
    }

    // Morph filter cutoff toward mode target — only if changed
    if (Math.abs(layer.filterFreq - this.lastFilterFreq) > 1) {
      this.lastFilterFreq = layer.filterFreq
      this.filter.frequency.cancelScheduledValues(Tone.now())
      this.filter.frequency.rampTo(layer.filterFreq, 1.0)
    }

    // Morph reverb wet toward mode target — only if changed
    if (Math.abs(layer.reverbWet - this.lastReverbWet) > 0.005) {
      this.lastReverbWet = layer.reverbWet
      this.reverb.wet.rampTo(layer.reverbWet, 2.0)
    }

    // Synth-pad/keys gain — the audible voice. Pads sit well above the
    // subliminal noise bed, scaled by the same activity level + the texture
    // volume slider, and capped so they support rather than dominate the mix.
    const padTarget = Math.min(0.82, this.activityLevel * 3.1)
      * this.arrangementMultiplier * this.padVolumeMultiplier
    if (Math.abs(padTarget - this.lastPadGain) > 0.008) {
      this.lastPadGain = padTarget
      this.padGain.gain.cancelScheduledValues(Tone.now())
      this.padGain.gain.rampTo(padTarget, 0.6)
    }
  }

  // Called by GeneratorOrchestrator when DensityComputer requests thinning
  setThinning(active: boolean): void {
    this.thinningActive = active
  }

  onStateTransition(to: OState, _physics: PhysicsState): void {
    if (to === OState.Dormant || !this.enabled) {
      this.activityLevel = 0
      this.gain.gain.rampTo(0, 1.0)
      this.stopPadLoop()
      // Do NOT stop the noise source — Tone.Noise.stop()+start() creates a new
      // AudioBufferSourceNode each time without freeing the old one, leaking ~4MB
      // per cycle. Silence via gain instead; the noise source runs continuously.
    } else {
      if (!this.noiseStarted) {
        // Start noise once on first non-Dormant transition; reuse forever after.
        this.noiseSource.start()
        this.noiseStarted = true
      }
      // Start (or resume) the synth-pad chord loop while awake.
      this.startPadLoop()
    }
  }

  reset(): void {
    this.activityLevel  = 0
    this.thinningActive = false
    this.gain.gain.rampTo(0, 0.5)
    this.stopPadLoop()
    // Do NOT stop noiseSource here — same leak as onStateTransition.
    // Gain ramp to 0 provides silence; source is disposed in dispose().
  }

   /** Public so the orchestrator can hard-cut the keys/pad on a live preset swap
    *  (see GeneratorOrchestrator.cutActivePartsForSwap). Texture has no Tone.Part
    *  — its "part" is the sustained pad voicing. We release the held voicing
    *  immediately but leave the pad loop scheduler running, so it re-comps the
    *  new voicing on the next bar. */
  stopPart(): void {
    try { this.padSampler.releaseAll() } catch { /* sampler not ready */ }
  }

  refreshVoice(): void {
    if (!realInstrumentsReady()) return
    this.swapPadVoice(this.currentModeKey)
  }

  // ── Reactive mutation methods (Section 05) ────────────────────────

  applyVolumeMultiplier(multiplier: number): void {
    const m = Math.max(0, Math.min(1.3, multiplier))  // cap at 1.3 — texture should never dominate
    this.textureVolumeMultiplier = m
    // Drives the synth-pad level too (processFrame multiplies padTarget by it),
    // so the texture volume slider — and the orchestrator's mute via
    // applyVolumeMultiplier(0) — control the pads as well as the noise bed.
    this.padVolumeMultiplier = m
  }

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:    return 0
      case OState.Awakening:  return 0.05 * organism.awakeningProgress
      case OState.Breathing:  return 0.15 * organism.breathingWarmth
      case OState.Flow:       return 0.20 + (0.08 * organism.flowDepth)
    }
  }

  // Loop playback (_loopPlayer / _loopMode / loadLoop / setLoopMode / swapLoop)
  // is centralized in GeneratorBase.


  dispose(): void {
    this.disposeLoopPlayback()
    this.stopPadLoop()
    this.padSampler.dispose()
    this.padReverb.dispose()
    this.padGain.dispose()
    this.padWidener.dispose()
    try { if (this.noiseStarted) this.noiseSource.stop() } catch { /* already stopped */ }
    try { if (this.riserStarted) this.riserNoise.stop() } catch { /* already stopped */ }
    this.noiseSource.dispose()
    this.highpass.dispose()
    this.filter.dispose()
    this.reverb.dispose()
    this.gain.dispose()
    this.riserNoise.dispose()
    this.riserFilter.dispose()
    this.riserGain.dispose()
    this.output.dispose()
  }
}
