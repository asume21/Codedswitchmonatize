/**
 * Code-to-Music Studio V2
 * Convert code to harmonic music using the four chords algorithm
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Music, Code, Wand2, Play, Download, RefreshCw, Info } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAudio } from '@/hooks/use-audio';
import type { MusicData as CodeToMusicData } from '../../../../shared/types/codeToMusic';

const SAMPLE_CODE = `class MusicPlayer {
    constructor() {
        this.volume = 50;
        this.isPlaying = false;
    }
    
    play(song) {
        for (let i = 0; i < song.length; i++) {
            if (song[i].isValid()) {
                this.isPlaying = true;
                return true;
            }
        }
        return false;
    }
    
    stop() {
        this.isPlaying = false;
    }
}`;

const GENRES = [
  { value: 'pop', label: 'Pop', description: '120 BPM, upbeat and catchy' },
  { value: 'rock', label: 'Rock', description: '140 BPM, powerful and energetic' },
  { value: 'hiphop', label: 'Hip-Hop', description: '90 BPM, rhythmic and groovy' },
  { value: 'edm', label: 'EDM', description: '128 BPM, electronic and danceable' },
  { value: 'rnb', label: 'R&B', description: '80 BPM, smooth and soulful' },
  { value: 'country', label: 'Country', description: '100 BPM, melodic and storytelling' },
];

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
];

export default function CodeToMusicStudioV2() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [language, setLanguage] = useState('javascript');
  const [genre, setGenre] = useState('pop');
  const [variation, setVariation] = useState([0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [musicData, setMusicData] = useState<CodeToMusicData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { toast } = useToast();
  const { playNote, initialize, isInitialized } = useAudio();

  const generateMusic = async () => {
    if (!code.trim()) {
      toast({
        title: 'Code Required',
        description: 'Please enter some code to convert to music',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiRequest('POST', '/api/code-to-music', {
        code,
        language,
        genre,
        variation: variation[0],
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();
      
      if (data.success) {
        setMusicData(data.music);
        toast({
          title: 'Music Generated! 🎵',
          description: `Created ${data.music.melody.length} notes in ${data.metadata.genre} style`,
        });
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate music',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const loadSample = () => {
    setCode(SAMPLE_CODE);
    setLanguage('javascript');
    toast({
      title: 'Sample Loaded',
      description: 'Try generating music from this code!',
    });
  };

  const clearScheduledPlayback = () => {
    timeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutsRef.current = [];
  };

  const handlePlay = async () => {
    if (!musicData) {
      toast({
        title: 'No Music Yet',
        description: 'Generate music from your code before playing it back.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (!isInitialized) {
        await initialize();
      }

      clearScheduledPlayback();
      setIsPlaying(true);

      const scheduleTimeout = (delayMs: number, fn: () => void) => {
        const id = setTimeout(fn, delayMs);
        timeoutsRef.current.push(id);
      };

      // Schedule melody notes
      musicData.melody.forEach((note: CodeToMusicData['melody'][number]) => {
        if (!note?.note) return;
        const match = note.note.match(/([A-G]#?)(\d+)/);
        if (!match) return;
        const [, noteName, octaveStr] = match;
        const octave = parseInt(octaveStr, 10) || 4;
        const velocity = Math.max(0, Math.min(1, (note.velocity ?? 100) / 127));

        scheduleTimeout(note.start * 1000, () => {
          playNote(noteName, octave, note.duration, note.instrument || 'piano', velocity);
        });
      });

      // Schedule chords as sustained backing harmony
      musicData.chords.forEach((chord: CodeToMusicData['chords'][number]) => {
        if (!chord?.notes) return;
        chord.notes.forEach((chordNote: string) => {
          const match = chordNote.match(/([A-G]#?)(\d+)/);
          if (!match) return;
          const [, noteName, octaveStr] = match;
          const octave = parseInt(octaveStr, 10) || 4;

          scheduleTimeout(chord.start * 1000, () => {
            playNote(noteName, octave, chord.duration, 'piano', 0.8);
          });
        });
      });

      // Auto-stop flag after the generated duration
      const totalDurationMs = (musicData.metadata?.duration ?? 0) * 1000;
      if (totalDurationMs > 0) {
        scheduleTimeout(totalDurationMs + 200, () => {
          clearScheduledPlayback();
          setIsPlaying(false);
        });
      }
    } catch (error) {
      console.error('Playback error:', error);
      toast({
        title: 'Playback Failed',
        description: error instanceof Error ? error.message : 'Could not play generated music.',
        variant: 'destructive',
      });
      clearScheduledPlayback();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    clearScheduledPlayback();
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      clearScheduledPlayback();
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col gap-4 p-4 pb-16 bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 overflow-y-auto">
      {/* Header */}
      <Card className="bg-slate-900/50 border-purple-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Music className="w-6 h-6 text-purple-400" />
                Code-to-Music Studio
              </CardTitle>
              <CardDescription className="mt-2">
                Convert your code into harmonic music using the four chords algorithm
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-purple-500/50 text-purple-400">
              v2.0 - Four Chords
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        {/* Left Panel - Code Input */}
        <Card className="bg-slate-900/50 border-purple-500/20 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Code className="w-5 h-5 text-blue-400" />
              Your Code
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            {/* Language & Genre Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Language</label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Genre</label>
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES.map(g => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Variation Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Variation</label>
                <span className="text-sm text-purple-400">{variation[0]}</span>
              </div>
              <Slider
                value={variation}
                onValueChange={setVariation}
                min={0}
                max={9}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Change to generate different music from the same code
              </p>
            </div>

            {/* Code Editor */}
            <div className="flex-1 flex flex-col">
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code here..."
                className="flex-1 font-mono text-sm bg-slate-950 border-slate-700 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                data-testid="code-to-music-generate"
                onClick={generateMusic}
                disabled={isGenerating}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate Music
                  </>
                )}
              </Button>
              <Button
                data-testid="code-to-music-load-sample"
                onClick={loadSample}
                variant="outline"
                className="border-purple-500/50"
              >
                Load Sample
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Music Output */}
        <Card className="bg-slate-900/50 border-purple-500/20 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Music className="w-5 h-5 text-purple-400" />
              Generated Music
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {musicData ? (
              <div className="space-y-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-700">
                    <div className="text-xs text-gray-400">Genre</div>
                    <div className="text-lg font-semibold text-purple-400 capitalize">
                      {musicData.metadata.genre}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-700">
                    <div className="text-xs text-gray-400">BPM</div>
                    <div className="text-lg font-semibold text-blue-400">
                      {musicData.metadata.bpm}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-700">
                    <div className="text-xs text-gray-400">Key</div>
                    <div className="text-lg font-semibold text-green-400">
                      {musicData.metadata.key}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-700">
                    <div className="text-xs text-gray-400">Duration</div>
                    <div className="text-lg font-semibold text-pink-400">
                      {musicData.metadata.duration.toFixed(1)}s
                    </div>
                  </div>
                </div>

                {/* Music Stats */}
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-700 space-y-2">
                  <div className="text-sm font-medium text-gray-300">Music Structure</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Chords:</span>
                      <span className="ml-2 text-purple-400">{musicData.chords.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Notes:</span>
                      <span className="ml-2 text-blue-400">{musicData.melody.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Events:</span>
                      <span className="ml-2 text-green-400">{musicData.timeline.length}</span>
                    </div>
                  </div>
                </div>

                {/* Chord Progression */}
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-700">
                  <div className="text-sm font-medium text-gray-300 mb-2">Chord Progression</div>
                  <div className="flex gap-2">
                    {musicData.chords.map((chord, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="border-purple-500/50 text-purple-400"
                      >
                        {chord.chord}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    data-testid="code-to-music-play"
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    disabled={isGenerating || !musicData}
                    onClick={isPlaying ? handleStop : handlePlay}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {isPlaying ? 'Stop' : 'Play Music'}
                  </Button>
                  <Button variant="outline" className="border-purple-500/50">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500 space-y-3">
                  <Info className="w-12 h-12 mx-auto opacity-50" />
                  <p className="text-sm">No music generated yet</p>
                  <p className="text-xs">Enter code and click "Generate Music"</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
