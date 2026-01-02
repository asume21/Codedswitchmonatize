import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Music, Drum, Guitar, Piano, Mic2, Wand2, RefreshCw, Send, Save, FolderPlus, Heart, X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { professionalAudio } from '@/lib/professionalAudio';

interface AILoopGeneratorProps {
  currentBpm?: number;
  currentKey?: string;
  currentScale?: string;
  onClose?: () => void;
}

interface GeneratedLoop {
  notes: Array<{
    pitch: number;
    startStep: number;
    duration: number;
    velocity: number;
    trackType: 'drums' | 'bass' | 'chords' | 'melody';
  }>;
  bpm: number;
}

interface SavedLoop {
  id: string;
  name: string;
  genre: string;
  key: string;
  scale: string;
  bpm: number;
  bars: number;
  notes: GeneratedLoop['notes'];
  createdAt: number;
  isFavorite: boolean;
}

const LOOP_LIBRARY_KEY = 'ai-loop-library';

const GENRES = [
  { value: 'hip-hop', label: 'Hip-Hop' },
  { value: 'trap', label: 'Trap' },
  { value: 'lo-fi', label: 'Lo-Fi' },
  { value: 'pop', label: 'Pop' },
  { value: 'edm', label: 'EDM' },
  { value: 'house', label: 'House' },
  { value: 'r-and-b', label: 'R&B' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'rock', label: 'Rock' },
  { value: 'ambient', label: 'Ambient' },
];

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = ['major', 'minor', 'dorian', 'mixolydian', 'pentatonic', 'blues'];

export default function AILoopGenerator({ 
  currentBpm = 120, 
  currentKey = 'C',
  currentScale = 'minor',
  onClose 
}: AILoopGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  
  // Loop settings
  const [genre, setGenre] = useState('hip-hop');
  const [key, setKey] = useState(currentKey);
  const [scale, setScale] = useState(currentScale);
  const [bpm, setBpm] = useState(currentBpm);
  const [complexity, setComplexity] = useState(50);
  const [bars, setBars] = useState(4);
  
  // Track toggles
  const [includeDrums, setIncludeDrums] = useState(true);
  const [includeBass, setIncludeBass] = useState(true);
  const [includeChords, setIncludeChords] = useState(true);
  const [includeMelody, setIncludeMelody] = useState(true);
  
  // Last generated loop (for saving)
  const [lastGeneratedLoop, setLastGeneratedLoop] = useState<GeneratedLoop | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [loopName, setLoopName] = useState('');
  
  // Loop library
  const [savedLoops, setSavedLoops] = useState<SavedLoop[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOOP_LIBRARY_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [showLibrary, setShowLibrary] = useState(false);

  const dispatchTopianoRoll = (loop: GeneratedLoop) => {
    // Get mixer channel hints
    const channels = professionalAudio.getChannels();
    const channelMapping = {
      drums: channels.find(c => c.id === 'drums' || c.name.toLowerCase() === 'drums')?.id,
      bass: channels.find(c => c.id === 'bass' || c.name.toLowerCase() === 'bass')?.id,
      chords: channels.find(c => c.id === 'instruments' || c.name.toLowerCase() === 'instruments')?.id,
      melody: channels.find(c => c.id === 'lead' || c.name.toLowerCase() === 'lead')?.id,
    };

    // Dispatch event to Piano Roll
    const event = new CustomEvent('astutely:generated', {
      detail: {
        notes: loop.notes,
        bpm: loop.bpm,
        channelMapping,
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(event);
    
    // Also save to localStorage as backup
    localStorage.setItem('astutely-generated', JSON.stringify({
      notes: loop.notes,
      bpm: loop.bpm,
      channelMapping,
      timestamp: Date.now()
    }));
    
    // Store for potential saving
    setLastGeneratedLoop(loop);
  };

  const saveToLibrary = () => {
    if (!lastGeneratedLoop || !loopName.trim()) {
      toast({
        title: 'Enter a name',
        description: 'Please enter a name for your loop',
        variant: 'destructive'
      });
      return;
    }
    
    const newLoop: SavedLoop = {
      id: `loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: loopName.trim(),
      genre,
      key,
      scale,
      bpm,
      bars,
      notes: lastGeneratedLoop.notes,
      createdAt: Date.now(),
      isFavorite: false
    };
    
    const updated = [...savedLoops, newLoop];
    setSavedLoops(updated);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOOP_LIBRARY_KEY, JSON.stringify(updated));
    }
    
    setShowSaveDialog(false);
    setLoopName('');
    toast({
      title: '💾 Loop Saved!',
      description: `"${newLoop.name}" added to your library`,
    });
  };

  const loadFromLibrary = (loop: SavedLoop) => {
    const generatedLoop: GeneratedLoop = {
      notes: loop.notes,
      bpm: loop.bpm
    };
    dispatchTopianoRoll(generatedLoop);
    setGenre(loop.genre);
    setKey(loop.key);
    setScale(loop.scale);
    setBpm(loop.bpm);
    setBars(loop.bars);
    toast({
      title: '📂 Loop Loaded',
      description: `"${loop.name}" sent to Piano Roll`,
    });
  };

  const deleteFromLibrary = (loopId: string) => {
    const updated = savedLoops.filter(l => l.id !== loopId);
    setSavedLoops(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOOP_LIBRARY_KEY, JSON.stringify(updated));
    }
    toast({ title: '🗑️ Loop Deleted' });
  };

  const toggleFavorite = (loopId: string) => {
    const updated = savedLoops.map(l => 
      l.id === loopId ? { ...l, isFavorite: !l.isFavorite } : l
    );
    setSavedLoops(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOOP_LIBRARY_KEY, JSON.stringify(updated));
    }
  };

  const generateFullLoop = async () => {
    setIsGenerating(true);
    setGeneratingType('full');
    
    try {
      const response = await fetch('/api/ai/generate-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          genre,
          key,
          scale,
          bpm,
          complexity: complexity / 100,
          bars,
          includeDrums,
          includeBass,
          includeChords,
          includeMelody
        })
      });

      if (!response.ok) {
        // Generate locally if API fails
        const localLoop = generateLocalLoop();
        dispatchTopianoRoll(localLoop);
        toast({
          title: '🎵 Loop Generated (Local)',
          description: `${localLoop.notes.length} notes created at ${bpm} BPM`,
        });
        return;
      }

      const data = await response.json();
      if (data.notes && data.notes.length > 0) {
        dispatchTopianoRoll({ notes: data.notes, bpm });
        toast({
          title: '🎵 AI Loop Generated!',
          description: `${data.notes.length} notes sent to Piano Roll`,
        });
      }
    } catch (error) {
      console.error('Loop generation error:', error);
      // Fallback to local generation
      const localLoop = generateLocalLoop();
      dispatchTopianoRoll(localLoop);
      toast({
        title: '🎵 Loop Generated (Local)',
        description: `${localLoop.notes.length} notes created`,
      });
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  const generateLocalLoop = (): GeneratedLoop => {
    const notes: GeneratedLoop['notes'] = [];
    const stepsPerBar = 16;
    const totalSteps = bars * stepsPerBar;
    
    // Scale notes for the selected key
    const scaleIntervals: Record<string, number[]> = {
      'major': [0, 2, 4, 5, 7, 9, 11],
      'minor': [0, 2, 3, 5, 7, 8, 10],
      'dorian': [0, 2, 3, 5, 7, 9, 10],
      'mixolydian': [0, 2, 4, 5, 7, 9, 10],
      'pentatonic': [0, 2, 4, 7, 9],
      'blues': [0, 3, 5, 6, 7, 10],
    };
    
    const keyOffset = KEYS.indexOf(key);
    const intervals = scaleIntervals[scale] || scaleIntervals['minor'];
    const scaleNotes = intervals.map(i => (keyOffset + i) % 12);
    
    // Generate drums
    if (includeDrums) {
      // Kick on 1 and 3
      for (let bar = 0; bar < bars; bar++) {
        notes.push({ pitch: 36, startStep: bar * 16, duration: 2, velocity: 100, trackType: 'drums' });
        notes.push({ pitch: 36, startStep: bar * 16 + 8, duration: 2, velocity: 90, trackType: 'drums' });
        
        // Snare on 2 and 4
        notes.push({ pitch: 38, startStep: bar * 16 + 4, duration: 2, velocity: 100, trackType: 'drums' });
        notes.push({ pitch: 38, startStep: bar * 16 + 12, duration: 2, velocity: 95, trackType: 'drums' });
        
        // Hi-hats
        for (let i = 0; i < 16; i += 2) {
          notes.push({ pitch: 42, startStep: bar * 16 + i, duration: 1, velocity: 70 + Math.random() * 20, trackType: 'drums' });
        }
      }
    }
    
    // Generate bass
    if (includeBass) {
      const bassOctave = 2;
      for (let bar = 0; bar < bars; bar++) {
        const rootNote = scaleNotes[0] + bassOctave * 12 + 12;
        const fifthNote = scaleNotes[Math.min(4, scaleNotes.length - 1)] + bassOctave * 12 + 12;
        
        notes.push({ pitch: rootNote, startStep: bar * 16, duration: 4, velocity: 100, trackType: 'bass' });
        notes.push({ pitch: rootNote, startStep: bar * 16 + 4, duration: 2, velocity: 85, trackType: 'bass' });
        notes.push({ pitch: fifthNote, startStep: bar * 16 + 8, duration: 4, velocity: 90, trackType: 'bass' });
        notes.push({ pitch: rootNote, startStep: bar * 16 + 12, duration: 2, velocity: 80, trackType: 'bass' });
      }
    }
    
    // Generate chords
    if (includeChords) {
      const chordOctave = 4;
      for (let bar = 0; bar < bars; bar++) {
        const chordRoot = scaleNotes[bar % scaleNotes.length] + chordOctave * 12 + 12;
        const chordThird = scaleNotes[(bar + 2) % scaleNotes.length] + chordOctave * 12 + 12;
        const chordFifth = scaleNotes[(bar + 4) % scaleNotes.length] + chordOctave * 12 + 12;
        
        // Chord on beat 1
        notes.push({ pitch: chordRoot, startStep: bar * 16, duration: 8, velocity: 75, trackType: 'chords' });
        notes.push({ pitch: chordThird, startStep: bar * 16, duration: 8, velocity: 70, trackType: 'chords' });
        notes.push({ pitch: chordFifth, startStep: bar * 16, duration: 8, velocity: 70, trackType: 'chords' });
        
        // Chord on beat 3
        notes.push({ pitch: chordRoot, startStep: bar * 16 + 8, duration: 8, velocity: 70, trackType: 'chords' });
        notes.push({ pitch: chordThird, startStep: bar * 16 + 8, duration: 8, velocity: 65, trackType: 'chords' });
        notes.push({ pitch: chordFifth, startStep: bar * 16 + 8, duration: 8, velocity: 65, trackType: 'chords' });
      }
    }
    
    // Generate melody
    if (includeMelody) {
      const melodyOctave = 5;
      for (let bar = 0; bar < bars; bar++) {
        const notesInBar = 4 + Math.floor(complexity / 25);
        for (let i = 0; i < notesInBar; i++) {
          const step = bar * 16 + Math.floor(i * (16 / notesInBar));
          const noteIndex = Math.floor(Math.random() * scaleNotes.length);
          const pitch = scaleNotes[noteIndex] + melodyOctave * 12 + 12;
          const duration = Math.random() > 0.5 ? 2 : 4;
          
          notes.push({ 
            pitch, 
            startStep: step, 
            duration, 
            velocity: 80 + Math.random() * 20, 
            trackType: 'melody' 
          });
        }
      }
    }
    
    return { notes, bpm };
  };

  const generateQuickContent = async (type: 'melody' | 'drums' | 'bass' | 'chords') => {
    setIsGenerating(true);
    setGeneratingType(type);
    
    try {
      // Generate just the specified type
      const loop = generateLocalLoop();
      const filteredNotes = loop.notes.filter(n => n.trackType === type);
      
      if (filteredNotes.length > 0) {
        dispatchTopianoRoll({ notes: filteredNotes, bpm });
        toast({
          title: `🎵 ${type.charAt(0).toUpperCase() + type.slice(1)} Generated!`,
          description: `${filteredNotes.length} notes sent to Piano Roll`,
        });
      }
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description: 'Could not generate content',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-3xl relative overflow-hidden shadow-2xl group">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-pink-500/5 pointer-events-none" />
      
      <CardHeader className="relative z-10 border-b border-white/5 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400 font-black uppercase tracking-tight">
            <Sparkles className="w-6 h-6 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
            AI Loop Generator
          </CardTitle>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] font-black tracking-widest uppercase px-2 py-0">
            Neural Engine
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6 relative z-10">
        {/* Quick Generate Buttons */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1">Rapid Synthesis</label>
          <div className="grid grid-cols-4 gap-3">
            <Button
              size="sm"
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-3 bg-white/5 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40 rounded-xl transition-all group/btn"
              onClick={(e) => {
                e.stopPropagation();
                generateQuickContent('melody');
              }}
              disabled={isGenerating}
            >
              {generatingType === 'melody' ? <Loader2 className="w-5 h-5 animate-spin text-blue-400" /> : <Music className="w-5 h-5 text-blue-400 group-hover/btn:scale-110 transition-transform" />}
              <span className="text-[10px] font-black uppercase tracking-tighter">Melody</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-3 bg-white/5 border-pink-500/20 hover:bg-pink-500/20 hover:border-pink-500/40 rounded-xl transition-all group/btn"
              onClick={(e) => {
                e.stopPropagation();
                generateQuickContent('drums');
              }}
              disabled={isGenerating}
            >
              {generatingType === 'drums' ? <Loader2 className="w-5 h-5 animate-spin text-pink-400" /> : <Drum className="w-5 h-5 text-pink-400 group-hover/btn:scale-110 transition-transform" />}
              <span className="text-[10px] font-black uppercase tracking-tighter">Drums</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-3 bg-white/5 border-green-500/20 hover:bg-green-500/20 hover:border-green-500/40 rounded-xl transition-all group/btn"
              onClick={(e) => {
                e.stopPropagation();
                generateQuickContent('bass');
              }}
              disabled={isGenerating}
            >
              {generatingType === 'bass' ? <Loader2 className="w-5 h-5 animate-spin text-green-400" /> : <Guitar className="w-5 h-5 text-green-400 group-hover/btn:scale-110 transition-transform" />}
              <span className="text-[10px] font-black uppercase tracking-tighter">Bass</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-3 bg-white/5 border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40 rounded-xl transition-all group/btn"
              onClick={(e) => {
                e.stopPropagation();
                generateQuickContent('chords');
              }}
              disabled={isGenerating}
            >
              {generatingType === 'chords' ? <Loader2 className="w-5 h-5 animate-spin text-purple-400" /> : <Piano className="w-5 h-5 text-purple-400 group-hover/btn:scale-110 transition-transform" />}
              <span className="text-[10px] font-black uppercase tracking-tighter">Chords</span>
            </Button>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Genre</label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="h-9 bg-white/5 border-white/10 rounded-xl hover:bg-white/10 transition-all text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl">
                {GENRES.map(g => (
                  <SelectItem key={g.value} value={g.value} className="focus:bg-purple-500/20 text-xs font-medium">{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Key</label>
            <Select value={key} onValueChange={setKey}>
              <SelectTrigger className="h-9 bg-white/5 border-white/10 rounded-xl hover:bg-white/10 transition-all text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl">
                {KEYS.map(k => (
                  <SelectItem key={k} value={k} className="focus:bg-blue-500/20 text-xs font-medium">{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Scale</label>
            <Select value={scale} onValueChange={setScale}>
              <SelectTrigger className="h-9 bg-white/5 border-white/10 rounded-xl hover:bg-white/10 transition-all text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl">
                {SCALES.map(s => (
                  <SelectItem key={s} value={s} className="focus:bg-pink-500/20 text-xs font-medium">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 bg-white/5 p-4 rounded-2xl border border-white/5">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest">BPM</label>
              <span className="text-xs font-black text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">{bpm}</span>
            </div>
            <Slider value={[bpm]} onValueChange={(v) => setBpm(v[0])} min={60} max={180} step={1} className="py-2" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest">Complexity</label>
              <span className="text-xs font-black text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]">{complexity}%</span>
            </div>
            <Slider value={[complexity]} onValueChange={(v) => setComplexity(v[0])} min={10} max={100} step={10} className="py-2" />
          </div>
        </div>

        <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-cyan-300/60 uppercase tracking-widest">Arrangement Length</label>
            <span className="text-xs font-black text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">{bars} Bars</span>
          </div>
          <Slider value={[bars]} onValueChange={(v) => setBars(v[0])} min={1} max={8} step={1} className="py-2" />
        </div>

        {/* Track Toggles */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Engine Sub-Systems</label>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Drums', active: includeDrums, setter: setIncludeDrums, icon: Drum, color: 'pink' },
              { label: 'Bass', active: includeBass, setter: setIncludeBass, icon: Guitar, color: 'green' },
              { label: 'Chords', active: includeChords, setter: setIncludeChords, icon: Piano, color: 'purple' },
              { label: 'Melody', active: includeMelody, setter: setIncludeMelody, icon: Music, color: 'blue' }
            ].map((sys) => (
              <Button
                key={sys.label}
                size="sm"
                variant={sys.active ? 'default' : 'outline'}
                className={`h-8 px-4 rounded-full font-black uppercase text-[10px] tracking-widest transition-all border-2 ${
                  sys.active 
                    ? `bg-${sys.color}-500/20 border-${sys.color}-500/50 text-${sys.color}-400 shadow-[0_0_10px_rgba(var(--${sys.color}-500),0.2)]` 
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}
                onClick={() => sys.setter(!sys.active)}
              >
                <sys.icon className="w-3 h-3 mr-2" />
                {sys.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Generate Full Loop Button */}
        <Button
          className="w-full h-14 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-blue-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-blue-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] border border-white/20"
          onClick={(e) => {
            e.stopPropagation();
            generateFullLoop();
          }}
          disabled={isGenerating || (!includeDrums && !includeBass && !includeChords && !includeMelody)}
        >
          {isGenerating && generatingType === 'full' ? (
            <>
              <Loader2 className="w-5 h-5 mr-3 animate-spin text-white" />
              Neural Rendering...
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5 mr-3 drop-shadow-[0_0_8px_white]" />
              Generate Full Sequence
            </>
          )}
        </Button>

        {/* Library Management */}
        <div className="flex gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 h-11 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
            onClick={() => setShowSaveDialog(true)}
            disabled={!lastGeneratedLoop}
          >
            <Save className="w-4 h-4 mr-2" />
            Archive Loop
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`flex-1 h-11 border rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
              showLibrary 
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
            }`}
            onClick={() => setShowLibrary(!showLibrary)}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Neural Archive ({savedLoops.length})
          </Button>
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="p-4 bg-black/40 backdrop-blur-2xl rounded-2xl border border-green-500/30 space-y-3 animate-in fade-in zoom-in-95">
            <label className="text-[10px] font-black text-green-400/80 uppercase tracking-widest ml-1">Archive Identifier</label>
            <div className="flex gap-2">
              <Input
                value={loopName}
                onChange={(e) => setLoopName(e.target.value)}
                placeholder="SEQUENCE_ID_01..."
                className="flex-1 h-10 bg-white/5 border-white/10 rounded-lg text-sm font-bold text-white placeholder:text-white/20"
                onKeyDown={(e) => e.key === 'Enter' && saveToLibrary()}
              />
              <Button size="sm" onClick={saveToLibrary} className="bg-green-600 hover:bg-green-500 h-10 px-4 rounded-lg font-black uppercase text-xs">
                Sync
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSaveDialog(false)} className="h-10 text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Loop Library */}
        {showLibrary && (
          <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2 animate-in slide-in-from-bottom-4 duration-300">
            {savedLoops.length === 0 ? (
              <div className="text-center text-white/20 text-[10px] font-black uppercase tracking-widest py-8 bg-black/20 rounded-2xl border border-dashed border-white/10">
                Archive Empty // Waiting for Input
              </div>
            ) : (
              <>
                {savedLoops
                  .sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
                  .map(loop => (
                    <div 
                      key={loop.id}
                      className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-purple-500/40 hover:bg-white/10 transition-all group/item shadow-sm"
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:bg-transparent"
                        onClick={() => toggleFavorite(loop.id)}
                      >
                        <Heart className={`w-4 h-4 transition-all ${loop.isFavorite ? 'fill-red-500 text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'text-white/20 group-hover/item:text-white/40'}`} />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-white/90 truncate uppercase tracking-tight">{loop.name}</div>
                        <div className="text-[9px] font-black text-white/30 uppercase tracking-tighter">
                          {loop.genre} • {loop.key} {loop.scale} • {loop.bpm} BPM
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                        onClick={() => loadFromLibrary(loop)}
                      >
                        Recall
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                        onClick={() => deleteFromLibrary(loop.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
              </>
            )}
          </div>
        )}

        <p className="text-[9px] text-white/20 text-center font-black uppercase tracking-[0.3em] pt-2">
          Holographic Loop Matrix // Multi-System Synchronization Ready
        </p>
      </CardContent>
    </Card>
  );
}

