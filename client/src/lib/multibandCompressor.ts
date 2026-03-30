/**
 * Multi-band Compressor — Splits audio into 3 frequency bands (low/mid/high)
 * and compresses each independently. Essential for mastering.
 *
 * Signal flow:
 *   input → [lowpass → compLow  ]
 *         → [bandpass → compMid ] → mixGain → output
 *         → [highpass → compHigh]
 */

export interface MultibandConfig {
  /** Crossover frequency between low and mid bands (Hz) */
  lowCrossover: number;
  /** Crossover frequency between mid and high bands (Hz) */
  highCrossover: number;
  /** Per-band compressor settings */
  low:  BandCompressorConfig;
  mid:  BandCompressorConfig;
  high: BandCompressorConfig;
  /** Output gain (dB) */
  outputGainDb: number;
}

export interface BandCompressorConfig {
  threshold: number;  // dB
  ratio: number;
  attack: number;     // seconds
  release: number;    // seconds
  knee: number;       // dB
  makeupGain: number; // dB
  solo: boolean;
  mute: boolean;
}

const DEFAULT_BAND: BandCompressorConfig = {
  threshold: -18,
  ratio: 3,
  attack: 0.01,
  release: 0.15,
  knee: 6,
  makeupGain: 0,
  solo: false,
  mute: false,
};

export const DEFAULT_MULTIBAND_CONFIG: MultibandConfig = {
  lowCrossover: 200,
  highCrossover: 4000,
  low:  { ...DEFAULT_BAND, threshold: -20, ratio: 4, attack: 0.02, release: 0.2 },
  mid:  { ...DEFAULT_BAND, threshold: -16, ratio: 2.5 },
  high: { ...DEFAULT_BAND, threshold: -14, ratio: 2, attack: 0.005, release: 0.1 },
  outputGainDb: 0,
};

interface BandNodes {
  filter: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  makeupGain: GainNode;
  muteGain: GainNode;
}

export class MultibandCompressor {
  private ctx: AudioContext;
  readonly input: GainNode;
  readonly output: GainNode;

  private lowBand: BandNodes;
  private midBand: BandNodes;
  private highBand: BandNodes;
  private outputGain: GainNode;

  private config: MultibandConfig;

  constructor(ctx: AudioContext, config?: Partial<MultibandConfig>) {
    this.ctx = ctx;
    this.config = { ...DEFAULT_MULTIBAND_CONFIG, ...config };

    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = Math.pow(10, this.config.outputGainDb / 20);

    // Create bands
    this.lowBand = this.createBand('lowpass', this.config.lowCrossover, this.config.low);
    this.midBand = this.createBandpass(this.config.lowCrossover, this.config.highCrossover, this.config.mid);
    this.highBand = this.createBand('highpass', this.config.highCrossover, this.config.high);

    // Wire: input → filters → compressors → makeup → mute → outputGain → output
    this.input.connect(this.lowBand.filter);
    this.input.connect(this.midBand.filter);
    this.input.connect(this.highBand.filter);

    this.lowBand.muteGain.connect(this.outputGain);
    this.midBand.muteGain.connect(this.outputGain);
    this.highBand.muteGain.connect(this.outputGain);

    this.outputGain.connect(this.output);
  }

  private createBand(type: BiquadFilterType, freq: number, config: BandCompressorConfig): BandNodes {
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = 0.707; // Butterworth

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = config.threshold;
    compressor.ratio.value = config.ratio;
    compressor.attack.value = config.attack;
    compressor.release.value = config.release;
    compressor.knee.value = config.knee;

    const makeupGain = this.ctx.createGain();
    makeupGain.gain.value = Math.pow(10, config.makeupGain / 20);

    const muteGain = this.ctx.createGain();
    muteGain.gain.value = config.mute ? 0 : 1;

    filter.connect(compressor);
    compressor.connect(makeupGain);
    makeupGain.connect(muteGain);

    return { filter, compressor, makeupGain, muteGain };
  }

  private createBandpass(lowFreq: number, highFreq: number, config: BandCompressorConfig): BandNodes {
    // Use a bandpass filter centered between crossovers
    const centerFreq = Math.sqrt(lowFreq * highFreq);
    const Q = centerFreq / (highFreq - lowFreq);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centerFreq;
    filter.Q.value = Math.max(0.1, Q);

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = config.threshold;
    compressor.ratio.value = config.ratio;
    compressor.attack.value = config.attack;
    compressor.release.value = config.release;
    compressor.knee.value = config.knee;

    const makeupGain = this.ctx.createGain();
    makeupGain.gain.value = Math.pow(10, config.makeupGain / 20);

    const muteGain = this.ctx.createGain();
    muteGain.gain.value = config.mute ? 0 : 1;

    filter.connect(compressor);
    compressor.connect(makeupGain);
    makeupGain.connect(muteGain);

    return { filter, compressor, makeupGain, muteGain };
  }

  updateBand(band: 'low' | 'mid' | 'high', config: Partial<BandCompressorConfig>): void {
    const nodes = band === 'low' ? this.lowBand : band === 'mid' ? this.midBand : this.highBand;
    const bandConfig = this.config[band];

    if (config.threshold !== undefined) {
      bandConfig.threshold = config.threshold;
      nodes.compressor.threshold.setValueAtTime(config.threshold, this.ctx.currentTime);
    }
    if (config.ratio !== undefined) {
      bandConfig.ratio = config.ratio;
      nodes.compressor.ratio.setValueAtTime(config.ratio, this.ctx.currentTime);
    }
    if (config.attack !== undefined) {
      bandConfig.attack = config.attack;
      nodes.compressor.attack.setValueAtTime(config.attack, this.ctx.currentTime);
    }
    if (config.release !== undefined) {
      bandConfig.release = config.release;
      nodes.compressor.release.setValueAtTime(config.release, this.ctx.currentTime);
    }
    if (config.makeupGain !== undefined) {
      bandConfig.makeupGain = config.makeupGain;
      nodes.makeupGain.gain.setValueAtTime(Math.pow(10, config.makeupGain / 20), this.ctx.currentTime);
    }
    if (config.mute !== undefined) {
      bandConfig.mute = config.mute;
      nodes.muteGain.gain.setValueAtTime(config.mute ? 0 : 1, this.ctx.currentTime);
    }
  }

  setCrossovers(lowCrossover?: number, highCrossover?: number): void {
    if (lowCrossover !== undefined) {
      this.config.lowCrossover = lowCrossover;
      this.lowBand.filter.frequency.setValueAtTime(lowCrossover, this.ctx.currentTime);
      // Update bandpass center
      const center = Math.sqrt(lowCrossover * this.config.highCrossover);
      this.midBand.filter.frequency.setValueAtTime(center, this.ctx.currentTime);
    }
    if (highCrossover !== undefined) {
      this.config.highCrossover = highCrossover;
      this.highBand.filter.frequency.setValueAtTime(highCrossover, this.ctx.currentTime);
      const center = Math.sqrt(this.config.lowCrossover * highCrossover);
      this.midBand.filter.frequency.setValueAtTime(center, this.ctx.currentTime);
    }
  }

  setOutputGain(db: number): void {
    this.config.outputGainDb = db;
    this.outputGain.gain.setValueAtTime(Math.pow(10, db / 20), this.ctx.currentTime);
  }

  getConfig(): Readonly<MultibandConfig> {
    return { ...this.config };
  }

  /** Get gain reduction per band (in dB, negative means compressing). */
  getReduction(): { low: number; mid: number; high: number } {
    return {
      low: this.lowBand.compressor.reduction,
      mid: this.midBand.compressor.reduction,
      high: this.highBand.compressor.reduction,
    };
  }

  dispose(): void {
    const disposeBand = (b: BandNodes) => {
      b.filter.disconnect();
      b.compressor.disconnect();
      b.makeupGain.disconnect();
      b.muteGain.disconnect();
    };
    this.input.disconnect();
    disposeBand(this.lowBand);
    disposeBand(this.midBand);
    disposeBand(this.highBand);
    this.outputGain.disconnect();
    this.output.disconnect();
  }
}
