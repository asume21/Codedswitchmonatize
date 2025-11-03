import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrackControlsPlugin } from './plugins/TrackControlsPlugin';
import { PianoRollPlugin } from './plugins/PianoRollPlugin';
import { StepSequencerPlugin } from './plugins/StepSequencerPlugin';
import { realisticAudio } from '@/lib/realisticAudio';
import { useToast } from '@/hooks/use-toast';
import { StudioAudioContext } from '@/pages/studio';
import type { Note } from './types/pianoRollTypes';
import { AudioPlayer } from '@/components/ui/audio-player';

interface Track {
  id: string;
  name: string;
  instrument: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  notes: Note[];
}


function MelodyComposerV2() {
  const { toast } = useToast();
  const studioContext = useContext(StudioAudioContext);
  
  // Core state
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedTrack, setSelectedTrack] = useState('track1');
  const [tempo, setTempo] = useState(studioContext.bpm);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);

  const isPlaying = studioContext.isPlaying;

  // Plugin visibility
  const [activePlugins, setActivePlugins] = useState({
    trackControls: true,
    pianoRoll: true, // Re-enabled - will handle type conflicts with casting
    stepSequencer: true
  });

  // Multi-track system
  const [localTracks, setLocalTracks] = useState<Track[]>([
    { id: 'track1', name: 'Lead', instrument: 'piano', volume: 80, pan: 0, muted: false, solo: false, notes: [] },
    { id: 'track2', name: 'Bass', instrument: 'bass', volume: 75, pan: -10, muted: false, solo: false, notes: [] },
    { id: 'track3', name: 'Drums', instrument: 'drums', volume: 85, pan: 0, muted: false, solo: false, notes: [] },
    { id: 'track4', name: 'Harmony', instrument: 'synth', volume: 65, pan: 15, muted: false, solo: false, notes: [] }
  ]);

  const tracks = useMemo(() => {
    if (studioContext.currentTracks && (studioContext.currentTracks as Track[]).length > 0) {
      return studioContext.currentTracks as Track[];
    }
    return localTracks;
  }, [studioContext.currentTracks, localTracks]);

  // Initialize audio engine
  useEffect(() => {
    realisticAudio.initialize().then(() => {
      toast({ title: "Audio Engine Ready", description: "Multi-track system initialized" });
    }).catch(error => {
      console.error('Audio initialization failed:', error);
      toast({ title: "Audio Error", description: "Failed to initialize audio engine" });
    });
  }, []);

  useEffect(() => {
    if (studioContext.setCurrentTracks) {
      studioContext.setCurrentTracks(localTracks);
    }
  }, [localTracks]); // Remove studioContext from dependencies to prevent infinite loop

  useEffect(() => {
    if (studioContext.setBpm) {
      studioContext.setBpm(tempo);
    }
  }, [tempo]); // Remove studioContext from dependencies to prevent infinite loop

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
    setLocalTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, ...updates } : track
    ));

    const baseTracks = (studioContext.currentTracks as Track[])?.length > 0 ? (studioContext.currentTracks as Track[]) : localTracks;
    const updated = baseTracks.map(track => track.id === trackId ? { ...track, ...updates } : track);
    studioContext.setCurrentTracks(updated);
    
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
    if (!studioContext.isPlaying) {
      studioContext.playCurrentAudio();
      toast({ title: "Playback Started", description: "Multi-track sequencer playing" });
    } else {
      studioContext.stopCurrentAudio();
      toast({ title: "Playback Stopped", description: "Sequencer paused" });
    }
  };

  const stopPlayback = () => {
    studioContext.stopCurrentAudio();
    realisticAudio.stopAllSounds();
    toast({ title: "Playback Stopped", description: "All sounds stopped" });
  };

  const clearAllNotes = () => {
    setNotes([]);
    setLocalTracks(prev => prev.map(track => ({ ...track, notes: [] })));
    const baseTracks = (studioContext.currentTracks as Track[])?.length > 0 ? (studioContext.currentTracks as Track[]) : localTracks;
    const cleared = baseTracks.map(track => ({ ...track, notes: [] }));
    studioContext.setCurrentTracks(cleared);
    toast({ title: "All Notes Cleared", description: "Composition reset" });
  };

  const handleTrackNotesUpdate = (trackId: string, updatedNotes: Note[]) => {
    setLocalTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, notes: updatedNotes } : track
    ));

    const baseTracks = (studioContext.currentTracks as Track[])?.length > 0 ? (studioContext.currentTracks as Track[]) : localTracks;
    const updated = baseTracks.map(track => track.id === trackId ? { ...track, notes: updatedNotes } : track);
    studioContext.setCurrentTracks(updated);

    if (trackId === selectedTrack) {
      setNotes(updatedNotes);
    }
  };

  const totalNotes = tracks.reduce((sum, track) => sum + (track.notes?.length || 0), 0);

  useEffect(() => {
    const activeTrack = tracks.find(track => track.id === selectedTrack);
    setNotes(activeTrack?.notes ?? []);
  }, [selectedTrack, tracks]);

  // AI Melody Generation
  const generateAIMelody = async () => {
    try {
      toast({ title: "Generating melody...", description: "AI is composing your melody" });
      
      const response = await fetch('/api/melody/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scale: 'C Major',
          style: 'melodic',
          complexity: 'medium',
          availableTracks: tracks.map(t => ({
            instrument: t.instrument,
            name: t.name
          })),
          musicalParams: {
            bpm: tempo,
            key: 'C',
            timeSignature: '4/4'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const result = await response.json();
      const data = result.data; // Server wraps response in { success, data, message }
      
      // Set the audio URL if available
      if (data && data.audioUrl) {
        setGeneratedAudioUrl(data.audioUrl);
      }
      
      // Convert API response to Note format for the selected track
      if (data && data.notes && Array.isArray(data.notes)) {
        const generatedNotes: Note[] = data.notes.map((n: any, index: number) => ({
          id: `note-${Date.now()}-${index}`,
          pitch: n.note || n.pitch,
          octave: n.octave || 4,
          start: n.time || n.start || 0,
          duration: n.duration || 0.5,
          velocity: n.velocity || 0.8
        }));

        handleTrackNotesUpdate(selectedTrack, generatedNotes);
        
        toast({ 
          title: "Melody Generated!", 
          description: `Added ${generatedNotes.length} notes to ${tracks.find(t => t.id === selectedTrack)?.name}. ${data.audioUrl ? 'AI audio ready!' : ''}` 
        });
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast({ 
        title: "Generation Failed", 
        description: "Could not generate melody. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-gray-900 to-black p-6 overflow-auto">
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

            {/* AI Generate */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">AI Tools</label>
              <Button
                onClick={generateAIMelody}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                ✨ AI Generate Melody
              </Button>
            </div>

            {/* Plugin Toggles */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Active Plugins</label>
              <div className="flex space-x-2">
                <Button
                  onClick={() => { togglePlugin('trackControls'); }}
                  variant={activePlugins.trackControls ? "default" : "outline"}
                  size="sm"
                >
                  🎛️
                </Button>
                <Button
                  onClick={() => { togglePlugin('pianoRoll'); }}
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

          </div>

        {/* Status Bar */}
        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
          <div className="flex justify-between items-center text-sm">
            <div className="text-gray-300">
              <strong>Status:</strong> {isPlaying ? '🟢 Playing' : '🔴 Stopped'} | 
              <strong> Tracks:</strong> {tracks.length} | 
              <strong> Notes:</strong> {totalNotes} | 
              <strong> Active:</strong> {tracks.find(t => t.id === selectedTrack)?.name}
            </div>
              <Button
                onClick={clearAllNotes}
                variant="outline"
                size="sm"
                className="border-red-600 text-red-400 hover:bg-red-900"
              >
                {activePlugins.pianoRoll && activePlugins.stepSequencer ? '🎹 & 🥁' : activePlugins.pianoRoll ? '🎹' : activePlugins.stepSequencer ? '🥁' : 'Disabled'}
                🗑️ Clear All
              </Button>
            </div>
          </div>
        </div>

        {/* AI Generated Audio Player */}
        {generatedAudioUrl && (
          <AudioPlayer 
            audioUrl={generatedAudioUrl}
            title={`AI Melody - ${tracks.find(t => t.id === selectedTrack)?.name}`}
            className="mb-6"
          />
        )}

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
        {activePlugins.pianoRoll && (
          <PianoRollPlugin
            tracks={tracks}
            notes={notes}
            onNotesChange={(updated) => handleTrackNotesUpdate(selectedTrack, updated)}
            selectedTrack={selectedTrack}
            isPlaying={isPlaying}
            onPlayNote={playNote}
          />
        )}

        {/* Step Sequencer Plugin */}
        {activePlugins.stepSequencer && (
          <StepSequencerPlugin
            tracks={tracks}
            selectedTrack={selectedTrack}
            isPlaying={isPlaying}
            onPlayDrum={playDrum}
            onPlayNote={playNote}
            onStartPlayback={togglePlayback}
            onStopPlayback={stopPlayback}
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
