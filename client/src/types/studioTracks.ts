export type TrackKind = 'beat' | 'piano' | 'midi' | 'audio' | 'aux' | 'vocal';

export type TrackType = 'audio' | 'midi' | 'beat' | 'aux' | 'lyrics';

// ─── Arrangement Clip ────────────────────────────────────────────────
// Canonical clip type for the arrangement timeline. Beats are the base unit;
// bars are derived via time signature at display time.

export interface ArrangementClip {
  id: string;
  startBeat: number;
  endBeat: number;
  offsetBeat: number;       // trim start within source material
  fadeInBeats: number;
  fadeOutBeats: number;
  gain: number;             // 0-2, 1 = unity
  loop: boolean;
  loopEndBeat: number;
  type: 'audio' | 'midi' | 'pattern';
  audioUrl?: string;        // for audio clips
  notes?: TrackNote[];      // for midi clips
  patternId?: string;       // for pattern-reference clips
  source?: 'recording' | 'ai' | 'imported' | 'bounced';
  name: string;
  color?: string;
}

/** Convert bar number to beat using time signature (numerator = beats per bar) */
export function barToBeat(bar: number, beatsPerBar: number = 4): number {
  return bar * beatsPerBar;
}

/** Convert beat to bar number */
export function beatToBar(beat: number, beatsPerBar: number = 4): number {
  return beat / beatsPerBar;
}

/** Create an ArrangementClip with sensible defaults */
export function createArrangementClip(
  overrides: Partial<ArrangementClip> & Pick<ArrangementClip, 'name' | 'type' | 'startBeat' | 'endBeat'>,
): ArrangementClip {
  return {
    id: crypto.randomUUID(),
    offsetBeat: 0,
    fadeInBeats: 0,
    fadeOutBeats: 0,
    gain: 1,
    loop: false,
    loopEndBeat: overrides.endBeat,
    ...overrides,
  };
}

export interface TrackPayload {
  type: TrackType;
  source: string;
  volume: number;
  pan: number;
  bpm: number;
  notes?: TrackNote[];
  audioUrl?: string;
  instrument?: string;
  color?: string;
  pattern?: unknown;
  data?: unknown;
  sendA?: number;
  sendB?: number;
  sendLevels?: Record<string, number>;
  // Extended properties for various track types
  startTime?: number;
  duration?: number;
  packId?: string;
  samples?: SampleInfo[];
  key?: string;
  genre?: string;
  [key: string]: unknown; // Allow additional properties
}

export interface TrackNote {
  id?: string;
  step?: number;
  length?: number;
  velocity?: number;
  note?: string;
  octave?: number;
  [key: string]: unknown;
}

export interface SampleInfo {
  id?: string;
  name?: string;
  url?: string;
  startTime?: number;
  duration?: number;
  gain?: number;
  pan?: number;
  [key: string]: unknown;
}

export interface TrackClip {
  id: string;
  kind: TrackKind;
  name: string;
  lengthBars: number;
  startBar: number;
  muted?: boolean;
  solo?: boolean;
  payload: TrackPayload;
  /** Arrangement clips — when present, these define the track's timeline content.
   *  When absent, a single clip is synthesized from startBar/lengthBars (backwards compat). */
  clips?: ArrangementClip[];
}

export const DEFAULT_TRACK_PAYLOAD: TrackPayload = {
  type: 'midi',
  source: 'unknown',
  volume: 0.8,
  pan: 0,
  bpm: 120,
  notes: [],
  sendA: -60,
  sendB: -60,
  sendLevels: {},
};

export function createTrackPayload(overrides: Partial<TrackPayload> = {}): TrackPayload {
  return {
    ...DEFAULT_TRACK_PAYLOAD,
    ...overrides,
  };
}
