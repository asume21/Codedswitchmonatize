import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Layers, 
  Plus, 
  Minus, 
  Play, 
  Pause, 
  Volume2,
  Eye,
  EyeOff,
  Lock,
  Unlock
} from "lucide-react";

interface Layer {
  id: string;
  name: string;
  type: "drums" | "bass" | "melody" | "harmony" | "fx";
  volume: number[];
  opacity: number[];
  active: boolean;
  visible: boolean;
  locked: boolean;
  color: string;
}

export default function DynamicLayering() {
  const [layers, setLayers] = useState<Layer[]>([
    {
      id: "1",
      name: "Kick Pattern",
      type: "drums",
      volume: [80],
      opacity: [100],
      active: true,
      visible: true,
      locked: false,
      color: "bg-red-500"
    },
    {
      id: "2",
      name: "Bass Line",
      type: "bass",
      volume: [70],
      opacity: [85],
      active: true,
      visible: true,
      locked: false,
      color: "bg-blue-500"
    },
    {
      id: "3",
      name: "Lead Melody",
      type: "melody",
      volume: [65],
      opacity: [90],
      active: false,
      visible: true,
      locked: false,
      color: "bg-green-500"
    },
    {
      id: "4",
      name: "Pad Harmony",
      type: "harmony",
      volume: [45],
      opacity: [60],
      active: false,
      visible: true,
      locked: false,
      color: "bg-purple-500"
    }
  ]);

  const [isPlaying, setIsPlaying] = useState(false);

  const updateLayer = (layerId: string, property: keyof Layer, value: any) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, [property]: value }
        : layer
    ));
  };

  const addLayer = () => {
    const newLayer: Layer = {
      id: Date.now().toString(),
      name: `Layer ${layers.length + 1}`,
      type: "melody",
      volume: [75],
      opacity: [100],
      active: false,
      visible: true,
      locked: false,
      color: "bg-gray-500"
    };
    setLayers(prev => [...prev, newLayer]);
  };

  const removeLayer = (layerId: string) => {
    setLayers(prev => prev.filter(layer => layer.id !== layerId));
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "drums": return "bg-red-100 text-red-800";
      case "bass": return "bg-blue-100 text-blue-800";
      case "melody": return "bg-green-100 text-green-800";
      case "harmony": return "bg-purple-100 text-purple-800";
      case "fx": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Dynamic Layering
          </CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <div className="flex gap-6 h-full">
            {/* Layer List */}
            <div className="w-1/2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Audio Layers</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addLayer}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant={isPlaying ? "default" : "outline"}
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {layers.map((layer) => (
                  <Card key={layer.id} className={`border-l-4 ${layer.color.replace('bg-', 'border-')}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${layer.color}`}></div>
                          <span className="font-medium">{layer.name}</span>
                          <Badge variant="outline" className={getTypeColor(layer.type)}>
                            {layer.type}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateLayer(layer.id, 'visible', !layer.visible)}
                          >
                            {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateLayer(layer.id, 'locked', !layer.locked)}
                          >
                            {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeLayer(layer.id)}
                            disabled={layer.locked}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm w-12">Active</span>
                          <Switch
                            checked={layer.active}
                            onCheckedChange={(checked) => updateLayer(layer.id, 'active', checked)}
                            disabled={layer.locked}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Volume2 className="h-4 w-4" />
                            <span className="text-sm w-16">Volume</span>
                            <Slider
                              value={layer.volume}
                              onValueChange={(value) => updateLayer(layer.id, 'volume', value)}
                              max={100}
                              min={0}
                              step={1}
                              className="flex-1"
                              disabled={layer.locked}
                            />
                            <span className="text-sm w-8">{layer.volume[0]}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4" />
                            <span className="text-sm w-16">Opacity</span>
                            <Slider
                              value={layer.opacity}
                              onValueChange={(value) => updateLayer(layer.id, 'opacity', value)}
                              max={100}
                              min={0}
                              step={1}
                              className="flex-1"
                              disabled={layer.locked}
                            />
                            <span className="text-sm w-8">{layer.opacity[0]}%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Visual Timeline */}
            <div className="flex-1">
              <h3 className="font-medium mb-4">Layer Timeline</h3>
              <div className="bg-gray-900 rounded-lg p-4 h-96">
                <div className="space-y-2">
                  {layers.filter(layer => layer.visible).map((layer, index) => (
                    <div key={layer.id} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${layer.color}`}></div>
                      <div className="flex-1 h-8 bg-gray-800 rounded relative overflow-hidden">
                        {layer.active && (
                          <div 
                            className={`h-full ${layer.color} rounded`}
                            style={{ 
                              opacity: layer.opacity[0] / 100,
                              width: `${layer.volume[0]}%`
                            }}
                          ></div>
                        )}
                        {isPlaying && layer.active && (
                          <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 w-20">{layer.name}</span>
                    </div>
                  ))}
                </div>

                {layers.filter(layer => layer.visible).length === 0 && (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No visible layers</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Layer Controls */}
              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => setLayers(prev => prev.map(l => ({ ...l, active: true })))}
                  >
                    Enable All
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setLayers(prev => prev.map(l => ({ ...l, active: false })))}
                  >
                    Disable All
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setLayers(prev => prev.map(l => ({ ...l, volume: [75], opacity: [100] })))}
                  >
                    Reset Levels
                  </Button>
                </div>

                <div className="text-sm text-gray-600">
                  Active Layers: {layers.filter(l => l.active).length} / {layers.length}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
