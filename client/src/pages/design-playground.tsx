import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Layout, 
  Maximize2, 
  Grid3x3, 
  Columns,
  Music,
  Sliders,
  Layers,
  FileAudio,
  ChevronRight,
  ChevronDown,
  Play,
  Square,
  SkipBack,
  SkipForward,
  Settings,
  Plus,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';

type LayoutOption = 'current' | 'file-tabs' | 'immersive' | 'modular';

export default function DesignPlayground() {
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('current');
  const [leftPanelTab, setLeftPanelTab] = useState('instruments');
  const [isPlaying, setIsPlaying] = useState(false);

  const layoutOptions = [
    { 
      id: 'current' as LayoutOption, 
      name: 'Current Design', 
      icon: Layout,
      description: 'Your existing Unified Studio layout'
    },
    { 
      id: 'file-tabs' as LayoutOption, 
      name: 'File-Tab Style', 
      icon: Columns,
      description: 'Left panel with file-style tabs (VS Code inspired)'
    },
    { 
      id: 'immersive' as LayoutOption, 
      name: 'Immersive Mode', 
      icon: Maximize2,
      description: 'Full-screen DAW, minimal chrome'
    },
    { 
      id: 'modular' as LayoutOption, 
      name: 'Modular Windows', 
      icon: Grid3x3,
      description: 'Floating draggable panels (Pro Tools style)'
    },
  ];

  const instruments = ['Grand Piano', 'Electric Piano', '808 Bass', 'Synth Bass', 'Acoustic Guitar', 'Lead Synth'];
  const patterns = ['Pattern 1', 'Pattern 2', 'Drum Loop 1', 'Bass Loop 1'];
  const effects = ['Reverb', 'Delay', 'Compressor', 'EQ', 'Distortion'];
  const samples = ['Kick.wav', 'Snare.wav', 'HiHat.wav', 'Clap.wav'];

  const renderCurrentLayout = () => (
    <div className="flex h-full bg-background">
      {/* Left Panel - Instruments */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <Input placeholder="Search instruments..." data-testid="input-search-instruments" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="font-semibold mb-2 flex items-center gap-2">
            <ChevronDown className="w-4 h-4" />
            Piano
          </div>
          {instruments.slice(0, 2).map((inst, i) => (
            <div key={i} className="pl-6 py-1 text-sm text-muted-foreground hover-elevate rounded-md px-2 cursor-pointer" data-testid={`item-instrument-${i}`}>
              + {inst}
            </div>
          ))}
          <div className="font-semibold mb-2 mt-4 flex items-center gap-2">
            <ChevronRight className="w-4 h-4" />
            Bass
          </div>
        </div>
      </div>

      {/* Center - Timeline */}
      <div className="flex-1 flex flex-col">
        {/* Top Tabs */}
        <div className="border-b px-4 py-2 flex gap-2">
          <Button variant="ghost" size="sm" data-testid="button-arrangement">Arrangement</Button>
          <Button variant="ghost" size="sm" data-testid="button-piano-roll">Piano Roll</Button>
          <Button variant="ghost" size="sm" data-testid="button-mixer">Mixer</Button>
          <Button variant="ghost" size="sm" data-testid="button-ai-studio">AI Studio</Button>
        </div>

        {/* Timeline Area */}
        <div className="flex-1 p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timeline - All Tracks (1)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 border rounded-md">
                  <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-mute">M</Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-solo">S</Button>
                  <span className="flex-1 text-sm">Piano 1</span>
                  <div className="w-48 h-8 bg-accent rounded-md"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transport Controls */}
        <div className="border-t p-2 flex items-center justify-center gap-2">
          <Button size="icon" variant="ghost" data-testid="button-skip-back">
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button size="icon" data-testid="button-play" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="ghost" data-testid="button-skip-forward">
            <SkipForward className="w-4 h-4" />
          </Button>
          <span className="mx-4 text-sm">120 BPM</span>
        </div>
      </div>

      {/* Right Panel - AI Assistant */}
      <div className="w-96 border-l p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AI Assistant</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">AI music assistant ready...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderFileTabLayout = () => (
    <div className="flex h-full bg-background">
      {/* Left Panel - Tabbed like Files */}
      <div className="w-80 border-r flex flex-col">
        {/* Vertical Tabs */}
        <div className="flex border-b">
          <Button
            variant={leftPanelTab === 'instruments' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 rounded-none"
            onClick={() => setLeftPanelTab('instruments')}
            data-testid="button-tab-instruments"
          >
            <Music className="w-4 h-4 mr-2" />
            Instruments
          </Button>
        </div>
        <div className="flex border-b">
          <Button
            variant={leftPanelTab === 'patterns' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 rounded-none"
            onClick={() => setLeftPanelTab('patterns')}
            data-testid="button-tab-patterns"
          >
            <Layers className="w-4 h-4 mr-2" />
            Patterns
          </Button>
        </div>
        <div className="flex border-b">
          <Button
            variant={leftPanelTab === 'effects' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 rounded-none"
            onClick={() => setLeftPanelTab('effects')}
            data-testid="button-tab-effects"
          >
            <Sliders className="w-4 h-4 mr-2" />
            Effects
          </Button>
        </div>
        <div className="flex border-b">
          <Button
            variant={leftPanelTab === 'samples' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 rounded-none"
            onClick={() => setLeftPanelTab('samples')}
            data-testid="button-tab-samples"
          >
            <FileAudio className="w-4 h-4 mr-2" />
            Samples
          </Button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {leftPanelTab === 'instruments' && (
            <div className="space-y-1">
              {instruments.map((inst, i) => (
                <div key={i} className="py-2 px-3 text-sm hover-elevate rounded-md cursor-pointer flex items-center gap-2" data-testid={`item-instrument-${i}`}>
                  <Plus className="w-3 h-3" />
                  {inst}
                </div>
              ))}
            </div>
          )}
          {leftPanelTab === 'patterns' && (
            <div className="space-y-1">
              {patterns.map((pattern, i) => (
                <div key={i} className="py-2 px-3 text-sm hover-elevate rounded-md cursor-pointer" data-testid={`item-pattern-${i}`}>
                  {pattern}
                </div>
              ))}
            </div>
          )}
          {leftPanelTab === 'effects' && (
            <div className="space-y-1">
              {effects.map((effect, i) => (
                <div key={i} className="py-2 px-3 text-sm hover-elevate rounded-md cursor-pointer flex items-center gap-2" data-testid={`item-effect-${i}`}>
                  <Plus className="w-3 h-3" />
                  {effect}
                </div>
              ))}
            </div>
          )}
          {leftPanelTab === 'samples' && (
            <div className="space-y-1">
              {samples.map((sample, i) => (
                <div key={i} className="py-2 px-3 text-sm hover-elevate rounded-md cursor-pointer" data-testid={`item-sample-${i}`}>
                  {sample}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center - Main Workspace */}
      <div className="flex-1 flex flex-col">
        {/* Minimal Top Bar */}
        <div className="border-b px-4 py-1 flex items-center justify-between text-sm">
          <div className="flex gap-4">
            <span className="font-medium">Untitled Project</span>
            <span className="text-muted-foreground">120 BPM • C Major</span>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" data-testid="button-settings">
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Timeline */}
        <div className="flex-1 p-6">
          <div className="border rounded-md h-full p-4">
            <div className="text-sm text-muted-foreground mb-4">Track Arrangement</div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs w-20">Piano 1</span>
                <div className="flex-1 h-12 bg-accent/20 border rounded-md"></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-20">Bass</span>
                <div className="flex-1 h-12 bg-accent/20 border rounded-md"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Transport */}
        <div className="border-t p-2 flex items-center justify-center gap-2 bg-muted/30">
          <Button size="icon" variant="ghost" data-testid="button-play-file">
            <Play className="w-4 h-4" />
          </Button>
          <span className="text-sm font-mono">00:00</span>
        </div>
      </div>
    </div>
  );

  const renderImmersiveLayout = () => (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Minimal Top Bar - Hidden until hover */}
      <div className="border-b border-white/10 px-4 py-1 flex items-center justify-between text-xs opacity-50 hover:opacity-100 transition-opacity">
        <div className="flex gap-4">
          <span>Untitled Project</span>
          <span className="text-white/50">120 BPM</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-6 text-xs" data-testid="button-menu-file">File</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" data-testid="button-menu-view">View</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" data-testid="button-menu-tools">Tools</Button>
        </div>
      </div>

      {/* Full Canvas - Maximum Space */}
      <div className="flex-1 p-2">
        <div className="h-full rounded-md border border-white/20 p-6 bg-white/5">
          <div className="text-xs text-white/50 mb-4">ARRANGEMENT VIEW</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 h-16 bg-white/10 rounded-md px-3">
              <span className="text-sm">Piano</span>
              <div className="flex-1 bg-purple-500/30 h-8 rounded-sm"></div>
            </div>
            <div className="flex items-center gap-2 h-16 bg-white/10 rounded-md px-3">
              <span className="text-sm">Bass</span>
              <div className="flex-1 bg-blue-500/30 h-8 rounded-sm"></div>
            </div>
            <div className="flex items-center gap-2 h-16 bg-white/10 rounded-md px-3">
              <span className="text-sm">Drums</span>
              <div className="flex-1 bg-green-500/30 h-8 rounded-sm"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Transport */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/20 rounded-full px-6 py-2 flex items-center gap-4">
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" data-testid="button-play-immersive">
          <Play className="w-4 h-4" />
        </Button>
        <span className="font-mono text-sm">00:00 / 03:24</span>
        <span className="text-sm text-white/50">120 BPM</span>
      </div>
    </div>
  );

  const renderModularLayout = () => (
    <div className="flex flex-col h-full bg-background">
      {/* Top Menu Bar */}
      <div className="border-b px-4 py-1 flex items-center gap-4 text-sm">
        <span className="font-medium">Modular Studio</span>
        <Button size="sm" variant="ghost" className="h-7" data-testid="button-add-panel">+ Add Panel</Button>
      </div>

      {/* Workspace with Floating Panels */}
      <div className="flex-1 relative p-4 bg-muted/20">
        {/* Panel 1 - Instruments */}
        <Card className="absolute top-4 left-4 w-80 shadow-lg" data-testid="card-panel-instruments">
          <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-sm flex items-center justify-between">
              Instruments
              <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-close-instruments">×</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-1 max-h-48 overflow-y-auto">
            {instruments.slice(0, 4).map((inst, i) => (
              <div key={i} className="text-sm py-1 px-2 hover-elevate rounded-md cursor-pointer" data-testid={`item-modular-instrument-${i}`}>
                {inst}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Panel 2 - Timeline */}
        <Card className="absolute top-4 left-96 right-80 shadow-lg" data-testid="card-panel-timeline">
          <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-sm flex items-center justify-between">
              Timeline
              <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-close-timeline">×</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="h-32 border rounded-md p-2 bg-accent/10">
              <div className="text-xs text-muted-foreground mb-2">Tracks</div>
              <div className="space-y-1">
                <div className="h-6 bg-accent rounded-sm"></div>
                <div className="h-6 bg-accent rounded-sm"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel 3 - Mixer */}
        <Card className="absolute top-4 right-4 w-72 shadow-lg" data-testid="card-panel-mixer">
          <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-sm flex items-center justify-between">
              Mixer
              <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-close-mixer">×</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-8 h-24 bg-accent/30 rounded-sm"></div>
                <span className="text-xs">Ch 1</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-8 h-24 bg-accent/30 rounded-sm"></div>
                <span className="text-xs">Ch 2</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel 4 - Piano Roll */}
        <Card className="absolute bottom-4 left-4 right-4 shadow-lg" data-testid="card-panel-piano">
          <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-sm flex items-center justify-between">
              Piano Roll
              <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-close-piano">×</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="h-32 border rounded-md bg-accent/5"></div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Transport */}
      <div className="border-t p-2 flex items-center justify-center gap-2">
        <Button size="icon" data-testid="button-play-modular">
          <Play className="w-4 h-4" />
        </Button>
        <span className="text-sm">120 BPM</span>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b p-4">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-title">🎨 Design Playground</h1>
        <p className="text-sm text-muted-foreground">
          Test different layout options for the Unified Studio. Click each option to explore!
        </p>
      </div>

      {/* Layout Selector */}
      <div className="border-b p-4 flex gap-2 flex-wrap">
        {layoutOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Button
              key={option.id}
              variant={activeLayout === option.id ? 'default' : 'outline'}
              onClick={() => setActiveLayout(option.id)}
              className="flex items-center gap-2"
              data-testid={`button-layout-${option.id}`}
            >
              <Icon className="w-4 h-4" />
              <div className="text-left">
                <div className="font-medium">{option.name}</div>
                <div className="text-xs opacity-70">{option.description}</div>
              </div>
            </Button>
          );
        })}
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-hidden">
        {activeLayout === 'current' && renderCurrentLayout()}
        {activeLayout === 'file-tabs' && renderFileTabLayout()}
        {activeLayout === 'immersive' && renderImmersiveLayout()}
        {activeLayout === 'modular' && renderModularLayout()}
      </div>
    </div>
  );
}
