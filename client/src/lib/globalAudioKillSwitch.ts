/**
 * Global Audio Kill Switch — NUCLEAR EDITION
 * Intercepts ALL audio creation globally via monkey-patching.
 * Nothing can escape: new Audio(), AudioContext, oscillators, etc.
 */

import { realisticAudio } from './realisticAudio';
import { professionalAudio } from './professionalAudio';

class GlobalAudioKillSwitch {
  private audioElements: Set<HTMLAudioElement> = new Set();
  private audioContexts: Set<AudioContext> = new Set();
  private oscillators: Set<OscillatorNode> = new Set();
  private audioSources: Set<AudioBufferSourceNode> = new Set();
  private _killed = false;

  get isKilled() {
    return this._killed;
  }

  registerAudioElement(audio: HTMLAudioElement) {
    this.audioElements.add(audio);
    // Auto-remove when ended to prevent memory leaks
    audio.addEventListener('ended', () => this.audioElements.delete(audio), { once: true });
  }

  registerAudioContext(ctx: AudioContext) {
    this.audioContexts.add(ctx);
  }

  registerOscillator(osc: OscillatorNode) {
    this.oscillators.add(osc);
  }

  registerAudioSource(source: AudioBufferSourceNode) {
    this.audioSources.add(source);
  }

  unregisterAudioElement(audio: HTMLAudioElement) {
    this.audioElements.delete(audio);
  }

  unregisterOscillator(osc: OscillatorNode) {
    this.oscillators.delete(osc);
  }

  unregisterAudioSource(source: AudioBufferSourceNode) {
    this.audioSources.delete(source);
  }

  /**
   * KILL ALL AUDIO — Nuclear option.
   * Stops every tracked element, every DOM element, every AudioContext.
   */
  killAllAudio() {
    console.log(' GLOBAL AUDIO KILL SWITCH ACTIVATED — NUCLEAR MODE');
    // TEMP DIAGNOSTIC (remove after Organism-silence root cause confirmed):
    // logs WHO triggered the nuke so we can see if a studio stop() is killing a
    // live Organism session. See memory: project_organism_silence_audio_routing.
    console.trace('[kill-switch] killAllAudio() called by →');
    this._killed = true;

    // 1. Stop ALL tracked HTMLAudioElements (includes hidden new Audio() calls)
    this.audioElements.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) { /* ignore */ }
    });

    // 2. Stop ALL oscillators
    this.oscillators.forEach(osc => {
      try { osc.stop(); } catch { /* already stopped */ }
      try { osc.disconnect(); } catch { /* ignore */ }
    });

    // 3. Stop ALL AudioBufferSourceNodes
    this.audioSources.forEach(source => {
      try { source.stop(); } catch { /* already stopped */ }
      try { source.disconnect(); } catch { /* ignore */ }
    });

    // 4. Suspend ALL AudioContexts (do NOT close — closed contexts can never be reused)
    this.audioContexts.forEach(ctx => {
      try {
        if (ctx.state === 'running') ctx.suspend();
      } catch { /* ignore */ }
    });

    // 5. Stop realisticAudio engine
    try { realisticAudio.stopAllSounds(); } catch { /* ignore */ }

    // 6. Stop professionalAudio engine (suspend its AudioContext)
    try {
      const proCtx = (professionalAudio as any).audioContext as AudioContext | null;
      if (proCtx && proCtx.state !== 'closed') { proCtx.suspend(); }
    } catch { /* ignore */ }

    // 6b. Stop Tone.js transport — scheduled events keep firing even when ctx is suspended
    try {
      const toneRef = (window as any).__toneRef;
      if (toneRef) {
        const t = typeof toneRef.getTransport === 'function' ? toneRef.getTransport() : toneRef.Transport;
        t?.stop?.();
        t?.cancel?.(0);
      }
    } catch { /* ignore */ }

    // 7. BRUTE FORCE: Stop ALL <audio> and <video> elements in the DOM
    document.querySelectorAll('audio, video').forEach(el => {
      try {
        const media = el as HTMLMediaElement;
        media.pause();
        media.currentTime = 0;
      } catch { /* ignore */ }
    });

    // Clear tracking sets
    this.audioElements.clear();
    this.oscillators.clear();
    this.audioSources.clear();

    console.log(' ALL AUDIO KILLED — Nothing should be playing');

    // Reset killed state after a short delay so new audio can be created
    setTimeout(() => { this._killed = false; }, 500);
  }
}

// Singleton instance
export const globalAudioKillSwitch = new GlobalAudioKillSwitch();

// ═══════════════════════════════════════════════════════════════════════════════
// MONKEY-PATCH: Intercept ALL new Audio() calls globally
// This is the key fix — new Audio() elements are NOT in the DOM,
// so querySelectorAll('audio') can't find them.
// By patching the constructor, we auto-track every single one.
// ═══════════════════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  const OriginalAudio = window.Audio;

  (window as any).Audio = function PatchedAudio(src?: string): HTMLAudioElement {
    const audio = new OriginalAudio(src);
    globalAudioKillSwitch.registerAudioElement(audio);
    return audio;
  } as unknown as typeof Audio;

  // Preserve prototype chain so instanceof checks still work
  window.Audio.prototype = OriginalAudio.prototype;

  // Preserve static methods/properties (e.g. Audio.NETWORK_IDLE, Audio.HAVE_ENOUGH_DATA)
  Object.assign(window.Audio, OriginalAudio);

  // Also patch AudioContext to auto-track all contexts
  const OriginalAudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (OriginalAudioContext) {
    (window as any).AudioContext = function PatchedAudioContext(
      ...args: ConstructorParameters<typeof AudioContext>
    ): AudioContext {
      const ctx = new OriginalAudioContext(...args);
      globalAudioKillSwitch.registerAudioContext(ctx);
      return ctx;
    } as unknown as typeof AudioContext;

    window.AudioContext.prototype = OriginalAudioContext.prototype;
  }

  // Also patch webkitAudioContext (Safari) if it's a distinct constructor
  const WebkitAC = (window as any).webkitAudioContext;
  if (WebkitAC && WebkitAC !== OriginalAudioContext) {
    (window as any).webkitAudioContext = function PatchedWebkitAudioContext(
      ...args: any[]
    ): AudioContext {
      const ctx = new WebkitAC(...args);
      globalAudioKillSwitch.registerAudioContext(ctx);
      return ctx;
    };
    (window as any).webkitAudioContext.prototype = WebkitAC.prototype;
  }

  // Patch BaseAudioContext prototype — every createBufferSource / createOscillator
  // call auto-registers, so all ~25 files using raw Web Audio are covered without edits.
  const BAC = (window as any).BaseAudioContext;
  if (BAC && BAC.prototype) {
    const origCBS = BAC.prototype.createBufferSource;
    if (origCBS) {
      BAC.prototype.createBufferSource = function (...args: any[]) {
        const source = origCBS.apply(this, args);
        try { globalAudioKillSwitch.registerAudioSource(source); } catch { /* ignore */ }
        return source;
      };
    }
    const origCO = BAC.prototype.createOscillator;
    if (origCO) {
      BAC.prototype.createOscillator = function (...args: any[]) {
        const osc = origCO.apply(this, args);
        try { globalAudioKillSwitch.registerOscillator(osc); } catch { /* ignore */ }
        return osc;
      };
    }
  }

  // Patch document.createElement so <audio> created via DOM API is also tracked
  // (covers SongUploader / SongUploadPanel which bypass `new Audio()`).
  if (typeof document !== 'undefined') {
    const origCreateElement = document.createElement.bind(document);
    (document as any).createElement = function (tagName: string, ...rest: any[]) {
      const el = origCreateElement(tagName as any, ...(rest as []));
      if (typeof tagName === 'string' && tagName.toLowerCase() === 'audio') {
        try { globalAudioKillSwitch.registerAudioElement(el as HTMLAudioElement); } catch { /* ignore */ }
      }
      return el;
    };
  }
}

// Global keyboard shortcut: Ctrl+Shift+K kills all audio
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      globalAudioKillSwitch.killAllAudio();
    }
  });
}
