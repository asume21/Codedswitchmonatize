import type { InstrumentFamily } from '../techniques/types'

export type PerformerRole = 'lead' | 'bass' | 'chord' | 'texture'

export type InstrumentPerformerId =
  | 'guitar-nylon'
  | 'guitar-clean'
  | 'guitar-distorted'
  | 'violin'
  | 'cello'
  | 'bass-electric'
  | 'bass-upright'
  | 'bass-synth'
  | 'flute'
  | 'clarinet'
  | 'sax'
  | 'trumpet'
  | 'trombone'
  | 'french-horn'
  | 'oboe'
  | 'piano'
  | 'rhodes'
  | 'organ'
  | 'strings'
  | 'choir'
  | 'harp'
  | 'marimba'
  | 'vibraphone'
  | 'sitar'

export interface InstrumentEnvelope {
  attack: number
  release: number
}

export interface InstrumentPerformerProfile {
  id: InstrumentPerformerId
  name: string
  family: InstrumentFamily
  roles: PerformerRole[]
  samplerPreset: string
  range: [number, number]
  preferredOctave: number
  polyphony: 'mono' | 'poly'
  envelope: InstrumentEnvelope
  volume: number
  /**
   * Optional id of a real note-mapped multisample (served at
   * /api/loops/instruments, e.g. 'SSO_Violins1'). When present on disk, the
   * generator builds the voice from these recorded samples instead of the GM
   * `samplerPreset`. GM remains the graceful fallback. See realInstruments.ts.
   */
  realInstrument?: string
  defaultTechnique: string
  defaultLeadArticulation: string
  defaultBassArticulation: string
  modeBias: string[]
  tags: string[]
}

export interface PerformerSelectionContext {
  role: PerformerRole
  mode: string
  energy: number
  brightness?: number
  explicitId?: InstrumentPerformerId
  variation?: number  // section counter — rotates preferred list so each section picks a different instrument
}
