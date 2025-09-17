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

  constructor() {
    this.volume = new Tone.Volume(0);
    this.volume.toDestination();
  }

  // Core initialization
  async initialize() {
    if (this.isInitialized) return;
    await Tone.start(); // Required on iOS/Chrome
    this.isInitialized = true;
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

  // Drum playback
  playDrum(drum: DrumType, velocity = 0.8) {
    if (!this.isInitialized) {
      console.warn('AudioEngine not initialized');
      return;
    }
    
    const drumSampler = this.samplers['drums'];
    if (drumSampler) {
      drumSampler.triggerAttackRelease(drum, '8n', undefined, velocity);
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
    Tone.Transport.cancel();
    this.isInitialized = false;
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
