import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Music, Drum, Guitar, Piano, Mic2, Wand2, RefreshCw, Send, Save, FolderPlus, Heart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

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
    // Dispatch event to Piano Roll
    const event = new CustomEvent('astutely:generated', {
      detail: {
        notes: loop.notes,
        bpm: loop.bpm,
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(event);
    
    // Also save to localStorage as backup
    localStorage.setItem('astutely-generated', JSON.stringify({
      notes: loop.notes,
      bpm: loop.bpm,
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
    <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Loop Generator
          </CardTitle>
          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">Pro</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Generate Buttons */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 font-medium">Quick Generate</label>
          <div className="grid grid-cols-4 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-2 border-blue-500/30 hover:bg-blue-500/20"
              onClick={() => generateQuickContent('melody')}
              disabled={isGenerating}
            >
              {generatingType === 'melody' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4 text-blue-400" />}
              <span className="text-xs">Melody</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-2 border-pink-500/30 hover:bg-pink-500/20"
              onClick={() => generateQuickContent('drums')}
              disabled={isGenerating}
            >
              {generatingType === 'drums' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Drum className="w-4 h-4 text-pink-400" />}
              <span className="text-xs">Drums</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-2 border-green-500/30 hover:bg-green-500/20"
              onClick={() => generateQuickContent('bass')}
              disabled={isGenerating}
            >
              {generatingType === 'bass' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Guitar className="w-4 h-4 text-green-400" />}
              <span className="text-xs">Bass</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-2 border-purple-500/30 hover:bg-purple-500/20"
              onClick={() => generateQuickContent('chords')}
              disabled={isGenerating}
            >
              {generatingType === 'chords' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Piano className="w-4 h-4 text-purple-400" />}
              <span className="text-xs">Chords</span>
            </Button>
          </div>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Genre</label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map(g => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Key</label>
            <Select value={key} onValueChange={setKey}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEYS.map(k => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Scale</label>
            <Select value={scale} onValueChange={setScale}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCALES.map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">BPM: {bpm}</label>
            <Slider
              value={[bpm]}
              onValueChange={(v) => setBpm(v[0])}
              min={60}
              max={180}
              step={1}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Complexity: {complexity}%</label>
            <Slider
              value={[complexity]}
              onValueChange={(v) => setComplexity(v[0])}
              min={10}
              max={100}
              step={10}
              className="w-full"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Bars: {bars}</label>
          <Slider
            value={[bars]}
            onValueChange={(v) => setBars(v[0])}
            min={1}
            max={8}
            step={1}
            className="w-full"
          />
        </div>

        {/* Track Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-gray-400">Include:</label>
          <Button
            size="sm"
            variant={includeDrums ? 'default' : 'outline'}
            className="h-6 text-xs px-2"
            onClick={() => setIncludeDrums(!includeDrums)}
          >
            <Drum className="w-3 h-3 mr-1" />
            Drums
          </Button>
          <Button
            size="sm"
            variant={includeBass ? 'default' : 'outline'}
            className="h-6 text-xs px-2"
            onClick={() => setIncludeBass(!includeBass)}
          >
            <Guitar className="w-3 h-3 mr-1" />
            Bass
          </Button>
          <Button
            size="sm"
            variant={includeChords ? 'default' : 'outline'}
            className="h-6 text-xs px-2"
            onClick={() => setIncludeChords(!includeChords)}
          >
            <Piano className="w-3 h-3 mr-1" />
            Chords
          </Button>
          <Button
            size="sm"
            variant={includeMelody ? 'default' : 'outline'}
            className="h-6 text-xs px-2"
            onClick={() => setIncludeMelody(!includeMelody)}
          >
            <Music className="w-3 h-3 mr-1" />
            Melody
          </Button>
        </div>

        {/* Generate Full Loop Button */}
        <Button
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          onClick={generateFullLoop}
          disabled={isGenerating || (!includeDrums && !includeBass && !includeChords && !includeMelody)}
        >
          {isGenerating && generatingType === 'full' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Full Loop
            </>
          )}
        </Button>

        {/* Save to Library / Library Toggle */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-green-500/30 hover:bg-green-500/20"
            onClick={() => setShowSaveDialog(true)}
            disabled={!lastGeneratedLoop}
          >
            <Save className="w-4 h-4 mr-2 text-green-400" />
            Save to Library
          </Button>
          <Button
            size="sm"
            variant={showLibrary ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setShowLibrary(!showLibrary)}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Library ({savedLoops.length})
          </Button>
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="p-3 bg-gray-800/80 rounded-lg border border-green-500/30 space-y-2">
            <label className="text-xs text-gray-400">Loop Name</label>
            <div className="flex gap-2">
              <Input
                value={loopName}
                onChange={(e) => setLoopName(e.target.value)}
                placeholder="My awesome loop..."
                className="flex-1 h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && saveToLibrary()}
              />
              <Button size="sm" onClick={saveToLibrary} className="bg-green-600 hover:bg-green-700">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Loop Library */}
        {showLibrary && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {savedLoops.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-4">
                No saved loops yet. Generate and save some!
              </div>
            ) : (
              <>
                {/* Favorites first */}
                {savedLoops
                  .sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
                  .map(loop => (
                    <div 
                      key={loop.id}
                      className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-colors"
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleFavorite(loop.id)}
                      >
                        <Heart className={`w-4 h-4 ${loop.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{loop.name}</div>
                        <div className="text-xs text-gray-500">
                          {loop.genre} • {loop.key} {loop.scale} • {loop.bpm} BPM • {loop.bars} bars
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => loadFromLibrary(loop)}
                      >
                        Load
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                        onClick={() => deleteFromLibrary(loop.id)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
