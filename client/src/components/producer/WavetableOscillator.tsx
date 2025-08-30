import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Radio, 
  Play, 
  Pause, 
  Volume2
} from "lucide-react";

export function WavetableOscillator() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveform, setWaveform] = useState("sine");
  const [frequency, setFrequency] = useState([440]);
  const [amplitude, setAmplitude] = useState([75]);
  const [wavetablePosition, setWavetablePosition] = useState([0]);
  const [detune, setDetune] = useState([0]);

  const waveforms = ["sine", "square", "sawtooth", "triangle", "noise"];

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-6 w-6" />
            Wavetable Oscillator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Waveform Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Waveform</label>
              <Select value={waveform} onValueChange={setWaveform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {waveforms.map((wave) => (
                    <SelectItem key={wave} value={wave}>
                      {wave.charAt(0).toUpperCase() + wave.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Frequency</label>
                <Slider
                  value={frequency}
                  onValueChange={setFrequency}
                  max={2000}
                  min={20}
                  step={1}
                />
                <div className="text-xs text-gray-500 mt-1">{frequency[0]} Hz</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Amplitude</label>
                <Slider
                  value={amplitude}
                  onValueChange={setAmplitude}
                  max={100}
                  min={0}
                  step={1}
                />
                <div className="text-xs text-gray-500 mt-1">{amplitude[0]}%</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Wavetable Position</label>
                <Slider
                  value={wavetablePosition}
                  onValueChange={setWavetablePosition}
                  max={100}
                  min={0}
                  step={1}
                />
                <div className="text-xs text-gray-500 mt-1">{wavetablePosition[0]}%</div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Detune</label>
                <Slider
                  value={detune}
                  onValueChange={setDetune}
                  max={100}
                  min={-100}
                  step={1}
                />
                <div className="text-xs text-gray-500 mt-1">{detune[0]} cents</div>
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
