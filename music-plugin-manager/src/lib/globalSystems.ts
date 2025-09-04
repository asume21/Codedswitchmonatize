import { realisticAudio } from './realisticAudio';

// Global AI System
export class GlobalAISystem {
  private static instance: GlobalAISystem;
  private apiKey: string = '';
  private isInitialized = false;

  static getInstance(): GlobalAISystem {
    if (!GlobalAISystem.instance) {
      GlobalAISystem.instance = new GlobalAISystem();
    }
    return GlobalAISystem.instance;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🤖 Initializing Global AI System...');
    this.isInitialized = true;
    console.log('✅ Global AI System ready - available to all plugins');
  }

  // AI assistance for any plugin
  async getContextualHelp(pluginName: string, context: any): Promise<string> {
    try {
      const response = await fetch('/api/ai/contextual-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pluginName, context })
      });
      
      const data = await response.json();
      return data.help || 'AI assistance temporarily unavailable';
    } catch (error) {
      console.error('AI help error:', error);
      return 'AI assistance temporarily unavailable';
    }
  }

  // AI suggestions for any plugin
  async getSuggestions(pluginName: string, data: any): Promise<any[]> {
    try {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pluginName, data })
      });
      
      const result = await response.json();
      return result.suggestions || [];
    } catch (error) {
      console.error('AI suggestions error:', error);
      return [];
    }
  }

  // AI analysis for any content
  async analyzeContent(type: string, content: any): Promise<any> {
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, content })
      });
      
      return await response.json();
    } catch (error) {
      console.error('AI analysis error:', error);
      return { error: 'Analysis failed' };
    }
  }
}

// Global MIDI System
export class GlobalMIDISystem {
  private static instance: GlobalMIDISystem;
  private midiAccess: any = null;
  private isInitialized = false;
  private listeners: Map<string, Function[]> = new Map();

  static getInstance(): GlobalMIDISystem {
    if (!GlobalMIDISystem.instance) {
      GlobalMIDISystem.instance = new GlobalMIDISystem();
    }
    return GlobalMIDISystem.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🎹 Initializing Global MIDI System...');
      
      if (navigator.requestMIDIAccess) {
        this.midiAccess = await navigator.requestMIDIAccess();
        this.setupMIDIListeners();
        this.isInitialized = true;
        console.log('✅ Global MIDI System ready - available to all plugins');
      } else {
        console.warn('⚠️ MIDI not supported in this browser');
      }
    } catch (error) {
      console.error('MIDI initialization failed:', error);
    }
  }

  private setupMIDIListeners() {
    if (!this.midiAccess) return;

    // Listen to all MIDI inputs
    for (const input of this.midiAccess.inputs.values()) {
      input.onmidimessage = (event: any) => {
        this.broadcastMIDIMessage(event.data);
      };
    }
  }

  private broadcastMIDIMessage(data: Uint8Array) {
    const [status, note, velocity] = Array.from(data);
    const messageType = status & 0xF0;
    
    // Broadcast to all registered listeners
    this.listeners.forEach((callbacks) => {
      callbacks.forEach(callback => {
        callback({ messageType, note, velocity, raw: data });
      });
    });
  }

  // Register plugin for MIDI events
  registerPlugin(pluginId: string, callback: Function) {
    if (!this.listeners.has(pluginId)) {
      this.listeners.set(pluginId, []);
    }
    this.listeners.get(pluginId)!.push(callback);
  }

  // Unregister plugin
  unregisterPlugin(pluginId: string) {
    this.listeners.delete(pluginId);
  }

  // Send MIDI output
  sendMIDI(outputId: string, data: number[]) {
    if (!this.midiAccess) return;
    
    const output = this.midiAccess.outputs.get(outputId);
    if (output) {
      output.send(data);
    }
  }

  // Get available MIDI devices
  getDevices() {
    if (!this.midiAccess) return { inputs: [], outputs: [] };
    
    return {
      inputs: Array.from(this.midiAccess.inputs.values()),
      outputs: Array.from(this.midiAccess.outputs.values())
    };
  }
}

// Global Audio System (wrapper around existing realisticAudio)
export class GlobalAudioSystem {
  private static instance: GlobalAudioSystem;

  static getInstance(): GlobalAudioSystem {
    if (!GlobalAudioSystem.instance) {
      GlobalAudioSystem.instance = new GlobalAudioSystem();
    }
    return GlobalAudioSystem.instance;
  }

  async initialize() {
    console.log('🎵 Initializing Global Audio System...');
    await realisticAudio.initialize();
    console.log('✅ Global Audio System ready - available to all plugins');
  }

  // Expose audio methods to all plugins
  async playNote(note: string, octave: number, duration: number, instrument: string, velocity: number = 0.8) {
    return realisticAudio.playNote(note, octave, duration, instrument, velocity);
  }

  async playDrumSound(drumType: string, velocity: number = 0.8) {
    return realisticAudio.playDrumSound(drumType, velocity);
  }

  stopAllSounds() {
    realisticAudio.stopAllSounds();
  }

  setMasterVolume(volume: number) {
    realisticAudio.setMasterVolume(volume);
  }

  getAvailableInstruments() {
    return realisticAudio.getAvailableInstruments();
  }

  isReady() {
    return realisticAudio.isReady();
  }
}

// Plugin Registry System
export class PluginRegistry {
  private static instance: PluginRegistry;
  private plugins: Map<string, any> = new Map();
  private activePlugins: Set<string> = new Set();

  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  // Register a plugin
  registerPlugin(id: string, plugin: any) {
    this.plugins.set(id, plugin);
    console.log(`🔌 Plugin registered: ${id}`);
  }

  // Activate a plugin
  activatePlugin(id: string) {
    if (this.plugins.has(id)) {
      this.activePlugins.add(id);
      console.log(`✅ Plugin activated: ${id}`);
      return true;
    }
    return false;
  }

  // Deactivate a plugin
  deactivatePlugin(id: string) {
    this.activePlugins.delete(id);
    console.log(`❌ Plugin deactivated: ${id}`);
  }

  // Get active plugins
  getActivePlugins() {
    return Array.from(this.activePlugins);
  }

  // Get all registered plugins
  getAllPlugins() {
    return Array.from(this.plugins.keys());
  }

  // Check if plugin is active
  isPluginActive(id: string) {
    return this.activePlugins.has(id);
  }
}

// Global Systems Manager
export class GlobalSystemsManager {
  private static instance: GlobalSystemsManager;
  private ai: GlobalAISystem;
  private midi: GlobalMIDISystem;
  private audio: GlobalAudioSystem;
  private registry: PluginRegistry;

  constructor() {
    this.ai = GlobalAISystem.getInstance();
    this.midi = GlobalMIDISystem.getInstance();
    this.audio = GlobalAudioSystem.getInstance();
    this.registry = PluginRegistry.getInstance();
  }

  static getInstance(): GlobalSystemsManager {
    if (!GlobalSystemsManager.instance) {
      GlobalSystemsManager.instance = new GlobalSystemsManager();
    }
    return GlobalSystemsManager.instance;
  }

  async initialize() {
    console.log('🌐 Initializing Global Systems Manager...');
    
    await Promise.all([
      this.ai.initialize(),
      this.midi.initialize(),
      this.audio.initialize()
    ]);

    console.log('✅ All Global Systems initialized and ready');
  }

  // Expose systems to plugins
  getAI() { return this.ai; }
  getMIDI() { return this.midi; }
  getAudio() { return this.audio; }
  getRegistry() { return this.registry; }
}

// Export singleton instances
export const globalSystems = GlobalSystemsManager.getInstance();
export const globalAI = GlobalAISystem.getInstance();
export const globalMIDI = GlobalMIDISystem.getInstance();
export const globalAudio = GlobalAudioSystem.getInstance();
export const pluginRegistry = PluginRegistry.getInstance();
