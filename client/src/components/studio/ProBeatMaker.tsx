/**
 * ProBeatMaker - Professional Beat Maker
 * Ableton/Logic-level features merged from all beat makers
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTransport } from '@/contexts/TransportContext';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { AIProviderSelector } from '@/components/ui/ai-provider-selector';
import {
  Play, Square, RotateCcw, Undo2, Redo2, Shuffle, Send, ChevronDown, Wand2,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

// Types
interface DrumStep {
  active: boolean;
  velocity: number;
  probability: number;
}

interface DrumTrack {
  id: string;
  name: string;
  color: string;
  pattern: DrumStep[];
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

// Constants
const DEFAULT_TRACKS = [
  { id: 'kick', name: 'Kick', color: 'bg-red-500' },
  { id: 'snare', name: 'Snare', color: 'bg-blue-500' },
  { id: 'clap', name: 'Clap', color: 'bg-purple-500' },
  { id: 'hihat', name: 'Hi-Hat', color: 'bg-yellow-500' },
  { id: 'openhat', name: 'Open Hat', color: 'bg-green-500' },
  { id: 'perc', name: 'Perc', color: 'bg-orange-500' },
  { id: 'tom', name: 'Tom', color: 'bg-pink-500' },
  { id: 'crash', name: 'Crash', color: 'bg-cyan-500' },
];

const PRESETS: Record<string, Record<string, boolean[]>> = {
  'Hip-Hop': {
    kick: [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0].map(Boolean),
    snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0].map(Boolean),
  },
  'Trap': {
    kick: [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0].map(Boolean),
    snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    hihat: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1].map(Boolean),
    openhat: [0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1].map(Boolean),
  },
  'House': {
    kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0].map(Boolean),
    clap: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    hihat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0].map(Boolean),
  },
  'Techno': {
    kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0].map(Boolean),
    hihat: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1].map(Boolean),
    openhat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0].map(Boolean),
  },
  'D&B': {
    kick: [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0].map(Boolean),
    snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0].map(Boolean),
    hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0].map(Boolean),
  },
  'Boom Bap': {
    kick: [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0].map(Boolean),
    snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0].map(Boolean),
  },
};

const createEmptyStep = (): DrumStep => ({ active: false, velocity: 100, probability: 100 });
const createPattern = (len: number) => Array(len).fill(null).map(() => createEmptyStep());
const initTracks = (len: number): DrumTrack[] => DEFAULT_TRACKS.map(t => ({
  ...t, pattern: createPattern(len), volume: 80, pan: 0, muted: false, solo: false,
}));

interface Props {
  onPatternChange?: (tracks: DrumTrack[], bpm: number) => void;
}

export default function ProBeatMaker({ onPatternChange }: Props) {
  const { toast } = useToast();
  const { tempo } = useTransport();
  
  const [tracks, setTracks] = useState<DrumTrack[]>(() => initTracks(16));
  const [bpm, setBpm] = useState(90);
  const [patternLength, setPatternLength] = useState(16);
  const [swing, setSwing] = useState(0);
  const [groove, setGroove] = useState(0);
  const [masterVol, setMasterVol] = useState(80);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStep, setSelectedStep] = useState<{t: number, s: number} | null>(null);
  const [history, setHistory] = useState<DrumTrack[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  
  // AI Generation state
  const [aiProvider, setAiProvider] = useState('grok');
  const [selectedGenre, setSelectedGenre] = useState('Hip-Hop');
  
  // AI Beat generation mutation
  const generateBeatMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        genre: selectedGenre.toLowerCase(),
        bpm,
        duration: Math.max(1, Math.round((patternLength * 60) / bpm / 4)),
        aiProvider,
      };
      
      const response = await apiRequest('POST', '/api/beats/generate', payload);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to generate beat');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const beatPattern = data?.beat?.pattern;
      if (beatPattern) {
        saveHistory();
        setTracks(prev => prev.map(track => {
          const presetPattern = beatPattern[track.id];
          return {
            ...track,
            pattern: track.pattern.map((step, i) => ({
              ...step,
              active: presetPattern ? presetPattern[i % presetPattern.length] : false,
            })),
          };
        }));
        
        toast({ 
          title: '🎵 AI Beat Generated!', 
          description: `${selectedGenre} beat at ${bpm} BPM` 
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate AI beat',
        variant: 'destructive',
      });
    },
  });
  
  const audioCtx = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => { audioCtx.current?.close(); };
  }, []);

  useEffect(() => { if (tempo) setBpm(Math.round(tempo)); }, [tempo]);

  const saveHistory = useCallback(() => {
    const copy = JSON.parse(JSON.stringify(tracks));
    setHistory(h => [...h.slice(0, historyIdx + 1), copy].slice(-30));
    setHistoryIdx(i => i + 1);
  }, [tracks, historyIdx]);

  const undo = () => {
    if (historyIdx > 0) {
      setTracks(JSON.parse(JSON.stringify(history[historyIdx - 1])));
      setHistoryIdx(i => i - 1);
    }
  };

  const redo = () => {
    if (historyIdx < history.length - 1) {
      setTracks(JSON.parse(JSON.stringify(history[historyIdx + 1])));
      setHistoryIdx(i => i + 1);
    }
  };

  const playSound = useCallback(async (id: string, vel: number, vol: number) => {
    if (!audioCtx.current) return;
    const ctx = audioCtx.current;
    if (ctx.state === 'suspended') await ctx.resume();
    const gain = ctx.createGain();
    gain.gain.value = (vel / 127) * (vol / 100) * (masterVol / 100);
    gain.connect(ctx.destination);

    if (id === 'kick') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      o.connect(g); g.connect(gain); o.start(); o.stop(ctx.currentTime + 0.3);
    } else if (id === 'snare' || id === 'clap') {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
      const s = ctx.createBufferSource(); s.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      s.connect(g); g.connect(gain); s.start(); s.stop(ctx.currentTime + 0.15);
    } else if (id === 'hihat') {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      s.connect(f); f.connect(gain); s.start(); s.stop(ctx.currentTime + 0.05);
    } else if (id === 'openhat') {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.2);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
      s.connect(f); f.connect(gain); s.start(); s.stop(ctx.currentTime + 0.25);
    } else if (id === 'tom') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(200, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      o.connect(g); g.connect(gain); o.start(); o.stop(ctx.currentTime + 0.25);
    } else if (id === 'crash' || id === 'perc') {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 0.5);
      const s = ctx.createBufferSource(); s.buffer = buf;
      s.connect(gain); s.start(); s.stop(ctx.currentTime + 0.8);
    }
  }, [masterVol]);

  useEffect(() => {
    if (!isPlaying) return;
    const baseMs = (60 / bpm / 4) * 1000;
    const ms = currentStep % 2 === 1 && swing > 0 ? baseMs + baseMs * swing / 100 * 0.33 : baseMs;
    
    intervalRef.current = setTimeout(() => {
      const hasSolo = tracks.some(t => t.solo);
      tracks.forEach(track => {
        const step = track.pattern[currentStep];
        // FIXED: Check mute/solo logic correctly
        const shouldPlay = step?.active && 
                          !track.muted && 
                          (!hasSolo || track.solo);
        
        if (shouldPlay) {
          if (Math.random() * 100 <= step.probability) {
            const backbeat = currentStep % 4 === 2 || currentStep % 4 === 3;
            const boost = groove > 0 ? 1 + (groove / 200) * (backbeat ? 1 : -0.3) : 1;
            playSound(track.id, Math.min(127, step.velocity * boost), track.volume);
          }
        }
      });
      setCurrentStep(s => (s + 1) % patternLength);
    }, ms);
    
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); };
  }, [isPlaying, currentStep, tracks, bpm, swing, groove, patternLength, playSound]);

  const toggleStep = (ti: number, si: number) => {
    saveHistory();
    setTracks(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[ti].pattern[si].active = !copy[ti].pattern[si].active;
      if (copy[ti].pattern[si].active) playSound(copy[ti].id, 100, copy[ti].volume);
      return copy;
    });
    setSelectedStep({ t: ti, s: si });
  };

  const loadPreset = (name: string) => {
    saveHistory();
    const p = PRESETS[name];
    if (!p) return;
    setTracks(prev => prev.map(t => ({
      ...t,
      pattern: t.pattern.map((step, i) => ({
        ...step,
        active: p[t.id] ? p[t.id][i % p[t.id].length] : false,
      })),
    })));
    toast({ title: `🎵 ${name}`, description: 'Pattern loaded' });
  };

  const clearAll = () => { saveHistory(); setTracks(initTracks(patternLength)); };
  const randomize = () => {
    saveHistory();
    setTracks(prev => prev.map(t => ({
      ...t,
      pattern: t.pattern.map(() => ({
        active: Math.random() < (t.id === 'kick' || t.id === 'snare' ? 0.2 : 0.3),
        velocity: 70 + Math.floor(Math.random() * 57),
        probability: 80 + Math.floor(Math.random() * 20),
      })),
    })));
    toast({ title: '🎲 Randomized!' });
  };

  const changeLength = (len: number) => {
    setPatternLength(len);
    setTracks(prev => prev.map(t => ({
      ...t,
      pattern: Array(len).fill(null).map((_, i) => t.pattern[i] || createEmptyStep()),
    })));
  };

  return (
    <Card className="p-4 bg-gray-900 border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          🥁 Pro Beat Maker
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{bpm} BPM</Badge>
          <Badge variant="outline">Step {currentStep + 1}/{patternLength}</Badge>
        </div>
      </div>

      {/* Transport & Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button onClick={() => { setIsPlaying(!isPlaying); if (isPlaying) setCurrentStep(0); }}
          className={isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}>
          {isPlaying ? <Square className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
          {isPlaying ? 'Stop' : 'Play'}
        </Button>
        
        {/* AI Generation Controls */}
        <div className="flex items-center gap-2 border-l border-gray-600 pl-2">
          <AIProviderSelector value={aiProvider} onValueChange={setAiProvider} />
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Hip-Hop', 'Trap', 'House', 'Techno', 'D&B', 'Reggaeton', 'Boom Bap', 'Lo-Fi'].map(g => 
                <SelectItem key={g} value={g}>{g}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => generateBeatMutation.mutate()}
            disabled={generateBeatMutation.isPending}
            className="bg-purple-600 hover:bg-purple-500"
          >
            <Wand2 className="w-4 h-4 mr-1" />
            {generateBeatMutation.isPending ? 'Generating...' : 'AI Generate'}
          </Button>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline"><ChevronDown className="w-4 h-4 mr-1" />Presets</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-800 border-gray-700">
            <DropdownMenuLabel>Genre Presets</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.keys(PRESETS).map(name => (
              <DropdownMenuItem key={name} onClick={() => loadPreset(name)}>{name}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={String(patternLength)} onValueChange={v => changeLength(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[8, 16, 32, 64].map(n => <SelectItem key={n} value={String(n)}>{n} steps</SelectItem>)}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={randomize}><Shuffle className="w-4 h-4 mr-1" />Random</Button>
        <Button variant="outline" onClick={clearAll}><RotateCcw className="w-4 h-4 mr-1" />Clear</Button>
        <Button variant="outline" onClick={undo} disabled={historyIdx <= 0}><Undo2 className="w-4 h-4" /></Button>
        <Button variant="outline" onClick={redo} disabled={historyIdx >= history.length - 1}><Redo2 className="w-4 h-4" /></Button>
      </div>

      {/* Master Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-800 rounded">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Master</span>
          <Slider value={[masterVol]} onValueChange={v => setMasterVol(v[0])} max={100} className="w-20" />
          <span className="text-xs w-8">{masterVol}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Swing</span>
          <Slider value={[swing]} onValueChange={v => setSwing(v[0])} max={100} className="w-20" />
          <span className="text-xs w-8">{swing}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Groove</span>
          <Slider value={[groove]} onValueChange={v => setGroove(v[0])} max={100} className="w-20" />
          <span className="text-xs w-8">{groove}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">BPM</span>
          <input type="number" value={bpm} onChange={e => setBpm(Number(e.target.value))}
            className="w-16 bg-gray-700 rounded px-2 py-1 text-sm" min={40} max={240} />
        </div>
      </div>

      {/* Selected Step Editor */}
      {selectedStep && (
        <div className="mb-4 p-3 bg-gray-800 rounded border border-gray-600">
          <div className="text-sm text-white mb-2">
            {tracks[selectedStep.t].name} — Step {selectedStep.s + 1}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Velocity</span>
              <Slider value={[tracks[selectedStep.t].pattern[selectedStep.s].velocity]}
                onValueChange={v => setTracks(prev => {
                  const c = JSON.parse(JSON.stringify(prev));
                  c[selectedStep.t].pattern[selectedStep.s].velocity = v[0];
                  return c;
                })} max={127} className="w-24" />
              <span className="text-xs w-8">{tracks[selectedStep.t].pattern[selectedStep.s].velocity}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Probability</span>
              <Slider value={[tracks[selectedStep.t].pattern[selectedStep.s].probability]}
                onValueChange={v => setTracks(prev => {
                  const c = JSON.parse(JSON.stringify(prev));
                  c[selectedStep.t].pattern[selectedStep.s].probability = v[0];
                  return c;
                })} max={100} className="w-24" />
              <span className="text-xs w-8">{tracks[selectedStep.t].pattern[selectedStep.s].probability}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Step Grid */}
      <div className="space-y-2 overflow-x-auto">
        {tracks.map((track, ti) => (
          <div key={track.id} className="flex items-center gap-2">
            {/* Track Controls */}
            <div className="flex items-center gap-1 w-28 flex-shrink-0">
              <div className={`w-3 h-3 rounded ${track.color}`} />
              <span className="text-xs font-medium text-white truncate flex-1">{track.name}</span>
              <Button size="sm" variant={track.muted ? 'destructive' : 'outline'}
                onClick={() => setTracks(p => { const c = [...p]; c[ti] = {...c[ti], muted: !c[ti].muted}; return c; })}
                className="h-5 w-5 p-0 text-xs">M</Button>
              <Button size="sm" variant={track.solo ? 'default' : 'outline'}
                onClick={() => setTracks(p => { const c = [...p]; c[ti] = {...c[ti], solo: !c[ti].solo}; return c; })}
                className="h-5 w-5 p-0 text-xs">S</Button>
            </div>

            {/* Steps */}
            <div className="flex gap-0.5">
              {track.pattern.map((step, si) => (
                <button key={si} onClick={() => toggleStep(ti, si)}
                  className={`w-7 h-7 rounded text-xs font-bold transition-all
                    ${step.active ? `${track.color} text-white shadow-lg` : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}
                    ${currentStep === si && isPlaying ? 'ring-2 ring-yellow-400 scale-110' : ''}
                    ${selectedStep?.t === ti && selectedStep?.s === si ? 'ring-2 ring-blue-400' : ''}
                    ${si % 4 === 0 ? 'ml-1' : ''}`}>
                  {si + 1}
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1 w-20 flex-shrink-0">
              <Slider value={[track.volume]} onValueChange={v => setTracks(p => {
                const c = [...p]; c[ti] = {...c[ti], volume: v[0]}; return c;
              })} max={100} className="w-14" />
              <span className="text-xs w-6">{track.volume}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Export */}
      <div className="mt-4 flex gap-2">
        <Button className="bg-green-600 hover:bg-green-500" onClick={() => {
          // Convert tracks to pattern format
          const pattern: Record<string, boolean[]> = {};
          tracks.forEach(t => {
            pattern[t.id] = t.pattern.map(s => s.active);
          });
          
          // Send to parent component
          onPatternChange?.(tracks, bpm);
          
          // Central communication - dispatch event for Multi-Track Player
          const event = new CustomEvent('openStudioTool', {
            detail: { tool: 'multitrack', data: { pattern, bpm, type: 'beat' } }
          });
          window.dispatchEvent(event);
          
          // Also send to timeline directly
          const timelineEvent = new CustomEvent('addBeatToTimeline', {
            detail: { pattern, bpm, tracks }
          });
          window.dispatchEvent(timelineEvent);
          
          toast({ title: '✅ Pattern Sent', description: 'Beat sent to timeline & Multi-Track' });
        }}>
          <Send className="w-4 h-4 mr-1" />Send to Timeline
        </Button>
        
        <Button className="bg-blue-600 hover:bg-blue-500" onClick={() => {
          // Route to Mixer
          const event = new CustomEvent('openStudioTool', {
            detail: { tool: 'mixer', data: { tracks, bpm, type: 'beat' } }
          });
          window.dispatchEvent(event);
          toast({ title: '🎛️ Routed to Mixer', description: 'Beat sent to Mix Studio' });
        }}>
          <RotateCcw className="w-4 h-4 mr-1" />Route to Mixer
        </Button>
      </div>
    </Card>
  );
}
