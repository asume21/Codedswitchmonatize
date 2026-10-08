import { describe, it, expect } from 'vitest';
import { EFFECT_AUTO_PARAMS, resolveAutomationParam } from '../AutomationLane';

// Product review M6: the lane dropdown offered 15 parameters, playback applied
// 2. Every offered parameter must map to something the mixer engine can set.
describe('automation parameters', () => {
  it('every offered parameter resolves to a mixer action', () => {
    for (const p of EFFECT_AUTO_PARAMS) {
      expect(resolveAutomationParam(p.value, 0.5), p.value).not.toBeNull();
    }
  });

  it('maps lane values (0–1) to engine units', () => {
    expect(resolveAutomationParam('volume', 0.6)).toEqual({ kind: 'volume', value: 0.6 });
    expect(resolveAutomationParam('pan', 0)).toEqual({ kind: 'pan', value: -1 });
    expect(resolveAutomationParam('eq.low', 1)).toEqual({ kind: 'eq', bands: ['low'], gainDb: 12 });
    expect(resolveAutomationParam('eq.mid', 0.5)).toEqual({ kind: 'eq', bands: ['lowMid', 'highMid'], gainDb: 0 });
    expect(resolveAutomationParam('reverb.mix', 0.4)).toEqual({ kind: 'send', sendId: 'hall', level: 0.4 });
    expect(resolveAutomationParam('delay.mix', 0.2)).toEqual({ kind: 'send', sendId: 'delay', level: 0.2 });
  });

  it('does not offer parameters the engine cannot control', () => {
    const offered = EFFECT_AUTO_PARAMS.map((p) => p.value);
    for (const unsupported of ['filter.cutoff', 'distortion.amount', 'compressor.threshold', 'delay.time']) {
      expect(offered).not.toContain(unsupported);
    }
  });
});
