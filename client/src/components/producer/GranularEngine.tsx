import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  AudioWaveform, 
  Play, 
  Pause, 
  Upload,
  RotateCcw
} from "lucide-react";

export default function GranularEngine() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [grainSize, setGrainSize] = useState([50]);
  const [grainDensity, setGrainDensity] = useState([75]);
  const [position, setPosition] = useState([50]);
  const [pitch, setPitch] = useState([0]);
  const [spread, setSpread] = useState([25]);

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AudioWaveform className="h-6 w-6" />
            Granular Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Audio Source */}
            <div>
              <h3 className="font-medium mb-4">Audio Source</h3>
              <Button variant="outline" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Load Audio File
              </Button>
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Grain Size</label>
                <Slider
                  value={grainSize}
                  onValueChange={setGrainSize}
                  max={200}
                  min={1}
                  step={1}
                />
                <div className="text-xs text-gray-500 mt-1">{grainSize[0]}ms</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Grain Density</label>
                <Slider
                  value={grainDensity}
                  onValueChange={setGrainDensity}
                  max={100}
                  min={1}
                  step={1}
                />
                <div className="text-xs text-gray-500 mt-1">{grainDensity[0]}%</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Position</label>
                <Slider
                  value={position}
                  onValueChange={setPosition}
                  max={100}
                  min={0}
                  step={1}
                />
                <div className="text-xs text-gray-500 mt-1">{position[0]}%</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Pitch</label>
                <Slider
                  value={pitch}
                  onValueChange={setPitch}
                  max={24}
                  min={-24}
                  step={1}
                />
                <div className="text-xs text-gray-500 mt-1">{pitch[0]} semitones</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Spread</label>
                <Slider
                  value={spread}
                  onValueChange={setSpread}
                  max={100}
                  min={0}
                  step={1}
                />
                <div className="text-xs text-gray-500 mt-1">{spread[0]}%</div>
              </div>
            </div>

            {/* Transport */}
            <div className="flex gap-2">
              <Button
                variant={isPlaying ? "default" : "outline"}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="outline">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
