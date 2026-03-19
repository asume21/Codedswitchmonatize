// Section 05 — TensionRelease behavior

import type { ReactiveContext, ReactiveConfig } from '../types'

export class TensionRelease {
  private readonly config:      ReactiveConfig
  private tensionHistory:       number[]  = []
  private releaseWindowOpen:    boolean   = false
  private releaseWindowFrames:  number    = 0
  private lastReleaseFrameIdx:  number    = -999

  constructor(config: ReactiveConfig) {
    this.config = config
  }

  process(ctx: ReactiveContext): Partial<{
    textureVolumeMultiplier: number
    kickVelocityMultiplier:  number
  }> {
    const tension     = this.computeTensionIndex(ctx)
    const fps         = 43
    const windowFrames = Math.round(this.config.tensionBuildBars * 4 * fps / 10)

    this.tensionHistory.push(tension)
    if (this.tensionHistory.length > windowFrames) this.tensionHistory.shift()

    const isBuildingTension = this.isTensionBuilding(windowFrames)

    const releaseWindowFrames =
      Math.round(this.config.tensionReleaseWindowBars * 4 * fps / 10)

    if (isBuildingTension && !this.releaseWindowOpen) {
      const framesSinceLast = ctx.frame.frameIndex - this.lastReleaseFrameIdx
      if (framesSinceLast > windowFrames) {
        this.releaseWindowOpen   = true
        this.releaseWindowFrames = releaseWindowFrames
        this.lastReleaseFrameIdx = ctx.frame.frameIndex
      }
    }

    if (this.releaseWindowOpen) {
      this.releaseWindowFrames--
      if (this.releaseWindowFrames <= 0) {
        this.releaseWindowOpen = false
      }
      return {
        textureVolumeMultiplier: 0.6,
        kickVelocityMultiplier:  1.25,
      }
    }

    return {}
  }

  isReleaseWindowOpen(): boolean { return this.releaseWindowOpen }

  reset(): void {
    this.tensionHistory      = []
    this.releaseWindowOpen   = false
    this.releaseWindowFrames = 0
    this.lastReleaseFrameIdx = -999
  }

  // ── Private ──────────────────────────────────────────────────────

  private computeTensionIndex(ctx: ReactiveContext): number {
    const { rms, spectralFlux } = ctx.frame
    const { presence }          = ctx.physics
    return Math.min(1, (rms * 0.4) + (spectralFlux * 0.4) + (presence * 0.2))
  }

  private isTensionBuilding(windowFrames: number): boolean {
    if (this.tensionHistory.length < windowFrames) return false
    const firstHalf  = this.tensionHistory.slice(0, windowFrames / 2)
    const secondHalf = this.tensionHistory.slice(windowFrames / 2)
    const meanFirst  = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const meanSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    return meanSecond > meanFirst * 1.15
  }
}
