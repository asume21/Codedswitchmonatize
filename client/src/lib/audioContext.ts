import * as Tone from 'tone';

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
    // If Tone.js is already running, use its context
    if (Tone.context && Tone.context.rawContext) {
      sharedContext = Tone.context.rawContext as AudioContext;
    } else {
      // Create a new one with optimized settings for production
      sharedContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Optimize audio context for production to reduce crackling
      if (sharedContext.sampleRate > 48000) {
        console.warn(`🔊 High sample rate detected: ${sharedContext.sampleRate}Hz. This may cause performance issues.`);
      }
      
      // Inform Tone.js to use this context
      Tone.setContext(new Tone.Context(sharedContext));
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
      try {
        // Close old context
        if (sharedContext) {
          sharedContext.removeEventListener('statechange', handleContextStateChange);
          await sharedContext.close();
        }
        
        // Create new context
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
