import * as Tone from "tone";
import type { SequencerState } from "./sequencer";

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
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      console.log(
        "🎵 Synthetic audio context created, state:",
        this.audioContext.state,
      );

      // Handle suspended context (required for browser autoplay policies)
      if (this.audioContext.state === "suspended") {
        console.log(
          "🎵 Synthetic audio context suspended, attempting to resume...",
        );

        // Add a click listener to resume context on next user interaction
        const resumeAudio = async () => {
          if (this.audioContext && this.audioContext.state === "suspended") {
            try {
              await this.audioContext.resume();
              console.log("🎵 Synthetic audio context resumed successfully");
            } catch (error) {
              console.error(
                "🎵 Failed to resume synthetic audio context:",
                error,
              );
            }
          }
          document.removeEventListener("click", resumeAudio, true);
          document.removeEventListener("keydown", resumeAudio, true);
          document.removeEventListener("touchstart", resumeAudio, true);
        };

        // Listen for user interactions to resume audio
        document.addEventListener("click", resumeAudio, true);
        document.addEventListener("keydown", resumeAudio, true);
        document.addEventListener("touchstart", resumeAudio, true);

        // Try to resume immediately in case we already have permission
        try {
          await this.audioContext.resume();
          console.log("🎵 Synthetic audio context resumed immediately");
        } catch (error) {
          console.log(
            "🎵 Synthetic audio context needs user interaction to resume",
          );
        }
      }

      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.audioContext.destination);

      await this.createReverb();
      this.isInitialized = true;
      console.log("🎵 Synthetic audio engine initialized successfully");
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      throw error;
    }
  }

  private async createReverb(): Promise<void> {
    if (!this.audioContext) return;

    this.reverbConvolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * 2;
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    this.reverbConvolver.buffer = impulse;
  }

  private addReverb(source: GainNode, amount: number): void {
    if (!this.audioContext || !this.reverbConvolver || !this.masterGain) return;

    const wetGain = this.audioContext.createGain();
    const dryGain = this.audioContext.createGain();

    wetGain.gain.value = amount;
    dryGain.gain.value = 1 - amount;

    source.connect(dryGain);
    source.connect(this.reverbConvolver);

    this.reverbConvolver.connect(wetGain);

    wetGain.connect(this.masterGain);
    dryGain.connect(this.masterGain);
  }

  async playNote(
    frequency: number,
    duration: number,
    velocity: number = 0.7,
    instrument: string = "piano",
    sustainEnabled: boolean = true,
  ): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      await this.initialize();
    }

    try {
      const currentTime = this.audioContext!.currentTime;

      // Route to completely different synthesis methods for each instrument
      if (instrument.includes("piano") && !instrument.includes("organ")) {
        this.playPianoNote(
          frequency,
          duration,
          velocity,
          currentTime,
          sustainEnabled,
        );
      } else if (instrument.includes("grand")) {
        this.playGrandPianoNote(frequency, duration, velocity, currentTime);
      } else if (instrument.includes("organ")) {
        this.playOrganNote(frequency, duration, velocity, currentTime);
      } else if (instrument.includes("guitar")) {
        this.playGuitarNote(
          frequency,
          duration,
          velocity,
          currentTime,
          sustainEnabled,
        );
      } else if (instrument.includes("violin")) {
        this.playViolinNote(frequency, duration, velocity, currentTime);
      } else if (instrument.includes("ukulele")) {
        this.playUkuleleNote(frequency, duration, velocity, currentTime);
      } else if (instrument.includes("flute") && !instrument.includes("pan")) {
        this.playFluteNote(frequency, duration, velocity, currentTime);
      } else if (instrument.includes("panflute")) {
        this.playPanFluteNote(frequency, duration, velocity, currentTime);
      } else if (instrument.includes("recorder")) {
        this.playRecorderNote(frequency, duration, velocity, currentTime);
      } else {
        this.playGenericNote(frequency, duration, velocity, currentTime);
      }
    } catch (error) {
      console.error("Failed to play note:", error);
    }
  }

  // PIANO: Authentic acoustic piano with hammer strike, string resonance, and natural decay
  private playPianoNote(
    frequency: number,
    duration: number,
    velocity: number,
    currentTime: number,
    sustainEnabled: boolean = true,
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillators: OscillatorNode[] = [];
    const masterGain = this.audioContext.createGain();

    // Piano string harmonics - acoustic piano has rich harmonic series
    const fundamental = this.audioContext.createOscillator();
    const harmonic2 = this.audioContext.createOscillator();
    const harmonic3 = this.audioContext.createOscillator();
    const harmonic4 = this.audioContext.createOscillator();
    const harmonic5 = this.audioContext.createOscillator();

    // Hammer strike simulation
    const hammerStrike = this.audioContext.createBufferSource();
    const hammerTransient = this.audioContext.createOscillator();

    // String sympathetic resonance
    const stringResonance = this.audioContext.createOscillator();

    // Gains for each component
    const fundGain = this.audioContext.createGain();
    const harm2Gain = this.audioContext.createGain();
    const harm3Gain = this.audioContext.createGain();
    const harm4Gain = this.audioContext.createGain();
    const harm5Gain = this.audioContext.createGain();
    const hammerGain = this.audioContext.createGain();
    const transientGain = this.audioContext.createGain();
    const resonanceGain = this.audioContext.createGain();

    // Filters for piano tone shaping
    const pianoFilter = this.audioContext.createBiquadFilter();
    const brightnessFilter = this.audioContext.createBiquadFilter();

    // Piano harmonics - adjust for frequency range
    if (frequency < 150) {
      // Low notes - more percussive, less string-like
      fundamental.type = "square"; // More percussive for bass
    } else {
      fundamental.type = "triangle"; // Warm for mid/high
    }
    fundamental.frequency.setValueAtTime(frequency, currentTime);

    harmonic2.type = "sine";
    harmonic2.frequency.setValueAtTime(frequency * 2, currentTime);

    harmonic3.type = "sine";
    harmonic3.frequency.setValueAtTime(frequency * 3, currentTime);

    harmonic4.type = "sine";
    harmonic4.frequency.setValueAtTime(frequency * 4, currentTime);

    harmonic5.type = "sine";
    harmonic5.frequency.setValueAtTime(frequency * 5, currentTime);

    // Hammer strike noise
    const hammerLength = Math.floor(this.audioContext.sampleRate * 0.005); // 5ms
    const hammerBuffer = this.audioContext.createBuffer(
      1,
      hammerLength,
      this.audioContext.sampleRate,
    );
    const hammerData = hammerBuffer.getChannelData(0);
    for (let i = 0; i < hammerLength; i++) {
      hammerData[i] =
        (Math.random() * 2 - 1) * Math.exp((-i / hammerLength) * 8);
    }
    hammerStrike.buffer = hammerBuffer;

    // Hammer transient
    hammerTransient.type = "square";
    hammerTransient.frequency.setValueAtTime(frequency * 8, currentTime);

    // String sympathetic resonance
    stringResonance.type = "triangle";
    stringResonance.frequency.setValueAtTime(frequency * 1.003, currentTime); // Slightly detuned

    // Piano tone filtering - adjust for frequency range
    pianoFilter.type = "lowpass";
    if (frequency < 150) {
      // Low notes - tighter filtering, less string resonance
      pianoFilter.frequency.setValueAtTime(frequency * 4, currentTime);
      pianoFilter.Q.setValueAtTime(2, currentTime);
    } else {
      pianoFilter.frequency.setValueAtTime(frequency * 6, currentTime);
      pianoFilter.Q.setValueAtTime(1, currentTime);
    }

    // Brightness control
    brightnessFilter.type = "peaking";
    brightnessFilter.frequency.setValueAtTime(frequency * 3, currentTime);
    brightnessFilter.Q.setValueAtTime(2, currentTime);
    if (frequency < 150) {
      brightnessFilter.gain.setValueAtTime(1, currentTime); // Less bright for low notes
    } else {
      brightnessFilter.gain.setValueAtTime(3, currentTime);
    }

    // Piano ADSR envelope with configurable sustain
    const attackTime = 0.02;
    const decayTime = 0.15;
    const sustainLevel = sustainEnabled ? 0.75 : 0.2; // Lower sustain when disabled
    const releaseTime = sustainEnabled
      ? Math.min(0.4, duration * 0.3)
      : Math.min(0.2, duration * 0.7);

    // Fundamental with sustain
    const fundVol = Math.max(0.001, velocity * 0.8);
    fundGain.gain.setValueAtTime(0.001, currentTime);
    fundGain.gain.exponentialRampToValueAtTime(
      fundVol,
      currentTime + attackTime,
    );
    fundGain.gain.exponentialRampToValueAtTime(
      fundVol * sustainLevel,
      currentTime + attackTime + decayTime,
    );
    if (duration > attackTime + decayTime + releaseTime) {
      fundGain.gain.setValueAtTime(
        fundVol * sustainLevel,
        currentTime + duration - releaseTime,
      );
    }
    fundGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    // Harmonics with sustain
    const harm2Vol = Math.max(0.001, velocity * 0.6);
    harm2Gain.gain.setValueAtTime(0.001, currentTime);
    harm2Gain.gain.exponentialRampToValueAtTime(
      harm2Vol,
      currentTime + attackTime,
    );
    harm2Gain.gain.exponentialRampToValueAtTime(
      harm2Vol * sustainLevel,
      currentTime + attackTime + decayTime,
    );
    if (duration > attackTime + decayTime + releaseTime) {
      harm2Gain.gain.setValueAtTime(
        harm2Vol * sustainLevel,
        currentTime + duration - releaseTime,
      );
    }
    harm2Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const harm3Vol = Math.max(0.001, velocity * 0.4);
    harm3Gain.gain.setValueAtTime(0.001, currentTime);
    harm3Gain.gain.exponentialRampToValueAtTime(
      harm3Vol,
      currentTime + attackTime,
    );
    harm3Gain.gain.exponentialRampToValueAtTime(
      harm3Vol * sustainLevel,
      currentTime + attackTime + decayTime,
    );
    if (duration > attackTime + decayTime + releaseTime) {
      harm3Gain.gain.setValueAtTime(
        harm3Vol * sustainLevel,
        currentTime + duration - releaseTime,
      );
    }
    harm3Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const harm4Vol = Math.max(0.001, velocity * 0.3);
    harm4Gain.gain.setValueAtTime(0.001, currentTime);
    harm4Gain.gain.exponentialRampToValueAtTime(
      harm4Vol,
      currentTime + attackTime,
    );
    harm4Gain.gain.exponentialRampToValueAtTime(
      harm4Vol * sustainLevel,
      currentTime + attackTime + decayTime,
    );
    if (duration > attackTime + decayTime + releaseTime) {
      harm4Gain.gain.setValueAtTime(
        harm4Vol * sustainLevel,
        currentTime + duration - releaseTime,
      );
    }
    harm4Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const harm5Vol = Math.max(0.001, velocity * 0.2);
    harm5Gain.gain.setValueAtTime(0.001, currentTime);
    harm5Gain.gain.exponentialRampToValueAtTime(
      harm5Vol,
      currentTime + attackTime,
    );
    harm5Gain.gain.exponentialRampToValueAtTime(
      harm5Vol * sustainLevel,
      currentTime + attackTime + decayTime,
    );
    if (duration > attackTime + decayTime + releaseTime) {
      harm5Gain.gain.setValueAtTime(
        harm5Vol * sustainLevel,
        currentTime + duration - releaseTime,
      );
    }
    harm5Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    // Hammer components
    const hammerVol = Math.max(0.001, velocity * 0.3);
    hammerGain.gain.setValueAtTime(hammerVol, currentTime);
    hammerGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.01);

    const transientVol = Math.max(0.001, velocity * 0.2);
    transientGain.gain.setValueAtTime(transientVol, currentTime);
    transientGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.005);

    // String resonance
    const resonanceVol = Math.max(0.001, velocity * 0.3);
    resonanceGain.gain.setValueAtTime(0.001, currentTime);
    resonanceGain.gain.exponentialRampToValueAtTime(
      resonanceVol,
      currentTime + 0.02,
    );
    resonanceGain.gain.exponentialRampToValueAtTime(
      resonanceVol * 0.8,
      currentTime + 0.2,
    );
    resonanceGain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration,
    );

    // Connect fundamental through filters
    fundamental.connect(pianoFilter);
    pianoFilter.connect(brightnessFilter);
    brightnessFilter.connect(fundGain);
    fundGain.connect(masterGain);

    // Connect harmonics
    harmonic2.connect(harm2Gain);
    harm2Gain.connect(masterGain);

    harmonic3.connect(harm3Gain);
    harm3Gain.connect(masterGain);

    harmonic4.connect(harm4Gain);
    harm4Gain.connect(masterGain);

    harmonic5.connect(harm5Gain);
    harm5Gain.connect(masterGain);

    // Connect hammer components
    hammerStrike.connect(hammerGain);
    hammerGain.connect(masterGain);

    hammerTransient.connect(transientGain);
    transientGain.connect(masterGain);

    // Connect string resonance
    stringResonance.connect(resonanceGain);
    resonanceGain.connect(masterGain);

    // Start all components
    fundamental.start(currentTime);
    harmonic2.start(currentTime);
    harmonic3.start(currentTime);
    harmonic4.start(currentTime);
    harmonic5.start(currentTime);
    hammerStrike.start(currentTime);
    hammerTransient.start(currentTime);
    stringResonance.start(currentTime);

    // Stop all components
    fundamental.stop(currentTime + duration);
    harmonic2.stop(currentTime + duration);
    harmonic3.stop(currentTime + duration);
    harmonic4.stop(currentTime + duration);
    harmonic5.stop(currentTime + duration);
    hammerTransient.stop(currentTime + duration);
    stringResonance.stop(currentTime + duration);

    oscillators.push(
      fundamental,
      harmonic2,
      harmonic3,
      harmonic4,
      harmonic5,
      hammerTransient,
      stringResonance,
    );

    this.addReverb(masterGain, 0.3); // Natural room reverb
    masterGain.connect(this.masterGain);
    this.trackOscillators(oscillators, "piano", frequency);
  }

  // GRAND PIANO: Premium concert grand with rich harmonics, long sustain, and warm tone
  private playGrandPianoNote(
    frequency: number,
    duration: number,
    velocity: number,
    currentTime: number,
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillators: OscillatorNode[] = [];
    const masterGain = this.audioContext.createGain();

    // Grand piano harmonic series - richer than upright piano
    const fundamental = this.audioContext.createOscillator();
    const harmonic2 = this.audioContext.createOscillator();
    const harmonic3 = this.audioContext.createOscillator();
    const harmonic4 = this.audioContext.createOscillator();
    const harmonic5 = this.audioContext.createOscillator();
    const harmonic6 = this.audioContext.createOscillator();

    // Grand piano soundboard resonance
    const soundboard1 = this.audioContext.createOscillator();
    const soundboard2 = this.audioContext.createOscillator();

    // Hammer mechanism - softer than upright
    const hammerStrike = this.audioContext.createBufferSource();

    // Gains for each component
    const fundGain = this.audioContext.createGain();
    const harm2Gain = this.audioContext.createGain();
    const harm3Gain = this.audioContext.createGain();
    const harm4Gain = this.audioContext.createGain();
    const harm5Gain = this.audioContext.createGain();
    const harm6Gain = this.audioContext.createGain();
    const soundboard1Gain = this.audioContext.createGain();
    const soundboard2Gain = this.audioContext.createGain();
    const hammerGain = this.audioContext.createGain();

    // Filters for grand piano tone
    const grandFilter = this.audioContext.createBiquadFilter();
    const warmthFilter = this.audioContext.createBiquadFilter();
    const soundboardFilter = this.audioContext.createBiquadFilter();

    // Grand piano harmonics - warmer and richer
    fundamental.type = "triangle";
    fundamental.frequency.setValueAtTime(frequency, currentTime);

    harmonic2.type = "sine";
    harmonic2.frequency.setValueAtTime(frequency * 2, currentTime);

    harmonic3.type = "sine";
    harmonic3.frequency.setValueAtTime(frequency * 3, currentTime);

    harmonic4.type = "sine";
    harmonic4.frequency.setValueAtTime(frequency * 4, currentTime);

    harmonic5.type = "sine";
    harmonic5.frequency.setValueAtTime(frequency * 5, currentTime);

    harmonic6.type = "sine";
    harmonic6.frequency.setValueAtTime(frequency * 6, currentTime);

    // Large soundboard resonance
    soundboard1.type = "triangle";
    soundboard1.frequency.setValueAtTime(frequency * 0.997, currentTime); // Slightly detuned

    soundboard2.type = "triangle";
    soundboard2.frequency.setValueAtTime(frequency * 1.003, currentTime); // Slightly detuned

    // Softer hammer for grand piano
    const hammerLength = Math.floor(this.audioContext.sampleRate * 0.003); // 3ms - softer than upright
    const hammerBuffer = this.audioContext.createBuffer(
      1,
      hammerLength,
      this.audioContext.sampleRate,
    );
    const hammerData = hammerBuffer.getChannelData(0);
    for (let i = 0; i < hammerLength; i++) {
      hammerData[i] =
        (Math.random() * 2 - 1) * 0.5 * Math.exp((-i / hammerLength) * 6);
    }
    hammerStrike.buffer = hammerBuffer;

    // Grand piano tone shaping
    grandFilter.type = "lowpass";
    grandFilter.frequency.setValueAtTime(frequency * 8, currentTime); // More open than upright
    grandFilter.Q.setValueAtTime(0.8, currentTime);

    // Warmth enhancement
    warmthFilter.type = "peaking";
    warmthFilter.frequency.setValueAtTime(frequency * 2, currentTime);
    warmthFilter.Q.setValueAtTime(1.5, currentTime);
    warmthFilter.gain.setValueAtTime(2, currentTime);

    // Soundboard filtering
    soundboardFilter.type = "bandpass";
    soundboardFilter.frequency.setValueAtTime(frequency * 1.5, currentTime);
    soundboardFilter.Q.setValueAtTime(1, currentTime);

    // Grand piano envelope - longer sustain than upright
    const fundVol = Math.max(0.001, velocity * 0.9);
    fundGain.gain.setValueAtTime(fundVol, currentTime);
    fundGain.gain.exponentialRampToValueAtTime(
      fundVol * 0.8,
      currentTime + 0.2,
    );
    fundGain.gain.exponentialRampToValueAtTime(
      fundVol * 0.6,
      currentTime + duration * 0.4,
    );
    fundGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    // Richer harmonic distribution
    const harm2Vol = Math.max(0.001, velocity * 0.7);
    harm2Gain.gain.setValueAtTime(harm2Vol, currentTime);
    harm2Gain.gain.exponentialRampToValueAtTime(
      harm2Vol * 0.7,
      currentTime + 0.15,
    );
    harm2Gain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.9,
    );

    const harm3Vol = Math.max(0.001, velocity * 0.5);
    harm3Gain.gain.setValueAtTime(harm3Vol, currentTime);
    harm3Gain.gain.exponentialRampToValueAtTime(
      harm3Vol * 0.6,
      currentTime + 0.12,
    );
    harm3Gain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.7,
    );

    const harm4Vol = Math.max(0.001, velocity * 0.4);
    harm4Gain.gain.setValueAtTime(harm4Vol, currentTime);
    harm4Gain.gain.exponentialRampToValueAtTime(
      harm4Vol * 0.5,
      currentTime + 0.1,
    );
    harm4Gain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.6,
    );

    const harm5Vol = Math.max(0.001, velocity * 0.3);
    harm5Gain.gain.setValueAtTime(harm5Vol, currentTime);
    harm5Gain.gain.exponentialRampToValueAtTime(
      harm5Vol * 0.4,
      currentTime + 0.08,
    );
    harm5Gain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.5,
    );

    const harm6Vol = Math.max(0.001, velocity * 0.2);
    harm6Gain.gain.setValueAtTime(harm6Vol, currentTime);
    harm6Gain.gain.exponentialRampToValueAtTime(
      harm6Vol * 0.3,
      currentTime + 0.06,
    );
    harm6Gain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.4,
    );

    // Soundboard resonance - distinctive of grand pianos
    const soundboard1Vol = Math.max(0.001, velocity * 0.4);
    soundboard1Gain.gain.setValueAtTime(0.001, currentTime);
    soundboard1Gain.gain.exponentialRampToValueAtTime(
      soundboard1Vol,
      currentTime + 0.05,
    );
    soundboard1Gain.gain.exponentialRampToValueAtTime(
      soundboard1Vol * 0.8,
      currentTime + 0.3,
    );
    soundboard1Gain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration,
    );

    const soundboard2Vol = Math.max(0.001, velocity * 0.35);
    soundboard2Gain.gain.setValueAtTime(0.001, currentTime);
    soundboard2Gain.gain.exponentialRampToValueAtTime(
      soundboard2Vol,
      currentTime + 0.07,
    );
    soundboard2Gain.gain.exponentialRampToValueAtTime(
      soundboard2Vol * 0.7,
      currentTime + 0.35,
    );
    soundboard2Gain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration,
    );

    // Softer hammer
    const hammerVol = Math.max(0.001, velocity * 0.2);
    hammerGain.gain.setValueAtTime(hammerVol, currentTime);
    hammerGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.008);

    // Connect fundamental through filters
    fundamental.connect(grandFilter);
    grandFilter.connect(warmthFilter);
    warmthFilter.connect(fundGain);
    fundGain.connect(masterGain);

    // Connect harmonics
    harmonic2.connect(harm2Gain);
    harm2Gain.connect(masterGain);

    harmonic3.connect(harm3Gain);
    harm3Gain.connect(masterGain);

    harmonic4.connect(harm4Gain);
    harm4Gain.connect(masterGain);

    harmonic5.connect(harm5Gain);
    harm5Gain.connect(masterGain);

    harmonic6.connect(harm6Gain);
    harm6Gain.connect(masterGain);

    // Connect soundboard through filter
    soundboard1.connect(soundboardFilter);
    soundboardFilter.connect(soundboard1Gain);
    soundboard1Gain.connect(masterGain);

    soundboard2.connect(soundboard2Gain);
    soundboard2Gain.connect(masterGain);

    // Connect hammer
    hammerStrike.connect(hammerGain);
    hammerGain.connect(masterGain);

    // Start all components
    fundamental.start(currentTime);
    harmonic2.start(currentTime);
    harmonic3.start(currentTime);
    harmonic4.start(currentTime);
    harmonic5.start(currentTime);
    harmonic6.start(currentTime);
    soundboard1.start(currentTime);
    soundboard2.start(currentTime);
    hammerStrike.start(currentTime);

    // Stop all components
    fundamental.stop(currentTime + duration);
    harmonic2.stop(currentTime + duration);
    harmonic3.stop(currentTime + duration);
    harmonic4.stop(currentTime + duration);
    harmonic5.stop(currentTime + duration);
    harmonic6.stop(currentTime + duration);
    soundboard1.stop(currentTime + duration);
    soundboard2.stop(currentTime + duration);

    oscillators.push(
      fundamental,
      harmonic2,
      harmonic3,
      harmonic4,
      harmonic5,
      harmonic6,
      soundboard1,
      soundboard2,
    );

    this.addReverb(masterGain, 0.5); // Concert hall reverb
    masterGain.connect(this.masterGain);
    this.trackOscillators(oscillators, "grand", frequency);
  }

  // ORGAN: Buzzy, nasal, electronic with vibrato - sounds like a cheap electronic keyboard
  private playOrganNote(
    frequency: number,
    duration: number,
    velocity: number,
    currentTime: number,
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillators: OscillatorNode[] = [];
    const masterGain = this.audioContext.createGain();

    // Organ drawbar harmonics - classic Hammond organ style
    const fundamental = this.audioContext.createOscillator(); // 16' drawbar
    const octave = this.audioContext.createOscillator(); // 8' drawbar
    const fifth = this.audioContext.createOscillator(); // 5 1/3' drawbar
    const fourth = this.audioContext.createOscillator(); // 4' drawbar
    const third = this.audioContext.createOscillator(); // 2 2/3' drawbar
    const second = this.audioContext.createOscillator(); // 2' drawbar

    // Wind/breath sound for realism
    const windNoise = this.audioContext.createBufferSource();

    // Gains for each drawbar
    const fundGain = this.audioContext.createGain();
    const octaveGain = this.audioContext.createGain();
    const fifthGain = this.audioContext.createGain();
    const fourthGain = this.audioContext.createGain();
    const thirdGain = this.audioContext.createGain();
    const secondGain = this.audioContext.createGain();
    const windGain = this.audioContext.createGain();

    // Organ tone filtering
    const organFilter = this.audioContext.createBiquadFilter();

    // Organ drawbar frequencies (Hammond organ ratios)
    fundamental.type = "sine"; // Pure tones like organ pipes
    fundamental.frequency.setValueAtTime(frequency * 0.5, currentTime); // Sub-octave

    octave.type = "sine";
    octave.frequency.setValueAtTime(frequency, currentTime); // Main pitch

    fifth.type = "sine";
    fifth.frequency.setValueAtTime(frequency * 1.498, currentTime); // Perfect fifth

    fourth.type = "sine";
    fourth.frequency.setValueAtTime(frequency * 2, currentTime); // Octave up

    third.type = "sine";
    third.frequency.setValueAtTime(frequency * 2.997, currentTime); // Fifth above octave

    second.type = "sine";
    second.frequency.setValueAtTime(frequency * 4, currentTime); // Two octaves up

    // Wind noise for pipe organ character
    const windLength = Math.floor(this.audioContext.sampleRate * duration);
    const windBuffer = this.audioContext.createBuffer(
      1,
      windLength,
      this.audioContext.sampleRate,
    );
    const windData = windBuffer.getChannelData(0);
    for (let i = 0; i < windLength; i++) {
      windData[i] = (Math.random() * 2 - 1) * 0.02; // Very subtle wind
    }
    windNoise.buffer = windBuffer;

    // Organ filtering - warm and full
    organFilter.type = "lowpass";
    organFilter.frequency.setValueAtTime(frequency * 8, currentTime);
    organFilter.Q.setValueAtTime(0.7, currentTime);

    // Organ envelope - instant attack, sustained, quick release
    const fundVol = Math.max(0.001, velocity * 0.6);
    fundGain.gain.setValueAtTime(fundVol, currentTime);
    fundGain.gain.setValueAtTime(fundVol * 0.95, currentTime + duration - 0.05);
    fundGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const octaveVol = Math.max(0.001, velocity * 0.8); // Main drawbar
    octaveGain.gain.setValueAtTime(octaveVol, currentTime);
    octaveGain.gain.setValueAtTime(
      octaveVol * 0.95,
      currentTime + duration - 0.05,
    );
    octaveGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const fifthVol = Math.max(0.001, velocity * 0.5);
    fifthGain.gain.setValueAtTime(fifthVol, currentTime);
    fifthGain.gain.setValueAtTime(
      fifthVol * 0.9,
      currentTime + duration - 0.05,
    );
    fifthGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const fourthVol = Math.max(0.001, velocity * 0.4);
    fourthGain.gain.setValueAtTime(fourthVol, currentTime);
    fourthGain.gain.setValueAtTime(
      fourthVol * 0.9,
      currentTime + duration - 0.05,
    );
    fourthGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const thirdVol = Math.max(0.001, velocity * 0.3);
    thirdGain.gain.setValueAtTime(thirdVol, currentTime);
    thirdGain.gain.setValueAtTime(
      thirdVol * 0.85,
      currentTime + duration - 0.05,
    );
    thirdGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const secondVol = Math.max(0.001, velocity * 0.25);
    secondGain.gain.setValueAtTime(secondVol, currentTime);
    secondGain.gain.setValueAtTime(
      secondVol * 0.8,
      currentTime + duration - 0.05,
    );
    secondGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const windVol = Math.max(0.001, velocity * 0.1);
    windGain.gain.setValueAtTime(windVol, currentTime);
    windGain.gain.exponentialRampToValueAtTime(
      windVol * 0.7,
      currentTime + duration * 0.8,
    );
    windGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    // Connect all drawbars through filter
    fundamental.connect(organFilter);
    organFilter.connect(fundGain);
    fundGain.connect(masterGain);

    octave.connect(octaveGain);
    octaveGain.connect(masterGain);

    fifth.connect(fifthGain);
    fifthGain.connect(masterGain);

    fourth.connect(fourthGain);
    fourthGain.connect(masterGain);

    third.connect(thirdGain);
    thirdGain.connect(masterGain);

    second.connect(secondGain);
    secondGain.connect(masterGain);

    windNoise.connect(windGain);
    windGain.connect(masterGain);

    // Start all oscillators
    fundamental.start(currentTime);
    octave.start(currentTime);
    fifth.start(currentTime);
    fourth.start(currentTime);
    third.start(currentTime);
    second.start(currentTime);
    windNoise.start(currentTime);

    // Stop all oscillators
    fundamental.stop(currentTime + duration);
    octave.stop(currentTime + duration);
    fifth.stop(currentTime + duration);
    fourth.stop(currentTime + duration);
    third.stop(currentTime + duration);
    second.stop(currentTime + duration);

    oscillators.push(fundamental, octave, fifth, fourth, third, second);

    this.addReverb(masterGain, 0.6); // Cathedral reverb for organ
    masterGain.connect(this.masterGain);
    this.trackOscillators(oscillators, "organ", frequency);
  }

  // GUITAR: Sharp percussive attack - completely different from violin
  private playGuitarNote(
    frequency: number,
    duration: number,
    velocity: number,
    currentTime: number,
    sustainEnabled: boolean = true,
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillators: OscillatorNode[] = [];
    const masterGain = this.audioContext.createGain();

    const pluckOsc = this.audioContext.createOscillator();
    const sustainOsc = this.audioContext.createOscillator();
    const pluckNoise = this.audioContext.createOscillator();

    const pluckGain = this.audioContext.createGain();
    const sustainGain = this.audioContext.createGain();
    const noiseGain = this.audioContext.createGain();

    const guitarFilter = this.audioContext.createBiquadFilter();
    const pluckFilter = this.audioContext.createBiquadFilter();

    // Sharp pluck attack
    pluckOsc.type = "square";
    pluckOsc.frequency.setValueAtTime(frequency, currentTime);

    sustainOsc.type = "triangle";
    sustainOsc.frequency.setValueAtTime(frequency, currentTime);

    pluckNoise.type = "sawtooth";
    pluckNoise.frequency.setValueAtTime(frequency * 20, currentTime);

    guitarFilter.type = "lowpass";
    guitarFilter.frequency.setValueAtTime(frequency * 6, currentTime);
    guitarFilter.frequency.exponentialRampToValueAtTime(
      frequency * 2,
      currentTime + duration,
    );
    guitarFilter.Q.setValueAtTime(3, currentTime);

    pluckFilter.type = "highpass";
    pluckFilter.frequency.setValueAtTime(2000, currentTime);
    pluckFilter.Q.setValueAtTime(5, currentTime);

    // Guitar ADSR with configurable sustain
    const attackTime = 0.01; // Very fast attack
    const decayTime = 0.08;
    const sustainLevel = sustainEnabled ? 0.65 : 0.15; // Lower sustain when disabled
    const releaseTime = sustainEnabled
      ? Math.min(0.3, duration * 0.4)
      : Math.min(0.15, duration * 0.8);

    // Pluck attack - instant but brief
    const pluckVolume = Math.max(0.001, velocity * 1.2);
    pluckGain.gain.setValueAtTime(pluckVolume, currentTime);
    pluckGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.05);

    // Sustain with proper ADSR
    const sustainVolume = Math.max(0.001, velocity * 0.6);
    sustainGain.gain.setValueAtTime(0.001, currentTime);
    sustainGain.gain.exponentialRampToValueAtTime(
      sustainVolume,
      currentTime + attackTime,
    );
    sustainGain.gain.exponentialRampToValueAtTime(
      sustainVolume * sustainLevel,
      currentTime + attackTime + decayTime,
    );
    if (duration > attackTime + decayTime + releaseTime) {
      sustainGain.gain.setValueAtTime(
        sustainVolume * sustainLevel,
        currentTime + duration - releaseTime,
      );
    }
    sustainGain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration,
    );

    const noiseVolume = Math.max(0.001, velocity * 0.3);
    noiseGain.gain.setValueAtTime(noiseVolume, currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.02);

    pluckOsc.connect(pluckFilter);
    pluckFilter.connect(pluckGain);
    pluckGain.connect(masterGain);

    sustainOsc.connect(guitarFilter);
    guitarFilter.connect(sustainGain);
    sustainGain.connect(masterGain);

    pluckNoise.connect(noiseGain);
    noiseGain.connect(masterGain);

    pluckOsc.start(currentTime);
    sustainOsc.start(currentTime);
    pluckNoise.start(currentTime);

    pluckOsc.stop(currentTime + duration);
    sustainOsc.stop(currentTime + duration);
    pluckNoise.stop(currentTime + duration);

    oscillators.push(pluckOsc, sustainOsc, pluckNoise);

    this.addReverb(masterGain, 0.1);
    masterGain.connect(this.masterGain);
    this.trackOscillators(oscillators, "guitar", frequency);
  }

  // VIOLIN: Authentic bowed string with realistic formants and body resonance
  private playViolinNote(
    frequency: number,
    duration: number,
    velocity: number,
    currentTime: number,
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillators: OscillatorNode[] = [];
    const masterGain = this.audioContext.createGain();

    // Violin string fundamental - sawtooth has more harmonics like real bowed strings
    const fundamental = this.audioContext.createOscillator();

    // Body resonance oscillators - violin body has specific resonant frequencies
    const bodyResonance1 = this.audioContext.createOscillator();
    const bodyResonance2 = this.audioContext.createOscillator();

    // Bow noise for realistic attack
    const bowNoise = this.audioContext.createBufferSource();

    // Gains for each component
    const fundGain = this.audioContext.createGain();
    const body1Gain = this.audioContext.createGain();
    const body2Gain = this.audioContext.createGain();
    const noiseGain = this.audioContext.createGain();

    // Violin formant filters - these give violin its characteristic timbre
    const formant1 = this.audioContext.createBiquadFilter(); // Main body resonance
    const formant2 = this.audioContext.createBiquadFilter(); // Upper formant
    const airFilter = this.audioContext.createBiquadFilter(); // Air cavity resonance

    // Violin string - sawtooth for rich harmonics
    fundamental.type = "sawtooth";
    fundamental.frequency.setValueAtTime(frequency, currentTime);

    // Body resonances - key frequencies for violin body (around 440-880 Hz range)
    bodyResonance1.type = "sine";
    bodyResonance1.frequency.setValueAtTime(440, currentTime); // A string resonance

    bodyResonance2.type = "sine";
    bodyResonance2.frequency.setValueAtTime(880, currentTime); // Higher body resonance

    // Bow noise for realistic attack texture
    const noiseLength = Math.floor(this.audioContext.sampleRate * 0.1);
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      noiseLength,
      this.audioContext.sampleRate,
    );
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.1; // Bow scraping noise
    }
    bowNoise.buffer = noiseBuffer;

    // Violin formant filtering - this is crucial for realistic violin timbre
    formant1.type = "bandpass";
    formant1.frequency.setValueAtTime(600, currentTime); // Main violin formant
    formant1.Q.setValueAtTime(3, currentTime);

    formant2.type = "bandpass";
    formant2.frequency.setValueAtTime(1400, currentTime); // Brightness formant
    formant2.Q.setValueAtTime(2, currentTime);

    airFilter.type = "lowpass";
    airFilter.frequency.setValueAtTime(frequency * 4, currentTime); // Remove harsh harmonics
    airFilter.Q.setValueAtTime(0.7, currentTime);

    // Realistic violin envelope with proper sustain - Attack, Decay, Sustain, Release (ADSR)
    const fundVol = Math.max(0.001, velocity * 0.6);
    const attackTime = 0.08; // Faster bow contact
    const decayTime = 0.15; // Quick settle to sustain
    const sustainLevel = fundVol * 0.85; // Strong sustain level
    const releaseTime = Math.min(0.3, duration * 0.3); // Proportional release

    fundGain.gain.setValueAtTime(0.001, currentTime);
    // Attack
    fundGain.gain.exponentialRampToValueAtTime(
      fundVol,
      currentTime + attackTime,
    );
    // Decay to sustain
    fundGain.gain.exponentialRampToValueAtTime(
      sustainLevel,
      currentTime + attackTime + decayTime,
    );
    // Sustain phase - hold steady
    if (duration > attackTime + decayTime + releaseTime) {
      fundGain.gain.setValueAtTime(
        sustainLevel,
        currentTime + duration - releaseTime,
      );
    }
    // Release
    fundGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    // Body resonance envelopes - stronger sustain for richer sound
    const body1Vol = Math.max(0.001, velocity * 0.3);
    const body1Sustain = body1Vol * 0.9;
    body1Gain.gain.setValueAtTime(0.001, currentTime);
    body1Gain.gain.exponentialRampToValueAtTime(body1Vol, currentTime + 0.12);
    body1Gain.gain.exponentialRampToValueAtTime(
      body1Sustain,
      currentTime + 0.2,
    );
    if (duration > 0.5) {
      body1Gain.gain.setValueAtTime(
        body1Sustain,
        currentTime + duration - releaseTime,
      );
    }
    body1Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const body2Vol = Math.max(0.001, velocity * 0.25);
    const body2Sustain = body2Vol * 0.85;
    body2Gain.gain.setValueAtTime(0.001, currentTime);
    body2Gain.gain.exponentialRampToValueAtTime(body2Vol, currentTime + 0.15);
    body2Gain.gain.exponentialRampToValueAtTime(
      body2Sustain,
      currentTime + 0.25,
    );
    if (duration > 0.6) {
      body2Gain.gain.setValueAtTime(
        body2Sustain,
        currentTime + duration - releaseTime,
      );
    }
    body2Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    // Bow noise envelope - only at attack
    const noiseVol = Math.max(0.001, velocity * 0.15);
    noiseGain.gain.setValueAtTime(noiseVol, currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.08);

    // Connect violin components through formant filters
    fundamental.connect(formant1);
    formant1.connect(formant2);
    formant2.connect(airFilter);
    airFilter.connect(fundGain);
    fundGain.connect(masterGain);

    // Body resonances connect directly
    bodyResonance1.connect(body1Gain);
    body1Gain.connect(masterGain);

    bodyResonance2.connect(body2Gain);
    body2Gain.connect(masterGain);

    // Bow noise
    bowNoise.connect(noiseGain);
    noiseGain.connect(masterGain);

    // Start all components
    fundamental.start(currentTime);
    bodyResonance1.start(currentTime);
    bodyResonance2.start(currentTime);
    bowNoise.start(currentTime);

    // Stop all components
    fundamental.stop(currentTime + duration);
    bodyResonance1.stop(currentTime + duration);
    bodyResonance2.stop(currentTime + duration);

    oscillators.push(fundamental, bodyResonance1, bodyResonance2);

    this.addReverb(masterGain, 0.4); // Concert hall reverb for violin
    masterGain.connect(this.masterGain);
    this.trackOscillators(oscillators, "violin", frequency);
  }

  // UKULELE: Bright, bouncy, multiple detuned triangles
  private playUkuleleNote(
    frequency: number,
    duration: number,
    velocity: number,
    currentTime: number,
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillators: OscillatorNode[] = [];
    const masterGain = this.audioContext.createGain();

    const brightOsc1 = this.audioContext.createOscillator();
    const brightOsc2 = this.audioContext.createOscillator();
    const brightOsc3 = this.audioContext.createOscillator();
    const sparkleOsc = this.audioContext.createOscillator();

    const osc1Gain = this.audioContext.createGain();
    const osc2Gain = this.audioContext.createGain();
    const osc3Gain = this.audioContext.createGain();
    const sparkleGain = this.audioContext.createGain();

    const brightFilter = this.audioContext.createBiquadFilter();
    const sparkleFilter = this.audioContext.createBiquadFilter();

    brightOsc1.type = "triangle";
    brightOsc1.frequency.setValueAtTime(frequency, currentTime);

    brightOsc2.type = "triangle";
    brightOsc2.frequency.setValueAtTime(frequency * 2.01, currentTime);

    brightOsc3.type = "triangle";
    brightOsc3.frequency.setValueAtTime(frequency * 3.02, currentTime);

    sparkleOsc.type = "sine";
    sparkleOsc.frequency.setValueAtTime(frequency * 8, currentTime);

    brightFilter.type = "highpass";
    brightFilter.frequency.setValueAtTime(frequency * 0.8, currentTime);
    brightFilter.Q.setValueAtTime(2, currentTime);

    sparkleFilter.type = "bandpass";
    sparkleFilter.frequency.setValueAtTime(frequency * 6, currentTime);
    sparkleFilter.Q.setValueAtTime(8, currentTime);

    // Quick bounce, medium decay
    const vol1 = Math.max(0.001, velocity * 1.3);
    osc1Gain.gain.setValueAtTime(vol1, currentTime);
    osc1Gain.gain.exponentialRampToValueAtTime(vol1 * 0.8, currentTime + 0.08);
    osc1Gain.gain.exponentialRampToValueAtTime(
      vol1 * 0.4,
      currentTime + duration * 0.5,
    );
    osc1Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const vol2 = Math.max(0.001, velocity * 0.8);
    osc2Gain.gain.setValueAtTime(vol2, currentTime);
    osc2Gain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.7,
    );

    const vol3 = Math.max(0.001, velocity * 0.6);
    osc3Gain.gain.setValueAtTime(vol3, currentTime);
    osc3Gain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.5,
    );

    const sparkleVol = Math.max(0.001, velocity * 0.4);
    sparkleGain.gain.setValueAtTime(sparkleVol, currentTime);
    sparkleGain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.3,
    );

    brightOsc1.connect(brightFilter);
    brightFilter.connect(osc1Gain);
    osc1Gain.connect(masterGain);

    brightOsc2.connect(osc2Gain);
    osc2Gain.connect(masterGain);

    brightOsc3.connect(osc3Gain);
    osc3Gain.connect(masterGain);

    sparkleOsc.connect(sparkleFilter);
    sparkleFilter.connect(sparkleGain);
    sparkleGain.connect(masterGain);

    brightOsc1.start(currentTime);
    brightOsc2.start(currentTime);
    brightOsc3.start(currentTime);
    sparkleOsc.start(currentTime);

    brightOsc1.stop(currentTime + duration);
    brightOsc2.stop(currentTime + duration);
    brightOsc3.stop(currentTime + duration);
    sparkleOsc.stop(currentTime + duration);

    oscillators.push(brightOsc1, brightOsc2, brightOsc3, sparkleOsc);

    this.addReverb(masterGain, 0.05);
    masterGain.connect(this.masterGain);
    this.trackOscillators(oscillators, "ukulele", frequency);
  }

  // FLUTE: Breathy, airy with noise component
  private playFluteNote(
    frequency: number,
    duration: number,
    velocity: number,
    currentTime: number,
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillators: OscillatorNode[] = [];
    const masterGain = this.audioContext.createGain();

    const fluteOsc = this.audioContext.createOscillator();
    const breathNoise = this.audioContext.createOscillator();
    const airTone = this.audioContext.createOscillator();

    const fluteGain = this.audioContext.createGain();
    const breathGain = this.audioContext.createGain();
    const airGain = this.audioContext.createGain();

    const fluteFilter = this.audioContext.createBiquadFilter();
    const breathFilter = this.audioContext.createBiquadFilter();

    // Pure flute tone
    fluteOsc.type = "sine";
    fluteOsc.frequency.setValueAtTime(frequency, currentTime);

    // Breath noise
    breathNoise.type = "sawtooth";
    breathNoise.frequency.setValueAtTime(frequency * 6.5, currentTime);

    // Air tone
    airTone.type = "triangle";
    airTone.frequency.setValueAtTime(frequency * 2.1, currentTime);

    // Smooth flute filtering
    fluteFilter.type = "lowpass";
    fluteFilter.frequency.setValueAtTime(frequency * 4, currentTime);
    fluteFilter.Q.setValueAtTime(1.5, currentTime);

    // Breath filtering
    breathFilter.type = "bandpass";
    breathFilter.frequency.setValueAtTime(frequency * 8, currentTime);
    breathFilter.Q.setValueAtTime(12, currentTime);

    // Gentle flute envelope
    const fluteVol = Math.max(0.001, velocity * 0.9);
    fluteGain.gain.setValueAtTime(0.001, currentTime);
    fluteGain.gain.exponentialRampToValueAtTime(fluteVol, currentTime + 0.15);
    if (duration > 0.3) {
      fluteGain.gain.setValueAtTime(
        fluteVol * 0.8,
        currentTime + duration - 0.2,
      );
    }
    fluteGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const breathVol = Math.max(0.001, velocity * 0.15);
    breathGain.gain.setValueAtTime(breathVol, currentTime);
    breathGain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.8,
    );

    const airVol = Math.max(0.001, velocity * 0.3);
    airGain.gain.setValueAtTime(airVol, currentTime);
    airGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    fluteOsc.connect(fluteFilter);
    fluteFilter.connect(fluteGain);
    fluteGain.connect(masterGain);

    breathNoise.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(masterGain);

    airTone.connect(airGain);
    airGain.connect(masterGain);

    fluteOsc.start(currentTime);
    breathNoise.start(currentTime);
    airTone.start(currentTime);

    fluteOsc.stop(currentTime + duration);
    breathNoise.stop(currentTime + duration);
    airTone.stop(currentTime + duration);

    oscillators.push(fluteOsc, breathNoise, airTone);

    this.addReverb(masterGain, 0.3);
    masterGain.connect(this.masterGain);
    this.trackOscillators(oscillators, "flute", frequency);
  }

  // PAN FLUTE: Hollow, woody, different from regular flute
  private playPanFluteNote(
    frequency: number,
    duration: number,
    velocity: number,
    currentTime: number,
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillators: OscillatorNode[] = [];
    const masterGain = this.audioContext.createGain();

    // Hollow tube resonance - totally different from flute
    const tube1 = this.audioContext.createOscillator();
    const tube2 = this.audioContext.createOscillator();
    const hollow = this.audioContext.createOscillator();
    const woodAir = this.audioContext.createOscillator();

    const tube1Gain = this.audioContext.createGain();
    const tube2Gain = this.audioContext.createGain();
    const hollowGain = this.audioContext.createGain();
    const woodGain = this.audioContext.createGain();

    const tubeFilter = this.audioContext.createBiquadFilter();
    const hollowFilter = this.audioContext.createBiquadFilter();

    // Multiple tube resonances
    tube1.type = "square";
    tube1.frequency.setValueAtTime(frequency, currentTime);

    tube2.type = "square";
    tube2.frequency.setValueAtTime(frequency * 0.99, currentTime); // Slight detune

    // Hollow resonance
    hollow.type = "triangle";
    hollow.frequency.setValueAtTime(frequency * 0.5, currentTime);

    // Wood/air interaction
    woodAir.type = "sawtooth";
    woodAir.frequency.setValueAtTime(frequency * 4, currentTime);

    // Tube filtering
    tubeFilter.type = "bandpass";
    tubeFilter.frequency.setValueAtTime(frequency * 2, currentTime);
    tubeFilter.Q.setValueAtTime(6, currentTime);

    // Hollow filtering
    hollowFilter.type = "lowpass";
    hollowFilter.frequency.setValueAtTime(frequency * 3, currentTime);
    hollowFilter.Q.setValueAtTime(3, currentTime);

    // Pan flute envelope: Medium attack, woody sustain
    const tube1Vol = Math.max(0.001, velocity * 0.7);
    tube1Gain.gain.setValueAtTime(0.001, currentTime);
    tube1Gain.gain.exponentialRampToValueAtTime(tube1Vol, currentTime + 0.1);
    tube1Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const tube2Vol = Math.max(0.001, velocity * 0.65);
    tube2Gain.gain.setValueAtTime(0.001, currentTime);
    tube2Gain.gain.exponentialRampToValueAtTime(tube2Vol, currentTime + 0.12);
    tube2Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const hollowVol = Math.max(0.001, velocity * 0.4);
    hollowGain.gain.setValueAtTime(0.001, currentTime);
    hollowGain.gain.exponentialRampToValueAtTime(hollowVol, currentTime + 0.05);
    hollowGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const woodVol = Math.max(0.001, velocity * 0.2);
    woodGain.gain.setValueAtTime(woodVol, currentTime);
    woodGain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.6,
    );

    tube1.connect(tubeFilter);
    tubeFilter.connect(tube1Gain);
    tube1Gain.connect(masterGain);

    tube2.connect(tube2Gain);
    tube2Gain.connect(masterGain);

    hollow.connect(hollowFilter);
    hollowFilter.connect(hollowGain);
    hollowGain.connect(masterGain);

    woodAir.connect(woodGain);
    woodGain.connect(masterGain);

    tube1.start(currentTime);
    tube2.start(currentTime);
    hollow.start(currentTime);
    woodAir.start(currentTime);

    tube1.stop(currentTime + duration);
    tube2.stop(currentTime + duration);
    hollow.stop(currentTime + duration);
    woodAir.stop(currentTime + duration);

    oscillators.push(tube1, tube2, hollow, woodAir);

    this.addReverb(masterGain, 0.5); // More reverb than flute
    masterGain.connect(this.masterGain);
    this.trackOscillators(oscillators, "panflute", frequency);
  }

  // RECORDER: Sharp, piercing, schoolroom sound - different from both flutes
  private playRecorderNote(
    frequency: number,
    duration: number,
    velocity: number,
    currentTime: number,
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillators: OscillatorNode[] = [];
    const masterGain = this.audioContext.createGain();

    // Sharp, piercing tone
    const sharp1 = this.audioContext.createOscillator();
    const sharp2 = this.audioContext.createOscillator();
    const sharp3 = this.audioContext.createOscillator();
    const edge = this.audioContext.createOscillator();

    const sharp1Gain = this.audioContext.createGain();
    const sharp2Gain = this.audioContext.createGain();
    const sharp3Gain = this.audioContext.createGain();
    const edgeGain = this.audioContext.createGain();

    const sharpFilter = this.audioContext.createBiquadFilter();
    const edgeFilter = this.audioContext.createBiquadFilter();

    // Sharp harmonics
    sharp1.type = "sawtooth";
    sharp1.frequency.setValueAtTime(frequency, currentTime);

    sharp2.type = "sawtooth";
    sharp2.frequency.setValueAtTime(frequency * 2, currentTime);

    sharp3.type = "sawtooth";
    sharp3.frequency.setValueAtTime(frequency * 3, currentTime);

    // Edge tone
    edge.type = "square";
    edge.frequency.setValueAtTime(frequency * 8, currentTime);

    // Sharp filtering
    sharpFilter.type = "bandpass";
    sharpFilter.frequency.setValueAtTime(frequency * 5, currentTime);
    sharpFilter.Q.setValueAtTime(4, currentTime);

    // Edge filtering
    edgeFilter.type = "highpass";
    edgeFilter.frequency.setValueAtTime(frequency * 6, currentTime);
    edgeFilter.Q.setValueAtTime(8, currentTime);

    // Recorder envelope: Sharp attack, quick to full volume
    const sharp1Vol = Math.max(0.001, velocity * 1.0);
    sharp1Gain.gain.setValueAtTime(0.001, currentTime);
    sharp1Gain.gain.exponentialRampToValueAtTime(sharp1Vol, currentTime + 0.05);
    sharp1Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const sharp2Vol = Math.max(0.001, velocity * 0.6);
    sharp2Gain.gain.setValueAtTime(sharp2Vol, currentTime);
    sharp2Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const sharp3Vol = Math.max(0.001, velocity * 0.4);
    sharp3Gain.gain.setValueAtTime(sharp3Vol, currentTime);
    sharp3Gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    const edgeVol = Math.max(0.001, velocity * 0.3);
    edgeGain.gain.setValueAtTime(edgeVol, currentTime);
    edgeGain.gain.exponentialRampToValueAtTime(
      0.001,
      currentTime + duration * 0.5,
    );

    sharp1.connect(sharpFilter);
    sharpFilter.connect(sharp1Gain);
    sharp1Gain.connect(masterGain);

    sharp2.connect(sharp2Gain);
    sharp2Gain.connect(masterGain);

    sharp3.connect(sharp3Gain);
    sharp3Gain.connect(masterGain);

    edge.connect(edgeFilter);
    edgeFilter.connect(edgeGain);
    edgeGain.connect(masterGain);

    sharp1.start(currentTime);
    sharp2.start(currentTime);
    sharp3.start(currentTime);
    edge.start(currentTime);

    sharp1.stop(currentTime + duration);
    sharp2.stop(currentTime + duration);
    sharp3.stop(currentTime + duration);
    edge.stop(currentTime + duration);

    oscillators.push(sharp1, sharp2, sharp3, edge);

    this.addReverb(masterGain, 0.1); // Very little reverb - dry classroom sound
    masterGain.connect(this.masterGain);
    this.trackOscillators(oscillators, "recorder", frequency);
  }

  // Generic fallback
  private playGenericNote(
    frequency: number,
    duration: number,
    velocity: number,
    currentTime: number,
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillators: OscillatorNode[] = [];
    const masterGain = this.audioContext.createGain();

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, currentTime);

    const volume = Math.max(0.001, velocity * 0.5);
    gain.gain.setValueAtTime(volume, currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(currentTime);
    osc.stop(currentTime + duration);

    oscillators.push(osc);

    this.addReverb(masterGain, 0.2);
    masterGain.connect(this.masterGain);
    this.trackOscillators(oscillators, "generic", frequency);
  }

  playFrequency(
    frequency: number,
    duration: number = 0.5,
    velocity: number = 0.7,
  ): void {
    this.playNote(frequency, duration, velocity, "piano", true);
  }

  private trackOscillators(
    oscillators: OscillatorNode[],
    instrument: string,
    frequency: number,
  ): void {
    const data: OscillatorData[] = oscillators.map((osc) => ({
      oscillator: osc,
      gain: this.audioContext!.createGain(),
      instrument,
      frequency,
      startTime: this.audioContext!.currentTime,
    }));

    if (!this.activeOscillators.has(instrument)) {
      this.activeOscillators.set(instrument, []);
    }
    this.activeOscillators.get(instrument)!.push(...data);
  }

  // Drum methods remain the same
  playDrum(
    type:
      | "kick"
      | "snare"
      | "hihat"
      | "openhat"
      | "crash"
      | "ride"
      | "clap"
      | "tom",
    velocity: number = 0.7,
  ): void {
    if (!this.audioContext || !this.masterGain) return;

    const currentTime = this.audioContext.currentTime;

    switch (type) {
      case "kick":
        this.playKick(currentTime, velocity);
        break;
      case "snare":
        this.playSnare(currentTime, velocity);
        break;
      case "hihat":
        this.playHihat(currentTime, velocity, false);
        break;
      case "openhat":
        this.playHihat(currentTime, velocity, true);
        break;
      case "crash":
        this.playCrash(currentTime, velocity);
        break;
      case "ride":
        this.playRide(currentTime, velocity);
        break;
      case "clap":
        this.playClap(currentTime, velocity);
        break;
      case "tom":
        this.playTom(currentTime, velocity);
        break;
    }
  }

  private playKick(currentTime: number, velocity: number): void {
    if (!this.audioContext || !this.masterGain) return;

    try {
      // PROFESSIONAL 808-STYLE KICK DRUM - Deep, punchy, realistic
      const kickOsc = this.audioContext.createOscillator();
      const subKick = this.audioContext.createOscillator();
      const clickOsc = this.audioContext.createOscillator();
      const noiseSource = this.audioContext.createBufferSource();

      const kickGain = this.audioContext.createGain();
      const subGain = this.audioContext.createGain();
      const clickGain = this.audioContext.createGain();
      const noiseGain = this.audioContext.createGain();

      const kickFilter = this.audioContext.createBiquadFilter();
      const subFilter = this.audioContext.createBiquadFilter();
      const clickFilter = this.audioContext.createBiquadFilter();
      const noiseFilter = this.audioContext.createBiquadFilter();

      // Main kick fundamental - deep sine wave with pitch sweep
      kickOsc.type = "sine";
      kickOsc.frequency.setValueAtTime(60, currentTime);
      kickOsc.frequency.exponentialRampToValueAtTime(45, currentTime + 0.05);
      kickOsc.frequency.exponentialRampToValueAtTime(30, currentTime + 0.2);

      // Sub bass component - even deeper
      subKick.type = "sine";
      subKick.frequency.setValueAtTime(35, currentTime);
      subKick.frequency.exponentialRampToValueAtTime(25, currentTime + 0.15);

      // Beater click/attack
      clickOsc.type = "square";
      clickOsc.frequency.setValueAtTime(800, currentTime);
      clickOsc.frequency.exponentialRampToValueAtTime(200, currentTime + 0.02);

      // Realistic kick noise (beater hitting drumhead)
      const noiseLength = Math.floor(this.audioContext.sampleRate * 0.08);
      const noiseBuffer = this.audioContext.createBuffer(
        1,
        noiseLength,
        this.audioContext.sampleRate,
      );
      const noiseData = noiseBuffer.getChannelData(0);

      for (let i = 0; i < noiseLength; i++) {
        const envelope = Math.pow(1 - i / noiseLength, 4);
        noiseData[i] = (Math.random() * 2 - 1) * envelope * 0.8;
      }
      noiseSource.buffer = noiseBuffer;

      // Professional filtering
      kickFilter.type = "lowpass";
      kickFilter.frequency.setValueAtTime(100, currentTime);
      kickFilter.Q.setValueAtTime(1.2, currentTime);

      subFilter.type = "lowpass";
      subFilter.frequency.setValueAtTime(60, currentTime);
      subFilter.Q.setValueAtTime(0.8, currentTime);

      clickFilter.type = "bandpass";
      clickFilter.frequency.setValueAtTime(1500, currentTime);
      clickFilter.Q.setValueAtTime(3, currentTime);

      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(800, currentTime);
      noiseFilter.Q.setValueAtTime(2, currentTime);

      // Realistic kick envelope - punchy attack, controlled decay
      const kickVol = Math.max(0.001, velocity * 1.0);
      kickGain.gain.setValueAtTime(kickVol, currentTime);
      kickGain.gain.exponentialRampToValueAtTime(
        kickVol * 0.7,
        currentTime + 0.05,
      );
      kickGain.gain.exponentialRampToValueAtTime(
        kickVol * 0.3,
        currentTime + 0.15,
      );
      kickGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.5);

      // Sub bass envelope - longer sustain for body
      const subVol = Math.max(0.001, velocity * 0.8);
      subGain.gain.setValueAtTime(subVol, currentTime);
      subGain.gain.exponentialRampToValueAtTime(
        subVol * 0.6,
        currentTime + 0.08,
      );
      subGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.4);

      // Click envelope - sharp attack
      const clickVol = Math.max(0.001, velocity * 0.4);
      clickGain.gain.setValueAtTime(clickVol, currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.025);

      // Noise envelope - very brief attack texture
      const noiseVol = Math.max(0.001, velocity * 0.6);
      noiseGain.gain.setValueAtTime(noiseVol, currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.08);

      // Connect all components
      kickOsc.connect(kickFilter);
      kickFilter.connect(kickGain);
      kickGain.connect(this.masterGain);

      subKick.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(this.masterGain);

      clickOsc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(this.masterGain);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      // Start all components
      kickOsc.start(currentTime);
      subKick.start(currentTime);
      clickOsc.start(currentTime);
      noiseSource.start(currentTime);

      // Stop all components
      kickOsc.stop(currentTime + 0.5);
      subKick.stop(currentTime + 0.4);
      clickOsc.stop(currentTime + 0.025);
    } catch (error) {
      console.error("🎵 Kick drum error:", error);
    }
  }

  private playSnare(currentTime: number, velocity: number): void {
    if (!this.audioContext || !this.masterGain) return;

    try {
      // REALISTIC SNARE DRUM - Multiple layers for authentic sound
      const snareNoise = this.audioContext.createBufferSource();
      const snareBody = this.audioContext.createOscillator();
      const snareRattle = this.audioContext.createBufferSource();
      const snareAttack = this.audioContext.createOscillator();

      const noiseGain = this.audioContext.createGain();
      const bodyGain = this.audioContext.createGain();
      const rattleGain = this.audioContext.createGain();
      const attackGain = this.audioContext.createGain();

      const noiseFilter = this.audioContext.createBiquadFilter();
      const bodyFilter = this.audioContext.createBiquadFilter();
      const rattleFilter = this.audioContext.createBiquadFilter();
      const attackFilter = this.audioContext.createBiquadFilter();

      // Main snare noise (snares buzzing)
      const noiseLength = Math.floor(this.audioContext.sampleRate * 0.15);
      const noiseBuffer = this.audioContext.createBuffer(
        1,
        noiseLength,
        this.audioContext.sampleRate,
      );
      const noiseData = noiseBuffer.getChannelData(0);

      for (let i = 0; i < noiseLength; i++) {
        const envelope = Math.pow(1 - i / noiseLength, 1.5);
        const freq = 8000 + Math.sin(i * 0.02) * 2000; // Varying frequency content
        noiseData[i] = (Math.random() * 2 - 1) * envelope * 0.9;
      }
      snareNoise.buffer = noiseBuffer;

      // Snare body tone (drum shell resonance)
      snareBody.type = "triangle";
      snareBody.frequency.setValueAtTime(220, currentTime);
      snareBody.frequency.exponentialRampToValueAtTime(160, currentTime + 0.1);

      // Snare rattle (wire snares)
      const rattleLength = Math.floor(this.audioContext.sampleRate * 0.12);
      const rattleBuffer = this.audioContext.createBuffer(
        1,
        rattleLength,
        this.audioContext.sampleRate,
      );
      const rattleData = rattleBuffer.getChannelData(0);

      for (let i = 0; i < rattleLength; i++) {
        const envelope = Math.pow(1 - i / rattleLength, 2.5);
        // High-frequency metallic rattle
        rattleData[i] = (Math.random() * 2 - 1) * envelope * 0.7;
      }
      snareRattle.buffer = rattleBuffer;

      // Sharp attack transient
      snareAttack.type = "square";
      snareAttack.frequency.setValueAtTime(1500, currentTime);
      snareAttack.frequency.exponentialRampToValueAtTime(
        800,
        currentTime + 0.01,
      );

      // Professional filtering for each layer
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(4000, currentTime);
      noiseFilter.Q.setValueAtTime(1.8, currentTime);

      bodyFilter.type = "lowpass";
      bodyFilter.frequency.setValueAtTime(800, currentTime);
      bodyFilter.Q.setValueAtTime(2, currentTime);

      rattleFilter.type = "highpass";
      rattleFilter.frequency.setValueAtTime(6000, currentTime);
      rattleFilter.Q.setValueAtTime(1.5, currentTime);

      attackFilter.type = "bandpass";
      attackFilter.frequency.setValueAtTime(2500, currentTime);
      attackFilter.Q.setValueAtTime(4, currentTime);

      // Realistic snare envelopes
      const noiseVol = Math.max(0.001, velocity * 1.1);
      noiseGain.gain.setValueAtTime(noiseVol, currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(
        noiseVol * 0.4,
        currentTime + 0.02,
      );
      noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.15);

      const bodyVol = Math.max(0.001, velocity * 0.7);
      bodyGain.gain.setValueAtTime(bodyVol, currentTime);
      bodyGain.gain.exponentialRampToValueAtTime(
        bodyVol * 0.3,
        currentTime + 0.05,
      );
      bodyGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.12);

      const rattleVol = Math.max(0.001, velocity * 0.8);
      rattleGain.gain.setValueAtTime(rattleVol, currentTime);
      rattleGain.gain.exponentialRampToValueAtTime(
        rattleVol * 0.2,
        currentTime + 0.03,
      );
      rattleGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.12);

      const attackVol = Math.max(0.001, velocity * 0.6);
      attackGain.gain.setValueAtTime(attackVol, currentTime);
      attackGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.015);

      // Connect all layers
      snareNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      snareBody.connect(bodyFilter);
      bodyFilter.connect(bodyGain);
      bodyGain.connect(this.masterGain);

      snareRattle.connect(rattleFilter);
      rattleFilter.connect(rattleGain);
      rattleGain.connect(this.masterGain);

      snareAttack.connect(attackFilter);
      attackFilter.connect(attackGain);
      attackGain.connect(this.masterGain);

      // Start all components
      snareNoise.start(currentTime);
      snareBody.start(currentTime);
      snareRattle.start(currentTime);
      snareAttack.start(currentTime);

      // Stop components
      snareBody.stop(currentTime + 0.12);
      snareAttack.stop(currentTime + 0.015);
    } catch (error) {
      console.error("🎵 Snare drum error:", error);
    }
  }

  private playHihat(
    currentTime: number,
    velocity: number,
    open: boolean = false,
  ): void {
    if (!this.audioContext || !this.masterGain) return;

    try {
      // REALISTIC HI-HAT - Multiple metallic layers
      const metallicNoise = this.audioContext.createBufferSource();
      const toneOsc1 = this.audioContext.createOscillator();
      const toneOsc2 = this.audioContext.createOscillator();
      const shimmerOsc = this.audioContext.createOscillator();

      const noiseGain = this.audioContext.createGain();
      const tone1Gain = this.audioContext.createGain();
      const tone2Gain = this.audioContext.createGain();
      const shimmerGain = this.audioContext.createGain();

      const metallicFilter = this.audioContext.createBiquadFilter();
      const toneFilter = this.audioContext.createBiquadFilter();
      const shimmerFilter = this.audioContext.createBiquadFilter();

      const duration = open ? 0.35 : 0.08;

      // Realistic metallic noise with harmonic content
      const noiseLength = Math.floor(this.audioContext.sampleRate * duration);
      const noiseBuffer = this.audioContext.createBuffer(
        1,
        noiseLength,
        this.audioContext.sampleRate,
      );
      const noiseData = noiseBuffer.getChannelData(0);

      for (let i = 0; i < noiseLength; i++) {
        const envelope = open
          ? Math.pow(1 - i / noiseLength, 0.6)
          : Math.pow(1 - i / noiseLength, 3);

        // Create metallic timbre with multiple frequency components
        const metallic1 = Math.sin(i * 0.8) * 0.3;
        const metallic2 = Math.sin(i * 1.2) * 0.2;
        const metallic3 = Math.sin(i * 2.1) * 0.1;
        const noise = (Math.random() * 2 - 1) * 0.4;

        noiseData[i] = (noise + metallic1 + metallic2 + metallic3) * envelope;
      }
      metallicNoise.buffer = noiseBuffer;

      // Metallic tones for realism
      toneOsc1.type = "square";
      toneOsc1.frequency.setValueAtTime(8500, currentTime);
      toneOsc1.frequency.exponentialRampToValueAtTime(
        7200,
        currentTime + duration * 0.3,
      );

      toneOsc2.type = "sawtooth";
      toneOsc2.frequency.setValueAtTime(11200, currentTime);
      toneOsc2.frequency.exponentialRampToValueAtTime(
        9800,
        currentTime + duration * 0.4,
      );

      // High-frequency shimmer
      shimmerOsc.type = "sine";
      shimmerOsc.frequency.setValueAtTime(13500, currentTime);

      // Professional filtering
      metallicFilter.type = "bandpass";
      metallicFilter.frequency.setValueAtTime(8000, currentTime);
      metallicFilter.Q.setValueAtTime(1.2, currentTime);

      toneFilter.type = "highpass";
      toneFilter.frequency.setValueAtTime(6000, currentTime);
      toneFilter.Q.setValueAtTime(0.8, currentTime);

      shimmerFilter.type = "bandpass";
      shimmerFilter.frequency.setValueAtTime(12000, currentTime);
      shimmerFilter.Q.setValueAtTime(3, currentTime);

      // Realistic hi-hat envelopes
      const noiseVol = Math.max(0.001, velocity * (open ? 0.6 : 0.8));
      noiseGain.gain.setValueAtTime(noiseVol, currentTime);
      if (open) {
        noiseGain.gain.exponentialRampToValueAtTime(
          noiseVol * 0.7,
          currentTime + 0.05,
        );
        noiseGain.gain.exponentialRampToValueAtTime(
          noiseVol * 0.3,
          currentTime + 0.15,
        );
        noiseGain.gain.exponentialRampToValueAtTime(
          0.001,
          currentTime + duration,
        );
      } else {
        noiseGain.gain.exponentialRampToValueAtTime(
          noiseVol * 0.3,
          currentTime + 0.02,
        );
        noiseGain.gain.exponentialRampToValueAtTime(
          0.001,
          currentTime + duration,
        );
      }

      const tone1Vol = Math.max(0.001, velocity * 0.4);
      tone1Gain.gain.setValueAtTime(tone1Vol, currentTime);
      tone1Gain.gain.exponentialRampToValueAtTime(
        0.001,
        currentTime + duration * (open ? 0.7 : 0.5),
      );

      const tone2Vol = Math.max(0.001, velocity * 0.35);
      tone2Gain.gain.setValueAtTime(tone2Vol, currentTime);
      tone2Gain.gain.exponentialRampToValueAtTime(
        0.001,
        currentTime + duration * (open ? 0.6 : 0.4),
      );

      const shimmerVol = Math.max(0.001, velocity * 0.25);
      shimmerGain.gain.setValueAtTime(shimmerVol, currentTime);
      shimmerGain.gain.exponentialRampToValueAtTime(
        0.001,
        currentTime + duration * (open ? 0.8 : 0.3),
      );

      // Connect all components
      metallicNoise.connect(metallicFilter);
      metallicFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      toneOsc1.connect(toneFilter);
      toneFilter.connect(tone1Gain);
      tone1Gain.connect(this.masterGain);

      toneOsc2.connect(tone2Gain);
      tone2Gain.connect(this.masterGain);

      shimmerOsc.connect(shimmerFilter);
      shimmerFilter.connect(shimmerGain);
      shimmerGain.connect(this.masterGain);

      // Start all components
      metallicNoise.start(currentTime);
      toneOsc1.start(currentTime);
      toneOsc2.start(currentTime);
      shimmerOsc.start(currentTime);

      // Stop components
      toneOsc1.stop(currentTime + duration);
      toneOsc2.stop(currentTime + duration);
      shimmerOsc.stop(currentTime + duration);
    } catch (error) {
      console.error("🎵 Hi-hat error:", error);
    }
  }

  private playCrash(currentTime: number, velocity: number): void {
    if (!this.audioContext || !this.masterGain) return;

    try {
      // ISOLATED CRASH CYMBAL - Explosive metallic crash
      const crashNoise = this.audioContext.createBufferSource();
      const crashGain = this.audioContext.createGain();
      const crashFilter = this.audioContext.createBiquadFilter();

      const crashBufferSize = this.audioContext.sampleRate * 2.5;
      const crashBuffer = this.audioContext.createBuffer(
        2,
        crashBufferSize,
        this.audioContext.sampleRate,
      );

      for (let crashChannel = 0; crashChannel < 2; crashChannel++) {
        const crashData = crashBuffer.getChannelData(crashChannel);
        for (let i = 0; i < crashBufferSize; i++) {
          crashData[i] =
            (Math.random() * 2 - 1) * (1 - i / crashBufferSize) * 0.6;
        }
      }

      crashNoise.buffer = crashBuffer;

      crashFilter.type = "highpass";
      crashFilter.frequency.setValueAtTime(4000, currentTime);
      crashFilter.Q.setValueAtTime(1.5, currentTime);

      const crashVol = Math.max(0.001, velocity * 0.9);
      crashGain.gain.setValueAtTime(crashVol, currentTime);
      crashGain.gain.exponentialRampToValueAtTime(
        crashVol * 0.4,
        currentTime + 0.1,
      );
      crashGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 2.5);

      crashNoise.connect(crashFilter);
      crashFilter.connect(crashGain);
      crashGain.connect(this.masterGain);

      crashNoise.start(currentTime);
    } catch (error) {
      console.error("Crash cymbal error:", error);
    }
  }

  private playRide(currentTime: number, velocity: number): void {
    if (!this.audioContext || !this.masterGain) return;

    try {
      // ISOLATED RIDE CYMBAL - Smooth metallic ride
      const rideOsc1 = this.audioContext.createOscillator();
      const rideOsc2 = this.audioContext.createOscillator();
      const rideNoise = this.audioContext.createBufferSource();
      const rideGain = this.audioContext.createGain();
      const rideFilter = this.audioContext.createBiquadFilter();

      rideOsc1.type = "triangle";
      rideOsc1.frequency.setValueAtTime(850, currentTime);

      rideOsc2.type = "sine";
      rideOsc2.frequency.setValueAtTime(1300, currentTime);

      const rideBufferSize = this.audioContext.sampleRate * 0.35;
      const rideBuffer = this.audioContext.createBuffer(
        1,
        rideBufferSize,
        this.audioContext.sampleRate,
      );
      const rideData = rideBuffer.getChannelData(0);

      for (let i = 0; i < rideBufferSize; i++) {
        rideData[i] = (Math.random() * 2 - 1) * (1 - i / rideBufferSize) * 0.12;
      }

      rideNoise.buffer = rideBuffer;

      rideFilter.type = "highpass";
      rideFilter.frequency.setValueAtTime(2800, currentTime);
      rideFilter.Q.setValueAtTime(2.5, currentTime);

      const rideVol = Math.max(0.001, velocity * 0.7);
      rideGain.gain.setValueAtTime(rideVol, currentTime);
      rideGain.gain.exponentialRampToValueAtTime(
        rideVol * 0.6,
        currentTime + 0.05,
      );
      rideGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 1.5);

      rideOsc1.connect(rideFilter);
      rideOsc2.connect(rideFilter);
      rideNoise.connect(rideFilter);
      rideFilter.connect(rideGain);
      rideGain.connect(this.masterGain);

      rideOsc1.start(currentTime);
      rideOsc2.start(currentTime);
      rideNoise.start(currentTime);
      rideOsc1.stop(currentTime + 1.5);
      rideOsc2.stop(currentTime + 1.5);
    } catch (error) {
      console.error("Ride cymbal error:", error);
    }
  }

  private playClap(currentTime: number, velocity: number): void {
    if (!this.audioContext || !this.masterGain) return;

    try {
      // ISOLATED CLAP - Multiple burst layers
      for (let clapBurst = 0; clapBurst < 4; clapBurst++) {
        const clapDelay = clapBurst * 0.01;
        const clapNoise = this.audioContext.createBufferSource();
        const clapGain = this.audioContext.createGain();
        const clapFilter = this.audioContext.createBiquadFilter();

        const clapBufferSize = this.audioContext.sampleRate * 0.15;
        const clapBuffer = this.audioContext.createBuffer(
          1,
          clapBufferSize,
          this.audioContext.sampleRate,
        );
        const clapData = clapBuffer.getChannelData(0);

        for (let j = 0; j < clapBufferSize; j++) {
          clapData[j] =
            (Math.random() * 2 - 1) * (1 - j / clapBufferSize) * 0.85;
        }

        clapNoise.buffer = clapBuffer;

        clapFilter.type = "bandpass";
        clapFilter.frequency.setValueAtTime(
          1400 + clapBurst * 250,
          currentTime,
        );
        clapFilter.Q.setValueAtTime(9, currentTime);

        const clapBurstGain = Math.max(
          0.001,
          velocity * (0.9 - clapBurst * 0.15),
        );
        clapGain.gain.setValueAtTime(clapBurstGain, currentTime + clapDelay);
        clapGain.gain.exponentialRampToValueAtTime(
          0.001,
          currentTime + clapDelay + 0.12,
        );

        clapNoise.connect(clapFilter);
        clapFilter.connect(clapGain);
        clapGain.connect(this.masterGain);

        clapNoise.start(currentTime + clapDelay);
      }
    } catch (error) {
      console.error("Clap error:", error);
    }
  }

  private playTom(currentTime: number, velocity: number): void {
    if (!this.audioContext || !this.masterGain) return;

    try {
      // REALISTIC TOM DRUM - Multiple resonance layers
      const tomFundamental = this.audioContext.createOscillator();
      const tomHarmonic = this.audioContext.createOscillator();
      const tomAttack = this.audioContext.createOscillator();
      const tomNoise = this.audioContext.createBufferSource();

      const fundGain = this.audioContext.createGain();
      const harmGain = this.audioContext.createGain();
      const attackGain = this.audioContext.createGain();
      const noiseGain = this.audioContext.createGain();

      const fundFilter = this.audioContext.createBiquadFilter();
      const harmFilter = this.audioContext.createBiquadFilter();
      const attackFilter = this.audioContext.createBiquadFilter();
      const noiseFilter = this.audioContext.createBiquadFilter();

      // Tom fundamental with realistic pitch bend
      tomFundamental.type = "sine";
      tomFundamental.frequency.setValueAtTime(110, currentTime);
      tomFundamental.frequency.exponentialRampToValueAtTime(
        85,
        currentTime + 0.1,
      );
      tomFundamental.frequency.exponentialRampToValueAtTime(
        75,
        currentTime + 0.25,
      );

      // Harmonic overtone
      tomHarmonic.type = "triangle";
      tomHarmonic.frequency.setValueAtTime(165, currentTime); // 1.5x fundamental
      tomHarmonic.frequency.exponentialRampToValueAtTime(
        127,
        currentTime + 0.1,
      );
      tomHarmonic.frequency.exponentialRampToValueAtTime(
        112,
        currentTime + 0.25,
      );

      // Attack transient
      tomAttack.type = "square";
      tomAttack.frequency.setValueAtTime(400, currentTime);
      tomAttack.frequency.exponentialRampToValueAtTime(200, currentTime + 0.02);

      // Tom stick attack noise
      const noiseLength = Math.floor(this.audioContext.sampleRate * 0.05);
      const noiseBuffer = this.audioContext.createBuffer(
        1,
        noiseLength,
        this.audioContext.sampleRate,
      );
      const noiseData = noiseBuffer.getChannelData(0);

      for (let i = 0; i < noiseLength; i++) {
        const envelope = Math.pow(1 - i / noiseLength, 6);
        noiseData[i] = (Math.random() * 2 - 1) * envelope * 0.5;
      }
      tomNoise.buffer = noiseBuffer;

      // Professional tom filtering
      fundFilter.type = "lowpass";
      fundFilter.frequency.setValueAtTime(400, currentTime);
      fundFilter.Q.setValueAtTime(2.5, currentTime);

      harmFilter.type = "bandpass";
      harmFilter.frequency.setValueAtTime(800, currentTime);
      harmFilter.Q.setValueAtTime(1.8, currentTime);

      attackFilter.type = "bandpass";
      attackFilter.frequency.setValueAtTime(1200, currentTime);
      attackFilter.Q.setValueAtTime(3, currentTime);

      noiseFilter.type = "highpass";
      noiseFilter.frequency.setValueAtTime(2000, currentTime);
      noiseFilter.Q.setValueAtTime(1, currentTime);

      // Realistic tom envelopes
      const fundVol = Math.max(0.001, velocity * 1.0);
      fundGain.gain.setValueAtTime(fundVol, currentTime);
      fundGain.gain.exponentialRampToValueAtTime(
        fundVol * 0.7,
        currentTime + 0.05,
      );
      fundGain.gain.exponentialRampToValueAtTime(
        fundVol * 0.3,
        currentTime + 0.15,
      );
      fundGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.45);

      const harmVol = Math.max(0.001, velocity * 0.6);
      harmGain.gain.setValueAtTime(harmVol, currentTime);
      harmGain.gain.exponentialRampToValueAtTime(
        harmVol * 0.4,
        currentTime + 0.08,
      );
      harmGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.35);

      const attackVol = Math.max(0.001, velocity * 0.4);
      attackGain.gain.setValueAtTime(attackVol, currentTime);
      attackGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.025);

      const noiseVol = Math.max(0.001, velocity * 0.5);
      noiseGain.gain.setValueAtTime(noiseVol, currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.05);

      // Connect all components
      tomFundamental.connect(fundFilter);
      fundFilter.connect(fundGain);
      fundGain.connect(this.masterGain);

      tomHarmonic.connect(harmFilter);
      harmFilter.connect(harmGain);
      harmGain.connect(this.masterGain);

      tomAttack.connect(attackFilter);
      attackFilter.connect(attackGain);
      attackGain.connect(this.masterGain);

      tomNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      // Start all components
      tomFundamental.start(currentTime);
      tomHarmonic.start(currentTime);
      tomAttack.start(currentTime);
      tomNoise.start(currentTime);

      // Stop components
      tomFundamental.stop(currentTime + 0.45);
      tomHarmonic.stop(currentTime + 0.35);
      tomAttack.stop(currentTime + 0.025);
    } catch (error) {
      console.error("🎵 Tom drum error:", error);
    }
  }

  stopAllInstruments(): void {
    this.activeOscillators.forEach((oscillators, instrument) => {
      oscillators.forEach((oscData) => {
        try {
          oscData.oscillator.stop();
        } catch (error) {
          // Oscillator may already be stopped
        }
      });
    });
    this.activeOscillators.clear();
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(
        Math.max(0, Math.min(1, volume)),
        this.audioContext!.currentTime,
      );
    }
  }
}

// Export singleton instance
export const audioEngine = new AudioEngine();

// Version-2 Style Audio Manager for Sequencer with Output CO Producer Features
class AudioManager {
  private initialized = false;
  private sequence?: Tone.Sequence;
  private drums: { [key: string]: any } = {};

  async initialize() {
    if (this.initialized) return;

    await Tone.start();
    console.log("Tone.js audio context started");

    // Initialize Output CO Producer-style multi-layered drum synthesis
    this.drums = {
      kick: new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 10,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
      }).toDestination(),
      snare: new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
      }).toDestination(),
      hhc: new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
        harmonicity: 8,
        modulationIndex: 40,
        resonance: 6000,
        octaves: 2,
      }).toDestination(),
      hho: new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
        harmonicity: 8,
        modulationIndex: 40,
        resonance: 6000,
        octaves: 2,
      }).toDestination(),
      crash: new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 2, release: 0.5 },
        harmonicity: 12,
        modulationIndex: 80,
        resonance: 8000,
        octaves: 3,
      }).toDestination(),
      clap: new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      }).toDestination(),
      tom: new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 4,
        oscillator: { type: "sine" },
        envelope: { attack: 0.006, decay: 0.5, sustain: 0 },
      }).toDestination(),
      perc: new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.2, release: 0.1 },
        harmonicity: 6,
        modulationIndex: 20,
        resonance: 4000,
        octaves: 1.5,
      }).toDestination(),
    };

    this.initialized = true;
  }

  setBpm(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  async playSequencer(state: SequencerState) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.stop();
    Tone.Transport.bpm.value = state.bpm;

    const totalSteps = state.bars * state.stepsPerBar;
    const stepTime = `${state.stepsPerBar}n`;

    this.sequence = new Tone.Sequence(
      (time, step) => {
        state.tracks.forEach((track) => {
          if ((track as any).muted) return;

          track.clips.forEach((clip) => {
            const localStep = step - clip.start;
            if (localStep >= 0 && localStep < clip.length) {
              const stepData = clip.steps[localStep];
              if (stepData?.active && this.drums[track.id]) {
                const velocity = stepData.velocity || 1;

                // Output CO Producer-style triggering with velocity sensitivity
                const drumSynth = this.drums[track.id];
                if (drumSynth) {
                  if (track.id === "kick" || track.id.startsWith("tom")) {
                    drumSynth.triggerAttackRelease("C1", "16n", time, velocity);
                  } else {
                    drumSynth.triggerAttackRelease("16n", time, velocity);
                  }
                }
              }
            }
          });
        });
      },
      Array.from({ length: totalSteps }, (_, i) => i),
      stepTime,
    );

    this.sequence.start();
    Tone.Transport.start();
  }

  async playBeat(
    pattern: any,
    samples: string[] = ["kick", "snare", "hihat"],
    bpm: number,
  ) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.stop();
    Tone.Transport.bpm.value = bpm;

    // Convert old pattern format to new format if needed
    if (Array.isArray(pattern)) {
      // Simple array pattern
      this.sequence = new Tone.Sequence(
        (time, step) => {
          if (pattern[step] && this.drums.kick) {
            this.drums.kick.triggerAttackRelease("C1", "16n", time);
          }
        },
        Array.from({ length: pattern.length }, (_, i) => i),
        "16n",
      );
    } else if (pattern.kick || pattern.snare || pattern.hihat) {
      // Multi-track pattern with Output CO Producer-style layering
      this.sequence = new Tone.Sequence(
        (time, step) => {
          if (pattern.kick?.[step] && this.drums.kick) {
            this.drums.kick.triggerAttackRelease("C1", "16n", time);
          }
          if (pattern.snare?.[step] && this.drums.snare) {
            this.drums.snare.triggerAttackRelease("16n", time);
          }
          if (pattern.hihat?.[step] && this.drums.hhc) {
            this.drums.hhc.triggerAttackRelease("16n", time);
          }
          if (pattern.openhat?.[step] && this.drums.hho) {
            this.drums.hho.triggerAttackRelease("16n", time);
          }
          if (pattern.crash?.[step] && this.drums.crash) {
            this.drums.crash.triggerAttackRelease("16n", time);
          }
          if (pattern.clap?.[step] && this.drums.clap) {
            this.drums.clap.triggerAttackRelease("16n", time);
          }
          if (pattern.tom?.[step] && this.drums.tom) {
            this.drums.tom.triggerAttackRelease("C2", "16n", time);
          }
        },
        Array.from({ length: 16 }, (_, i) => i),
        "16n",
      );
    }

    if (this.sequence) {
      this.sequence.start();
      Tone.Transport.start();
    }
  }

  stop() {
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
      this.sequence = undefined;
    }
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }

  dispose() {
    this.stop();
    Object.values(this.drums).forEach((drum) => drum.dispose());
    this.drums = {};
    this.initialized = false;
  }
}

export const audioManager = new AudioManager();
