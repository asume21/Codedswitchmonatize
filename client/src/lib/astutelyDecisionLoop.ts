/**
 * AstutelyDecisionLoop — The reactive brain that evaluates SelfListenReports
 * and makes automated mix + organism adjustments.
 *
 * Fires each time a new SelfListenReport arrives (~every 15s).
 * Makes conservative, bounded adjustments to prevent oscillation.
 */

import type { SelfListenReport } from '@/organism/audio/types';
import type { PhysicsState } from '@/organism/physics/types';
import { astutelyOrganismBridge } from './astutelyOrganismBridge';
import { astutelyMixerBridge } from './astutelyMixerBridge';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MixAdjustment {
  channelId: string;
  property: 'volume' | 'eq';
  band?: string;
  value: number;
  reason: string;
}

export interface OrganismAdjustment {
  action: string;
  generator?: string;
  value: number | boolean;
  reason: string;
}

export interface DecisionResult {
  mixAdjustments: MixAdjustment[];
  organismAdjustments: OrganismAdjustment[];
  log: string[];
  timestamp: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_VOLUME_STEP = 0.05;
const MAX_EQ_STEP = 1.5;           // dB per evaluation
const COOLDOWN_MS = 10_000;         // min time between same-type adjustments
const MAX_HISTORY = 20;

// ── Decision Loop ────────────────────────────────────────────────────────────

export class AstutelyDecisionLoop {
  private enabled = false;
  private activeGenre: string | null = null;
  private history: DecisionResult[] = [];
  private lastAdjustmentTimes: Record<string, number> = {};

  enable(): void { this.enabled = true; }
  disable(): void { this.enabled = false; }
  isEnabled(): boolean { return this.enabled; }

  setGenre(genre: string | null): void {
    this.activeGenre = genre;
  }

  getHistory(): DecisionResult[] {
    return this.history;
  }

  evaluate(report: SelfListenReport, physicsState: PhysicsState | null): DecisionResult {
    const result: DecisionResult = {
      mixAdjustments: [],
      organismAdjustments: [],
      log: [],
      timestamp: Date.now(),
    };

    if (!this.enabled) return result;

    this.evaluateVolume(report, result);
    this.evaluateFrequencyBalance(report, result);
    this.evaluateRhythm(report, physicsState, result);
    this.evaluateDynamics(report, result);

    // Apply all adjustments
    this.applyMixAdjustments(result.mixAdjustments);
    this.applyOrganismAdjustments(result.organismAdjustments);

    // Store history
    this.history.push(result);
    if (this.history.length > MAX_HISTORY) this.history.shift();

    return result;
  }

  // ── Volume evaluation ──────────────────────────────────────────────────

  private evaluateVolume(report: SelfListenReport, result: DecisionResult): void {
    if (!this.canAdjust('volume')) return;

    if (report.hasClipping) {
      result.mixAdjustments.push({
        channelId: '__master__',
        property: 'volume',
        value: -0.1,
        reason: `Clipping detected (${report.clippingPercent.toFixed(2)}%)`,
      });
      result.log.push(`Volume: clipping at ${report.clippingPercent.toFixed(2)}% — reducing master`);
      this.markAdjusted('volume');
    } else if (report.needsVolumeReduction) {
      result.mixAdjustments.push({
        channelId: '__master__',
        property: 'volume',
        value: -MAX_VOLUME_STEP,
        reason: 'RMS too high',
      });
      result.log.push('Volume: RMS too hot — reducing master');
      this.markAdjusted('volume');
    } else if (report.needsVolumeBoost && !report.isSilent) {
      result.mixAdjustments.push({
        channelId: '__master__',
        property: 'volume',
        value: MAX_VOLUME_STEP,
        reason: 'RMS too low',
      });
      result.log.push('Volume: RMS too quiet — boosting master');
      this.markAdjusted('volume');
    }
  }

  // ── Frequency balance ──────────────────────────────────────────────────

  private evaluateFrequencyBalance(report: SelfListenReport, result: DecisionResult): void {
    if (!this.canAdjust('eq')) return;

    const { bandEnergy, spectralCentroidHz } = report;
    const snapshot = astutelyMixerBridge.getSnapshot();
    let adjusted = false;

    // Muddy mix — too much low-mid energy
    if (spectralCentroidHz < 1200 && bandEnergy.lowMid > 0.35) {
      for (const ch of snapshot.channels) {
        if (ch.name.toLowerCase().includes('bass') || ch.name.toLowerCase().includes('drum')) {
          result.mixAdjustments.push({
            channelId: ch.id,
            property: 'eq',
            band: 'lowMid',
            value: -MAX_EQ_STEP,
            reason: 'Muddy mix — cutting low-mid',
          });
        }
      }
      result.log.push(`EQ: Muddy (centroid ${spectralCentroidHz.toFixed(0)}Hz) — cutting low-mids`);
      adjusted = true;
    }

    // Harsh mix — too bright
    if (spectralCentroidHz > 6000 && bandEnergy.high > 0.25) {
      for (const ch of snapshot.channels) {
        if (ch.name.toLowerCase().includes('melody') || ch.name.toLowerCase().includes('hi')) {
          result.mixAdjustments.push({
            channelId: ch.id,
            property: 'eq',
            band: 'highMid',
            value: -MAX_EQ_STEP,
            reason: 'Harsh mix — cutting high-mid',
          });
        }
      }
      result.log.push(`EQ: Harsh (centroid ${spectralCentroidHz.toFixed(0)}Hz) — cutting high-mids`);
      adjusted = true;
    }

    // Sub-heavy — too much sub bass
    if (bandEnergy.sub > 0.35) {
      for (const ch of snapshot.channels) {
        if (ch.name.toLowerCase().includes('bass')) {
          result.mixAdjustments.push({
            channelId: ch.id,
            property: 'eq',
            band: 'low',
            value: -MAX_EQ_STEP,
            reason: 'Sub-heavy mix — cutting low shelf on bass',
          });
        }
      }
      result.log.push('EQ: Sub-heavy — cutting bass low shelf');
      adjusted = true;
    }

    if (adjusted) this.markAdjusted('eq');
  }

  // ── Rhythm evaluation ──────────────────────────────────────────────────

  private evaluateRhythm(report: SelfListenReport, physicsState: PhysicsState | null, result: DecisionResult): void {
    if (!this.canAdjust('rhythm')) return;

    // BPM drift correction
    if (report.estimatedBpm && Math.abs(report.bpmDrift) > 3) {
      result.organismAdjustments.push({
        action: 'setBpm',
        value: report.estimatedBpm,
        reason: `BPM drift of ${report.bpmDrift.toFixed(1)} detected`,
      });
      result.log.push(`Rhythm: BPM drift ${report.bpmDrift.toFixed(1)} — re-syncing to ${report.estimatedBpm}`);
      this.markAdjusted('rhythm');
    }

    // Sloppy groove — increase kick presence
    if (report.onsetTimingStdDevMs > 50 && physicsState) {
      result.organismAdjustments.push({
        action: 'setGeneratorVolume',
        generator: 'kickVelocity',
        value: 1.1,
        reason: `Groove jitter (stddev ${report.onsetTimingStdDevMs.toFixed(0)}ms)`,
      });
      result.log.push(`Rhythm: Sloppy groove (${report.onsetTimingStdDevMs.toFixed(0)}ms jitter) — increasing kick`);
      this.markAdjusted('rhythm');
    }
  }

  // ── Dynamics evaluation ────────────────────────────────────────────────

  private evaluateDynamics(report: SelfListenReport, result: DecisionResult): void {
    if (!this.canAdjust('dynamics')) return;

    // Over-compressed — no headroom
    if (report.dynamicRangeDb < 4 && report.crestFactor < 1.5) {
      result.organismAdjustments.push({
        action: 'setGeneratorVolume',
        generator: 'bass',
        value: 0.9,
        reason: `Over-compressed (DR ${report.dynamicRangeDb.toFixed(1)}dB, crest ${report.crestFactor.toFixed(2)})`,
      });
      result.organismAdjustments.push({
        action: 'setGeneratorVolume',
        generator: 'hatDensity',
        value: 1.1,
        reason: 'Adding transient energy via hats',
      });
      result.log.push(`Dynamics: Over-compressed (DR ${report.dynamicRangeDb.toFixed(1)}dB) — reducing bass, boosting hats`);
      this.markAdjusted('dynamics');
    }
  }

  // ── Adjustment application ─────────────────────────────────────────────

  private applyMixAdjustments(adjustments: MixAdjustment[]): void {
    const snapshot = astutelyMixerBridge.getSnapshot();

    for (const adj of adjustments) {
      if (adj.channelId === '__master__' && adj.property === 'volume') {
        const newLevel = Math.max(0, Math.min(1, snapshot.masterLevel + adj.value));
        astutelyMixerBridge.setMasterLevel(newLevel);
      } else if (adj.property === 'eq' && adj.band) {
        astutelyMixerBridge.setChannelEQ(
          adj.channelId,
          adj.band as 'low' | 'lowMid' | 'highMid' | 'high',
          adj.value,
        );
      } else if (adj.property === 'volume') {
        const ch = snapshot.channels.find(c => c.id === adj.channelId);
        if (ch) {
          const newVol = Math.max(0, Math.min(1, ch.volume + adj.value));
          astutelyMixerBridge.setChannelVolume(adj.channelId, newVol);
        }
      }
    }
  }

  private applyOrganismAdjustments(adjustments: OrganismAdjustment[]): void {
    for (const adj of adjustments) {
      if (adj.action === 'setBpm' && typeof adj.value === 'number') {
        astutelyOrganismBridge.setBpm(adj.value);
      } else if (adj.action === 'setGeneratorVolume' && adj.generator && typeof adj.value === 'number') {
        astutelyOrganismBridge.setGeneratorVolume(
          adj.generator as 'bass' | 'melody' | 'hatDensity' | 'kickVelocity' | 'texture',
          adj.value,
        );
      }
    }
  }

  // ── Cooldown management ────────────────────────────────────────────────

  private canAdjust(category: string): boolean {
    const lastTime = this.lastAdjustmentTimes[category];
    if (!lastTime) return true;
    return Date.now() - lastTime >= COOLDOWN_MS;
  }

  private markAdjusted(category: string): void {
    this.lastAdjustmentTimes[category] = Date.now();
  }
}
