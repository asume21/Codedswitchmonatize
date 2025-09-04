/**
 * Professional Audio Engine - World-class audio processing for CodedSwitch
 * Features: Real-time effects, professional mixing console, advanced routing
 */

export interface AudioEffect {
  id: string;
  name: string;
  type: 'compressor' | 'eq' | 'reverb' | 'delay' | 'chorus' | 'filter' | 'distortion' | 'limiter';
  bypass: boolean;
  parameters: { [key: string]: number };
}

export interface MixerChannel {
  id: string;
  name: string;
  input: GainNode;
  output: GainNode;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  eq: {
    lowShelf: BiquadFilterNode;
    lowMid: BiquadFilterNode;
    highMid: BiquadFilterNode;
    highShelf: BiquadFilterNode;
  };
  compressor: DynamicsCompressorNode;
  effects: AudioEffect[];
  sends: { [sendId: string]: GainNode };
  analyzer: AnalyserNode;
  peakMeter: number;
  rmsLevel: number;
}

export interface SendReturn {
  id: string;
  name: string;
  input: GainNode;
  output: GainNode;
  effect: AudioEffect | null;
  wetLevel: number;
  return: number;
}

export class ProfessionalAudioEngine {
  private audioContext: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterAnalyzer: AnalyserNode | null = null;
  
  private channels: Map<string, MixerChannel> = new Map();
  private sendReturns: Map<string, SendReturn> = new Map();
  
  private isInitialized = false;
  private sampleRate = 44100;
  private bufferSize = 256;
  
  // Professional reverb impulse responses
  private reverbBuffers: Map<string, AudioBuffer> = new Map();
  private convolutionNodes: Map<string, ConvolverNode> = new Map();
  
  // Spectrum analysis
  private spectrumAnalyzer: AnalyserNode | null = null;
  private spectrumData: Uint8Array | null = null;
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sampleRate = this.audioContext.sampleRate;
      
      console.log('🎛️ Professional Audio Engine - Initializing');
      console.log(`   Sample Rate: ${this.sampleRate}Hz`);
      console.log(`   Buffer Size: ${this.bufferSize}`);
      
      // Handle suspended context
      if (this.audioContext.state === 'suspended') {
        await this.resumeAudioContext();
      }
      
      // Create master bus chain
      await this.createMasterBus();
      
      // Create default send returns
      await this.createDefaultSends();
      
      // Generate reverb impulse responses
      await this.generateReverbImpulses();
      
      // Initialize spectrum analyzer
      this.initializeSpectrumAnalyzer();
      
      this.isInitialized = true;
      console.log('🎛️ Professional Audio Engine - Ready');
      
    } catch (error) {
      console.error('Failed to initialize Professional Audio Engine:', error);
      throw error;
    }
  }
  
  private async resumeAudioContext(): Promise<void> {
    if (!this.audioContext) return;
    
    const resumeAudio = async () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          console.log('🎛️ Audio context resumed');
        } catch (error) {
          console.error('Failed to resume audio context:', error);
        }
      }
      document.removeEventListener('click', resumeAudio, true);
      document.removeEventListener('keydown', resumeAudio, true);
    };
    
    document.addEventListener('click', resumeAudio, true);
    document.addEventListener('keydown', resumeAudio, true);
    
    try {
      await this.audioContext.resume();
    } catch (error) {
      console.log('Audio context needs user interaction');
    }
  }
  
  private async createMasterBus(): Promise<void> {
    if (!this.audioContext) return;
    
    // Master gain
    this.masterBus = this.audioContext.createGain();
    this.masterBus.gain.value = 0.8;
    
    // Master compressor (gentle program compression)
    this.masterCompressor = this.audioContext.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -18; // dB
    this.masterCompressor.knee.value = 12; // Soft knee
    this.masterCompressor.ratio.value = 3; // 3:1 ratio
    this.masterCompressor.attack.value = 0.008; // 8ms attack
    this.masterCompressor.release.value = 0.2; // 200ms release
    
    // Master limiter (brick wall limiting)
    this.masterLimiter = this.audioContext.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -1; // -1dB ceiling
    this.masterLimiter.knee.value = 0; // Hard knee
    this.masterLimiter.ratio.value = 20; // Hard limiting
    this.masterLimiter.attack.value = 0.001; // 1ms attack
    this.masterLimiter.release.value = 0.05; // 50ms release
    
    // Master analyzer
    this.masterAnalyzer = this.audioContext.createAnalyser();
    this.masterAnalyzer.fftSize = 2048;
    this.masterAnalyzer.smoothingTimeConstant = 0.8;
    
    // Chain: masterBus -> compressor -> limiter -> analyzer -> destination
    this.masterBus.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyzer);
    this.masterAnalyzer.connect(this.audioContext.destination);
    
    console.log('🎛️ Master bus created with professional processing chain');
  }
  
  private async createDefaultSends(): Promise<void> {
    if (!this.audioContext) return;
    
    // Send 1: Hall Reverb
    const hallSend = await this.createSendReturn('hall', 'Hall Reverb', 'reverb');
    this.sendReturns.set('hall', hallSend);
    
    // Send 2: Delay
    const delaySend = await this.createSendReturn('delay', 'Stereo Delay', 'delay');  
    this.sendReturns.set('delay', delaySend);
    
    // Send 3: Chorus
    const chorusSend = await this.createSendReturn('chorus', 'Vintage Chorus', 'chorus');
    this.sendReturns.set('chorus', chorusSend);
    
    console.log('🎛️ Default send returns created');
  }
  
  private async createSendReturn(id: string, name: string, effectType: string): Promise<SendReturn> {
    if (!this.audioContext || !this.masterBus) throw new Error('Audio context not initialized');
    
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();
    const effect = await this.createEffect(effectType);
    
    // Connect send return chain
    input.connect(effect.node);
    effect.node.connect(output);
    output.connect(this.masterBus);
    
    return {
      id,
      name,
      input,
      output,
      effect: effect.effect,
      wetLevel: 0.5,
      return: 0.8
    };
  }
  
  private async createEffect(type: string): Promise<{ node: AudioNode; effect: AudioEffect }> {
    if (!this.audioContext) throw new Error('Audio context not initialized');
    
    let node: AudioNode;
    let effect: AudioEffect;
    
    switch (type) {
      case 'reverb':
        node = await this.createHallReverb();
        effect = {
          id: 'hall_reverb',
          name: 'Hall Reverb',
          type: 'reverb',
          bypass: false,
          parameters: {
            roomSize: 0.7,
            decay: 3.5,
            damping: 0.3,
            predelay: 0.02,
            wetLevel: 0.4
          }
        };
        break;
        
      case 'delay':
        node = this.createStereoDelay();
        effect = {
          id: 'stereo_delay',
          name: 'Stereo Delay',
          type: 'delay',
          bypass: false,
          parameters: {
            time: 0.25,
            feedback: 0.35,
            highCut: 8000,
            lowCut: 200,
            wetLevel: 0.3
          }
        };
        break;
        
      case 'chorus':
        node = this.createVintageChorus();
        effect = {
          id: 'vintage_chorus',
          name: 'Vintage Chorus',
          type: 'chorus',
          bypass: false,
          parameters: {
            rate: 0.8,
            depth: 0.4,
            feedback: 0.1,
            mix: 0.5
          }
        };
        break;
        
      default:
        node = this.audioContext.createGain();
        effect = {
          id: 'bypass',
          name: 'Bypass',
          type: 'filter',
          bypass: true,
          parameters: {}
        };
    }
    
    return { node, effect };
  }
  
  private async createHallReverb(): Promise<ConvolverNode> {
    if (!this.audioContext) throw new Error('Audio context not initialized');
    
    const convolver = this.audioContext.createConvolver();
    
    // Generate hall impulse response if not cached
    if (!this.reverbBuffers.has('hall')) {
      const impulse = this.generateHallImpulse(3.5, 0.3); // 3.5s decay, 0.3 damping
      this.reverbBuffers.set('hall', impulse);
    }
    
    convolver.buffer = this.reverbBuffers.get('hall')!;
    this.convolutionNodes.set('hall', convolver);
    
    return convolver;
  }
  
  private createStereoDelay(): AudioNode {
    if (!this.audioContext) throw new Error('Audio context not initialized');
    
    // Create stereo delay with feedback and filtering
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();
    
    const leftDelay = this.audioContext.createDelay(1.0);
    const rightDelay = this.audioContext.createDelay(1.0);
    
    const leftFeedback = this.audioContext.createGain();
    const rightFeedback = this.audioContext.createGain();
    
    const highCut = this.audioContext.createBiquadFilter();
    const lowCut = this.audioContext.createBiquadFilter();
    
    // Configure delays
    leftDelay.delayTime.value = 0.25; // 250ms
    rightDelay.delayTime.value = 0.375; // 375ms (different timing for stereo width)
    
    leftFeedback.gain.value = 0.35;
    rightFeedback.gain.value = 0.35;
    
    // Configure filters
    highCut.type = 'lowpass';
    highCut.frequency.value = 8000;
    highCut.Q.value = 0.707;
    
    lowCut.type = 'highpass';
    lowCut.frequency.value = 200;
    lowCut.Q.value = 0.707;
    
    // Connect delay network
    input.connect(leftDelay);
    input.connect(rightDelay);
    
    leftDelay.connect(lowCut);
    lowCut.connect(highCut);
    highCut.connect(leftFeedback);
    leftFeedback.connect(leftDelay);
    
    rightDelay.connect(lowCut);
    rightFeedback.connect(rightDelay);
    
    leftDelay.connect(output);
    rightDelay.connect(output);
    
    // Return the input node for connections
    (input as any).delayOutput = output;
    return input;
  }
  
  private createVintageChorus(): AudioNode {
    if (!this.audioContext) throw new Error('Audio context not initialized');
    
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();
    const wet = this.audioContext.createGain();
    const dry = this.audioContext.createGain();
    
    const delay = this.audioContext.createDelay(0.05);
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();
    const feedback = this.audioContext.createGain();
    
    // Configure LFO for chorus modulation
    lfo.type = 'sine';
    lfo.frequency.value = 0.8; // 0.8 Hz modulation rate
    
    lfoGain.gain.value = 0.005; // 5ms modulation depth
    delay.delayTime.value = 0.02; // 20ms base delay
    
    feedback.gain.value = 0.1; // Light feedback
    wet.gain.value = 0.5; // 50% wet
    dry.gain.value = 0.5; // 50% dry
    
    // Connect chorus network
    input.connect(dry);
    input.connect(delay);
    
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    
    delay.connect(wet);
    delay.connect(feedback);
    feedback.connect(delay);
    
    dry.connect(output);
    wet.connect(output);
    
    lfo.start();
    
    return input;
  }
  
  private generateHallImpulse(decay: number, damping: number): AudioBuffer {
    if (!this.audioContext) throw new Error('Audio context not initialized');
    
    const length = this.sampleRate * decay;
    const impulse = this.audioContext.createBuffer(2, length, this.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      
      for (let i = 0; i < length; i++) {
        const t = i / this.sampleRate;
        const envelope = Math.exp(-t * (5 / decay));
        const dampingFactor = 1 - (t / decay) * damping;
        
        // Create complex reflection pattern
        let sample = 0;
        sample += (Math.random() * 2 - 1) * envelope * dampingFactor;
        sample += Math.sin(t * 440 * Math.PI * 2) * envelope * 0.1; // Early reflections
        sample += Math.sin(t * 660 * Math.PI * 2) * envelope * 0.05;
        
        channelData[i] = sample;
      }
    }
    
    return impulse;
  }
  
  private async generateReverbImpulses(): Promise<void> {
    // Generate different room types
    const rooms = [
      { name: 'hall', decay: 3.5, damping: 0.3 },
      { name: 'room', decay: 1.2, damping: 0.5 },
      { name: 'plate', decay: 2.8, damping: 0.1 },
      { name: 'spring', decay: 0.8, damping: 0.7 }
    ];
    
    for (const room of rooms) {
      const impulse = this.generateHallImpulse(room.decay, room.damping);
      this.reverbBuffers.set(room.name, impulse);
    }
    
    console.log('🎛️ Reverb impulses generated for all room types');
  }
  
  private initializeSpectrumAnalyzer(): void {
    if (!this.audioContext || !this.masterAnalyzer) return;
    
    this.spectrumAnalyzer = this.masterAnalyzer;
    this.spectrumData = new Uint8Array(this.spectrumAnalyzer.frequencyBinCount);
    
    console.log('🎛️ Spectrum analyzer initialized');
  }
  
  // Public API Methods
  
  createMixerChannel(id: string, name: string): MixerChannel {
    if (!this.audioContext || !this.masterBus) throw new Error('Audio engine not initialized');
    
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();
    const panNode = this.audioContext.createStereoPanner();
    
    // Create 4-band parametric EQ
    const lowShelf = this.audioContext.createBiquadFilter();
    const lowMid = this.audioContext.createBiquadFilter();
    const highMid = this.audioContext.createBiquadFilter();
    const highShelf = this.audioContext.createBiquadFilter();
    
    // Configure EQ bands
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 100;
    lowShelf.gain.value = 0;
    
    lowMid.type = 'peaking';
    lowMid.frequency.value = 400;
    lowMid.Q.value = 1.0;
    lowMid.gain.value = 0;
    
    highMid.type = 'peaking';
    highMid.frequency.value = 2500;
    highMid.Q.value = 1.0;
    highMid.gain.value = 0;
    
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 8000;
    highShelf.gain.value = 0;
    
    // Create compressor
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 6;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.25;
    
    // Create analyzer for metering
    const analyzer = this.audioContext.createAnalyser();
    analyzer.fftSize = 256;
    analyzer.smoothingTimeConstant = 0.3;
    
    // Create sends
    const sends: { [sendId: string]: GainNode } = {};
    Array.from(this.sendReturns.keys()).forEach(sendId => {
      const sendGain = this.audioContext!.createGain();
      sendGain.gain.value = 0;
      sends[sendId] = sendGain;
      
      // Connect to send
      output.connect(sendGain);
      sendGain.connect(this.sendReturns.get(sendId)!.input);
    });
    
    // Connect signal chain: input -> EQ -> compressor -> pan -> output -> analyzer -> master
    input.connect(lowShelf);
    lowShelf.connect(lowMid);
    lowMid.connect(highMid);
    highMid.connect(highShelf);
    highShelf.connect(compressor);
    compressor.connect(panNode);
    panNode.connect(output);
    output.connect(analyzer);
    analyzer.connect(this.masterBus);
    
    const channel: MixerChannel = {
      id,
      name,
      input,
      output,
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      eq: {
        lowShelf,
        lowMid,
        highMid,
        highShelf
      },
      compressor,
      effects: [],
      sends,
      analyzer,
      peakMeter: 0,
      rmsLevel: 0
    };
    
    this.channels.set(id, channel);
    console.log(`🎛️ Mixer channel created: ${name}`);
    
    return channel;
  }
  
  setChannelVolume(channelId: string, volume: number): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    channel.volume = Math.max(0, Math.min(1, volume));
    channel.output.gain.value = channel.volume;
  }
  
  setChannelPan(channelId: string, pan: number): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    channel.pan = Math.max(-1, Math.min(1, pan));
    // Pan is handled by the StereoPannerNode in the signal chain
  }
  
  setChannelEQ(channelId: string, band: 'low' | 'lowMid' | 'highMid' | 'high', gain: number): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    const gainValue = Math.max(-15, Math.min(15, gain)); // ±15dB range
    
    switch (band) {
      case 'low':
        channel.eq.lowShelf.gain.value = gainValue;
        break;
      case 'lowMid':
        channel.eq.lowMid.gain.value = gainValue;
        break;
      case 'highMid':
        channel.eq.highMid.gain.value = gainValue;
        break;
      case 'high':
        channel.eq.highShelf.gain.value = gainValue;
        break;
    }
  }
  
  setSendLevel(channelId: string, sendId: string, level: number): void {
    const channel = this.channels.get(channelId);
    const send = channel?.sends[sendId];
    if (!send) return;
    
    send.gain.value = Math.max(0, Math.min(1, level));
  }
  
  muteChannel(channelId: string, muted: boolean): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    channel.muted = muted;
    channel.output.gain.value = muted ? 0 : channel.volume;
  }
  
  soloChannel(channelId: string, solo: boolean): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    channel.solo = solo;
    
    // Handle solo logic
    const soloedChannels = Array.from(this.channels.values()).filter(ch => ch.solo);
    
    Array.from(this.channels.values()).forEach(ch => {
      if (soloedChannels.length === 0) {
        // No solo, restore normal volume
        ch.output.gain.value = ch.muted ? 0 : ch.volume;
      } else {
        // Solo active, mute non-soloed channels
        ch.output.gain.value = (ch.solo && !ch.muted) ? ch.volume : 0;
      }
    });
  }
  
  getChannelMeters(channelId: string): { peak: number; rms: number } {
    const channel = this.channels.get(channelId);
    if (!channel) return { peak: 0, rms: 0 };
    
    const dataArray = new Uint8Array(channel.analyzer.frequencyBinCount);
    channel.analyzer.getByteFrequencyData(dataArray);
    
    // Calculate peak and RMS levels
    let peak = 0;
    let rms = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i] / 255;
      peak = Math.max(peak, value);
      rms += value * value;
    }
    
    rms = Math.sqrt(rms / dataArray.length);
    
    channel.peakMeter = peak;
    channel.rmsLevel = rms;
    
    return { peak, rms };
  }
  
  getMasterSpectrum(): Uint8Array | null {
    if (!this.spectrumAnalyzer || !this.spectrumData) return null;
    
    // Create a new Uint8Array with proper ArrayBuffer type
    const data = new Uint8Array(this.spectrumData.length);
    this.spectrumAnalyzer.getByteFrequencyData(data);
    return data;
  }
  
  getChannels(): MixerChannel[] {
    return Array.from(this.channels.values());
  }
  
  getSendReturns(): SendReturn[] {
    return Array.from(this.sendReturns.values());
  }
  
  // Connect external audio source to a channel
  connectToChannel(channelId: string, source: AudioNode): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    source.connect(channel.input);
  }
  
  disconnect(): void {
    // Disconnect all channels and clean up
    Array.from(this.channels.values()).forEach(channel => {
      try {
        channel.input.disconnect();
        channel.output.disconnect();
      } catch (e) {
        // Node may already be disconnected
      }
    });
    
    this.channels.clear();
    this.sendReturns.clear();
    
    if (this.masterBus) {
      this.masterBus.disconnect();
    }
    
    console.log('🎛️ Professional Audio Engine disconnected');
  }
}

// Global instance
export const professionalAudio = new ProfessionalAudioEngine();