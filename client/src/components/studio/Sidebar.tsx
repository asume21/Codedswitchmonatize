import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Music, 
  Code, 
  Mic, 
  Headphones, 
  Settings, 
  FileMusic,
  Waveform,
  Play,
  Pause,
  Square
} from "lucide-react";

interface SidebarProps {
  onToolSelect?: (tool: string) => void;
  activeTool?: string;
}

export default function Sidebar({ onToolSelect, activeTool }: SidebarProps) {
  const tools = [
    { id: "music-studio", label: "Music Studio", icon: Music },
    { id: "beat-studio", label: "Beat Studio", icon: Waveform },
    { id: "melody-composer", label: "Melody Composer", icon: FileMusic },
    { id: "code-translator", label: "Code Translator", icon: Code },
    { id: "lyric-lab", label: "Lyric Lab", icon: Mic },
    { id: "mix-studio", label: "Mix Studio", icon: Headphones },
    { id: "ai-assistant", label: "AI Assistant", icon: Settings },
  ];

  return (
    <div className="w-64 h-full bg-gray-900 text-white p-4 flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Studio Tools</h2>
      </div>

      <div className="flex-1 space-y-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.id}
              variant={activeTool === tool.id ? "secondary" : "ghost"}
              className="w-full justify-start text-left"
              onClick={() => onToolSelect?.(tool.id)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {tool.label}
            </Button>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-700">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Transport</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <Play className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline">
                <Pause className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline">
                <Square className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
