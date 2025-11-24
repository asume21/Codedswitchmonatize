import { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { StudioAudioContext } from '@/pages/studio';
import { ChevronDown, ChevronRight, ChevronLeft, Maximize2, Minimize2, MessageSquare, Music, Sliders, Piano, Layers, Mic2, FileText, Wand2, Upload, Cable, RefreshCw, Settings, Workflow, Wrench, Play, Pause, Square, Repeat } from 'lucide-react';
import FloatingAIAssistant from './FloatingAIAssistant';
import AIAssistant from './AIAssistant';
import MusicGenerationPanel from './MusicGenerationPanel';
import LyricsFocusMode from './LyricsFocusMode';
import ProfessionalStudio from './ProfessionalStudio';
import LyricLab from './LyricLab';
import CodeToMusicStudioV2 from './CodeToMusicStudioV2';
import VerticalPianoRoll from './VerticalPianoRoll';
import ProfessionalMixer from './ProfessionalMixer';
import SongUploader from './SongUploader';
import WorkflowSelector from './WorkflowSelector';
import type { WorkflowPreset } from './WorkflowSelector';
import { useToast } from '@/hooks/use-toast';
import { useMIDI } from '@/hooks/use-midi';
import { realisticAudio } from '@/lib/realisticAudio';
import { AudioEngine } from '@/lib/audio';
import AudioAnalysisPanel from './AudioAnalysisPanel';
import AudioToolsPage from './AudioToolsPage';
import type { Note } from './types/pianoRollTypes';
import BeatLab from './BeatLab';
import { useTransport } from '@/contexts/TransportContext';
import { useTracks, type StudioTrack } from '@/hooks/useTracks';

// Workflow Configuration Types
interface WorkflowConfig {
  activeView: 'arrangement' | 'piano-roll' | 'mixer' | 'ai-studio' | 'lyrics' | 'song-uploader' | 'code-to-music' | 'audio-tools' | 'beat-lab';
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

export default function UnifiedStudioWorkspace() {
  const studioContext = useContext(StudioAudioContext);
  const { toast } = useToast();
  const {
    tempo,
    setTempo: setTransportTempo,
    position,
    isPlaying: transportPlaying,
    play: startTransport,
    pause: pauseTransport,
    stop: stopTransport,
    loop,
    setLoop,
    seek,
  } = useTransport();
  const {
    tracks,
    addTrack: addTrackToStore,
    updateTrack: updateTrackInStore,
    removeTrack: removeTrackFromStore,
  } = useTracks();
  
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
  
  
  // Main View State (DAW-style tabs)
  const [activeView, setActiveView] = useState<'arrangement' | 'piano-roll' | 'mixer' | 'ai-studio' | 'lyrics' | 'song-uploader' | 'code-to-music' | 'audio-tools' | 'beat-lab'>('arrangement');
  
  // Section expansion states
  const [instrumentsExpanded, setInstrumentsExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [pianoRollExpanded, setPianoRollExpanded] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [mixerExpanded, setMixerExpanded] = useState(false);

  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [zoom, setZoom] = useState([50]);
  const playheadPosition = position * 4; // Convert beats to 16th-note steps
  
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
  const setTracks = useCallback((next: StudioTrack[] | ((prev: StudioTrack[]) => StudioTrack[])) => {
    const nextTracks = typeof next === 'function' ? (next as (prev: StudioTrack[]) => StudioTrack[])(tracks as StudioTrack[]) : next;
    const nextIds = new Set(nextTracks.map((t) => t.id));

    tracks.forEach((track) => {
      if (!nextIds.has(track.id)) {
        removeTrackFromStore(track.id);
      }
    });

    nextTracks.forEach((track) => {
      const payload = {
        ...(track as any).payload,
        type: track.type ?? 'midi',
        instrument: track.instrument,
        notes: track.notes,
        audioUrl: track.audioUrl,
        volume: track.volume ?? 0.8,
        pan: track.pan ?? 0,
        data: track.data,
      };

      if (tracks.some((existing) => existing.id === track.id)) {
        updateTrackInStore(track.id, {
          name: track.name,
          muted: track.muted,
          solo: track.solo,
          payload,
          type: track.type,
          instrument: track.instrument,
          notes: track.notes,
          audioUrl: track.audioUrl,
          volume: track.volume,
          pan: track.pan,
        });
      } else {
        addTrackToStore({
          id: track.id,
          name: track.name,
          type: (track.type ?? 'midi') as any,
          instrument: track.instrument,
          notes: track.notes,
          audioUrl: track.audioUrl,
          muted: track.muted,
          solo: track.solo,
          volume: track.volume ?? 0.8,
          pan: track.pan ?? 0,
          lengthBars: (track as any).lengthBars ?? 4,
          startBar: (track as any).startBar ?? 0,
          payload,
        });
      }
    });
  }, [tracks, addTrackToStore, updateTrackInStore, removeTrackFromStore]);
  const ensureDefaultTrack = useCallback(() => {
    if (tracks.length === 0) {
      const defaultTrack: StudioTrack = {
        id: 'track-1',
        name: 'Piano 1',
        kind: 'midi',
        type: 'midi',
        instrument: 'piano',
        data: [],
        notes: [],
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        lengthBars: 4,
        startBar: 0,
        payload: {},
      };
      setTracks([defaultTrack]);
      setSelectedTrack(defaultTrack.id);
    }
  }, [setTracks, tracks, setSelectedTrack]);
  
  useEffect(() => {
    ensureDefaultTrack();
    if (!selectedTrack && tracks.length > 0) {
      setSelectedTrack(tracks[0].id);
    } else if (selectedTrack && !tracks.some(track => track.id === selectedTrack)) {
      setSelectedTrack(tracks[0]?.id ?? null);
    }
  }, [ensureDefaultTrack, tracks, selectedTrack]);

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
    const newTrack: StudioTrack = {
      id: `track-${Date.now()}`,
      name: `${instrument} ${tracks.length + 1}`,
      kind: type === 'midi' ? 'midi' : 'audio',
      type,
      instrument,
      data: [],
      notes: [], // Initialize notes array for Piano Roll
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 4,
      startBar: 0,
      payload: {},
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    setPianoRollExpanded(true);
  };

  // Playback is now controlled by Global Transport
  // This function prepares the track data for the Global Transport to play
  const preparePlaybackData = () => {
    const notesToPlay: Array<{ note: string; octave: number; time: number; track: StudioTrack }> = [];
    
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
      const normalized: StudioTrack[] = (projectData.tracks ?? []).map((t: any) => ({
        ...t,
        id: t.id ?? `track-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
        type: t.type ?? 'midi',
        volume: t.volume ?? 0.8,
        pan: t.pan ?? 0,
        notes: t.notes ?? [],
        lengthBars: t.lengthBars ?? 4,
        startBar: t.startBar ?? 0,
        payload: t.payload ?? {},
      }));
      setTracks(normalized);
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
    // Create a simple audio export
    const projectData = {
      tracks,
      tempo,
      timestamp: new Date().toISOString(),
    };
    const dataStr = JSON.stringify(projectData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CodedSwitch-Project-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Project Exported",
      description: "Project exported as JSON file",
    });
  };

  // Edit menu actions
  const handleUndo = () => {
    toast({ title: "Undo", description: "Undo functionality coming soon" });
  };

  const handleRedo = () => {
    toast({ title: "Redo", description: "Redo functionality coming soon" });
  };

  const handleCut = () => {
    toast({ title: "Cut", description: "Selection cut to clipboard" });
  };

  const handleCopy = () => {
    toast({ title: "Copy", description: "Selection copied to clipboard" });
  };

  const handlePaste = () => {
    toast({ title: "Paste", description: "Pasted from clipboard" });
  };

  const handleDuplicate = () => {
    if (selectedTrack) {
      const trackToDupe = tracks.find(t => t.id === selectedTrack);
      if (trackToDupe) {
        const newTrack: StudioTrack = {
          ...trackToDupe,
          id: `track-${Date.now()}`,
          name: `${trackToDupe.name} (Copy)`,
        };
        setTracks([...tracks, newTrack]);
        toast({ title: "Duplicated", description: `Created copy of ${trackToDupe.name}` });
      }
    } else {
      toast({ title: "No Selection", description: "Select a track to duplicate" });
    }
  };

  const handleDelete = () => {
    if (selectedTrack) {
      setTracks(tracks.filter(t => t.id !== selectedTrack));
      setSelectedTrack(null);
      toast({ title: "Deleted", description: "Track deleted" });
    }
  };

  const handleSelectAll = () => {
    toast({ title: "Select All", description: "All items selected" });
  };

  // Create menu actions
  const handleNewMIDITrack = () => {
    const newTrack: StudioTrack = {
      id: `track-${Date.now()}`,
      name: `MIDI ${tracks.length + 1}`,
      kind: 'midi',
      type: 'midi',
      instrument: 'piano',
      notes: [],
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 4,
      startBar: 0,
      payload: {},
      data: {},
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    toast({ title: "MIDI Track Created", description: newTrack.name });
  };

  const handleNewAudioTrack = () => {
    const newTrack: StudioTrack = {
      id: `track-${Date.now()}`,
      name: `Audio ${tracks.length + 1}`,
      kind: 'audio',
      type: 'audio',
      instrument: 'audio',
      notes: [],
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 4,
      startBar: 0,
      payload: {},
      data: {},
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    toast({ title: "Audio Track Created", description: newTrack.name });
  };

  // Mix menu actions
  const handleNormalize = () => {
    toast({ title: "Normalize", description: "Audio normalized to 0dB" });
  };

  const handleReverse = () => {
    toast({ title: "Reverse", description: "Audio reversed" });
  };

  const handleBounceToAudio = () => {
    if (selectedTrack) {
      const track = tracks.find(t => t.id === selectedTrack);
      if (track) {
        const bounced: StudioTrack = {
          ...track,
          id: `track-${Date.now()}`,
          name: `${track.name} (Bounced)`,
          kind: 'audio',
          type: 'audio',
        };
        setTracks([...tracks, bounced]);
        toast({ title: "Bounced", description: `${track.name} bounced to audio` });
      }
    }
  };

  const handleGroupTracks = () => {
    toast({ title: "Group Tracks", description: "Selected tracks grouped" });
  };

  const handleSoloAll = () => {
    setTracks(tracks.map(t => ({ ...t, solo: true })));
    toast({ title: "Solo All", description: "All tracks soloed" });
  };

  const handleMuteAll = () => {
    setTracks(tracks.map(t => ({ ...t, muted: true })));
    toast({ title: "Mute All", description: "All tracks muted" });
  };

  const handleUnsoloAll = () => {
    setTracks(tracks.map(t => ({ ...t, solo: false })));
    toast({ title: "Unsolo All", description: "All tracks unsoloed" });
  };

  const handleUnmuteAll = () => {
    setTracks(tracks.map(t => ({ ...t, muted: false })));
    toast({ title: "Unmute All", description: "All tracks unmuted" });
  };

  const handleResetFaders = () => {
    setTracks(tracks.map(t => ({ ...t, volume: 0.8 })));
    toast({ title: "Reset Faders", description: "All faders reset to 0dB" });
  };

  const handleResetPan = () => {
    setTracks(tracks.map(t => ({ ...t, pan: 0 })));
    toast({ title: "Reset Pan", description: "All pan controls centered" });
  };

  // Arrange menu actions
  const handleLoopSelection = () => {
    setLoop({ enabled: true, start: 0, end: 4 });
    toast({ title: "Loop Enabled", description: "Selection looped" });
  };

  const handleAddMarker = () => {
    toast({ title: "Marker Added", description: `Marker at bar ${Math.floor(playheadPosition / 16) + 1}` });
  };

  const handleSnapToGrid = () => {
    toast({ title: "Snap to Grid", description: "Grid snapping toggled" });
  };

  // Window menu actions
  const handleResetLayout = () => {
    setInstrumentsExpanded(true);
    setActiveView('arrangement');
    toast({ title: "Layout Reset", description: "Default layout restored" });
  };

  // Tools menu actions
  const handleTuner = () => {
    toast({ title: "Tuner", description: "Tuner opened" });
  };

  const handleMetronome = () => {
    toast({ title: "Metronome", description: "Metronome toggled" });
  };

  const handleMusicGenerated = (audioUrl: string, metadata: any) => {
    // Add generated music as a new track
    const newTrack: StudioTrack = {
      id: `track-${Date.now()}`,
      name: `Generated - ${metadata.genre}`,
      kind: 'audio',
      type: 'audio',
      instrument: metadata.provider,
      data: { audioUrl, metadata },
      notes: [], // Initialize notes array
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 8,
      startBar: 0,
      payload: {},
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
      const newTrack: StudioTrack = {
        id: `track-${Date.now()}`,
        name: 'Lyrics',
        kind: 'aux',
        type: 'lyrics',
        data: { lyrics, sections },
        notes: [], // Initialize notes array
        volume: 1,
        pan: 0,
        muted: false,
        solo: false,
        lengthBars: 8,
        startBar: 0,
        payload: {},
      };
      setTracks([...tracks, newTrack]);
    }
    setShowLyricsFocus(false);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Top Bar */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-2 justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <h1 className="text-lg font-bold">🎵 Studio</h1>
          <div className="flex space-x-0.5">
            <div className="relative group">
              <Button variant="ghost" size="sm">File ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-50">
                <div onClick={handleNewProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>New Project</span>
                  <span className="text-xs text-gray-500">Ctrl+N</span>
                </div>
                <div onClick={handleLoadProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Open Project...</span>
                  <span className="text-xs text-gray-500">Ctrl+O</span>
                </div>
                <div onClick={() => toast({ title: "Recent Projects" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Recent Projects ▶
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleSaveProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Save Project</span>
                  <span className="text-xs text-gray-500">Ctrl+S</span>
                </div>
                <div onClick={() => toast({ title: "Save As..." })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Save As...</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+S</span>
                </div>
                <div onClick={() => toast({ title: "Save Template" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Save as Template...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => setActiveView('song-uploader')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Import Audio...</span>
                  <span className="text-xs text-gray-500">Ctrl+I</span>
                </div>
                <div onClick={() => toast({ title: "Import MIDI..." })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Import MIDI...
                </div>
                <div onClick={() => toast({ title: "Import Project..." })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Import Project...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleExport} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Export Audio...</span>
                  <span className="text-xs text-gray-500">Ctrl+E</span>
                </div>
                <div onClick={() => toast({ title: "Export MIDI..." })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Export MIDI...
                </div>
                <div onClick={() => toast({ title: "Export Stems..." })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Export Stems...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Project Settings" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Project Settings...
                </div>
                <div onClick={() => toast({ title: "Preferences" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Preferences...</span>
                  <span className="text-xs text-gray-500">Ctrl+,</span>
                </div>
              </div>
            </div>
            <div className="relative group">
              <Button variant="ghost" size="sm">Edit ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-50">
                <div onClick={handleUndo} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Undo</span>
                  <span className="text-xs text-gray-500">Ctrl+Z</span>
                </div>
                <div onClick={handleRedo} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Redo</span>
                  <span className="text-xs text-gray-500">Ctrl+Y</span>
                </div>
                <div onClick={() => toast({ title: "History..." })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  History...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleCut} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Cut</span>
                  <span className="text-xs text-gray-500">Ctrl+X</span>
                </div>
                <div onClick={handleCopy} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Copy</span>
                  <span className="text-xs text-gray-500">Ctrl+C</span>
                </div>
                <div onClick={handlePaste} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Paste</span>
                  <span className="text-xs text-gray-500">Ctrl+V</span>
                </div>
                <div onClick={handleDuplicate} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Duplicate</span>
                  <span className="text-xs text-gray-500">Ctrl+D</span>
                </div>
                <div onClick={handleDelete} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Delete</span>
                  <span className="text-xs text-gray-500">Del</span>
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleSelectAll} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Select All</span>
                  <span className="text-xs text-gray-500">Ctrl+A</span>
                </div>
                <div onClick={() => toast({ title: "Deselect All" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Deselect All</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+A</span>
                </div>
                <div onClick={() => toast({ title: "Invert Selection" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Invert Selection
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Split at Playhead" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Split at Playhead</span>
                  <span className="text-xs text-gray-500">Ctrl+K</span>
                </div>
                <div onClick={() => toast({ title: "Join Clips" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Join Clips</span>
                  <span className="text-xs text-gray-500">Ctrl+J</span>
                </div>
                <div onClick={() => toast({ title: "Quantize..." })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Quantize...</span>
                  <span className="text-xs text-gray-500">Ctrl+Q</span>
                </div>
                <div onClick={() => toast({ title: "Transpose..." })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Transpose...</span>
                  <span className="text-xs text-gray-500">Ctrl+T</span>
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Find..." })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Find...</span>
                  <span className="text-xs text-gray-500">Ctrl+F</span>
                </div>
                <div onClick={() => toast({ title: "Replace..." })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Replace...</span>
                  <span className="text-xs text-gray-500">Ctrl+H</span>
                </div>
              </div>
            </div>
            <div className="relative group">
              <Button variant="ghost" size="sm">View ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-50">
                <div onClick={() => setActiveView('arrangement')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>{activeView === 'arrangement' ? '✓' : '  '} Arrangement</span>
                  <span className="text-xs text-gray-500">F1</span>
                </div>
                <div onClick={() => setActiveView('beat-lab')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>{activeView === 'beat-lab' ? '✓' : '  '} Beat Lab</span>
                  <span className="text-xs text-gray-500">F2</span>
                </div>
                <div onClick={() => setActiveView('piano-roll')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>{activeView === 'piano-roll' ? '✓' : '  '} Piano Roll</span>
                  <span className="text-xs text-gray-500">F3</span>
                </div>
                <div onClick={() => setActiveView('mixer')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>{activeView === 'mixer' ? '✓' : '  '} Mixer</span>
                  <span className="text-xs text-gray-500">F4</span>
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => setActiveView('ai-studio')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>{activeView === 'ai-studio' ? '✓' : '  '} AI Studio</span>
                  <span className="text-xs text-gray-500">F5</span>
                </div>
                <div onClick={() => setActiveView('code-to-music')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>{activeView === 'code-to-music' ? '✓' : '  '} Code to Music</span>
                  <span className="text-xs text-gray-500">F6</span>
                </div>
                <div onClick={() => setActiveView('lyrics')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>{activeView === 'lyrics' ? '✓' : '  '} Lyrics</span>
                  <span className="text-xs text-gray-500">F7</span>
                </div>
                <div onClick={() => setActiveView('audio-tools')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>{activeView === 'audio-tools' ? '✓' : '  '} Audio Tools</span>
                  <span className="text-xs text-gray-500">F8</span>
                </div>
                <div onClick={() => setActiveView('song-uploader')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>{activeView === 'song-uploader' ? '✓' : '  '} Upload</span>
                  <span className="text-xs text-gray-500">F9</span>
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => setInstrumentsExpanded(!instrumentsExpanded)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>{instrumentsExpanded ? '✓' : '  '} Instrument Library</span>
                  <span className="text-xs text-gray-500">Ctrl+1</span>
                </div>
                <div onClick={() => toast({ title: "Browser toggled" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Sample Browser</span>
                  <span className="text-xs text-gray-500">Ctrl+2</span>
                </div>
                <div onClick={() => toast({ title: "Inspector toggled" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Inspector</span>
                  <span className="text-xs text-gray-500">Ctrl+3</span>
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Zoom In" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Zoom In</span>
                  <span className="text-xs text-gray-500">Ctrl++</span>
                </div>
                <div onClick={() => toast({ title: "Zoom Out" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Zoom Out</span>
                  <span className="text-xs text-gray-500">Ctrl+-</span>
                </div>
                <div onClick={() => toast({ title: "Zoom to Fit" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Zoom to Fit</span>
                  <span className="text-xs text-gray-500">Ctrl+0</span>
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Full Screen" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Full Screen</span>
                  <span className="text-xs text-gray-500">F11</span>
                </div>
                <div onClick={() => toast({ title: "Focus Mode" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Focus Mode</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+F</span>
                </div>
              </div>
            </div>

            {/* CREATE Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm">Create ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-50">
                <div onClick={handleNewMIDITrack} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>New MIDI Track</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+T</span>
                </div>
                <div onClick={handleNewAudioTrack} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>New Audio Track</span>
                  <span className="text-xs text-gray-500">Ctrl+T</span>
                </div>
                <div onClick={() => toast({ title: "New Instrument Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  New Instrument Track
                </div>
                <div onClick={() => toast({ title: "New Return Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  New Return Track
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Insert Audio Effect" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Insert Audio Effect...
                </div>
                <div onClick={() => toast({ title: "Insert MIDI Effect" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Insert MIDI Effect...
                </div>
                <div onClick={() => toast({ title: "Insert Instrument" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Insert Instrument...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "New Send" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  New Send
                </div>
                <div onClick={() => toast({ title: "New Bus" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  New Bus
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Empty Clip" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Empty Clip</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+M</span>
                </div>
                <div onClick={() => toast({ title: "Recording Clip" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Recording Clip
                </div>
              </div>
            </div>

            {/* ARRANGE Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm">Arrange ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-50">
                <div onClick={() => toast({ title: "Insert Time" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Insert Time...</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+I</span>
                </div>
                <div onClick={() => toast({ title: "Delete Time" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Delete Time...</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+Del</span>
                </div>
                <div onClick={() => toast({ title: "Duplicate Time" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Duplicate Time...</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+D</span>
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleLoopSelection} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Loop Selection</span>
                  <span className="text-xs text-gray-500">Ctrl+L</span>
                </div>
                <div onClick={() => toast({ title: "Set Loop Length" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Set Loop Length...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleAddMarker} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Add Marker</span>
                  <span className="text-xs text-gray-500">M</span>
                </div>
                <div onClick={() => toast({ title: "Add Locator" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Add Locator
                </div>
                <div onClick={() => toast({ title: "Marker List" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Marker List...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleSnapToGrid} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Snap to Grid</span>
                  <span className="text-xs text-gray-500">Ctrl+G</span>
                </div>
                <div onClick={() => toast({ title: "Grid Settings" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Grid Settings...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Tempo Map" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Tempo Map...
                </div>
                <div onClick={() => toast({ title: "Time Signature" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Time Signature...
                </div>
                <div onClick={() => toast({ title: "Key Signature" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Key Signature...
                </div>
              </div>
            </div>

            {/* MIX Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm">Mix ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-50">
                <div onClick={handleNormalize} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Normalize</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+N</span>
                </div>
                <div onClick={handleReverse} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Reverse</span>
                  <span className="text-xs text-gray-500">Ctrl+R</span>
                </div>
                <div onClick={() => toast({ title: "Fade In" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Fade In
                </div>
                <div onClick={() => toast({ title: "Fade Out" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Fade Out
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleBounceToAudio} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Bounce to Audio</span>
                  <span className="text-xs text-gray-500">Ctrl+B</span>
                </div>
                <div onClick={() => toast({ title: "Freeze Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Freeze Track
                </div>
                <div onClick={() => toast({ title: "Flatten Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Flatten Track
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleGroupTracks} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Group Tracks</span>
                  <span className="text-xs text-gray-500">Ctrl+G</span>
                </div>
                <div onClick={() => toast({ title: "Ungroup Tracks" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Ungroup Tracks</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+G</span>
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleSoloAll} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Solo All Tracks
                </div>
                <div onClick={handleMuteAll} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Mute All Tracks
                </div>
                <div onClick={handleUnsoloAll} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Unsolo All
                </div>
                <div onClick={handleUnmuteAll} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Unmute All
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleResetFaders} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Reset All Faders
                </div>
                <div onClick={handleResetPan} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Reset All Pan
                </div>
              </div>
            </div>

            {/* MORE Menu - Groups Tools, Window, Help */}
            <div className="relative group">
              <Button variant="ghost" size="sm">More ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-50">
                {/* Tools Submenu */}
                <div className="relative group/tools">
                  <div className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                    <span>🔧 Tools</span>
                    <span>▶</span>
                  </div>
                  <div className="hidden group-hover/tools:block absolute left-full top-0 bg-gray-800 border border-gray-700 rounded shadow-lg ml-1 w-56 z-50">
                    <div onClick={handleTuner} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                      <span>Tuner</span>
                      <span className="text-xs text-gray-500">Ctrl+Shift+U</span>
                    </div>
                    <div onClick={handleMetronome} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                      <span>Metronome</span>
                      <span className="text-xs text-gray-500">C</span>
                    </div>
                    <div onClick={() => toast({ title: "Click Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                      Click Track Settings...
                    </div>
                    <div className="border-t border-gray-700 my-1"></div>
                    <div onClick={() => toast({ title: "Spectrum Analyzer" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                      Spectrum Analyzer
                    </div>
                    <div onClick={() => toast({ title: "Chord Detector" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                      Chord Detector
                    </div>
                    <div onClick={() => toast({ title: "BPM Detector" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                      BPM Detector
                    </div>
                  </div>
                </div>

                {/* Window Submenu */}
                <div className="relative group/window">
                  <div className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                    <span>🪟 Window</span>
                    <span>▶</span>
                  </div>
                  <div className="hidden group-hover/window:block absolute left-full top-0 bg-gray-800 border border-gray-700 rounded shadow-lg ml-1 w-56 z-50">
                    <div onClick={handleResetLayout} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                      <span>Reset Layout</span>
                      <span className="text-xs text-gray-500">Ctrl+Alt+R</span>
                    </div>
                    <div onClick={() => setInstrumentsExpanded(!instrumentsExpanded)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                      {instrumentsExpanded ? '✓' : '  '} Show Instrument Library
                    </div>
                    <div onClick={() => toast({ title: "Full Screen" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                      <span>Full Screen</span>
                      <span className="text-xs text-gray-500">F11</span>
                    </div>
                  </div>
                </div>

                {/* Help Submenu */}
                <div className="relative group/help">
                  <div className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                    <span>❓ Help</span>
                    <span>▶</span>
                  </div>
                  <div className="hidden group-hover/help:block absolute left-full top-0 bg-gray-800 border border-gray-700 rounded shadow-lg ml-1 w-56 z-50">
                    <div onClick={() => toast({ title: "Keyboard Shortcuts" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                      <span>Keyboard Shortcuts</span>
                      <span className="text-xs text-gray-500">Ctrl+/</span>
                    </div>
                    <div onClick={() => toast({ title: "Documentation" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                      Documentation
                    </div>
                    <div className="border-t border-gray-700 my-1"></div>
                    <div onClick={() => toast({ title: "About CodedSwitch", description: "Professional AI Music Production Studio" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                      About CodedSwitch
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* OLD TOOLS Menu - REMOVE */}
            <div className="relative group hidden">
              <Button variant="ghost" size="sm">Tools ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-50">
                <div onClick={handleTuner} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Tuner</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+U</span>
                </div>
                <div onClick={handleMetronome} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Metronome</span>
                  <span className="text-xs text-gray-500">C</span>
                </div>
                <div onClick={() => toast({ title: "Click Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Click Track Settings...
                </div>
                <div onClick={() => toast({ title: "Count-In" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Count-In Settings...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Spectrum Analyzer" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Spectrum Analyzer
                </div>
                <div onClick={() => toast({ title: "Oscilloscope" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Oscilloscope
                </div>
                <div onClick={() => toast({ title: "Phase Meter" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Phase Meter
                </div>
                <div onClick={() => toast({ title: "Loudness Meter" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Loudness Meter
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Chord Detector" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Chord Detector
                </div>
                <div onClick={() => toast({ title: "Key Detector" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Key Detector
                </div>
                <div onClick={() => toast({ title: "BPM Detector" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  BPM Detector
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Audio to MIDI" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Audio to MIDI...
                </div>
                <div onClick={() => toast({ title: "MIDI Learn" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>MIDI Learn</span>
                  <span className="text-xs text-gray-500">Ctrl+M</span>
                </div>
              </div>
            </div>

            {/* WINDOW Menu - NOW IN MORE MENU */}
            <div className="relative group hidden">
              <Button variant="ghost" size="sm">Window ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-50">
                <div onClick={() => toast({ title: "Minimize" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Minimize</span>
                  <span className="text-xs text-gray-500">Ctrl+M</span>
                </div>
                <div onClick={() => toast({ title: "Maximize" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Maximize
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Tile Horizontally" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Tile Horizontally
                </div>
                <div onClick={() => toast({ title: "Tile Vertically" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Tile Vertically
                </div>
                <div onClick={() => toast({ title: "Cascade" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Cascade Windows
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={handleResetLayout} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Reset Layout</span>
                  <span className="text-xs text-gray-500">Ctrl+Alt+R</span>
                </div>
                <div onClick={() => toast({ title: "Save Layout" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Save Layout...
                </div>
                <div onClick={() => toast({ title: "Load Layout" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Load Layout...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => setInstrumentsExpanded(!instrumentsExpanded)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  {instrumentsExpanded ? '✓' : '  '} Show Instrument Library
                </div>
                <div onClick={() => toast({ title: "Browser toggled" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Show Browser
                </div>
                <div onClick={() => toast({ title: "Inspector toggled" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Show Inspector
                </div>
                <div onClick={() => toast({ title: "Mixer toggled" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Show Mixer Panel
                </div>
              </div>
            </div>

            {/* HELP Menu - NOW IN MORE MENU */}
            <div className="relative group hidden">
              <Button variant="ghost" size="sm">Help ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-50">
                <div onClick={() => toast({ title: "Keyboard Shortcuts" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                  <span>Keyboard Shortcuts</span>
                  <span className="text-xs text-gray-500">Ctrl+/</span>
                </div>
                <div onClick={() => toast({ title: "Getting Started" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Getting Started Guide
                </div>
                <div onClick={() => toast({ title: "Video Tutorials" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Video Tutorials
                </div>
                <div onClick={() => toast({ title: "Documentation" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Documentation
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Community Forum" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Community Forum
                </div>
                <div onClick={() => toast({ title: "Discord Server" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Join Discord
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Report Bug" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Report a Bug...
                </div>
                <div onClick={() => toast({ title: "Feature Request" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Request a Feature...
                </div>
                <div onClick={() => toast({ title: "Send Feedback" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Send Feedback...
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "Check for Updates" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Check for Updates...
                </div>
                <div onClick={() => toast({ title: "Release Notes" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  Release Notes
                </div>
                <div className="border-t border-gray-700 my-1"></div>
                <div onClick={() => toast({ title: "About CodedSwitch", description: "Professional AI Music Production Studio" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer">
                  About CodedSwitch
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
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 py-2">
            <Button
              size="sm"
              onClick={() => (transportPlaying ? pauseTransport() : startTransport())}
              className={transportPlaying ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500"}
            >
              {transportPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {transportPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                stopTransport();
                seek(0);
              }}
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="font-semibold">Bar {Math.max(1, Math.floor(playheadPosition / 16) + 1)}</span>
              <span className="text-gray-500">Beat {Math.max(1, Math.floor(position % 4) + 1)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 py-2">
            <Sliders className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-300 font-medium">Tempo</span>
            <div className="w-28">
              <Slider
                value={[tempo]}
                onValueChange={(value) => setTransportTempo(value[0])}
                max={200}
                min={40}
                step={1}
                className="w-full"
              />
            </div>
            <span className="text-xs text-white font-bold w-14 text-right">{Math.round(tempo)} BPM</span>
          </div>

          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 py-2">
            <Repeat className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-300 font-medium">Loop</span>
            <Switch
              checked={loop.enabled}
              onCheckedChange={(checked) => setLoop({ enabled: checked })}
            />
            {loop.enabled && (
              <span className="text-xs text-gray-400">
                Bars {loop.start + 1}-{loop.end}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLoop({ enabled: true, start: 0, end: 4 })}
            >
              4-Bar
            </Button>
          </div>

          <Button
            onClick={() => setShowMusicGen(!showMusicGen)}
            className="bg-purple-600 hover:bg-purple-500"
          >
            <Music className="w-4 h-4 mr-2" />
            Generate Music
          </Button>
          <Button
            onClick={() => {
              setActiveView('ai-studio');
            }}
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
        </div>
      </div>

      {/* DAW-Style Tab Bar - Reorganized for better UX */}
      <div className="bg-gray-850 border-b border-gray-700 px-2 flex items-center justify-between h-10 flex-shrink-0">
        {/* Primary Tabs - Core Production Tools */}
        <div className="flex items-center space-x-1">
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
            variant={activeView === 'beat-lab' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('beat-lab')}
            className="h-8 px-3"
          >
            <Music className="w-3 h-3 mr-1.5" />
            Beat Lab
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
        </div>

        {/* Undo/Redo Controls */}
        <div className="flex items-center space-x-1 border-l border-r border-gray-700 px-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleUndo}
            className="h-8 px-3"
            title="Undo (Ctrl+Z)"
          >
            <i className="fas fa-undo mr-1.5"></i>
            Undo
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRedo}
            className="h-8 px-3"
            title="Redo (Ctrl+Y)"
          >
            <i className="fas fa-redo mr-1.5"></i>
            Redo
          </Button>
        </div>

        {/* Secondary Tabs - AI & Tools */}
        <div className="flex items-center space-x-1">
          <Button
            variant={activeView === 'ai-studio' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('ai-studio')}
            className="h-8 px-3"
          >
            <Wand2 className="w-3 h-3 mr-1.5" />
            AI Studio
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
          <Button
            variant={activeView === 'lyrics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('lyrics')}
            className="h-8 px-3"
          >
            <Mic2 className="w-3 h-3 mr-1.5" />
            Lyrics
          </Button>
          <Button
            variant={activeView === 'audio-tools' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('audio-tools')}
            className="h-8 px-3"
          >
            <Wrench className="w-3 h-3 mr-1.5" />
            Tools
          </Button>
          <Button
            variant={activeView === 'song-uploader' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('song-uploader')}
            className="h-8 px-3"
          >
            <Upload className="w-3 h-3 mr-1.5" />
            Upload
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Instrument Library - Collapsible */}
        {instrumentsExpanded && (
          <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <Input
                placeholder="Search instruments..."
                className="w-full mr-2"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInstrumentsExpanded(false)}
                className="h-8 w-8 p-0 flex-shrink-0"
                title="Hide Instrument Library (Ctrl+1)"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
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
        )}

        {/* Toggle Button when Library is Hidden */}
        {!instrumentsExpanded && (
          <div className="w-12 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInstrumentsExpanded(true)}
              className="h-8 w-8 p-0"
              title="Show Instrument Library (Ctrl+1)"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

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
                                      
                                      // Check if this note is currently playing (align to transport steps)
                                      const noteStartStep = note.step;
                                      const noteEndStep = noteStartStep + noteLength;
                                      const isCurrentlyPlaying = transportPlaying && 
                                        playheadPosition >= noteStartStep && 
                                        playheadPosition <= noteEndStep;
                                      
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
                {/* @ts-ignore - VerticalPianoRoll prop types mismatch but runtime compatible */}
                <VerticalPianoRoll 
                  {...({ tracks: tracks as any } as any)}
                  selectedTrack={selectedTrack || undefined}
                  isPlaying={transportPlaying}
                  currentTime={playheadPosition}
                  onPlayNote={(note: string, octave: number, duration: number, instrument: string) => {
                    playNote(note, octave, instrument);
                  }}
                  onNotesChange={(updatedNotes: any[]) => {
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

          {/* BEAT LAB VIEW */}
          {activeView === 'beat-lab' && (
            <div className="flex-1 overflow-y-auto bg-gray-900">
              <BeatLab />
            </div>
          )}

          {/* PIANO ROLL VIEW */}
          {activeView === 'piano-roll' && (
            <div className="flex-1 overflow-hidden bg-gray-900">
              {/* @ts-ignore - VerticalPianoRoll prop types mismatch but runtime compatible */}
              <VerticalPianoRoll 
                {...({ tracks: tracks as any } as any)}
                selectedTrack={selectedTrack || undefined}
                isPlaying={transportPlaying}
                currentTime={playheadPosition}
                onPlayNote={(note: string, octave: number, duration: number, instrument: string) => {
                  // Play note with current track's instrument
                  playNote(note, octave, instrument);
                }}
                onNotesChange={(updatedNotes: any[]) => {
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
            <div className="flex-1 overflow-hidden bg-gray-900">
              <AIAssistant />
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

          {/* AUDIO TOOLS VIEW */}
          {activeView === 'audio-tools' && (
            <div className="flex-1 overflow-y-auto bg-gray-900">
              <AudioToolsPage />
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
    </div>
  );
}
