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
    //
    // NO forced sampleRate: we used to pin 44100, but the user's hardware runs
    // at 48000 (measured 2026-07-16) — a pinned mismatched rate makes Chrome
    // resample EVERY output quantum forever, extra work on exactly the audio
    // thread whose missed deadlines ARE the crackle (glitch-scan proved the
    // rendered signal is clean; the clicks are real-time output underruns).
    // Matching the device rate removes that resampler. 44.1k WAV samples are
    // resampled ONCE at decode time instead, which is free at runtime.
    sharedContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'playback',
    });

    // Force Tone.js to use OUR context (not its own default small-buffer one)
    const toneContext = new Tone.Context(sharedContext);
    // TANK BUILD: lookAhead is the scheduler's safety margin against main-thread
    // jank. The Organism page renders heavy visualizers/meters at ~60fps AND
    // runs 4 generators that can all rebuild their Tone.Part loops simultaneously
    // on chord changes — that's a scheduling spike of 100+ events in one frame.
    // 0.35s gives the scheduler ~4× the headroom to ride out these spikes.
    // Latency cost is ~350ms which is imperceptible for generative playback.
    toneContext.lookAhead = 0.5;
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

    startAudioHealthMonitor(sharedContext);
  }
  return sharedContext;
}

// ── Audio-health monitor (dev diagnostics) ──────────────────────────────────
// The crackle/cutout investigation proved the rendered signal is clean and the
// clicks are REAL-TIME output underruns on the user's machine — which headless
// probes can never see. This watches the one observable symptom: while the
// context is running, the audio clock must advance 1:1 with the wall clock.
// When the audio thread misses deadlines, currentTime falls behind in bursts.
// Every stall is logged and tallied; `window.__audioHealth()` prints the
// session summary so a listening session produces NUMBERS, not vibes.
interface AudioStall { at: number; behindMs: number; outputLatencyMs: number }
const audioStalls: AudioStall[] = [];

function startAudioHealthMonitor(ctx: AudioContext): void {
  let lastWall = performance.now();
  let lastAudio = ctx.currentTime;
  let consecutiveStalls = 0;
  let totalChecks = 0;
  let totalStallMs = 0;
  // Skip the first 10s — sampler loading (string_ensemble, drum kit, marimba,
  // etc.) blocks the main thread decoding audio files. Those stalls are one-time
  // startup cost, not playback issues. Monitoring them just creates noise.
  let graceUntil = performance.now() + 10_000;

  window.setInterval(() => {
    // Grace period: skip logging during startup
    if (performance.now() < graceUntil) {
      lastWall = performance.now();
      lastAudio = ctx.currentTime;
      return;
    }
    const wall = performance.now();
    const audio = ctx.currentTime;
    if (ctx.state === 'running') {
      const wallDelta = wall - lastWall;
      const audioDelta = (audio - lastAudio) * 1000;
      const behindMs = wallDelta - audioDelta;
      const outputLatencyMs = Math.round(((ctx as any).outputLatency ?? 0) * 1000);
      // The platform's outputLatency (40-55ms on Windows WASAPI) is NORMAL
      // pipeline delay — the audio clock will always lag by at least that much.
      // Only flag when behindMs exceeds outputLatency + 50ms (a real stall).
      const realStallThreshold = outputLatencyMs + 50;
      if (behindMs > realStallThreshold) {
        consecutiveStalls++;
        totalStallMs += behindMs;
        const stall: AudioStall = {
          at: Math.round(wall),
          behindMs: Math.round(behindMs),
          outputLatencyMs,
        };
        audioStalls.push(stall);
        // Only log every 10th real stall to avoid console spam
        if (consecutiveStalls % 10 === 1) {
          console.warn(`🩺 [audio-health] real stall #${consecutiveStalls}: audio clock fell ${stall.behindMs}ms behind (outputLatency ${stall.outputLatencyMs}ms, threshold ${realStallThreshold}ms)`);
        }
        // TANK BUILD: if we stall 5+ times consecutively with >300ms behind,
        // the scheduler is drowning. Force a reset.
        if (consecutiveStalls >= 5 && behindMs > 300) {
          console.warn('🩺 [audio-health] TANK RECOVERY: resetting audio context to clear stall backlog');
          ctx.suspend().then(() => ctx.resume()).catch(() => {});
          consecutiveStalls = 0;
          lastAudio = ctx.currentTime;
          lastWall = performance.now();
          return;
        }
      } else {
        consecutiveStalls = Math.max(0, consecutiveStalls - 1);
      }
      totalChecks++;
    }
    lastWall = wall;
    lastAudio = audio;
  }, 500);

  (window as any).__audioHealth = () => ({
    sampleRate: ctx.sampleRate,
    baseLatencyMs: Math.round((ctx.baseLatency ?? 0) * 1000),
    outputLatencyMs: Math.round(((ctx as any).outputLatency ?? 0) * 1000),
    state: ctx.state,
    totalChecks,
    realStallCount: audioStalls.length,
    avgStallMs: audioStalls.length > 0 ? Math.round(totalStallMs / audioStalls.length) : 0,
    worstStallMs: audioStalls.reduce((m, s) => Math.max(m, s.behindMs), 0),
    recentStalls: audioStalls.slice(-5),
  });
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
