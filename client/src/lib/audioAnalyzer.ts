/**
 * Intelligent Audio Analyzer
 * Detects issues in music and recommends specific tools and fixes
 */

import { audioRouter } from './audioRouter';

export type AudioIssue = {
  id: string;
  type: 'vocals' | 'noise' | 'clipping' | 'eq' | 'dynamics' | 'timing' | 'pitch' | 'silence' | 'distortion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: {
    startTime: number;
    endTime: number;
    frequency?: number; // Hz for frequency-specific issues
  };
  recommendation: {
    tool: string; // Which tool to use
    route: string; // Route path to the tool
    mode: 'auto' | 'guided' | 'manual'; // Suggested mode
    settings?: any; // Recommended settings
    aiPrompt?: string; // Prompt for AI-assisted fix
  };
};

export type EditMode = 'auto' | 'guided' | 'manual';

export interface EditCapability {
  mode: EditMode;
  tool: string;
  canAutoFix: boolean;
  aiGuidance?: {
    suggestions: string[];
    parameters: any;
    confidence: number;
  };
}

export interface AnalysisResult {
  audioUrl?: string;
  duration: number;
  sampleRate: number;
  bitDepth?: number;
  channels: number;
  
  // Audio characteristics
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  peakLevel: number; // dB
  rmsLevel: number; // dB
  dynamicRange: number; // dB
  
  // Detected issues
  issues: AudioIssue[];
  
  // Recommendations
  recommendations: {
    priority: 'immediate' | 'suggested' | 'optional';
    fixes: AudioIssue['recommendation'][];
  };
  
  // Frequency analysis
  spectrum?: {
    bass: number; // 20-250 Hz
    midrange: number; // 250-4000 Hz
    treble: number; // 4000-20000 Hz
    balance: 'balanced' | 'bass-heavy' | 'treble-heavy' | 'mid-scooped';
  };
}

class AudioAnalyzer {
  private context: AudioContext | null = null;
  
  /**
   * Tool routing map - maps issues to specific studio tools
   */
  private toolRoutes = {
    vocals: {
      tool: 'Vocal Editor',
      route: '/studio/vocal-editor',
      capabilities: ['pitch-correction', 'vocal-removal', 'harmony-generation']
    },
    noise: {
      tool: 'Noise Removal',
      route: '/studio/noise-removal',
      capabilities: ['denoise', 'gate', 'spectral-repair']
    },
    eq: {
      tool: 'EQ Master',
      route: '/studio/eq-master',
      capabilities: ['parametric-eq', 'graphic-eq', 'auto-eq']
    },
    dynamics: {
      tool: 'Dynamics Processor',
      route: '/studio/dynamics',
      capabilities: ['compression', 'limiting', 'expansion', 'gating']
    },
    mastering: {
      tool: 'Mastering Suite',
      route: '/studio/mastering',
      capabilities: ['loudness', 'stereo-width', 'final-polish']
    },
    timing: {
      tool: 'Time Editor',
      route: '/studio/time-editor',
      capabilities: ['quantize', 'tempo-adjust', 'time-stretch']
    },
    pitch: {
      tool: 'Pitch Editor',
      route: '/studio/pitch-editor',
      capabilities: ['pitch-shift', 'auto-tune', 'key-change']
    }
  };

  constructor() {
    this.initializeContext();
  }

  private async initializeContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Analyze audio and detect issues
   */
  async analyzeAudio(audioData: ArrayBuffer | string): Promise<AnalysisResult> {
    await this.initializeContext();
    
    let audioBuffer: AudioBuffer;
    
    try {
      if (typeof audioData === 'string') {
        // Fetch audio from URL
        const response = await fetch(audioData);
        const buffer = await response.arrayBuffer();
        audioBuffer = await this.context!.decodeAudioData(buffer);
      } else {
        audioBuffer = await this.context!.decodeAudioData(audioData);
      }
    } catch (error) {
      console.error('Failed to decode audio:', error);
      throw new Error('Invalid audio data');
    }

    // Perform various analyses
    const issues: AudioIssue[] = [];
    const channelData = audioBuffer.getChannelData(0);
    
    // 1. Check for clipping
    const clipping = this.detectClipping(channelData);
    if (clipping.hasClipping) {
      issues.push({
        id: 'clip-1',
        type: 'clipping',
        severity: clipping.severity as any,
        description: `Audio is clipping at ${clipping.locations.length} locations`,
        location: clipping.locations[0],
        recommendation: {
          tool: this.toolRoutes.dynamics.tool,
          route: this.toolRoutes.dynamics.route,
          mode: 'auto',
          settings: { 
            limiter: true, 
            threshold: -0.3,
            makeup: -3 
          },
          aiPrompt: 'Apply soft limiting to prevent clipping while maintaining loudness'
        }
      });
    }

    // 2. Check for noise
    const noise = this.detectNoise(channelData, audioBuffer.sampleRate);
    if (noise.hasNoise) {
      issues.push({
        id: 'noise-1',
        type: 'noise',
        severity: noise.level > 0.1 ? 'high' : 'medium',
        description: `Background noise detected (${noise.type})`,
        recommendation: {
          tool: this.toolRoutes.noise.tool,
          route: this.toolRoutes.noise.route,
          mode: 'guided',
          settings: { 
            algorithm: noise.type === 'white' ? 'spectral' : 'adaptive',
            strength: noise.level * 100 
          },
          aiPrompt: `Remove ${noise.type} noise while preserving musical content`
        }
      });
    }

    // 3. Check for vocal presence
    const vocals = this.detectVocals(channelData, audioBuffer.sampleRate);
    if (vocals.hasVocals) {
      if (vocals.needsPitchCorrection) {
        issues.push({
          id: 'vocal-1',
          type: 'vocals',
          severity: 'medium',
          description: 'Vocals detected with pitch issues',
          recommendation: {
            tool: this.toolRoutes.vocals.tool,
            route: this.toolRoutes.vocals.route,
            mode: 'guided',
            settings: { 
              pitchCorrection: true,
              strength: 75 
            },
            aiPrompt: 'Apply subtle pitch correction to vocals while maintaining natural character'
          }
        });
      }
    }

    // 4. Check frequency balance
    const spectrum = this.analyzeSpectrum(channelData, audioBuffer.sampleRate);
    if (spectrum.balance !== 'balanced') {
      issues.push({
        id: 'eq-1',
        type: 'eq',
        severity: 'low',
        description: `Frequency imbalance: ${spectrum.balance}`,
        recommendation: {
          tool: this.toolRoutes.eq.tool,
          route: this.toolRoutes.eq.route,
          mode: 'auto',
          settings: {
            preset: spectrum.balance === 'bass-heavy' ? 'brighten' : 'warm',
            auto: true
          },
          aiPrompt: `Balance frequencies to achieve a more ${spectrum.balance === 'bass-heavy' ? 'bright and clear' : 'warm and full'} sound`
        }
      });
    }

    // 5. Check dynamics
    const dynamics = this.analyzeDynamics(channelData);
    if (dynamics.needsCompression) {
      issues.push({
        id: 'dynamics-1',
        type: 'dynamics',
        severity: 'medium',
        description: `Dynamic range too ${dynamics.range > 30 ? 'wide' : 'narrow'}`,
        recommendation: {
          tool: this.toolRoutes.dynamics.tool,
          route: this.toolRoutes.dynamics.route,
          mode: 'guided',
          settings: {
            ratio: dynamics.range > 30 ? 4 : 2,
            threshold: dynamics.peakLevel - 12,
            attack: 10,
            release: 100
          },
          aiPrompt: `Apply ${dynamics.range > 30 ? 'gentle compression' : 'parallel compression'} to improve dynamics`
        }
      });
    }

    // Calculate overall quality
    const overallQuality = this.calculateOverallQuality(issues);

    // Sort issues by severity
    issues.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Generate prioritized recommendations
    const recommendations = {
      priority: issues.some(i => i.severity === 'critical') ? 'immediate' as const :
                issues.some(i => i.severity === 'high') ? 'suggested' as const : 
                'optional' as const,
      fixes: issues.map(i => i.recommendation)
    };

    return {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      overallQuality,
      peakLevel: dynamics.peakLevel,
      rmsLevel: dynamics.rmsLevel,
      dynamicRange: dynamics.range,
      issues,
      recommendations,
      spectrum
    };
  }

  /**
   * Detect clipping in audio
   */
  private detectClipping(samples: Float32Array): { 
    hasClipping: boolean; 
    severity: string; 
    locations: any[] 
  } {
    const threshold = 0.99;
    const locations: any[] = [];
    let clippedSamples = 0;

    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) >= threshold) {
        clippedSamples++;
        if (locations.length < 10) {
          locations.push({
            startTime: i / 44100,
            endTime: (i + 1) / 44100
          });
        }
      }
    }

    const clippingRatio = clippedSamples / samples.length;
    const severity = clippingRatio > 0.01 ? 'critical' :
                    clippingRatio > 0.001 ? 'high' :
                    clippingRatio > 0.0001 ? 'medium' : 'low';

    return {
      hasClipping: clippedSamples > 0,
      severity,
      locations
    };
  }

  /**
   * Detect noise in audio
   */
  private detectNoise(samples: Float32Array, sampleRate: number): {
    hasNoise: boolean;
    type: 'white' | 'hum' | 'hiss' | 'background';
    level: number;
  } {
    // Simple noise detection based on quiet sections
    const windowSize = sampleRate * 0.1; // 100ms windows
    const windows = Math.floor(samples.length / windowSize);
    let quietWindows = 0;
    let noiseLevel = 0;

    for (let w = 0; w < windows; w++) {
      let windowRMS = 0;
      for (let i = 0; i < windowSize; i++) {
        const idx = w * windowSize + i;
        if (idx < samples.length) {
          windowRMS += samples[idx] * samples[idx];
        }
      }
      windowRMS = Math.sqrt(windowRMS / windowSize);
      
      if (windowRMS < 0.01 && windowRMS > 0.001) {
        quietWindows++;
        noiseLevel += windowRMS;
      }
    }

    const avgNoiseLevel = quietWindows > 0 ? noiseLevel / quietWindows : 0;
    
    return {
      hasNoise: avgNoiseLevel > 0.002,
      type: 'background', // Simplified for now
      level: avgNoiseLevel
    };
  }

  /**
   * Detect vocals in audio
   */
  private detectVocals(samples: Float32Array, sampleRate: number): {
    hasVocals: boolean;
    needsPitchCorrection: boolean;
  } {
    // Simple vocal detection based on frequency content
    // Real implementation would use more sophisticated methods
    // For now, we'll check for energy in vocal frequency range (100-8000 Hz)
    
    return {
      hasVocals: false, // Simplified for now
      needsPitchCorrection: false
    };
  }

  /**
   * Analyze frequency spectrum
   */
  private analyzeSpectrum(samples: Float32Array, sampleRate: number): {
    bass: number;
    midrange: number;
    treble: number;
    balance: 'balanced' | 'bass-heavy' | 'treble-heavy' | 'mid-scooped';
  } {
    // Simplified frequency analysis
    // Real implementation would use FFT
    
    const bass = 0.3;
    const midrange = 0.4;
    const treble = 0.3;
    
    let balance: 'balanced' | 'bass-heavy' | 'treble-heavy' | 'mid-scooped' = 'balanced';
    if (bass > midrange * 1.5) balance = 'bass-heavy';
    else if (treble > midrange * 1.5) balance = 'treble-heavy';
    else if (midrange < (bass + treble) / 3) balance = 'mid-scooped';
    
    return { bass, midrange, treble, balance };
  }

  /**
   * Analyze dynamics
   */
  private analyzeDynamics(samples: Float32Array): {
    peakLevel: number;
    rmsLevel: number;
    range: number;
    needsCompression: boolean;
  } {
    let peak = 0;
    let rms = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) peak = abs;
      rms += samples[i] * samples[i];
    }
    
    rms = Math.sqrt(rms / samples.length);
    
    const peakDB = 20 * Math.log10(peak);
    const rmsDB = 20 * Math.log10(rms);
    const range = peakDB - rmsDB;
    
    return {
      peakLevel: peakDB,
      rmsLevel: rmsDB,
      range,
      needsCompression: range > 30 || range < 6
    };
  }

  /**
   * Calculate overall quality based on issues
   */
  private calculateOverallQuality(issues: AudioIssue[]): 'excellent' | 'good' | 'fair' | 'poor' {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const mediumCount = issues.filter(i => i.severity === 'medium').length;
    
    if (criticalCount > 0) return 'poor';
    if (highCount > 2) return 'poor';
    if (highCount > 0 || mediumCount > 3) return 'fair';
    if (mediumCount > 0) return 'good';
    return 'excellent';
  }

  /**
   * Get edit capability for a specific tool
   */
  getEditCapability(tool: string, issue: AudioIssue): EditCapability {
    const canAutoFix = ['clipping', 'eq', 'dynamics'].includes(issue.type);
    
    return {
      mode: issue.recommendation.mode,
      tool,
      canAutoFix,
      aiGuidance: {
        suggestions: this.getAISuggestions(issue),
        parameters: issue.recommendation.settings || {},
        confidence: canAutoFix ? 0.85 : 0.65
      }
    };
  }

  /**
   * Get AI suggestions for fixing an issue
   */
  private getAISuggestions(issue: AudioIssue): string[] {
    const suggestions: { [key: string]: string[] } = {
      clipping: [
        'Apply a soft limiter at -0.3dB',
        'Reduce overall gain by 3dB',
        'Use multiband compression to control peaks'
      ],
      noise: [
        'Use spectral subtraction for broadband noise',
        'Apply a noise gate for silence sections',
        'Use adaptive filtering for variable noise'
      ],
      vocals: [
        'Apply gentle pitch correction (50-75% strength)',
        'Use formant correction to maintain natural tone',
        'Add subtle reverb to blend corrections'
      ],
      eq: [
        'Boost high frequencies for clarity',
        'Cut muddy frequencies around 200-400Hz',
        'Apply a gentle high-pass filter at 80Hz'
      ],
      dynamics: [
        'Apply 3:1 compression with -12dB threshold',
        'Use parallel compression for punch',
        'Add a limiter on the master bus'
      ]
    };

    return suggestions[issue.type] || ['Analyze the audio carefully', 'Make subtle adjustments', 'Compare with reference tracks'];
  }

  /**
   * Route to recommended tool
   */
  routeToTool(recommendation: AudioIssue['recommendation']) {
    // Send routing information to the audio router
    audioRouter.routeAudio(
      'analyzer',
      recommendation.tool,
      {
        route: recommendation.route,
        mode: recommendation.mode,
        settings: recommendation.settings,
        aiPrompt: recommendation.aiPrompt
      },
      'pattern'
    );

    console.log(`🎯 Routing to ${recommendation.tool} at ${recommendation.route} in ${recommendation.mode} mode`);
    
    // Return the route for navigation
    return recommendation.route;
  }
}

// Create singleton instance
export const audioAnalyzer = new AudioAnalyzer();
export default audioAnalyzer;