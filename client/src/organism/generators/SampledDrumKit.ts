import * as Tone from 'tone'
import { DrumInstrument } from './types'
import { OrganismMode } from '../physics/types'
import { loadOrganismKits, type OrganismKitSample } from '../instruments/OrganismKitCache'

type SampleVoice = 'kick' | 'snare' | 'hatClosed' | 'hatOpen' | 'perc'

type SampleKitDefinition = Record<SampleVoice, string[]>
type SampleVoiceSlot = {
  gain: Tone.Gain
  player: Tone.Player
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

const sampleUrl = (filenameOrUrl: string): string =>
  filenameOrUrl.startsWith('/api/') ? filenameOrUrl : `/api/samples/${encodeURIComponent(filenameOrUrl)}`

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

const VOICE_TRIM_DB: Record<SampleVoice, number> = {
  kick: -3,
  snare: -6,
  hatClosed: -14,
  hatOpen: -16,
  perc: -10,
}

const VOICE_DURATION: Record<SampleVoice, Tone.Unit.Time> = {
  kick: 0.65,
  snare: 0.45,
  hatClosed: 0.08,
  hatOpen: 0.5,
  perc: 0.22,
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
  const hatClosed = urlsByRole('hat', /\b(cl|closed|close|ch)\b/i, 'hatClosed')
  const hatOpen = urlsByRole('hat', /\b(op|open|oh)\b/i, 'hatOpen')
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

  constructor(output: Tone.Gain) {
    this.output = output
    this.setMode(OrganismMode.Glow)
    void this.hydratePrivateKit()
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
        voiceSlots.push({ gain, player })
      }

      this.slots.set(voice, voiceSlots)
      this.slotCursor.set(voice, 0)
    }
  }

  trigger(instrument: DrumInstrument, time: number, velocity: number): boolean {
    const voice = this.resolveVoice(instrument, velocity)
    const voiceSlots = this.slots.get(voice)
    if (!voiceSlots || voiceSlots.length === 0) return false

    const cursor = this.slotCursor.get(voice) ?? 0
    const slotIndex = cursor % voiceSlots.length
    const slot = voiceSlots[slotIndex]
    this.slotCursor.set(voice, (slotIndex + 1) % voiceSlots.length)

    const slotKey = `${voice}:${slotIndex}`
    // If this slot permanently errored (server returned 404/network fail), fall
    // through to the synth fallback so drums are never silent.
    if (this.slotErrored.has(slotKey)) return false

    // Still loading — claim the hit so DrumGenerator does NOT fall back to its
    // MembraneSynth/NoiseSynth voices. We return true (sampler "owns" this hit)
    // even though no audio fires; the alternative — synth fallback during the
    // first 1-2 bars while WAVs stream in — produces a jarring timbre shift
    // mid-loop once samples finish loading. A handful of silent hits during
    // cold-start is preferable to "synth drummer → real kit" hand-off in
    // the listener's ear.
    if (!slot.player.loaded) return true

    const shapedVelocity = Math.max(0, Math.min(1, velocity))
    try {
      slot.gain.gain.cancelScheduledValues(time)
      slot.gain.gain.setValueAtTime(shapedVelocity, time)
      slot.player.start(time, 0, VOICE_DURATION[voice])
      return true
    } catch (error) {
      if (!this.warnedVoices.has(voice)) {
        this.warnedVoices.add(voice)
        console.warn('[Organism] sampled drum voice could not be scheduled; using synth fallback', {
          voice,
          error,
        })
      }
      return false
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

  private async hydratePrivateKit(): Promise<void> {
    try {
      const response = await loadOrganismKits()
      if (!response) return

      const kit = response.kits.find((candidate) => candidate.id === response.bestKitId) ?? response.kits[0]
      if (!kit) return

      const definition = buildSampleKitDefinitionFromSamples(kit.id, kit.samples)
      if (!definition) return

      this.privateKitDefinition = definition
      const mode = this.currentMode ?? OrganismMode.Glow
      this.currentMode = null
      this.setMode(mode)
      console.info('[Organism] private drum kit loaded', { kitId: kit.id })
    } catch (error) {
      console.warn('[Organism] private drum kit discovery failed; using bundled kit', error)
    }
  }
}
