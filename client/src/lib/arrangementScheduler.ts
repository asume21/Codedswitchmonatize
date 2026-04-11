/**
 * ArrangementScheduler — Timeline-aware playback layer.
 *
 * Subscribes to pianoRollScheduler's rawStep (never-wrapping counter) and
 * converts it to absolute timeline beats. This enables arrangement playback
 * (clips at arbitrary positions) without replacing the proven pattern-loop
 * scheduler.
 *
 * Architecture:
 *   TransportContext.play()
 *     → pianoRollScheduler.start()      (the clock)
 *     → arrangementScheduler.start()    (this file — timeline layer)
 *
 *   Components register clips:
 *     arrangementScheduler.setClips(trackId, clips)
 *
 *   On each step, the scheduler:
 *     1. Converts rawStep to timelineBeat
 *     2. Checks which clips are active
 *     3. Schedules MIDI notes and audio sources at correct audioTime
 *     4. Fires songEnd when timeline reaches songEndBeat
 */

import { pianoRollScheduler, type StepCallback } from './pianoRollScheduler';
import { getAudioContext } from './audioContext';
import type { ArrangementClip, TrackNote } from '@/types/studioTracks';

export type SongEndCallback = () => void;
export type ClipEventCallback = (event: ClipEvent) => void;

export interface ClipEvent {
  type: 'clipStart' | 'clipEnd';
  trackId: string;
  clip: ArrangementClip;
  audioTime: number;
}

interface ActiveAudioSource {
  clipId: string;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
}

interface RegisteredTrack {
  clips: ArrangementClip[];
  muted: boolean;
  solo: boolean;
}

class ArrangementScheduler {
  // ─── State ─────────────────────────────────────────────────────────
  private _isRunning = false;
  private startBeat = 0;            // transport position when play was pressed
  private songEndBeat = 64;         // where to stop (beats)
  private unsubscribe: (() => void) | null = null;

  // ─── Registered clips per track ────────────────────────────────────
  private tracks = new Map<string, RegisteredTrack>();

  // ─── Active audio sources (for stopping on pause/seek) ────────────
  private activeSources: ActiveAudioSource[] = [];

  // ─── Audio buffers cache (decoded) ─────────────────────────────────
  private bufferCache = new Map<string, AudioBuffer>();

  // ─── Clip state tracking ───────────────────────────────────────────
  private startedClipIds = new Set<string>();   // clips that have been triggered this playback
  private lastTimelineBeat = 0;

  // ─── Callbacks ─────────────────────────────────────────────────────
  private songEndListeners = new Set<SongEndCallback>();
  private clipEventListeners = new Set<ClipEventCallback>();
  private midiNoteCallback: ((note: TrackNote, audioTime: number, trackId: string) => void) | null = null;

  // ─── Public getters ────────────────────────────────────────────────
  get isRunning() { return this._isRunning; }

  get currentTimelineBeat(): number {
    return this.lastTimelineBeat;
  }

  // ─── Clip registration ─────────────────────────────────────────────

  /** Register or update clips for a track. Call whenever clips change. */
  setClips(trackId: string, clips: ArrangementClip[], muted = false, solo = false) {
    this.tracks.set(trackId, { clips, muted, solo });
  }

  /** Remove a track's clips. */
  removeTrack(trackId: string) {
    this.tracks.delete(trackId);
    // Stop any active sources for this track
    this.activeSources = this.activeSources.filter(s => {
      const clip = this.findClipById(s.clipId);
      if (!clip) {
        try { s.source.stop(); } catch {}
        return false;
      }
      return true;
    });
  }

  /** Clear all registered clips. */
  clearAll() {
    this.tracks.clear();
    this.stopAllSources();
  }

  // ─── Audio buffer management ───────────────────────────────────────

  /** Pre-load and decode an audio URL for clip playback. */
  async loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) return this.bufferCache.get(url)!;
    const ctx = getAudioContext();
    if (!ctx) return null;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch (e) {
      console.error('[ArrangementScheduler] Failed to load audio:', url, e);
      return null;
    }
  }

  /** Set a pre-decoded buffer (e.g., from a recording). */
  setAudioBuffer(url: string, buffer: AudioBuffer) {
    this.bufferCache.set(url, buffer);
  }

  // ─── Transport control ─────────────────────────────────────────────

  /**
   * Start arrangement playback. Called by TransportContext.play() when
   * transportMode === 'arrangement'.
   *
   * @param startBeat The beat position to start from (transport position).
   * @param songEndBeat Where to stop playback.
   */
  start(startBeat: number, songEndBeat: number) {
    if (this._isRunning) this.stop();

    this.startBeat = startBeat;
    this.songEndBeat = songEndBeat;
    this.lastTimelineBeat = startBeat;
    this.startedClipIds.clear();
    this._isRunning = true;

    // Subscribe to the master clock
    this.unsubscribe = pianoRollScheduler.subscribe(this.onStep);

    // Pre-load audio buffers for all registered audio clips
    for (const [, track] of this.tracks) {
      for (const clip of track.clips) {
        if (clip.type === 'audio' && clip.audioUrl && !this.bufferCache.has(clip.audioUrl)) {
          this.loadAudioBuffer(clip.audioUrl);
        }
      }
    }
  }

  stop() {
    this._isRunning = false;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.stopAllSources();
    this.startedClipIds.clear();
  }

  /** Update song end without restarting. */
  setSongEnd(beat: number) {
    this.songEndBeat = beat;
  }

  // ─── Event subscriptions ───────────────────────────────────────────

  onSongEnd(cb: SongEndCallback): () => void {
    this.songEndListeners.add(cb);
    return () => this.songEndListeners.delete(cb);
  }

  onClipEvent(cb: ClipEventCallback): () => void {
    this.clipEventListeners.add(cb);
    return () => this.clipEventListeners.delete(cb);
  }

  /** Register a callback for MIDI notes that need to be played. */
  onMidiNote(cb: (note: TrackNote, audioTime: number, trackId: string) => void): () => void {
    this.midiNoteCallback = cb;
    return () => { this.midiNoteCallback = null; };
  }

  // ─── Core step handler ─────────────────────────────────────────────

  private onStep: StepCallback = (_step, audioTime, rawStep) => {
    if (!this._isRunning) return;

    // Convert rawStep (16th notes from scheduler start) to absolute timeline beat
    const timelineBeat = this.startBeat + rawStep * 0.25;
    this.lastTimelineBeat = timelineBeat;

    // Check song end
    if (timelineBeat >= this.songEndBeat) {
      this._isRunning = false;
      this.songEndListeners.forEach(cb => { try { cb(); } catch {} });
      return;
    }

    // Determine which tracks have solo active
    let hasSolo = false;
    for (const [, track] of this.tracks) {
      if (track.solo) { hasSolo = true; break; }
    }

    // Process each track's clips
    for (const [trackId, track] of this.tracks) {
      // Mute/solo logic
      if (track.muted) continue;
      if (hasSolo && !track.solo) continue;

      for (const clip of track.clips) {
        this.processClip(clip, trackId, timelineBeat, audioTime);
      }
    }
  };

  private processClip(clip: ArrangementClip, trackId: string, timelineBeat: number, audioTime: number) {
    const clipActive = timelineBeat >= clip.startBeat && timelineBeat < clip.endBeat;

    // ── Clip start trigger ──
    if (clipActive && !this.startedClipIds.has(clip.id)) {
      this.startedClipIds.add(clip.id);

      // Notify listeners
      this.clipEventListeners.forEach(cb => {
        try { cb({ type: 'clipStart', trackId, clip, audioTime }); } catch {}
      });

      // Handle based on clip type
      if (clip.type === 'audio' && clip.audioUrl) {
        this.startAudioClip(clip, trackId, timelineBeat, audioTime);
      }
    }

    // ── MIDI note scheduling ──
    if (clip.type === 'midi' && clipActive && clip.notes && this.midiNoteCallback) {
      // Schedule notes that fall within this 16th-note step
      const stepBeatStart = timelineBeat;
      const stepBeatEnd = timelineBeat + 0.25;

      for (const note of clip.notes) {
        if (note.step === undefined) continue;
        // Note position relative to clip start
        const noteBeat = clip.startBeat + (note.step * 0.25) - clip.offsetBeat;
        if (noteBeat >= stepBeatStart && noteBeat < stepBeatEnd) {
          // Calculate precise audioTime for this note
          const ctx = getAudioContext();
          if (ctx) {
            const beatOffset = noteBeat - timelineBeat;
            const bps = pianoRollScheduler.bpm / 60;
            const noteAudioTime = audioTime + (beatOffset / bps);
            this.midiNoteCallback(note, noteAudioTime, trackId);
          }
        }
      }
    }

    // ── Clip end detection ──
    if (!clipActive && this.startedClipIds.has(clip.id) && timelineBeat >= clip.endBeat) {
      this.clipEventListeners.forEach(cb => {
        try { cb({ type: 'clipEnd', trackId, clip, audioTime }); } catch {}
      });
    }
  }

  private startAudioClip(clip: ArrangementClip, _trackId: string, timelineBeat: number, audioTime: number) {
    const ctx = getAudioContext();
    if (!ctx || !clip.audioUrl) return;

    const buffer = this.bufferCache.get(clip.audioUrl);
    if (!buffer) {
      // Buffer not loaded yet — try to load and skip this occurrence
      this.loadAudioBuffer(clip.audioUrl);
      return;
    }

    const bps = pianoRollScheduler.bpm / 60;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    gainNode.gain.value = clip.gain;

    // Calculate when this clip should actually start playing
    const beatOffset = clip.startBeat - timelineBeat;
    const clipStartTime = audioTime + Math.max(0, beatOffset / bps);

    // Calculate playback offset (for trimmed clips or mid-clip seeks)
    let playOffset = clip.offsetBeat / bps;
    let playDuration = (clip.endBeat - clip.startBeat) / bps;

    if (timelineBeat > clip.startBeat) {
      // Seeking into the middle of a clip
      const skipBeats = timelineBeat - clip.startBeat;
      playOffset += skipBeats / bps;
      playDuration -= skipBeats / bps;
    }

    if (playDuration <= 0) return;

    // Fade in
    if (clip.fadeInBeats > 0 && timelineBeat <= clip.startBeat) {
      const fadeInDuration = clip.fadeInBeats / bps;
      gainNode.gain.setValueAtTime(0, clipStartTime);
      gainNode.gain.linearRampToValueAtTime(clip.gain, clipStartTime + fadeInDuration);
    }

    // Fade out
    if (clip.fadeOutBeats > 0) {
      const fadeOutDuration = clip.fadeOutBeats / bps;
      const fadeOutStart = clipStartTime + playDuration - fadeOutDuration;
      gainNode.gain.setValueAtTime(clip.gain, Math.max(clipStartTime, fadeOutStart));
      gainNode.gain.linearRampToValueAtTime(0, clipStartTime + playDuration);
    }

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (clip.loop) {
      source.loop = true;
      source.loopStart = clip.offsetBeat / bps;
      source.loopEnd = (clip.loopEndBeat - clip.startBeat + clip.offsetBeat) / bps;
    }

    source.start(clipStartTime, playOffset, clip.loop ? undefined : playDuration);

    // Track for cleanup
    this.activeSources.push({ clipId: clip.id, source, gainNode });

    // Auto-remove when done
    source.onended = () => {
      this.activeSources = this.activeSources.filter(s => s.clipId !== clip.id);
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private stopAllSources() {
    for (const { source } of this.activeSources) {
      try { source.stop(); } catch {}
    }
    this.activeSources = [];
  }

  private findClipById(clipId: string): ArrangementClip | undefined {
    for (const [, track] of this.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
    return undefined;
  }
}

// Singleton — one arrangement scheduler for the whole app
export const arrangementScheduler = new ArrangementScheduler();
