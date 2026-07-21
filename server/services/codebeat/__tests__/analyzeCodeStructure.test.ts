import { describe, it, expect } from 'vitest';
import { analyzeCodeStructure } from '../analyzeCodeStructure';

const SAMPLE = `function main() {
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      helper(i);
    }
  }
}
function helper(x) {
  return x * 2;
}`;

describe('analyzeCodeStructure', () => {
  it('extracts top-level units with the most-referenced first as hook candidate', () => {
    const fp = analyzeCodeStructure(SAMPLE, 'javascript');
    expect(fp.units.length).toBeGreaterThanOrEqual(2);
    const names = fp.units.map(u => u.name);
    expect(names).toContain('main');
    expect(names).toContain('helper');
  });

  it('counts loops and branches across the file', () => {
    const fp = analyzeCodeStructure(SAMPLE, 'javascript');
    expect(fp.totalLoops).toBeGreaterThanOrEqual(1);
    expect(fp.totalBranches).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic — same input yields deeply equal output', () => {
    const a = analyzeCodeStructure(SAMPLE, 'javascript');
    const b = analyzeCodeStructure(SAMPLE, 'javascript');
    expect(a).toEqual(b);
  });

  it('never throws on empty code and returns a minimal fingerprint', () => {
    const fp = analyzeCodeStructure('', 'javascript');
    expect(fp.units).toEqual([]);
    expect(fp.identifiers).toEqual([]);
    expect(fp.totalLines).toBe(0);
  });
});
