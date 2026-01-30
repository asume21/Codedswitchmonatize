import * as Tone from 'tone';
import { getAudioContext } from './audioContext';

interface PackSample {
  id: string;
  name: string;
  type: 'loop' | 'oneshot' | 'midi';
  duration: number;
  aiData?: {
    notes?: string[];
    pattern?: number[];
    intensity?: number;
  };
}

interface PackMetadata {
  energy: number;
  mood: string;
  instruments: string[];
  tags: string[];
}

interface GeneratedPack {
  id: string;
  title: string;
  bpm: number;
  key: string;
  genre: string;
  samples: PackSample[];
  metadata: PackMetadata;
}

const CHORD_NOTES: Record<string, string[]> = {
  'C': ['C4', 'E4', 'G4'],
  'Cm': ['C4', 'Eb4', 'G4'],
  'D': ['D4', 'F#4', 'A4'],
  'Dm': ['D4', 'F4', 'A4'],
  'E': ['E4', 'G#4', 'B4'],
  'Em': ['E4', 'G4', 'B4'],
  'F': ['F4', 'A4', 'C5'],
  'Fm': ['F4', 'Ab4', 'C5'],
  'G': ['G4', 'B4', 'D5'],
  'Gm': ['G4', 'Bb4', 'D5'],
  'A': ['A4', 'C#5', 'E5'],
  'Am': ['A4', 'C5', 'E5'],
  'Bb': ['Bb4', 'D5', 'F5'],
  'F#': ['F#4', 'A#4', 'C#5'],
};

const BASS_PATTERNS: Record<string, number[]> = {
  'Hip Hop': [1, 0, 0, 1, 0, 0, 1, 0],
  'Trap': [1, 0, 1, 0, 0, 1, 0, 1],
  'House': [1, 0, 0, 0, 1, 0, 0, 0],
  'Electronic': [1, 0, 1, 0, 1, 0, 1, 0],
  'Lo-Fi': [1, 0, 0, 0, 0, 1, 0, 0],
  'Jazz': [1, 0, 0, 1, 0, 0, 1, 0],
};

const DRUM_PATTERNS: Record<string, { kick: number[], snare: number[], hat: number[] }> = {
  'Hip Hop': {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  },
  'Trap': {
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  'House': {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  },
  'Electronic': {
    kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  'Lo-Fi': {
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  },
  'Jazz': {
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    hat: [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
  },
};

function getChordNotes(key: string): string[] {
  const cleaned = key.replace(/[0-9]/g, '').trim();
  return CHORD_NOTES[cleaned] || CHORD_NOTES['C'];
}

function getBassNote(key: string): string {
  const cleaned = key.replace(/[0-9]/g, '').replace('m', '').trim();
  return cleaned + '2';
}

export class PackAudioSynthesizer {
  private synth: Tone.PolySynth | null = null;
  private bassSynth: Tone.MonoSynth | null = null;
  private drumSynth: Tone.MembraneSynth | null = null;
  private noiseSynth: Tone.NoiseSynth | null = null;
  private metalSynth: Tone.MetalSynth | null = null;
  private isPlaying = false;
  private stepLoopId: number | null = null;
  private recorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private targetNode: AudioNode | null = null;
  private stopListeners = new Set<() => void>();

  setTargetNode(node: AudioNode | null) {
    this.targetNode = node;
    // Reconnect if synths already exist
    if (node) {
      this.synth?.disconnect();
      this.synth?.connect(node);
      this.bassSynth?.disconnect();
      this.bassSynth?.connect(node);
      this.drumSynth?.disconnect();
      this.drumSynth?.connect(node);
      this.noiseSynth?.disconnect();
      this.noiseSynth?.connect(node);
      this.metalSynth?.disconnect();
      this.metalSynth?.connect(node);
    }
  }

  async initialize() {
    const sharedCtx = getAudioContext();
    if (Tone.context.rawContext !== sharedCtx) {
      Tone.setContext(new Tone.Context(sharedCtx));
    }
    
    await Tone.start();
    
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 }
    });
    
    if (this.targetNode) {
      this.synth.connect(this.targetNode);
    } else {
      this.synth.toDestination();
    }
    
    this.synth.volume.value = -6;

    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
      filter: { Q: 2, type: 'lowpass', rolloff: -24 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3, baseFrequency: 100, octaves: 2 }
    });
    
    if (this.targetNode) {
      this.bassSynth.connect(this.targetNode);
    } else {
      this.bassSynth.toDestination();
    }
    
    this.bassSynth.volume.value = -3;

    this.drumSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 }
    });
    
    if (this.targetNode) {
      this.drumSynth.connect(this.targetNode);
    } else {
      this.drumSynth.toDestination();
    }
    
    this.drumSynth.volume.value = 0;

    this.noiseSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 }
    });
    
    if (this.targetNode) {
      this.noiseSynth.connect(this.targetNode);
    } else {
      this.noiseSynth.toDestination();
    }
    
    this.noiseSynth.volume.value = -12;

    this.metalSynth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    });
    
    if (this.targetNode) {
      this.metalSynth.connect(this.targetNode);
    } else {
      this.metalSynth.toDestination();
    }
    
    this.metalSynth.volume.value = -18;
  }

  stop() {
    this.isPlaying = false;
    if (this.stepLoopId !== null) {
      Tone.Transport.clear(this.stepLoopId);
      this.stepLoopId = null;
    }
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.cancel();
    this.notifyStop();
  }

  onStop(listener: () => void) {
    this.stopListeners.add(listener);
    return () => {
      this.stopListeners.delete(listener);
    };
  }

  private notifyStop() {
    this.stopListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('PackAudioSynthesizer stop listener failed', error);
      }
    });
  }

  async playPack(pack: GeneratedPack, volume: number = 0.75, options: { loop?: boolean; bars?: number } = {}): Promise<void> {
    if (this.isPlaying) {
      this.stop();
      return;
    }

    await this.initialize();
    
    const masterVolume = Tone.dbToGain(volume * 20 - 20);
    if (this.synth) this.synth.volume.value = Tone.gainToDb(masterVolume) - 6;
    if (this.bassSynth) this.bassSynth.volume.value = Tone.gainToDb(masterVolume) - 3;
    if (this.drumSynth) this.drumSynth.volume.value = Tone.gainToDb(masterVolume);

    Tone.Transport.bpm.value = pack.bpm || 120;
    
    const genre = pack.genre || 'Electronic';
    const key = pack.key || 'C';
    const chordNotes = getChordNotes(key);
    const bassNote = getBassNote(key);
    
    const drumPattern = DRUM_PATTERNS[genre] || DRUM_PATTERNS['Electronic'];
    const bassPattern = BASS_PATTERNS[genre] || BASS_PATTERNS['Electronic'];
    
    const stepsPerBar = 16;
    const maxBars = Math.max(1, options.bars ?? 4);
    const shouldLoop = options.loop ?? false;

    if (this.stepLoopId !== null) {
      Tone.Transport.clear(this.stepLoopId);
      this.stepLoopId = null;
    }

    this.isPlaying = true;
    let stepCounter = 0;

    this.stepLoopId = Tone.Transport.scheduleRepeat((time) => {
      const patternStep = stepCounter % stepsPerBar;

      if (drumPattern.kick[patternStep]) {
        this.drumSynth?.triggerAttackRelease('C1', '8n', time);
      }

      if (drumPattern.snare[patternStep]) {
        this.noiseSynth?.triggerAttackRelease('16n', time);
      }

      if (drumPattern.hat[patternStep]) {
        this.metalSynth?.triggerAttackRelease('32n', time, 0.3);
      }

      const bassStep = stepCounter % bassPattern.length;
      if (bassPattern[bassStep]) {
        this.bassSynth?.triggerAttackRelease(bassNote, '8n', time);
      }

      if (patternStep === 0) {
        this.synth?.triggerAttackRelease(chordNotes, '2n', time, 0.4);
      }

      stepCounter += 1;
      if (!shouldLoop && stepCounter >= maxBars * stepsPerBar) {
        this.stop();
      }
    }, '16n');

    Tone.Transport.position = 0;
    Tone.Transport.start();
  }

  async generateAudioBlob(pack: GeneratedPack): Promise<Blob> {
    await this.initialize();
    
    const offlineContext = new OfflineAudioContext(2, 44100 * 8, 44100);
    
    return new Promise((resolve) => {
      const chunks: Blob[] = [];
      const dest = Tone.getContext().createMediaStreamDestination();
      
      if (this.synth) this.synth.connect(dest);
      if (this.bassSynth) this.bassSynth.connect(dest);
      if (this.drumSynth) this.drumSynth.connect(dest);
      if (this.noiseSynth) this.noiseSynth.connect(dest);
      if (this.metalSynth) this.metalSynth.connect(dest);

      const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        resolve(blob);
      };

      recorder.start();
      
      this.playPack(pack).then(() => {
        setTimeout(() => {
          recorder.stop();
        }, 100);
      });
    });
  }

  dispose() {
    this.stop();
    this.synth?.dispose();
    this.bassSynth?.dispose();
    this.drumSynth?.dispose();
    this.noiseSynth?.dispose();
    this.metalSynth?.dispose();
    this.synth = null;
    this.bassSynth = null;
    this.drumSynth = null;
    this.noiseSynth = null;
    this.metalSynth = null;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const packSynthesizer = new PackAudioSynthesizer();
