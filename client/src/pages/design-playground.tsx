import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  Trash2,
  Edit2,
  GripVertical,
  Download,
  Pencil,
  Check,
  X,
  Boxes
} from 'lucide-react';
import { LayoutManager } from '@/components/playground/LayoutManager';

type LayoutOption = 'current' | 'file-tabs' | 'immersive' | 'modular' | 'custom';

interface TabConfig {
  id: string;
  name: string;
  icon: string;
}

export default function DesignPlayground() {
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('current');
  const [leftPanelTab, setLeftPanelTab] = useState('instruments');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Edit mode states
  const [editMode, setEditMode] = useState(false);
  const [customTabs, setCustomTabs] = useState<TabConfig[]>([
    { id: 'instruments', name: 'Instruments', icon: 'music' },
    { id: 'patterns', name: 'Patterns', icon: 'layers' },
    { id: 'effects', name: 'Effects', icon: 'sliders' },
    { id: 'samples', name: 'Samples', icon: 'file-audio' },
  ]);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  
  // Resize states
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(384);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  
  // Drag and drop states
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  
  // Density mode
  const [densityMode, setDensityMode] = useState<'comfortable' | 'compact' | 'dense'>('comfortable');
  
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Get spacing based on density
  const getSpacing = () => {
    switch (densityMode) {
      case 'dense':
        return { p: 'p-1', gap: 'gap-1', text: 'text-xs', h: 'h-7' };
      case 'compact':
        return { p: 'p-2', gap: 'gap-2', text: 'text-sm', h: 'h-8' };
      default:
        return { p: 'p-4', gap: 'gap-4', text: 'text-base', h: 'h-9' };
    }
  };

  const spacing = getSpacing();

  const layoutOptions = [
    { 
      id: 'custom' as LayoutOption, 
      name: 'Custom Builder', 
      icon: Boxes,
      description: '✨ Full Control - Split, resize, customize everything'
    },
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

  // Handle resize drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft && resizeRef.current) {
        const delta = e.clientX - resizeRef.current.startX;
        const newWidth = Math.max(200, Math.min(600, resizeRef.current.startWidth + delta));
        setLeftPanelWidth(newWidth);
      }
      if (isResizingRight && resizeRef.current) {
        const delta = resizeRef.current.startX - e.clientX;
        const newWidth = Math.max(200, Math.min(600, resizeRef.current.startWidth + delta));
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
      resizeRef.current = null;
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  const handleStartResize = (side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = {
      startX: e.clientX,
      startWidth: side === 'left' ? leftPanelWidth : rightPanelWidth
    };
    if (side === 'left') {
      setIsResizingLeft(true);
    } else {
      setIsResizingRight(true);
    }
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      'music': Music,
      'layers': Layers,
      'sliders': Sliders,
      'file-audio': FileAudio,
    };
    return icons[iconName] || Music;
  };

  const addNewTab = () => {
    const newTab: TabConfig = {
      id: `tab-${Date.now()}`,
      name: 'New Tab',
      icon: 'music'
    };
    setCustomTabs([...customTabs, newTab]);
  };

  const removeTab = (id: string) => {
    setCustomTabs(customTabs.filter(tab => tab.id !== id));
  };

  const startEditingTab = (tab: TabConfig) => {
    setEditingTabId(tab.id);
    setEditingTabName(tab.name);
  };

  const saveTabName = (id: string) => {
    setCustomTabs(customTabs.map(tab => 
      tab.id === id ? { ...tab, name: editingTabName } : tab
    ));
    setEditingTabId(null);
    setEditingTabName('');
  };

  const cancelEditingTab = () => {
    setEditingTabId(null);
    setEditingTabName('');
  };

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTabId(tabId);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleDrop = (e: React.DragEvent, dropTabId: string) => {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === dropTabId) return;

    const draggedIndex = customTabs.findIndex(t => t.id === draggedTabId);
    const dropIndex = customTabs.findIndex(t => t.id === dropTabId);

    if (draggedIndex === -1 || dropIndex === -1) return;

    const newTabs = [...customTabs];
    const [draggedTab] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(dropIndex, 0, draggedTab);

    setCustomTabs(newTabs);
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const exportConfig = () => {
    const config = {
      layout: activeLayout,
      tabs: customTabs,
      leftPanelWidth,
      rightPanelWidth,
    };
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'unified-studio-config.json';
    link.click();
  };

  const renderCurrentLayout = () => (
    <div className="flex h-full bg-background">
      {/* Left Panel - Instruments */}
      <div style={{ width: leftPanelWidth }} className={`border-r flex flex-col relative ${spacing.text}`}>
        <div className={`${spacing.p} border-b`}>
          <Input placeholder="Search instruments..." className={spacing.h} data-testid="input-search-instruments" />
        </div>
        <div className={`flex-1 overflow-y-auto ${spacing.p} ${spacing.gap}`}>
          <div className={`font-semibold mb-2 flex items-center ${spacing.gap}`}>
            <ChevronDown className="w-4 h-4" />
            Piano
          </div>
          {instruments.slice(0, densityMode === 'dense' ? 4 : densityMode === 'compact' ? 3 : 2).map((inst, i) => (
            <div key={i} className={`pl-6 ${spacing.p} ${spacing.text} text-muted-foreground hover-elevate rounded-md cursor-pointer`} data-testid={`item-instrument-${i}`}>
              + {inst}
            </div>
          ))}
          <div className={`font-semibold mb-2 mt-2 flex items-center ${spacing.gap}`}>
            <ChevronRight className="w-4 h-4" />
            Bass
          </div>
        </div>
        {editMode && (
          <div
            className="absolute top-0 right-0 w-3 h-full bg-primary/70 hover:bg-primary cursor-col-resize transition-all flex items-center justify-center group"
            onMouseDown={(e) => handleStartResize('left', e)}
            data-testid="resize-handle-left"
            title="Drag to resize panel"
          >
            <div className="w-1 h-16 bg-primary-foreground rounded-full group-hover:h-24 transition-all"></div>
          </div>
        )}
      </div>

      {/* Center - Timeline */}
      <div className="flex-1 flex flex-col">
        {/* Top Tabs */}
        <div className={`border-b ${spacing.p} flex ${spacing.gap}`}>
          <Button variant="ghost" size="sm" className={spacing.h} data-testid="button-arrangement">Arrangement</Button>
          <Button variant="ghost" size="sm" className={spacing.h} data-testid="button-piano-roll">Piano Roll</Button>
          <Button variant="ghost" size="sm" className={spacing.h} data-testid="button-mixer">Mixer</Button>
          <Button variant="ghost" size="sm" className={spacing.h} data-testid="button-ai-studio">AI Studio</Button>
        </div>

        {/* Timeline Area */}
        <div className={`flex-1 ${spacing.p}`}>
          <Card>
            <CardHeader className={spacing.p}>
              <CardTitle className={spacing.text}>Timeline - All Tracks ({densityMode === 'dense' ? 3 : densityMode === 'compact' ? 2 : 1})</CardTitle>
            </CardHeader>
            <CardContent className={spacing.p}>
              <div className={spacing.gap}>
                {[...Array(densityMode === 'dense' ? 3 : densityMode === 'compact' ? 2 : 1)].map((_, i) => (
                  <div key={i} className={`flex items-center ${spacing.gap} ${spacing.p} border rounded-md`}>
                    <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-mute">M</Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-solo">S</Button>
                    <span className={`flex-1 ${spacing.text}`}>{i === 0 ? 'Piano 1' : i === 1 ? 'Bass' : 'Drums'}</span>
                    <div className={`w-48 ${densityMode === 'dense' ? 'h-6' : 'h-8'} bg-accent rounded-md`}></div>
                  </div>
                ))}
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
      <div style={{ width: rightPanelWidth }} className={`border-l ${spacing.p} relative`}>
        <Card>
          <CardHeader className={spacing.p}>
            <CardTitle className={spacing.text}>AI Assistant</CardTitle>
          </CardHeader>
          <CardContent className={spacing.p}>
            <p className={`${spacing.text} text-muted-foreground`}>AI music assistant ready...</p>
          </CardContent>
        </Card>
        {editMode && (
          <div
            className="absolute top-0 left-0 w-3 h-full bg-primary/70 hover:bg-primary cursor-col-resize transition-all flex items-center justify-center group"
            onMouseDown={(e) => handleStartResize('right', e)}
            data-testid="resize-handle-right"
            title="Drag to resize panel"
          >
            <div className="w-1 h-16 bg-primary-foreground rounded-full group-hover:h-24 transition-all"></div>
          </div>
        )}
      </div>
    </div>
  );

  const renderFileTabLayout = () => (
    <div className="flex h-full bg-background">
      {/* Left Panel - Tabbed like Files */}
      <div style={{ width: leftPanelWidth }} className={`border-r flex flex-col relative ${spacing.text}`}>
        {/* Vertical Tabs */}
        {customTabs.map((tab, index) => {
          const IconComponent = getIconComponent(tab.icon);
          const isDragging = draggedTabId === tab.id;
          const isDragOver = dragOverTabId === tab.id;
          return (
            <div 
              key={tab.id} 
              className={`flex border-b items-center transition-all ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'border-t-2 border-t-primary' : ''}`}
              draggable={editMode}
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={(e) => handleDragOver(e, tab.id)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, tab.id)}
            >
              {editMode && (
                <div className="p-1 cursor-move">
                  <GripVertical className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
              {editingTabId === tab.id ? (
                <div className="flex-1 flex items-center gap-1 p-1">
                  <Input
                    value={editingTabName}
                    onChange={(e) => setEditingTabName(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                    data-testid={`input-edit-tab-${tab.id}`}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveTabName(tab.id)} data-testid={`button-save-tab-${tab.id}`}>
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditingTab} data-testid={`button-cancel-tab-${tab.id}`}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant={leftPanelTab === tab.id ? 'default' : 'ghost'}
                    size="sm"
                    className="flex-1 rounded-none justify-start"
                    onClick={() => setLeftPanelTab(tab.id)}
                    data-testid={`button-tab-${tab.id}`}
                  >
                    <IconComponent className="w-4 h-4 mr-2" />
                    {tab.name}
                  </Button>
                  {editMode && (
                    <div className="flex gap-1 px-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditingTab(tab)} data-testid={`button-edit-tab-${tab.id}`}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeTab(tab.id)} data-testid={`button-remove-tab-${tab.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        
        {editMode && (
          <div className="border-b">
            <Button
              size="sm"
              variant="ghost"
              className="w-full rounded-none"
              onClick={addNewTab}
              data-testid="button-add-tab"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tab
            </Button>
          </div>
        )}

        {/* Tab Content */}
        <div className={`flex-1 overflow-y-auto ${spacing.p}`}>
          {leftPanelTab === 'instruments' && (
            <div className={spacing.gap}>
              {instruments.map((inst, i) => (
                <div key={i} className={`${spacing.p} ${spacing.text} hover-elevate rounded-md cursor-pointer flex items-center gap-2`} data-testid={`item-instrument-${i}`}>
                  <Plus className="w-3 h-3" />
                  {inst}
                </div>
              ))}
            </div>
          )}
          {leftPanelTab === 'patterns' && (
            <div className={spacing.gap}>
              {patterns.map((pattern, i) => (
                <div key={i} className={`${spacing.p} ${spacing.text} hover-elevate rounded-md cursor-pointer`} data-testid={`item-pattern-${i}`}>
                  {pattern}
                </div>
              ))}
            </div>
          )}
          {leftPanelTab === 'effects' && (
            <div className={spacing.gap}>
              {effects.map((effect, i) => (
                <div key={i} className={`${spacing.p} ${spacing.text} hover-elevate rounded-md cursor-pointer flex items-center gap-2`} data-testid={`item-effect-${i}`}>
                  <Plus className="w-3 h-3" />
                  {effect}
                </div>
              ))}
            </div>
          )}
          {leftPanelTab === 'samples' && (
            <div className={spacing.gap}>
              {samples.map((sample, i) => (
                <div key={i} className={`${spacing.p} ${spacing.text} hover-elevate rounded-md cursor-pointer`} data-testid={`item-sample-${i}`}>
                  {sample}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {editMode && (
          <div
            className="absolute top-0 right-0 w-3 h-full bg-primary/70 hover:bg-primary cursor-col-resize transition-all z-10 flex items-center justify-center group"
            onMouseDown={(e) => handleStartResize('left', e)}
            data-testid="resize-handle-left-file"
            title="Drag to resize panel"
          >
            <div className="w-1 h-16 bg-primary-foreground rounded-full group-hover:h-24 transition-all"></div>
          </div>
        )}
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
        <div className={`flex-1 ${densityMode === 'dense' ? 'p-2' : densityMode === 'compact' ? 'p-4' : 'p-6'}`}>
          <div className={`border rounded-md h-full ${spacing.p}`}>
            <div className={`${spacing.text} text-muted-foreground mb-2`}>Track Arrangement</div>
            <div className={spacing.gap}>
              {[...Array(densityMode === 'dense' ? 6 : densityMode === 'compact' ? 4 : 2)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`${spacing.text} w-16`}>{i === 0 ? 'Piano 1' : i === 1 ? 'Bass' : i === 2 ? 'Drums' : i === 3 ? 'Synth' : i === 4 ? 'Guitar' : 'Vocals'}</span>
                  <div className={`flex-1 ${densityMode === 'dense' ? 'h-8' : densityMode === 'compact' ? 'h-10' : 'h-12'} bg-accent/20 border rounded-md`}></div>
                </div>
              ))}
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
      <div className={`border-b border-white/10 ${spacing.p} flex items-center justify-between ${spacing.text} opacity-50 hover:opacity-100 transition-opacity`}>
        <div className={`flex ${spacing.gap}`}>
          <span>Untitled Project</span>
          <span className="text-white/50">120 BPM</span>
        </div>
        <div className={`flex ${spacing.gap}`}>
          <Button size="sm" variant="ghost" className={`${spacing.h} ${spacing.text}`} data-testid="button-menu-file">File</Button>
          <Button size="sm" variant="ghost" className={`${spacing.h} ${spacing.text}`} data-testid="button-menu-view">View</Button>
          <Button size="sm" variant="ghost" className={`${spacing.h} ${spacing.text}`} data-testid="button-menu-tools">Tools</Button>
        </div>
      </div>

      {/* Full Canvas - Maximum Space */}
      <div className={`flex-1 ${densityMode === 'dense' ? 'p-1' : densityMode === 'compact' ? 'p-2' : 'p-2'}`}>
        <div className={`h-full rounded-md border border-white/20 ${densityMode === 'dense' ? 'p-3' : densityMode === 'compact' ? 'p-4' : 'p-6'} bg-white/5`}>
          <div className={`${spacing.text} text-white/50 mb-2`}>ARRANGEMENT VIEW</div>
          <div className={spacing.gap}>
            {[...Array(densityMode === 'dense' ? 8 : densityMode === 'compact' ? 5 : 3)].map((_, i) => (
              <div key={i} className={`flex items-center ${spacing.gap} ${densityMode === 'dense' ? 'h-10' : densityMode === 'compact' ? 'h-12' : 'h-16'} bg-white/10 rounded-md ${spacing.p}`}>
                <span className={spacing.text}>{i === 0 ? 'Piano' : i === 1 ? 'Bass' : i === 2 ? 'Drums' : i === 3 ? 'Synth' : i === 4 ? 'Guitar' : i === 5 ? 'Vocals' : i === 6 ? 'Strings' : 'FX'}</span>
                <div className={`flex-1 ${['bg-purple-500/30', 'bg-blue-500/30', 'bg-green-500/30', 'bg-yellow-500/30', 'bg-red-500/30', 'bg-pink-500/30', 'bg-cyan-500/30', 'bg-orange-500/30'][i % 8]} ${densityMode === 'dense' ? 'h-6' : 'h-8'} rounded-sm`}></div>
              </div>
            ))}
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
      <div className={`border-b ${spacing.p} flex items-center ${spacing.gap} ${spacing.text}`}>
        <span className="font-medium">Modular Studio</span>
        <Button size="sm" variant="ghost" className={spacing.h} data-testid="button-add-panel">+ Add Panel</Button>
      </div>

      {/* Workspace with Floating Panels */}
      <div className={`flex-1 relative ${spacing.p} bg-muted/20`}>
        {/* Panel 1 - Instruments */}
        <Card className={`absolute ${densityMode === 'dense' ? 'top-2 left-2' : 'top-4 left-4'} w-80 shadow-lg`} data-testid="card-panel-instruments">
          <CardHeader className={`${spacing.p} border-b`}>
            <CardTitle className={`${spacing.text} flex items-center justify-between`}>
              Instruments
              <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-close-instruments">×</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className={`${spacing.p} ${spacing.gap} max-h-48 overflow-y-auto`}>
            {instruments.slice(0, densityMode === 'dense' ? 6 : densityMode === 'compact' ? 5 : 4).map((inst, i) => (
              <div key={i} className={`${spacing.text} ${spacing.p} hover-elevate rounded-md cursor-pointer`} data-testid={`item-modular-instrument-${i}`}>
                {inst}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Panel 2 - Timeline */}
        <Card className={`absolute ${densityMode === 'dense' ? 'top-2 left-[21rem] right-[19rem]' : 'top-4 left-96 right-80'} shadow-lg`} data-testid="card-panel-timeline">
          <CardHeader className={`${spacing.p} border-b`}>
            <CardTitle className={`${spacing.text} flex items-center justify-between`}>
              Timeline
              <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-close-timeline">×</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className={spacing.p}>
            <div className={`${densityMode === 'dense' ? 'h-24' : densityMode === 'compact' ? 'h-28' : 'h-32'} border rounded-md ${spacing.p} bg-accent/10`}>
              <div className={`${spacing.text} text-muted-foreground mb-2`}>Tracks</div>
              <div className={spacing.gap}>
                {[...Array(densityMode === 'dense' ? 3 : 2)].map((_, i) => (
                  <div key={i} className={`${densityMode === 'dense' ? 'h-5' : 'h-6'} bg-accent rounded-sm`}></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel 3 - Mixer */}
        <Card className={`absolute ${densityMode === 'dense' ? 'top-2 right-2' : 'top-4 right-4'} w-72 shadow-lg`} data-testid="card-panel-mixer">
          <CardHeader className={`${spacing.p} border-b`}>
            <CardTitle className={`${spacing.text} flex items-center justify-between`}>
              Mixer
              <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-close-mixer">×</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className={spacing.p}>
            <div className={`flex ${spacing.gap}`}>
              {[...Array(densityMode === 'dense' ? 4 : 2)].map((_, i) => (
                <div key={i} className={`flex-1 flex flex-col items-center ${spacing.gap}`}>
                  <div className={`w-8 ${densityMode === 'dense' ? 'h-16' : 'h-24'} bg-accent/30 rounded-sm`}></div>
                  <span className={spacing.text}>Ch {i + 1}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Panel 4 - Piano Roll */}
        <Card className={`absolute ${densityMode === 'dense' ? 'bottom-2 left-2 right-2' : 'bottom-4 left-4 right-4'} shadow-lg`} data-testid="card-panel-piano">
          <CardHeader className={`${spacing.p} border-b`}>
            <CardTitle className={`${spacing.text} flex items-center justify-between`}>
              Piano Roll
              <Button size="icon" variant="ghost" className="h-6 w-6" data-testid="button-close-piano">×</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className={spacing.p}>
            <div className={`${densityMode === 'dense' ? 'h-24' : 'h-32'} border rounded-md bg-accent/5`}></div>
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
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold" data-testid="text-title">🎨 Design Playground</h1>
          <div className="flex gap-2 items-center">
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={densityMode === 'comfortable' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDensityMode('comfortable')}
                data-testid="button-density-comfortable"
              >
                Comfortable
              </Button>
              <Button
                variant={densityMode === 'compact' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDensityMode('compact')}
                data-testid="button-density-compact"
              >
                Compact
              </Button>
              <Button
                variant={densityMode === 'dense' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDensityMode('dense')}
                data-testid="button-density-dense"
              >
                Dense
              </Button>
            </div>
            
            {/* Edit Mode button - only show for non-Custom Builder layouts */}
            {activeLayout !== 'custom' && (
              <Button
                variant={editMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEditMode(!editMode)}
                data-testid="button-toggle-edit"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
              </Button>
            )}
            
            {/* Export button - only show for non-Custom Builder layouts */}
            {activeLayout !== 'custom' && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportConfig}
                data-testid="button-export-config"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Design
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {activeLayout === 'custom' && (
            <>
              <span className="text-primary font-medium">✨ Custom Builder Active:</span> Use the controls in each panel to split, change content, or remove • Load templates to start with different layouts • Toggle density to optimize spacing
            </>
          )}
          {activeLayout !== 'custom' && (
            <>
              Test different layouts & density levels • {editMode && <span className="text-primary font-medium">✨ Edit Mode Active: Drag tabs by grip icon • Drag colored edges to resize • Pencil to rename • Trash to delete</span>}
              {!editMode && 'Toggle density (Comfortable/Compact/Dense) to see how much fits on screen'}
            </>
          )}
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
        {activeLayout === 'custom' && <LayoutManager density={densityMode} />}
        {activeLayout === 'current' && renderCurrentLayout()}
        {activeLayout === 'file-tabs' && renderFileTabLayout()}
        {activeLayout === 'immersive' && renderImmersiveLayout()}
        {activeLayout === 'modular' && renderModularLayout()}
      </div>
    </div>
  );
}
