import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrackControlsPlugin } from './plugins/TrackControlsPlugin';
import { PianoRollPlugin } from './plugins/PianoRollPlugin';
import { StepSequencerPlugin } from './plugins/StepSequencerPlugin';
import { realisticAudio } from '@/lib/realisticAudio';

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

interface Toast {
  title: string;
  description: string;
}

const toast = ({ title, description }: Toast) => {
  console.log(`🎵 ${title}: ${description}`);
};

function MelodyComposer() {
  // Core state
  const [notes, setNotes] = useState<Note[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState('track1');
  const [tempo, setTempo] = useState(120);
  const [scale, setScale] = useState('C Major');
  const [key, setKey] = useState('C');

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
      await realisticAudio.playDrumSound(drumType, velocity);
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

  return (
    <div className="h-screen bg-gray-900 text-white overflow-hidden">
      <div className="h-full p-3 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-3">
        
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">🎹 Melody Composer</h1>
          <div className="flex items-center space-x-3 text-xs text-gray-400">
            <span>{scale}</span>
            <span>{tempo} BPM</span>
          </div>
        </div>

        {/* Compact Controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Scale</label>
            <Select value={scale} onValueChange={setScale}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="C Major">C Major</SelectItem>
                <SelectItem value="G Major">G Major</SelectItem>
                <SelectItem value="D Major">D Major</SelectItem>
                <SelectItem value="A Major">A Major</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Tempo: {tempo}</label>
            <input
              type="range"
              min="60"
              max="200"
              value={tempo}
              onChange={(e) => setTempo(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded cursor-pointer"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Key</label>
            <Select value={key} onValueChange={setKey}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="C">C</SelectItem>
                <SelectItem value="D">D</SelectItem>
                <SelectItem value="E">E</SelectItem>
                <SelectItem value="F">F</SelectItem>
                <SelectItem value="G">G</SelectItem>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex space-x-1">
            <Button
              onClick={togglePlayback}
              size="sm"
              className={isPlaying ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </Button>
            <Button
              onClick={stopPlayback}
              size="sm"
              variant="outline"
            >
              ⏹️
            </Button>
          </div>
        </div>

        {/* Compact Plugins */}
        <TrackControlsPlugin
          tracks={tracks}
          onTrackUpdate={updateTrack}
          selectedTrack={selectedTrack}
          onTrackSelect={setSelectedTrack}
        />

        <PianoRollPlugin
          notes={notes}
          onNotesChange={setNotes}
          selectedTrack={selectedTrack}
          isPlaying={isPlaying}
          onPlayNote={playNote}
        />

        <StepSequencerPlugin
          tracks={tracks}
          selectedTrack={selectedTrack}
          isPlaying={isPlaying}
          onPlayDrum={playDrum}
          onPlayNote={playNote}
        />

        </div>
      </div>
    </div>
  );
}

export default MelodyComposer;
