import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAudio } from '@/hooks/use-audio';
import { realisticAudio } from '@/lib/realisticAudio';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Music, Mic, Volume2, Sparkles, Users, Play, Download, Star, Zap, Layers } from 'lucide-react';
import { Link } from 'wouter';
import PianoRollPreview from './PianoRollPreview';
import DAWMultiTrackPianoRoll, { demoDAWSession } from './DAWMultiTrackPianoRoll';
import ModularChordProgression from './ModularChordProgression';
import ModularPianoRoll from './ModularPianoRoll';
import ModularDrumMachine from './ModularDrumMachine';
import { UpgradeModal, useLicenseGate } from '@/lib/LicenseGuard';

// Professional Studio Component - Professional-Grade AI Music Generation Integrated in Main Studio
export default function ProfessionalStudio() {
  const { toast } = useToast();
  const { playDrum, initialize, isInitialized } = useAudio();
  const [activeTab, setActiveTab] = useState('full-song');
  const { requirePro, startUpgrade } = useLicenseGate();
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Chord Progression State
  const [chordProgression, setChordProgression] = useState<Array<{ root: string; quality: string }>>([]);

  function handleAISuggestChordProgression() {
    if (!requirePro("ai-chords", () => setShowUpgrade(true))) return;
    setChordProgression([
      { root: 'C', quality: 'maj' },
      { root: 'F', quality: 'maj7' },
      { root: 'Dm', quality: 'min' },
      { root: 'G', quality: '7' }
    ]);
  }

  function handlePlayChordProgression() {
    // Optionally implement playback logic here, or leave empty for now
  }

  // Piano Roll AI Suggestion - using correct PianoRollNote type
  const [pianoRollNotes, setPianoRollNotes] = useState<Array<{ id: string; pitch: number; start: number; duration: number; velocity: number }>>([]);
  
  function handleAISuggestPianoRoll() {
    if (!requirePro("ai-chords", () => setShowUpgrade(true))) return;
    // Generate a simple AI-suggested melody based on chord progression (MIDI pitch values)
    const suggestedNotes = [
      { id: 'n1', pitch: 60, start: 0, duration: 0.5, velocity: 100 },     // C4
      { id: 'n2', pitch: 64, start: 0.5, duration: 0.5, velocity: 100 },   // E4
      { id: 'n3', pitch: 67, start: 1, duration: 0.5, velocity: 100 },     // G4
      { id: 'n4', pitch: 72, start: 1.5, duration: 1, velocity: 100 },     // C5
      { id: 'n5', pitch: 71, start: 2.5, duration: 0.5, velocity: 90 },    // B4
      { id: 'n6', pitch: 69, start: 3, duration: 0.5, velocity: 90 },      // A4
      { id: 'n7', pitch: 67, start: 3.5, duration: 1, velocity: 100 },     // G4
    ];
    setPianoRollNotes(suggestedNotes);
  }

  // Drum Machine AI Suggestion - using correct DrumStep type
  const [drumPattern, setDrumPattern] = useState<Array<{ id: string; step: number; velocity: number; active: boolean }>>([]);
  
  function handleAISuggestDrumPattern() {
    if (!requirePro("ai-chords", () => setShowUpgrade(true))) return;
    // Generate a basic AI-suggested drum pattern
    const suggestedPattern: Array<{ id: string; step: number; velocity: number; active: boolean }> = [];
    for (let step = 0; step < 16; step++) {
      // Kick on 1, 5, 9, 13
      if (step % 4 === 0) suggestedPattern.push({ id: `kick-${step}`, step, velocity: 100, active: true });
      // Snare on 5, 13
      if (step === 4 || step === 12) suggestedPattern.push({ id: `snare-${step}`, step, velocity: 100, active: true });
      // Hi-hat on every other step
      if (step % 2 === 0) suggestedPattern.push({ id: `hihat-${step}`, step, velocity: 80, active: true });
    }
    setDrumPattern(suggestedPattern);
  }

  // Full Song Generation State
  const [songPrompt, setSongPrompt] = useState('');
  const [songOptions, setSongOptions] = useState({
    genre: 'pop',
    mood: 'uplifting',
    duration: 180,
    style: 'modern',
    instruments: ['piano', 'guitar', 'bass', 'drums'],
    vocals: true,
    bpm: 120,
    key: 'C Major'
  });

  // Add Vocals State
  const [instrumentalData, setInstrumentalData] = useState('');
  const [vocalOptions, setVocalOptions] = useState({
    style: 'pop',
    lyrics: '',
    melody: true,
    harmonies: true,
    adLibs: false
  });

  // Add Instrumentals State
  const [vocalData, setVocalData] = useState('');
  const [instrumentalOptions, setInstrumentalOptions] = useState({
    genre: 'pop',
    energy: 'medium',
    instruments: ['piano', 'guitar', 'bass', 'drums'],
    complexity: 5
  });

  // Genre Blending State
  const [primaryGenre, setPrimaryGenre] = useState('pop');
  const [secondaryGenres, setSecondaryGenres] = useState(['rock']);
  const [genrePrompt, setGenrePrompt] = useState('');

  // Enhanced Lyrics State
  const [lyricsTheme, setLyricsTheme] = useState('');
  const [lyricsGenre, setLyricsGenre] = useState('pop');
  const [lyricsMood, setLyricsMood] = useState('uplifting');

  // Code-Music Translation State
  const [codeInput, setCodeInput] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [musicStyle, setMusicStyle] = useState('algorithmic');
  const [cloudStatus, setCloudStatus] = useState<any>(null);

  // Code to Music Translation Mutation
  const codeToMusicMutation = useMutation({
    mutationFn: async ({ code, language, musicStyle }: { code: string; language: string; musicStyle: string }) => {
      const response = await apiRequest('POST', '/api/code-to-music', {
        code,
        language,
        musicStyle
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Code Translated to Music!",
        description: data.professional ? "Professional analysis complete" : "AI analysis complete - deploy cloud for .wav generation"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Translation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Results state
  const [generatedSong, setGeneratedSong] = useState<any>(null);
  const [generatedLyrics, setGeneratedLyrics] = useState<any>(null);
  const [generatedBeat, setGeneratedBeat] = useState<any>(null);
  const [lyricHelper, setLyricHelper] = useState<any>(null);
  const [showLyricHelper, setShowLyricHelper] = useState(false);
  const [helperWord, setHelperWord] = useState('');
  const [helperType, setHelperType] = useState('rhymes');

  // Integrated AI Music Generation Mutations 
  const generateFullSongMutation = useMutation({
    mutationFn: async (data: { prompt?: string; lyrics?: string; options: any }) => {
      const response = await apiRequest('POST', '/api/audio/generate-song', data);
      const parsedResponse = await response.json();
      console.log('🎵 Parsed API response:', parsedResponse);
      return parsedResponse;
    },
    onSuccess: (result) => {
      console.log('🎵 Setting generated song:', result);
      // Extract the song data from the result
      const songData = result.song || result;
      setGeneratedSong(songData);
      toast({
        title: "AI Song Generated",
        description: "Your complete song with AI beat and melody is ready!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate AI song",
        variant: "destructive"
      });
    }
  });

  const generateAIBeatMutation = useMutation({
    mutationFn: async (data: { style: string; lyrics?: string; bpm?: number; complexity?: number }) => {
      // Transform data to match API expectations
      const beatData = {
        genre: data.style || 'electronic',
        bpm: data.bpm || 120,
        duration: 30 // Default 30 seconds
      };
      const response = await apiRequest('POST', '/api/beats/generate', beatData);
      return await response.json();
    },
    onSuccess: (result) => {
      setGeneratedBeat(result);
      toast({
        title: "AI Beat Generated", 
        description: "Your unique AI beat is ready to use!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Beat Generation Failed",
        description: error.message || "Failed to generate AI beat", 
        variant: "destructive"
      });
    }
  });

  const generateAIMelodyMutation = useMutation({
    mutationFn: async (data: { scale: string; style: string; complexity: number; lyrics?: string; beatData?: any }) => {
      const response = await apiRequest('POST', '/api/melodies/generate', data);
      return await response.json(); 
    },
    onSuccess: (result) => {
      toast({
        title: "AI Melody Generated",
        description: "Your AI-enhanced melody is ready!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Melody Generation Failed",
        description: error.message || "Failed to generate AI melody",
        variant: "destructive"
      });
    }
  });
  const generateSongMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/audio/generate-song', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      setGeneratedSong(data.song);
      toast({
        title: "Professional Song Generated! 🎵",
        description: `Studio-quality ${data.song?.metadata?.duration || 180}s song created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.response?.data?.error || "Failed to generate professional song",
        variant: "destructive"
      });
    }
  });

  const addVocalsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/audio/generate-song', { ...data, includeVocals: true });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Vocals Added Successfully! 🎤",
        description: "Professional vocal arrangement layered onto instrumental",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Vocal Addition Failed",
        description: error.response?.data?.error || "Failed to add vocals",
        variant: "destructive"
      });
    }
  });

  const generateLyricsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/audio/generate-lyrics', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log("🎵 Lyrics data received:", data);
      setGeneratedLyrics(data.lyrics);
      toast({
        title: "Professional Lyrics Generated! ✍️",
        description: "ReMi-level sophisticated lyrics created",
      });
    },
    onError: (error: any) => {
      console.error("❌ Lyrics generation error:", error);
      toast({
        title: "Lyric Generation Failed",
        description: error.response?.data?.error || "Failed to generate lyrics",
        variant: "destructive"
      });
    }
  });

  // FULL SONG GENERATION - Professional studio feature
  const fullSongGenerationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/songs/generate-professional', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log("✅ Full song generation success!", data);
      setGeneratedSong(data.song);
      toast({
        title: "Professional Song Generated!",
        description: `${data.metadata?.duration || 240}s song with vocals, melody & full arrangement created`,
      });
    },
    onError: (error: any) => {
      console.error("❌ Full song generation error:", error);
      toast({
        title: "Song Generation Failed", 
        description: error?.message || "Could not generate professional song",
        variant: "destructive",
      });
    }
  });

  // GENRE FUSION GENERATION - Advanced genre blending
  const genreFusionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/songs/blend-genres', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log("🎵 Genre fusion success:", data);
      toast({
        title: "Genre Fusion Complete!",
        description: `Successfully blended ${data.genreFusion?.primaryElements?.length || 0} genre elements`,
      });
    },
    onError: (error: any) => {
      console.error("❌ Genre fusion error:", error);
      toast({
        title: "Genre Fusion Failed",
        description: error?.message || "Could not blend genres",
        variant: "destructive",
      });
    }
  });

  // FULL RAP INSTRUMENTAL GENERATION - Complete rap-ready tracks  
  const generateBeatFromLyricsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/audio/generate-beat-from-lyrics', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log("✅ Full rap instrumental success! Data:", data);
      setGeneratedBeat(data.beat);
      toast({
        title: "Rap Instrumental Complete! 🎵",
        description: `Full ${data.isFullInstrumental ? 'rap-ready instrumental' : 'beat pattern'} created - BPM: ${data.bpm || 'Unknown'}`,
      });
    },
    onError: (error: any) => {
      console.error("❌ Rap instrumental generation error:", error);
      toast({
        title: "Instrumental Generation Failed",
        description: error?.message || "Could not generate rap instrumental from lyrics",
        variant: "destructive",
      });
    }
  });

  const lyricHelperMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/audio/generate-lyrics', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      setLyricHelper(data.helper);
      toast({
        title: "Lyric Helper Ready!",
        description: `Found ${helperType} for "${helperWord}"`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lyric Helper Failed",
        description: error?.message || "Could not get lyric suggestions",
        variant: "destructive",
      });
    }
  });

  // Integrated AI Generation Handlers
  const handleFullSongGeneration = () => {
    generateFullSongMutation.mutate({
      prompt: songPrompt,
      lyrics: vocalOptions.lyrics || (generatedLyrics?.content || generatedLyrics?.text),
      options: {
        genre: songOptions.genre,
        mood: songOptions.mood,
        duration: songOptions.duration,
        style: songOptions.style,
        bpm: songOptions.bpm,
        key: songOptions.key,
        complexity: 5
      }
    });
  };

  const handleAIBeatGeneration = () => {
    const lyrics = vocalOptions.lyrics || (generatedLyrics?.content || generatedLyrics?.text);
    generateAIBeatMutation.mutate({
      style: songOptions.genre,
      lyrics,
      bpm: songOptions.bpm,
      complexity: 5
    });
  };

  const handleAIMelodyGeneration = () => {
    const lyrics = vocalOptions.lyrics || (generatedLyrics?.content || generatedLyrics?.text);
    generateAIMelodyMutation.mutate({
      scale: songOptions.key,
      style: songOptions.genre,
      complexity: 5,
      lyrics,
      beatData: generatedBeat
    });
  };

  // Audio Playback Handlers
  const playGeneratedSong = async () => {
    console.log('🎵 Play button clicked, generatedSong exists:', !!generatedSong);
    console.log('🎧 Audio initialized:', isInitialized);
    
    if (!generatedSong) {
      toast({
        title: "No Song Available",
        description: "Generate a song first before playing",
        variant: "destructive"
      });
      return;
    }

    // Force audio initialization if needed
    if (!isInitialized) {
      console.log('⚡ Initializing audio engine...');
      try {
        await initialize();
        console.log('✅ Audio engine initialized successfully');
      } catch (error) {
        console.error('❌ Audio initialization failed:', error);
        toast({
          title: "Audio Setup Failed",
          description: "Could not initialize audio. Try clicking again.",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      console.log('🎵 Playing generated song...', generatedSong);
      console.log('🎵 Song structure check:', {
        hasBeat: !!generatedSong.beat,
        hasDrums: !!generatedSong.beat?.drums,
        drumKeys: generatedSong.beat?.drums ? Object.keys(generatedSong.beat.drums) : 'none',
        songKeys: Object.keys(generatedSong),
        hasAudioUrl: !!(generatedSong.audio_url || generatedSong.audioUrl || generatedSong.url)
      });
      
      // First check if there's an actual audio URL from AI generation (Suno, MusicGen, etc.)
      const audioUrl = generatedSong.audio_url || generatedSong.audioUrl || generatedSong.url;
      if (audioUrl) {
        console.log('🎵 Found audio URL, playing actual audio file:', audioUrl);
        const audio = new Audio(audioUrl);
        audio.crossOrigin = "anonymous";
        audio.volume = 0.8;
        
        audio.addEventListener('loadedmetadata', () => {
          console.log(`✅ Audio loaded: duration ${audio.duration}s`);
        });
        
        audio.addEventListener('error', (e) => {
          console.error('❌ Audio playback error:', e);
          toast({
            title: "Playback Error",
            description: "Could not play the generated audio. Falling back to drum pattern.",
            variant: "destructive"
          });
        });
        
        await audio.play();
        toast({
          title: "🎵 Playing AI Generated Song",
          description: "Full audio track from AI is now playing!"
        });
        return;
      }
      
      // Check for different song structure formats (fallback to drum patterns)
      let drumsFound = false;
      let drumPatterns = null;
      let songBpm = 120;
      
      // Check for beat.drums structure
      if (generatedSong.beat?.drums) {
        drumsFound = true;
        drumPatterns = generatedSong.beat.drums;
        songBpm = generatedSong.beat.bpm || 120;
        console.log('🥁 Found drums in beat.drums structure');
      }
      // Check for direct drums property
      else if (generatedSong.drums) {
        drumsFound = true;
        drumPatterns = generatedSong.drums;
        console.log('🥁 Found drums in direct drums structure');
      }
      // If no drums found, create a simple default pattern to blend with the song
      if (!drumsFound) {
        console.log('🎵 No drum patterns found, creating default pattern to blend with melody');
        drumsFound = true;
        // Create a simple 4/4 beat pattern
        drumPatterns = {
          kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
          snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
          hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        };
      }
      
      // Get BPM from various locations
      songBpm = generatedSong.beat?.bpm || 
                generatedSong.metadata?.bpm || 
                generatedSong.songStructure?.intro?.bpm || 
                120;
      
      if (drumsFound && drumPatterns) {
        const drums = drumPatterns;
        const bpm = songBpm;
        
        // Calculate step duration based on BPM (16th notes)
        const stepDuration = (60 / bpm) / 4;
        
        // Play both drums and melody together
        console.log('🎵 Starting blended playback of drums and melody');
        
        // Start drum pattern
        let currentStep = 0;
        const playDrumPattern = () => {
          if (currentStep >= 16) {
            currentStep = 0; // Loop the pattern
          }
          
          // Play each drum sound if active at current step
          if (drums.kick?.[currentStep]) playDrum('kick', 0.8);
          if (drums.snare?.[currentStep]) playDrum('snare', 0.7);
          if (drums.hihat?.[currentStep]) playDrum('hihat', 0.4);
          if (drums.bass?.[currentStep]) playDrum('tom', 0.6);
          if (drums.perc?.[currentStep]) playDrum('clap', 0.5);
          
          currentStep++;
        };
        
        // Create a COMPLETE SONG with beat that matches the lyrics using synchronized composer
        console.log('🎵 Creating COMPLETE SONG with vocals and beat that matches the lyrics');

        try {
          await playDrum('kick', 0.8);
          console.log('✅ Test kick sound played successfully');
          
          toast({
            title: "Playing Test Sound",
            description: "No drum pattern found, played test kick instead"
          });
        } catch (audioError: any) {
          console.error('❌ Test sound failed:', audioError);
          toast({
            title: "Audio Error",
            description: "Could not play any audio. Check browser permissions.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error playing song:', error);
      toast({
        title: "Playback Error",
        description: "Failed to play the generated song",
        variant: "destructive"
      });
    }
  };

  const playGeneratedBeat = async () => {
    if (!generatedBeat || !isInitialized) {
      if (!isInitialized) {
        await initialize();
      }
      return;
    }

    try {
      console.log('🥁 Playing generated beat...', generatedBeat);
      
      const beatData = generatedBeat.fullBeat || generatedBeat;
      if (beatData?.drums) {
        const drums = beatData.drums;
        const bpm = generatedBeat.bpm || beatData.bpm || 120;
        
        // Calculate step duration based on BPM (16th notes)
        const stepDuration = (60 / bpm) / 4;
        
        // Play drum pattern
        let currentStep = 0;
        const playPattern = () => {
          if (currentStep >= 16) {
            currentStep = 0; // Loop the pattern
          }
          
          // Play each drum sound if active at current step
          if (drums.kick?.[currentStep]) playDrum('kick', 0.8);
          if (drums.snare?.[currentStep]) playDrum('snare', 0.7);
          if (drums.hihat?.[currentStep]) playDrum('hihat', 0.4);
          if (drums.bass?.[currentStep]) playDrum('tom', 0.6);
          if (drums.perc?.[currentStep]) playDrum('clap', 0.5);
          
          currentStep++;
        };
        
        // Start playing pattern
        const patternInterval = setInterval(playPattern, stepDuration * 1000);
        
        // Stop after a reasonable duration (4 bars = 16 steps)
        setTimeout(() => {
          clearInterval(patternInterval);
        }, stepDuration * 1000 * 16);
        
        toast({
          title: "Playing AI Beat",
          description: "Generated beat pattern is now playing!"
        });
      }
    } catch (error) {
      console.error('Error playing beat:', error);
      toast({
        title: "Playback Error",
        description: "Failed to play the generated beat",
        variant: "destructive"
      });
    }
  };

  // Download Handler
  const downloadGeneratedSong = () => {
    if (!generatedSong) {
      toast({
        title: "No Song to Download",
        description: "Generate a song first before downloading",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create downloadable JSON file with song data
      const songData = {
        metadata: {
          title: generatedSong.metadata?.title || "AI Generated Song",
          genre: songOptions.genre,
          bpm: generatedSong.metadata?.bpm || songOptions.bpm,
          key: songOptions.key,
          duration: generatedSong.metadata?.duration || songOptions.duration,
          generatedAt: new Date().toISOString()
        },
        song: generatedSong,
        lyrics: generatedLyrics,
        beat: generatedBeat
      };

      const blob = new Blob([JSON.stringify(songData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${songData.metadata.title.replace(/\s+/g, '_')}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Song Downloaded",
        description: "Your AI-generated song data has been saved"
      });
    } catch (error) {
      console.error('❌ Download error:', error);
      toast({
        title: "Download Failed",
        description: "Could not download the song",
        variant: "destructive"
      });
    }
  };

  // Legacy handler for backward compatibility
  const generateBeatFromLyrics = () => {
    if (!generatedLyrics) return;
    
    const lyricsText = generatedLyrics.content || generatedLyrics.text || '';
    generateBeatFromLyricsMutation.mutate({
      lyrics: lyricsText,
      options: {
        style: songOptions.style,
        genre: lyricsGenre,
        energy: lyricsMood
      }
    });
  };

  const getLyricHelper = (word: string, type: string) => {
    const context = generatedLyrics?.content || lyricsTheme;
    lyricHelperMutation.mutate({
      word,
      type,
      context
    });
  };

  // Generate complete full-length song from lyrics - Professional studio feature
  const generateFullSongFromLyrics = () => {
    if (!generatedLyrics) {
      toast({
        title: "No Lyrics Found",
        description: "Generate lyrics first to create a full song",
        variant: "destructive",
      });
      return;
    }

    const lyricsText = generatedLyrics.content || generatedLyrics.text || '';
    
    fullSongGenerationMutation.mutate({
      prompt: `Create a complete professional song with these lyrics: "${lyricsText.slice(0, 500)}..."`,
      options: {
        genre: lyricsGenre,
        mood: lyricsMood,
        duration: 240, // 4 minutes - full length song
        style: songOptions.style,
        instruments: songOptions.instruments,
        vocals: true,
        bpm: songOptions.bpm,
        key: songOptions.key
      }
    });
  };

  // Play the generated rap instrumental using full arrangement - legacy version
  const playRapInstrumentalLegacy = async () => {
    if (!isInitialized) {
      await initialize();
    }

    const beatData = generatedBeat || generateBeatFromLyricsMutation.data?.beat;
    if (!beatData) {
      toast({
        title: "No Instrumental",
        description: "Generate a rap instrumental first to play it",
        variant: "destructive",
      });
      return;
    }

    console.log("🎵 AI-Generated Beat Data Structure:", beatData);

    // Check if it's a full instrumental or just drums
    const isFullInstrumental = beatData.songStructure && beatData.bassLine && beatData.melody;
    
    // Extract drums from various possible structures
    let drums = beatData.drums || beatData.beatPattern || beatData.pattern || beatData;
    
    // Handle nested response structures from AI
    if (beatData.beat && typeof beatData.beat === 'object') {
      drums = beatData.beat.drums || beatData.beat.beatPattern || beatData.beat.pattern || beatData.beat;
    }
    
    // Handle beatPattern directly in response
    if (beatData.beatPattern && typeof beatData.beatPattern === 'object') {
      drums = beatData.beatPattern;
    }
    
    const bpm = generateBeatFromLyricsMutation.data?.bpm || beatData.bpm || beatData.beat?.bpm || 120;
    const stepDuration = (60 / bpm) * (1000 / 4); // Duration per 16th note in ms

    console.log(`🎵 Playing ${isFullInstrumental ? 'full rap instrumental' : 'drum pattern'} - BPM: ${bpm}`);
    console.log("🥁 Raw drum pattern data:", drums);

    // Extract patterns with multiple fallback strategies
    let kick = drums?.kick || drums?.kickPattern || [];
    let snare = drums?.snare || drums?.snarePattern || [];
    let hihat = drums?.hihat || drums?.hihatPattern || drums?.hihats || [];
    let bass = drums?.bass || drums?.bassPattern || [];
    
    // Convert string patterns to boolean arrays if needed
    if (typeof kick === 'string') kick = kick.split('').map(c => c === '1' || c === 'x');
    if (typeof snare === 'string') snare = snare.split('').map(c => c === '1' || c === 'x');
    if (typeof hihat === 'string') hihat = hihat.split('').map(c => c === '1' || c === 'x');
    if (typeof bass === 'string') bass = bass.split('').map(c => c === '1' || c === 'x');
    
    // Ensure arrays are boolean/number types
    kick = Array.isArray(kick) ? kick : [];
    snare = Array.isArray(snare) ? snare : [];
    hihat = Array.isArray(hihat) ? hihat : [];
    bass = Array.isArray(bass) ? bass : [];
    
    console.log("🎯 Processed individual patterns:", { 
      kick: kick.slice(0, 4) + `... (${kick.length} steps)`, 
      snare: snare.slice(0, 4) + `... (${snare.length} steps)`, 
      hihat: hihat.slice(0, 4) + `... (${hihat.length} steps)`,
      bass: bass.slice(0, 4) + `... (${bass.length} steps)`
    });
    
    const totalSteps = Math.max(kick?.length || 0, snare?.length || 0, hihat?.length || 0, bass?.length || 0, 16);
    console.log(`📏 Total steps in pattern: ${totalSteps}`);
    
    if (totalSteps === 0 || (kick.length === 0 && snare.length === 0 && hihat.length === 0)) {
      console.warn("❌ No valid drum patterns found! Creating fallback pattern...");
      
      // Create a basic fallback pattern if AI data is empty
      kick = [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false];
      snare = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false];
      hihat = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false];
      
      console.log("🛠️ Using fallback drum pattern");
      toast({
        title: "Using Fallback Pattern",
        description: "AI data was incomplete, playing basic drum pattern",
        variant: "default",
      });
    }
    
    // Play for 4 measures (64 steps) for full instrumental experience
    const measures = isFullInstrumental ? 4 : 2;
    console.log(`🔄 Playing ${measures} measures...`);
    
    for (let measure = 0; measure < measures; measure++) {
      for (let step = 0; step < totalSteps; step++) {
        setTimeout(() => {
          const currentStep = step;
          console.log(`⏰ Step ${measure}.${currentStep}: checking patterns...`);
          
          if (kick && (kick[currentStep] === 1 || kick[currentStep] === true)) {
            console.log(`🥁 Playing KICK at step ${currentStep}`);
            playDrum('kick');
          }
          
          if (snare && (snare[currentStep] === 1 || snare[currentStep] === true)) {
            console.log(`🥁 Playing SNARE at step ${currentStep}`);
            playDrum('snare');
          }
          
          if (hihat && (hihat[currentStep] === 1 || hihat[currentStep] === true)) {
            console.log(`🥁 Playing HIHAT at step ${currentStep}`);
            playDrum('hihat');
          }
          
          // Add bass pattern for full instrumentals
          if (bass && (bass[currentStep] === 1 || bass[currentStep] === true)) {
            console.log(`🎸 Playing BASS at step ${currentStep}`);
            playDrum('tom'); // Play bass sound if available
          }
        }, (measure * totalSteps * stepDuration) + (step * stepDuration));
      }
    }

    toast({
      title: isFullInstrumental ? "Rap Instrumental Playing 🎵" : "Beat Pattern Playing 🥁",
      description: isFullInstrumental ? "Complete instrumental arrangement with bass, melody & drums" : "Drum pattern preview",
    });
  };

  const genres = [
    'pop', 'rock', 'hip-hop', 'electronic', 'classical', 'jazz', 'blues', 'country',
    'reggae', 'funk', 'soul', 'r&b', 'folk', 'indie', 'alternative', 'metal',
    'ambient', 'house', 'techno', 'trance', 'dubstep', 'latin', 'world', 'experimental'
  ];

  const moods = [
    'uplifting', 'energetic', 'melancholic', 'romantic', 'aggressive', 'peaceful',
    'mysterious', 'playful', 'dark', 'bright', 'emotional', 'calm', 'intense', 'dreamy'
  ];

  const keys = [
    'C Major', 'D Major', 'E Major', 'F Major', 'G Major', 'A Major', 'B Major',
    'C Minor', 'D Minor', 'E Minor', 'F Minor', 'G Minor', 'A Minor', 'B Minor'
  ];

  return (
    <div className="space-y-6 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Star className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Professional Studio
          </h2>
          <Star className="w-6 h-6 text-yellow-500" />
        </div>
        <p className="text-sm text-gray-400 mb-3">
          AI-Powered Beat Generation • Electronic Music Creation • Code-Music Translation
        </p>
        <div className="flex justify-center gap-3 mb-4">
          <Link href="/music-studio">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              🎵 Multi-Track Studio
            </Button>
          </Link>
          <Link href="/melody-composer">
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
              🎹 Plugin Studio
            </Button>
          </Link>
        </div>
        <div className="flex justify-center gap-2 flex-wrap">
          <Badge variant="secondary" className="bg-purple-900 text-purple-200 text-xs">Web Audio API</Badge>
          <Badge variant="secondary" className="bg-blue-900 text-blue-200 text-xs">Electronic Beats</Badge>
          <Badge variant="secondary" className="bg-green-900 text-green-200 text-xs">Mixing Controls</Badge>
          <Badge variant="secondary" className="bg-orange-900 text-orange-200 text-xs">Code Translation</Badge>
        </div>
      </div>



      {/* Professional Audio Generation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="full-song" className="text-xs">
            <Music className="w-3 h-3 mr-1" />
            Full Song
          </TabsTrigger>
          <TabsTrigger value="code-music" className="text-xs">
            <Zap className="w-3 h-3 mr-1" />
            Code↔Music
          </TabsTrigger>
          <TabsTrigger value="add-vocals" className="text-xs">
            <Mic className="w-3 h-3 mr-1" />
            Add Vocals
          </TabsTrigger>
          <TabsTrigger value="genre-blend" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            Genre Mix
          </TabsTrigger>
          <TabsTrigger value="lyrics" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            Pro Lyrics
          </TabsTrigger>
        </TabsList>

        {/* Full Song Generation */}
        <TabsContent value="full-song" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Music className="w-5 h-5" />
                Generate Studio-Quality Song (Up to 8 Minutes)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="song-prompt">Creative Prompt</Label>
                <Textarea
                  id="song-prompt"
                  placeholder="Describe your song idea... (e.g., 'An uplifting pop anthem about overcoming challenges')"
                  value={songPrompt}
                  onChange={(e) => setSongPrompt(e.target.value)}
                  className="mt-1"
                  rows={3}
                  data-testid="input-song-prompt"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Genre</Label>
                  <Select value={songOptions.genre} onValueChange={(value) => setSongOptions({...songOptions, genre: value})}>
                    <SelectTrigger data-testid="select-genre" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mood</Label>
                  <Select value={songOptions.mood} onValueChange={(value) => setSongOptions({...songOptions, mood: value})}>
                    <SelectTrigger data-testid="select-mood" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {moods.map(mood => (
                        <SelectItem key={mood} value={mood}>{mood}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Key</Label>
                  <Select value={songOptions.key} onValueChange={(value) => setSongOptions({...songOptions, key: value})}>
                    <SelectTrigger data-testid="select-key" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {keys.map(key => (
                        <SelectItem key={key} value={key}>{key}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Duration: {songOptions.duration}s ({Math.floor(songOptions.duration/60)}:{String(songOptions.duration%60).padStart(2,'0')})</Label>
                  <Slider
                    value={[songOptions.duration]}
                    onValueChange={([value]) => setSongOptions({...songOptions, duration: value})}
                    min={30}
                    max={480}
                    step={30}
                    className="mt-2"
                    data-testid="slider-duration"
                  />
                </div>

                <div>
                  <Label>BPM: {songOptions.bpm}</Label>
                  <Slider
                    value={[songOptions.bpm]}
                    onValueChange={([value]) => setSongOptions({...songOptions, bpm: value})}
                    min={60}
                    max={180}
                    step={5}
                    className="mt-2"
                    data-testid="slider-bpm"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="vocals"
                  checked={songOptions.vocals}
                  onCheckedChange={(checked) => setSongOptions({...songOptions, vocals: checked})}
                  data-testid="switch-vocals"
                />
                <Label htmlFor="vocals">Include Vocals</Label>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleFullSongGeneration}
                  disabled={!songPrompt && !vocalOptions.lyrics || generateFullSongMutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  data-testid="button-generate-song"
                >
                  {generateFullSongMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Generating AI Song with Beat & Melody...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4" />
                      Generate Complete AI Song
                    </div>
                  )}
                </Button>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleAIBeatGeneration}
                    disabled={generateAIBeatMutation.isPending}
                    variant="outline"
                    className="border-purple-500 text-purple-300 hover:bg-purple-900"
                    data-testid="button-generate-beat"
                  >
                    {generateAIBeatMutation.isPending ? (
                      <div className="flex items-center gap-1">
                        <div className="animate-spin w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full" />
                        AI Beat
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        AI Beat Only
                      </div>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleAIMelodyGeneration}
                    disabled={generateAIMelodyMutation.isPending}
                    variant="outline"
                    className="border-blue-500 text-blue-300 hover:bg-blue-900"
                    data-testid="button-generate-melody"
                  >
                    {generateAIMelodyMutation.isPending ? (
                      <div className="flex items-center gap-1">
                        <div className="animate-spin w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full" />
                        AI Melody
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Music className="w-3 h-3" />
                        AI Melody Only
                      </div>
                    )}
                  </Button>
                </div>
              </div>

              {/* Show AI Beat Results */}
              {generatedBeat && (
                <Card className="mt-4 bg-purple-900/20 border-purple-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-purple-400" />
                      <span className="text-purple-400 font-medium">AI Beat Generated!</span>
                    </div>
                    <div className="text-sm text-gray-300">
                      <p><strong>Style:</strong> {generatedBeat.fullBeat?.metadata?.style || 'AI Generated'}</p>
                      <p><strong>BPM:</strong> {generatedBeat.bpm || generatedBeat.fullBeat?.bpm || 'Unknown'}</p>
                      <p><strong>AI Generated:</strong> {generatedBeat.aiGenerated ? 'Yes' : 'No'}</p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={playGeneratedBeat}
                        data-testid="button-play-beat"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Preview Beat
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(generatedSong || (generatedSong?.song && generatedSong.success)) && (
                <Card className="mt-4 bg-green-900/20 border-green-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-medium">Song Generated Successfully!</span>
                    </div>
                    <div className="text-sm text-gray-300">
                      <p><strong>Title:</strong> {generatedSong.title || 'Professional Composition'}</p>
                      <p><strong>Duration:</strong> {generatedSong.metadata?.duration || songOptions.duration} seconds</p>
                      <p><strong>Quality:</strong> Studio Professional (44.1kHz equivalent)</p>
                      <p><strong>Genre:</strong> {songOptions.genre} • <strong>Mood:</strong> {songOptions.mood}</p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={playGeneratedSong}
                        data-testid="button-play-song"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Play
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <PianoRollPreview generatedSong={generatedSong} />
              <ModularChordProgression
                progression={chordProgression}
                onAISuggest={handleAISuggestChordProgression}
                onPlay={handlePlayChordProgression}
                onProgressionChange={setChordProgression}
              />
              <ModularPianoRoll notes={pianoRollNotes} onAISuggest={handleAISuggestPianoRoll} onNotesChange={setPianoRollNotes} />
              <ModularDrumMachine pattern={drumPattern} onAISuggest={handleAISuggestDrumPattern} onPatternChange={setDrumPattern} />

            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Vocals Tab */}
        {/* Code-Music Translation Tab */}
        <TabsContent value="code-music" className="space-y-4">
          <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                Code ↔ Music Translation
              </CardTitle>
              <p className="text-sm text-gray-400">
                Bidirectional translation between code and music using AI
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cloud Status Display */}
              {cloudStatus && (
                <div className={`p-3 rounded-lg border ${
                  cloudStatus.status === 'connected' 
                    ? 'bg-green-900/20 border-green-500/30 text-green-400'
                    : cloudStatus.status === 'not_configured'
                    ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'
                    : 'bg-red-900/20 border-red-500/30 text-red-400'
                }`}>
                  <div className="text-sm font-medium">
                    {cloudStatus.status === 'connected' && '✅ Cloud MusicGen Connected'}
                    {cloudStatus.status === 'not_configured' && '⚙️ Cloud MusicGen Not Configured'}
                    {cloudStatus.status !== 'connected' && cloudStatus.status !== 'not_configured' && '❌ Cloud MusicGen Offline'}
                  </div>
                  <div className="text-xs mt-1">
                    {cloudStatus.message || 
                     (cloudStatus.status === 'connected' ? 'Professional .wav generation available' : 
                      'AI analysis available, deploy cloud for professional generation')}
                  </div>
                </div>
              )}

              {/* Code Input */}
              <div>
                <Label>Code Input</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="java">Java</SelectItem>
                        <SelectItem value="cpp">C++</SelectItem>
                        <SelectItem value="rust">Rust</SelectItem>
                        <SelectItem value="go">Go</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={musicStyle} onValueChange={setMusicStyle}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="algorithmic">Algorithmic</SelectItem>
                        <SelectItem value="ambient">Ambient</SelectItem>
                        <SelectItem value="electronic">Electronic</SelectItem>
                        <SelectItem value="classical">Classical</SelectItem>
                        <SelectItem value="jazz">Jazz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <textarea
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="Paste your code here..."
                    className="w-full h-32 p-3 bg-black/50 border border-gray-600 rounded-lg text-white font-mono text-sm"
                  />
                </div>
              </div>

              {/* Translation Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  onClick={() => codeToMusicMutation.mutate({
                    code: codeInput,
                    language: selectedLanguage,
                    musicStyle
                  })}
                  disabled={!codeInput || codeToMusicMutation.isPending}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {codeToMusicMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Translating...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4" />
                      Code → Music
                    </div>
                  )}
                </Button>

                <Button
                  onClick={async () => {
                    try {
                      const response = await apiRequest('POST', '/api/code-to-music', {
                        code: codeInput,
                        language: selectedLanguage
                      });
                      
                      toast({
                        title: "Test Simulation Ready",
                        description: "Deploy cloud MusicGen for full testing"
                      });
                    } catch (error: any) {
                      toast({
                        title: "Test Failed",
                        description: error.message,
                        variant: "destructive"
                      });
                    }
                  }}
                  disabled={!codeInput}
                  variant="outline"
                  className="border-green-500 text-green-300 hover:bg-green-900"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Bidirectional Test
                  </div>
                </Button>
              </div>

              {/* Setup Guide Link */}
              {cloudStatus?.status === 'not_configured' && (
                <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <div className="text-blue-400 text-sm font-medium mb-1">
                    Ready for Professional Generation
                  </div>
                  <div className="text-xs text-blue-300">
                    Your system supports code-music translation. Deploy cloud MusicGen for professional .wav generation.
                    See <code>MUSICGEN_SETUP_COMPLETE.md</code> for setup instructions.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add-vocals" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mic className="w-5 h-5" />
                Add Professional Vocals to Instrumental
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="instrumental-data">Instrumental Track Data</Label>
                <Textarea
                  id="instrumental-data"
                  placeholder="Paste your instrumental track data or upload file..."
                  value={instrumentalData}
                  onChange={(e) => setInstrumentalData(e.target.value)}
                  className="mt-1"
                  rows={3}
                  data-testid="input-instrumental-data"
                />
              </div>

              <div>
                <Label htmlFor="lyrics-input">Custom Lyrics (Optional)</Label>
                <Textarea
                  id="lyrics-input"
                  placeholder="Enter custom lyrics or leave blank for AI-generated lyrics..."
                  value={vocalOptions.lyrics}
                  onChange={(e) => setVocalOptions({...vocalOptions, lyrics: e.target.value})}
                  className="mt-1"
                  rows={3}
                  data-testid="input-custom-lyrics"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="melody-vocals"
                    checked={vocalOptions.melody}
                    onCheckedChange={(checked) => setVocalOptions({...vocalOptions, melody: checked})}
                    data-testid="switch-melody"
                  />
                  <Label htmlFor="melody-vocals" className="text-sm">Lead Melody</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="harmonies"
                    checked={vocalOptions.harmonies}
                    onCheckedChange={(checked) => setVocalOptions({...vocalOptions, harmonies: checked})}
                    data-testid="switch-harmonies"
                  />
                  <Label htmlFor="harmonies" className="text-sm">Harmonies</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="adlibs"
                    checked={vocalOptions.adLibs}
                    onCheckedChange={(checked) => setVocalOptions({...vocalOptions, adLibs: checked})}
                    data-testid="switch-adlibs"
                  />
                  <Label htmlFor="adlibs" className="text-sm">Ad-Libs</Label>
                </div>
              </div>

              <Button
                onClick={() => addVocalsMutation.mutate({ 
                  instrumentalData: JSON.parse(instrumentalData || '{}'), 
                  vocalOptions 
                })}
                disabled={!instrumentalData || addVocalsMutation.isPending}
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                data-testid="button-add-vocals"
              >
                {addVocalsMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Adding Professional Vocals...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    Add Professional Vocals
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Professional Lyrics Tab */}
        <TabsContent value="lyrics" className="space-y-4">
          {/* SUNO-LEVEL ADVANCED FEATURES - Always Visible */}
          <Card className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="w-5 h-5 text-yellow-400" />
                Professional Advanced Features
              </CardTitle>
              <p className="text-sm text-gray-400">Generate beats from lyrics and get real-time lyric assistance</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="advanced-lyrics">Enter Lyrics or Word for Analysis</Label>
                <Input
                  id="advanced-lyrics"
                  placeholder="Enter lyrics to generate beat OR word for rhymes/synonyms..."
                  value={helperWord}
                  onChange={(e) => setHelperWord(e.target.value)}
                  className="mt-1"
                  data-testid="input-advanced-lyrics"
                />
              </div>
              
              {/* PRIMARY ACTION - Full Song Generation */}
              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 mb-4"
                onClick={generateFullSongFromLyrics}
                disabled={!generatedLyrics || fullSongGenerationMutation.isPending}
                data-testid="button-generate-full-song-from-lyrics"
              >
                {fullSongGenerationMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Generating Full Professional Song...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    <span>Generate Complete Song with Melody & Vocals (Professional)</span>
                  </div>
                )}
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="border-purple-500/30 hover:bg-purple-900/20"
                  onClick={() => {
                    if (helperWord) {
                      generateBeatFromLyricsMutation.mutate({
                        lyrics: helperWord,
                        options: { style: 'hip-hop', genre: 'rap', energy: lyricsMood }
                      });
                    }
                  }}
                  disabled={!helperWord || generateBeatFromLyricsMutation.isPending}
                  data-testid="button-generate-beat-from-lyrics"
                >
                  {generateBeatFromLyricsMutation.isPending ? (
                    <div className="flex items-center gap-1">
                      <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                      <span>Analyzing...</span>
                    </div>
                  ) : (
                    <>
                      <Music className="w-3 h-3 mr-1" />
                      Generate Rap Instrumental
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  className="border-blue-500/30 hover:bg-blue-900/20"
                  onClick={() => {
                    if (helperWord) {
                      getLyricHelper(helperWord, 'rhymes');
                    }
                  }}
                  disabled={!helperWord || lyricHelperMutation.isPending}
                  data-testid="button-find-rhymes"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Find Rhymes
                </Button>
                
                <Button
                  variant="outline"
                  className="border-green-500/30 hover:bg-green-900/20"
                  onClick={() => {
                    if (helperWord) {
                      getLyricHelper(helperWord, 'synonyms');
                    }
                  }}
                  disabled={!helperWord || lyricHelperMutation.isPending}
                  data-testid="button-find-synonyms"
                >
                  <Users className="w-3 h-3 mr-1" />
                  Find Synonyms
                </Button>
              </div>
              
              {/* Full Song Generation Results */}
              {fullSongGenerationMutation.isSuccess && generatedSong && (
                <Card className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Music className="w-5 h-5 text-purple-400" />
                      <span className="text-purple-400 font-medium text-lg">Professional Song Generated!</span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-4">
                      <div className="bg-purple-900/30 p-2 rounded">
                        <div className="text-purple-300 font-medium">Duration</div>
                        <div className="text-white">{generatedSong.metadata?.duration || 240}s</div>
                      </div>
                      <div className="bg-blue-900/30 p-2 rounded">
                        <div className="text-blue-300 font-medium">Quality</div>
                        <div className="text-white">Studio (44.1kHz)</div>
                      </div>
                      <div className="bg-green-900/30 p-2 rounded">
                        <div className="text-green-300 font-medium">Instruments</div>
                        <div className="text-white">{generatedSong.songStructure ? Object.keys(generatedSong.songStructure).length : 'Full Band'}</div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="text-sm text-gray-300">
                        <strong>Song Structure:</strong> {generatedSong.songStructure ? 
                          Object.keys(generatedSong.songStructure).join(' → ').replace(/([A-Z])/g, ' $1') : 
                          'Intro → Verse → Chorus → Verse → Chorus → Bridge → Final Chorus → Outro'}
                      </div>
                      <div className="text-sm text-gray-300">
                        <strong>Chord Progression:</strong> {generatedSong.chordProgression?.join(' - ') || 'Complex Multi-Section Progressions'}
                      </div>
                      <div className="text-sm text-gray-300">
                        <strong>Vocals:</strong> {generatedSong.vocals ? 'Lead Vocals + Harmonies + Ad-libs' : 'Instrumental'}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={() => playGeneratedSong()}
                        disabled={!generatedSong}
                        data-testid="button-play-full-song"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Play Complete Song
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-green-500/30 hover:bg-green-900/20"
                        onClick={async () => {
                          console.log('🔧 Test button clicked, isInitialized:', isInitialized);
                          try {
                            if (!isInitialized) {
                              console.log('🔧 Initializing audio...');
                              await initialize();
                              console.log('🔧 Audio initialized successfully');
                            }
                            console.log('🔧 Playing test kick...');
                            playDrum('kick', 0.8);
                            console.log('🔧 Test kick command sent');
                            toast({
                              title: "Audio Test",
                              description: "Test kick drum sound played"
                            });
                          } catch (error: any) {
                            console.error('🔧 Test button error:', error);
                            toast({
                              title: "Audio Test Failed",
                              description: `Error: ${error?.message || 'Unknown error'}`,
                              variant: "destructive"
                            });
                          }
                        }}
                        data-testid="button-test-audio"
                      >
                        <Volume2 className="w-3 h-3 mr-1" />
                        Test Audio
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-purple-500/30"
                        onClick={() => downloadGeneratedSong()}
                        disabled={!generatedSong}
                        data-testid="button-download-song"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download Song Data
                      </Button>
                    </div>
                    

                  </CardContent>
                </Card>
              )}

              {/* Beat Analysis Results */}
              {generateBeatFromLyricsMutation.isSuccess && (
                <Card className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Music className="w-5 h-5 text-purple-400" />
                      <span className="text-purple-400 font-medium text-lg">
                        {generateBeatFromLyricsMutation.data?.isFullInstrumental ? 'Full Rap Instrumental Created!' : 'Beat Pattern Generated!'}
                      </span>
                      {generateBeatFromLyricsMutation.data?.rapReady && (
                        <Badge className="bg-green-600 text-white">RAP READY</Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-300 mb-3">
                      <div className="bg-gray-800/50 p-2 rounded">
                        <strong>BPM:</strong> {generateBeatFromLyricsMutation.data?.bpm || generatedBeat?.bpm || 'N/A'}
                      </div>
                      <div className="bg-gray-800/50 p-2 rounded">
                        <strong>Key:</strong> {generateBeatFromLyricsMutation.data?.key || 'C Minor'}
                      </div>
                    </div>

                    {generateBeatFromLyricsMutation.data?.isFullInstrumental && (
                      <div className="space-y-2 mb-3">
                        <div className="text-sm">
                          <strong className="text-green-400">Full Arrangement Includes:</strong>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>✓ Drum Kit (Kick, Snare, Hi-Hat)</div>
                          <div>✓ Bass Line (808s & Sub Bass)</div>
                          <div>✓ Melodic Elements (Piano, Strings)</div>
                          <div>✓ Chord Progression</div>
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          <strong>Structure:</strong> Intro → Verse → Hook → Verse → Bridge → Outro
                        </div>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-gray-400">
                      <strong>Analysis:</strong> {generateBeatFromLyricsMutation.data?.metadata?.syllableCount || 0} syllables analyzed across {generateBeatFromLyricsMutation.data?.metadata?.lineCount || 0} lines
                    </div>
                    
                    <Button 
                      size="sm" 
                      className="mt-3 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      onClick={() => playGeneratedBeat()}
                      data-testid="button-play-rap-instrumental"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {generateBeatFromLyricsMutation.data?.isFullInstrumental ? 'Play Rap Instrumental' : 'Play Beat Pattern'}
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              {lyricHelperMutation.isSuccess && (
                <Card className="bg-blue-900/20 border-blue-500/30">
                  <CardContent className="pt-3">
                    <div className="text-blue-400 font-medium mb-2">Lyric Helper Results:</div>
                    <div className="space-y-1">
                      {lyricHelperMutation.data?.helper?.suggestions?.slice(0, 6).map((suggestion: string, index: number) => (
                        <div key={index} className="text-gray-300 text-sm">• {suggestion}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                ReMi-Level Lyric Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="lyrics-theme">Song Theme</Label>
                <Input
                  id="lyrics-theme"
                  placeholder="e.g., 'Overcoming adversity', 'Love and loss', 'Innovation and technology'"
                  value={lyricsTheme}
                  onChange={(e) => setLyricsTheme(e.target.value)}
                  className="mt-1"
                  data-testid="input-lyrics-theme"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Genre</Label>
                  <Select value={lyricsGenre} onValueChange={setLyricsGenre}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mood</Label>
                  <Select value={lyricsMood} onValueChange={setLyricsMood}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {moods.map(mood => (
                        <SelectItem key={mood} value={mood}>{mood}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={() => generateLyricsMutation.mutate({ 
                  theme: lyricsTheme,
                  genre: lyricsGenre,
                  mood: lyricsMood,
                  songStructure: { sections: ["verse", "chorus", "verse", "chorus", "bridge", "chorus"] }
                })}
                disabled={!lyricsTheme || generateLyricsMutation.isPending}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                data-testid="button-generate-lyrics"
              >
                {generateLyricsMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Generating Professional Lyrics...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Generate ReMi-Level Lyrics
                  </div>
                )}
              </Button>

              {(generateLyricsMutation.isSuccess || generatedLyrics) && (
                <Card className="mt-4 bg-green-900/20 border-green-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-medium">Professional Lyrics Generated!</span>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg text-sm max-h-64 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-gray-200 font-mono">
                        {generatedLyrics?.content || generatedLyrics?.text || generateLyricsMutation.data?.lyrics?.content || 'Loading lyrics...'}
                      </pre>
                    </div>
                    
                    {/* SUNO-LEVEL ADVANCED FEATURES */}
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-yellow-400">
                        <Star className="w-4 h-4" />
                        <span className="font-medium">Professional Advanced Tools</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-purple-500/30 hover:bg-purple-900/20"
                          onClick={() => {
                            const lyricsText = generatedLyrics?.content || generatedLyrics?.text || generateLyricsMutation.data?.lyrics?.content || '';
                            console.log("🎵 Generating beat from lyrics:", lyricsText.slice(0, 100) + "...");
                            generateBeatFromLyricsMutation.mutate({
                              lyrics: lyricsText,
                              options: {
                                style: 'hip-hop',
                                genre: lyricsGenre,
                                energy: lyricsMood
                              }
                            });
                          }}
                          disabled={generateBeatFromLyricsMutation.isPending}
                          data-testid="button-generate-beat-from-lyrics"
                        >
                          <Music className="w-3 h-3 mr-1" />
                          {generateBeatFromLyricsMutation.isPending ? 'Generating...' : 'Generate Beat from Lyrics'}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-500/30 hover:bg-blue-900/20"
                          onClick={() => setShowLyricHelper(true)}
                          data-testid="button-lyric-helper"
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          Lyric Helper (Rhymes/Synonyms)
                        </Button>
                      </div>
                      
                      {/* Generated Beat from Lyrics Display */}
                      {(generateBeatFromLyricsMutation.isSuccess || generatedBeat) && (
                        <Card className="mt-3 bg-purple-900/20 border-purple-500/30">
                          <CardContent className="pt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Music className="w-4 h-4 text-purple-400" />
                              <span className="text-purple-400 font-medium">Beat Generated from Lyrics!</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                              <div><strong>BPM:</strong> {generateBeatFromLyricsMutation.data?.bpm || generatedBeat?.bpm || 'N/A'}</div>
                              <div><strong>Energy:</strong> {generateBeatFromLyricsMutation.data?.analysis?.energyLevel || generatedBeat?.analysis?.energyLevel || 'Medium'}</div>
                            </div>
                            <Button 
                              size="sm" 
                              className="mt-2 bg-purple-600 hover:bg-purple-700"
                              onClick={() => playGeneratedBeat()}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Play Beat Pattern
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lyric Helper Modal */}
              {showLyricHelper && (
                <Card className="mt-4 bg-blue-900/20 border-blue-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-400 font-medium">Real-time Lyric Helper</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setShowLyricHelper(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        ✕
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input
                          placeholder="Enter word for help..."
                          value={helperWord}
                          onChange={(e) => setHelperWord(e.target.value)}
                          data-testid="input-helper-word"
                        />
                        <Select value={helperType} onValueChange={setHelperType}>
                          <SelectTrigger data-testid="select-helper-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rhymes">Find Rhymes</SelectItem>
                            <SelectItem value="synonyms">Find Synonyms</SelectItem>
                            <SelectItem value="syllables">Syllable Match</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => getLyricHelper(helperWord, helperType)}
                        disabled={!helperWord || lyricHelperMutation.isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        data-testid="button-get-lyric-help"
                      >
                        {lyricHelperMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                            Getting Suggestions...
                          </div>
                        ) : (
                          `Get ${helperType === 'rhymes' ? 'Rhymes' : helperType === 'synonyms' ? 'Synonyms' : 'Syllable Matches'}`
                        )}
                      </Button>
                      
                      {/* Helper Results */}
                      {lyricHelper && (
                        <div className="bg-gray-800 p-3 rounded text-sm">
                          <div className="text-blue-400 font-medium mb-2">Suggestions for "{helperWord}":</div>
                          <div className="space-y-2">
                            {lyricHelper.suggestions?.map((suggestion: string, index: number) => (
                              <div key={index} className="text-gray-300">• {suggestion}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Genre Blending Tab */}
        <TabsContent value="genre-blend" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5" />
                Advanced Genre Fusion
              </CardTitle>
              <p className="text-sm text-gray-400">Blend multiple genres seamlessly with AI-powered fusion techniques</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Primary Genre</Label>
                  <Select defaultValue="electronic">
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronic">Electronic</SelectItem>
                      <SelectItem value="pop">Pop</SelectItem>
                      <SelectItem value="rock">Rock</SelectItem>
                      <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                      <SelectItem value="jazz">Jazz</SelectItem>
                      <SelectItem value="classical">Classical</SelectItem>
                      <SelectItem value="reggae">Reggae</SelectItem>
                      <SelectItem value="country">Country</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Secondary Genre</Label>
                  <Select defaultValue="jazz">
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jazz">Jazz</SelectItem>
                      <SelectItem value="classical">Classical</SelectItem>
                      <SelectItem value="ambient">Ambient</SelectItem>
                      <SelectItem value="world">World Music</SelectItem>
                      <SelectItem value="funk">Funk</SelectItem>
                      <SelectItem value="latin">Latin</SelectItem>
                      <SelectItem value="blues">Blues</SelectItem>
                      <SelectItem value="experimental">Experimental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Fusion Balance</Label>
                <div className="px-2 py-3">
                  <Slider
                    defaultValue={[50]}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Primary Dominant</span>
                    <span>Equal Balance</span>
                    <span>Secondary Dominant</span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="fusion-concept">Fusion Concept</Label>
                <Textarea
                  id="fusion-concept"
                  placeholder="e.g., 'Electronic-jazz fusion with sophisticated harmonies and digital textures, maintaining jazz improvisation over electronic beats'"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Genre Fusion
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} onUpgrade={startUpgrade} />
    </div>
  );
}
