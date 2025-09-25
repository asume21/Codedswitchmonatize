declare module 'tone' {
  export class Transport {
    static start(time?: number): void;
    static stop(time?: number): void;
    static bpm: {
      value: number;
    };
    static loop(callback: (time: number) => void, interval: string): void;
  }

  export class PolySynth {
    constructor(synth: any, options?: any);
    toDestination(): this;
    triggerAttackRelease(note: string | string[], duration: string | number, time?: number, velocity?: number): this;
    releaseAll(time?: number): void;
    dispose(): void;
  }

  export class MonoSynth {
    constructor(options?: any);
    toDestination(): this;
    triggerAttack(note: string, time?: number, velocity?: number): this;
    triggerRelease(time?: number): this;
    dispose(): void;
  }

  export class Sampler {
    constructor(options: any);
    toDestination(): this;
    triggerAttackRelease(note: string | string[], duration: string | number, time?: number, velocity?: number): this;
    dispose(): void;
  }

  export class Loop {
    constructor(callback: (time: number) => void, interval: string);
    start(time?: number): void;
    stop(time?: number): void;
    dispose(): void;
  }

  export class Destination {
    static volume: {
      value: number;
    };
    static mute: boolean;
  }

  export function start(): Promise<void>;
  export function getContext(): {
    rawContext: AudioContext;
  };
}
