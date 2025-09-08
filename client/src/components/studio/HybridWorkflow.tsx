import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Play, Pause, Square, RotateCcw, Sparkles, Edit3, Download, Upload } from 'lucide-react';

interface HybridProject {
  id: string;
  name: string;
  createdAt: Date;
  aiElements: AIGeneratedElement[];
  manualElements: ManualElement[];
  mixedElements: MixedElement[];
}

interface AIGeneratedElement {
  id: string;
  type: 'beat' | 'melody' | 'lyrics' | 'chord_progression';
  data: any;
  confidence: number;
  editable: boolean;
}

interface ManualElement {
  id: string;
  type: 'note_sequence' | 'chord_sequence' | 'drum_pattern';
  data: any;
  createdAt: Date;
}

interface MixedElement {
  id: string;
  aiSource: string;
  manualModifications: any[];
  finalResult: any;
}

export default function HybridWorkflow() {
  const { toast } = useToast();
  const [activeProject, setActiveProject] = useState<HybridProject | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // AI Generation Mutations
  const generateBeatMutation = useMutation({
    mutationFn: async (data: { style: string; bpm: number; complexity: number }) => {
      const response = await apiRequest('POST', '/api/beats/generate', data);
      return await response.json();
    },
    onSuccess: (beat) => {
      if (activeProject) {
        const aiElement: AIGeneratedElement = {
          id: `ai_${Date.now()}`,
          type: 'beat',
          data: beat,
          confidence: beat.confidence || 0.8,
          editable: true
        };
        setActiveProject(prev => prev ? {
          ...prev,
          aiElements: [...prev.aiElements, aiElement]
        } : null);
      }
      toast({
        title: "AI Beat Generated",
        description: "Beat added to your hybrid project!"
      });
    }
  });

  const generateMelodyMutation = useMutation({
    mutationFn: async (data: { scale: string; style: string; complexity: number }) => {
      const response = await apiRequest('POST', '/api/melodies/generate', data);
      return await response.json();
    },
    onSuccess: (melody) => {
      if (activeProject) {
        const aiElement: AIGeneratedElement = {
          id: `ai_${Date.now()}`,
          type: 'melody',
          data: melody,
          confidence: melody.confidence || 0.8,
          editable: true
        };
        setActiveProject(prev => prev ? {
          ...prev,
          aiElements: [...prev.aiElements, aiElement]
        } : null);
      }
      toast({
        title: "AI Melody Generated",
        description: "Melody added to your hybrid project!"
      });
    }
  });

  const createNewProject = () => {
    const newProject: HybridProject = {
      id: `project_${Date.now()}`,
      name: `Hybrid Project ${new Date().toLocaleDateString()}`,
      createdAt: new Date(),
      aiElements: [],
      manualElements: [],
      mixedElements: []
    };
    setActiveProject(newProject);
    toast({
      title: "New Hybrid Project Created",
      description: "Start building your perfect track!"
    });
  };

  const handlePlay = () => {
    if (isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setIsPlaying(false);
      setCurrentStep(0);
    } else {
      setIsPlaying(true);
      // Play logic for mixed elements
    }
  };

  const mixElements = (aiElementId: string, manualElementId: string) => {
    if (!activeProject) return;

    const aiElement = activeProject.aiElements.find(el => el.id === aiElementId);
    const manualElement = activeProject.manualElements.find(el => el.id === manualElementId);

    if (!aiElement || !manualElement) return;

    // Create mixed element
    const mixedElement: MixedElement = {
      id: `mixed_${Date.now()}`,
      aiSource: aiElementId,
      manualModifications: [manualElement],
      finalResult: {
        ...aiElement.data,
        manualOverlays: [manualElement.data]
      }
    };

    setActiveProject(prev => prev ? {
      ...prev,
      mixedElements: [...prev.mixedElements, mixedElement]
    } : null);

    toast({
      title: "Elements Mixed",
      description: "AI and manual elements combined successfully!"
    });
  };

  const exportProject = () => {
    if (!activeProject) return;

    const exportData = {
      project: activeProject,
      timestamp: new Date().toISOString(),
      version: "1.0"
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProject.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Project Exported",
      description: "Your hybrid project has been saved!"
    });
  };

  return (
    <div className="h-full w-full bg-gray-900 text-white">
      <Card className="h-full bg-gray-800 border-gray-700">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xl">🎵 Hybrid Workflow Studio</span>
              <Badge variant="secondary" className="bg-purple-600">
                <Sparkles className="w-3 h-3 mr-1" />
                AI + Manual
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {!activeProject ? (
                <Button onClick={createNewProject} className="bg-green-600 hover:bg-green-500">
                  <Edit3 className="h-4 w-4 mr-2" />
                  New Hybrid Project
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handlePlay}
                    className={`${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Button onClick={exportProject} variant="outline" className="bg-blue-600 hover:bg-blue-500">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </>
              )}
            </div>
          </CardTitle>

          {activeProject && (
            <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-600">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{activeProject.name}</h3>
                  <p className="text-sm text-gray-400">
                    Created: {activeProject.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {activeProject.aiElements.length} AI Elements
                  </Badge>
                  <Badge variant="outline">
                    {activeProject.manualElements.length} Manual Elements
                  </Badge>
                  <Badge variant="outline" className="bg-purple-600">
                    {activeProject.mixedElements.length} Mixed Elements
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="h-full overflow-y-auto">
          {!activeProject ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <Sparkles className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Create Your First Hybrid Project</h3>
                <p className="text-gray-400 mb-6">
                  Combine AI-generated elements with your manual creativity to make the perfect track.
                </p>
                <Button onClick={createNewProject} className="bg-purple-600 hover:bg-purple-500">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start Hybrid Project
                </Button>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="generate" className="h-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="generate">🎯 Generate AI</TabsTrigger>
                <TabsTrigger value="manual">🎹 Manual Edit</TabsTrigger>
                <TabsTrigger value="mix">🔄 Mix Elements</TabsTrigger>
                <TabsTrigger value="export">💾 Export</TabsTrigger>
              </TabsList>

              <TabsContent value="generate" className="mt-6">
                <div className="space-y-6">
                  <Card className="bg-gray-800 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-lg">Generate AI Elements</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Beat Style</Label>
                          <select className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600">
                            <option value="hip-hop">Hip Hop</option>
                            <option value="electronic">Electronic</option>
                            <option value="rock">Rock</option>
                            <option value="jazz">Jazz</option>
                          </select>
                        </div>
                        <div>
                          <Label>BPM</Label>
                          <input
                            type="number"
                            defaultValue="120"
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={() => generateBeatMutation.mutate({
                          style: 'hip-hop',
                          bpm: 120,
                          complexity: 5
                        })}
                        disabled={generateBeatMutation.isPending}
                        className="w-full bg-blue-600 hover:bg-blue-500"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate AI Beat
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-lg">Generate AI Melody</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Scale</Label>
                          <select className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600">
                            <option value="C Major">C Major</option>
                            <option value="D Minor">D Minor</option>
                            <option value="A Minor">A Minor</option>
                          </select>
                        </div>
                        <div>
                          <Label>Style</Label>
                          <select className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600">
                            <option value="melodic">Melodic</option>
                            <option value="harmonic">Harmonic</option>
                            <option value="rhythmic">Rhythmic</option>
                          </select>
                        </div>
                      </div>
                      <Button
                        onClick={() => generateMelodyMutation.mutate({
                          scale: 'C Major',
                          style: 'melodic',
                          complexity: 5
                        })}
                        disabled={generateMelodyMutation.isPending}
                        className="w-full bg-green-600 hover:bg-green-500"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate AI Melody
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="mt-6">
                <div className="space-y-4">
                  <Card className="bg-gray-800 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-lg">Manual Elements</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <Edit3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400 mb-4">
                          Use the piano roll and other manual tools to create elements, then import them here.
                        </p>
                        <Button variant="outline" className="bg-gray-700 hover:bg-gray-600">
                          <Upload className="w-4 h-4 mr-2" />
                          Import Manual Element
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="mix" className="mt-6">
                <div className="space-y-4">
                  <Card className="bg-gray-800 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-lg">Mix AI & Manual Elements</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>AI Element</Label>
                            <select className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600">
                              <option value="">Select AI Element</option>
                              {activeProject.aiElements.map(el => (
                                <option key={el.id} value={el.id}>
                                  {el.type} (Confidence: {Math.round(el.confidence * 100)}%)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label>Manual Element</Label>
                            <select className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600">
                              <option value="">Select Manual Element</option>
                              {activeProject.manualElements.map(el => (
                                <option key={el.id} value={el.id}>{el.type}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <Button className="w-full bg-purple-600 hover:bg-purple-500">
                          🔄 Mix Elements
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="export" className="mt-6">
                <div className="space-y-4">
                  <Card className="bg-gray-800 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-lg">Export Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" className="bg-gray-700 hover:bg-gray-600">
                          🎵 Export as Audio
                        </Button>
                        <Button variant="outline" className="bg-gray-700 hover:bg-gray-600">
                          🎼 Export as MIDI
                        </Button>
                      </div>
                      <Button onClick={exportProject} className="w-full bg-blue-600 hover:bg-blue-500">
                        💾 Export Project File
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
