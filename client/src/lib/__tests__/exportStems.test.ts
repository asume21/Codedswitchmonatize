import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { stemFileNames, buildStemsZip } from '../exportStems';

// Product review M7: "Export stems" downloaded one MIDI file. Stems are one
// file per track, delivered together as a single zip.
describe('stems export packaging', () => {
  it('gives every track a safe, unique file name', () => {
    const names = stemFileNames([
      { name: 'Lead Vocal', ext: 'wav' },
      { name: 'Lead Vocal', ext: 'wav' },
      { name: 'Drums/../evil?', ext: 'wav' },
      { name: 'Bass', ext: 'mid' },
    ]);
    expect(names).toEqual(['01 Lead Vocal.wav', '02 Lead Vocal.wav', '03 Drums_.._evil_.wav', '04 Bass.mid']);
  });

  it('does not double an extension the track name already has', () => {
    expect(stemFileNames([{ name: 'clap_1.wav', ext: 'wav' }, { name: 'take.webm', ext: 'wav' }]))
      .toEqual(['01 clap_1.wav', '02 take.wav']);
  });

  it('round-trips every stem through the zip', () => {
    const zip = buildStemsZip([
      { fileName: '01 Drums.wav', data: new Uint8Array([1, 2, 3]) },
      { fileName: '02 Bass.mid', data: new TextEncoder().encode('MThd') },
    ]);
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['01 Drums.wav', '02 Bass.mid']);
    expect(Array.from(files['01 Drums.wav'])).toEqual([1, 2, 3]);
    expect(strFromU8(files['02 Bass.mid'])).toBe('MThd');
  });
});
