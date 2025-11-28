// client/src/components/studio/DAWLayoutWorkspace.tsx
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

// NEW CODEDSWITCH FLOW LAYOUT CONFIG — THIS IS THE ONE
const layoutConfig = {
  "version": "1.0",
  "splitLayout": {
    "id": "root",
    "type": "split",
    "direction": "vertical",
    "children": [
      // TOP — TRANSPORT (always visible)
      {
        "id": "top",
        "type": "panel",
        "content": "transport",
        "size": 90
      },
      // MAIN ROW
      {
        "id": "main",
        "type": "split",
        "direction": "horizontal",
        "flex": 1,
        "children": [
          // LEFT — INSTRUMENTS (collapsible)
          {
            "id": "instruments",
            "type": "panel",
            "content": "instruments",
            "size": 320,
            "collapsible": true
          },
          // CENTER — TIMELINE + PIANO ROLL
          {
            "id": "center",
            "type": "split",
            "direction": "vertical",
            "flex": 1,
            "children": [
              {
                "id": "timeline",
                "type": "panel",
                "content": "timeline",
                "flex": 1
              },
              {
                "id": "piano-roll",
                "type": "panel",
                "content": "piano-roll",
                "size": 350
              }
            ]
          },
          // RIGHT — EFFECTS + AI (collapsible)
          {
            "id": "right",
            "type": "split",
            "direction": "vertical",
            "size": 380,
            "children": [
              {
                "id": "ai",
                "type": "panel",
                "content": "ai-assistant",
                "size": 400,
                "collapsible": true
              },
              {
                "id": "effects",
                "type": "panel",
                "content": "effects",
                "flex": 1
              }
            ]
          }
        ]
      },
      // BOTTOM — MIXER (collapsible)
      {
        "id": "mixer",
        "type": "panel",
        "content": "mixer",
        "size": 500,
        "collapsible": true
      }
    ]
  }
};

// Keep your existing components below (InstrumentsPanel, EffectsPanel, TimelinePanel)
// They are perfect — no changes needed

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
          <SelectTrigger className="h-8 text-xs">
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
    <Card className="h-full flex flex-col">
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
          <Slider value={[reverb]} onValueChange={([val]) => setReverb(val)} min={0} max={100} step={1} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Delay</label>
            <span className="text-xs font-mono">{delay}%</span>
          </div>
          <Slider value={[delay]} onValueChange={([val]) => setDelay(val)} min={0} max={100} step={1} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Distortion</label>
            <span className="text-xs font-mono">{distortion}%</span>
          </div>
          <Slider value={[distortion]} onValueChange={([val]) => setDistortion(val)} min={0} max={100} step={1} />
        </div>
      </CardContent>
    </Card>
  );
}

// Timeline panel
function TimelinePanel() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="h-full bg-gray-900/50 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Arrangement View Coming Soon</p>
      </CardContent>
    </Card>
  );
}

export default function DAWLayoutWorkspace() {
  const contentMap = {
    "instruments": <InstrumentsPanel />,
    "effects": <EffectsPanel />,
    "timeline": <TimelinePanel />,
    "piano-roll": <VerticalPianoRoll />,
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