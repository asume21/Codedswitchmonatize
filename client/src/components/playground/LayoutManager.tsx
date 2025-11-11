import { useState } from 'react';
import { PanelContainer, PanelNode, PanelType } from './PanelContainer';
import { FreeformLayoutEditor } from './FreeformLayoutEditor';
import { splitToFreeform, freeformToSplit, type FreeformPanel } from './layoutConversion';
import { Button } from '@/components/ui/button';
import { 
  Edit2, 
  Download, 
  Upload,
  RotateCcw,
  Save,
  Grid3x3,
  Move
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LayoutManagerProps {
  initialLayout?: PanelNode;
  density: 'comfortable' | 'compact' | 'dense';
}

// Default starting layouts - organized by workflow style
const defaultLayouts = {
  // Classic Layouts
  classic: {
    id: 'root',
    type: 'split' as const,
    direction: 'horizontal' as const,
    children: [
      {
        id: 'left',
        type: 'panel' as const,
        content: 'instruments' as PanelType,
        size: 1
      },
      {
        id: 'center',
        type: 'split' as const,
        direction: 'vertical' as const,
        size: 3,
        children: [
          {
            id: 'timeline',
            type: 'panel' as const,
            content: 'timeline' as PanelType,
            size: 2
          },
          {
            id: 'piano',
            type: 'panel' as const,
            content: 'piano-roll' as PanelType,
            size: 1
          }
        ]
      },
      {
        id: 'right',
        type: 'split' as const,
        direction: 'vertical' as const,
        size: 1,
        children: [
          {
            id: 'mixer',
            type: 'panel' as const,
            content: 'mixer' as PanelType,
            size: 1
          },
          {
            id: 'ai',
            type: 'panel' as const,
            content: 'ai-assistant' as PanelType,
            size: 1
          }
        ]
      }
    ]
  },

  // Producer-focused: Large timeline + piano roll
  producer: {
    id: 'root',
    type: 'split' as const,
    direction: 'horizontal' as const,
    children: [
      {
        id: 'left',
        type: 'panel' as const,
        content: 'instruments' as PanelType,
        size: 1
      },
      {
        id: 'center',
        type: 'split' as const,
        direction: 'vertical' as const,
        size: 4,
        children: [
          {
            id: 'timeline',
            type: 'panel' as const,
            content: 'timeline' as PanelType,
            size: 1
          },
          {
            id: 'piano',
            type: 'panel' as const,
            content: 'piano-roll' as PanelType,
            size: 2
          }
        ]
      },
      {
        id: 'right',
        type: 'panel' as const,
        content: 'mixer' as PanelType,
        size: 1
      }
    ]
  },

  // Mixing Console: Emphasis on mixer
  mixing: {
    id: 'root',
    type: 'split' as const,
    direction: 'horizontal' as const,
    children: [
      {
        id: 'left',
        type: 'split' as const,
        direction: 'vertical' as const,
        size: 1,
        children: [
          {
            id: 'timeline',
            type: 'panel' as const,
            content: 'timeline' as PanelType,
            size: 2
          },
          {
            id: 'effects',
            type: 'panel' as const,
            content: 'effects' as PanelType,
            size: 1
          }
        ]
      },
      {
        id: 'mixer',
        type: 'panel' as const,
        content: 'mixer' as PanelType,
        size: 2
      }
    ]
  },

  // Composition: Piano roll + instruments
  composition: {
    id: 'root',
    type: 'split' as const,
    direction: 'horizontal' as const,
    children: [
      {
        id: 'left',
        type: 'split' as const,
        direction: 'vertical' as const,
        size: 1,
        children: [
          {
            id: 'instruments',
            type: 'panel' as const,
            content: 'instruments' as PanelType,
            size: 1
          },
          {
            id: 'samples',
            type: 'panel' as const,
            content: 'samples' as PanelType,
            size: 1
          }
        ]
      },
      {
        id: 'center',
        type: 'panel' as const,
        content: 'piano-roll' as PanelType,
        size: 3
      },
      {
        id: 'right',
        type: 'panel' as const,
        content: 'mixer' as PanelType,
        size: 1
      }
    ]
  },

  // AI-Assisted: Large AI panel
  ai: {
    id: 'root',
    type: 'split' as const,
    direction: 'horizontal' as const,
    children: [
      {
        id: 'left',
        type: 'panel' as const,
        content: 'instruments' as PanelType,
        size: 1
      },
      {
        id: 'center',
        type: 'panel' as const,
        content: 'timeline' as PanelType,
        size: 2
      },
      {
        id: 'right',
        type: 'split' as const,
        direction: 'vertical' as const,
        size: 1.5,
        children: [
          {
            id: 'ai',
            type: 'panel' as const,
            content: 'ai-assistant' as PanelType,
            size: 2
          },
          {
            id: 'mixer',
            type: 'panel' as const,
            content: 'mixer' as PanelType,
            size: 1
          }
        ]
      }
    ]
  },

  // Arranger: Full-width timeline on top
  arranger: {
    id: 'root',
    type: 'split' as const,
    direction: 'vertical' as const,
    children: [
      {
        id: 'timeline',
        type: 'panel' as const,
        content: 'timeline' as PanelType,
        size: 1
      },
      {
        id: 'bottom',
        type: 'split' as const,
        direction: 'horizontal' as const,
        size: 1,
        children: [
          {
            id: 'instruments',
            type: 'panel' as const,
            content: 'instruments' as PanelType,
            size: 1
          },
          {
            id: 'piano',
            type: 'panel' as const,
            content: 'piano-roll' as PanelType,
            size: 2
          },
          {
            id: 'mixer',
            type: 'panel' as const,
            content: 'mixer' as PanelType,
            size: 1
          }
        ]
      }
    ]
  },

  // Live Performance: Minimal, focused
  live: {
    id: 'root',
    type: 'split' as const,
    direction: 'horizontal' as const,
    children: [
      {
        id: 'instruments',
        type: 'panel' as const,
        content: 'instruments' as PanelType,
        size: 1
      },
      {
        id: 'timeline',
        type: 'panel' as const,
        content: 'timeline' as PanelType,
        size: 3
      },
      {
        id: 'effects',
        type: 'panel' as const,
        content: 'effects' as PanelType,
        size: 1
      }
    ]
  },

  // Minimal: Single panel
  minimal: {
    id: 'root',
    type: 'panel' as const,
    content: 'timeline' as PanelType
  }
};

// Template metadata for display
const templateInfo: Record<string, { name: string; description: string; category: string }> = {
  classic: { name: 'Classic DAW', description: '3-column with timeline, mixer & AI', category: 'Standard' },
  producer: { name: 'Producer Focus', description: 'Large piano roll for composition', category: 'Standard' },
  mixing: { name: 'Mixing Console', description: 'Emphasis on mixer for final mix', category: 'Specialized' },
  composition: { name: 'Composition', description: 'Piano roll + instruments library', category: 'Specialized' },
  ai: { name: 'AI-Assisted', description: 'Large AI panel for creative help', category: 'Specialized' },
  arranger: { name: 'Arranger View', description: 'Full-width timeline on top', category: 'Alternative' },
  live: { name: 'Live Performance', description: 'Minimal & focused for live use', category: 'Alternative' },
  minimal: { name: 'Minimal', description: 'Single panel - start from scratch', category: 'Alternative' }
};

export function LayoutManager({ initialLayout, density }: LayoutManagerProps) {
  const [mode, setMode] = useState<'split' | 'freeform'>('split');
  const [splitLayout, setSplitLayout] = useState<PanelNode>(initialLayout || defaultLayouts.classic);
  const [freeformPanels, setFreeformPanels] = useState<FreeformPanel[]>([]);
  const [editMode, setEditMode] = useState(true);
  const [history, setHistory] = useState<PanelNode[]>([]);

  // Generate unique ID
  const generateId = () => `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle mode switching with conversion
  // Design: Split is the "source of truth"
  // - When switching TO Freeform: Always convert from current Split layout
  // - When switching TO Split: Never convert, preserve Split edits
  const handleModeChange = (newMode: 'split' | 'freeform') => {
    if (newMode === mode) return;

    if (newMode === 'freeform') {
      // Always convert from current Split layout to Freeform
      // This ensures Freeform always reflects the latest Split structure
      const converted = splitToFreeform(splitLayout);
      setFreeformPanels(converted);
    }
    // When switching to Split: Never convert from Freeform
    // This preserves all Split edits independently

    setMode(newMode);
  };

  // Find a node by ID in the tree
  const findNode = (root: PanelNode, id: string): PanelNode | null => {
    if (root.id === id) return root;
    if (root.children) {
      for (const child of root.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Clone the tree deeply
  const cloneTree = (node: PanelNode): PanelNode => {
    return {
      ...node,
      children: node.children?.map(cloneTree)
    };
  };

  // Split a panel
  const handleSplit = (nodeId: string, direction: 'horizontal' | 'vertical') => {
    const newLayout = cloneTree(splitLayout);
    const node = findNode(newLayout, nodeId);
    
    if (node && node.type === 'panel') {
      // Save current state to history
      setHistory(prev => [...prev, splitLayout]);

      // Convert panel to split container
      const originalContent = node.content;
      node.type = 'split';
      node.direction = direction;
      node.children = [
        {
          id: generateId(),
          type: 'panel',
          content: originalContent,
          size: 1
        },
        {
          id: generateId(),
          type: 'panel',
          content: 'empty',
          size: 1
        }
      ];
      delete node.content;

      setSplitLayout(newLayout);
    }
  };

  // Remove a panel
  const handleRemove = (nodeId: string) => {
    // Don't allow removing root
    if (nodeId === 'root' || nodeId === splitLayout.id) return;

    const newLayout = cloneTree(splitLayout);
    
    // Find parent of the node to remove
    const findParent = (root: PanelNode, targetId: string): PanelNode | null => {
      if (root.children) {
        if (root.children.some(c => c.id === targetId)) {
          return root;
        }
        for (const child of root.children) {
          const found = findParent(child, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const parent = findParent(newLayout, nodeId);
    
    if (parent && parent.children) {
      // Save current state to history
      setHistory(prev => [...prev, splitLayout]);

      // Remove the child
      parent.children = parent.children.filter(c => c.id !== nodeId);

      // If only one child remains, collapse the parent
      if (parent.children.length === 1 && parent.id !== 'root') {
        const remainingChild = parent.children[0];
        Object.assign(parent, remainingChild);
      }

      setSplitLayout(newLayout);
    }
  };

  // Change panel content
  const handleChangeContent = (nodeId: string, content: PanelType) => {
    const newLayout = cloneTree(splitLayout);
    const node = findNode(newLayout, nodeId);
    
    if (node && node.type === 'panel') {
      // Save current state to history
      setHistory(prev => [...prev, splitLayout]);
      
      node.content = content;
      setSplitLayout(newLayout);
    }
  };

  // Undo last change
  const handleUndo = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setSplitLayout(previous);
    }
  };

  // Reset to default splitLayout
  const handleReset = (preset: keyof typeof defaultLayouts = 'classic') => {
    setHistory(prev => [...prev, splitLayout]);
    setSplitLayout(cloneTree(defaultLayouts[preset]));
  };

  // Export configuration
  const handleExport = () => {
    const config = {
      version: '1.0',
      splitLayout: splitLayout,
      metadata: {
        created: new Date().toISOString(),
        density: density
      }
    };
    
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `splitLayout-${Date.now()}.json`;
    link.click();
  };

  // Import configuration
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            const config = JSON.parse(e.target.result);
            if (config.splitLayout) {
              setHistory(prev => [...prev, splitLayout]);
              setSplitLayout(config.splitLayout);
            }
          } catch (err) {
            console.error('Failed to import splitLayout:', err);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b p-2 flex items-center justify-between gap-2 bg-muted/30">
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={mode === 'split' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleModeChange('split')}
              data-testid="button-mode-split"
            >
              <Grid3x3 className="w-3 h-3 mr-1" />
              Split
            </Button>
            <Button
              variant={mode === 'freeform' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleModeChange('freeform')}
              data-testid="button-mode-freeform"
            >
              <Move className="w-3 h-3 mr-1" />
              Freeform
            </Button>
          </div>

          {mode === 'split' && (
            <>
              <Button
                variant={editMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEditMode(!editMode)}
                data-testid="button-toggle-edit-mode"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                {editMode ? 'Editing' : 'View Only'}
              </Button>
            </>
          )}

          {mode === 'split' && editMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={history.length === 0}
                data-testid="button-undo"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Undo ({history.length})
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-reset-splitLayout">
                    <Save className="w-4 h-4 mr-2" />
                    Load Template
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  {/* Standard Layouts */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Standard</div>
                  {Object.entries(templateInfo)
                    .filter(([_, info]) => info.category === 'Standard')
                    .map(([key, info]) => (
                      <DropdownMenuItem 
                        key={key}
                        onClick={() => handleReset(key as keyof typeof defaultLayouts)}
                      >
                        <div>
                          <div className="font-medium">{info.name}</div>
                          <div className="text-xs text-muted-foreground">{info.description}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  
                  {/* Specialized Layouts */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Specialized</div>
                  {Object.entries(templateInfo)
                    .filter(([_, info]) => info.category === 'Specialized')
                    .map(([key, info]) => (
                      <DropdownMenuItem 
                        key={key}
                        onClick={() => handleReset(key as keyof typeof defaultLayouts)}
                      >
                        <div>
                          <div className="font-medium">{info.name}</div>
                          <div className="text-xs text-muted-foreground">{info.description}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}

                  {/* Alternative Layouts */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Alternative</div>
                  {Object.entries(templateInfo)
                    .filter(([_, info]) => info.category === 'Alternative')
                    .map(([key, info]) => (
                      <DropdownMenuItem 
                        key={key}
                        onClick={() => handleReset(key as keyof typeof defaultLayouts)}
                      >
                        <div>
                          <div className="font-medium">{info.name}</div>
                          <div className="text-xs text-muted-foreground">{info.description}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImport}
            data-testid="button-import"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            data-testid="button-export"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Render based on mode */}
      {mode === 'split' ? (
        <>
          {/* Panel Tree - Split Mode */}
          <div className="flex-1 p-2 overflow-hidden">
            <PanelContainer
              node={splitLayout}
              onSplit={handleSplit}
              onRemove={handleRemove}
              onChangeContent={handleChangeContent}
              editMode={editMode}
              density={density}
            />
          </div>

          {/* Help Text - Split Mode */}
          {editMode && (
            <div className="border-t p-2 text-xs text-muted-foreground bg-muted/20">
              <strong>Split Mode Editing:</strong> Click controls in panel headers • 
              <kbd className="mx-1 px-1 bg-background border rounded">+</kbd> Change content • 
              <kbd className="mx-1 px-1 bg-background border rounded">Split</kbd> Add panels • 
              <kbd className="mx-1 px-1 bg-background border rounded">Trash</kbd> Remove panels
            </div>
          )}
        </>
      ) : (
        /* Freeform Mode */
        <div className="flex-1 overflow-hidden">
          <FreeformLayoutEditor 
            density={density}
            panels={freeformPanels}
            onChange={setFreeformPanels}
          />
        </div>
      )}
    </div>
  );
}
