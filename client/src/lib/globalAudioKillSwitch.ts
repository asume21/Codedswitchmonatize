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
    console.log('🔴 GLOBAL AUDIO KILL SWITCH ACTIVATED — NUCLEAR MODE');
    this._killed = true;

    // 1. Stop ALL tracked HTMLAudioElements (includes hidden new Audio() calls)
    this.audioElements.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.removeAttribute('src');
        audio.load(); // forces release
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

    // 7. BRUTE FORCE: Stop ALL <audio> and <video> elements in the DOM
    document.querySelectorAll('audio, video').forEach(el => {
      try {
        const media = el as HTMLMediaElement;
        media.pause();
        media.currentTime = 0;
        media.src = '';
        media.removeAttribute('src');
        media.load();
      } catch { /* ignore */ }
    });

    // 8. Stop any iframes that might be playing audio
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        iframe.src = 'about:blank';
      } catch { /* ignore */ }
    });

    // Clear tracking sets
    this.audioElements.clear();
    this.oscillators.clear();
    this.audioSources.clear();
    this.audioContexts.clear();

    console.log('✅ ALL AUDIO KILLED — Nothing should be playing');

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
}

// Global keyboard shortcut: Escape or Ctrl+Shift+K kills all audio
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.shiftKey && e.key === 'K') || e.key === 'Escape') {
      globalAudioKillSwitch.killAllAudio();
    }
  });
}
