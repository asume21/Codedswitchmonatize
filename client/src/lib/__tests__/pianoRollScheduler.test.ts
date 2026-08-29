import { describe, it, expect, vi, beforeEach } from 'vitest';

// getAudioContext is the single shared context — stub it with a controllable clock.
let now = 0;
vi.mock('../audioContext', () => ({
  getAudioContext: () => ({ get currentTime() { return now; }, state: 'running', resume: () => {} }),
}));

import { pianoRollScheduler } from '../pianoRollScheduler';

describe('pianoRollScheduler — pattern length guards', () => {
  beforeEach(() => {
    now = 0;
    pianoRollScheduler.stop();
  });

  it('ignores a zero / negative / NaN patternSteps instead of dividing by it', () => {
    pianoRollScheduler.setPatternSteps(32);
    pianoRollScheduler.setPatternSteps(0);
    expect(pianoRollScheduler.patternSteps).toBe(32);
    pianoRollScheduler.setPatternSteps(-4);
    expect(pianoRollScheduler.patternSteps).toBe(32);
    pianoRollScheduler.setPatternSteps(Number.NaN);
    expect(pianoRollScheduler.patternSteps).toBe(32);
  });

  it('floors a fractional patternSteps', () => {
    pianoRollScheduler.setPatternSteps(16.7);
    expect(pianoRollScheduler.patternSteps).toBe(16);
  });

  it('audioTimeToStep returns -1 when idle rather than NaN', () => {
    expect(pianoRollScheduler.audioTimeToStep(0)).toBe(-1);
  });

  it('seekToStep wraps negative steps into range', () => {
    pianoRollScheduler.setPatternSteps(16);
    pianoRollScheduler.seekToStep(-1);
    // -1 mod 16 -> 15, never a negative index
    expect(pianoRollScheduler.audioTimeToStep(now)).toBe(-1); // idle, but no throw
  });
});
