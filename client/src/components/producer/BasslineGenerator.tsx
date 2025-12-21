import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Square, Zap, Music2, Volume2 } from 'lucide-react';
import { useAudio } from '@/hooks/use-audio';

interface BasslineGeneratorProps {
  kickPattern?: boolean[];
  bpm?: number;
  onBasslineChange?: (bassline: any) => void;
}

const BASS_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HIP_HOP_SCALES = {
  'minor': [0, 2, 3, 5, 7, 8, 10], // Natural minor
  'dorian': [0, 2, 3, 5, 7, 9, 10], // Dorian mode
  'blues': [0, 3, 5, 6, 7, 10], // Blues scale
  'pentatonic': [0, 3, 5, 7, 10] // Minor pentatonic
};

export function BasslineGenerator({ 
  kickPattern = new Array(16).fill(false), 
  bpm = 90,
  onBasslineChange 
}: BasslineGeneratorProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bassPattern, setBassPattern] = useState<string[]>(new Array(16).fill(''));
  const [bassLengths, setBassLengths] = useState<number[]>(new Array(16).fill(0.5)); // Note durations
  const [rootNote, setRootNote] = useState('C');
  const [scale, setScale] = useState<keyof typeof HIP_HOP_SCALES>('minor');
  const [octave, setOctave] = useState([2]);
  const [volume, setVolume] = useState([80]);
  const [syncToKick, setSyncToKick] = useState(true);
  const [defaultDuration, setDefaultDuration] = useState([0.5]); // Default note length
  
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playNote, initialize } = useAudio();

  // Generate scale notes based on root and scale type
  const getScaleNotes = () => {
    const rootIndex = BASS_NOTES.indexOf(rootNote);
    const scalePattern = HIP_HOP_SCALES[scale];
    
    return scalePattern.map(interval => {
      const noteIndex = (rootIndex + interval) % 12;
      return BASS_NOTES[noteIndex];
    });
  };

  // Generate classic hip-hop bassline
  const generateClassicBassline = () => {
    const scaleNotes = getScaleNotes();
    const newPattern = new Array(16).fill('');
    
    // Classic "All Eyez On Me" style bassline
    // Root note on kick hits, fifth and third for movement
    kickPattern.forEach((hasKick, index) => {
      if (hasKick) {
        // Root note on kick hits
        newPattern[index] = scaleNotes[0]; // Root
      } else if (index % 4 === 2) {
        // Fifth on beat 3
        newPattern[index] = scaleNotes[4] || scaleNotes[2]; // Fifth or third
      } else if (index % 8 === 6) {
        // Third for movement
        newPattern[index] = scaleNotes[2]; // Third
      }
    });
    
    // Add some syncopation if no kick sync
    if (!syncToKick || kickPattern.every(k => !k)) {
      newPattern[0] = scaleNotes[0]; // Root on 1
      newPattern[6] = scaleNotes[2]; // Third
      newPattern[8] = scaleNotes[0]; // Root
      newPattern[14] = scaleNotes[4] || scaleNotes[1]; // Fifth or second
    }
    
    setBassPattern(newPattern);
    onBasslineChange?.({
      pattern: newPattern,
      rootNote,
      scale,
      octave: octave[0],
      bpm
    });
  };

  // Generate 808-style bassline
  const generate808Bassline = () => {
    const scaleNotes = getScaleNotes();
    const newPattern = new Array(16).fill('');
    
    // 808-style: longer notes, more space
    newPattern[0] = scaleNotes[0]; // Root
    newPattern[4] = scaleNotes[0]; // Root
    newPattern[8] = scaleNotes[2]; // Third
    newPattern[12] = scaleNotes[4] || scaleNotes[1]; // Fifth
    
    setBassPattern(newPattern);
    onBasslineChange?.({
      pattern: newPattern,
      rootNote,
      scale,
      octave: octave[0],
      bpm,
      style: '808'
    });
  };

  // Play bass sound with custom duration
  const playBassNote = async (note: string, duration: number = 0.5) => {
    if (!note) return;
    await initialize();
    const vel = Math.max(0, Math.min(1, volume[0] / 100));
    playNote(note, octave[0], duration, 'bass', vel);
  };

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      const stepTime = (60 / bpm) * 1000 / 4; // 16th notes
      
      intervalRef.current = setTimeout(() => {
        const note = bassPattern[currentStep];
        if (note) {
          const duration = bassLengths[currentStep];
          void playBassNote(note, duration);
        }
        
        setCurrentStep((prev) => (prev + 1) % 16);
      }, stepTime);
    }
    
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isPlaying, currentStep, bassPattern, octave, volume, bpm]);

  const togglePlay = () => {
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    if (!newPlaying) {
      setCurrentStep(0);
    }
  };

  // Sync with master play state  
  useEffect(() => {
    const masterPlayHandler = (event: any) => {
      const shouldPlay = event.detail?.playing;
      console.log(`🎸 Bass received master control: ${shouldPlay ? 'PLAY' : 'STOP'}`);
      
      if (shouldPlay !== undefined) {
        setIsPlaying(shouldPlay);
        if (!shouldPlay) {
          setCurrentStep(0);
        }
      }
    };

    window.addEventListener('masterPlayControl', masterPlayHandler);
    return () => window.removeEventListener('masterPlayControl', masterPlayHandler);
  }, []);

  const clearPattern = () => {
    setBassPattern(new Array(16).fill(''));
    setBassLengths(new Array(16).fill(0.5));
  };

  const setStepNote = (stepIndex: number, note: string) => {
    const newPattern = [...bassPattern];
    newPattern[stepIndex] = note;
    
    // Set default duration for new notes
    if (note && note !== '-' && !bassPattern[stepIndex]) {
      const newLengths = [...bassLengths];
      newLengths[stepIndex] = defaultDuration[0];
      setBassLengths(newLengths);
    }
    
    const nextLengths = note && note !== '-' && !bassPattern[stepIndex]
      ? (() => {
          const newLengths = [...bassLengths];
          newLengths[stepIndex] = defaultDuration[0];
          return newLengths;
        })()
      : bassLengths;

    setBassPattern(newPattern);
    if (nextLengths !== bassLengths) {
      setBassLengths(nextLengths);
    }
    onBasslineChange?.({
      pattern: newPattern,
      lengths: nextLengths,
      rootNote,
      scale,
      octave: octave[0],
      bpm
    });
    
    // Live playback - play the bass note immediately when selected
    if (note && note !== '-') {
      void playBassNote(note, nextLengths[stepIndex]);
    }
  };

  const setStepDuration = (stepIndex: number, duration: number) => {
    const newLengths = [...bassLengths];
    newLengths[stepIndex] = duration;
    setBassLengths(newLengths);
    
    onBasslineChange?.({
      pattern: bassPattern,
      lengths: newLengths,
      rootNote,
      scale,
      octave: octave[0],
      bpm
    });
    
    // Live preview with new duration
    const note = bassPattern[stepIndex];
    if (note && note !== '-') {
      playBassNote(note, duration);
    }
  };

  const scaleNotes = getScaleNotes();

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Music2 className="h-6 w-6 text-blue-500" />
          <h3 className="text-2xl font-bold">Bassline Generator</h3>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Hip-Hop Bass
          </Badge>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            syncToKick ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">
              {syncToKick ? 'Synced to Kick' : 'Free Mode'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium">Root Note</label>
          <Select value={rootNote} onValueChange={setRootNote}>
            <SelectTrigger data-testid="select-root-note">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASS_NOTES.map(note => (
                <SelectItem key={note} value={note}>{note}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="text-sm font-medium">Scale</label>
          <Select value={scale} onValueChange={(value: keyof typeof HIP_HOP_SCALES) => setScale(value)}>
            <SelectTrigger data-testid="select-scale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="dorian">Dorian</SelectItem>
              <SelectItem value="blues">Blues</SelectItem>
              <SelectItem value="pentatonic">Pentatonic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="text-sm font-medium">Octave: {octave[0]}</label>
          <Slider
            value={octave}
            onValueChange={setOctave}
            min={1}
            max={4}
            step={1}
            className="mt-2"
            data-testid="slider-octave"
          />
        </div>
        
        <div>
          <label className="text-sm font-medium">Volume: {volume[0]}</label>
          <Slider
            value={volume}
            onValueChange={setVolume}
            max={100}
            step={1}
            className="mt-2"
            data-testid="slider-bass-volume"
          />
        </div>
        
        <div>
          <label className="text-sm font-medium">Default Length: {defaultDuration[0]}s</label>
          <Slider
            value={defaultDuration}
            onValueChange={setDefaultDuration}
            min={0.1}
            max={2.0}
            step={0.1}
            className="mt-2"
            data-testid="slider-default-duration"
          />
          <div className="text-xs text-gray-500 mt-1">
            {defaultDuration[0] < 0.3 ? 'Staccato' : 
             defaultDuration[0] < 0.8 ? 'Normal' : 'Sustained'}
          </div>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center gap-4">
        <Button
          onClick={togglePlay}
          size="lg"
          data-testid="button-bass-play"
          className={isPlaying ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}
        >
          {isPlaying ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {isPlaying ? "Stop" : "Play"}
        </Button>
        
        <Button onClick={generateClassicBassline} variant="outline" data-testid="button-classic-bass">
          Classic Hip-Hop
        </Button>
        
        <Button onClick={generate808Bassline} variant="outline" data-testid="button-808-bass">
          808 Style
        </Button>
        
        <Button onClick={clearPattern} variant="outline" data-testid="button-clear-bass">
          Clear
        </Button>
        
        <Button
          onClick={() => setSyncToKick(!syncToKick)}
          variant={syncToKick ? "default" : "outline"}
          data-testid="button-sync-kick"
        >
          <Zap className="h-4 w-4 mr-2" />
          Sync to Kick
        </Button>
      </div>

      {/* Pattern Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Scale Notes:</span>
          {scaleNotes.map((note, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {note}
            </Badge>
          ))}
        </div>
        
        <div className="space-y-2">
          <div className="flex gap-1">
            {bassPattern.map((note, stepIndex) => (
              <div key={stepIndex} className="flex flex-col items-center gap-1">
                <div className="text-xs text-center w-16">
                  {stepIndex + 1}
                </div>
                
                <div className="flex flex-col gap-1">
                  <Select 
                    value={note || '-'} 
                    onValueChange={(value) => setStepNote(stepIndex, value === '-' ? '' : value)}
                  >
                    <SelectTrigger 
                      className={`w-16 h-8 p-0 text-xs ${
                        currentStep === stepIndex && isPlaying 
                          ? 'ring-2 ring-blue-400 ring-offset-2' 
                          : ''
                      } ${note ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                      data-testid={`select-bass-step-${stepIndex}`}
                    >
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">-</SelectItem>
                      {scaleNotes.map(scaleNote => (
                        <SelectItem key={scaleNote} value={scaleNote}>
                          {scaleNote}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Duration Control */}
                  {note && note !== '-' && (
                    <div className="w-16">
                      <Slider
                        value={[bassLengths[stepIndex]]}
                        onValueChange={(value) => setStepDuration(stepIndex, value[0])}
                        min={0.1}
                        max={2.0}
                        step={0.1}
                        className="h-2"
                        data-testid={`slider-duration-${stepIndex}`}
                      />
                      <div className="text-xs text-center text-gray-500 mt-1">
                        {bassLengths[stepIndex].toFixed(1)}s
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Show kick pattern for reference */}
                {kickPattern[stepIndex] && (
                  <div className="w-16 h-1 bg-red-400 rounded" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}