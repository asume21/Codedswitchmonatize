/**
 * Automation Engine — Draw volume/pan/effect curves per track.
 * Supports linear, exponential, and step interpolation.
 * Integrates with the project manager and undo system.
 */

import type { AutomationPoint, AutomationLane } from '@/lib/projectManager';

/**
 * Interpolate the value of an automation lane at a given time (in beats).
 */
export function getAutomationValue(lane: AutomationLane, time: number): number | null {
  if (!lane.enabled || lane.points.length === 0) return null;

  const sorted = [...lane.points].sort((a, b) => a.time - b.time);

  // Before first point — hold first value
  if (time <= sorted[0].time) return sorted[0].value;

  // After last point — hold last value
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  // Find surrounding points
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (time >= a.time && time <= b.time) {
      return interpolate(a, b, time);
    }
  }

  return sorted[sorted.length - 1].value;
}

function interpolate(a: AutomationPoint, b: AutomationPoint, time: number): number {
  if (a.time === b.time) return b.value;
  const t = (time - a.time) / (b.time - a.time); // 0-1

  switch (b.curve) {
    case 'step':
      return a.value;
    case 'exponential': {
      // Exponential curve (audio-friendly)
      const minVal = 0.001;
      const aVal = Math.max(a.value, minVal);
      const bVal = Math.max(b.value, minVal);
      return aVal * Math.pow(bVal / aVal, t);
    }
    case 'linear':
    default:
      return a.value + (b.value - a.value) * t;
  }
}

/**
 * Add a point to an automation lane, replacing any point at the same time.
 */
export function addAutomationPoint(
  lane: AutomationLane,
  point: AutomationPoint,
): AutomationLane {
  const filtered = lane.points.filter(p => Math.abs(p.time - point.time) > 0.001);
  return {
    ...lane,
    points: [...filtered, point].sort((a, b) => a.time - b.time),
  };
}

/**
 * Remove a point from an automation lane by time (within tolerance).
 */
export function removeAutomationPoint(
  lane: AutomationLane,
  time: number,
  tolerance: number = 0.05,
): AutomationLane {
  return {
    ...lane,
    points: lane.points.filter(p => Math.abs(p.time - time) > tolerance),
  };
}

/**
 * Move a point in time and/or value.
 */
export function moveAutomationPoint(
  lane: AutomationLane,
  oldTime: number,
  newTime: number,
  newValue: number,
  tolerance: number = 0.05,
): AutomationLane {
  const points = lane.points.map(p => {
    if (Math.abs(p.time - oldTime) <= tolerance) {
      return { ...p, time: newTime, value: Math.max(0, Math.min(1, newValue)) };
    }
    return p;
  });
  return { ...lane, points: points.sort((a, b) => a.time - b.time) };
}

/**
 * Create a new automation lane.
 */
export function createAutomationLane(
  trackId: string,
  parameter: string,
): AutomationLane {
  return {
    id: crypto.randomUUID(),
    trackId,
    parameter,
    points: [],
    enabled: true,
  };
}

/**
 * Draw a freehand automation curve (pencil tool).
 * Takes an array of {time, value} samples and reduces to key points.
 */
export function drawAutomationCurve(
  lane: AutomationLane,
  samples: Array<{ time: number; value: number }>,
  curve: 'linear' | 'exponential' | 'step' = 'linear',
  simplifyThreshold: number = 0.02,
): AutomationLane {
  if (samples.length === 0) return lane;

  // Douglas-Peucker simplification to reduce point count
  const simplified = simplifyPoints(samples, simplifyThreshold);

  const newPoints: AutomationPoint[] = simplified.map(s => ({
    time: s.time,
    value: Math.max(0, Math.min(1, s.value)),
    curve,
  }));

  // Merge with existing points outside the drawn range
  const minTime = Math.min(...samples.map(s => s.time));
  const maxTime = Math.max(...samples.map(s => s.time));
  const existing = lane.points.filter(p => p.time < minTime || p.time > maxTime);

  return {
    ...lane,
    points: [...existing, ...newPoints].sort((a, b) => a.time - b.time),
  };
}

function simplifyPoints(
  points: Array<{ time: number; value: number }>,
  threshold: number,
): Array<{ time: number; value: number }> {
  if (points.length <= 2) return points;

  const first = points[0];
  const last = points[points.length - 1];

  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > threshold) {
    const left = simplifyPoints(points.slice(0, maxIdx + 1), threshold);
    const right = simplifyPoints(points.slice(maxIdx), threshold);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(
  point: { time: number; value: number },
  lineStart: { time: number; value: number },
  lineEnd: { time: number; value: number },
): number {
  const dx = lineEnd.time - lineStart.time;
  const dy = lineEnd.value - lineStart.value;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return Math.sqrt((point.time - lineStart.time) ** 2 + (point.value - lineStart.value) ** 2);
  return Math.abs(dy * point.time - dx * point.value + lineEnd.time * lineStart.value - lineEnd.value * lineStart.time) / len;
}

/**
 * Standard automatable parameters per track type.
 */
export const AUTOMATABLE_PARAMS = {
  common: ['volume', 'pan', 'mute'],
  expression: ['expression', 'modulation', 'filter.cutoff'],
  effects: {
    eq: ['eq.low', 'eq.mid', 'eq.high'],
    compressor: ['compressor.threshold', 'compressor.ratio'],
    reverb: ['reverb.mix', 'reverb.decay'],
    delay: ['delay.mix', 'delay.feedback', 'delay.time'],
    chorus: ['chorus.rate', 'chorus.depth', 'chorus.mix'],
    distortion: ['distortion.drive', 'distortion.mix'],
    filter: ['filter.frequency', 'filter.resonance'],
  },
  send: ['send.reverb', 'send.delay'],
} as const;

/**
 * Get display name for an automation parameter.
 */
export function getParamDisplayName(param: string): string {
  const names: Record<string, string> = {
    'volume': 'Volume',
    'pan': 'Pan',
    'mute': 'Mute',
    'expression': 'Expression (CC11)',
    'modulation': 'Vibrato / Mod (CC1)',
    'filter.cutoff': 'Filter Cutoff',
    'eq.low': 'EQ Low',
    'eq.mid': 'EQ Mid',
    'eq.high': 'EQ High',
    'compressor.threshold': 'Comp Threshold',
    'compressor.ratio': 'Comp Ratio',
    'reverb.mix': 'Reverb Mix',
    'reverb.decay': 'Reverb Decay',
    'delay.mix': 'Delay Mix',
    'delay.feedback': 'Delay Feedback',
    'delay.time': 'Delay Time',
    'chorus.rate': 'Chorus Rate',
    'chorus.depth': 'Chorus Depth',
    'chorus.mix': 'Chorus Mix',
    'distortion.drive': 'Distortion Drive',
    'distortion.mix': 'Distortion Mix',
    'filter.frequency': 'Filter Freq',
    'filter.resonance': 'Filter Res',
    'send.reverb': 'Send: Reverb',
    'send.delay': 'Send: Delay',
  };
  return names[param] || param;
}
