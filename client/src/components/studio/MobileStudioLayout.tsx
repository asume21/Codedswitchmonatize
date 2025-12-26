import React, { useState } from 'react';
import { 
  Music, 
  Mic2, 
  Layers, 
  Settings, 
  Play, 
  Pause, 
  Square, 
  Home,
  Piano,
  Drum,
  FileText,
  Wand2,
  Upload,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MobileTab = 'home' | 'piano' | 'beats' | 'lyrics' | 'ai' | 'upload' | 'more';

interface MobileStudioLayoutProps {
  children?: React.ReactNode;
  onTabChange?: (tab: MobileTab) => void;
  activeTab?: MobileTab;
  isPlaying?: boolean;
  onPlay?: () => void;
  onStop?: () => void;
  bpm?: number;
  currentKey?: string;
}

export function MobileStudioLayout({
  children,
  onTabChange,
  activeTab = 'home',
  isPlaying = false,
  onPlay,
  onStop,
  bpm = 120,
  currentKey = 'C'
}: MobileStudioLayoutProps) {
  const [internalTab, setInternalTab] = useState<MobileTab>(activeTab);
  
  const currentTab = activeTab || internalTab;
  
  const handleTabChange = (tab: MobileTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  const tabs: { id: MobileTab; icon: React.ReactNode; label: string }[] = [
    { id: 'home', icon: <Home className="w-5 h-5" />, label: 'Home' },
    { id: 'piano', icon: <Piano className="w-5 h-5" />, label: 'Piano' },
    { id: 'beats', icon: <Drum className="w-5 h-5" />, label: 'Beats' },
    { id: 'lyrics', icon: <FileText className="w-5 h-5" />, label: 'Lyrics' },
    { id: 'ai', icon: <Wand2 className="w-5 h-5" />, label: 'AI' },
    { id: 'more', icon: <MoreHorizontal className="w-5 h-5" />, label: 'More' },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-gray-900 text-white">
      {/* Mobile Header - Compact transport */}
      <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-3 flex-shrink-0">
        {/* Left: Logo/Title */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold">Studio</span>
        </div>
        
        {/* Center: Transport */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onPlay}
            className={cn(
              "h-10 w-10 p-0 rounded-full",
              isPlaying ? "bg-orange-600 hover:bg-orange-500" : "bg-green-600 hover:bg-green-500"
            )}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onStop}
            className="h-10 w-10 p-0 rounded-full bg-gray-700 hover:bg-gray-600"
          >
            <Square className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Right: BPM/Key */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-bold">{bpm}</span>
          <span className="text-gray-400">BPM</span>
          <span className="px-2 py-1 bg-gray-700 rounded text-xs font-bold">{currentKey}</span>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div className="h-16 bg-gray-800 border-t border-gray-700 flex items-center justify-around px-2 flex-shrink-0 safe-area-bottom">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-all min-w-[56px]",
              currentTab === tab.id
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            )}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Mobile-optimized Piano Roll wrapper
export function MobilePianoRoll({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      {/* Simplified toolbar for mobile */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center gap-2 px-3 overflow-x-auto flex-shrink-0">
        <Button size="sm" variant="ghost" className="h-9 px-3 flex-shrink-0">
          <Piano className="w-4 h-4 mr-1" />
          Piano
        </Button>
        <Button size="sm" variant="ghost" className="h-9 px-3 flex-shrink-0">
          <Drum className="w-4 h-4 mr-1" />
          Drums
        </Button>
        <Button size="sm" variant="ghost" className="h-9 px-3 flex-shrink-0">
          <Layers className="w-4 h-4 mr-1" />
          Bass
        </Button>
        <Button size="sm" variant="ghost" className="h-9 px-3 flex-shrink-0">
          <Wand2 className="w-4 h-4 mr-1" />
          AI
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto touch-pan-x touch-pan-y">
        {children}
      </div>
    </div>
  );
}

// Mobile-optimized Beat Maker
export function MobileBeatMaker() {
  const [selectedPad, setSelectedPad] = useState<number | null>(null);
  
  const pads = Array.from({ length: 16 }, (_, i) => i);
  
  return (
    <div className="h-full w-full p-4 flex flex-col gap-4">
      {/* 4x4 Pad Grid */}
      <div className="grid grid-cols-4 gap-2 flex-1">
        {pads.map((pad) => (
          <button
            key={pad}
            onClick={() => setSelectedPad(pad)}
            className={cn(
              "aspect-square rounded-xl flex items-center justify-center text-lg font-bold transition-all active:scale-95",
              selectedPad === pad
                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            )}
          >
            {pad + 1}
          </button>
        ))}
      </div>
      
      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button className="flex-1 h-12 bg-green-600 hover:bg-green-500">
          <Play className="w-5 h-5 mr-2" />
          Play
        </Button>
        <Button variant="outline" className="flex-1 h-12">
          <Wand2 className="w-5 h-5 mr-2" />
          AI Generate
        </Button>
      </div>
    </div>
  );
}

export default MobileStudioLayout;
