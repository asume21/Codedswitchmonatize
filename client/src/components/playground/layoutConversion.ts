import type { PanelNode, PanelType } from './PanelContainer';

export interface FreeformPanel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: PanelType;
  zIndex: number;
}

// Canvas size for freeform mode (in pixels)
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

/**
 * Convert Split tree structure to Freeform panel array
 * Traverses the PanelNode tree and converts each panel node into a positioned panel
 */
export function splitToFreeform(
  node: PanelNode, 
  bounds = { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
): FreeformPanel[] {
  const panels: FreeformPanel[] = [];
  let zIndex = 1;

  function traverse(current: PanelNode, rect: { x: number; y: number; width: number; height: number }) {
    if (current.type === 'panel') {
      // Panel node - create a freeform panel
      panels.push({
        id: current.id,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        content: current.content || 'empty',
        zIndex: zIndex++
      });
    } else if (current.type === 'split' && current.children && current.children.length > 0) {
      // Split node - recursively process children
      const children = current.children;
      
      // Calculate total size (sum of all child sizes, defaulting to 1 each)
      const totalSize = children.reduce((sum, child) => sum + (child.size || 1), 0);
      
      // Process each child with its proportional bounds
      let offset = 0;
      children.forEach(child => {
        const childSize = child.size || 1;
        const proportion = childSize / totalSize;
        
        if (current.direction === 'horizontal') {
          // Horizontal split - divide width
          const childWidth = rect.width * proportion;
          traverse(child, {
            x: rect.x + offset,
            y: rect.y,
            width: childWidth,
            height: rect.height
          });
          offset += childWidth;
        } else {
          // Vertical split - divide height
          const childHeight = rect.height * proportion;
          traverse(child, {
            x: rect.x,
            y: rect.y + offset,
            width: rect.width,
            height: childHeight
          });
          offset += childHeight;
        }
      });
    }
  }

  traverse(node, bounds);
  return panels;
}

/**
 * Convert Freeform panel array to Split tree structure
 * Uses a column-based approach: group by columns (left to right), then stack vertically within columns
 */
export function freeformToSplit(panels: FreeformPanel[]): PanelNode {
  if (panels.length === 0) {
    return {
      id: `panel-${Date.now()}`,
      type: 'panel',
      content: 'empty'
    };
  }

  if (panels.length === 1) {
    const panel = panels[0];
    return {
      id: panel.id,
      type: 'panel',
      content: panel.content
    };
  }

  // Column-based approach: Group panels into columns based on X position
  // Sort by X position first (left to right)
  const sorted = [...panels].sort((a, b) => a.x - b.x);
  
  // Group into columns (panels with overlapping X ranges)
  const columns: FreeformPanel[][] = [];
  
  let currentColumn: FreeformPanel[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const columnLeft = Math.min(...currentColumn.map(p => p.x));
    const columnRight = Math.max(...currentColumn.map(p => p.x + p.width));
    
    // Check if current panel overlaps horizontally with this column
    // A panel belongs to the column if it starts before the column ends
    if (current.x < columnRight + 20) { // 20px tolerance for gaps
      currentColumn.push(current);
    } else {
      // Start new column
      columns.push(currentColumn);
      currentColumn = [current];
    }
  }
  columns.push(currentColumn);

  // If only one column, create vertical stack
  if (columns.length === 1) {
    const columnPanels = columns[0].sort((a, b) => a.y - b.y);
    return createVerticalStack(columnPanels);
  }

  // Multiple columns - create horizontal split with vertical stacks inside
  const columnNodes = columns.map(columnPanels => {
    const sorted = columnPanels.sort((a, b) => a.y - b.y);
    if (sorted.length === 1) {
      return {
        id: sorted[0].id,
        type: 'panel' as const,
        content: sorted[0].content,
        size: sorted[0].width
      };
    }
    return {
      ...createVerticalStack(sorted),
      size: Math.max(...sorted.map(p => p.width))
    };
  });

  return {
    id: `split-${Date.now()}`,
    type: 'split',
    direction: 'horizontal',
    children: columnNodes
  };
}

/**
 * Create a vertical stack from panels (top to bottom)
 */
function createVerticalStack(panels: FreeformPanel[]): PanelNode {
  if (panels.length === 1) {
    return {
      id: panels[0].id,
      type: 'panel',
      content: panels[0].content
    };
  }

  return {
    id: `split-${Date.now()}`,
    type: 'split',
    direction: 'vertical',
    children: panels.map(p => ({
      id: p.id,
      type: 'panel' as const,
      content: p.content,
      size: p.height
    }))
  };
}

/**
 * Analyze panel layout to determine dominant split direction and grouping
 */
function analyzePanelLayout(panels: FreeformPanel[]): { 
  direction: 'horizontal' | 'vertical'; 
  groups: FreeformPanel[][] 
} {
  // Calculate average panel dimensions
  const avgWidth = panels.reduce((sum, p) => sum + p.width, 0) / panels.length;
  const avgHeight = panels.reduce((sum, p) => sum + p.height, 0) / panels.length;

  // Determine if panels are arranged more horizontally or vertically
  const horizontalVariance = calculateVariance(panels.map(p => p.x));
  const verticalVariance = calculateVariance(panels.map(p => p.y));

  const direction = horizontalVariance > verticalVariance ? 'horizontal' : 'vertical';

  // Group panels by dominant axis
  const groups: FreeformPanel[][] = [];
  const epsilon = direction === 'horizontal' ? avgWidth * 0.3 : avgHeight * 0.3;

  const sorted = [...panels].sort((a, b) => 
    direction === 'horizontal' ? a.x - b.x : a.y - b.y
  );

  let currentGroup: FreeformPanel[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    
    const gap = direction === 'horizontal'
      ? current.x - (previous.x + previous.width)
      : current.y - (previous.y + previous.height);

    if (gap > epsilon) {
      // Start new group
      groups.push(currentGroup);
      currentGroup = [current];
    } else {
      // Add to current group
      currentGroup.push(current);
    }
  }
  
  groups.push(currentGroup);

  return { direction, groups };
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Create a stack of panels in a given direction
 */
function createStack(panels: FreeformPanel[], direction: 'horizontal' | 'vertical'): PanelNode {
  if (panels.length === 1) {
    return {
      id: panels[0].id,
      type: 'panel',
      content: panels[0].content
    };
  }

  // Calculate sizes based on panel dimensions
  const children = panels.map(panel => ({
    id: panel.id,
    type: 'panel' as const,
    content: panel.content,
    size: direction === 'horizontal' ? panel.width : panel.height
  }));

  return {
    id: `split-${Date.now()}`,
    type: 'split',
    direction,
    children
  };
}

/**
 * Create split from grouped panels
 */
function createSplitFromGroups(
  groups: FreeformPanel[][], 
  direction: 'horizontal' | 'vertical'
): PanelNode {
  if (groups.length === 1) {
    // Single group - create stack in opposite direction
    const oppositeDirection = direction === 'horizontal' ? 'vertical' : 'horizontal';
    return createStack(groups[0], oppositeDirection);
  }

  // Create children for each group
  const children = groups.map(group => {
    if (group.length === 1) {
      return {
        id: group[0].id,
        type: 'panel' as const,
        content: group[0].content,
        size: direction === 'horizontal' 
          ? group[0].width 
          : group[0].height
      };
    } else {
      // Recursively create split for this group
      const oppositeDirection = direction === 'horizontal' ? 'vertical' : 'horizontal';
      const childNode = createStack(group, oppositeDirection);
      
      // Calculate total size for this group
      const totalSize = direction === 'horizontal'
        ? Math.max(...group.map(p => p.x + p.width)) - Math.min(...group.map(p => p.x))
        : Math.max(...group.map(p => p.y + p.height)) - Math.min(...group.map(p => p.y));
      
      return {
        ...childNode,
        size: totalSize
      };
    }
  });

  return {
    id: `split-${Date.now()}`,
    type: 'split',
    direction,
    children
  };
}
