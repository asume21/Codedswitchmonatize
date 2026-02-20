export type AIProviderId =
  | 'suno'
  | 'replicate-suno'
  | 'replicate-musicgen'
  | 'astutely'
  | 'grok'
  | 'openai'
  | 'local';

export interface ProviderCapability {
  id: AIProviderId;
  label: string;
  estimatedLatency: string;
  maxDuration: number; // seconds, 0 means no direct audio output support
  bpmRange: { min: number; max: number };
  maxVariations: number;
  maxSections: number;
  supportsStructuredSections: boolean;
  supportsGuideMelody: boolean;
  supportsNativeStems: boolean;
  canGenerateAudio: boolean;
}

export const PROVIDER_CAPABILITIES: Record<AIProviderId, ProviderCapability> = {
  suno: {
    id: 'suno',
    label: 'Suno',
    estimatedLatency: '30-90s',
    maxDuration: 240,
    bpmRange: { min: 60, max: 180 },
    maxVariations: 4,
    maxSections: 10,
    supportsStructuredSections: true,
    supportsGuideMelody: true,
    supportsNativeStems: false,
    canGenerateAudio: true,
  },
  'replicate-suno': {
    id: 'replicate-suno',
    label: 'Suno (Replicate)',
    estimatedLatency: '30-90s',
    maxDuration: 240,
    bpmRange: { min: 60, max: 180 },
    maxVariations: 4,
    maxSections: 10,
    supportsStructuredSections: true,
    supportsGuideMelody: true,
    supportsNativeStems: false,
    canGenerateAudio: true,
  },
  'replicate-musicgen': {
    id: 'replicate-musicgen',
    label: 'MusicGen',
    estimatedLatency: '15-30s',
    maxDuration: 30,
    bpmRange: { min: 70, max: 160 },
    maxVariations: 3,
    maxSections: 2,
    supportsStructuredSections: false,
    supportsGuideMelody: true,
    supportsNativeStems: false,
    canGenerateAudio: true,
  },
  astutely: {
    id: 'astutely',
    label: 'Astutely',
    estimatedLatency: '5-20s',
    maxDuration: 30,
    bpmRange: { min: 70, max: 160 },
    maxVariations: 3,
    maxSections: 2,
    supportsStructuredSections: false,
    supportsGuideMelody: false,
    supportsNativeStems: false,
    canGenerateAudio: true,
  },
  grok: {
    id: 'grok',
    label: 'Grok',
    estimatedLatency: '5-15s',
    maxDuration: 0,
    bpmRange: { min: 0, max: 0 },
    maxVariations: 0,
    maxSections: 0,
    supportsStructuredSections: false,
    supportsGuideMelody: false,
    supportsNativeStems: false,
    canGenerateAudio: false,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    estimatedLatency: '5-15s',
    maxDuration: 0,
    bpmRange: { min: 0, max: 0 },
    maxVariations: 0,
    maxSections: 0,
    supportsStructuredSections: false,
    supportsGuideMelody: false,
    supportsNativeStems: false,
    canGenerateAudio: false,
  },
  local: {
    id: 'local',
    label: 'Local',
    estimatedLatency: '5-20s',
    maxDuration: 0,
    bpmRange: { min: 0, max: 0 },
    maxVariations: 0,
    maxSections: 0,
    supportsStructuredSections: false,
    supportsGuideMelody: false,
    supportsNativeStems: false,
    canGenerateAudio: false,
  },
};

export interface GenerationConstraintInput {
  provider: string;
  duration?: number;
  bpm?: number;
  variations?: number;
  sectionCount?: number;
  requireGuideMelody?: boolean;
}

export interface GenerationConstraintResult {
  requestedProvider: string;
  effectiveProvider: AIProviderId;
  capability: ProviderCapability;
  duration?: number;
  bpm?: number;
  variations: number;
  sectionCount: number;
  warnings: string[];
  rerouteReason: string | null;
}

function asProviderId(provider: string): AIProviderId | null {
  const normalized = String(provider || '').toLowerCase() as AIProviderId;
  return PROVIDER_CAPABILITIES[normalized] ? normalized : null;
}

function pickHighCapacityProvider(): AIProviderId {
  return PROVIDER_CAPABILITIES.suno.canGenerateAudio ? 'suno' : 'replicate-suno';
}

export function resolveGenerationConstraints(input: GenerationConstraintInput): GenerationConstraintResult {
  const requestedProvider = String(input.provider || 'suno').toLowerCase();
  const requestedId = asProviderId(requestedProvider) || 'suno';
  let effectiveProvider: AIProviderId = requestedId;
  let capability = PROVIDER_CAPABILITIES[effectiveProvider];
  const warnings: string[] = [];
  let rerouteReason: string | null = null;

  const requestedDuration = Number.isFinite(Number(input.duration)) ? Number(input.duration) : undefined;
  const requestedBpm = Number.isFinite(Number(input.bpm)) ? Number(input.bpm) : undefined;
  const requestedVariations = Math.max(1, Math.floor(Number(input.variations || 1)));
  const requestedSectionCount = Math.max(0, Math.floor(Number(input.sectionCount || 0)));

  const needsHighCapacity =
    (requestedDuration !== undefined && capability.maxDuration > 0 && requestedDuration > capability.maxDuration) ||
    requestedSectionCount > capability.maxSections ||
    requestedVariations > capability.maxVariations ||
    (requestedSectionCount > 0 && !capability.supportsStructuredSections) ||
    (!capability.supportsGuideMelody && Boolean(input.requireGuideMelody));

  if (!capability.canGenerateAudio || needsHighCapacity) {
    const fallbackProvider = pickHighCapacityProvider();
    if (fallbackProvider !== effectiveProvider) {
      rerouteReason = `Routed from ${capability.label} to ${PROVIDER_CAPABILITIES[fallbackProvider].label} for request capability fit.`;
      warnings.push(rerouteReason);
      effectiveProvider = fallbackProvider;
      capability = PROVIDER_CAPABILITIES[effectiveProvider];
    }
  }

  let duration = requestedDuration;
  if (duration !== undefined && capability.maxDuration > 0 && duration > capability.maxDuration) {
    warnings.push(`Duration capped from ${duration}s to ${capability.maxDuration}s for ${capability.label}.`);
    duration = capability.maxDuration;
  }

  let bpm = requestedBpm;
  if (bpm !== undefined && capability.bpmRange.max > 0) {
    const capped = Math.max(capability.bpmRange.min, Math.min(capability.bpmRange.max, bpm));
    if (capped !== bpm) {
      warnings.push(`BPM adjusted from ${bpm} to ${capped} for ${capability.label}.`);
      bpm = capped;
    }
  }

  const variations = Math.max(1, Math.min(capability.maxVariations || 1, requestedVariations));
  if (variations !== requestedVariations) {
    warnings.push(`Variations reduced from ${requestedVariations} to ${variations} for ${capability.label}.`);
  }

  const sectionCount = Math.max(0, Math.min(capability.maxSections || 0, requestedSectionCount));
  if (sectionCount !== requestedSectionCount) {
    warnings.push(`Sections reduced from ${requestedSectionCount} to ${sectionCount} for ${capability.label}.`);
  }

  return {
    requestedProvider,
    effectiveProvider,
    capability,
    duration,
    bpm,
    variations,
    sectionCount,
    warnings,
    rerouteReason,
  };
}
