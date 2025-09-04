import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Sparkles, Dice1, Play, Pause, Download, Volume2, 
  Loader2, Zap, Package, Headphones, Music, Plus, DatabaseIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { audioManager } from "@/lib/audio";
import { realisticAudio } from "@/lib/realisticAudio";
import { apiRequest } from "@/lib/queryClient";

interface GeneratedPack {
  id: string;
  title: string;
  description: string;
  bpm: number;
  key: string;
  genre: string;
  samples: {
    id: string;
    name: string;
    type: "loop" | "oneshot" | "midi";
    duration: number;
    url?: string;
    audioUrl?: string; // For MusicGen real audio files
    pattern?: any;
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> c9353c43027a4404e9beec386e86b63251b2385f
    aiData?: {
      notes?: string[];
      pattern?: number[];
      intensity?: number;
    };
<<<<<<< HEAD
=======
>>>>>>> 8485ec252f45f5cb49fc4fc23695ca7bb13fbcc6
=======
>>>>>>> c9353c43027a4404e9beec386e86b63251b2385f
  }[];
  metadata: {
    energy: number;
    mood: string;
    instruments: string[];
    tags: string[];
  };
}

const RANDOM_PROMPTS = [
  "Heavy synths and ambient guitars with a cyberpunk vibe, 100 BPM, C minor.",
  "Intense and suspenseful movie trailer score with big percussion hits and chilling strings.",
  "Dreamy lo-fi hip hop with vinyl crackle, warm pads, and mellow jazz chords, 85 BPM.",
  "Aggressive trap beats with 808s, dark atmosphere, and industrial elements, 140 BPM.",
  "Uplifting house music with piano melodies, vocal chops, and four-on-the-floor kicks, 128 BPM.",
  "Cinematic orchestral composition with epic brass, soaring strings, and thunderous timpani.",
  "Retro synthwave with nostalgic arpeggios, neon atmosphere, and driving basslines, 120 BPM.",
  "Experimental ambient textures with granular synthesis, field recordings, and evolving drones.",
  "Jazzy neo-soul with smooth Rhodes, walking basslines, and laid-back grooves, 90 BPM.",
  "Hard-hitting drill beats with sliding 808s, hi-hat rolls, and menacing melodies, 150 BPM."
];

export default function PackGenerator() {
  const [prompt, setPrompt] = useState("");
  const [packCount, setPackCount] = useState(4);
  const [generatedPacks, setGeneratedPacks] = useState<GeneratedPack[]>([]);
  const [aiProvider, setAiProvider] = useState("musicgen"); // Default to MusicGen for real audio
  const [playingPack, setPlayingPack] = useState<string | null>(null);
  const [previewVolume, setPreviewVolume] = useState([75]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (userPrompt: string) => {
      const response = await fetch("/api/packs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: userPrompt,
          count: packCount,
          aiProvider: aiProvider
        }),
      });

      if (!response.ok) {
        throw new Error(`Pack generation failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedPacks(data.packs || []);
      toast({
        title: "Sample packs generated!",
        description: `Created ${data.packs?.length || 0} unique sample packs`,
      });
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addToLibraryMutation = useMutation({
    mutationFn: async (pack: GeneratedPack) => {
      // Convert GeneratedPack format to database format
      const samplePackData = {
        name: pack.title,
        genre: pack.genre,
        mood: pack.metadata.mood,
        description: pack.description,
        generatedSamples: pack.samples.map(sample => ({
          name: sample.name,
          type: sample.type === "loop" ? "drums" : sample.type === "oneshot" ? "bass" : "melody",
          category: sample.type,
          audioData: generateAudioDataForSample(sample), // Generate realistic audio data
          description: `${sample.type} sample from ${pack.title}`,
          bpm: pack.bpm,
          key: pack.key,
          duration: sample.duration
        }))
      };

      const response = await fetch(`/api/sample-packs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(samplePackData),
      });

      if (!response.ok) {
        throw new Error(`Failed to add pack: ${response.statusText}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Pack Added to Library",
        description: "Sample pack successfully added to your Sample Library!",
      });
      // Invalidate samples query to refresh the library
      queryClient.invalidateQueries({ queryKey: ["/api/samples"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sample-packs"] });
    },
    onError: (error) => {
      toast({
        title: "❌ Failed to Add Pack",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate high-quality realistic audio data for samples
  const generateAudioDataForSample = (sample: any) => {
    const sampleRate = 44100;
    const duration = Math.min(sample.duration / 1000, 3); // Max 3 seconds, convert ms to seconds
    const numSamples = Math.floor(sampleRate * duration);
    
    // Create WAV header
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    
    // Generate professional-quality audio based on sample name and type
    const sampleName = (sample.name || '').toLowerCase();
    let offset = 44;
    
    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      let amplitude = 0;
      
      // Generate professional, musical audio based on sample type
      if (sampleName.includes('kick') || sampleName.includes('drum')) {
        // Professional kick drum with multiple layers
        const envelope = Math.exp(-time * 12); // Natural decay
        const pitchEnv = Math.exp(-time * 8); // Pitch envelope
        
        // Sub bass component (20-60Hz)
        const subBass = Math.sin(time * 2 * Math.PI * (40 + 20 * pitchEnv));
        
        // Body thump (60-120Hz)  
        const body = Math.sin(time * 2 * Math.PI * (80 + 40 * pitchEnv));
        
        // Click component for attack
        const clickEnv = Math.exp(-time * 50);
        const click = Math.sin(time * 2 * Math.PI * 2000) * clickEnv * 0.3;
        
        amplitude = (subBass * 0.8 + body * 0.6 + click) * envelope * 0.9;
                    
      } else if (sampleName.includes('snare')) {
        // Professional snare with tone and rattle
        const envelope = Math.exp(-time * 6);
        const toneEnv = Math.exp(-time * 4);
        
        // Fundamental tone (150-250Hz)
        const tone = Math.sin(time * 2 * Math.PI * 200) * toneEnv * 0.7;
        
        // Snare rattle (filtered noise)
        const rattle = (Math.random() * 2 - 1) * envelope * 0.6;
        
        // High frequency sizzle
        const sizzle = Math.sin(time * 2 * Math.PI * 8000) * envelope * 0.2;
        
        amplitude = (tone + rattle + sizzle) * 0.8;
        
      } else if (sampleName.includes('hihat') || sampleName.includes('hat')) {
        // Crisp hi-hat with natural metallic sound
        const envelope = Math.exp(-time * 20);
        
        // Multiple high frequencies for metallic sound
        const metal1 = Math.sin(time * 2 * Math.PI * 6000) * 0.4;
        const metal2 = Math.sin(time * 2 * Math.PI * 8000) * 0.3;
        const metal3 = Math.sin(time * 2 * Math.PI * 10000) * 0.2;
        const noise = (Math.random() * 2 - 1) * 0.5;
        
        amplitude = (metal1 + metal2 + metal3 + noise) * envelope * 0.6;
        
      } else if (sampleName.includes('bass') || sampleName.includes('808') || sample.type === 'oneshot') {
        // Deep, punchy bass with proper sub content
        const envelope = Math.exp(-time * 1.8);
        const pitchEnv = Math.exp(-time * 3);
        
        // Sub bass (30-50Hz)
        const sub = Math.sin(time * 2 * Math.PI * (35 + 15 * pitchEnv));
        
        // Fundamental (50-80Hz)
        const fundamental = Math.sin(time * 2 * Math.PI * (65 + 25 * pitchEnv));
        
        // Harmonic for punch
        const harmonic = Math.sin(time * 2 * Math.PI * (130 + 50 * pitchEnv)) * 0.4;
        
        // Slight distortion for warmth
        const signal = (sub * 0.9 + fundamental * 0.7 + harmonic) * envelope;
        amplitude = Math.tanh(signal * 1.5) * 0.85;
        
      } else if (sampleName.includes('vocal') || sampleName.includes('voice')) {
        // Rich vocal formants that sound human
        const envelope = Math.exp(-time * 0.8);
        const vibrato = 1 + 0.04 * Math.sin(time * 2 * Math.PI * 5.5);
        
        // Vowel formants for "Ah" sound
        const f1 = Math.sin(time * 2 * Math.PI * 730 * vibrato) * 0.8;  // First formant
        const f2 = Math.sin(time * 2 * Math.PI * 1090 * vibrato) * 0.5; // Second formant  
        const f3 = Math.sin(time * 2 * Math.PI * 2440 * vibrato) * 0.25; // Third formant
        const f4 = Math.sin(time * 2 * Math.PI * 3400 * vibrato) * 0.1;  // Brightness
        
        // Natural vocal breathiness
        const breath = (Math.random() * 2 - 1) * envelope * 0.05;
        
        amplitude = (f1 + f2 + f3 + f4 + breath) * envelope * 0.7;
        
      } else if (sample.type === 'loop' || sampleName.includes('loop')) {
        // Generate complex rhythmic loop
        const beatTime = (time * 4) % 1; // 4/4 time
        let loopAmp = 0;
        
        // Kick on 1 and 3
        if (beatTime < 0.1 || (beatTime > 0.5 && beatTime < 0.6)) {
          const kickDecay = Math.exp(-(beatTime % 0.5) * 20);
          loopAmp += Math.sin(beatTime * 2 * Math.PI * 60) * kickDecay * 0.8;
        }
        
        // Snare on 2 and 4
        if ((beatTime > 0.2 && beatTime < 0.3) || (beatTime > 0.7 && beatTime < 0.8)) {
          const snareDecay = Math.exp(-((beatTime - 0.25) % 0.5) * 15);
          loopAmp += ((Math.sin(beatTime * 2 * Math.PI * 200) * 0.6 + 
                      (Math.random() * 2 - 1) * 0.4) * snareDecay);
        }
        
        // Hi-hats throughout
        const hatDecay = Math.exp(-(beatTime * 8 % 0.125) * 40);
        loopAmp += (Math.random() * 2 - 1) * hatDecay * 0.2;
        
        amplitude = loopAmp * 0.6;
        
      } else {
        // Generate melodic content with harmonics
        const vibrato = 1 + 0.03 * Math.sin(time * 2 * Math.PI * 5);
        const decay = Math.exp(-time * 0.8);
        const fundamental = Math.sin(time * 2 * Math.PI * 440 * vibrato); // A4
        const harmonic2 = Math.sin(time * 2 * Math.PI * 880 * vibrato) * 0.3;
        const harmonic3 = Math.sin(time * 2 * Math.PI * 1320 * vibrato) * 0.15;
        amplitude = (fundamental + harmonic2 + harmonic3) * decay * 0.6;
      }
      
      // Apply gentle compression and limiting
      amplitude = Math.tanh(amplitude * 1.2) * 0.8;
      
      // Convert to 16-bit PCM with proper range
      const sample16 = Math.max(-32767, Math.min(32767, amplitude * 32767));
      view.setInt16(offset, sample16, true);
      offset += 2;
    }
    
    // Convert to base64
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(buffer))));
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "No prompt entered",
        description: "Please describe the sample pack you want to create",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate(prompt);
  };

  const handleRandomPrompt = () => {
    const randomPrompt = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
    setPrompt(randomPrompt);
  };

  const handlePlayPack = async (pack: GeneratedPack) => {
    try {
      // Initialize audio context if needed
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      if (playingPack === pack.id) {
        setPlayingPack(null);
        return;
      }

      setPlayingPack(pack.id);
      
      // Create a realistic preview based on pack genre and instruments
      await playGenrePreview(pack, audioContext);
      
      toast({
        title: `Playing "${pack.title}"`,
        description: `${pack.genre} • ${pack.bpm} BPM • ${pack.key}`,
      });
      
      // Auto-stop after 8 seconds
      setTimeout(() => {
        setPlayingPack(null);
      }, 8000);
      
    } catch (error) {
      console.error('Playback error:', error);
      toast({
        title: "Playback failed", 
        description: "Could not preview sample pack",
        variant: "destructive",
      });
      setPlayingPack(null);
    }
  };

  const playGenrePreview = async (pack: GeneratedPack, audioContext: AudioContext) => {
    console.log(`🎵 Playing AI-generated pack: "${pack.title}"`);
    console.log(`🤖 Pack contains ${pack.samples.length} samples:`, pack.samples.map(s => s.name));
    
    // Check if this pack has real audio files (MusicGen) or needs synthesis
    const hasRealAudio = pack.samples.some(sample => sample.audioUrl);
    
    if (hasRealAudio) {
      // Play real AI-generated audio files
      await playRealAudioSamples(pack);
    } else {
      // Fallback to synthesis for metadata-only packs
      await playSynthesizedSamples(pack, audioContext);
    }
  };

  const playRealAudioSamples = async (pack: GeneratedPack) => {
    console.log(`🎵 Playing real MusicGen audio for "${pack.title}"`);
    
    for (const sample of pack.samples) {
      if (!sample.audioUrl) continue;
      
      try {
        // Create audio element and play the real AI-generated audio
        const audio = new Audio(sample.audioUrl);
        audio.volume = 0.7;
        
        console.log(`🎵 Playing real AI audio: "${sample.name}"`);
        
        setTimeout(() => {
          if (playingPack) {
            audio.play().catch(err => {
              console.error(`Failed to play audio for ${sample.name}:`, err);
            });
          }
        }, 0);
        
        // Clean up after sample duration
        setTimeout(() => {
          audio.pause();
          audio.remove();
        }, (sample.duration || 8) * 1000);
        
      } catch (error) {
        console.error(`Error playing real audio for ${sample.name}:`, error);
      }
    }
  };

  const playSynthesizedSamples = async (pack: GeneratedPack, audioContext: AudioContext) => {
    console.log(`🎵 Synthesizing AI-designed samples for "${pack.title}"`);
    
    // Initialize professional audio engine
    await realisticAudio.initialize();
    
    const previewDuration = 8; // seconds
    const stepTime = (60 / pack.bpm) / 4; // 16th notes
    
    // Use the AI-generated musical data if available
    const sampleSchedule: Array<{
      sample: any,
      startTime: number,
      instrument: string,
      notes: string[],
      pattern: number[],
      intensity: number
    }> = [];
    
    // Process each AI-generated sample with its intelligent musical data
    pack.samples.forEach((sample, index) => {
      const sampleName = sample.name.toLowerCase();
      let instrument = 'piano';
      let notes = ['C', 'D', 'E', 'G', 'A'];
      let pattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
      let intensity = 0.6;
      
      // Use AI-generated data if available (from MusicGen service)
      if (sample.aiData) {
        notes = sample.aiData.notes || notes;
        pattern = sample.aiData.pattern || pattern;
        intensity = sample.aiData.intensity || intensity;
        console.log(`🤖 Using AI-generated data for "${sample.name}":`, {
          notes: notes.slice(0, 3),
          pattern: pattern.slice(0, 8),
          intensity
        });
      }
      
      // Map AI sample names to actual instruments
      if (sampleName.includes('kick') || sampleName.includes('drum')) {
        instrument = 'kick';
      } else if (sampleName.includes('snare')) {
        instrument = 'snare';
      } else if (sampleName.includes('hat') || sampleName.includes('hihat')) {
        instrument = 'hihat';
      } else if (sampleName.includes('lead') || sampleName.includes('synth')) {
        instrument = 'lead-synth';
      } else if (sampleName.includes('bass')) {
        instrument = 'bass';
      } else if (sampleName.includes('pad') || sampleName.includes('atmospheric')) {
        instrument = 'pad';
      } else if (sampleName.includes('violin')) {
        instrument = 'violin';
      } else if (sampleName.includes('flute')) {
        instrument = 'flute-concert';
      } else if (sampleName.includes('guitar')) {
        instrument = 'guitar-acoustic';
      } else if (sampleName.includes('piano')) {
        instrument = 'piano';
      }
      
      // Schedule this AI-generated sample to play with its AI pattern
      sampleSchedule.push({
        sample,
        startTime: index * 0.5, // Stagger samples slightly
        instrument,
        notes,
        pattern,
        intensity
      });
    });
    
    console.log(`🎵 Playing ${sampleSchedule.length} AI-designed samples with intelligent patterns`);
    
    // Play each sample according to its AI-generated pattern
    sampleSchedule.forEach(({ sample, startTime, instrument, notes, pattern, intensity }) => {
      setTimeout(() => {
        if (!playingPack) return;
        
        console.log(`🎵 Starting AI pattern for "${sample.name}" as ${instrument}`);
        
        // Play the AI-generated pattern
        let currentStep = 0;
        const totalSteps = Math.floor((previewDuration * 1000) / (stepTime * 1000));
        
        const playPatternStep = async () => {
          if (!playingPack) return;
          
          const stepIndex = currentStep % pattern.length;
          
          if (pattern[stepIndex]) {
            if (instrument === 'kick' || instrument === 'snare' || instrument === 'hihat') {
              // Play drums with AI intensity
              await realisticAudio.playDrumSound(instrument, intensity);
            } else {
              // Play melodic instruments with AI notes and intensity
              const noteIndex = currentStep % notes.length;
              const note = notes[noteIndex];
              const octave = instrument === 'violin' ? 5 : 4;
              const duration = Math.min(sample.duration || 1.0, 2.0);
              await realisticAudio.playNote(note, octave, duration, instrument, intensity);
            }
          }
          
          currentStep++;
          if (currentStep < totalSteps) {
            setTimeout(() => playPatternStep(), stepTime * 1000);
          }
        };
        
        playPatternStep();
      }, startTime * 1000);
    });
  };

  const playKick = (audioContext: AudioContext) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.frequency.setValueAtTime(60, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.8, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.start();
    osc.stop(audioContext.currentTime + 0.3);
  };

  const playSnare = (audioContext: AudioContext) => {
    const noise = audioContext.createBufferSource();
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.2, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    noise.buffer = buffer;
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    noise.connect(gain);
    gain.connect(audioContext.destination);
    
    noise.start();
  };

  const playHihat = (audioContext: AudioContext) => {
    const noise = audioContext.createBufferSource();
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.05, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    
    noise.buffer = buffer;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.2, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    
    noise.start();
  };

  const handleDownloadPack = (pack: GeneratedPack) => {
    // Simulate pack download
    toast({
      title: `Downloading "${pack.title}"`,
      description: `${pack.samples.length} samples • ${pack.genre} • ${pack.key}`,
    });
    
    // In a real implementation, this would trigger an actual download
    console.log("Downloading pack:", pack);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg flex items-center justify-center">
                <Package className="text-white h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">Pack Generator</h1>
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                    Beta
                  </Badge>
                </div>
                <p className="text-xl text-muted-foreground mt-1">
                  Enter a prompt, listen to the previews, then download your favorite pack.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Powered
              </Badge>
              <Badge variant="secondary">Real-time</Badge>
              <Badge variant="secondary">High Quality</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-8">
        {/* Examples */}
        <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-200/20">
          <CardHeader>
            <CardTitle className="text-emerald-700 dark:text-emerald-300">
              Examples of prompts:
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Heavy synths and ambient guitars with a cyberpunk vibe, 100 BPM, C minor.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Intense and suspenseful movie trailer score with big percussion hits and chilling strings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Prompt Input */}
        <Card className="border-2 border-emerald-200/30">
          <CardHeader>
            <CardTitle className="text-emerald-600">Enter Prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Textarea
                placeholder="Describe anything..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="resize-none text-lg border-emerald-200/50 focus:border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/30"
              />
              
              <Button
                variant="outline"
                onClick={handleRandomPrompt}
                className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              >
                <Dice1 className="h-4 w-4 mr-2" />
                Try a Random Prompt
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Number of Packs</label>
                <Select value={packCount.toString()} onValueChange={(v) => setPackCount(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Pack</SelectItem>
                    <SelectItem value="2">2 Packs</SelectItem>
                    <SelectItem value="4">4 Packs</SelectItem>
                    <SelectItem value="6">6 Packs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">AI Provider</label>
                <Select value={aiProvider} onValueChange={setAiProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="structure">📋 AI Structure Generator</SelectItem>
                    <SelectItem value="musicgen">🎵 MusicGen AI (Real Audio)</SelectItem>
                    <SelectItem value="grok">🤖 Grok AI (Premium)</SelectItem>
                    <SelectItem value="intelligent">🧠 Basic (Free)</SelectItem>
                    <SelectItem value="openai" disabled>💡 OpenAI (Configure API key)</SelectItem>
                    <SelectItem value="gemini" disabled>💎 Gemini (Configure API key)</SelectItem>
                    <SelectItem value="anthropic" disabled>🔬 Anthropic (Configure API key)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Preview Volume: {previewVolume[0]}%
                </label>
                <Slider
                  value={previewVolume}
                  onValueChange={setPreviewVolume}
                  max={100}
                  min={0}
                  step={1}
                />
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !prompt.trim()}
              className="w-full h-12 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating {packCount} New Packs...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate {packCount} New Packs
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Packs */}
        {generatedPacks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Generated Sample Packs</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generatedPacks.map((pack) => (
                <Card key={pack.id} className="border-emerald-200/30 hover:border-emerald-300/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{pack.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {pack.description}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                        {pack.genre}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Pack Info */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">BPM:</span>
                        <p className="font-medium">{pack.bpm}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Key:</span>
                        <p className="font-medium">{pack.key}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Samples:</span>
                        <p className="font-medium">{pack.samples.length}</p>
                      </div>
                    </div>

                    {/* Instruments */}
                    <div>
                      <span className="text-sm text-muted-foreground">Instruments:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(Array.isArray(pack.metadata.instruments) ? pack.metadata.instruments : 
                          typeof pack.metadata.instruments === 'string' ? (pack.metadata.instruments as string).split(',').map((s: string) => s.trim()) : 
                          ['Unknown']).map((instrument: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {instrument}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Sample List */}
                    <div>
                      <span className="text-sm text-muted-foreground">Samples:</span>
                      <div className="space-y-1 mt-1">
                        {pack.samples.slice(0, 3).map((sample) => (
                          <div key={sample.id} className="flex items-center justify-between text-xs">
                            <span>{sample.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {sample.type}
                            </Badge>
                          </div>
                        ))}
                        {pack.samples.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{pack.samples.length - 3} more samples
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePlayPack(pack)}
                        className="flex-1"
                      >
                        {playingPack === pack.id ? (
                          <>
                            <Pause className="h-4 w-4 mr-1" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Preview
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => handleDownloadPack(pack)}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      
                      <Button
                        onClick={() => addToLibraryMutation.mutate(pack)}
                        size="sm"
                        variant="outline"
                        disabled={addToLibraryMutation.isPending}
                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                        data-testid={`button-add-to-library-${pack.id}`}
                      >
                        {addToLibraryMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <DatabaseIcon className="h-4 w-4 mr-1" />
                        )}
                        Add to Library
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Help Section */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Pro Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-1">Be Specific</h4>
                <p className="text-muted-foreground">
                  Include BPM, key, genre, and mood for better results
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Use Musical Terms</h4>
                <p className="text-muted-foreground">
                  Mention instruments, scales, and production techniques
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Describe the Vibe</h4>
                <p className="text-muted-foreground">
                  Add emotional context like "aggressive", "dreamy", or "nostalgic"
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Reference Styles</h4>
                <p className="text-muted-foreground">
                  Mention genres, artists, or movie soundtracks for inspiration
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}