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
import { timeStretch, calculatePlaybackRate, estimateBpm, type StretchConfig } from './timeStretch';

export interface MixTrack {
  id: string;
  name: string;
  audioUrl: string;
  audioBuffer?: AudioBuffer;
  volume: number; // 0-100
  pan: number; // -100 to 100
  muted: boolean;
  solo: boolean;
  /** Source BPM of this sample (auto-detected or user-set). If set, will time-stretch to project BPM. */
  sourceBpm?: number;
  /** Whether to preserve pitch when time-stretching (default true for melodic, false for drums). */
  preservePitch?: boolean;
  /** Pitch shift in semitones (-12 to +12). Applied after time-stretch. */
  pitchShiftSemitones?: number;
  // Internal nodes
  sourceNode?: AudioBufferSourceNode;
  gainNode?: GainNode;
  panNode?: StereoPannerNode;
}

export interface GroupBus {
  id: string;
  name: string;
  volume: number;      // 0-100
  muted: boolean;
  trackIds: string[];  // which tracks route through this bus
  // Internal nodes
  gainNode?: GainNode;
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
  private groupBuses: Map<string, GroupBus> = new Map();
  private loadedBuffers: Map<string, AudioBuffer> = new Map();
  private stretchedBuffers: Map<string, AudioBuffer> = new Map();

  /** Project BPM — samples with sourceBpm will be time-stretched to match this. */
  private projectBpm: number = 120;

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
   * Set the project BPM. Tracks with sourceBpm will be re-stretched.
   */
  setProjectBpm(bpm: number): void {
    if (bpm === this.projectBpm) return;
    this.projectBpm = bpm;
    // Clear stretched cache so tracks get re-stretched on next play
    this.stretchedBuffers.clear();
  }

  getProjectBpm(): number {
    return this.projectBpm;
  }

  /**
   * Get a time-stretched buffer for a track (or the original if no stretching needed).
   */
  private async getStretchedBuffer(track: MixTrack): Promise<AudioBuffer | undefined> {
    if (!track.audioBuffer) return undefined;

    const sourceBpm = track.sourceBpm;
    if (!sourceBpm || sourceBpm === this.projectBpm) {
      return track.audioBuffer; // No stretch needed
    }

    const cacheKey = `${track.id}:${sourceBpm}:${this.projectBpm}:${track.preservePitch ?? true}`;
    if (this.stretchedBuffers.has(cacheKey)) {
      return this.stretchedBuffers.get(cacheKey)!;
    }

    const config: StretchConfig = {
      sourceBpm,
      targetBpm: this.projectBpm,
      preservePitch: track.preservePitch ?? true,
    };

    try {
      const result = await timeStretch(track.audioBuffer, config);
      this.stretchedBuffers.set(cacheKey, result.buffer);
      console.log(`⏱️ Stretched "${track.name}" from ${sourceBpm} to ${this.projectBpm} BPM (${track.preservePitch !== false ? 'pitch preserved' : 'pitch changed'})`);
      return result.buffer;
    } catch (err) {
      console.warn(`Time-stretch failed for ${track.name}, using original:`, err);
      return track.audioBuffer;
    }
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

      // Auto-detect BPM if not provided and buffer is long enough (> 2 seconds)
      if (!mixTrack.sourceBpm && buffer.duration > 2) {
        try {
          mixTrack.sourceBpm = estimateBpm(buffer);
          console.log(`🎵 Auto-detected BPM for "${track.name}": ${mixTrack.sourceBpm}`);
        } catch { /* BPM detection failed, skip */ }
      }

      // Update duration to longest track
      if (buffer.duration > this.duration) {
        this.duration = buffer.duration;
      }

      this.emitState();
    } catch (error) {
      console.error(`Failed to load track ${track.name}:`, error);
    }
  }

  // ─── Group Bus Management ────────────────────────────────────────

  /**
   * Create a group bus that multiple tracks can route through.
   * E.g., group 3 vocal tracks into one "Vocals" bus for shared EQ/compression.
   */
  createGroupBus(id: string, name: string, trackIds: string[]): void {
    if (!this.audioContext || !this.masterGain) return;

    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.masterGain);

    this.groupBuses.set(id, {
      id,
      name,
      volume: 100,
      muted: false,
      trackIds,
      gainNode,
    });

    console.log(`🔀 Group bus "${name}" created with ${trackIds.length} tracks`);
  }

  /**
   * Remove a group bus and route its tracks back to master.
   */
  removeGroupBus(busId: string): void {
    const bus = this.groupBuses.get(busId);
    if (!bus) return;

    if (bus.gainNode) {
      bus.gainNode.disconnect();
    }
    this.groupBuses.delete(busId);
  }

  /**
   * Set group bus volume.
   */
  setGroupBusVolume(busId: string, volume: number): void {
    const bus = this.groupBuses.get(busId);
    if (!bus?.gainNode) return;
    bus.volume = volume;
    bus.gainNode.gain.setValueAtTime(
      bus.muted ? 0 : volume / 100,
      this.audioContext?.currentTime || 0,
    );
  }

  /**
   * Toggle group bus mute.
   */
  setGroupBusMute(busId: string, muted: boolean): void {
    const bus = this.groupBuses.get(busId);
    if (!bus?.gainNode) return;
    bus.muted = muted;
    bus.gainNode.gain.setValueAtTime(
      muted ? 0 : bus.volume / 100,
      this.audioContext?.currentTime || 0,
    );
  }

  /**
   * Get the destination node for a track (group bus or master).
   */
  private getTrackDestination(trackId: string): AudioNode | null {
    // Check if track belongs to a group bus
    for (const bus of this.groupBuses.values()) {
      if (bus.trackIds.includes(trackId) && bus.gainNode) {
        return bus.gainNode;
      }
    }
    return this.masterGain;
  }

  getGroupBuses(): GroupBus[] {
    return Array.from(this.groupBuses.values());
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
   * Connect a track's audio nodes (uses time-stretched buffer if available).
   */
  private async connectTrackAsync(track: MixTrack, startOffset: number = 0): Promise<void> {
    if (!this.audioContext || !this.masterGain || !track.audioBuffer) return;

    // Get stretched buffer (or original if no stretch needed)
    const playbackBuffer = await this.getStretchedBuffer(track) || track.audioBuffer;

    // Create nodes
    track.sourceNode = this.audioContext.createBufferSource();
    track.sourceNode.buffer = playbackBuffer;

    // Apply pitch shift via detune (in cents: 1 semitone = 100 cents)
    if (track.pitchShiftSemitones && track.pitchShiftSemitones !== 0) {
      track.sourceNode.detune.value = track.pitchShiftSemitones * 100;
    }

    track.gainNode = this.audioContext.createGain();
    track.gainNode.gain.value = this.calculateTrackGain(track);

    track.panNode = this.audioContext.createStereoPanner();
    track.panNode.pan.value = track.pan / 100;

    // Connect: source -> gain -> pan -> destination (group bus or master)
    const destination = this.getTrackDestination(track.id);
    if (!destination) return;

    track.sourceNode.connect(track.gainNode);
    track.gainNode.connect(track.panNode);
    track.panNode.connect(destination);

    // Handle track end
    track.sourceNode.onended = () => {
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
   * Connect a track's audio nodes (sync wrapper for backward compat).
   */
  private connectTrack(track: MixTrack, startOffset: number = 0): void {
    this.connectTrackAsync(track, startOffset);
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
    
    // Connect and start all tracks (with time-stretch if needed)
    const connectPromises: Promise<void>[] = [];
    this.tracks.forEach(track => {
      if (track.audioBuffer) {
        connectPromises.push(this.connectTrackAsync(track, startOffset));
      }
    });
    await Promise.all(connectPromises);

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
    this.stretchedBuffers.clear();
    
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
