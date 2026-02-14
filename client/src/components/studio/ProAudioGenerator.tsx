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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Music, Loader2, Sparkles, Zap } from 'lucide-react';

interface GeneratedSong {
  id: string;
  title: string;
  description: string;
  structure: any;
  metadata: {
    duration: number;
    key: string;
    bpm: number;
    format: string;
  };
  chordProgression: string[];
  productionNotes: any;
  audioFeatures: any;
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
          /* Generated Song Display - Enhanced with both approaches */
          <div className="space-y-6">
            {/* Song Info Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{generatedSong.title}</CardTitle>
                    <p className="text-muted-foreground mt-1">{generatedSong.description}</p>
                  </div>
                  <Button
                    onClick={() => setGeneratedSong(null)}
                    variant="outline"
                  >
                    Generate Another Song
                  </Button>
                </div>
              </CardHeader>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Song Structure */}
              <div className="lg:col-span-2">
                <Tabs defaultValue="structure" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="structure">Song Structure</TabsTrigger>
                    <TabsTrigger value="chords">Chord Progression</TabsTrigger>
                    <TabsTrigger value="production">Production Notes</TabsTrigger>
                    <TabsTrigger value="features">Audio Features</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="structure">
                    <Card>
                      <CardHeader>
                        <CardTitle>Song Structure</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-96 font-mono">
                          {JSON.stringify(generatedSong.structure, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="chords">
                    <Card>
                      <CardHeader>
                        <CardTitle>Chord Progression</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {generatedSong.chordProgression?.map((chord, index) => (
                            <Badge key={index} variant="secondary" className="text-base px-3 py-1">
                              {chord}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="production">
                    <Card>
                      <CardHeader>
                        <CardTitle>Production Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-64 font-mono">
                          {JSON.stringify(generatedSong.productionNotes, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="features">
                    <Card>
                      <CardHeader>
                        <CardTitle>Audio Features</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-64 font-mono">
                          {JSON.stringify(generatedSong.audioFeatures, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            
              {/* Metadata Sidebar */}
              <div className="space-y-4">
                {/* Quick Metadata */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>Duration: {formatDuration(generatedSong.metadata.duration)}</div>
                    <div>Key: {generatedSong.metadata.key}</div>
                    <div>BPM: {generatedSong.metadata.bpm}</div>
                    <div>Format: {generatedSong.metadata.format}</div>
                  </CardContent>
                </Card>
                
                {/* Quick Chord Progression */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Chord Progression</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {generatedSong.chordProgression?.slice(0, 8).map((chord, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {chord}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Actions */}
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full">
                    Export Structure
                  </Button>
                  <Button variant="outline" size="sm" className="w-full">
                    Save Project
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
