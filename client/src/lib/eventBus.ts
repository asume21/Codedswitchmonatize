/**
 * Studio Event Bus - Enables loose coupling between components
 * Components can emit and listen to events without direct dependencies
 */

import mitt, { Emitter } from 'mitt';

/**
 * All event types in the studio
 */
export type StudioEvents = {
  // Song Events
  'song:uploaded': { songId: string; songName: string; audioUrl: string };
  'song:analyzed': { songId: string; analysis: any };
  'song:updated': { songId: string; updates: any };
  
  // Session Events
  'session:created': { sessionId: string; songName: string };
  'session:loaded': { sessionId: string };
  'session:updated': { sessionId: string; data: any };
  'session:closed': { sessionId: string };
  
  // Audio Events
  'audio:play': { source: string };
  'audio:pause': { source: string };
  'audio:stop': { source: string };
  'audio:seeked': { time: number };
  
  // Pattern Events
  'pattern:changed': { pattern: any; source: string };
  'pattern:exported': { pattern: any; destination: string };
  
  // Melody Events
  'melody:changed': { notes: any[]; source: string };
  'melody:exported': { notes: any[]; destination: string };
  
  // Lyrics Events
  'lyrics:updated': { lyrics: string; source: string };
  'lyrics:analyzed': { analysis: any };
  
  // Mix Events
  'mix:updated': { channels: any[]; source: string };
  'mix:exported': { mixData: any };
  
  // Tool Navigation
  'tool:opened': { tool: string; sessionId?: string };
  'tool:closed': { tool: string };
  
  // Transcription Events
  'transcription:started': { songId: string };
  'transcription:completed': { songId: string; lyrics: string };
  'transcription:failed': { songId: string; error: string };
  
  // AI Events
  'ai:request-started': { type: string; params: any };
  'ai:request-completed': { type: string; result: any };
  'ai:request-failed': { type: string; error: string };
  
  // Export Events
  'export:started': { format: string; filename: string };
  'export:completed': { format: string; url: string };
  'export:failed': { format: string; error: string };

  // Project Events
  'project:created': { projectId: string; name: string };
  'project:saved': { projectId: string };
  'project:loaded': { projectId: string; name: string };
  'project:autosaved': { projectId: string };
  'project:dirty': { projectId: string };
  'project:exported': { projectId: string; filename: string };
  'project:imported': { projectId: string; name: string };

  // Undo/Redo Events
  'undo:executed': { label: string };
  'undo:redone': { label: string };
  'undo:cleared': {};

  // Automation Events
  'automation:point-added': { laneId: string; trackId: string; parameter: string };
  'automation:point-removed': { laneId: string; trackId: string };
  'automation:curve-drawn': { laneId: string; trackId: string; pointCount: number };
  'automation:lane-created': { laneId: string; trackId: string; parameter: string };
  'automation:lane-toggled': { laneId: string; enabled: boolean };

  // Effects Chain Events
  'effects:added': { trackId: string; effectType: string; effectId: string };
  'effects:removed': { trackId: string; effectId: string };
  'effects:reordered': { trackId: string };
  'effects:param-changed': { trackId: string; effectId: string; param: string; value: number };
  'effects:bypassed': { trackId: string; effectId: string; enabled: boolean };
  'effects:preset-loaded': { trackId: string; effectId: string; presetName: string };

  // Mixer Events
  'mixer:initialized': { channelCount: number; busCount: number };
  'mixer:volume-changed': { channelId: string; volume: number };
  'mixer:pan-changed': { channelId: string; pan: number };
  'mixer:mute-toggled': { channelId: string; muted: boolean };
  'mixer:solo-toggled': { channelId: string; soloed: boolean };
  'mixer:send-changed': { channelId: string; busId: string; amount: number };
  'mixer:bus-created': { busId: string; name: string; type: string };
  'mixer:bus-removed': { busId: string };

  // Recording Events
  'recording:started': { trackId: string };
  'recording:stopped': { trackId: string; takeId: string; durationMs: number };
  'recording:paused': { trackId: string };
  'recording:resumed': { trackId: string };
  'recording:take-selected': { trackId: string; takeId: string };
  'recording:take-deleted': { trackId: string; takeId: string };
  'recording:monitoring-started': {};
  'recording:monitoring-stopped': {};

  // Clip Events
  'clip:created': { clipId: string; trackId: string };
  'clip:trimmed': { clipId: string; edge: 'start' | 'end' };
  'clip:moved': { clipId: string; newStartBeat: number };
  'clip:split': { clipId: string; leftId: string; rightId: string };
  'clip:deleted': { clipId: string; trackId: string };
  'clip:duplicated': { clipId: string; newClipId: string };
  'clip:crossfade-created': { clipAId: string; clipBId: string };
  'clip:gain-changed': { clipId: string; gain: number };
  'clip:fade-changed': { clipId: string; fadeIn: number; fadeOut: number };

  // Sample Slicer Events
  'slicer:loaded': { sampleId: string; name: string };
  'slicer:sliced': { sampleId: string; sliceCount: number; method: string };
  'slicer:slice-played': { sampleId: string; sliceId: string };
  'slicer:exported': { sampleId: string; sliceCount: number };

  // Freeze/Bounce Events
  'track:frozen': { trackId: string };
  'track:unfrozen': { trackId: string };
  'bounce:started': { trackIds: string[] };
  'bounce:completed': { url: string };
  'bounce:failed': { error: string };

  // MIDI Editor Events
  'midi:velocity-changed': { trackId: string; noteIds: string[] };
  'midi:quantized': { trackId: string; grid: string; noteCount: number };
  'midi:transposed': { trackId: string; semitones: number };
  'midi:scale-snapped': { trackId: string; scale: string; key: string };
  'midi:cc-changed': { trackId: string; cc: number };
  'midi:humanized': { trackId: string; type: 'velocity' | 'timing' };
};

/**
 * Global event bus instance
 */
export const eventBus: Emitter<StudioEvents> = mitt<StudioEvents>();

/**
 * Type-safe event emitter
 */
export function emitEvent<K extends keyof StudioEvents>(
  type: K,
  data: StudioEvents[K]
): void {
  eventBus.emit(type, data);
}

/**
 * Type-safe event listener with automatic cleanup
 */
export function useEventListener<K extends keyof StudioEvents>(
  type: K,
  handler: (data: StudioEvents[K]) => void
): () => void {
  eventBus.on(type, handler);
  return () => eventBus.off(type, handler);
}

/**
 * Subscribe to multiple events at once
 */
export function subscribeToEvents(
  subscriptions: {
    [K in keyof StudioEvents]?: (data: StudioEvents[K]) => void;
  }
): () => void {
  const unsubscribers: Array<() => void> = [];
  
  for (const [eventType, handler] of Object.entries(subscriptions)) {
    eventBus.on(eventType as any, handler as any);
    unsubscribers.push(() => eventBus.off(eventType as any, handler as any));
  }
  
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

/**
 * Event logging for debugging (can be disabled in production)
 */
const DEBUG_EVENTS = process.env.NODE_ENV === 'development';

if (DEBUG_EVENTS) {
  eventBus.on('*', (type, data) => {
    console.log(`[Event Bus] ${String(type)}:`, data);
  });
}

/**
 * React hook for listening to events
 */
import { useEffect } from 'react';

export function useStudioEvent<K extends keyof StudioEvents>(
  type: K,
  handler: (data: StudioEvents[K]) => void,
  deps: any[] = []
): void {
  useEffect(() => {
    eventBus.on(type, handler);
    return () => eventBus.off(type, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * React hook for listening to multiple events
 */
export function useStudioEvents(
  subscriptions: {
    [K in keyof StudioEvents]?: (data: StudioEvents[K]) => void;
  },
  deps: any[] = []
): void {
  useEffect(() => {
    const cleanup = subscribeToEvents(subscriptions);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Example usage:
 * 
 * // Emit an event
 * emitEvent('song:uploaded', { 
 *   songId: '123', 
 *   songName: 'My Song.mp3',
 *   audioUrl: 'https://...'
 * });
 * 
 * // Listen in a component
 * useStudioEvent('song:uploaded', (data) => {
 *   console.log('Song uploaded:', data.songName);
 *   // Update UI, load session, etc.
 * });
 * 
 * // Listen to multiple events
 * useStudioEvents({
 *   'song:uploaded': (data) => console.log('Uploaded:', data.songName),
 *   'session:created': (data) => console.log('Session:', data.sessionId),
 *   'pattern:changed': (data) => console.log('Pattern changed')
 * });
 */
