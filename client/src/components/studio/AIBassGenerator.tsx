import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Music2, Zap, Piano, Volume2, Save, RotateCcw, Download, Trash2, Send, Circle, Square, Edit3, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { realisticAudio } from '@/lib/realisticAudio';
import { professionalAudio } from '@/lib/professionalAudio';

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

      const mixerChannel = professionalAudio.getChannels().find(
        ch => ch.id === 'bass' || ch.name.toLowerCase() === 'bass'
      );

      if (bassStyle === 'sub') {
        const audioContext = (realisticAudio as any)?.audioContext as AudioContext | null;
        if (!audioContext) return;

        const currentTime = audioContext.currentTime;
        const destination = (mixerChannel?.input as AudioNode | undefined) || audioContext.destination;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, currentTime);

        const startGain = Math.min(1, Math.max(0, (velocity[0] / 127) * 0.9));
        const durationSeconds = Math.max(0.05, (noteLength[0] / 100) * 0.8);
        gain.gain.setValueAtTime(0.0001, currentTime);
        gain.gain.exponentialRampToValueAtTime(startGain, currentTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, currentTime + durationSeconds);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(currentTime);
        osc.stop(currentTime + durationSeconds + 0.02);
        return;
      }

      const styleToInstrument: Record<string, string> = {
        '808': 'synth_bass_1',
        sub: 'synth_bass_1',
        synth: 'synth_bass_2',
        electric: 'electric_bass_finger',
        upright: 'acoustic_bass',
      };

      const instrument = styleToInstrument[bassStyle] || 'synth_bass_1';
      await realisticAudio.playNote(
        note,
        oct,
        noteLength[0] / 100,
        instrument,
        velocity[0] / 127,
        true,
        mixerChannel?.input
      );
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
          name: `Bass ${patternType}`,
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

      // Note: Track is added via onBassGenerated callback to parent component

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
    <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-3xl relative overflow-hidden shadow-2xl group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
      
      <CardHeader className="relative z-10 border-b border-white/5 pb-4">
        <CardTitle className="flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-black uppercase tracking-tighter">
          <Music2 className="w-6 h-6 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          AI Bass Generator
          <Badge variant="outline" className="ml-auto bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] font-black tracking-widest uppercase px-2 py-0">
            Bass Dragon
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Style & Pattern */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest ml-1">Bass Style</Label>
              <Select value={bassStyle} onValueChange={setBassStyle}>
                <SelectTrigger className="bg-white/5 border-white/10 rounded-xl hover:bg-white/10 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl">
                  {bassStyles.map(style => (
                    <SelectItem key={style.value} value={style.value} className="focus:bg-blue-500/20">
                      <div className="flex flex-col py-1">
                        <span className="font-bold text-white tracking-tight">{style.label}</span>
                        <span className="text-[10px] text-white/40 font-medium uppercase tracking-tighter">{style.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest ml-1">Pattern Type</Label>
              <Select value={patternType} onValueChange={setPatternType}>
                <SelectTrigger className="bg-white/5 border-white/10 rounded-xl hover:bg-white/10 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl">
                  {patternTypes.map(pattern => (
                    <SelectItem key={pattern.value} value={pattern.value} className="focus:bg-purple-500/20">
                      <div className="flex flex-col py-1">
                        <span className="font-bold text-white tracking-tight">{pattern.label}</span>
                        <span className="text-[10px] text-white/40 font-medium uppercase tracking-tighter">{pattern.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right Column: Sliders */}
          <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/5">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest">Octave</Label>
                <span className="text-xs font-black text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]">{octave[0]}</span>
              </div>
              <Slider value={octave} onValueChange={setOctave} min={0} max={4} step={1} className="py-2" />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest">Groove</Label>
                <span className="text-xs font-black text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">{groove[0]}%</span>
              </div>
              <Slider value={groove} onValueChange={setGroove} min={0} max={100} step={1} className="py-2" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3 bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black text-cyan-300/60 uppercase tracking-widest">Length</Label>
              <span className="text-[10px] font-black text-cyan-400">{noteLength[0]}%</span>
            </div>
            <Slider value={noteLength} onValueChange={setNoteLength} min={10} max={100} step={1} />
          </div>
          <div className="space-y-3 bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black text-amber-300/60 uppercase tracking-widest">Velocity</Label>
              <span className="text-[10px] font-black text-amber-400">{velocity[0]}</span>
            </div>
            <Slider value={velocity} onValueChange={setVelocity} min={20} max={127} step={1} />
          </div>
          <div className="space-y-3 bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black text-pink-300/60 uppercase tracking-widest">Glide</Label>
              <span className="text-[10px] font-black text-pink-400">{glide[0]}%</span>
            </div>
            <Slider value={glide} onValueChange={setGlide} min={0} max={100} step={1} />
          </div>
        </div>

        <Button
          onClick={generateBassLine}
          disabled={isGenerating || !chordProgression || chordProgression.length === 0}
          className="w-full h-14 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] border border-white/20"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              Synthesizing Frequencies...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-3 drop-shadow-[0_0_8px_white]" />
              Generate Neural Bass
            </>
          )}
        </Button>

        {/* Interactive Keyboard Section */}
        <div className="space-y-4 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black text-blue-300/60 uppercase tracking-[0.2em] flex items-center gap-2">
              <Piano className="w-4 h-4 text-blue-400" />
              Interactive Haptic Keyboard
              {isRecording && <span className="text-red-500 animate-pulse font-black ml-2">● SIGNAL CAPTURE</span>}
            </Label>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant={isRecording ? "destructive" : "outline"}
                onClick={toggleRecording}
                className={`h-8 px-4 rounded-full font-black uppercase text-[10px] tracking-widest border-2 transition-all ${
                  isRecording ? 'animate-pulse' : 'bg-white/5 border-white/10'
                }`}
              >
                {isRecording ? <Square className="w-3 h-3 mr-2 fill-current" /> : <Circle className="w-3 h-3 mr-2 fill-current" />}
                {isRecording ? 'Abort' : 'Rec'}
              </Button>
              <div className="px-3 py-1 bg-purple-500/20 rounded-full border border-purple-500/30">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Oct {octave[0]}</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
              {BASS_NOTES.map((note) => {
                const isBlack = note.includes('#');
                const isActive = activeNote === `${note}${octave[0]}`;
                return (
                  <button
                    key={note}
                    onMouseDown={() => playBassNote(note)}
                    className={`
                      relative shrink-0 transition-all duration-75
                      ${isBlack 
                        ? 'bg-gradient-to-b from-gray-800 to-black text-white w-8 h-20 -mx-3 z-10 rounded-b-lg border-x border-b border-white/10' 
                        : 'bg-gradient-to-b from-white to-gray-300 text-gray-900 w-12 h-32 rounded-b-xl border-x border-b border-gray-400'
                      }
                      ${isActive ? 'brightness-150 scale-95 shadow-[0_0_20px_rgba(59,130,246,0.8)]' : ''}
                      flex items-end justify-center pb-3 text-[10px] font-black uppercase tracking-tighter
                      hover:brightness-110 active:scale-95 cursor-pointer select-none
                    `}
                  >
                    <span className={isBlack ? 'text-blue-400/80' : 'text-gray-500'}>{note}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="flex gap-2 justify-center">
            {[0, 1, 2, 3].map((oct) => (
              <Button
                key={oct}
                size="sm"
                variant="ghost"
                onClick={() => setOctave([oct])}
                className={`h-8 w-12 rounded-lg font-black text-[10px] transition-all border ${
                  octave[0] === oct 
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                    : 'bg-white/5 border-white/5 text-white/40 hover:text-white hover:bg-white/10'
                }`}
              >
                {oct}
              </Button>
            ))}
          </div>
        </div>

        {/* Recorded Signal Flow */}
        {recordedNotes.length > 0 && (
          <div className="space-y-3 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black text-red-400/80 uppercase tracking-widest flex items-center gap-2">
                <Circle className="w-3 h-3 fill-current animate-pulse" />
                Captured Signal ({recordedNotes.length})
              </Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={useRecordedNotes} className="h-7 text-[10px] font-black uppercase tracking-tighter rounded-lg border-red-500/30 text-red-400 hover:bg-red-500/10">
                  Sync
                </Button>
                <Button size="sm" variant="outline" onClick={sendToPianoRoll} className="h-7 text-[10px] font-black uppercase tracking-tighter rounded-lg border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                  <Edit3 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={clearRecordedNotes} className="h-7 w-7 p-0 text-red-400/60 hover:text-red-400 hover:bg-red-500/10">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
              {recordedNotes.map((note, idx) => (
                <div 
                  key={idx} 
                  onClick={() => deleteRecordedNote(idx)}
                  className="px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black rounded-md flex items-center gap-1.5 hover:bg-red-500/20 cursor-pointer transition-all group"
                >
                  {note.note}{note.octave}
                  <X className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Pattern Output */}
        {generatedBass.length > 0 && (
          <div className="space-y-4 p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
              {generatedBass.map((note, idx) => (
                <span key={idx} className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-md shadow-sm">
                  {note.note}{note.octave}
                </span>
              ))}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={isPlaying ? stopPlayback : playGeneratedBass}
                variant="outline"
                className={`flex-1 h-12 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${
                  isPlaying ? 'bg-red-500/10 border-red-500/50 text-red-400 animate-pulse' : 'bg-blue-500/10 border-blue-500/50 text-blue-400 hover:bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                }`}
              >
                {isPlaying ? <Square className="w-4 h-4 mr-2 fill-current" /> : <Volume2 className="w-4 h-4 mr-2" />}
                {isPlaying ? 'Stop' : `Audition (${generatedBass.length})`}
              </Button>
              <Button 
                onClick={() => onBassGenerated?.(generatedBass)} 
                className="h-12 px-6 bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all hover:scale-105 active:scale-95"
                title="Inject into Production Timeline"
              >
                <Send className="w-5 h-5 mr-2" />
                Commit
              </Button>
              <div className="flex gap-1.5">
                <Button onClick={sendToPianoRoll} variant="ghost" size="icon" className="h-12 w-12 rounded-xl bg-white/5 border border-white/5 text-purple-400 hover:bg-purple-500/10" title="Edit in Piano Roll">
                  <Edit3 className="w-5 h-5" />
                </Button>
                <Button onClick={exportBassLine} variant="ghost" size="icon" className="h-12 w-12 rounded-xl bg-white/5 border border-white/5 text-amber-400 hover:bg-amber-500/10" title="Export Data">
                  <Download className="w-5 h-5" />
                </Button>
                <Button onClick={clearBass} variant="ghost" size="icon" className="h-12 w-12 rounded-xl bg-white/5 border border-white/5 text-red-400 hover:bg-red-500/10" title="Clear Buffer">
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Preset & Save Management */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
          <Button onClick={savePreset} variant="ghost" size="sm" className="h-10 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 font-black uppercase text-[10px] tracking-widest">
            <Save className="w-3.5 h-3.5 mr-2" />
            Save Preset
          </Button>
          <Button onClick={loadPreset} variant="ghost" size="sm" className="h-10 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 font-black uppercase text-[10px] tracking-widest">
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
            Load Preset
          </Button>
        </div>

        <p className="text-[9px] text-white/20 text-center font-black uppercase tracking-[0.3em] pt-2">
          Quantum Neural Bass Engine // Ready for Signal Processing
        </p>
      </CardContent>
    </Card>
  );
}

