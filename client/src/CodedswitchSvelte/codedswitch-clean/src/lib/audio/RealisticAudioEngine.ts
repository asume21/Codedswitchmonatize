import * as Tone from 'tone';

type MonoSynthType = InstanceType<typeof Tone.MonoSynth>;
type PolySynthType = InstanceType<typeof Tone.PolySynth>;
type SamplerType = InstanceType<typeof Tone.Sampler>;
type LoopType = InstanceType<typeof Tone.Loop>;

const { MonoSynth, PolySynth, Sampler, Loop } = Tone;

// Type definitions for Tone.js
type Instrument = 'piano' | 'guitar' | 'bass' | 'synth' | 'drums' | 'strings' | 'violin' | 'flute' | 'trumpet' | string;
type DrumType = 'kick' | 'snare' | 'hihat' | 'hihat-open' | 'hihat-closed' | 'clap' | 'crash' | 'ride' | 'tom1' | 'tom2' | 'tom3';


export class RealisticAudioEngine {
  /**
   * Resume the audio context if it is suspended.
   */
  public async resumeContext() {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }
  private synths: Map<string, PolySynthType | MonoSynthType> = new Map();
  private samplers: Map<string, SamplerType> = new Map();
  private isPolyphonic: Map<string, boolean> = new Map();
  private currentBPM = 120;
  private isPlaying = false;
  private loops: Map<string, LoopType> = new Map();
  private context: AudioContext | null = null;
  private initialized = false;
  private loading = false;
  
  // Instrument mapping similar to the original
  private instrumentLibrary: { [key: string]: string } = {
    // Piano instruments
    'piano': 'acoustic_grand_piano',
    'piano-keyboard': 'acoustic_grand_piano',
    'piano-grand': 'acoustic_grand_piano',
    'piano-organ': 'church_organ',
    
    // String instruments
    'guitar': 'acoustic_guitar_steel',
    'guitar-acoustic': 'acoustic_guitar_steel',
    'guitar-electric': 'electric_guitar_clean',
    'guitar-distorted': 'distortion_guitar',
    'guitar-nylon': 'acoustic_guitar_nylon',
    'strings-violin': 'violin',
    'strings-ukulele': 'acoustic_guitar_nylon',
    
    // Flute instruments
    'flute-recorder': 'recorder',
    'flute-indian': 'flute',
    'flute-concert': 'flute',
    
    // Horn instruments
    'horns-trumpet': 'trumpet',
    'horns-trombone': 'trombone',
    'horns-french': 'french_horn',
    
    // Synthesizers
    'synth-analog': 'electric_piano_1',
    'synth-digital': 'electric_piano_2',
    'synth-fm': 'electric_piano_1',
    
    // Bass instruments
    'bass': 'electric_bass_finger',
    'bass-electric': 'electric_bass_finger',
    'bass-upright': 'acoustic_bass',
    'bass-synth': 'synth_bass_1',
    
    // Drum instruments
    'drums': 'drums',
    'drums-acoustic': 'drums',
    'drums-electronic': 'drums-electronic',
    
    // Legacy mappings
    'violin': 'violin',
    'organ': 'church_organ',
    'synth': 'lead_1_square',
    'strings': 'string_ensemble_1',
    'flute': 'flute',
    'trumpet': 'trumpet'
  };

  constructor() {
    this.initialize();
  }

  async initialize() {
    if (this.initialized || this.loading) return;
    this.loading = true;
    
    try {
      await Tone.start();
      this.context = Tone.getContext().rawContext as AudioContext;
      console.log('🎵 Audio context created, state:', this.context.state);
      
      // Setup basic synths
      await this.setupBasicSynths();
      
      this.initialized = true;
      console.log('🎵 Audio engine initialized');
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  private async setupBasicSynths() {
    // Basic piano synth
    const piano = new PolySynth({
      voice: Tone.PolySynth,
      envelope: { 
        attack: 0.005, 
        decay: 0.1, 
        sustain: 0.3, 
        release: 1 
      }
    }).toDestination();
    this.synths.set('piano', piano);
    this.isPolyphonic.set('piano', true);
    
    // Bass synth
    const bass = this.createSynth('bass', false);
    this.synths.set('bass', bass);

    // Lead synth
    const lead = this.createSynth('lead');
    this.synths.set('lead', lead);

    // Setup drum samples
    await this.setupDrumSampler();
  }

  private createPiano() {
    // Simple piano-like synth for now
    const synth = new PolySynth({
      voice: Tone.PolySynth,
      oscillator: {
        type: 'triangle8' as const
      },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.3,
        release: 1
      }
    }).toDestination();

    this.synths.set('piano', synth as unknown as (PolySynthType | MonoSynthType));
    this.isPolyphonic.set('piano', true);
    return synth;
  }

  private createSynth(instrument: string, isPolyphonic: boolean = true) {
    let synth: any; // Using any to handle the different synth types

    if (isPolyphonic) {
      synth = new PolySynth({
        voice: Tone.PolySynth,
        oscillator: {
          type: 'sine' as const
        },
        envelope: {
          attack: 0.1,
          decay: 0.2,
          sustain: 0.5,
          release: 0.8
        }
      });
      this.isPolyphonic.set(instrument, true);
    } else {
      const options = {
        oscillator: {
          type: 'sine' as const
        },
        envelope: {
          attack: 0.1,
          decay: 0.2,
          sustain: 0.5,
          release: 0.8
        }
      };
      synth = new MonoSynth(options);
      this.isPolyphonic.set(instrument, false);
    }

    synth.toDestination();
    this.synths.set(instrument, synth);
    return synth;
  }

  private async setupDrumSampler() {
    const drumSamples = {
      kick: 'samples/drums/kick.mp3',
      snare: 'samples/drums/snare.mp3',
      hihat: 'samples/drums/hihat.mp3',
      'hihat-open': 'samples/drums/hihat-open.mp3',
      'hihat-closed': 'samples/drums/hihat-closed.mp3',
      clap: 'samples/drums/clap.mp3',
      crash: 'samples/drums/crash.mp3',
      ride: 'samples/drums/ride.mp3',
      tom1: 'samples/drums/tom1.mp3',
      tom2: 'samples/drums/tom2.mp3',
      tom3: 'samples/drums/tom3.mp3'
    };

    const drumSampler = this.createSampler('drums', '/samples/drums/', Object.keys(drumSamples));
    this.samplers.set('drums', drumSampler);
  }

  private createSampler(instrument: string, baseUrl: string, notes: string[]) {
    const urls: { [note: string]: string } = {};
    notes.forEach(note => {
      urls[note] = `${note}.mp3`;
    });

    const sampler = new Tone.Sampler({
      urls,
      release: 1,
      baseUrl
    }).toDestination();

    this.samplers.set(instrument, sampler);
    this.isPolyphonic.set(instrument, true); // Samplers are typically polyphonic
    return sampler;
  }

  async playNote(note: string, duration: string = '8n', instrument: Instrument = 'piano', velocity: number = 0.8) {
    if (!this.initialized) await this.initialize();

    const synth = this.synths.get(instrument) || this.synths.get('piano');
    if (synth) {
      try {
        if (this.isPolyphonic.get(instrument) !== false) {
          // PolySynth or other polyphonic instrument
          (synth as any).triggerAttackRelease(note, duration, undefined, velocity);
        } else {
          // Monophonic instrument
          (synth as any).triggerAttack(note, undefined, velocity);
          (synth as any).triggerRelease(`+${duration}`);
        }
      } catch (e) {
        console.error(`Error playing note on ${instrument}:`, e);
      }
    }
  }

  async playDrum(drumType: DrumType, velocity: number = 0.8) {
    if (!this.initialized) await this.initialize();

    const drumSampler = this.samplers.get('drums');
    if (drumSampler) {
      drumSampler.triggerAttackRelease(drumType, '8n', undefined, velocity);
    }
  }

  setBPM(bpm: number) {
    this.currentBPM = bpm;
    Tone.Transport.bpm.value = bpm;
  }

  async startPlayback() {
    if (!this.initialized) await this.initialize();
    if (this.isPlaying) return;

    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }

    Tone.Transport.start();
    this.isPlaying = true;
  }

  setMasterVolume(volume: number) {
    // Tone.Destination.volume is in decibels. Converting linear gain [0, 1] to dB.
    if (volume === 0) {
      Tone.Destination.volume.value = -Infinity;
    } else {
      Tone.Destination.volume.value = Tone.gainToDb(volume);
    }
  }

  stopPlayback() {
    Tone.Transport.stop();
    this.isPlaying = false;

    // Stop all notes
    this.synths.forEach((synth, instrument) => {
      try {
        if (this.isPolyphonic.get(instrument) !== false) {
          // PolySynth
          if (typeof (synth as any).releaseAll === 'function') {
            (synth as any).releaseAll();
          }
        } else {
          // MonoSynth
          if (typeof (synth as any).triggerRelease === 'function') {
            (synth as any).triggerRelease();
          }
        }
      } catch (e) {
        console.warn(`Error stopping instrument ${instrument}:`, e);
      }
    });
  }

  createLoop(callback: (time: number) => void, interval: string, id: string = 'default'): LoopType {
    this.removeLoop(id);

    const loop = new Loop(callback, interval);
    this.loops.set(id, loop);
    return loop;
  }

  removeLoop(id: string = 'default') {
    const loop = this.loops.get(id);
    if (loop) {
      loop.dispose();
      this.loops.delete(id);
    }
  }

  dispose() {
    this.stopPlayback();
    
    // Clean up all synths and samplers
    this.synths.forEach(synth => synth.dispose());
    this.samplers.forEach(sampler => sampler.dispose());
    this.loops.forEach(loop => loop.dispose());
    
    this.synths.clear();
    this.samplers.clear();
    this.loops.clear();
    
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    
    this.initialized = false;
  }
}

export const audioEngine = new RealisticAudioEngine();
