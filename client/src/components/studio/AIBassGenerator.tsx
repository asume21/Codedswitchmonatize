import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Loader2, Music2, Zap, Piano, Volume2, Save, RotateCcw, Download, Trash2, Send, Circle, Square, Edit3, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { realisticAudio } from '@/lib/realisticAudio';

interface BassGeneratorProps {
  chordProgression?: Array<{ chord: string; duration: number }>;
  onBassGenerated?: (bassNotes: any[]) => void;
}

// Bass notes for interactive keyboard
const BASS_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export default function AIBassGenerator({ chordProgression, onBassGenerated }: BassGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [bassStyle, setBassStyle] = useState('808');
  const [patternType, setPatternType] = useState('root-fifth');
  const [octave, setOctave] = useState([2]); // Default octave 2 (bass range)
  const [groove, setGroove] = useState([50]); // Swing/groove amount
  const [noteLength, setNoteLength] = useState([75]); // Staccato to legato
  const [velocity, setVelocity] = useState([70]); // Note velocity
  const [glide, setGlide] = useState([0]); // Glide/portamento
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [generatedBass, setGeneratedBass] = useState<any[]>([]);
  const [recordedNotes, setRecordedNotes] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<NodeJS.Timeout | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const { toast } = useToast();

  // Initialize audio on mount
  useEffect(() => {
    realisticAudio.initialize().catch(console.error);
  }, []);

  // Play a single bass note (and record if in recording mode)
  const playBassNote = useCallback(async (note: string, oct: number = octave[0]) => {
    setActiveNote(`${note}${oct}`);
    
    // Record the note if in recording mode
    if (isRecording) {
      const currentTime = Date.now();
      const timeOffset = (currentTime - recordStartTimeRef.current) / 1000;
      const newNote = {
        note,
        octave: oct,
        time: timeOffset,
        duration: noteLength[0] / 100,
        velocity: velocity[0] / 127,
      };
      setRecordedNotes(prev => [...prev, newNote]);
    }
    
    try {
      await realisticAudio.initialize();
      // Use synth bass or electric bass based on style
      const instrument = bassStyle === 'electric' ? 'electric_bass_finger' : 
                        bassStyle === 'upright' ? 'acoustic_bass' : 'synth_bass_1';
      await realisticAudio.playNote(note, oct, noteLength[0] / 100, instrument, velocity[0] / 127);
    } catch (error) {
      console.error('Bass playback error:', error);
    }
    setTimeout(() => setActiveNote(null), 200);
  }, [octave, bassStyle, noteLength, velocity, isRecording]);

  // Toggle recording mode
  const toggleRecording = useCallback(() => {
    if (!isRecording) {
      recordStartTimeRef.current = Date.now();
      setRecordedNotes([]);
      setIsRecording(true);
      toast({ title: "🔴 Recording", description: "Play notes on the keyboard to record" });
    } else {
      setIsRecording(false);
      toast({ title: "Recording Stopped", description: `${recordedNotes.length} notes recorded` });
    }
  }, [isRecording, recordedNotes.length, toast]);

  // Use recorded notes as the generated bass line
  const useRecordedNotes = useCallback(() => {
    if (recordedNotes.length === 0) {
      toast({ title: "No Notes", description: "Record some notes first", variant: "destructive" });
      return;
    }
    setGeneratedBass(recordedNotes);
    toast({ title: "Notes Applied", description: `${recordedNotes.length} recorded notes ready` });
  }, [recordedNotes, toast]);

  // Delete a recorded note
  const deleteRecordedNote = useCallback((index: number) => {
    setRecordedNotes(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Clear recorded notes
  const clearRecordedNotes = useCallback(() => {
    setRecordedNotes([]);
    toast({ title: "Cleared", description: "Recorded notes cleared" });
  }, [toast]);

  // Send to Piano Roll for editing
  const sendToPianoRoll = useCallback(() => {
    const notesToSend = generatedBass.length > 0 ? generatedBass : recordedNotes;
    if (notesToSend.length === 0) {
      toast({ title: "No Notes", description: "Generate or record notes first", variant: "destructive" });
      return;
    }
    window.dispatchEvent(new CustomEvent('bass:sendToPianoRoll', {
      detail: { notes: notesToSend, instrument: 'Bass Synth' }
    }));
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'piano-roll' }));
    toast({ title: "Sent to Piano Roll", description: `${notesToSend.length} notes sent for editing` });
  }, [generatedBass, recordedNotes, toast]);

  // Play generated bass line
  const playGeneratedBass = useCallback(async () => {
    if (generatedBass.length === 0) {
      toast({ title: "No Bass", description: "Generate a bass line first!", variant: "destructive" });
      return;
    }
    
    setIsPlaying(true);
    let noteIndex = 0;
    
    const playNext = async () => {
      if (noteIndex >= generatedBass.length) {
        setIsPlaying(false);
        return;
      }
      
      const bassNote = generatedBass[noteIndex];
      await playBassNote(bassNote.note, bassNote.octave);
      noteIndex++;
      
      const duration = (bassNote.duration || 0.5) * 1000;
      playbackRef.current = setTimeout(playNext, duration);
    };
    
    await playNext();
  }, [generatedBass, playBassNote, toast]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
      playbackRef.current = null;
    }
    setIsPlaying(false);
    realisticAudio.stopAllSounds();
  }, []);

  // ISSUE #1: Save preset functionality
  const savePreset = useCallback(() => {
    const preset = {
      name: `Bass Preset ${new Date().toLocaleTimeString()}`,
      settings: { bassStyle, patternType, octave: octave[0], groove: groove[0], noteLength: noteLength[0], velocity: velocity[0], glide: glide[0] },
      generatedBass,
    };
    localStorage.setItem('bass-generator-preset', JSON.stringify(preset));
    toast({ title: 'Preset Saved', description: 'Bass settings saved to browser' });
  }, [bassStyle, patternType, octave, groove, noteLength, velocity, glide, generatedBass, toast]);

  // ISSUE #1: Load preset functionality
  const loadPreset = useCallback(() => {
    try {
      const saved = localStorage.getItem('bass-generator-preset');
      if (saved) {
        const preset = JSON.parse(saved);
        if (preset.settings) {
          setBassStyle(preset.settings.bassStyle || '808');
          setPatternType(preset.settings.patternType || 'root-fifth');
          setOctave([preset.settings.octave ?? 2]);
          setGroove([preset.settings.groove ?? 50]);
          setNoteLength([preset.settings.noteLength ?? 75]);
          setVelocity([preset.settings.velocity ?? 70]);
          setGlide([preset.settings.glide ?? 0]);
          if (preset.generatedBass) setGeneratedBass(preset.generatedBass);
          toast({ title: 'Preset Loaded', description: `Loaded: ${preset.name}` });
        }
      } else {
        toast({ title: 'No Preset', description: 'No saved preset found', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Load Failed', description: 'Could not load preset', variant: 'destructive' });
    }
  }, [toast]);

  // ISSUE #2: Export bass line to JSON
  const exportBassLine = useCallback(() => {
    if (generatedBass.length === 0) {
      toast({ title: 'No Bass', description: 'Generate a bass line first', variant: 'destructive' });
      return;
    }
    const exportData = {
      bassLine: generatedBass,
      settings: { bassStyle, patternType, octave: octave[0], groove: groove[0], noteLength: noteLength[0], velocity: velocity[0], glide: glide[0] },
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bass-line-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported!', description: `Bass line with ${generatedBass.length} notes saved` });
  }, [generatedBass, bassStyle, patternType, octave, groove, noteLength, velocity, glide, toast]);

  // ISSUE #3: Clear generated bass
  const clearBass = useCallback(() => {
    stopPlayback();
    setGeneratedBass([]);
    toast({ title: 'Cleared', description: 'Bass line cleared' });
  }, [stopPlayback, toast]);

  const bassStyles = [
    { value: '808', label: '🔊 808 Bass', description: 'Deep trap/hip-hop bass' },
    { value: 'sub', label: '🌊 Sub Bass', description: 'Pure sine wave sub' },
    { value: 'synth', label: '⚡ Synth Bass', description: 'Funky plucky bass' },
    { value: 'electric', label: '🎸 Electric Bass', description: 'Slap/fingerstyle' },
    { value: 'upright', label: '🎻 Upright Bass', description: 'Jazz acoustic bass' },
  ];

  const patternTypes = [
    { value: 'root', label: 'Root Notes', description: 'Simple root following' },
    { value: 'root-fifth', label: 'Root + 5th', description: 'Root and fifth alternating' },
    { value: 'walking', label: 'Walking Bass', description: 'Chromatic movement' },
    { value: 'arpeggio', label: 'Arpeggiated', description: 'Chord tone arpeggios' },
    { value: 'rhythmic', label: 'Rhythmic', description: 'Syncopated patterns' },
  ];

  const generateBassLine = async () => {
    if (!chordProgression || chordProgression.length === 0) {
      toast({
        title: "No Chords Found",
        description: "Generate a chord progression first!",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Call AI to generate bass line
      const response = await fetch('/api/music/generate-bass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chordProgression,
          style: bassStyle,
          pattern: patternType,
          octave: octave[0],
          groove: groove[0] / 100,
          noteLength: noteLength[0] / 100,
          velocity: velocity[0] / 127,
          glide: glide[0] / 100,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate bass line');
      }

      const data = await response.json();
      
      const bassNotes = data.notes || data.bassNotes || [];
      setGeneratedBass(bassNotes);
      
      toast({
        title: "🎸 Bass Generated!",
        description: `Created ${bassNotes.length} bass notes using ${bassStyles.find(s => s.value === bassStyle)?.label}`,
      });

      // Pass bass notes to parent
      if (onBassGenerated) {
        onBassGenerated(bassNotes);
      }

    } catch (error) {
      console.error('Bass generation error:', error);
      toast({
        title: "Generation Failed",
        description: "Could not generate bass line. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-400">
          <Music2 className="w-5 h-5" />
          AI Bass Generator
          <span className="text-xs text-gray-500 font-normal ml-auto">Bass Dragon Style</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bass Style Selector */}
        <div className="space-y-2">
          <Label className="text-sm text-gray-300">Bass Style</Label>
          <Select value={bassStyle} onValueChange={setBassStyle}>
            <SelectTrigger className="bg-gray-800 border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {bassStyles.map(style => (
                <SelectItem key={style.value} value={style.value}>
                  <div className="flex flex-col">
                    <span>{style.label}</span>
                    <span className="text-xs text-gray-400">{style.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pattern Type */}
        <div className="space-y-2">
          <Label className="text-sm text-gray-300">Pattern Type</Label>
          <Select value={patternType} onValueChange={setPatternType}>
            <SelectTrigger className="bg-gray-800 border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {patternTypes.map(pattern => (
                <SelectItem key={pattern.value} value={pattern.value}>
                  <div className="flex flex-col">
                    <span>{pattern.label}</span>
                    <span className="text-xs text-gray-400">{pattern.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Octave Selector */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm text-gray-300">Octave</Label>
            <span className="text-xs text-purple-400 font-bold">{octave[0]}</span>
          </div>
          <Slider
            value={octave}
            onValueChange={setOctave}
            min={0}
            max={4}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Sub Bass</span>
            <span>Mid Bass</span>
          </div>
        </div>

        {/* Groove Amount */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm text-gray-300">Groove / Swing</Label>
            <span className="text-xs text-purple-400 font-bold">{groove[0]}%</span>
          </div>
          <Slider
            value={groove}
            onValueChange={setGroove}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Note Length */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm text-gray-300">Note Length</Label>
            <span className="text-xs text-purple-400 font-bold">{noteLength[0]}%</span>
          </div>
          <Slider
            value={noteLength}
            onValueChange={setNoteLength}
            min={10}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Staccato</span>
            <span>Legato</span>
          </div>
        </div>

        {/* Velocity */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm text-gray-300">Velocity</Label>
            <span className="text-xs text-purple-400 font-bold">{velocity[0]}</span>
          </div>
          <Slider
            value={velocity}
            onValueChange={setVelocity}
            min={20}
            max={127}
            step={1}
            className="w-full"
          />
        </div>

        {/* Glide Amount */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm text-gray-300">Glide / Portamento</Label>
            <span className="text-xs text-purple-400 font-bold">{glide[0]}%</span>
          </div>
          <Slider
            value={glide}
            onValueChange={setGlide}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateBassLine}
          disabled={isGenerating || !chordProgression || chordProgression.length === 0}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating Bass...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Generate Bass Line
            </>
          )}
        </Button>

        {/* Interactive Bass Keyboard */}
        <div className="space-y-2 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-gray-300 flex items-center gap-2">
              <Piano className="w-4 h-4" />
              Interactive Bass Keyboard
              {isRecording && <span className="text-red-500 animate-pulse">● REC</span>}
            </Label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={isRecording ? "destructive" : "outline"}
                onClick={toggleRecording}
                className="text-xs"
              >
                {isRecording ? <Square className="w-3 h-3 mr-1" /> : <Circle className="w-3 h-3 mr-1" />}
                {isRecording ? 'Stop' : 'Record'}
              </Button>
              <span className="text-xs text-purple-400">Octave {octave[0]}</span>
            </div>
          </div>
          
          {/* Bass Keys */}
          <div className="flex gap-1 p-2 bg-gray-800 rounded-lg overflow-x-auto">
            {BASS_NOTES.map((note) => {
              const isBlack = note.includes('#');
              const isActive = activeNote === `${note}${octave[0]}`;
              return (
                <button
                  key={note}
                  onMouseDown={() => playBassNote(note)}
                  onTouchStart={() => playBassNote(note)}
                  className={`
                    ${isBlack 
                      ? 'bg-gray-900 text-white w-8 h-16 -mx-2 z-10 rounded-b' 
                      : 'bg-gradient-to-b from-gray-200 to-gray-400 text-gray-800 w-10 h-20 rounded-b-lg'
                    }
                    ${isActive ? 'ring-2 ring-purple-500 scale-95' : ''}
                    flex items-end justify-center pb-1 text-xs font-bold
                    hover:opacity-80 active:scale-95 transition-all
                    shadow-md cursor-pointer select-none
                  `}
                >
                  {note}
                </button>
              );
            })}
          </div>
          
          {/* Quick Octave Buttons */}
          <div className="flex gap-2 justify-center">
            {[0, 1, 2, 3].map((oct) => (
              <Button
                key={oct}
                size="sm"
                variant={octave[0] === oct ? "default" : "outline"}
                onClick={() => setOctave([oct])}
                className="text-xs"
              >
                Oct {oct}
              </Button>
            ))}
          </div>
        </div>

        {/* Recorded Notes Section */}
        {recordedNotes.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-red-900/50">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-red-300 flex items-center gap-2">
                <Circle className="w-3 h-3 text-red-500" />
                Recorded Notes ({recordedNotes.length})
              </Label>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={useRecordedNotes} className="text-xs">
                  Use Notes
                </Button>
                <Button size="sm" variant="outline" onClick={sendToPianoRoll} className="text-xs">
                  <Edit3 className="w-3 h-3 mr-1" />
                  Edit in Piano Roll
                </Button>
                <Button size="sm" variant="ghost" onClick={clearRecordedNotes} className="text-xs text-red-400">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="bg-gray-800 rounded p-2 max-h-24 overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {recordedNotes.map((note, idx) => (
                  <span 
                    key={idx} 
                    className="px-2 py-0.5 bg-red-600/30 text-red-300 text-xs rounded flex items-center gap-1 group cursor-pointer hover:bg-red-600/50"
                    onClick={() => deleteRecordedNote(idx)}
                    title="Click to delete"
                  >
                    {note.note}{note.octave}
                    <X className="w-2 h-2 opacity-0 group-hover:opacity-100" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Playback Controls for Generated Bass */}
        {generatedBass.length > 0 && (
          <div className="space-y-2 pt-2">
            {/* ISSUE #4: Visual display of generated bass notes */}
            <div className="bg-gray-800 rounded p-2 max-h-20 overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {generatedBass.map((note, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-xs rounded">
                    {note.note}{note.octave}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={isPlaying ? stopPlayback : playGeneratedBass}
                variant="outline"
                className="flex-1"
              >
                <Volume2 className="w-4 h-4 mr-2" />
                {isPlaying ? 'Stop' : `Play (${generatedBass.length})`}
              </Button>
              <Button 
                onClick={() => onBassGenerated?.(generatedBass)} 
                className="bg-blue-600 hover:bg-blue-500"
                title="Send to Multi-Track"
              >
                <Send className="w-4 h-4 mr-2" />
                Send to Tracks
              </Button>
              <Button onClick={sendToPianoRoll} variant="outline" size="icon" title="Edit in Piano Roll">
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button onClick={exportBassLine} variant="outline" size="icon" title="Export bass line">
                <Download className="w-4 h-4" />
              </Button>
              <Button onClick={clearBass} variant="outline" size="icon" title="Clear bass line">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Preset Controls */}
        <div className="flex gap-2 pt-2 border-t border-gray-700">
          <Button onClick={savePreset} variant="outline" size="sm" className="flex-1">
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
          <Button onClick={loadPreset} variant="outline" size="sm" className="flex-1">
            <RotateCcw className="w-3 h-3 mr-1" />
            Load
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-800">
          Click keys to play bass notes manually, or use AI to generate patterns
        </div>
      </CardContent>
    </Card>
  );
}
