/**
 * Audio node census — dev diagnostic for the crackle/stall hunt.
 *
 * WHY THIS EXISTS (2026-08-08): the stall rate climbs 0.14% (stopped) → 51.7%
 * (0-20s playing) → 100% (20s+) while notes-per-bar stays constant and the JS
 * heap stays flat (60.8 → 60.4 MB). Rising AUDIO cost with flat JS cost points
 * at nodes/voices created on the render thread and never released. The UI, the
 * meters, the static mix graph, the convolution reverbs and a JS heap leak have
 * all been ruled out with numbers — see the project memory. This measures the
 * one remaining hypothesis directly instead of inferring it.
 *
 * It patches the NATIVE Web Audio constructors, which is the single chokepoint
 * every path shares: Tone.js voices, the shared getAudioContext() graph,
 * soundfont-player, and raw sample playback all bottom out here.
 *
 * Read it with `window.__nodeCensus()`. Cumulative totals are almost always the
 * wrong reading (that trap cost a previous session hours), so the default
 * report is a DELTA against the last mark:
 *
 *     __nodeCensus.mark()            // start a window
 *     ...play for 30s...
 *     __nodeCensus()                 // { windowMs, perType: { created, ended, netLive }, ... }
 *
 * The tell we are hunting: a type whose `netLive` climbs steadily across
 * consecutive windows while the generators' event counts hold flat.
 */

type Counts = Record<string, number>;

interface Snapshot {
  at: number;
  created: Counts;
  ended: Counts;
  disconnected: Counts;
}

const created: Counts = {};
const ended: Counts = {};
const disconnected: Counts = {};

let installed = false;
let lastMark: Snapshot | null = null;

function bump(bag: Counts, key: string): void {
  bag[key] = (bag[key] ?? 0) + 1;
}

function snapshot(): Snapshot {
  return {
    at: performance.now(),
    created: { ...created },
    ended: { ...ended },
    disconnected: { ...disconnected },
  };
}

/**
 * One-shot sources (AudioBufferSourceNode, OscillatorNode) free themselves when
 * they finish. Hooking `ended` gives a true liveness count for exactly the node
 * types that represent a playing VOICE — the thing the hypothesis says is
 * accumulating. Sustained nodes (Gain, Filter, ...) have no such event, so for
 * those `disconnected` is the closest available proxy for release.
 */
const ONE_SHOT = new Set(['AudioBufferSourceNode', 'OscillatorNode', 'ConstantSourceNode']);

function patchConstructor(name: string): void {
  const Original = (window as any)[name];
  if (typeof Original !== 'function') return;

  function Patched(this: any, ...args: any[]) {
    const node = new Original(...args);
    bump(created, name);
    if (ONE_SHOT.has(name)) {
      // `ended` fires once when the source stops rendering and the browser can
      // release it. A source that is started but never stops never fires this.
      node.addEventListener('ended', () => bump(ended, name), { once: true });
    }
    return node;
  }

  Patched.prototype = Original.prototype;
  Object.setPrototypeOf(Patched, Original);
  (window as any)[name] = Patched;
}

/**
 * Tone.js and older code create nodes through the factory methods rather than
 * the constructors, so both routes have to be counted or the census reads low.
 */
function patchFactory(method: string, typeName: string): void {
  const proto = (window as any).BaseAudioContext?.prototype ?? (window as any).AudioContext?.prototype;
  if (!proto) return;
  const original = proto[method];
  if (typeof original !== 'function') return;

  proto[method] = function patchedFactory(this: BaseAudioContext, ...args: any[]) {
    const node = original.apply(this, args);
    bump(created, typeName);
    if (ONE_SHOT.has(typeName)) {
      node.addEventListener('ended', () => bump(ended, typeName), { once: true });
    }
    return node;
  };
}

const NODE_TYPES: Array<[ctor: string, factory: string]> = [
  ['GainNode', 'createGain'],
  ['AudioBufferSourceNode', 'createBufferSource'],
  ['OscillatorNode', 'createOscillator'],
  ['BiquadFilterNode', 'createBiquadFilter'],
  ['DynamicsCompressorNode', 'createDynamicsCompressor'],
  ['ConvolverNode', 'createConvolver'],
  ['DelayNode', 'createDelay'],
  ['WaveShaperNode', 'createWaveShaper'],
  ['AnalyserNode', 'createAnalyser'],
  ['StereoPannerNode', 'createStereoPanner'],
  ['ChannelMergerNode', 'createChannelMerger'],
  ['ChannelSplitterNode', 'createChannelSplitter'],
  ['ConstantSourceNode', 'createConstantSource'],
  ['IIRFilterNode', 'createIIRFilter'],
];

export function installAudioNodeCensus(): void {
  if (installed) return;
  installed = true;

  for (const [ctor, factory] of NODE_TYPES) {
    patchConstructor(ctor);
    patchFactory(factory, ctor);
  }

  // A full `disconnect()` is the closest thing to "released" for sustained
  // nodes. Tone's dispose() calls it, so this tracks Tone teardown too.
  const audioNodeProto = (window as any).AudioNode?.prototype;
  if (audioNodeProto && typeof audioNodeProto.disconnect === 'function') {
    const originalDisconnect = audioNodeProto.disconnect;
    audioNodeProto.disconnect = function patchedDisconnect(this: AudioNode, ...args: any[]) {
      if (args.length === 0) bump(disconnected, this.constructor?.name ?? 'unknown');
      return originalDisconnect.apply(this, args);
    };
  }

  const report = (): Record<string, unknown> => {
    const now = snapshot();
    const base: Snapshot = lastMark ?? {
      at: 0,
      created: {},
      ended: {},
      disconnected: {},
    };

    const perType: Record<string, { created: number; ended: number; disconnected: number; netLive: number }> = {};
    for (const type of Object.keys(now.created)) {
      const c = (now.created[type] ?? 0) - (base.created[type] ?? 0);
      const e = (now.ended[type] ?? 0) - (base.ended[type] ?? 0);
      const d = (now.disconnected[type] ?? 0) - (base.disconnected[type] ?? 0);
      if (c === 0 && e === 0 && d === 0) continue;
      // For one-shot sources netLive is exact (created minus finished). For
      // sustained nodes it is created-minus-disconnected, an upper bound.
      perType[type] = { created: c, ended: e, disconnected: d, netLive: c - (ONE_SHOT.has(type) ? e : d) };
    }

    return {
      windowMs: Math.round(now.at - base.at),
      sinceMark: lastMark !== null,
      perType,
      note: 'netLive climbing across consecutive equal-length windows = accumulation. Call __nodeCensus.mark() to start a fresh window.',
    };
  };

  (report as any).mark = () => {
    lastMark = snapshot();
    return { markedAtMs: Math.round(lastMark.at) };
  };
  (report as any).reset = () => {
    lastMark = null;
    return { cleared: true };
  };
  (report as any).totals = () => snapshot();

  (window as any).__nodeCensus = report;
}

// Installed as an IMPORT SIDE EFFECT, like globalAudioKillSwitch. A call from
// main.tsx's body would run too late: ES imports execute first, so Tone.js would
// already have built its import-time context nodes before the patch landed.
// Dev-only by default; add ?census=1 to enable against a deployed build.
if (
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('census') === '1')
) {
  installAudioNodeCensus();
}
