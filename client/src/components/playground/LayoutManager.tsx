import { useState } from 'react';
import { PanelContainer, PanelNode, PanelType } from './PanelContainer';
import { Button } from '@/components/ui/button';
import { 
  Edit2, 
  Download, 
  Upload,
  RotateCcw,
  Save
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

// Default starting layouts
const defaultLayouts = {
  daw: {
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
  simple: {
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
      }
    ]
  },
  minimal: {
    id: 'root',
    type: 'panel' as const,
    content: 'timeline' as PanelType
  }
};

export function LayoutManager({ initialLayout, density }: LayoutManagerProps) {
  const [layout, setLayout] = useState<PanelNode>(initialLayout || defaultLayouts.daw);
  const [editMode, setEditMode] = useState(true);
  const [history, setHistory] = useState<PanelNode[]>([]);

  // Generate unique ID
  const generateId = () => `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    const newLayout = cloneTree(layout);
    const node = findNode(newLayout, nodeId);
    
    if (node && node.type === 'panel') {
      // Save current state to history
      setHistory(prev => [...prev, layout]);

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

      setLayout(newLayout);
    }
  };

  // Remove a panel
  const handleRemove = (nodeId: string) => {
    // Don't allow removing root
    if (nodeId === 'root' || nodeId === layout.id) return;

    const newLayout = cloneTree(layout);
    
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
      setHistory(prev => [...prev, layout]);

      // Remove the child
      parent.children = parent.children.filter(c => c.id !== nodeId);

      // If only one child remains, collapse the parent
      if (parent.children.length === 1 && parent.id !== 'root') {
        const remainingChild = parent.children[0];
        Object.assign(parent, remainingChild);
      }

      setLayout(newLayout);
    }
  };

  // Change panel content
  const handleChangeContent = (nodeId: string, content: PanelType) => {
    const newLayout = cloneTree(layout);
    const node = findNode(newLayout, nodeId);
    
    if (node && node.type === 'panel') {
      // Save current state to history
      setHistory(prev => [...prev, layout]);
      
      node.content = content;
      setLayout(newLayout);
    }
  };

  // Undo last change
  const handleUndo = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setLayout(previous);
    }
  };

  // Reset to default layout
  const handleReset = (preset: keyof typeof defaultLayouts = 'daw') => {
    setHistory(prev => [...prev, layout]);
    setLayout(cloneTree(defaultLayouts[preset]));
  };

  // Export configuration
  const handleExport = () => {
    const config = {
      version: '1.0',
      layout: layout,
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
    link.download = `layout-${Date.now()}.json`;
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
            if (config.layout) {
              setHistory(prev => [...prev, layout]);
              setLayout(config.layout);
            }
          } catch (err) {
            console.error('Failed to import layout:', err);
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
          <Button
            variant={editMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEditMode(!editMode)}
            data-testid="button-toggle-edit-mode"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            {editMode ? 'Editing' : 'View Only'}
          </Button>

          {editMode && (
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
                  <Button variant="outline" size="sm" data-testid="button-reset-layout">
                    <Save className="w-4 h-4 mr-2" />
                    Load Preset
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleReset('daw')}>
                    DAW Layout (Full)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReset('simple')}>
                    Simple Layout
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReset('minimal')}>
                    Minimal (Single Panel)
                  </DropdownMenuItem>
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

      {/* Panel Tree */}
      <div className="flex-1 p-2 overflow-hidden">
        <PanelContainer
          node={layout}
          onSplit={handleSplit}
          onRemove={handleRemove}
          onChangeContent={handleChangeContent}
          editMode={editMode}
          density={density}
        />
      </div>

      {/* Help Text */}
      {editMode && (
        <div className="border-t p-2 text-xs text-muted-foreground bg-muted/20">
          <strong>Editing Mode:</strong> Hover over panels to see controls • 
          <kbd className="mx-1 px-1 bg-background border rounded">+</kbd> Change content • 
          <kbd className="mx-1 px-1 bg-background border rounded">Split</kbd> Add panels • 
          <kbd className="mx-1 px-1 bg-background border rounded">Trash</kbd> Remove panels
        </div>
      )}
    </div>
  );
}
