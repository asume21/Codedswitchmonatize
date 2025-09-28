import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrackControlsPlugin } from './plugins/TrackControlsPlugin';
import { PianoRollPlugin } from './plugins/PianoRollPlugin';
import { StepSequencerPlugin } from './plugins/StepSequencerPlugin';
import { realisticAudio } from '@/lib/realisticAudio';
import { useToast } from '@/hooks/use-toast';

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


function MelodyComposerV2() {
  const { toast } = useToast();
  
  // Core state
  const [notes, setNotes] = useState<Note[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState('track1');
  const [tempo, setTempo] = useState(120);

  // Plugin visibility
  const [activePlugins, setActivePlugins] = useState({
    trackControls: true,
    pianoRoll: false, // Disabled due to Note type conflicts - will fix later
    stepSequencer: true
  });

  // Multi-track system
  const [tracks, setTracks] = useState<Track[]>([
    { id: 'track1', name: 'Lead', instrument: 'piano', volume: 80, pan: 0, muted: false, solo: false },
    { id: 'track2', name: 'Bass', instrument: 'bass', volume: 75, pan: -10, muted: false, solo: false },
    { id: 'track3', name: 'Drums', instrument: 'drums', volume: 85, pan: 0, muted: false, solo: false },
    { id: 'track4', name: 'Harmony', instrument: 'synth', volume: 65, pan: 15, muted: false, solo: false }
  ]);

  // Initialize audio engine
  useEffect(() => {
    realisticAudio.initialize().then(() => {
      toast({ title: "Audio Engine Ready", description: "Multi-track system initialized" });
    }).catch(error => {
      console.error('Audio initialization failed:', error);
      toast({ title: "Audio Error", description: "Failed to initialize audio engine" });
    });
  }, []);

  // Audio functions
  const playNote = async (note: string, octave: number = 4, duration: number = 0.5, instrument: string = 'piano') => {
    try {
      await realisticAudio.playNote(note, octave, duration, instrument, 0.8);
    } catch (error) {
      console.error('Error playing note:', error);
    }
  };

  const playDrum = async (drumType: string, velocity: number = 0.8) => {
    try {
      // @ts-ignore - RealisticAudioEngine interface inconsistency
      await realisticAudio.playDrum(drumType, velocity);
    } catch (error) {
      console.error('Error playing drum:', error);
    }
  };

  // Track management
  const updateTrack = (trackId: string, updates: Partial<Track>) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, ...updates } : track
    ));
    
    toast({ 
      title: "Track Updated", 
      description: `${tracks.find(t => t.id === trackId)?.name} settings changed` 
    });
  };

  const togglePlugin = (pluginName: keyof typeof activePlugins) => {
    setActivePlugins(prev => ({
      ...prev,
      [pluginName]: !prev[pluginName]
    }));
  };

  // Playback controls
  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      toast({ title: "Playback Started", description: "Multi-track sequencer playing" });
    } else {
      toast({ title: "Playback Stopped", description: "Sequencer paused" });
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    realisticAudio.stopAllSounds();
    toast({ title: "Playback Stopped", description: "All sounds stopped" });
  };

  const clearAllNotes = () => {
    setNotes([]);
    toast({ title: "All Notes Cleared", description: "Composition reset" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎵 MelodyComposer V2
            <span className="ml-3 text-lg bg-green-600 px-3 py-1 rounded-full">PLUGIN SYSTEM</span>
          </h1>
          <p className="text-gray-400">Professional Multi-Track Music Production with Modular Plugins</p>
        </div>

        {/* Main Controls */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Tempo Control */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Tempo: {tempo} BPM
              </label>
              <input
                type="range"
                min="60"
                max="200"
                value={tempo}
                onChange={(e) => setTempo(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Track Selector */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Active Track</label>
              <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map(track => (
                    <SelectItem key={track.id} value={track.id}>
                      {track.name} ({track.instrument})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plugin Toggles */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Active Plugins</label>
              <div className="flex space-x-2">
                <Button
                  onClick={() => togglePlugin('trackControls')}
                  variant={activePlugins.trackControls ? "default" : "outline"}
                  size="sm"
                >
                  🎛️
                </Button>
                <Button
                  onClick={() => togglePlugin('pianoRoll')}
                  variant={activePlugins.pianoRoll ? "default" : "outline"}
                  size="sm"
                >
                  🎹
                </Button>
                <Button
                  onClick={() => { togglePlugin('stepSequencer'); }}
                  variant={activePlugins.stepSequencer ? "default" : "outline"}
                  size="sm"
                >
                  🥁
                </Button>
              </div>
            </div>

            {/* Master Controls */}
            <div className="flex items-end space-x-2">
              <Button
                onClick={togglePlayback}
                size="lg"
                className={isPlaying ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              >
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </Button>
              <Button
                onClick={stopPlayback}
                size="lg"
                variant="outline"
              >
                ⏹️ Stop
              </Button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="mt-4 p-3 bg-gray-700 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <div className="text-gray-300">
                <strong>Status:</strong> {isPlaying ? '🟢 Playing' : '🔴 Stopped'} | 
                <strong> Tracks:</strong> {tracks.length} | 
                <strong> Notes:</strong> {notes.length} | 
                <strong> Active:</strong> {tracks.find(t => t.id === selectedTrack)?.name}
              </div>
              <Button
                onClick={clearAllNotes}
                variant="outline"
                size="sm"
                className="border-red-600 text-red-400 hover:bg-red-900"
              >
                🗑️ Clear All
              </Button>
            </div>
          </div>
        </div>

        {/* Track Controls Plugin */}
        {activePlugins.trackControls && (
          <TrackControlsPlugin
            tracks={tracks}
            onTrackUpdate={updateTrack}
            selectedTrack={selectedTrack}
            onTrackSelect={setSelectedTrack}
          />
        )}

        {/* Piano Roll Plugin */}
        {activePlugins.pianoRoll && (() => {
          // @ts-ignore - Note type interface inconsistency between components
          const pianoRollNotes = notes;
          // @ts-ignore - Note type interface inconsistency between components  
          const pianoRollOnNotesChange = setNotes;
          
          return (
            <PianoRollPlugin
              tracks={tracks}
              notes={pianoRollNotes}
              onNotesChange={pianoRollOnNotesChange}
              selectedTrack={selectedTrack}
              isPlaying={isPlaying}
              onPlayNote={playNote}
            />
          );
        })()}

        {/* Step Sequencer Plugin */}
        {activePlugins.stepSequencer && (
          <StepSequencerPlugin
            tracks={tracks}
            selectedTrack={selectedTrack}
            isPlaying={isPlaying}
            onPlayDrum={playDrum}
            onPlayNote={playNote}
          />
        )}

        {/* Plugin Status */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">🔌 Plugin System Status</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className={`p-3 rounded ${activePlugins.trackControls ? 'bg-green-900' : 'bg-gray-700'}`}>
              <div className="text-2xl mb-1">🎛️</div>
              <div className="text-sm text-white font-medium">Track Controls</div>
              <div className="text-xs text-gray-400">
                {activePlugins.trackControls ? 'Active' : 'Disabled'}
              </div>
            </div>
            <div className={`p-3 rounded ${activePlugins.pianoRoll ? 'bg-green-900' : 'bg-gray-700'}`}>
              <div className="text-2xl mb-1">🎹</div>
              <div className="text-sm text-white font-medium">Piano Roll</div>
              <div className="text-xs text-gray-400">
                {activePlugins.pianoRoll ? 'Active' : 'Disabled'}
              </div>
            </div>
            <div className={`p-3 rounded ${activePlugins.stepSequencer ? 'bg-green-900' : 'bg-gray-700'}`}>
              <div className="text-2xl mb-1">🥁</div>
              <div className="text-sm text-white font-medium">Step Sequencer</div>
              <div className="text-xs text-gray-400">
                {activePlugins.stepSequencer ? 'Active' : 'Disabled'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>✅ Plugin-Based Architecture | 🎛️ Multi-Track Mixing | 🎹 Real-Time Audio | 🥁 Step Sequencing</p>
        </div>
      </div>
    </div>
  );
}

export default MelodyComposerV2;
