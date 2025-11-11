/**
 * AI Pattern Generator Service
 * Converts text prompts into structured music patterns (notes, timing, instruments)
 * that can be played through the RealisticAudioEngine's high-quality soundfonts
 */

interface Note {
  pitch: string;
  duration: number; // in beats
  velocity: number; // 0-127
  time: number; // start time in beats
}

interface InstrumentPattern {
  instrument: string;
  notes: Note[];
}

interface GeneratedPattern {
  bpm: number;
  timeSignature: string;
  key: string;
  scale: string;
  patterns: InstrumentPattern[];
  metadata: {
    genre: string;
    mood: string;
    energy: number; // 0-100
    complexity: number; // 0-100
  };
}

// Music theory helpers
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

const CHORD_PROGRESSIONS = {
  pop: ['I', 'V', 'vi', 'IV'], // C-G-Am-F
  rock: ['I', 'IV', 'V', 'I'],  // C-F-G-C
  jazz: ['IIm7', 'V7', 'Imaj7'], // Dm7-G7-Cmaj7
  blues: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
  emotional: ['vi', 'IV', 'I', 'V'], // Am-F-C-G
};

const RHYTHM_PATTERNS = {
  'straight': [1, 0, 1, 0, 1, 0, 1, 0],
  'swing': [1, 0, 0, 1, 0, 0, 1, 0],
  'latin': [1, 0, 1, 1, 0, 1, 1, 0],
  'funk': [1, 0, 0, 1, 0, 0, 1, 1],
  'ballad': [1, 0, 0, 0, 1, 0, 0, 0],
};

export class PatternGenerator {
  /**
   * Analyzes the text prompt to extract musical parameters
   */
  private analyzePrompt(prompt: string): {
    genre: string;
    mood: string;
    energy: number;
    instruments: string[];
    tempo: 'slow' | 'medium' | 'fast';
  } {
    const lowerPrompt = prompt.toLowerCase();
    
    // Detect genre
    let genre = 'pop';
    if (lowerPrompt.includes('jazz')) genre = 'jazz';
    else if (lowerPrompt.includes('rock')) genre = 'rock';
    else if (lowerPrompt.includes('classical')) genre = 'classical';
    else if (lowerPrompt.includes('electronic') || lowerPrompt.includes('edm')) genre = 'electronic';
    else if (lowerPrompt.includes('hip') || lowerPrompt.includes('hop')) genre = 'hiphop';
    else if (lowerPrompt.includes('blues')) genre = 'blues';
    
    // Detect mood
    let mood = 'neutral';
    if (lowerPrompt.includes('happy') || lowerPrompt.includes('upbeat') || lowerPrompt.includes('cheerful')) mood = 'happy';
    else if (lowerPrompt.includes('sad') || lowerPrompt.includes('melancholy')) mood = 'sad';
    else if (lowerPrompt.includes('emotional') || lowerPrompt.includes('dramatic')) mood = 'emotional';
    else if (lowerPrompt.includes('calm') || lowerPrompt.includes('peaceful')) mood = 'calm';
    else if (lowerPrompt.includes('aggressive') || lowerPrompt.includes('intense')) mood = 'aggressive';
    
    // Detect energy level
    let energy = 50;
    if (lowerPrompt.includes('energetic') || lowerPrompt.includes('upbeat') || lowerPrompt.includes('fast')) energy = 80;
    else if (lowerPrompt.includes('calm') || lowerPrompt.includes('slow') || lowerPrompt.includes('relaxed')) energy = 30;
    else if (lowerPrompt.includes('intense') || lowerPrompt.includes('powerful')) energy = 90;
    
    // Detect tempo
    let tempo: 'slow' | 'medium' | 'fast' = 'medium';
    if (lowerPrompt.includes('slow') || lowerPrompt.includes('ballad')) tempo = 'slow';
    else if (lowerPrompt.includes('fast') || lowerPrompt.includes('quick') || lowerPrompt.includes('upbeat')) tempo = 'fast';
    
    // Detect instruments
    const instruments: string[] = [];
    if (lowerPrompt.includes('piano')) instruments.push('acoustic_grand_piano');
    if (lowerPrompt.includes('guitar')) instruments.push('acoustic_guitar_steel');
    if (lowerPrompt.includes('string') || lowerPrompt.includes('violin')) instruments.push('string_ensemble_1');
    if (lowerPrompt.includes('bass')) instruments.push('synth_bass_1');
    if (lowerPrompt.includes('drum')) instruments.push('drums');
    if (lowerPrompt.includes('synth')) instruments.push('lead_2_sawtooth');
    
    // Default instruments based on genre if none specified
    if (instruments.length === 0) {
      switch (genre) {
        case 'jazz':
          instruments.push('acoustic_grand_piano', 'acoustic_bass', 'tenor_sax');
          break;
        case 'rock':
          instruments.push('electric_guitar_clean', 'electric_bass_pick', 'drums');
          break;
        case 'classical':
          instruments.push('acoustic_grand_piano', 'string_ensemble_1', 'flute');
          break;
        case 'electronic':
          instruments.push('lead_2_sawtooth', 'synth_bass_2', 'drums');
          break;
        default:
          instruments.push('acoustic_grand_piano', 'synth_bass_1', 'drums');
      }
    }
    
    return { genre, mood, energy, instruments, tempo };
  }
  
  /**
   * Generates a chord progression based on genre and mood
   */
  private generateChordProgression(genre: string, key: string, bars: number = 8): string[] {
    const progressionKey = genre in CHORD_PROGRESSIONS ? genre : 'pop';
    const baseProgression = CHORD_PROGRESSIONS[progressionKey as keyof typeof CHORD_PROGRESSIONS];
    
    const progression: string[] = [];
    for (let i = 0; i < bars; i++) {
      progression.push(baseProgression[i % baseProgression.length]);
    }
    
    return progression;
  }
  
  /**
   * Converts chord symbols to actual notes
   */
  private chordToNotes(chord: string, rootNote: number, octave: number = 4): number[] {
    const notes: number[] = [];
    const baseNote = rootNote + (octave * 12);
    
    // Simple major/minor chord detection
    if (chord.includes('m')) {
      // Minor chord
      notes.push(baseNote, baseNote + 3, baseNote + 7);
    } else if (chord.includes('7')) {
      // Seventh chord
      notes.push(baseNote, baseNote + 4, baseNote + 7, baseNote + 10);
    } else {
      // Major chord
      notes.push(baseNote, baseNote + 4, baseNote + 7);
    }
    
    return notes;
  }
  
  /**
   * Converts MIDI note number to note name
   */
  private midiToNoteName(midi: number): string {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const note = notes[midi % 12];
    return `${note}${octave}`;
  }
  
  /**
   * Generates a melody pattern
   */
  private generateMelody(
    scale: number[],
    rootNote: number,
    bars: number,
    energy: number,
    complexity: number
  ): Note[] {
    const notes: Note[] = [];
    const notesPerBar = Math.floor(4 + (complexity / 25)); // 4-8 notes per bar
    const octaveRange = Math.floor(1 + (energy / 50)); // 1-3 octaves
    
    let currentTime = 0;
    
    for (let bar = 0; bar < bars; bar++) {
      for (let i = 0; i < notesPerBar; i++) {
        const scaleIndex = Math.floor(Math.random() * scale.length);
        const octaveShift = Math.floor(Math.random() * octaveRange) * 12;
        const midiNote = rootNote + scale[scaleIndex] + octaveShift + 48; // Start at C4
        
        const duration = Math.random() > 0.7 ? 0.5 : 0.25; // Mix of eighth and sixteenth notes
        const velocity = 60 + Math.floor(Math.random() * 40); // 60-100
        
        notes.push({
          pitch: this.midiToNoteName(midiNote),
          duration,
          velocity,
          time: currentTime
        });
        
        currentTime += duration;
      }
    }
    
    return notes;
  }
  
  /**
   * Generates a bass pattern
   */
  private generateBass(
    chords: string[],
    rootNote: number,
    beatsPerBar: number
  ): Note[] {
    const notes: Note[] = [];
    let currentTime = 0;
    
    chords.forEach((chord, barIndex) => {
      // Play root note on strong beats
      for (let beat = 0; beat < beatsPerBar; beat++) {
        if (beat === 0 || beat === 2) { // Play on 1 and 3
          const midiNote = rootNote + 36; // Bass octave
          notes.push({
            pitch: this.midiToNoteName(midiNote),
            duration: 0.5,
            velocity: 80,
            time: currentTime + beat
          });
        }
      }
      currentTime += beatsPerBar;
    });
    
    return notes;
  }
  
  /**
   * Generates a drum pattern
   */
  private generateDrums(
    genre: string,
    bars: number,
    energy: number
  ): Note[] {
    const notes: Note[] = [];
    const pattern = genre in RHYTHM_PATTERNS ? 
      RHYTHM_PATTERNS[genre as keyof typeof RHYTHM_PATTERNS] : 
      RHYTHM_PATTERNS['straight'];
    
    let currentTime = 0;
    
    for (let bar = 0; bar < bars; bar++) {
      pattern.forEach((hit, index) => {
        if (hit === 1) {
          // Kick drum on strong beats
          if (index % 4 === 0) {
            notes.push({
              pitch: 'C2', // Kick
              duration: 0.25,
              velocity: 90,
              time: currentTime + (index * 0.25)
            });
          }
          // Snare on backbeats
          else if (index % 4 === 2) {
            notes.push({
              pitch: 'D2', // Snare
              duration: 0.25,
              velocity: 85,
              time: currentTime + (index * 0.25)
            });
          }
          // Hi-hat
          notes.push({
            pitch: 'F#2', // Hi-hat
            duration: 0.125,
            velocity: 60 + Math.floor(Math.random() * 20),
            time: currentTime + (index * 0.25)
          });
        }
      });
      currentTime += 4; // 4 beats per bar
    }
    
    return notes;
  }
  
  /**
   * Main generation method
   */
  generatePattern(prompt: string, duration: number = 30, customBpm?: number): GeneratedPattern {
    const analysis = this.analyzePrompt(prompt);
    
    // Determine BPM based on tempo and genre
    let bpm = customBpm || 120;
    if (!customBpm) {
      switch (analysis.tempo) {
        case 'slow': bpm = 60 + Math.floor(Math.random() * 20); break;
        case 'medium': bpm = 100 + Math.floor(Math.random() * 20); break;
        case 'fast': bpm = 140 + Math.floor(Math.random() * 40); break;
      }
    }
    
    // Determine key and scale
    const rootNotes = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    const key = 'C'; // Default to C for simplicity
    const rootNote = rootNotes[key as keyof typeof rootNotes];
    const scaleName = analysis.mood === 'sad' || analysis.mood === 'emotional' ? 'minor' : 'major';
    const scale = SCALES[scaleName as keyof typeof SCALES];
    
    // Calculate bars based on duration and BPM
    const beatsPerSecond = bpm / 60;
    const totalBeats = duration * beatsPerSecond;
    const bars = Math.floor(totalBeats / 4); // 4/4 time signature
    
    // Generate chord progression
    const chords = this.generateChordProgression(analysis.genre, key, bars);
    
    // Generate patterns for each instrument
    const patterns: InstrumentPattern[] = [];
    
    // Add drums if genre needs them
    if (analysis.genre !== 'classical' && analysis.instruments.includes('drums')) {
      patterns.push({
        instrument: 'drums',
        notes: this.generateDrums(analysis.genre, bars, analysis.energy)
      });
    }
    
    // Add bass
    if (analysis.instruments.some(i => i.includes('bass'))) {
      const bassInstrument = analysis.instruments.find(i => i.includes('bass')) || 'synth_bass_1';
      patterns.push({
        instrument: bassInstrument,
        notes: this.generateBass(chords, rootNote, 4)
      });
    }
    
    // Add melody instruments
    const melodyInstruments = analysis.instruments.filter(i => 
      !i.includes('bass') && i !== 'drums'
    );
    
    melodyInstruments.forEach((instrument, index) => {
      const complexity = 50 + (index * 10); // Vary complexity for different instruments
      patterns.push({
        instrument,
        notes: this.generateMelody(scale, rootNote, bars, analysis.energy, complexity)
      });
    });
    
    return {
      bpm,
      timeSignature: '4/4',
      key,
      scale: scaleName,
      patterns,
      metadata: {
        genre: analysis.genre,
        mood: analysis.mood,
        energy: analysis.energy,
        complexity: 50
      }
    };
  }
}

export const patternGenerator = new PatternGenerator();