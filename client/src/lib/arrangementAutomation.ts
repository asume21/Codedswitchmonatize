/**
 * An AI arrangement (sections with per-track on/off + volume) as volume
 * automation, so the song shape is audible on playback and editable in the
 * arrangement's automation lanes.
 *
 * "Apply full arrangement" used to do nothing while reporting success, and
 * "Apply section" only flipped whole-track mute/volume for the entire song
 * (product review A2/A3). Stepped points switch cleanly at each section
 * boundary — no fade across a section.
 */
import type { AutoPoint } from '@/components/studio/AutomationLane';

export interface ArrangementSectionLike {
  startBar: number;
  endBar: number;
  trackStates?: Record<string, { active: boolean; volume: number }>;
}

export function arrangementToVolumeAutomation(
  sections: ArrangementSectionLike[],
  trackIds: string[],
): Record<string, AutoPoint[]> {
  const ordered = [...sections].sort((a, b) => a.startBar - b.startBar);
  const out: Record<string, AutoPoint[]> = {};
  for (const id of trackIds) {
    if (!ordered.some((s) => s.trackStates?.[id])) continue; // arrangement doesn't use this track
    const points: AutoPoint[] = ordered.map((s, i) => {
      const state = s.trackStates?.[id];
      return {
        id: `arr-${id}-${i}`,
        bar: s.startBar,
        value: state?.active ? Math.max(0, Math.min(1, state.volume)) : 0,
        curve: 'step',
      };
    });
    const last = ordered[ordered.length - 1];
    if (last) points.push({ id: `arr-${id}-end`, bar: last.endBar, value: points[points.length - 1].value, curve: 'step' });
    out[id] = points;
  }
  return out;
}
