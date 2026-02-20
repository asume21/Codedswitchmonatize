import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Music, Loader2, Sparkles, Zap, Download, AlertTriangle,
  Copy, Check, ChefHat, Lightbulb, Clock, Save,
} from 'lucide-react';
import { PROVIDER_CAPABILITIES, resolveGenerationConstraints } from '../../../../shared/aiProviderCapabilities';

interface GenerationVariation {
  audio_url: string;
  seed: number;
  variation: number;
}

interface GeneratedSong {
  success: boolean;
  audioUrl: string;
  title: string;
  description: string;
  genre: string;
  prompt: string;
  provider: string;
  seed?: number;
  duration?: number;
  variations?: GenerationVariation[];
  sections?: Array<{ audio_url: string; section: string; sectionIndex: number }>;
  stems?: {
    vocals?: string;
    instrumental?: string;
    drums?: string;
    bass?: string;
    other?: string;
  };
  stemChannelMapping?: Record<string, string>;
  stemWarning?: string;
  requestId?: string;
  requestedProvider?: string | null;
  effectiveProvider?: string;
  rerouteReason?: string | null;
  providerWarnings?: string[];
  generationOutcome?: 'success' | 'fallback' | 'error';
}

interface GenerationMeta {
  requestedProvider?: string | null;
  effectiveProvider?: string | null;
  requestId?: string | null;
  outcome?: 'success' | 'fallback' | 'error';
  stemWarning?: string | null;
}

interface AIGenerationRouteMetrics {
  total: number;
  success: number;
  error: number;
  fallback: number;
  averageLatencyMs: number;
  fallbackRate: number;
}

interface AIGenerationMetricsSnapshot {
  startedAt: string;
  totals: AIGenerationRouteMetrics;
  routes: Record<string, AIGenerationRouteMetrics>;
}

interface StarterRecipe {
  label: string;
  description: string;
  genre: string;
  mood: string;
  bpm: number;
  key: string;
  style: string;
  instruments: Record<string, boolean>;
  prompt: string;
  duration: number;
}

const STARTER_RECIPES: StarterRecipe[] = [
  {
    label: 'Boom-Bap Classic',
    description: 'Dusty 90s hip-hop with vinyl crackle',
    genre: 'Hip-Hop', mood: 'Dark', bpm: 90, key: 'C Major', style: '90s boom-bap, dusty vinyl, golden era',
    instruments: { piano: false, guitar: false, bass: true, drums: true, synth: false, strings: false, pads: true, brass: false },
    prompt: 'Classic 90s boom-bap hip-hop beat with dusty vinyl drums, deep sub bass, and warm Rhodes pads',
    duration: 60,
  },
  {
    label: 'Trap Hard',
    description: 'Modern trap with 808s and hi-hats',
    genre: 'Hip-Hop', mood: 'Aggressive', bpm: 140, key: 'F Major', style: 'modern trap, hard-hitting, dark',
    instruments: { piano: false, guitar: false, bass: true, drums: true, synth: true, strings: false, pads: false, brass: false },
    prompt: 'Hard-hitting modern trap beat with rolling 808 bass, crisp hi-hat patterns, and dark synth melodies',
    duration: 60,
  },
  {
    label: 'Lo-fi Chill',
    description: 'Relaxed lo-fi beats to study to',
    genre: 'Electronic', mood: 'Chill', bpm: 75, key: 'Eb Major', style: 'lo-fi, jazzy, warm analog',
    instruments: { piano: true, guitar: true, bass: true, drums: true, synth: false, strings: false, pads: true, brass: false },
    prompt: 'Relaxing lo-fi hip-hop beat with jazzy piano chords, warm guitar, vinyl crackle, and mellow drums',
    duration: 60,
  },
  {
    label: 'Pop Anthem',
    description: 'Uplifting pop with big chorus energy',
    genre: 'Pop', mood: 'Uplifting', bpm: 120, key: 'G Major', style: 'modern pop, radio-ready, polished',
    instruments: { piano: true, guitar: true, bass: true, drums: true, synth: true, strings: true, pads: false, brass: false },
    prompt: 'Uplifting pop anthem with driving drums, bright synths, acoustic guitar, and a powerful singalong chorus',
    duration: 120,
  },
  {
    label: 'Dark Synthwave',
    description: 'Retro 80s synths with modern punch',
    genre: 'Electronic', mood: 'Mysterious', bpm: 110, key: 'A Major', style: 'synthwave, retro 80s, neon',
    instruments: { piano: false, guitar: false, bass: true, drums: true, synth: true, strings: false, pads: true, brass: false },
    prompt: 'Dark synthwave track with pulsing analog synths, gated reverb drums, deep bass, and retro 80s atmosphere',
    duration: 90,
  },
  {
    label: 'R&B Smooth',
    description: 'Silky R&B with lush harmonies',
    genre: 'R&B', mood: 'Romantic', bpm: 85, key: 'Db Major', style: 'modern R&B, smooth, lush',
    instruments: { piano: true, guitar: true, bass: true, drums: true, synth: false, strings: true, pads: true, brass: false },
    prompt: 'Smooth modern R&B track with silky Rhodes piano, warm bass guitar, lush string pads, and crisp snare',
    duration: 90,
  },
  {
    label: 'Rock Energy',
    description: 'Driving rock with electric guitars',
    genre: 'Rock', mood: 'Energetic', bpm: 130, key: 'E Major', style: 'rock, driving, powerful',
    instruments: { piano: false, guitar: true, bass: true, drums: true, synth: false, strings: false, pads: false, brass: false },
    prompt: 'Energetic rock song with distorted electric guitars, driving power drums, punchy bass, and a catchy riff',
    duration: 90,
  },
  {
    label: 'Jazz Lounge',
    description: 'Sophisticated jazz with live feel',
    genre: 'Jazz', mood: 'Dreamy', bpm: 100, key: 'Bb Major', style: 'jazz, sophisticated, live feel',
    instruments: { piano: true, guitar: true, bass: true, drums: true, synth: false, strings: false, pads: false, brass: true },
    prompt: 'Sophisticated jazz lounge track with walking upright bass, brushed drums, warm piano comping, and muted trumpet',
    duration: 60,
  },
];

const BEST_TAKE_CACHE_KEY = 'pro-audio-best-take-v1';
const PRO_AUDIO_SETTINGS_KEY = 'pro-audio-settings-v1';

const STRUCTURE_MAP: Record<string, Array<{name: string; duration: number; energy: string}>> = {
  'verse-hook': [
    { name: 'verse', duration: 20, energy: 'medium' },
    { name: 'hook', duration: 15, energy: 'high' },
  ],
  'full-song': [
    { name: 'intro', duration: 10, energy: 'low' },
    { name: 'verse', duration: 20, energy: 'medium' },
    { name: 'hook', duration: 15, energy: 'high' },
    { name: 'verse2', duration: 20, energy: 'medium' },
    { name: 'hook2', duration: 15, energy: 'high' },
    { name: 'outro', duration: 10, energy: 'low' },
  ],
  'intro-verse-chorus-outro': [
    { name: 'intro', duration: 8, energy: 'low' },
    { name: 'verse', duration: 16, energy: 'medium' },
    { name: 'pre-chorus', duration: 8, energy: 'medium' },
    { name: 'chorus', duration: 16, energy: 'high' },
    { name: 'verse2', duration: 16, energy: 'medium' },
    { name: 'chorus2', duration: 16, energy: 'high' },
    { name: 'bridge', duration: 8, energy: 'low' },
    { name: 'final-chorus', duration: 16, energy: 'high' },
    { name: 'outro', duration: 8, energy: 'low' },
  ],
};

const GENRES = ['Hip-Hop', 'Pop', 'Rock', 'Electronic', 'Jazz', 'Classical', 'R&B', 'Country', 'Blues', 'Reggae', 'Folk', 'Indie'];
const MOODS = ['Dark', 'Uplifting', 'Energetic', 'Chill', 'Melancholic', 'Aggressive', 'Dreamy', 'Mysterious', 'Romantic', 'Epic'];
const KEYS = ['C Major', 'G Major', 'D Major', 'A Major', 'E Major', 'B Major', 'F# Major', 'C# Major', 'F Major', 'Bb Major', 'Eb Major', 'Ab Major', 'Db Major', 'Gb Major', 'Cb Major'];

export function ProAudioGenerator() {
  const { toast } = useToast();

  // Form state
  const [songDescription, setSongDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [aiProvider, setAiProvider] = useState('suno');
  const [duration, setDuration] = useState([60]);
  const [bpm, setBpm] = useState([120]);
  const [key, setKey] = useState('C Major');
  const [style, setStyle] = useState('');
  const [includeVocals, setIncludeVocals] = useState(false);

  // Advanced generation controls
  const [seed, setSeed] = useState<number | ''>('');
  const [variations, setVariations] = useState(1);
  const [melodyGuideUrl, setMelodyGuideUrl] = useState('');
  const [songStructure, setSongStructure] = useState('auto');
  const [generateMultiple, setGenerateMultiple] = useState(false);
  const [autoSeparateStems, setAutoSeparateStems] = useState(false);
  const [stemCount, setStemCount] = useState<2 | 4>(4);
  const [autoImportStems, setAutoImportStems] = useState(true);
  const [requireStems, setRequireStems] = useState(false);

  // Instruments state — drums + bass + keys default on
  const [instruments, setInstruments] = useState({
    piano: true,
    guitar: false,
    bass: true,
    drums: true,
    synth: false,
    strings: false,
    pads: false,
    brass: false,
  });

  // Generated song state
  const [generatedSong, setGeneratedSong] = useState<GeneratedSong | null>(null);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationMeta, setGenerationMeta] = useState<GenerationMeta | null>(null);
  const [aiMetrics, setAiMetrics] = useState<AIGenerationMetricsSnapshot | null>(null);
  const [aiMetricsError, setAiMetricsError] = useState<string | null>(null);

  // Results UI state
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Derived provider info
  const providerCapability = PROVIDER_CAPABILITIES[(aiProvider as keyof typeof PROVIDER_CAPABILITIES)] || PROVIDER_CAPABILITIES.suno;
  const providerMaxSingle = providerCapability.maxDuration;
  const providerBpmRange = providerCapability.bpmRange;
  const isTextOnlyProvider = !providerCapability.canGenerateAudio;
  const providerLabel = providerCapability.label || aiProvider;
  const providerEst = providerCapability.estimatedLatency || '15-60s';
  const effectiveVariations = generateMultiple ? 3 : variations;
  const getMaxDuration = useCallback(() => {
    if (songStructure !== 'auto') return 300;
    return providerMaxSingle;
  }, [songStructure, providerMaxSingle]);
  const effectiveDuration = Math.min(duration[0], songStructure === 'auto' ? providerMaxSingle || 30 : 300);
  const effectiveBpm = Math.max(providerBpmRange.min || bpm[0], Math.min(providerBpmRange.max || bpm[0], bpm[0]));
  const isDurationCapped = duration[0] > getMaxDuration() && songStructure === 'auto' && providerMaxSingle > 0;
  const isBpmCapped = !isTextOnlyProvider && (bpm[0] < providerBpmRange.min || bpm[0] > providerBpmRange.max);

  const resolveEffectiveProvider = useCallback(() => {
    return resolveGenerationConstraints({
      provider: aiProvider,
      duration: duration[0],
      bpm: bpm[0],
      variations: effectiveVariations,
      sectionCount: STRUCTURE_MAP[songStructure]?.length || 0,
      requireGuideMelody: Boolean(melodyGuideUrl),
    });
  }, [aiProvider, duration, bpm, effectiveVariations, songStructure, melodyGuideUrl]);

  const buildTakeCacheKey = useCallback((payload: {
    prompt: string;
    provider: string;
    seed?: number;
    bpm: number;
    duration: number;
    structureKey: string;
  }) => {
    return [
      payload.provider,
      payload.seed ?? 'auto-seed',
      payload.bpm,
      payload.duration,
      payload.structureKey,
      payload.prompt.trim().toLowerCase(),
    ].join('::');
  }, []);

  const loadAIMetrics = useCallback(async () => {
    try {
      const response = await apiRequest('GET', '/api/ai/generation-metrics');
      if (!response.ok) {
        setAiMetricsError(`Metrics unavailable (${response.status})`);
        return;
      }

      const body = await response.json();
      setAiMetrics(body?.metrics || null);
      setAiMetricsError(null);
    } catch {
      setAiMetricsError('Metrics unavailable');
    }
  }, []);

  useEffect(() => {
    void loadAIMetrics();
  }, [loadAIMetrics]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRO_AUDIO_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        songStructure: string;
        variations: number;
        generateMultiple: boolean;
        seed: number | '';
        melodyGuideUrl: string;
        autoSeparateStems: boolean;
        stemCount: 2 | 4;
        autoImportStems: boolean;
        requireStems: boolean;
      }>;

      if (typeof parsed.songStructure === 'string' && (parsed.songStructure === 'auto' || Boolean(STRUCTURE_MAP[parsed.songStructure]))) {
        setSongStructure(parsed.songStructure);
      }
      if (typeof parsed.variations === 'number' && parsed.variations >= 1 && parsed.variations <= 4) {
        setVariations(parsed.variations);
      }
      if (typeof parsed.generateMultiple === 'boolean') {
        setGenerateMultiple(parsed.generateMultiple);
      }
      if (typeof parsed.seed === 'number' || parsed.seed === '') {
        setSeed(parsed.seed);
      }
      if (typeof parsed.melodyGuideUrl === 'string') {
        setMelodyGuideUrl(parsed.melodyGuideUrl);
      }
      if (typeof parsed.autoSeparateStems === 'boolean') {
        setAutoSeparateStems(parsed.autoSeparateStems);
      }
      if (parsed.stemCount === 2 || parsed.stemCount === 4) {
        setStemCount(parsed.stemCount);
      }
      if (typeof parsed.autoImportStems === 'boolean') {
        setAutoImportStems(parsed.autoImportStems);
      }
      if (typeof parsed.requireStems === 'boolean') {
        setRequireStems(parsed.requireStems);
      }
    } catch {
      // ignore corrupted persisted settings
    }
  }, []);

  useEffect(() => {
    try {
      const payload = {
        songStructure,
        variations,
        generateMultiple,
        seed,
        melodyGuideUrl,
        autoSeparateStems,
        stemCount,
        autoImportStems,
        requireStems,
      };
      localStorage.setItem(PRO_AUDIO_SETTINGS_KEY, JSON.stringify(payload));
    } catch {
      // non-blocking persistence
    }
  }, [songStructure, variations, generateMultiple, seed, melodyGuideUrl, autoSeparateStems, stemCount, autoImportStems, requireStems]);

  const persistBestTake = useCallback((cacheKey: string, song: GeneratedSong, selectedIndex: number) => {
    try {
      const raw = localStorage.getItem(BEST_TAKE_CACHE_KEY);
      const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
      parsed[cacheKey] = {
        updatedAt: Date.now(),
        selectedVariation: selectedIndex,
        provider: song.provider,
        audioUrl: song.audioUrl,
        seed: song.seed,
      };

      localStorage.setItem(BEST_TAKE_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // non-blocking cache write
    }
  }, []);

  // Instrument validation
  const selectedInstrumentsList = useMemo(
    () => Object.keys(instruments).filter(k => instruments[k as keyof typeof instruments]),
    [instruments],
  );
  const hasInstruments = selectedInstrumentsList.length > 0;

  // Apply a starter recipe
  const applyRecipe = useCallback((recipe: StarterRecipe) => {
    setSongDescription(recipe.prompt);
    setGenre(recipe.genre);
    setMood(recipe.mood);
    setBpm([recipe.bpm]);
    setKey(recipe.key);
    setStyle(recipe.style);
    setDuration([recipe.duration]);
    setInstruments(recipe.instruments as typeof instruments);
  }, []);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (isTextOnlyProvider) {
        throw new Error(`${providerLabel} cannot generate audio. Pick an audio provider like Suno or MusicGen.`);
      }
      if (!hasInstruments) {
        throw new Error('Select at least one instrument before generating.');
      }

      const resolved = resolveEffectiveProvider();
      const {
        effectiveProvider,
        rerouteReason,
        duration: constrainedDuration,
        bpm: constrainedBpm,
        variations: constrainedVariations,
        warnings,
      } = resolved;
      if (rerouteReason) {
        toast({
          title: 'Provider Auto-Routed',
          description: rerouteReason,
        });
      }
      if (warnings.length > 0) {
        toast({
          title: 'Provider Constraints Applied',
          description: warnings.join(' '),
        });
      }

      const estTime = (PROVIDER_CAPABILITIES[effectiveProvider]?.estimatedLatency || providerEst);
      const effectiveLabel = PROVIDER_CAPABILITIES[effectiveProvider]?.label || effectiveProvider;
      setGenerationMeta({
        requestedProvider: aiProvider,
        effectiveProvider,
      });
      setGenerationProgress(`Routing request to ${effectiveLabel} (est. ${estTime})...`);
      setSelectedVariation(0);

      const payload: Record<string, any> = {
        songDescription,
        genre,
        mood,
        aiProvider: effectiveProvider,
        duration: constrainedDuration ?? effectiveDuration,
        bpm: constrainedBpm ?? effectiveBpm,
        key,
        style,
        includeVocals,
        instruments: selectedInstrumentsList,
        seed: typeof seed === 'number' ? seed : undefined,
        variations: constrainedVariations,
        melodyUrl: melodyGuideUrl || undefined,
        structure: STRUCTURE_MAP[songStructure] || undefined,
        autoSeparateStems,
        stemCount,
        requireStems,
      };

      if (constrainedVariations > 1) {
        setGenerationProgress(`${effectiveLabel}: generating ${constrainedVariations} variations (est. ${estTime})...`);
      } else if (STRUCTURE_MAP[songStructure]) {
        setGenerationProgress(`${effectiveLabel}: generating ${STRUCTURE_MAP[songStructure].length} sections (est. ${estTime})...`);
      } else {
        setGenerationProgress(`${effectiveLabel}: generating audio (est. ${estTime})...`);
      }

      const response = await apiRequest('POST', '/api/music/generate-complete', payload);

      if (!response.ok) {
        let detail = 'Failed to generate song';
        let requestId: string | null = null;
        let effectiveProvider: string | null = null;
        try {
          const errBody = await response.json();
          detail = errBody.message || errBody.error || detail;
          requestId = errBody.requestId || null;
          effectiveProvider = errBody.effectiveProvider || errBody.provider || null;
        } catch { /* response wasn't JSON */ }
        const suffix = [
          effectiveProvider ? `provider=${effectiveProvider}` : null,
          requestId ? `requestId=${requestId}` : null,
        ].filter(Boolean).join(' | ');
        throw new Error(`${providerLabel} (${response.status}): ${detail}${suffix ? ` [${suffix}]` : ''}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedSong(data);
      setGenerationProgress('');
      setGenerationMeta({
        requestedProvider: data.requestedProvider || aiProvider,
        effectiveProvider: data.effectiveProvider || data.provider || null,
        requestId: data.requestId || null,
        outcome: (data.generationOutcome as 'success' | 'fallback' | 'error' | undefined) || 'success',
        stemWarning: data.stemWarning || null,
      });

      if ((data.generationOutcome as string) === 'fallback') {
        toast({
          title: 'Fallback Generation Used',
          description: 'The primary provider path did not fully succeed, so a fallback provider path was used.',
        });
      }
      setSavedToLibrary(false);
      setLinkCopied(false);
      const varCount = data.variations?.length || 0;
      const secCount = data.sections?.length || 0;
      const extra = varCount > 1 ? ` with ${varCount} variations` : secCount > 1 ? ` with ${secCount} sections` : '';
      toast({
        title: 'Song Generated!',
        description: `Ready to play via ${data.provider || providerLabel}${extra}`,
      });

      if (Array.isArray(data?.providerWarnings) && data.providerWarnings.length > 0) {
        toast({
          title: 'Generation Constraints Applied',
          description: data.providerWarnings.join(' '),
        });
      }

      if (data?.stemWarning) {
        toast({
          title: 'Stem Separation Notice',
          description: String(data.stemWarning),
          variant: 'destructive',
        });
      }

      if (autoSeparateStems && autoImportStems && data?.stems) {
        const stemOrder: Array<keyof NonNullable<GeneratedSong['stems']>> = ['vocals', 'drums', 'bass', 'other', 'instrumental'];
        const importableStems = stemOrder
          .map((stemName) => ({ stemName, url: data.stems?.[stemName] }))
          .filter((entry) => typeof entry.url === 'string' && entry.url.length > 0);

        importableStems.forEach((entry) => {
          const mappedTrackId = data?.stemChannelMapping?.[String(entry.stemName)] || `track-stem-${String(entry.stemName)}`;
          window.dispatchEvent(new CustomEvent('studio:importAudioTrack', {
            detail: {
              trackId: mappedTrackId,
              name: `${data.title || 'Generated Song'} - ${String(entry.stemName).toUpperCase()}`,
              audioUrl: entry.url,
            }
          }));
        });

        if (importableStems.length > 0) {
          toast({
            title: 'Stems Imported to Multi-Track',
            description: `${importableStems.length} stem track${importableStems.length > 1 ? 's' : ''} added automatically.`,
          });
        }
      }

      const cacheKey = buildTakeCacheKey({
        prompt: songDescription,
        provider: data.provider || aiProvider,
        seed: typeof data.seed === 'number' ? data.seed : (typeof seed === 'number' ? seed : undefined),
        bpm: effectiveBpm,
        duration: effectiveDuration,
        structureKey: songStructure,
      });
      persistBestTake(cacheKey, data as GeneratedSong, 0);
      void loadAIMetrics();
    },
    onError: (error) => {
      setGenerationProgress('');
      const message = String(error?.message || 'Generation failed');
      const requestIdMatch = message.match(/requestId=([^\]\s|]+)/i);
      const providerMatch = message.match(/provider=([^\]\s|]+)/i);
      setGenerationMeta((prev) => ({
        requestedProvider: prev?.requestedProvider || aiProvider,
        effectiveProvider: providerMatch?.[1] || prev?.effectiveProvider || null,
        requestId: requestIdMatch?.[1] || prev?.requestId || null,
        outcome: 'error',
        stemWarning: prev?.stemWarning || null,
      }));
      toast({
        title: `Generation Failed (${providerLabel})`,
        description: message,
        variant: 'destructive',
      });
      void loadAIMetrics();
    },
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleInstrumentChange = (instrument: string, checked: boolean) => {
    setInstruments(prev => ({ ...prev, [instrument]: checked }));
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
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

  const handleAudioEnded = () => { setIsPlaying(false); setCurrentTime(0); };

  const handleDownload = async () => {
    if (!generatedSong?.audioUrl) return;
    try {
      const response = await fetch(generatedSong.audioUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText || 'File not found'}`);
      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Downloaded file is empty — the audio may have expired.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedSong.title || 'generated-song'}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Download Started', description: 'Your song is downloading...' });
    } catch (err: any) {
      toast({ title: 'Download Failed', description: err?.message || 'Could not download the audio file.', variant: 'destructive' });
    }
  };

  const handleCopyLink = async () => {
    if (!generatedSong?.audioUrl) return;
    try {
      await navigator.clipboard.writeText(generatedSong.audioUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      toast({ title: 'Copy Failed', description: 'Could not copy link to clipboard.', variant: 'destructive' });
    }
  };

  const handleSaveToLibrary = async () => {
    if (!generatedSong) return;
    try {
      const response = await apiRequest('POST', '/api/songs/upload', {
        title: generatedSong.title,
        genre: generatedSong.genre,
        songURL: generatedSong.audioUrl,
        description: generatedSong.description,
      });
      if (!response.ok) {
        let detail = 'Could not save to library';
        try {
          const errBody = await response.json();
          detail = errBody.message || errBody.error || detail;
        } catch { /* not JSON */ }
        throw new Error(detail);
      }
      setSavedToLibrary(true);
      toast({ title: 'Saved to Library', description: 'Song added to your library.' });
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err?.message || 'Could not save to library.', variant: 'destructive' });
    }
  };

  const handleNewGeneration = () => {
    setGeneratedSong(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    setSavedToLibrary(false);
    setLinkCopied(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Pro Audio Generator</h1>
              <p className="text-muted-foreground mt-1">Pick a genre, mood, and length — we'll handle the rest.</p>
            </div>
            <div className="flex gap-2 items-center">
              <Badge variant="secondary">{providerLabel}</Badge>
              <Badge variant="outline">
                {providerMaxSingle > 0 ? `Up to ${formatDuration(providerMaxSingle)}` : 'Text only'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {!generatedSong ? (
          <div className="space-y-6">
            {/* Starter Recipes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ChefHat className="h-4 w-4" />
                  Quick Start — pick a recipe or describe your own below
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {STARTER_RECIPES.map((recipe) => (
                    <button
                      key={recipe.label}
                      onClick={() => applyRecipe(recipe)}
                      className="text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                    >
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">{recipe.label}</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">{recipe.description}</span>
                      <span className="block text-[10px] text-muted-foreground/70 mt-1">{recipe.bpm} BPM &middot; {recipe.key}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Main Form — Accordion layout */}
            <Card>
              <CardContent className="pt-6">
                <Accordion type="multiple" defaultValue={['basics']} className="w-full">
                  {/* BASICS — always visible by default */}
                  <AccordionItem value="basics">
                    <AccordionTrigger className="text-base font-semibold hover:no-underline">
                      Basics
                    </AccordionTrigger>
                    <AccordionContent className="space-y-5 pt-2">
                      {/* Song Description */}
                      <div>
                        <Label className="mb-2 block font-medium">Describe your song</Label>
                        <Textarea
                          value={songDescription}
                          onChange={(e) => setSongDescription(e.target.value)}
                          placeholder="e.g. Dark trap beat with rolling 808s and eerie synth melodies..."
                          className="min-h-[80px] resize-none"
                        />
                        <div className="flex items-start gap-1.5 mt-2 text-[11px] text-muted-foreground">
                          <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>Great prompts include: <strong>genre + era + instruments + mix style</strong> (e.g., "90s boom-bap with dusty vinyl drums, Rhodes keys, fat sub bass, warm analog mix")</span>
                        </div>
                      </div>

                      {/* Genre, Mood, Provider */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="mb-1.5 block text-sm">Genre</Label>
                          <Select value={genre} onValueChange={setGenre}>
                            <SelectTrigger><SelectValue placeholder="Select genre" /></SelectTrigger>
                            <SelectContent>
                              {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="mb-1.5 block text-sm">Mood</Label>
                          <Select value={mood} onValueChange={setMood}>
                            <SelectTrigger><SelectValue placeholder="Select mood" /></SelectTrigger>
                            <SelectContent>
                              {MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="mb-1.5 block text-sm">AI Provider</Label>
                          <AIProviderSelector value={aiProvider} onValueChange={setAiProvider} />
                        </div>
                      </div>

                      {/* Duration, BPM, Key */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="mb-1.5 block text-sm">Duration ({formatDuration(duration[0])})</Label>
                          <Slider value={duration} onValueChange={setDuration} max={Math.max(providerMaxSingle, 30)} min={10} step={10} className="mt-2" />
                          {isDurationCapped && (
                            <p className="text-[10px] text-yellow-400 mt-1">{providerLabel} max: {formatDuration(providerMaxSingle)}. Use Song Structure for longer.</p>
                          )}
                        </div>
                        <div>
                          <Label className="mb-1.5 block text-sm">BPM ({bpm[0]})</Label>
                          <Slider value={bpm} onValueChange={setBpm} max={200} min={60} step={5} className="mt-2" />
                        </div>
                        <div>
                          <Label className="mb-1.5 block text-sm">Key</Label>
                          <Select value={key} onValueChange={setKey}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {KEYS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Generate 3 options toggle */}
                      <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                        <Switch checked={generateMultiple} onCheckedChange={setGenerateMultiple} />
                        <div>
                          <span className="text-sm font-medium">Generate 3 options</span>
                          <span className="block text-[11px] text-muted-foreground">Creates 3 variations so you can pick the best one (takes longer)</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* SOUND — instruments, style, vocals */}
                  <AccordionItem value="sound">
                    <AccordionTrigger className="text-base font-semibold hover:no-underline">
                      Sound &amp; Instruments
                      <span className="text-xs font-normal text-muted-foreground ml-2">({selectedInstrumentsList.join(', ') || 'none'})</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div>
                        <Label className="mb-2 block text-sm">Instruments</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {Object.entries(instruments).map(([instrument, checked]) => (
                            <label key={instrument} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => handleInstrumentChange(instrument, c as boolean)}
                              />
                              <span className="text-sm capitalize">{instrument}</span>
                            </label>
                          ))}
                        </div>
                        {!hasInstruments && (
                          <p className="text-[11px] text-orange-400 mt-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Select at least one instrument
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="mb-1.5 block text-sm">Style (optional)</Label>
                          <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="e.g. modern, vintage, lo-fi, analog" />
                        </div>
                        <div>
                          <Label className="mb-1.5 block text-sm">Vocals</Label>
                          <div className="flex items-center gap-2 mt-2">
                            <Switch checked={includeVocals} onCheckedChange={setIncludeVocals} />
                            <span className="text-sm text-muted-foreground">{includeVocals ? 'Include vocals' : 'Instrumental only'}</span>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* ADVANCED — seed, variations, structure, melody */}
                  <AccordionItem value="advanced">
                    <AccordionTrigger className="text-base font-semibold hover:no-underline">
                      Advanced
                      <span className="text-xs font-normal text-muted-foreground ml-2">(structure, seed, melody guide)</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="mb-1.5 block text-sm">Song Structure</Label>
                          <Select value={songStructure} onValueChange={setSongStructure}>
                            <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto (single block)</SelectItem>
                              <SelectItem value="verse-hook">Verse + Hook (2 sections)</SelectItem>
                              <SelectItem value="full-song">Full Song (6 sections)</SelectItem>
                              <SelectItem value="intro-verse-chorus-outro">Complete (9 sections)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground mt-1">Use sections to generate longer, structured songs.</p>
                        </div>
                        <div>
                          <Label className="mb-1.5 block text-sm">Variations</Label>
                          <Select value={String(variations)} onValueChange={(v) => setVariations(Number(v))} disabled={generateMultiple}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 (fastest)</SelectItem>
                              <SelectItem value="2">2 variations</SelectItem>
                              <SelectItem value="3">3 variations</SelectItem>
                              <SelectItem value="4">4 variations (pick best)</SelectItem>
                            </SelectContent>
                          </Select>
                          {generateMultiple && (
                            <p className="text-[10px] text-muted-foreground mt-1">"Generate 3 options" is enabled, so variations are locked to 3.</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="mb-1.5 block text-sm">Seed</Label>
                          <Input type="number" placeholder="Random" value={seed} onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : '')} />
                          <div className="flex items-center gap-2 mt-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setSeed(Date.now())}>Randomize</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setSeed('')}>Clear</Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Same seed = same output. Leave empty for random.</p>
                        </div>
                        <div>
                          <Label className="mb-1.5 block text-sm">Melody Guide URL</Label>
                          <Input type="url" placeholder="https://... (audio file)" value={melodyGuideUrl} onChange={(e) => setMelodyGuideUrl(e.target.value)} />
                          <p className="text-[10px] text-muted-foreground mt-1">Reference melody for conditioning (MusicGen melody-large).</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="mb-1.5 block text-sm">Stem Separation</Label>
                          <div className="flex items-center gap-2">
                            <Switch checked={autoSeparateStems} onCheckedChange={setAutoSeparateStems} />
                            <span className="text-sm text-muted-foreground">Run post-generation stem split</span>
                          </div>
                          {autoSeparateStems && (
                            <Select value={String(stemCount)} onValueChange={(v) => setStemCount(Number(v) as 2 | 4)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="2">2-stem (vocals + instrumental)</SelectItem>
                                <SelectItem value="4">4-stem (vocals/drums/bass/other)</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="mb-1.5 block text-sm">Stem Import</Label>
                          <div className="flex items-center gap-2">
                            <Switch checked={autoImportStems} onCheckedChange={setAutoImportStems} disabled={!autoSeparateStems} />
                            <span className="text-sm text-muted-foreground">Auto-import stems into Multi-Track</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={requireStems} onCheckedChange={setRequireStems} disabled={!autoSeparateStems} />
                            <span className="text-sm text-muted-foreground">Require stems (fail generation if unavailable)</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">Imports each returned stem as its own audio track.</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            {/* Warnings */}
            {isTextOnlyProvider && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span><strong>{providerLabel}</strong> does not generate audio. Switch to Suno or MusicGen.</span>
              </div>
            )}

            {requireStems && autoSeparateStems && (
              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 text-sm text-sky-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Strict stems mode is enabled. Generation will fail if stems cannot be produced for this request.
                </span>
              </div>
            )}

            {generationMeta?.requestId && (
              <div className="bg-muted/40 border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <div><span className="font-medium">Request ID:</span> {generationMeta.requestId}</div>
                {generationMeta.requestedProvider && (
                  <div><span className="font-medium">Requested Provider:</span> {generationMeta.requestedProvider}</div>
                )}
                {generationMeta.effectiveProvider && (
                  <div><span className="font-medium">Effective Provider:</span> {generationMeta.effectiveProvider}</div>
                )}
                {generationMeta.outcome && (
                  <div><span className="font-medium">Outcome:</span> {generationMeta.outcome}</div>
                )}
                {generationMeta.stemWarning && (
                  <div className="text-amber-400"><span className="font-medium">Stem Warning:</span> {generationMeta.stemWarning}</div>
                )}
              </div>
            )}

            <div className="bg-muted/20 border rounded-lg p-3 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">AI Generation Metrics</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => void loadAIMetrics()}>
                  Refresh
                </Button>
              </div>
              {aiMetricsError && <div className="text-amber-400">{aiMetricsError}</div>}
              {!aiMetrics && !aiMetricsError && <div>Loading metrics...</div>}
              {aiMetrics && (
                <div className="space-y-1">
                  <div>Total requests: {aiMetrics.totals.total} • Fallback rate: {(aiMetrics.totals.fallbackRate * 100).toFixed(1)}% • Avg latency: {Math.round(aiMetrics.totals.averageLatencyMs)}ms</div>
                  {aiMetrics.routes['/api/music/generate-complete'] && (
                    <div>
                      /api/music/generate-complete → total {aiMetrics.routes['/api/music/generate-complete'].total}, fallback {aiMetrics.routes['/api/music/generate-complete'].fallback}, error {aiMetrics.routes['/api/music/generate-complete'].error}
                    </div>
                  )}
                  {aiMetrics.routes['/api/astutely'] && (
                    <div>
                      /api/astutely → total {aiMetrics.routes['/api/astutely'].total}, fallback {aiMetrics.routes['/api/astutely'].fallback}, error {aiMetrics.routes['/api/astutely'].error}
                    </div>
                  )}
                  {aiMetrics.routes['/api/astutely/generate-audio'] && (
                    <div>
                      /api/astutely/generate-audio → total {aiMetrics.routes['/api/astutely/generate-audio'].total}, fallback {aiMetrics.routes['/api/astutely/generate-audio'].fallback}, error {aiMetrics.routes['/api/astutely/generate-audio'].error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isBpmCapped && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {providerLabel} supports roughly {providerBpmRange.min}-{providerBpmRange.max} BPM. Requested {bpm[0]} BPM will be sent as {effectiveBpm} BPM.
                </span>
              </div>
            )}

            {/* Generate Button */}
            <div className="text-center space-y-3">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !songDescription.trim() || isTextOnlyProvider || !hasInstruments}
                size="lg"
                className="min-w-72 h-12 text-base"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Music className="mr-2 h-5 w-5" />
                    {generateMultiple ? 'Generate 3 Options' : 'Generate Song'}
                  </>
                )}
              </Button>

              {/* Progress indicator with provider + time estimate */}
              {generateMutation.isPending && generationProgress && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
                  <Clock className="h-4 w-4" />
                  <span>{generationProgress}</span>
                </div>
              )}

              {/* Friendly hint when form is empty */}
              {!songDescription.trim() && !generateMutation.isPending && (
                <p className="text-xs text-muted-foreground">Pick a recipe above or type a description to get started</p>
              )}
            </div>
          </div>
        ) : (
          /* ===== RESULTS VIEW ===== */
          <div className="space-y-6">
            <audio
              ref={audioRef}
              src={generatedSong.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleAudioEnded}
              preload="metadata"
            />

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{generatedSong.title}</CardTitle>
                    <p className="text-muted-foreground mt-1 text-sm">{generatedSong.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{generatedSong.genre}</Badge>
                    <Badge variant="outline">{generatedSong.provider}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Audio Player */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <Button onClick={togglePlayback} size="lg" className="h-12 w-12 rounded-full p-0 shrink-0">
                      {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      )}
                    </Button>
                    <div className="flex-1 space-y-1">
                      <Slider value={[currentTime]} onValueChange={handleSeek} max={audioDuration || 100} min={0} step={0.1} className="cursor-pointer" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(audioDuration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons — with inline confirmations */}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleDownload} variant="outline" size="sm">
                    <Download className="mr-1.5 h-4 w-4" />
                    Download
                  </Button>
                  <Button onClick={handleSaveToLibrary} variant="outline" size="sm" disabled={savedToLibrary}>
                    {savedToLibrary ? <Check className="mr-1.5 h-4 w-4 text-green-400" /> : <Save className="mr-1.5 h-4 w-4" />}
                    {savedToLibrary ? 'Saved!' : 'Save to Library'}
                  </Button>
                  <Button onClick={handleCopyLink} variant="outline" size="sm">
                    {linkCopied ? <Check className="mr-1.5 h-4 w-4 text-green-400" /> : <Copy className="mr-1.5 h-4 w-4" />}
                    {linkCopied ? 'Copied!' : 'Copy Link'}
                  </Button>
                  <Button onClick={handleNewGeneration} variant="outline" size="sm">
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Generate Another
                  </Button>
                </div>

                {/* Variation Picker */}
                {generatedSong.variations && generatedSong.variations.length > 1 && (
                  <div className="border-t pt-3 mt-2 space-y-2">
                    <span className="text-sm font-medium">Pick the best variation:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {generatedSong.variations.map((v, i) => (
                        <button
                          key={i}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                            selectedVariation === i
                              ? 'bg-primary/10 border border-primary/40 ring-1 ring-primary/20'
                              : 'bg-muted/30 border border-transparent hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setSelectedVariation(i);
                            if (audioRef.current) {
                              audioRef.current.src = v.audio_url;
                              audioRef.current.load();
                              setIsPlaying(false);
                              setCurrentTime(0);
                            }
                            setGeneratedSong(prev => prev ? { ...prev, audioUrl: v.audio_url } : prev);

                            const cacheKey = buildTakeCacheKey({
                              prompt: songDescription,
                              provider: generatedSong.provider || aiProvider,
                              seed: typeof generatedSong.seed === 'number' ? generatedSong.seed : (typeof seed === 'number' ? seed : undefined),
                              bpm: effectiveBpm,
                              duration: effectiveDuration,
                              structureKey: songStructure,
                            });
                            persistBestTake(cacheKey, generatedSong, i);
                          }}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            selectedVariation === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                            {i + 1}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-medium">Option {i + 1}</span>
                            <span className="block text-[10px] text-muted-foreground">seed: {v.seed}</span>
                          </div>
                          {selectedVariation === i && <Badge variant="default" className="text-[10px] ml-auto shrink-0">Playing</Badge>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section Blocks */}
                {generatedSong.sections && generatedSong.sections.length > 1 && (
                  <div className="border-t pt-3 mt-2 space-y-2">
                    <span className="text-sm font-medium">Sections ({generatedSong.sections.length} blocks):</span>
                    <div className="flex flex-wrap gap-2">
                      {generatedSong.sections.map((sec, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            if (audioRef.current && sec.audio_url) {
                              audioRef.current.src = sec.audio_url;
                              audioRef.current.load();
                              audioRef.current.play();
                              setIsPlaying(true);
                            }
                          }}
                        >
                          ▶ {sec.section}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generation Details */}
                <div className="text-xs text-muted-foreground border-t pt-3 mt-2 space-y-1">
                  <div><span className="font-medium">Prompt:</span> {generatedSong.prompt}</div>
                  {generatedSong.seed != null && <div><span className="font-medium">Seed:</span> {generatedSong.seed} (reuse for same output)</div>}
                  {generatedSong.provider && <div><span className="font-medium">Provider:</span> {generatedSong.provider}</div>}
                  {generatedSong.requestId && <div><span className="font-medium">Request ID:</span> {generatedSong.requestId}</div>}
                  {generatedSong.requestedProvider && <div><span className="font-medium">Requested Provider:</span> {generatedSong.requestedProvider}</div>}
                  {generatedSong.effectiveProvider && <div><span className="font-medium">Effective Provider:</span> {generatedSong.effectiveProvider}</div>}
                  {generatedSong.generationOutcome && <div><span className="font-medium">Outcome:</span> {generatedSong.generationOutcome}</div>}
                  {generatedSong.stemWarning && (
                    <div className="text-amber-400"><span className="font-medium">Stem Warning:</span> {generatedSong.stemWarning}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
