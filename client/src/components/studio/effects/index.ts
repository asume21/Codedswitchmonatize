// Audio Effects Plugins
export { EQPlugin } from './EQPlugin';
export { CompressorPlugin } from './CompressorPlugin';
export { DeesserPlugin } from './DeesserPlugin';
export { ReverbPlugin } from './ReverbPlugin';
export { LimiterPlugin } from './LimiterPlugin';
export { NoiseGatePlugin } from './NoiseGatePlugin';
export { DelayPlugin } from './DelayPlugin';
export { ChorusPlugin } from './ChorusPlugin';
export { SaturationPlugin } from './SaturationPlugin';

// Tool Types
export type ToolType = 'EQ' | 'Compressor' | 'Deesser' | 'Reverb' | 'Limiter' | 'NoiseGate' | 'Delay' | 'Chorus' | 'Saturation';

export interface ToolRecommendation {
  tool: ToolType;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  settings?: string;
}
