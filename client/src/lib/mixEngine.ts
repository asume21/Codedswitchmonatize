/**
 * MixEngine - Professional Web Audio API-based multi-track mixer
 * Handles synchronized playback of multiple audio tracks with:
 * - Volume control per track
 * - Stereo panning
 * - Solo/Mute
 * - Master volume and limiting
 * - Real-time mixing
 */

import { getAudioContext } from './audioContext';

export interface MixTrack {
  id: string;
  name: string;
  audioUrl: string;
  audioBuffer?: AudioBuffer;
  volume: number; // 0-100
  pan: number; // -100 to 100
  muted: boolean;
  solo: boolean;
  // Internal nodes
  sourceNode?: AudioBufferSourceNode;
  gainNode?: GainNode;
  panNode?: StereoPannerNode;
}

export interface MixEngineState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  loadingProgress: number;
}

export type MixEngineCallback = (state: MixEngineState) => void;

class MixEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  private tracks: Map<string, MixTrack> = new Map();
  private loadedBuffers: Map<string, AudioBuffer> = new Map();
  
  private isPlaying = false;
  private isPaused = false;
  private startTime = 0;
  private pauseTime = 0;
  private duration = 0;
  
  private stateCallback: MixEngineCallback | null = null;
  private animationFrameId: number | null = null;
  
  private masterVolume = 1.0;

  /**
   * Initialize the audio context and master chain
   */
  async initialize(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      return;
    }

    this.audioContext = getAudioContext();
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Create master chain: tracks -> masterGain -> limiter -> analyser -> destination
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.masterVolume;

    // Limiter (using compressor with aggressive settings)
    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;

    // Analyser for metering
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;

    // Connect master chain
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    console.log('🎛️ MixEngine initialized');
  }

  /**
   * Set callback for state updates
   */
  onStateChange(callback: MixEngineCallback): void {
    this.stateCallback = callback;
  }

  /**
   * Emit current state to callback
   */
  private emitState(): void {
    if (this.stateCallback) {
      this.stateCallback({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        currentTime: this.getCurrentTime(),
        duration: this.duration,
        loadingProgress: this.getLoadingProgress(),
      });
    }
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) {
      return this.pauseTime;
    }
    return this.audioContext.currentTime - this.startTime + this.pauseTime;
  }

  /**
   * Get loading progress (0-100)
   */
  private getLoadingProgress(): number {
    const total = this.tracks.size;
    if (total === 0) return 100;
    const loaded = Array.from(this.tracks.values()).filter(t => t.audioBuffer).length;
    return Math.round((loaded / total) * 100);
  }

  /**
   * Set master volume (0-1)
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioContext?.currentTime || 0);
    }
  }

  /**
   * Load an audio file and return its buffer
   */
  private async loadAudioBuffer(url: string): Promise<AudioBuffer> {
    // Check cache first
    if (this.loadedBuffers.has(url)) {
      return this.loadedBuffers.get(url)!;
    }

    await this.initialize();

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    
    // Cache the buffer
    this.loadedBuffers.set(url, audioBuffer);
    
    return audioBuffer;
  }

  /**
   * Add a track to the mix
   */
  async addTrack(track: Omit<MixTrack, 'audioBuffer' | 'sourceNode' | 'gainNode' | 'panNode'>): Promise<void> {
    await this.initialize();

    const mixTrack: MixTrack = {
      ...track,
      audioBuffer: undefined,
      sourceNode: undefined,
      gainNode: undefined,
      panNode: undefined,
    };

    this.tracks.set(track.id, mixTrack);
    this.emitState();

    // Load audio in background
    try {
      const buffer = await this.loadAudioBuffer(track.audioUrl);
      mixTrack.audioBuffer = buffer;
      
      // Update duration to longest track
      if (buffer.duration > this.duration) {
        this.duration = buffer.duration;
      }
      
      this.emitState();
    } catch (error) {
      console.error(`Failed to load track ${track.name}:`, error);
    }
  }

  /**
   * Remove a track from the mix
   */
  removeTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      this.disconnectTrack(track);
      this.tracks.delete(trackId);
      
      // Recalculate duration
      this.duration = 0;
      this.tracks.forEach(t => {
        if (t.audioBuffer && t.audioBuffer.duration > this.duration) {
          this.duration = t.audioBuffer.duration;
        }
      });
      
      this.emitState();
    }
  }

  /**
   * Clear all tracks
   */
  clearTracks(): void {
    this.stop();
    this.tracks.forEach(track => this.disconnectTrack(track));
    this.tracks.clear();
    this.duration = 0;
    this.emitState();
  }

  /**
   * Update track settings
   */
  updateTrack(trackId: string, updates: Partial<Pick<MixTrack, 'volume' | 'pan' | 'muted' | 'solo'>>): void {
    const track = this.tracks.get(trackId);
    if (!track) return;

    if (updates.volume !== undefined) {
      track.volume = updates.volume;
      if (track.gainNode) {
        const gain = this.calculateTrackGain(track);
        track.gainNode.gain.setValueAtTime(gain, this.audioContext?.currentTime || 0);
      }
    }

    if (updates.pan !== undefined) {
      track.pan = updates.pan;
      if (track.panNode) {
        track.panNode.pan.setValueAtTime(updates.pan / 100, this.audioContext?.currentTime || 0);
      }
    }

    if (updates.muted !== undefined) {
      track.muted = updates.muted;
      this.updateAllTrackGains();
    }

    if (updates.solo !== undefined) {
      track.solo = updates.solo;
      this.updateAllTrackGains();
    }

    this.emitState();
  }

  /**
   * Calculate effective gain for a track (considering solo/mute)
   */
  private calculateTrackGain(track: MixTrack): number {
    const hasSolo = Array.from(this.tracks.values()).some(t => t.solo);
    
    // If any track is soloed, only play soloed tracks
    if (hasSolo && !track.solo) {
      return 0;
    }
    
    // If track is muted, return 0
    if (track.muted) {
      return 0;
    }
    
    // Convert volume (0-100) to gain (0-1)
    return track.volume / 100;
  }

  /**
   * Update gains for all tracks (when solo/mute changes)
   */
  private updateAllTrackGains(): void {
    this.tracks.forEach(track => {
      if (track.gainNode) {
        const gain = this.calculateTrackGain(track);
        track.gainNode.gain.setValueAtTime(gain, this.audioContext?.currentTime || 0);
      }
    });
  }

  /**
   * Connect a track's audio nodes
   */
  private connectTrack(track: MixTrack, startOffset: number = 0): void {
    if (!this.audioContext || !this.masterGain || !track.audioBuffer) return;

    // Create nodes
    track.sourceNode = this.audioContext.createBufferSource();
    track.sourceNode.buffer = track.audioBuffer;

    track.gainNode = this.audioContext.createGain();
    track.gainNode.gain.value = this.calculateTrackGain(track);

    track.panNode = this.audioContext.createStereoPanner();
    track.panNode.pan.value = track.pan / 100;

    // Connect: source -> gain -> pan -> master
    track.sourceNode.connect(track.gainNode);
    track.gainNode.connect(track.panNode);
    track.panNode.connect(this.masterGain);

    // Handle track end
    track.sourceNode.onended = () => {
      // Check if all tracks have ended
      const allEnded = Array.from(this.tracks.values()).every(t => 
        !t.sourceNode || t.sourceNode.context.state === 'closed'
      );
      if (allEnded && this.isPlaying) {
        this.stop();
      }
    };

    // Start playback from offset
    track.sourceNode.start(0, startOffset);
  }

  /**
   * Disconnect a track's audio nodes
   */
  private disconnectTrack(track: MixTrack): void {
    if (track.sourceNode) {
      try {
        track.sourceNode.stop();
        track.sourceNode.disconnect();
      } catch (e) {
        // Already stopped
      }
      track.sourceNode = undefined;
    }
    if (track.gainNode) {
      track.gainNode.disconnect();
      track.gainNode = undefined;
    }
    if (track.panNode) {
      track.panNode.disconnect();
      track.panNode = undefined;
    }
  }

  /**
   * Start playback
   */
  async play(fromTime?: number): Promise<void> {
    await this.initialize();

    if (this.isPlaying && !this.isPaused) {
      return; // Already playing
    }

    // Stop any existing playback
    this.tracks.forEach(track => this.disconnectTrack(track));

    const startOffset = fromTime !== undefined ? fromTime : this.pauseTime;
    
    // Connect and start all tracks
    this.tracks.forEach(track => {
      if (track.audioBuffer) {
        this.connectTrack(track, startOffset);
      }
    });

    this.startTime = this.audioContext!.currentTime - startOffset;
    this.pauseTime = startOffset;
    this.isPlaying = true;
    this.isPaused = false;

    // Start animation loop for time updates
    this.startAnimationLoop();

    this.emitState();
    console.log('▶️ MixEngine playing from', startOffset.toFixed(2), 'seconds');
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.isPlaying || this.isPaused) return;

    this.pauseTime = this.getCurrentTime();
    
    // Stop all source nodes
    this.tracks.forEach(track => this.disconnectTrack(track));

    this.isPaused = true;
    this.stopAnimationLoop();
    this.emitState();
    
    console.log('⏸️ MixEngine paused at', this.pauseTime.toFixed(2), 'seconds');
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    // Stop all source nodes
    this.tracks.forEach(track => this.disconnectTrack(track));

    this.isPlaying = false;
    this.isPaused = false;
    this.pauseTime = 0;
    this.stopAnimationLoop();
    this.emitState();
    
    console.log('⏹️ MixEngine stopped');
  }

  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    const wasPlaying = this.isPlaying && !this.isPaused;
    
    if (wasPlaying) {
      this.stop();
    }
    
    this.pauseTime = Math.max(0, Math.min(time, this.duration));
    
    if (wasPlaying) {
      this.play(this.pauseTime);
    } else {
      this.emitState();
    }
  }

  /**
   * Start animation loop for time updates
   */
  private startAnimationLoop(): void {
    const update = () => {
      if (this.isPlaying && !this.isPaused) {
        this.emitState();
        
        // Check if we've reached the end
        if (this.getCurrentTime() >= this.duration) {
          this.stop();
          return;
        }
        
        this.animationFrameId = requestAnimationFrame(update);
      }
    };
    this.animationFrameId = requestAnimationFrame(update);
  }

  /**
   * Stop animation loop
   */
  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get analyser node for visualization
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Get current state
   */
  getState(): MixEngineState {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentTime: this.getCurrentTime(),
      duration: this.duration,
      loadingProgress: this.getLoadingProgress(),
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.stop();
    this.clearTracks();
    this.loadedBuffers.clear();
    
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.limiter) {
      this.limiter.disconnect();
      this.limiter = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    // Don't close the shared audio context
    this.audioContext = null;
    
    console.log('🎛️ MixEngine disposed');
  }
}

// Singleton instance
let mixEngineInstance: MixEngine | null = null;

export function getMixEngine(): MixEngine {
  if (!mixEngineInstance) {
    mixEngineInstance = new MixEngine();
  }
  return mixEngineInstance;
}

export function disposeMixEngine(): void {
  if (mixEngineInstance) {
    mixEngineInstance.dispose();
    mixEngineInstance = null;
  }
}

export default MixEngine;
