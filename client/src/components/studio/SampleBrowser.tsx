/**
 * Sample Browser Component
 * Browse and preview audio samples from the local sample library
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Play, Pause, Volume2, Drum, Music, 
  Waves, X, Download, Plus, Loader2 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Sample {
  id: string;
  filename: string;
  type: 'kick' | 'snare' | 'hihat' | 'loop' | 'percussion' | 'other';
  variant: string;
  bpm?: number;
  path: string;
  url: string;
}

interface SampleBrowserProps {
  onClose: () => void;
  onSampleSelect?: (sample: Sample) => void;
}

export default function SampleBrowser({ onClose, onSampleSelect }: SampleBrowserProps) {
  const { toast } = useToast();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchSamples();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const fetchSamples = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/samples');
      if (!response.ok) {
        throw new Error('Failed to fetch samples');
      }
      const data = await response.json();
      setSamples(data.samples || []);
    } catch (err) {
      console.error('Failed to load samples:', err);
      setError('No samples found. Add audio files to the samples directory.');
      setSamples([]);
    } finally {
      setLoading(false);
    }
  };

  const playSample = (sample: Sample) => {
    if (playingSample === sample.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingSample(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(sample.url);
    audio.onended = () => setPlayingSample(null);
    audio.onerror = () => {
      toast({ title: 'Playback Error', description: 'Could not play sample', variant: 'destructive' });
      setPlayingSample(null);
    };
    audio.play();
    audioRef.current = audio;
    setPlayingSample(sample.id);
  };

  const handleAddToProject = (sample: Sample) => {
    if (onSampleSelect) {
      onSampleSelect(sample);
    }
    toast({ title: 'Sample Added', description: `${sample.filename} added to project` });
  };

  const filteredSamples = samples.filter(sample => {
    const matchesSearch = sample.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sample.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || sample.type === activeTab;
    return matchesSearch && matchesTab;
  });

  const sampleTypes = ['all', 'kick', 'snare', 'hihat', 'loop', 'percussion', 'other'];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'kick':
      case 'snare':
      case 'hihat':
      case 'percussion':
        return <Drum className="w-4 h-4" />;
      case 'loop':
        return <Waves className="w-4 h-4" />;
      default:
        return <Music className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-80 h-full bg-black/95 border-l border-cyan-500/40 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-cyan-500/40 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cyan-100 flex items-center gap-2">
          <Music className="w-4 h-4 text-cyan-400" />
          Sample Browser
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="w-4 h-4 text-cyan-400" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-cyan-500/40">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
          <Input
            placeholder="Search samples..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-black/60 border-cyan-500/40 text-cyan-100 placeholder:text-cyan-400/50 h-8 text-sm"
          />
        </div>
      </div>

      {/* Type Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2 bg-black/60 border border-cyan-500/40 h-auto flex-wrap">
          {sampleTypes.map(type => (
            <TabsTrigger
              key={type}
              value={type}
              className="text-xs px-2 py-1 data-[state=active]:bg-cyan-500/30 data-[state=active]:text-cyan-100"
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 mt-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <Music className="w-12 h-12 text-cyan-400/30 mx-auto mb-2" />
                  <p className="text-sm text-cyan-400/70">{error}</p>
                  <p className="text-xs text-cyan-400/50 mt-2">
                    Add .wav or .mp3 files to:<br />
                    <code className="text-cyan-300">/audio/samples/</code>
                  </p>
                </div>
              ) : filteredSamples.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-8 h-8 text-cyan-400/30 mx-auto mb-2" />
                  <p className="text-sm text-cyan-400/70">No samples found</p>
                </div>
              ) : (
                filteredSamples.map(sample => (
                  <div
                    key={sample.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                      playingSample === sample.id
                        ? 'bg-cyan-500/20 border-cyan-500/60'
                        : 'bg-black/40 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/10'
                    }`}
                    onClick={() => playSample(sample)}
                  >
                    <div className="text-cyan-400">
                      {getTypeIcon(sample.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-cyan-100 truncate">{sample.filename}</p>
                      <p className="text-xs text-cyan-400/70">
                        {sample.type} {sample.bpm ? `• ${sample.bpm} BPM` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => { e.stopPropagation(); playSample(sample); }}
                      >
                        {playingSample === sample.id ? (
                          <Pause className="w-3 h-3 text-cyan-400" />
                        ) : (
                          <Play className="w-3 h-3 text-cyan-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => { e.stopPropagation(); handleAddToProject(sample); }}
                      >
                        <Plus className="w-3 h-3 text-cyan-400" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="p-3 border-t border-cyan-500/40 text-center">
        <p className="text-xs text-cyan-400/70">
          {samples.length} samples available
        </p>
      </div>
    </div>
  );
}
