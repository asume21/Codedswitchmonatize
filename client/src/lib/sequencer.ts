import { nanoid } from "nanoid";

export type TrackId =
  | "kick"
  | "snare"
  | "hhc" // hi-hat closed
  | "hho" // hi-hat open
  | "tom1"
  | "tom2"
  | "tom3"
  | "ride"
  | "crash"
  | "clap"
  | "perc";

export interface Step {
  active: boolean;
  velocity?: number; // 0..1 optional for future use
}

export interface Clip {
  id: string;
  start: number; // timeline step index
  length: number; // in steps
  steps: Step[]; // length = length
  name?: string; // optional label
}

export interface Track {
  id: TrackId;
  name: string;
  clips: Clip[];
  mute?: boolean;
  solo?: boolean;
  volume?: number; // dB
  pan?: number; // -1..1
}

export interface SequencerState {
  bpm: number;
  swing: number; // 0..1
  bars: number; // e.g. 4
  stepsPerBar: number; // 16
  loopStart: number; // step index
  loopEnd: number; // step index
  tracks: Track[];
}

export const DEFAULT_TRACKS: Track[] = [
  { id: "kick", name: "Kick", clips: [] },
  { id: "snare", name: "Snare", clips: [] },
  { id: "hhc", name: "Hi-hat (Closed)", clips: [] },
  { id: "hho", name: "Hi-hat (Open)", clips: [] },
  { id: "tom1", name: "Tom 1", clips: [] },
  { id: "tom2", name: "Tom 2", clips: [] },
  { id: "tom3", name: "Tom 3", clips: [] },
  { id: "ride", name: "Ride", clips: [] },
  { id: "crash", name: "Crash", clips: [] },
  { id: "clap", name: "Clap", clips: [] },
  { id: "perc", name: "Percussion", clips: [] },
];

export function createEmptyClip(
  start: number,
  length: number,
  name?: string,
): Clip {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    start,
    length,
    steps: Array.from({ length }, () => ({ active: false })),
    name,
  };
}

export function createDefaultState(bars = 4, stepsPerBar = 16): SequencerState {
  return {
    bpm: 120,
    swing: 0,
    bars,
    stepsPerBar,
    loopStart: 0,
    loopEnd: bars * stepsPerBar,
    tracks: DEFAULT_TRACKS.map((t) => ({ ...t, clips: [] })),
  };
}
