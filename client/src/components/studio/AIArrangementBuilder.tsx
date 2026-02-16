import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, LayoutList, ArrowRight, Music2, Play, Volume2, VolumeX, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TrackState {
  active: boolean;
  volume: number;
}

interface ArrangementSection {
  name: string;
  startBar: number;
  endBar: number;
  energy: number;
  description?: string;
  trackStates?: Record<string, TrackState>;
}

interface ArrangementResult {
  totalBars: number;
  sections: ArrangementSection[];
  transitions: { from: string; to: string; type: string; description?: string }[];
  recommendations: string[];
}

interface TrackInfo {
  id: string;
  name: string;
  instrument?: string;
  type?: string;
  noteCount?: number;
  muted?: boolean;
  volume?: number;
}

interface AIArrangementBuilderProps {
  currentBpm?: number;
  currentKey?: string;
  tracks?: TrackInfo[];
  onApplyArrangement?: (arrangement: ArrangementResult) => void;
  onApplySection?: (sectionIndex: number, trackStates: Record<string, TrackState>) => void;
  onClose?: () => void;
}

export default function AIArrangementBuilder({ 
  currentBpm = 120, 
  currentKey = 'C',
  tracks: projectTracks = [],
  onApplyArrangement,
  onApplySection,
  onClose,
}: AIArrangementBuilderProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [arrangement, setArrangement] = useState<ArrangementResult | null>(null);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const [bpm, setBpm] = useState(currentBpm);
  const [key, setKey] = useState(currentKey);
  const [genre, setGenre] = useState('pop');
  const [mood, setMood] = useState('energetic');
  const [duration, setDuration] = useState(3);
  const { toast } = useToast();

  const generateArrangement = useCallback(async () => {
    setIsGenerating(true);
    try {
      const trackData = projectTracks.map(t => ({
        id: t.id,
        name: t.name,
        instrument: t.instrument || t.type || 'unknown',
        type: t.type,
        noteCount: t.noteCount || 0,
      }));

      const response = await apiRequest('POST', '/api/ai/arrangement', {
        bpm,
        key,
        genre,
        mood,
        durationMinutes: duration,
        tracks: trackData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.arrangement) {
        setArrangement(data.arrangement);
        setActiveSection(null);
        toast({
          title: "🎼 Arrangement Generated!",
          description: `${data.arrangement.sections?.length || 0} sections for ${projectTracks.length} tracks (${data.provider})`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate arrangement",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  }, [bpm, key, genre, mood, duration, projectTracks, toast]);

  const previewSection = useCallback((sectionIndex: number) => {
    if (!arrangement) return;
    const section = arrangement.sections[sectionIndex];
    if (!section?.trackStates) return;

    setActiveSection(sectionIndex);

    if (onApplySection) {
      onApplySection(sectionIndex, section.trackStates);
    }

    // Dispatch event so the studio workspace can apply track states
    window.dispatchEvent(new CustomEvent('arrangement:applySection', {
      detail: {
        sectionIndex,
        sectionName: section.name,
        trackStates: section.trackStates,
        startBar: section.startBar,
        endBar: section.endBar,
      }
    }));

    toast({
      title: `▶ ${section.name}`,
      description: section.description || `Bars ${section.startBar}-${section.endBar}`,
      duration: 2000,
    });
  }, [arrangement, onApplySection, toast]);

  const applyFullArrangement = useCallback(() => {
    if (!arrangement) return;

    if (onApplyArrangement) {
      onApplyArrangement(arrangement);
    }

    // Dispatch event with the full arrangement
    window.dispatchEvent(new CustomEvent('arrangement:applyFull', {
      detail: { arrangement, bpm, key }
    }));

    toast({
      title: '✅ Arrangement Applied!',
      description: `${arrangement.sections.length} sections applied to ${projectTracks.length} tracks`,
    });
  }, [arrangement, bpm, key, projectTracks.length, onApplyArrangement, toast]);

  const getEnergyColor = (energy: number) => {
    if (energy >= 8) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (energy >= 6) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (energy >= 4) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const getEnergyBar = (energy: number) => {
    const width = Math.min(100, Math.max(10, energy * 10));
    const color = energy >= 8 ? 'bg-red-500' : energy >= 6 ? 'bg-orange-500' : energy >= 4 ? 'bg-yellow-500' : 'bg-blue-500';
    return (
      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${width}%` }} />
      </div>
    );
  };

  return (
    <Card className="bg-gray-900 border-cyan-500/30 text-white">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-cyan-400">
          <LayoutList className="w-4 h-4" />
          AI Arrangement Builder
        </CardTitle>
        <div className="flex items-center gap-2">
          {projectTracks.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400">
              {projectTracks.length} tracks
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs bg-cyan-500/20 text-cyan-400">Pro</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {projectTracks.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Your Tracks</label>
            <div className="flex flex-wrap gap-1">
              {projectTracks.map((t, i) => (
                <Badge key={t.id || i} variant="outline" className="text-[10px] border-gray-600 text-gray-300">
                  {t.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {projectTracks.length === 0 && (
          <div className="text-xs text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
            No tracks detected. Add some tracks first (drums, bass, melody, etc.) then the AI will arrange them into a full song.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">BPM</label>
            <Input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              min={60}
              max={200}
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Key</label>
            <Select value={key} onValueChange={setKey}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Genre</label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pop">Pop</SelectItem>
                <SelectItem value="rock">Rock</SelectItem>
                <SelectItem value="hip-hop">Hip-Hop / Trap</SelectItem>
                <SelectItem value="electronic">Electronic / EDM</SelectItem>
                <SelectItem value="r-and-b">R&B / Soul</SelectItem>
                <SelectItem value="jazz">Jazz</SelectItem>
                <SelectItem value="lo-fi">Lo-Fi</SelectItem>
                <SelectItem value="drill">Drill</SelectItem>
                <SelectItem value="afrobeats">Afrobeats</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Mood</label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="energetic">Energetic</SelectItem>
                <SelectItem value="calm">Calm</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="uplifting">Uplifting</SelectItem>
                <SelectItem value="melancholic">Melancholic</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
                <SelectItem value="dreamy">Dreamy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Duration: {duration} minutes</label>
          <Input
            type="range"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            min={2}
            max={6}
            step={0.5}
            className="w-full accent-cyan-500"
          />
        </div>

        <Button 
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold" 
          onClick={generateArrangement} 
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Arranging {projectTracks.length} tracks...
            </>
          ) : (
            <>
              <LayoutList className="w-4 h-4 mr-2" />
              {projectTracks.length > 0 ? `Arrange ${projectTracks.length} Tracks` : 'Generate Arrangement'}
            </>
          )}
        </Button>

        {arrangement && (
          <div className="space-y-3 pt-2 border-t border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Total Length</span>
              <span className="font-medium text-cyan-400">{arrangement.totalBars} bars</span>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-300">Sections — click to preview</span>
              <div className="space-y-1">
                {arrangement.sections?.map((section, i) => {
                  const trackStates = section.trackStates || {};
                  const activeCount = Object.values(trackStates).filter(s => s.active).length;
                  const totalCount = Object.keys(trackStates).length;
                  const isActive = activeSection === i;

                  return (
                    <button
                      key={i}
                      onClick={() => previewSection(i)}
                      className={`w-full flex items-center justify-between text-xs p-2 rounded-md transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-cyan-500/20 border border-cyan-500/50 ring-1 ring-cyan-500/30' 
                          : 'bg-gray-800/50 border border-gray-700 hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                        ) : (
                          <Music2 className="w-3 h-3 text-gray-500" />
                        )}
                        <span className={`font-medium ${isActive ? 'text-cyan-400' : 'text-gray-300'}`}>
                          {section.name}
                        </span>
                        {totalCount > 0 && (
                          <span className="text-gray-500">
                            {activeCount}/{totalCount} tracks
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{section.startBar}-{section.endBar}</span>
                        {getEnergyBar(section.energy)}
                        <Badge variant="outline" className={`text-[10px] ${getEnergyColor(section.energy)}`}>
                          {section.energy}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeSection !== null && arrangement.sections[activeSection]?.trackStates && (
              <div className="space-y-2 bg-gray-800/50 rounded-md p-3 border border-gray-700">
                <span className="text-xs font-medium text-cyan-400">
                  {arrangement.sections[activeSection].name} — Track Mix
                </span>
                <div className="space-y-1">
                  {Object.entries(arrangement.sections[activeSection].trackStates!).map(([name, state]) => (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {state.active ? (
                          <Volume2 className="w-3 h-3 text-green-400" />
                        ) : (
                          <VolumeX className="w-3 h-3 text-red-400" />
                        )}
                        <span className={state.active ? 'text-gray-200' : 'text-gray-500 line-through'}>
                          {name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${state.active ? 'bg-green-500' : 'bg-red-500/30'}`}
                            style={{ width: `${state.volume}%` }}
                          />
                        </div>
                        <span className="text-gray-500 w-8 text-right">{state.volume}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                {arrangement.sections[activeSection].description && (
                  <p className="text-[10px] text-gray-500 italic mt-1">
                    {arrangement.sections[activeSection].description}
                  </p>
                )}
              </div>
            )}

            {arrangement.transitions && arrangement.transitions.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-300">Transitions</span>
                <div className="flex flex-wrap gap-1">
                  {arrangement.transitions.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-gray-600 text-gray-400">
                      {t.from} <ArrowRight className="w-2 h-2 mx-1" /> {t.to}
                      <span className="ml-1 text-gray-500">({t.type})</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {arrangement.recommendations && arrangement.recommendations.length > 0 && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-gray-300">Production Tips</span>
                <ul className="text-xs text-gray-500 space-y-1">
                  {arrangement.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button 
              size="sm" 
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold"
              onClick={applyFullArrangement}
            >
              <Check className="w-4 h-4 mr-2" />
              Apply Full Arrangement to Timeline
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
