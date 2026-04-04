/**
 * AstutelyGenreEnforcer — The single authority for genre enforcement.
 *
 * When Astutely sets a genre, this module produces a command plan that:
 * 1. Locks Organism mode + BPM + generator volumes
 * 2. Applies mixer presets (volume, EQ, sends)
 * 3. Returns the pattern style string for AI generation
 *
 * enforce() returns a plan — the caller (AstutelyCoreContext) applies it.
 * This makes enforcement testable and auditable.
 */

import { OrganismMode } from '@/organism/physics/types';
import type { GenreMixPreset } from './astutelyMixerBridge';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GenreProfile {
  id: string;
  label: string;
  organismMode: OrganismMode;
  bpmRange: [number, number];
  defaultBpm: number;
  textureEnabled: boolean;
  patternStyle: string;
  quickStartPresetId: string;
  generatorVolumes: {
    hatDensity: number;
    kickVelocity: number;
    bassVolume: number;
    melodyVolume: number;
    chordVolume: number;
  };
  mixPreset: GenreMixPreset;
}

export interface OrganismCommand {
  action: 'lockMode' | 'setBpm' | 'setGeneratorVolume' | 'setTextureEnabled';
  generator?: string;
  value: OrganismMode | number | boolean;
}

export interface MixerCommand {
  method: 'applyGenrePreset';
  args: [GenreMixPreset];
}

export interface EnforcementPlan {
  genre: GenreProfile;
  organismCommands: OrganismCommand[];
  mixerCommands: MixerCommand[];
  patternStyle: string;
}

// ── Genre Profiles ───────────────────────────────────────────────────────────

export const GENRE_PROFILES: Record<string, GenreProfile> = {
  trap: {
    id: 'trap',
    label: 'Trap',
    organismMode: OrganismMode.Heat,
    bpmRange: [130, 160],
    defaultBpm: 140,
    textureEnabled: false,
    patternStyle: 'Travis Scott rage',
    quickStartPresetId: 'trap-140',
    generatorVolumes: { hatDensity: 1.3, kickVelocity: 1.2, bassVolume: 1.1, melodyVolume: 0.8, chordVolume: 0.7 },
    mixPreset: {
      name: 'Trap',
      channels: {
        drums:  { volume: 0.85, pan: 0, eq: { low: 3, lowMid: -1, highMid: 2, high: 1 } },
        bass:   { volume: 0.9,  pan: 0, eq: { low: 4, lowMid: 0, highMid: -2, high: -3 } },
        melody: { volume: 0.6,  pan: 0.1, eq: { low: -3, lowMid: 0, highMid: 1, high: 2 } },
        chords: { volume: 0.5,  pan: -0.1, eq: { low: -2, lowMid: 1, highMid: 0, high: 1 } },
      },
      masterLevel: 0.8,
    },
  },
  lofi: {
    id: 'lofi',
    label: 'Lo-fi',
    organismMode: OrganismMode.Ice,
    bpmRange: [70, 95],
    defaultBpm: 85,
    textureEnabled: true,
    patternStyle: 'lo-fi chill study beat',
    quickStartPresetId: 'lofi-85',
    generatorVolumes: { hatDensity: 0.7, kickVelocity: 0.8, bassVolume: 1.0, melodyVolume: 1.2, chordVolume: 1.1 },
    mixPreset: {
      name: 'Lo-fi',
      channels: {
        drums:  { volume: 0.65, pan: 0, eq: { low: 1, lowMid: 0, highMid: -2, high: -4 } },
        bass:   { volume: 0.75, pan: 0, eq: { low: 2, lowMid: 1, highMid: -1, high: -2 } },
        melody: { volume: 0.7,  pan: 0.15, eq: { low: -1, lowMid: 2, highMid: 0, high: -1 } },
        chords: { volume: 0.65, pan: -0.15, eq: { low: 0, lowMid: 1, highMid: 1, high: -1 } },
      },
      masterLevel: 0.7,
    },
  },
  'boom-bap': {
    id: 'boom-bap',
    label: 'Boom Bap',
    organismMode: OrganismMode.Smoke,
    bpmRange: [80, 100],
    defaultBpm: 90,
    textureEnabled: false,
    patternStyle: '90s boom bap hip hop',
    quickStartPresetId: 'boombap-90',
    generatorVolumes: { hatDensity: 1.0, kickVelocity: 1.1, bassVolume: 1.0, melodyVolume: 0.9, chordVolume: 1.0 },
    mixPreset: {
      name: 'Boom Bap',
      channels: {
        drums:  { volume: 0.85, pan: 0, eq: { low: 2, lowMid: 1, highMid: 1, high: 0 } },
        bass:   { volume: 0.8,  pan: 0, eq: { low: 3, lowMid: 0, highMid: -1, high: -2 } },
        melody: { volume: 0.6,  pan: 0.2, eq: { low: -2, lowMid: 1, highMid: 2, high: 1 } },
        chords: { volume: 0.55, pan: -0.2, eq: { low: -1, lowMid: 0, highMid: 1, high: 0 } },
      },
      masterLevel: 0.78,
    },
  },
  drill: {
    id: 'drill',
    label: 'Drill',
    organismMode: OrganismMode.Gravel,
    bpmRange: [130, 150],
    defaultBpm: 140,
    textureEnabled: false,
    patternStyle: 'UK drill dark sliding 808',
    quickStartPresetId: 'drill-140',
    generatorVolumes: { hatDensity: 1.4, kickVelocity: 1.0, bassVolume: 1.2, melodyVolume: 0.7, chordVolume: 0.6 },
    mixPreset: {
      name: 'Drill',
      channels: {
        drums:  { volume: 0.8,  pan: 0, eq: { low: 2, lowMid: 0, highMid: 3, high: 2 } },
        bass:   { volume: 0.95, pan: 0, eq: { low: 5, lowMid: -1, highMid: -3, high: -4 } },
        melody: { volume: 0.55, pan: 0.1, eq: { low: -3, lowMid: -1, highMid: 2, high: 3 } },
        chords: { volume: 0.4,  pan: -0.1, eq: { low: -2, lowMid: 0, highMid: 1, high: 2 } },
      },
      masterLevel: 0.82,
    },
  },
  chill: {
    id: 'chill',
    label: 'Chill',
    organismMode: OrganismMode.Glow,
    bpmRange: [65, 85],
    defaultBpm: 75,
    textureEnabled: true,
    patternStyle: 'ambient chill melodic',
    quickStartPresetId: 'chill-75',
    generatorVolumes: { hatDensity: 0.6, kickVelocity: 0.7, bassVolume: 0.9, melodyVolume: 1.3, chordVolume: 1.2 },
    mixPreset: {
      name: 'Chill',
      channels: {
        drums:  { volume: 0.55, pan: 0, eq: { low: 0, lowMid: -1, highMid: -1, high: -2 } },
        bass:   { volume: 0.7,  pan: 0, eq: { low: 2, lowMid: 1, highMid: -2, high: -3 } },
        melody: { volume: 0.8,  pan: 0.2, eq: { low: -1, lowMid: 1, highMid: 2, high: 1 } },
        chords: { volume: 0.75, pan: -0.2, eq: { low: 0, lowMid: 2, highMid: 1, high: 0 } },
      },
      masterLevel: 0.68,
    },
  },
  funk: {
    id: 'funk',
    label: 'Funk',
    organismMode: OrganismMode.Smoke,
    bpmRange: [90, 115],
    defaultBpm: 100,
    textureEnabled: false,
    patternStyle: 'funky groove bass-heavy',
    quickStartPresetId: 'funk-100',
    generatorVolumes: { hatDensity: 1.1, kickVelocity: 1.0, bassVolume: 1.2, melodyVolume: 1.0, chordVolume: 0.9 },
    mixPreset: {
      name: 'Funk',
      channels: {
        drums:  { volume: 0.8,  pan: 0, eq: { low: 1, lowMid: 1, highMid: 2, high: 1 } },
        bass:   { volume: 0.85, pan: 0, eq: { low: 3, lowMid: 2, highMid: 0, high: -1 } },
        melody: { volume: 0.65, pan: 0.15, eq: { low: -2, lowMid: 0, highMid: 2, high: 2 } },
        chords: { volume: 0.6,  pan: -0.15, eq: { low: -1, lowMid: 1, highMid: 1, high: 1 } },
      },
      masterLevel: 0.78,
    },
  },
};

// ── Enforcer ─────────────────────────────────────────────────────────────────

class AstutelyGenreEnforcer {
  private activeGenre: GenreProfile | null = null;

  getActiveGenre(): GenreProfile | null {
    return this.activeGenre;
  }

  getAvailableGenres(): GenreProfile[] {
    return Object.values(GENRE_PROFILES);
  }

  enforce(genreId: string): EnforcementPlan | null {
    const genre = GENRE_PROFILES[genreId];
    if (!genre) return null;

    this.activeGenre = genre;

    const organismCommands: OrganismCommand[] = [
      { action: 'lockMode', value: genre.organismMode },
      { action: 'setBpm', value: genre.defaultBpm },
      { action: 'setTextureEnabled', value: genre.textureEnabled },
      { action: 'setGeneratorVolume', generator: 'hatDensity', value: genre.generatorVolumes.hatDensity },
      { action: 'setGeneratorVolume', generator: 'kickVelocity', value: genre.generatorVolumes.kickVelocity },
      { action: 'setGeneratorVolume', generator: 'bass', value: genre.generatorVolumes.bassVolume },
      { action: 'setGeneratorVolume', generator: 'melody', value: genre.generatorVolumes.melodyVolume },
      { action: 'setGeneratorVolume', generator: 'chord', value: genre.generatorVolumes.chordVolume },
    ];

    const mixerCommands: MixerCommand[] = [
      { method: 'applyGenrePreset', args: [genre.mixPreset] },
    ];

    return {
      genre,
      organismCommands,
      mixerCommands,
      patternStyle: genre.patternStyle,
    };
  }

  clearGenre(): void {
    this.activeGenre = null;
  }
}

export const astutelyGenreEnforcer = new AstutelyGenreEnforcer();
