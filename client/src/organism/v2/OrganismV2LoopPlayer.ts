import { getAudioContext } from '../../lib/audioContext'
import type { QuickStartPreset } from '../../features/organism/QuickStartPresets'

export interface OrganismV2Stem {
  id: 'kick' | 'snare' | 'hats' | 'perc' | 'toms'
  label: string
  url: string
  gain: number
}

export interface OrganismV2Status {
  active: boolean
  presetId: string | null
  kitBpm: number | null
  targetBpm: number | null
  playbackRate: number
  stems: OrganismV2Stem[]
}

const AVAILABLE_BPMS = [85, 95, 105, 124, 132]

const STEM_FILES: Record<number, Record<OrganismV2Stem['id'], string>> = {
  85: {
    kick: '/assets/loops/85bpm/E808_Loop_BD_85-08.wav',
    snare: '/assets/loops/85bpm/E808_Loop_SD_85-08.wav',
    hats: '/assets/loops/85bpm/E808_Loop_Hats_85-08.wav',
    perc: '/assets/loops/85bpm/E808_Loop_Perc_85-04.wav',
    toms: '/assets/loops/85bpm/E808_Loop_Toms_85-04.wav',
  },
  95: {
    kick: '/assets/loops/95bpm/E808_Loop_BD_95-08.wav',
    snare: '/assets/loops/95bpm/E808_Loop_SD_95-08.wav',
    hats: '/assets/loops/95bpm/E808_Loop_Hats_95-08.wav',
    perc: '/assets/loops/95bpm/E808_Loop_Perc_95-04.wav',
    toms: '/assets/loops/95bpm/E808_Loop_Toms_95-04.wav',
  },
  105: {
    kick: '/assets/loops/105bpm/E808_Loop_BD_105-08.wav',
    snare: '/assets/loops/105bpm/E808_Loop_SD_105-08.wav',
    hats: '/assets/loops/105bpm/E808_Loop_Hats_105-08.wav',
    perc: '/assets/loops/105bpm/E808_Loop_Perc_105-04.wav',
    toms: '/assets/loops/105bpm/E808_Loop_Toms_105-04.wav',
  },
  124: {
    kick: '/assets/loops/124bpm/E808_Loop_BD_124-08.wav',
    snare: '/assets/loops/124bpm/E808_Loop_SD_124-07.wav',
    hats: '/assets/loops/124bpm/E808_Loop_Hats_124-08.wav',
    perc: '/assets/loops/124bpm/E808_Loop_Perc_124-04.wav',
    toms: '/assets/loops/124bpm/E808_Loop_Toms_124-04.wav',
  },
  132: {
    kick: '/assets/loops/132bpm/E808_Loop_BD_132-08.wav',
    snare: '/assets/loops/132bpm/E808_Loop_SD_132-08.wav',
    hats: '/assets/loops/132bpm/E808_Loop_Hats_132-08.wav',
    perc: '/assets/loops/132bpm/E808_Loop_Perc_132-04.wav',
    toms: '/assets/loops/132bpm/E808_Loop_Toms_132-04.wav',
  },
}

const STEM_GAINS: Record<OrganismV2Stem['id'], number> = {
  kick: 0.95,
  snare: 0.78,
  hats: 0.42,
  perc: 0.34,
  toms: 0.22,
}

function nearestKitBpm(targetBpm: number): number {
  return AVAILABLE_BPMS.reduce((best, bpm) =>
    Math.abs(bpm - targetBpm) < Math.abs(best - targetBpm) ? bpm : best,
  AVAILABLE_BPMS[0])
}

function makeStem(id: OrganismV2Stem['id'], kitBpm: number): OrganismV2Stem {
  return {
    id,
    label: id === 'perc' ? 'Percussion' : id[0].toUpperCase() + id.slice(1),
    url: STEM_FILES[kitBpm][id],
    gain: STEM_GAINS[id],
  }
}

interface StemNode {
  stem: OrganismV2Stem
  audio: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
}

export class OrganismV2LoopPlayer {
  private stems: StemNode[] = []
  private master: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private bassGain: GainNode | null = null
  private bassTimer: number | null = null
  private status: OrganismV2Status = {
    active: false,
    presetId: null,
    kitBpm: null,
    targetBpm: null,
    playbackRate: 1,
    stems: [],
  }

  getStatus(): OrganismV2Status {
    return {
      ...this.status,
      stems: [...this.status.stems],
    }
  }

  async start(preset: QuickStartPreset): Promise<OrganismV2Status> {
    this.stop()

    const ctx = getAudioContext()
    if (ctx.state !== 'running') {
      await ctx.resume()
    }

    const kitBpm = nearestKitBpm(preset.bpm)
    const playbackRate = Math.max(0.75, Math.min(1.18, preset.bpm / kitBpm))
    const stems = (['kick', 'snare', 'hats', 'perc', 'toms'] as const).map(id => makeStem(id, kitBpm))

    const master = ctx.createGain()
    master.gain.value = 1.45

    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.knee.value = 18
    compressor.ratio.value = 3
    compressor.attack.value = 0.006
    compressor.release.value = 0.18

    master.connect(compressor)
    compressor.connect(ctx.destination)
    this.master = master
    this.compressor = compressor

    this.stems = stems.map(stem => {
      const audio = new Audio(stem.url)
      audio.crossOrigin = 'anonymous'
      audio.loop = true
      audio.preload = 'auto'
      audio.playbackRate = playbackRate

      const source = ctx.createMediaElementSource(audio)
      const gain = ctx.createGain()
      gain.gain.value = stem.gain
      source.connect(gain)
      gain.connect(master)
      return { stem, audio, source, gain }
    })

    await Promise.all(this.stems.map(({ audio }) => new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener('canplaythrough', onReady)
        audio.removeEventListener('error', onError)
      }
      const onReady = () => {
        cleanup()
        resolve()
      }
      const onError = () => {
        cleanup()
        reject(new Error(`Could not load ${audio.src}`))
      }
      audio.addEventListener('canplaythrough', onReady, { once: true })
      audio.addEventListener('error', onError, { once: true })
      audio.load()
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) onReady()
    })))

    this.stems.forEach(({ audio }) => {
      audio.currentTime = 0
    })

    await Promise.all(this.stems.map(({ audio }) => audio.play()))
    this.startBassPattern(preset.bpm, preset.energy)

    this.status = {
      active: true,
      presetId: preset.id,
      kitBpm,
      targetBpm: preset.bpm,
      playbackRate,
      stems,
    }
    return this.getStatus()
  }

  setMasterGain(value: number): void {
    if (!this.master) return
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(2.5, value)), getAudioContext().currentTime, 0.02)
  }

  stop(): void {
    if (this.bassTimer !== null) {
      window.clearInterval(this.bassTimer)
      this.bassTimer = null
    }

    this.stems.forEach(({ audio, source, gain }) => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      source.disconnect()
      gain.disconnect()
    })
    this.stems = []
    this.bassGain?.disconnect()
    this.bassGain = null
    this.master?.disconnect()
    this.compressor?.disconnect()
    this.master = null
    this.compressor = null

    this.status = {
      active: false,
      presetId: null,
      kitBpm: null,
      targetBpm: null,
      playbackRate: 1,
      stems: [],
    }
  }

  private startBassPattern(bpm: number, energy: QuickStartPreset['energy']): void {
    const ctx = getAudioContext()
    const bassGain = ctx.createGain()
    bassGain.gain.value = energy === 'high' ? 0.34 : energy === 'medium' ? 0.26 : 0.18
    bassGain.connect(this.master ?? ctx.destination)
    this.bassGain = bassGain

    const beatSeconds = 60 / bpm
    const pattern = energy === 'high'
      ? [0, 0.75, 1.5, 2.5, 3.25]
      : energy === 'medium'
        ? [0, 1.5, 2.5]
        : [0, 2]
    const notes = energy === 'high' ? [43.65, 43.65, 51.91, 38.89, 43.65] : [43.65, 38.89, 43.65]

    const playBar = () => {
      const now = ctx.currentTime + 0.03
      pattern.forEach((beat, index) => {
        const osc = ctx.createOscillator()
        const noteGain = ctx.createGain()
        const start = now + beat * beatSeconds
        const duration = beatSeconds * (energy === 'low' ? 1.6 : 0.82)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(notes[index % notes.length], start)
        osc.frequency.exponentialRampToValueAtTime(Math.max(28, notes[index % notes.length] * 0.72), start + duration)
        noteGain.gain.setValueAtTime(0.0001, start)
        noteGain.gain.exponentialRampToValueAtTime(1, start + 0.012)
        noteGain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
        osc.connect(noteGain)
        noteGain.connect(bassGain)
        osc.start(start)
        osc.stop(start + duration + 0.02)
      })
    }

    playBar()
    this.bassTimer = window.setInterval(playBar, beatSeconds * 4 * 1000)
  }
}
