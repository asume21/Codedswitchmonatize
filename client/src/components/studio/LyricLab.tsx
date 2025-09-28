import { useState, useContext } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/hooks/use-audio";
import { StudioAudioContext } from "@/pages/studio";
import { AIProviderSelector } from "@/components/ui/ai-provider-selector";

interface RhymeSuggestion {
  word: string;
  type: "perfect" | "near";
}

export default function LyricLab() {
  const studioContext = useContext(StudioAudioContext);
  const [title, setTitle] = useState("My Awesome Track");
  const [content, setContent] = useState(`[Verse 1]
Started from the bottom of the code base,
Debugging through the night at my own pace,
Functions calling functions in this digital space,
Building something greater than the human race.

[Pre-Chorus]
Binary dreams and electric thoughts,
Creating melodies from the code I've wrought.

[Chorus]
We're translating hearts to algorithms,
Making music from the syntax we're writing,
Every loop and every variable's a rhythm,
In this digital symphony we're designing.

[Verse 2]
Type here or use AI generation...`);

  // Update studio context whenever lyrics content changes
  React.useEffect(() => {
    studioContext.setCurrentLyrics(content);
  }, [content, studioContext]);

  // Load persisted lyrics from studio context on component mount
  React.useEffect(() => {
    if (studioContext.currentLyrics && studioContext.currentLyrics !== content) {
      setContent(studioContext.currentLyrics);
    }
  }, [studioContext.currentLyrics]);
  const [genre, setGenre] = useState("hip-hop");
  const [rhymeScheme, setRhymeScheme] = useState("ABAB");
  const [theme, setTheme] = useState("technology, coding");
  const [mood, setMood] = useState("upbeat");
  const [currentWord, setCurrentWord] = useState("");
  const [rhymeSuggestions, setRhymeSuggestions] = useState<RhymeSuggestion[]>([]);
  const [hasGeneratedMusic, setHasGeneratedMusic] = useState(false);
  const [lyricComplexity, setLyricComplexity] = useState([5]);
  const [beatComplexity, setBeatComplexity] = useState([5]);
  const [aiProvider, setAiProvider] = useState("grok");

  // Check if there's already generated music in studio context and localStorage
  React.useEffect(() => {
    const hasPattern = studioContext.currentPattern && Object.keys(studioContext.currentPattern).length > 0 && 
      Object.values(studioContext.currentPattern).some(arr => Array.isArray(arr) && arr.some(val => val === true));
    const hasMelody = studioContext.currentMelody && studioContext.currentMelody.length > 0;
    const hasCodeMusic = studioContext.currentCodeMusic && Object.keys(studioContext.currentCodeMusic).length > 0;
    
    // Also check localStorage for persisted data  
    let hasStoredData = false;
    try {
      const storedData = localStorage.getItem('generatedMusicData');
      if (storedData) {
        const parsed = JSON.parse(storedData);
        hasStoredData = parsed?.beatPattern && Object.values(parsed.beatPattern).some(arr => 
          Array.isArray(arr) && arr.some(val => val === true));
      }
    } catch (error) {
      // Ignore localStorage errors
    }
    
    if (hasPattern || hasMelody || hasCodeMusic || hasStoredData) {
      setHasGeneratedMusic(true);
    } else {
      setHasGeneratedMusic(false);
    }
  }, [studioContext.currentPattern, studioContext.currentMelody, studioContext.currentCodeMusic]);

  const { toast } = useToast();
  const { initialize, isInitialized } = useAudio();

  const generateLyricsMutation = useMutation({
    mutationFn: async (data: { theme: string; genre: string; mood: string; complexity?: number; aiProvider: string }) => {
      // Add randomization to prevent repetitive results
      const genres = ["hip-hop", "pop", "rock", "country", "R&B", "folk", "reggae", "electronic", "jazz", "blues"];
      const moods = ["upbeat", "melancholic", "energetic", "romantic", "rebellious", "peaceful", "intense", "nostalgic"];
      const themes = ["love", "freedom", "success", "struggle", "dreams", "technology", "nature", "friendship"];
      
      const randomGenre = genres[Math.floor(Math.random() * genres.length)];
      const randomMood = moods[Math.floor(Math.random() * moods.length)];
      const randomTheme = themes[Math.floor(Math.random() * themes.length)];
      
      const response = await apiRequest("POST", "/api/lyrics/generate", {
        theme: `${data.theme}, ${randomTheme}`,
        genre: randomGenre,
        mood: randomMood,
        complexity: data.complexity,
        aiProvider: data.aiProvider
      });
      return response.json();
    },
    onSuccess: (data) => {
      setContent(data.content || data);
      setTitle(`${genre} Song ${Date.now()}`);
      // Save lyrics to studio context for master playback
      studioContext.setCurrentLyrics(data.content || data);
      toast({
        title: "Lyrics Generated",
        description: "AI has created unique lyrics for you.",
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate lyrics. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveLyricsMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; genre: string; rhymeScheme: string }) => {
      const response = await apiRequest("POST", "/api/lyrics", data);
      return response.json();
    },
    onSuccess: () => {
      // Save lyrics to studio context for master playback
      studioContext.setCurrentLyrics(content);
      toast({
        title: "Lyrics Saved",
        description: "Your lyrics have been saved successfully.",
      });
    },
  });

  // Generate music from lyrics using Suno API
  const generateMusicFromLyricsMutation = useMutation({
    mutationFn: async (data: { lyrics: string; genre: string; mood: string; title: string }) => {
      const response = await apiRequest("POST", "/api/lyrics/generate-music", data);
      return response.json();
    },
    onSuccess: (data) => {
      console.log("🎵 Music generated from lyrics:", data);
      if (data.audioUrl) {
        toast({
          title: "Music Generated!",
          description: `Song "${data.title}" created. Audio ready to play.`,
        });
      }
      setHasGeneratedMusic(true);
    },
    onError: () => {
      toast({
        title: "Music Generation Failed",
        description: "Failed to generate music from lyrics. Please try again.",
        variant: "destructive",
      });
    },
  });

  // NEW: Mastering function to optimize the full song
  const masterSongMutation = useMutation({
    mutationFn: async (data: { 
      pattern: unknown; 
      melody: any[]; 
      lyrics: string; 
      codeMusic: any;
      bpm: number;
      genre: string;
    }) => {
      const response = await apiRequest("POST", "/api/master", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Song Mastered",
        description: "Your song has been professionally mastered and optimized!",
      });
      // Apply mastered settings to studio context
      if (data.masteredSettings) {
        console.log("Mastered settings applied:", data.masteredSettings);
      }
    },
    onError: () => {
      toast({
        title: "Mastering Failed",
        description: "Failed to master the song. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rhymeMutation = useMutation({
    mutationFn: async (data: { word: string }) => {
      const response = await apiRequest("POST", "/api/lyrics/rhymes", data);
      return response.json();
    },
    onSuccess: (data) => {
      const suggestions: RhymeSuggestion[] = data.rhymes.map((rhyme: string) => ({
        word: rhyme,
        type: "perfect" as const,
      }));
      setRhymeSuggestions(suggestions);
    },
  });

  const generateBeatFromLyricsMutation = useMutation({
    mutationFn: async (data: { lyrics: string; genre: string; complexity?: number }) => {
      const response = await apiRequest("POST", "/api/lyrics/generate-beat", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Beat Pattern Generated",
        description: "AI has analyzed your lyrics and generated a matching beat pattern.",
      });
      // You can store the beat pattern in state or send it to the BeatMaker component
      console.log("Generated beat pattern:", data.beatPattern);
    },
    onError: () => {
      toast({
        title: "Beat Generation Failed",
        description: "Failed to generate beat from lyrics. Please try again.",
        variant: "destructive",
      });
    },
  });

  const { data: savedLyrics } = useQuery({
    queryKey: ["/api/lyrics"],
  });

  const handleGenerateAI = () => {
    if (!theme.trim()) {
      toast({
        title: "No Theme Provided",
        description: "Please enter a theme for the lyrics.",
        variant: "destructive",
      });
      return;
    }

    generateLyricsMutation.mutate({
      theme,
      genre,
      mood,
      aiProvider,
      complexity: lyricComplexity[0],
    });
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Incomplete Lyrics",
        description: "Please provide both title and content.",
        variant: "destructive",
      });
      return;
    }

    saveLyricsMutation.mutate({
      title,
      content,
      genre,
      rhymeScheme,
    });
  };

  const handleFindRhymes = () => {
    if (!currentWord.trim()) return;
    rhymeMutation.mutate({ word: currentWord.trim() });
  };

  const insertRhyme = (rhyme: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + rhyme + content.substring(end);
      setContent(newContent);

      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + rhyme.length, start + rhyme.length);
      }, 0);
    }
  };

  const goToSection = (section: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      const sectionIndex = content.indexOf(`[${section.charAt(0).toUpperCase() + section.slice(1)}]`);
      if (sectionIndex !== -1) {
        textarea.focus();
        textarea.setSelectionRange(sectionIndex, sectionIndex);
        textarea.scrollTop = (sectionIndex / content.length) * textarea.scrollHeight;
      }
    }
  };

  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  const lineCount = content.split('\n').length;

  const genres = [
    { value: "hip-hop", label: "Hip-Hop" },
    { value: "pop", label: "Pop" },
    { value: "rock", label: "Rock" },
    { value: "r&b", label: "R&B" },
    { value: "country", label: "Country" },
    { value: "electronic", label: "Electronic" },
  ];

  const moods = [
    { value: "upbeat", label: "Upbeat" },
    { value: "melancholic", label: "Melancholic" },
    { value: "energetic", label: "Energetic" },
    { value: "romantic", label: "Romantic" },
    { value: "introspective", label: "Introspective" },
  ];

  const rhymeSchemes = [
    { value: "AABB", label: "AABB (Couplets)" },
    { value: "ABAB", label: "ABAB (Alternating)" },
    { value: "ABCB", label: "ABCB (Ballad)" },
    { value: "FREE", label: "Free Verse" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-heading font-bold">Lyric Lab</h2>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => {
                initialize();
                toast({ title: "Audio Initialized", description: "The audio engine has started." });
              }}
              disabled={isInitialized}
              className="bg-studio-accent hover:bg-blue-500"
            >
              <i className="fas fa-power-off mr-2"></i>
              {isInitialized ? 'Audio Ready' : 'Start Audio'}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Lyric Editor */}
          <div className="col-span-2 bg-studio-panel border border-gray-600 rounded-lg overflow-hidden">
            <div className="bg-gray-700 px-4 py-2 border-b border-gray-600 flex items-center justify-between">
              <h3 className="font-medium">Lyric Editor</h3>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <span>Words: {wordCount}</span>
                  <span>Lines: {lineCount}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                    <i className="fas fa-undo"></i>
                  </Button>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                    <i className="fas fa-redo"></i>
                  </Button>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                    <i className="fas fa-spell-check"></i>
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song Title"
                className="mb-4 bg-gray-700 border-gray-600 font-semibold text-lg"
              />

              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="h-96 bg-transparent border-none resize-none font-mono text-sm leading-relaxed focus:outline-none"
                placeholder="Start writing your lyrics here..."
              />
            </div>

            {/* Rhyme Suggestions */}
            {rhymeSuggestions.length > 0 && (
              <div className="p-4 bg-gray-800 border-t border-gray-600">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Rhyme Suggestions</span>
                  <span className="text-xs text-gray-400">For: "{currentWord}"</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {rhymeSuggestions.slice(0, 8).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => insertRhyme(suggestion.word)}
                      className="px-2 py-1 bg-studio-accent bg-opacity-20 text-studio-accent rounded text-xs hover:bg-opacity-30 transition-colors"
                    >
                      {suggestion.word}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Lyric Tools */}
          <div className="space-y-6">
            {/* Song Structure */}
            <div className="bg-studio-panel border border-gray-600 rounded-lg p-4">
              <h3 className="font-medium mb-3">Song Structure</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600" onClick={() => { goToSection("intro"); }}>
                  <span>Intro</span>
                  <span className="text-gray-400">8 bars</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-studio-accent bg-opacity-20 rounded cursor-pointer" onClick={() => goToSection("verse 1")}>
                  <span>Verse 1</span>
                  <span className="text-gray-400">16 bars</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600" onClick={() => goToSection("pre-chorus")}>
                  <span>Pre-Chorus</span>
                  <span className="text-gray-400">8 bars</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600" onClick={() => goToSection("chorus")}>
                  <span>Chorus</span>
                  <span className="text-gray-400">16 bars</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-600 rounded cursor-pointer hover:bg-gray-500">
                  <span className="text-gray-400">+ Add Section</span>
                  <i className="fas fa-plus text-gray-400"></i>
                </div>
              </div>
            </div>

            {/* Rhyme Scheme */}
            <div className="bg-studio-panel border border-gray-600 rounded-lg p-4">
              <h3 className="font-medium mb-3">Rhyme Scheme</h3>
              <div className="space-y-3">
                {rhymeSchemes.map((scheme) => (
                  <div key={scheme.value} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="rhyme"
                      value={scheme.value}
                      checked={rhymeScheme === scheme.value}
                      onChange={(e) => setRhymeScheme(e.target.value)}
                      className="text-studio-accent"
                    />
                    <label className="text-sm cursor-pointer" onClick={() => setRhymeScheme(scheme.value)}>
                      {scheme.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Generated Music Status */}
            {hasGeneratedMusic && (
              <div className="bg-green-900 bg-opacity-30 border border-green-500 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-green-400">Generated Music Ready</h3>
                  <i className="fas fa-check-circle text-green-400"></i>
                </div>
                <p className="text-sm text-green-300 mb-3">
                  Your lyrics have been transformed into music! Check these tabs:
                </p>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'beatmaker' }))}
                    size="sm"
                    className="bg-green-600 hover:bg-green-500 text-xs"
                  >
                    <i className="fas fa-drum mr-1"></i>
                    View Beat
                  </Button>
                  <Button
                    onClick={() => window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'melody' }))}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-xs"
                  >
                    <i className="fas fa-music mr-1"></i>
                    View Melody
                  </Button>
                </div>
              </div>
            )}

            {/* AI Generation */}
            <div className="bg-studio-panel border border-gray-600 rounded-lg p-4">
              <h3 className="font-medium mb-3">AI Generation</h3>
              <div className="space-y-3">
                <Input
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Theme or concept..."
                  className="bg-gray-700 border-gray-600"
                />
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select genre..." />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={mood} onValueChange={setMood}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mood..." />
                  </SelectTrigger>
                  <SelectContent>
                    {moods.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-2">
                  <Label>Lyric Complexity: {lyricComplexity[0]}/10</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">Simple</span>
                    <Slider
                      value={lyricComplexity}
                      onValueChange={setLyricComplexity}
                      max={10}
                      min={1}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-400">Complex</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Beat Complexity: {beatComplexity[0]}/10</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">Simple</span>
                    <Slider
                      value={beatComplexity}
                      onValueChange={setBeatComplexity}
                      max={10}
                      min={1}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-400">Complex</span>
                  </div>
                </div>
                <div className="mb-4">
                  <AIProviderSelector value={aiProvider} onValueChange={setAiProvider} />
                </div>
                <div className="space-y-2">
                  <Button
                    onClick={handleGenerateAI}
                    disabled={generateLyricsMutation.isPending}
                    className="w-full bg-studio-accent hover:bg-blue-500"
                  >
                    {generateLyricsMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner animate-spin mr-2"></i>
                        Generating...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-magic mr-2"></i>
                        AI Generate Lyrics
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => generateMusicFromLyricsMutation.mutate({
                      lyrics: content,
                      genre,
                      mood,
                      title,
                    })}
                    disabled={generateMusicFromLyricsMutation.isPending || !content.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-500"
                  >
                    {generateMusicFromLyricsMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner animate-spin mr-2"></i>
                        Creating Music...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-music mr-2"></i>
                        Generate Music from Lyrics
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => masterSongMutation.mutate({
                      pattern: studioContext.currentPattern,
                      melody: studioContext.currentMelody,
                      lyrics: studioContext.currentLyrics || content,
                      codeMusic: studioContext.currentCodeMusic,
                      bpm: studioContext.bpm,
                      genre,
                    })}
                    disabled={masterSongMutation.isPending || (!studioContext.currentPattern && !studioContext.currentMelody)}
                    className="w-full bg-orange-600 hover:bg-orange-500"
                  >
                    {masterSongMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner animate-spin mr-2"></i>
                        Mastering...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-sliders-h mr-2"></i>
                        Master Full Song
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Rhyme Dictionary */}
            <div className="bg-studio-panel border border-gray-600 rounded-lg p-4">
              <h3 className="font-medium mb-3">Rhyme Dictionary</h3>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <Input
                    value={currentWord}
                    onChange={(e) => setCurrentWord(e.target.value)}
                    placeholder="Enter word to find rhymes..."
                    className="bg-gray-700 border-gray-600"
                    onKeyDown={(e) => e.key === "Enter" && handleFindRhymes()}
                  />
                  <Button
                    onClick={handleFindRhymes}
                    disabled={rhymeMutation.isPending}
                    size="sm"
                    className="bg-studio-accent hover:bg-blue-500"
                  >
                    <i className="fas fa-search"></i>
                  </Button>
                </div>

                {rhymeMutation.isPending && (
                  <div className="text-center py-4">
                    <i className="fas fa-spinner animate-spin text-studio-accent"></i>
                  </div>
                )}
              </div>
            </div>

            {/* Lyric Analysis */}
            <div className="bg-studio-panel border border-gray-600 rounded-lg p-4">
              <h3 className="font-medium mb-3">Lyric Analysis</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tempo Suggestion:</span>
                  <span className="text-studio-accent">
                    {genre === "hip-hop" ? "80-90 BPM" :
                     genre === "pop" ? "120-130 BPM" :
                     genre === "rock" ? "110-140 BPM" :
                     genre === "r&b" ? "70-100 BPM" :
                     genre === "electronic" ? "128-140 BPM" : "90-120 BPM"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Syllable Density:</span>
                  <span className="text-studio-accent">
                    {Math.round((content.split(/\s+/).length / lineCount) * 10) / 10} words/line
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rhythm Style:</span>
                  <span className="text-studio-accent">
                    {wordCount / lineCount > 8 ? "Fast Flow" :
                     wordCount / lineCount > 5 ? "Medium Flow" : "Slow Flow"}
                  </span>
                </div>
                <Button
                  onClick={() => { generateBeatFromLyricsMutation.mutate({ lyrics: content, genre }); }}
                  disabled={generateBeatFromLyricsMutation.isPending || !content.trim()}
                  className="w-full bg-green-600 hover:bg-green-500"
                  size="sm"
                >
                  <i className="fas fa-drum mr-2"></i>
                  Analyze & Generate Beat
                </Button>
              </div>
            </div>

            {/* Word Bank */}
            <div className="bg-studio-panel border border-gray-600 rounded-lg p-4">
              <h3 className="font-medium mb-3">Word Bank</h3>
              <div className="space-y-2 text-xs max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {["algorithm", "digital", "syntax", "binary", "electric", "function", "variable", "execute"].map((word) => (
                    <button
                      key={word}
                      onClick={() => { insertRhyme(word); }}
                      className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}