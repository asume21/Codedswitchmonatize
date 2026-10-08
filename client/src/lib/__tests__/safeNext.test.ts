import { describe, it, expect } from 'vitest';
import { safeNextPath } from '../safeNext';

// After sign-in we send people back where they came from (?next=...). Only a
// same-site path is allowed — anything else would be an open redirect.
describe('safeNextPath', () => {
  it('returns a same-site path from ?next=', () => {
    expect(safeNextPath('?next=%2Fstudio%2Fmake', '/dashboard')).toBe('/studio/make');
    expect(safeNextPath('?next=/studio/mix?view=piano', '/dashboard')).toBe('/studio/mix?view=piano');
  });

  it('falls back when next is missing or unsafe', () => {
    expect(safeNextPath('', '/dashboard')).toBe('/dashboard');
    expect(safeNextPath('?next=https://evil.example', '/dashboard')).toBe('/dashboard');
    expect(safeNextPath('?next=//evil.example/x', '/dashboard')).toBe('/dashboard');
    expect(safeNextPath('?next=/\\evil.example', '/dashboard')).toBe('/dashboard');
    expect(safeNextPath('?next=javascript:alert(1)', '/dashboard')).toBe('/dashboard');
    expect(safeNextPath('?next=/login', '/dashboard')).toBe('/dashboard');
  });
});
