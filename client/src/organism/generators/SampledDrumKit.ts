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
 * Keep ghost notes audible without flattening accents. A literal linear gain
 * makes a 0.2-velocity hat disappear after its per-voice trim, so the
 * drummer's feel layer never reaches the listener.
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

// Absolute URLs (/api/…, /assets/…) pass through. Cymatics one-shots are
// public static assets; bare names still resolve through the sample library.
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

// The committed Bang one-shots are the dependable, producer-grade starting
// kit. Discovery can upgrade them to a private kit later, but cold starts must
// not sound like a generic GM drum machine.
const CYMATICS_BANG_KIT: SampleKitDefinition = {
  kick:      ['/assets/drums/cymatics/kick.wav'],
  snare:     ['/assets/drums/cymatics/snare.wav', '/assets/drums/cymatics/clap.wav'],
  hatClosed: ['/assets/drums/cymatics/hat-closed.wav'],
  hatOpen:   ['/assets/drums/cymatics/hat-open.wav'],
  perc:      ['/assets/drums/cymatics/perc.wav'],
}

const CYMATICS_FALLBACK_KIT: SampleKitDefinition = {
  kick:      ['/assets/drums/cymatics/kick-2.wav', '/assets/drums/cymatics/kick-3.wav'],
  snare:     [
    '/assets/drums/cymatics/snare-2.wav',
    '/assets/drums/cymatics/snare-3.wav',
    '/assets/drums/cymatics/clap-2.wav',
    '/assets/drums/cymatics/clap-3.wav',
  ],
  hatClosed: ['/assets/drums/cymatics/hat-closed-2.wav', '/assets/drums/cymatics/hat-closed-3.wav'],
  hatOpen:   ['/assets/drums/cymatics/hat-open-2.wav'],
  perc:      [
    '/assets/drums/cymatics/perc-2.wav',
    '/assets/drums/cymatics/perc-3.wav',
    '/assets/drums/cymatics/rim-1.wav',
  ],
}

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

const VOICE_DURATION: Record<SampleVoice, Tone.Unit.Time> = {
  // Let the natural one-shot tails speak; only closed hats stay deliberately tight.
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

  // Imported kits are not consistently named. A kit with generic `hat` roles
  // should still be playable rather than getting rejected by a filename regex.
  if (!hatClosed.length) {
    const allHats = urlsByRole('hat', undefined, 'hatClosed')
    if (allHats.length) {
      const split = Math.ceil(allHats.length / 2)
      hatClosed = allHats.slice(0, split)
      if (!hatOpen.length) hatOpen = allHats.slice(split)
      if (!hatOpen.length) hatOpen = hatClosed
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
  private kitSource: string = 'bundled:cymatics-bang'
  private warnedVoices = new Set<SampleVoice>()
  private profiles: Map<string, SampleProfile> = new Map()
  private genreTarget: GenreTarget = getGenreTarget('hip-hop')
  private keyRootPc: number | null = null
  private kickTuneRates = new Map<string, { pc: number; rate: number }>()

  constructor(output: Tone.Gain) {
    this.output = output
    this.privateKitDefinition = CYMATICS_BANG_WITH_FALLBACKS
    this.setMode(OrganismMode.Glow)
    void this.hydratePrivateKit()
    void loadSampleProfiles().then((profiles) => {
      this.profiles = profiles
      if (profiles.size && this.privateKitDefinition) this.rebuildVoicePools(this.privateKitDefinition)
    })
  }

  getDebug(): Record<string, unknown> {
    const voices = Object.fromEntries([...this.slots.entries()].map(([voice, slots]) => [
      voice,
      {
        total: slots.length,
        loaded: slots.filter((slot) => slot.player.loaded).length,
        errors: slots.filter((_, index) => this.slotErrored.has(`${voice}:${index}`)).length,
      },
    ]))
    return {
      mode: this.currentMode,
      source: this.kitSource,
      voices,
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

  /** Retune a pitched kick gently (at most ±3 semitones) to the song key. */
  setKeyRoot(pc: number | null): void {
    const normalized = pc === null ? null : ((Math.round(pc) % 12) + 12) % 12
    if (normalized === this.keyRootPc) return
    this.keyRootPc = normalized
    this.scheduleKickTuning()
  }

  setGenreTarget(subGenre: string): void {
    this.genreTarget = getGenreTarget(subGenre)
    if (this.profiles.size && this.privateKitDefinition) this.rebuildVoicePools(this.privateKitDefinition)
  }

  trigger(instrument: DrumInstrument, time: number, velocity: number, voiceVelocity = velocity): boolean {
    const voice = this.resolveVoice(instrument, voiceVelocity)
    const voiceSlots = this.slots.get(voice)
    if (!voiceSlots || voiceSlots.length === 0) return false

    const startCursor = this.slotCursor.get(voice) ?? 0
    const shapedVelocity = velocityToGain(velocity)
    const isClap = (slot: SampleVoiceSlot) => /clap/i.test(slot.url)
    const snareHasBoth = voice === 'snare' && voiceSlots.some(isClap) && voiceSlots.some(slot => !isClap(slot))

    // Scan around failed slots before allowing DrumGenerator's deliberately
    // conservative synth fallback. This keeps one bad asset from changing the
    // whole kit's identity mid-song.
    for (let i = 0; i < voiceSlots.length; i++) {
      const slotIndex = (startCursor + i) % voiceSlots.length
      const slotKey = `${voice}:${slotIndex}`
      if (this.slotErrored.has(slotKey)) continue

      const slot = voiceSlots[slotIndex]
      if (snareHasBoth && isClap(slot)) continue
      this.slotCursor.set(voice, (slotIndex + 1) % voiceSlots.length)

      // Claim a streaming hit so the first loaded bar does not flip from synth
      // to samples partway through a phrase.
      if (!slot.player.loaded) return true

      try {
        if (voice === 'kick') this.applyKickTuning(slot)
        slot.gain.gain.cancelScheduledValues(time)
        slot.gain.gain.setValueAtTime(shapedVelocity, time)
        slot.player.start(time, 0, VOICE_DURATION[voice])
        if (snareHasBoth && voiceVelocity >= 0.75) this.layerClap(voiceSlots, time, shapedVelocity)
        return true
      } catch (error) {
        this.slotErrored.add(slotKey)
        if (!this.warnedVoices.has(voice)) {
          this.warnedVoices.add(voice)
          console.warn('[Organism] sampled drum slot could not be scheduled; trying another sample', { voice, slotKey, error })
        }
      }
    }

    return false
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

  /** Pitch analysis is deliberately outside the audio callback. */
  private scheduleKickTuning(): void {
    if (this.keyRootPc === null) return
    const pc = this.keyRootPc
    globalThis.setTimeout(() => {
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
    if (!cached && this.keyRootPc !== null) this.scheduleKickTuning()
  }

  private layerClap(voiceSlots: SampleVoiceSlot[], time: number, snareGain: number): void {
    for (let i = 0; i < voiceSlots.length; i++) {
      const slot = voiceSlots[i]
      if (!/clap/i.test(slot.url) || this.slotErrored.has(`snare:${i}`) || !slot.player.loaded) continue
      try {
        slot.gain.gain.cancelScheduledValues(time)
        slot.gain.gain.setValueAtTime(snareGain * 0.55, time)
        slot.player.start(time, 0, VOICE_DURATION.snare)
      } catch { /* decorative layer must never cancel its primary snare */ }
      return
    }
  }

  /** Re-rank live pools by measured sample fit without re-creating players. */
  private rebuildVoicePools(definition: SampleKitDefinition): void {
    for (const [voice, urls] of Object.entries(definition) as [SampleVoice, string[]][]) {
      if (urls.length < 2) continue
      urls.sort((a, b) => {
        const score = (url: string) => {
          const profile = getProfileByFilename(this.profiles, url)
          return profile ? scoreForVoice(profile, voice, this.genreTarget) : 0.5
        }
        return score(b) - score(a)
      })

      const rank = new Map(urls.map((url, index) => [url, index]))
      const active = this.slots.get(voice)
      if (active) {
        active.sort((a, b) => (rank.get(a.url) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.url) ?? Number.MAX_SAFE_INTEGER))
        this.slotCursor.set(voice, 0)
      }
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
      this.kitSource = `private:${kit.id}`
      if (this.profiles.size) this.rebuildVoicePools(definition)
      const mode = this.currentMode ?? OrganismMode.Glow
      this.currentMode = null
      this.setMode(mode)
      console.info('[Organism] private drum kit loaded', { kitId: kit.id })
    } catch (error) {
      console.warn('[Organism] private drum kit discovery failed; using bundled kit', error)
    }
  }
}
