import { createReadStream, existsSync } from "fs";
import { join } from "path";

// Audio service for handling server-side audio operations
export class AudioService {
  private static audioFormats = ['.wav', '.mp3', '.ogg', '.m4a'];

  // Generate audio file paths based on sound type
  static getAudioPath(soundType: string, variant: string = 'default'): string {
    const audioDir = join(process.cwd(), 'audio', 'samples');
    const filename = `${soundType}_${variant}.wav`;
    return join(audioDir, filename);
  }

  // Check if audio file exists
  static hasAudioFile(soundType: string, variant: string = 'default'): boolean {
    const path = this.getAudioPath(soundType, variant);
    return existsSync(path);
  }

  // Stream audio file
  static streamAudioFile(soundType: string, variant: string = 'default') {
    const path = this.getAudioPath(soundType, variant);
    if (!existsSync(path)) {
      throw new Error(`Audio file not found: ${soundType}_${variant}`);
    }
    return createReadStream(path);
  }

  // Get audio metadata
  static getAudioMetadata(soundType: string, variant: string = 'default') {
    return {
      soundType,
      variant,
      path: this.getAudioPath(soundType, variant),
      exists: this.hasAudioFile(soundType, variant),
      mimeType: 'audio/wav',
    };
  }

  // Generate drum kit configuration
  static getDrumKitConfig() {
    return {
      kick: {
        variants: ['808', 'acoustic', 'electronic', 'punchy'],
        defaultVolume: 0.8,
        frequency: 60,
      },
      snare: {
        variants: ['acoustic', 'electronic', 'clap', 'rim'],
        defaultVolume: 0.7,
        frequency: 200,
      },
      hihat: {
        variants: ['closed', 'open', 'electronic', 'vintage'],
        defaultVolume: 0.5,
        frequency: 8000,
      },
      crash: {
        variants: ['bright', 'dark', 'splash', 'ride'],
        defaultVolume: 0.6,
        frequency: 5000,
      },
      tom: {
        variants: ['high', 'mid', 'low', 'floor'],
        defaultVolume: 0.6,
        frequency: 120,
      },
      percussion: {
        variants: ['shaker', 'tambourine', 'cowbell', 'clave'],
        defaultVolume: 0.4,
        frequency: 1000,
      },
    };
  }

  // Generate instrument presets for melody composition
  static getInstrumentPresets() {
    return {
      piano: {
        type: 'acoustic',
        waveform: 'sine',
        attack: 0.01,
        decay: 0.3,
        sustain: 0.7,
        release: 1.0,
        cutoff: 2000,
        resonance: 1,
      },
      synthesizer: {
        type: 'electronic',
        waveform: 'sawtooth',
        attack: 0.05,
        decay: 0.2,
        sustain: 0.8,
        release: 0.5,
        cutoff: 1500,
        resonance: 5,
      },
      strings: {
        type: 'orchestral',
        waveform: 'triangle',
        attack: 0.2,
        decay: 0.1,
        sustain: 0.9,
        release: 2.0,
        cutoff: 3000,
        resonance: 2,
      },
      bass: {
        type: 'electronic',
        waveform: 'square',
        attack: 0.01,
        decay: 0.5,
        sustain: 0.6,
        release: 0.3,
        cutoff: 800,
        resonance: 8,
      },
      lead: {
        type: 'electronic',
        waveform: 'sawtooth',
        attack: 0.02,
        decay: 0.3,
        sustain: 0.7,
        release: 0.8,
        cutoff: 2500,
        resonance: 6,
      },
    };
  }

  // Generate audio processing effects configuration
  static getEffectsConfig() {
    return {
      reverb: {
        types: ['hall', 'room', 'plate', 'spring', 'cathedral'],
        parameters: {
          roomSize: { min: 0, max: 100, default: 50 },
          damping: { min: 0, max: 100, default: 50 },
          wetLevel: { min: 0, max: 100, default: 30 },
          dryLevel: { min: 0, max: 100, default: 70 },
          width: { min: 0, max: 100, default: 100 },
        },
      },
      delay: {
        types: ['stereo', 'ping-pong', 'tape', 'digital'],
        parameters: {
          time: { min: 0, max: 2000, default: 250, unit: 'ms' },
          feedback: { min: 0, max: 95, default: 30, unit: '%' },
          mix: { min: 0, max: 100, default: 25, unit: '%' },
          highCut: { min: 20, max: 20000, default: 8000, unit: 'Hz' },
          lowCut: { min: 20, max: 20000, default: 100, unit: 'Hz' },
        },
      },
      compressor: {
        types: ['vintage', 'modern', 'optical', 'vca', 'multiband'],
        parameters: {
          threshold: { min: -60, max: 0, default: -20, unit: 'dB' },
          ratio: { min: 1, max: 20, default: 4, unit: ':1' },
          attack: { min: 0.1, max: 100, default: 10, unit: 'ms' },
          release: { min: 1, max: 1000, default: 100, unit: 'ms' },
          knee: { min: 0, max: 10, default: 2, unit: 'dB' },
          makeupGain: { min: 0, max: 30, default: 0, unit: 'dB' },
        },
      },
      equalizer: {
        bands: [
          { name: 'low', frequency: 80, q: 0.7, type: 'highpass' },
          { name: 'lowMid', frequency: 200, q: 1.0, type: 'bell' },
          { name: 'mid', frequency: 1000, q: 1.0, type: 'bell' },
          { name: 'highMid', frequency: 5000, q: 1.0, type: 'bell' },
          { name: 'high', frequency: 12000, q: 0.7, type: 'shelf' },
        ],
        parameters: {
          gain: { min: -15, max: 15, default: 0, unit: 'dB' },
          frequency: { min: 20, max: 20000, unit: 'Hz' },
          q: { min: 0.1, max: 10, default: 1.0 },
        },
      },
      distortion: {
        types: ['overdrive', 'distortion', 'fuzz', 'saturation', 'bitcrusher'],
        parameters: {
          drive: { min: 0, max: 100, default: 25, unit: '%' },
          tone: { min: 0, max: 100, default: 50, unit: '%' },
          output: { min: 0, max: 100, default: 75, unit: '%' },
          mix: { min: 0, max: 100, default: 100, unit: '%' },
        },
      },
    };
  }

  // Generate mixer channel configuration
  static getMixerChannelConfig() {
    return {
      input: {
        gain: { min: -60, max: 12, default: 0, unit: 'dB' },
        phase: { options: ['normal', 'inverted'], default: 'normal' },
        highpass: { min: 20, max: 500, default: 20, unit: 'Hz' },
      },
      equalizer: this.getEffectsConfig().equalizer,
      dynamics: {
        gate: {
          threshold: { min: -80, max: 0, default: -40, unit: 'dB' },
          range: { min: 0, max: 80, default: 10, unit: 'dB' },
          attack: { min: 0.1, max: 100, default: 1, unit: 'ms' },
          hold: { min: 0, max: 5000, default: 10, unit: 'ms' },
          release: { min: 1, max: 5000, default: 100, unit: 'ms' },
        },
        compressor: this.getEffectsConfig().compressor.parameters,
      },
      sends: {
        count: 4,
        preFader: { default: false },
        level: { min: -60, max: 12, default: -60, unit: 'dB' },
      },
      output: {
        fader: { min: -60, max: 12, default: 0, unit: 'dB' },
        pan: { min: -100, max: 100, default: 0, unit: '%' },
        mute: { default: false },
        solo: { default: false },
      },
    };
  }

  // Generate audio export formats
  static getExportFormats() {
    return {
      wav: {
        extension: '.wav',
        mimeType: 'audio/wav',
        quality: 'lossless',
        bitDepth: [16, 24, 32],
        sampleRate: [44100, 48000, 96000, 192000],
        default: { bitDepth: 24, sampleRate: 44100 },
      },
      mp3: {
        extension: '.mp3',
        mimeType: 'audio/mpeg',
        quality: 'lossy',
        bitRate: [128, 192, 256, 320],
        sampleRate: [44100, 48000],
        default: { bitRate: 320, sampleRate: 44100 },
      },
      flac: {
        extension: '.flac',
        mimeType: 'audio/flac',
        quality: 'lossless',
        compression: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        sampleRate: [44100, 48000, 96000, 192000],
        default: { compression: 5, sampleRate: 44100 },
      },
      ogg: {
        extension: '.ogg',
        mimeType: 'audio/ogg',
        quality: 'lossy',
        quality_level: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        sampleRate: [44100, 48000],
        default: { quality_level: 7, sampleRate: 44100 },
      },
      midi: {
        extension: '.mid',
        mimeType: 'audio/midi',
        quality: 'data',
        ticksPerQuarter: [96, 192, 384, 480, 960],
        default: { ticksPerQuarter: 480 },
      },
    };
  }

  // Audio analysis utilities
  static analyzeAudioPattern(pattern: any) {
    const analysis = {
      density: 0,
      complexity: 0,
      rhythm: 'steady',
      dominant_instruments: [] as string[],
      suggestions: [] as string[],
    };

    if (!pattern || typeof pattern !== 'object') {
      return analysis;
    }

    const tracks = Object.entries(pattern);
    const totalSteps = 16;
    let totalHits = 0;

    tracks.forEach(([instrument, steps]: [string, any]) => {
      if (Array.isArray(steps)) {
        const hits = steps.filter(Boolean).length;
        totalHits += hits;
        
        if (hits > totalSteps * 0.5) {
          analysis.dominant_instruments.push(instrument);
        }
      }
    });

    analysis.density = totalHits / (tracks.length * totalSteps);
    analysis.complexity = analysis.density * tracks.length;

    if (analysis.density < 0.2) {
      analysis.rhythm = 'sparse';
      analysis.suggestions.push('Consider adding more elements for fuller sound');
    } else if (analysis.density > 0.7) {
      analysis.rhythm = 'busy';
      analysis.suggestions.push('Pattern might be too dense, consider simplifying');
    }

    return analysis;
  }

  // Beat matching and tempo analysis
  static analyzeTempo(bpm: number) {
    const tempoRanges = {
      ballad: { min: 60, max: 80, label: 'Ballad' },
      moderate: { min: 80, max: 100, label: 'Moderate' },
      uptempo: { min: 100, max: 120, label: 'Up-tempo' },
      dance: { min: 120, max: 140, label: 'Dance' },
      fast: { min: 140, max: 180, label: 'Fast' },
      extreme: { min: 180, max: 250, label: 'Extreme' },
    };

    for (const [key, range] of Object.entries(tempoRanges)) {
      if (bpm >= range.min && bpm <= range.max) {
        return {
          category: key,
          label: range.label,
          bpm,
          suggestions: AudioService.getTempoSuggestions(key),
        };
      }
    }

    return {
      category: 'custom',
      label: 'Custom',
      bpm,
      suggestions: ['Unique tempo - experiment with different patterns'],
    };
  }

  private static getTempoSuggestions(category: string): string[] {
    const suggestions: { [key: string]: string[] } = {
      ballad: ['Focus on emotional expression', 'Use sustained instruments', 'Add reverb for atmosphere'],
      moderate: ['Great for acoustic instruments', 'Consider swing rhythms', 'Layer melodies gradually'],
      uptempo: ['Perfect for rock/pop', 'Use driving bass lines', 'Add percussion for energy'],
      dance: ['Emphasize the beat', 'Use electronic elements', 'Keep patterns repetitive'],
      fast: ['Focus on precision', 'Use staccato elements', 'Consider complex polyrhythms'],
      extreme: ['Emphasize attack transients', 'Use minimal reverb', 'Focus on rhythmic complexity'],
    };

    return suggestions[category] || ['Experiment with different approaches'];
  }
}

export default AudioService;
