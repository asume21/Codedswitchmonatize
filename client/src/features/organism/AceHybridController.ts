/**
 * AceHybridController — the live/ace/both mode switch for the ACE-Step hybrid
 * (rung 2/3). It owns the relationship between ACE's produced stems and the
 * generative band so they never silently double up:
 *
 *   - 'live' : generative band plays; ACE stems silent (default — nothing changes).
 *   - 'ace'  : ACE stems are the sound; the generative band is silenced — BUT only
 *              once the stems actually arrive (rendering takes minutes), so the band
 *              keeps playing during the render and we swap on arrival (graceful, no
 *              dead air). Mirrors composeForPreset's "jam first, upgrade when ready".
 *   - 'both' : ACE stems + full generative band layered (the A/B test case).
 *
 * Headless + dependency-injected so it unit-tests without Tone/React: the stem
 * layer, the stem fetcher, and the "silence the band" hook are all passed in.
 */
import type { AceStem } from '@/organism/loops/AceStemLayer'
import { requestAceStems, type AceStemRequest } from './requestAceStems'

export type AceHybridMode = 'live' | 'ace' | 'both'

/** The slice of AceStemLayer this controller drives (kept minimal so tests can
 *  inject a fake without Tone). */
export interface StemLayerLike {
  load(stems: AceStem[], targetBpm: number): Promise<void>
  play(): void
  stop(): void
  setActive(active: boolean): void
}

export interface AceHybridDeps {
  stemLayer: StemLayerLike
  /** Silence (true) or restore (false) the generative band — drums/bass/keys/
   *  melody/chords. Wired in the provider to the orchestrator's generator gains. */
  setBandSilenced: (silenced: boolean) => void
  /** Injectable stem fetcher (defaults to the real requestAceStems). */
  fetchStems?: (req: AceStemRequest) => Promise<AceStem[] | null>
}

export class AceHybridController {
  private mode: AceHybridMode = 'live'
  private request: AceStemRequest | null = null
  private stemsReady = false
  private requesting = false

  constructor(private deps: AceHybridDeps) {}

  getMode(): AceHybridMode { return this.mode }
  isStemsReady(): boolean { return this.stemsReady }

  /**
   * Provide/replace the render request (e.g. from the loaded ArrangementPlan).
   * Drops any stale stems; if a stem-using mode is active, kicks off a fresh
   * render. Safe to call on every plan/section change.
   */
  setRequest(req: AceStemRequest): void {
    this.request = req
    this.stemsReady = false
    this.deps.stemLayer.stop()
    if (this.mode !== 'live') void this.ensureStems()
    this.applyMode()
  }

  /** Switch mode. Returns immediately; stems load in the background if needed. */
  setMode(mode: AceHybridMode): void {
    this.mode = mode
    if (mode !== 'live') void this.ensureStems()
    this.applyMode()
  }

  private async ensureStems(): Promise<void> {
    if (this.stemsReady || this.requesting || !this.request) return
    this.requesting = true
    try {
      const fetchStems = this.deps.fetchStems ?? requestAceStems
      const stems = await fetchStems(this.request)
      if (!stems || stems.length === 0) return
      await this.deps.stemLayer.load(stems, this.request.bpm)
      this.deps.stemLayer.play()
      this.stemsReady = true
    } catch (err) {
      console.warn('[aceHybrid] stem render failed; staying on live band', err)
    } finally {
      this.requesting = false
      this.applyMode()
    }
  }

  /** Reconcile audio to (mode × readiness). The single place that decides who
   *  is heard, so the two never double unintentionally. */
  private applyMode(): void {
    const stemsActive  = this.mode !== 'live' && this.stemsReady
    const bandSilenced = this.mode === 'ace' && this.stemsReady
    this.deps.stemLayer.setActive(stemsActive)
    this.deps.setBandSilenced(bandSilenced)
  }

  dispose(): void {
    this.deps.stemLayer.stop()
    this.deps.setBandSilenced(false)
  }
}
