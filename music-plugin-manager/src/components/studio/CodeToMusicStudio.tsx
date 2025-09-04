import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { globalSystems, globalAI, globalMIDI, globalAudio, pluginRegistry } from '@/lib/globalSystems';

// Plugin Components
import { TrackControlsPlugin } from './plugins/TrackControlsPlugin';
import { PianoRollPlugin } from './plugins/PianoRollPlugin';
import { StepSequencerPlugin } from './plugins/StepSequencerPlugin';

interface Note {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
  trackId: string;
}

interface Track {
  id: string;
  name: string;
  instrument: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

interface CodeToMusicProject {
  id: string;
  name: string;
  code: string;
  music: {
    notes: Note[];
    tracks: Track[];
    tempo: number;
    scale: string;
  };
  lyrics: string;
  analysis: any;
}

function CodeToMusicStudio() {
  // Core project state
  const [project, setProject] = useState<CodeToMusicProject>({
    id: 'project-1',
    name: 'New Project',
    code: '',
    music: {
      notes: [],
      tracks: [
        { id: 'track1', name: 'Lead', instrument: 'piano', volume: 80, pan: 0, muted: false, solo: false },
        { id: 'track2', name: 'Bass', instrument: 'bass', volume: 75, pan: -10, muted: false, solo: false },
        { id: 'track3', name: 'Drums', instrument: 'drums', volume: 85, pan: 0, muted: false, solo: false },
        { id: 'track4', name: 'Harmony', instrument: 'synth', volume: 65, pan: 15, muted: false, solo: false }
      ],
      tempo: 120,
      scale: 'C Major'
    },
    lyrics: '',
    analysis: null
  });

  // Plugin management
  const [activePlugins, setActivePlugins] = useState({
    codeToMusic: true,
    musicToCode: false,
    trackControls: true,
    pianoRoll: true,
    stepSequencer: false,
    lyricLab: false,
    songAnalyzer: false,
    aiAssistant: true,
    midiController: false,
    codeTranslator: false,
    vulnerabilityScanner: false,
    packGenerator: false
  });

  // System state
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState('track1');
  const [systemsReady, setSystemsReady] = useState(false);

  // Initialize global systems
  useEffect(() => {
    const initializeSystems = async () => {
      try {
        await globalSystems.initialize();
        
        // Register core plugins
        pluginRegistry.registerPlugin('codeToMusic', 'CodeToMusicPlugin');
        pluginRegistry.registerPlugin('musicToCode', 'MusicToCodePlugin');
        pluginRegistry.registerPlugin('trackControls', 'TrackControlsPlugin');
        pluginRegistry.registerPlugin('pianoRoll', 'PianoRollPlugin');
        pluginRegistry.registerPlugin('stepSequencer', 'StepSequencerPlugin');
        pluginRegistry.registerPlugin('aiAssistant', 'AIAssistantPlugin');
        
        // Activate default plugins
        Object.entries(activePlugins).forEach(([pluginId, isActive]) => {
          if (isActive) {
            pluginRegistry.activatePlugin(pluginId);
          }
        });

        setSystemsReady(true);
      } catch (error) {
        console.error('Failed to initialize systems:', error);
      }
    };

    initializeSystems();
  }, []);

  // Plugin management functions
  const togglePlugin = (pluginId: keyof typeof activePlugins) => {
    setActivePlugins(prev => {
      const newState = { ...prev, [pluginId]: !prev[pluginId] };
      
      if (newState[pluginId]) {
        pluginRegistry.activatePlugin(pluginId);
      } else {
        pluginRegistry.deactivatePlugin(pluginId);
      }
      
      return newState;
    });
  };

  // Code to Music conversion
  const convertCodeToMusic = async () => {
    if (!project.code.trim()) return;

    try {
      const suggestions = await globalAI.getSuggestions('codeToMusic', {
        code: project.code,
        currentTracks: project.music.tracks,
        tempo: project.music.tempo
      });

      // Simulate code-to-music conversion
      const newNotes: Note[] = [];
      const codeLines = project.code.split('\n').filter(line => line.trim());
      
      codeLines.forEach((line, index) => {
        const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const note = noteNames[line.length % noteNames.length];
        const octave = 4 + (line.includes('function') ? 1 : 0);
        
        newNotes.push({
          id: `code-note-${index}`,
          pitch: (octave * 12) + noteNames.indexOf(note),
          start: index * 0.5,
          duration: line.includes('{') ? 1.0 : 0.5,
          velocity: 0.8,
          trackId: 'track1'
        });
      });

      setProject(prev => ({
        ...prev,
        music: { ...prev.music, notes: [...prev.music.notes, ...newNotes] }
      }));

      console.log('🎵 Code converted to music:', newNotes.length, 'notes generated');
    } catch (error) {
      console.error('Code to music conversion failed:', error);
    }
  };

  // Music to Code conversion
  const convertMusicToCode = async () => {
    if (project.music.notes.length === 0) return;

    try {
      const analysis = await globalAI.analyzeContent('music', {
        notes: project.music.notes,
        tracks: project.music.tracks,
        tempo: project.music.tempo
      });

      // Simulate music-to-code conversion
      let generatedCode = '// Generated from musical structure\n';
      generatedCode += `function melody_${Date.now()}() {\n`;
      
      project.music.notes.forEach((note, index) => {
        const indent = '  '.repeat(Math.floor(note.pitch / 12) - 3);
        generatedCode += `${indent}// Note ${index + 1}: Pitch ${note.pitch}\n`;
        generatedCode += `${indent}playNote(${note.pitch}, ${note.duration});\n`;
      });
      
      generatedCode += '}\n';

      setProject(prev => ({ ...prev, code: generatedCode }));
      console.log('💻 Music converted to code');
    } catch (error) {
      console.error('Music to code conversion failed:', error);
    }
  };

  // Audio functions
  const playNote = async (note: string, octave: number = 4, duration: number = 0.5, instrument: string = 'piano') => {
    if (!systemsReady) return;
    await globalAudio.playNote(note, octave, duration, instrument);
  };

  const playDrum = async (drumType: string, velocity: number = 0.8) => {
    if (!systemsReady) return;
    await globalAudio.playDrumSound(drumType, velocity);
  };

  // Track management
  const updateTrack = (trackId: string, updates: Partial<Track>) => {
    setProject(prev => ({
      ...prev,
      music: {
        ...prev.music,
        tracks: prev.music.tracks.map(track => 
          track.id === trackId ? { ...track, ...updates } : track
        )
      }
    }));
  };

  const updateNotes = (notes: Note[]) => {
    setProject(prev => ({
      ...prev,
      music: { ...prev.music, notes }
    }));
  };

  // Playback controls
  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      console.log('▶️ Starting playback');
    } else {
      globalAudio.stopAllSounds();
      console.log('⏸️ Stopping playback');
    }
  };

  if (!systemsReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎵</div>
          <h2 className="text-2xl font-bold text-white mb-2">Initializing CodeToMusic Studio</h2>
          <p className="text-gray-400">Loading global AI, MIDI, and audio systems...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎵 CodeToMusic Studio
            <span className="ml-3 text-lg bg-blue-600 px-3 py-1 rounded-full">PLUGIN HOST</span>
          </h1>
          <p className="text-gray-400">
            Global AI • Global MIDI • Plugin Architecture • Code ↔ Music Translation
          </p>
        </div>

        {/* Main Controls */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Project Info */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Project</label>
              <input
                type="text"
                value={project.name}
                onChange={(e) => setProject(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-gray-700 border-gray-600 text-white px-3 py-2 rounded"
              />
            </div>

            {/* Tempo Control */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Tempo: {project.music.tempo} BPM
              </label>
              <input
                type="range"
                min="60"
                max="200"
                value={project.music.tempo}
                onChange={(e) => setProject(prev => ({
                  ...prev,
                  music: { ...prev.music, tempo: parseInt(e.target.value) }
                }))}
                className="w-full"
              />
            </div>

            {/* Active Track */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Active Track</label>
              <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {project.music.tracks.map(track => (
                    <SelectItem key={track.id} value={track.id}>
                      {track.name} ({track.instrument})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Playback Controls */}
            <div className="flex items-end space-x-2">
              <Button
                onClick={togglePlayback}
                size="lg"
                className={isPlaying ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </Button>
              <Button
                onClick={() => globalAudio.stopAllSounds()}
                size="lg"
                variant="outline"
              >
                ⏹️
              </Button>
            </div>
          </div>
        </div>

        {/* Core Translation Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Code to Music */}
          {activePlugins.codeToMusic && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
                💻 Code to Music
                <span className="ml-2 text-sm bg-blue-600 px-2 py-1 rounded">CORE</span>
              </h3>
              
              <textarea
                value={project.code}
                onChange={(e) => setProject(prev => ({ ...prev, code: e.target.value }))}
                placeholder="Enter your code here..."
                className="w-full h-40 bg-gray-700 border-gray-600 text-white p-3 rounded mb-4 font-mono text-sm"
              />
              
              <Button
                onClick={convertCodeToMusic}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!project.code.trim()}
              >
                🎵 Convert to Music
              </Button>
            </div>
          )}

          {/* Music to Code */}
          {activePlugins.musicToCode && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
                🎵 Music to Code
                <span className="ml-2 text-sm bg-blue-600 px-2 py-1 rounded">CORE</span>
              </h3>
              
              <div className="bg-gray-700 p-3 rounded mb-4 h-40 overflow-y-auto">
                <pre className="text-white text-sm font-mono">
                  {project.code || '// Generated code will appear here...'}
                </pre>
              </div>
              
              <Button
                onClick={convertMusicToCode}
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={project.music.notes.length === 0}
              >
                💻 Convert to Code
              </Button>
            </div>
          )}
        </div>

        {/* Plugin Controls */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-white">🔌 Plugin Manager</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(activePlugins).map(([pluginId, isActive]) => (
              <Button
                key={pluginId}
                onClick={() => togglePlugin(pluginId as keyof typeof activePlugins)}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="text-xs"
              >
                {pluginId.replace(/([A-Z])/g, ' $1').trim()}
              </Button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-gray-700 rounded text-sm text-gray-300">
            <strong>Active:</strong> {Object.values(activePlugins).filter(Boolean).length} plugins | 
            <strong> Notes:</strong> {project.music.notes.length} | 
            <strong> Tracks:</strong> {project.music.tracks.length}
          </div>
        </div>

        {/* Active Plugins */}
        {activePlugins.trackControls && (
          <TrackControlsPlugin
            tracks={project.music.tracks}
            onTrackUpdate={updateTrack}
            selectedTrack={selectedTrack}
            onTrackSelect={setSelectedTrack}
          />
        )}

        {activePlugins.pianoRoll && (
          <PianoRollPlugin
            notes={project.music.notes}
            onNotesChange={updateNotes}
            selectedTrack={selectedTrack}
            isPlaying={isPlaying}
            onPlayNote={playNote}
          />
        )}

        {activePlugins.stepSequencer && (
          <StepSequencerPlugin
            tracks={project.music.tracks}
            selectedTrack={selectedTrack}
            isPlaying={isPlaying}
            onPlayDrum={playDrum}
            onPlayNote={playNote}
          />
        )}

        {/* AI Assistant */}
        {activePlugins.aiAssistant && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
              🤖 AI Assistant
              <span className="ml-2 text-sm bg-green-600 px-2 py-1 rounded">GLOBAL AI</span>
            </h3>
            <div className="text-center text-gray-400 py-8">
              <p>AI Assistant ready to help with any plugin</p>
              <p className="text-sm">Context-aware suggestions • Real-time analysis • Smart automation</p>
            </div>
          </div>
        )}

        {/* System Status */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-green-900 rounded">
              <div className="text-2xl mb-1">🤖</div>
              <div className="text-sm text-white font-medium">Global AI</div>
              <div className="text-xs text-gray-400">Ready</div>
            </div>
            <div className="p-3 bg-blue-900 rounded">
              <div className="text-2xl mb-1">🎹</div>
              <div className="text-sm text-white font-medium">Global MIDI</div>
              <div className="text-xs text-gray-400">Ready</div>
            </div>
            <div className="p-3 bg-purple-900 rounded">
              <div className="text-2xl mb-1">🎵</div>
              <div className="text-sm text-white font-medium">Global Audio</div>
              <div className="text-xs text-gray-400">Ready</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CodeToMusicStudio;
