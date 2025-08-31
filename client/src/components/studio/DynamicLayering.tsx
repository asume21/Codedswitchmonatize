import { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { StudioAudioContext } from "@/pages/studio";
import { useAudio } from "@/hooks/use-audio";

interface Layer {
  instrument: string;
  type: string;
  notes: Array<{
    frequency: number;
    start: number;
    duration: number;
    velocity: number;
  }>;
  volume: number;
  pan: number;
  effects: string[];
  role: string;
}

interface LayerResult {
  layers: Layer[];
  layerType: string;
  primaryInstrument: string;
  approach: string;
  complexity: number;
  explanation: string;
}

export default function DynamicLayering() {
  const [targetStyle, setTargetStyle] = useState("electronic");
  const [complexity, setComplexity] = useState([5]);
  const [generatedLayers, setGeneratedLayers] = useState<Layer[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

  const { toast } = useToast();
  const { playFrequency, initialize, isInitialized } = useAudio();
  const studioContext = useContext(StudioAudioContext);

  const generateLayersMutation = useMutation({
    mutationFn: async (data: { arrangement: any; style: string; complexity: number }) => {
      // Add randomization for variety
      const styles = ["electronic", "orchestral", "jazz", "rock", "ambient", "world", "cinematic", "experimental"];
      const complexities = [3, 4, 5, 6, 7, 8];
      
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];
      const randomComplexity = complexities[Math.floor(Math.random() * complexities.length)];
      
      const response = await apiRequest("POST", "/api/layers/generate", {
        ...data,
        style: randomStyle,
        complexity: randomComplexity
      });
      return response.json();
    },
    onSuccess: (data: LayerResult) => {
      if (data.layers) {
        setGeneratedLayers(data.layers);
        // Add layers to studio context
        studioContext.setCurrentLayers?.(data.layers);
      }
      toast({
        title: "Layers Generated",
        description: `AI created ${data.layers?.length || 0} ${data.approach} ${data.primaryInstrument} layers!`,
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate dynamic layers. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getCurrentArrangement = () => {
    return {
      beatPattern: studioContext.currentPattern,
      melody: studioContext.currentMelody,
      lyrics: studioContext.currentLyrics,
      codeMusic: studioContext.currentCodeMusic,
      bpm: 120, // Default BPM
      timestamp: Date.now()
    };
  };

  const handleGenerateLayers = () => {
    const arrangement = getCurrentArrangement();
    
    generateLayersMutation.mutate({
      arrangement,
      style: targetStyle,
      complexity: complexity[0]
    });
  };

  const playLayer = async (layer: Layer) => {
    if (!isInitialized) {
      await initialize();
    }

    setIsPlaying(true);
    setSelectedLayer(layer.instrument);

    // Play the layer's notes in sequence
    for (const note of layer.notes) {
      setTimeout(() => {
        playFrequency(note.frequency, note.duration, layer.instrument, note.velocity);
      }, note.start * 1000);
    }

    // Stop playing after the longest note
    const maxEnd = Math.max(...layer.notes.map(n => n.start + n.duration));
    setTimeout(() => {
      setIsPlaying(false);
      setSelectedLayer(null);
    }, maxEnd * 1000);
  };

  const playAllLayers = async () => {
    if (!isInitialized) {
      await initialize();
    }

    setIsPlaying(true);

    // Play all layers simultaneously
    generatedLayers.forEach(layer => {
      layer.notes.forEach(note => {
        setTimeout(() => {
          playFrequency(note.frequency, note.duration, layer.instrument, note.velocity * layer.volume);
        }, note.start * 1000);
      });
    });

    // Calculate total duration
    const maxDuration = Math.max(
      ...generatedLayers.flatMap(layer => 
        layer.notes.map(note => note.start + note.duration)
      )
    );

    setTimeout(() => {
      setIsPlaying(false);
    }, maxDuration * 1000);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-600 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-heading font-bold">AI Dynamic Layering</h2>
          <div className="flex items-center space-x-2">
            <Button
              onClick={initialize}
              disabled={isInitialized}
              className="bg-studio-accent hover:bg-blue-500"
            >
              <i className="fas fa-power-off mr-2"></i>
              {isInitialized ? 'Audio Ready' : 'Start Audio'}
            </Button>
            <div className="text-xs text-gray-400 px-2">
              <div>Intelligent instrument layering</div>
              <div>Analyzes your arrangement and adds complementary parts</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Target Style</Label>
            <Select value={targetStyle} onValueChange={setTargetStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orchestral">Orchestral (Strings, Brass, Woodwinds)</SelectItem>
                <SelectItem value="electronic">Electronic (Synths, Pads, Piano)</SelectItem>
                <SelectItem value="jazz">Jazz (Piano, Trumpet, Saxophone)</SelectItem>
                <SelectItem value="rock">Rock (Guitar, Organ, Strings)</SelectItem>
                <SelectItem value="ambient">Ambient (Pads, Harp, Choir)</SelectItem>
                <SelectItem value="world">World (Ethnic Instruments, Flute)</SelectItem>
                <SelectItem value="cinematic">Cinematic (Full Orchestra)</SelectItem>
                <SelectItem value="experimental">Experimental (Mixed Instruments)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Complexity: {complexity[0]}/10</Label>
            <Slider
              value={complexity}
              onValueChange={setComplexity}
              max={10}
              min={1}
              step={1}
              className="w-full"
            />
          </div>

          <div className="flex items-end space-x-2">
            <Button
              onClick={handleGenerateLayers}
              disabled={generateLayersMutation.isPending}
              className="bg-studio-accent hover:bg-blue-500 flex-1"
            >
              {generateLayersMutation.isPending ? (
                <>
                  <i className="fas fa-spinner animate-spin mr-2"></i>
                  Generating...
                </>
              ) : (
                <>
                  <i className="fas fa-layer-group mr-2"></i>
                  Generate Layers
                </>
              )}
            </Button>

            {generatedLayers.length > 0 && (
              <Button
                onClick={playAllLayers}
                disabled={isPlaying || !isInitialized}
                className="bg-green-600 hover:bg-green-500"
              >
                <i className={`fas ${isPlaying ? 'fa-stop' : 'fa-play'} mr-2`}></i>
                {isPlaying ? 'Stop' : 'Play All'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {generatedLayers.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div className="max-w-md">
              <i className="fas fa-layer-group text-6xl text-gray-600 mb-4"></i>
              <h3 className="text-xl font-semibold mb-2">No Layers Generated</h3>
              <p className="text-gray-400 mb-6">
                Click "Generate Layers" to have AI analyze your current arrangement and add intelligent instrumental layers with piano, violin, guitar, flute, trumpet, and other melodic instruments.
              </p>
              <div className="text-sm text-gray-500 space-y-2">
                <p><strong>Current Arrangement:</strong></p>
                <p>• Beats: {studioContext.currentPattern ? 'Available' : 'None'}</p>
                <p>• Melody: {studioContext.currentMelody?.length ? `${studioContext.currentMelody.length} notes` : 'None'}</p>
                <p>• Lyrics: {studioContext.currentLyrics ? 'Available' : 'None'}</p>
              </div>
              <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-400 mb-2"><strong>Available Instruments:</strong></p>
                <div className="flex flex-wrap gap-1 text-xs">
                  {["Piano", "Violin", "Guitar", "Flute", "Trumpet", "Saxophone", "Organ", "Harp", "Cello", "Synthesizer", "Ambient Pads", "Choir"].map(inst => (
                    <span key={inst} className="bg-gray-700 text-gray-300 px-2 py-1 rounded">{inst}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Generated Layers ({generatedLayers.length})</h3>
              <Badge variant="secondary">{targetStyle} style</Badge>
            </div>

            <div className="grid gap-4">
              {generatedLayers.map((layer, index) => (
                <Card key={index} className={`border-gray-600 ${selectedLayer === layer.instrument ? 'ring-2 ring-blue-500' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{layer.instrument}</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{layer.type}</Badge>
                        <Button
                          size="sm"
                          onClick={() => playLayer(layer)}
                          disabled={isPlaying || !isInitialized}
                          className="bg-green-600 hover:bg-green-500"
                        >
                          <i className={`fas ${isPlaying && selectedLayer === layer.instrument ? 'fa-stop' : 'fa-play'} mr-1`}></i>
                          {isPlaying && selectedLayer === layer.instrument ? 'Stop' : 'Play'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Volume:</span>
                          <div className="font-semibold">{Math.round(layer.volume * 100)}%</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Pan:</span>
                          <div className="font-semibold">
                            {layer.pan === 0 ? 'Center' : layer.pan > 0 ? `${Math.round(layer.pan * 100)}% R` : `${Math.round(Math.abs(layer.pan) * 100)}% L`}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Notes:</span>
                          <div className="font-semibold">{layer.notes.length}</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Role:</span>
                          <div className="font-semibold text-xs">{layer.role}</div>
                        </div>
                      </div>

                      {(Array.isArray(layer.effects) ? layer.effects.length > 0 : layer.effects) && (
                        <div>
                          <span className="text-gray-400 text-sm">Effects:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(Array.isArray(layer.effects) ? layer.effects : layer.effects ? [layer.effects] : []).map((effect, effectIndex) => (
                              <Badge key={effectIndex} variant="secondary" className="text-xs">
                                {effect}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <Separator className="bg-gray-600" />

                      <div className="space-y-1">
                        <span className="text-gray-400 text-sm">Note Preview (first 3):</span>
                        {layer.notes.slice(0, 3).map((note, noteIndex) => (
                          <div key={noteIndex} className="text-xs font-mono bg-gray-800 p-2 rounded">
                            {Math.round(note.frequency)}Hz • {note.start}s • {note.duration}s • {Math.round(note.velocity * 100)}%
                          </div>
                        ))}
                        {layer.notes.length > 3 && (
                          <div className="text-xs text-gray-500">+{layer.notes.length - 3} more notes...</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}