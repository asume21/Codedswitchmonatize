import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Music, FileText, Settings, Save, Upload, Download } from 'lucide-react';

interface SongSection {
  id: string;
  name: string;
  duration: number;
  measures: number;
  instruments: string[];
  vocals?: boolean;
  dynamics: string;
  tempo?: number;
  key?: string;
  description: string;
}

interface SongMetadata {
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  key: string;
  duration: string;
  format: string;
}

interface ProductionNotes {
  mixing: string;
  mastering: string;
  effects: string;
  style: string;
  professionalGrade: boolean;
}

export function SongStructureManager() {
  const [songStructure, setSongStructure] = useState<SongSection[]>([
    {
      id: 'intro',
      name: 'Intro',
      duration: 16,
      measures: 4,
      instruments: ['piano', 'strings'],
      dynamics: 'soft',
      tempo: 120,
      key: 'C Major',
      description: 'Atmospheric opening with gentle piano and strings'
    }
  ]);

  const [metadata, setMetadata] = useState<SongMetadata>({
    title: '',
    artist: '',
    genre: '',
    bpm: 120,
    key: 'C Major',
    duration: '3:00',
    format: 'WAV'
  });

  const [productionNotes, setProductionNotes] = useState<ProductionNotes>({
    mixing: 'Professional stereo balance',
    mastering: 'Commercial loudness standards',
    effects: 'Studio-grade reverb and compression',
    style: 'modern',
    professionalGrade: true
  });

  const [chordProgression, setChordProgression] = useState('C - Am - F - G');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isEditingSection, setIsEditingSection] = useState(false);

  const commonInstruments = [
    'piano', 'guitar', 'bass', 'drums', 'strings', 'vocals', 'synth', 'horn', 'full_band', 'reduced'
  ];

  const dynamicsOptions = [
    'soft', 'moderate', 'powerful', 'intimate', 'climactic', 'decrescendo'
  ];

  const addSection = () => {
    const newSection: SongSection = {
      id: `section_${Date.now()}`,
      name: 'New Section',
      duration: 16,
      measures: 4,
      instruments: ['piano'],
      dynamics: 'moderate',
      description: 'New song section'
    };
    setSongStructure([...songStructure, newSection]);
  };

  const deleteSection = (id: string) => {
    setSongStructure(songStructure.filter(section => section.id !== id));
  };

  const updateSection = (id: string, updates: Partial<SongSection>) => {
    setSongStructure(songStructure.map(section => 
      section.id === id ? { ...section, ...updates } : section
    ));
  };

  const importStructure = () => {
    // Handle file import
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            const parsed = JSON.parse(content);
            if (parsed.intro || parsed.verse1 || parsed.chorus) {
              // Convert from your attached format to our format
              const sections = Object.entries(parsed).map(([key, value]: [string, unknown]) => {
                const section = value as Record<string, any>;
                return {
                  id: key,
                  name: key.charAt(0).toUpperCase() + key.slice(1),
                  duration: section.duration || 16,
                  measures: section.measures || 4,
                  instruments: Array.isArray(section.instruments) ? section.instruments : ['piano'],
                  vocals: section.vocals || false,
                  dynamics: section.dynamics || 'moderate',
                  tempo: section.tempo || 120,
                  key: section.key || 'C Major',
                  description: section.description || ''
                };
              });
              setSongStructure(sections);
            }
          } catch (error) {
            console.error('Error parsing file:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const exportStructure = () => {
    const fullStructure = {
      metadata,
      structure: songStructure.reduce((acc, section) => {
        acc[section.id] = section;
        return acc;
      }, {} as any),
      chordProgression,
      productionNotes
    };
    
    const blob = new Blob([JSON.stringify(fullStructure, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.title || 'song'}_structure.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full bg-gray-900 text-white p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold">Song Structure Manager</h1>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Professional Arrangement Tool
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={importStructure} variant="outline" className="flex items-center gap-2" data-testid="button-import">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button onClick={exportStructure} variant="outline" className="flex items-center gap-2" data-testid="button-export">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button onClick={addSection} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2" data-testid="button-add-section">
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        </div>
      </div>

      <Tabs defaultValue="structure" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="structure">Song Structure</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="chords">Chord Progression</TabsTrigger>
          <TabsTrigger value="production">Production Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="space-y-4">
          <Card className="p-6 bg-gray-800 border-gray-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Music className="h-5 w-5" />
              Song Sections
            </h3>
            
            <div className="grid gap-4">
              {songStructure.map((section, index) => (
                <Card key={section.id} className="p-4 bg-gray-750 border-gray-600">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{section.name}</h4>
                        <div className="flex gap-2 text-sm text-gray-400">
                          <span>{section.duration}s</span>
                          <span>•</span>
                          <span>{section.measures} measures</span>
                          <span>•</span>
                          <span className="capitalize">{section.dynamics}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="border-gray-600">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-gray-800 border-gray-600 text-white max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Section: {section.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Section Name</Label>
                                <Input
                                  value={section.name}
                                  onChange={(e) => { updateSection(section.id, { name: e.target.value }); }}
                                  className="bg-gray-700 border-gray-600"
                                />
                              </div>
                              <div>
                                <Label>Duration (seconds)</Label>
                                <Input
                                  type="number"
                                  value={section.duration}
                                  onChange={(e) => updateSection(section.id, { duration: parseInt(e.target.value) || 16 })}
                                  className="bg-gray-700 border-gray-600"
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Measures</Label>
                                <Input
                                  type="number"
                                  value={section.measures}
                                  onChange={(e) => updateSection(section.id, { measures: parseInt(e.target.value) || 4 })}
                                  className="bg-gray-700 border-gray-600"
                                />
                              </div>
                              <div>
                                <Label>Dynamics</Label>
                                <Select value={section.dynamics} onValueChange={(value) => updateSection(section.id, { dynamics: value })}>
                                  <SelectTrigger className="bg-gray-700 border-gray-600">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-600">
                                    {dynamicsOptions.map(option => (
                                      <SelectItem key={option} value={option}>{option}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div>
                              <Label>Instruments</Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {commonInstruments.map(instrument => (
                                  <Badge
                                    key={instrument}
                                    variant={section.instruments.includes(instrument) ? "default" : "outline"}
                                    className="cursor-pointer"
                                    onClick={() => {
                                      const instruments = section.instruments.includes(instrument)
                                        ? section.instruments.filter(i => i !== instrument)
                                        : [...section.instruments, instrument];
                                      updateSection(section.id, { instruments });
                                    }}
                                  >
                                    {instrument}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <Label>Description</Label>
                              <Textarea
                                value={section.description}
                                onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                className="bg-gray-700 border-gray-600"
                                rows={3}
                              />
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => deleteSection(section.id)}
                        className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {section.instruments.map(instrument => (
                        <Badge key={instrument} variant="secondary" className="text-xs">
                          {instrument}
                        </Badge>
                      ))}
                      {section.vocals && (
                        <Badge variant="default" className="text-xs bg-green-600">
                          Vocals
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-300">{section.description}</p>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="metadata" className="space-y-4">
          <Card className="p-6 bg-gray-800 border-gray-700">
            <h3 className="text-xl font-semibold mb-4">Song Metadata</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={metadata.title}
                  onChange={(e) => { setMetadata({...metadata, title: e.target.value}); }}
                  placeholder="Song Title"
                  className="bg-gray-700 border-gray-600"
                  data-testid="input-song-title"
                />
              </div>
              <div>
                <Label>Artist</Label>
                <Input
                  value={metadata.artist}
                  onChange={(e) => setMetadata({...metadata, artist: e.target.value})}
                  placeholder="Artist Name"
                  className="bg-gray-700 border-gray-600"
                  data-testid="input-song-artist"
                />
              </div>
              <div>
                <Label>Genre</Label>
                <Select value={metadata.genre} onValueChange={(value) => setMetadata({...metadata, genre: value})}>
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue placeholder="Select Genre" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="hip-hop">Hip Hop</SelectItem>
                    <SelectItem value="pop">Pop</SelectItem>
                    <SelectItem value="rock">Rock</SelectItem>
                    <SelectItem value="electronic">Electronic</SelectItem>
                    <SelectItem value="jazz">Jazz</SelectItem>
                    <SelectItem value="classical">Classical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>BPM</Label>
                <Input
                  type="number"
                  value={metadata.bpm}
                  onChange={(e) => setMetadata({...metadata, bpm: parseInt(e.target.value) || 120})}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label>Key</Label>
                <Input
                  value={metadata.key}
                  onChange={(e) => { setMetadata({...metadata, key: e.target.value}); }}
                  placeholder="C Major"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label>Duration</Label>
                <Input
                  value={metadata.duration}
                  onChange={(e) => setMetadata({...metadata, duration: e.target.value})}
                  placeholder="3:00"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="chords" className="space-y-4">
          <Card className="p-6 bg-gray-800 border-gray-700">
            <h3 className="text-xl font-semibold mb-4">Chord Progression</h3>
            
            <div>
              <Label>Main Progression</Label>
              <Input
                value={chordProgression}
                onChange={(e) => setChordProgression(e.target.value)}
                placeholder="C - Am - F - G"
                className="bg-gray-700 border-gray-600 mt-2"
                data-testid="input-chord-progression"
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          <Card className="p-6 bg-gray-800 border-gray-700">
            <h3 className="text-xl font-semibold mb-4">Production Notes</h3>
            
            <div className="space-y-4">
              <div>
                <Label>Mixing</Label>
                <Input
                  value={productionNotes.mixing}
                  onChange={(e) => { setProductionNotes({...productionNotes, mixing: e.target.value}); }}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label>Mastering</Label>
                <Input
                  value={productionNotes.mastering}
                  onChange={(e) => { setProductionNotes({...productionNotes, mastering: e.target.value}); }}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label>Effects</Label>
                <Input
                  value={productionNotes.effects}
                  onChange={(e) => { setProductionNotes({...productionNotes, effects: e.target.value}); }}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label>Style</Label>
                <Select value={productionNotes.style} onValueChange={(value) => { setProductionNotes({...productionNotes, style: value}); }}>
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="vintage">Vintage</SelectItem>
                    <SelectItem value="lo-fi">Lo-Fi</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}