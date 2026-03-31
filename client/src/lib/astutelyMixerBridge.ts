/**
 * AstutelyMixerBridge — Thin wrapper around the professionalAudio singleton
 * giving Astutely's brain clean access to read mixer state and control mix parameters.
 */

import { professionalAudio } from './professionalAudio';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MixerChannelSnapshot {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  peak: number;
  rms: number;
}

export interface MixerSnapshot {
  channels: MixerChannelSnapshot[];
  masterLevel: number;
}

export type EQBand = 'low' | 'lowMid' | 'highMid' | 'high';

export interface GenreMixPreset {
  name: string;
  channels: Record<string, {
    volume?: number;
    pan?: number;
    eq?: Partial<Record<EQBand, number>>;
    sendLevels?: Record<string, number>;
  }>;
  masterLevel: number;
}

// ── Bridge Singleton ─────────────────────────────────────────────────────────

class AstutelyMixerBridge {

  // ── Read ────────────────────────────────────────────────────────────────

  getSnapshot(): MixerSnapshot {
    const channels = professionalAudio.getChannels().map(ch => {
      const meters = professionalAudio.getChannelMeters(ch.id);
      return {
        id: ch.id,
        name: ch.name,
        volume: ch.volume,
        pan: ch.pan,
        muted: ch.muted,
        solo: ch.solo,
        peak: meters.peak,
        rms: meters.rms,
      };
    });
    return {
      channels,
      masterLevel: (professionalAudio as unknown as { masterLevel: number }).masterLevel ?? 0.8,
    };
  }

  getChannelMeters(channelId: string): { peak: number; rms: number } {
    return professionalAudio.getChannelMeters(channelId);
  }

  // ── Write ───────────────────────────────────────────────────────────────

  setChannelVolume(channelId: string, volume: number): void {
    professionalAudio.setChannelVolume(channelId, volume);
  }

  setChannelPan(channelId: string, pan: number): void {
    professionalAudio.setChannelPan(channelId, pan);
  }

  setChannelEQ(channelId: string, band: EQBand, gain: number): void {
    professionalAudio.setChannelEQ(channelId, band, gain);
  }

  muteChannel(channelId: string, muted: boolean): void {
    professionalAudio.muteChannel(channelId, muted);
  }

  soloChannel(channelId: string, solo: boolean): void {
    professionalAudio.soloChannel(channelId, solo);
  }

  setMasterLevel(level: number): void {
    professionalAudio.setMasterLevel(level);
  }

  setSendLevel(channelId: string, sendId: string, level: number): void {
    professionalAudio.setSendLevel(channelId, sendId, level);
  }

  // ── Genre presets ───────────────────────────────────────────────────────

  applyGenrePreset(preset: GenreMixPreset): void {
    const snapshot = this.getSnapshot();

    for (const ch of snapshot.channels) {
      const presetCh = preset.channels[ch.name.toLowerCase()] ?? preset.channels[ch.id];
      if (!presetCh) continue;

      if (presetCh.volume !== undefined) this.setChannelVolume(ch.id, presetCh.volume);
      if (presetCh.pan !== undefined) this.setChannelPan(ch.id, presetCh.pan);

      if (presetCh.eq) {
        for (const [band, gain] of Object.entries(presetCh.eq)) {
          if (gain !== undefined) this.setChannelEQ(ch.id, band as EQBand, gain);
        }
      }

      if (presetCh.sendLevels) {
        for (const [sendId, level] of Object.entries(presetCh.sendLevels)) {
          this.setSendLevel(ch.id, sendId, level);
        }
      }
    }

    this.setMasterLevel(preset.masterLevel);
  }
}

export const astutelyMixerBridge = new AstutelyMixerBridge();
