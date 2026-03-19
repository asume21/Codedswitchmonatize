export class DensityComputer {
  private readonly windowFrames: number
  private readonly smoothing:    number

  private generatorLevels: Map<string, number> = new Map()

  private densityBuffer: number[] = []
  private smoothed:      number   = 0

  private highDensityFrameCount: number = 0
  private readonly highDensityThreshold  = 0.85
  private readonly highDensityFrameLimit = 172

  constructor(windowFrames: number, smoothing: number) {
    this.windowFrames = windowFrames
    this.smoothing    = smoothing
  }

  registerGeneratorLevel(name: string, level: number): void {
    this.generatorLevels.set(name, Math.max(0, Math.min(1, level)))
  }

  process(voicePresence: number): { density: number; thinningRequested: boolean } {
    let total = voicePresence * 0.3

    for (const level of this.generatorLevels.values()) {
      total += level
    }

    const generatorCount = Math.max(1, this.generatorLevels.size)
    const raw = Math.min(1, total / (1 + generatorCount * 0.175))

    this.densityBuffer.push(raw)
    if (this.densityBuffer.length > this.windowFrames) {
      this.densityBuffer.shift()
    }

    const avg = this.densityBuffer.reduce((a, b) => a + b, 0)
              / this.densityBuffer.length

    this.smoothed += this.smoothing * (avg - this.smoothed)

    if (this.smoothed > this.highDensityThreshold) {
      this.highDensityFrameCount += 1
    } else {
      this.highDensityFrameCount = 0
    }

    const thinningRequested = this.highDensityFrameCount >= this.highDensityFrameLimit

    return { density: Math.max(0, Math.min(1, this.smoothed)), thinningRequested }
  }

  reset(): void {
    this.generatorLevels       = new Map()
    this.densityBuffer         = []
    this.smoothed              = 0
    this.highDensityFrameCount = 0
  }
}
