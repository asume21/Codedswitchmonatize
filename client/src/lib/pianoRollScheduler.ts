/**
 * pianoRollScheduler — Global Web Audio lookahead scheduler
 *
 * This is the single audio clock for the entire studio. All components
 * that need step-accurate timing subscribe here instead of running their
 * own setInterval/setTimeout timers.
 *
 * Architecture:
 *   TransportContext.play()
 *     → pianoRollScheduler.start()   (this file)
 *     → Tone.Transport.start()       (for Tone.js generators)
 *   Both anchored to the same AudioContext.currentTime → zero drift.
 *
 *   Any component subscribes:
 *     const unsub = pianoRollScheduler.subscribe((step, audioTime) => { ... })
 *
 * Based on "A Tale of Two Clocks" (Chris Wilson).
 */

import { getAudioContext } from './audioContext';

// How far ahead to schedule audio (seconds)
const LOOK_AHEAD_SECS = 0.12;
// How often to run the scheduler loop (ms) — must be << LOOK_AHEAD_SECS * 1000
const SCHEDULE_INTERVAL_MS = 25;

export type StepCallback = (
  step: number,       // 0-based step within the pattern (wraps at patternSteps)
  audioTime: number,  // AudioContext.currentTime when this step fires
  rawStep: number,    // Continuously incrementing step counter (never wraps) — use for beat math
) => void;

export type VisualStepCallback = (step: number) => void;

class PianoRollScheduler {
  // ─── Pub/sub ───────────────────────────────────────────────────────────────
  private stepSubscribers = new Set<StepCallback>();
  private visualSubscribers = new Set<VisualStepCallback>();

  // ─── Internal state ────────────────────────────────────────────────────────
  private timerID: ReturnType<typeof setTimeout> | null = null;
  private rafID: number | null = null;

  private _isRunning = false;
  private _bpm = 120;
  private _patternSteps = 64;

  // `currentStep` = the NEXT step to be scheduled (0-based, wraps at patternSteps)
  // `rawStep`     = same but never wraps
  private currentStep = 0;
  private rawStep = 0;
  private nextStepAudioTime = 0;

  // ─── Public getters ────────────────────────────────────────────────────────

  get isRunning() { return this._isRunning; }
  get bpm() { return this._bpm; }
  get patternSteps() { return this._patternSteps; }

  /** Duration of one 1/16th-note in seconds */
  get stepDuration() { return 60 / this._bpm / 4; }

  /**
   * Current visual step, smoothly interpolated from AudioContext.currentTime.
   * Use this for the playhead position — it's always accurate to the hardware clock.
   */
  get visualStep(): number {
    const ctx = getAudioContext();
    if (!ctx || !this._isRunning) return this.currentStep;
    const elapsed = ctx.currentTime - (this.nextStepAudioTime - this.stepDuration);
    const frac = Math.min(1, Math.max(0, elapsed / this.stepDuration));
    const base = ((this.currentStep - 1) + this._patternSteps) % this._patternSteps;
    return Math.floor(base + frac) % this._patternSteps;
  }

  // ─── Subscription API ──────────────────────────────────────────────────────

  /**
   * Subscribe to step events. The callback fires ahead of time (by LOOK_AHEAD_SECS)
   * with the exact AudioContext timestamp — use `audioTime` to schedule Web Audio
   * nodes for sample-accurate playback.
   *
   * Returns an unsubscribe function.
   */
  subscribe(cb: StepCallback): () => void {
    this.stepSubscribers.add(cb);
    return () => this.stepSubscribers.delete(cb);
  }

  /**
   * Subscribe to visual step updates (fired via RAF — ~60fps).
   * Use this for UI elements like the playhead, step highlights.
   * Returns an unsubscribe function.
   */
  subscribeVisual(cb: VisualStepCallback): () => void {
    this.visualSubscribers.add(cb);
    return () => this.visualSubscribers.delete(cb);
  }

  // ─── Control ───────────────────────────────────────────────────────────────

  /**
   * Start the scheduler. Called by TransportContext — do NOT call from
   * individual components (they should subscribe instead).
   *
   * @param startAudioTime Optional AudioContext.currentTime to anchor the start
   *                       (pass Tone.Transport's start time to sync clocks).
   */
  start(bpm: number, patternSteps: number, startAudioTime?: number) {
    if (this._isRunning) this.stop();

    const ctx = getAudioContext();
    if (!ctx) { console.warn('[Scheduler] No AudioContext'); return; }
    if (ctx.state === 'suspended') ctx.resume();

    this._bpm = bpm;
    this._patternSteps = patternSteps;
    this.currentStep = 0;
    this.rawStep = 0;
    this.nextStepAudioTime = startAudioTime ?? (ctx.currentTime + 0.05);
    this._isRunning = true;

    this.scheduleLoop();
    this.rafLoop();
  }

  stop() {
    this._isRunning = false;
    if (this.timerID !== null) { clearTimeout(this.timerID); this.timerID = null; }
    if (this.rafID !== null) { cancelAnimationFrame(this.rafID); this.rafID = null; }
    this.currentStep = 0;
    this.rawStep = 0;
    // Notify visual subscribers so playhead snaps to 0
    this.visualSubscribers.forEach(cb => cb(0));
  }

  setBpm(bpm: number) {
    this._bpm = bpm;
    // nextStepAudioTime stays put — new tempo takes effect from next scheduled step
  }

  setPatternSteps(steps: number) {
    this._patternSteps = steps;
    if (this.currentStep >= steps) this.currentStep = 0;
  }

  seekToStep(step: number) {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.currentStep = step % this._patternSteps;
    this.rawStep = step;
    this.nextStepAudioTime = ctx.currentTime + 0.05;
  }

  /**
   * Convert an AudioContext timestamp to the pattern step it falls on.
   * Use this during MIDI/keyboard recording to get sample-accurate step positions.
   */
  audioTimeToStep(audioTime: number): number {
    if (!this._isRunning) return -1;
    const stepsFromNext = Math.floor((audioTime - this.nextStepAudioTime) / this.stepDuration);
    const raw = this.currentStep + stepsFromNext;
    return ((raw % this._patternSteps) + this._patternSteps) % this._patternSteps;
  }

  // ─── Internal loops ────────────────────────────────────────────────────────

  private scheduleLoop() {
    if (!this._isRunning) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const horizon = ctx.currentTime + LOOK_AHEAD_SECS;

    while (this.nextStepAudioTime < horizon) {
      const step = this.currentStep;
      const audioTime = this.nextStepAudioTime;
      const raw = this.rawStep;

      // Broadcast to all subscribers
      this.stepSubscribers.forEach(cb => {
        try { cb(step, audioTime, raw); } catch (e) { console.error('[Scheduler] subscriber error', e); }
      });

      this.nextStepAudioTime += this.stepDuration;
      this.currentStep = (this.currentStep + 1) % this._patternSteps;
      this.rawStep++;
    }

    this.timerID = setTimeout(() => this.scheduleLoop(), SCHEDULE_INTERVAL_MS);
  }

  private rafLoop() {
    if (!this._isRunning) return;
    const vs = this.visualStep;
    this.visualSubscribers.forEach(cb => { try { cb(vs); } catch {} });
    this.rafID = requestAnimationFrame(() => this.rafLoop());
  }
}

// Singleton — one clock for the whole app
export const pianoRollScheduler = new PianoRollScheduler();
