import * as Tone from 'tone'
import { DrumInstrument } from './types'
import { OrganismMode } from '../physics/types'
import { loadOrganismKits, type OrganismKitSample } from '../instruments/OrganismKitCache'
import {
  loadSampleProfiles,
  getProfileByFilename,
  scoreForVoice,
  getGenreTarget,
  type SampleProfile,
  type GenreTarget,
} from '../instruments/sampleProfileCache'
import { detectFundamentalHz, tuneShiftSemitones } from '../instruments/pitchDetect'

type SampleVoice = 'kick' | 'snare' | 'hatClosed' | 'hatOpen' | 'perc'

type SampleKitDefinition = Record<SampleVoice, string[]>
type SampleVoiceSlot = {
  gain: Tone.Gain
  player: Tone.Player
  url: string
}

/**
 * Sampler-style velocity law with an audibility floor. The previous linear
 * velocity→gain mapping put a 0.2-velocity ghost hat at −14 dB before the
 * −14 dB voice trim even applied — the entire "feel" layer the improvisers
 * write (ghost snares, 16th infill, velocity arcs) was effectively inaudible.
 * The floor keeps quiet hits present; the power curve preserves accent contrast.
 */
export function velocityToGain(velocity: number): number {
  const v = Math.max(0, Math.min(1, velocity))
  if (v <= 0) return 0
  return 0.12 + 0.88 * Math.pow(v, 1.35)
}

const PREFERRED_KIT_POOLS: Record<string, Partial<Record<SampleVoice, RegExp[]>>> = {
  'infinity-real-beat': {
    kick: [
      /^Kick - Tight\.wav$/i,
      /^Kick - Hard\.wav$/i,
      /^Kick - Thumpster\.wav$/i,
      /^Kick - Grandmaster\.wav$/i,
      /^Kick - Juicy\.wav$/i,
    ],
    snare: [
      /^Snare - Tight\.wav$/i,
      /^Snare - OG\.wav$/i,
      /^Snare - Snapper\.wav$/i,
      /^Snare - Analog\.wav$/i,
      /^Snare - Vinyl\.wav$/i,
    ],
    hatClosed: [
      /^Hat - Sizzle\.wav$/i,
      /^Hat - Noise\.wav$/i,
      /^Hat - Micro\.wav$/i,
      /^Hat - Sweet\.wav$/i,
    ],
    hatOpen: [
      /^Hat - Vinyl\.wav$/i,
      /^Hat - Sweet\.wav$/i,
      /^Hat - Wonky\.wav$/i,
      /^Hat - Springwater\.wav$/i,
    ],
    perc: [
      /^Perc - Analog 1\.wav$/i,
      /^Perc - Retrostick\.wav$/i,
      /^Perc - Skipper\.wav$/i,
      /^Perc - Tambo\.wav$/i,
    ],
  },
}

// Absolute URLs (/api/…, /assets/…) pass through verbatim; bare filenames are
// resolved against the /api/samples library mount. The Cymatics one-shots live
// under server/Assets and are served at /assets, so they take the passthrough.
const sampleUrl = (filenameOrUrl: string): string =>
  filenameOrUrl.startsWith('/') ? filenameOrUrl : `/api/samples/${encodeURIComponent(filenameOrUrl)}`

const KIT_DEFINITIONS: Record<OrganismMode, SampleKitDefinition> = {
  [OrganismMode.Heat]: {
    kick:      ['kick_808.wav'],
    snare:     ['snare_e808_sd-01.wav'],
    hatClosed: ['hihat_cycdh_eleck01-cl01.wav'],
    hatOpen:   ['hihat_cycdh_eleck01-op01.wav'],
    perc:      ['percussion_perc-808.wav'],
  },
  [OrganismMode.Gravel]: {
    kick:      ['kick_acoustic01.wav'],
    snare:     ['snare_e808_sd-05.wav'],
    hatClosed: ['hihat_cycdh_k1close_cl03.wav'],
    hatOpen:   ['hihat_cycdh_k1close_op03.wav'],
    perc:      ['percussion_cycdh_kurz08-perc03.wav'],
  },
  [OrganismMode.Smoke]: {
    kick:      ['kick_1985.wav'],
    snare:     ['snare_e808_sd-08.wav'],
    hatClosed: ['hihat_vinyl.wav'],
    hatOpen:   ['hihat_cycdh_k2room_op02.wav'],
    perc:      ['percussion_cycdh_kurz08-perc01.wav'],
  },
  [OrganismMode.Ice]: {
    kick:      ['kick_low_rez.wav'],
    snare:     ['snare_e808_sd-10.wav'],
    hatClosed: ['hihat_micro.wav'],
    hatOpen:   ['hihat_sizzle.wav'],
    perc:      ['percussion_perc-metal.wav'],
  },
  [OrganismMode.Glow]: {
    kick:      ['kick_classic.wav'],
    snare:     ['snare_e808_sd-03.wav'],
    hatClosed: ['hihat_acoustic_01.wav'],
    hatOpen:   ['hihat_cycdh_k2room_op01.wav'],
    perc:      ['percussion_cycdh_kurz08-perc08.wav'],
  },
}

// Cymatics "Bang" hip-hop one-shots — producer-grade kick/snare/clap/hat/perc
// committed under server/Assets/drums/cymatics and served by the public /assets
// static mount (Tone.Player media fetches can't attach an auth token, so the
// kit must be reachable without one). These replace the thin per-mode GM samples
// as the PRIMARY drum kit; they play the same role the premium private kit does
// (one consistent kit across modes).
const CYMATICS_BANG_KIT: SampleKitDefinition = {
  kick:      ['/assets/drums/cymatics/kick.wav'],
  // Backbeat alternates snare and clap (a common boom-bap variation) via the
  // round-robin slot cursor.
  snare:     ['/assets/drums/cymatics/snare.wav', '/assets/drums/cymatics/clap.wav'],
  hatClosed: ['/assets/drums/cymatics/hat-closed.wav'],
  hatOpen:   ['/assets/drums/cymatics/hat-open.wav'],
  perc:      ['/assets/drums/cymatics/perc.wav'],
}

// Additional Cymatics Bang variations — different pitches/tones from the same
// one-shot library. These are appended to the primary pool so that when a
// primary slot permanently errors (404 / network), the round-robin cursor
// naturally lands on one of these instead of falling through to a synth voice.
// Fallback chain: primary Bang slot → these variations → silent (no synth).
const CYMATICS_FALLBACK_KIT: SampleKitDefinition = {
  kick:      [
    '/assets/drums/cymatics/kick-2.wav',   // Bang Kick 2 – C# (punchier transient)
    '/assets/drums/cymatics/kick-3.wav',   // Bang Kick 3 – D  (mid-weight sub)
  ],
  snare:     [
    '/assets/drums/cymatics/snare-2.wav',  // Bang Snare 2 – D
    '/assets/drums/cymatics/snare-3.wav',  // Bang Snare 3 – F
    '/assets/drums/cymatics/clap-2.wav',   // Bang Clap 2 (tighter snap)
    '/assets/drums/cymatics/clap-3.wav',   // Bang Clap 3
  ],
  hatClosed: [
    '/assets/drums/cymatics/hat-closed-2.wav',
    '/assets/drums/cymatics/hat-closed-3.wav',
  ],
  hatOpen:   [
    '/assets/drums/cymatics/hat-open-2.wav',  // Bang Open Hihat 2 (shorter decay)
  ],
  perc:      [
    '/assets/drums/cymatics/perc-2.wav',   // Bang Percussion 7 (darker)
    '/assets/drums/cymatics/perc-3.wav',   // Bang Percussion 10
    '/assets/drums/cymatics/rim-1.wav',    // Bang Rimshot 1 (grooves well in perc slot)
  ],
}

// Merged kit used at runtime: primary URLs first, fallback URLs appended.
// SampledDrumKit.trigger() scans forward through the pool on error, so failed
// primary slots are transparently replaced by working fallback slots.
// No synth oscillator fallback anywhere in this chain — see DrumGenerator.
const CYMATICS_BANG_WITH_FALLBACKS: SampleKitDefinition = {
  kick:      [...CYMATICS_BANG_KIT.kick,      ...CYMATICS_FALLBACK_KIT.kick],
  snare:     [...CYMATICS_BANG_KIT.snare,     ...CYMATICS_FALLBACK_KIT.snare],
  hatClosed: [...CYMATICS_BANG_KIT.hatClosed, ...CYMATICS_FALLBACK_KIT.hatClosed],
  hatOpen:   [...CYMATICS_BANG_KIT.hatOpen,   ...CYMATICS_FALLBACK_KIT.hatOpen],
  perc:      [...CYMATICS_BANG_KIT.perc,      ...CYMATICS_FALLBACK_KIT.perc],
}

const VOICE_TRIM_DB: Record<SampleVoice, number> = {
  kick: -3,
  snare: -6,
  hatClosed: -14,
  hatOpen: -16,
  perc: -10,
}

// Playback windows — generous, not surgical. The old values (kick 0.65s,
// hatOpen 0.5s) hard-truncated the one-shots' natural tails, which is exactly
// the part that makes a produced kit sound expensive. Closed hat stays tight
// by design (that IS the sample's character).
const VOICE_DURATION: Record<SampleVoice, Tone.Unit.Time> = {
  kick: 1.1,
  snare: 0.7,
  hatClosed: 0.08,
  hatOpen: 0.85,
  perc: 0.3,
}

const VOICE_POOL_SIZE: Record<SampleVoice, number> = {
  kick: 3,
  snare: 4,
  hatClosed: 10,
  hatOpen: 5,
  perc: 4,
}

const MAX_PRIVATE_POOL_SIZE: Record<SampleVoice, number> = {
  kick: 5,
  snare: 5,
  hatClosed: 6,
  hatOpen: 4,
  perc: 4,
}

export function buildSampleKitDefinitionFromSamples(
  kitId: string,
  samples: OrganismKitSample[],
): SampleKitDefinition | null {
  const preferred = PREFERRED_KIT_POOLS[kitId] ?? {}
  const urlsByRole = (
    role: OrganismKitSample['role'],
    fallbackMatch?: RegExp,
    voice: SampleVoice = role as SampleVoice,
  ) => {
    const urls: string[] = []
    for (const match of preferred[voice] ?? []) {
      const preferredSample = samples.find((sample) => sample.role === role && match.test(sample.fileName))
      if (preferredSample && !urls.includes(preferredSample.url)) urls.push(preferredSample.url)
    }
    if (urls.length) return urls.slice(0, MAX_PRIVATE_POOL_SIZE[voice])

    const fallback = samples
      .filter((sample) => sample.role === role && (!fallbackMatch || fallbackMatch.test(sample.fileName)))
      .map((sample) => sample.url)

    for (const url of fallback) {
      if (urls.length >= MAX_PRIVATE_POOL_SIZE[voice]) break
      if (!urls.includes(url)) urls.push(url)
    }

    return urls.slice(0, MAX_PRIVATE_POOL_SIZE[voice])
  }

  const kick = urlsByRole('kick', undefined, 'kick')
  const snare = urlsByRole('snare', undefined, 'snare')
  let hatClosed = urlsByRole('hat', /\b(cl|closed|close|ch)\b/i, 'hatClosed')
  let hatOpen = urlsByRole('hat', /\b(op|open|oh)\b/i, 'hatOpen')

  // Fallback: if we found no closed hats by regex but there are 'hat' role samples, partition them
  if (!hatClosed.length) {
    const allHats = urlsByRole('hat', undefined, 'hatClosed')
    if (allHats.length > 0) {
      hatClosed = allHats.slice(0, Math.ceil(allHats.length / 2))
      if (!hatOpen.length) {
        hatOpen = allHats.slice(Math.ceil(allHats.length / 2))
        if (!hatOpen.length) {
          hatOpen = hatClosed
        }
      }
    }
  }

  const perc = urlsByRole('perc', undefined, 'perc')
  const tomPerc = perc.length ? perc : urlsByRole('tom', undefined, 'perc')

  if (!kick.length || !snare.length || !hatClosed.length || !tomPerc.length) return null

  return {
    kick,
    snare,
    hatClosed,
    hatOpen: hatOpen.length ? hatOpen : hatClosed,
    perc: tomPerc,
  }
}

export class SampledDrumKit {
  private readonly output: Tone.Gain
  private readonly slots = new Map<SampleVoice, SampleVoiceSlot[]>()
  private readonly slotCursor = new Map<SampleVoice, number>()
  private readonly slotErrored = new Set<string>()  // "voice:slotIndex" → failed to load
  private currentMode: OrganismMode | null = null
  private privateKitDefinition: SampleKitDefinition | null = null
  private warnedVoices = new Set<SampleVoice>()

  // Profile-based kit selection
  private profiles: Map<string, SampleProfile> = new Map()
  private genreTarget: GenreTarget = getGenreTarget('hip-hop')

  // Key tuning — kicks are retuned onto the song's key root (≤ ±3 st) via
  // playbackRate. Rates are detected off-thread (setTimeout) and cached per
  // URL; until a rate is cached the kick plays untuned (rate 1) — never a
  // blocking pitch analysis inside the trigger path.
  private keyRootPc: number | null = null
  private kickTuneRates = new Map<string, { pc: number; rate: number }>()

  constructor(output: Tone.Gain) {
    this.output = output
    // Seed the merged Cymatics kit (primary + fallback URLs) as the initial
    // definition. The pool contains enough variations that if a primary URL
    // errors the cursor naturally lands on a working fallback — no synth.
    // hydratePrivateKit() may still override this with a discovered premium kit.
    this.privateKitDefinition = CYMATICS_BANG_WITH_FALLBACKS
    this.setMode(OrganismMode.Glow)
    void this.hydratePrivateKit()
    // Load DSP profiles in the background — used by setGenreTarget() to re-rank
    // voice pools once profiles arrive. No-ops silently if the DB isn't ready yet.
    void loadSampleProfiles().then((p) => { this.profiles = p })
  }

  /**
   * Tell the kit what genre we're playing so it can re-rank its voice pools.
   * Safe to call at any time — re-builds voice pools from the current definition.
   */
  setGenreTarget(subGenre: string): void {
    const target = getGenreTarget(subGenre)
    this.genreTarget = target
    // Rebuild the private kit definition using the new target if profiles are ready
    if (this.profiles.size > 0 && this.privateKitDefinition) {
      this.rebuildVoicePools(this.privateKitDefinition)
    }
  }

  setMode(mode: OrganismMode): void {
    if (this.currentMode === mode) return
    const prevMode = this.currentMode
    this.currentMode = mode

    // If the private kit (TR-808) is hydrated, every "mode" plays the SAME
    // samples — only the velocity/filter shaping per mode differs. Reusing
    // the existing Tone.Player slots avoids the 200-500ms silent-hit window
    // that you'd otherwise get every time the user clicks a preset that
    // changes mode (Heat for trap, Ice for cloud, etc). Without this reuse
    // path, switching preset → setMode → disposeVoices → recreate → wait
    // for cache hits = audibly broken first 1-2 bars of the new preset.
    //
    // We still rebuild if the private kit isn't ready yet (cold-start before
    // /api/organism/kits resolves) — those modes do use different bundled
    // sample files, so dispose+recreate is necessary there.
    const reuseSlots = this.privateKitDefinition !== null && prevMode !== null
    if (reuseSlots) return

    this.disposeVoices()
    this.slotErrored.clear()
    this.warnedVoices.clear()

    const definition = this.privateKitDefinition ?? KIT_DEFINITIONS[mode] ?? KIT_DEFINITIONS[OrganismMode.Glow]
    for (const [voice, urls] of Object.entries(definition) as [SampleVoice, string[]][]) {
      const voiceSlots: SampleVoiceSlot[] = []
      const poolSize = Math.max(VOICE_POOL_SIZE[voice], urls.length)

      for (let i = 0; i < poolSize; i++) {
        const slotKey = `${voice}:${i}`
        const filename = urls[i % urls.length]
        const gain = new Tone.Gain(0)
        gain.connect(this.output)

        const player = new Tone.Player({
          url: sampleUrl(filename),
          fadeOut: 0.006,
          onerror: (error) => {
            this.slotErrored.add(slotKey)
            if (this.warnedVoices.has(voice)) return
            this.warnedVoices.add(voice)
            console.warn('[Organism] sampled drum voice failed to load; using synth fallback', {
              voice,
              filename,
              error,
            })
          },
        })
        player.volume.value = VOICE_TRIM_DB[voice]
        player.connect(gain)
        voiceSlots.push({ gain, player, url: filename })
      }

      this.slots.set(voice, voiceSlots)
      this.slotCursor.set(voice, 0)
    }
  }

  /**
   * @param velocity   post-dynamics velocity (kick-duck, multipliers) — sets loudness
   * @param voiceVelocity pre-dynamics pattern velocity — selects the voice. Without
   *   this split, an open-hat accent ducked by a nearby kick would mutate into a
   *   CLOSED hat (timbre flapping), and freeplay could never reach the open hat.
   */
  trigger(instrument: DrumInstrument, time: number, velocity: number, voiceVelocity = velocity): boolean {
    const voice = this.resolveVoice(instrument, voiceVelocity)
    const voiceSlots = this.slots.get(voice)
    if (!voiceSlots || voiceSlots.length === 0) return false

    const startCursor = this.slotCursor.get(voice) ?? 0
    const shapedVelocity = velocityToGain(velocity)

    // Backbeat snares layer the clap ON TOP of the snare (the producer move)
    // instead of the round-robin cursor randomly alternating snare/clap hits.
    // Clap slots are excluded from the primary scan when a non-clap snare exists.
    const isClapSlot = (slot: SampleVoiceSlot) => /clap/i.test(slot.url)
    const snareHasBoth = voice === 'snare'
      && voiceSlots.some(isClapSlot) && voiceSlots.some(s => !isClapSlot(s))

    // Scan forward from cursor for the first usable slot.
    // Skips permanently-errored slots (404/network) so fallback URLs are used
    // transparently — no synth oscillator is ever triggered by this path.
    // The cursor is advanced past the chosen slot to preserve round-robin variation.
    for (let i = 0; i < voiceSlots.length; i++) {
      const slotIndex = (startCursor + i) % voiceSlots.length
      const slotKey = `${voice}:${slotIndex}`

      if (this.slotErrored.has(slotKey)) continue

      const slot = voiceSlots[slotIndex]
      if (snareHasBoth && isClapSlot(slot)) continue  // claps are layer-only now

      // Advance cursor past this slot for the next trigger call
      this.slotCursor.set(voice, (slotIndex + 1) % voiceSlots.length)

      // Still loading — claim the hit so DrumGenerator does NOT fall back to
      // synth. A handful of silent hits during cold-start is preferable to the
      // jarring "synth drummer → real kit" timbre shift mid-loop.
      if (!slot.player.loaded) return true

      try {
        if (voice === 'kick') this.applyKickTuning(slot)
        slot.gain.gain.cancelScheduledValues(time)
        slot.gain.gain.setValueAtTime(shapedVelocity, time)
        slot.player.start(time, 0, VOICE_DURATION[voice])
        if (snareHasBoth && voiceVelocity >= 0.75) {
          this.layerClap(voiceSlots, time, shapedVelocity)
        }
        return true
      } catch (error) {
        // Scheduling error — mark as permanently failed and try the next slot
        this.slotErrored.add(slotKey)
        if (!this.warnedVoices.has(voice)) {
          this.warnedVoices.add(voice)
          console.warn('[Organism] sampled drum slot scheduling failed; trying fallback slot', {
            voice, slotKey, error,
          })
        }
        // continue scanning fallback slots
      }
    }

    // All slots for this voice exhausted — go silent.
    // No synth fallback: a missing beat in hip-hop is less disruptive than an
    // oscillator thump that reads as the wrong kit entirely.
    if (!this.warnedVoices.has(voice)) {
      this.warnedVoices.add(voice)
      console.warn('[Organism] all Cymatics drum slots exhausted for voice; going silent (no synth)', { voice })
    }
    return false
  }

  /** Set the song's key root (pitch class 0-11, null = no tuning). Kicks are
   *  retuned onto it so the drum's sub sits in key with the 808 and chords. */
  setKeyRoot(pc: number | null): void {
    if (pc === this.keyRootPc) return
    this.keyRootPc = pc
    this.scheduleKickTuning()
  }

  /** Pre-compute tuning rates off the trigger path. Idempotent per (url, pc). */
  private scheduleKickTuning(): void {
    if (this.keyRootPc === null || typeof window === 'undefined') return
    const pc = this.keyRootPc
    window.setTimeout(() => {
      if (this.keyRootPc !== pc) return
      for (const slot of this.slots.get('kick') ?? []) {
        if (this.kickTuneRates.get(slot.url)?.pc === pc) continue
        const audio = slot.player.buffer?.loaded ? slot.player.buffer.get() : undefined
        if (!audio) continue
        const f0 = detectFundamentalHz(audio.getChannelData(0), audio.sampleRate)
        const rate = f0 ? Math.pow(2, tuneShiftSemitones(f0, pc) / 12) : 1
        this.kickTuneRates.set(slot.url, { pc, rate })
      }
    }, 0)
  }

  private applyKickTuning(slot: SampleVoiceSlot): void {
    const cached = this.kickTuneRates.get(slot.url)
    const rate = cached && cached.pc === this.keyRootPc ? cached.rate : 1
    if (slot.player.playbackRate !== rate) slot.player.playbackRate = rate
    // Not yet analyzed for this key — kick this URL's analysis off-thread.
    if (!cached && this.keyRootPc !== null) this.scheduleKickTuning()
  }

  /** Stack the first loaded clap under a backbeat snare at reduced level. */
  private layerClap(voiceSlots: SampleVoiceSlot[], time: number, snareGain: number): void {
    for (let i = 0; i < voiceSlots.length; i++) {
      const slot = voiceSlots[i]
      if (!/clap/i.test(slot.url)) continue
      if (this.slotErrored.has(`snare:${i}`)) continue
      if (!slot.player.loaded) continue
      try {
        slot.gain.gain.cancelScheduledValues(time)
        slot.gain.gain.setValueAtTime(snareGain * 0.55, time)
        slot.player.start(time, 0, VOICE_DURATION.snare)
      } catch { /* layer is decorative — never fail the primary hit over it */ }
      return
    }
  }

  dispose(): void {
    this.disposeVoices()
  }

  private resolveVoice(instrument: DrumInstrument, velocity: number): SampleVoice {
    switch (instrument) {
      case DrumInstrument.Kick:
        return 'kick'
      case DrumInstrument.Snare:
        return 'snare'
      case DrumInstrument.Hat:
        return velocity > 0.55 ? 'hatOpen' : 'hatClosed'
      case DrumInstrument.Perc:
        return 'perc'
    }
  }

  private disposeVoices(): void {
    for (const voiceSlots of this.slots.values()) {
      for (const { player, gain } of voiceSlots) {
        player.dispose()
        gain.dispose()
      }
    }
    this.slots.clear()
    this.slotCursor.clear()
  }

  /** Re-rank the voice pools inside an already-built definition using profile scores. */
  private rebuildVoicePools(definition: SampleKitDefinition): void {
    const voiceMap: Record<string, SampleVoice> = {
      kick: 'kick', snare: 'snare', hatClosed: 'hatClosed', hatOpen: 'hatOpen', perc: 'perc',
    }
    for (const [voiceKey, urls] of Object.entries(definition) as [string, string[]][]) {
      const voice = voiceMap[voiceKey] as SampleVoice
      if (!voice || urls.length < 2) continue  // nothing to re-rank
      // Score each URL by profile fit; URLs without profiles keep a neutral 0.5 score
      const scored = urls.map((url) => {
        const profile = getProfileByFilename(this.profiles, url)
        const score = profile ? scoreForVoice(profile, voice, this.genreTarget) : 0.5
        return { url, score }
      })
      scored.sort((a, b) => b.score - a.score)
      // Mutate the urls array in-place so the existing definition reflects the new ranking
      scored.forEach(({ url }, i) => { (definition as Record<string, string[]>)[voiceKey][i] = url })
    }
  }

  private async hydratePrivateKit(): Promise<void> {
    try {
      const response = await loadOrganismKits()
      if (!response) return

      const kit = response.kits.find((candidate) => candidate.id === response.bestKitId) ?? response.kits[0]
      if (!kit) return

      const definition = buildSampleKitDefinitionFromSamples(kit.id, kit.samples)
      if (!definition) return

      this.privateKitDefinition = definition
      // If profiles already arrived, rank the new definition before loading voices
      if (this.profiles.size > 0) this.rebuildVoicePools(definition)
      const mode = this.currentMode ?? OrganismMode.Glow
      this.currentMode = null
      this.setMode(mode)
      console.info('[Organism] private drum kit loaded', { kitId: kit.id })
    } catch (error) {
      console.warn('[Organism] private drum kit discovery failed; using bundled kit', error)
    }
  }
}
