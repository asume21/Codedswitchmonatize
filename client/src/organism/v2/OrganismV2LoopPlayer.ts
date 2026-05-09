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
  section: string | null
  bar: number
  cycleBars: number
  stems: OrganismV2Stem[]
}

interface ArrangementSection {
  name: 'intro' | 'verse' | 'hook' | 'breakdown' | 'drop'
  bars: number
  gains: Record<OrganismV2Stem['id'], number>
  bass: number
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

const ARRANGEMENT: ArrangementSection[] = [
  {
    name: 'intro',
    bars: 4,
    gains: { kick: 0.18, snare: 0.28, hats: 0.34, perc: 0.18, toms: 0 },
    bass: 0,
  },
  {
    name: 'verse',
    bars: 8,
    gains: { kick: 0.82, snare: 0.70, hats: 0.36, perc: 0.24, toms: 0 },
    bass: 0.68,
  },
  {
    name: 'hook',
    bars: 8,
    gains: { kick: 1.0, snare: 0.84, hats: 0.50, perc: 0.34, toms: 0.08 },
    bass: 1.0,
  },
  {
    name: 'breakdown',
    bars: 4,
    gains: { kick: 0.18, snare: 0.36, hats: 0.28, perc: 0.18, toms: 0 },
    bass: 0.22,
  },
  {
    name: 'drop',
    bars: 8,
    gains: { kick: 1.05, snare: 0.88, hats: 0.56, perc: 0.38, toms: 0.16 },
    bass: 1.08,
  },
]

const ARRANGEMENT_TOTAL_BARS = ARRANGEMENT.reduce((sum, section) => sum + section.bars, 0)

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
  private bassDrive: WaveShaperNode | null = null
  private bassFilter: BiquadFilterNode | null = null
  private bassTimer: number | null = null
  private barTimer: number | null = null
  private barIndex: number = 0
  private currentPreset: QuickStartPreset | null = null
  private statusListener: ((status: OrganismV2Status) => void) | null = null
  private status: OrganismV2Status = {
    active: false,
    presetId: null,
    kitBpm: null,
    targetBpm: null,
    playbackRate: 1,
    section: null,
    bar: 0,
    cycleBars: ARRANGEMENT_TOTAL_BARS,
    stems: [],
  }

  onStatusChange(listener: (status: OrganismV2Status) => void): () => void {
    this.statusListener = listener
    listener(this.getStatus())
    return () => {
      if (this.statusListener === listener) this.statusListener = null
    }
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
    this.currentPreset = preset
    this.barIndex = 0
    this.startBassChain(preset.energy)

    this.status = {
      active: true,
      presetId: preset.id,
      kitBpm,
      targetBpm: preset.bpm,
      playbackRate,
      section: 'intro',
      bar: 1,
      cycleBars: ARRANGEMENT_TOTAL_BARS,
      stems,
    }
    this.applyArrangementBar()
    this.startArrangementClock(preset.bpm)
    this.emitStatus()
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
    if (this.barTimer !== null) {
      window.clearInterval(this.barTimer)
      this.barTimer = null
    }

    this.stems.forEach(({ audio, source, gain }) => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      source.disconnect()
      gain.disconnect()
    })
    this.stems = []
    this.currentPreset = null
    this.barIndex = 0
    this.bassDrive?.disconnect()
    this.bassFilter?.disconnect()
    this.bassGain?.disconnect()
    this.bassDrive = null
    this.bassFilter = null
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
      section: null,
      bar: 0,
      cycleBars: ARRANGEMENT_TOTAL_BARS,
      stems: [],
    }
    this.emitStatus()
  }

  private startArrangementClock(bpm: number): void {
    const barMs = (60 / bpm) * 4 * 1000
    this.barTimer = window.setInterval(() => {
      this.barIndex = (this.barIndex + 1) % ARRANGEMENT_TOTAL_BARS
      this.applyArrangementBar()
      this.emitStatus()
    }, barMs)
  }

  private getSectionForBar(barIndex: number): { section: ArrangementSection; localBar: number } {
    let cursor = 0
    for (const section of ARRANGEMENT) {
      if (barIndex < cursor + section.bars) {
        return { section, localBar: barIndex - cursor }
      }
      cursor += section.bars
    }
    return { section: ARRANGEMENT[ARRANGEMENT.length - 1], localBar: 0 }
  }

  private applyArrangementBar(): void {
    if (!this.currentPreset) return

    const ctx = getAudioContext()
    const { section, localBar } = this.getSectionForBar(this.barIndex)
    const isFillBar = this.barIndex > 0 && (this.barIndex + 1) % 8 === 0
    const isDropEntry = localBar === 0 && (section.name === 'hook' || section.name === 'drop')
    const now = ctx.currentTime

    this.stems.forEach(({ stem, gain }) => {
      let target = stem.gain * section.gains[stem.id]
      if (isFillBar && (stem.id === 'toms' || stem.id === 'perc')) target *= 2.4
      if (isDropEntry && (stem.id === 'kick' || stem.id === 'snare')) target *= 1.12
      gain.gain.cancelScheduledValues(now)
      gain.gain.setTargetAtTime(Math.max(0, target), now, 0.08)
    })

    if (this.bassGain) {
      const energyGain = this.currentPreset.energy === 'high' ? 0.42 : this.currentPreset.energy === 'medium' ? 0.32 : 0.22
      this.bassGain.gain.cancelScheduledValues(now)
      this.bassGain.gain.setTargetAtTime(energyGain * section.bass, now, 0.05)
    }

    this.scheduleBassBar(section, localBar, isFillBar)

    this.status = {
      ...this.status,
      section: section.name,
      bar: this.barIndex + 1,
    }
  }

  private startBassChain(energy: QuickStartPreset['energy']): void {
    const ctx = getAudioContext()
    const bassGain = ctx.createGain()
    bassGain.gain.value = energy === 'high' ? 0.42 : energy === 'medium' ? 0.32 : 0.22

    const drive = ctx.createWaveShaper()
    drive.curve = this.makeDriveCurve(energy === 'high' ? 1.8 : 1.2)
    drive.oversample = '2x'

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = energy === 'high' ? 420 : 320
    filter.Q.value = 0.7

    bassGain.connect(drive)
    drive.connect(filter)
    filter.connect(this.master ?? ctx.destination)
    this.bassGain = bassGain
    this.bassDrive = drive
    this.bassFilter = filter
  }

  private scheduleBassBar(section: ArrangementSection, localBar: number, isFillBar: boolean): void {
    if (!this.currentPreset || !this.bassGain || section.bass <= 0) return

    const ctx = getAudioContext()
    const bpm = this.currentPreset.bpm
    const energy = this.currentPreset.energy
    const beatSeconds = 60 / bpm
    const root = energy === 'high' ? 43.65 : energy === 'low' ? 38.89 : 41.2
    const fifth = root * 1.5
    const minorSeventh = root * 1.7818
    const octave = root * 2
    const barVariation = localBar % 4
    const pattern = section.name === 'breakdown'
      ? [{ beat: 0, note: root, length: 2.4 }]
      : energy === 'high'
        ? [
            { beat: 0, note: root, length: 0.64 },
            { beat: 0.75, note: root, length: 0.42 },
            { beat: 1.5, note: barVariation === 3 ? minorSeventh : fifth, length: 0.56 },
            { beat: 2.5, note: root * 0.89, length: 0.48 },
            { beat: isFillBar ? 3.0 : 3.25, note: isFillBar ? octave : root, length: 0.38 },
          ]
        : energy === 'medium'
          ? [
              { beat: 0, note: root, length: 0.9 },
              { beat: 1.5, note: barVariation === 2 ? fifth : root * 0.89, length: 0.58 },
              { beat: 2.5, note: root, length: 0.72 },
              ...(isFillBar ? [{ beat: 3.35, note: octave, length: 0.32 }] : []),
            ]
          : [
              { beat: 0, note: root, length: 1.65 },
              { beat: 2, note: barVariation === 3 ? fifth : root * 0.89, length: 1.2 },
            ]

    const now = ctx.currentTime + 0.025
    pattern.forEach(({ beat, note, length }) => {
      const osc = ctx.createOscillator()
      const click = ctx.createOscillator()
      const noteGain = ctx.createGain()
      const clickGain = ctx.createGain()
      const start = now + beat * beatSeconds
      const duration = beatSeconds * length

      osc.type = 'sine'
      osc.frequency.setValueAtTime(note, start)
      osc.frequency.exponentialRampToValueAtTime(Math.max(28, note * 0.72), start + duration)

      click.type = 'triangle'
      click.frequency.setValueAtTime(note * 2, start)

      noteGain.gain.setValueAtTime(0.0001, start)
      noteGain.gain.exponentialRampToValueAtTime(1, start + 0.01)
      noteGain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      clickGain.gain.setValueAtTime(0.12, start)
      clickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.045)

      osc.connect(noteGain)
      click.connect(clickGain)
      noteGain.connect(this.bassGain!)
      clickGain.connect(this.bassGain!)
      osc.start(start)
      click.start(start)
      osc.stop(start + duration + 0.02)
      click.stop(start + 0.06)
    })
  }

  private makeDriveCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 256
    const curve = new Float32Array(new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT))
    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / samples - 1
      curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x))
    }
    return curve as Float32Array<ArrayBuffer>
  }

  private emitStatus(): void {
    this.statusListener?.(this.getStatus())
  }
}
