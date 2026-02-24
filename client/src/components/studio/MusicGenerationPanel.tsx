import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Wand2, Music, DollarSign, Piano, Play, Pause, Square, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { realisticAudio } from '@/lib/realisticAudio';
import { UpgradeModal, useLicenseGate } from '@/lib/LicenseGuard';
import { requestAstutelyPattern, mapGenreToAstutelyStyle } from '@/lib/astutelyBridge';
import { astutelyToNotes, midiToNoteOctave, astutelyGenerateAudio, astutelyPlayAudio } from '@/lib/astutelyEngine';

interface DiagnosticEvent {
  id: string;
  timestamp: number;
  severity: 'info' | 'warn' | 'error' | 'critical';
  category: string;
  message: string;
  provider?: string;
  durationMs?: number;
  resolution?: string;
  validationErrors?: string[];
  rawAIResponse?: string;
}

interface DiagnosticSummary {
  totalGenerations: number;
  successCount: number;
  fallbackCount: number;
  errorCount: number;
  avgLatencyMs: number;
  localAISuccessRate: number;
  cloudAISuccessRate: number;
  lastError: DiagnosticEvent | null;
  topErrors: { message: string; count: number }[];
  uptime: number;
  recentEvents: DiagnosticEvent[];
}

interface MusicGenerationPanelProps {
  onMusicGenerated?: (audioUrl: string, metadata: any) => void;
}

type PatternNote = {
  time: number;
  duration: number;
  pitch: string;
  velocity: number;
};

interface InstrumentPattern {
  instrument: string;
  notes: PatternNote[];
}

interface RealisticPattern {
  bpm: number;
  patterns: InstrumentPattern[];
}

const DRUM_MIDI_TO_NAME: Record<number, string> = {
  36: 'kick',
  38: 'snare',
  42: 'hihat',
  46: 'openhat',
  39: 'clap',
  49: 'crash',
  51: 'ride',
  45: 'tom',
  47: 'tom',
  48: 'tom',
  50: 'tom',
  56: 'cowbell',
  54: 'perc',
  57: 'perc',
};

function mapDrumPitch(pitch: number) {
  return DRUM_MIDI_TO_NAME[pitch] || 'perc';
}

const TRACK_TYPE_TO_INSTRUMENT: Record<string, string> = {
  drums: 'drums',
  bass: 'synth_bass_1',
  chords: 'acoustic_grand_piano',
  melody: 'lead_2_sawtooth',
};

function getPatternLengthInBeats(pattern: RealisticPattern) {
  const maxEnd = pattern.patterns.flatMap(p => p.notes.map(n => n.time + n.duration));
  return maxEnd.length ? Math.max(...maxEnd) : 16;
}

function astutelyNotesToRealisticPattern(notes: ReturnType<typeof astutelyToNotes>, bpmValue: number): RealisticPattern {
  const patterns = new Map<string, InstrumentPattern>();

  const ensurePattern = (instrument: string) => {
    if (!patterns.has(instrument)) {
      patterns.set(instrument, { instrument, notes: [] });
    }
    return patterns.get(instrument)!;
  };

  notes.forEach((note) => {
    const time = (note.startStep || 0) / 4;
    const duration = Math.max(0.25, (note.duration || 1) / 4);
    const velocity = note.velocity ?? 100;

    if (note.trackType === 'drums') {
      ensurePattern('drums').notes.push({
        time,
        duration,
        pitch: mapDrumPitch(note.pitch),
        velocity,
      });
      return;
    }

    const instrument = TRACK_TYPE_TO_INSTRUMENT[note.trackType] || 'acoustic_grand_piano';
    const { note: noteName, octave } = midiToNoteOctave(note.pitch);
    ensurePattern(instrument).notes.push({
      time,
      duration,
      pitch: `${noteName}${octave}`,
      velocity,
    });
  });

  return {
    bpm: bpmValue,
    patterns: Array.from(patterns.values()),
  };
}

type TrackCounts = { drums: number; bass: number; chords: number; melody: number };

function summarizeTrackCounts(notes: ReturnType<typeof astutelyToNotes>): TrackCounts {
  return notes.reduce<TrackCounts>((acc, note) => {
    if (note.trackType && acc[note.trackType as keyof TrackCounts] !== undefined) {
      acc[note.trackType as keyof TrackCounts] += 1;
    }
    return acc;
  }, { drums: 0, bass: 0, chords: 0, melody: 0 });
}

export default function MusicGenerationPanel({ onMusicGenerated }: MusicGenerationPanelProps) {
  const [provider, setProvider] = useState<'musicgen' | 'suno'>('musicgen');
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('electronic');
  const [duration, setDuration] = useState([30]);
  const [bpm, setBpm] = useState([120]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useRealisticInstruments, setUseRealisticInstruments] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { requirePro, startUpgrade } = useLicenseGate();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticSummary | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentPatternRef = useRef<RealisticPattern | null>(null);

  const fetchDiagnostics = useCallback(async () => {
    setDiagLoading(true);
    try {
      const res = await fetch('/api/astutely/diagnostics?limit=20');
      if (res.ok) {
        const data = await res.json();
        if (data.success) setDiagnostics(data);
      }
    } catch {
      // silently fail
    } finally {
      setDiagLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showDiagnostics) fetchDiagnostics();
  }, [showDiagnostics, fetchDiagnostics]);
  
  const providers = {
    musicgen: {
      name: 'MusicGen',
      icon: Music,
      cost: 'Low',
      quality: 'Good',
      maxDuration: 30,
      description: 'Fast, affordable instrumental generation',
      color: 'bg-blue-600',
    },
    suno: {
      name: 'Suno AI',
      icon: Wand2,
      cost: 'High',
      quality: 'Exceptional',
      maxDuration: 240,
      description: 'Professional quality with vocals',
      color: 'bg-purple-600',
    },
  };

  const genres = [
    'electronic', 'hip-hop', 'rock', 'pop', 'jazz', 'classical', 
    'ambient', 'lo-fi', 'trap', 'house', 'techno', 'dubstep',
    'r&b', 'funk', 'reggae', 'country', 'metal', 'indie'
  ];

  // Play generated pattern through RealisticAudioEngine
  const playPattern = async (pattern: RealisticPattern) => {
    await realisticAudio.initialize();
    
    // Load all instruments needed for the pattern
    const instrumentPromises = pattern.patterns.map((p) => 
      p.instrument !== 'drums' ? realisticAudio.loadAdditionalInstrument(p.instrument) : null
    ).filter(Boolean);
    
    await Promise.all(instrumentPromises);
    
    const msPerBeat = (60 / pattern.bpm) * 1000;
    let currentBeat = 0;
    const totalBeats = getPatternLengthInBeats(pattern);
    
    setIsPlaying(true);
    
    // Play notes in real-time
    playbackIntervalRef.current = setInterval(() => {
      if (currentBeat >= totalBeats) {
        stopPlayback();
        return;
      }
      
      // Play notes from all instruments at this beat
      pattern.patterns.forEach((instrumentPattern) => {
        const notesToPlay = instrumentPattern.notes.filter((note) => 
          Math.abs(note.time - currentBeat) < 0.1
        );
        
        notesToPlay.forEach((note) => {
          if (instrumentPattern.instrument === 'drums') {
            realisticAudio.playDrumSound(note.pitch, (note.velocity / 127) * 0.45);
          } else {
            const match = note.pitch.match(/([A-G]#?)(\d+)/);
            if (match) {
              const noteName = match[1];
              const octave = parseInt(match[2]);
              const vol = instrumentPattern.instrument.includes('bass')
                ? (note.velocity / 127) * 0.6
                : (note.velocity / 127) * 0.7;
              realisticAudio.playNote(
                noteName,
                octave,
                note.duration * msPerBeat / 1000,
                instrumentPattern.instrument,
                vol
              );
            }
          }
        });
      });
      
      currentBeat += 0.25; // Move forward by 16th note
    }, msPerBeat / 4); // Run every 16th note
  };
  
  const stopPlayback = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);

    realisticAudio.stopAllSounds();
  };

  const handleGenerate = async () => {
    if (!requirePro("ai", () => setShowUpgrade(true))) {
      return;
    }
    if (!prompt.trim()) {
      toast({
        title: 'Prompt Required',
        description: 'Please describe the music you want to generate.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const style = mapGenreToAstutelyStyle(genre);
      const composedPrompt = `${genre} ${prompt}`.trim();

      toast({
        title: 'Astutely Generating',
        description: `Creating a ${style} arrangement with ${composedPrompt}`,
      });

      const { result, notes } = await requestAstutelyPattern({
        style,
        prompt: composedPrompt,
      });

      const pattern = astutelyNotesToRealisticPattern(notes, result.bpm);
      currentPatternRef.current = pattern;
      setBpm([result.bpm]);

      const counts = summarizeTrackCounts(notes);
      toast({
        title: 'Beat Added To Piano Roll',
        description: `Drums ${counts.drums} • Bass ${counts.bass} • Chords ${counts.chords} • Melody ${counts.melody}`,
      });

      // NOTE: playAstutelyPreview() already plays the pattern inside astutelyGenerate().
      // Do NOT call playPattern() here — it would double the audio.

      if (onMusicGenerated) {
        onMusicGenerated('', {
          provider: 'astutely',
          prompt: composedPrompt,
          genre,
          bpm: result.bpm,
          style: result.style,
          key: result.key,
          generatedAt: new Date(),
          pattern,
        });
      }

      // Generate real AI audio (Suno/MusicGen) after pattern succeeds
      try {
        toast({
          title: '🎵 Generating Real Audio',
          description: `Creating professional ${style} track via AI...`,
        });
        const audioResult = await astutelyGenerateAudio(style, {
          prompt: composedPrompt,
          bpm: result.bpm,
          key: result.key,
        });
        try {
          await astutelyPlayAudio(audioResult.audioUrl);
        } catch (playErr) {
          console.warn('Auto-play blocked:', playErr);
        }
        if (onMusicGenerated) {
          onMusicGenerated(audioResult.audioUrl, {
            provider: audioResult.provider,
            prompt: composedPrompt,
            genre,
            bpm: result.bpm,
            style: result.style,
            key: result.key,
            generatedAt: new Date(),
            duration: audioResult.duration,
          });
        }
        toast({
          title: '✅ Real Audio Ready!',
          description: `Generated via ${audioResult.provider} (${audioResult.duration}s)`,
        });
      } catch (audioErr) {
        console.warn('Real audio generation failed, pattern still available:', audioErr);
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate music. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const currentProvider = providers[provider];
  const ProviderIcon = currentProvider.icon;

  return (
    <>
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Wand2 className="w-5 h-5 mr-2 text-purple-400" />
            AI Music Generation
          </span>
          <div className="text-sm font-normal text-gray-400">
            Powered by {currentProvider.name}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Realistic Instruments Toggle */}
        <div className="flex items-center justify-between p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
          <div className="flex items-center space-x-2">
            <Piano className="w-5 h-5 text-purple-400" />
            <Label htmlFor="realistic-mode" className="text-white cursor-pointer">
              Use Realistic Instruments (High Quality Soundfonts)
            </Label>
          </div>
          <Switch
            id="realistic-mode"
            checked={useRealisticInstruments}
            onCheckedChange={setUseRealisticInstruments}
            className="data-[state=checked]:bg-purple-600"
          />
        </div>
        
        {/* Playback Controls (for realistic mode) */}
        {useRealisticInstruments && currentPatternRef.current && (
          <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-lg">
            {!isPlaying ? (
              <Button
                onClick={() => currentPatternRef.current && playPattern(currentPatternRef.current)}
                size="sm"
                className="bg-green-600 hover:bg-green-500"
              >
                <Play className="w-4 h-4 mr-1" />
                Play
              </Button>
            ) : (
              <Button
                onClick={stopPlayback}
                size="sm"
                className="bg-red-600 hover:bg-red-500"
              >
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            )}
            <span className="text-sm text-gray-400 ml-2">
              {currentPatternRef.current.patterns.length} instruments loaded
            </span>
          </div>
        )}
        
        {/* Provider Selection (only show for raw audio mode) */}
        {!useRealisticInstruments && (
        <div>
          <label className="text-sm text-gray-400 mb-2 block">AI Provider</label>
          <Select value={provider} onValueChange={(val: 'musicgen' | 'suno') => setProvider(val)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(providers) as Array<keyof typeof providers>).map((key) => {
                const p = providers[key];
                const Icon = p.icon;
                return (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center">
                        <Icon className="w-4 h-4 mr-2" />
                        <span>{p.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          p.cost === 'Low' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'
                        }`}>
                          {p.cost} Cost
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300">
                          {p.quality}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          <div className="mt-2 p-3 bg-gray-900 rounded border border-gray-700">
            <div className="flex items-start space-x-2">
              <ProviderIcon className={`w-5 h-5 mt-0.5 ${provider === 'suno' ? 'text-purple-400' : 'text-blue-400'}`} />
              <div className="flex-1">
                <p className="text-sm text-gray-300">{currentProvider.description}</p>
                <div className="flex items-center space-x-3 mt-2 text-xs text-gray-400">
                  <span className="flex items-center">
                    <DollarSign className="w-3 h-3 mr-1" />
                    Cost: {currentProvider.cost}
                  </span>
                  <span>•</span>
                  <span>Max: {currentProvider.maxDuration}s</span>
                  <span>•</span>
                  <span>Quality: {currentProvider.quality}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Prompt */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Describe Your Music</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'upbeat melody with piano and strings, emotional and cinematic'"
            className="min-h-[100px] resize-none text-black dark:text-white"
            disabled={isGenerating}
          />
        </div>

        {/* Genre */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Genre</label>
          <Select value={genre} onValueChange={setGenre} disabled={isGenerating}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {genres.map((g) => (
                <SelectItem key={g} value={g}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Duration */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Duration: {duration[0]}s (max: {currentProvider.maxDuration}s)
          </label>
          <Slider
            value={duration}
            onValueChange={setDuration}
            max={currentProvider.maxDuration}
            min={10}
            step={5}
            disabled={isGenerating}
          />
        </div>

        {/* BPM */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            BPM: {bpm[0]}
          </label>
          <Slider
            value={bpm}
            onValueChange={setBpm}
            max={180}
            min={60}
            step={5}
            disabled={isGenerating}
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className={`w-full ${currentProvider.color} hover:opacity-90 text-white font-bold py-6 text-lg`}
        >
          {isGenerating ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Generating with {currentProvider.name}...
            </>
          ) : (
            <>
              <ProviderIcon className="w-5 h-5 mr-2" />
              Generate Music ({currentProvider.cost} Cost)
            </>
          )}
        </Button>

        {/* Info + Diagnostics Toggle */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Powered by Astutely intelligence
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-400 hover:text-white gap-1"
            onClick={() => {
              setShowDiagnostics(!showDiagnostics);
              if (!showDiagnostics) fetchDiagnostics();
            }}
          >
            <Activity className="w-3 h-3" />
            {showDiagnostics ? 'Hide' : 'Brain Status'}
          </Button>
        </div>

        {/* Astutely Diagnostics Panel */}
        {showDiagnostics && (
          <div className="border border-gray-700 rounded-lg p-3 space-y-3 bg-gray-900/50">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-purple-400" />
                Astutely Brain Diagnostics
              </h4>
              <Button variant="ghost" size="sm" onClick={fetchDiagnostics} disabled={diagLoading} className="text-xs h-6 px-2">
                {diagLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            {diagnostics ? (
              <>
                {/* Health Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-gray-400">Generations</div>
                    <div className="text-lg font-bold text-white">{diagnostics.totalGenerations}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-green-400">{diagnostics.successCount} AI</span>
                      <span className="text-yellow-400">{diagnostics.fallbackCount} fallback</span>
                      <span className="text-red-400">{diagnostics.errorCount} err</span>
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-gray-400">AI Success Rates</div>
                    <div className="mt-1 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Phi3 (Local)</span>
                        <Badge variant={diagnostics.localAISuccessRate >= 50 ? 'default' : 'destructive'} className="text-xs h-5">
                          {diagnostics.localAISuccessRate}%
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Grok (Cloud)</span>
                        <Badge variant={diagnostics.cloudAISuccessRate >= 50 ? 'default' : 'destructive'} className="text-xs h-5">
                          {diagnostics.cloudAISuccessRate}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {diagnostics.avgLatencyMs > 0 && (
                  <div className="text-xs text-gray-400">
                    Avg latency: <span className="text-white">{diagnostics.avgLatencyMs}ms</span>
                  </div>
                )}

                {/* Recent Events */}
                {diagnostics.recentEvents.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-400 font-medium">Recent Activity</div>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {diagnostics.recentEvents.slice(0, 15).map((evt) => (
                        <div
                          key={evt.id}
                          className={`text-xs rounded px-2 py-1.5 flex items-start gap-1.5 ${
                            evt.severity === 'critical' ? 'bg-red-900/40 border border-red-700' :
                            evt.severity === 'error' ? 'bg-red-900/20 border border-red-800/50' :
                            evt.severity === 'warn' ? 'bg-yellow-900/20 border border-yellow-800/50' :
                            'bg-gray-800/50 border border-gray-700/50'
                          }`}
                        >
                          {evt.severity === 'critical' || evt.severity === 'error' ? (
                            <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                          ) : evt.severity === 'warn' ? (
                            <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" />
                          ) : (
                            <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-gray-200 break-words">{evt.message}</div>
                            {evt.resolution && (
                              <div className="text-gray-500 mt-0.5">→ {evt.resolution}</div>
                            )}
                            {evt.validationErrors && evt.validationErrors.length > 0 && (
                              <div className="text-red-300/70 mt-0.5">
                                Validation: {evt.validationErrors.slice(0, 3).join('; ')}
                              </div>
                            )}
                            <div className="text-gray-600 mt-0.5">
                              {new Date(evt.timestamp).toLocaleTimeString()}
                              {evt.provider && ` • ${evt.provider}`}
                              {evt.durationMs ? ` • ${evt.durationMs}ms` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Errors */}
                {diagnostics.topErrors.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-400 font-medium">Top Recurring Issues</div>
                    {diagnostics.topErrors.slice(0, 5).map((err, i) => (
                      <div key={i} className="text-xs flex justify-between bg-gray-800/50 rounded px-2 py-1">
                        <span className="text-red-300 truncate mr-2">{err.message}</span>
                        <Badge variant="destructive" className="text-xs h-4 shrink-0">×{err.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {diagnostics.totalGenerations === 0 && (
                  <div className="text-xs text-gray-500 text-center py-2">
                    No generations yet this session. Generate something to see diagnostics.
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-gray-500 text-center py-2">
                {diagLoading ? 'Loading diagnostics...' : 'Could not load diagnostics'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    <UpgradeModal
      open={showUpgrade}
      onClose={() => setShowUpgrade(false)}
      onUpgrade={startUpgrade}
    />
    </>
  );
}
