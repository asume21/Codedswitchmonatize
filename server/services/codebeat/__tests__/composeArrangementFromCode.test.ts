import { describe, it, expect } from 'vitest';
import { analyzeCodeStructure } from '../analyzeCodeStructure';
import { composeArrangementFromCode } from '../composeArrangementFromCode';
import { validateArrangementPlan } from '../../../../shared/arrangement';

const SAMPLE = `function render() {
  for (let i = 0; i < 8; i++) {
    if (visible(i)) { draw(i); }
  }
}
function visible(i) { return i > 2; }
function draw(i) { return i; }`;

describe('composeArrangementFromCode', () => {
  it('emits a plan that passes validateArrangementPlan', () => {
    const fp = analyzeCodeStructure(SAMPLE, 'javascript');
    const plan = composeArrangementFromCode(fp, { genre: 'hiphop' });
    expect(validateArrangementPlan(plan)).toBeNull();
  });

  it('is deterministic — same fingerprint yields deeply equal plan', () => {
    const fp = analyzeCodeStructure(SAMPLE, 'javascript');
    const a = composeArrangementFromCode(fp, { genre: 'hiphop' });
    const b = composeArrangementFromCode(fp, { genre: 'hiphop' });
    expect(a).toEqual(b);
  });

  it('maps the most-referenced unit to a drop (hook) section', () => {
    const fp = analyzeCodeStructure(SAMPLE, 'javascript');
    const plan = composeArrangementFromCode(fp, { genre: 'hiphop' });
    expect(plan.sections.some(s => s.name === 'drop')).toBe(true);
  });

  it('always produces at least one section even for empty code', () => {
    const fp = analyzeCodeStructure('', 'javascript');
    const plan = composeArrangementFromCode(fp, { genre: 'pop' });
    expect(plan.sections.length).toBeGreaterThanOrEqual(1);
    expect(validateArrangementPlan(plan)).toBeNull();
  });
});
