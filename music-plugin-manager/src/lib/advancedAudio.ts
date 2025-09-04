import * as Tone from "tone";

export type TrackId =
  | "kick"
  | "snare"
  | "hhc" // hi-hat closed
  | "hho" // hi-hat open
  | "tom1"
  | "tom2"
  | "tom3"
  | "ride"
  | "crash";

export interface SequencerState {
  bpm: number;
  swing: number;
  bars: number;
  stepsPerBar: number;
  loopStart: number;
  loopEnd: number;
  tracks: SequencerTrack[];
}

export interface SequencerTrack {
  id: TrackId;
  name: string;
  clips: Clip[];
  mute?: boolean;
  solo?: boolean;
  volume?: number;
  pan?: number;
}

export interface Clip {
  id: string;
  start: number;
  length: number;
  steps: Step[];
  name?: string;
}

export interface Step {
  active: boolean;
  velocity?: number;
}

export class AdvancedAudioManager {
  private synth: Tone.Synth | null = null;
  private drumKit: { [key: string]: any };
  private isInitialized = false;
  private currentSequence: Tone.Sequence | null = null;
  private trackInstruments: Partial<Record<TrackId, any>> = {};

  constructor() {
    this.drumKit = {};
  }

  async playSequencer(state: SequencerState) {
    await this.initialize();
    try {
      // Stop any existing sequence
      if (this.currentSequence) {
        this.currentSequence.stop();
        this.currentSequence.dispose();
      }

      this.setBpm(state.bpm);

      const totalSteps = state.bars * state.stepsPerBar;

      // Build step activation map per track for the whole timeline
      const stepMap: Partial<Record<TrackId, boolean[]>> = {};
      for (const track of state.tracks) {
        const arr = Array<boolean>(totalSteps).fill(false);
        for (const clip of track.clips) {
          for (let i = 0; i < clip.length; i++) {
            const globalStep = clip.start + i;
            if (globalStep >= 0 && globalStep < totalSteps) {
              arr[globalStep] = arr[globalStep] || !!clip.steps[i]?.active;
            }
          }
        }
        stepMap[track.id as TrackId] = arr;
      }

      const indices = Array.from({ length: totalSteps }, (_, i) => i);
      this.currentSequence = new Tone.Sequence(
        (time, stepIndex: number) => {
          // Determine if any solo is active
          const anySolo = state.tracks.some((t) => t.solo);

          for (const t of state.tracks) {
            const id = t.id as TrackId;
            const active = stepMap[id]?.[stepIndex];
            if (!active) continue;
            if (t.mute) continue;
            if (anySolo && !t.solo) continue;

            const inst = this.trackInstruments[id] || this.drumKit.hihat;

            // Play AI-generated patterns with dynamic parameters
            // TODO: Replace with AI composition data - no hardcoded drum sounds
            const aiPattern = this.getAIPatternForInstrument(id, stepIndex);

            if (aiPattern) {
              inst.triggerAttackRelease(
                aiPattern.note || this.getDefaultNote(id),
                aiPattern.duration || this.getDefaultDuration(id),
                time,
                aiPattern.velocity || 0.8,
              );
            } else {
              // Temporary fallback - should be replaced with AI data
              this.triggerHardcodedPattern(id, inst, time);
            }
          }
        },
        indices,
        "16n",
      );

      this.currentSequence.loop = true;
      this.currentSequence.start(0);
      Tone.Transport.start();
    } catch (error) {
      console.warn("Failed to play sequencer:", error);
    }
  }

  // AI Pattern Methods - Replace hardcoded with AI data
  private getAIPatternForInstrument(
    instrumentId: string,
    stepIndex: number,
  ): any {
    // TODO: Connect to AI composition data from professionalAudio.ts
    // For now return null to use temporary fallback
    return null;
  }

  private getDefaultNote(instrumentId: string): string | number {
    const noteMap: { [key: string]: string | number } = {
      kick: "C1",
      snare: "8n",
      hhc: 220,
      hho: 200,
      tom1: "G1",
      tom2: "F1",
      tom3: "D1",
      ride: 260,
      crash: 220,
    };
    return noteMap[instrumentId] || 220;
  }

  private getDefaultDuration(instrumentId: string): string {
    const durationMap: { [key: string]: string } = {
      kick: "8n",
      snare: "8n",
      hhc: "16n",
      hho: "8n",
      tom1: "8n",
      tom2: "8n",
      tom3: "8n",
      ride: "4n",
      crash: "2n",
    };
    return durationMap[instrumentId] || "16n";
  }

  private triggerHardcodedPattern(id: string, inst: any, time: number): void {
    // Temporary hardcoded patterns - MUST be replaced with AI data
    switch (id) {
      case "kick":
        inst.triggerAttackRelease("C1", "8n", time);
        break;
      case "snare":
        inst.triggerAttackRelease("8n", time);
        break;
      case "hhc":
        inst.triggerAttackRelease(220, "16n", time, 0.9);
        break;
      case "hho":
        inst.triggerAttackRelease(200, "8n", time, 0.9);
        break;
      case "tom1":
        inst.triggerAttackRelease("G1", "8n", time);
        break;
      case "tom2":
        inst.triggerAttackRelease("F1", "8n", time);
        break;
      case "tom3":
        inst.triggerAttackRelease("D1", "8n", time);
        break;
      case "ride":
        inst.triggerAttackRelease(260, "4n", time, 1);
        break;
      case "crash":
        inst.triggerAttackRelease(220, "2n", time, 1);
        break;
      default:
        this.drumKit.hihat.triggerAttackRelease(220, "16n", time, 0.8);
    }
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log("Initializing Tone.js audio context...");
      await Tone.start();
      console.log(
        "Tone.js started, audio context state:",
        Tone.getContext().state,
      );

      // Create core synth only after the context is started (requires a user gesture)
      this.synth = this.synth ?? new Tone.Synth().toDestination();

      // Create synthesized drum sounds instead of loading files
      this.drumKit = {
        kick: new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 10,
          oscillator: { type: "sine" },
          envelope: {
            attack: 0.001,
            decay: 0.4,
            sustain: 0.01,
            release: 1.4,
            attackCurve: "exponential",
          },
        }).toDestination(),

        snare: new Tone.NoiseSynth({
          noise: { type: "white" },
          envelope: { attack: 0.005, decay: 0.1, sustain: 0.0 },
        }).toDestination(),

        hihat: new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.15, release: 0.02 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5,
        }).toDestination(),
      };

      // Map sequencer track instruments
      this.trackInstruments = {
        kick: this.drumKit.kick,
        snare: this.drumKit.snare,
        hhc: new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.12, release: 0.02 },
          harmonicity: 5,
          modulationIndex: 30,
          resonance: 5000,
          octaves: 1.5,
        }).toDestination(),
        hho: new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.45, release: 0.08 },
          harmonicity: 5,
          modulationIndex: 30,
          resonance: 4000,
          octaves: 1.5,
        }).toDestination(),
        tom1: new Tone.MembraneSynth({
          octaves: 4,
          envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.2 },
        }).toDestination(),
        tom2: new Tone.MembraneSynth({
          octaves: 4,
          envelope: { attack: 0.001, decay: 0.5, sustain: 0.01, release: 0.25 },
        }).toDestination(),
        tom3: new Tone.MembraneSynth({
          octaves: 4,
          envelope: { attack: 0.001, decay: 0.6, sustain: 0.01, release: 0.3 },
        }).toDestination(),
        ride: new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 1.2, release: 0.2 },
          resonance: 7000,
        }).toDestination(),
        crash: new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 1.8, release: 0.3 },
          resonance: 6000,
        }).toDestination(),
      };

      // Boost cymbals/hat levels for clarity
      try {
        (this.drumKit.hihat as any).volume.value = 6;
        (this.trackInstruments.hhc as any).volume.value = 6;
        (this.trackInstruments.hho as any).volume.value = 6;
        (this.trackInstruments.ride as any).volume.value = 6;
        (this.trackInstruments.crash as any).volume.value = 6;
      } catch {}

      console.log("Drum kit created:", Object.keys(this.drumKit));

      this.isInitialized = true;
    } catch (error) {
      console.error("Audio initialization failed:", error);
      throw error;
    }
  }

  setBpm(bpm: number) {
    try {
      Tone.Transport.bpm.value = bpm;
    } catch (error) {
      // noop
    }
  }

  async playNote(note: string | number, duration: string = "8n") {
    await this.initialize();
    try {
      if (!this.synth) return;
      this.synth.triggerAttackRelease(note, duration);
    } catch (error) {
      console.warn("Failed to play note:", error);
    }
  }

  async playMelody(notes: number[], tempo: number = 120) {
    await this.initialize();

    try {
      Tone.Transport.bpm.value = tempo;

      const sequence = new Tone.Sequence(
        (time, note) => {
          if (!this.synth) return;
          this.synth.triggerAttackRelease(
            Tone.Frequency(note, "midi").toNote(),
            "8n",
            time,
          );
        },
        notes,
        "8n",
      );

      sequence.start();
      Tone.Transport.start();

      // Stop after the sequence completes
      setTimeout(
        () => {
          sequence.stop();
          Tone.Transport.stop();
          sequence.dispose();
        },
        notes.length * (60 / tempo) * 0.5 * 1000,
      );
    } catch (error) {
      console.warn("Failed to play melody:", error);
    }
  }

  async playBeat(pattern: number[], samples: string[], bpm: number = 120) {
    await this.initialize();

    try {
      // Stop any existing sequence
      if (this.currentSequence) {
        this.currentSequence.stop();
        this.currentSequence.dispose();
      }

      Tone.Transport.bpm.value = bpm;

      console.log("Playing beat pattern:", pattern);

      this.currentSequence = new Tone.Sequence(
        (time, index) => {
          // Always play something so we can hear it's working
          if (index % 4 === 0) {
            // Kick on main beats (1, 5, 9, 13)
            this.drumKit.kick.triggerAttackRelease("C1", "8n", time);
            console.log("Playing kick at step", index);
          }

          if (index === 4 || index === 12) {
            // Snare on backbeat
            this.drumKit.snare.triggerAttackRelease("8n", time);
            console.log("Playing snare at step", index);
          }

          // Hi-hat on every step for consistent rhythm
          this.drumKit.hihat.triggerAttackRelease(220, "16n", time, 0.8);

          // Additional sounds based on AI pattern
          if (
            pattern[index] === 1 &&
            index % 4 !== 0 &&
            index !== 4 &&
            index !== 12
          ) {
            this.drumKit.kick.triggerAttackRelease("C2", "16n", time + 0.1);
          }
        },
        Array.from({ length: 16 }, (_, i) => i),
        "16n",
      );

      this.currentSequence.start();
      Tone.Transport.start();

      // Loop the pattern
      this.currentSequence.loop = true;
    } catch (error) {
      console.warn("Failed to play beat:", error);
    }
  }

  stop() {
    try {
      if (this.currentSequence) {
        this.currentSequence.stop();
        this.currentSequence.dispose();
        this.currentSequence = null;
      }
      Tone.Transport.stop();
      Tone.Transport.cancel();
    } catch (error) {
      console.warn("Failed to stop audio:", error);
    }
  }

  dispose() {
    try {
      this.stop();
      if (this.synth) {
        this.synth.dispose();
        this.synth = null;
      }
      Object.values(this.drumKit).forEach((instrument) => instrument.dispose());
      this.isInitialized = false;
    } catch (error) {
      console.warn("Failed to dispose audio:", error);
    }
  }
}

export const advancedAudioManager = new AdvancedAudioManager();
