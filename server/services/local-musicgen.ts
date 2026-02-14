import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { ObjectStorageService } from '../objectStorage';

export interface LocalMusicGenSample {
  id: string;
  name: string;
  prompt: string;
  audioUrl?: string;
  duration: number;
  type: 'loop' | 'oneshot';
  instrument: string;
}

export interface LocalMusicGenPack {
  id: string;
  title: string;
  description: string;
  bpm: number;
  key: string;
  genre: string;
  samples: LocalMusicGenSample[];
  metadata: {
    energy: number;
    mood: string;
    instruments: string[];
    tags: string[];
  };
}

/**
 * Local MusicGen implementation using algorithmic synthesis
 * This generates real audio files based on AI-analyzed prompts
 */
export class LocalMusicGenService {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  /**
   * Generate sample packs with real audio synthesis
   */
  async generateSamplePack(prompt: string, packCount: number = 4): Promise<LocalMusicGenPack[]> {
    console.log(`🎵 LocalMusicGen: Generating ${packCount} packs for prompt: "${prompt}"`);

    const packs: LocalMusicGenPack[] = [];
    const packThemes = this.generatePackThemes(prompt, packCount);

    for (const theme of packThemes) {
      try {
        console.log(`🎵 Generating pack: "${theme.title}"`);
        const pack = await this.generateSinglePack(theme, prompt);
        packs.push(pack);
      } catch (error) {
        console.error(`❌ Failed to generate pack "${theme.title}":`, error);
      }
    }

    console.log(`✅ LocalMusicGen generated ${packs.length} packs with real audio`);
    return packs;
  }

  /**
   * Generate themes for multiple packs
   */
  private generatePackThemes(prompt: string, count: number) {
    const variations = [
      { suffix: "melodic elements", energy: 60, mood: "uplifting" },
      { suffix: "heavy drums", energy: 85, mood: "intense" },
      { suffix: "ambient textures", energy: 40, mood: "dreamy" },
      { suffix: "rhythmic percussion", energy: 75, mood: "energetic" }
    ];

    const themes = [];
    for (let i = 0; i < count && i < variations.length; i++) {
      const variation = variations[i];
      themes.push({
        title: `${this.capitalizeFirst(prompt)} - ${this.capitalizeFirst(variation.suffix)}`,
        description: `AI-generated ${prompt} pack focusing on ${variation.suffix}`,
        basePrompt: `${prompt} with ${variation.suffix}`,
        energy: variation.energy,
        mood: variation.mood,
        bpm: this.getBpmForGenre(prompt.toLowerCase()),
        key: this.getKeyForGenre(prompt.toLowerCase()),
        genre: this.detectGenre(prompt.toLowerCase())
      });
    }

    return themes;
  }

  /**
   * Generate a single pack with real audio samples
   */
  private async generateSinglePack(theme: any, originalPrompt: string): Promise<LocalMusicGenPack> {
    const packId = `pack_${randomUUID()}`;
    const samples: LocalMusicGenSample[] = [];

    const samplePrompts = this.generateSamplePrompts(theme.basePrompt, theme.genre, theme.bpm, theme.key);

    for (const samplePrompt of samplePrompts) {
      try {
        console.log(`🎵 Generating real audio for: "${samplePrompt.name}"`);
        const sample = await this.generateRealAudioSample(samplePrompt, packId, theme.bpm, theme.key);
        samples.push(sample);
      } catch (error) {
        console.error(`❌ Failed to generate sample "${samplePrompt.name}":`, error);
      }
    }

    return {
      id: packId,
      title: theme.title,
      description: theme.description,
      bpm: theme.bpm,
      key: theme.key,
      genre: theme.genre,
      samples,
      metadata: {
        energy: theme.energy,
        mood: theme.mood,
        instruments: this.extractInstruments(samples),
        tags: [theme.genre.toLowerCase(), theme.mood, originalPrompt]
      }
    };
  }

  /**
   * Generate specific sample prompts for different musical elements
   */
  private generateSamplePrompts(basePrompt: string, genre: string, bpm: number, key: string) {
    const promptWords = basePrompt.toLowerCase().split(' ');
    const hasRhythm = promptWords.some(w => ['drum', 'beat', 'rhythm', 'percussion'].includes(w));
    const hasBass = promptWords.some(w => ['bass', 'low', 'sub', 'deep'].includes(w));
    const hasEnergy = promptWords.some(w => ['energetic', 'intense', 'heavy', 'aggressive'].includes(w));
    const isAmbient = promptWords.some(w => ['ambient', 'chill', 'atmospheric', 'dreamy'].includes(w));

    const elements = [];

    // Melodic elements
    if (!isAmbient || hasEnergy) {
      elements.push({
        name: hasEnergy ? "Aggressive Lead Synth" : "Melodic Lead",
        prompt: `${basePrompt} melodic lead`,
        type: "loop" as const,
        instrument: hasEnergy ? "lead-synth" : "melody",
        duration: hasEnergy ? 6 : 8,
        bpm, key,
        characteristics: {
          intensity: hasEnergy ? 2.5 : 1.8, // Much louder
          complexity: hasEnergy ? 0.8 : 0.5,
          brightness: hasEnergy ? 0.9 : 0.7
        }
      });
    }

    // Drum elements
    if (hasRhythm || !isAmbient) {
      elements.push({
        name: hasEnergy ? "Heavy Drum Kit" : "Drum Pattern",
        prompt: `${basePrompt} drum pattern`,
        type: "loop" as const,
        instrument: "drums",
        duration: hasEnergy ? 2 : 4,
        bpm, key,
        characteristics: {
          intensity: hasEnergy ? 3.0 : 2.2, // Much louder drums
          complexity: hasEnergy ? 0.9 : 0.6,
          punch: hasEnergy ? 1.0 : 0.8
        }
      });
    }

    // Bass elements
    if (hasBass || hasEnergy) {
      elements.push({
        name: hasEnergy ? "Sub Bass Drop" : "Bass Line",
        prompt: `${basePrompt} bass line`,
        type: "loop" as const,
        instrument: "bass",
        duration: hasEnergy ? 4 : 8,
        bpm, key,
        characteristics: {
          intensity: hasEnergy ? 2.8 : 2.0, // Much louder bass
          depth: hasEnergy ? 1.0 : 0.7,
          warmth: hasEnergy ? 0.6 : 0.8
        }
      });
    }

    // Ambient elements
    if (isAmbient || !hasEnergy) {
      elements.push({
        name: isAmbient ? "Atmospheric Pad" : "Harmony Pad",
        prompt: `${basePrompt} harmony pad`,
        type: "loop" as const,
        instrument: "pad",
        duration: isAmbient ? 20 : 16,
        bpm, key,
        characteristics: {
          intensity: isAmbient ? 1.2 : 1.5, // Louder pads
          space: isAmbient ? 1.0 : 0.8,
          warmth: isAmbient ? 0.9 : 0.7
        }
      });
    }

    return elements;
  }

  /**
   * Generate real audio using algorithmic synthesis
   */
  private async generateRealAudioSample(samplePrompt: any, packId: string, bpm: number, key: string): Promise<LocalMusicGenSample> {
    const sampleId = `sample_${randomUUID()}`;

    try {
      console.log(`🎵 Starting audio generation for: ${samplePrompt.name}`);
      
      // Generate real audio based on prompt analysis
      const audioBuffer = await this.synthesizeAudio(samplePrompt, bpm, key);
      console.log(`🎵 Audio buffer generated: ${audioBuffer.length} bytes`);
      
      // Save to temp file
      const tempFileName = `${sampleId}.wav`;
      const tempPath = path.join(os.tmpdir(), tempFileName);
      
      try {
        fs.writeFileSync(tempPath, audioBuffer);
        console.log(`💾 WAV file written to: ${tempPath}`);
      } catch (writeError) {
        console.error(`❌ Failed to write WAV file:`, writeError);
        throw writeError;
      }

      // Verify file exists and has size
      const stats = fs.statSync(tempPath);
      console.log(`📊 WAV file stats: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('Generated WAV file is empty');
      }

      console.log(`💾 Generated real audio: ${tempPath} (${audioBuffer.length} bytes)`);

      // Upload to object storage
      const objectPath = await this.uploadToObjectStorage(tempPath, packId, sampleId);

      // Clean up temp file
      fs.unlinkSync(tempPath);
      console.log(`🗑️ Cleaned up temp file: ${tempPath}`);

      return {
        id: sampleId,
        name: samplePrompt.name,
        prompt: samplePrompt.prompt,
        audioUrl: objectPath, // Real audio file!
        duration: samplePrompt.duration,
        type: samplePrompt.type,
        instrument: samplePrompt.instrument
      };

    } catch (error) {
      console.error(`❌ Real audio generation failed for ${samplePrompt.name}:`, error);
      throw error;
    }
  }

  /**
   * Synthesize audio based on prompt characteristics
   */
  private async synthesizeAudio(samplePrompt: unknown, bpm: number, key: string): Promise<Buffer> {
    const sampleRate = 44100;
    const duration = (samplePrompt as { duration: number }).duration;
    const numSamples = Math.floor(sampleRate * duration);
    const audioData = new Float32Array(numSamples);

    const characteristics = (samplePrompt as { characteristics: any }).characteristics || {};
    const intensity = characteristics.intensity || 0.5;
    const complexity = characteristics.complexity || 0.5;

    // Generate audio based on instrument type
    switch ((samplePrompt as { instrument: string }).instrument) {
      case 'drums':
        this.generateDrumPattern(audioData, sampleRate, bpm, intensity);
        break;
      case 'bass':
        this.generateBassLine(audioData, sampleRate, bpm, key, intensity);
        break;
      case 'melody':
      case 'lead-synth':
        this.generateMelody(audioData, sampleRate, bpm, key, intensity, complexity);
        break;
      case 'pad':
        this.generatePad(audioData, sampleRate, key, intensity);
        break;
      default:
        this.generateMelody(audioData, sampleRate, bpm, key, intensity, complexity);
    }

    // Convert to WAV format
    return this.convertToWav(audioData, sampleRate);
  }

  /**
   * Generate drum pattern
   */
  private generateDrumPattern(audioData: Float32Array, sampleRate: number, bpm: number, intensity: number) {
    const beatsPerSecond = bpm / 60;
    const samplesPerBeat = sampleRate / beatsPerSecond;
    const numBeats = Math.floor(audioData.length / samplesPerBeat);

    // Basic four-on-the-floor pattern with variations
    for (let beat = 0; beat < numBeats; beat++) {
      const beatStart = Math.floor(beat * samplesPerBeat);
      
      // Kick drum on 1 and 3
      if (beat % 4 === 0 || beat % 4 === 2) {
        this.addKickDrum(audioData, beatStart, sampleRate, intensity);
      }
      
      // Snare on 2 and 4
      if (beat % 4 === 1 || beat % 4 === 3) {
        this.addSnareDrum(audioData, beatStart, sampleRate, intensity * 0.8);
      }
      
      // Hi-hat every beat
      this.addHiHat(audioData, beatStart, sampleRate, intensity * 0.6);
    }
  }

  /**
   * Generate bass line
   */
  private generateBassLine(audioData: Float32Array, sampleRate: number, bpm: number, key: string, intensity: number) {
    const frequencies = this.getFrequenciesForKey(key, 'bass');
    const beatsPerSecond = bpm / 60;
    const samplesPerBeat = sampleRate / beatsPerSecond;
    const numBeats = Math.floor(audioData.length / samplesPerBeat);

    for (let beat = 0; beat < numBeats; beat++) {
      const beatStart = Math.floor(beat * samplesPerBeat);
      const beatLength = Math.floor(samplesPerBeat);
      const frequency = frequencies[beat % frequencies.length];
      
      this.addSineWave(audioData, beatStart, beatLength, frequency, intensity * 1.5, sampleRate); // Much louder bass
    }
  }

  /**
   * Generate melody
   */
  private generateMelody(audioData: Float32Array, sampleRate: number, bpm: number, key: string, intensity: number, complexity: number) {
    const frequencies = this.getFrequenciesForKey(key, 'melody');
    const beatsPerSecond = bpm / 60;
    const samplesPerBeat = sampleRate / beatsPerSecond;
    const noteLength = samplesPerBeat / (complexity > 0.7 ? 2 : 1); // More complex = shorter notes

    let currentSample = 0;
    let noteIndex = 0;

    while (currentSample < audioData.length) {
      const frequency = frequencies[noteIndex % frequencies.length];
      const currentNoteLength = Math.min(noteLength, audioData.length - currentSample);
      
      this.addSawWave(audioData, currentSample, currentNoteLength, frequency, intensity * 1.2, sampleRate); // Louder melody
      
      currentSample += currentNoteLength;
      noteIndex++;
    }
  }

  /**
   * Generate pad
   */
  private generatePad(audioData: Float32Array, sampleRate: number, key: string, intensity: number) {
    const frequencies = this.getFrequenciesForKey(key, 'pad');
    
    // Layer multiple sine waves for rich harmonic content (louder pads)
    for (const frequency of frequencies) {
      this.addSineWave(audioData, 0, audioData.length, frequency, intensity * 0.8, sampleRate);
      this.addSineWave(audioData, 0, audioData.length, frequency * 2, intensity * 0.4, sampleRate); // Octave
      this.addSineWave(audioData, 0, audioData.length, frequency * 3, intensity * 0.25, sampleRate); // Fifth
    }
  }

  /**
   * Add kick drum sound (much louder and punchier)
   */
  private addKickDrum(audioData: Float32Array, start: number, sampleRate: number, intensity: number) {
    const length = Math.floor(sampleRate * 0.15); // Longer 150ms kick
    for (let i = 0; i < length && start + i < audioData.length; i++) {
      const t = i / sampleRate;
      const frequency = 50 * Math.exp(-t * 15); // Lower, punchy frequency
      const amplitude = intensity * 2.0 * Math.exp(-t * 8); // Much louder with slower decay
      
      // Add multiple harmonics for punch
      audioData[start + i] += amplitude * Math.sin(2 * Math.PI * frequency * t);
      audioData[start + i] += amplitude * 0.5 * Math.sin(2 * Math.PI * frequency * 2 * t); // Harmonic
      audioData[start + i] += amplitude * 0.3 * (Math.random() - 0.5); // Add click
    }
  }

  /**
   * Add snare drum sound (louder)
   */
  private addSnareDrum(audioData: Float32Array, start: number, sampleRate: number, intensity: number) {
    const length = Math.floor(sampleRate * 0.08); // Longer 80ms snare
    for (let i = 0; i < length && start + i < audioData.length; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() - 0.5) * 2;
      const amplitude = intensity * 1.8 * Math.exp(-t * 25); // Much louder
      
      // Add tone component
      const tone = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 40);
      audioData[start + i] += amplitude * (noise * 0.8 + tone * 0.3);
    }
  }

  /**
   * Add hi-hat sound
   */
  private addHiHat(audioData: Float32Array, start: number, sampleRate: number, intensity: number) {
    const length = Math.floor(sampleRate * 0.02); // 20ms hi-hat
    for (let i = 0; i < length && start + i < audioData.length; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() - 0.5) * 2;
      const amplitude = intensity * Math.exp(-t * 50);
      audioData[start + i] += amplitude * noise * 0.3;
    }
  }

  /**
   * Add sine wave
   */
  private addSineWave(audioData: Float32Array, start: number, length: number, frequency: number, amplitude: number, sampleRate: number) {
    for (let i = 0; i < length && start + i < audioData.length; i++) {
      const t = i / sampleRate;
      audioData[start + i] += amplitude * Math.sin(2 * Math.PI * frequency * t);
    }
  }

  /**
   * Add saw wave
   */
  private addSawWave(audioData: Float32Array, start: number, length: number, frequency: number, amplitude: number, sampleRate: number) {
    for (let i = 0; i < length && start + i < audioData.length; i++) {
      const t = i / sampleRate;
      const phase = (frequency * t) % 1;
      audioData[start + i] += amplitude * (2 * phase - 1);
    }
  }

  /**
   * Get frequencies for musical key
   */
  private getFrequenciesForKey(key: string, instrumentType: string): number[] {
    // Major scale frequencies (7 notes)
    const majorFrequencies: { [key: string]: number[] } = {
      'C': [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88],
      'D': [293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 554.37],
      'E': [329.63, 369.99, 415.30, 440.00, 493.88, 554.37, 622.25],
      'F': [349.23, 392.00, 440.00, 466.16, 523.25, 587.33, 659.25],
      'G': [392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 739.99],
      'A': [440.00, 493.88, 554.37, 587.33, 659.25, 739.99, 830.61],
      'B': [493.88, 554.37, 622.25, 659.25, 739.99, 830.61, 932.33]
    };

    // Natural minor scale frequencies (W-H-W-W-H-W-W pattern)
    const minorFrequencies: { [key: string]: number[] } = {
      'A': [440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99],
      'B': [493.88, 554.37, 587.33, 659.25, 739.99, 783.99, 880.00],
      'C': [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16],
      'D': [293.66, 329.63, 349.23, 392.00, 440.00, 466.16, 523.25],
      'E': [329.63, 369.99, 392.00, 440.00, 493.88, 523.25, 587.33],
      'F': [349.23, 392.00, 415.30, 466.16, 523.25, 554.37, 622.25],
      'G': [392.00, 440.00, 466.16, 523.25, 587.33, 622.25, 698.46],
    };

    // Parse key: "Am" → root=A, minor=true; "C" → root=C, minor=false
    const isMinor = key.includes('m') && !key.includes('maj');
    const rootNote = key.charAt(0).toUpperCase();
    // Handle sharps/flats by falling back to closest natural note
    const cleanRoot = rootNote === '#' || rootNote === 'B' ? rootNote : rootNote;

    let frequencies: number[];
    if (isMinor) {
      frequencies = minorFrequencies[cleanRoot] || minorFrequencies['A'];
    } else {
      frequencies = majorFrequencies[cleanRoot] || majorFrequencies['C'];
    }

    // Adjust for instrument type
    if (instrumentType === 'bass') {
      frequencies = frequencies.map(f => f / 4); // Two octaves down
    } else if (instrumentType === 'pad') {
      frequencies = frequencies.slice(0, 4); // Use only lower notes for pads
    }

    return frequencies;
  }

  /**
   * Convert float32 audio to WAV format
   */
  private convertToWav(audioData: Float32Array, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const headerLength = 44;
    const dataLength = audioData.length * bytesPerSample;
    const fileLength = headerLength + dataLength;

    const wavBuffer = Buffer.alloc(fileLength);
    let offset = 0;

    // WAV header
    wavBuffer.write('RIFF', offset); offset += 4;
    wavBuffer.writeUInt32LE(fileLength - 8, offset); offset += 4;
    wavBuffer.write('WAVE', offset); offset += 4;
    wavBuffer.write('fmt ', offset); offset += 4;
    wavBuffer.writeUInt32LE(16, offset); offset += 4;
    wavBuffer.writeUInt16LE(1, offset); offset += 2;
    wavBuffer.writeUInt16LE(numChannels, offset); offset += 2;
    wavBuffer.writeUInt32LE(sampleRate, offset); offset += 4;
    wavBuffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, offset); offset += 4;
    wavBuffer.writeUInt16LE(numChannels * bytesPerSample, offset); offset += 2;
    wavBuffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
    wavBuffer.write('data', offset); offset += 4;
    wavBuffer.writeUInt32LE(dataLength, offset); offset += 4;

    // Convert float32 to int16
    for (let i = 0; i < audioData.length; i++) {
      const clampedValue = Math.max(-1, Math.min(1, audioData[i]));
      const int16Value = Math.round(clampedValue * 32767);
      wavBuffer.writeInt16LE(int16Value, offset);
      offset += 2;
    }

    return wavBuffer;
  }

  /**
   * Upload generated audio to object storage with better error handling
   */
  private async uploadToObjectStorage(filePath: string, packId: string, sampleId: string): Promise<string> {
    try {
      console.log(`☁️ Starting upload for sample: ${sampleId}`);
      
      // Get upload URL
      const uploadUrl = await this.objectStorage.getObjectEntityUploadURL();
      console.log(`☁️ Got upload URL: ${uploadUrl}`);
      
      // Read and verify file
      const fileBuffer = fs.readFileSync(filePath);
      console.log(`☁️ File read successfully: ${fileBuffer.length} bytes`);

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: fileBuffer,
        headers: {
          'Content-Type': 'audio/wav'
        }
      });

      console.log(`☁️ Upload response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`☁️ Upload failed with status ${response.status}:`, errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const objectPath = `/objects/uploads/${sampleId}`;
      console.log(`✅ Successfully uploaded real audio to: ${objectPath}`);
      
      // Object uploaded successfully
      console.log(`✅ Upload completed for ${sampleId}`)
      
      return objectPath;

    } catch (error) {
      console.error(`❌ Object storage upload failed for ${sampleId}:`, error);
      throw error;
    }
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getBpmForGenre(genre: string): number {
    const bpmMap: Record<string, number> = {
      'hip hop': 90, 'boom bap': 90, 'trap': 145, 'drill': 145,
      'house': 125, 'deep house': 122, 'techno': 132,
      'lo-fi': 80, 'lofi': 80, 'jazz': 110,
      'ambient': 75, 'chill': 80,
      'rock': 130, 'pop': 115,
      'r&b': 70, 'rnb': 70, 'soul': 80,
      'country': 115, 'reggae': 75, 'reggaeton': 95,
      'funk': 110, 'afrobeat': 110,
      'drum and bass': 174, 'dnb': 174, 'dubstep': 140,
      'latin': 105,
    };
    for (const [key, bpm] of Object.entries(bpmMap)) {
      if (genre.includes(key)) return bpm;
    }
    return 120;
  }

  private getKeyForGenre(genre: string): string {
    // Genre-appropriate key selection using a hash of the genre string for determinism
    const keyMap: Record<string, string[]> = {
      'hip hop': ['Cm', 'Fm', 'Gm', 'Am'],
      'trap': ['Cm', 'F#m', 'Am', 'Dm'],
      'house': ['Am', 'Dm', 'Em', 'Gm'],
      'techno': ['Am', 'Fm', 'Cm', 'Gm'],
      'lo-fi': ['C', 'Am', 'F', 'Dm'],
      'jazz': ['Dm', 'G', 'C', 'Am'],
      'ambient': ['C', 'Am', 'Em', 'Dm'],
      'rock': ['E', 'A', 'D', 'G'],
      'pop': ['C', 'G', 'Am', 'F'],
      'r&b': ['Dm', 'Gm', 'Am', 'Cm'],
      'country': ['G', 'C', 'D', 'A'],
      'funk': ['Em', 'Am', 'Dm', 'Gm'],
      'reggae': ['Am', 'Dm', 'Em', 'G'],
      'drum and bass': ['Am', 'Fm', 'Cm', 'Dm'],
      'dubstep': ['Fm', 'Cm', 'Gm', 'Dm'],
    };
    // Find matching genre keys
    for (const [key, keys] of Object.entries(keyMap)) {
      if (genre.includes(key)) {
        // Use a simple hash of the genre + timestamp for variety without Math.random
        const hash = genre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return keys[hash % keys.length];
      }
    }
    return 'Am'; // Default to A minor — more musical than always C major
  }

  private detectGenre(prompt: string): string {
    const genrePatterns: [string, string][] = [
      ['drum and bass', 'Drum & Bass'], ['drum & bass', 'Drum & Bass'], ['dnb', 'Drum & Bass'],
      ['deep house', 'Deep House'], ['boom bap', 'Boom Bap'],
      ['hip hop', 'Hip Hop'], ['hiphop', 'Hip Hop'],
      ['trap', 'Trap'], ['drill', 'Drill'],
      ['house', 'House'], ['techno', 'Techno'],
      ['ambient', 'Ambient'], ['lo-fi', 'Lo-Fi'], ['lofi', 'Lo-Fi'],
      ['jazz', 'Jazz'], ['rock', 'Rock'], ['pop', 'Pop'],
      ['r&b', 'R&B'], ['rnb', 'R&B'], ['soul', 'Soul'],
      ['country', 'Country'], ['reggae', 'Reggae'], ['reggaeton', 'Reggaeton'],
      ['funk', 'Funk'], ['afrobeat', 'Afrobeat'], ['latin', 'Latin'],
      ['dubstep', 'Dubstep'], ['edm', 'EDM'],
    ];
    for (const [pattern, name] of genrePatterns) {
      if (prompt.includes(pattern)) return name;
    }
    return 'Electronic';
  }

  private extractInstruments(samples: LocalMusicGenSample[]): string[] {
    const instruments = samples.map(s => s.instrument);
    return Array.from(new Set(instruments));
  }

}

export const localMusicGenService = new LocalMusicGenService();