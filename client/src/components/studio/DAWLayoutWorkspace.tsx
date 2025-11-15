import { useState, useContext } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { SplitLayoutRenderer } from "./SplitLayoutRenderer";
import TransportControls from "./TransportControls";
import VerticalPianoRoll from "./VerticalPianoRoll";
import ProfessionalMixer from "./ProfessionalMixer";
import FloatingAIAssistant from "./FloatingAIAssistant";
import { StudioAudioContext } from "@/pages/studio";
import { 
  Music, Activity, Sparkles, Sliders, 
  Piano, Clock, Mic2, Volume2 
} from "lucide-react";
import { realisticAudio } from "@/lib/realisticAudio";

// Import the layout config
const layoutConfig = {
  "version": "1.0",
  "splitLayout": {
    "id": "root",
    "type": "split",
    "direction": "horizontal",
    "children": [
      {
        "id": "left",
        "type": "split",
        "size": 1,
        "children": [
          {
            "id": "panel-1762910392636-xqfzuu54x",
            "type": "panel",
            "content": "instruments",
            "size": 1
          },
          {
            "id": "panel-1762910392636-vhrzvdek7",
            "type": "panel",
            "content": "effects",
            "size": 1
          }
        ],
        "direction": "horizontal"
      },
      {
        "id": "center",
        "type": "split",
        "size": 2,
        "children": [
          {
            "id": "panel-1762910384269-hib9mo7fn",
            "type": "split",
            "size": 1,
            "children": [
              {
                "id": "panel-1762910430291-k1w6rfjdg",
                "type": "panel",
                "content": "timeline",
                "size": 1
              },
              {
                "id": "panel-1762910430291-5ugmxl6oe",
                "type": "panel",
                "content": "piano-roll",
                "size": 1
              }
            ],
            "direction": "vertical"
          },
          {
            "id": "panel-1762910384269-sm3tumtze",
            "type": "panel",
            "content": "transport",
            "size": 1
          }
        ],
        "direction": "vertical"
      },
      {
        "id": "right",
        "type": "split",
        "direction": "vertical",
        "size": 1.5,
        "children": [
          {
            "id": "ai",
            "type": "panel",
            "content": "ai-assistant",
            "size": 2
          },
          {
            "id": "mixer",
            "type": "panel",
            "content": "mixer",
            "size": 1
          }
        ]
      }
    ]
  },
  "metadata": {
    "created": "2025-11-12T01:20:39.843Z",
    "density": "dense"
  }
};

// Instrument panel with realistic audio instruments
function InstrumentsPanel() {
  const [selectedInstrument, setSelectedInstrument] = useState("piano");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const instruments = [
    { id: "piano", name: "Piano", category: "keys", icon: Piano },
    { id: "guitar", name: "Guitar", category: "strings", icon: Music },
    { id: "bass-electric", name: "Electric Bass", category: "bass", icon: Activity },
    { id: "strings", name: "Strings", category: "orchestral", icon: Music },
    { id: "violin", name: "Violin", category: "orchestral", icon: Music },
    { id: "flute", name: "Flute", category: "winds", icon: Music },
    { id: "trumpet", name: "Trumpet", category: "brass", icon: Music },
    { id: "synth-analog", name: "Analog Synth", category: "synth", icon: Sparkles },
    { id: "leads-square", name: "Square Lead", category: "synth", icon: Sparkles },
  ];

  const categories = ["all", "keys", "strings", "bass", "orchestral", "winds", "brass", "synth"];

  const filteredInstruments = selectedCategory === "all" 
    ? instruments 
    : instruments.filter(inst => inst.category === selectedCategory);

  return (
    <Card className="h-full flex flex-col" data-testid="panel-instruments">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Music className="w-4 h-4" />
          Instruments
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-3 flex flex-col gap-2">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-instrument-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {filteredInstruments.map(inst => {
              const Icon = inst.icon;
              return (
                <Button
                  key={inst.id}
                  variant={selectedInstrument === inst.id ? "default" : "ghost"}
                  className="w-full justify-start h-8 text-xs"
                  onClick={() => setSelectedInstrument(inst.id)}
                  data-testid={`button-instrument-${inst.id}`}
                >
                  <Icon className="w-3 h-3 mr-2" />
                  {inst.name}
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Effects panel
function EffectsPanel() {
  const [reverb, setReverb] = useState(20);
  const [delay, setDelay] = useState(15);
  const [distortion, setDistortion] = useState(0);

  return (
    <Card className="h-full flex flex-col" data-testid="panel-effects">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sliders className="w-4 h-4" />
          Effects
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-3 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Reverb</label>
            <span className="text-xs font-mono">{reverb}%</span>
          </div>
          <Slider
            value={[reverb]}
            onValueChange={([val]) => setReverb(val)}
            min={0}
            max={100}
            step={1}
            data-testid="slider-reverb"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Delay</label>
            <span className="text-xs font-mono">{delay}%</span>
          </div>
          <Slider
            value={[delay]}
            onValueChange={([val]) => setDelay(val)}
            min={0}
            max={100}
            step={1}
            data-testid="slider-delay"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Distortion</label>
            <span className="text-xs font-mono">{distortion}%</span>
          </div>
          <Slider
            value={[distortion]}
            onValueChange={([val]) => setDistortion(val)}
            min={0}
            max={100}
            step={1}
            data-testid="slider-distortion"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Timeline/Arrangement panel
function TimelinePanel() {
  const context = useContext(StudioAudioContext);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(120); // 2 minutes

  return (
    <Card className="h-full flex flex-col" data-testid="panel-timeline">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-3">
        <div className="h-full bg-muted/20 rounded-md flex items-center justify-center relative">
          {/* Timeline ruler */}
          <div className="absolute top-0 left-0 right-0 h-6 border-b flex items-center px-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>0:00</span>
              <span>0:30</span>
              <span>1:00</span>
              <span>1:30</span>
              <span>2:00</span>
            </div>
          </div>
          
          {/* Placeholder for tracks */}
          <div className="text-xs text-muted-foreground">
            Arrangement View - BPM: {context.bpm}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DAWLayoutWorkspace() {
  const [tracks] = useState([
    {
      id: "1",
      name: "Piano",
      instrument: "piano",
      notes: [],
      volume: 80,
      pan: 0,
      muted: false,
      solo: false
    }
  ]);

  const contentMap = {
    "instruments": <InstrumentsPanel />,
    "effects": <EffectsPanel />,
    "timeline": <TimelinePanel />,
    "piano-roll": <VerticalPianoRoll tracks={tracks} selectedTrack="1" />,
    "transport": <TransportControls />,
    "ai-assistant": <FloatingAIAssistant />,
    "mixer": <ProfessionalMixer />,
  };

  return (
    <div className="h-full w-full" data-testid="daw-layout-workspace">
      <SplitLayoutRenderer 
        config={layoutConfig as any} 
        contentMap={contentMap} 
      />
    </div>
  );
}
