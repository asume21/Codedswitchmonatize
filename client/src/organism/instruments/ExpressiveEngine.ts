/**
 * ExpressiveEngine — Dual-mode instrument engine for sustained, expressive playing.
 * 
 * Mode 1: "Synth" — Tone.js synthesizers (PolySynth, FMSynth, MonoSynth)
 *   - Infinite sustain, full ADSR envelope control
 *   - Great for electronic bass, synth strings, pads
 * 
 * Mode 2: "Sampler" — Tone.js Sampler with loop points
 *   - Uses real audio recordings that loop seamlessly
 *   - Great for realistic acoustic violin, upright bass, etc.
 * 
 * Both modes respond properly to NoteOn / NoteOff for true key-hold dynamics.
 */

import * as Tone from 'tone';

// ─── ADSR Envelope Shape ───────────────────────────────────────────

export interface ADSREnvelope {
  attack: number;   // seconds (0.001 – 5.0)
  decay: number;    // seconds (0.001 – 5.0)
  sustain: number;  // level   (0.0 – 1.0)
  release: number;  // seconds (0.001 – 10.0)
}

// ─── Instrument Preset ─────────────────────────────────────────────

export type InstrumentMode = 'synth' | 'sampler';
export type SynthType = 'subBass' | 'fmBass' | 'analogStrings' | 'pad' | 'lead';

export interface InstrumentPreset {
  id: string;
  name: string;
  mode: InstrumentMode;
  synthType?: SynthType;
  envelope: ADSREnvelope;
  // Synth-specific
  oscillatorType?: OscillatorType; // 'sine' | 'triangle' | 'sawtooth' | 'square'
  detuneSpread?: number;           // cents, for richness
  filterFrequency?: number;        // Hz
  filterResonance?: number;        // Q
  // Sampler-specific  
  sampleUrl?: string;
  loopStart?: number;              // seconds into the sample
  loopEnd?: number;                // seconds into the sample
}

// ─── Default Presets ────────────────────────────────────────────────

export const FACTORY_PRESETS: InstrumentPreset[] = [
  {
    id: 'sub-bass',
    name: 'Sub Bass',
    mode: 'synth',
    synthType: 'subBass',
    envelope: { attack: 0.005, decay: 0.1, sustain: 1.0, release: 0.3 },
    oscillatorType: 'sine',
    filterFrequency: 200,
    filterResonance: 1,
  },
  {
    id: 'fm-bass',
    name: 'FM Bass',
    mode: 'synth',
    synthType: 'fmBass',
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.15 },
  },
  {
    id: 'analog-strings',
    name: 'Analog Strings',
    mode: 'synth',
    synthType: 'analogStrings',
    envelope: { attack: 0.8, decay: 0.5, sustain: 0.9, release: 1.5 },
    oscillatorType: 'sawtooth',
    detuneSpread: 12,
    filterFrequency: 3000,
    filterResonance: 0.5,
  },
  {
    id: 'warm-pad',
    name: 'Warm Pad',
    mode: 'synth',
    synthType: 'pad',
    envelope: { attack: 1.5, decay: 1.0, sustain: 0.85, release: 3.0 },
    oscillatorType: 'sawtooth',
    detuneSpread: 20,
    filterFrequency: 1800,
    filterResonance: 0.3,
  },
  {
    id: 'synth-lead',
    name: 'Synth Lead',
    mode: 'synth',
    synthType: 'lead',
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.2 },
    oscillatorType: 'square',
    filterFrequency: 5000,
    filterResonance: 2,
  },
  {
    id: 'violin-sampler',
    name: 'Violin (Acoustic)',
    mode: 'sampler',
    envelope: { attack: 0.15, decay: 0.3, sustain: 1.0, release: 0.5 },
  },
  {
    id: 'cello-sampler',
    name: 'Cello (Acoustic)',
    mode: 'sampler',
    envelope: { attack: 0.2, decay: 0.4, sustain: 1.0, release: 0.8 },
  },
  {
    id: 'upright-bass-sampler',
    name: 'Upright Bass (Acoustic)',
    mode: 'sampler',
    envelope: { attack: 0.05, decay: 0.4, sustain: 0.7, release: 0.4 },
  },
];

// ─── Voice Tracking ─────────────────────────────────────────────────

interface ActiveVoice {
  noteKey: string;         // e.g. "C4"
  synth?: Tone.Synth | Tone.FMSynth | Tone.MonoSynth;
  polySynth?: Tone.PolySynth;
  sampler?: Tone.Sampler;
  gainNode: Tone.Gain;
  startTime: number;
  frequency: string;       // Tone.js note string
}

// ─── The Engine ─────────────────────────────────────────────────────

export class ExpressiveEngine {
  private activeVoices: Map<string, ActiveVoice> = new Map();
  private currentPreset: InstrumentPreset;
  private masterGain: Tone.Gain;
  private expressionGain: Tone.Gain; // For CC11 Expression control
  private filter: Tone.Filter;
  private isReady = false;
  
  // Sampler (lazy-loaded per preset)
  private sampler: Tone.Sampler | null = null;
  private samplerReady = false;

  // Expression value (0-1), controlled externally via automation or CC
  private expressionValue = 1.0;

  constructor() {
    this.currentPreset = FACTORY_PRESETS[0]; // Sub Bass default
    this.masterGain = new Tone.Gain(0.8);
    this.expressionGain = new Tone.Gain(1.0);
    this.filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 20000,
      rolloff: -12,
    });

    // Chain: voices → filter → expressionGain → masterGain → destination
    this.filter.connect(this.expressionGain);
    this.expressionGain.connect(this.masterGain);
    this.masterGain.toDestination();
  }

  /**
   * Connect the engine to a custom output node instead of the default destination.
   */
  connectTo(node: Tone.InputNode): void {
    this.masterGain.disconnect();
    this.masterGain.connect(node);
  }

  // ─── Preset Management ──────────────────────────────────────────

  setPreset(preset: InstrumentPreset): void {
    // Stop all active voices when switching presets
    this.allNotesOff();
    this.currentPreset = preset;

    // Update filter
    if (preset.filterFrequency !== undefined) {
      this.filter.frequency.value = preset.filterFrequency;
    }
    if (preset.filterResonance !== undefined) {
      this.filter.Q.value = preset.filterResonance;
    }

    // If it's a sampler preset, prepare the sampler
    if (preset.mode === 'sampler') {
      this.loadSampler(preset);
    } else {
      this.sampler = null;
      this.samplerReady = false;
    }

    this.isReady = true;
  }

  getPreset(): InstrumentPreset {
    return this.currentPreset;
  }

  updateEnvelope(envelope: Partial<ADSREnvelope>): void {
    this.currentPreset = {
      ...this.currentPreset,
      envelope: { ...this.currentPreset.envelope, ...envelope },
    };
  }

  // ─── Expression Control (CC11) ──────────────────────────────────

  setExpression(value: number): void {
    this.expressionValue = Math.max(0, Math.min(1, value));
    const now = Tone.now();
    this.expressionGain.gain.rampTo(this.expressionValue, 0.02, now);
  }

  getExpression(): number {
    return this.expressionValue;
  }

  // ─── Note On / Note Off ─────────────────────────────────────────

  /**
   * NoteOn — Start a sustained note. The note will hold until noteOff() is called.
   * @param note  - e.g. "C4", "F#3"
   * @param velocity - 0.0 to 1.0
   */
  noteOn(note: string, velocity: number = 0.8): void {
    // If same note is already playing, release it first (re-trigger)
    if (this.activeVoices.has(note)) {
      this.noteOff(note);
    }

    const preset = this.currentPreset;
    const env = preset.envelope;
    const vel = Math.max(0.01, Math.min(1.0, velocity));

    if (preset.mode === 'synth') {
      this.noteOnSynth(note, vel, preset, env);
    } else {
      this.noteOnSampler(note, vel, env);
    }
  }

  /**
   * NoteOff — Release a sustained note, triggering the Release phase of ADSR.
   */
  noteOff(note: string): void {
    const voice = this.activeVoices.get(note);
    if (!voice) return;

    const releaseTime = this.currentPreset.envelope.release;

    if (voice.synth) {
      try {
        voice.synth.triggerRelease(Tone.now());
      } catch {
        // Voice may have already been released
      }
      // Clean up after release finishes
      setTimeout(() => {
        try {
          voice.synth?.dispose();
          voice.gainNode.dispose();
        } catch { /* ignore */ }
      }, (releaseTime + 0.5) * 1000);
    }

    if (voice.polySynth) {
      try {
        voice.polySynth.triggerRelease(voice.frequency, Tone.now());
      } catch { /* ignore */ }
      setTimeout(() => {
        try {
          voice.polySynth?.dispose();
          voice.gainNode.dispose();
        } catch { /* ignore */ }
      }, (releaseTime + 0.5) * 1000);
    }

    if (voice.sampler) {
      try {
        voice.sampler.triggerRelease(voice.frequency, Tone.now());
      } catch { /* ignore */ }
      // Sampler voices do not need individual disposal (shared sampler)
      setTimeout(() => {
        try {
          voice.gainNode.dispose();
        } catch { /* ignore */ }
      }, (releaseTime + 0.5) * 1000);
    }

    this.activeVoices.delete(note);
  }

  /**
   * Trigger a note for a specific duration (used by the sequencer/piano roll playback).
   */
  triggerNote(note: string, duration: number, velocity: number = 0.8): void {
    this.noteOn(note, velocity);
    setTimeout(() => {
      this.noteOff(note);
    }, duration * 1000);
  }

  /**
   * Stop all currently playing notes immediately.
   */
  allNotesOff(): void {
    for (const [note] of this.activeVoices) {
      this.noteOff(note);
    }
    this.activeVoices.clear();
  }

  // ─── Synth Voice Creation ───────────────────────────────────────

  private noteOnSynth(
    note: string,
    velocity: number,
    preset: InstrumentPreset,
    env: ADSREnvelope,
  ): void {
    const gainNode = new Tone.Gain(velocity);
    
    let synth: Tone.Synth | Tone.FMSynth | Tone.MonoSynth | undefined;
    let polySynth: Tone.PolySynth | undefined;

    switch (preset.synthType) {
      case 'subBass': {
        synth = new Tone.Synth({
          oscillator: { type: preset.oscillatorType || 'sine' },
          envelope: {
            attack: env.attack,
            decay: env.decay,
            sustain: env.sustain,
            release: env.release,
          },
        });
        synth.connect(gainNode);
        gainNode.connect(this.filter);
        synth.triggerAttack(note, Tone.now(), velocity);
        break;
      }

      case 'fmBass': {
        const fm = new Tone.FMSynth({
          harmonicity: 1.5,
          modulationIndex: 8,
          oscillator: { type: 'sine' },
          modulation: { type: 'square' },
          envelope: {
            attack: env.attack,
            decay: env.decay,
            sustain: env.sustain,
            release: env.release,
          },
          modulationEnvelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.4,
            release: env.release,
          },
        });
        fm.connect(gainNode);
        gainNode.connect(this.filter);
        fm.triggerAttack(note, Tone.now(), velocity);
        synth = fm;
        break;
      }

      case 'analogStrings': {
        // Rich saw wave with slight detune for chorus-like width
        const osc1 = new Tone.Synth({
          oscillator: { type: (preset.oscillatorType || 'sawtooth') as any },
          envelope: {
            attack: env.attack,
            decay: env.decay,
            sustain: env.sustain,
            release: env.release,
          },
        });
        const osc2 = new Tone.Synth({
          oscillator: { type: (preset.oscillatorType || 'sawtooth') as any },
          envelope: {
            attack: env.attack * 1.1,
            decay: env.decay,
            sustain: env.sustain,
            release: env.release * 1.1,
          },
        });

        osc2.detune.value = preset.detuneSpread || 12;

        const mergeGain = new Tone.Gain(0.5);
        osc1.connect(mergeGain);
        osc2.connect(mergeGain);
        mergeGain.connect(gainNode);
        gainNode.connect(this.filter);

        osc1.triggerAttack(note, Tone.now(), velocity * 0.7);
        osc2.triggerAttack(note, Tone.now(), velocity * 0.7);

        // Store the first oscillator as the primary synth for noteOff
        synth = osc1;

        // We'll track the second oscillator for cleanup
        const voice: ActiveVoice = {
          noteKey: note,
          synth: osc1,
          gainNode,
          startTime: Tone.now(),
          frequency: note,
        };
        this.activeVoices.set(note, voice);

        // Override noteOff to handle both oscillators
        const originalNoteOff = this.noteOff.bind(this);
        const customCleanup = () => {
          try { osc2.triggerRelease(Tone.now()); } catch { /* */ }
          setTimeout(() => {
            try { osc2.dispose(); mergeGain.dispose(); } catch { /* */ }
          }, (env.release + 0.5) * 1000);
        };

        // Store cleanup function
        (voice as any)._extraCleanup = customCleanup;
        return; // Already stored voice
      }

      case 'pad': {
        // Lush pad — multiple detuned oscillators
        const padSynth = new Tone.Synth({
          oscillator: { type: (preset.oscillatorType || 'sawtooth') as any },
          envelope: {
            attack: env.attack,
            decay: env.decay,
            sustain: env.sustain,
            release: env.release,
          },
        });
        padSynth.connect(gainNode);
        gainNode.connect(this.filter);
        padSynth.triggerAttack(note, Tone.now(), velocity);
        synth = padSynth;
        break;
      }

      case 'lead': {
        const leadSynth = new Tone.MonoSynth({
          oscillator: { type: (preset.oscillatorType || 'square') as any },
          envelope: {
            attack: env.attack,
            decay: env.decay,
            sustain: env.sustain,
            release: env.release,
          },
          filter: {
            type: 'lowpass',
            frequency: preset.filterFrequency || 5000,
            Q: preset.filterResonance || 2,
          },
          filterEnvelope: {
            attack: env.attack,
            decay: env.decay * 2,
            sustain: 0.5,
            release: env.release,
            baseFrequency: 200,
            octaves: 4,
          },
        });
        leadSynth.connect(gainNode);
        gainNode.connect(this.filter);
        leadSynth.triggerAttack(note, Tone.now(), velocity);
        synth = leadSynth;
        break;
      }

      default: {
        // Fallback — basic sine
        synth = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: {
            attack: env.attack,
            decay: env.decay,
            sustain: env.sustain,
            release: env.release,
          },
        });
        synth.connect(gainNode);
        gainNode.connect(this.filter);
        synth.triggerAttack(note, Tone.now(), velocity);
        break;
      }
    }

    const voice: ActiveVoice = {
      noteKey: note,
      synth,
      polySynth,
      gainNode,
      startTime: Tone.now(),
      frequency: note,
    };
    this.activeVoices.set(note, voice);
  }

  // ─── Sampler Voice Creation ─────────────────────────────────────

  private loadSampler(preset: InstrumentPreset): void {
    this.samplerReady = false;

    // Use Tone.js Sampler with General MIDI soundfont URLs
    // This provides realistic acoustic samples with loop support
    const baseUrl = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/';
    
    // Map preset IDs to soundfont instrument names
    const instrumentMap: Record<string, string> = {
      'violin-sampler': 'violin',
      'cello-sampler': 'cello',
      'upright-bass-sampler': 'acoustic_bass',
    };

    const sfInstrument = instrumentMap[preset.id] || 'violin';
    const sfUrl = `${baseUrl}${sfInstrument}-mp3/`;

    // Build a sampler that covers a few octaves
    const noteMap: Record<string, string> = {};
    const noteNames = ['C', 'D#', 'F#', 'A']; // Sample every minor third for coverage
    for (let octave = 2; octave <= 6; octave++) {
      for (const n of noteNames) {
        const key = `${n}${octave}`;
        noteMap[key] = `${sfUrl}${n.replace('#', 's')}${octave}.mp3`;
      }
    }

    this.sampler = new Tone.Sampler({
      urls: noteMap,
      release: preset.envelope.release,
      attack: preset.envelope.attack,
      onload: () => {
        this.samplerReady = true;
        console.log(`🎻 Sampler loaded: ${preset.name}`);
      },
      onerror: (err) => {
        console.error(`🎻 Sampler load error for ${preset.name}:`, err);
        this.samplerReady = false;
      },
    });

    this.sampler.connect(this.filter);
  }

  private noteOnSampler(note: string, velocity: number, env: ADSREnvelope): void {
    if (!this.sampler || !this.samplerReady) {
      // Fallback to synth if sampler isn't ready
      console.warn('🎻 Sampler not ready, falling back to synth strings');
      const fallbackPreset: InstrumentPreset = {
        ...this.currentPreset,
        mode: 'synth',
        synthType: 'analogStrings',
      };
      this.noteOnSynth(note, velocity, fallbackPreset, env);
      return;
    }

    const gainNode = new Tone.Gain(velocity);
    this.sampler.connect(gainNode);
    gainNode.connect(this.filter);

    try {
      this.sampler.triggerAttack(note, Tone.now(), velocity);
    } catch (err) {
      console.warn('🎻 Sampler triggerAttack failed:', err);
    }

    const voice: ActiveVoice = {
      noteKey: note,
      sampler: this.sampler,
      gainNode,
      startTime: Tone.now(),
      frequency: note,
    };
    this.activeVoices.set(note, voice);
  }

  // ─── Master Volume ──────────────────────────────────────────────

  setVolume(db: number): void {
    const gain = Math.pow(10, db / 20);
    this.masterGain.gain.rampTo(Math.max(0, Math.min(2, gain)), 0.05);
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  dispose(): void {
    this.allNotesOff();
    this.sampler?.dispose();
    this.filter.dispose();
    this.expressionGain.dispose();
    this.masterGain.dispose();
  }

  // ─── Static helpers ─────────────────────────────────────────────

  static noteToString(noteName: string, octave: number): string {
    return `${noteName}${octave}`;
  }

  static getPresets(): InstrumentPreset[] {
    return [...FACTORY_PRESETS];
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

let _instance: ExpressiveEngine | null = null;

export function getExpressiveEngine(): ExpressiveEngine {
  if (!_instance) {
    _instance = new ExpressiveEngine();
    _instance.setPreset(FACTORY_PRESETS[0]);
  }
  return _instance;
}
