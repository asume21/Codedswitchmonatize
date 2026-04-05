/**
 * AstutelyOrganismBridge — Bidirectional event bridge between Astutely (brain)
 * and the Organism (real-time audio engine).
 *
 * Uses window CustomEvents to sidestep React provider ordering issues
 * (GlobalOrganismWrapper wraps AstutelyCoreProvider, not vice versa).
 *
 * Inbound:  listens to organism:physics-update, organism:state-change,
 *           organism:self-listen-report, organism:started, organism:stopped
 * Outbound: dispatches organism:command with extended action types
 */

import { OrganismMode, type PhysicsState } from '@/organism/physics/types';
import type { SelfListenReport } from '@/organism/audio/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OrganismStateSnapshot {
  current: string;
  previous: string | null;
  flowDepth: number;
  breathingWarmth: number;
}

export interface ChordSnapshot {
  label: string;
  intervals: number[];
  rootOffset: number;
  rootPitchClass: number;
}

export interface MusicalSnapshot {
  subGenre: string;
  section: string;
  energy: number;
  density: number;
  rootPitchClass: number;
  tempo: number;
  chordLabel: string;
}

export interface AstutelyOrganismBridgeState {
  physicsState: PhysicsState | null;
  organismState: OrganismStateSnapshot | null;
  selfListenReport: SelfListenReport | null;
  currentChord: ChordSnapshot | null;
  musicalState: MusicalSnapshot | null;
  isRunning: boolean;
}

type BridgeSubscriber = (state: AstutelyOrganismBridgeState) => void;

// ── Bridge Singleton ─────────────────────────────────────────────────────────

class AstutelyOrganismBridge {
  private state: AstutelyOrganismBridgeState = {
    physicsState: null,
    organismState: null,
    selfListenReport: null,
    currentChord: null,
    musicalState: null,
    isRunning: false,
  };

  private subscribers = new Set<BridgeSubscriber>();
  private connected = false;
  private handlers: Array<{ event: string; handler: EventListener }> = [];

  // ── Inbound: listen to organism events ─────────────────────────────────

  connect(): void {
    if (this.connected) return;
    this.connected = true;

    const listen = (event: string, handler: (e: CustomEvent) => void) => {
      const wrapped = (e: Event) => handler(e as CustomEvent);
      this.handlers.push({ event, handler: wrapped });
      window.addEventListener(event, wrapped);
    };

    listen('organism:physics-update', (e) => {
      this.state = { ...this.state, physicsState: e.detail as PhysicsState };
      this.notify();
    });

    listen('organism:state-change', (e) => {
      this.state = { ...this.state, organismState: e.detail as OrganismStateSnapshot };
      this.notify();
    });

    listen('organism:self-listen-report', (e) => {
      this.state = { ...this.state, selfListenReport: e.detail as SelfListenReport };
      this.notify();
    });

    listen('organism:chord-change', (e) => {
      const d = e.detail as Record<string, unknown>;
      this.state = {
        ...this.state,
        currentChord: {
          label: d.label as string,
          intervals: d.intervals as number[],
          rootOffset: d.rootOffset as number,
          rootPitchClass: d.rootPitchClass as number,
        },
      };
      this.notify();
    });

    listen('organism:musical-state', (e) => {
      this.state = { ...this.state, musicalState: e.detail as MusicalSnapshot };
      this.notify();
    });

    listen('organism:started', () => {
      this.state = { ...this.state, isRunning: true };
      this.notify();
    });

    listen('organism:stopped', () => {
      this.state = { ...this.state, isRunning: false };
      this.notify();
    });
  }

  disconnect(): void {
    if (!this.connected) return;
    for (const { event, handler } of this.handlers) {
      window.removeEventListener(event, handler);
    }
    this.handlers = [];
    this.connected = false;
  }

  // ── Outbound: send commands TO organism ────────────────────────────────

  private dispatch(action: string, detail: Record<string, unknown> = {}): void {
    window.dispatchEvent(new CustomEvent('organism:command', {
      detail: { action, ...detail },
    }));
  }

  start(inputSource?: string): void {
    this.dispatch('start', inputSource ? { inputSource } : {});
  }

  stop(): void {
    this.dispatch('stop');
  }

  quickStart(presetId: string): void {
    this.dispatch('quick-start', { presetId });
  }

  capture(): void {
    this.dispatch('capture');
  }

  lockMode(mode: OrganismMode): void {
    this.dispatch('lock-mode', { mode });
  }

  unlockMode(): void {
    this.dispatch('unlock-mode');
  }

  setBpm(bpm: number): void {
    this.dispatch('set-bpm', { bpm });
  }

  forceState(targetState: string): void {
    this.dispatch('force-state', { state: targetState });
  }

  setGeneratorVolume(generator: 'bass' | 'melody' | 'hatDensity' | 'kickVelocity' | 'texture' | 'chord', volume: number): void {
    this.dispatch('set-generator-volume', { generator, volume });
  }

  setTextureEnabled(enabled: boolean): void {
    this.dispatch('set-texture-enabled', { enabled });
  }

  setMelodyOnly(enabled: boolean): void {
    this.dispatch('set-melody-only', { enabled });
  }

  forceSubGenre(subGenre: string): void {
    this.dispatch('force-subgenre', { subGenre });
  }

  // ── State access ───────────────────────────────────────────────────────

  getState(): AstutelyOrganismBridgeState {
    return this.state;
  }

  subscribe(cb: BridgeSubscriber): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private notify(): void {
    for (const cb of this.subscribers) {
      cb(this.state);
    }
  }
}

export const astutelyOrganismBridge = new AstutelyOrganismBridge();
