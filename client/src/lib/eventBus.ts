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
