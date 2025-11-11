import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RealisticAudioEngine } from '@/lib/realisticAudio';
import { Play, Piano, Guitar, Drum, Music2, Volume2 } from 'lucide-react';

export default function AudioEngineTest() {
  const [selectedInstrument, setSelectedInstrument] = useState('acoustic_grand_piano');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioEngineRef = useRef<RealisticAudioEngine | null>(null);

  // Popular instruments to test
  const instruments = [
    { id: 'acoustic_grand_piano', name: '🎹 Grand Piano', icon: Piano },
    { id: 'acoustic_guitar_steel', name: '🎸 Acoustic Guitar', icon: Guitar },
    { id: 'electric_guitar_clean', name: '🎸 Electric Guitar', icon: Guitar },
    { id: 'violin', name: '🎻 Violin', icon: Music2 },
    { id: 'trumpet', name: '🎺 Trumpet', icon: Music2 },
    { id: 'tenor_sax', name: '🎷 Saxophone', icon: Music2 },
    { id: 'string_ensemble_1', name: '🎻 String Ensemble', icon: Music2 },
    { id: 'synth_bass_1', name: '🎹 Synth Bass', icon: Music2 },
    { id: 'lead_2_sawtooth', name: '🎹 Synth Lead', icon: Music2 },
    { id: 'choir_aahs', name: '🎤 Choir', icon: Music2 },
    { id: 'drums', name: '🥁 Drums', icon: Drum },
  ];

  const playTestSequence = async () => {
    setIsPlaying(true);
    
    // Initialize audio engine if needed
    if (!audioEngineRef.current) {
      audioEngineRef.current = new RealisticAudioEngine();
    }
    
    const engine = audioEngineRef.current;
    await engine.initialize();
    
    if (selectedInstrument === 'drums') {
      // Play a drum pattern
      const drumSounds = ['C2', 'D2', 'F#2']; // Kick, Snare, Hi-hat
      const pattern = [
        { sound: 'C2', time: 0 },     // Kick
        { sound: 'F#2', time: 0 },    // Hi-hat
        { sound: 'F#2', time: 250 },  // Hi-hat
        { sound: 'D2', time: 500 },   // Snare
        { sound: 'F#2', time: 500 },  // Hi-hat
        { sound: 'F#2', time: 750 },  // Hi-hat
        { sound: 'C2', time: 1000 },  // Kick
        { sound: 'F#2', time: 1000 }, // Hi-hat
        { sound: 'C2', time: 1250 },  // Kick
        { sound: 'F#2', time: 1250 }, // Hi-hat
        { sound: 'D2', time: 1500 },  // Snare
        { sound: 'F#2', time: 1500 }, // Hi-hat
        { sound: 'F#2', time: 1750 }, // Hi-hat
      ];
      
      // Play the drum pattern
      pattern.forEach(({ sound, time }) => {
        setTimeout(() => engine.playDrumSound(sound, 0.8), time);
      });
      
      setTimeout(() => setIsPlaying(false), 2000);
    } else {
      // Load the selected instrument
      await engine.loadAdditionalInstrument(selectedInstrument);
      
      // Play a simple melody
      const notes = [
        { note: 'C', octave: 4, time: 0 },
        { note: 'E', octave: 4, time: 250 },
        { note: 'G', octave: 4, time: 500 },
        { note: 'C', octave: 5, time: 750 },
        { note: 'G', octave: 4, time: 1000 },
        { note: 'E', octave: 4, time: 1250 },
        { note: 'C', octave: 4, time: 1500 },
      ];
      
      // Play the melody
      notes.forEach(({ note, octave, time }) => {
        setTimeout(() => {
          engine.playNote(note, octave, 0.5, selectedInstrument, 0.8);
        }, time);
      });
      
      setTimeout(() => setIsPlaying(false), 2000);
    }
  };

  const playScale = async () => {
    setIsPlaying(true);
    
    if (!audioEngineRef.current) {
      audioEngineRef.current = new RealisticAudioEngine();
    }
    
    const engine = audioEngineRef.current;
    await engine.initialize();
    
    if (selectedInstrument !== 'drums') {
      await engine.loadAdditionalInstrument(selectedInstrument);
      
      // Play C major scale
      const scale = [
        { note: 'C', octave: 4 },
        { note: 'D', octave: 4 },
        { note: 'E', octave: 4 },
        { note: 'F', octave: 4 },
        { note: 'G', octave: 4 },
        { note: 'A', octave: 4 },
        { note: 'B', octave: 4 },
        { note: 'C', octave: 5 },
      ];
      
      scale.forEach(({ note, octave }, index) => {
        setTimeout(() => {
          engine.playNote(note, octave, 0.4, selectedInstrument, 0.7);
        }, index * 300);
      });
      
      setTimeout(() => setIsPlaying(false), 2400);
    }
  };

  const playChord = async () => {
    setIsPlaying(true);
    
    if (!audioEngineRef.current) {
      audioEngineRef.current = new RealisticAudioEngine();
    }
    
    const engine = audioEngineRef.current;
    await engine.initialize();
    
    if (selectedInstrument !== 'drums') {
      await engine.loadAdditionalInstrument(selectedInstrument);
      
      // Play C major chord
      engine.playNote('C', 4, 1, selectedInstrument, 0.8);
      engine.playNote('E', 4, 1, selectedInstrument, 0.8);
      engine.playNote('G', 4, 1, selectedInstrument, 0.8);
      
      setTimeout(() => setIsPlaying(false), 1000);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-purple-400" />
          Test Your Realistic Audio Engine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-purple-950/50 rounded-lg border border-purple-500/20">
          <p className="text-sm text-purple-300 mb-3">
            Your RealisticAudioEngine has 50+ high-quality soundfont instruments ready to play!
            Select an instrument and click the buttons to hear it in action.
          </p>
          
          {/* Instrument Selector */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-2 block">Select Instrument</label>
            <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {instruments.map(inst => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Test Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={playTestSequence}
              disabled={isPlaying}
              className="bg-purple-600 hover:bg-purple-500"
            >
              <Play className="w-4 h-4 mr-1" />
              {selectedInstrument === 'drums' ? 'Play Beat' : 'Play Melody'}
            </Button>
            
            {selectedInstrument !== 'drums' && (
              <>
                <Button
                  onClick={playScale}
                  disabled={isPlaying}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  <Music2 className="w-4 h-4 mr-1" />
                  Play Scale
                </Button>
                
                <Button
                  onClick={playChord}
                  disabled={isPlaying}
                  className="bg-green-600 hover:bg-green-500"
                >
                  <Piano className="w-4 h-4 mr-1" />
                  Play Chord
                </Button>
              </>
            )}
          </div>

          {isPlaying && (
            <div className="mt-3 text-center">
              <span className="text-yellow-400 animate-pulse">
                ♪ Playing {instruments.find(i => i.id === selectedInstrument)?.name}...
              </span>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>✓ Grand pianos, electric pianos, harpsichord</p>
          <p>✓ Acoustic & electric guitars</p>
          <p>✓ Full orchestra: strings, brass, woodwinds</p>
          <p>✓ Synthesizers, pads, and leads</p>
          <p>✓ Drums and percussion</p>
          <p>✓ And 40+ more instruments!</p>
        </div>
      </CardContent>
    </Card>
  );
}