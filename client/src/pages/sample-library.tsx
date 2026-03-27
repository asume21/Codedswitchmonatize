/**
 * Sample Library Page
 * Dedicated page for browsing and previewing audio samples
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Play, Pause, Plus, Loader2, FolderOpen, Music2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';

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

export default function SampleLibraryPage() {
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
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to load sample library",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to load sample library:', error);
      toast({
        title: "Error",
        description: "Failed to load sample library",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter samples based on search and category
  const filteredSamples = useMemo(() => {
    if (!data?.samples) return [];
    
    let filtered = data.samples;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query) ||
        s.subcategory.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [data, searchQuery, selectedCategory]);

  // Preview audio
  const handlePreview = (sample: SampleFile) => {
    if (playingUrl === sample.url) {
      // Stop if already playing
      previewAudio?.pause();
      setPlayingUrl(null);
      return;
    }

    // Stop previous audio
    if (previewAudio) {
      previewAudio.pause();
    }

    // Create and play new audio
    const audio = new Audio(sample.url);
    audio.volume = 0.7;
    audio.play().catch(err => {
      console.error('Failed to play audio:', err);
      toast({
        title: "Playback Error",
        description: "Failed to play sample",
        variant: "destructive",
      });
    });

    audio.onended = () => {
      setPlayingUrl(null);
    };

    setPreviewAudio(audio);
    setPlayingUrl(sample.url);
    audioRef.current = audio;
  };

  // Add sample to project — dispatches event for studio integration and
  // stores in sessionStorage so the studio can pick it up on next mount
  const handleAddSample = (sample: SampleFile) => {
    // Dispatch event for any open studio instance to receive
    window.dispatchEvent(new CustomEvent('sample-library:add-sample', {
      detail: {
        id: sample.id,
        name: sample.name,
        url: sample.url,
        category: sample.category,
        subcategory: sample.subcategory,
      },
    }));

    // Persist to sessionStorage so the studio can load it even if opened later
    try {
      const pending = JSON.parse(sessionStorage.getItem('pendingSamples') || '[]');
      pending.push({
        id: sample.id,
        name: sample.name,
        url: sample.url,
        category: sample.category,
        addedAt: Date.now(),
      });
      sessionStorage.setItem('pendingSamples', JSON.stringify(pending));
    } catch {
      // sessionStorage full or unavailable — event dispatch is primary path
    }

    toast({
      title: "Sample Added",
      description: `${sample.name} ready to use in studio`,
    });
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
      }
    };
  }, [previewAudio]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-cyan-300">Loading sample library...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <FolderOpen className="w-16 h-16 text-cyan-500/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-cyan-300 mb-2">Sample Library Not Available</h2>
          <p className="text-cyan-500/60 mb-6">
            Sample library path is empty or not accessible.
          </p>
          <Button
            onClick={loadSampleLibrary}
            className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-black/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Music2 className="w-8 h-8 text-cyan-400" />
              <div>
                <h1 className="text-2xl font-bold text-cyan-300">Sample Library</h1>
                <p className="text-sm text-cyan-500/60">
                  {data.totalCount} samples available
                </p>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/60" />
              <input
                id="page-sample-search"
                name="page-sample-search"
                autoComplete="off"
                type="text"
                placeholder="Search samples..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-black/60 border border-cyan-500/40 rounded-lg text-cyan-100 placeholder:text-cyan-500/40 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <select
              id="page-sample-category"
              name="page-sample-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 bg-black/60 border border-cyan-500/40 rounded-lg text-cyan-100 focus:outline-none focus:border-cyan-400"
            >
              <option value="all">All Categories</option>
              {data.categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sample Grid */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {filteredSamples.length === 0 ? (
          <div className="text-center py-16">
            <Music2 className="w-16 h-16 text-cyan-500/40 mx-auto mb-4" />
            <p className="text-cyan-500/60">No samples found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSamples.map(sample => (
              <div
                key={sample.id}
                className="bg-black/60 border border-cyan-500/20 rounded-lg p-4 hover:border-cyan-500/40 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-cyan-300 truncate mb-1">
                      {sample.name}
                    </h3>
                    <p className="text-xs text-cyan-500/60">
                      {sample.category} / {sample.subcategory}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreview(sample)}
                    className="flex-1 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20"
                  >
                    {playingUrl === sample.url ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddSample(sample)}
                    className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
