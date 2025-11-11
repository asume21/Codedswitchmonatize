import { useState } from 'react';
import { Rnd } from 'react-rnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Music,
  Sliders,
  Piano,
  Brain,
  FileAudio,
  Settings,
  Activity,
  Plus,
  Trash2
} from 'lucide-react';
import type { PanelType } from './PanelContainer';

interface FreeformPanel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: PanelType;
  zIndex: number;
}

interface FreeformLayoutEditorProps {
  density: 'comfortable' | 'compact' | 'dense';
  initialPanels?: FreeformPanel[];
}

const panelTypeIcons: Record<PanelType, any> = {
  'timeline': Activity,
  'mixer': Sliders,
  'piano-roll': Piano,
  'instruments': Music,
  'effects': Settings,
  'samples': FileAudio,
  'ai-assistant': Brain,
  'transport': Activity,
  'empty': Plus
};

const panelTypeLabels: Record<PanelType, string> = {
  'timeline': 'Timeline',
  'mixer': 'Mixer',
  'piano-roll': 'Piano Roll',
  'instruments': 'Instruments',
  'effects': 'Effects',
  'samples': 'Samples',
  'ai-assistant': 'AI Assistant',
  'transport': 'Transport',
  'empty': 'Empty Panel'
};

// Default panels for freeform mode
const getDefaultPanels = (): FreeformPanel[] => [
  {
    id: 'panel-1',
    x: 20,
    y: 20,
    width: 300,
    height: 200,
    content: 'instruments',
    zIndex: 1
  },
  {
    id: 'panel-2',
    x: 340,
    y: 20,
    width: 500,
    height: 300,
    content: 'timeline',
    zIndex: 2
  },
  {
    id: 'panel-3',
    x: 860,
    y: 20,
    width: 280,
    height: 400,
    content: 'mixer',
    zIndex: 3
  },
  {
    id: 'panel-4',
    x: 340,
    y: 340,
    width: 500,
    height: 200,
    content: 'piano-roll',
    zIndex: 4
  }
];

export function FreeformLayoutEditor({ density, initialPanels }: FreeformLayoutEditorProps) {
  const [panels, setPanels] = useState<FreeformPanel[]>(initialPanels || getDefaultPanels());
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
  const [maxZIndex, setMaxZIndex] = useState(panels.length);

  const spacing = {
    comfortable: { p: 'p-4', text: 'text-base', headerH: 'h-12' },
    compact: { p: 'p-2', text: 'text-sm', headerH: 'h-10' },
    dense: { p: 'p-1', text: 'text-xs', headerH: 'h-8' }
  }[density];

  const handleDragStop = (id: string, d: { x: number; y: number }) => {
    setPanels(prev => prev.map(p => 
      p.id === id ? { ...p, x: d.x, y: d.y } : p
    ));
  };

  const handleResizeStop = (
    id: string,
    ref: HTMLElement,
    position: { x: number; y: number }
  ) => {
    setPanels(prev => prev.map(p => 
      p.id === id 
        ? { 
            ...p, 
            width: parseInt(ref.style.width),
            height: parseInt(ref.style.height),
            x: position.x,
            y: position.y
          } 
        : p
    ));
  };

  const handlePanelClick = (id: string) => {
    setSelectedPanel(id);
    // Bring to front
    const newZIndex = maxZIndex + 1;
    setMaxZIndex(newZIndex);
    setPanels(prev => prev.map(p => 
      p.id === id ? { ...p, zIndex: newZIndex } : p
    ));
  };

  const handleChangeContent = (id: string, content: PanelType) => {
    setPanels(prev => prev.map(p => 
      p.id === id ? { ...p, content } : p
    ));
  };

  const handleRemovePanel = (id: string) => {
    setPanels(prev => prev.filter(p => p.id !== id));
    if (selectedPanel === id) {
      setSelectedPanel(null);
    }
  };

  const handleAddPanel = () => {
    const newPanel: FreeformPanel = {
      id: `panel-${Date.now()}`,
      x: 50 + (panels.length * 20),
      y: 50 + (panels.length * 20),
      width: 400,
      height: 250,
      content: 'empty',
      zIndex: maxZIndex + 1
    };
    setPanels(prev => [...prev, newPanel]);
    setMaxZIndex(maxZIndex + 1);
    setSelectedPanel(newPanel.id);
  };

  return (
    <div className="relative h-full w-full bg-muted/10 overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-50 flex gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={handleAddPanel}
          data-testid="button-add-freeform-panel"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Panel
        </Button>
      </div>

      {/* Grid background for visual reference */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      {/* Freeform Panels */}
      {panels.map((panel) => {
        const Icon = panelTypeIcons[panel.content];
        const isSelected = selectedPanel === panel.id;

        return (
          <Rnd
            key={panel.id}
            position={{ x: panel.x, y: panel.y }}
            size={{ width: panel.width, height: panel.height }}
            onDragStop={(e, d) => handleDragStop(panel.id, d)}
            onResizeStop={(e, direction, ref, delta, position) => 
              handleResizeStop(panel.id, ref, position)
            }
            minWidth={200}
            minHeight={150}
            bounds="parent"
            style={{ zIndex: panel.zIndex }}
            dragHandleClassName="drag-handle"
            enableResizing={{
              top: true,
              right: true,
              bottom: true,
              left: true,
              topRight: true,
              bottomRight: true,
              bottomLeft: true,
              topLeft: true,
            }}
            resizeHandleStyles={{
              top: { cursor: 'ns-resize' },
              right: { cursor: 'ew-resize' },
              bottom: { cursor: 'ns-resize' },
              left: { cursor: 'ew-resize' },
              topRight: { cursor: 'nesw-resize' },
              bottomRight: { cursor: 'nwse-resize' },
              bottomLeft: { cursor: 'nesw-resize' },
              topLeft: { cursor: 'nwse-resize' },
            }}
            onClick={() => handlePanelClick(panel.id)}
          >
            <Card 
              className={`h-full flex flex-col ${isSelected ? 'ring-2 ring-primary shadow-lg' : 'shadow-md'} transition-shadow`}
            >
              {/* Panel Header - Draggable */}
              <CardHeader 
                className={`drag-handle cursor-move ${spacing.p} ${spacing.headerH} border-b flex flex-row items-center justify-between space-y-0 bg-muted/50`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <CardTitle className={spacing.text}>
                    {panelTypeLabels[panel.content]}
                  </CardTitle>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  {/* Change Content */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        data-testid={`button-change-freeform-${panel.id}`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleChangeContent(panel.id, 'timeline')}>
                        <Activity className="w-4 h-4 mr-2" />
                        Timeline
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleChangeContent(panel.id, 'mixer')}>
                        <Sliders className="w-4 h-4 mr-2" />
                        Mixer
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleChangeContent(panel.id, 'piano-roll')}>
                        <Piano className="w-4 h-4 mr-2" />
                        Piano Roll
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleChangeContent(panel.id, 'instruments')}>
                        <Music className="w-4 h-4 mr-2" />
                        Instruments
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleChangeContent(panel.id, 'effects')}>
                        <Settings className="w-4 h-4 mr-2" />
                        Effects
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleChangeContent(panel.id, 'samples')}>
                        <FileAudio className="w-4 h-4 mr-2" />
                        Samples
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleChangeContent(panel.id, 'ai-assistant')}>
                        <Brain className="w-4 h-4 mr-2" />
                        AI Assistant
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Remove Panel */}
                  <Button 
                    size="icon" 
                    variant="ghost"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePanel(panel.id);
                    }}
                    data-testid={`button-remove-freeform-${panel.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>

              {/* Panel Content */}
              <CardContent className={`flex-1 ${spacing.p} overflow-auto`}>
                <PanelContentPreview type={panel.content} density={density} />
              </CardContent>

              {/* Resize indicator when selected */}
              {isSelected && (
                <div className="absolute bottom-1 right-1 text-xs text-muted-foreground bg-background/80 px-1 rounded pointer-events-none">
                  {panel.width} × {panel.height}
                </div>
              )}
            </Card>
          </Rnd>
        );
      })}

      {/* Help Text */}
      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        <strong>Freeform Mode:</strong> Drag panels by header • Resize from corners/edges • Click to select
      </div>
    </div>
  );
}

// Simplified panel content preview
function PanelContentPreview({ type, density }: { type: PanelType; density: 'comfortable' | 'compact' | 'dense' }) {
  const spacing = {
    comfortable: { p: 'p-2', text: 'text-sm', gap: 'gap-2' },
    compact: { p: 'p-1', text: 'text-xs', gap: 'gap-1' },
    dense: { p: 'p-0.5', text: 'text-xs', gap: 'gap-0.5' }
  }[density];

  switch (type) {
    case 'timeline':
      return (
        <div className={spacing.gap}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex items-center ${spacing.gap} ${spacing.p} border rounded-md h-8`}>
              <span className={spacing.text}>Track {i}</span>
              <div className="flex-1 bg-accent/30 h-4 rounded-sm"></div>
            </div>
          ))}
        </div>
      );

    case 'mixer':
      return (
        <div className={`flex ${spacing.gap} justify-center`}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex flex-col items-center ${spacing.gap}`}>
              <div className="w-6 h-20 bg-accent/30 rounded-sm"></div>
              <span className={spacing.text}>Ch {i}</span>
            </div>
          ))}
        </div>
      );

    case 'piano-roll':
      return (
        <div className="h-full border rounded-md bg-accent/5 flex items-center justify-center">
          <span className={`${spacing.text} text-muted-foreground`}>Piano Roll Grid</span>
        </div>
      );

    case 'instruments':
      return (
        <div className={spacing.gap}>
          {['Grand Piano', 'Synth', 'Bass'].map((inst, i) => (
            <div key={i} className={`${spacing.p} ${spacing.text} hover-elevate rounded-md cursor-pointer`}>
              + {inst}
            </div>
          ))}
        </div>
      );

    case 'effects':
      return (
        <div className={spacing.gap}>
          {['Reverb', 'Delay', 'EQ'].map((fx, i) => (
            <div key={i} className={`${spacing.p} ${spacing.text} hover-elevate rounded-md cursor-pointer`}>
              + {fx}
            </div>
          ))}
        </div>
      );

    case 'samples':
      return (
        <div className={spacing.gap}>
          {['Kick.wav', 'Snare.wav', 'Hat.wav'].map((sample, i) => (
            <div key={i} className={`${spacing.p} ${spacing.text} hover-elevate rounded-md cursor-pointer`}>
              {sample}
            </div>
          ))}
        </div>
      );

    case 'ai-assistant':
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <Brain className="w-6 h-6 text-muted-foreground" />
          <p className={`${spacing.text} text-muted-foreground text-center`}>
            AI music assistant ready...
          </p>
        </div>
      );

    case 'empty':
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
          <Plus className="w-6 h-6" />
          <p className={spacing.text}>Empty Panel</p>
        </div>
      );

    default:
      return null;
  }
}
