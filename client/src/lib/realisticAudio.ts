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
    // Periodic cleanup of finished nodes every 5 seconds
    setInterval(() => this.cleanupFinishedNodes(), 5000);
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
          // Track active node for cleanup/noteOff
          const noteKey = `${realInstrument}:${noteName}`;
          if (!this.activeNotes.has(noteKey)) {
            this.activeNotes.set(noteKey, []);
          }
          this.activeNotes.get(noteKey)?.push(audioNode);

          // If duration is provided, automatically schedule removal from tracking
          if (duration > 0) {
            setTimeout(() => {
              const nodes = this.activeNotes.get(noteKey);
              if (nodes) {
                const index = nodes.indexOf(audioNode);
                if (index > -1) nodes.splice(index, 1);
                if (nodes.length === 0) this.activeNotes.delete(noteKey);
              }
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
          this.playSyntheticTom(currentTime, velocity, kitProfile.tom, destination);
          break;
        case 'tom_hi':
          // Slightly higher tom
          this.playSyntheticTom(currentTime, Math.min(1, velocity * 0.95), kitProfile.tom, destination);
          break;
        case 'tom_mid':
          this.playSyntheticTom(currentTime, velocity, kitProfile.tom, destination);
          break;
        case 'tom_lo':
          // Slightly deeper, heavier tom
          this.playSyntheticTom(currentTime, Math.min(1, velocity * 1.05), kitProfile.tom, destination);
          break;
        case 'conga':
          // Conga-style: reuse tom but a bit brighter
          this.playSyntheticTom(currentTime, Math.min(1, velocity * 0.9), kitProfile.tom, destination);
          break;
        case 'clap':
          this.playSyntheticClap(currentTime, velocity, destination);
          break;
        case 'perc':
          // Perc: shorter, clickier clap
          this.playSyntheticClap(currentTime, Math.min(1, velocity * 0.8), destination);
          break;
        case 'rim':
          // Rimshot-ish: also clap-based but quieter
          this.playSyntheticClap(currentTime, Math.min(1, velocity * 0.7), destination);
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
          // FX: use crash with lower velocity so it sits back in the mix
          this.playSyntheticCrash(currentTime, Math.min(1, velocity * 0.6), destination);
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
      const kickOsc = this.audioContext.createOscillator();
      const kickClickOsc = this.audioContext.createOscillator();
      const kickGain = this.audioContext.createGain();
      const kickClickGain = this.audioContext.createGain();
      const kickFilter = this.audioContext.createBiquadFilter();

      // Main kick - deep sine wave
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(k.pitchStart, currentTime);
      kickOsc.frequency.exponentialRampToValueAtTime(k.pitchEnd, currentTime + k.pitchSweep);

      // Click/beater attack
      kickClickOsc.type = 'triangle';
      kickClickOsc.frequency.setValueAtTime(1200, currentTime);
      kickClickOsc.frequency.exponentialRampToValueAtTime(800, currentTime + 0.01);

      // Tight filter for definition
      kickFilter.type = 'lowpass';
      kickFilter.frequency.setValueAtTime(k.filterHz, currentTime);
      kickFilter.Q.setValueAtTime(k.filterQ, currentTime);

      // Main kick envelope - punchy decay - BOOSTED VOLUME
      const kickVol = Math.max(0.001, velocity * k.bodyGain);
      kickGain.gain.setValueAtTime(kickVol, currentTime);
      kickGain.gain.exponentialRampToValueAtTime(kickVol * 0.6, currentTime + Math.min(0.08, k.bodyDecay * 0.35));
      kickGain.gain.exponentialRampToValueAtTime(0.001, currentTime + k.bodyDecay);

      // Softer click envelope - reduced volume and smoother attack to eliminate harsh clicking
      const clickVol = Math.max(0.001, velocity * k.clickVol); // Kit-shaped click
      kickClickGain.gain.setValueAtTime(0.001, currentTime); // Start from zero to smooth attack
      kickClickGain.gain.exponentialRampToValueAtTime(clickVol, currentTime + 0.003); // Gentle rise
      kickClickGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.02); // Slightly longer decay

      // Connect
      kickOsc.connect(kickFilter);
      kickFilter.connect(kickGain);
      kickGain.connect(destination || this.audioContext.destination);

      kickClickOsc.connect(kickClickGain);
      kickClickGain.connect(destination || this.audioContext.destination);

      kickOsc.start(currentTime);
      kickClickOsc.start(currentTime);
      kickOsc.stop(currentTime + k.bodyDecay);
      kickClickOsc.stop(currentTime + 0.015);
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

      snareNoise.start(currentTime);
      snareTone.start(currentTime);
      snareTone.stop(currentTime + s.toneDecay);
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

      hihatNoise.start(currentTime);
    } catch (error) {
      console.error('🎵 Hi-hat error:', error);
    }
  }

  private playSyntheticTom(
    currentTime: number,
    velocity: number,
    profile?: { startFreq: number; endFreq: number; filterHz: number; vol: number; decay: number },
    destination?: AudioNode
  ): void {
    if (!this.audioContext) return;

    try {
      const t = profile || this.drumKitProfiles.default.tom;
      const tomOsc = this.audioContext.createOscillator();
      const tomGain = this.audioContext.createGain();
      const tomFilter = this.audioContext.createBiquadFilter();

      // Tom fundamental frequency
      tomOsc.type = 'sine';
      tomOsc.frequency.setValueAtTime(t.startFreq, currentTime);
      tomOsc.frequency.exponentialRampToValueAtTime(t.endFreq, currentTime + Math.min(0.3, t.decay * 0.7));

      // Mid-focused filter
      tomFilter.type = 'lowpass';
      tomFilter.frequency.setValueAtTime(t.filterHz, currentTime);
      tomFilter.Q.setValueAtTime(3, currentTime);

      // Punchy envelope - BOOSTED VOLUME
      const tomVol = Math.max(0.001, velocity * t.vol);
      tomGain.gain.setValueAtTime(tomVol, currentTime);
      tomGain.gain.exponentialRampToValueAtTime(tomVol * 0.5, currentTime + 0.1);
      tomGain.gain.exponentialRampToValueAtTime(0.001, currentTime + t.decay);

      // Connect
      tomOsc.connect(tomFilter);
      tomFilter.connect(tomGain);
      tomGain.connect(destination || this.audioContext.destination);

      tomOsc.start(currentTime);
      tomOsc.stop(currentTime + t.decay);
    } catch (error) {
      console.error('🎵 Tom drum error:', error);
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

      openhatNoise.start(currentTime);
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

      clapNoise.start(currentTime);
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

      crashNoise.start(currentTime);
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

      bassOsc.start(currentTime);
      bassOsc.stop(currentTime + duration);
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

      osc1.start(currentTime);
      osc2.start(currentTime);
      osc1.stop(currentTime + duration);
      osc2.stop(currentTime + duration);
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

      rideNoise.start(currentTime);
      rideTone.start(currentTime);
      rideTone.stop(currentTime + 0.15);
    } catch (error) {
      console.error('🎵 Ride cymbal error:', error);
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
