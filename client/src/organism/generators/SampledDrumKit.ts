import * as Tone from 'tone'
import { DrumInstrument } from './types'
import { OrganismMode } from '../physics/types'

type SampleVoice = 'kick' | 'snare' | 'hatClosed' | 'hatOpen' | 'perc'

type SampleKitDefinition = Record<SampleVoice, string>

const sampleUrl = (filename: string): string => `/api/samples/${encodeURIComponent(filename)}`

const KIT_DEFINITIONS: Record<OrganismMode, SampleKitDefinition> = {
  [OrganismMode.Heat]: {
    kick: 'kick_._e808_bd[short]-03.wav',
    snare: 'snare_._e808_sd-08.wav',
    hatClosed: 'hihat_cycdh_eleck01-cl01.wav',
    hatOpen: 'hihat_cycdh_eleck01-op01.wav',
    perc: 'percussion_perc-808.wav',
  },
  [OrganismMode.Gravel]: {
    kick: 'kick_acoustic01.wav',
    snare: 'snare_acoustic01.wav',
    hatClosed: 'hihat_cycdh_k1close_cl03.wav',
    hatOpen: 'hihat_cycdh_k1close_op03.wav',
    perc: 'percussion_cycdh_kurz08-perc03.wav',
  },
  [OrganismMode.Smoke]: {
    kick: 'kick_1985.wav',
    snare: 'snare_cassette.wav',
    hatClosed: 'hihat_vinyl.wav',
    hatOpen: 'hihat_cycdh_k2room_op02.wav',
    perc: 'percussion_shaker-analog.wav',
  },
  [OrganismMode.Ice]: {
    kick: 'kick_low_rez.wav',
    snare: 'snare_block.wav',
    hatClosed: 'hihat_micro.wav',
    hatOpen: 'hihat_sizzle.wav',
    perc: 'percussion_perc-metal.wav',
  },
  [OrganismMode.Glow]: {
    kick: 'kick_classic.wav',
    snare: 'snare_big.wav',
    hatClosed: 'hihat_acoustic_01.wav',
    hatOpen: 'hihat_cycdh_k2room_op01.wav',
    perc: 'percussion_perc-short.wav',
  },
}

const VOICE_TRIM_DB: Record<SampleVoice, number> = {
  kick: -3,
  snare: -5,
  hatClosed: -12,
  hatOpen: -14,
  perc: -10,
}

const VOICE_DURATION: Record<SampleVoice, Tone.Unit.Time> = {
  kick: 0.65,
  snare: 0.45,
  hatClosed: 0.08,
  hatOpen: 0.5,
  perc: 0.22,
}

export class SampledDrumKit {
  private readonly output: Tone.Gain
  private readonly voiceGains = new Map<SampleVoice, Tone.Gain>()
  private readonly players = new Map<SampleVoice, Tone.Player>()
  private currentMode: OrganismMode | null = null
  private warnedVoices = new Set<SampleVoice>()

  constructor(output: Tone.Gain) {
    this.output = output
    this.setMode(OrganismMode.Glow)
  }

  setMode(mode: OrganismMode): void {
    if (this.currentMode === mode) return
    this.disposeVoices()
    this.currentMode = mode

    const definition = KIT_DEFINITIONS[mode] ?? KIT_DEFINITIONS[OrganismMode.Glow]
    for (const [voice, filename] of Object.entries(definition) as [SampleVoice, string][]) {
      const gain = new Tone.Gain(0)
      gain.connect(this.output)

      const player = new Tone.Player({
        url: sampleUrl(filename),
        fadeOut: 0.006,
        onerror: (error) => {
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

      this.voiceGains.set(voice, gain)
      this.players.set(voice, player)
    }
  }

  trigger(instrument: DrumInstrument, time: number, velocity: number): boolean {
    const voice = this.resolveVoice(instrument, velocity)
    const player = this.players.get(voice)
    const gain = this.voiceGains.get(voice)
    if (!player || !gain || !player.loaded) return false

    const shapedVelocity = Math.max(0, Math.min(1, velocity))
    gain.gain.cancelScheduledValues(time)
    gain.gain.setValueAtTime(shapedVelocity, time)
    player.start(time, 0, VOICE_DURATION[voice])
    return true
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
    for (const player of this.players.values()) player.dispose()
    for (const gain of this.voiceGains.values()) gain.dispose()
    this.players.clear()
    this.voiceGains.clear()
  }
}
