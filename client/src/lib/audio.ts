import * as Tone from "tone";
import type { SequencerState } from "./sequencer";
import { realisticAudio } from './realisticAudio';

export interface OscillatorData {
  oscillator: OscillatorNode;
  gain: GainNode;
  instrument: string;
  frequency: number;
  startTime: number;
}

export class AudioEngine {
  public audioContext: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  private activeOscillators: Map<string, OscillatorData[]> = new Map();
  private reverbConvolver: ConvolverNode | null = null;
  public isInitialized: boolean = false;

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.audioContext.destination);
      
      await this.createReverb();
      this.isInitialized = true;
      console.log('🎵 Synthetic audio engine initialized successfully');
    } catch (error) {
      console.error("Failed to initialize audio:", error);
    }
  }

  private async createReverb(): Promise<void> {
    if (!this.audioContext) return;
    
    this.reverbConvolver = this.audioContext.createConvolver();
    
    // Create impulse response for reverb
    const length = this.audioContext.sampleRate * 2;
    const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    
    this.reverbConvolver.buffer = impulse;
    this.reverbConvolver.connect(this.masterGain!);
  }

  async playNote(frequency: number, duration: number, velocity: number, instrument: string = 'sine', sustainEnabled: boolean = false): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      await this.initialize();
      if (!this.audioContext || !this.masterGain) return;
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);

      oscillator.frequency.value = frequency;
      oscillator.type = instrument as OscillatorType;

      const oscData: OscillatorData = {
        oscillator,
        gain: gainNode,
        instrument,
        frequency,
        startTime: this.audioContext.currentTime
      };

      if (!this.activeOscillators.has(instrument)) {
        this.activeOscillators.set(instrument, []);
      }
      this.activeOscillators.get(instrument)!.push(oscData);

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(velocity * 0.3, this.audioContext.currentTime + 0.01);
      
      if (!sustainEnabled) {
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      }

      oscillator.start(this.audioContext.currentTime);
      
      if (!sustainEnabled) {
        oscillator.stop(this.audioContext.currentTime + duration);
      }
    } catch (error) {
      console.error("Error playing note:", error);
    }
  }

  playDrum(type: 'kick' | 'snare' | 'hihat' | 'openhat' | 'clap' | 'crash' | 'tom', volume: number = 0.7): void {
    if (!this.audioContext || !this.masterGain) return;

    const currentTime = this.audioContext.currentTime;
    
    switch (type) {
      case 'kick':
        this.createKickDrum(currentTime, volume);
        break;
      case 'snare':
        this.createSnareDrum(currentTime, volume);
        break;
      case 'hihat':
        this.createHiHat(currentTime, volume);
        break;
      case 'openhat':
        this.createOpenHat(currentTime, volume);
        break;
      case 'clap':
        this.createClap(currentTime, volume);
        break;
      case 'crash':
        this.createCrash(currentTime, volume);
        break;
      case 'tom':
        this.createTom(currentTime, volume);
        break;
    }
  }

  private createKickDrum(time: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.frequency.setValueAtTime(60, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  private createSnareDrum(time: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    // Noise component
    const bufferSize = this.audioContext.sampleRate * 0.1;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    const noiseGain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    filter.type = 'highpass';
    filter.frequency.value = 1000;

    noiseGain.gain.setValueAtTime(volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    noise.start(time);
  }

  private createHiHat(time: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const bufferSize = this.audioContext.sampleRate * 0.1;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    filter.type = 'highpass';
    filter.frequency.value = 7000;

    gain.gain.setValueAtTime(volume * 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    noise.start(time);
  }

  private createOpenHat(time: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const bufferSize = this.audioContext.sampleRate * 0.3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    filter.type = 'highpass';
    filter.frequency.value = 7000;

    gain.gain.setValueAtTime(volume * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

    noise.start(time);
  }

  private createClap(time: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    for (let i = 0; i < 3; i++) {
      const delay = i * 0.01;
      this.createSnareDrum(time + delay, volume * 0.7);
    }
  }

  private createCrash(time: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const bufferSize = this.audioContext.sampleRate * 2;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    filter.type = 'highpass';
    filter.frequency.value = 5000;

    gain.gain.setValueAtTime(volume * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 2);

    noise.start(time);
  }

  private createTom(time: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.3);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  playBeat(pattern: any, samples: string[], bpm: number): Promise<void> {
    return Promise.resolve();
  }

  playSequencer(state: SequencerState): Promise<void> {
    return Promise.resolve();
  }

  setBpm(bpm: number): void {
    // Implementation for BPM setting
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  stop(): void {
    this.activeOscillators.forEach((oscillators, instrument) => {
      oscillators.forEach(oscData => {
        try {
          oscData.oscillator.stop();
        } catch (error) {
          // Oscillator may already be stopped
        }
      });
    });
    this.activeOscillators.clear();
  }
}

export interface AudioEngine {
  initialize(): Promise<void>;
  playNote(frequency: number, duration: number, velocity: number, instrument?: string, sustainEnabled?: boolean): Promise<void>;
  playDrum(type: 'kick' | 'snare' | 'hihat' | 'openhat' | 'clap' | 'crash' | 'tom', volume?: number): void;
  playBeat(pattern: any, samples: string[], bpm: number): Promise<void>;
  playSequencer(state: any): Promise<void>;
  setBpm(bpm: number): void;
  setMasterVolume(volume: number): void;
  stop(): void;
}

export class WebAudioEngine extends AudioEngine {
  // Additional web audio specific methods can be added here
}

// Create and export singleton instances
export const audioEngine = new WebAudioEngine();
export const audioManager = audioEngine;

// Export default
export default audioEngine;
