// client/src/components/studio/DesktopBridgeToggle.tsx

import React, { useEffect, useState } from 'react';
import { useDesktopBridge } from '../../contexts/DesktopBridgeContext';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Monitor, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BridgeStats } from '../../lib/desktopBridge';

export const DesktopBridgeToggle: React.FC = () => {
  const { isEnabled, isActive, connectionState, toggleActive, getStats } = useDesktopBridge();
  const [stats, setStats] = useState<BridgeStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Poll stats every 3 seconds if connected
  useEffect(() => {
    if (connectionState !== 'ready') {
      setStats(null);
      return;
    }

    const fetchStats = async () => {
      try {
        const currentStats = await getStats();
        setStats(currentStats);
      } catch (e) {
        // Silent catch
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [connectionState, getStats]);

  if (!isEnabled) {
    return null;
  }

  // Get status details
  const getStatusColor = () => {
    if (!isActive) return 'bg-zinc-600 shadow-none';
    switch (connectionState) {
      case 'ready':
        return 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]';
      case 'syncing':
      case 'connecting':
        return 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]';
      case 'error':
      case 'disconnected':
      default:
        return 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';
    }
  };

  const getStatusText = () => {
    if (!isActive) return 'Desktop Engine: Off';
    switch (connectionState) {
      case 'ready':
        return 'Connected to local engine';
      case 'syncing':
        return 'Synchronizing clocks...';
      case 'connecting':
        return 'Connecting to local engine...';
      case 'error':
        return 'Connection error (is engine running?)';
      case 'disconnected':
      default:
        return 'Disconnected';
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleActive}
              className={cn(
                "h-8 border-zinc-800 bg-zinc-950/60 text-xs transition-all duration-300 gap-2 hover:bg-zinc-900/60 hover:text-zinc-200",
                isActive && connectionState === 'ready' && "border-cyan-500/30 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/20"
              )}
            >
              <Monitor className={cn("h-3.5 w-3.5", isActive && connectionState === 'ready' && "text-cyan-400")} />
              <span>Desktop Output</span>
              <span className={cn("h-2 w-2 rounded-full", getStatusColor())} />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent className="border-zinc-800 bg-zinc-950 text-zinc-300 max-w-[280px] p-3 text-xs leading-relaxed shadow-xl">
          <div className="space-y-1.5">
            <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
              <span>{getStatusText()}</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              When enabled, MIDI notes and audio triggers are routed to your high-fidelity local Python engine instead of the browser.
            </p>
            {stats && stats.count > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-zinc-800/80 space-y-1 text-[10px] font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Events:</span>
                  <span className="text-cyan-400">{stats.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Median Jitter:</span>
                  <span className="text-zinc-300">{stats.median_ms.toFixed(2)} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Max Jitter:</span>
                  <span className="text-zinc-300">{stats.max_ms.toFixed(2)} ms</span>
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
