/**
 * StylePresets — re-export of the shared bank so client code can keep
 * importing from this client-local path. The actual definitions live in
 * shared/stylePresets.ts because the server-side composer also needs them.
 */
export {
  STYLE_PRESETS,
  getStylePreset,
  pickStylePreset,
  listStylePresetIds,
  type StylePreset,
  type StyleMood,
} from '@shared/stylePresets'
