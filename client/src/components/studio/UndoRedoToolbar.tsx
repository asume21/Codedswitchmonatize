/**
 * UndoRedoToolbar — Undo/Redo buttons with keyboard shortcut support.
 *
 * Subscribes to the undoSystem for reactive state updates.
 * Renders compact undo/redo buttons showing the last action label.
 */

import { useState, useEffect, useCallback } from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { undo, redo, getUndoState, subscribeUndo } from '@/lib/undoSystem';

export function UndoRedoToolbar() {
  const [state, setState] = useState(getUndoState);

  useEffect(() => {
    return subscribeUndo(() => setState(getUndoState()));
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => undo()}
        disabled={!state.canUndo}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-gray-400 hover:text-cyan-300"
        title={state.undoLabel ? `Undo: ${state.undoLabel} (Ctrl+Z)` : 'Nothing to undo'}
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => redo()}
        disabled={!state.canRedo}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-gray-400 hover:text-cyan-300"
        title={state.redoLabel ? `Redo: ${state.redoLabel} (Ctrl+Shift+Z)` : 'Nothing to redo'}
      >
        <Redo2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default UndoRedoToolbar;
