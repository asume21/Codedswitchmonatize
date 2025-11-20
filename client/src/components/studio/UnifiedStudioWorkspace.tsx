import { useState, useContext, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { StudioAudioContext } from '@/pages/studio';
import { ChevronDown, ChevronRight, Maximize2, Minimize2, MessageSquare, Music, Sliders, Piano, Layers, Mic2, FileText, Wand2, Upload, Cable, RefreshCw, Settings, Workflow } from 'lucide-react';
import FloatingAIAssistant from './FloatingAIAssistant';
import MusicGenerationPanel from './MusicGenerationPanel';
import LyricsFocusMode from './LyricsFocusMode';
import ProfessionalStudio from './ProfessionalStudio';
import LyricLab from './LyricLab';
import CodeToMusicStudioV2 from './CodeToMusicStudioV2';
import VerticalPianoRoll from './VerticalPianoRoll';
import ProfessionalMixer from './ProfessionalMixer';
import SongUploader from './SongUploader';
import WorkflowSelector from './WorkflowSelector';
import TransportControls from './TransportControls';
import type { WorkflowPreset } from './WorkflowSelector';
import { useToast } from '@/hooks/use-toast';
import { useMIDI } from '@/hooks/use-midi';
import { realisticAudio } from '@/lib/realisticAudio';
import { AudioEngine } from '@/lib/audio';
import AudioAnalysisPanel from './AudioAnalysisPanel';
import type { Note } from './types/pianoRollTypes';

// Workflow Configuration Types
interface WorkflowConfig {
  activeView: 'arrangement' | 'piano-roll' | 'mixer' | 'ai-studio' | 'lyrics' | 'song-uploader';
  showAIAssistant: boolean;
  showMusicGen: boolean;
  expandedSections?: {
    arrangementControls?: boolean;
    instrumentsPanel?: boolean;
    pianoRollTools?: boolean;
    mixerPanel?: boolean;
  };
  guidedMode?: boolean; // For Beginner workflow
  description: string;
}

// Legacy ID migration map for backwards compatibility
const LEGACY_WORKFLOW_ID_MAP: Record<string, WorkflowPreset['id']> = {
  'mixing-console': 'mixing',
  'ai-assisted': 'ai',
  'immersive-mode': 'immersive',
};

// Workflow Configuration Profiles
const WORKFLOW_CONFIGS: Record<WorkflowPreset['id'], WorkflowConfig> = {
  'song-analyzer': {
    activeView: 'song-uploader',
    showAIAssistant: true,
    showMusicGen: false,
    expandedSections: {},
    description: 'Upload and analyze existing songs with AI-powered insights for BPM, key, structure, and production quality',
  },
  'mixing': {
    activeView: 'mixer',
    showAIAssistant: false,
    showMusicGen: false,
    expandedSections: {
      mixerPanel: true,
    },
    description: 'Professional mixer focused on mixing and mastering with effects and automation',
  },
  'ai': {
    activeView: 'ai-studio',
    showAIAssistant: true,
    showMusicGen: true,
    expandedSections: {},
    description: 'AI-first workflow with assistant and generation tools prominently visible',
  },
  'composition': {
    activeView: 'piano-roll',
    showAIAssistant: false,
    showMusicGen: false,
    expandedSections: {
      pianoRollTools: true,
      instrumentsPanel: true,
    },
    description: 'Focused on melody creation with piano roll and instrument selection',
  },
  'immersive': {
    activeView: 'arrangement',
    showAIAssistant: false,
    showMusicGen: false,
    expandedSections: {},
    description: 'Distraction-free fullscreen arrangement view for focused production',
  },
  'beginner': {
    activeView: 'arrangement',
    showAIAssistant: true,
    showMusicGen: false,
    expandedSections: {
      arrangementControls: true,
      instrumentsPanel: true,
    },
    guidedMode: true,
    description: 'Guided experience with helpful tips and simplified controls for newcomers',
  },
};

interface Track {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'lyrics';
  instrument?: string;
  data: any;
  notes?: Note[]; // For MIDI tracks
  audioUrl?: string; // For audio tracks - URL to audio file
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

export default function UnifiedStudioWorkspace() {
  const studioContext = useContext(StudioAudioContext);
  const { toast } = useToast();
  
  // MIDI Controller Integration
  const { 
    isSupported: midiSupported, 
    isConnected: midiConnected, 
    connectedDevices: midiDevices,
    lastNote: midiLastNote,
    activeNotes: midiActiveNotes,
    initializeMIDI,
    refreshDevices: refreshMIDIDevices,
    settings: midiSettings,
    updateSettings: updateMIDISettings,
    setMasterVolume: setMIDIMasterVolume
  } = useMIDI();
  
  // Audio engines
  const [synthesisEngine] = useState(() => new AudioEngine());

  // Initialize audio engines on mount
  useEffect(() => {
    realisticAudio.initialize().catch(err => {
      console.error('Failed to initialize realistic audio (drums):', err);
    });
    synthesisEngine.initialize().catch(err => {
      console.error('Failed to initialize synthesis engine (instruments):', err);
    });
  }, [synthesisEngine]);
  
  // Animate playhead when playing
  useEffect(() => {
    if (studioContext?.isPlaying) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        setPlayheadPosition(elapsed * 2); // 2 bars per second
      }, 50); // Update every 50ms
      
      return () => clearInterval(interval);
    } else {
      setPlayheadPosition(0); // Reset when stopped
    }
  }, [studioContext?.isPlaying]);
  
  // Main View State (DAW-style tabs)
  const [activeView, setActiveView] = useState<'arrangement' | 'piano-roll' | 'mixer' | 'ai-studio' | 'lyrics' | 'song-uploader' | 'code-to-music'>('arrangement');
  
  // Section expansion states
  const [instrumentsExpanded, setInstrumentsExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [pianoRollExpanded, setPianoRollExpanded] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [mixerExpanded, setMixerExpanded] = useState(false);

  // Track management
  const [tracks, setTracks] = useState<Track[]>([
    {
      id: 'track-1',
      name: 'Piano 1',
      type: 'midi',
      instrument: 'piano',
      data: [],
      notes: [], // Add empty notes array for Piano Roll
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    },
  ]);
  
  const [selectedTrack, setSelectedTrack] = useState<string | null>('track-1');
  const [zoom, setZoom] = useState([50]);
  const [playheadPosition, setPlayheadPosition] = useState(0); // For timeline playhead
  
  // UI State
  const [showAIAssistant, setShowAIAssistant] = useState(true);
  const [showMusicGen, setShowMusicGen] = useState(false);
  const [showLyricsFocus, setShowLyricsFocus] = useState(false);
  const [pianoRollTool, setPianoRollTool] = useState<'draw' | 'select' | 'erase'>('draw');
  
  // Master Volume Control
  const [masterVolume, setMasterVolume] = useState(0.7); // Default 70%

  // Workflow Selector State
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowPreset['id'] | null>(null);

  // Check if this is the first time visiting the studio and load persisted workflow
  useEffect(() => {
    const hasSeenWorkflowSelector = localStorage.getItem('hasSeenWorkflowSelector');
    let savedWorkflow = localStorage.getItem('selectedWorkflow') as string | null;
    
    if (!hasSeenWorkflowSelector) {
      // First time - show workflow selector
      setShowWorkflowSelector(true);
    } else if (savedWorkflow) {
      // Migrate legacy workflow IDs to new format
      if (LEGACY_WORKFLOW_ID_MAP[savedWorkflow]) {
        const migratedId = LEGACY_WORKFLOW_ID_MAP[savedWorkflow];
        savedWorkflow = migratedId;
        // Save the migrated ID to localStorage
        localStorage.setItem('selectedWorkflow', migratedId);
      }
      
      // Load saved workflow configuration if valid
      const workflowId = savedWorkflow as WorkflowPreset['id'];
      if (WORKFLOW_CONFIGS[workflowId]) {
        const config = WORKFLOW_CONFIGS[workflowId];
        setCurrentWorkflow(workflowId);
        setActiveView(config.activeView);
        setShowAIAssistant(config.showAIAssistant);
        setShowMusicGen(config.showMusicGen);
      }
    }
  }, []);

  // Handle workflow selection
  const handleSelectWorkflow = (workflowId: WorkflowPreset['id']) => {
    const config = WORKFLOW_CONFIGS[workflowId];
    
    if (!config) {
      console.error(`Unknown workflow: ${workflowId}`);
      return;
    }

    // Apply workflow configuration with batch state updates
    setCurrentWorkflow(workflowId);
    setActiveView(config.activeView);
    setShowAIAssistant(config.showAIAssistant);
    setShowMusicGen(config.showMusicGen);
    
    // Persist selections
    localStorage.setItem('hasSeenWorkflowSelector', 'true');
    localStorage.setItem('selectedWorkflow', workflowId);
    setShowWorkflowSelector(false);
    
    // Show success toast with workflow description
    toast({
      title: "Workflow Applied",
      description: config.description,
      duration: 4000,
    });

    // Special handling for guided beginner mode
    if (config.guidedMode) {
      setTimeout(() => {
        toast({
          title: "Welcome, Beginner!",
          description: "The AI Assistant is here to guide you. Click 'Generate Music' to get started quickly!",
          duration: 6000,
        });
      }, 1000);
    }
  };

  // Handle skip/close workflow selector
  const handleSkipWorkflow = () => {
    localStorage.setItem('hasSeenWorkflowSelector', 'true');
    setShowWorkflowSelector(false);
  };

  // Instrument categories
  const instrumentCategories = {
    Piano: ['Grand Piano', 'Electric Piano', 'Synth Piano', 'Harpsichord'],
    Bass: ['808 Bass', 'Synth Bass', 'Electric Bass', 'Upright Bass', 'Sub Bass'],
    Guitar: ['Acoustic Guitar', 'Electric Guitar', 'Classical Guitar', 'Bass Guitar'],
    Strings: ['Violin', 'Viola', 'Cello', 'Double Bass', 'String Ensemble'],
    Winds: ['Flute', 'Clarinet', 'Saxophone', 'Trumpet', 'Horn', 'Trombone'],
    Drums: ['Kick', 'Snare', 'Hi-Hat', 'Tom', 'Cymbal', 'Full Kit'],
    Synth: ['Lead Synth', 'Pad Synth', 'Arp Synth', 'Bass Synth'],
    Other: ['Percussion', 'Sound Effects', 'Vocal', 'Samples'],
  };

  const addTrack = (instrument: string, type: 'midi' | 'audio') => {
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `${instrument} ${tracks.length + 1}`,
      type,
      instrument,
      data: [],
      notes: [], // Initialize notes array for Piano Roll
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    setPianoRollExpanded(true);
  };

  // Playback is now controlled by Global Transport
  // This function prepares the track data for the Global Transport to play
  const preparePlaybackData = () => {
    const notesToPlay: Array<{ note: string; octave: number; time: number; track: Track }> = [];
    
    tracks.forEach(track => {
      if (!track.muted && track.notes && track.notes.length > 0) {
        track.notes.forEach(note => {
          notesToPlay.push({
            note: note.note, // Keep note name as-is (already has #)
            octave: note.octave,
            time: note.step * 0.125, // 4 steps per beat, 0.5s per beat = 0.125s per step
            track
          });
        });
      }
    });
    
    return notesToPlay;
  };

  // Map UI instrument names to General MIDI Soundfont names DIRECTLY
  const mapInstrumentName = (uiName: string): string => {
    const mapping: Record<string, string> = {
      // Piano
      'Grand Piano': 'acoustic_grand_piano',
      'Electric Piano': 'electric_piano_1',
      'Synth Piano': 'electric_piano_2',
      'Harpsichord': 'harpsichord',
      
      // Bass - CORRECT General MIDI mappings
      '808 Bass': 'synth_bass_2', // Deep electronic bass (play low notes for 808 effect)
      'Synth Bass': 'synth_bass_1', // Standard synth bass
      'Electric Bass': 'electric_bass_finger', // Fingered electric bass (standard)
      'Upright Bass': 'acoustic_bass', // Acoustic upright/double bass
      'Sub Bass': 'fretless_bass', // Smooth, deep fretless bass
      
      // Guitar
      'Acoustic Guitar': 'acoustic_guitar_steel',
      'Electric Guitar': 'electric_guitar_clean',
      'Classical Guitar': 'acoustic_guitar_nylon',
      'Bass Guitar': 'electric_bass_pick',
      
      // Strings - EACH ONE DIFFERENT
      'Violin': 'violin',
      'Viola': 'viola',
      'Cello': 'cello',
      'Double Bass': 'contrabass',
      'String Ensemble': 'string_ensemble_1',
      
      // Winds - MORE VARIETY
      'Flute': 'flute',
      'Clarinet': 'clarinet',
      'Saxophone': 'tenor_sax',
      'Trumpet': 'trumpet',
      'Horn': 'french_horn',
      'Trombone': 'trombone',
      
      // Synth
      'Lead Synth': 'lead_1_square',
      'Pad Synth': 'pad_2_warm',
      'Arp Synth': 'lead_2_sawtooth',
      'Bass Synth': 'synth_bass_1',
      
      // Drums - CORRECT General MIDI percussion instruments
      'Kick': 'taiko_drum', // Deep Japanese drum (closest to kick)
      'Snare': 'steel_drums', // Sharp metallic hit (snare crack, no lollipop sound)
      'Hi-Hat': 'agogo', // Metallic bell sound (hi-hat)
      'Tom': 'melodic_tom', // Actual melodic tom drum
      'Cymbal': 'reverse_cymbal', // Cymbal crash/splash sound
      'Full Kit': 'synth_drum', // Multi-purpose drum
      
      // Other category - ACTUAL INSTRUMENTS
      'Percussion': 'timpani',
      'Sound Effects': 'synth_voice',
      'Vocal': 'choir_aahs',
      'Samples': 'orchestral_harp',
    };
    
    return mapping[uiName] || 'acoustic_grand_piano';
  };

  // Play a note with the REAL audio engines (Synthesis for instruments, realisticAudio for drums)
  const playNote = async (note: string, octave: number, instrumentType?: string) => {
    try {
      // Get current track's instrument or use default
      const currentTrack = tracks.find(t => t.id === selectedTrack);
      let uiInstrument = instrumentType || currentTrack?.instrument || 'Grand Piano';
      
      // GET VOLUME AND PAN FROM TRACK
      const trackVolume = currentTrack?.volume ?? 0.8;
      const trackPan = currentTrack?.pan ?? 0;
      
      // Check if it's a drum instrument - use realisticAudio drum synthesis
      const drumMap: Record<string, string> = {
        'Kick': 'kick',
        'Snare': 'snare',
        'Hi-Hat': 'hihat',
        'Tom': 'tom',
        'Cymbal': 'crash',
        'Full Kit': 'kick'
      };
      
      if (drumMap[uiInstrument]) {
        // Use real drum synthesis from realisticAudio WITH TRACK VOLUME
        await realisticAudio.playDrumSound(drumMap[uiInstrument], trackVolume);
        return;
      }
      
      // For melodic instruments, use the RealisticAudioEngine with General MIDI soundfonts
      // This supports ALL instruments: trumpet, synth bass, violin, flute, etc.
      const midiInstrument = mapInstrumentName(uiInstrument);
      
      console.log(`🎹 Playing ${note}${octave} with instrument: ${uiInstrument} → ${midiInstrument}`);
      
      // Play using RealisticAudioEngine (soundfont-player) WITH TRACK VOLUME
      await realisticAudio.playNote(note, octave, trackVolume, midiInstrument, 0.5);
      
      // TODO: Apply pan using Web Audio API StereoPannerNode
    } catch (error) {
      console.error('Error playing note:', error);
    }
  };

  // Handle grid click based on tool mode
  const addNoteToGrid = (note: string, octave: number, barPosition: number) => {
    if (!selectedTrack) {
      toast({
        title: "No Track Selected",
        description: "Please select a MIDI track first",
        variant: "destructive",
      });
      return;
    }
    
    // Don't replace # with Sharp - keep note name as-is
    const noteStr = note;
    
    if (pianoRollTool === 'erase') {
      // Erase mode - remove notes at this position
      setTracks(tracks.map(t => {
        if (t.id === selectedTrack) {
          const existingNotes = t.notes || [];
          const filtered = existingNotes.filter(n => 
            !(n.note === noteStr && n.octave === octave && n.step === barPosition)
          );
          return { ...t, notes: filtered };
        }
        return t;
      }));
      toast({
        title: "Note Erased",
        description: `Removed ${note}${octave} at bar ${barPosition + 1}`,
        duration: 1000,
      });
      return;
    }
    
    if (pianoRollTool === 'draw') {
      // Draw mode - add note using unified Note structure
      const newNote: Note = {
        id: `note-${Date.now()}`,
        note: noteStr,
        octave,
        step: barPosition,  // Position in steps
        velocity: 100,      // Default velocity
        length: 4,          // Default length (4 steps = 1 beat)
      };
      
      setTracks(tracks.map(t => {
        if (t.id === selectedTrack) {
          const existingNotes = t.notes || [];
          return { ...t, notes: [...existingNotes, newNote] };
        }
        return t;
      }));
      
      playNote(note, octave);
    }
    
    // Select mode - just preview the note
    if (pianoRollTool === 'select') {
      playNote(note, octave);
    }
  };

  // File menu actions
  const handleNewProject = () => {
    if (confirm('Create new project? This will clear all tracks.')) {
      setTracks([]);
      toast({
        title: "New Project",
        description: "Created new empty project",
      });
    }
  };

  const handleSaveProject = () => {
    const projectData = {
      tracks,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('unifiedStudioProject', JSON.stringify(projectData));
    toast({
      title: "Project Saved",
      description: "Your project has been saved locally",
    });
  };

  const handleLoadProject = () => {
    const saved = localStorage.getItem('unifiedStudioProject');
    if (saved) {
      const projectData = JSON.parse(saved);
      setTracks(projectData.tracks);
      toast({
        title: "Project Loaded",
        description: "Project loaded successfully",
      });
    } else {
      toast({
        title: "No Project Found",
        description: "No saved project found",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    toast({
      title: "Export",
      description: "Export feature coming soon!",
    });
  };

  const handleMusicGenerated = (audioUrl: string, metadata: any) => {
    // Add generated music as a new track
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Generated - ${metadata.genre}`,
      type: 'audio',
      instrument: metadata.provider,
      data: { audioUrl, metadata },
      notes: [], // Initialize notes array
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    setShowMusicGen(false);
  };

  const handleLyricsSaved = (lyrics: string, sections: any[]) => {
    // Add or update lyrics track
    const lyricsTrack = tracks.find(t => t.type === 'lyrics');
    if (lyricsTrack) {
      setTracks(tracks.map(t =>
        t.type === 'lyrics' ? { ...t, data: { lyrics, sections } } : t
      ));
    } else {
      const newTrack: Track = {
        id: `track-${Date.now()}`,
        name: 'Lyrics',
        type: 'lyrics',
        data: { lyrics, sections },
        notes: [], // Initialize notes array
        volume: 1,
        pan: 0,
        muted: false,
        solo: false,
      };
      setTracks([...tracks, newTrack]);
    }
    setShowLyricsFocus(false);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">🎵 Unified Studio</h1>
          <div className="flex space-x-1">
            <div className="relative group">
              <Button variant="ghost" size="sm">File ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-40 z-50">
                <div onClick={handleNewProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">New Project</div>
                <div onClick={handleSaveProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">Save Project</div>
                <div onClick={handleLoadProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">Load Project</div>
                <div className="border-t border-gray-700"></div>
                <div onClick={handleExport} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">Export...</div>
              </div>
            </div>
            <div className="relative group">
              <Button variant="ghost" size="sm">Edit ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-40 z-50">
                <div onClick={() => toast({ title: "Undo" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">Undo</div>
                <div onClick={() => toast({ title: "Redo" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">Redo</div>
                <div className="border-t border-gray-700"></div>
                <div onClick={() => toast({ title: "Copy" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">Copy</div>
                <div onClick={() => toast({ title: "Paste" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">Paste</div>
              </div>
            </div>
            <div className="relative group">
              <Button variant="ghost" size="sm">View ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-48 z-50">
                <div onClick={() => setActiveView('arrangement')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  {activeView === 'arrangement' ? '✓' : '  '} Arrangement
                </div>
                <div onClick={() => setActiveView('piano-roll')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  {activeView === 'piano-roll' ? '✓' : '  '} Piano Roll
                </div>
                <div onClick={() => setActiveView('mixer')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  {activeView === 'mixer' ? '✓' : '  '} Mixer
                </div>
                <div onClick={() => setActiveView('ai-studio')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  {activeView === 'ai-studio' ? '✓' : '  '} AI Studio
                </div>
                <div onClick={() => setActiveView('lyrics')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  {activeView === 'lyrics' ? '✓' : '  '} Lyrics Lab
                </div>
                <div onClick={() => setActiveView('song-uploader')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  {activeView === 'song-uploader' ? '✓' : '  '} Song Uploader
                </div>
              </div>
            </div>
            
            {/* MIDI Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm" className="flex items-center gap-1">
                <Cable className="w-3 h-3" />
                MIDI ▼
                {midiConnected && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
              </Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-72 z-50 p-3 space-y-3">
                {/* MIDI Status */}
                <div className="pb-2 border-b border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">MIDI Controller</span>
                    <div className={`px-2 py-0.5 rounded text-xs font-semibold ${midiConnected ? 'bg-green-600' : 'bg-gray-600'}`}>
                      {midiConnected ? '● Connected' : '○ Disconnected'}
                    </div>
                  </div>
                  {!midiSupported && (
                    <div className="text-xs text-yellow-400">
                      ⚠️ Web MIDI not supported in this browser
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  {!midiConnected ? (
                    <button
                      onClick={() => {
                        initializeMIDI();
                        toast({ title: "Connecting to MIDI...", description: "Please wait..." });
                      }}
                      className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Cable className="w-4 h-4" />
                      Connect MIDI Controller
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        refreshMIDIDevices();
                        toast({ title: "Refreshing MIDI devices...", description: "Scanning for controllers" });
                      }}
                      className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh Devices
                    </button>
                  )}
                </div>

                {/* Connected Devices */}
                {midiConnected && midiDevices.length > 0 && (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-2">Connected ({midiDevices.length}):</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {midiDevices.slice(0, 3).map((device) => (
                        <div key={device.id} className="text-xs bg-gray-700/50 rounded px-2 py-1.5">
                          <div className="font-medium text-white truncate">{device.name}</div>
                          <div className="text-gray-400 truncate">{device.manufacturer}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Notes Indicator */}
                {midiConnected && midiActiveNotes.size > 0 && (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-green-400 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Playing: {Array.from(midiActiveNotes).join(', ')}
                    </div>
                  </div>
                )}

                {/* MIDI Volume Control */}
                {midiConnected && (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-300">🔊 MIDI Volume</span>
                      <span className="text-xs text-blue-400 font-bold">{Math.round((midiSettings?.midiVolume ?? 0.3) * 100)}%</span>
                    </div>
                    <Slider
                      value={[(midiSettings?.midiVolume ?? 0.3) * 100]}
                      onValueChange={(value) => {
                        const newVolume = value[0] / 100;
                        updateMIDISettings({ midiVolume: newVolume });
                      }}
                      max={100}
                      min={0}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Silent</span>
                      <span>Loud</span>
                    </div>
                  </div>
                )}

                {/* Current Instrument */}
                {midiConnected && (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Current Instrument:</div>
                    <select
                      value={midiSettings?.currentInstrument || 'piano'}
                      onChange={(e) => updateMIDISettings({ currentInstrument: e.target.value })}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                    >
                      <option value="piano">🎹 Piano</option>
                      <option value="guitar">🎸 Guitar</option>
                      <option value="violin">🎻 Violin</option>
                      <option value="flute">🎵 Flute</option>
                      <option value="trumpet">🎺 Trumpet</option>
                      <option value="bass">🎸 Bass</option>
                      <option value="organ">🎹 Organ</option>
                    </select>
                  </div>
                )}

                {/* Advanced MIDI Settings */}
                {midiConnected && (
                  <div className="pt-2 border-t border-gray-700 space-y-2">
                    <div className="text-xs font-semibold text-gray-300 mb-2">⚙️ Advanced Options</div>
                    
                    {/* Sustain Pedal */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300">Sustain Pedal</span>
                        <span className="text-xs text-gray-500">(CC 64)</span>
                      </div>
                      <Switch
                        checked={midiSettings?.sustainPedal !== false}
                        onCheckedChange={(checked) => {
                          updateMIDISettings({ sustainPedal: checked });
                          toast({ 
                            title: checked ? "Sustain Pedal Enabled" : "Sustain Pedal Disabled",
                            description: checked ? "Pedal will hold notes" : "Pedal has no effect",
                            duration: 2000 
                          });
                        }}
                      />
                    </div>

                    {/* Pitch Bend */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300">Pitch Bend</span>
                        <span className="text-xs text-gray-500">(±2 semitones)</span>
                      </div>
                      <Switch
                        checked={midiSettings?.pitchBend !== false}
                        onCheckedChange={(checked) => {
                          updateMIDISettings({ pitchBend: checked });
                          toast({ 
                            title: checked ? "Pitch Bend Enabled" : "Pitch Bend Disabled",
                            description: checked ? "Bend wheel affects pitch" : "Bend wheel ignored",
                            duration: 2000 
                          });
                        }}
                      />
                    </div>

                    {/* Modulation */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300">Modulation</span>
                        <span className="text-xs text-gray-500">(CC 1)</span>
                      </div>
                      <Switch
                        checked={midiSettings?.modulation !== false}
                        onCheckedChange={(checked) => {
                          updateMIDISettings({ modulation: checked });
                          toast({ 
                            title: checked ? "Modulation Enabled" : "Modulation Disabled",
                            description: checked ? "Mod wheel adds vibrato" : "Mod wheel ignored",
                            duration: 2000 
                          });
                        }}
                      />
                    </div>

                    {/* Auto-Connect New Devices */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300">Auto-Connect</span>
                        <span className="text-xs text-gray-500">(New devices)</span>
                      </div>
                      <Switch
                        checked={midiSettings?.autoConnect !== false}
                        onCheckedChange={(checked) => {
                          updateMIDISettings({ autoConnect: checked });
                          toast({ 
                            title: checked ? "Auto-Connect Enabled" : "Auto-Connect Disabled",
                            description: checked ? "New devices connect automatically" : "Manual connection required",
                            duration: 2000 
                          });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Help Text */}
                <div className="pt-2 border-t border-gray-700 text-xs text-gray-400">
                  💡 MIDI works across all tabs - play Piano Roll, Arrangement, Mixer in real-time!
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Transport Controls */}
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowMusicGen(!showMusicGen)}
            className="bg-purple-600 hover:bg-purple-500"
          >
            <Music className="w-4 h-4 mr-2" />
            Generate Music
          </Button>
          <Button
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            className="bg-blue-600 hover:bg-blue-500"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            AI Assistant
          </Button>
          <Button
            onClick={() => setShowWorkflowSelector(true)}
            className="bg-green-600 hover:bg-green-500"
            data-testid="button-change-workflow"
          >
            <Workflow className="w-4 h-4 mr-2" />
            Change Workflow
          </Button>
          
          {/* Master Volume Control */}
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded border border-gray-700">
            <Sliders className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400 font-medium">Master</span>
            <div className="w-24">
              <Slider
                value={[masterVolume * 100]}
                onValueChange={(value) => {
                  const newVolume = value[0] / 100;
                  setMasterVolume(newVolume);
                  setMIDIMasterVolume(newVolume); // Actually update audio gain
                }}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
            </div>
            <span className="text-xs text-white font-bold w-8 text-right">{Math.round(masterVolume * 100)}%</span>
          </div>
          
          <div className="text-sm text-gray-400 italic">
            Use Global Transport to play ▶
          </div>
          <Button variant="outline" size="sm">
            <i className="fas fa-undo mr-2"></i>
            Undo
          </Button>
          <Button variant="outline" size="sm">
            <i className="fas fa-redo mr-2"></i>
            Redo
          </Button>
        </div>
      </div>

      {/* DAW-Style Tab Bar */}
      <div className="bg-gray-850 border-b border-gray-700 px-2 flex items-center space-x-1 h-10 flex-shrink-0">
        <Button
          variant={activeView === 'arrangement' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('arrangement')}
          className="h-8 px-3"
        >
          <Layers className="w-3 h-3 mr-1.5" />
          Arrangement
        </Button>
        <Button
          variant={activeView === 'piano-roll' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('piano-roll')}
          className="h-8 px-3"
        >
          <Piano className="w-3 h-3 mr-1.5" />
          Piano Roll
        </Button>
        <Button
          variant={activeView === 'mixer' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('mixer')}
          className="h-8 px-3"
        >
          <Sliders className="w-3 h-3 mr-1.5" />
          Mixer
        </Button>
        <Button
          variant={activeView === 'ai-studio' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('ai-studio')}
          className="h-8 px-3"
        >
          <Music className="w-3 h-3 mr-1.5" />
          AI Studio
        </Button>
        <Button
          variant={activeView === 'lyrics' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('lyrics')}
          className="h-8 px-3"
        >
          <Mic2 className="w-3 h-3 mr-1.5" />
          Lyrics Lab
        </Button>
        <Button
          variant={activeView === 'song-uploader' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('song-uploader')}
          className="h-8 px-3"
        >
          <Upload className="w-3 h-3 mr-1.5" />
          Song Uploader
        </Button>
        <Button
          variant={activeView === 'code-to-music' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('code-to-music')}
          className="h-8 px-3"
        >
          <Wand2 className="w-3 h-3 mr-1.5" />
          Code to Music
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Instrument Library - Always visible */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-gray-700">
            <Input
              placeholder="Search instruments..."
              className="w-full"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {Object.entries(instrumentCategories).map(([category, instruments]) => (
                <div key={category}>
                  <button
                    className="w-full text-left px-2 py-1.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 rounded flex items-center"
                    onClick={() => {
                      // Toggle category expansion
                    }}
                  >
                    <ChevronRight className="w-4 h-4 mr-1" />
                    {category}
                  </button>
                  <div className="ml-4 space-y-0.5">
                    {instruments.map((inst) => (
                      <button
                        key={inst}
                        onClick={() => addTrack(inst, 'midi')}
                        className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-blue-600 hover:text-white rounded"
                        title={`Click to add ${inst} track`}
                      >
                        + {inst}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Main Workspace with Tab Views */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ARRANGEMENT VIEW */}
          {activeView === 'arrangement' && (
          <>
          {/* Timeline Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setTimelineExpanded(!timelineExpanded)}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center justify-between"
            >
              <span className="font-medium">
                {timelineExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
                TIMELINE - ALL TRACKS ({tracks.length})
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast({
                      title: "🪄 AI Arrangement",
                      description: "AI will suggest optimal track arrangement, structure, and transitions"
                    });
                  }}
                  className="text-xs bg-gradient-to-r from-purple-600 to-blue-600"
                >
                  <Wand2 className="w-3 h-3 mr-1" />
                  AI Arrange
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    addTrack('New Track', 'midi');
                  }}
                  className="text-xs"
                >
                  <i className="fas fa-plus mr-1"></i>
                  Add Track
                </Button>
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <span>Zoom:</span>
                  <Slider
                    value={zoom}
                    onValueChange={setZoom}
                    max={100}
                    min={10}
                    step={1}
                    className="w-24"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>{zoom[0]}%</span>
                </div>
              </div>
            </button>
            
            {timelineExpanded && (
              <div className="bg-gray-900 p-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {tracks.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => {
                        setSelectedTrack(track.id);
                        if (track.type === 'midi') {
                          setPianoRollExpanded(true);
                        } else if (track.type === 'lyrics') {
                          setLyricsExpanded(true);
                        }
                      }}
                      className={`border rounded overflow-hidden cursor-pointer transition ${
                        selectedTrack === track.id
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex">
                        {/* Track Info Panel */}
                        <div className="w-48 bg-gray-800 p-3 border-r border-gray-700 flex-shrink-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm truncate">{track.name}</span>
                          </div>
                          <div className="flex items-center space-x-1 mb-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTracks(tracks.map(t =>
                                  t.id === track.id ? { ...t, muted: !t.muted } : t
                                ));
                                toast({
                                  title: track.muted ? '🔊 Unmuted' : '🔇 Muted',
                                  description: `${track.name} is now ${track.muted ? 'unmuted' : 'muted'}`,
                                  duration: 1500,
                                });
                              }}
                              className={`h-6 w-6 p-0 transition-all ${
                                track.muted 
                                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/50' 
                                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                              }`}
                              title={track.muted ? 'Unmute Track' : 'Mute Track'}
                            >
                              M
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTracks(tracks.map(t =>
                                  t.id === track.id ? { ...t, solo: !t.solo } : t
                                ));
                                toast({
                                  title: track.solo ? '👥 Solo Off' : '⭐ Solo On',
                                  description: `${track.name} solo ${track.solo ? 'disabled' : 'enabled'}`,
                                  duration: 1500,
                                });
                              }}
                              className={`h-6 w-6 p-0 transition-all ${
                                track.solo 
                                  ? 'bg-yellow-600 text-white hover:bg-yellow-700 shadow-lg shadow-yellow-500/50' 
                                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                              }`}
                              title={track.solo ? 'Disable Solo' : 'Enable Solo'}
                            >
                              S
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTracks(tracks.filter(t => t.id !== track.id));
                              }}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                              title="Delete"
                            >
                              <i className="fas fa-trash text-xs"></i>
                            </Button>
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="text-gray-400">Type: <span className="text-gray-200">{track.type.toUpperCase()}</span></div>
                            {track.instrument && <div className="text-gray-400">Inst: <span className="text-gray-200">{track.instrument}</span></div>}
                            <div className="mt-2">
                              <div className="text-gray-400 mb-1">Vol: {Math.round(track.volume * 100)}%</div>
                              <Slider
                                value={[track.volume * 100]}
                                onValueChange={(val) => {
                                  setTracks(tracks.map(t =>
                                    t.id === track.id ? { ...t, volume: val[0] / 100 } : t
                                  ));
                                }}
                                max={100}
                                min={0}
                                step={1}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full"
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Track Timeline Visualization */}
                        <div className="flex-1 bg-gray-900 p-2 relative">
                          {track.type === 'audio' ? (
                            // Real Audio Waveform - Load from track.audioUrl
                            <div className="h-full flex items-center">
                              {track.audioUrl ? (
                                <div className="w-full h-16 bg-blue-900/20 border border-blue-700/50 rounded relative overflow-hidden">
                                  <canvas 
                                    id={`waveform-${track.id}`}
                                    className="w-full h-full"
                                    style={{ imageRendering: 'pixelated' }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center text-xs text-blue-400 pointer-events-none">
                                    {track.name}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-16 bg-gray-800/50 border border-gray-700 rounded flex items-center justify-center">
                                  <div className="text-xs text-gray-500">
                                    No audio file - Click to upload
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : track.type === 'midi' ? (
                            // MIDI blocks visualization - REAL NOTES
                            <div className="h-full flex items-center">
                              <div className="w-full h-12 relative">
                                {track.notes && track.notes.length > 0 ? (
                                  (() => {
                                    // Sort notes by step to process them in order
                                    const sortedNotes = [...track.notes].sort((a, b) => a.step - b.step);
                                    
                                    return sortedNotes.map((note, index) => {
                                      // Calculate note width, preventing overlap with next note
                                      let noteLength = note.length || 1;
                                      
                                      // Find next note that comes after this one
                                      const nextNote = sortedNotes.find((n, i) => i > index && n.step > note.step);
                                      
                                      if (nextNote) {
                                        // Limit length to not overlap with next note
                                        const maxLength = nextNote.step - note.step;
                                        noteLength = Math.min(noteLength, maxLength);
                                      }
                                      
                                      // Check if this note is currently playing
                                      const noteStartTime = note.step * 0.25; // Each step is 0.25 seconds
                                      const noteEndTime = noteStartTime + (noteLength * 0.25);
                                      const isCurrentlyPlaying = studioContext?.isPlaying && 
                                        playheadPosition >= noteStartTime && 
                                        playheadPosition <= noteEndTime;
                                      
                                      return (
                                        <div
                                          key={note.id}
                                          className={`absolute top-0 h-8 border rounded flex items-center justify-center text-xs cursor-move group transition-all ${
                                            isCurrentlyPlaying 
                                              ? 'bg-yellow-400 border-yellow-300 shadow-lg shadow-yellow-500/50 scale-110 z-10' 
                                              : 'bg-green-600/80 border-green-400 hover:bg-green-500'
                                          }`}
                                          style={{
                                            left: `${note.step * 15}px`, // 15px per step (4 steps per bar)
                                            width: `${Math.max(1, noteLength) * 15 - 2}px`, // -2px gap
                                          }}
                                          draggable
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('noteId', note.id);
                                            e.dataTransfer.setData('trackId', track.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                          }}
                                          onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                          }}
                                          onDrop={(e) => {
                                            e.preventDefault();
                                            const noteId = e.dataTransfer.getData('noteId');
                                            const trackId = e.dataTransfer.getData('trackId');
                                            if (trackId === track.id) {
                                              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                              if (rect) {
                                                const newStep = Math.round((e.clientX - rect.left) / 15);
                                                setTracks(tracks.map(t => {
                                                  if (t.id === track.id && t.notes) {
                                                    return {
                                                      ...t,
                                                      notes: t.notes.map(n => 
                                                        n.id === noteId ? { ...n, step: Math.max(0, newStep) } : n
                                                      )
                                                    };
                                                  }
                                                  return t;
                                                }));
                                              }
                                            }
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            playNote(note.note, note.octave, track.instrument);
                                          }}
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (confirm(`Delete note ${note.note}${note.octave}?`)) {
                                              setTracks(tracks.map(t => {
                                                if (t.id === track.id && t.notes) {
                                                  return {
                                                    ...t,
                                                    notes: t.notes.filter(n => n.id !== note.id)
                                                  };
                                                }
                                                return t;
                                              }));
                                              toast({
                                                title: '🗑️ Note Deleted',
                                                description: `${note.note}${note.octave} removed from timeline`,
                                                duration: 1500,
                                              });
                                            }
                                          }}
                                          title={`${note.note}${note.octave} - Click: play | Drag: move | Right-click: delete`}
                                        >
                                          {note.note}{note.octave}
                                          {/* Resize handle */}
                                          <div
                                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-green-300/0 hover:bg-green-300/50 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              const startX = e.clientX;
                                              const startWidth = noteLength * 15;
                                              
                                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                                const deltaX = moveEvent.clientX - startX;
                                                const newWidth = Math.max(15, startWidth + deltaX);
                                                const newLength = Math.round(newWidth / 15);
                                                
                                                setTracks(tracks.map(t => {
                                                  if (t.id === track.id && t.notes) {
                                                    return {
                                                      ...t,
                                                      notes: t.notes.map(n => 
                                                        n.id === note.id ? { ...n, length: newLength } : n
                                                      )
                                                    };
                                                  }
                                                  return t;
                                                }));
                                              };
                                              
                                              const handleMouseUp = () => {
                                                document.removeEventListener('mousemove', handleMouseMove);
                                                document.removeEventListener('mouseup', handleMouseUp);
                                              };
                                              
                                              document.addEventListener('mousemove', handleMouseMove);
                                              document.addEventListener('mouseup', handleMouseUp);
                                            }}
                                            title="Drag to resize"
                                          />
                                        </div>
                                      );
                                    });
                                  })()
                                ) : (
                                  <div className="text-xs text-gray-500 text-center">
                                    No notes - Add notes in Piano Roll
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            // Lyrics blocks
                            <div className="h-full flex items-center">
                              <div className="text-sm text-purple-400 truncate">
                                🎤 [Verse 1] Walking down this empty street...
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {tracks.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="mb-2">
                        <i className="fas fa-music text-4xl opacity-20"></i>
                      </div>
                      <p className="mb-2">No tracks yet</p>
                      <p className="text-xs">Click instruments from the left panel or use the "+ Add Track" button above</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Piano Roll Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setPianoRollExpanded(!pianoRollExpanded)}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center"
            >
              {pianoRollExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
              PIANO ROLL {selectedTrack && `(${tracks.find(t => t.id === selectedTrack)?.name})`}
            </button>
            
            {pianoRollExpanded && selectedTrack && (
              <div className="bg-gray-900">
                <VerticalPianoRoll 
                  tracks={tracks as any}
                  selectedTrack={selectedTrack || undefined}
                  isPlaying={studioContext?.isPlaying}
                  currentTime={playheadPosition}
                  onPlayNote={(note, octave, duration, instrument) => {
                    playNote(note, octave, instrument);
                  }}
                  onNotesChange={(updatedNotes) => {
                    if (selectedTrack) {
                      setTracks(tracks.map(t => 
                        t.id === selectedTrack 
                          ? { ...t, notes: updatedNotes }
                          : t
                      ));
                    }
                  }}
 />
              </div>
            )}
          </div>

          {/* Lyrics Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setLyricsExpanded(!lyricsExpanded)}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center justify-between"
            >
              <span>
                {lyricsExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
                LYRICS EDITOR
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLyricsFocus(true);
                }}
              >
                <Maximize2 className="w-4 h-4 mr-1" />
                Focus Mode
              </Button>
            </button>
            
            {lyricsExpanded && (
              <div className="bg-gray-900 p-4">
                <div className="border border-gray-700 rounded p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Song Lyrics</h3>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <i className="fas fa-magic mr-1"></i>
                        AI Suggest (Grok)
                      </Button>
                      <Button size="sm" variant="outline">
                        Rhyme Help
                      </Button>
                    </div>
                  </div>
                  
                  <textarea
                    className="w-full h-48 bg-gray-800 border border-gray-700 rounded p-3 text-sm resize-none"
                    placeholder="Write your lyrics here...

[Verse 1]
Your lyrics will sync with the timeline

[Chorus]
..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mixer Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setMixerExpanded(!mixerExpanded)}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center"
            >
              {mixerExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
              MIXER & EFFECTS {selectedTrack && `(${tracks.find(t => t.id === selectedTrack)?.name})`}
            </button>
            
            {mixerExpanded && selectedTrack && (
              <div className="bg-gray-900 p-4">
                <div className="border border-gray-700 rounded p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Volume</label>
                      <Slider
                        value={[tracks.find(t => t.id === selectedTrack)?.volume || 0.8]}
                        onValueChange={(val) => {
                          setTracks(tracks.map(t =>
                            t.id === selectedTrack ? { ...t, volume: val[0] } : t
                          ));
                        }}
                        max={1}
                        min={0}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Pan</label>
                      <Slider
                        value={[tracks.find(t => t.id === selectedTrack)?.pan || 0]}
                        onValueChange={(val) => {
                          setTracks(tracks.map(t =>
                            t.id === selectedTrack ? { ...t, pan: val[0] } : t
                          ));
                        }}
                        max={1}
                        min={-1}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Effects Chain</label>
                      <div className="flex space-x-1">
                        <Button size="sm" variant="outline">EQ</Button>
                        <Button size="sm" variant="outline">Comp</Button>
                        <Button size="sm" variant="outline">Reverb</Button>
                        <Button size="sm" variant="outline">+ Add</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </>
          )}

          {/* PIANO ROLL VIEW */}
          {activeView === 'piano-roll' && (
            <div className="flex-1 overflow-hidden bg-gray-900">
              <VerticalPianoRoll 
                tracks={tracks as any}
                selectedTrack={selectedTrack || undefined}
                isPlaying={studioContext?.isPlaying}
                currentTime={playheadPosition}
                onPlayNote={(note, octave, duration, instrument) => {
                  // Play note with current track's instrument
                  playNote(note, octave, instrument);
                }}
                onNotesChange={(updatedNotes) => {
                  // Update the notes for the selected track
                  if (selectedTrack) {
                    setTracks(tracks.map(t => 
                      t.id === selectedTrack 
                        ? { ...t, notes: updatedNotes }
                        : t
                    ));
                  }
                }}
              />
            </div>
          )}

          {/* MIXER VIEW */}
          {activeView === 'mixer' && (
            <div className="flex-1 overflow-y-auto bg-gray-900">
              <ProfessionalMixer />
            </div>
          )}

          {/* AI STUDIO VIEW */}
          {activeView === 'ai-studio' && (
            <div className="flex-1 overflow-y-auto bg-gray-900">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
                <div className="lg:col-span-2">
                  <ProfessionalStudio />
                </div>
                <div className="lg:col-span-1">
                  <AudioAnalysisPanel 
                    audioUrl={studioContext?.uploadedSongAudio?.src}
                  />
                </div>
              </div>
            </div>
          )}

          {/* LYRICS LAB VIEW */}
          {activeView === 'lyrics' && (
            <div className="flex-1 overflow-y-auto bg-gray-900">
              <LyricLab />
            </div>
          )}

          {/* SONG UPLOADER VIEW */}
          {activeView === 'song-uploader' && (
            <div className="flex-1 overflow-y-auto bg-gray-900">
              <SongUploader />
            </div>
          )}

          {/* CODE TO MUSIC VIEW */}
          {activeView === 'code-to-music' && (
            <div className="flex-1 overflow-hidden">
              <CodeToMusicStudioV2 />
            </div>
          )}
        </div>
      </div>

      {/* Floating/Overlay Components */}
      {/* TEMPORARILY DISABLED - React hooks error on mobile */}
      {/* {showAIAssistant && (
        <FloatingAIAssistant onClose={() => setShowAIAssistant(false)} />
      )} */}

      {showMusicGen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <Button
              onClick={() => setShowMusicGen(false)}
              variant="ghost"
              className="mb-2"
            >
              <i className="fas fa-times mr-2"></i>
              Close
            </Button>
            <MusicGenerationPanel onMusicGenerated={handleMusicGenerated} />
          </div>
        </div>
      )}

      {showLyricsFocus && (
        <LyricsFocusMode
          onClose={() => setShowLyricsFocus(false)}
          onSave={handleLyricsSaved}
        />
      )}

      {/* Workflow Selector Modal */}
      <Dialog open={showWorkflowSelector} onOpenChange={setShowWorkflowSelector}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0 bg-background">
          <WorkflowSelector
            onSelectWorkflow={handleSelectWorkflow}
            onSkip={handleSkipWorkflow}
          />
        </DialogContent>
      </Dialog>

      {/* Global Transport Controls - Always available */}
      <TransportControls currentTool="Unified Studio" activeTab={activeView} />
    </div>
  );
}
