import { useState, useEffect, useCallback } from 'react';
import { Undo2, Redo2, History, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { undo, redo, getUndoState, subscribeUndo, clearHistory } from '@/lib/undoSystem';

export default function UndoRedoControls() {
  const [state, setState] = useState(getUndoState());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const unsub = subscribeUndo(() => setState(getUndoState()));
    return unsub;
  }, []);

  const handleUndo = useCallback(() => {
    undo();
  }, []);

  const handleRedo = useCallback(() => {
    redo();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={handleUndo}
        disabled={!state.canUndo}
        className="p-1.5 h-auto text-zinc-400 hover:text-white disabled:opacity-30"
        title={state.undoLabel ? `Undo: ${state.undoLabel}` : 'Nothing to undo'}
      >
        <Undo2 className="w-4 h-4" />
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={handleRedo}
        disabled={!state.canRedo}
        className="p-1.5 h-auto text-zinc-400 hover:text-white disabled:opacity-30"
        title={state.redoLabel ? `Redo: ${state.redoLabel}` : 'Nothing to redo'}
      >
        <Redo2 className="w-4 h-4" />
      </Button>

      <Popover open={showHistory} onOpenChange={setShowHistory}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="p-1.5 h-auto text-zinc-400 hover:text-white"
            title="Undo History"
          >
            <History className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0 bg-zinc-900 border-zinc-700" align="start">
          <div className="p-2 border-b border-zinc-700 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Undo History</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { clearHistory(); setShowHistory(false); }}
              className="text-xs text-zinc-500 hover:text-red-400 h-auto p-1"
            >
              Clear
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {state.futureHistory.length > 0 && (
              <div className="px-2 pt-1">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Redo</span>
                {state.futureHistory.map((item, i) => (
                  <div key={item.id} className="text-xs text-zinc-500 py-0.5 px-1 rounded">
                    {item.label}
                  </div>
                ))}
              </div>
            )}
            <div className="px-2 py-1 bg-purple-500/10 border-l-2 border-purple-500 mx-1 my-1 rounded-r">
              <span className="text-[10px] text-purple-400 uppercase tracking-wider">Current</span>
            </div>
            {state.history.length > 0 ? (
              <div className="px-2 pb-1">
                {[...state.history].reverse().map((item) => (
                  <div key={item.id} className="text-xs text-zinc-300 py-0.5 px-1 rounded hover:bg-zinc-800">
                    {item.label}
                    <span className="text-zinc-600 ml-2">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-xs text-zinc-500 text-center">No history yet</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
