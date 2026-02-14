import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AIProviderSelector } from '@/components/ui/ai-provider-selector';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Tabs removed — results view now uses audio player instead of JSON tabs
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Music, Loader2, Sparkles, Zap } from 'lucide-react';

interface GeneratedSong {
  success: boolean;
  audioUrl: string;
  title: string;
  description: string;
  genre: string;
  prompt: string;
  provider: string;
}

export function ProAudioGenerator() {
  const { toast } = useToast();
  
  // Form state
  const [songDescription, setSongDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [aiProvider, setAiProvider] = useState('replicate-musicgen');
  const [duration, setDuration] = useState([180]); // 3:00 in seconds
  const [bpm, setBpm] = useState([120]);
  const [key, setKey] = useState('C Major');
  const [style, setStyle] = useState('');
  const [includeVocals, setIncludeVocals] = useState(true);
  
  // Instruments state (organized like the live site)
  const [instruments, setInstruments] = useState({
    piano: false,
    guitar: false,
    bass: false,
    drums: false,
    synth: false,
    strings: false,
    pads: false,
    brass: false
  });
  
  // Generated song state
  const [generatedSong, setGeneratedSong] = useState<GeneratedSong | null>(null);
  
  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const examplePrompts = [
    "An uplifting pop anthem about conquering challenges",
    "A moody synthwave track for late-night coding", 
    "Energetic rock song with powerful chorus and catchy riff"
  ];
  
  const genres = ['Hip-Hop', 'Pop', 'Rock', 'Electronic', 'Jazz', 'Classical', 'R&B', 'Country', 'Blues', 'Reggae', 'Folk', 'Indie'];
  const moods = ['Dark', 'Uplifting', 'Energetic', 'Chill', 'Melancholic', 'Aggressive', 'Dreamy', 'Mysterious', 'Romantic', 'Epic'];
  const keys = ['C Major', 'G Major', 'D Major', 'A Major', 'E Major', 'B Major', 'F# Major', 'C# Major', 'F Major', 'Bb Major', 'Eb Major', 'Ab Major', 'Db Major', 'Gb Major', 'Cb Major'];
  
  const generateMutation = useMutation({
    mutationFn: async () => {
      const selectedInstruments = Object.keys(instruments).filter(key => instruments[key as keyof typeof instruments]);
      
      const payload = {
        songDescription,
        genre,
        mood,
        aiProvider,
        duration: duration[0],
        bpm: bpm[0],
        key,
        style,
        includeVocals,
        instruments: selectedInstruments
      };
      
      const response = await apiRequest('POST', '/api/music/generate-complete', payload);
      
      if (!response.ok) {
        throw new Error('Failed to generate song');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedSong(data);
      toast({
        title: "🎵 Professional Song Generated!",
        description: "Your complete song structure is ready to explore",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleInstrumentChange = (instrument: string, checked: boolean) => {
    setInstruments(prev => ({
      ...prev,
      [instrument]: checked
    }));
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDownload = async () => {
    if (!generatedSong?.audioUrl) return;
    try {
      const response = await fetch(generatedSong.audioUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedSong.title || 'generated-song'}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Download Started', description: 'Your song is downloading...' });
    } catch {
      toast({ title: 'Download Failed', description: 'Could not download the audio file.', variant: 'destructive' });
    }
  };

  const handleSaveToLibrary = async () => {
    if (!generatedSong) return;
    try {
      await apiRequest('POST', '/api/songs/upload', {
        title: generatedSong.title,
        genre: generatedSong.genre,
        songURL: generatedSong.audioUrl,
        description: generatedSong.description,
      });
      toast({ title: 'Saved to Library', description: 'Song added to your library.' });
    } catch {
      toast({ title: 'Save Failed', description: 'Could not save to library.', variant: 'destructive' });
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNewGeneration = () => {
    setGeneratedSong(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header - Clean version matching live site */}
      <div className="border-b border-border">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Pro Audio</h1>
              <p className="text-muted-foreground mt-1">Generate studio-quality songs using the Grok provider</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">Studio-Grade</Badge>
              <Badge variant="secondary">Grok Only</Badge>
              <Badge variant="secondary">Up to 8 minutes</Badge>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6 max-w-6xl mx-auto">
        {!generatedSong ? (
          /* Generation Form - Clean layout like live site */
          <div className="space-y-8">
            {/* Generation Parameters */}
            <Card>
              <CardHeader>
                <CardTitle>Generation Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Song Description */}
                <div>
                  <Label className="mb-2 block font-medium">Song Description</Label>
                  <Textarea
                    value={songDescription}
                    onChange={(e) => setSongDescription(e.target.value)}
                    placeholder="Describe your song idea..."
                    className="min-h-[100px] resize-none"
                  />
                </div>
                  
                {/* Row 1: Genre, Mood, AI Provider - Clean layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="mb-2 block font-medium">Genre</Label>
                    <Select value={genre} onValueChange={setGenre}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {genres.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="mb-2 block font-medium">Mood</Label>
                    <Select value={mood} onValueChange={setMood}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mood" />
                      </SelectTrigger>
                      <SelectContent>
                        {moods.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="mb-2 block font-medium">AI Provider</Label>
                    <AIProviderSelector value={aiProvider} onValueChange={setAiProvider} />
                  </div>
                </div>
                  
                {/* Row 2: Duration, BPM, Key */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="mb-2 block font-medium">Duration ({formatDuration(duration[0])})</Label>
                    <Slider
                      value={duration}
                      onValueChange={setDuration}
                      max={480}
                      min={30}
                      step={30}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label className="mb-2 block font-medium">BPM ({bpm[0]})</Label>
                    <Slider
                      value={bpm}
                      onValueChange={setBpm}
                      max={200}
                      min={60}
                      step={5}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label className="mb-2 block font-medium">Key</Label>
                    <Select value={key} onValueChange={setKey}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {keys.map(k => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                  
                {/* Row 3: Style, Vocals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block font-medium">Style (Optional)</Label>
                    <Input
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      placeholder="e.g. modern, vintage, lo-fi"
                    />
                  </div>
                  
                  <div>
                    <Label className="mb-2 block font-medium">Vocals</Label>
                    <div className="flex items-center space-x-2 mt-3">
                      <Switch
                        checked={includeVocals}
                        onCheckedChange={setIncludeVocals}
                      />
                      <span className="text-sm text-muted-foreground">Include lead vocals</span>
                    </div>
                  </div>
                </div>
                  
                {/* Instruments - Organized grid like live site */}
                <div>
                  <Label className="mb-3 block font-medium">Instruments</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(instruments).map(([instrument, checked]) => (
                      <div key={instrument} className="flex items-center space-x-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(checked) => handleInstrumentChange(instrument, checked as boolean)}
                        />
                        <span className="text-sm capitalize">{instrument}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Example Prompts */}
            <Card>
              <CardHeader>
                <CardTitle>Example Prompts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {examplePrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full text-left h-auto p-3"
                    onClick={() => setSongDescription(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </CardContent>
            </Card>
            
            {/* Generate Button - Matching live site style */}
            <div className="text-center">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !songDescription.trim()}
                size="lg"
                className="min-w-64 h-12"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Professional Song...
                  </>
                ) : (
                  <>
                    <Music className="mr-2 h-5 w-5" />
                    Generate Professional Song
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Generated Song Display — Audio Player + Actions */
          <div className="space-y-6">
            {/* Hidden audio element */}
            <audio
              ref={audioRef}
              src={generatedSong.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleAudioEnded}
              preload="metadata"
            />

            {/* Song Info + Player */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{generatedSong.title}</CardTitle>
                    <p className="text-muted-foreground mt-1">{generatedSong.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{generatedSong.genre}</Badge>
                    <Badge variant="outline">{generatedSong.provider}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Audio Player Controls */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={togglePlayback}
                      size="lg"
                      className="h-12 w-12 rounded-full p-0"
                    >
                      {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      )}
                    </Button>
                    <div className="flex-1 space-y-1">
                      <Slider
                        value={[currentTime]}
                        onValueChange={handleSeek}
                        max={audioDuration || 100}
                        min={0}
                        step={0.1}
                        className="cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(audioDuration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleDownload} variant="outline">
                    <Zap className="mr-2 h-4 w-4" />
                    Download Audio
                  </Button>
                  <Button onClick={handleSaveToLibrary} variant="outline">
                    <Music className="mr-2 h-4 w-4" />
                    Save to Library
                  </Button>
                  <Button onClick={handleNewGeneration} variant="outline">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Another
                  </Button>
                </div>

                {/* Generation Details */}
                <div className="text-xs text-muted-foreground border-t pt-3 mt-3">
                  <span className="font-medium">Prompt:</span> {generatedSong.prompt}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
