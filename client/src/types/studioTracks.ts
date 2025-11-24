export type TrackKind = 'beat' | 'piano' | 'midi' | 'audio' | 'aux';

export interface TrackClip {
  id: string;
  kind: TrackKind;
  name: string;
  lengthBars: number;
  startBar: number;
  muted?: boolean;
  solo?: boolean;
  payload: Record<string, unknown>;
}
