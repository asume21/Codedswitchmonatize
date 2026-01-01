import * as Tone from 'tone';

/**
 * Global Audio Context Manager
 * Ensures all audio engines (Tone.js, Soundfont, Professional Mixer)
 * share the same hardware context for seamless routing.
 */

let sharedContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    // If Tone.js is already running, use its context
    if (Tone.context && Tone.context.rawContext) {
      sharedContext = Tone.context.rawContext as AudioContext;
    } else {
      // Create a new one
      sharedContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Inform Tone.js to use this context
      Tone.setContext(new Tone.Context(sharedContext));
    }
  }
  return sharedContext;
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  
  if (Tone.context.state !== 'running') {
    await Tone.start();
  }
  
  console.log('🔊 Audio Context Resumed:', ctx.state);
}
