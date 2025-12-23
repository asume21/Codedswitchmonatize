import { jobManager, Job } from './jobManager';

// Types for the mix preview system
export interface Region {
  id: string;
  start: number;      // Start time in seconds
  end: number;        // End time in seconds
  src: string;        // Audio source URL
  type: 'audio' | 'midi' | 'drums';
  offset?: number;    // Offset within the source file
  duration?: number;  // Duration to use from source
  stretch?: number;   // Time stretch factor (1.0 = normal)
  gain?: number;      // Clip gain in dB (-60 to +12)
}

export interface Insert {
  type: 'eq' | 'compressor';
  enabled: boolean;
  params: Record<string, number>;
}

export interface Send {
  target: 'reverb' | 'delay';
  level: number;      // Send level in dB
  preFader: boolean;
}

export interface Track {
  id: string;
  type: 'audio' | 'midi' | 'drums';
  kind?: 'vocal' | 'drums' | 'bass' | 'synth' | 'guitar' | 'keys' | 'fx' | 'other';
  name: string;
  color?: string;
  regions: Region[];
  volume: number;     // Fader level in dB
  pan: number;        // -100 (L) to +100 (R)
  muted: boolean;
  solo: boolean;
  inserts: Insert[];
  sends: { a: Send; b: Send };
}

export interface MasterBus {
  volume: number;     // Master fader in dB
  limiter: {
    threshold: number;  // dB
    release: number;    // ms
    ceiling: number;    // dB
  };
}

export interface Session {
  id: string;
  name: string;
  bpm: number;
  key: string;
  timeSignature: { numerator: number; denominator: number };
  loopStart?: number;
  loopEnd?: number;
  punchIn?: number;
  punchOut?: number;
  tracks: Track[];
  masterBus: MasterBus;
  buses: {
    reverb: { type: string; params: Record<string, number> };
    delay: { type: string; params: Record<string, number> };
  };
}

export interface MixPreviewRequest {
  session: Session;
  renderQuality: 'fast' | 'high';
  startTime?: number;
  endTime?: number;
  format?: 'wav' | 'mp3';
}

export interface MixPreviewResult {
  jobId: string;
  previewUrl: string;
  duration: number;
  peakLevel: number;
  format: string;
}

// Default values for track kinds
const TRACK_KIND_DEFAULTS: Record<string, { sendA: number; sendB: number; eqPreset?: string }> = {
  vocal: { sendA: -12, sendB: -18, eqPreset: 'vocal' },
  drums: { sendA: -24, sendB: -30, eqPreset: 'drums' },
  bass: { sendA: -30, sendB: -36, eqPreset: 'bass' },
  synth: { sendA: -15, sendB: -12, eqPreset: 'synth' },
  guitar: { sendA: -12, sendB: -15, eqPreset: 'guitar' },
  keys: { sendA: -15, sendB: -18, eqPreset: 'keys' },
  fx: { sendA: -6, sendB: -6, eqPreset: 'fx' },
  other: { sendA: -18, sendB: -18 },
};

// Default master bus limiter settings
const DEFAULT_MASTER_BUS: MasterBus = {
  volume: 0,
  limiter: {
    threshold: -1,
    release: 100,
    ceiling: -0.3,
  },
};

// Default EQ presets
const EQ_PRESETS: Record<string, Record<string, number>> = {
  vocal: { lowCut: 80, low: -2, lowMid: 0, mid: 2, highMid: 1, high: 2 },
  drums: { lowCut: 40, low: 2, lowMid: -1, mid: 0, highMid: 2, high: 1 },
  bass: { lowCut: 30, low: 3, lowMid: 1, mid: -2, highMid: -1, high: -3 },
  synth: { lowCut: 60, low: 0, lowMid: 1, mid: 2, highMid: 1, high: 0 },
  guitar: { lowCut: 80, low: -1, lowMid: 2, mid: 1, highMid: 2, high: 1 },
  keys: { lowCut: 60, low: 0, lowMid: 0, mid: 1, highMid: 1, high: 2 },
  fx: { lowCut: 100, low: -3, lowMid: 0, mid: 0, highMid: 0, high: 3 },
};

// Default compressor presets
const COMPRESSOR_PRESETS: Record<string, Record<string, number>> = {
  vocal: { threshold: -18, ratio: 3, attack: 10, release: 100, makeupGain: 3 },
  drums: { threshold: -12, ratio: 4, attack: 5, release: 50, makeupGain: 2 },
  bass: { threshold: -15, ratio: 4, attack: 20, release: 150, makeupGain: 2 },
  synth: { threshold: -20, ratio: 2, attack: 15, release: 100, makeupGain: 1 },
  guitar: { threshold: -16, ratio: 3, attack: 10, release: 80, makeupGain: 2 },
  keys: { threshold: -20, ratio: 2, attack: 20, release: 120, makeupGain: 1 },
  fx: { threshold: -24, ratio: 2, attack: 30, release: 200, makeupGain: 0 },
};

class MixPreviewService {
  
  /**
   * Apply default settings based on track kind
   */
  applyTrackKindDefaults(track: Track): Track {
    const kind = track.kind || 'other';
    const defaults = TRACK_KIND_DEFAULTS[kind] || TRACK_KIND_DEFAULTS.other;
    
    // Apply send defaults if not explicitly set
    if (track.sends.a.level === -60) {
      track.sends.a.level = defaults.sendA;
    }
    if (track.sends.b.level === -60) {
      track.sends.b.level = defaults.sendB;
    }
    
    // Apply EQ preset if available and EQ insert exists
    const eqInsert = track.inserts.find(i => i.type === 'eq');
    if (eqInsert && defaults.eqPreset && EQ_PRESETS[defaults.eqPreset]) {
      eqInsert.params = { ...EQ_PRESETS[defaults.eqPreset], ...eqInsert.params };
    }
    
    // Apply compressor preset if available
    const compInsert = track.inserts.find(i => i.type === 'compressor');
    if (compInsert && defaults.eqPreset && COMPRESSOR_PRESETS[defaults.eqPreset]) {
      compInsert.params = { ...COMPRESSOR_PRESETS[defaults.eqPreset], ...compInsert.params };
    }
    
    return track;
  }

  /**
   * Validate session data
   */
  validateSession(session: Session): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!session.id) errors.push('Session ID is required');
    if (!session.tracks || session.tracks.length === 0) errors.push('At least one track is required');
    if (session.bpm < 20 || session.bpm > 300) errors.push('BPM must be between 20 and 300');
    
    session.tracks.forEach((track, i) => {
      if (!track.id) errors.push(`Track ${i} missing ID`);
      if (!track.regions || track.regions.length === 0) {
        errors.push(`Track ${i} (${track.name || 'unnamed'}) has no regions`);
      }
      track.regions.forEach((region, j) => {
        if (!region.src) errors.push(`Track ${i} region ${j} missing source`);
        if (region.start < 0) errors.push(`Track ${i} region ${j} has negative start time`);
        if (region.end <= region.start) errors.push(`Track ${i} region ${j} end must be after start`);
      });
    });
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Calculate session duration from all regions
   */
  calculateDuration(session: Session): number {
    let maxEnd = 0;
    session.tracks.forEach(track => {
      if (!track.muted || track.solo) {
        track.regions.forEach(region => {
          if (region.end > maxEnd) maxEnd = region.end;
        });
      }
    });
    return maxEnd;
  }

  /**
   * Process solo/mute logic
   */
  getActiveTracks(tracks: Track[]): Track[] {
    const hasSolo = tracks.some(t => t.solo);
    if (hasSolo) {
      return tracks.filter(t => t.solo);
    }
    return tracks.filter(t => !t.muted);
  }

  /**
   * Build the mix graph for rendering
   */
  buildMixGraph(session: Session): {
    activeTracks: Track[];
    duration: number;
    masterBus: MasterBus;
    buses: Session['buses'];
  } {
    // Apply track kind defaults
    const processedTracks = session.tracks.map(t => this.applyTrackKindDefaults({ ...t }));
    
    // Get active tracks (respecting solo/mute)
    const activeTracks = this.getActiveTracks(processedTracks);
    
    // Calculate duration
    const duration = this.calculateDuration({ ...session, tracks: activeTracks });
    
    // Ensure master bus has defaults
    const masterBus: MasterBus = {
      ...DEFAULT_MASTER_BUS,
      ...session.masterBus,
      limiter: {
        ...DEFAULT_MASTER_BUS.limiter,
        ...session.masterBus?.limiter,
      },
    };
    
    return {
      activeTracks,
      duration,
      masterBus,
      buses: session.buses,
    };
  }

  /**
   * Start a mix preview render job
   */
  async startPreview(request: MixPreviewRequest): Promise<{ jobId: string; estimatedTime: number }> {
    const { session, renderQuality } = request;
    
    // Validate session
    const validation = this.validateSession(session);
    if (!validation.valid) {
      throw new Error(`Invalid session: ${validation.errors.join(', ')}`);
    }
    
    // Build mix graph
    const mixGraph = this.buildMixGraph(session);
    
    // Create job
    const job = jobManager.createJob('mix-preview', {
      sessionId: session.id,
      quality: renderQuality,
      trackCount: mixGraph.activeTracks.length,
      duration: mixGraph.duration,
    });
    
    // Estimate render time based on quality and duration
    const estimatedTime = renderQuality === 'fast' 
      ? Math.ceil(mixGraph.duration * 0.1) 
      : Math.ceil(mixGraph.duration * 0.5);
    
    // Start async render process
    this.processRender(job.id, request, mixGraph);
    
    return { jobId: job.id, estimatedTime };
  }

  /**
   * Process the render (async)
   */
  private async processRender(
    jobId: string, 
    request: MixPreviewRequest,
    mixGraph: ReturnType<typeof this.buildMixGraph>
  ): Promise<void> {
    try {
      jobManager.setProgress(jobId, 5);
      
      // Simulate processing stages
      const stages = [
        { name: 'Loading assets', progress: 20 },
        { name: 'Processing regions', progress: 40 },
        { name: 'Applying inserts', progress: 60 },
        { name: 'Mixing sends', progress: 75 },
        { name: 'Master processing', progress: 90 },
        { name: 'Encoding output', progress: 100 },
      ];
      
      const delayMs = request.renderQuality === 'fast' ? 200 : 500;
      
      for (const stage of stages) {
        await this.delay(delayMs);
        jobManager.setProgress(jobId, stage.progress);
      }
      
      // Generate preview URL (in production, this would be the actual rendered file)
      const previewUrl = `/api/mix/preview/${jobId}/audio.${request.format || 'wav'}`;
      
      const result: MixPreviewResult = {
        jobId,
        previewUrl,
        duration: mixGraph.duration,
        peakLevel: -0.3, // Simulated peak after limiting
        format: request.format || 'wav',
      };
      
      jobManager.complete(jobId, result);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown render error';
      jobManager.fail(jobId, message);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): Job | undefined {
    return jobManager.getJob(jobId);
  }
}

export const mixPreviewService = new MixPreviewService();
export default mixPreviewService;
