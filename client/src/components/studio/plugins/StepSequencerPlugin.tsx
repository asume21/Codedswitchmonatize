import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface StepSequencerPluginProps {
  tracks: Array<{ id: string; name: string; instrument: string }>;
  selectedTrack: string;
  isPlaying: boolean;
  onPlayDrum: (drumType: string, velocity: number) => void;
  onPlayNote: (note: string, octave: number, duration: number, instrument: string) => void;
}

export function StepSequencerPlugin({ 
  tracks, 
  selectedTrack, 
  isPlaying,
  onPlayDrum,
  onPlayNote 
}: StepSequencerPluginProps) {
  const [patterns, setPatterns] = useState<{[trackId: string]: boolean[]}>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);

  const STEPS = 16;
  const DRUM_SOUNDS = ['kick', 'snare', 'hihat', 'openhat', 'clap', 'crash'];
  const MELODY_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  // Initialize patterns
  useEffect(() => {
    const newPatterns: {[trackId: string]: boolean[]} = {};
    tracks.forEach(track => {
      if (!patterns[track.id]) {
        newPatterns[track.id] = new Array(STEPS).fill(false);
      }
    });
    if (Object.keys(newPatterns).length > 0) {
      setPatterns(prev => ({ ...prev, ...newPatterns }));
    }
  }, [tracks]);

  // Step sequencer playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        const nextStep = (prev + 1) % STEPS;
        
        // Play sounds for active steps
        tracks.forEach(track => {
          if (patterns[track.id]?.[nextStep]) {
            if (track.name === 'Drums' || track.instrument.includes('drum')) {
              const drumSound = DRUM_SOUNDS[nextStep % DRUM_SOUNDS.length];
              onPlayDrum(drumSound, 0.8);
            } else {
              const note = MELODY_NOTES[nextStep % MELODY_NOTES.length];
              onPlayNote(note, 4, 0.25, track.instrument);
            }
          }
        });
        
        return nextStep;
      });
    }, (60 / bpm / 4) * 1000); // 16th notes

    return () => clearInterval(interval);
  }, [isPlaying, bpm, patterns, tracks, onPlayDrum, onPlayNote]);

  const toggleStep = (trackId: string, stepIndex: number) => {
    setPatterns(prev => ({
      ...prev,
      [trackId]: prev[trackId]?.map((step, index) => 
        index === stepIndex ? !step : step
      ) || new Array(STEPS).fill(false)
    }));
  };

  const clearPattern = (trackId: string) => {
    setPatterns(prev => ({
      ...prev,
      [trackId]: new Array(STEPS).fill(false)
    }));
  };

  const randomizePattern = (trackId: string) => {
    setPatterns(prev => ({
      ...prev,
      [trackId]: new Array(STEPS).fill(false).map(() => Math.random() > 0.7)
    }));
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
        🎛️ Step Sequencer
        <span className="ml-2 text-sm bg-green-600 px-2 py-1 rounded">PLUGIN</span>
      </h3>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-300">
            BPM: <span className="font-bold text-white">{bpm}</span>
          </div>
          <input
            type="range"
            min="60"
            max="200"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="w-24"
          />
        </div>

        <div className="text-sm text-gray-300">
          Step: <span className="font-bold text-white">{currentStep + 1}/16</span>
        </div>
      </div>

      {/* Step Grid */}
      <div className="space-y-4">
        {tracks.map(track => (
          <div key={track.id} className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium ${
                  selectedTrack === track.id ? 'text-blue-400' : 'text-gray-300'
                }`}>
                  {track.name}
                </span>
                <span className="text-xs text-gray-500">
                  {track.instrument}
                </span>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={() => randomizePattern(track.id)}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  🎲
                </Button>
                <Button
                  onClick={() => clearPattern(track.id)}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Step buttons */}
            <div className="grid grid-cols-16 gap-1">
              {new Array(STEPS).fill(0).map((_, stepIndex) => (
                <button
                  key={stepIndex}
                  onClick={() => toggleStep(track.id, stepIndex)}
                  className={`
                    w-8 h-8 rounded text-xs font-bold transition-all
                    ${patterns[track.id]?.[stepIndex] 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }
                    ${currentStep === stepIndex && isPlaying 
                      ? 'ring-2 ring-yellow-400 animate-pulse' 
                      : ''
                    }
                    ${stepIndex % 4 === 0 ? 'border-l-2 border-gray-500' : ''}
                  `}
                >
                  {stepIndex + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-gray-700 rounded text-center">
        <p className="text-sm text-gray-300">
          ✅ Step Sequencer Active | BPM: <strong>{bpm}</strong> | 
          Playing: <strong>{isPlaying ? 'Yes' : 'No'}</strong>
        </p>
      </div>
    </div>
  );
}
