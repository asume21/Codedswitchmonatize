/**
 * Preset Manager — Shared utility for saving/loading effect presets.
 * Stores presets in localStorage, keyed by effect type.
 * Supports multiple presets per effect with naming and browsing.
 */

export interface EffectPreset {
  id: string;
  name: string;
  effectType: string;
  parameters: Record<string, number>;
  createdAt: string;
}

const STORAGE_KEY = 'codedswitch_effect_presets';

function getAllPresets(): EffectPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAllPresets(presets: EffectPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/**
 * Get all presets for an effect type.
 */
export function getPresetsForEffect(effectType: string): EffectPreset[] {
  return getAllPresets().filter(p => p.effectType === effectType);
}

/**
 * Save a new preset.
 */
export function savePreset(effectType: string, name: string, parameters: Record<string, number>): EffectPreset {
  const preset: EffectPreset = {
    id: crypto.randomUUID(),
    name,
    effectType,
    parameters,
    createdAt: new Date().toISOString(),
  };

  const all = getAllPresets();
  all.push(preset);
  saveAllPresets(all);
  return preset;
}

/**
 * Delete a preset by ID.
 */
export function deletePreset(presetId: string): void {
  const all = getAllPresets().filter(p => p.id !== presetId);
  saveAllPresets(all);
}

/**
 * Rename a preset.
 */
export function renamePreset(presetId: string, newName: string): void {
  const all = getAllPresets();
  const preset = all.find(p => p.id === presetId);
  if (preset) {
    preset.name = newName;
    saveAllPresets(all);
  }
}

/**
 * Get a specific preset by ID.
 */
export function getPreset(presetId: string): EffectPreset | null {
  return getAllPresets().find(p => p.id === presetId) ?? null;
}

/**
 * Factory presets — built-in presets for each effect type.
 */
export const FACTORY_PRESETS: Record<string, Array<{ name: string; parameters: Record<string, number> }>> = {
  compressor: [
    { name: 'Gentle Glue', parameters: { threshold: -12, ratio: 2, attack: 20, release: 150, knee: 10 } },
    { name: 'Vocal Squeeze', parameters: { threshold: -18, ratio: 4, attack: 5, release: 80, knee: 6 } },
    { name: 'Bus Crush', parameters: { threshold: -24, ratio: 8, attack: 1, release: 50, knee: 3 } },
    { name: 'Parallel Punch', parameters: { threshold: -30, ratio: 10, attack: 0.5, release: 30, knee: 0 } },
  ],
  eq: [
    { name: 'Vocal Presence', parameters: { low: -2, mid: 3, high: 2, lowFreq: 200, midFreq: 3000, highFreq: 8000 } },
    { name: 'Bass Boost', parameters: { low: 6, mid: -1, high: -2, lowFreq: 100, midFreq: 500, highFreq: 4000 } },
    { name: 'Hi-Fi Sparkle', parameters: { low: 0, mid: 0, high: 5, lowFreq: 60, midFreq: 1000, highFreq: 12000 } },
    { name: 'Telephone', parameters: { low: -12, mid: 6, high: -12, lowFreq: 300, midFreq: 2000, highFreq: 3500 } },
  ],
  reverb: [
    { name: 'Small Room', parameters: { decay: 0.8, mix: 0.2, preDelay: 5 } },
    { name: 'Large Hall', parameters: { decay: 4.0, mix: 0.35, preDelay: 30 } },
    { name: 'Cathedral', parameters: { decay: 8.0, mix: 0.5, preDelay: 50 } },
    { name: 'Plate', parameters: { decay: 2.0, mix: 0.3, preDelay: 10 } },
  ],
  delay: [
    { name: 'Slapback', parameters: { time: 80, feedback: 0.1, mix: 0.3 } },
    { name: '1/4 Note Echo', parameters: { time: 500, feedback: 0.35, mix: 0.25 } },
    { name: 'Dotted 1/8', parameters: { time: 375, feedback: 0.4, mix: 0.2 } },
    { name: 'Ambient Wash', parameters: { time: 750, feedback: 0.55, mix: 0.4 } },
  ],
  chorus: [
    { name: 'Subtle Thicken', parameters: { rate: 0.5, depth: 0.3, feedback: 0.1 } },
    { name: '80s Wide', parameters: { rate: 1.2, depth: 0.6, feedback: 0.3 } },
    { name: 'Detune', parameters: { rate: 0.2, depth: 0.8, feedback: 0.0 } },
  ],
  limiter: [
    { name: 'Transparent', parameters: { threshold: -1, ceiling: -0.3, attack: 5, release: 50 } },
    { name: 'Loud Master', parameters: { threshold: -3, ceiling: -0.1, attack: 1, release: 20 } },
    { name: 'Brick Wall', parameters: { threshold: -6, ceiling: -0.1, attack: 0.1, release: 10 } },
  ],
  saturation: [
    { name: 'Warm Tape', parameters: { drive: 15, tone: 60, output: 80 } },
    { name: 'Tube Overdrive', parameters: { drive: 40, tone: 50, output: 70 } },
    { name: 'Dirty Crunch', parameters: { drive: 70, tone: 40, output: 60 } },
  ],
};

/**
 * Get factory + user presets combined for an effect type.
 */
export function getAllPresetsForEffect(effectType: string): Array<EffectPreset & { isFactory?: boolean }> {
  const factory = (FACTORY_PRESETS[effectType] || []).map((p, i) => ({
    id: `factory-${effectType}-${i}`,
    name: p.name,
    effectType,
    parameters: p.parameters,
    createdAt: '2024-01-01',
    isFactory: true as const,
  }));

  const user = getPresetsForEffect(effectType).map(p => ({
    ...p,
    isFactory: false as const,
  }));

  return [...factory, ...user];
}
