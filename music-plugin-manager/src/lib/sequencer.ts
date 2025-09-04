import { nanoid } from "nanoid";

export type TrackId = string;

export interface Step {
  active: boolean;
  velocity: number;
}

export interface Clip {
  id: string;
  name?: string;
  start: number;
  length: number;
  steps: (Step | null)[];
}

export interface Track {
  id: TrackId;
  name: string;
  clips: Clip[];
  muted?: boolean;
  solo?: boolean;
  volume?: number;
}

export interface SequencerState {
  bars: number;
  stepsPerBar: number;
  bpm: number;
  tracks: Track[];
}

export const DEFAULT_TRACKS: Omit<Track, "clips">[] = [
  { id: "kick", name: "Kick" },
  { id: "snare", name: "Snare" },
  { id: "hhc", name: "Hi-Hat Closed" },
  { id: "hho", name: "Hi-Hat Open" },
  { id: "crash", name: "Crash" },
  { id: "clap", name: "Clap" },
  { id: "tom", name: "Tom" },
  { id: "perc", name: "Percussion" },
];

export function createDefaultState(bars = 4, stepsPerBar = 16, bpm = 120): SequencerState {
  return {
    bars,
    stepsPerBar,
    bpm,
    tracks: DEFAULT_TRACKS.map((track) => ({
      ...track,
      clips: [],
      volume: 1,
      muted: false,
      solo: false,
    })),
  };
}

export function createEmptyClip(start: number, length: number, name?: string): Clip {
  return {
    id: nanoid(),
    name,
    start,
    length,
    steps: Array(length).fill(null),
  };
}