/**
 * Instrument Library Component
 * Browse and select virtual instruments for MIDI tracks
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Piano, Guitar, Drum, Music2, 
  X, Volume2, Waves, Mic2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Instrument {
  id: string;
  name: string;
  category: 'keys' | 'strings' | 'drums' | 'synth' | 'bass' | 'vocals' | 'fx';
  description: string;
  icon: string;
}

const INSTRUMENTS: Instrument[] = [
  { id: 'piano', name: 'Grand Piano', category: 'keys', description: 'Classic grand piano sound', icon: '🎹' },
  { id: 'electric-piano', name: 'Electric Piano', category: 'keys', description: 'Rhodes-style electric piano', icon: '🎹' },
  { id: 'organ', name: 'Hammond Organ', category: 'keys', description: 'Classic B3 organ', icon: '🎹' },
  { id: 'synth-lead', name: 'Synth Lead', category: 'synth', description: 'Modern synth lead', icon: '🎛️' },
  { id: 'synth-pad', name: 'Synth Pad', category: 'synth', description: 'Atmospheric pad sound', icon: '🎛️' },
  { id: 'synth-bass', name: 'Synth Bass', category: 'bass', description: 'Punchy synth bass', icon: '🎛️' },
  { id: 'acoustic-guitar', name: 'Acoustic Guitar', category: 'strings', description: 'Steel string acoustic', icon: '🎸' },
  { id: 'electric-guitar', name: 'Electric Guitar', category: 'strings', description: 'Clean electric guitar', icon: '🎸' },
  { id: 'bass-guitar', name: 'Bass Guitar', category: 'bass', description: 'Electric bass guitar', icon: '🎸' },
  { id: 'strings', name: 'String Ensemble', category: 'strings', description: 'Orchestral strings', icon: '🎻' },
  { id: 'drums-acoustic', name: 'Acoustic Drums', category: 'drums', description: 'Live drum kit', icon: '🥁' },
  { id: 'drums-electronic', name: 'Electronic Drums', category: 'drums', description: '808/909 style drums', icon: '🥁' },
  { id: 'percussion', name: 'Percussion', category: 'drums', description: 'World percussion', icon: '🥁' },
  { id: 'vocals', name: 'Vocal Synth', category: 'vocals', description: 'Synthesized vocals', icon: '🎤' },
  { id: 'choir', name: 'Choir', category: 'vocals', description: 'Vocal choir', icon: '🎤' },
  { id: 'fx-riser', name: 'Riser FX', category: 'fx', description: 'Build-up effects', icon: '✨' },
  { id: 'fx-impact', name: 'Impact FX', category: 'fx', description: 'Drop impacts', icon: '💥' },
];

interface InstrumentLibraryProps {
  onClose: () => void;
  onInstrumentSelect?: (instrument: Instrument) => void;
}

export default function InstrumentLibrary({ onClose, onInstrumentSelect }: InstrumentLibraryProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  const handleSelectInstrument = (instrument: Instrument) => {
    if (onInstrumentSelect) {
      onInstrumentSelect(instrument);
    }
    toast({ 
      title: 'Instrument Selected', 
      description: `${instrument.name} loaded` 
    });
  };

  const filteredInstruments = INSTRUMENTS.filter(inst => {
    const matchesSearch = inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          inst.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || inst.category === activeTab;
    return matchesSearch && matchesTab;
  });

  const categories = ['all', 'keys', 'synth', 'strings', 'bass', 'drums', 'vocals', 'fx'];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'keys': return <Piano className="w-4 h-4" />;
      case 'strings': return <Guitar className="w-4 h-4" />;
      case 'drums': return <Drum className="w-4 h-4" />;
      case 'synth': return <Waves className="w-4 h-4" />;
      case 'vocals': return <Mic2 className="w-4 h-4" />;
      default: return <Music2 className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-72 h-full bg-black/95 border-l border-cyan-500/40 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-cyan-500/40 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cyan-100 flex items-center gap-2">
          <Piano className="w-4 h-4 text-cyan-400" />
          Instrument Library
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="w-4 h-4 text-cyan-400" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-cyan-500/40">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
          <Input
            placeholder="Search instruments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-black/60 border-cyan-500/40 text-cyan-100 placeholder:text-cyan-400/50 h-8 text-sm"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2 bg-black/60 border border-cyan-500/40 h-auto flex-wrap">
          {categories.map(cat => (
            <TabsTrigger
              key={cat}
              value={cat}
              className="text-xs px-2 py-1 data-[state=active]:bg-cyan-500/30 data-[state=active]:text-cyan-100"
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 mt-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-1">
              {filteredInstruments.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-8 h-8 text-cyan-400/30 mx-auto mb-2" />
                  <p className="text-sm text-cyan-400/70">No instruments found</p>
                </div>
              ) : (
                filteredInstruments.map(instrument => (
                  <div
                    key={instrument.id}
                    onClick={() => handleSelectInstrument(instrument)}
                    className="flex items-center gap-3 p-2 rounded-lg border bg-black/40 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all cursor-pointer"
                  >
                    <div className="text-2xl">{instrument.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-cyan-100 font-medium">{instrument.name}</p>
                      <p className="text-xs text-cyan-400/70 truncate">{instrument.description}</p>
                    </div>
                    <div className="text-cyan-400">
                      {getCategoryIcon(instrument.category)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="p-3 border-t border-cyan-500/40 text-center">
        <p className="text-xs text-cyan-400/70">
          {INSTRUMENTS.length} instruments available
        </p>
      </div>
    </div>
  );
}
