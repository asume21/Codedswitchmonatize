import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrackControlsPlugin } from './plugins/TrackControlsPlugin';
import { PianoRollPlugin } from './plugins/PianoRollPlugin';
import { StepSequencerPlugin } from './plugins/StepSequencerPlugin';
import { realisticAudio } from '@/lib/realisticAudio';
import { Play, Pause, Square, Plus, Volume2, VolumeX, Mic2, Music, Download, Share2, Gauge, Piano } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

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
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [activeTab, setActiveTab] = useState('piano-roll');
  const { toast } = useToast();
  const playheadRef = useRef<HTMLDivElement>(null);

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
  const togglePlayback = async () => {
    if (!isPlaying) {
      try {
        await realisticAudio.resumeContext();
        setIsPlaying(true);
        startPlayback();
        toast({ title: "Playback Started", description: "Multi-track sequencer playing" });
      } catch (error) {
        console.error('Error starting playback:', error);
        toast({ title: "Playback Error", description: "Failed to start audio" });
      }
    } else {
      setIsPlaying(false);
      stopPlayback();
    }
  };

  const startPlayback = () => {
    // Implementation for playback with timing
    // This would handle the sequencer timing and note triggering
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentBeat(0);
    realisticAudio.stopAllSounds();
    toast({ title: "Playback Stopped", description: "All sounds stopped" });
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    // Update the volume for the selected track
    updateTrack(selectedTrack, { volume: newVolume });
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    // Mute all tracks
    tracks.forEach(track => {
      updateTrack(track.id, { muted: newMuteState });
    });
    toast({
      title: newMuteState ? "Audio Muted" : "Audio Unmuted",
      description: newMuteState ? "All tracks are muted" : "Sound is enabled"
    });
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Top Bar */}
      <div className="bg-gray-800 p-3 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold flex items-center">
            <Music className="mr-2 h-5 w-5" /> Melody Composer
          </h1>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={togglePlayback}
              size="sm"
              className={`${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} w-10 h-10 p-0 rounded-full`}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              onClick={stopPlayback}
              size="sm"
              variant="outline"
              className="w-10 h-10 p-0 rounded-full"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 w-40">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="h-8 w-8"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="gap-1">
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button variant="default" size="sm" className="gap-1">
              <Share2 className="h-4 w-4" /> Share
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Transport Controls */}
          <div className="bg-gray-800 p-3 border-b border-gray-700">
            <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs font-medium text-gray-300 block mb-1">Scale</Label>
                <Select value={scale} onValueChange={setScale}>
                  <SelectTrigger className="h-8 text-xs bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {['C Major', 'G Major', 'D Major', 'A Major', 'E Major', 'B Major', 'F# Major',
                      'C# Major', 'F Major', 'Bb Major', 'Eb Major', 'Ab Major', 'Db Major', 'Gb Major'].map((s) => (
                      <SelectItem key={s} value={s} className="hover:bg-gray-700">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-300 block mb-1">Tempo: {tempo} BPM</Label>
                <div className="flex items-center space-x-2">
                  <Slider
                    value={[tempo]}
                    onValueChange={(value) => setTempo(value[0])}
                    min={60}
                    max={200}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={tempo}
                    onChange={(e) => setTempo(Number(e.target.value))}
                    className="w-16 h-8 text-xs text-center"
                    min={60}
                    max={200}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-300 block mb-1">Key</Label>
                <Select value={key} onValueChange={setKey}>
                  <SelectTrigger className="h-8 text-xs bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((k) => (
                      <SelectItem key={k} value={k} className="hover:bg-gray-700">
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end space-x-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Plus className="h-4 w-4 mr-2" /> New Track
                </Button>
                <Button variant="outline" size="sm">
                  <Gauge className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Main Workspace */}
          <div className="flex-1 overflow-hidden">
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="h-full flex flex-col"
            >
              <div className="border-b border-gray-700">
                <TabsList className="bg-transparent p-0 h-10 rounded-none">
                  <TabsTrigger 
                    value="piano-roll" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent"
                  >
                    <Piano className="h-4 w-4 mr-2" /> Piano Roll
                  </TabsTrigger>
                  <TabsTrigger 
                    value="step-sequencer" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent"
                  >
                    <Gauge className="h-4 w-4 mr-2" /> Step Sequencer
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="piano-roll" className="m-0 h-full">
                  <div className="h-full flex flex-col">
                    <TrackControlsPlugin
                      tracks={tracks}
                      onTrackUpdate={updateTrack}
                      selectedTrack={selectedTrack}
                      onTrackSelect={setSelectedTrack}
                    />
                    <div className="flex-1 overflow-auto">
                      <PianoRollPlugin
                        notes={notes}
                        onNotesChange={setNotes}
                        selectedTrack={selectedTrack}
                        isPlaying={isPlaying}
                        currentBeat={currentBeat}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="step-sequencer" className="m-0 h-full">
                  <div className="h-full p-4">
                    <StepSequencerPlugin
                      tracks={tracks}
                      selectedTrack={selectedTrack}
                      onTrackSelect={setSelectedTrack}
                      isPlaying={isPlaying}
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
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
