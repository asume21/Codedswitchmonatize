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
  private scheduledEvents: number[] = [];
  private recorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private targetNode: AudioNode | null = null;

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
    this.scheduledEvents.forEach(id => Tone.Transport.clear(id));
    this.scheduledEvents = [];
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }

  async playPack(pack: GeneratedPack, volume: number = 0.75): Promise<void> {
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
    
    const sixteenthNote = Tone.Time('16n').toSeconds();
    const totalBars = 4;
    const stepsPerBar = 16;
    const totalSteps = totalBars * stepsPerBar;

    this.isPlaying = true;

    for (let step = 0; step < totalSteps; step++) {
      const time = step * sixteenthNote;
      const patternStep = step % 16;

      if (drumPattern.kick[patternStep] && this.drumSynth) {
        const id = Tone.Transport.schedule((t) => {
          this.drumSynth?.triggerAttackRelease('C1', '8n', t);
        }, time);
        this.scheduledEvents.push(id);
      }

      if (drumPattern.snare[patternStep] && this.noiseSynth) {
        const id = Tone.Transport.schedule((t) => {
          this.noiseSynth?.triggerAttackRelease('16n', t);
        }, time);
        this.scheduledEvents.push(id);
      }

      if (drumPattern.hat[patternStep] && this.metalSynth) {
        const id = Tone.Transport.schedule((t) => {
          this.metalSynth?.triggerAttackRelease('32n', t, 0.3);
        }, time);
        this.scheduledEvents.push(id);
      }

      const bassStep = step % bassPattern.length;
      if (bassPattern[bassStep] && this.bassSynth) {
        const id = Tone.Transport.schedule((t) => {
          this.bassSynth?.triggerAttackRelease(bassNote, '8n', t);
        }, time);
        this.scheduledEvents.push(id);
      }

      if (step % 16 === 0 && this.synth) {
        const id = Tone.Transport.schedule((t) => {
          this.synth?.triggerAttackRelease(chordNotes, '2n', t, 0.4);
        }, time);
        this.scheduledEvents.push(id);
      }
    }

    const totalDuration = totalSteps * sixteenthNote;
    const stopId = Tone.Transport.schedule(() => {
      this.stop();
    }, totalDuration);
    this.scheduledEvents.push(stopId);

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
