import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

type DrumType = 'kick' | 'snare' | 'hihat' | 'hihat-open' | 'hihat-closed' | 'clap' | 'crash' | 'ride' | 'tom1' | 'tom2' | 'tom3';

let lcgSeed = Date.now() % 2147483647;
const getSecureRandom = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] / 0xffffffff;
  }

  lcgSeed = (lcgSeed * 48271) % 2147483647;
  return lcgSeed / 2147483647;
};

interface StepSequencerPluginProps {
  tracks: Array<{ id: string; name: string; instrument: string }>;
  selectedTrack: string;
  isPlaying: boolean;
  onPlayDrum: (drumType: DrumType, velocity: number) => void;
  onPlayNote: (note: string, octave: number, duration: number, instrument: string) => void;
  onStartPlayback: () => void;
  onStopPlayback: () => void;
}

export function StepSequencerPlugin({
  tracks,
  selectedTrack,
  isPlaying,
  onPlayDrum,
  onPlayNote,
  onStartPlayback,
  onStopPlayback,
}: StepSequencerPluginProps) {
  const [patterns, setPatterns] = useState<{[trackId: string]: boolean[]}>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);

  const STEPS = 16;
  const DRUM_SOUNDS: DrumType[] = ['kick', 'snare', 'hihat-closed', 'hihat-open', 'clap', 'crash'];
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
      [trackId]: new Array(STEPS).fill(false).map(() => getSecureRandom() > 0.7)
    }));
  };

  const handlePlayClick = () => {
    if (isPlaying) {
      onStopPlayback();
    } else {
      onStartPlayback();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 text-sm text-gray-300">
          <span className="text-base font-semibold text-white">🎛️ Step Sequencer</span>
          <span className="hidden sm:inline-flex text-xs bg-green-600 px-2 py-1 rounded">Plugin</span>
          <span>
            BPM <strong className="text-white ml-1">{bpm}</strong>
          </span>
          <input
            type="range"
            min="60"
            max="200"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePlayClick}
            size="sm"
            className={isPlaying ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
          >
            {isPlaying ? '⏸ Pause' : '▶️ Play'}
          </Button>
          <Button
            onClick={onStopPlayback}
            size="sm"
            variant="outline"
          >
            ⏹ Stop
          </Button>
          <span className="text-sm text-gray-300">
            Step <span className="font-bold text-white ml-1">{currentStep + 1}/16</span>
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {tracks.map(track => (
          <div key={track.id} className="bg-gray-900/80 rounded-lg px-3 py-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm font-medium ${selectedTrack === track.id ? 'text-blue-400' : 'text-gray-200'}`}
                >
                  {track.name}
                </span>
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  {track.instrument}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => randomizePattern(track.id)}
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-xs"
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

            <div className="overflow-x-auto">
              <div className="grid grid-cols-16 gap-1 min-w-[32rem] sm:min-w-[36rem]">
                {new Array(STEPS).fill(0).map((_, stepIndex) => (
                  <button
                    key={stepIndex}
                    onClick={() => toggleStep(track.id, stepIndex)}
                    className={`
                      h-9 rounded-md text-xs font-bold transition-colors
                      ${patterns[track.id]?.[stepIndex]
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }
                      ${currentStep === stepIndex && isPlaying
                        ? 'ring-2 ring-yellow-400'
                        : ''
                      }
                      ${stepIndex % 4 === 0 ? 'border-l-2 border-gray-600 pl-1' : ''}
                    `}
                  >
                    {stepIndex + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
