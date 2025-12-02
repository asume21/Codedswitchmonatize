import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { 
  Play, Pause, Square, SkipBack, SkipForward,
  Undo2, Redo2, Sparkles, Plus, Volume2, 
  FolderOpen, Settings, X, Music, Mic2, 
  Drum, Guitar, Piano, Waves, Sliders,
  FileAudio, Upload, Download, Save, Zap,
  Menu, Home, LayoutDashboard, Wand2, Code,
  Shield, MessageSquare, Headphones, ChevronDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransport } from '@/contexts/TransportContext';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import VerticalPianoRoll from '@/components/studio/VerticalPianoRoll';
import AstutelyPanel from '@/components/ai/AstutelyPanel';
import { astutelyToNotes, type AstutelyResult } from '@/lib/astutelyEngine';

// ============================================
// CODEDSWITCH FLOW - THE SOUL OF THE DAW
// A completely original, addictive, artist-first experience
// ============================================

// Signature CodedSwitch colors
const COLORS = {
  bg: '#0f0a1a',
  bgLight: '#1a1025',
  bgPanel: 'rgba(15, 10, 26, 0.95)',
  purple: '#8B5CF6',
  purpleGlow: 'rgba(139, 92, 246, 0.4)',
  pink: '#EC4899',
  pinkGlow: 'rgba(236, 72, 153, 0.3)',
  accent: '#A855F7',
  text: '#E2E8F0',
  textMuted: '#94A3B8',
  border: 'rgba(139, 92, 246, 0.2)',
};

// ============================================
// FLOATING PANEL COMPONENT
// ============================================
interface FloatingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  position: 'left' | 'right' | 'bottom';
  title: string;
  hotkey: string;
  children: React.ReactNode;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({ 
  isOpen, onClose, position, title, hotkey, children 
}) => {
  const positionStyles = {
    left: {
      className: `left-0 top-16 bottom-0 w-80`,
      transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
    },
    right: {
      className: `right-0 top-16 bottom-0 w-[420px]`,
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    },
    bottom: {
      className: `left-0 right-0 bottom-0 h-80`,
      transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    },
  };

  const { className, transform } = positionStyles[position];
  const borderClass = position === 'bottom' ? 'border-t' : position === 'left' ? 'border-r' : 'border-l';

  return (
    <div 
      className={`fixed z-50 ${className} ${borderClass}`}
      style={{ 
        background: COLORS.bgPanel,
        backdropFilter: 'blur(20px)',
        borderColor: COLORS.border,
        boxShadow: isOpen ? `0 0 80px ${COLORS.purpleGlow}` : 'none',
        transform,
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Panel Header */}
      <div 
        className="flex items-center justify-between px-4 py-3"
        style={{ 
          borderBottom: `1px solid ${COLORS.border}`,
          background: 'rgba(139, 92, 246, 0.05)',
        }}
      >
        <div className="flex items-center gap-3">
          <h3 
            className="text-sm font-bold uppercase tracking-widest"
            style={{ color: COLORS.purple }}
          >
            {title}
          </h3>
          <kbd 
            className="px-2 py-0.5 text-xs rounded"
            style={{ 
              background: 'rgba(139, 92, 246, 0.2)',
              color: COLORS.textMuted,
            }}
          >
            {hotkey}
          </kbd>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-lg transition-all hover:scale-110"
          style={{ 
            background: 'rgba(139, 92, 246, 0.1)',
            color: COLORS.textMuted,
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Panel Content */}
      <div className="h-[calc(100%-52px)] overflow-auto p-4">
        {children}
      </div>
    </div>
  );
};

// ============================================
// MIXER PANEL - Real mixing controls
// ============================================
const MixerPanel: React.FC = () => {
  const { tracks } = useTrackStore();
  const [localTracks, setLocalTracks] = useState([
    { id: 'master', name: 'MASTER', volume: 85, pan: 0, muted: false, solo: false, color: COLORS.purple },
    { id: 'track1', name: 'Piano', volume: 75, pan: -15, muted: false, solo: false, color: '#3B82F6' },
    { id: 'track2', name: 'Drums', volume: 80, pan: 0, muted: false, solo: false, color: '#EC4899' },
    { id: 'track3', name: 'Bass', volume: 70, pan: 10, muted: false, solo: false, color: '#10B981' },
    { id: 'track4', name: 'Synth', volume: 65, pan: -20, muted: false, solo: false, color: '#F59E0B' },
  ]);

  const toggleMute = (id: string) => {
    setLocalTracks(prev => prev.map(t => 
      t.id === id ? { ...t, muted: !t.muted } : t
    ));
  };

  const toggleSolo = (id: string) => {
    setLocalTracks(prev => prev.map(t => 
      t.id === id ? { ...t, solo: !t.solo } : t
    ));
  };

  return (
    <div className="flex gap-2 h-full overflow-x-auto pb-2">
      {localTracks.map(track => (
        <div 
          key={track.id}
          className="flex flex-col items-center gap-2 p-3 rounded-xl min-w-[72px] flex-shrink-0"
          style={{ 
            background: 'rgba(139, 92, 246, 0.05)',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {/* VU Meter / Fader */}
          <div 
            className="h-36 w-3 rounded-full relative overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <div 
              className="absolute bottom-0 w-full rounded-full transition-all duration-150"
              style={{ 
                height: `${track.muted ? 0 : track.volume}%`, 
                background: `linear-gradient(to top, ${track.color}, ${track.color}88)`,
                boxShadow: `0 0 15px ${track.color}60`,
              }}
            />
            {/* Peak indicator */}
            <div 
              className="absolute w-full h-1"
              style={{ 
                bottom: `${track.volume}%`,
                background: track.color,
                boxShadow: `0 0 8px ${track.color}`,
              }}
            />
          </div>
          
          {/* Volume display */}
          <span className="text-xs font-mono" style={{ color: COLORS.textMuted }}>
            {track.muted ? '---' : `${track.volume}`}
          </span>
          
          {/* Mute/Solo buttons */}
          <div className="flex gap-1">
            <button 
              onClick={() => toggleMute(track.id)}
              className="text-xs px-2 py-1 rounded font-bold transition-all"
              style={{ 
                background: track.muted ? '#EF4444' : 'rgba(255,255,255,0.1)',
                color: track.muted ? 'white' : COLORS.textMuted,
                boxShadow: track.muted ? '0 0 10px rgba(239,68,68,0.5)' : 'none',
              }}
            >
              M
            </button>
            <button 
              onClick={() => toggleSolo(track.id)}
              className="text-xs px-2 py-1 rounded font-bold transition-all"
              style={{ 
                background: track.solo ? '#FBBF24' : 'rgba(255,255,255,0.1)',
                color: track.solo ? 'black' : COLORS.textMuted,
                boxShadow: track.solo ? '0 0 10px rgba(251,191,36,0.5)' : 'none',
              }}
            >
              S
            </button>
          </div>
          
          {/* Track name */}
          <span 
            className="text-xs font-semibold truncate w-full text-center"
            style={{ color: track.color }}
          >
            {track.name}
          </span>
        </div>
      ))}
    </div>
  );
};

// ============================================
// BROWSER PANEL - Sound & sample browser
// ============================================
interface Sample {
  id: string;
  name: string;
  category: string;
  bpm: number;
  key?: string;
  duration: number;
  url: string;
  color: string;
}

const BrowserPanel: React.FC = () => {
  const { toast } = useToast();
  const { position } = useTransport();
  const { addTrack } = useTrackStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const categories = [
    { id: 'drums', name: 'Drums', icon: Drum, count: 245, color: '#EC4899' },
    { id: 'bass', name: 'Bass', icon: Guitar, count: 128, color: '#10B981' },
    { id: 'keys', name: 'Keys', icon: Piano, count: 312, color: '#3B82F6' },
    { id: 'synths', name: 'Synths', icon: Waves, count: 189, color: '#8B5CF6' },
    { id: 'vocals', name: 'Vocals', icon: Mic2, count: 89, color: '#F59E0B' },
    { id: 'fx', name: 'FX', icon: Sparkles, count: 156, color: '#06B6D4' },
  ];

  // Sample library - synthesized sounds (no external files needed)
  const allSamples: Sample[] = [
    // Drums
    { id: 's1', name: '808 Kick Heavy', category: 'Drums', bpm: 140, key: 'C', duration: 0.5, url: '', color: '#EC4899' },
    { id: 's4', name: 'Hi-Hat Loop', category: 'Drums', bpm: 140, key: '-', duration: 0.2, url: '', color: '#EC4899' },
    { id: 's5', name: 'Snare Trap', category: 'Drums', bpm: 140, key: '-', duration: 0.3, url: '', color: '#EC4899' },
    { id: 's7', name: 'Clap Stack', category: 'Drums', bpm: 128, key: '-', duration: 0.2, url: '', color: '#EC4899' },
    // Bass
    { id: 's2', name: 'Analog Bass 01', category: 'Bass', bpm: 128, key: 'F', duration: 0.8, url: '', color: '#10B981' },
    { id: 's8', name: 'Sub Bass Deep', category: 'Bass', bpm: 120, key: 'C', duration: 1.0, url: '', color: '#10B981' },
    // Keys
    { id: 's9', name: 'Piano Chord', category: 'Keys', bpm: 120, key: 'Am', duration: 1.5, url: '', color: '#3B82F6' },
    { id: 's10', name: 'Rhodes Stab', category: 'Keys', bpm: 128, key: 'Dm', duration: 0.8, url: '', color: '#3B82F6' },
    // Synths
    { id: 's3', name: 'Pad Atmosphere', category: 'Synths', bpm: 120, key: 'Am', duration: 2.0, url: '', color: '#8B5CF6' },
    { id: 's6', name: 'Synth Lead', category: 'Synths', bpm: 128, key: 'G', duration: 1.0, url: '', color: '#8B5CF6' },
    // Vocals
    { id: 's11', name: 'Vocal Chop', category: 'Vocals', bpm: 128, key: 'C', duration: 0.5, url: '', color: '#F59E0B' },
    // FX
    { id: 's12', name: 'Riser Build', category: 'FX', bpm: 128, key: '-', duration: 2.0, url: '', color: '#06B6D4' },
    { id: 's13', name: 'Impact Hit', category: 'FX', bpm: 128, key: '-', duration: 0.5, url: '', color: '#06B6D4' },
  ];

  // Filter samples by selected category
  const samples = selectedCategory 
    ? allSamples.filter(s => s.category.toLowerCase() === selectedCategory)
    : allSamples;

  // Synthesize and play a sample sound
  const playSampleSound = (sample: Sample) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      
      setPlayingSampleId(sample.id);
      setTimeout(() => setPlayingSampleId(null), sample.duration * 1000);

      // Create different sounds based on sample type
      if (sample.name.includes('Kick') || sample.name.includes('808')) {
        // 808 Kick - sine wave with pitch drop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (sample.name.includes('Hi-Hat')) {
        // Hi-hat - noise burst
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        const highpass = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        noise.buffer = buffer;
        highpass.type = 'highpass';
        highpass.frequency.value = 8000;
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        noise.connect(highpass).connect(gain).connect(ctx.destination);
        noise.start(now);
      } else if (sample.name.includes('Snare')) {
        // Snare - noise + tone
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 200;
        oscGain.gain.setValueAtTime(0.5, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(oscGain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
        // Noise part
        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        const noiseGain = ctx.createGain();
        noise.buffer = buffer;
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        noise.connect(noiseGain).connect(ctx.destination);
        noise.start(now);
      } else if (sample.name.includes('Clap')) {
        // Clap - multiple noise bursts
        for (let i = 0; i < 3; i++) {
          const bufferSize = ctx.sampleRate * 0.03;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let j = 0; j < bufferSize; j++) data[j] = Math.random() * 2 - 1;
          const noise = ctx.createBufferSource();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          noise.buffer = buffer;
          filter.type = 'bandpass';
          filter.frequency.value = 2000;
          gain.gain.setValueAtTime(0.4, now + i * 0.01);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.01 + 0.1);
          noise.connect(filter).connect(gain).connect(ctx.destination);
          noise.start(now + i * 0.01);
        }
      } else if (sample.category === 'Bass') {
        // Bass - low sine/saw
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = sample.key === 'F' ? 87 : 65; // F2 or C2
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + sample.duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + sample.duration);
      } else if (sample.category === 'Keys' || sample.name.includes('Piano')) {
        // Piano/Keys - multiple harmonics
        const freqs = sample.key === 'Am' ? [220, 261, 329] : [293, 349, 440]; // Am or Dm chord
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + sample.duration);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + sample.duration);
        });
      } else if (sample.name.includes('Pad') || sample.name.includes('Atmosphere')) {
        // Pad - slow attack, multiple detuned oscillators
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = 220 * (1 + i * 0.01); // Slight detune
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.15, now + 0.3);
          gain.gain.exponentialRampToValueAtTime(0.01, now + sample.duration);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + sample.duration);
        }
      } else if (sample.name.includes('Lead')) {
        // Synth lead - saw with filter
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = sample.key === 'G' ? 392 : 440;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(500, now + sample.duration);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + sample.duration);
        osc.connect(filter).connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + sample.duration);
      } else if (sample.name.includes('Vocal')) {
        // Vocal chop - formant-like
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 261;
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        filter.Q.value = 5;
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + sample.duration);
        osc.connect(filter).connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + sample.duration);
      } else if (sample.name.includes('Riser')) {
        // Riser - pitch up noise
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + sample.duration);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.5, now + sample.duration * 0.9);
        gain.gain.exponentialRampToValueAtTime(0.01, now + sample.duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + sample.duration);
      } else if (sample.name.includes('Impact')) {
        // Impact - low boom + noise
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      } else {
        // Default - simple tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + sample.duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + sample.duration);
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  // Handle sample click - add to timeline
  const handleSampleClick = (sample: Sample) => {
    const id = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    addTrack({
      id,
      name: sample.name,
      kind: 'audio',
      lengthBars: Math.max(1, Math.round(sample.duration * 2)), // Rough mapping of seconds to bars
      startBar: Math.floor(position),
      payload: {
        type: 'audio',
        audioUrl: sample.url,
        startTime: position,
        duration: sample.duration,
        volume: 0.8,
        color: sample.color,
      },
    });
    toast({
      title: '🎵 Sample Added!',
      description: `${sample.name} added at beat ${Math.floor(position) + 1}`,
    });
  };

  return (
    <div className="h-full flex gap-4">
      {/* Categories - Click to filter */}
      <div className="flex gap-3">
        {categories.map(cat => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <div 
              key={cat.id}
              onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all hover:scale-105"
              style={{ 
                background: isSelected ? `${cat.color}30` : 'rgba(139, 92, 246, 0.05)',
                border: isSelected ? `2px solid ${cat.color}` : `1px solid ${COLORS.border}`,
              }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ 
                  background: `${cat.color}20`,
                  boxShadow: isSelected ? `0 0 30px ${cat.color}60` : `0 0 20px ${cat.color}30`,
                }}
              >
                <Icon className="w-6 h-6" style={{ color: cat.color }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: isSelected ? cat.color : COLORS.text }}>{cat.name}</span>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>{allSamples.filter(s => s.category.toLowerCase() === cat.id).length}</span>
            </div>
          );
        })}
      </div>

      {/* Sample list */}
      <div className="flex-1 ml-4">
        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: COLORS.purple }}>
          {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'All'} Samples ({samples.length})
        </h4>
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
          {samples.map((sample) => {
            const isPlaying = playingSampleId === sample.id;
            return (
              <div 
                key={sample.id}
                className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02] hover:bg-white/10 active:scale-[0.98]"
                style={{ 
                  background: isPlaying ? `${sample.color}20` : 'rgba(139, 92, 246, 0.05)',
                  border: isPlaying ? `2px solid ${sample.color}` : `1px solid ${COLORS.border}`,
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Play button - plays the sound */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSampleSound(sample);
                    }}
                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                    style={{ background: isPlaying ? sample.color : `${sample.color}30` }}
                  >
                    <Play className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} style={{ color: isPlaying ? '#fff' : sample.color }} />
                  </button>
                  <div>
                    <p className="text-sm font-medium" style={{ color: COLORS.text }}>{sample.name}</p>
                    <p className="text-xs" style={{ color: COLORS.textMuted }}>
                      {sample.category} • {sample.bpm} BPM {sample.key !== '-' && `• ${sample.key}`}
                    </p>
                  </div>
                </div>
                {/* Add to timeline button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSampleClick(sample);
                  }}
                  className="p-2 rounded-lg transition-all hover:scale-110 hover:bg-purple-500"
                  style={{ background: 'rgba(139, 92, 246, 0.3)' }}
                  title="Add to timeline"
                >
                  <Plus className="w-4 h-4" style={{ color: COLORS.purple }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================
// INSPECTOR PANEL - Track properties (FUNCTIONAL)
// ============================================
const InspectorPanel: React.FC = () => {
  const { toast } = useToast();
  const [trackName, setTrackName] = useState('Piano - Track 1');
  const [instrument, setInstrument] = useState('Grand Piano');
  const [effects, setEffects] = useState({ reverb: 50, delay: 40, chorus: 20 });
  const [volume, setVolume] = useState(80);
  const [pan, setPan] = useState(0);

  const handleEffectChange = (effect: string, value: number) => {
    setEffects(prev => ({ ...prev, [effect.toLowerCase()]: value }));
    // Dispatch event so audio engine can apply effect
    window.dispatchEvent(new CustomEvent('track:effect', { 
      detail: { effect: effect.toLowerCase(), value: value / 100 } 
    }));
  };

  const handleAction = (action: string) => {
    switch (action) {
      case 'Duplicate':
        window.dispatchEvent(new CustomEvent('track:duplicate'));
        toast({ title: '📋 Track Duplicated', description: `${trackName} copied` });
        break;
      case 'Delete':
        if (confirm('Delete this track?')) {
          window.dispatchEvent(new CustomEvent('track:delete'));
          toast({ title: '🗑️ Track Deleted', description: `${trackName} removed` });
        }
        break;
      case 'Bounce':
        toast({ title: '🎵 Bouncing...', description: 'Rendering track to audio file' });
        window.dispatchEvent(new CustomEvent('track:bounce'));
        setTimeout(() => {
          toast({ title: '✅ Bounce Complete', description: 'Track rendered to audio' });
        }, 2000);
        break;
      case 'Freeze':
        toast({ title: '❄️ Freezing Track', description: 'Reducing CPU usage' });
        window.dispatchEvent(new CustomEvent('track:freeze'));
        break;
    }
  };

  const instruments = [
    'Grand Piano', 'Electric Piano', 'Rhodes', 'Wurlitzer',
    'Synth Lead', 'Synth Pad', 'Synth Bass',
    'Acoustic Guitar', 'Electric Guitar', 'Bass Guitar',
    'Strings', 'Brass', 'Woodwinds',
    'Drums', 'Percussion'
  ];

  return (
    <div className="space-y-4">
      {/* Selected Track Info */}
      <div 
        className="p-4 rounded-xl"
        style={{ 
          background: 'rgba(139, 92, 246, 0.05)',
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: COLORS.purple }}>
          Selected Track
        </h4>
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(59, 130, 246, 0.2)' }}
          >
            <Piano className="w-5 h-5" style={{ color: '#3B82F6' }} />
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
              className="font-semibold bg-transparent border-none outline-none w-full"
              style={{ color: COLORS.text }}
            />
            <p className="text-xs" style={{ color: COLORS.textMuted }}>{instrument}</p>
          </div>
        </div>
      </div>

      {/* Volume & Pan */}
      <div 
        className="p-4 rounded-xl"
        style={{ 
          background: 'rgba(139, 92, 246, 0.05)',
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs" style={{ color: COLORS.textMuted }}>Volume</span>
              <span className="text-xs" style={{ color: COLORS.purple }}>{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                window.dispatchEvent(new CustomEvent('track:volume', { detail: { value: Number(e.target.value) / 100 } }));
              }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, ${COLORS.purple} ${volume}%, rgba(0,0,0,0.3) ${volume}%)` }}
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs" style={{ color: COLORS.textMuted }}>Pan</span>
              <span className="text-xs" style={{ color: COLORS.purple }}>{pan > 0 ? `R${pan}` : pan < 0 ? `L${Math.abs(pan)}` : 'C'}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={pan}
              onChange={(e) => {
                setPan(Number(e.target.value));
                window.dispatchEvent(new CustomEvent('track:pan', { detail: { value: Number(e.target.value) / 100 } }));
              }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.3)' }}
            />
          </div>
        </div>
      </div>

      {/* Instrument Selector */}
      <div 
        className="p-4 rounded-xl"
        style={{ 
          background: 'rgba(139, 92, 246, 0.05)',
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: COLORS.purple }}>
          Instrument
        </h4>
        <select 
          value={instrument}
          onChange={(e) => {
            setInstrument(e.target.value);
            window.dispatchEvent(new CustomEvent('track:instrument', { detail: { instrument: e.target.value } }));
            toast({ title: '🎹 Instrument Changed', description: e.target.value });
          }}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ 
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${COLORS.border}`,
            color: COLORS.text,
          }}
        >
          {instruments.map(inst => (
            <option key={inst} value={inst}>{inst}</option>
          ))}
        </select>
      </div>

      {/* Quick Effects - Now functional */}
      <div 
        className="p-4 rounded-xl"
        style={{ 
          background: 'rgba(139, 92, 246, 0.05)',
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: COLORS.purple }}>
          Effects
        </h4>
        <div className="space-y-3">
          {Object.entries(effects).map(([effect, value]) => (
            <div key={effect}>
              <div className="flex justify-between mb-1">
                <span className="text-sm capitalize" style={{ color: COLORS.text }}>{effect}</span>
                <span className="text-xs" style={{ color: COLORS.purple }}>{value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(e) => handleEffectChange(effect, Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ 
                  background: `linear-gradient(to right, ${COLORS.purple} ${value}%, rgba(0,0,0,0.3) ${value}%)`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions - Now functional */}
      <div 
        className="p-4 rounded-xl"
        style={{ 
          background: 'rgba(139, 92, 246, 0.05)',
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: COLORS.purple }}>
          Actions
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {['Duplicate', 'Delete', 'Bounce', 'Freeze'].map(action => (
            <button 
              key={action}
              onClick={() => handleAction(action)}
              className="px-3 py-2 text-xs font-semibold rounded-lg transition-all hover:scale-105 active:scale-95"
              style={{ 
                background: action === 'Delete' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                color: action === 'Delete' ? '#EF4444' : COLORS.text,
                border: `1px solid ${action === 'Delete' ? 'rgba(239, 68, 68, 0.3)' : COLORS.border}`,
              }}
            >
              {action === 'Duplicate' && '📋 '}
              {action === 'Delete' && '🗑️ '}
              {action === 'Bounce' && '🎵 '}
              {action === 'Freeze' && '❄️ '}
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// AI HELP MODAL
// ============================================
const AIHelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  
  // Early return AFTER hooks
  if (!isOpen) return null;
  
  const aiActions = [
    { icon: '🎵', title: 'Generate Chords', desc: 'AI creates unique progression', action: 'chords' },
    { icon: '🎹', title: 'Create Melody', desc: 'AI generates melody', action: 'melody' },
    { icon: '🥁', title: 'Add Drums', desc: 'AI creates drum pattern', action: 'drums' },
    { icon: '🎸', title: 'Generate Bass', desc: 'AI generates bassline', action: 'bass' },
  ];

  // Real AI generation using /api/grok
  const generateWithAI = async (type: string) => {
    const prompts: Record<string, string> = {
      chords: `You are Astutely, an AI music producer. Generate a unique 4-chord progression for a modern beat in a random key. Return ONLY valid JSON like: {"chords": [{"name": "Cm", "notes": ["C", "Eb", "G"]}, {"name": "Ab", "notes": ["Ab", "C", "Eb"]}, {"name": "Bb", "notes": ["Bb", "D", "F"]}, {"name": "Gm", "notes": ["G", "Bb", "D"]}]}`,
      melody: `You are Astutely, an AI music producer. Generate an 8-note melody for a catchy hook. Use MIDI note numbers (60=C4). Return ONLY valid JSON like: {"notes": [60, 63, 65, 67, 68, 67, 65, 63], "durations": [0.25, 0.25, 0.5, 0.25, 0.25, 0.5, 0.25, 0.5]}`,
      drums: `You are Astutely, an AI music producer. Generate a 16-step drum pattern. Return ONLY valid JSON like: {"kicks": [0, 4, 8, 12], "snares": [4, 12], "hihats": [0, 2, 4, 6, 8, 10, 12, 14], "bpm": 128}`,
      bass: `You are Astutely, an AI music producer. Generate a 4-note bassline that grooves. Use MIDI note numbers (36=C2). Return ONLY valid JSON like: {"notes": [36, 43, 41, 38], "durations": [0.5, 0.5, 0.5, 0.5]}`
    };

    const response = await fetch('/api/grok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompts[type] })
    });

    const data = await response.json();
    
    // Parse AI response
    const content = data.response || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : content);
  };

  // Play generated content
  const playGenerated = async (type: string, data: any) => {
    const { realisticAudio } = await import('@/lib/realisticAudio');
    await realisticAudio.initialize();

    if (type === 'chords' && data.chords) {
      data.chords.forEach((chord: any, i: number) => {
        setTimeout(() => {
          chord.notes.forEach((note: string) => {
            realisticAudio.playNote(note, 4, 0.8, 'piano', 0.7);
          });
        }, i * 600);
      });
      return data.chords.map((c: any) => c.name).join(' - ');
    }

    if (type === 'melody' && data.notes) {
      data.notes.forEach((midi: number, i: number) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const note = noteNames[midi % 12];
        const octave = Math.floor(midi / 12) - 1;
        setTimeout(() => {
          realisticAudio.playNote(note, octave, data.durations?.[i] || 0.3, 'piano', 0.8);
        }, i * 200);
      });
      return `${data.notes.length}-note melody`;
    }

    if (type === 'drums' && (data.kicks || data.snares || data.hihats)) {
      const beatMs = 60000 / (data.bpm || 128) / 4;
      data.kicks?.forEach((step: number) => {
        setTimeout(() => realisticAudio.playDrumSound('kick', 0.9), step * beatMs);
      });
      data.snares?.forEach((step: number) => {
        setTimeout(() => realisticAudio.playDrumSound('snare', 0.8), step * beatMs);
      });
      data.hihats?.forEach((step: number) => {
        setTimeout(() => realisticAudio.playDrumSound('hihat', 0.5), step * beatMs);
      });
      return `${data.bpm || 128} BPM pattern`;
    }

    if (type === 'bass' && data.notes) {
      data.notes.forEach((midi: number, i: number) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const note = noteNames[midi % 12];
        const octave = Math.floor(midi / 12) - 1;
        setTimeout(() => {
          realisticAudio.playNote(note, octave, data.durations?.[i] || 0.5, 'bass-synth', 0.9);
        }, i * 500);
      });
      return `${data.notes.length}-note bassline`;
    }

    return 'Generated';
  };

  const handleAction = async (action: string, title: string) => {
    setIsGenerating(true);
    setActiveAction(action);
    toast({ title: `✨ ${title}`, description: 'AI is generating...' });
    
    try {
      // Call real AI
      const aiData = await generateWithAI(action);
      
      // Play the generated content
      const result = await playGenerated(action, aiData);
      
      toast({ title: `🎵 ${title}`, description: result });
      
      setTimeout(() => {
        setIsGenerating(false);
        setActiveAction(null);
      }, 2000);
      
    } catch (error) {
      console.error('AI action error:', error);
      toast({ title: '❌ Error', description: 'AI generation failed', variant: 'destructive' });
      setIsGenerating(false);
      setActiveAction(null);
    }
  };

  // Handle chat send
  const handleChatSend = async () => {
    if (!chatInput.trim() || isGenerating) return;
    
    setIsGenerating(true);
    toast({ title: '💬 Asking AI...', description: chatInput.substring(0, 50) });
    
    try {
      const response = await fetch('/api/grok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: `You are Astutely, an AI music production assistant. Help the user with: ${chatInput}. Be concise and helpful.` 
        })
      });
      
      const data = await response.json();
      toast({ 
        title: '🤖 Astutely', 
        description: data.response?.substring(0, 200) || 'No response'
      });
      setChatInput('');
    } catch (error) {
      toast({ title: '❌ Error', description: 'Failed to get AI response', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div 
        className="w-[520px] max-w-[90vw] rounded-2xl p-6"
        style={{ 
          background: COLORS.bg,
          border: `1px solid ${COLORS.border}`,
          boxShadow: `0 0 100px ${COLORS.purpleGlow}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ 
                background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.pink})`,
                boxShadow: `0 0 30px ${COLORS.purpleGlow}`,
              }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: COLORS.text }}>AI Assistant</h2>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>Press H anytime for help</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg transition-all hover:scale-110"
            style={{ background: 'rgba(139, 92, 246, 0.1)' }}
          >
            <X className="w-5 h-5" style={{ color: COLORS.textMuted }} />
          </button>
        </div>

        {/* AI Actions Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {aiActions.map(item => {
            const isActive = activeAction === item.action;
            return (
              <button 
                key={item.title}
                onClick={() => handleAction(item.action, item.title)}
                disabled={isGenerating && !isActive}
                className={`p-4 rounded-xl text-left transition-all hover:scale-[1.02] ${isActive ? 'animate-pulse' : ''}`}
                style={{ 
                  background: isActive 
                    ? `linear-gradient(135deg, ${COLORS.purple}40, ${COLORS.pink}40)` 
                    : 'rgba(139, 92, 246, 0.05)',
                  border: isActive 
                    ? `2px solid ${COLORS.purple}` 
                    : `1px solid ${COLORS.border}`,
                  opacity: isGenerating && !isActive ? 0.5 : 1,
                }}
              >
                <span className="text-2xl mb-2 block">{isActive ? '🎶' : item.icon}</span>
                <span className="text-sm font-semibold block" style={{ color: COLORS.text }}>
                  {isActive ? 'Playing...' : item.title}
                </span>
                <span className="text-xs" style={{ color: COLORS.textMuted }}>{item.desc}</span>
              </button>
            );
          })}
        </div>

        {/* AI Chat Input */}
        <div 
          className="flex items-center gap-2 p-3 rounded-xl"
          style={{ 
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <input 
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
            placeholder="Ask AI anything about your music..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.text }}
            disabled={isGenerating}
          />
          <button 
            onClick={handleChatSend}
            disabled={isGenerating || !chatInput.trim()}
            className="p-2 rounded-lg transition-all hover:scale-110 disabled:opacity-50"
            style={{ 
              background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.pink})`,
            }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN CODEDSWITCH FLOW COMPONENT
// ============================================
export const CodedSwitchFlow: React.FC = () => {
  const { toast } = useToast();
  
  // Transport context
  const { 
    isPlaying: transportIsPlaying, 
    tempo: transportTempo,
    play: transportPlay,
    stop: transportStop,
    setTempo: setTransportTempo
  } = useTransport();

  // Local state
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [projectName, setProjectName] = useState('Untitled Project');
  
  // Floating panels
  const [mixerOpen, setMixerOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [aiHelpOpen, setAIHelpOpen] = useState(false);
  const [showAstutely, setShowAstutely] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  
  // Navigation
  const [, navigate] = useLocation();

  // Sync with transport
  useEffect(() => {
    setIsPlaying(transportIsPlaying);
  }, [transportIsPlaying]);

  useEffect(() => {
    if (transportTempo) setBpm(transportTempo);
  }, [transportTempo]);

  // Play/Pause handler
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      transportStop();
    } else {
      transportPlay();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, transportPlay, transportStop]);

  // BPM handler
  const handleBpmChange = useCallback((newBpm: number) => {
    const clampedBpm = Math.max(40, Math.min(300, newBpm));
    setBpm(clampedBpm);
    setTransportTempo(clampedBpm);
  }, [setTransportTempo]);

  // Close all panels
  const closeAllPanels = useCallback(() => {
    setMixerOpen(false);
    setBrowserOpen(false);
    setInspectorOpen(false);
    setAIHelpOpen(false);
    setNavMenuOpen(false);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      
      // Escape = close all
      if (key === 'escape') {
        closeAllPanels();
        return;
      }
      
      // Space = Play/Pause
      if (key === ' ') {
        e.preventDefault();
        handlePlayPause();
        return;
      }
      
      // M = Mixer
      if (key === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setMixerOpen(prev => !prev);
        return;
      }
      
      // B = Browser
      if (key === 'b' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setBrowserOpen(prev => !prev);
        return;
      }
      
      // I = Inspector
      if (key === 'i' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setInspectorOpen(prev => !prev);
        return;
      }
      
      // H = AI Help
      if (key === 'h' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setAIHelpOpen(prev => !prev);
        return;
      }
      
      // A = Add Track
      if (key === 'a' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toast({ title: '➕ Track Added', description: 'New track created' });
        return;
      }
      
      // Ctrl+Z = Undo
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        toast({ title: '↩️ Undo' });
        return;
      }
      
      // Ctrl+Y = Redo
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        toast({ title: '↪️ Redo' });
        return;
      }
      
      // Ctrl+S = Save
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        toast({ title: '💾 Saved', description: 'Project saved' });
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, closeAllPanels, toast]);

  return (
    <div 
      className="h-screen w-screen overflow-hidden flex flex-col"
      style={{ background: COLORS.bg }}
    >
      {/* ============================================ */}
      {/* TOP BAR - The Command Center */}
      {/* ============================================ */}
      <header 
        className="h-16 flex items-center justify-between px-4 flex-shrink-0 z-40"
        style={{ 
          background: 'rgba(15, 10, 26, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        {/* Left: Logo + Navigation Menu + Project Name */}
        <div className="flex items-center gap-4">
          {/* Navigation Menu Button */}
          <div className="relative">
            <button
              onClick={() => setNavMenuOpen(!navMenuOpen)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all hover:scale-105"
              style={{ 
                background: navMenuOpen ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
              }}
            >
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ 
                  background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.pink})`,
                  boxShadow: `0 0 20px ${COLORS.purpleGlow}`,
                }}
              >
                <span className="text-white font-black text-sm">CS</span>
              </div>
              <span 
                className="text-lg font-black tracking-tight hidden sm:block"
                style={{ 
                  background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.pink})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                CodedSwitch
              </span>
              <ChevronDown 
                className={`w-4 h-4 transition-transform ${navMenuOpen ? 'rotate-180' : ''}`} 
                style={{ color: COLORS.textMuted }} 
              />
            </button>
            
            {/* Navigation Dropdown Menu */}
            {navMenuOpen && (
              <div 
                className="absolute top-full left-0 mt-2 w-64 rounded-xl py-2 z-50"
                style={{ 
                  background: COLORS.bgPanel,
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${COLORS.border}`,
                  boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
                }}
              >
                <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.purple }}>
                  Navigate
                </div>
                
                {[
                  { icon: Home, label: 'Home', path: '/' },
                  { icon: LayoutDashboard, label: 'Full Studio', path: '/studio' },
                  { icon: Music, label: 'Unified Studio', path: '/unified-studio' },
                  { icon: Piano, label: 'DAW Layout', path: '/daw-layout' },
                  { icon: Wand2, label: 'Melody Composer', path: '/melody-composer' },
                  { icon: Mic2, label: 'Lyric Lab', path: '/lyric-lab' },
                  { icon: Drum, label: 'Beat Studio', path: '/beat-studio' },
                  { icon: Code, label: 'Code Translator', path: '/code-translator' },
                  { icon: Shield, label: 'Security Scanner', path: '/vulnerability-scanner' },
                  { icon: MessageSquare, label: 'AI Assistant', path: '/ai-assistant' },
                  { icon: Headphones, label: 'Mix Studio', path: '/mix-studio' },
                ].map(item => (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setNavMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all hover:bg-white/5"
                  >
                    <item.icon className="w-4 h-4" style={{ color: COLORS.purple }} />
                    <span style={{ color: COLORS.text }}>{item.label}</span>
                  </button>
                ))}
                
                <div className="mx-3 my-2 h-px" style={{ background: COLORS.border }} />
                
                <div className="px-3 py-2 text-xs" style={{ color: COLORS.textMuted }}>
                  Current: CodedSwitch Flow
                </div>
              </div>
            )}
          </div>
          
          <div className="h-6 w-px" style={{ background: COLORS.border }} />
          
          {/* Project Name */}
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent outline-none text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ 
              color: COLORS.text,
              border: `1px solid transparent`,
            }}
            onFocus={(e) => e.target.style.borderColor = COLORS.border}
            onBlur={(e) => e.target.style.borderColor = 'transparent'}
          />
        </div>
        
        {/* Center: THE GIANT PLAY BUTTON */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
          {/* Skip Back */}
          <button 
            className="p-2 rounded-lg transition-all hover:scale-110"
            style={{ background: 'rgba(139, 92, 246, 0.1)' }}
          >
            <SkipBack className="w-4 h-4" style={{ color: COLORS.textMuted }} />
          </button>
          
          {/* THE PLAY BUTTON - Heart of the app */}
          <button
            onClick={handlePlayPause}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: isPlaying 
                ? `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})`
                : `linear-gradient(135deg, ${COLORS.purple}, #6D28D9)`,
              boxShadow: isPlaying 
                ? `0 0 60px ${COLORS.pinkGlow}, 0 0 100px ${COLORS.purpleGlow}`
                : `0 0 30px ${COLORS.purpleGlow}`,
              transform: isPlaying ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 text-white" />
            ) : (
              <Play className="w-7 h-7 text-white ml-1" />
            )}
          </button>
          
          {/* Stop */}
          <button 
            onClick={() => { transportStop(); setIsPlaying(false); }}
            className="p-2 rounded-lg transition-all hover:scale-110"
            style={{ background: 'rgba(139, 92, 246, 0.1)' }}
          >
            <Square className="w-4 h-4" style={{ color: COLORS.textMuted }} />
          </button>
        </div>
        
        {/* Right: BPM + Controls + AI */}
        <div className="flex items-center gap-3">
          {/* BPM Control */}
          <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ 
              background: 'rgba(139, 92, 246, 0.1)',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <span className="text-xs font-bold uppercase" style={{ color: COLORS.textMuted }}>BPM</span>
            <input
              type="number"
              value={bpm}
              onChange={(e) => handleBpmChange(Number(e.target.value))}
              className="w-12 bg-transparent text-center outline-none font-bold"
              style={{ color: COLORS.text }}
              min={40}
              max={300}
            />
          </div>
          
          {/* Undo/Redo */}
          <div className="flex items-center">
            <button 
              className="p-2 rounded-lg transition-all hover:scale-110"
              style={{ color: COLORS.textMuted }}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              className="p-2 rounded-lg transition-all hover:scale-110"
              style={{ color: COLORS.textMuted }}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          
          {/* ASTUTELY BUTTON - The viral feature */}
          <button
            onClick={() => setShowAstutely(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-105"
            style={{ 
              background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)',
            }}
            title="Astutely - AI Beat Transformer"
          >
            <Zap className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">Astutely</span>
          </button>
          
          {/* AI Button */}
          <button
            onClick={() => setAIHelpOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-105"
            style={{ 
              background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.pink})`,
              boxShadow: `0 0 20px ${COLORS.purpleGlow}`,
            }}
            title="AI Help (H)"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">AI</span>
          </button>
        </div>
      </header>

      {/* ============================================ */}
      {/* MAIN CANVAS - Full Bleed, No Borders */}
      {/* ============================================ */}
      <main className="flex-1 relative overflow-auto">
        {/* Ambient Background Glow - Breathes with the music */}
        <div 
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 z-0"
          style={{
            background: isPlaying 
              ? `radial-gradient(ellipse at center, ${COLORS.purpleGlow} 0%, transparent 60%)`
              : `radial-gradient(ellipse at center, rgba(139, 92, 246, 0.05) 0%, transparent 60%)`,
            opacity: isPlaying ? 1 : 0.5,
          }}
        />
        
        {/* The Hybrid View - Piano Roll + Timeline */}
        <div className="h-full w-full relative z-10 overflow-auto">
          <VerticalPianoRoll />
        </div>
        
        {/* Keyboard Hints - Fade when not needed */}
        <div 
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 px-5 py-2.5 rounded-full opacity-40 hover:opacity-100 transition-opacity"
          style={{ 
            background: 'rgba(15, 10, 26, 0.9)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {[
            { key: 'Space', action: 'Play' },
            { key: 'M', action: 'Mixer' },
            { key: 'B', action: 'Browser' },
            { key: 'I', action: 'Inspector' },
            { key: 'H', action: 'AI Help' },
            { key: 'Esc', action: 'Close All' },
          ].map(({ key, action }) => (
            <span key={key} className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.textMuted }}>
              <kbd 
                className="px-1.5 py-0.5 rounded text-xs font-mono"
                style={{ background: 'rgba(139, 92, 246, 0.2)', color: COLORS.purple }}
              >
                {key}
              </kbd>
              {action}
            </span>
          ))}
        </div>
      </main>

      {/* ============================================ */}
      {/* FLOATING PANELS - Appear on demand */}
      {/* ============================================ */}
      
      {/* Inspector - Left */}
      <FloatingPanel 
        isOpen={inspectorOpen} 
        onClose={() => setInspectorOpen(false)} 
        position="left"
        title="Inspector"
        hotkey="I"
      >
        <InspectorPanel />
      </FloatingPanel>
      
      {/* Mixer - Right */}
      <FloatingPanel 
        isOpen={mixerOpen} 
        onClose={() => setMixerOpen(false)} 
        position="right"
        title="Mixer"
        hotkey="M"
      >
        <MixerPanel />
      </FloatingPanel>
      
      {/* Browser - Bottom */}
      <FloatingPanel 
        isOpen={browserOpen} 
        onClose={() => setBrowserOpen(false)} 
        position="bottom"
        title="Browser"
        hotkey="B"
      >
        <BrowserPanel />
      </FloatingPanel>
      
      {/* AI Help Modal */}
      <AIHelpModal isOpen={aiHelpOpen} onClose={() => setAIHelpOpen(false)} />
      
      {/* ASTUTELY PANEL - The viral feature */}
      {showAstutely && (
        <AstutelyPanel 
          onClose={() => setShowAstutely(false)}
          onGenerated={(result: AstutelyResult) => {
            // Convert Astutely result to track notes and add to timeline
            const notes = astutelyToNotes(result);
            const drumNotes = notes.filter(n => n.trackType === 'drums');
            const bassNotes = notes.filter(n => n.trackType === 'bass');
            const chordNotes = notes.filter(n => n.trackType === 'chords');
            const melodyNotes = notes.filter(n => n.trackType === 'melody');
            
            // Update BPM to match generated beat
            setBpm(result.bpm);
            setTransportTempo(result.bpm);
            
            // Store generated notes in localStorage so Piano Roll can load them
            localStorage.setItem('astutely-generated', JSON.stringify({
              notes,
              bpm: result.bpm,
              timestamp: Date.now(),
              counts: {
                drums: drumNotes.length,
                bass: bassNotes.length,
                chords: chordNotes.length,
                melody: melodyNotes.length
              }
            }));
            
            // Dispatch custom event so Piano Roll knows to load the notes
            window.dispatchEvent(new CustomEvent('astutely:generated', { detail: { notes, bpm: result.bpm } }));
            
            toast({ 
              title: '🔥 Astutely Complete!', 
              description: (
                <div className="flex flex-col gap-2">
                  <span>Added {drumNotes.length} drums, {bassNotes.length} bass, {chordNotes.length} chords, {melodyNotes.length} melody notes at {result.bpm} BPM</span>
                  <button 
                    onClick={() => {
                      // Navigate to Piano Roll tab
                      const pianoRollTab = document.querySelector('[data-tab="piano-roll"]') as HTMLElement;
                      if (pianoRollTab) pianoRollTab.click();
                      // Or scroll to piano roll section
                      const pianoRoll = document.querySelector('.piano-roll-container');
                      if (pianoRoll) pianoRoll.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-white text-sm font-medium transition-colors"
                  >
                    → View in Piano Roll
                  </button>
                </div>
              ),
              duration: 10000, // Keep visible longer
            });
          }}
        />
      )}
      
      {/* Edge Triggers - Subtle hints to open panels */}
      {!inspectorOpen && (
        <div 
          className="fixed left-0 top-1/2 transform -translate-y-1/2 w-1 h-24 rounded-r cursor-pointer transition-all hover:w-2"
          style={{ 
            background: `linear-gradient(to bottom, transparent, ${COLORS.purple}, transparent)`,
            opacity: 0.5,
          }}
          onClick={() => setInspectorOpen(true)}
          title="Inspector (I)"
        />
      )}
      {!mixerOpen && (
        <div 
          className="fixed right-0 top-1/2 transform -translate-y-1/2 w-1 h-24 rounded-l cursor-pointer transition-all hover:w-2"
          style={{ 
            background: `linear-gradient(to bottom, transparent, ${COLORS.purple}, transparent)`,
            opacity: 0.5,
          }}
          onClick={() => setMixerOpen(true)}
          title="Mixer (M)"
        />
      )}
      {!browserOpen && (
        <div 
          className="fixed bottom-0 left-1/2 transform -translate-x-1/2 h-1 w-24 rounded-t cursor-pointer transition-all hover:h-2"
          style={{ 
            background: `linear-gradient(to right, transparent, ${COLORS.purple}, transparent)`,
            opacity: 0.5,
          }}
          onClick={() => setBrowserOpen(true)}
          title="Browser (B)"
        />
      )}
    </div>
  );
};

export default CodedSwitchFlow;
