import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from '@/components/ui/resizable';
import { 
  SplitSquareHorizontal, 
  SplitSquareVertical, 
  Trash2, 
  Plus,
  GripVertical,
  Music,
  Sliders,
  Layers,
  FileAudio,
  Brain,
  Piano,
  Activity,
  Settings,
  Play,
  Pause,
  Square,
  Circle,
  SkipBack,
  SkipForward
} from 'lucide-react';

export type PanelType = 
  | 'timeline' 
  | 'mixer' 
  | 'piano-roll' 
  | 'instruments' 
  | 'effects' 
  | 'samples'
  | 'ai-assistant'
  | 'transport'
  | 'empty';

export interface PanelNode {
  id: string;
  type: 'panel' | 'split';
  direction?: 'horizontal' | 'vertical';
  size?: number;
  content?: PanelType;
  children?: PanelNode[];
}

interface PanelContainerProps {
  node: PanelNode;
  onSplit: (nodeId: string, direction: 'horizontal' | 'vertical') => void;
  onRemove: (nodeId: string) => void;
  onChangeContent: (nodeId: string, content: PanelType) => void;
  onResize?: (nodeId: string, size: number) => void;
  editMode: boolean;
  density: 'comfortable' | 'compact' | 'dense';
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

export function PanelContainer({ 
  node, 
  onSplit, 
  onRemove, 
  onChangeContent,
  editMode,
  density 
}: PanelContainerProps) {
  const [isResizing, setIsResizing] = useState(false);

  const spacing = {
    comfortable: { p: 'p-4', text: 'text-base', gap: 'gap-4' },
    compact: { p: 'p-2', text: 'text-sm', gap: 'gap-2' },
    dense: { p: 'p-1', text: 'text-xs', gap: 'gap-1' }
  }[density];

  if (node.type === 'split' && node.children) {
    return (
      <div 
        className={`flex ${node.direction === 'horizontal' ? 'flex-row' : 'flex-col'} h-full w-full ${spacing.gap}`}
      >
        {node.children.map((child, index) => (
          <div 
            key={child.id}
            className="flex-1 min-h-0 min-w-0"
            style={{ flex: child.size || 1 }}
          >
            <PanelContainer
              node={child}
              onSplit={onSplit}
              onRemove={onRemove}
              onChangeContent={onChangeContent}
              editMode={editMode}
              density={density}
            />
          </div>
        ))}
      </div>
    );
  }

  const Icon = panelTypeIcons[node.content || 'empty'];

  return (
    <Card className="h-full flex flex-col relative border-2 transition-colors hover:border-primary/50">
      {/* Panel Header */}
      <CardHeader className={`${spacing.p} border-b flex flex-row items-center justify-between space-y-0 bg-muted/30`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <CardTitle className={spacing.text}>
            {panelTypeLabels[node.content || 'empty']}
          </CardTitle>
        </div>

        {/* Edit Controls - Always visible when in edit mode */}
        {editMode && (
          <div className="flex items-center gap-1">
            {/* Change Panel Content */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  data-testid={`button-change-content-${node.id}`}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onChangeContent(node.id, 'timeline')}>
                  <Activity className="w-4 h-4 mr-2" />
                  Timeline
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChangeContent(node.id, 'mixer')}>
                  <Sliders className="w-4 h-4 mr-2" />
                  Mixer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChangeContent(node.id, 'piano-roll')}>
                  <Piano className="w-4 h-4 mr-2" />
                  Piano Roll
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChangeContent(node.id, 'transport')}>
                  <Play className="w-4 h-4 mr-2" />
                  Transport
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChangeContent(node.id, 'instruments')}>
                  <Music className="w-4 h-4 mr-2" />
                  Instruments
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChangeContent(node.id, 'effects')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Effects
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChangeContent(node.id, 'samples')}>
                  <FileAudio className="w-4 h-4 mr-2" />
                  Samples
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChangeContent(node.id, 'ai-assistant')}>
                  <Brain className="w-4 h-4 mr-2" />
                  AI Assistant
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Split Horizontal */}
            <Button 
              size="icon" 
              variant="ghost"
              className="h-6 w-6"
              onClick={() => onSplit(node.id, 'horizontal')}
              title="Split Horizontally"
              data-testid={`button-split-h-${node.id}`}
            >
              <SplitSquareHorizontal className="w-3 h-3" />
            </Button>

            {/* Split Vertical */}
            <Button 
              size="icon" 
              variant="ghost"
              className="h-6 w-6"
              onClick={() => onSplit(node.id, 'vertical')}
              title="Split Vertically"
              data-testid={`button-split-v-${node.id}`}
            >
              <SplitSquareVertical className="w-3 h-3" />
            </Button>

            {/* Remove Panel */}
            <Button 
              size="icon" 
              variant="ghost"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onRemove(node.id)}
              title="Remove Panel"
              data-testid={`button-remove-${node.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </CardHeader>

      {/* Panel Content */}
      <CardContent className={`flex-1 ${spacing.p} overflow-auto`}>
        <PanelContent type={node.content || 'empty'} density={density} />
      </CardContent>
    </Card>
  );
}

function PanelContent({ type, density }: { type: PanelType; density: 'comfortable' | 'compact' | 'dense' }) {
  const spacing = {
    comfortable: { p: 'p-2', text: 'text-sm', gap: 'gap-2', h: 'h-12' },
    compact: { p: 'p-1', text: 'text-xs', gap: 'gap-1', h: 'h-10' },
    dense: { p: 'p-1', text: 'text-xs', gap: 'gap-1', h: 'h-8' }
  }[density];

  switch (type) {
    case 'timeline':
      return (
        <div className={spacing.gap}>
          {[...Array(density === 'dense' ? 4 : density === 'compact' ? 3 : 2)].map((_, i) => (
            <div key={i} className={`flex items-center ${spacing.gap} ${spacing.p} border rounded-md ${spacing.h}`}>
              <span className={spacing.text}>Track {i + 1}</span>
              <div className="flex-1 bg-accent/30 h-6 rounded-sm"></div>
            </div>
          ))}
        </div>
      );

    case 'mixer':
      return (
        <div className={`flex ${spacing.gap}`}>
          {[...Array(density === 'dense' ? 4 : density === 'compact' ? 3 : 2)].map((_, i) => (
            <div key={i} className={`flex-1 flex flex-col items-center ${spacing.gap}`}>
              <div className={`w-8 ${density === 'dense' ? 'h-16' : density === 'compact' ? 'h-20' : 'h-24'} bg-accent/30 rounded-sm`}></div>
              <span className={spacing.text}>Ch {i + 1}</span>
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
          {['Grand Piano', 'Electric Piano', 'Synth', 'Bass', 'Drums', 'Guitar'].slice(0, density === 'dense' ? 6 : density === 'compact' ? 4 : 3).map((inst, i) => (
            <div key={i} className={`${spacing.p} ${spacing.text} hover-elevate rounded-md cursor-pointer`}>
              + {inst}
            </div>
          ))}
        </div>
      );

    case 'effects':
      return (
        <div className={spacing.gap}>
          {['Reverb', 'Delay', 'Compressor', 'EQ', 'Distortion'].slice(0, density === 'dense' ? 5 : 3).map((fx, i) => (
            <div key={i} className={`${spacing.p} ${spacing.text} hover-elevate rounded-md cursor-pointer flex items-center gap-2`}>
              <Plus className="w-3 h-3" />
              {fx}
            </div>
          ))}
        </div>
      );

    case 'samples':
      return (
        <div className={spacing.gap}>
          {['Kick.wav', 'Snare.wav', 'Hat.wav', 'Clap.wav'].map((sample, i) => (
            <div key={i} className={`${spacing.p} ${spacing.text} hover-elevate rounded-md cursor-pointer`}>
              {sample}
            </div>
          ))}
        </div>
      );

    case 'ai-assistant':
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <Brain className="w-8 h-8 text-muted-foreground" />
          <p className={`${spacing.text} text-muted-foreground text-center`}>
            AI music assistant ready...
          </p>
        </div>
      );

    case 'transport':
      return (
        <div className="flex items-center justify-center gap-3">
          {/* Transport Controls */}
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" data-testid="button-transport-rewind">
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="default" className="h-8 w-8" data-testid="button-transport-play">
              <Play className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" data-testid="button-transport-stop">
              <Square className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" data-testid="button-transport-record">
              <Circle className="w-4 h-4 text-destructive" />
            </Button>
          </div>
          
          {/* Time Display */}
          <div className="flex items-center gap-2 px-3 py-1 border rounded-md bg-muted/30">
            <span className={`${spacing.text} font-mono`}>00:00.000</span>
          </div>
          
          {/* BPM Display */}
          <div className="flex items-center gap-2 px-3 py-1 border rounded-md bg-muted/30">
            <span className={`${spacing.text} font-mono`}>120 BPM</span>
          </div>
          
          {/* Time Signature */}
          <div className="flex items-center gap-2 px-3 py-1 border rounded-md bg-muted/30">
            <span className={spacing.text}>4/4</span>
          </div>
        </div>
      );

    default:
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
          <Plus className="w-8 h-8" />
          <p className={spacing.text}>Empty Panel</p>
          <p className="text-xs">Click + above to add content</p>
        </div>
      );
  }
}
