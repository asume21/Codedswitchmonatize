import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  Save, Undo2, Sliders, Music, Mic, Scissors, Snowflake, Layers, Layers2, Piano, Wand2,
  type LucideIcon,
} from 'lucide-react';

export interface WindowConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  resizable: boolean;
}

export interface WindowState {
  id: string;
  open: boolean;
  minimized: boolean;
  zIndex: number;
  x: number;
  y: number;
}

// Registry of all available studio windows
export const STUDIO_WINDOWS: WindowConfig[] = [
  { id: 'project-manager', title: 'Project Manager', icon: Save, defaultWidth: 420, defaultHeight: 480, minWidth: 320, minHeight: 300, resizable: true },
  { id: 'effects-chain', title: 'Effects Chain', icon: Sliders, defaultWidth: 300, defaultHeight: 500, minWidth: 260, minHeight: 300, resizable: true },
  { id: 'mixer', title: 'Mixer', icon: Layers, defaultWidth: 700, defaultHeight: 420, minWidth: 400, minHeight: 300, resizable: true },
  { id: 'automation', title: 'Automation', icon: Wand2, defaultWidth: 600, defaultHeight: 200, minWidth: 400, minHeight: 150, resizable: true },
  { id: 'recording', title: 'Recording', icon: Mic, defaultWidth: 340, defaultHeight: 520, minWidth: 300, minHeight: 400, resizable: true },
  { id: 'sample-slicer', title: 'Sample Slicer', icon: Scissors, defaultWidth: 600, defaultHeight: 450, minWidth: 400, minHeight: 300, resizable: true },
  { id: 'freeze-bounce', title: 'Freeze / Bounce', icon: Snowflake, defaultWidth: 340, defaultHeight: 480, minWidth: 280, minHeight: 350, resizable: true },
  { id: 'clip-editor', title: 'Clip Editor', icon: Music, defaultWidth: 700, defaultHeight: 200, minWidth: 400, minHeight: 120, resizable: true },
  { id: 'midi-editor', title: 'MIDI Editor', icon: Piano, defaultWidth: 750, defaultHeight: 350, minWidth: 500, minHeight: 250, resizable: true },
  { id: 'undo-history', title: 'Undo History', icon: Undo2, defaultWidth: 280, defaultHeight: 360, minWidth: 220, minHeight: 200, resizable: true },
  { id: 'stem-generator', title: 'AI Stem Generator', icon: Layers2, defaultWidth: 380, defaultHeight: 580, minWidth: 320, minHeight: 400, resizable: true },
  { id: 'sample-library', title: 'Sample Library', icon: Music, defaultWidth: 420, defaultHeight: 600, minWidth: 360, minHeight: 450, resizable: true },
];

interface WindowManagerContextValue {
  windows: WindowState[];
  openWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  toggleWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  isOpen: (id: string) => boolean;
  isMinimized: (id: string) => boolean;
  getZIndex: (id: string) => number;
  getConfig: (id: string) => WindowConfig | undefined;
}

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

let nextZ = 100;

function cascadePosition(index: number): { x: number; y: number } {
  const offset = (index % 8) * 30;
  return { x: 80 + offset, y: 60 + offset };
}

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<WindowState[]>([]);

  const openWindow = useCallback((id: string) => {
    setWindows(prev => {
      const existing = prev.find(w => w.id === id);
      if (existing) {
        // Already open — bring to front and restore if minimized
        nextZ++;
        return prev.map(w => w.id === id ? { ...w, open: true, minimized: false, zIndex: nextZ } : w);
      }
      // New window
      nextZ++;
      const openCount = prev.filter(w => w.open).length;
      const { x, y } = cascadePosition(openCount);
      return [...prev, { id, open: true, minimized: false, zIndex: nextZ, x, y }];
    });
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, open: false, minimized: false } : w));
  }, []);

  const toggleWindow = useCallback((id: string) => {
    setWindows(prev => {
      const existing = prev.find(w => w.id === id);
      if (existing?.open && !existing.minimized) {
        return prev.map(w => w.id === id ? { ...w, open: false } : w);
      }
      nextZ++;
      if (existing) {
        return prev.map(w => w.id === id ? { ...w, open: true, minimized: false, zIndex: nextZ } : w);
      }
      const openCount = prev.filter(w => w.open).length;
      const { x, y } = cascadePosition(openCount);
      return [...prev, { id, open: true, minimized: false, zIndex: nextZ, x, y }];
    });
  }, []);

  const focusWindow = useCallback((id: string) => {
    nextZ++;
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: nextZ } : w));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: true } : w));
  }, []);

  const restoreWindow = useCallback((id: string) => {
    nextZ++;
    setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: false, zIndex: nextZ } : w));
  }, []);

  const isOpen = useCallback((id: string) => {
    return windows.find(w => w.id === id)?.open ?? false;
  }, [windows]);

  const isMinimized = useCallback((id: string) => {
    return windows.find(w => w.id === id)?.minimized ?? false;
  }, [windows]);

  const getZIndex = useCallback((id: string) => {
    return windows.find(w => w.id === id)?.zIndex ?? 100;
  }, [windows]);

  const getConfig = useCallback((id: string) => {
    return STUDIO_WINDOWS.find(w => w.id === id);
  }, []);

  return (
    <WindowManagerContext.Provider value={{
      windows,
      openWindow,
      closeWindow,
      toggleWindow,
      focusWindow,
      minimizeWindow,
      restoreWindow,
      isOpen,
      isMinimized,
      getZIndex,
      getConfig,
    }}>
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager(): WindowManagerContextValue {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error('useWindowManager must be used within WindowManagerProvider');
  return ctx;
}
