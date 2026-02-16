/**
 * Clip Editor — Non-destructive audio clip editing.
 * Supports: trim start/end, fade in/out, crossfade, clip gain envelopes.
 * All edits are non-destructive — original audio is never modified.
 */

import type { AudioClip } from '@/lib/projectManager';

/**
 * Create a new audio clip with default values.
 */
export function createAudioClip(
  trackId: string,
  audioUrl: string,
  name: string,
  startBeat: number,
  durationBeats: number,
  source: AudioClip['source'] = 'imported',
): AudioClip {
  return {
    id: crypto.randomUUID(),
    trackId,
    name,
    audioUrl,
    startBeat,
    endBeat: startBeat + durationBeats,
    offsetBeat: 0,
    fadeInBeats: 0,
    fadeOutBeats: 0,
    gain: 1,
    loop: false,
    loopEndBeat: startBeat + durationBeats,
    source,
  };
}

/**
 * Trim the start of a clip (move the left edge inward).
 * This adjusts both the visible start and the internal offset.
 */
export function trimClipStart(clip: AudioClip, newStartBeat: number): AudioClip {
  const minStart = clip.startBeat - clip.offsetBeat; // can't go before source start
  const clampedStart = Math.max(minStart, Math.min(newStartBeat, clip.endBeat - 0.25));
  const deltaBeats = clampedStart - clip.startBeat;

  return {
    ...clip,
    startBeat: clampedStart,
    offsetBeat: clip.offsetBeat + deltaBeats,
  };
}

/**
 * Trim the end of a clip (move the right edge inward).
 */
export function trimClipEnd(clip: AudioClip, newEndBeat: number): AudioClip {
  const clampedEnd = Math.max(clip.startBeat + 0.25, newEndBeat);
  return {
    ...clip,
    endBeat: clampedEnd,
  };
}

/**
 * Move a clip to a new position on the timeline.
 */
export function moveClip(clip: AudioClip, newStartBeat: number): AudioClip {
  const duration = clip.endBeat - clip.startBeat;
  return {
    ...clip,
    startBeat: Math.max(0, newStartBeat),
    endBeat: Math.max(0, newStartBeat) + duration,
  };
}

/**
 * Move a clip to a different track.
 */
export function moveClipToTrack(clip: AudioClip, newTrackId: string): AudioClip {
  return { ...clip, trackId: newTrackId };
}

/**
 * Set fade in duration (in beats).
 */
export function setFadeIn(clip: AudioClip, fadeInBeats: number): AudioClip {
  const maxFade = (clip.endBeat - clip.startBeat) * 0.5;
  return {
    ...clip,
    fadeInBeats: Math.max(0, Math.min(fadeInBeats, maxFade)),
  };
}

/**
 * Set fade out duration (in beats).
 */
export function setFadeOut(clip: AudioClip, fadeOutBeats: number): AudioClip {
  const maxFade = (clip.endBeat - clip.startBeat) * 0.5;
  return {
    ...clip,
    fadeOutBeats: Math.max(0, Math.min(fadeOutBeats, maxFade)),
  };
}

/**
 * Set clip gain (0-2, where 1 = unity).
 */
export function setClipGain(clip: AudioClip, gain: number): AudioClip {
  return {
    ...clip,
    gain: Math.max(0, Math.min(2, gain)),
  };
}

/**
 * Toggle loop mode on a clip.
 */
export function toggleClipLoop(clip: AudioClip, loop: boolean, loopEndBeat?: number): AudioClip {
  return {
    ...clip,
    loop,
    loopEndBeat: loopEndBeat ?? clip.endBeat,
  };
}

/**
 * Split a clip at a specific beat position, creating two clips.
 */
export function splitClip(clip: AudioClip, splitBeat: number): [AudioClip, AudioClip] | null {
  if (splitBeat <= clip.startBeat || splitBeat >= clip.endBeat) return null;

  const leftClip: AudioClip = {
    ...clip,
    id: crypto.randomUUID(),
    endBeat: splitBeat,
    fadeOutBeats: 0,
  };

  const rightClip: AudioClip = {
    ...clip,
    id: crypto.randomUUID(),
    startBeat: splitBeat,
    offsetBeat: clip.offsetBeat + (splitBeat - clip.startBeat),
    fadeInBeats: 0,
  };

  return [leftClip, rightClip];
}

/**
 * Duplicate a clip (place copy right after the original).
 */
export function duplicateClip(clip: AudioClip): AudioClip {
  const duration = clip.endBeat - clip.startBeat;
  return {
    ...clip,
    id: crypto.randomUUID(),
    startBeat: clip.endBeat,
    endBeat: clip.endBeat + duration,
  };
}

/**
 * Create a crossfade between two adjacent clips on the same track.
 * Returns the modified clips with overlapping fade regions.
 */
export function createCrossfade(
  clipA: AudioClip,
  clipB: AudioClip,
  crossfadeBeats: number,
): [AudioClip, AudioClip] | null {
  // clipA must end before or at clipB's start
  if (clipA.trackId !== clipB.trackId) return null;

  const sorted = clipA.startBeat <= clipB.startBeat ? [clipA, clipB] : [clipB, clipA];
  const [first, second] = sorted;

  const maxCrossfade = Math.min(
    (first.endBeat - first.startBeat) * 0.5,
    (second.endBeat - second.startBeat) * 0.5,
  );
  const fadeDuration = Math.min(crossfadeBeats, maxCrossfade);

  // Extend first clip and overlap with second
  const newFirst: AudioClip = {
    ...first,
    endBeat: first.endBeat + fadeDuration * 0.5,
    fadeOutBeats: fadeDuration,
  };

  const newSecond: AudioClip = {
    ...second,
    startBeat: second.startBeat - fadeDuration * 0.5,
    offsetBeat: second.offsetBeat - fadeDuration * 0.5,
    fadeInBeats: fadeDuration,
  };

  return [newFirst, newSecond];
}

/**
 * Apply clip edits to a Web Audio source for playback.
 * Returns the configured source node ready to play.
 */
export function applyClipToAudioSource(
  ctx: AudioContext,
  clip: AudioClip,
  sourceBuffer: AudioBuffer,
  bpm: number,
  destination: AudioNode,
): AudioBufferSourceNode {
  const beatsPerSecond = bpm / 60;
  const source = ctx.createBufferSource();
  source.buffer = sourceBuffer;

  // Clip gain
  const gainNode = ctx.createGain();
  gainNode.gain.value = clip.gain;

  // Fade in
  if (clip.fadeInBeats > 0) {
    const fadeInDuration = clip.fadeInBeats / beatsPerSecond;
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(clip.gain, ctx.currentTime + fadeInDuration);
  }

  // Fade out
  if (clip.fadeOutBeats > 0) {
    const clipDuration = (clip.endBeat - clip.startBeat) / beatsPerSecond;
    const fadeOutStart = clipDuration - (clip.fadeOutBeats / beatsPerSecond);
    gainNode.gain.setValueAtTime(clip.gain, ctx.currentTime + fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + clipDuration);
  }

  source.connect(gainNode);
  gainNode.connect(destination);

  // Calculate playback offset and duration
  const offsetSeconds = clip.offsetBeat / beatsPerSecond;
  const durationSeconds = (clip.endBeat - clip.startBeat) / beatsPerSecond;

  if (clip.loop) {
    source.loop = true;
    source.loopStart = offsetSeconds;
    source.loopEnd = offsetSeconds + durationSeconds;
  }

  source.start(0, offsetSeconds, clip.loop ? undefined : durationSeconds);
  return source;
}

/**
 * Get the visible duration of a clip in beats.
 */
export function getClipDuration(clip: AudioClip): number {
  return clip.endBeat - clip.startBeat;
}

/**
 * Check if two clips overlap on the same track.
 */
export function clipsOverlap(a: AudioClip, b: AudioClip): boolean {
  if (a.trackId !== b.trackId) return false;
  return a.startBeat < b.endBeat && b.startBeat < a.endBeat;
}

/**
 * Snap a beat position to the nearest grid division.
 */
export function snapToGrid(beat: number, gridSize: number): number {
  return Math.round(beat / gridSize) * gridSize;
}

/**
 * Get all clips for a track, sorted by start position.
 */
export function getTrackClips(clips: AudioClip[], trackId: string): AudioClip[] {
  return clips
    .filter(c => c.trackId === trackId)
    .sort((a, b) => a.startBeat - b.startBeat);
}
