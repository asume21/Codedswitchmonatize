export class SwingComputer {
  private readonly windowOnsets: number
  private readonly smoothing:    number

  private onsetTimes:    number[] = []
  private smoothedSwing: number   = 0.5

  constructor(windowOnsets: number, smoothing: number) {
    this.windowOnsets = windowOnsets
    this.smoothing    = smoothing
  }

  process(onsetDetected: boolean, onsetTimestamp: number): number {
    if (!onsetDetected) return this.smoothedSwing

    this.onsetTimes.push(onsetTimestamp)
    if (this.onsetTimes.length > this.windowOnsets + 1) {
      this.onsetTimes.shift()
    }

    if (this.onsetTimes.length < 3) return this.smoothedSwing

    const iois: number[] = []
    for (let i = 1; i < this.onsetTimes.length; i += 1) {
      iois.push(this.onsetTimes[i] - this.onsetTimes[i - 1])
    }

    const longIois:  number[] = []
    const shortIois: number[] = []

    for (let i = 0; i < iois.length - 1; i += 2) {
      if (iois[i] > iois[i + 1]) {
        longIois.push(iois[i])
        shortIois.push(iois[i + 1])
      } else {
        longIois.push(iois[i + 1])
        shortIois.push(iois[i])
      }
    }

    if (longIois.length === 0 || shortIois.length === 0) return this.smoothedSwing

    const meanLong  = longIois.reduce((a, b) => a + b, 0)  / longIois.length
    const meanShort = shortIois.reduce((a, b) => a + b, 0) / shortIois.length
    const total     = meanLong + meanShort

    if (total === 0) return this.smoothedSwing

    const rawSwing = Math.max(0.5, Math.min(0.75, meanLong / total))

    this.smoothedSwing += this.smoothing * (rawSwing - this.smoothedSwing)

    return this.smoothedSwing
  }

  reset(): void {
    this.onsetTimes    = []
    this.smoothedSwing = 0.5
  }
}
