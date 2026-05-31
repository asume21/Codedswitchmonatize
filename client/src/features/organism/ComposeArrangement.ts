/**
 * composeForPreset — call the server-side composer (Ollama / deterministic
 * fallback) to get an ArrangementPlan tailored to a quick-start preset.
 *
 * Design: fire-and-forget. The Organism starts in jam mode immediately so
 * audio is heard with zero added latency. When the composer returns (~1s
 * via Ollama, instant via deterministic fallback), the caller hands the
 * plan to orchestrator.loadArrangementPlan() and the Conductor switches
 * from jam mode (random progressions every section) to plan mode (intro →
 * verse → build → drop → ... per the composer's intent).
 *
 * Returns null on any failure — caller should treat that as "stay in jam
 * mode" without surfacing an error. The composer endpoint never throws
 * (deterministic fallback is always available), so failures here mean
 * network/auth issues and should not break live playback.
 */
import type { ArrangementPlan } from '@shared/arrangement'
import type { QuickStartPreset } from './QuickStartPresets'
import { apiRequest } from '@/lib/queryClient'

interface ComposerRequest {
  prompt?: string
  bpm?: number
  subGenre?: string
  mood?: string
  allowedTemplateIds?: string[]
  allowedStyleIds?: string[]
}

function presetMood(preset: QuickStartPreset): string {
  // Map energy + organism mode to a mood keyword the composer prompt-builder
  // recognizes. The composer's deterministic fallback uses these to pick
  // section progressions (minor-key for melancholic, major-with-tension for
  // triumphant, etc).
  if (preset.energy === 'high')   return preset.mode === 'gravel' ? 'dark' : 'triumphant'
  if (preset.energy === 'low')    return preset.mode === 'glow'   ? 'melancholic' : 'cool'
  return 'cool'
}

function presetPrompt(preset: QuickStartPreset, mood: string): string {
  // Free-form text the Ollama composer interprets. Keep it descriptive but
  // bounded — the composer JSON-schema-constrains its output regardless.
  return `${preset.label} style hip-hop beat at ${preset.bpm} BPM, ` +
         `${preset.genre}, ${mood} mood, full song structure with verse, ` +
         `build, drop, breakdown, and outro for vocal recording`
}

export async function composeForPreset(
  preset: QuickStartPreset,
  _signal?: AbortSignal,
): Promise<ArrangementPlan | null> {
  const mood = presetMood(preset)
  const body: ComposerRequest = {
    prompt:             presetPrompt(preset, mood),
    bpm:                preset.bpm,
    subGenre:           preset.subGenre,
    mood,
    allowedTemplateIds: preset.allowedTemplateIds,
    allowedStyleIds:    preset.allowedStyleIds,
  }
  try {
    // Use the project's apiRequest wrapper so the Bearer token from
    // localStorage and credentials are included — otherwise this endpoint
    // returns 401 and we fall to jam mode.
    const res = await apiRequest('POST', '/api/ai-music/compose', body)
    if (!res.ok) {
      console.warn('[composer] /api/ai-music/compose returned', res.status)
      return null
    }
    const json = await res.json()
    const plan = json?.plan
    if (!plan || typeof plan.id !== 'string' || !Array.isArray(plan.sections)) {
      console.warn('[composer] response missing plan or sections', json)
      return null
    }
    return plan as ArrangementPlan
  } catch (err) {
    console.warn('[composer] compose fetch failed', err)
    return null
  }
}
