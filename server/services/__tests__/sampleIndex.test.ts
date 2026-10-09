import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { classifySampleFilename } from '../sampleClassify';

// Product review L5/L6 (2026-10-07): index.json listed 378 files that didn't
// exist (deleted macOS ._ junk) and filed 46% of samples as "other".
const dir = path.join(process.cwd(), 'audio', 'samples');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const samples: Array<{ filename: string; type: string }> = index.samples;

describe('audio/samples/index.json', () => {
  it('lists only files that exist', () => {
    const missing = samples.filter((s) => !fs.existsSync(path.join(dir, s.filename))).map((s) => s.filename);
    expect(missing, `${missing.length} index entries have no file`).toEqual([]);
  });

  it('has no macOS AppleDouble junk', () => {
    expect(samples.filter((s) => s.filename.includes('._'))).toEqual([]);
  });

  it('keeps totalSamples honest', () => {
    expect(index.totalSamples).toBe(samples.length);
  });
});

describe('classifySampleFilename', () => {
  it('files recognisable drum names, leaves ambiguous ones alone', () => {
    expect(classifySampleFilename('other_cycdh_e808_snr01.wav', 'other')).toBe('snare');
    expect(classifySampleFilename('other_cycdh_k1close-02.wav', 'other')).toBe('kick');
    expect(classifySampleFilename('other_cycdh_tom03.wav', 'other')).toBe('percussion');
    expect(classifySampleFilename('other_clap_-_crackle_1.wav', 'other')).toBe('percussion');
    expect(classifySampleFilename('other_cycdh_crash01.wav', 'other')).toBe('percussion');
    expect(classifySampleFilename('other_cycdh_kurz04.wav', 'other')).toBe('other');
    expect(classifySampleFilename('kick_808.wav', 'kick')).toBe('kick'); // never overrides a real type
  });
});
