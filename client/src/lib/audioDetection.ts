/**
 * Audio Detection Utilities
 * Real-time chord detection and BPM detection from audio
 */

// Note frequencies for chord detection (A4 = 440Hz)
const NOTE_FREQUENCIES: { [key: string]: number } = {
  'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
  'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
  'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Chord patterns (intervals from root)
const CHORD_PATTERNS: { [key: string]: number[] } = {
  'Major': [0, 4, 7],
  'Minor': [0, 3, 7],
  'Diminished': [0, 3, 6],
  'Augmented': [0, 4, 8],
  'Major 7': [0, 4, 7, 11],
  'Minor 7': [0, 3, 7, 10],
  'Dominant 7': [0, 4, 7, 10],
  'Diminished 7': [0, 3, 6, 9],
  'Half-Diminished 7': [0, 3, 6, 10],
  'Sus2': [0, 2, 7],
  'Sus4': [0, 5, 7],
  'Add9': [0, 4, 7, 14],
  '6': [0, 4, 7, 9],
  'Minor 6': [0, 3, 7, 9],
  'Power': [0, 7],
};

export interface ChordDetectionResult {
  chord: string;
  root: string;
  type: string;
  confidence: number;
  notes: string[];
  frequencies: number[];
}

export interface BPMDetectionResult {
  bpm: number;
  confidence: number;
  beats: number[];
  timeSignature: string;
}

export interface SpectrumData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  dominantFrequency: number;
  dominantNote: string;
}

class AudioDetection {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private fftSize = 8192; // High resolution for accurate pitch detection

  constructor() {
    this.initializeContext();
  }

  private async initializeContext(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = 0.8;
    }
  }

  /**
   * Get AudioContext for external use
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Get Analyser node for external use
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Detect chord from audio buffer
   */
  async detectChordFromBuffer(audioBuffer: AudioBuffer): Promise<ChordDetectionResult> {
    await this.initializeContext();
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Perform FFT analysis
    const spectrum = this.performFFT(channelData, sampleRate);
    
    // Find peaks in the spectrum (dominant frequencies)
    const peaks = this.findSpectralPeaks(spectrum.frequencies, spectrum.magnitudes, sampleRate);
    
    // Convert frequencies to notes
    const detectedNotes = peaks.map(freq => this.frequencyToNote(freq));
    
    // Identify chord from notes
    const chord = this.identifyChord(detectedNotes);
    
    return {
      ...chord,
      frequencies: peaks
    };
  }

  /**
   * Detect chord from live audio stream
   */
  async detectChordFromStream(stream: MediaStream): Promise<ChordDetectionResult> {
    await this.initializeContext();
    
    const source = this.audioContext!.createMediaStreamSource(stream);
    source.connect(this.analyser!);
    
    // Get frequency data
    const bufferLength = this.analyser!.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyser!.getFloatFrequencyData(dataArray);
    
    // Convert to linear scale
    const magnitudes = new Float32Array(bufferLength);
    for (let i = 0; i < bufferLength; i++) {
      magnitudes[i] = Math.pow(10, dataArray[i] / 20);
    }
    
    // Create frequency array
    const frequencies = new Float32Array(bufferLength);
    const nyquist = this.audioContext!.sampleRate / 2;
    for (let i = 0; i < bufferLength; i++) {
      frequencies[i] = (i / bufferLength) * nyquist;
    }
    
    // Find peaks
    const peaks = this.findSpectralPeaks(frequencies, magnitudes, this.audioContext!.sampleRate);
    const detectedNotes = peaks.map(freq => this.frequencyToNote(freq));
    const chord = this.identifyChord(detectedNotes);
    
    source.disconnect();
    
    return {
      ...chord,
      frequencies: peaks
    };
  }

  /**
   * Detect BPM from audio buffer
   */
  async detectBPMFromBuffer(audioBuffer: AudioBuffer): Promise<BPMDetectionResult> {
    await this.initializeContext();
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Apply low-pass filter to focus on bass/kick
    const filtered = this.lowPassFilter(channelData, sampleRate, 200);
    
    // Calculate energy envelope
    const envelope = this.calculateEnvelope(filtered, sampleRate);
    
    // Detect peaks (beats)
    const beats = this.detectBeats(envelope, sampleRate);
    
    // Calculate BPM from beat intervals
    const bpmResult = this.calculateBPM(beats, sampleRate);
    
    return bpmResult;
  }

  /**
   * Detect BPM from audio URL
   */
  async detectBPMFromURL(url: string): Promise<BPMDetectionResult> {
    await this.initializeContext();
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    
    return this.detectBPMFromBuffer(audioBuffer);
  }

  /**
   * Perform FFT on audio samples
   */
  private performFFT(samples: Float32Array, sampleRate: number): SpectrumData {
    const fftSize = Math.min(this.fftSize, samples.length);
    const frequencies = new Float32Array(fftSize / 2);
    const magnitudes = new Float32Array(fftSize / 2);
    
    // Apply Hanning window
    const windowed = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / fftSize));
      windowed[i] = (samples[i] || 0) * window;
    }
    
    // Simple DFT (for production, use Web Audio API's built-in FFT)
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    
    for (let k = 0; k < fftSize / 2; k++) {
      let sumReal = 0;
      let sumImag = 0;
      
      for (let n = 0; n < fftSize; n++) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        sumReal += windowed[n] * Math.cos(angle);
        sumImag -= windowed[n] * Math.sin(angle);
      }
      
      real[k] = sumReal;
      imag[k] = sumImag;
      
      frequencies[k] = (k * sampleRate) / fftSize;
      magnitudes[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag) / fftSize;
    }
    
    // Find dominant frequency
    let maxMag = 0;
    let dominantIdx = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      if (magnitudes[i] > maxMag) {
        maxMag = magnitudes[i];
        dominantIdx = i;
      }
    }
    
    const dominantFrequency = frequencies[dominantIdx];
    const dominantNote = this.frequencyToNote(dominantFrequency);
    
    return {
      frequencies,
      magnitudes,
      dominantFrequency,
      dominantNote
    };
  }

  /**
   * Find spectral peaks (dominant frequencies)
   */
  private findSpectralPeaks(frequencies: Float32Array, magnitudes: Float32Array, sampleRate: number): number[] {
    const peaks: { freq: number; mag: number }[] = [];
    const minFreq = 60; // Below C2
    const maxFreq = 2000; // Above B6
    const threshold = 0.1; // Minimum magnitude threshold
    
    // Find local maxima
    for (let i = 2; i < magnitudes.length - 2; i++) {
      const freq = frequencies[i];
      if (freq < minFreq || freq > maxFreq) continue;
      
      const mag = magnitudes[i];
      if (mag < threshold) continue;
      
      // Check if local maximum
      if (mag > magnitudes[i - 1] && mag > magnitudes[i + 1] &&
          mag > magnitudes[i - 2] && mag > magnitudes[i + 2]) {
        peaks.push({ freq, mag });
      }
    }
    
    // Sort by magnitude and take top peaks
    peaks.sort((a, b) => b.mag - a.mag);
    
    // Filter harmonics (keep only fundamental frequencies)
    const fundamentals: number[] = [];
    for (const peak of peaks.slice(0, 12)) {
      let isHarmonic = false;
      for (const fund of fundamentals) {
        const ratio = peak.freq / fund;
        if (Math.abs(ratio - Math.round(ratio)) < 0.05 && ratio > 1.5) {
          isHarmonic = true;
          break;
        }
      }
      if (!isHarmonic) {
        fundamentals.push(peak.freq);
      }
      if (fundamentals.length >= 6) break;
    }
    
    return fundamentals;
  }

  /**
   * Convert frequency to note name
   */
  private frequencyToNote(frequency: number): string {
    if (frequency <= 0) return 'Unknown';
    
    // A4 = 440Hz, MIDI note 69
    const midiNote = 12 * Math.log2(frequency / 440) + 69;
    const noteIndex = Math.round(midiNote) % 12;
    const octave = Math.floor(Math.round(midiNote) / 12) - 1;
    
    return NOTE_NAMES[noteIndex] + octave;
  }

  /**
   * Get note name without octave
   */
  private getNoteClass(note: string): string {
    return note.replace(/\d+$/, '');
  }

  /**
   * Identify chord from detected notes
   */
  private identifyChord(notes: string[]): Omit<ChordDetectionResult, 'frequencies'> {
    if (notes.length === 0) {
      return { chord: 'No chord detected', root: '', type: '', confidence: 0, notes: [] };
    }
    
    if (notes.length === 1) {
      return { chord: notes[0], root: this.getNoteClass(notes[0]), type: 'Single Note', confidence: 1, notes };
    }
    
    // Get unique note classes (ignore octaves)
    const noteClasses = [...new Set(notes.map(n => this.getNoteClass(n)))];
    
    if (noteClasses.length < 2) {
      return { chord: noteClasses[0], root: noteClasses[0], type: 'Unison', confidence: 0.9, notes };
    }
    
    // Try each note as potential root
    let bestMatch = { chord: 'Unknown', root: '', type: '', confidence: 0, notes };
    
    for (const potentialRoot of noteClasses) {
      const rootIndex = NOTE_NAMES.indexOf(potentialRoot);
      if (rootIndex === -1) continue;
      
      // Calculate intervals from root
      const intervals = noteClasses.map(note => {
        const noteIndex = NOTE_NAMES.indexOf(note);
        return (noteIndex - rootIndex + 12) % 12;
      }).sort((a, b) => a - b);
      
      // Match against chord patterns
      for (const [chordType, pattern] of Object.entries(CHORD_PATTERNS)) {
        const matchScore = this.matchChordPattern(intervals, pattern);
        if (matchScore > bestMatch.confidence) {
          bestMatch = {
            chord: `${potentialRoot} ${chordType}`,
            root: potentialRoot,
            type: chordType,
            confidence: matchScore,
            notes
          };
        }
      }
    }
    
    // If no good match, describe as note cluster
    if (bestMatch.confidence < 0.5) {
      bestMatch = {
        chord: noteClasses.join(' + '),
        root: noteClasses[0],
        type: 'Cluster',
        confidence: 0.3,
        notes
      };
    }
    
    return bestMatch;
  }

  /**
   * Match intervals against chord pattern
   */
  private matchChordPattern(intervals: number[], pattern: number[]): number {
    let matches = 0;
    let total = pattern.length;
    
    for (const p of pattern) {
      if (intervals.includes(p)) {
        matches++;
      }
    }
    
    // Penalize extra notes not in pattern
    const extraNotes = intervals.filter(i => !pattern.includes(i)).length;
    const penalty = extraNotes * 0.1;
    
    return Math.max(0, (matches / total) - penalty);
  }

  /**
   * Low-pass filter for BPM detection
   */
  private lowPassFilter(samples: Float32Array, sampleRate: number, cutoff: number): Float32Array {
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / sampleRate;
    const alpha = dt / (rc + dt);
    
    const filtered = new Float32Array(samples.length);
    filtered[0] = samples[0];
    
    for (let i = 1; i < samples.length; i++) {
      filtered[i] = filtered[i - 1] + alpha * (samples[i] - filtered[i - 1]);
    }
    
    return filtered;
  }

  /**
   * Calculate energy envelope for beat detection
   */
  private calculateEnvelope(samples: Float32Array, sampleRate: number): Float32Array {
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
    const hopSize = Math.floor(windowSize / 2);
    const numWindows = Math.floor((samples.length - windowSize) / hopSize);
    
    const envelope = new Float32Array(numWindows);
    
    for (let i = 0; i < numWindows; i++) {
      const start = i * hopSize;
      let energy = 0;
      
      for (let j = 0; j < windowSize; j++) {
        const sample = samples[start + j];
        energy += sample * sample;
      }
      
      envelope[i] = Math.sqrt(energy / windowSize);
    }
    
    return envelope;
  }

  /**
   * Detect beats from energy envelope
   */
  private detectBeats(envelope: Float32Array, sampleRate: number): number[] {
    const beats: number[] = [];
    const windowSize = Math.floor(sampleRate * 0.01);
    const hopSize = Math.floor(windowSize / 2);
    
    // Calculate adaptive threshold
    const windowLength = 43; // ~430ms at 100 windows/sec
    const threshold = 1.3;
    
    for (let i = windowLength; i < envelope.length - windowLength; i++) {
      // Local average
      let localAvg = 0;
      for (let j = i - windowLength; j < i + windowLength; j++) {
        localAvg += envelope[j];
      }
      localAvg /= (windowLength * 2);
      
      // Check if current sample is a beat
      if (envelope[i] > localAvg * threshold &&
          envelope[i] > envelope[i - 1] &&
          envelope[i] > envelope[i + 1]) {
        
        // Convert to sample position
        const samplePos = i * hopSize;
        
        // Avoid detecting beats too close together (minimum 200ms apart)
        if (beats.length === 0 || samplePos - beats[beats.length - 1] > sampleRate * 0.2) {
          beats.push(samplePos);
        }
      }
    }
    
    return beats;
  }

  /**
   * Calculate BPM from beat positions
   */
  private calculateBPM(beats: number[], sampleRate: number): BPMDetectionResult {
    if (beats.length < 2) {
      return { bpm: 0, confidence: 0, beats: [], timeSignature: '4/4' };
    }
    
    // Calculate intervals between beats
    const intervals: number[] = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }
    
    // Convert to BPM values
    const bpmValues = intervals.map(interval => (60 * sampleRate) / interval);
    
    // Filter reasonable BPM range (60-200)
    const validBPMs = bpmValues.filter(bpm => bpm >= 60 && bpm <= 200);
    
    if (validBPMs.length === 0) {
      // Try half/double tempo
      const adjustedBPMs = bpmValues.map(bpm => {
        if (bpm < 60) return bpm * 2;
        if (bpm > 200) return bpm / 2;
        return bpm;
      }).filter(bpm => bpm >= 60 && bpm <= 200);
      
      if (adjustedBPMs.length === 0) {
        return { bpm: 0, confidence: 0, beats: [], timeSignature: '4/4' };
      }
      
      validBPMs.push(...adjustedBPMs);
    }
    
    // Calculate median BPM
    validBPMs.sort((a, b) => a - b);
    const medianBPM = validBPMs[Math.floor(validBPMs.length / 2)];
    
    // Round to nearest whole number
    const bpm = Math.round(medianBPM);
    
    // Calculate confidence based on consistency
    const variance = validBPMs.reduce((sum, b) => sum + Math.pow(b - medianBPM, 2), 0) / validBPMs.length;
    const stdDev = Math.sqrt(variance);
    const confidence = Math.max(0, Math.min(1, 1 - (stdDev / medianBPM)));
    
    // Guess time signature based on beat grouping
    const timeSignature = this.guessTimeSignature(beats, sampleRate, bpm);
    
    return {
      bpm,
      confidence,
      beats: beats.map(b => b / sampleRate), // Convert to seconds
      timeSignature
    };
  }

  /**
   * Guess time signature from beat pattern
   */
  private guessTimeSignature(beats: number[], sampleRate: number, bpm: number): string {
    // This is a simplified heuristic
    // Real implementation would analyze accent patterns
    
    if (beats.length < 8) return '4/4';
    
    const beatDuration = (60 / bpm) * sampleRate;
    const intervals: number[] = [];
    
    for (let i = 1; i < Math.min(beats.length, 16); i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }
    
    // Check for waltz feel (3/4)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const expectedQuarter = beatDuration;
    
    // If intervals are consistently ~1.5x expected, might be 6/8
    const ratio = avgInterval / expectedQuarter;
    
    if (Math.abs(ratio - 1.5) < 0.2) return '6/8';
    if (Math.abs(ratio - 0.75) < 0.15) return '3/4';
    
    return '4/4';
  }

  /**
   * Analyze audio file and return both chord and BPM
   */
  async analyzeAudioFile(file: File): Promise<{
    chord: ChordDetectionResult;
    bpm: BPMDetectionResult;
  }> {
    await this.initializeContext();
    
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    
    const [chord, bpm] = await Promise.all([
      this.detectChordFromBuffer(audioBuffer),
      this.detectBPMFromBuffer(audioBuffer)
    ]);
    
    return { chord, bpm };
  }

  /**
   * Real-time analysis from microphone
   */
  async startRealtimeAnalysis(
    onChordDetected: (chord: ChordDetectionResult) => void,
    onBPMDetected: (bpm: BPMDetectionResult) => void
  ): Promise<() => void> {
    await this.initializeContext();
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.audioContext!.createMediaStreamSource(stream);
    
    // Create script processor for real-time analysis
    const bufferSize = 4096;
    const processor = this.audioContext!.createScriptProcessor(bufferSize, 1, 1);
    
    let sampleBuffer: Float32Array[] = [];
    const samplesNeeded = this.audioContext!.sampleRate * 2; // 2 seconds of audio
    
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      sampleBuffer.push(new Float32Array(inputData));
      
      // Keep only recent samples
      let totalSamples = sampleBuffer.reduce((sum, arr) => sum + arr.length, 0);
      while (totalSamples > samplesNeeded && sampleBuffer.length > 1) {
        totalSamples -= sampleBuffer[0].length;
        sampleBuffer.shift();
      }
      
      // Analyze every 500ms
      if (sampleBuffer.length > 0 && totalSamples >= samplesNeeded / 2) {
        // Combine buffers
        const combined = new Float32Array(totalSamples);
        let offset = 0;
        for (const buf of sampleBuffer) {
          combined.set(buf, offset);
          offset += buf.length;
        }
        
        // Detect chord
        const spectrum = this.performFFT(combined, this.audioContext!.sampleRate);
        const peaks = this.findSpectralPeaks(spectrum.frequencies, spectrum.magnitudes, this.audioContext!.sampleRate);
        const notes = peaks.map(f => this.frequencyToNote(f));
        const chord = this.identifyChord(notes);
        onChordDetected({ ...chord, frequencies: peaks });
        
        // Detect BPM (less frequently)
        if (totalSamples >= samplesNeeded) {
          const envelope = this.calculateEnvelope(combined, this.audioContext!.sampleRate);
          const beats = this.detectBeats(envelope, this.audioContext!.sampleRate);
          const bpm = this.calculateBPM(beats, this.audioContext!.sampleRate);
          onBPMDetected(bpm);
        }
      }
    };
    
    source.connect(processor);
    processor.connect(this.audioContext!.destination);
    
    // Return cleanup function
    return () => {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach(track => track.stop());
    };
  }
}

// Export singleton instance
export const audioDetection = new AudioDetection();
export default audioDetection;
