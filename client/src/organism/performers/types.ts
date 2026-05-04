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
  | 'piano'
  | 'rhodes'
  | 'strings'
  | 'harp'
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
}
