import { useState, useCallback } from 'react';
import { Settings } from 'lucide-react';

export interface Plugin {
  id: string;
  name: string;
  description: string;
  category: 'studio' | 'production' | 'analysis' | 'utility';
  component: React.ComponentType;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}

// Simple placeholder component
const PlaceholderComponent = () => (
  <div className="p-4 text-center text-muted-foreground">
    <Settings className="w-8 h-8 mx-auto mb-2" />
    <p>Plugin coming soon...</p>
  </div>
);

const defaultPlugins: Plugin[] = [
  {
    id: 'melody-composer',
    name: 'Melody Composer',
    description: 'AI-powered melody generation and composition tools',
    category: 'studio',
    component: PlaceholderComponent,
    icon: Settings,
    active: false,
  },
  {
    id: 'song-uploader',
    name: 'Song Uploader',
    description: 'Upload and manage your music files',
    category: 'studio',
    component: PlaceholderComponent,
    icon: Settings,
    active: false,
  },
  {
    id: 'beat-studio',
    name: 'Beat Studio',
    description: 'Create and edit drum patterns and beats',
    category: 'studio',
    component: PlaceholderComponent,
    icon: Settings,
    active: false,
  },
  {
    id: 'mix-studio',
    name: 'Mix Studio',
    description: 'Professional mixing and mastering tools',
    category: 'production',
    component: PlaceholderComponent,
    icon: Settings,
    active: false,
  },
  {
    id: 'ai-assistant',
    name: 'AI Assistant',
    description: 'Intelligent music production assistant',
    category: 'studio',
    component: PlaceholderComponent,
    icon: Settings,
    active: false,
  },
];

export function usePluginManager() {
  const [plugins, setPlugins] = useState<Plugin[]>(defaultPlugins);

  const togglePlugin = useCallback((pluginId: string) => {
    setPlugins(prev => prev.map(plugin => 
      plugin.id === pluginId 
        ? { ...plugin, active: !plugin.active }
        : plugin
    ));
  }, []);

  const getActivePlugins = useCallback(() => {
    return plugins.filter(plugin => plugin.active);
  }, [plugins]);

  const getPluginById = useCallback((id: string) => {
    return plugins.find(plugin => plugin.id === id);
  }, [plugins]);

  return {
    plugins,
    togglePlugin,
    getActivePlugins,
    getPluginById,
  };
}
