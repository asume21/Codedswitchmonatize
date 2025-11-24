import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
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
  // Simplified - only Custom Builder mode now
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
  const [_editingTabId, setEditingTabId] = useState<string | null>(null);
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

  // Layout options removed - all templates now accessible via Custom Builder's "Load Template" dropdown

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

  // All render functions removed - now only using Custom Builder with LayoutManager
  // Templates are accessible via "Load Template" dropdown inside Custom Builder

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
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="text-primary font-medium">✨ Custom Builder:</span> Use the controls in each panel to split, change content, or remove • Load templates to start with different layouts • Toggle density (Comfortable/Compact/Dense) to optimize spacing
        </p>
      </div>

      {/* Custom Builder - Always Active */}
      <div className="flex-1 overflow-hidden">
        <LayoutManager density={densityMode} />
      </div>
    </div>
  );
}
