// Section 04 — Generator Types

export enum GeneratorName {
  Drum    = 'drum',
  Bass    = 'bass',
  Melody  = 'melody',
  Texture = 'texture',
  Chord   = 'chord',
}

export enum BassBehavior {
  Lock       = 'lock',
  Walk       = 'walk',
  Bounce     = 'bounce',
  Breathe    = 'breathe',
  Trap       = 'trap',
  Funk       = 'funk',
  Dub        = 'dub',
  // ── New sub-genre behaviors ──
  Slide808   = 'slide808',    // Trap/drill 808 with portamento glide between notes
  WestCoast  = 'westcoast',   // G-funk Parliament bounce — syncopated with high-pass filter
  DirtySouth = 'dirtysouth',  // Crunk heavy root slam — sparse but massive
  Phonk      = 'phonk',       // Memphis dark bass — stuttered 808 with heavy distortion
  Jersey     = 'jersey',      // Jersey club — fast staccato 808 hits at 130+ BPM
  Reggaeton  = 'reggaeton',   // Dembow bass pattern — locks to dembow kick pattern
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
  chord:   GeneratorActivityReport
}
