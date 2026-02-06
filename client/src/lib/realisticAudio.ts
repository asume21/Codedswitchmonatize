import Soundfont from 'soundfont-player';
import { getAudioContext } from './audioContext';

const INSTRUMENT_LIBRARY = {
  // Direct General MIDI mappings (self-referencing for direct use)
  acoustic_grand_piano: 'acoustic_grand_piano',
  electric_piano_1: 'electric_piano_1',
  electric_piano_2: 'electric_piano_2',
  harpsichord: 'harpsichord',
  synth_bass_1: 'synth_bass_1',
  synth_bass_2: 'synth_bass_2',
  electric_bass_finger: 'electric_bass_finger',
  electric_bass_pick: 'electric_bass_pick',
  acoustic_bass: 'acoustic_bass',
  fretless_bass: 'fretless_bass',
  slap_bass_1: 'slap_bass_1',
  acoustic_guitar_steel: 'acoustic_guitar_steel',
  electric_guitar_clean: 'electric_guitar_clean',
  acoustic_guitar_nylon: 'acoustic_guitar_nylon',
  violin: 'violin',
  viola: 'viola',
  cello: 'cello',
  contrabass: 'contrabass',
  string_ensemble_1: 'string_ensemble_1',
  flute: 'flute',
  clarinet: 'clarinet',
  tenor_sax: 'tenor_sax',
  trumpet: 'trumpet',
  french_horn: 'french_horn',
  trombone: 'trombone',
  lead_1_square: 'lead_1_square',
  lead_2_sawtooth: 'lead_2_sawtooth',
  pad_2_warm: 'pad_2_warm',
  taiko_drum: 'taiko_drum',
  synth_drum: 'synth_drum',
  reverse_cymbal: 'reverse_cymbal',
  melodic_tom: 'melodic_tom',
  timpani: 'timpani',
  woodblock: 'woodblock',
  agogo: 'agogo',
  tinkle_bell: 'tinkle_bell',
  steel_drums: 'steel_drums',
  synth_voice: 'synth_voice',
  choir_aahs: 'choir_aahs',
  orchestral_harp: 'orchestral_harp',
  
  // Legacy mappings for backwards compatibility
  piano: 'acoustic_grand_piano',
  'piano-keyboard': 'acoustic_grand_piano',
  'piano-grand': 'acoustic_grand_piano', 
  'piano-organ': 'church_organ',
  guitar: 'acoustic_guitar_steel',
  'strings-guitar': 'acoustic_guitar_steel',
  'guitar-acoustic': 'acoustic_guitar_steel',
  'guitar-electric': 'electric_guitar_clean',
  'guitar-distorted': 'distortion_guitar',
  'guitar-nylon': 'acoustic_guitar_nylon',
  'strings-violin': 'violin',
  'strings-ukulele': 'acoustic_guitar_nylon',
  'flute-recorder': 'recorder',
  'flute-indian': 'flute',
  'flute-concert': 'flute',
  'horns-trumpet': 'trumpet',
  'horns-trombone': 'trombone',
  'horns-french': 'french_horn',
  'synth-analog': 'electric_piano_1',
  'synth-digital': 'electric_piano_2',
  'synth-fm': 'electric_piano_1',
  'bass-electric': 'electric_bass_finger',
  'bass-upright': 'acoustic_bass',
  'bass-synth': 'synth_bass_1',
  // Neumann Bass Pack aliases (mapped onto the most suitable GM bass programs)
  'neumann_sub_bass': 'synth_bass_1',
  'neumann_punch_bass': 'electric_bass_finger',
  'neumann_grit_bass': 'synth_bass_2',
  'pads-warm': 'pad_2_warm',
  'pads-strings': 'string_ensemble_1',
  'pads-choir': 'choir_aahs',
  'leads-square': 'lead_1_square',
  'leads-saw': 'lead_2_sawtooth',
  'leads-pluck': 'lead_6_voice',
  'drum-kick': 'taiko_drum',
  'drum-snare': 'steel_drums',
  'drum-hihat': 'agogo',
  'drum-crash': 'reverse_cymbal',
  'drum-tom': 'melodic_tom',
  'drum-clap': 'steel_drums',
  bass: 'electric_bass_finger',
  organ: 'church_organ',
  synth: 'lead_1_square',
  strings: 'string_ensemble_1'
};

export class RealisticAudioEngine {
  private instruments: { [key: string]: any } = {};
  private instrumentLoadPromises: Record<string, Promise<any>> = {};
  private activeNotes: Map<string, any[]> = new Map(); // Track active audio nodes by key
  private audioContext: AudioContext | null = getAudioContext();
  private isInitialized = false;
  private isLoading = false;
  
  // Voice limiting to prevent audio crackling
  private maxPolyphony = 16; // Maximum simultaneous voices (reduced from 32 to prevent buffer overflow)
  private totalActiveVoices = 0;
  private voiceQueue: Array<{ node: any; startTime: number; key: string }> = [];
  private initPromise: Promise<void> | null = null;
  public bassDrumDuration = 0.8;
  private instrumentLibrary: { [key: string]: string };

  // Drum kit voicing profiles
  private drumKitAliases: Record<string, string> = {
    trap: '808',
  };

  private drumKitProfiles: Record<string, {
    kick: {
      pitchStart: number;
      pitchEnd: number;
      pitchSweep: number;
      bodyDecay: number;
      filterHz: number;
      filterQ: number;
      bodyGain: number;
      clickVol: number;
    };
    snare: {
      toneStart: number;
      toneEnd: number;
      toneDecay: number;
      bandHz: number;
      bandQ: number;
      noiseDecay: number;
      noiseVol: number;
      toneVol: number;
    };
    hihat: { decay: number; hpHz: number; vol: number };
    openhat: { decay: number; hpHz: number; vol: number };
    tom: { startFreq: number; endFreq: number; filterHz: number; vol: number; decay: number };
  }> = {
    default: {
      kick: { pitchStart: 65, pitchEnd: 35, pitchSweep: 0.15, bodyDecay: 0.4, filterHz: 120, filterQ: 8, bodyGain: 1.8, clickVol: 0.15 },
      snare: { toneStart: 240, toneEnd: 180, toneDecay: 0.08, bandHz: 2500, bandQ: 2.5, noiseDecay: 0.12, noiseVol: 1.4, toneVol: 0.6 },
      hihat: { decay: 0.05, hpHz: 10000, vol: 1.2 },
      openhat: { decay: 0.25, hpHz: 8000, vol: 1.2 },
      tom: { startFreq: 120, endFreq: 80, filterHz: 600, vol: 1.4, decay: 0.4 },
    },
    '808': {
      kick: { pitchStart: 55, pitchEnd: 32, pitchSweep: 0.18, bodyDecay: 0.55, filterHz: 130, filterQ: 7, bodyGain: 1.9, clickVol: 0.1 },
      snare: { toneStart: 190, toneEnd: 140, toneDecay: 0.1, bandHz: 2000, bandQ: 2.2, noiseDecay: 0.14, noiseVol: 1.3, toneVol: 0.6 },
      hihat: { decay: 0.06, hpHz: 9500, vol: 1.15 },
      openhat: { decay: 0.32, hpHz: 8500, vol: 1.1 },
      tom: { startFreq: 110, endFreq: 70, filterHz: 520, vol: 1.35, decay: 0.42 },
    },
    '909': {
      kick: { pitchStart: 70, pitchEnd: 48, pitchSweep: 0.13, bodyDecay: 0.32, filterHz: 180, filterQ: 9, bodyGain: 1.6, clickVol: 0.24 },
      snare: { toneStart: 220, toneEnd: 170, toneDecay: 0.07, bandHz: 3200, bandQ: 2.8, noiseDecay: 0.12, noiseVol: 1.45, toneVol: 0.7 },
      hihat: { decay: 0.07, hpHz: 11000, vol: 1.2 },
      openhat: { decay: 0.3, hpHz: 9000, vol: 1.15 },
      tom: { startFreq: 130, endFreq: 90, filterHz: 650, vol: 1.45, decay: 0.36 },
    },
    acoustic: {
      kick: { pitchStart: 78, pitchEnd: 55, pitchSweep: 0.1, bodyDecay: 0.28, filterHz: 240, filterQ: 6, bodyGain: 1.4, clickVol: 0.32 },
      snare: { toneStart: 200, toneEnd: 160, toneDecay: 0.08, bandHz: 3500, bandQ: 1.8, noiseDecay: 0.1, noiseVol: 1.35, toneVol: 0.55 },
      hihat: { decay: 0.06, hpHz: 10500, vol: 1.1 },
      openhat: { decay: 0.26, hpHz: 9500, vol: 1.05 },
      tom: { startFreq: 140, endFreq: 95, filterHz: 700, vol: 1.3, decay: 0.32 },
    },
    lofi: {
      kick: { pitchStart: 60, pitchEnd: 38, pitchSweep: 0.16, bodyDecay: 0.45, filterHz: 140, filterQ: 5, bodyGain: 1.2, clickVol: 0.08 },
      snare: { toneStart: 170, toneEnd: 130, toneDecay: 0.07, bandHz: 1800, bandQ: 1.8, noiseDecay: 0.14, noiseVol: 1.1, toneVol: 0.45 },
      hihat: { decay: 0.08, hpHz: 7000, vol: 1.0 },
      openhat: { decay: 0.28, hpHz: 7500, vol: 0.95 },
      tom: { startFreq: 115, endFreq: 75, filterHz: 520, vol: 1.15, decay: 0.38 },
    },
  };

  // Singleton pattern for shared instance
  static getInstance() {
    if (!(window as any).realisticAudio) {
      (window as any).realisticAudio = new RealisticAudioEngine();
    }
    return (window as any).realisticAudio;
  }

  constructor() {
    this.instrumentLibrary = INSTRUMENT_LIBRARY;
    // Periodic cleanup of finished nodes every 2 seconds (more frequent for better performance)
    setInterval(() => this.cleanupFinishedNodes(), 2000);
  }

  /**
   * Voice stealing - remove oldest voices when we exceed max polyphony
   */
  private stealOldestVoices(count: number = 1) {
    if (!this.audioContext || this.voiceQueue.length === 0) return;
    
    // Sort by start time (oldest first)
    this.voiceQueue.sort((a, b) => a.startTime - b.startTime);
    
    // Remove oldest voices
    const toRemove = this.voiceQueue.splice(0, count);
    toRemove.forEach(voice => {
      try {
        if (voice.node) {
          if (typeof voice.node.stop === 'function') {
            voice.node.stop(this.audioContext!.currentTime);
          }
          voice.node.disconnect();
        }
        // Remove from activeNotes map
        const nodes = this.activeNotes.get(voice.key);
        if (nodes) {
          const idx = nodes.indexOf(voice.node);
          if (idx > -1) nodes.splice(idx, 1);
          if (nodes.length === 0) this.activeNotes.delete(voice.key);
        }
        this.totalActiveVoices = Math.max(0, this.totalActiveVoices - 1);
      } catch (e) {
        // Ignore cleanup errors
      }
    });
  }

  /**
   * Track a new voice for polyphony management
   */
  private trackVoice(node: any, key: string) {
    if (!this.audioContext) return;
    
    // If we're at max polyphony, steal oldest voice
    if (this.totalActiveVoices >= this.maxPolyphony) {
      this.stealOldestVoices(Math.ceil(this.maxPolyphony * 0.5)); // Remove 50% of voices for aggressive cleanup
    }
    
    this.voiceQueue.push({
      node,
      startTime: this.audioContext.currentTime,
      key
    });
    this.totalActiveVoices++;
  }

  /**
   * Remove a voice from tracking
   */
  private untrackVoice(node: any) {
    const idx = this.voiceQueue.findIndex(v => v.node === node);
    if (idx > -1) {
      this.voiceQueue.splice(idx, 1);
      this.totalActiveVoices = Math.max(0, this.totalActiveVoices - 1);
    }
  }

  /**
   * Clean up audio nodes that have finished playing
   */
  private cleanupFinishedNodes() {
    if (!this.audioContext) return;
    
    const currentTime = this.audioContext.currentTime;
    const keysToDelete: string[] = [];
    
    this.activeNotes.forEach((nodes, key) => {
      // Filter out nodes that should have finished
      const activeNodes = nodes.filter(node => {
        // If node has a stop time and it's passed, disconnect it
        if (node && node.playbackState === 'finished') {
          try {
            node.disconnect();
          } catch (e) {
            // Already disconnected
          }
          return false;
        }
        
        // Additional cleanup: remove nodes that have been playing too long (potential memory leaks)
        if (node && (node as any).startTime) {
          const playDuration = currentTime - (node as any).startTime;
          if (playDuration > 10) { // 10 seconds max play time
            try {
              if (typeof node.stop === 'function') {
                node.stop(currentTime);
              }
              node.disconnect();
            } catch (e) {
              // Ignore errors during cleanup
            }
            return false;
          }
        }
        
        return true;
      });
      
      if (activeNodes.length === 0) {
        keysToDelete.push(key);
      } else if (activeNodes.length !== nodes.length) {
        this.activeNotes.set(key, activeNodes);
      }
    });
    
    // Remove empty entries
    keysToDelete.forEach(key => this.activeNotes.delete(key));
    
    // Log cleanup activity for debugging
    if (keysToDelete.length > 0) {
      console.log(`🔊 Cleaned up ${keysToDelete.length} finished audio nodes`);
    }
  }

  async initialize() {
    if (this.isInitialized && this.audioContext?.state === 'running') return;
    this.audioContext = getAudioContext();
    this.isInitialized = true;
    console.log('🎹 RealisticAudioEngine initialized');
  }

  /**
   * Resume the audio context (critical for iOS/Safari)
   */
  async resume() {
    if (!this.audioContext) await this.initialize();
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Centralized helper to ensure an instrument is loaded before use.
   * Prevents duplicate/concurrent fetch requests.
   */
  private async ensureInstrumentLoaded(instrumentName: string): Promise<any> {
    // Resolve alias to GM key
    const key = (this.instrumentLibrary as any)[String(instrumentName || 'piano')] || String(instrumentName || 'piano');

    // 1. Check if already loaded
    if (this.instruments[key]) return this.instruments[key];

    // 2. Check if currently loading
    const existingPromise = this.instrumentLoadPromises[key];
    if (existingPromise) return existingPromise;

    // 3. Start loading
    console.log(`📡 Loading instrument: ${key}...`);
    const loadPromise = (async () => {
      try {
        if (!this.audioContext) await this.initialize();
        const instrument = await Soundfont.instrument(this.audioContext!, key as any);
        this.instruments[key] = instrument;
        console.log(`✅ Instrument loaded: ${key}`);
        return instrument;
      } catch (error) {
        console.error(`❌ Failed to load instrument ${key}:`, error);
        delete this.instrumentLoadPromises[key];
        throw error;
      }
    })();

    this.instrumentLoadPromises[key] = loadPromise;
    return loadPromise;
  }

  /**
   * Load an additional instrument into the engine
   */
  async loadAdditionalInstrument(instrumentName: string): Promise<void> {
    await this.ensureInstrumentLoaded(instrumentName);
  }

  async playNote(
    note: string,
    octave: number,
    duration: number,
    instrument: string = 'piano',
    velocity: number = 0.7,
    isMidi: boolean = false,
    targetNode?: AudioNode
  ): Promise<void> {
    console.log(`🎵 playNote: ${note}${octave} on ${instrument}`);

    if (!this.isInitialized) {
      console.log('🎵 Audio not initialized, initializing...');
      await this.initialize();
    }

    if (!this.audioContext) {
      console.warn('🎵 Audio context not available, skipping playback');
      return;
    }

    // iOS fix: Always try to resume if suspended
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn('🎵 Failed to resume audio context:', e);
      }
    }

    const requestedInstrument = String(instrument || 'piano');
    // Map requested name to GM key if possible
    let realInstrument = (this.instrumentLibrary as any)[requestedInstrument] || requestedInstrument;

    try {
      // Ensure instrument is loaded
      await this.ensureInstrumentLoaded(realInstrument);

      if (this.instruments[realInstrument]) {
        const noteName = `${note}${octave}`;
        const destination = targetNode || this.audioContext.destination;

        // Play immediately - soundfont library handles its own scheduling
        const audioNode = this.instruments[realInstrument].play(
          noteName,
          this.audioContext.currentTime,
          {
            duration: duration > 0 ? duration : undefined,
            gain: velocity,
            destination: destination
          }
        );

        if (audioNode) {
          // Track start time for cleanup
          (audioNode as any).startTime = this.audioContext.currentTime;

          // Track active node for cleanup/noteOff
          const noteKey = `${realInstrument}:${noteName}`;
          if (!this.activeNotes.has(noteKey)) {
            this.activeNotes.set(noteKey, []);
          }
          this.activeNotes.get(noteKey)?.push(audioNode);
          
          // Track for polyphony management
          this.trackVoice(audioNode, noteKey);

          // If duration is provided, automatically schedule removal from tracking
          if (duration > 0) {
            setTimeout(() => {
              const nodes = this.activeNotes.get(noteKey);
              if (nodes) {
                const index = nodes.indexOf(audioNode);
                if (index > -1) nodes.splice(index, 1);
                if (nodes.length === 0) this.activeNotes.delete(noteKey);
              }
              this.untrackVoice(audioNode);
            }, duration * 1000 + 100);
          }
          return;
        }
      }

      // Fallback to synthetic if soundfont fails or is missing
      await this.fallbackToSynthetic(note, octave, duration, velocity, targetNode || this.audioContext.destination);
    } catch (error) {
      console.warn(`⚠️ Soundfont play failed for ${realInstrument}, using synthetic fallback`);
      await this.fallbackToSynthetic(note, octave, duration, velocity, targetNode || this.audioContext.destination);
    }
  }

  async playDrumSound(drumType: string, velocity: number = 0.7, kit: string = 'default', targetNode?: AudioNode): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Choose a kit profile to give each kit a distinct flavor
    const kitKey = (kit || 'default').toLowerCase();
    const mappedKey = this.drumKitAliases[kitKey] || kitKey;
    const kitProfile = this.drumKitProfiles[mappedKey] || this.drumKitProfiles.default;

    // Use synthetic drum engine for "realistic" mode since soundfonts are broken
    console.log(`Playing synthetic drum in realistic mode: ${drumType}`);
    
    if (!this.audioContext) {
      console.error('AudioContext not available for synthetic drums');
      return;
    }
    
    // iOS fix: Always try to resume if suspended
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn('🎵 Failed to resume audio context for drums:', e);
      }
    }

    const currentTime = this.audioContext.currentTime;
    const destination = targetNode || this.audioContext.destination;
    
    try {
      // Recreate the professional drum synthesis here
      switch (drumType) {
        case 'kick':
          this.playSyntheticKick(currentTime, velocity, kitProfile.kick, destination);
          break;
        case 'bass': // Deeper, sub-bass drum
          this.playSyntheticBassDrum(currentTime, velocity, destination);
          break;
        case 'snare':
          this.playSyntheticSnare(currentTime, velocity, kitProfile.snare, destination);
          break;
        case 'hihat':
          this.playSyntheticHihat(currentTime, velocity, kitProfile.hihat, destination);
          break;
        case 'openhat':
          this.playSyntheticOpenHat(currentTime, velocity, kitProfile.openhat, destination);
          break;
        case 'tom':
          this.playSyntheticTom(currentTime, velocity, 180, 110, 0.38, destination);
          break;
        case 'tom_hi':
          this.playSyntheticTom(currentTime, velocity, 240, 160, 0.32, destination);
          break;
        case 'tom_mid':
          this.playSyntheticTom(currentTime, velocity, 200, 130, 0.35, destination);
          break;
        case 'tom_lo':
          this.playSyntheticTom(currentTime, velocity, 150, 90, 0.42, destination);
          break;
        case 'conga':
          this.playSyntheticConga(currentTime, velocity, destination);
          break;
        case 'clap':
          this.playSyntheticClap(currentTime, velocity, destination);
          break;
        case 'perc':
          this.playSyntheticPerc(currentTime, velocity, destination);
          break;
        case 'rim':
          this.playSyntheticRim(currentTime, velocity, destination);
          break;
        case 'crash':
          this.playSyntheticCrash(currentTime, velocity, destination);
          break;
        case 'cowbell':
          this.playSyntheticCowbell(currentTime, velocity, destination);
          break;
        case 'ride':
          this.playSyntheticRide(currentTime, velocity, destination);
          break;
        case 'fx':
          this.playSyntheticFX(currentTime, velocity, destination);
          break;
        case 'foley':
          this.playSyntheticFoley(currentTime, velocity, destination);
          break;
        case 'bell':
          this.playSyntheticBell(currentTime, velocity, destination);
          break;
        case 'vinyl fx':
        case 'vinylfx':
          this.playSyntheticVinylFX(currentTime, velocity, destination);
          break;
        case 'shaker':
          this.playSyntheticShaker(currentTime, velocity, destination);
          break;
        default:
          console.warn(`🎵 Unknown drum type: ${drumType}`);
      }
    } catch (error) {
      console.error('🎵 Drum sound error:', error);
    }
  }

  // Fallback to synthetic audio generation for unsupported octaves
  private async fallbackToSynthetic(note: string, octave: number, duration: number, velocity: number, destination?: AudioNode): Promise<void> {
    // Silent fallback - no logging needed as this is expected behavior for extreme octaves
    if (!this.audioContext) {
      return;
    }

    try {
      const currentTime = this.audioContext.currentTime;

      // Convert note name and octave to frequency
      const frequency = this.noteToFrequency(note, octave);

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(destination || this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine'; // Simple sine wave for fallback

      // Envelope
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(velocity * 0.3, currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);
    } catch (error) {
      // Silent failure - synthetic fallback is best-effort
    }
  }

  // Convert note name and octave to frequency
  private noteToFrequency(note: string, octave: number): number {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteIndex = noteNames.indexOf(note.toUpperCase());

    if (noteIndex === -1) {
      console.warn(`Unknown note: ${note}, defaulting to A`);
      return 440; // A4
    }

    // A4 = 440Hz, MIDI note 69
    const midiNote = (octave + 1) * 12 + noteIndex;
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  // Get list of available instruments
  getAvailableInstruments(): string[] {
    return Object.keys(this.instrumentLibrary);
  }

  // Check if engine is ready
  isReady(): boolean {
    return this.isInitialized && !this.isLoading;
  }

  // Stop a specific note on a specific instrument
  noteOff(note: string, octave: number, instrument: string = 'piano') {
    const realInstrument = (this.instrumentLibrary as any)[instrument] || instrument;
    const noteName = `${note}${octave}`;
    const noteKey = `${realInstrument}:${noteName}`;
    const nodes = this.activeNotes.get(noteKey);

    if (nodes && nodes.length > 0) {
      const node = nodes.shift();
      if (node && typeof node.stop === 'function') {
        node.stop(this.audioContext?.currentTime || 0);
      }
      if (nodes.length === 0) {
        this.activeNotes.delete(noteKey);
      }
    }
  }

  // Stop all playing sounds
  stopAllSounds() {
    // 1. Release all active soundfont notes
    this.activeNotes.forEach((nodes, key) => {
      nodes.forEach(node => {
        if (node && typeof node.stop === 'function') {
          try {
            node.stop(this.audioContext?.currentTime || 0);
          } catch (e) {
            // Ignore stop errors
          }
        }
        // Disconnect the node to free resources
        if (node && typeof node.disconnect === 'function') {
          try {
            node.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
        }
      });
    });
    this.activeNotes.clear();

    // 2. Disconnect all loaded instruments to free audio graph resources
    Object.values(this.instruments).forEach(instrument => {
      if (instrument && typeof instrument.disconnect === 'function') {
        try {
          instrument.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      }
    });

    // 3. Reset local state
    // IMPORTANT: Do NOT close() the shared AudioContext.
    this.instruments = {};
    this.instrumentLoadPromises = {};
    this.isInitialized = false;
  }

  // Professional synthetic drum implementations (to avoid circular imports)
  private playSyntheticKick(currentTime: number, velocity: number, profile?: {
    pitchStart: number;
    pitchEnd: number;
    pitchSweep: number;
    bodyDecay: number;
    filterHz: number;
    filterQ: number;
    bodyGain: number;
    clickVol: number;
  }, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      const k = profile || this.drumKitProfiles.default.kick;
      const ctx = this.audioContext;
      const dest = destination || ctx.destination;
      
      // === MAIN BODY OSCILLATOR (deep sine) ===
      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      const bodyFilter = ctx.createBiquadFilter();
      
      // Sub-bass body - pure sine for clean low end
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(k.pitchStart, currentTime);
      bodyOsc.frequency.exponentialRampToValueAtTime(Math.max(20, k.pitchEnd), currentTime + k.pitchSweep);
      
      // Gentle lowpass to remove any harmonics
      bodyFilter.type = 'lowpass';
      bodyFilter.frequency.setValueAtTime(Math.max(80, k.filterHz), currentTime);
      bodyFilter.Q.setValueAtTime(Math.min(k.filterQ, 4), currentTime); // Limit Q to prevent ringing
      
      // Smooth envelope with proper attack
      const bodyVol = Math.max(0.001, velocity * k.bodyGain * 0.9);
      bodyGain.gain.setValueAtTime(0.001, currentTime);
      bodyGain.gain.linearRampToValueAtTime(bodyVol, currentTime + 0.005); // 5ms attack
      bodyGain.gain.exponentialRampToValueAtTime(bodyVol * 0.7, currentTime + 0.05);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, currentTime + k.bodyDecay);
      
      // === PUNCH/CLICK LAYER (softer, lower frequency) ===
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      const clickFilter = ctx.createBiquadFilter();
      
      // Use a lower frequency sine for punch instead of harsh triangle
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(180, currentTime); // Much lower than before (was 1200)
      clickOsc.frequency.exponentialRampToValueAtTime(60, currentTime + 0.025);
      
      // Bandpass to shape the click
      clickFilter.type = 'bandpass';
      clickFilter.frequency.setValueAtTime(150, currentTime);
      clickFilter.Q.setValueAtTime(1.5, currentTime);
      
      // Very short click envelope
      const clickVol = Math.max(0.001, velocity * k.clickVol * 0.6);
      clickGain.gain.setValueAtTime(0.001, currentTime);
      clickGain.gain.linearRampToValueAtTime(clickVol, currentTime + 0.002);
      clickGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.035);
      
      // === TRANSIENT NOISE LAYER (adds realistic attack) ===
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.003));
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(400, currentTime);
      noiseFilter.Q.setValueAtTime(2, currentTime);
      
      const noiseVol = velocity * k.clickVol * 0.15;
      noiseGain.gain.setValueAtTime(noiseVol, currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.015);
      
      // === CONNECT ALL LAYERS ===
      bodyOsc.connect(bodyFilter);
      bodyFilter.connect(bodyGain);
      bodyGain.connect(dest);
      
      clickOsc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(dest);
      
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(dest);
      
      // === START AND STOP (with 50ms lookahead for smooth scheduling) ===
      const scheduleTime = currentTime + 0.05;
      bodyOsc.start(scheduleTime);
      clickOsc.start(scheduleTime);
      noiseSource.start(scheduleTime);
      
      bodyOsc.stop(scheduleTime + k.bodyDecay + 0.05);
      clickOsc.stop(scheduleTime + 0.04);
      
    } catch (error) {
      console.error('🎵 Kick drum error:', error);
    }
  }

  private playSyntheticSnare(
    currentTime: number,
    velocity: number,
    profile?: {
      toneStart: number;
      toneEnd: number;
      toneDecay: number;
      bandHz: number;
      bandQ: number;
      noiseDecay: number;
      noiseVol: number;
      toneVol: number;
    },
    destination?: AudioNode
  ): void {
    if (!this.audioContext) return;

    try {
      const s = profile || this.drumKitProfiles.default.snare;
      const snareNoise = this.audioContext.createBufferSource();
      const snareTone = this.audioContext.createOscillator();
      const snareGain = this.audioContext.createGain();
      const snareToneGain = this.audioContext.createGain();
      const snareFilter = this.audioContext.createBiquadFilter();

      // Generate proper snare noise
      const bufferSize = this.audioContext.sampleRate * s.noiseDecay;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.pow(1 - (i / bufferSize), 2);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      snareNoise.buffer = buffer;

      // Snare fundamental
      snareTone.type = 'triangle';
      snareTone.frequency.setValueAtTime(s.toneStart, currentTime);
      snareTone.frequency.exponentialRampToValueAtTime(s.toneEnd, currentTime + s.toneDecay);

      // Bandpass for snare character
      snareFilter.type = 'bandpass';
      snareFilter.frequency.setValueAtTime(s.bandHz, currentTime);
      snareFilter.Q.setValueAtTime(s.bandQ, currentTime);

      // Snare crack envelope - BOOSTED VOLUME
      const snareVol = Math.max(0.001, velocity * s.noiseVol);
      snareGain.gain.setValueAtTime(snareVol, currentTime);
      snareGain.gain.exponentialRampToValueAtTime(0.001, currentTime + s.noiseDecay);

      const toneVol = Math.max(0.001, velocity * s.toneVol);
      snareToneGain.gain.setValueAtTime(toneVol, currentTime);
      snareToneGain.gain.exponentialRampToValueAtTime(0.001, currentTime + s.toneDecay);

      // Connect
      snareNoise.connect(snareFilter);
      snareFilter.connect(snareGain);
      snareGain.connect(destination || this.audioContext.destination);

      snareTone.connect(snareToneGain);
      snareToneGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      snareNoise.start(scheduleTime);
      snareTone.start(scheduleTime);
      snareTone.stop(scheduleTime + s.toneDecay);
    } catch (error) {
      console.error('🎵 Snare drum error:', error);
    }
  }

  private playSyntheticHihat(
    currentTime: number,
    velocity: number,
    profile?: { decay: number; hpHz: number; vol: number },
    destination?: AudioNode
  ): void {
    if (!this.audioContext) return;

    try {
      const h = profile || this.drumKitProfiles.default.hihat;
      const hihatNoise = this.audioContext.createBufferSource();
      const hihatGain = this.audioContext.createGain();
      const hihatFilter = this.audioContext.createBiquadFilter();

      const duration = h.decay;
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate hi-hat noise with proper envelope
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.pow(1 - (i / bufferSize), 4);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      hihatNoise.buffer = buffer;

      // High-pass for metallic character
      hihatFilter.type = 'highpass';
      hihatFilter.frequency.setValueAtTime(h.hpHz, currentTime);
      hihatFilter.Q.setValueAtTime(1, currentTime);

      const hihatVol = Math.max(0.001, velocity * h.vol); // BOOSTED VOLUME
      hihatGain.gain.setValueAtTime(hihatVol, currentTime);
      hihatGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      // Connect
      hihatNoise.connect(hihatFilter);
      hihatFilter.connect(hihatGain);
      hihatGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      hihatNoise.start(scheduleTime);
    } catch (error) {
      console.error('🎵 Hi-hat error:', error);
    }
  }

  private playSyntheticTom(
    currentTime: number,
    velocity: number,
    startFreq: number,
    endFreq: number,
    decay: number,
    destination?: AudioNode
  ): void {
    if (!this.audioContext) return;

    try {
      const tomOsc = this.audioContext.createOscillator();
      const tomGain = this.audioContext.createGain();
      const tomFilter = this.audioContext.createBiquadFilter();

      // Tom fundamental frequency
      tomOsc.type = 'sine';
      tomOsc.frequency.setValueAtTime(startFreq, currentTime);
      tomOsc.frequency.exponentialRampToValueAtTime(endFreq, currentTime + Math.min(0.3, decay * 0.7));

      // Mid-focused filter
      tomFilter.type = 'lowpass';
      tomFilter.frequency.setValueAtTime(600, currentTime);
      tomFilter.Q.setValueAtTime(3, currentTime);

      // Punchy envelope
      const tomVol = Math.max(0.001, velocity * 1.4);
      tomGain.gain.setValueAtTime(tomVol, currentTime);
      tomGain.gain.exponentialRampToValueAtTime(tomVol * 0.5, currentTime + 0.1);
      tomGain.gain.exponentialRampToValueAtTime(0.001, currentTime + decay);

      // Connect
      tomOsc.connect(tomFilter);
      tomFilter.connect(tomGain);
      tomGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      tomOsc.start(scheduleTime);
      tomOsc.stop(scheduleTime + decay);
    } catch (error) {
      console.error('🎵 Tom drum error:', error);
    }
  }

  private playSyntheticConga(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Conga: higher pitched tom with sharper attack
      const congaOsc = this.audioContext.createOscillator();
      const congaGain = this.audioContext.createGain();
      const congaFilter = this.audioContext.createBiquadFilter();

      congaOsc.type = 'sine';
      congaOsc.frequency.setValueAtTime(340, currentTime);
      congaOsc.frequency.exponentialRampToValueAtTime(160, currentTime + 0.2);

      // Brighter filter for conga
      congaFilter.type = 'bandpass';
      congaFilter.frequency.setValueAtTime(800, currentTime);
      congaFilter.Q.setValueAtTime(2, currentTime);

      const duration = 0.32;
      const congaVol = Math.max(0.001, velocity * 1.2);
      congaGain.gain.setValueAtTime(congaVol, currentTime);
      congaGain.gain.exponentialRampToValueAtTime(congaVol * 0.4, currentTime + 0.08);
      congaGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      congaOsc.connect(congaFilter);
      congaFilter.connect(congaGain);
      congaGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      congaOsc.start(scheduleTime);
      congaOsc.stop(scheduleTime + duration);
    } catch (error) {
      console.error('🎵 Conga error:', error);
    }
  }

  private playSyntheticPerc(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Perc: short, high-pitched metallic sound
      const percNoise = this.audioContext.createBufferSource();
      const percGain = this.audioContext.createGain();
      const percFilter = this.audioContext.createBiquadFilter();

      const duration = 0.08;
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      // Short burst of filtered noise
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.pow(1 - (i / bufferSize), 6);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      percNoise.buffer = buffer;

      // High bandpass for bright, short perc sound
      percFilter.type = 'bandpass';
      percFilter.frequency.setValueAtTime(6500, currentTime);
      percFilter.Q.setValueAtTime(4, currentTime);

      const percVol = Math.max(0.001, velocity * 0.8);
      percGain.gain.setValueAtTime(percVol, currentTime);
      percGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      percNoise.connect(percFilter);
      percFilter.connect(percGain);
      percGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      percNoise.start(scheduleTime);
    } catch (error) {
      console.error('🎵 Perc error:', error);
    }
  }

  private playSyntheticRim(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Rimshot: sharp click with brief tone
      const rimClick = this.audioContext.createOscillator();
      const rimTone = this.audioContext.createOscillator();
      const clickGain = this.audioContext.createGain();
      const toneGain = this.audioContext.createGain();
      const masterGain = this.audioContext.createGain();

      // Sharp click
      rimClick.type = 'square';
      rimClick.frequency.setValueAtTime(1800, currentTime);

      // Brief tone
      rimTone.type = 'triangle';
      rimTone.frequency.setValueAtTime(400, currentTime);

      const duration = 0.05;
      const rimVol = Math.max(0.001, velocity * 0.7);

      clickGain.gain.setValueAtTime(rimVol, currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.01);

      toneGain.gain.setValueAtTime(rimVol * 0.5, currentTime);
      toneGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      masterGain.gain.setValueAtTime(1, currentTime);

      rimClick.connect(clickGain);
      rimTone.connect(toneGain);
      clickGain.connect(masterGain);
      toneGain.connect(masterGain);
      masterGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      rimClick.start(scheduleTime);
      rimTone.start(scheduleTime);
      rimClick.stop(scheduleTime + 0.01);
      rimTone.stop(scheduleTime + duration);
    } catch (error) {
      console.error('🎵 Rimshot error:', error);
    }
  }

  private playSyntheticOpenHat(
    currentTime: number,
    velocity: number,
    profile?: { decay: number; hpHz: number; vol: number },
    destination?: AudioNode
  ): void {
    if (!this.audioContext) return;

    try {
      const h = profile || this.drumKitProfiles.default.openhat;
      const openhatNoise = this.audioContext.createBufferSource();
      const openhatGain = this.audioContext.createGain();
      const openhatFilter = this.audioContext.createBiquadFilter();

      const duration = h.decay; // Longer than closed hi-hat
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate open hi-hat noise with slower envelope
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.pow(1 - (i / bufferSize), 2); // Slower decay than closed hat
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      openhatNoise.buffer = buffer;

      // High-pass for metallic character
      openhatFilter.type = 'highpass';
      openhatFilter.frequency.setValueAtTime(h.hpHz, currentTime);
      openhatFilter.Q.setValueAtTime(1, currentTime);

      const openhatVol = Math.max(0.001, velocity * h.vol); // BOOSTED VOLUME
      openhatGain.gain.setValueAtTime(openhatVol, currentTime);
      openhatGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      // Connect
      openhatNoise.connect(openhatFilter);
      openhatFilter.connect(openhatGain);
      openhatGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      openhatNoise.start(scheduleTime);
    } catch (error) {
      console.error('🎵 Open hi-hat error:', error);
    }
  }

  private playSyntheticClap(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Create a sharp, punchy clap using filtered white noise with tight envelope
      const clapNoise = this.audioContext.createBufferSource();
      const clapGain = this.audioContext.createGain();
      const clapFilter = this.audioContext.createBiquadFilter();
      const clapFilter2 = this.audioContext.createBiquadFilter();

      const duration = 0.08;
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate tight clap noise with sharp attack
      for (let i = 0; i < bufferSize; i++) {
        const envelope = i < bufferSize * 0.1 ? 1 : Math.pow(1 - ((i - bufferSize * 0.1) / (bufferSize * 0.9)), 4);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      clapNoise.buffer = buffer;

      // Two-stage filtering for crisp clap sound
      clapFilter.type = 'highpass';
      clapFilter.frequency.setValueAtTime(800, currentTime);
      clapFilter.Q.setValueAtTime(1, currentTime);

      clapFilter2.type = 'bandpass';
      clapFilter2.frequency.setValueAtTime(2200, currentTime);
      clapFilter2.Q.setValueAtTime(3, currentTime);

      // Sharp attack, quick decay - BOOSTED VOLUME  
      const clapVol = Math.max(0.001, velocity * 1.3);
      clapGain.gain.setValueAtTime(clapVol, currentTime);
      clapGain.gain.exponentialRampToValueAtTime(clapVol * 0.3, currentTime + 0.01);
      clapGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      // Connect through both filters
      clapNoise.connect(clapFilter);
      clapFilter.connect(clapFilter2);
      clapFilter2.connect(clapGain);
      clapGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      clapNoise.start(scheduleTime);
    } catch (error) {
      console.error('🎵 Clap error:', error);
    }
  }

  private playSyntheticCrash(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Create a realistic crash using filtered white noise (like the hi-hat but longer)
      const crashNoise = this.audioContext.createBufferSource();
      const crashGain = this.audioContext.createGain();
      const crashFilter = this.audioContext.createBiquadFilter();

      const duration = 1.2; // Shorter than UFO version but still long crash
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate crash noise with natural decay
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.pow(1 - (i / bufferSize), 0.3); // Natural crash decay
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      crashNoise.buffer = buffer;

      // High-pass filter for bright metallic crash
      crashFilter.type = 'highpass';
      crashFilter.frequency.setValueAtTime(4000, currentTime);
      crashFilter.Q.setValueAtTime(0.3, currentTime);

      // Crash envelope
      const crashVol = Math.max(0.001, velocity * 1.0);
      crashGain.gain.setValueAtTime(crashVol, currentTime);
      crashGain.gain.exponentialRampToValueAtTime(crashVol * 0.4, currentTime + 0.2);
      crashGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      // Connect
      crashNoise.connect(crashFilter);
      crashFilter.connect(crashGain);
      crashGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      crashNoise.start(scheduleTime);
    } catch (error) {
      console.error('🎵 Crash cymbal error:', error);
    }
  }

  private playSyntheticBassDrum(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      const bassOsc = this.audioContext.createOscillator();
      const bassGain = this.audioContext.createGain();
      const bassFilter = this.audioContext.createBiquadFilter();

      // Much lower frequency than kick for sub-bass feel
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(50, currentTime);
      bassOsc.frequency.exponentialRampToValueAtTime(35, currentTime + 0.2);

      // Gentler low-pass filter to reduce distortion
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(100, currentTime);
      bassFilter.Q.setValueAtTime(2, currentTime);

      // Use configurable duration from settings
      const duration = this.bassDrumDuration;
      const bassVol = Math.max(0.001, velocity * 1.1);
      bassGain.gain.setValueAtTime(bassVol, currentTime);
      bassGain.gain.exponentialRampToValueAtTime(bassVol * 0.6, currentTime + 0.15);
      bassGain.gain.exponentialRampToValueAtTime(bassVol * 0.2, currentTime + duration * 0.6);
      bassGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      // Connect
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      bassOsc.start(scheduleTime);
      bassOsc.stop(scheduleTime + duration);
    } catch (error) {
      console.error('🎵 Bass drum error:', error);
    }
  }

  private playSyntheticCowbell(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Cowbell uses two square waves tuned to specific frequencies
      const osc1 = this.audioContext.createOscillator();
      const osc2 = this.audioContext.createOscillator();
      const gain1 = this.audioContext.createGain();
      const gain2 = this.audioContext.createGain();
      const masterGain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();

      // Classic cowbell frequencies (around 540Hz and 800Hz)
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(540, currentTime);
      
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(800, currentTime);

      // Bandpass filter for metallic tone
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, currentTime);
      filter.Q.setValueAtTime(1, currentTime);

      // Envelope - short, punchy
      const duration = 0.25;
      const cowbellVol = Math.max(0.001, velocity * 0.9);
      
      gain1.gain.setValueAtTime(cowbellVol * 0.5, currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);
      
      gain2.gain.setValueAtTime(cowbellVol * 0.3, currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      masterGain.gain.setValueAtTime(1, currentTime);

      // Connect
      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(filter);
      gain2.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      osc1.start(scheduleTime);
      osc2.start(scheduleTime);
      osc1.stop(scheduleTime + duration);
      osc2.stop(scheduleTime + duration);
    } catch (error) {
      console.error('🎵 Cowbell error:', error);
    }
  }

  private playSyntheticRide(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Ride cymbal: metallic noise with a bell-like tone
      const rideNoise = this.audioContext.createBufferSource();
      const rideTone = this.audioContext.createOscillator();
      const noiseGain = this.audioContext.createGain();
      const toneGain = this.audioContext.createGain();
      const rideFilter = this.audioContext.createBiquadFilter();
      const masterGain = this.audioContext.createGain();

      const duration = 0.8; // Medium sustain
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate metallic noise
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.pow(1 - (i / bufferSize), 1.5);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      rideNoise.buffer = buffer;

      // Bell tone component
      rideTone.type = 'sine';
      rideTone.frequency.setValueAtTime(3200, currentTime);

      // High-pass filter for bright metallic sound
      rideFilter.type = 'highpass';
      rideFilter.frequency.setValueAtTime(5000, currentTime);
      rideFilter.Q.setValueAtTime(0.5, currentTime);

      // Envelope
      const rideVol = Math.max(0.001, velocity * 0.8);
      
      noiseGain.gain.setValueAtTime(rideVol, currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(rideVol * 0.3, currentTime + 0.1);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      toneGain.gain.setValueAtTime(rideVol * 0.4, currentTime);
      toneGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.15);

      masterGain.gain.setValueAtTime(1, currentTime);

      // Connect
      rideNoise.connect(rideFilter);
      rideFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      
      rideTone.connect(toneGain);
      toneGain.connect(masterGain);
      
      masterGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      rideNoise.start(scheduleTime);
      rideTone.start(scheduleTime);
      rideTone.stop(scheduleTime + 0.15);
    } catch (error) {
      console.error('🎵 Ride cymbal error:', error);
    }
  }

  private playSyntheticFX(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // FX: Reverse cymbal / whoosh effect
      const fxNoise = this.audioContext.createBufferSource();
      const fxGain = this.audioContext.createGain();
      const fxFilter = this.audioContext.createBiquadFilter();

      const duration = 0.6;
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate reverse-envelope noise (builds up)
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.pow(i / bufferSize, 2); // Reverse envelope
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      fxNoise.buffer = buffer;

      // Sweeping filter
      fxFilter.type = 'lowpass';
      fxFilter.frequency.setValueAtTime(200, currentTime);
      fxFilter.frequency.exponentialRampToValueAtTime(8000, currentTime + duration);
      fxFilter.Q.setValueAtTime(2, currentTime);

      const fxVol = Math.max(0.001, velocity * 0.7);
      fxGain.gain.setValueAtTime(0.001, currentTime);
      fxGain.gain.exponentialRampToValueAtTime(fxVol, currentTime + duration * 0.8);
      fxGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      fxNoise.connect(fxFilter);
      fxFilter.connect(fxGain);
      fxGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      fxNoise.start(scheduleTime);
    } catch (error) {
      console.error('🎵 FX error:', error);
    }
  }

  private playSyntheticFoley(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Foley: Random organic sound (like a tap or knock)
      const foleyOsc = this.audioContext.createOscillator();
      const foleyNoise = this.audioContext.createBufferSource();
      const oscGain = this.audioContext.createGain();
      const noiseGain = this.audioContext.createGain();
      const foleyFilter = this.audioContext.createBiquadFilter();
      const masterGain = this.audioContext.createGain();

      // Low thud component
      foleyOsc.type = 'sine';
      foleyOsc.frequency.setValueAtTime(120, currentTime);
      foleyOsc.frequency.exponentialRampToValueAtTime(60, currentTime + 0.1);

      // Noise component for texture
      const duration = 0.15;
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.pow(1 - (i / bufferSize), 4);
        data[i] = (Math.random() * 2 - 1) * envelope * 0.3;
      }

      foleyNoise.buffer = buffer;

      // Mid-range filter
      foleyFilter.type = 'bandpass';
      foleyFilter.frequency.setValueAtTime(400, currentTime);
      foleyFilter.Q.setValueAtTime(1, currentTime);

      const foleyVol = Math.max(0.001, velocity * 0.9);
      
      oscGain.gain.setValueAtTime(foleyVol * 0.6, currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.1);

      noiseGain.gain.setValueAtTime(foleyVol * 0.4, currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      masterGain.gain.setValueAtTime(1, currentTime);

      foleyOsc.connect(oscGain);
      foleyNoise.connect(noiseGain);
      oscGain.connect(foleyFilter);
      noiseGain.connect(foleyFilter);
      foleyFilter.connect(masterGain);
      masterGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      foleyOsc.start(scheduleTime);
      foleyNoise.start(scheduleTime);
      foleyOsc.stop(scheduleTime + 0.1);
    } catch (error) {
      console.error('🎵 Foley error:', error);
    }
  }

  private playSyntheticBell(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Bell: Bright metallic tone with harmonics
      const bell1 = this.audioContext.createOscillator();
      const bell2 = this.audioContext.createOscillator();
      const bell3 = this.audioContext.createOscillator();
      const gain1 = this.audioContext.createGain();
      const gain2 = this.audioContext.createGain();
      const gain3 = this.audioContext.createGain();
      const masterGain = this.audioContext.createGain();

      // Bell harmonics (inharmonic ratios for metallic sound)
      bell1.type = 'sine';
      bell1.frequency.setValueAtTime(1200, currentTime);
      
      bell2.type = 'sine';
      bell2.frequency.setValueAtTime(1800, currentTime);
      
      bell3.type = 'sine';
      bell3.frequency.setValueAtTime(2400, currentTime);

      const duration = 0.4;
      const bellVol = Math.max(0.001, velocity * 0.8);

      gain1.gain.setValueAtTime(bellVol, currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      gain2.gain.setValueAtTime(bellVol * 0.6, currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, currentTime + duration * 0.8);

      gain3.gain.setValueAtTime(bellVol * 0.4, currentTime);
      gain3.gain.exponentialRampToValueAtTime(0.001, currentTime + duration * 0.6);

      masterGain.gain.setValueAtTime(1, currentTime);

      bell1.connect(gain1);
      bell2.connect(gain2);
      bell3.connect(gain3);
      gain1.connect(masterGain);
      gain2.connect(masterGain);
      gain3.connect(masterGain);
      masterGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      bell1.start(scheduleTime);
      bell2.start(scheduleTime);
      bell3.start(scheduleTime);
      bell1.stop(scheduleTime + duration);
      bell2.stop(scheduleTime + duration * 0.8);
      bell3.stop(scheduleTime + duration * 0.6);
    } catch (error) {
      console.error('🎵 Bell error:', error);
    }
  }

  private playSyntheticVinylFX(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Vinyl FX: Crackle and pop sound
      const vinylNoise = this.audioContext.createBufferSource();
      const vinylGain = this.audioContext.createGain();
      const vinylFilter = this.audioContext.createBiquadFilter();

      const duration = 0.2;
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate vinyl crackle (random pops and noise)
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.pow(1 - (i / bufferSize), 3);
        // Random pops mixed with noise
        const pop = Math.random() > 0.95 ? (Math.random() * 2 - 1) * 2 : 0;
        const noise = (Math.random() * 2 - 1) * 0.3;
        data[i] = (pop + noise) * envelope;
      }

      vinylNoise.buffer = buffer;

      // Mid-high filter for vinyl character
      vinylFilter.type = 'highpass';
      vinylFilter.frequency.setValueAtTime(1000, currentTime);
      vinylFilter.Q.setValueAtTime(0.7, currentTime);

      const vinylVol = Math.max(0.001, velocity * 0.6);
      vinylGain.gain.setValueAtTime(vinylVol, currentTime);
      vinylGain.gain.exponentialRampToValueAtTime(vinylVol * 0.5, currentTime + 0.05);
      vinylGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      vinylNoise.connect(vinylFilter);
      vinylFilter.connect(vinylGain);
      vinylGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      vinylNoise.start(scheduleTime);
    } catch (error) {
      console.error('🎵 Vinyl FX error:', error);
    }
  }

  private playSyntheticShaker(currentTime: number, velocity: number, destination?: AudioNode): void {
    if (!this.audioContext) return;

    try {
      // Shaker: High-frequency noise burst
      const shakerNoise = this.audioContext.createBufferSource();
      const shakerGain = this.audioContext.createGain();
      const shakerFilter = this.audioContext.createBiquadFilter();

      const duration = 0.12;
      const bufferSize = this.audioContext.sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate shaker noise
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.sin((i / bufferSize) * Math.PI); // Bell curve
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      shakerNoise.buffer = buffer;

      // High-pass filter for bright shaker sound
      shakerFilter.type = 'highpass';
      shakerFilter.frequency.setValueAtTime(4000, currentTime);
      shakerFilter.Q.setValueAtTime(1, currentTime);

      const shakerVol = Math.max(0.001, velocity * 0.7);
      shakerGain.gain.setValueAtTime(shakerVol, currentTime);
      shakerGain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      shakerNoise.connect(shakerFilter);
      shakerFilter.connect(shakerGain);
      shakerGain.connect(destination || this.audioContext.destination);

      // 50ms lookahead for smooth scheduling
      const scheduleTime = currentTime + 0.05;
      shakerNoise.start(scheduleTime);
    } catch (error) {
      console.error('🎵 Shaker error:', error);
    }
  }

  // Master volume control
  private masterVolume: number = 1.0;
  private masterGain: GainNode | null = null;

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }
}

// Export singleton instance
export const realisticAudio = new RealisticAudioEngine();
