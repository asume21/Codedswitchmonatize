import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music, Play, Pause, Square, Download } from "lucide-react";

export default function MelodyComposer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState([120]);
  const [key, setKey] = useState("C");
  const [scale, setScale] = useState("major");

  const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const scales = ["major", "minor", "pentatonic", "blues", "dorian", "mixolydian"];

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-6 w-6" />
            Melody Composer
          </CardTitle>
        </CardHeader>
        <CardContent className="h-full space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Key</label>
              <Select value={key} onValueChange={setKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {keys.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Scale</label>
              <Select value={scale} onValueChange={setScale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scales.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Tempo: {tempo[0]} BPM
              </label>
              <Slider
                value={tempo}
                onValueChange={setTempo}
                max={200}
                min={60}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex-1 bg-white rounded-lg border p-4">
            <div className="h-64 bg-gray-50 rounded border-2 border-dashed flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Music className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Piano roll will appear here</p>
                <p className="text-xs">Click to add notes</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex gap-2">
              <Button onClick={handlePlay} variant="outline">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="outline">
                <Square className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2 ml-auto">
              <Button variant="outline">Generate AI Melody</Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export MIDI
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
