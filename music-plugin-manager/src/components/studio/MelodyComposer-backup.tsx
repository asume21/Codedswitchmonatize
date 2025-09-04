import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';
import { generateMelody } from '@/services/grok';
import { RealisticAudioEngine } from '@/components/audio/RealisticAudioEngine';

interface Note {
  id: string;
  note: string;
  octave: number;
  duration: number;
  start: number;
  track: string;
  velocity: number;
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

const MelodyComposer: React.FC = () => {
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
  
  // Default tracks
  const [tracks] = useState<Track[]>([
    { id: 'track1', name: 'Lead', instrument: 'acoustic_grand_piano', volume: 80, pan: 0, muted: false, solo: false },
    { id: 'track2', name: 'Bass', instrument: 'acoustic_bass', volume: 70, pan: -20, muted: false, solo: false },
    { id: 'track3', name: 'Drums', instrument: 'synth_drum', volume: 85, pan: 0, muted: false, solo: false },
    { id: 'track4', name: 'Harmony', instrument: 'pad_2_warm', volume: 60, pan: 20, muted: false, solo: false }
  ]);

  // Circle of Fifths constants
  const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
  const RELATIVE_MINORS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Fm', 'Cm', 'Gm', 'Dm'];

  // Helper functions
  const getCurrentKeyRoot = () => {
    return scale.split(' ')[0];
  };

  const getCurrentScaleNotes = () => {
    const root = getCurrentKeyRoot();
    const majorScale = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const rootIndex = majorScale.indexOf(root);
    if (rootIndex === -1) return majorScale;
    
    return [...majorScale.slice(rootIndex), ...majorScale.slice(0, rootIndex)];
  };

  const getChordProgressionForStyle = (style: string) => {
    const progressions = {
      classic: ['I', 'V', 'vi', 'IV'],
      jazz: ['ii', 'V', 'I', 'vi'],
      pop: ['vi', 'IV', 'I', 'V'],
      electronic: ['i', 'VII', 'VI', 'VII']
    };
    return progressions[style as keyof typeof progressions] || progressions.classic;
  };

  const getChordRootFromRoman = (romanNumeral: string, scaleNotes: string[]) => {
    const romanToIndex: {[key: string]: number} = {
      'I': 0, 'ii': 1, 'iii': 2, 'IV': 3, 'V': 4, 'vi': 5, 'vii': 6,
      'i': 0, 'II': 1, 'III': 2, 'iv': 3, 'v': 4, 'VI': 5, 'VII': 6
    };
    
    const index = romanToIndex[romanNumeral];
    return index !== undefined ? scaleNotes[index] : scaleNotes[0];
  };

  const getChordNotes = (rootNote: string) => {
    const noteMap: { [key: string]: number } = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    
    const rootIndex = noteMap[rootNote];
    if (rootIndex === undefined) return [];
    
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    return [
      { note: notes[rootIndex] },
      { note: notes[(rootIndex + 4) % 12] },
      { note: notes[(rootIndex + 7) % 12] }
    ];
  };

  const playChordFromProgression = (romanNumeral: string) => {
    const scaleNotes = getCurrentScaleNotes();
    const chordRoot = getChordRootFromRoman(romanNumeral, scaleNotes);
    const chordTones = getChordNotes(chordRoot);
    
    chordTones.forEach((tone, index) => {
      setTimeout(() => {
        if (realisticAudioRef.current) {
          realisticAudioRef.current.playNote(tone.note, 4, 'acoustic_grand_piano', 0.8);
        }
      }, index * 50);
    });
  };

  const generateChordProgression = () => {
    const progression = getChordProgressionForStyle(selectedChordProgression);
    const progressionNotes: Note[] = [];
    let currentTime = 0;

    progression.forEach((romanNumeral, chordIndex) => {
      const scaleNotes = getCurrentScaleNotes();
      const chordRoot = getChordRootFromRoman(romanNumeral, scaleNotes);
      
      if (chordRoot) {
        const chordTones = getChordNotes(chordRoot);
        
        chordTones.forEach((tone, noteIndex) => {
          progressionNotes.push({
            id: `chord-${Date.now()}-${chordIndex}-${noteIndex}-${Math.random()}`,
            note: tone.note,
            octave: 4,
            duration: 1.5,
            start: currentTime + (noteIndex * 0.05),
            track: selectedTrack,
            velocity: 85
          });
        });
      }
      
      currentTime += 2;
    });

    setNotes(prev => [...prev, ...progressionNotes]);
    
    toast({
      title: "Chord progression added",
      description: `Generated ${progression.join(' - ')} progression in ${scale}`
    });
  };

  const playFullProgression = () => {
    const progression = getChordProgressionForStyle(selectedChordProgression);
    
    progression.forEach((romanNumeral, index) => {
      setTimeout(() => {
        playChordFromProgression(romanNumeral);
      }, index * 2000);
    });

    toast({
      title: "Playing chord progression",
      description: `${progression.join(' - ')} in ${scale}`
    });
  };

  const clearNotes = () => {
    setNotes([]);
    toast({
      title: "Notes cleared",
      description: "All notes have been removed from the composition"
    });
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
            <label className="text-sm font-medium">Tempo</label>
            <Slider
              value={[tempo]}
              onValueChange={(value) => setTempo(value[0])}
              min={60}
              max={200}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Track</label>
            <Select value={selectedTrack} onValueChange={setSelectedTrack}>
              <SelectTrigger>
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
        </div>

        {/* Advanced Tools Toggle */}
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-200">Advanced Tools</h3>
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={() => setShowStepSequencer(!showStepSequencer)}
                className={`h-8 px-3 ${showStepSequencer ? 'bg-blue-600' : 'bg-gray-600'}`}
              >
                🎛️ Step Sequencer
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCircleOfFifths(!showCircleOfFifths)}
                className={`h-8 px-3 ${showCircleOfFifths ? 'bg-purple-600' : 'bg-gray-600'}`}
              >
                🎼 Circle of Fifths
              </Button>
            </div>
          </div>
        </div>

        {/* Circle of Fifths Panel */}
        {showCircleOfFifths && (
          <div className="bg-gray-800 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                🎼 Circle of Fifths - Chord Progression Builder
              </h3>
              <Button
                size="sm"
                onClick={() => setShowCircleOfFifths(false)}
                variant="outline"
                className="h-8 px-3"
              >
                ✕ Close
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Circle of Fifths Wheel */}
              <div className="flex flex-col items-center">
                <div className="relative w-64 h-64 mb-4">
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {/* Outer circle (Major keys) */}
                    {CIRCLE_OF_FIFTHS.map((key, index) => {
                      const angle = (index * 30 - 90) * (Math.PI / 180);
                      const x = 100 + 70 * Math.cos(angle);
                      const y = 100 + 70 * Math.sin(angle);
                      
                      return (
                        <g key={key}>
                          <circle
                            cx={x}
                            cy={y}
                            r="15"
                            fill={scale.includes(key) ? "#3b82f6" : "#374151"}
                            stroke="#6b7280"
                            strokeWidth="2"
                            className="cursor-pointer hover:fill-blue-400 transition-colors"
                            onClick={() => setScale(`${key} Major`)}
                          />
                          <text
                            x={x}
                            y={y + 4}
                            textAnchor="middle"
                            className="text-xs fill-white font-medium pointer-events-none"
                          >
                            {key}
                          </text>
                        </g>
                      );
                    })}

                    {/* Inner circle (Minor keys) */}
                    {RELATIVE_MINORS.map((key, index) => {
                      const angle = (index * 30 - 90) * (Math.PI / 180);
                      const x = 100 + 40 * Math.cos(angle);
                      const y = 100 + 40 * Math.sin(angle);
                      
                      return (
                        <g key={key}>
                          <circle
                            cx={x}
                            cy={y}
                            r="12"
                            fill={scale.includes(key.replace('m', '')) ? "#8b5cf6" : "#4b5563"}
                            stroke="#6b7280"
                            strokeWidth="1"
                            className="cursor-pointer hover:fill-purple-400 transition-colors"
                            onClick={() => setScale(`${key.replace('m', '')} Minor`)}
                          />
                          <text
                            x={x}
                            y={y + 3}
                            textAnchor="middle"
                            className="text-xs fill-white font-medium pointer-events-none"
                          >
                            {key}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                
                <p className="text-sm text-gray-400 text-center">
                  Click outer circle for Major keys, inner circle for Minor keys
                </p>
              </div>

              {/* Chord Progression Controls */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-200 mb-2 block">
                    Progression Style
                  </label>
                  <Select value={selectedChordProgression} onValueChange={(value: 'classic' | 'jazz' | 'pop' | 'electronic') => setSelectedChordProgression(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classic">Classic (I-V-vi-IV)</SelectItem>
                      <SelectItem value="jazz">Jazz (ii-V-I-vi)</SelectItem>
                      <SelectItem value="pop">Pop (vi-IV-I-V)</SelectItem>
                      <SelectItem value="electronic">Electronic (i-VII-VI-VII)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-200">Current Progression:</h4>
                  <div className="flex space-x-2">
                    {getChordProgressionForStyle(selectedChordProgression).map((chord, index) => (
                      <Button
                        key={index}
                        size="sm"
                        variant="outline"
                        onClick={() => playChordFromProgression(chord)}
                        className="h-8 px-3 text-xs"
                      >
                        {chord}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={generateChordProgression}
                    className="flex-1 bg-purple-600 hover:bg-purple-500"
                  >
                    ✨ Generate Progression
                  </Button>
                  <Button
                    onClick={playFullProgression}
                    variant="outline"
                    className="flex-1"
                  >
                    ▶️ Play All
                  </Button>
                </div>

                <div className="bg-gray-700 rounded p-3">
                  <h4 className="text-sm font-medium text-gray-200 mb-2">Music Theory Info</h4>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>Current Key: <span className="text-white">{getCurrentKeyRoot()} Major</span></div>
                    <div>Scale Notes: <span className="text-white">{getCurrentScaleNotes().join(' - ')}</span></div>
                    <div>Progression: <span className="text-white">{getChordProgressionForStyle(selectedChordProgression).join(' - ')}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <Button
            onClick={clearNotes}
            variant="outline"
            className="flex-1"
          >
            🗑️ Clear All
          </Button>
          <Button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex-1 ${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
          >
            {isPlaying ? '⏹️ Stop' : '▶️ Play'}
          </Button>
        </div>

        {/* Notes Display */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">Composition ({notes.length} notes)</h3>
          <div className="text-sm text-gray-400">
            {notes.length === 0 ? (
              <p>No notes yet. Use the Circle of Fifths to generate chord progressions!</p>
            ) : (
              <p>Notes ready for playback. Click Play to hear your composition.</p>
            )}
          </div>
        </div>

        {/* Audio Engine */}
        <RealisticAudioEngine ref={realisticAudioRef} />
      </div>
    </div>
  );
};

export default MelodyComposer;
