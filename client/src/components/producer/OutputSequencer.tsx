import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Pause, 
  Square,
  RotateCcw,
  Volume2,
  Settings
} from "lucide-react";

interface SequenceStep {
  id: number;
  active: boolean;
  velocity: number;
  note: string;
}

export default function OutputSequencer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState([120]);
  const [steps, setSteps] = useState<SequenceStep[]>(
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      active: false,
      velocity: 127,
      note: "C4"
    }))
  );

  const toggleStep = (stepId: number) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, active: !step.active }
        : step
    ));
  };

  const clearAll = () => {
    setSteps(prev => prev.map(step => ({ ...step, active: false })));
  };

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Output Sequencer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Transport Controls */}
            <div className="flex items-center gap-4">
              <Button
                variant={isPlaying ? "default" : "outline"}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                <Square className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={clearAll}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm">BPM:</span>
                <Slider
                  value={bpm}
                  onValueChange={setBpm}
                  max={200}
                  min={60}
                  step={1}
                  className="w-24"
                />
                <span className="text-sm w-8">{bpm[0]}</span>
              </div>
            </div>

            {/* Step Grid */}
            <div>
              <h3 className="font-medium mb-4">Sequence Steps</h3>
              <div className="grid grid-cols-16 gap-1">
                {steps.map((step) => (
                  <Button
                    key={step.id}
                    variant={step.active ? "default" : "outline"}
                    className={`h-12 w-12 p-0 ${
                      currentStep === step.id && isPlaying ? "ring-2 ring-blue-500" : ""
                    }`}
                    onClick={() => toggleStep(step.id)}
                  >
                    {step.id + 1}
                  </Button>
                ))}
              </div>
            </div>

            {/* Pattern Info */}
            <div className="flex items-center gap-4">
              <Badge variant="outline">
                Active Steps: {steps.filter(s => s.active).length}
              </Badge>
              <Badge variant="outline">
                Current: {currentStep + 1}/16
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
