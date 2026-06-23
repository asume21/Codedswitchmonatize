// client/src/lib/bridgeExporter.ts

import { getAudioContext } from './audioContext';
import { desktopBridge } from './desktopBridge';

/**
 * Converts Web Audio Context time (seconds) to Client high-res time (milliseconds)
 */
export function audioTimeToClientTime(audioTime: number): number {
  const ctx = getAudioContext();
  if (!ctx) return performance.now();
  const audioNow = ctx.currentTime;
  const clientNow = performance.now();
  return clientNow + (audioTime - audioNow) * 1000;
}

/**
 * Maps a musical note to the closest available piano sample name in assets.
 * Assets have A1, A2, A3, A4, A5, A6 WAV files.
 */
function getClosestPianoSample(note: string, octave: number): string {
  // Safe clamp octave between 1 and 6 based on copied WAV assets
  const safeOctave = Math.max(1, Math.min(6, octave));
  return `uprightPiano_A${safeOctave}`;
}

/**
 * Maps note and octave to the corresponding drum WAV file name in assets.
 */
function mapMidiNoteToDrum(note: string, octave: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const normalized = String(note || '').toUpperCase();
  const noteIndex = noteNames.indexOf(normalized);
  const midiNote = noteIndex >= 0 ? ((octave + 1) * 12 + noteIndex) : 36;

  if (midiNote <= 36) return 'kick';
  if (midiNote <= 40) return 'snare';
  if (midiNote <= 45) return 'hat';
  if (midiNote <= 49) return 'hat'; // tom fallback to hat
  if (midiNote <= 57) return 'perc';
  return 'snare';
}

/**
 * Intercepts a note playback request.
 * Returns true if the note was handled (exported to desktop bridge),
 * and false if the browser audio system should play it.
 */
export function exportNoteToBridge(
  note: string,
  octave: number,
  duration: number,
  instrument: string,
  velocity: number,
  when?: number
): boolean {
  // If the bridge is active and connected, export note
  const isBridgeActive = localStorage.getItem('cs_desktop_bridge_active') === 'true';
  if (!isBridgeActive || !desktopBridge.isConnected) {
    return false;
  }

  // Calculate target client time in milliseconds
  const clientPlayMs = when !== undefined ? audioTimeToClientTime(when) : (performance.now() + 20);

  const instLower = String(instrument || '').toLowerCase();

  if (instLower === 'drums') {
    const drumName = mapMidiNoteToDrum(note, octave);
    desktopBridge.sendNote(drumName, clientPlayMs, velocity);
  } else {
    // Melodic notes mapped to the closest piano sample
    const sampleName = getClosestPianoSample(note, octave);
    desktopBridge.sendNote(sampleName, clientPlayMs, velocity);
  }

  return true;
}

/**
 * Intercepts a drum sample playback request.
 * Returns true if handled by bridge, false if browser should play it.
 */
export function exportDrumToBridge(drumType: string, velocity: number): boolean {
  const isBridgeActive = localStorage.getItem('cs_desktop_bridge_active') === 'true';
  if (!isBridgeActive || !desktopBridge.isConnected) {
    return false;
  }

  const clientPlayMs = performance.now() + 20; // play "now"
  let mappedDrum = 'kick';

  const type = String(drumType || '').toLowerCase();
  if (type === 'kick' || type === 'bass') {
    mappedDrum = 'kick';
  } else if (type === 'snare') {
    mappedDrum = 'snare';
  } else if (type === 'hihat' || type === 'openhat' || type === 'hat') {
    mappedDrum = 'hat';
  } else if (type === 'clap') {
    mappedDrum = 'clap';
  } else if (type === 'perc') {
    mappedDrum = 'perc';
  } else {
    mappedDrum = 'perc'; // fallback
  }

  desktopBridge.sendNote(mappedDrum, clientPlayMs, velocity);
  return true;
}
