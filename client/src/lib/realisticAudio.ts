import Soundfont from 'soundfont-player';

export class RealisticAudioEngine {
  private instruments: { [key: string]: any} = {}
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private isLoading = false;
  private initPromise: Promise<void> | null = null; // Track initialization promise
  public bassDrumDuration = 0.8; // Configurable bass drum duration

  // Drum kit voicing profiles to give each kit a distinct sound
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

  // Map our instrument names to General MIDI soundfont names
  private instrumentLibrary: { [key: string]: string } = {
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
  }

  async initialize(): Promise<void> {
    // Return immediately if already initialized
    if (this.isInitialized) {
      console.log('🎵 Audio already initialized, skipping');
      return;
    }
    
    // If initialization is in progress, return the existing promise
    if (this.initPromise) {
      console.log('🎵 Audio initialization in progress, waiting...');
      return this.initPromise;
    }
    
    // Mark as loading and create initialization promise
    this.isLoading = true;
    
    this.initPromise = (async () => {
    try {
      // Create Web Audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      console.log('🎵 Realistic audio context created, state:', this.audioContext.state);
      console.log('🎵 Environment:', process.env.NODE_ENV || 'development');
      
      // Handle suspended context (required for browser autoplay policies)
      if (this.audioContext.state === 'suspended') {
        console.log('🎵 Audio context suspended, attempting to resume...');
        
        // Add a click listener to resume context on next user interaction
        const resumeAudio = async () => {
          if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
              await this.audioContext.resume();
              console.log('🎵 Audio context resumed successfully');
            } catch (error) {
              console.error('🎵 Failed to resume audio context:', error);
            }
          }
          document.removeEventListener('click', resumeAudio);
          document.removeEventListener('keydown', resumeAudio);
          document.removeEventListener('touchstart', resumeAudio, { passive: true } as any);
        }
        
        // Listen for user interactions to resume audio (passive listeners for mobile)
        document.addEventListener('click', resumeAudio, { once: true });
        document.addEventListener('keydown', resumeAudio, { once: true });
        document.addEventListener('touchstart', resumeAudio, { once: true, passive: true });
        
        // Don't try to resume immediately - wait for user interaction
        console.log('🎵 Audio context needs user interaction to resume');
      }

      console.log('🎵 Realistic audio context started, final state:', this.audioContext.state);

      // Load ONLY essential instruments on mobile for better performance
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const essentialInstruments = isMobile
        ? ['piano', 'guitar', 'bass-electric', 'strings'] // Minimal set for mobile
        : ['piano', 'guitar', 'strings-guitar', 'violin', 'flute', 'trumpet', 
           'piano-organ', 'bass-electric', 'strings-violin',
           'horns-trumpet', 'flute-concert', 'strings', 
           'synth-analog', 'leads-square'];
      
      console.log(`🎵 Loading ${essentialInstruments.length} instruments (mobile: ${isMobile})`);
      
      // Load instruments with timeout protection for mobile
      await Promise.race([
        this.loadInstruments(essentialInstruments),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Instrument loading timeout')), isMobile ? 10000 : 20000)
        )
      ]).catch(error => {
        console.warn('⚠️ Some instruments failed to load, continuing anyway:', error);
      });
      
      this.isInitialized = true;
      this.isLoading = false;
      console.log('🎵 Realistic audio engine initialized');
    } catch (error) {
      console.error('Failed to initialize realistic audio engine:', error);
      this.isLoading = false;
      // Don't throw - allow app to continue with limited functionality
      this.isInitialized = true; // Mark as initialized anyway
    } finally {
      this.initPromise = null; // Clear promise after completion
    }
    })(); // End of async IIFE
    
    return this.initPromise; // Return the initialization promise
  }

  public async resume(): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    if (this.audioContext && this.audioContext.state !== 'running') {
      await this.audioContext.resume();
      console.log('RealisticAudio context resumed');
    }
  }

  private async loadInstruments(instrumentNames: string[]): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const loadPromises = instrumentNames.map(async (name) => {
      if (this.instruments[name] || !(name in this.instrumentLibrary)) {
        return;
      }

      try {
        const soundfontName = this.instrumentLibrary[name];
        console.log(`🎵 Loading realistic ${name} instrument (${soundfontName})`);
        
        const instrument = await Soundfont.instrument(
          this.audioContext!, 
          soundfontName as any, // Type assertion for soundfont-player compatibility
          {
            format: 'mp3', // Use MP3 for better browser compatibility
            soundfont: 'FluidR3_GM', // Standard General MIDI soundfont (more reliable)
            nameToUrl: (name: string, soundfont: string, format: string) => {
              // Use the standard gleitz repo which hosts FluidR3_GM
              return `https://gleitz.github.io/midi-js-soundfonts/${soundfont}/${name}-${format}.js`;
            }
          }
        );
        
        this.instruments[name] = instrument;
        console.log(`🎵 Loaded realistic ${name} instrument successfully`);
      } catch (error) {
        console.error(`🎵 Failed to load ${name} instrument:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  async loadAdditionalInstrument(instrumentName: string): Promise<void> {
    if (this.instruments[instrumentName] || !(instrumentName in this.instrumentLibrary) || !this.audioContext) {
      return;
    }

    try {
      console.log(`Loading additional realistic ${instrumentName} instrument`);
      
      const soundfontName = this.instrumentLibrary[instrumentName];
      const instrument = await Soundfont.instrument(
        this.audioContext, 
        soundfontName as any, // Type assertion for soundfont-player compatibility
        {
          format: 'mp3',
          soundfont: 'FluidR3_GM',
          nameToUrl: (name: string, soundfont: string, format: string) => {
            return `https://gleitz.github.io/midi-js-soundfonts/${soundfont}/${name}-${format}.js`;
          }
        }
      );
      
      this.instruments[instrumentName] = instrument;
      console.log(`Loaded additional realistic ${instrumentName} instrument successfully`);
    } catch (error) {
      console.error(`Failed to load additional ${instrumentName} instrument:`, error);
    }
  }

  async playNote(
    note: string, 
    octave: number, 
    duration: number, 
    instrument: string = 'piano', 
    velocity: number = 0.7,
    sustainEnabled: boolean = true
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
      console.log('🎵 Audio context suspended, resuming...');
      try {
        await this.audioContext.resume();
        console.log('🎵 Audio context resumed for playback');
      } catch (e) {
        console.warn('🎵 Failed to resume audio context:', e);
      }
    }
    
    // NOTE: Removed octave clamping to allow full octave range (0-8)
    // Soundfonts support wider range than originally assumed
    let adjustedOctave = octave;

    // Use the instrument key directly, or fallback to legacy mapping
    let realInstrument = instrument;
    
    // If instrument not loaded, try fallback mapping to available instruments
    if (!this.instruments[realInstrument]) {
      // Ensure instrument is a string before using .includes()
      const instrumentStr = String(instrument || 'piano').toLowerCase();
      
      // Map to instruments that are actually loaded (from essentialInstruments list)
      if (instrumentStr.includes('piano') || instrumentStr.includes('keyboard') || instrumentStr.includes('grand')) {
        realInstrument = 'piano';
      } else if (instrumentStr.includes('guitar') || instrumentStr.includes('string')) {
        realInstrument = 'guitar';
      } else if (instrumentStr.includes('violin')) {
        realInstrument = 'violin';
      } else if (instrumentStr.includes('flute')) {
        realInstrument = 'flute';
      } else if (instrumentStr.includes('trumpet') || instrumentStr.includes('horn')) {
        realInstrument = 'trumpet';
      } else if (instrumentStr.includes('bass') || instrumentStr.includes('synth_bass')) {
        realInstrument = 'bass-electric';
      } else if (instrumentStr.includes('organ')) {
        realInstrument = 'piano-organ';
      } else if (instrumentStr.includes('synth') || instrumentStr.includes('analog')) {
        realInstrument = 'synth-analog';
      } else if (instrumentStr.includes('lead') || instrumentStr.includes('sawtooth') || instrumentStr.includes('square')) {
        realInstrument = 'leads-square';
      } else if (instrumentStr.includes('pad') || instrumentStr.includes('warm')) {
        realInstrument = 'strings'; // Use strings as fallback for pads
      } else {
        realInstrument = 'piano'; // Ultimate fallback
      }
    }
    
    const instrumentSampler = this.instruments[realInstrument];
    if (!instrumentSampler) {
      console.error(`❌ Instrument ${realInstrument} not loaded - available instruments:`, Object.keys(this.instruments));
      console.log('🎵 DEBUG: Trying to load instrument on-demand...');
      try {
        await this.loadAdditionalInstrument(realInstrument);
        const retrySampler = this.instruments[realInstrument];
        if (!retrySampler) {
          console.error(`❌ Still failed to load ${realInstrument}`);
          return;
        }
      } catch (loadError) {
        console.error(`❌ Failed to load ${realInstrument} on-demand:`, loadError);
        return;
      }
    }

    try {
      const noteWithOctave = `${note}${adjustedOctave}`;
      // Only log in debug mode to reduce console spam
      if (process.env.NODE_ENV === 'development') {
        console.debug(`🎵 Playing ${realInstrument}: ${noteWithOctave}`);
      }

      const audioNode = this.instruments[realInstrument].play(noteWithOctave, this.audioContext!.currentTime, {
        duration,
        gain: velocity
      });

      if (!audioNode) {
        // Sample not available for this octave - silently fall back to synthetic
        // This is expected for extreme octaves (E8, A8, etc.) - not an error
        await this.fallbackToSynthetic(note, adjustedOctave, duration, velocity);
      }
    } catch (error) {
      // Silently fall back to synthetic for unsupported notes
      // This is expected behavior, not an error worth logging
      await this.fallbackToSynthetic(note, adjustedOctave, duration, velocity);
    }
  }

  async playDrumSound(drumType: string, velocity: number = 0.7, kit: string = 'default'): Promise<void> {
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
    
    try {
      // Recreate the professional drum synthesis here
      switch (drumType) {
        case 'kick':
          this.playSyntheticKick(currentTime, velocity, kitProfile.kick);
          break;
        case 'bass': // Deeper, sub-bass drum
          this.playSyntheticBassDrum(currentTime, velocity);
          break;
        case 'snare':
          this.playSyntheticSnare(currentTime, velocity, kitProfile.snare);
          break;
        case 'hihat':
          this.playSyntheticHihat(currentTime, velocity, kitProfile.hihat);
          break;
        case 'openhat':
          this.playSyntheticOpenHat(currentTime, velocity, kitProfile.openhat);
          break;
        case 'tom':
          this.playSyntheticTom(currentTime, velocity, kitProfile.tom);
          break;
        case 'tom_hi':
          // Slightly higher tom
          this.playSyntheticTom(currentTime, Math.min(1, velocity * 0.95), kitProfile.tom);
          break;
        case 'tom_mid':
          this.playSyntheticTom(currentTime, velocity, kitProfile.tom);
          break;
        case 'tom_lo':
          // Slightly deeper, heavier tom
          this.playSyntheticTom(currentTime, Math.min(1, velocity * 1.05), kitProfile.tom);
          break;
        case 'conga':
          // Conga-style: reuse tom but a bit brighter
          this.playSyntheticTom(currentTime, Math.min(1, velocity * 0.9), kitProfile.tom);
          break;
        case 'clap':
          this.playSyntheticClap(currentTime, velocity);
          break;
        case 'perc':
          // Perc: shorter, clickier clap
          this.playSyntheticClap(currentTime, Math.min(1, velocity * 0.8));
          break;
        case 'rim':
          // Rimshot-ish: also clap-based but quieter
          this.playSyntheticClap(currentTime, Math.min(1, velocity * 0.7));
          break;
        case 'crash':
          this.playSyntheticCrash(currentTime, velocity);
          break;
        case 'fx':
          // FX: use crash with lower velocity so it sits back in the mix
          this.playSyntheticCrash(currentTime, Math.min(1, velocity * 0.6));
          break;
        default:
          console.warn(`🎵 Unknown drum type: ${drumType}`);
      }
    } catch (error) {
      console.error('🎵 Drum sound error:', error);
    }
  }

  // Fallback to synthetic audio generation for unsupported octaves
  private async fallbackToSynthetic(note: string, octave: number, duration: number, velocity: number): Promise<void> {
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
      gainNode.connect(this.audioContext.destination);

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

  // Stop all playing sounds
  stopAllSounds() {
    if (this.audioContext) {
      this.audioContext.close().then(() => {
        this.audioContext = null;
        this.isInitialized = false;
        this.instruments = {};
      });
    }
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
  }): void {
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
      kickGain.connect(this.audioContext.destination);

      kickClickOsc.connect(kickClickGain);
      kickClickGain.connect(this.audioContext.destination);

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
    }
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
      snareGain.connect(this.audioContext.destination);

      snareTone.connect(snareToneGain);
      snareToneGain.connect(this.audioContext.destination);

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
    profile?: { decay: number; hpHz: number; vol: number }
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
      hihatGain.connect(this.audioContext.destination);

      hihatNoise.start(currentTime);
    } catch (error) {
      console.error('🎵 Hi-hat error:', error);
    }
  }

  private playSyntheticTom(
    currentTime: number,
    velocity: number,
    profile?: { startFreq: number; endFreq: number; filterHz: number; vol: number; decay: number }
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
      tomGain.connect(this.audioContext.destination);

      tomOsc.start(currentTime);
      tomOsc.stop(currentTime + t.decay);
    } catch (error) {
      console.error('🎵 Tom drum error:', error);
    }
  }

  private playSyntheticOpenHat(
    currentTime: number,
    velocity: number,
    profile?: { decay: number; hpHz: number; vol: number }
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
      openhatGain.connect(this.audioContext.destination);

      openhatNoise.start(currentTime);
    } catch (error) {
      console.error('🎵 Open hi-hat error:', error);
    }
  }

  private playSyntheticClap(currentTime: number, velocity: number): void {
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
      clapGain.connect(this.audioContext.destination);

      clapNoise.start(currentTime);
    } catch (error) {
      console.error('🎵 Clap error:', error);
    }
  }

  private playSyntheticCrash(currentTime: number, velocity: number): void {
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
      crashGain.connect(this.audioContext.destination);

      crashNoise.start(currentTime);
    } catch (error) {
      console.error('🎵 Crash cymbal error:', error);
    }
  }

  private playSyntheticBassDrum(currentTime: number, velocity: number): void {
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
      bassGain.connect(this.audioContext.destination);

      bassOsc.start(currentTime);
      bassOsc.stop(currentTime + duration);
    } catch (error) {
      console.error('🎵 Bass drum error:', error);
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
