// Audio Effects Plugins
export { EQPlugin } from './EQPlugin';
export { CompressorPlugin } from './CompressorPlugin';
export { DeesserPlugin } from './DeesserPlugin';
export { ReverbPlugin } from './ReverbPlugin';
export { LimiterPlugin } from './LimiterPlugin';
export { NoiseGatePlugin } from './NoiseGatePlugin';

// Tool Types
export type ToolType = 'EQ' | 'Compressor' | 'Deesser' | 'Reverb' | 'Limiter' | 'NoiseGate';

export interface ToolRecommendation {
  tool: ToolType;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  settings?: string;
}
