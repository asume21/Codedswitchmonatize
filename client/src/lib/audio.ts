import { realisticAudio } from './realisticAudio';

export interface AudioEngine {
  initialize(): Promise<void>;
  playNote(frequency: number, duration: number, velocity: number, instrument?: string, sustainEnabled?: boolean): Promise<void>;
  playDrum(type: 'kick' | 'snare' | 'hihat' | 'openhat' | 'clap' | 'crash' | 'tom', volume?: number): void;
  playBeat(pattern: any, samples: string[], bpm: number): Promise<void>;
  playSequencer(state: any): Promise<void>;
  setBpm(bpm: number): void;
  setMasterVolume(volume: number): void;
  stop(): void;
  stopAllInstruments(): void;
}

class WebAudioEngine implements AudioEngine {
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private currentSequence: any = null;
  private masterGain: GainNode | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.7;

      this.isInitialized = true;
      console.log('Audio engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      throw error;
    }
  }

  async playNote(frequency: number, duration: number, velocity: number, instrument?: string, sustainEnabled?: boolean): Promise<void> {
    if (!this.audioContext || !this.masterGain) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(velocity, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.error('Failed to play note:', error);
    }
  }

  playDrum(type: 'kick' | 'snare' | 'hihat' | 'openhat' | 'clap' | 'crash' | 'tom', volume: number = 0.7): void {
    if (!this.audioContext || !this.masterGain) return;

    try {
      const currentTime = this.audioContext.currentTime;
      
      switch (type) {
        case 'kick':
          this.playKick(currentTime, volume);
          break;
        case 'snare':
          this.playSnare(currentTime, volume);
          break;
        case 'hihat':
          this.playHihat(currentTime, volume);
          break;
        case 'openhat':
          this.playOpenHat(currentTime, volume);
          break;
        case 'clap':
          this.playClap(currentTime, volume);
          break;
        case 'crash':
          this.playCrash(currentTime, volume);
          break;
        case 'tom':
          this.playTom(currentTime, volume);
          break;
      }
    } catch (error) {
      console.error('Failed to play drum:', error);
    }
  }

  private playKick(currentTime: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.frequency.setValueAtTime(60, currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(30, currentTime + 0.1);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(volume, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.3);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.start(currentTime);
    oscillator.stop(currentTime + 0.3);
  }

  private playSnare(currentTime: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.1, this.audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    
    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(volume * 0.3, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.1);
    
    noiseSource.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    noiseSource.start(currentTime);
  }

  private playHihat(currentTime: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.05, this.audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4);
    }
    
    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(volume * 0.2, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.05);
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    noiseSource.start(currentTime);
  }

  private playOpenHat(currentTime: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.3, this.audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
    }
    
    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(volume * 0.3, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.3);
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    noiseSource.start(currentTime);
  }

  private playClap(currentTime: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    for (let i = 0; i < 3; i++) {
      const delay = i * 0.01;
      const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.1, this.audioContext.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      
      for (let j = 0; j < data.length; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / data.length, 3);
      }
      
      const noiseSource = this.audioContext.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(volume * 0.2, currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + delay + 0.1);
      
      noiseSource.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      noiseSource.start(currentTime + delay);
    }
  }

  private playCrash(currentTime: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 2, this.audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.5);
    }
    
    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 5000;
    filter.Q.value = 0.5;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(volume * 0.4, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 2);
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    noiseSource.start(currentTime);
  }

  private playTom(currentTime: number, volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.frequency.setValueAtTime(120, currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(80, currentTime + 0.3);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(volume * 0.6, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.4);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.start(currentTime);
    oscillator.stop(currentTime + 0.4);
  }

  async playBeat(pattern: any, samples: string[], bpm: number): Promise<void> {
    if (!this.audioContext) return;

    const stepDuration = (60 / bpm / 4) * 1000; // 16th note duration
    let step = 0;

    const playStep = () => {
      if (pattern.kick && pattern.kick[step % 16]) {
        this.playDrum('kick');
      }
      if (pattern.snare && pattern.snare[step % 16]) {
        this.playDrum('snare');
      }
      if (pattern.hihat && pattern.hihat[step % 16]) {
        this.playDrum('hihat');
      }
      if (pattern.openhat && pattern.openhat[step % 16]) {
        this.playDrum('openhat');
      }

      step++;
      if (step < 16) {
        setTimeout(playStep, stepDuration);
      }
    };

    playStep();
  }

  async playSequencer(state: any): Promise<void> {
    // Basic sequencer implementation
    console.log('Playing sequencer state:', state);
  }

  setBpm(bpm: number): void {
    console.log('Setting BPM to:', bpm);
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  stop(): void {
    // Stop any playing sequences
    console.log('Stopping audio engine');
  }

  stopAllInstruments(): void {
    // Stop all instruments
    console.log('Stopping all instruments');
  }
}

export const audioEngine = new WebAudioEngine();
export const audioManager = audioEngine;