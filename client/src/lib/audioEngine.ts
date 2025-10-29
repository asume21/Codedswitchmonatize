import * as Tone from "tone";
import { realisticAudio } from "./realisticAudio";

export type InstrumentName = "piano" | "synth" | "bass" | "drums" | "custom";

export interface NoteEvent {
  note: string;
  time: number;
  duration: string | number;
  velocity: number;
  instrument?: InstrumentName;
}

type DrumType = 'kick' | 'snare' | 'hihat' | 'clap' | 'tom' | 'crash';

class AudioEngine {
  private samplers: Record<string, Tone.Sampler> = {};
  private isInitialized = false;
  private loadingProgress: Record<string, number> = {};
  private totalSamples = 0;
  private loadedSamples = 0;
  private reverb: Tone.Reverb | null = null;
  private delay: Tone.PingPongDelay | null = null;
  private volume: Tone.Volume;
  private drumVoices: Partial<Record<DrumType, Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth>> = {};
  private drumBus: Tone.Volume | null = null;

  constructor() {
    this.volume = new Tone.Volume(0);
    this.volume.toDestination();
  }

  // Core initialization
  async initialize() {
    if (this.isInitialized) return;
    // Don't start Tone.js here - let it start when user interacts
    try {
      await realisticAudio.initialize();
    } catch (error) {
      console.warn('Realistic audio engine unavailable, using synthetic fallback', error);
    }
    this.setupDrumVoices();
    this.isInitialized = true;
  }

  // Start Tone.js when needed (called from user interaction)
  async startAudio() {
    if (Tone.context.state !== 'running') {
      await Tone.start();
      console.log('🎵 Tone.js AudioContext started from user interaction');
    }
  }

  // Transport control
  startTransport(bpm = 120) {
    if (!this.isInitialized) {
      console.warn('AudioEngine not initialized');
      return;
    }
    Tone.Transport.bpm.value = bpm;
    Tone.Transport.start();
  }

  stopTransport() {
    if (!this.isInitialized) return;
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }

  // Note playback
  playNote(note: string, duration: string | number = '8n', velocity = 0.8, instrument: InstrumentName = 'piano') {
    if (!this.isInitialized) {
      console.warn('AudioEngine not initialized');
      return;
    }
    
    if (instrument === 'custom') {
      realisticAudio.playNote(note, 4, duration as number, 'piano', velocity);
      return;
    }

    const sampler = this.samplers[instrument];
    if (sampler) {
      sampler.triggerAttackRelease(note, duration, undefined, velocity);
    }
  }

  playDrum(drum: DrumType, velocity = 0.8) {
    if (!this.isInitialized) {
      console.warn('AudioEngine not initialized');
      return;
    }

    if (realisticAudio.isReady()) {
      realisticAudio.playDrumSound(drum, velocity).catch(() => {
        this.playFallbackDrum(drum, velocity);
      });
      return;
    }

    this.playFallbackDrum(drum, velocity);
  }

  private playFallbackDrum(drum: DrumType, velocity: number) {
    const drumSampler = this.samplers['drums'];
    if (drumSampler) {
      drumSampler.triggerAttackRelease(drum, '8n', undefined, velocity);
      return;
    }

    const drumVoice = this.drumVoices[drum];
    if (drumVoice) {
      const levelDb = Tone.gainToDb(Math.max(0.05, Math.min(1, velocity)));
      if (this.drumBus) {
        this.drumBus.volume.rampTo(levelDb, 0.02);
      }

      const duration =
        drum === 'crash' ? '2n' : drum === 'tom' ? '4n' : drum === 'clap' ? '8n' : '16n';

      if (drumVoice instanceof Tone.MembraneSynth) {
        const note = drum === 'kick' ? 'C1' : drum === 'tom' ? 'A2' : 'C2';
        drumVoice.triggerAttackRelease(note, duration);
      } else if (drumVoice instanceof Tone.NoiseSynth) {
        drumVoice.triggerAttackRelease(duration);
      } else if (drumVoice instanceof Tone.MetalSynth) {
        const pitch = drum === 'crash' ? 'G5' : 'E5';
        drumVoice.triggerAttackRelease(pitch, duration, undefined, velocity);
      }
      return;
    }
  }

  // Pattern scheduling
  schedulePattern(events: NoteEvent[], loop = false) {
    if (!this.isInitialized) return;
    
    // Clear any existing scheduled events
    Tone.Transport.cancel();

    events.forEach(event => {
      Tone.Transport.scheduleOnce((time) => {
        if (event.instrument === 'drums') {
          this.playDrum(event.note as DrumType, event.velocity);
        } else {
          this.playNote(
            event.note,
            event.duration,
            event.velocity,
            event.instrument
          );
        }
      }, event.time);
    });

    if (loop) {
      const endTime = Math.max(...events.map(e => e.time)) + 1;
      Tone.Transport.scheduleRepeat((time) => {
        this.schedulePattern(events, false);
      }, endTime);
    }
  }

  // Effects
  async addReverb(decay = 2.5, wet = 0.5) {
    this.reverb = new Tone.Reverb(decay);
    await this.reverb.generate();
    this.reverb.wet.value = wet;
    this.reverb.connect(this.volume);
    return this.reverb;
  }

  addDelay(delayTime = '8n', feedback = 0.5, wet = 0.3) {
    this.delay = new Tone.PingPongDelay(delayTime, feedback);
    this.delay.wet.value = wet;
    this.delay.connect(this.volume);
    return this.delay;
  }

  // Volume control
  setVolume(volume: number) {
    this.volume.volume.value = Tone.gainToDb(volume);
  }

  // Cleanup
  dispose() {
    Object.values(this.samplers).forEach(sampler => sampler.dispose());
    this.reverb?.dispose();
    this.delay?.dispose();
    this.volume.dispose();
    Object.values(this.drumVoices).forEach(voice => voice.dispose());
    this.drumVoices = {};
    this.drumBus?.dispose();
    this.drumBus = null;
    Tone.Transport.cancel();
    this.isInitialized = false;
  }

  private setupDrumVoices() {
    this.drumBus?.dispose();
    this.drumBus = new Tone.Volume(-6).toDestination();

    const connect = <T extends Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth>(voice: T) => {
      voice.connect(this.drumBus!);
      return voice;
    };

    const kick = connect(new Tone.MembraneSynth());
    kick.pitchDecay = 0.02;
    kick.octaves = 4;
    kick.oscillator.type = 'sine';
    kick.envelope.attack = 0.001;
    kick.envelope.decay = 0.4;
    kick.envelope.sustain = 0.01;
    kick.envelope.release = 0.4;
    this.drumVoices.kick = kick;

    const snare = connect(new Tone.NoiseSynth());
    snare.noise.type = 'white';
    snare.envelope.attack = 0.001;
    snare.envelope.decay = 0.2;
    snare.envelope.sustain = 0;
    this.drumVoices.snare = snare;

    const hihat = connect(new Tone.MetalSynth());
    hihat.frequency.setValueAtTime(250, Tone.now());
    hihat.envelope.attack = 0.001;
    hihat.envelope.decay = 0.1;
    hihat.envelope.release = 0.01;
    hihat.harmonicity = 5.1;
    hihat.modulationIndex = 32;
    this.drumVoices.hihat = hihat;

    const clap = connect(new Tone.NoiseSynth());
    clap.noise.type = 'pink';
    clap.envelope.attack = 0.001;
    clap.envelope.decay = 0.25;
    clap.envelope.sustain = 0;
    this.drumVoices.clap = clap;

    const tom = connect(new Tone.MembraneSynth());
    tom.pitchDecay = 0.008;
    tom.octaves = 2;
    tom.oscillator.type = 'sine';
    tom.envelope.attack = 0.001;
    tom.envelope.decay = 0.5;
    tom.envelope.sustain = 0.1;
    tom.envelope.release = 0.3;
    this.drumVoices.tom = tom;

    const crash = connect(new Tone.MetalSynth());
    crash.frequency.setValueAtTime(200, Tone.now());
    crash.envelope.attack = 0.001;
    crash.envelope.decay = 1.4;
    crash.envelope.release = 1;
    crash.harmonicity = 12;
    crash.modulationIndex = 20;
    crash.resonance = 7000;
    crash.octaves = 2;
    this.drumVoices.crash = crash;
  }

  // Alias for initialize for backward compatibility
  async init() {
    return this.initialize();
  }

  // Alias for stopTransport for backward compatibility
  stop() {
    this.stopTransport();
  }

  // Get loading progress (0-100)
  getLoadingProgress(): number {
    return this.totalSamples > 0 ? (this.loadedSamples / this.totalSamples) * 100 : 0;
  }
}

export const audioEngine = new AudioEngine();

export default audioEngine;
