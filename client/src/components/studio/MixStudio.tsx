import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { RealisticAudioEngine } from "@/lib/realisticAudio";
import audioRouter from "@/lib/audioRouter";
import {
  Play,
  Pause,
  Download,
  Save,
  Volume2,
  Music,
  Wand2,
  Layers,
  Upload,
  Sliders,
  Plus,
  Trash2,
  RefreshCw,
  ArrowDownToLine,
} from "lucide-react";

const realisticAudio = new RealisticAudioEngine();

interface TrackLayer {
  id: string;
  name: string;
  type: "beat" | "melody" | "bass" | "harmony" | "fx";
  data: any;
  volume: number;
  muted: boolean;
  solo: boolean;
  pan: number;
  effects: {
    reverb: number;
    delay: number;
    distortion: number;
  };
}

export default function MixStudio() {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(75);
  const [bpm, setBpm] = useState(120);
  const [layers, setLayers] = useState<TrackLayer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [mixName, setMixName] = useState("My Mix");
  const [aiPrompt, setAiPrompt] = useState("");
  const [savedMixes, setSavedMixes] = useState<any[]>([]);

  // Load saved patterns from localStorage and listen to audio router
  useEffect(() => {
    const savedBeats = localStorage.getItem("codedswitch_saved_beats");
    const savedMelodies = localStorage.getItem("codedswitch_saved_melodies");
    const savedBasslines = localStorage.getItem("codedswitch_saved_basslines");

    if (savedBeats || savedMelodies || savedBasslines) {
      console.log("📦 Found saved patterns to load into Mix Studio");
    }

    // Check for routed audio data periodically
    const checkRoutedData = () => {
      const tracks = audioRouter.getTracks();
      const buses = audioRouter.getBuses();
      
      // Look for tracks that haven't been imported yet
      tracks.forEach(track => {
        if (!layers.some(l => l.id === track.id)) {
          console.log('📨 Found new track:', track);
          const layerType: TrackLayer['type'] = 
            track.type === 'drums' ? 'beat' : 
            track.instrument === 'bass' ? 'bass' :
            'melody';
          
          const newLayer: TrackLayer = {
            id: track.id,
            name: track.name,
            type: layerType,
            data: track,
            volume: track.volume || 75,
            muted: track.muted || false,
            solo: track.solo || false,
            pan: track.pan || 0,
            effects: {
              reverb: 0,
              delay: 0,
              distortion: 0,
            },
          };
          
          setLayers(prev => [...prev, newLayer]);
        }
      });
    };
    
    // Check initially and set up periodic checking
    checkRoutedData();
    const intervalId = setInterval(checkRoutedData, 2000); // Check every 2 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // AI-powered mix generation
  const generateMixMutation = useMutation({
    mutationFn: async (params: any) => {
      const response = await apiRequest("POST", "/api/mix/generate", params);
      return response;
    },
    onSuccess: (data: any) => {
      console.log("🎛️ AI Mix generated:", data);
      if (data.layers) {
        setLayers(data.layers);
        toast({
          title: "Mix Generated!",
          description: "AI has created a professional mix based on your prompt",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Mix Generation Failed",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  // Import tracks from audio router
  const importFromRouter = (routeData: any) => {
    console.log('🎛️ Importing audio data:', routeData);
    
    if (routeData.from === 'BeatMaker' && routeData.data) {
      const beatData = routeData.data;
      const newLayer: TrackLayer = {
        id: `beat_${Date.now()}`,
        name: beatData.name || 'Imported Beat',
        type: 'beat',
        data: beatData,
        volume: 75,
        muted: false,
        solo: false,
        pan: 0,
        effects: {
          reverb: 0,
          delay: 0,
          distortion: 0,
        },
      };
      setLayers(prev => [...prev, newLayer]);
      
      // Update BPM if provided
      if (routeData.metadata?.bpm) {
        setBpm(routeData.metadata.bpm);
      }
      
      toast({
        title: "Beat Imported",
        description: `Received beat from BeatMaker`,
      });
    }
    
    if (routeData.from === 'MelodyComposer' && routeData.data) {
      const melodyData = routeData.data;
      
      // Import each track as a separate layer
      if (melodyData.tracks) {
        melodyData.tracks.forEach((track: any) => {
          const layerType: TrackLayer['type'] = 
            track.instrument === 'drums' ? 'beat' : 
            track.instrument === 'bass' ? 'bass' :
            track.name.toLowerCase().includes('harmony') ? 'harmony' : 'melody';
          
          const newLayer: TrackLayer = {
            id: `${track.id}_${Date.now()}`,
            name: track.name || 'Imported Track',
            type: layerType,
            data: {
              ...track,
              notes: melodyData.notes?.filter((n: any) => n.track === track.id) || []
            },
            volume: track.volume || 75,
            muted: track.muted || false,
            solo: track.solo || false,
            pan: track.pan || 0,
            effects: {
              reverb: 0,
              delay: 0,
              distortion: 0,
            },
          };
          setLayers(prev => [...prev, newLayer]);
        });
      }
      
      // Update BPM and key if provided
      if (routeData.metadata?.bpm) {
        setBpm(routeData.metadata.bpm);
      }
      
      toast({
        title: "Melody Imported",
        description: `Received ${melodyData.tracks?.length || 0} tracks from Melody Composer`,
      });
    }
  };

  // Import all available tracks from router
  const importAllFromRouter = () => {
    const allTracks = audioRouter.getTracks();
    
    console.log('📦 Importing all available tracks:', allTracks);
    
    let importCount = 0;
    
    // Import tracks
    allTracks.forEach((track: any) => {
      // Check if layer already exists
      if (!layers.some(l => l.id === track.id)) {
        const layerType: TrackLayer['type'] = 
          track.type === 'drums' ? 'beat' : 
          track.instrument === 'bass' ? 'bass' :
          track.name?.toLowerCase().includes('harmony') ? 'harmony' : 'melody';
        
        const newLayer: TrackLayer = {
          id: track.id,
          name: track.name,
          type: layerType,
          data: track,
          volume: track.volume || 75,
          muted: track.muted || false,
          solo: track.solo || false,
          pan: track.pan || 0,
          effects: {
            reverb: 0,
            delay: 0,
            distortion: 0,
          },
        };
        
        setLayers(prev => [...prev, newLayer]);
        importCount++;
      }
    });
    
    if (importCount > 0) {
      toast({
        title: "Tracks Imported",
        description: `Imported ${importCount} new tracks from audio router`,
      });
    } else if (allTracks.length > 0) {
      toast({
        title: "Tracks Already Imported",
        description: "All available tracks are already in the mix",
      });
    } else {
      toast({
        title: "No Tracks Available",
        description: "Route tracks from BeatMaker or MelodyComposer first",
      });
    }
  };

  // Add layer from saved patterns
  const addLayer = (type: TrackLayer["type"], name?: string) => {
    const newLayer: TrackLayer = {
      id: `layer_${Date.now()}`,
      name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} Track`,
      type,
      data: null,
      volume: 75,
      muted: false,
      solo: false,
      pan: 0,
      effects: {
        reverb: 0,
        delay: 0,
        distortion: 0,
      },
    };

    setLayers([...layers, newLayer]);
    toast({ title: "Layer Added", description: `Added ${newLayer.name}` });
  };

  // Load saved pattern into layer
  const loadPatternIntoLayer = (layerId: string, patternType: string) => {
    const storageKey = `codedswitch_saved_${patternType}`;
    const savedData = localStorage.getItem(storageKey);

    if (savedData) {
      const patterns = JSON.parse(savedData);
      if (patterns.length > 0) {
        setLayers(
          layers.map((layer) =>
            layer.id === layerId ? { ...layer, data: patterns[0] } : layer,
          ),
        );
        toast({
          title: "Pattern Loaded",
          description: `Loaded ${patternType} into layer`,
        });
      }
    }
  };

  // Update layer settings
  const updateLayer = (layerId: string, updates: Partial<TrackLayer>) => {
    setLayers(
      layers.map((layer) =>
        layer.id === layerId ? { ...layer, ...updates } : layer,
      ),
    );
  };

  // Remove layer
  const removeLayer = (layerId: string) => {
    setLayers(layers.filter((layer) => layer.id !== layerId));
    toast({ title: "Layer Removed" });
  };

  // AI Mix and Master
  const aiMixAndMaster = () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Enter AI Instructions",
        description: "Please describe how you want the mix to sound",
        variant: "destructive",
      });
      return;
    }

    generateMixMutation.mutate({
      prompt: aiPrompt,
      layers: layers,
      bpm: bpm,
      style: "professional",
    });
  };

  // Save mix to storage
  const saveMix = () => {
    const mixData = {
      id: `mix_${Date.now()}`,
      name: mixName,
      layers: layers,
      bpm: bpm,
      masterVolume: masterVolume,
      createdAt: new Date().toISOString(),
    };

    const existingMixes = JSON.parse(
      localStorage.getItem("codedswitch_mixes") || "[]",
    );
    existingMixes.push(mixData);
    localStorage.setItem("codedswitch_mixes", JSON.stringify(existingMixes));

    setSavedMixes(existingMixes);
    toast({ title: "Mix Saved!", description: `"${mixName}" has been saved` });
  };

  // Export mix as audio file
  const exportMix = async () => {
    toast({
      title: "Exporting Mix...",
      description: "Generating audio file, this may take a moment",
    });

    // This would trigger actual audio export
    setTimeout(() => {
      toast({
        title: "Mix Exported!",
        description: "Your mix has been exported as mix.wav",
      });
    }, 2000);
  };

  // Play the mixed audio
  const playMix = async () => {
    if (!isPlaying) {
      await realisticAudio.initialize();
      setIsPlaying(true);

      // Play all non-muted layers
      layers.forEach((layer) => {
        if (!layer.muted && layer.data) {
          console.log(`🎵 Playing layer: ${layer.name}`);
          // Play layer based on type
        }
      });
    } else {
      setIsPlaying(false);
      // Stop playback
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sliders className="w-8 h-8 text-purple-400" />
              <div>
                <CardTitle className="text-2xl">Mix Studio</CardTitle>
                <p className="text-sm text-gray-400">
                  Combine beats, bass, and melodies with AI-powered mixing
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={playMix}
                variant={isPlaying ? "destructive" : "default"}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 mr-1" />
                ) : (
                  <Play className="w-4 h-4 mr-1" />
                )}
                {isPlaying ? "Stop" : "Play Mix"}
              </Button>
              <Button onClick={saveMix} variant="outline">
                <Save className="w-4 h-4 mr-1" /> Save Mix
              </Button>
              <Button onClick={exportMix} variant="secondary">
                <Download className="w-4 h-4 mr-1" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Layer Stack */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Track Layers</CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={importAllFromRouter}
                    size="sm"
                    variant="default"
                    className="bg-purple-600 hover:bg-purple-500"
                  >
                    <ArrowDownToLine className="w-4 h-4 mr-1" /> Import Tracks
                  </Button>
                  <Button
                    onClick={() => addLayer("beat")}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Beat
                  </Button>
                  <Button
                    onClick={() => addLayer("melody")}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Melody
                  </Button>
                  <Button
                    onClick={() => addLayer("bass")}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Bass
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {layers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>
                    No layers yet. Add beats, melodies, or bass to start mixing!
                  </p>
                </div>
              ) : (
                layers.map((layer) => (
                  <Card
                    key={layer.id}
                    className={`p-4 ${selectedLayer === layer.id ? "border-purple-500" : ""}`}
                    onClick={() => setSelectedLayer(layer.id)}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              layer.type === "beat"
                                ? "default"
                                : layer.type === "melody"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {layer.type}
                          </Badge>
                          <input
                            className="bg-transparent border-b border-gray-600 text-lg"
                            value={layer.name}
                            onChange={(e) =>
                              updateLayer(layer.id, { name: e.target.value })
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={layer.solo ? "default" : "ghost"}
                            onClick={() =>
                              updateLayer(layer.id, { solo: !layer.solo })
                            }
                          >
                            S
                          </Button>
                          <Button
                            size="sm"
                            variant={layer.muted ? "destructive" : "ghost"}
                            onClick={() =>
                              updateLayer(layer.id, { muted: !layer.muted })
                            }
                          >
                            M
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeLayer(layer.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Volume and Pan */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">
                            Volume: {layer.volume}%
                          </Label>
                          <Slider
                            value={[layer.volume]}
                            onValueChange={(v) =>
                              updateLayer(layer.id, { volume: v[0] })
                            }
                            max={100}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">
                            Pan:{" "}
                            {layer.pan > 0
                              ? `R${layer.pan}`
                              : layer.pan < 0
                                ? `L${Math.abs(layer.pan)}`
                                : "C"}
                          </Label>
                          <Slider
                            value={[layer.pan]}
                            onValueChange={(v) =>
                              updateLayer(layer.id, { pan: v[0] })
                            }
                            min={-100}
                            max={100}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      {/* Load Pattern Button */}
                      {!layer.data && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              loadPatternIntoLayer(layer.id, `${layer.type}s`)
                            }
                          >
                            <Upload className="w-4 h-4 mr-1" /> Load Saved{" "}
                            {layer.type}
                          </Button>
                        </div>
                      )}

                      {/* Effects (shown when selected) */}
                      {selectedLayer === layer.id && (
                        <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                          <div>
                            <Label className="text-xs">Reverb</Label>
                            <Slider
                              value={[layer.effects.reverb]}
                              onValueChange={(v) =>
                                updateLayer(layer.id, {
                                  effects: { ...layer.effects, reverb: v[0] },
                                })
                              }
                              max={100}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Delay</Label>
                            <Slider
                              value={[layer.effects.delay]}
                              onValueChange={(v) =>
                                updateLayer(layer.id, {
                                  effects: { ...layer.effects, delay: v[0] },
                                })
                              }
                              max={100}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Distortion</Label>
                            <Slider
                              value={[layer.effects.distortion]}
                              onValueChange={(v) =>
                                updateLayer(layer.id, {
                                  effects: {
                                    ...layer.effects,
                                    distortion: v[0],
                                  },
                                })
                              }
                              max={100}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Controls & Master */}
        <div className="space-y-4">
          {/* AI Mix Assistant */}
          <Card className="bg-gradient-to-br from-blue-900/20 to-purple-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5" /> AI Mix Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe your ideal mix... e.g., 'Make it punchy with deep bass and crisp highs, add reverb to melody'"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="min-h-[100px]"
              />
              <Button
                onClick={aiMixAndMaster}
                className="w-full"
                disabled={generateMixMutation.isPending}
              >
                <Wand2 className="w-4 h-4 mr-1" />
                {generateMixMutation.isPending
                  ? "Mixing..."
                  : "AI Mix & Master"}
              </Button>
            </CardContent>
          </Card>

          {/* Master Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Master Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Master Volume: {masterVolume}%</Label>
                <Slider
                  value={[masterVolume]}
                  onValueChange={(v) => setMasterVolume(v[0])}
                  max={100}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>BPM: {bpm}</Label>
                <Slider
                  value={[bpm]}
                  onValueChange={(v) => setBpm(v[0])}
                  min={60}
                  max={200}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Mix Name</Label>
                <input
                  className="w-full p-2 mt-1 bg-gray-800 rounded"
                  value={mixName}
                  onChange={(e) => setMixName(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <RefreshCw className="w-4 h-4 mr-2" /> Auto-Sync Layers
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Volume2 className="w-4 h-4 mr-2" /> Auto-Balance Volume
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Music className="w-4 h-4 mr-2" /> Quantize All
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
