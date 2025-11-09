import { useState, useContext, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { StudioAudioContext } from '@/pages/studio';
import { ChevronDown, ChevronRight, Maximize2, Minimize2, MessageSquare, Music } from 'lucide-react';
import FloatingAIAssistant from './FloatingAIAssistant';
import MusicGenerationPanel from './MusicGenerationPanel';
import LyricsFocusMode from './LyricsFocusMode';
import { useToast } from '@/hooks/use-toast';

interface Note {
  id: string;
  note: string;
  octave: number;
  start: number; // bar position
  duration: number; // in bars
}

interface Track {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'lyrics';
  instrument?: string;
  data: any;
  notes?: Note[]; // For MIDI tracks
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

export default function UnifiedStudioWorkspace() {
  const studioContext = useContext(StudioAudioContext);
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Initialize Web Audio API
  if (!audioContextRef.current) {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  
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
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    },
  ]);
  
  const [selectedTrack, setSelectedTrack] = useState<string | null>('track-1');
  const [zoom, setZoom] = useState([50]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // UI State
  const [showAIAssistant, setShowAIAssistant] = useState(true);
  const [showMusicGen, setShowMusicGen] = useState(false);
  const [showLyricsFocus, setShowLyricsFocus] = useState(false);

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
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    setPianoRollExpanded(true);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      toast({
        title: "Playing",
        description: "Playback started",
      });
    }
  };

  // Play a piano note with Web Audio API
  const playNote = (note: string, octave: number) => {
    if (!audioContextRef.current) return;
    
    const noteFrequencies: { [key: string]: number } = {
      'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
      'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
      'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
    };
    
    const baseFreq = noteFrequencies[note];
    if (!baseFreq) return;
    
    const frequency = baseFreq * Math.pow(2, octave - 4);
    
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.5);
    
    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + 0.5);
    
    toast({
      title: "Note Played",
      description: `${note}${octave}`,
      duration: 1000,
    });
  };

  // Add note to grid
  const addNoteToGrid = (note: string, octave: number, barPosition: number) => {
    if (!selectedTrack) {
      toast({
        title: "No Track Selected",
        description: "Please select a MIDI track first",
        variant: "destructive",
      });
      return;
    }
    
    const noteStr = note.replace('#', 'Sharp');
    const newNote: Note = {
      id: `note-${Date.now()}`,
      note: noteStr,
      octave,
      start: barPosition,
      duration: 1,
    };
    
    setTracks(tracks.map(t => {
      if (t.id === selectedTrack) {
        const existingNotes = t.notes || [];
        return { ...t, notes: [...existingNotes, newNote] };
      }
      return t;
    }));
    
    playNote(note, octave);
    
    toast({
      title: "Note Added",
      description: `Added ${note}${octave} at bar ${barPosition + 1}`,
      duration: 1500,
    });
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
                <button onClick={handleNewProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">New Project</button>
                <button onClick={handleSaveProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">Save Project</button>
                <button onClick={handleLoadProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">Load Project</button>
                <div className="border-t border-gray-700"></div>
                <button onClick={handleExport} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">Export...</button>
              </div>
            </div>
            <div className="relative group">
              <Button variant="ghost" size="sm">Edit ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-40 z-50">
                <button onClick={() => toast({ title: "Undo" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">Undo</button>
                <button onClick={() => toast({ title: "Redo" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">Redo</button>
                <div className="border-t border-gray-700"></div>
                <button onClick={() => toast({ title: "Copy" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">Copy</button>
                <button onClick={() => toast({ title: "Paste" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">Paste</button>
              </div>
            </div>
            <div className="relative group">
              <Button variant="ghost" size="sm">View ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-48 z-50">
                <button onClick={() => setTimelineExpanded(!timelineExpanded)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">
                  {timelineExpanded ? '✓' : '  '} Timeline
                </button>
                <button onClick={() => setPianoRollExpanded(!pianoRollExpanded)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">
                  {pianoRollExpanded ? '✓' : '  '} Piano Roll
                </button>
                <button onClick={() => setMixerExpanded(!mixerExpanded)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm">
                  {mixerExpanded ? '✓' : '  '} Mixer
                </button>
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
            onClick={togglePlay}
            className={isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}
          >
            <i className={`fas ${isPlaying ? 'fa-stop' : 'fa-play'} mr-2`}></i>
            {isPlaying ? 'Stop' : 'Play'}
          </Button>
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Instrument Library */}
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

        {/* Center: Main Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
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
                              }}
                              className={`h-6 w-6 p-0 ${track.muted ? 'bg-red-600 text-white' : 'text-gray-400'}`}
                              title="Mute"
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
                              }}
                              className={`h-6 w-6 p-0 ${track.solo ? 'bg-yellow-600 text-white' : 'text-gray-400'}`}
                              title="Solo"
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
                            // Waveform visualization
                            <div className="h-full flex items-center">
                              <div className="w-full h-16 bg-blue-900/20 border border-blue-700/50 rounded flex items-end px-1">
                                {Array.from({ length: 100 }, (_, i) => (
                                  <div
                                    key={i}
                                    className="flex-1 bg-blue-500/70 mx-px rounded-t"
                                    style={{ height: `${Math.random() * 60 + 20}%` }}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : track.type === 'midi' ? (
                            // MIDI blocks visualization
                            <div className="h-full flex items-center">
                              <div className="w-full h-12 relative">
                                {/* Example MIDI blocks */}
                                <div className="absolute top-0 left-2 w-20 h-8 bg-green-600/80 border border-green-400 rounded flex items-center justify-center text-xs">
                                  C4
                                </div>
                                <div className="absolute top-0 left-24 w-32 h-8 bg-green-600/80 border border-green-400 rounded flex items-center justify-center text-xs">
                                  E4
                                </div>
                                <div className="absolute top-0 left-60 w-24 h-8 bg-green-600/80 border border-green-400 rounded flex items-center justify-center text-xs">
                                  G4
                                </div>
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
              <div className="bg-gray-900 p-4">
                <div className="border border-gray-700 rounded p-4 min-h-64">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">Draw</Button>
                      <Button size="sm" variant="outline">Select</Button>
                      <Button size="sm" variant="outline">Erase</Button>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <span>Scale:</span>
                      <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1">
                        <option>C Major</option>
                        <option>A Minor</option>
                        <option>G Major</option>
                        <option>D Minor</option>
                      </select>
                      <Button size="sm" variant="outline">Chord Builder</Button>
                    </div>
                  </div>
                  
                  {/* Piano Roll Grid */}
                  <div className="flex border border-gray-700 rounded overflow-hidden" style={{ height: '400px' }}>
                    {/* Piano Keys */}
                    <div className="w-16 bg-gray-800 border-r border-gray-700 overflow-y-auto flex-shrink-0">
                      {['C6', 'B5', 'A#5', 'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5', 'C5', 
                        'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4',
                        'B3', 'A#3', 'A3', 'G#3', 'G3', 'F#3', 'F3', 'E3', 'D#3', 'D3', 'C#3', 'C3'].map((noteStr, idx) => {
                        const isBlackKey = noteStr.includes('#');
                        const noteName = noteStr.slice(0, -1);
                        const octave = parseInt(noteStr.slice(-1));
                        return (
                          <div
                            key={noteStr}
                            onClick={() => playNote(noteName, octave)}
                            className={`h-6 flex items-center justify-center text-[10px] border-b border-gray-700 cursor-pointer hover:bg-blue-600 transition ${
                              isBlackKey ? 'bg-gray-900 text-gray-400' : 'bg-gray-800 text-gray-200'
                            }`}
                            title={`Click to play ${noteStr}`}
                          >
                            {noteStr}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Grid */}
                    <div className="flex-1 bg-gray-900 overflow-x-auto relative">
                      {/* Timeline ruler */}
                      <div className="h-6 bg-gray-800 border-b border-gray-700 flex text-xs text-gray-400">
                        {Array.from({ length: 32 }, (_, i) => (
                          <div key={i} className="flex-1 min-w-[60px] border-r border-gray-700 px-1">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      
                      {/* Note grid */}
                      <div className="relative">
                        {['C6', 'B5', 'A#5', 'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5', 'C5', 
                          'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4',
                          'B3', 'A#3', 'A3', 'G#3', 'G3', 'F#3', 'F3', 'E3', 'D#3', 'D3', 'C#3', 'C3'].map((noteStr, rowIdx) => {
                          const noteName = noteStr.slice(0, -1);
                          const octave = parseInt(noteStr.slice(-1));
                          return (
                          <div key={noteStr} className="h-6 border-b border-gray-700/50 flex">
                            {Array.from({ length: 32 }, (_, colIdx) => (
                              <div
                                key={colIdx}
                                onClick={() => addNoteToGrid(noteName, octave, colIdx)}
                                className="flex-1 min-w-[60px] border-r border-gray-700/30 hover:bg-green-600/30 cursor-pointer transition"
                                title={`Add ${noteStr} at bar ${colIdx + 1}`}
                              />
                            ))}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
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
        </div>
      </div>

      {/* Floating/Overlay Components */}
      {showAIAssistant && (
        <FloatingAIAssistant onClose={() => setShowAIAssistant(false)} />
      )}

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
    </div>
  );
}
