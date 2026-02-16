/**
 * Mixer Engine — Aux sends/returns, sub-groups, master bus with metering.
 * Builds a Web Audio routing graph from the project's mixer state.
 */

import type { MixerChannel, MixBus, SendConfig } from '@/lib/projectManager';
import type { EffectInstance } from '@/lib/effectsChain';
import { createWebAudioEffect } from '@/lib/effectsChain';

export interface MeterLevels {
  peak: number;     // 0-1
  rms: number;      // 0-1
  peakDb: number;   // dBFS
  rmsDb: number;    // dBFS
  clipping: boolean;
}

export interface MixerNode {
  channelId: string;
  inputGain: GainNode;
  panNode: StereoPannerNode;
  preEffectsGain: GainNode;
  postEffectsGain: GainNode;
  muteGain: GainNode;
  faderGain: GainNode;
  analyser: AnalyserNode;
  sendGains: Map<string, GainNode>;
  effectNodes: Array<{ input: AudioNode; output: AudioNode }>;
}

export interface BusNode {
  busId: string;
  inputGain: GainNode;
  faderGain: GainNode;
  panNode: StereoPannerNode;
  muteGain: GainNode;
  analyser: AnalyserNode;
  effectNodes: Array<{ input: AudioNode; output: AudioNode }>;
}

let ctx: AudioContext | null = null;
let channelNodes: Map<string, MixerNode> = new Map();
let busNodes: Map<string, BusNode> = new Map();
let masterNode: BusNode | null = null;
let meterTimerId: ReturnType<typeof setInterval> | null = null;
let meterListeners: Array<(meters: Map<string, MeterLevels>) => void> = [];

/**
 * Initialize the mixer graph from project state.
 */
export function initMixer(
  audioContext: AudioContext,
  channels: MixerChannel[],
  buses: MixBus[],
  masterBus: { volume: number; pan: number; muted: boolean; effects: EffectInstance[] },
): void {
  disposeMixer();
  ctx = audioContext;

  // Create bus nodes first (so channels can connect sends)
  for (const bus of buses) {
    const node = createBusNode(ctx, bus.id, bus.volume, bus.pan, bus.muted, bus.effects as EffectInstance[]);
    busNodes.set(bus.id, node);
  }

  // Create master bus
  masterNode = createBusNode(ctx, 'master', masterBus.volume, masterBus.pan, masterBus.muted, masterBus.effects as EffectInstance[]);
  masterNode.faderGain.connect(ctx.destination);

  // Connect aux buses to master
  for (const [, busNode] of busNodes) {
    busNode.faderGain.connect(masterNode.inputGain);
  }

  // Create channel nodes
  for (const ch of channels) {
    const node = createChannelNode(ctx, ch);
    channelNodes.set(ch.trackId, node);

    // Connect channel output to master
    node.faderGain.connect(masterNode.inputGain);

    // Connect sends
    for (const send of ch.sends) {
      const targetBus = busNodes.get(send.busId);
      if (targetBus) {
        const sendGain = ctx.createGain();
        sendGain.gain.value = send.amount;

        if (send.preFader) {
          node.preEffectsGain.connect(sendGain);
        } else {
          node.postEffectsGain.connect(sendGain);
        }
        sendGain.connect(targetBus.inputGain);
        node.sendGains.set(send.busId, sendGain);
      }
    }
  }

  // Start metering
  startMetering();
}

function createChannelNode(audioCtx: AudioContext, ch: MixerChannel): MixerNode {
  const inputGain = audioCtx.createGain();
  const panNode = audioCtx.createStereoPanner();
  panNode.pan.value = ch.pan;
  const preEffectsGain = audioCtx.createGain();
  const postEffectsGain = audioCtx.createGain();
  const muteGain = audioCtx.createGain();
  muteGain.gain.value = ch.muted ? 0 : 1;
  const faderGain = audioCtx.createGain();
  faderGain.gain.value = ch.volume;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  // Build effects chain
  const effectNodes: Array<{ input: AudioNode; output: AudioNode }> = [];
  let lastOutput: AudioNode = preEffectsGain;

  for (const effect of (ch.effects as EffectInstance[])) {
    const nodes = createWebAudioEffect(audioCtx, effect);
    if (nodes) {
      lastOutput.connect(nodes.input);
      lastOutput = nodes.output;
      effectNodes.push(nodes);
    }
  }

  // Connect chain: input -> pan -> preEffects -> [effects] -> postEffects -> mute -> fader -> analyser
  inputGain.connect(panNode);
  panNode.connect(preEffectsGain);
  lastOutput.connect(postEffectsGain);
  postEffectsGain.connect(muteGain);
  muteGain.connect(faderGain);
  faderGain.connect(analyser);

  return {
    channelId: ch.trackId,
    inputGain,
    panNode,
    preEffectsGain,
    postEffectsGain,
    muteGain,
    faderGain,
    analyser,
    sendGains: new Map(),
    effectNodes,
  };
}

function createBusNode(
  audioCtx: AudioContext,
  busId: string,
  volume: number,
  pan: number,
  muted: boolean,
  effects: EffectInstance[],
): BusNode {
  const inputGain = audioCtx.createGain();
  const panNode = audioCtx.createStereoPanner();
  panNode.pan.value = pan;
  const muteGain = audioCtx.createGain();
  muteGain.gain.value = muted ? 0 : 1;
  const faderGain = audioCtx.createGain();
  faderGain.gain.value = volume;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  const effectNodes: Array<{ input: AudioNode; output: AudioNode }> = [];
  let lastOutput: AudioNode = inputGain;

  for (const effect of effects) {
    const nodes = createWebAudioEffect(audioCtx, effect);
    if (nodes) {
      lastOutput.connect(nodes.input);
      lastOutput = nodes.output;
      effectNodes.push(nodes);
    }
  }

  lastOutput.connect(panNode);
  panNode.connect(muteGain);
  muteGain.connect(faderGain);
  faderGain.connect(analyser);

  return { busId, inputGain, faderGain, panNode, muteGain, analyser, effectNodes };
}

/**
 * Get the input node for a channel (to connect audio sources).
 */
export function getChannelInput(trackId: string): GainNode | null {
  return channelNodes.get(trackId)?.inputGain || null;
}

/**
 * Get the master output analyser for metering.
 */
export function getMasterAnalyser(): AnalyserNode | null {
  return masterNode?.analyser || null;
}

/**
 * Update a channel's volume.
 */
export function setChannelVolume(trackId: string, volume: number) {
  const node = channelNodes.get(trackId);
  if (node) node.faderGain.gain.value = Math.max(0, Math.min(1.5, volume));
}

/**
 * Update a channel's pan.
 */
export function setChannelPan(trackId: string, pan: number) {
  const node = channelNodes.get(trackId);
  if (node) node.panNode.pan.value = Math.max(-1, Math.min(1, pan));
}

/**
 * Mute/unmute a channel.
 */
export function setChannelMute(trackId: string, muted: boolean) {
  const node = channelNodes.get(trackId);
  if (node) node.muteGain.gain.value = muted ? 0 : 1;
}

/**
 * Solo a channel (mutes all others except soloed ones).
 */
export function applySoloState(soloedTrackIds: Set<string>) {
  const hasSolo = soloedTrackIds.size > 0;
  for (const [trackId, node] of channelNodes) {
    if (hasSolo) {
      node.muteGain.gain.value = soloedTrackIds.has(trackId) ? 1 : 0;
    } else {
      node.muteGain.gain.value = 1; // Restore all when no solo
    }
  }
}

/**
 * Update a send amount.
 */
export function setSendAmount(trackId: string, busId: string, amount: number) {
  const node = channelNodes.get(trackId);
  const sendGain = node?.sendGains.get(busId);
  if (sendGain) sendGain.gain.value = Math.max(0, Math.min(1, amount));
}

/**
 * Update bus volume.
 */
export function setBusVolume(busId: string, volume: number) {
  if (busId === 'master' && masterNode) {
    masterNode.faderGain.gain.value = Math.max(0, Math.min(1.5, volume));
  } else {
    const node = busNodes.get(busId);
    if (node) node.faderGain.gain.value = Math.max(0, Math.min(1.5, volume));
  }
}

/**
 * Read meter levels from an analyser node.
 */
export function readMeterLevels(analyser: AnalyserNode): MeterLevels {
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);

  let peak = 0;
  let sumSquares = 0;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
    sumSquares += data[i] * data[i];
  }
  const rms = Math.sqrt(sumSquares / data.length);

  return {
    peak: Math.min(peak, 1),
    rms: Math.min(rms, 1),
    peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
    rmsDb: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
    clipping: peak >= 1,
  };
}

/**
 * Subscribe to meter updates (called ~30fps).
 */
export function subscribeMeter(listener: (meters: Map<string, MeterLevels>) => void): () => void {
  meterListeners.push(listener);
  return () => { meterListeners = meterListeners.filter(l => l !== listener); };
}

function startMetering() {
  if (meterTimerId) return;
  meterTimerId = setInterval(() => {
    if (meterListeners.length === 0) return;

    const meters = new Map<string, MeterLevels>();

    for (const [trackId, node] of channelNodes) {
      meters.set(trackId, readMeterLevels(node.analyser));
    }
    for (const [busId, node] of busNodes) {
      meters.set(`bus:${busId}`, readMeterLevels(node.analyser));
    }
    if (masterNode) {
      meters.set('master', readMeterLevels(masterNode.analyser));
    }

    meterListeners.forEach(fn => fn(meters));
  }, 33); // ~30fps
}

/**
 * Dispose all mixer resources.
 */
export function disposeMixer() {
  if (meterTimerId) {
    clearInterval(meterTimerId);
    meterTimerId = null;
  }
  channelNodes.clear();
  busNodes.clear();
  masterNode = null;
  meterListeners = [];
}

/**
 * Create a default mixer channel for a new track.
 */
export function createDefaultChannel(trackId: string): MixerChannel {
  return {
    trackId,
    volume: 0.8,
    pan: 0,
    muted: false,
    soloed: false,
    sends: [],
    effects: [],
  };
}

/**
 * Create a default aux bus.
 */
export function createAuxBus(name: string, effectType: string): MixBus {
  return {
    id: crypto.randomUUID(),
    name,
    type: 'aux',
    volume: 0.7,
    pan: 0,
    muted: false,
    effects: [{
      id: crypto.randomUUID(),
      type: effectType,
      parameters: {},
      enabled: true,
    }],
    inputTrackIds: [],
  };
}

/**
 * Create a sub-group bus.
 */
export function createGroupBus(name: string, trackIds: string[]): MixBus {
  return {
    id: crypto.randomUUID(),
    name,
    type: 'group',
    volume: 0.85,
    pan: 0,
    muted: false,
    effects: [],
    inputTrackIds: trackIds,
  };
}
