/**
 * Centralized Audio Routing System
 * Manages audio flow between different studio components
 * Allows sharing of beats, melodies, and tracks between editors
 */

export interface AudioRoute {
  id: string;
  source: string; // Component that created the audio
  destination: string; // Component that receives the audio
  data: any; // The actual audio data (pattern, notes, audio URL, etc.)
  type: 'beat' | 'melody' | 'track' | 'audio_file' | 'pattern';
  metadata: {
    bpm?: number;
    key?: string;
    duration?: number;
    instrument?: string;
    created?: Date;
  };
}

export interface AudioBus {
  id: string;
  name: string;
  volume: number; // 0-100
  pan: number; // -100 to 100
  mute: boolean;
  solo: boolean;
  effects: {
    reverb: number;
    delay: number;
    distortion: number;
    compression: number;
  };
  sends: { [busId: string]: number }; // Send levels to other buses
  inputs: string[]; // IDs of components sending to this bus
}

export interface TrackData {
  id: string;
  name: string;
  type: 'beat' | 'melody' | 'bass' | 'harmony' | 'drums' | 'vocal';
  instrument: string;
  notes?: any[]; // Note data for melodic tracks
  pattern?: any; // Pattern data for beats
  audioUrl?: string; // For rendered audio files
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  bus: string; // Which bus this track routes to
}

class AudioRouter {
  private routes: Map<string, AudioRoute> = new Map();
  private buses: Map<string, AudioBus> = new Map();
  private tracks: Map<string, TrackData> = new Map();
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  
  // Master bus
  private masterBus: AudioBus = {
    id: 'master',
    name: 'Master',
    volume: 75,
    pan: 0,
    mute: false,
    solo: false,
    effects: {
      reverb: 0,
      delay: 0,
      distortion: 0,
      compression: 30
    },
    sends: {},
    inputs: []
  };

  constructor() {
    this.buses.set('master', this.masterBus);
    // Create default buses
    this.createDefaultBuses();
  }

  private createDefaultBuses() {
    // Drums bus
    this.buses.set('drums', {
      id: 'drums',
      name: 'Drums',
      volume: 85,
      pan: 0,
      mute: false,
      solo: false,
      effects: {
        reverb: 10,
        delay: 0,
        distortion: 0,
        compression: 50
      },
      sends: { master: 100 },
      inputs: []
    });

    // Bass bus
    this.buses.set('bass', {
      id: 'bass',
      name: 'Bass',
      volume: 80,
      pan: 0,
      mute: false,
      solo: false,
      effects: {
        reverb: 5,
        delay: 0,
        distortion: 10,
        compression: 40
      },
      sends: { master: 100 },
      inputs: []
    });

    // Melody bus
    this.buses.set('melody', {
      id: 'melody',
      name: 'Melody',
      volume: 75,
      pan: 0,
      mute: false,
      solo: false,
      effects: {
        reverb: 25,
        delay: 15,
        distortion: 0,
        compression: 20
      },
      sends: { master: 100 },
      inputs: []
    });

    // Effects bus (for reverb sends, etc.)
    this.buses.set('effects', {
      id: 'effects',
      name: 'Effects',
      volume: 50,
      pan: 0,
      mute: false,
      solo: false,
      effects: {
        reverb: 80,
        delay: 40,
        distortion: 0,
        compression: 0
      },
      sends: { master: 100 },
      inputs: []
    });
  }

  /**
   * Route audio from one component to another
   */
  routeAudio(source: string, destination: string, data: any, type: AudioRoute['type'], metadata?: AudioRoute['metadata']) {
    const routeId = `${source}->${destination}`;
    const route: AudioRoute = {
      id: routeId,
      source,
      destination,
      data,
      type,
      metadata: {
        ...metadata,
        created: new Date()
      }
    };

    this.routes.set(routeId, route);

    // Notify destination component
    this.notifySubscribers(destination, route);

    console.log(`🎵 Audio routed from ${source} to ${destination}`, route);
    return route;
  }

  /**
   * Get routed audio for a specific component
   */
  getRoutedAudio(destination: string): AudioRoute[] {
    const routes: AudioRoute[] = [];
    this.routes.forEach(route => {
      if (route.destination === destination) {
        routes.push(route);
      }
    });
    return routes;
  }

  /**
   * Subscribe to audio routes for a component
   */
  subscribe(componentId: string, callback: (data: any) => void) {
    if (!this.subscribers.has(componentId)) {
      this.subscribers.set(componentId, new Set());
    }
    this.subscribers.get(componentId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(componentId)?.delete(callback);
    };
  }

  private notifySubscribers(componentId: string, data: any) {
    this.subscribers.get(componentId)?.forEach(callback => {
      callback(data);
    });
  }

  /**
   * Add a track to the routing system
   */
  addTrack(track: TrackData) {
    this.tracks.set(track.id, track);
    
    // Add to appropriate bus inputs
    const bus = this.buses.get(track.bus);
    if (bus && !bus.inputs.includes(track.id)) {
      bus.inputs.push(track.id);
    }

    console.log(`🎵 Track added to router: ${track.name} (${track.type})`);
    return track;
  }

  /**
   * Get all tracks
   */
  getTracks(): TrackData[] {
    return Array.from(this.tracks.values());
  }

  /**
   * Get tracks by type
   */
  getTracksByType(type: TrackData['type']): TrackData[] {
    return Array.from(this.tracks.values()).filter(track => track.type === type);
  }

  /**
   * Update track routing
   */
  updateTrackRouting(trackId: string, newBusId: string) {
    const track = this.tracks.get(trackId);
    if (!track) return;

    // Remove from old bus
    const oldBus = this.buses.get(track.bus);
    if (oldBus) {
      oldBus.inputs = oldBus.inputs.filter(id => id !== trackId);
    }

    // Add to new bus
    track.bus = newBusId;
    const newBus = this.buses.get(newBusId);
    if (newBus && !newBus.inputs.includes(trackId)) {
      newBus.inputs.push(trackId);
    }

    console.log(`🎵 Track ${track.name} routed to bus ${newBusId}`);
  }

  /**
   * Get a bus by ID
   */
  getBus(busId: string): AudioBus | undefined {
    return this.buses.get(busId);
  }

  /**
   * Get all buses
   */
  getBuses(): AudioBus[] {
    return Array.from(this.buses.values());
  }

  /**
   * Update bus parameters
   */
  updateBus(busId: string, updates: Partial<AudioBus>) {
    const bus = this.buses.get(busId);
    if (bus) {
      Object.assign(bus, updates);
      console.log(`🎵 Bus ${busId} updated`, updates);
    }
  }

  /**
   * Export audio from a component
   */
  exportAudio(componentId: string, data: any, type: AudioRoute['type'], metadata?: any) {
    const exportData = {
      source: componentId,
      data,
      type,
      metadata: {
        ...metadata,
        exported: new Date()
      }
    };

    // Store in a temporary export buffer
    localStorage.setItem(`audio_export_${componentId}`, JSON.stringify(exportData));
    
    console.log(`🎵 Audio exported from ${componentId}`, exportData);
    return exportData;
  }

  /**
   * Import audio into a component
   */
  importAudio(componentId: string): any {
    // Check for any available exports
    const keys = Object.keys(localStorage).filter(key => key.startsWith('audio_export_'));
    const imports = keys.map(key => {
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    }).filter(Boolean);

    console.log(`🎵 Available audio imports for ${componentId}:`, imports);
    return imports;
  }

  /**
   * Mix multiple tracks through the bus system
   */
  async mixTracks(trackIds: string[], outputBusId: string = 'master'): Promise<any> {
    const tracks = trackIds.map(id => this.tracks.get(id)).filter(Boolean) as TrackData[];
    
    if (tracks.length === 0) {
      console.warn('No valid tracks to mix');
      return null;
    }

    // Calculate final mix based on volumes, pans, and bus routing
    const mixData = {
      tracks: tracks.map(track => ({
        ...track,
        finalVolume: this.calculateFinalVolume(track),
        finalPan: this.calculateFinalPan(track)
      })),
      masterBus: this.buses.get(outputBusId),
      timestamp: new Date()
    };

    console.log(`🎵 Mixed ${tracks.length} tracks through bus ${outputBusId}`, mixData);
    return mixData;
  }

  private calculateFinalVolume(track: TrackData): number {
    if (track.muted) return 0;

    const bus = this.buses.get(track.bus);
    if (!bus || bus.mute) return 0;

    // Calculate with bus volume
    let finalVolume = (track.volume / 100) * (bus.volume / 100);

    // Apply master bus volume if not already master
    if (track.bus !== 'master') {
      finalVolume *= (this.masterBus.volume / 100);
    }

    // Handle solo
    const hasSoloTracks = Array.from(this.tracks.values()).some(t => t.solo);
    if (hasSoloTracks && !track.solo) {
      return 0;
    }

    return finalVolume * 100; // Return as percentage
  }

  private calculateFinalPan(track: TrackData): number {
    const bus = this.buses.get(track.bus);
    if (!bus) return track.pan;

    // Combine track pan with bus pan
    const combinedPan = track.pan + bus.pan;
    return Math.max(-100, Math.min(100, combinedPan));
  }

  /**
   * Clear all routes
   */
  clearRoutes() {
    this.routes.clear();
    console.log('🎵 All audio routes cleared');
  }

  /**
   * Get routing diagram for visualization
   */
  getRoutingDiagram() {
    return {
      tracks: Array.from(this.tracks.values()),
      buses: Array.from(this.buses.values()),
      routes: Array.from(this.routes.values()),
      connections: this.getConnections()
    };
  }

  private getConnections() {
    const connections: any[] = [];

    // Track to bus connections
    this.tracks.forEach(track => {
      connections.push({
        from: track.id,
        to: track.bus,
        type: 'track-to-bus'
      });
    });

    // Bus to bus connections (sends)
    this.buses.forEach(bus => {
      Object.entries(bus.sends).forEach(([targetBusId, level]) => {
        if (level > 0) {
          connections.push({
            from: bus.id,
            to: targetBusId,
            type: 'bus-to-bus',
            level
          });
        }
      });
    });

    return connections;
  }
}

// Create singleton instance
export const audioRouter = new AudioRouter();

// Export router as default
export default audioRouter;