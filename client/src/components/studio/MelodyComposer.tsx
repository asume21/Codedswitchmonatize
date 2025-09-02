import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

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
  console.log(`${title}: ${description}`);
};

function MelodyComposer() {
  // Basic state
  const [notes, setNotes] = useState<Note[]>([]);
  const [scale, setScale] = useState('C Major');
  const [tempo, setTempo] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState('track1');
  
  // Circle of Fifths state
  const [showCircleOfFifths, setShowCircleOfFifths] = useState(true);
  const [selectedChordProgression, setSelectedChordProgression] = useState<'classic' | 'jazz' | 'pop' | 'electronic'>('classic');

  // Step sequencer state
  const [showStepSequencer, setShowStepSequencer] = useState(false);
  const [stepSequencerPattern, setStepSequencerPattern] = useState<{[trackId: string]: boolean[]}>({});
  const [stepSequencerSteps, setStepSequencerSteps] = useState(16);
  const [currentBeat, setCurrentBeat] = useState(0);

  // Audio ref
  const realisticAudioRef = useRef<any>(null);

  // Default tracks with mutable state
  const [tracks, setTracks] = useState<Track[]>([
    { id: 'track1', name: 'Lead', instrument: 'acoustic_grand_piano', volume: 80, pan: 0, muted: false, solo: false },
    { id: 'track2', name: 'Bass', instrument: 'acoustic_bass', volume: 70, pan: -20, muted: false, solo: false },
    { id: 'track3', name: 'Drums', instrument: 'synth_drum', volume: 85, pan: 0, muted: false, solo: false },
    { id: 'track4', name: 'Harmony', instrument: 'pad_2_warm', volume: 60, pan: 20, muted: false, solo: false }
  ]);

  // Available instruments
  const INSTRUMENTS = [
    { value: 'acoustic_grand_piano', label: '🎹 Grand Piano' },
    { value: 'electric_piano_1', label: '🎹 Electric Piano' },
    { value: 'acoustic_guitar_nylon', label: '🎸 Acoustic Guitar' },
    { value: 'electric_guitar_clean', label: '🎸 Electric Guitar' },
    { value: 'acoustic_bass', label: '🎸 Bass Guitar' },
    { value: 'violin', label: '🎻 Violin' },
    { value: 'trumpet', label: '🎺 Trumpet' },
    { value: 'tenor_sax', label: '🎷 Saxophone' },
    { value: 'flute', label: '🪈 Flute' },
    { value: 'synth_lead_1_square', label: '🎛️ Synth Lead' },
    { value: 'pad_2_warm', label: '🎛️ Synth Pad' },
    { value: 'synth_drum', label: '🥁 Synth Drums' }
  ];

  // Circle of Fifths constants
  const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
  const RELATIVE_MINORS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Fm', 'Cm', 'Gm', 'Dm'];

  // Helper functions
  const getCurrentKeyRoot = () => {
    return scale.split(' ')[0];
  };

  const getCurrentScaleNotes = () => {
    const majorScales: { [key: string]: string[] } = {
      'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
      'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
      'A': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
      'E': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
      'B': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
      'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
      'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E']
    };
    
    const root = getCurrentKeyRoot();
    return majorScales[root] || majorScales['C'];
  };

  // Chord progression definitions
  const CHORD_PROGRESSIONS = {
    classic: { name: 'Classic (I-V-vi-IV)', chords: [0, 4, 5, 3] }, // C-G-Am-F
    jazz: { name: 'Jazz (ii-V-I-vi)', chords: [1, 4, 0, 5] }, // Dm-G-C-Am
    pop: { name: 'Pop (vi-IV-I-V)', chords: [5, 3, 0, 4] }, // Am-F-C-G
    electronic: { name: 'Electronic (i-VII-VI-VII)', chords: [5, 6, 3, 6] } // Am-G-F-G
  };

  // Generate chord notes
  const generateChordNotes = (rootNote: string, chordType: 'major' | 'minor' = 'major') => {
    const noteToMidi: { [key: string]: number } = {
      'C': 60, 'C#': 61, 'D': 62, 'D#': 63, 'E': 64, 'F': 65,
      'F#': 66, 'G': 67, 'G#': 68, 'A': 69, 'A#': 70, 'B': 71,
      'Bb': 70, 'Db': 61, 'Eb': 63, 'Gb': 66, 'Ab': 68
    };

    const root = noteToMidi[rootNote] || 60;
    if (chordType === 'major') {
      return [root, root + 4, root + 7]; // Major triad
    } else {
      return [root, root + 3, root + 7]; // Minor triad
    }
  };

  // Play chord function
  const playChord = (chordNotes: number[]) => {
    chordNotes.forEach((pitch, index) => {
      const newNote: Note = {
        id: `chord-${Date.now()}-${index}`,
        pitch,
        start: Date.now() / 1000,
        duration: 1.0,
        velocity: 80,
        trackId: selectedTrack
      };
      
      setTimeout(() => {
        // Simulate audio playback
        console.log(`Playing chord note: ${pitch}`);
      }, index * 50);
    });
  };

  // Generate progression function
  const generateProgression = () => {
    const progression = CHORD_PROGRESSIONS[selectedChordProgression];
    const scaleNotes = getCurrentScaleNotes();
    const newNotes: Note[] = [];
    
    progression.chords.forEach((chordIndex, beatIndex) => {
      const rootNote = scaleNotes[chordIndex];
      const chordNotes = generateChordNotes(rootNote, 'major');
      
      chordNotes.forEach((pitch, noteIndex) => {
        newNotes.push({
          id: `prog-${Date.now()}-${beatIndex}-${noteIndex}`,
          pitch,
          start: beatIndex * 2, // 2 beats per chord
          duration: 1.5,
          velocity: 70,
          trackId: selectedTrack
        });
      });
    });

    setNotes(prev => [...prev, ...newNotes]);
    toast({
      title: "Chord progression generated",
      description: `Added ${progression.name} progression in ${scale}`
    });
  };

  // Play full progression
  const playProgression = () => {
    const progression = CHORD_PROGRESSIONS[selectedChordProgression];
    const scaleNotes = getCurrentScaleNotes();
    
    progression.chords.forEach((chordIndex, beatIndex) => {
      setTimeout(() => {
        const rootNote = scaleNotes[chordIndex];
        const chordNotes = generateChordNotes(rootNote, 'major');
        playChord(chordNotes);
      }, beatIndex * 1000);
    });
  };

  const clearNotes = () => {
    setNotes([]);
    toast({
      title: "Notes cleared",
      description: "All notes have been removed from the composition"
    });
  };

  // Track management functions
  const updateTrackInstrument = (trackId: string, instrument: string) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, instrument } : track
    ));
    toast({
      title: "Instrument changed",
      description: `Updated ${tracks.find(t => t.id === trackId)?.name} to ${INSTRUMENTS.find(i => i.value === instrument)?.label}`
    });
  };

  const updateTrackVolume = (trackId: string, volume: number) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, volume } : track
    ));
  };

  const toggleTrackMute = (trackId: string) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, muted: !track.muted } : track
    ));
  };

  const toggleTrackSolo = (trackId: string) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, solo: !track.solo } : track
    ));
  };

  return (
    <div className="w-full h-full bg-gray-900 text-white p-4 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">🎹 Melody Composer</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">Scale: {scale}</span>
            <span className="text-sm text-gray-400">Tempo: {tempo} BPM</span>
          </div>
        </div>

        {/* Multi-Track System */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-white">🎛️ Multi-Track System</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tracks.map((track) => (
              <div key={track.id} className={`bg-gray-700 rounded-lg p-4 border-2 ${
                selectedTrack === track.id ? 'border-blue-500' : 'border-gray-600'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-white">{track.name}</h4>
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant={track.muted ? "destructive" : "outline"}
                      onClick={() => toggleTrackMute(track.id)}
                      className="px-2 py-1 text-xs"
                    >
                      {track.muted ? 'M' : 'M'}
                    </Button>
                    <Button
                      size="sm"
                      variant={track.solo ? "default" : "outline"}
                      onClick={() => toggleTrackSolo(track.id)}
                      className="px-2 py-1 text-xs"
                    >
                      {track.solo ? 'S' : 'S'}
                    </Button>
                  </div>
                </div>
                
                {/* Instrument Selector */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-300 mb-1">Instrument</label>
                  <Select
                    value={track.instrument}
                    onValueChange={(value) => updateTrackInstrument(track.id, value)}
                  >
                    <SelectTrigger className="w-full bg-gray-600 border-gray-500 text-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-600 border-gray-500">
                      {INSTRUMENTS.map((instrument) => (
                        <SelectItem key={instrument.value} value={instrument.value} className="text-white hover:bg-gray-500">
                          {instrument.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Volume Control */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-300 mb-1">Volume: {track.volume}%</label>
                  <Slider
                    value={[track.volume]}
                    onValueChange={([value]) => updateTrackVolume(track.id, value)}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Select Track Button */}
                <Button
                  size="sm"
                  variant={selectedTrack === track.id ? "default" : "outline"}
                  onClick={() => setSelectedTrack(track.id)}
                  className="w-full text-xs"
                >
                  {selectedTrack === track.id ? '✓ Selected' : 'Select Track'}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Scale</label>
            <Select value={scale} onValueChange={setScale}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="C Major">C Major</SelectItem>
                <SelectItem value="G Major">G Major</SelectItem>
                <SelectItem value="D Major">D Major</SelectItem>
                <SelectItem value="A Major">A Major</SelectItem>
                <SelectItem value="E Major">E Major</SelectItem>
                <SelectItem value="B Major">B Major</SelectItem>
                <SelectItem value="F# Major">F# Major</SelectItem>
                <SelectItem value="F Major">F Major</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tempo: {tempo} BPM</label>
            <Slider
              value={[tempo]}
              onValueChange={([value]) => setTempo(value)}
              min={60}
              max={200}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Current Track</label>
            <Select value={selectedTrack} onValueChange={setSelectedTrack}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tracks.map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    {track.name} ({INSTRUMENTS.find(i => i.value === track.instrument)?.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Tools Toggle */}
        <div className="flex space-x-4">
          <Button
            variant={showCircleOfFifths ? "default" : "outline"}
            onClick={() => setShowCircleOfFifths(!showCircleOfFifths)}
          >
            🎼 Circle of Fifths
          </Button>
          <Button
            variant={showStepSequencer ? "default" : "outline"}
            onClick={() => setShowStepSequencer(!showStepSequencer)}
          >
            🎛️ Step Sequencer
          </Button>
        </div>

        {/* Circle of Fifths */}
        {showCircleOfFifths && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-white">🎼 Circle of Fifths & Chord Progression Builder</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Circle of Fifths Wheel */}
              <div className="flex flex-col items-center">
                <h4 className="text-lg font-medium mb-4 text-white">Interactive Circle</h4>
                <div className="relative w-80 h-80">
                  <svg viewBox="0 0 400 400" className="w-full h-full">
                    {/* Outer circle - Major keys */}
                    {CIRCLE_OF_FIFTHS.map((key, index) => {
                      const angle = (index * 30 - 90) * (Math.PI / 180);
                      const x = 200 + 140 * Math.cos(angle);
                      const y = 200 + 140 * Math.sin(angle);
                      const isSelected = getCurrentKeyRoot() === key;
                      
                      return (
                        <g key={key}>
                          <circle
                            cx={x}
                            cy={y}
                            r="25"
                            fill={isSelected ? "#3b82f6" : "#374151"}
                            stroke={isSelected ? "#60a5fa" : "#6b7280"}
                            strokeWidth="2"
                            className="cursor-pointer hover:fill-gray-600 transition-colors"
                            onClick={() => setScale(`${key} Major`)}
                          />
                          <text
                            x={x}
                            y={y + 5}
                            textAnchor="middle"
                            className="fill-white text-sm font-medium pointer-events-none"
                          >
                            {key}
                          </text>
                        </g>
                      );
                    })}
                    
                    {/* Inner circle - Minor keys */}
                    {RELATIVE_MINORS.map((key, index) => {
                      const angle = (index * 30 - 90) * (Math.PI / 180);
                      const x = 200 + 80 * Math.cos(angle);
                      const y = 200 + 80 * Math.sin(angle);
                      
                      return (
                        <g key={key}>
                          <circle
                            cx={x}
                            cy={y}
                            r="20"
                            fill="#1f2937"
                            stroke="#6b7280"
                            strokeWidth="1"
                            className="cursor-pointer hover:fill-gray-700 transition-colors"
                            onClick={() => setScale(`${key.replace('m', '')} Minor`)}
                          />
                          <text
                            x={x}
                            y={y + 4}
                            textAnchor="middle"
                            className="fill-white text-xs pointer-events-none"
                          >
                            {key}
                          </text>
                        </g>
                      );
                    })}
                    
                    {/* Center circle */}
                    <circle
                      cx="200"
                      cy="200"
                      r="30"
                      fill="#111827"
                      stroke="#374151"
                      strokeWidth="2"
                    />
                    <text
                      x="200"
                      y="205"
                      textAnchor="middle"
                      className="fill-white text-sm font-bold"
                    >
                      {getCurrentKeyRoot()}
                    </text>
                  </svg>
                </div>
              </div>

              {/* Chord Progression Builder */}
              <div>
                <h4 className="text-lg font-medium mb-4 text-white">Chord Progression Builder</h4>
                
                {/* Progression Style Selector */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-gray-300">Progression Style</label>
                  <Select
                    value={selectedChordProgression}
                    onValueChange={(value: any) => setSelectedChordProgression(value)}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {Object.entries(CHORD_PROGRESSIONS).map(([key, prog]) => (
                        <SelectItem key={key} value={key} className="text-white hover:bg-gray-600">
                          {prog.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Individual Chord Buttons */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-gray-300">Individual Chords</label>
                  <div className="grid grid-cols-4 gap-2">
                    {CHORD_PROGRESSIONS[selectedChordProgression].chords.map((chordIndex, beatIndex) => {
                      const scaleNotes = getCurrentScaleNotes();
                      const chordRoot = scaleNotes[chordIndex];
                      return (
                        <Button
                          key={beatIndex}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const chordNotes = generateChordNotes(chordRoot, 'major');
                            playChord(chordNotes);
                          }}
                          className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                        >
                          {chordRoot}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={generateProgression}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    ✨ Generate Progression
                  </Button>
                  <Button
                    onClick={playProgression}
                    variant="outline"
                    className="w-full border-gray-600 text-white hover:bg-gray-700"
                  >
                    ▶️ Play All
                  </Button>
                  <Button
                    onClick={clearNotes}
                    variant="outline"
                    className="w-full border-red-600 text-red-400 hover:bg-red-900"
                  >
                    🗑️ Clear Notes
                  </Button>
                </div>

                {/* Music Theory Info */}
                <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                  <h5 className="text-sm font-medium mb-2 text-white">Current Key Info</h5>
                  <p className="text-xs text-gray-300">
                    <strong>Key:</strong> {scale}<br/>
                    <strong>Scale Notes:</strong> {getCurrentScaleNotes().join(', ')}<br/>
                    <strong>Progression:</strong> {CHORD_PROGRESSIONS[selectedChordProgression].name}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step Sequencer */}
        {showStepSequencer && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-white">🎛️ Step Sequencer</h3>
            <div className="text-center text-gray-400">
              <p>Step sequencer interface will be implemented here</p>
              <p>16-step patterns for each track with visual beat indicators</p>
            </div>
          </div>
        )}

        {/* Piano Roll Placeholder */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-white">🎹 Piano Roll</h3>
          <div className="text-center text-gray-400">
            <p>Notes: {notes.length} | Selected Track: {tracks.find(t => t.id === selectedTrack)?.name}</p>
            <p>Piano roll interface with note visualization will be rendered here</p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex justify-center space-x-4">
          <Button
            onClick={() => setIsPlaying(!isPlaying)}
            size="lg"
            className={isPlaying ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </Button>
          <Button
            onClick={() => setIsPlaying(false)}
            size="lg"
            variant="outline"
          >
            ⏹️ Stop
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MelodyComposer;
