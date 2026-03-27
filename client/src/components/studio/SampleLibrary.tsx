/**
 * SampleLibrary.tsx
 * Professional sample browser with preview, search, and drag-to-track
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Play, Pause, Plus, Loader2, FolderOpen, Music2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface SampleFile {
  id: string;
  name: string;
  path: string;
  category: string;
  subcategory: string;
  url: string;
  size: number;
}

interface SampleLibraryData {
  success: boolean;
  samples: SampleFile[];
  grouped: Record<string, SampleFile[]>;
  totalCount: number;
  categories: string[];
}

export default function SampleLibrary() {
  const [data, setData] = useState<SampleLibraryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load sample library on mount
  useEffect(() => {
    loadSampleLibrary();
  }, []);

  const loadSampleLibrary = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('GET', '/api/sample-library');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
        toast({
          title: 'Sample Library Loaded',
          description: `${result.totalCount} samples from ${result.categories.length} instruments`,
        });
      } else {
        throw new Error(result.message || 'Failed to load samples');
      }
    } catch (error) {
      console.error('Failed to load sample library:', error);
      toast({
        title: 'Load Failed',
        description: 'Could not load sample library. Check server logs.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter samples based on search and category
  const filteredSamples = useMemo(() => {
    if (!data) return [];
    
    let samples = data.samples;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      samples = samples.filter(s => s.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      samples = samples.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query) ||
        s.subcategory.toLowerCase().includes(query)
      );
    }
    
    return samples;
  }, [data, selectedCategory, searchQuery]);

  // Preview playback
  const handlePreview = (sample: SampleFile) => {
    if (playingUrl === sample.url) {
      // Stop current preview
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingUrl(null);
      return;
    }

    // Stop previous audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Create new audio element
    const audio = new Audio(sample.url);
    audio.volume = 0.7;
    audio.crossOrigin = 'anonymous';
    
    audio.onended = () => setPlayingUrl(null);
    audio.onerror = () => {
      toast({
        title: 'Playback Error',
        description: `Could not play ${sample.name}`,
        variant: 'destructive',
      });
      setPlayingUrl(null);
    };

    audio.play().catch(err => {
      console.error('Preview playback failed:', err);
      toast({
        title: 'Playback Failed',
        description: 'Could not preview sample',
        variant: 'destructive',
      });
    });

    audioRef.current = audio;
    setPlayingUrl(sample.url);
  };

  // Add sample to multi-track
  const handleAddToTrack = (sample: SampleFile) => {
    window.dispatchEvent(new CustomEvent('importToMultiTrack', {
      detail: {
        type: 'audio',
        name: sample.name.replace(/\.(wav|mp3|ogg|flac|aiff)$/i, ''),
        audioUrl: sample.url,
      }
    }));
    
    toast({
      title: 'Sample Added',
      description: `${sample.name} added to Multi-Track`,
    });
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 text-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
          <p className="text-sm text-gray-400">Loading sample library...</p>
        </div>
      </div>
    );
  }

  if (!data || data.totalCount === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 text-white p-6">
        <div className="text-center max-w-md">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold mb-2">No Samples Found</h3>
          <p className="text-sm text-gray-400 mb-4">
            Sample library path is empty or not accessible.
          </p>
          <button
            onClick={loadSampleLibrary}
            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg text-cyan-300 border border-cyan-500/40 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900 text-white">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <Music2 className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold">Sample Library</h2>
          <span className="ml-auto text-xs text-gray-400">{filteredSamples.length} samples</span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            id="sample-lib-search"
            name="sample-lib-search"
            autoComplete="off"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search samples..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            All ({data.totalCount})
          </button>
          {data.categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all capitalize ${
                selectedCategory === cat
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {cat} ({data.grouped[cat]?.length || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Sample list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredSamples.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No samples match your search</p>
          </div>
        ) : (
          filteredSamples.map(sample => (
            <div
              key={sample.id}
              className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handlePreview(sample)}
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    playingUrl === sample.url
                      ? 'bg-cyan-500 text-white'
                      : 'bg-white/10 text-gray-400 group-hover:bg-white/20 group-hover:text-white'
                  }`}
                  title="Preview"
                >
                  {playingUrl === sample.url ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">{sample.name}</h4>
                  <p className="text-xs text-gray-400 truncate capitalize">
                    {sample.category} • {sample.subcategory.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatSize(sample.size)}</p>
                </div>

                <button
                  onClick={() => handleAddToTrack(sample)}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-all border border-emerald-500/40"
                  title="Add to Multi-Track"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
