/**
 * Effects Chain Engine — User-configurable per-track effects.
 * Supports: EQ, Compressor, Reverb, Delay, Chorus, Distortion, Filter, Limiter.
 * Each effect has presets, wet/dry mix, bypass, and drag-reorder.
 */

export interface EffectDefinition {
  type: string;
  label: string;
  category: 'dynamics' | 'eq' | 'time' | 'modulation' | 'distortion' | 'filter' | 'utility';
  defaultParams: Record<string, number>;
  paramRanges: Record<string, { min: number; max: number; step: number; unit: string }>;
}

export interface EffectInstance {
  id: string;
  type: string;
  enabled: boolean;
  parameters: Record<string, number>;
}

export const EFFECT_DEFINITIONS: EffectDefinition[] = [
  {
    type: 'eq',
    label: 'Parametric EQ',
    category: 'eq',
    defaultParams: { lowGain: 0, lowFreq: 100, midGain: 0, midFreq: 1000, midQ: 1, highGain: 0, highFreq: 8000 },
    paramRanges: {
      lowGain: { min: -24, max: 24, step: 0.5, unit: 'dB' },
      lowFreq: { min: 20, max: 500, step: 1, unit: 'Hz' },
      midGain: { min: -24, max: 24, step: 0.5, unit: 'dB' },
      midFreq: { min: 200, max: 8000, step: 1, unit: 'Hz' },
      midQ: { min: 0.1, max: 10, step: 0.1, unit: 'Q' },
      highGain: { min: -24, max: 24, step: 0.5, unit: 'dB' },
      highFreq: { min: 2000, max: 20000, step: 1, unit: 'Hz' },
    },
  },
  {
    type: 'compressor',
    label: 'Compressor',
    category: 'dynamics',
    defaultParams: { threshold: -18, ratio: 4, attack: 10, release: 100, knee: 6, makeupGain: 0, mix: 1 },
    paramRanges: {
      threshold: { min: -60, max: 0, step: 0.5, unit: 'dB' },
      ratio: { min: 1, max: 20, step: 0.1, unit: ':1' },
      attack: { min: 0.1, max: 200, step: 0.1, unit: 'ms' },
      release: { min: 10, max: 2000, step: 1, unit: 'ms' },
      knee: { min: 0, max: 40, step: 0.5, unit: 'dB' },
      makeupGain: { min: 0, max: 24, step: 0.5, unit: 'dB' },
      mix: { min: 0, max: 1, step: 0.01, unit: '' },
    },
  },
  {
    type: 'reverb',
    label: 'Reverb',
    category: 'time',
    defaultParams: { decay: 2.5, preDelay: 20, damping: 0.5, size: 0.7, mix: 0.3 },
    paramRanges: {
      decay: { min: 0.1, max: 20, step: 0.1, unit: 's' },
      preDelay: { min: 0, max: 200, step: 1, unit: 'ms' },
      damping: { min: 0, max: 1, step: 0.01, unit: '' },
      size: { min: 0, max: 1, step: 0.01, unit: '' },
      mix: { min: 0, max: 1, step: 0.01, unit: '' },
    },
  },
  {
    type: 'delay',
    label: 'Delay',
    category: 'time',
    defaultParams: { time: 375, feedback: 0.35, lowCut: 200, highCut: 8000, mix: 0.3, sync: 0 },
    paramRanges: {
      time: { min: 1, max: 2000, step: 1, unit: 'ms' },
      feedback: { min: 0, max: 0.95, step: 0.01, unit: '' },
      lowCut: { min: 20, max: 2000, step: 1, unit: 'Hz' },
      highCut: { min: 1000, max: 20000, step: 1, unit: 'Hz' },
      mix: { min: 0, max: 1, step: 0.01, unit: '' },
      sync: { min: 0, max: 1, step: 1, unit: '' },
    },
  },
  {
    type: 'chorus',
    label: 'Chorus',
    category: 'modulation',
    defaultParams: { rate: 1.5, depth: 0.5, delay: 7, feedback: 0.2, mix: 0.5 },
    paramRanges: {
      rate: { min: 0.1, max: 10, step: 0.1, unit: 'Hz' },
      depth: { min: 0, max: 1, step: 0.01, unit: '' },
      delay: { min: 1, max: 30, step: 0.1, unit: 'ms' },
      feedback: { min: 0, max: 0.95, step: 0.01, unit: '' },
      mix: { min: 0, max: 1, step: 0.01, unit: '' },
    },
  },
  {
    type: 'distortion',
    label: 'Distortion',
    category: 'distortion',
    defaultParams: { drive: 5, tone: 0.5, mix: 0.5, mode: 0 },
    paramRanges: {
      drive: { min: 0, max: 50, step: 0.5, unit: 'dB' },
      tone: { min: 0, max: 1, step: 0.01, unit: '' },
      mix: { min: 0, max: 1, step: 0.01, unit: '' },
      mode: { min: 0, max: 3, step: 1, unit: '' }, // 0=soft, 1=hard, 2=fuzz, 3=bitcrush
    },
  },
  {
    type: 'filter',
    label: 'Filter',
    category: 'filter',
    defaultParams: { frequency: 1000, resonance: 1, type: 0, envelope: 0, mix: 1 },
    paramRanges: {
      frequency: { min: 20, max: 20000, step: 1, unit: 'Hz' },
      resonance: { min: 0.1, max: 30, step: 0.1, unit: 'Q' },
      type: { min: 0, max: 3, step: 1, unit: '' }, // 0=lowpass, 1=highpass, 2=bandpass, 3=notch
      envelope: { min: -1, max: 1, step: 0.01, unit: '' },
      mix: { min: 0, max: 1, step: 0.01, unit: '' },
    },
  },
  {
    type: 'limiter',
    label: 'Limiter',
    category: 'dynamics',
    defaultParams: { threshold: -1, ceiling: -0.3, release: 50 },
    paramRanges: {
      threshold: { min: -30, max: 0, step: 0.1, unit: 'dB' },
      ceiling: { min: -6, max: 0, step: 0.1, unit: 'dB' },
      release: { min: 1, max: 500, step: 1, unit: 'ms' },
    },
  },
];

/**
 * Create a new effect instance with default parameters.
 */
export function createEffect(type: string): EffectInstance {
  const def = EFFECT_DEFINITIONS.find(d => d.type === type);
  if (!def) throw new Error(`Unknown effect type: ${type}`);
  return {
    id: crypto.randomUUID(),
    type,
    enabled: true,
    parameters: { ...def.defaultParams },
  };
}

/**
 * Get the definition for an effect type.
 */
export function getEffectDefinition(type: string): EffectDefinition | undefined {
  return EFFECT_DEFINITIONS.find(d => d.type === type);
}

/**
 * Reorder effects in a chain.
 */
export function reorderEffects(effects: EffectInstance[], fromIndex: number, toIndex: number): EffectInstance[] {
  const result = [...effects];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}

/**
 * Apply an effect to a Web Audio node chain.
 * Returns the output node to connect downstream.
 */
export function createWebAudioEffect(
  ctx: AudioContext,
  effect: EffectInstance,
): { input: AudioNode; output: AudioNode } | null {
  if (!effect.enabled) return null;
  const p = effect.parameters;

  switch (effect.type) {
    case 'eq': {
      const low = ctx.createBiquadFilter();
      low.type = 'lowshelf';
      low.frequency.value = p.lowFreq;
      low.gain.value = p.lowGain;

      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = p.midFreq;
      mid.Q.value = p.midQ;
      mid.gain.value = p.midGain;

      const high = ctx.createBiquadFilter();
      high.type = 'highshelf';
      high.frequency.value = p.highFreq;
      high.gain.value = p.highGain;

      low.connect(mid);
      mid.connect(high);
      return { input: low, output: high };
    }

    case 'compressor': {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = p.threshold;
      comp.ratio.value = p.ratio;
      comp.attack.value = p.attack / 1000;
      comp.release.value = p.release / 1000;
      comp.knee.value = p.knee;

      if (p.mix < 1) {
        // Parallel compression (wet/dry)
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const merger = ctx.createGain();
        dry.gain.value = 1 - p.mix;
        wet.gain.value = p.mix;
        const splitter = ctx.createGain();
        splitter.connect(dry);
        splitter.connect(comp);
        comp.connect(wet);
        dry.connect(merger);
        wet.connect(merger);
        return { input: splitter, output: merger };
      }

      return { input: comp, output: comp };
    }

    case 'filter': {
      const filter = ctx.createBiquadFilter();
      const types: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];
      filter.type = types[Math.floor(p.type)] || 'lowpass';
      filter.frequency.value = p.frequency;
      filter.Q.value = p.resonance;
      return { input: filter, output: filter };
    }

    case 'distortion': {
      const shaper = ctx.createWaveShaper();
      const samples = 44100;
      const curve = new Float32Array(samples);
      const drive = Math.pow(10, p.drive / 20);
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = Math.tanh(x * drive);
      }
      shaper.curve = curve;
      shaper.oversample = '4x';

      if (p.mix < 1) {
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const merger = ctx.createGain();
        dry.gain.value = 1 - p.mix;
        wet.gain.value = p.mix;
        const splitter = ctx.createGain();
        splitter.connect(dry);
        splitter.connect(shaper);
        shaper.connect(wet);
        dry.connect(merger);
        wet.connect(merger);
        return { input: splitter, output: merger };
      }

      return { input: shaper, output: shaper };
    }

    case 'limiter': {
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = p.threshold;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = p.release / 1000;
      limiter.knee.value = 0;
      return { input: limiter, output: limiter };
    }

    case 'reverb': {
      // Convolution-based reverb using generated impulse response
      const convolver = ctx.createConvolver();
      const decay = p.decay || 2.5;
      const size = p.size || 0.7;
      const damping = p.damping || 0.5;

      // Generate impulse response
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * decay);
      const impulse = ctx.createBuffer(2, length, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          // Exponential decay with damping (high damping = faster HF rolloff)
          const envelope = Math.exp(-t * (3 / decay));
          const dampingFactor = Math.exp(-t * damping * 8);
          data[i] = ((Math.random() * 2 - 1) * envelope * dampingFactor) * size;
        }
      }
      convolver.buffer = impulse;

      // Pre-delay
      const preDelay = ctx.createDelay(0.2);
      preDelay.delayTime.value = (p.preDelay || 0) / 1000;

      // Wet/dry mix
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const merger = ctx.createGain();
      const splitter = ctx.createGain();
      dry.gain.value = 1 - (p.mix || 0.3);
      wet.gain.value = p.mix || 0.3;

      splitter.connect(dry);
      splitter.connect(preDelay);
      preDelay.connect(convolver);
      convolver.connect(wet);
      dry.connect(merger);
      wet.connect(merger);
      return { input: splitter, output: merger };
    }

    case 'delay': {
      const delayNode = ctx.createDelay(2.0);
      delayNode.delayTime.value = (p.time || 375) / 1000;

      const feedback = ctx.createGain();
      feedback.gain.value = Math.min(0.95, p.feedback || 0.35);

      // Feedback filters
      const lowCut = ctx.createBiquadFilter();
      lowCut.type = 'highpass';
      lowCut.frequency.value = p.lowCut || 200;

      const highCut = ctx.createBiquadFilter();
      highCut.type = 'lowpass';
      highCut.frequency.value = p.highCut || 8000;

      // Feedback loop: delay → lowCut → highCut → feedback → delay
      delayNode.connect(lowCut);
      lowCut.connect(highCut);
      highCut.connect(feedback);
      feedback.connect(delayNode);

      // Wet/dry mix
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const merger = ctx.createGain();
      const splitter = ctx.createGain();
      dry.gain.value = 1 - (p.mix || 0.3);
      wet.gain.value = p.mix || 0.3;

      splitter.connect(dry);
      splitter.connect(delayNode);
      highCut.connect(wet); // tap after filters for wet signal
      dry.connect(merger);
      wet.connect(merger);
      return { input: splitter, output: merger };
    }

    case 'chorus': {
      const rate = p.rate || 1.5;
      const depth = p.depth || 0.5;
      const delayMs = p.delay || 7;
      const fbAmount = Math.min(0.95, p.feedback || 0.2);

      // Two modulated delay voices for stereo width
      const splitter = ctx.createGain();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const merger = ctx.createGain();
      dry.gain.value = 1 - (p.mix || 0.5);
      wet.gain.value = p.mix || 0.5;

      const delay1 = ctx.createDelay(0.05);
      delay1.delayTime.value = delayMs / 1000;
      const delay2 = ctx.createDelay(0.05);
      delay2.delayTime.value = (delayMs * 1.1) / 1000;

      // LFOs modulate delay times
      const lfo1 = ctx.createOscillator();
      lfo1.type = 'sine';
      lfo1.frequency.value = rate;
      const lfo1Gain = ctx.createGain();
      lfo1Gain.gain.value = (depth * delayMs * 0.5) / 1000;
      lfo1.connect(lfo1Gain);
      lfo1Gain.connect(delay1.delayTime);
      lfo1.start();

      const lfo2 = ctx.createOscillator();
      lfo2.type = 'sine';
      lfo2.frequency.value = rate * 1.1; // slight detune between voices
      const lfo2Gain = ctx.createGain();
      lfo2Gain.gain.value = (depth * delayMs * 0.5) / 1000;
      lfo2.connect(lfo2Gain);
      lfo2Gain.connect(delay2.delayTime);
      lfo2.start();

      // Feedback
      const fb1 = ctx.createGain();
      fb1.gain.value = fbAmount;
      delay1.connect(fb1);
      fb1.connect(delay1);

      const fb2 = ctx.createGain();
      fb2.gain.value = fbAmount;
      delay2.connect(fb2);
      fb2.connect(delay2);

      // Routing
      const chorusMix = ctx.createGain();
      chorusMix.gain.value = 0.5;
      splitter.connect(dry);
      splitter.connect(delay1);
      splitter.connect(delay2);
      delay1.connect(chorusMix);
      delay2.connect(chorusMix);
      chorusMix.connect(wet);
      dry.connect(merger);
      wet.connect(merger);
      return { input: splitter, output: merger };
    }

    default:
      console.warn(`[effectsChain] Unknown effect type: ${effect.type}`);
      return null;
  }
}

// ─── Effect Presets ──────────────────────────────────────────────────

export interface EffectPreset {
  name: string;
  type: string;
  parameters: Record<string, number>;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  // EQ Presets
  { name: 'Vocal Presence', type: 'eq', parameters: { lowGain: -3, lowFreq: 100, midGain: 4, midFreq: 3000, midQ: 1.5, highGain: 2, highFreq: 10000 } },
  { name: 'Bass Boost', type: 'eq', parameters: { lowGain: 6, lowFreq: 80, midGain: -2, midFreq: 500, midQ: 1, highGain: 0, highFreq: 8000 } },
  { name: 'Bright Mix', type: 'eq', parameters: { lowGain: 0, lowFreq: 100, midGain: 2, midFreq: 2000, midQ: 0.8, highGain: 5, highFreq: 12000 } },
  { name: 'Low Cut', type: 'eq', parameters: { lowGain: -18, lowFreq: 120, midGain: 0, midFreq: 1000, midQ: 1, highGain: 0, highFreq: 8000 } },

  // Compressor Presets
  { name: 'Gentle Glue', type: 'compressor', parameters: { threshold: -12, ratio: 2, attack: 30, release: 200, knee: 10, makeupGain: 2, mix: 1 } },
  { name: 'Vocal Control', type: 'compressor', parameters: { threshold: -18, ratio: 4, attack: 5, release: 100, knee: 6, makeupGain: 4, mix: 1 } },
  { name: 'Drum Punch', type: 'compressor', parameters: { threshold: -15, ratio: 6, attack: 1, release: 50, knee: 3, makeupGain: 3, mix: 1 } },
  { name: 'Parallel Crush', type: 'compressor', parameters: { threshold: -30, ratio: 20, attack: 0.5, release: 30, knee: 0, makeupGain: 10, mix: 0.3 } },

  // Reverb Presets
  { name: 'Small Room', type: 'reverb', parameters: { decay: 0.8, preDelay: 5, damping: 0.7, size: 0.3, mix: 0.2 } },
  { name: 'Large Hall', type: 'reverb', parameters: { decay: 4, preDelay: 30, damping: 0.4, size: 0.9, mix: 0.3 } },
  { name: 'Plate', type: 'reverb', parameters: { decay: 1.5, preDelay: 10, damping: 0.3, size: 0.5, mix: 0.25 } },
  { name: 'Cathedral', type: 'reverb', parameters: { decay: 8, preDelay: 50, damping: 0.2, size: 1, mix: 0.35 } },

  // Delay Presets
  { name: 'Slapback', type: 'delay', parameters: { time: 80, feedback: 0.1, lowCut: 200, highCut: 8000, mix: 0.3, sync: 0 } },
  { name: 'Ping Pong', type: 'delay', parameters: { time: 375, feedback: 0.4, lowCut: 300, highCut: 6000, mix: 0.25, sync: 0 } },
  { name: 'Dub Echo', type: 'delay', parameters: { time: 500, feedback: 0.6, lowCut: 400, highCut: 3000, mix: 0.35, sync: 0 } },
  { name: 'Subtle Ambience', type: 'delay', parameters: { time: 200, feedback: 0.2, lowCut: 200, highCut: 10000, mix: 0.15, sync: 0 } },

  // Distortion Presets
  { name: 'Warm Saturation', type: 'distortion', parameters: { drive: 3, tone: 0.6, mix: 0.4, mode: 0 } },
  { name: 'Crunch', type: 'distortion', parameters: { drive: 12, tone: 0.5, mix: 0.7, mode: 1 } },
  { name: 'Lo-fi', type: 'distortion', parameters: { drive: 8, tone: 0.3, mix: 0.5, mode: 3 } },

  // Filter Presets
  { name: 'Dark Filter', type: 'filter', parameters: { frequency: 800, resonance: 2, type: 0, envelope: 0, mix: 1 } },
  { name: 'Telephone', type: 'filter', parameters: { frequency: 2000, resonance: 1, type: 2, envelope: 0, mix: 1 } },
  { name: 'Sweep Ready', type: 'filter', parameters: { frequency: 5000, resonance: 4, type: 0, envelope: 0, mix: 1 } },
];

/**
 * Get presets for a specific effect type.
 */
export function getPresetsForType(type: string): EffectPreset[] {
  return EFFECT_PRESETS.filter(p => p.type === type);
}
