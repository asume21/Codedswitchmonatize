import { useState, useCallback } from 'react';
import { Plugin } from '@/components/layout/PluginManager';
import { 
  Music, Mic, Disc, Piano, Code, Wrench, 
  FileText, Shield, Bot, Sliders, Gamepad2, 
  Grid3X3, Waves, Package, BarChart3, Settings 
} from 'lucide-react';

// Import existing plugin components
import MelodyComposer from '@/components/studio/MelodyComposer';
import SongUploader from '@/components/studio/SongUploader';
import CodeTranslator from '@/components/studio/CodeTranslator';
import LyricLab from '@/components/studio/LyricLab';
import VulnerabilityScanner from '@/components/studio/VulnerabilityScanner';
import AIAssistant from '@/components/studio/AIAssistant';
import MixStudio from '@/components/studio/MixStudio';
import { MIDIController } from '@/components/studio/MIDIController';
import GranularEngine from '@/components/producer/GranularEngine';
import WavetableOscillator from '@/components/producer/WavetableOscillator';
import ProfessionalStudio from '@/components/studio/ProfessionalStudio';

// Placeholder component for missing plugins
const PlaceholderComponent = () => {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <Settings className="w-8 h-8 mx-auto mb-2" />
      <p>Plugin coming soon...</p>
    </div>
  );
};

const defaultPlugins: Plugin[] = [
  // Studio Category
  {
    id: 'melody-composer',
    name: 'Melody Composer',
    description: 'AI-powered melody generation and composition tools',
    category: 'studio',
    component: MelodyComposer,
    icon: Music,
    active: false,
  },
  {
    id: 'song-uploader',
    name: 'Song Uploader',
    description: 'Upload and manage your music files',
    category: 'studio',
    component: SongUploader,
    icon: Mic,
    active: false,
  },
  {
    id: 'beat-studio',
    name: 'Beat Studio',
    description: 'Create and edit drum patterns and beats',
    category: 'studio',
    component: BeatStudio,
    icon: Disc,
    active: false,
  },
  {
    id: 'unified-studio',
    name: 'Unified Studio',
    description: 'All-in-one music production workspace',
    category: 'studio',
    component: UnifiedStudio,
    icon: Piano,
    active: false,
  },
  {
    id: 'professional-studio',
    name: 'Professional Studio',
    description: 'Advanced professional music production suite',
    category: 'studio',
    component: ProfessionalStudio,
    icon: Settings,
    active: false,
  },
  {
    id: 'lyric-lab',
    name: 'Lyric Lab',
    description: 'AI-assisted lyric writing and editing',
    category: 'studio',
    component: LyricLab,
    icon: FileText,
    active: false,
  },
  {
    id: 'ai-assistant',
    name: 'AI Assistant',
    description: 'Intelligent music production assistant',
    category: 'studio',
    component: AIAssistant,
    icon: Bot,
    active: false,
  },

  // Production Category
  {
    id: 'mix-studio',
    name: 'Mix Studio',
    description: 'Professional mixing and mastering tools',
    category: 'production',
    component: MixStudio,
    icon: Sliders,
    active: false,
  },
  {
    id: 'pro-console',
    name: 'Pro Console',
    description: 'Advanced audio console and routing',
    category: 'production',
    component: ProConsole,
    icon: Gamepad2,
    active: false,
  },
  {
    id: 'midi-controller',
    name: 'MIDI Controller',
    description: 'MIDI device control and mapping',
    category: 'production',
    component: MidiController,
    icon: Grid3X3,
    active: false,
  },
  {
    id: 'advanced-sequencer',
    name: 'Advanced Sequencer',
    description: 'Multi-track MIDI and audio sequencing',
    category: 'production',
    component: AdvancedSequencer,
    icon: Grid3X3,
    active: false,
  },
  {
    id: 'granular-engine',
    name: 'Granular Engine',
    description: 'Granular synthesis and sound design',
    category: 'production',
    component: GranularEngine,
    icon: Waveform,
    active: false,
  },
  {
    id: 'wavetable-oscillator',
    name: 'Wavetable Oscillator',
    description: 'Advanced wavetable synthesis',
    category: 'production',
    component: WavetableOscillator,
    icon: Waveform,
    active: false,
  },
  {
    id: 'pack-generator',
    name: 'Pack Generator',
    description: 'Generate sample packs and loops',
    category: 'production',
    component: PackGenerator,
    icon: Package,
    active: false,
  },

  // Analysis Category
  {
    id: 'song-structure',
    name: 'Song Structure',
    description: 'Analyze and visualize song structure',
    category: 'analysis',
    component: SongStructure,
    icon: BarChart3,
    active: false,
  },

  // Utility Category
  {
    id: 'code-translator',
    name: 'Code Translator',
    description: 'Convert code between programming languages',
    category: 'utility',
    component: CodeTranslator,
    icon: Code,
    active: false,
  },
  {
    id: 'codebeat-studio',
    name: 'CodeBeat Studio',
    description: 'Generate music from code patterns',
    category: 'utility',
    component: CodeBeatStudio,
    icon: Wrench,
    active: false,
  },
  {
    id: 'vulnerability-scanner',
    name: 'Vulnerability Scanner',
    description: 'Scan code for security vulnerabilities',
    category: 'utility',
    component: VulnerabilityScanner,
    icon: Shield,
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
