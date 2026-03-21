// Section 04 — Generator Types

export enum GeneratorName {
  Drum    = 'drum',
  Bass    = 'bass',
  Melody  = 'melody',
  Texture = 'texture',
}

export enum BassBehavior {
  Lock    = 'lock',
  Walk    = 'walk',
  Bounce  = 'bounce',
  Breathe = 'breathe',
  Trap    = 'trap',
  Funk    = 'funk',
  Dub     = 'dub',
}

export enum MelodyBehavior {
  Rest    = 'rest',
  Hint    = 'hint',
  Respond = 'respond',
  Lead    = 'lead',
}

export interface DrumHit {
  instrument: DrumInstrument
  time:       string
  velocity:   number
}

export enum DrumInstrument {
  Kick  = 'kick',
  Snare = 'snare',
  Hat   = 'hat',
  Perc  = 'perc',
}

export interface ScheduledNote {
  pitch:    string
  duration: string
  velocity: number
  time:     string
}

export interface ScaleIntervals {
  [mode: string]: number[]
}

export interface ScaleDefinition {
  name:      string
  intervals: number[]
}

export interface GeneratorActivityReport {
  name:          GeneratorName
  activityLevel: number
  timestamp:     number
}

export interface GeneratorOutput {
  drum:    GeneratorActivityReport
  bass:    GeneratorActivityReport
  melody:  GeneratorActivityReport
  texture: GeneratorActivityReport
}
