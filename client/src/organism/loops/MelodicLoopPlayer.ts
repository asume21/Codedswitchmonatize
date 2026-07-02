import * as Tone from 'tone'

/**
 * MelodicLoopPlayer — the Organism's "real instrument" melody layer.
 *
 * Instead of synthesizing the melody, we play a real recorded melodic loop
 * (strings/keys/guitar) that matches the song's key + tempo, and ride it on the
 * SAME Tone.Transport as the generative drums + 808 so everything locks. This is
 * the jump from "synth demo" to "real beat".
 *
 * Catalog comes from GET /api/loops (see server/services/melodicLoopLibrary.ts).
 */

export interface CatalogLoop {
  id: string
  url: string
  fileName: string
  pack: string
  bpm: number
  key: string
  root: string
  mode: 'minor' | 'major'
  instrument: string
  durationSec?: number
  bars?: number
}

export type LoopChopKind = 'half-bar' | 'bar' | 'two-bar'

export interface CatalogLoopChop {
  id: string
  loopId: string
  url: string
  fileName: string
  pack: string
  bpm: number
  key: string
  root: string
  mode: 'minor' | 'major'
  instrument: string
  kind: LoopChopKind
  startSec: number
  durationSec: number
  bar: number
  beat: number
  tags: string[]
}

export interface LoopSelection {
  /** Desired musical root, e.g. "C", "F#". */
  root: string
  /** Desired mode. */
  mode: 'minor' | 'major'
  /** Target transport BPM. */
  bpm: number
  /** Preferred instrument substring, e.g. "violin". */
  instrument?: string
}

export class MelodicLoopPlayer {
  private catalog: CatalogLoop[] = []
  private chopCatalog: CatalogLoopChop[] = []
  private player: Tone.Player | null = null
  private chopPlayers: Map<string, Tone.Player> = new Map()
  private chopEventIds: number[] = []
  private gain: Tone.Gain
  private current: CatalogLoop | null = null
  private currentChops: CatalogLoopChop[] = []
  private loaded = false
  private chopsLoaded = false

  /**
   * @param output optional node to route into (e.g. the Organism MixEngine master
   *   input) so the shared limiter catches peaks and the loop sits inside one
   *   coherent mix. Falls back to the raw destination if not provided.
   */
  constructor(output?: Tone.InputNode) {
    // Strings are a finished, mixed element — keep their trim modest so summing
    // with the drum/808 bus doesn't clip. Routed through the master when given.
    this.gain = new Tone.Gain(0.7)
    if (output) this.gain.connect(output)
    else this.gain.toDestination()
  }

  async loadCatalog(): Promise<CatalogLoop[]> {
    if (this.loaded) return this.catalog
    try {
      const res = await fetch('/api/loops')
      if (!res.ok) throw new Error(`/api/loops ${res.status}`)
      const data = await res.json()
      this.catalog = Array.isArray(data.loops) ? data.loops : []
      this.loaded = true
    } catch (err) {
      console.warn('[MelodicLoop] catalog load failed', err)
      this.catalog = []
    }
    return this.catalog
  }

  getCatalog(): CatalogLoop[] {
    return this.catalog
  }

  async loadChops(): Promise<CatalogLoopChop[]> {
    if (this.chopsLoaded) return this.chopCatalog
    try {
      const res = await fetch('/api/loops/chops')
      if (!res.ok) throw new Error(`/api/loops/chops ${res.status}`)
      const data = await res.json()
      this.chopCatalog = Array.isArray(data.chops) ? data.chops : []
      this.chopsLoaded = true
    } catch (err) {
      console.warn('[MelodicLoop] chop catalog load failed', err)
      this.chopCatalog = []
    }
    return this.chopCatalog
  }

  getChopCatalog(): CatalogLoopChop[] {
    return this.chopCatalog
  }

  /**
   * Score + pick the best loop for the requested key/tempo/instrument.
   * Returns null if the catalog is empty.
   */
  select(sel: LoopSelection): CatalogLoop | null {
    if (this.catalog.length === 0) return null
    // Only consider REAL multi-bar phrase loops. The catalog also contains
    // hundreds of single-note one-shots / chord-hits (e.g. SK_FMPiano01_120_A =
    // one piano note) — some even carry a key+bpm in the name, but looping a
    // single note as "the melody" sounds broken. The Splice "_Mini_SP" packs are
    // the genuine multi-bar phrases. (One-shots feed the future playable-instrument
    // path, not this drop-in loop layer.)
    const loops = this.catalog.filter(l => l.key && l.bpm > 0 && /mini.?sp/i.test(l.pack))
    if (loops.length === 0) return null
    // We adopt the loop's NATIVE key (the band re-keys to it) rather than
    // transposing the audio — transposing recorded loops introduces artifacts.
    // So selection weights instrument (the style's voice) + mode + tempo.
    const instruments = (sel.instrument ? sel.instrument.split('|') : []).map(s => s.trim().toLowerCase()).filter(Boolean)
    const scored = loops.map((loop) => {
      let score = 0
      if (loop.mode === sel.mode) score += 30
      // Instrument match is the strongest signal — it's what makes a style's
      // melody sound like that style (strings vs keys vs guitar).
      if (instruments.length && instruments.some(i => loop.instrument.includes(i))) score += 60
      if (loop.bpm > 0) score -= Math.abs(loop.bpm - sel.bpm) * 0.4
      return { loop, score }
    })
    scored.sort((a, b) => b.score - a.score)
    if (scored.length === 0) return null
    // Variety: pick randomly among the top matches (within 20 pts of the best)
    // so the same style doesn't replay the identical phrase every time, while
    // still respecting instrument/mode/tempo fit.
    const top = scored.filter(s => s.score >= scored[0].score - 20)
    const pool = top.length > 0 ? top : scored
    // Avoid immediately repeating the last loop when there's an alternative.
    const fresh = pool.filter(s => s.loop.id !== this.current?.id)
    const choices = fresh.length > 0 ? fresh : pool
    return choices[Math.floor(Math.random() * choices.length)].loop
  }

  /**
   * Pick + play a loop matching the selection, synced to Tone.Transport.
   * Transposes (detune) to the requested root and time-stretches (playbackRate)
   * toward the target BPM. Safe to call repeatedly — it swaps the active loop.
   */
  async play(sel: LoopSelection): Promise<CatalogLoop | null> {
    await this.loadCatalog()
    const loop = this.select(sel)
    if (!loop) {
      console.warn('[MelodicLoop] no loop matched', sel)
      return null
    }
    this.stop()

    const playbackRate = loop.bpm > 0 ? Math.max(0.5, Math.min(2, sel.bpm / loop.bpm)) : 1

    return new Promise<CatalogLoop | null>((resolve) => {
      const player = new Tone.Player({
        url: loop.url,
        loop: true,
        playbackRate,
        fadeIn: 0.02,
        fadeOut: 0.05,
        onload: () => {
          // Ride the Transport so it locks to drums/808. start(0) syncs the loop
          // phase to the current transport position (Tone computes the offset).
          player.sync().start(0)
          this.current = loop
          resolve(loop)
        },
        onerror: (e) => {
          console.warn('[MelodicLoop] failed to load', loop.url, e)
          resolve(null)
        },
      }).connect(this.gain)
      this.player = player
    })
  }

  selectChops(sel: LoopSelection, bars = 4): CatalogLoopChop[] {
    if (this.chopCatalog.length === 0) return []
    const instruments = (sel.instrument ? sel.instrument.split('|') : []).map(s => s.trim().toLowerCase()).filter(Boolean)
    const scored = this.chopCatalog
      .filter(chop => chop.kind === 'bar')
      .map(chop => {
        let score = 0
        if (chop.mode === sel.mode) score += 25
        if (instruments.length && instruments.some(i => chop.instrument.includes(i) || chop.tags.includes(i))) score += 55
        if (chop.bpm > 0) score -= Math.abs(chop.bpm - sel.bpm) * 0.35
        if (chop.tags.includes('fullmix')) score -= 15
        if (this.currentChops.some(current => current.id === chop.id)) score -= 20
        return { chop, score }
      })
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) return []
    const top = scored.filter(s => s.score >= scored[0].score - 18)
    const pool = top.length > 0 ? top : scored
    const phrase: CatalogLoopChop[] = []
    const used = new Set<string>()

    for (let i = 0; i < bars; i++) {
      const candidates = pool.filter(s => !used.has(s.chop.id))
      const choices = candidates.length > 0 ? candidates : pool
      const pick = choices[Math.floor(Math.random() * choices.length)].chop
      phrase.push(pick)
      used.add(pick.id)
    }

    return phrase
  }

  async playChopped(sel: LoopSelection): Promise<CatalogLoopChop[]> {
    await this.loadChops()
    const chops = this.selectChops(sel, 4)
    if (chops.length === 0) {
      console.warn('[MelodicLoop] no chops matched', sel)
      return []
    }

    this.stop()
    this.currentChops = chops

    const uniqueLoopIds = [...new Set(chops.map(chop => chop.loopId))]
    await Promise.all(uniqueLoopIds.map(loopId => {
      const chop = chops.find(c => c.loopId === loopId)!
      const playbackRate = chop.bpm > 0 ? Math.max(0.5, Math.min(2, sel.bpm / chop.bpm)) : 1
      return new Promise<void>((resolve) => {
        const player = new Tone.Player({
          url: chop.url,
          loop: false,
          playbackRate,
          fadeIn: 0.01,
          fadeOut: 0.035,
          onload: () => resolve(),
          onerror: (e) => {
            console.warn('[MelodicLoop] failed to load chop source', chop.url, e)
            resolve()
          },
        }).connect(this.gain)
        this.chopPlayers.set(loopId, player)
      })
    }))

    const transport = Tone.getTransport()
    const schedulePhrase = (time: number) => {
      const bpm = Math.max(40, Number(transport.bpm.value) || sel.bpm || 90)
      const beatSec = 60 / bpm
      chops.forEach((chop, index) => {
        const player = this.chopPlayers.get(chop.loopId)
        if (!player) return
        player.start(time + index * 4 * beatSec, chop.startSec, chop.durationSec)
      })
    }

    const startAt = transport.state === 'started' ? '+0.05' : 0
    const eventId = transport.scheduleRepeat(schedulePhrase, '4m', startAt)
    this.chopEventIds.push(eventId)

    return chops
  }

  setLevel(linear: number): void {
    this.gain.gain.rampTo(Math.max(0, Math.min(1.5, linear)), 0.1)
  }

  isPlaying(): boolean {
    return this.current !== null
  }

  getCurrent(): CatalogLoop | null {
    return this.current
  }

  /** Dynamically adjust active loop and chop players' playbackRate to match the transport BPM. */
  syncBpm(targetBpm: number): void {
    const applyRate = (player: any, originalBpm: number) => {
      if (!player || !(originalBpm > 0)) return
      const rate = Math.max(0.5, Math.min(2, targetBpm / originalBpm))
      if (player.playbackRate && typeof player.playbackRate === 'object' && 'value' in player.playbackRate) {
        player.playbackRate.value = rate
      } else {
        player.playbackRate = rate
      }
    }

    if (this.player && this.current && this.current.bpm > 0) {
      applyRate(this.player, this.current.bpm)
    }

    for (const [loopId, player] of this.chopPlayers.entries()) {
      const chop = this.currentChops.find(c => c.loopId === loopId)
      if (chop && chop.bpm > 0) {
        applyRate(player, chop.bpm)
      }
    }
  }

  stop(): void {
    const transport = Tone.getTransport()
    for (const id of this.chopEventIds) {
      try { transport.clear(id) } catch { /* already cleared */ }
    }
    this.chopEventIds = []
    for (const player of this.chopPlayers.values()) {
      try { player.stop() } catch { /* not started */ }
      try { player.dispose() } catch { /* already disposed */ }
    }
    this.chopPlayers.clear()
    this.currentChops = []
    if (this.player) {
      try { this.player.unsync().stop(); } catch { /* not started */ }
      try { this.player.dispose(); } catch { /* already disposed */ }
      this.player = null
    }
    this.current = null
  }

  dispose(): void {
    this.stop()
    try { this.gain.dispose(); } catch { /* already disposed */ }
  }
}
