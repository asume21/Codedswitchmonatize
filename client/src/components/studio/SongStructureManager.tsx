import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Music2, 
  Plus, 
  Trash2, 
  ArrowUp,
  ArrowDown,
  Play,
  Copy
} from "lucide-react";

interface SongSection {
  id: string;
  name: string;
  type: "intro" | "verse" | "chorus" | "bridge" | "outro" | "breakdown";
  duration: number;
  bars: number;
  color: string;
}

export function SongStructureManager() {
  const [sections, setSections] = useState<SongSection[]>([
    {
      id: "1",
      name: "Intro",
      type: "intro",
      duration: 16,
      bars: 8,
      color: "bg-blue-500"
    },
    {
      id: "2",
      name: "Verse 1",
      type: "verse",
      duration: 32,
      bars: 16,
      color: "bg-green-500"
    },
    {
      id: "3",
      name: "Chorus",
      type: "chorus",
      duration: 32,
      bars: 16,
      color: "bg-red-500"
    },
    {
      id: "4",
      name: "Verse 2",
      type: "verse",
      duration: 32,
      bars: 16,
      color: "bg-green-500"
    },
    {
      id: "5",
      name: "Chorus",
      type: "chorus",
      duration: 32,
      bars: 16,
      color: "bg-red-500"
    }
  ]);

  const [currentSection, setCurrentSection] = useState<string | null>(null);

  const addSection = (type: SongSection["type"]) => {
    const newSection: SongSection = {
      id: Date.now().toString(),
      name: type.charAt(0).toUpperCase() + type.slice(1),
      type,
      duration: 32,
      bars: 16,
      color: getSectionColor(type)
    };
    setSections(prev => [...prev, newSection]);
  };

  const removeSection = (sectionId: string) => {
    setSections(prev => prev.filter(section => section.id !== sectionId));
  };

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    setSections(prev => {
      const index = prev.findIndex(s => s.id === sectionId);
      if (index === -1) return prev;
      
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newSections = [...prev];
      [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
      return newSections;
    });
  };

  const duplicateSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const newSection = {
      ...section,
      id: Date.now().toString(),
      name: `${section.name} (Copy)`
    };
    setSections(prev => [...prev, newSection]);
  };

  const getSectionColor = (type: SongSection["type"]) => {
    switch (type) {
      case "intro": return "bg-blue-500";
      case "verse": return "bg-green-500";
      case "chorus": return "bg-red-500";
      case "bridge": return "bg-purple-500";
      case "outro": return "bg-gray-500";
      case "breakdown": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getTotalDuration = () => {
    return sections.reduce((total, section) => total + section.duration, 0);
  };

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 className="h-6 w-6" />
            Song Structure Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 h-full">
            {/* Section List */}
            <div className="w-1/2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Song Sections</h3>
                <div className="text-sm text-gray-600">
                  Total: {getTotalDuration()}s ({Math.ceil(getTotalDuration() / 60)}:{String(getTotalDuration() % 60).padStart(2, '0')})
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sections.map((section, index) => (
                  <Card key={section.id} className={`border-l-4 ${section.color.replace('bg-', 'border-')}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${section.color}`}></div>
                          <span className="font-medium">{section.name}</span>
                          <Badge variant="outline">{section.type}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveSection(section.id, "up")}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveSection(section.id, "down")}
                            disabled={index === sections.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => duplicateSection(section.id)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeSection(section.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span>{section.bars} bars</span>
                        <span>{section.duration}s</span>
                        <Button
                          size="sm"
                          variant={currentSection === section.id ? "default" : "outline"}
                          onClick={() => setCurrentSection(section.id)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Play
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Add Section Buttons */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Add Section:</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => addSection("intro")}>
                    <Plus className="h-3 w-3 mr-1" />
                    Intro
                  </Button>
                  <Button size="sm" onClick={() => addSection("verse")}>
                    <Plus className="h-3 w-3 mr-1" />
                    Verse
                  </Button>
                  <Button size="sm" onClick={() => addSection("chorus")}>
                    <Plus className="h-3 w-3 mr-1" />
                    Chorus
                  </Button>
                  <Button size="sm" onClick={() => addSection("bridge")}>
                    <Plus className="h-3 w-3 mr-1" />
                    Bridge
                  </Button>
                  <Button size="sm" onClick={() => addSection("breakdown")}>
                    <Plus className="h-3 w-3 mr-1" />
                    Breakdown
                  </Button>
                  <Button size="sm" onClick={() => addSection("outro")}>
                    <Plus className="h-3 w-3 mr-1" />
                    Outro
                  </Button>
                </div>
              </div>
            </div>

            {/* Visual Timeline */}
            <div className="flex-1">
              <h3 className="font-medium mb-4">Structure Timeline</h3>
              <div className="bg-gray-900 rounded-lg p-4 h-96">
                <div className="space-y-1">
                  {sections.map((section, index) => (
                    <div key={section.id} className="flex items-center gap-2">
                      <div className="w-8 text-xs text-gray-400">{index + 1}</div>
                      <div 
                        className={`flex-1 h-8 ${section.color} rounded flex items-center px-3 text-white text-sm font-medium cursor-pointer hover:opacity-80`}
                        style={{ width: `${(section.duration / getTotalDuration()) * 100}%` }}
                        onClick={() => setCurrentSection(section.id)}
                      >
                        {section.name}
                      </div>
                      <div className="w-12 text-xs text-gray-400">{section.duration}s</div>
                    </div>
                  ))}
                </div>

                {sections.length === 0 && (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Music2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No sections added</p>
                      <p className="text-sm">Add sections to build your song structure</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Structure Templates */}
              <div className="mt-4">
                <h4 className="font-medium mb-2">Quick Templates</h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    Pop Structure
                  </Button>
                  <Button size="sm" variant="outline">
                    Rock Structure
                  </Button>
                  <Button size="sm" variant="outline">
                    Electronic
                  </Button>
                  <Button size="sm" variant="outline">
                    Custom
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
