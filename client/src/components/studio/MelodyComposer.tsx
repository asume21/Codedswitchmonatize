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
import { useAudio } from '@/hooks/use-audio';
import type { DrumType } from '@/hooks/use-audio';
import { Play, Pause, Square, Plus, Volume2, VolumeX, Mic2, Music, Download, Share2, Gauge, Piano } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { Note } from './types/pianoRollTypes';

interface Track {
  id: string;
  name: string;
  instrument: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

function MelodyComposer() {
  // Core state
  const [notes, setNotes] = useState<Note[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState('track1');
  const [tempo, setTempo] = useState(120);
  const [scale, setScale] = useState('C Major');
  const [key, setKey] = useState('C');
  const [currentBeat, setCurrentBeat] = useState(0);
  const [masterVolume, setMasterVolume] = useState(80); // Renamed for clarity
  const [activeTab, setActiveTab] = useState('piano-roll');
  const { toast } = useToast();
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { playNote: playNoteHook, playDrum: playDrumHook, setMasterVolume: setMasterVolumeHook, initialize } = useAudio();

  // Multi-track system
  const [tracks, setTracks] = useState<Track[]>([
    { id: 'track1', name: 'Lead', instrument: 'piano', volume: 80, pan: 0, muted: false, solo: false },
    { id: 'track2', name: 'Bass', instrument: 'bass', volume: 75, pan: -10, muted: false, solo: false },
    { id: 'track3', name: 'Drums', instrument: 'drums', volume: 85, pan: 0, muted: false, solo: false },
    { id: 'track4', name: 'Harmony', instrument: 'synth', volume: 65, pan: 15, muted: false, solo: false }
  ]);

  // Initialize audio engine
  useEffect(() => {
    initialize().then(() => {
      toast({ title: "Audio Engine Ready", description: "Multi-track system initialized" });
    }).catch(error => {
      console.error('Audio initialization failed:', error);
      toast({ title: "Audio Error", description: "Failed to initialize audio engine" });
    });
  }, [initialize, toast]);

  // Audio functions
  const playNote = async (
    note: string,
    octave: number = 4,
    duration: number | string = 0.5,
    instrument: string = 'piano'
  ) => {
    try {
      // Delegate to audio hook which handles initialization and conversion
      const durationNum = typeof duration === 'number' ? duration : parseFloat(duration) || 0.5;
      playNoteHook(note, octave, durationNum, instrument, 0.8);
    } catch (error) {
      console.error('Error playing note:', error);
    }
  };

  const playDrum = (
    drumType: any,
    velocity: number = 0.8
  ) => {
    try {
      // Map plugin drum names to audio engine supported types
      let mapped: DrumType;
      switch (drumType) {
        case 'hihat-open':
        case 'hihat-closed':
        case 'hihat':
          mapped = 'hihat';
          break;
        case 'tom1':
        case 'tom2':
        case 'tom3':
        case 'tom':
          mapped = 'tom';
          break;
        case 'ride':
        case 'crash':
          mapped = 'crash';
          break;
        case 'snare':
        case 'kick':
        default:
          mapped = drumType as DrumType;
      }
      playDrumHook(mapped, velocity);
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
        await initialize();
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
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }

    const stepDuration = 60000 / tempo / 4; // 16th notes

    playbackIntervalRef.current = setInterval(() => {
      setCurrentBeat(beat => {
        const nextBeat = (beat + 1) % (4 * 4); // 4 bars of 16th notes
        tracks.forEach(track => {
          if (!track.muted) {
            const notesForStep = notes.filter(note => note.step === nextBeat);
            notesForStep.forEach(note => {
              const durationInSeconds = (60 / tempo) * (note.length / 4);
              playNote(note.note, note.octave, durationInSeconds, track.instrument);
            });
          }
        });
        return nextBeat;
      });
    }, stepDuration);
  };

  const stopPlayback = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(0);
    toast({ title: "Playback Stopped", description: "All sounds stopped" });
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setMasterVolume(newVolume);
    setMasterVolumeHook(newVolume / 100);
  };

  const toggleMute = () => {
    const isAnyTrackMuted = tracks.some(track => track.muted);
    const newMuteState = !isAnyTrackMuted;
    setTracks(tracks.map(track => ({ ...track, muted: newMuteState })));
    toast({
      title: newMuteState ? "Muted All" : "Unmuted All",
      description: newMuteState ? "All tracks are muted" : "All tracks are unmuted"
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
              className={isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              onClick={stopPlayback}
              size="sm"
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
                {tracks.some(t => t.muted) ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[masterVolume]}
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
                        tracks={tracks}
                        notes={notes}
                        onNotesChange={setNotes}
                        selectedTrack={selectedTrack}
                        isPlaying={isPlaying}
                        onPlayNote={playNote}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="step-sequencer" className="m-0 h-full">
                  <div className="h-full p-4">
                    <StepSequencerPlugin
                      tracks={tracks}
                      selectedTrack={selectedTrack}
                      isPlaying={isPlaying}
                      onPlayDrum={playDrum}
                      onPlayNote={playNote}
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MelodyComposer;
