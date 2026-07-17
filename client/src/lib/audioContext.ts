import * as Tone from 'tone';
// SharedMasterBus is intentionally NOT installed at boot. It's bypassed in the
// audio path right now (each engine routes to context.destination directly)
// and constructing its nodes here would add unused audio-graph weight.

/**
 * Global Audio Context Manager
 * Ensures all audio engines (Tone.js, Soundfont, Professional Mixer)
 * share the same hardware context for seamless routing.
 */

let sharedContext: AudioContext | null = null;
let contextResumeAttempts = 0;
const MAX_RESUME_ATTEMPTS = 3;

export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    // Tone.js eagerly creates its OWN default context at module import —
    // 48 kHz, latencyHint 'interactive' (tiny buffers) — before this function
    // ever runs. Capture it now so we can dispose it after installing ours;
    // otherwise TWO audio render threads run all session (measured live
    // 2026-07-16: 48k 'interactive' running alongside the shared 44.1k
    // 'playback' — a second, crackle-prone audio thread competing for CPU).
    const orphanToneContext = Tone.getContext();

    // ALWAYS create our own context first with a larger buffer to prevent crackling.
    // 'playback' latencyHint tells the browser to use a bigger audio buffer
    // (~1024-2048 samples instead of ~128-256), which prevents audio glitches
    // when the main thread is busy processing mouse/keyboard UI events.
    sharedContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'playback',
      sampleRate: 44100,
    });

    // Force Tone.js to use OUR context (not its own default small-buffer one)
    const toneContext = new Tone.Context(sharedContext);
    // lookAhead is the scheduler's safety margin against main-thread jank. The
    // Organism page renders heavy visualizers/meters at ~60fps; with a small
    // lookAhead, a single dropped frame starves Tone's lookahead loop and the
    // audio buffer underruns → the crackle + brief silence that clears the
    // moment you navigate away (UI unmounts, main thread frees up). 0.2s gives
    // the scheduler ~2× the headroom to ride out UI stalls. Latency cost is
    // imperceptible for generative playback; reactive (mic/MIDI) paths still
    // respond well under ~200ms.
    toneContext.lookAhead = 0.2;
    Tone.setContext(toneContext);

    // Kill the orphan: close Tone's import-time default context so its audio
    // thread stops. Nothing user-facing can have scheduled onto it — every
    // app path routes through this function's shared context — and Tone's
    // dispose() closes the raw AudioContext it created.
    try {
      if (orphanToneContext.rawContext !== (sharedContext as unknown)) {
        void orphanToneContext.dispose();
      }
    } catch (err) {
      console.warn('🔊 Could not dispose Tone default context:', err);
    }

    // Add error handling for audio context
    sharedContext.addEventListener('statechange', handleContextStateChange);
  }
  return sharedContext;
}

function handleContextStateChange() {
  if (!sharedContext) return;
  
  console.log('🔊 Audio Context state changed:', sharedContext.state);
  
  // Auto-resume if suspended (common after user interaction)
  if (sharedContext.state === 'suspended' && contextResumeAttempts < MAX_RESUME_ATTEMPTS) {
    contextResumeAttempts++;
    setTimeout(async () => {
      try {
        await sharedContext?.resume();
        contextResumeAttempts = 0; // Reset on success
      } catch (error) {
        console.error('🔊 Failed to resume audio context:', error);
      }
    }, 100);
  }
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  
  try {
    // Resume context if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
      console.log('🔊 Audio context resumed successfully');
    }
    
    // Start Tone.js if not running
    if (Tone.context.state !== 'running') {
      await Tone.start();
      console.log('🔊 Tone.js started successfully');
    }
    
    // Reset resume attempts on successful resume
    contextResumeAttempts = 0;
    
  } catch (error) {
    console.error('🔊 Failed to resume audio context:', error);
    
    // Fallback: try to recreate context if resume fails
    if (contextResumeAttempts >= MAX_RESUME_ATTEMPTS) {
      console.warn('🔊 Max resume attempts reached, attempting to recreate audio context');
      // TEMP DIAGNOSTIC (remove after Organism-silence root cause confirmed):
      // recreating the shared context orphans every live Tone node (gains → NaN).
      // If this fires during a silent-out, this is the hijack, not the kill switch.
      console.trace('[audio-context] RECREATING shared AudioContext — orphans live nodes →');
      try {
        // Close old context
        if (sharedContext) {
          sharedContext.removeEventListener('statechange', handleContextStateChange);
          await sharedContext.close();
        }
        
        // Create new context.
        sharedContext = null;
        const newContext = getAudioContext();
        await newContext.resume();
        await Tone.start();
        
        console.log('🔊 Audio context recreated successfully');
        contextResumeAttempts = 0;
      } catch (recreateError) {
        console.error('🔊 Failed to recreate audio context:', recreateError);
      }
    }
  }
  
  console.log('🔊 Audio Context State:', ctx.state, 'Tone.js State:', Tone.context.state);
}
