import { useWindowManager, STUDIO_WINDOWS } from '@/contexts/WindowManagerContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function WindowLauncher() {
  const { toggleWindow, isOpen, isMinimized, restoreWindow } = useWindowManager();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5 px-2 py-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg backdrop-blur-sm">
        {STUDIO_WINDOWS.map(win => {
          const Icon = win.icon;
          const open = isOpen(win.id);
          const minimized = isMinimized(win.id);

          return (
            <Tooltip key={win.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (minimized) {
                      restoreWindow(win.id);
                    } else {
                      toggleWindow(win.id);
                    }
                  }}
                  className={`relative p-1.5 rounded-md transition-all ${
                    open && !minimized
                      ? 'bg-purple-500/20 text-purple-300 shadow-inner'
                      : minimized
                        ? 'bg-zinc-700/30 text-yellow-400/70'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {/* Active indicator dot */}
                  {open && (
                    <div className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                      minimized ? 'bg-yellow-400/70' : 'bg-purple-400'
                    }`} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs bg-zinc-800 border-zinc-600">
                {win.title}
                {open && !minimized && <span className="text-zinc-500 ml-1">(click to close)</span>}
                {minimized && <span className="text-yellow-400/70 ml-1">(minimized)</span>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
