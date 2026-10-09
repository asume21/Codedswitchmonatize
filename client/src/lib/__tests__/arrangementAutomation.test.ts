import { describe, it, expect } from 'vitest';
import { arrangementToVolumeAutomation } from '../arrangementAutomation';
import { valueAt } from '@/components/studio/AutomationLane';

// Product review A2/A3: "Apply full arrangement" did nothing (and said it
// worked). The song shape is written as stepped volume automation per track:
// in a section a track is either at its section volume or silent.
describe('arrangementToVolumeAutomation', () => {
  const sections = [
    { name: 'Intro', startBar: 0, endBar: 4, trackStates: { drums: { active: false, volume: 0.8 }, keys: { active: true, volume: 0.6 } } },
    { name: 'Verse', startBar: 4, endBar: 12, trackStates: { drums: { active: true, volume: 0.9 }, keys: { active: true, volume: 0.5 } } },
    { name: 'Break', startBar: 12, endBar: 16, trackStates: { drums: { active: false, volume: 0.9 } } },
  ];

  it('plays each track at its section volume, silent where inactive', () => {
    const auto = arrangementToVolumeAutomation(sections, ['drums', 'keys']);
    expect(valueAt(auto.drums, 2)).toBe(0);
    expect(valueAt(auto.drums, 6)).toBe(0.9);
    expect(valueAt(auto.drums, 13)).toBe(0);
    expect(valueAt(auto.keys, 1)).toBe(0.6);
    expect(valueAt(auto.keys, 11.9)).toBe(0.5); // step: holds, no fade across the section
  });

  it('silences a track a section does not mention', () => {
    const auto = arrangementToVolumeAutomation(sections, ['drums', 'keys']);
    expect(valueAt(auto.keys, 13)).toBe(0);
  });

  it('skips tracks no section mentions at all', () => {
    expect(arrangementToVolumeAutomation(sections, ['bass']).bass).toBeUndefined();
  });
});
