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
const BrowserPanel: React.FC = () => {
  const categories = [
    { id: 'drums', name: 'Drums', icon: Drum, count: 245, color: '#EC4899' },
    { id: 'bass', name: 'Bass', icon: Guitar, count: 128, color: '#10B981' },
    { id: 'keys', name: 'Keys', icon: Piano, count: 312, color: '#3B82F6' },
    { id: 'synths', name: 'Synths', icon: Waves, count: 189, color: '#8B5CF6' },
    { id: 'vocals', name: 'Vocals', icon: Mic2, count: 89, color: '#F59E0B' },
    { id: 'fx', name: 'FX', icon: Sparkles, count: 156, color: '#06B6D4' },
  ];

  const recentSounds = [
    { name: '808 Kick Heavy', category: 'Drums', bpm: 140 },
    { name: 'Analog Bass 01', category: 'Bass', bpm: 128 },
    { name: 'Pad Atmosphere', category: 'Synths', bpm: 120 },
    { name: 'Hi-Hat Loop', category: 'Drums', bpm: 140 },
  ];

  return (
    <div className="h-full flex gap-4">
      {/* Categories */}
      <div className="flex gap-3">
        {categories.map(cat => {
          const Icon = cat.icon;
          return (
            <div 
              key={cat.id}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all hover:scale-105"
              style={{ 
                background: 'rgba(139, 92, 246, 0.05)',
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ 
                  background: `${cat.color}20`,
                  boxShadow: `0 0 20px ${cat.color}30`,
                }}
              >
                <Icon className="w-6 h-6" style={{ color: cat.color }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: COLORS.text }}>{cat.name}</span>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>{cat.count}</span>
            </div>
          );
        })}
      </div>

      {/* Recent sounds */}
      <div className="flex-1 ml-4">
        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: COLORS.purple }}>
          Recent
        </h4>
        <div className="space-y-2">
          {recentSounds.map((sound, i) => (
            <div 
              key={i}
              className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02]"
              style={{ 
                background: 'rgba(139, 92, 246, 0.05)',
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(139, 92, 246, 0.2)' }}
                >
                  <FileAudio className="w-4 h-4" style={{ color: COLORS.purple }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: COLORS.text }}>{sound.name}</p>
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>{sound.category} • {sound.bpm} BPM</p>
                </div>
              </div>
              <button 
                className="p-2 rounded-lg transition-all hover:scale-110"
                style={{ background: 'rgba(139, 92, 246, 0.2)' }}
              >
                <Plus className="w-4 h-4" style={{ color: COLORS.purple }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// INSPECTOR PANEL - Track properties
// ============================================
const InspectorPanel: React.FC = () => {
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
          <div>
            <p className="font-semibold" style={{ color: COLORS.text }}>Piano - Track 1</p>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>Grand Piano</p>
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
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ 
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${COLORS.border}`,
            color: COLORS.text,
          }}
        >
          <option>Grand Piano</option>
          <option>Electric Piano</option>
          <option>Synth Lead</option>
          <option>Strings</option>
          <option>Pad</option>
        </select>
      </div>

      {/* Quick Effects */}
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
          {['Reverb', 'Delay', 'Chorus'].map(effect => (
            <div key={effect} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: COLORS.text }}>{effect}</span>
              <div 
                className="w-24 h-2 rounded-full overflow-hidden"
                style={{ background: 'rgba(0,0,0,0.3)' }}
              >
                <div 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${Math.random() * 60 + 20}%`,
                    background: `linear-gradient(to right, ${COLORS.purple}, ${COLORS.pink})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
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
              className="px-3 py-2 text-xs font-semibold rounded-lg transition-all hover:scale-105"
              style={{ 
                background: 'rgba(139, 92, 246, 0.1)',
                color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
              }}
            >
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
  const [selectedKey, setSelectedKey] = useState('C');
  const [selectedMood, setSelectedMood] = useState('happy');
  
  // Early return AFTER hooks
  if (!isOpen) return null;
  
  const aiActions = [
    { icon: '🎵', title: 'Generate Chords', desc: 'AI suggests chord progressions', action: 'chords' },
    { icon: '🎹', title: 'Create Melody', desc: 'Generate melody from chords', action: 'melody' },
    { icon: '🥁', title: 'Add Drums', desc: 'AI creates drum patterns', action: 'drums' },
    { icon: '🎸', title: 'Generate Bass', desc: 'Create bass from progression', action: 'bass' },
  ];

  const handleAction = async (action: string, title: string) => {
    setIsGenerating(true);
    toast({ title: `✨ ${title}`, description: 'AI is generating...' });
    
    try {
      if (action === 'chords') {
        // Use the real backend AI chord generation
        const res = await fetch('/api/chords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: selectedKey, mood: selectedMood })
        });
        const data = await res.json();
        
        if (data.success) {
          toast({ 
            title: '🎵 Chords Generated!', 
            description: `${data.progression}: ${data.chords.join(' - ')}` 
          });
        } else {
          toast({ title: '❌ Generation Failed', description: data.error, variant: 'destructive' });
        }
      } else {
        // Placeholder for other AI actions
        toast({ title: `✨ ${title}`, description: 'Coming soon!' });
      }
    } catch (error) {
      toast({ title: '❌ Error', description: 'AI generation failed', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
      onClose();
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
          {aiActions.map(item => (
            <button 
              key={item.title}
              onClick={() => handleAction(item.action, item.title)}
              disabled={isGenerating}
              className="p-4 rounded-xl text-left transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ 
                background: 'rgba(139, 92, 246, 0.05)',
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <span className="text-2xl mb-2 block">{item.icon}</span>
              <span className="text-sm font-semibold block" style={{ color: COLORS.text }}>{item.title}</span>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>{item.desc}</span>
            </button>
          ))}
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
            placeholder="Ask AI anything about your music..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.text }}
          />
          <button 
            className="p-2 rounded-lg transition-all hover:scale-110"
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
          onGenerated={(result) => {
            toast({ 
              title: '🔥 Astutely Complete!', 
              description: `Generated ${result.style} beat at ${result.bpm} BPM` 
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
