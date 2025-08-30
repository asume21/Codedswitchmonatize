import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StepSequencer } from "./StepSequencer.tsx";
import { BasslineGenerator } from "./BasslineGenerator.tsx";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  Settings,
  Music,
  Disc,
  Layers,
  Music2,
  Package,
  Loader2,
  Tags,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface BeatMakerProps {
  onBeatGenerated?: (beat: any) => void;
}

export function BeatMaker({ onBeatGenerated }: BeatMakerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [currentPattern, setCurrentPattern] = useState<any>(null);
  const [currentBassline, setCurrentBassline] = useState<any>(null);
  const [kickPattern, setKickPattern] = useState<boolean[]>(
    new Array(16).fill(false),
  );
  const [masterPlaying, setMasterPlaying] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Metadata state
  const [metadata, setMetadata] = useState({
    title: "",
    artist: "",
    album: "",
    genre: "",
    key: "",
    timeSignature: "4/4",
    copyright: "",
    description: "",
    tags: "",
  });

  // Load sample packs from database
  const { data: samplePacks = [], isLoading: loadingSamplePacks } = useQuery({
    queryKey: ["/api/sample-packs"],
  });

  const { data: allSamples = [], isLoading: loadingSamples } = useQuery({
    queryKey: ["/api/samples"],
  });

  // Function to play generated sample from database
  const playGeneratedSample = async (sample: any) => {
    try {
      // Initialize audio context if needed
      const context = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      if (context.state === "suspended") {
        await context.resume();
      }

      console.log(
        `🎵 Playing generated sample: ${sample.name} (${sample.category})`,
      );

      // Decode base64 audio data
      const audioData = atob(sample.audioData);
      const audioBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(audioBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      // Create audio buffer from data
      const buffer = await context.decodeAudioData(audioBuffer);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start();

      console.log("✅ Generated sample played successfully");
    } catch (error) {
      console.log(
        "🔄 Audio decoding failed, using Web Audio synthesis fallback for:",
        sample.name,
      );
      // Improved fallback - map sample categories to audio synthesis with variety
      const fallbackType = mapSampleCategoryToType(
        sample.category,
        sample.type,
        sample.name,
      );
      console.log(
        `🎵 Playing fallback sound: ${fallbackType} for sample "${sample.name}"`,
      );
      await playClassicSample(fallbackType);
    }
  };

  // Map sample categories to playable types with variety
  const mapSampleCategoryToType = (
    category: string,
    type: string,
    sampleName?: string,
  ) => {
    const name = (sampleName || "").toLowerCase();

    // First check sample name for specific keywords
    if (name.includes("kick") || name.includes("drum")) {
      const drumTypes = ["amen", "funky", "apache"];
      return drumTypes[Math.floor(Math.random() * drumTypes.length)];
    }

    if (name.includes("bass") || name.includes("sub") || name.includes("808")) {
      const bassTypes = ["808", "moog", "sub"];
      return bassTypes[Math.floor(Math.random() * bassTypes.length)];
    }

    if (
      name.includes("vocal") ||
      name.includes("voice") ||
      name.includes("yeah") ||
      name.includes("check")
    ) {
      const vocalTypes = ["vocal1", "vocal2", "vocal3"];
      return vocalTypes[Math.floor(Math.random() * vocalTypes.length)];
    }

    // Then check category/type with more variety
    if (
      category.includes("drums") ||
      category.includes("loop") ||
      type === "drums"
    ) {
      const drumTypes = ["amen", "funky", "apache"];
      return drumTypes[Math.floor(Math.random() * drumTypes.length)];
    }

    if (category.includes("bass") || type === "bass") {
      const bassTypes = ["808", "moog", "sub"];
      return bassTypes[Math.floor(Math.random() * bassTypes.length)];
    }

    if (category.includes("vocal") || category.includes("voice")) {
      const vocalTypes = ["vocal1", "vocal2", "vocal3"];
      return vocalTypes[Math.floor(Math.random() * vocalTypes.length)];
    }

    if (category.includes("melody") || type === "melody") {
      // Use vocal sounds for melody since they're more tonal
      const melodyTypes = ["vocal1", "vocal2", "vocal3"];
      return melodyTypes[Math.floor(Math.random() * melodyTypes.length)];
    }

    // For unknown categories, randomly pick any available sound
    const allTypes = [
      "amen",
      "funky",
      "apache",
      "808",
      "moog",
      "sub",
      "vocal1",
      "vocal2",
      "vocal3",
    ];
    return allTypes[Math.floor(Math.random() * allTypes.length)];
  };

  // Use the original realistic audio synthesis
  const playClassicSample = async (sampleType: string) => {
    try {
      // Initialize audio context if needed
      const context = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      if (context.state === "suspended") {
        await context.resume();
      }

      // Use proper audio synthesis from realisticAudio.ts
      if (sampleType.includes("vocal")) {
        playProfessionalVocalChop(context, sampleType);
      } else if (
        sampleType === "amen" ||
        sampleType === "funky" ||
        sampleType === "apache"
      ) {
        playClassicDrumBreak(context, sampleType);
      } else if (
        sampleType === "808" ||
        sampleType === "moog" ||
        sampleType === "sub"
      ) {
        playProfessionalBass(context, sampleType);
      }
    } catch (error) {
      console.log("Audio synthesis failed:", error);
    }
  };

  // Professional vocal chop synthesis that actually sounds like "Yeah", "Uh-huh", "Check It"
  const playProfessionalVocalChop = (
    context: AudioContext,
    vocalType: string,
  ) => {
    const currentTime = context.currentTime;

    if (vocalType === "vocal1") {
      // "Yeah" vocal - classic hip-hop vocal chop
      playYeahVocal(context, currentTime);
    } else if (vocalType === "vocal2") {
      // "Uh-huh" vocal - affirmative vocal sample
      playUhHuhVocal(context, currentTime);
    } else if (vocalType === "vocal3") {
      // "Check It" vocal - commanding vocal sample
      playCheckItVocal(context, currentTime);
    }
  };

  // "Yeah" vocal - characteristic hip-hop vocal
  const playYeahVocal = (context: AudioContext, startTime: number) => {
    // Two-part vocal: "Ye" + "ah"
    // Part 1: "Ye" sound (consonant + vowel)
    const osc1 = context.createOscillator();
    const gain1 = context.createGain();
    const filter1 = context.createBiquadFilter();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(200, startTime); // Start with "Y" consonant
    osc1.frequency.exponentialRampToValueAtTime(350, startTime + 0.15); // Move to "E" vowel

    filter1.type = "bandpass";
    filter1.frequency.setValueAtTime(1800, startTime);
    filter1.Q.setValueAtTime(3, startTime);

    gain1.gain.setValueAtTime(0, startTime);
    gain1.gain.linearRampToValueAtTime(0.8, startTime + 0.05);
    gain1.gain.linearRampToValueAtTime(0.6, startTime + 0.15);
    gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(context.destination);
    osc1.start(startTime);
    osc1.stop(startTime + 0.25);

    // Part 2: "ah" sound (open vowel)
    const osc2 = context.createOscillator();
    const gain2 = context.createGain();
    const filter2 = context.createBiquadFilter();

    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(280, startTime + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(240, startTime + 0.6);

    filter2.type = "bandpass";
    filter2.frequency.setValueAtTime(1200, startTime + 0.2);
    filter2.Q.setValueAtTime(2, startTime + 0.2);

    gain2.gain.setValueAtTime(0, startTime + 0.2);
    gain2.gain.linearRampToValueAtTime(0.9, startTime + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(context.destination);
    osc2.start(startTime + 0.2);
    osc2.stop(startTime + 0.7);
  };

  // "Uh-huh" vocal - two-syllable affirmative
  const playUhHuhVocal = (context: AudioContext, startTime: number) => {
    // Part 1: "Uh" sound (low, guttural)
    const osc1 = context.createOscillator();
    const gain1 = context.createGain();
    const filter1 = context.createBiquadFilter();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(150, startTime);
    osc1.frequency.exponentialRampToValueAtTime(180, startTime + 0.2);

    filter1.type = "lowpass";
    filter1.frequency.setValueAtTime(800, startTime);
    filter1.Q.setValueAtTime(1, startTime);

    gain1.gain.setValueAtTime(0, startTime);
    gain1.gain.linearRampToValueAtTime(0.7, startTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(context.destination);
    osc1.start(startTime);
    osc1.stop(startTime + 0.3);

    // Part 2: "Huh" sound (aspirated with breath)
    const osc2 = context.createOscillator();
    const gain2 = context.createGain();
    const filter2 = context.createBiquadFilter();

    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(220, startTime + 0.35);
    osc2.frequency.exponentialRampToValueAtTime(200, startTime + 0.65);

    filter2.type = "bandpass";
    filter2.frequency.setValueAtTime(1500, startTime + 0.35);
    filter2.Q.setValueAtTime(2.5, startTime + 0.35);

    gain2.gain.setValueAtTime(0, startTime + 0.35);
    gain2.gain.linearRampToValueAtTime(0.8, startTime + 0.4);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.75);

    // Add breath sound for "H"
    const breathNoise = context.createBufferSource();
    const breathBuffer = context.createBuffer(
      1,
      context.sampleRate * 0.1,
      context.sampleRate,
    );
    const breathData = breathBuffer.getChannelData(0);
    for (let i = 0; i < breathData.length; i++) {
      breathData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    breathNoise.buffer = breathBuffer;

    const breathGain = context.createGain();
    const breathFilter = context.createBiquadFilter();
    breathFilter.type = "highpass";
    breathFilter.frequency.setValueAtTime(3000, startTime + 0.35);
    breathGain.gain.setValueAtTime(0.2, startTime + 0.35);

    breathNoise.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(context.destination);
    breathNoise.start(startTime + 0.35);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(context.destination);
    osc2.start(startTime + 0.35);
    osc2.stop(startTime + 0.75);
  };

  // "Check It" vocal - commanding two-word phrase
  const playCheckItVocal = (context: AudioContext, startTime: number) => {
    // Part 1: "Check" sound (sharp consonant start)
    const osc1 = context.createOscillator();
    const gain1 = context.createGain();
    const filter1 = context.createBiquadFilter();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(300, startTime);
    osc1.frequency.exponentialRampToValueAtTime(250, startTime + 0.25);

    filter1.type = "bandpass";
    filter1.frequency.setValueAtTime(2200, startTime);
    filter1.frequency.exponentialRampToValueAtTime(1400, startTime + 0.25);
    filter1.Q.setValueAtTime(4, startTime);

    gain1.gain.setValueAtTime(0, startTime);
    gain1.gain.linearRampToValueAtTime(0.9, startTime + 0.03); // Sharp attack for "Ch"
    gain1.gain.linearRampToValueAtTime(0.7, startTime + 0.15);
    gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(context.destination);
    osc1.start(startTime);
    osc1.stop(startTime + 0.35);

    // Part 2: "It" sound (quick closure)
    const osc2 = context.createOscillator();
    const gain2 = context.createGain();
    const filter2 = context.createBiquadFilter();

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(320, startTime + 0.4);
    osc2.frequency.exponentialRampToValueAtTime(280, startTime + 0.65);

    filter2.type = "bandpass";
    filter2.frequency.setValueAtTime(1800, startTime + 0.4);
    filter2.Q.setValueAtTime(3, startTime + 0.4);

    gain2.gain.setValueAtTime(0, startTime + 0.4);
    gain2.gain.linearRampToValueAtTime(0.8, startTime + 0.42);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(context.destination);
    osc2.start(startTime + 0.4);
    osc2.stop(startTime + 0.7);
  };

  // Restore classic drum break patterns with distinct sounds
  const playClassicDrumBreak = (context: AudioContext, breakType: string) => {
    const currentTime = context.currentTime;

    if (breakType === "amen") {
      playAmenBreak(context, currentTime);
    } else if (breakType === "funky") {
      playFunkyDrummer(context, currentTime);
    } else if (breakType === "apache") {
      playApacheBreak(context, currentTime);
    }
  };

  // Professional bass synthesis - restore original power
  const playProfessionalBass = (context: AudioContext, bassType: string) => {
    const currentTime = context.currentTime;

    if (bassType === "808") {
      play808Bass(context, currentTime);
    } else if (bassType === "moog") {
      playMoogBass(context, currentTime);
    } else if (bassType === "sub") {
      playSubBass(context, currentTime);
    }
  };

  // Amen Break - most sampled drum break in history
  const playAmenBreak = (context: AudioContext, startTime: number) => {
    // Kick on 1 and 3
    playPowerfulKick(context, startTime);
    playPowerfulKick(context, startTime + 0.5);

    // Snare on 2 and 4
    playSnapSnare(context, startTime + 0.25);
    playSnapSnare(context, startTime + 0.75);

    // Ghost notes and fills
    playGhostNote(context, startTime + 0.125);
    playGhostNote(context, startTime + 0.375);
    playGhostNote(context, startTime + 0.625);
  };

  // Funky Drummer - James Brown classic
  const playFunkyDrummer = (context: AudioContext, startTime: number) => {
    // Different pattern with shuffle feel
    playPowerfulKick(context, startTime);
    playSnapSnare(context, startTime + 0.33);
    playPowerfulKick(context, startTime + 0.66);
    playSnapSnare(context, startTime + 0.83);
  };

  // Apache Break - Ultimate Breaks and Beats
  const playApacheBreak = (context: AudioContext, startTime: number) => {
    // Complex syncopated pattern
    playPowerfulKick(context, startTime);
    playGhostNote(context, startTime + 0.125);
    playSnapSnare(context, startTime + 0.25);
    playPowerfulKick(context, startTime + 0.5);
    playSnapSnare(context, startTime + 0.75);
  };

  // Powerful kick drum
  const playPowerfulKick = (context: AudioContext, startTime: number) => {
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(60, startTime);
    osc.frequency.exponentialRampToValueAtTime(20, startTime + 0.1);

    gain.gain.setValueAtTime(1.0, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.3);
  };

  // Snappy snare drum
  const playSnapSnare = (context: AudioContext, startTime: number) => {
    // Tone component
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, startTime);
    gain.gain.setValueAtTime(0.8, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.2);

    // Noise component
    const noise = context.createBufferSource();
    const noiseBuffer = context.createBuffer(
      1,
      context.sampleRate * 0.1,
      context.sampleRate,
    );
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const noiseGain = context.createGain();
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(3000, startTime);

    noiseGain.gain.setValueAtTime(0.5, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(context.destination);
    noise.start(startTime);
  };

  // Ghost note
  const playGhostNote = (context: AudioContext, startTime: number) => {
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(150, startTime);
    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.05);
  };

  // Booming 808 bass drum
  const play808Bass = (context: AudioContext, startTime: number) => {
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(55, startTime);
    osc.frequency.exponentialRampToValueAtTime(30, startTime + 0.4);

    gain.gain.setValueAtTime(1.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(startTime);
    osc.stop(startTime + 1.0);
  };

  // Fat Moog bass
  const playMoogBass = (context: AudioContext, startTime: number) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(82, startTime);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, startTime);
    filter.frequency.exponentialRampToValueAtTime(200, startTime + 0.5);
    filter.Q.setValueAtTime(20, startTime);

    gain.gain.setValueAtTime(1.0, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    osc.start(startTime);
    osc.stop(startTime + 1.2);
  };

  // Deep sub bass
  const playSubBass = (context: AudioContext, startTime: number) => {
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(41, startTime);

    gain.gain.setValueAtTime(1.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(startTime);
    osc.stop(startTime + 2.0);
  };

  const handlePatternChange = (tracks: any[]) => {
    // Extract kick pattern for bassline sync
    const kickTrack = tracks.find((track) => track.id === "kick");
    if (kickTrack) {
      setKickPattern(kickTrack.pattern);
    }

    const newPattern = {
      tracks,
      bassline: currentBassline,
      bpm,
      name: `Hip-Hop Beat ${Date.now()}`,
      style: "west-coast",
    };

    setCurrentPattern(newPattern);
    onBeatGenerated?.(newPattern);
  };

  const handleBasslineChange = (bassline: any) => {
    setCurrentBassline(bassline);

    if (currentPattern) {
      const updatedPattern = {
        ...currentPattern,
        bassline,
      };
      setCurrentPattern(updatedPattern);
      onBeatGenerated?.(updatedPattern);
    }
  };

  const handlePlayStateChange = (playing: boolean) => {
    setIsPlaying(playing);
  };

  const handleMasterPlay = () => {
    const newPlaying = !masterPlaying;
    console.log(
      `🎵 Master Play Control: ${newPlaying ? "PLAYING" : "STOPPING"} all tracks`,
    );

    setMasterPlaying(newPlaying);
    setIsPlaying(newPlaying);

    // Send play command to both sequencer and bassline
    window.dispatchEvent(
      new CustomEvent("masterPlayControl", {
        detail: { playing: newPlaying },
      }),
    );

    console.log("🎵 Master play event dispatched to drums and bass");
  };

  // Initialize audio context for samples
  const initAudioContext = async () => {
    if (!audioContext) {
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      setAudioContext(ctx);
      return ctx;
    }
    return audioContext;
  };

  // Sample playback functions
  const playSample = async (sampleType: string) => {
    const ctx = await initAudioContext();
    if (!ctx) return;

    console.log(`🎵 Playing sample: ${sampleType}`);

    switch (sampleType) {
      case "amen":
        playAmenBreak(ctx, ctx.currentTime);
        break;
      case "funky":
        playFunkyDrummer(ctx, ctx.currentTime);
        break;
      case "apache":
        playApacheBreak(ctx, ctx.currentTime);
        break;
      case "808":
        play808Bass(ctx, ctx.currentTime);
        break;
      case "moog":
        playMoogBass(ctx, ctx.currentTime);
        break;
      case "sub":
        playSubBass(ctx, ctx.currentTime);
        break;
      case "vocal1":
        playYeahVocal(ctx, ctx.currentTime);
        break;
      case "vocal2":
        playUhHuhVocal(ctx, ctx.currentTime);
        break;
      case "vocal3":
        playCheckItVocal(ctx, ctx.currentTime);
        break;
    }
  };

  // Helper function for drum sounds
  const playDrumSound = (ctx: AudioContext, type: string) => {
    switch (type) {
      case "kick":
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.frequency.setValueAtTime(60, ctx.currentTime);
        kickOsc.frequency.exponentialRampToValueAtTime(
          30,
          ctx.currentTime + 0.1,
        );
        kickGain.gain.setValueAtTime(0.8, ctx.currentTime);
        kickGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        kickOsc.connect(kickGain);
        kickGain.connect(ctx.destination);
        kickOsc.start();
        kickOsc.stop(ctx.currentTime + 0.3);
        break;

      case "snare":
        const snareNoise = ctx.createBufferSource();
        const snareBuffer = ctx.createBuffer(
          1,
          ctx.sampleRate * 0.2,
          ctx.sampleRate,
        );
        const snareData = snareBuffer.getChannelData(0);
        for (let i = 0; i < snareBuffer.length; i++) {
          snareData[i] = Math.random() * 2 - 1;
        }
        snareNoise.buffer = snareBuffer;
        const snareGain = ctx.createGain();
        snareGain.gain.setValueAtTime(0.3, ctx.currentTime);
        snareGain.gain.exponentialRampToValueAtTime(
          0.01,
          ctx.currentTime + 0.2,
        );
        snareNoise.connect(snareGain);
        snareGain.connect(ctx.destination);
        snareNoise.start();
        break;

      case "hihat":
        const hihatNoise = ctx.createBufferSource();
        const hihatBuffer = ctx.createBuffer(
          1,
          ctx.sampleRate * 0.05,
          ctx.sampleRate,
        );
        const hihatData = hihatBuffer.getChannelData(0);
        for (let i = 0; i < hihatBuffer.length; i++) {
          hihatData[i] = (Math.random() * 2 - 1) * 0.3;
        }
        hihatNoise.buffer = hihatBuffer;
        const hihatFilter = ctx.createBiquadFilter();
        hihatFilter.type = "highpass";
        hihatFilter.frequency.value = 8000;
        const hihatGain = ctx.createGain();
        hihatGain.gain.setValueAtTime(0.2, ctx.currentTime);
        hihatGain.gain.exponentialRampToValueAtTime(
          0.01,
          ctx.currentTime + 0.05,
        );
        hihatNoise.connect(hihatFilter);
        hihatFilter.connect(hihatGain);
        hihatGain.connect(ctx.destination);
        hihatNoise.start();
        break;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Disc className="h-6 w-6 text-purple-500" />
            <h1 className="text-3xl font-bold">Professional Beat Maker</h1>
            <Badge
              variant="secondary"
              className="bg-purple-100 text-purple-800"
            >
              Classic Hip-Hop Studio
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleMasterPlay}
              size="lg"
              data-testid="button-master-play"
              className={
                masterPlaying
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-green-500 hover:bg-green-600"
              }
            >
              {masterPlaying ? (
                <Square className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
              {masterPlaying ? "Stop All" : "Play All"}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">BPM</span>
              <Slider
                value={[bpm]}
                onValueChange={(value) => setBpm(value[0])}
                min={60}
                max={180}
                step={1}
                className="w-24"
                data-testid="slider-bpm"
              />
              <span className="text-sm w-12">{bpm}</span>
            </div>

            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                masterPlaying
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {masterPlaying ? (
                <Play className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {masterPlaying ? "Playing" : "Stopped"}
              </span>
            </div>

            {/* Metadata Button */}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  data-testid="button-beat-metadata"
                >
                  <Tags className="h-4 w-4" />
                  Metadata
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-600 text-white max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-gray-200 flex items-center gap-2">
                    <Tags className="h-5 w-5" />
                    Beat Metadata
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300">Title</Label>
                      <Input
                        value={metadata.title}
                        onChange={(e) =>
                          setMetadata({ ...metadata, title: e.target.value })
                        }
                        placeholder="Beat Title"
                        className="bg-gray-700 border-gray-600 text-white"
                        data-testid="input-beat-metadata-title"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300">Producer</Label>
                      <Input
                        value={metadata.artist}
                        onChange={(e) =>
                          setMetadata({ ...metadata, artist: e.target.value })
                        }
                        placeholder="Producer Name"
                        className="bg-gray-700 border-gray-600 text-white"
                        data-testid="input-beat-metadata-producer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300">Genre</Label>
                      <Select
                        value={metadata.genre}
                        onValueChange={(value) =>
                          setMetadata({ ...metadata, genre: value })
                        }
                      >
                        <SelectTrigger
                          className="bg-gray-700 border-gray-600 text-white"
                          data-testid="select-beat-metadata-genre"
                        >
                          <SelectValue placeholder="Select Genre" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-600">
                          <SelectItem value="hip-hop">Hip Hop</SelectItem>
                          <SelectItem value="trap">Trap</SelectItem>
                          <SelectItem value="drill">Drill</SelectItem>
                          <SelectItem value="boom-bap">Boom Bap</SelectItem>
                          <SelectItem value="lo-fi">Lo-Fi</SelectItem>
                          <SelectItem value="experimental">
                            Experimental
                          </SelectItem>
                          <SelectItem value="r&b">R&B</SelectItem>
                          <SelectItem value="electronic">Electronic</SelectItem>
                          <SelectItem value="house">House</SelectItem>
                          <SelectItem value="techno">Techno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-gray-300">Key</Label>
                      <Input
                        value={metadata.key}
                        onChange={(e) =>
                          setMetadata({ ...metadata, key: e.target.value })
                        }
                        placeholder="e.g., Am, F# Major"
                        className="bg-gray-700 border-gray-600 text-white"
                        data-testid="input-beat-metadata-key"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300">BPM</Label>
                      <Input
                        value={bpm.toString()}
                        onChange={(e) => {
                          const newBpm = parseInt(e.target.value) || bpm;
                          setBpm(newBpm);
                          setMetadata({ ...metadata, key: `${newBpm} BPM` });
                        }}
                        placeholder="120"
                        className="bg-gray-700 border-gray-600 text-white"
                        data-testid="input-beat-metadata-bpm"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300">Time Signature</Label>
                      <Select
                        value={metadata.timeSignature}
                        onValueChange={(value) =>
                          setMetadata({ ...metadata, timeSignature: value })
                        }
                      >
                        <SelectTrigger
                          className="bg-gray-700 border-gray-600 text-white"
                          data-testid="select-beat-metadata-time"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-600">
                          <SelectItem value="4/4">4/4</SelectItem>
                          <SelectItem value="3/4">3/4</SelectItem>
                          <SelectItem value="6/8">6/8</SelectItem>
                          <SelectItem value="7/8">7/8</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300">Description</Label>
                    <Input
                      value={metadata.description}
                      onChange={(e) =>
                        setMetadata({
                          ...metadata,
                          description: e.target.value,
                        })
                      }
                      placeholder="Hard-hitting trap beat with 808s"
                      className="bg-gray-700 border-gray-600 text-white"
                      data-testid="input-beat-metadata-description"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Tags</Label>
                    <Input
                      value={metadata.tags}
                      onChange={(e) =>
                        setMetadata({ ...metadata, tags: e.target.value })
                      }
                      placeholder="trap, 808, dark, heavy (comma separated)"
                      className="bg-gray-700 border-gray-600 text-white"
                      data-testid="input-beat-metadata-tags"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Copyright</Label>
                    <Input
                      value={metadata.copyright}
                      onChange={(e) =>
                        setMetadata({ ...metadata, copyright: e.target.value })
                      }
                      placeholder="© 2025 Producer Name"
                      className="bg-gray-700 border-gray-600 text-white"
                      data-testid="input-beat-metadata-copyright"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      variant="outline"
                      className="bg-gray-600 hover:bg-gray-500 text-white border-gray-600"
                    >
                      Clear All
                    </Button>
                    <Button className="bg-purple-600 hover:bg-purple-500 text-white">
                      Save Metadata
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="sequencer" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="sequencer" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Drums
            </TabsTrigger>
            <TabsTrigger value="bassline" className="flex items-center gap-2">
              <Music2 className="h-4 w-4" />
              Bassline
            </TabsTrigger>
            <TabsTrigger value="samples" className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              Samples
            </TabsTrigger>
            <TabsTrigger value="mixing" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Mixing
            </TabsTrigger>
            <TabsTrigger
              value="arrangement"
              className="flex items-center gap-2"
            >
              <Disc className="h-4 w-4" />
              Structure
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sequencer" className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border">
              <h3 className="font-semibold text-lg mb-2 text-gray-900">
                🎵 Classic Hip-Hop Drum Programming
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Professional 16-step sequencer with swing control, velocity
                programming, and classic West Coast sound design. Perfect for
                recreating beats like "All Eyez On Me" and other 90s classics.
              </p>
              <div className="flex gap-2">
                <Badge variant="outline">Kick Programming</Badge>
                <Badge variant="outline">Snare Placement</Badge>
                <Badge variant="outline">Hi-Hat Patterns</Badge>
                <Badge variant="outline">Swing & Groove</Badge>
              </div>
            </div>

            <StepSequencer
              bpm={bpm}
              onPatternChange={handlePatternChange}
              onPlayStateChange={handlePlayStateChange}
            />
          </TabsContent>

          <TabsContent value="bassline" className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border">
              <h3 className="font-semibold text-lg mb-2">
                🎸 Classic Hip-Hop Basslines
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Professional bassline generator that automatically syncs with
                your kick drum pattern. Create deep, punchy bass sounds that
                lock perfectly with your drums for that authentic West Coast
                sound.
              </p>
              <div className="flex gap-2">
                <Badge variant="outline">Auto-Sync to Kick</Badge>
                <Badge variant="outline">808 Bass Sounds</Badge>
                <Badge variant="outline">Hip-Hop Scales</Badge>
                <Badge variant="outline">Analog Modeling</Badge>
              </div>
            </div>

            <BasslineGenerator
              kickPattern={kickPattern}
              bpm={bpm}
              onBasslineChange={handleBasslineChange}
            />
          </TabsContent>

          <TabsContent value="samples" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">
                  Expanded Sample Library
                </h3>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-muted-foreground">
                    {(samplePacks as any[]).length} Packs •{" "}
                    {(allSamples as any[]).length} Samples
                  </span>
                </div>
              </div>

              {loadingSamplePacks || loadingSamples ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-muted-foreground">
                    Loading sample library...
                  </span>
                </div>
              ) : (
                <>
                  {/* Classic Samples */}
                  <div className="mb-8">
                    <h4 className="text-lg font-medium mb-4">
                      Classic Hip-Hop Samples
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="p-4">
                        <h5 className="font-medium mb-2">Drum Breaks</h5>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            data-testid="button-sample-amen"
                            onClick={() => playClassicSample("amen")}
                          >
                            Amen Break
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            data-testid="button-sample-funky"
                            onClick={() => playClassicSample("funky")}
                          >
                            Funky Drummer
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            data-testid="button-sample-apache"
                            onClick={() => playClassicSample("apache")}
                          >
                            Apache Break
                          </Button>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h5 className="font-medium mb-2">Bass Samples</h5>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            data-testid="button-sample-808"
                            onClick={() => playClassicSample("808")}
                          >
                            808 Bass
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            data-testid="button-sample-moog"
                            onClick={() => playClassicSample("moog")}
                          >
                            Moog Bass
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            data-testid="button-sample-sub"
                            onClick={() => playClassicSample("sub")}
                          >
                            Sub Bass
                          </Button>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h5 className="font-medium mb-2">Vocal Chops</h5>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            data-testid="button-sample-vocal1"
                            onClick={() => playClassicSample("vocal1")}
                          >
                            "Yeah" Vocal
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            data-testid="button-sample-vocal2"
                            onClick={() => playClassicSample("vocal2")}
                          >
                            "Uh-huh" Vocal
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            data-testid="button-sample-vocal3"
                            onClick={() => playClassicSample("vocal3")}
                          >
                            "Check It" Vocal
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Generated Sample Packs */}
                  {(samplePacks as any[]).length > 0 && (
                    <div>
                      <h4 className="text-lg font-medium mb-4 flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        AI-Generated Sample Packs
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(samplePacks as any[]).slice(0, 6).map((pack: any) => (
                          <Card key={pack.id} className="p-4 border-blue-200">
                            <div className="mb-3">
                              <h5 className="font-semibold text-sm">
                                {pack.name}
                              </h5>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {pack.genre}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {pack.mood}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                              {pack.description}
                            </p>
                            <div className="space-y-1">
                              {(allSamples as any[])
                                .filter(
                                  (sample: any) => sample.packId === pack.id,
                                )
                                .slice(0, 3)
                                .map((sample: any) => (
                                  <Button
                                    key={sample.id}
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => playGeneratedSample(sample)}
                                    data-testid={`button-sample-${sample.id}`}
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    {sample.name}
                                  </Button>
                                ))}
                            </div>
                          </Card>
                        ))}
                      </div>

                      {(samplePacks as any[]).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">
                            No generated sample packs yet.
                          </p>
                          <p className="text-xs">
                            Use the Pack Generator to create AI-powered sample
                            packs!
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="mixing" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">
                Professional Mixing Console
              </h3>
              <div className="grid grid-cols-4 gap-6">
                <Card className="p-4">
                  <h4 className="font-medium mb-3">Kick EQ</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm">Low (60Hz)</label>
                      <Slider
                        defaultValue={[75]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-kick-low"
                      />
                    </div>
                    <div>
                      <label className="text-sm">Mid (800Hz)</label>
                      <Slider
                        defaultValue={[50]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-kick-mid"
                      />
                    </div>
                    <div>
                      <label className="text-sm">High (5kHz)</label>
                      <Slider
                        defaultValue={[30]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-kick-high"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="font-medium mb-3">Snare EQ</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm">Low (200Hz)</label>
                      <Slider
                        defaultValue={[40]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-snare-low"
                      />
                    </div>
                    <div>
                      <label className="text-sm">Mid (2kHz)</label>
                      <Slider
                        defaultValue={[60]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-snare-mid"
                      />
                    </div>
                    <div>
                      <label className="text-sm">High (8kHz)</label>
                      <Slider
                        defaultValue={[80]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-snare-high"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="font-medium mb-3">Compression</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm">Ratio</label>
                      <Slider
                        defaultValue={[40]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-compression-ratio"
                      />
                    </div>
                    <div>
                      <label className="text-sm">Attack</label>
                      <Slider
                        defaultValue={[20]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-compression-attack"
                      />
                    </div>
                    <div>
                      <label className="text-sm">Release</label>
                      <Slider
                        defaultValue={[60]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-compression-release"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="font-medium mb-3">Master Bus</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm">Bus Comp</label>
                      <Slider
                        defaultValue={[35]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-master-compression"
                      />
                    </div>
                    <div>
                      <label className="text-sm">Saturation</label>
                      <Slider
                        defaultValue={[25]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-master-saturation"
                      />
                    </div>
                    <div>
                      <label className="text-sm">Stereo Width</label>
                      <Slider
                        defaultValue={[70]}
                        max={100}
                        className="mt-1"
                        data-testid="slider-master-width"
                      />
                    </div>
                  </div>
                </Card>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="arrangement" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">
                Song Arrangement Builder
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-8 gap-2">
                  {[
                    "Intro",
                    "Verse 1",
                    "Hook",
                    "Verse 2",
                    "Hook",
                    "Bridge",
                    "Hook",
                    "Outro",
                  ].map((section, index) => (
                    <Card key={index} className="p-3 text-center">
                      <div className="text-sm font-medium">{section}</div>
                      <div className="text-xs text-gray-500 mt-1">8 bars</div>
                    </Card>
                  ))}
                </div>

                <div className="flex gap-4 mt-6">
                  <Button variant="outline" data-testid="button-add-section">
                    Add Section
                  </Button>
                  <Button variant="outline" data-testid="button-copy-section">
                    Copy Pattern
                  </Button>
                  <Button variant="outline" data-testid="button-song-export">
                    Export Song
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
