/**
 * Undo/Redo System — Command pattern covering all DAW operations.
 * Supports: note edits, track changes, mixer moves, automation, clip operations.
 * Integrates with eventBus and projectManager.
 */

import { markDirty } from '@/lib/projectManager';

export interface UndoCommand {
  id: string;
  label: string;          // Human-readable description for history panel
  timestamp: number;
  execute: () => void;    // Do / redo
  undo: () => void;       // Reverse
}

const MAX_HISTORY = 200;

let undoStack: UndoCommand[] = [];
let redoStack: UndoCommand[] = [];
let listeners: Array<() => void> = [];
let batchCommands: UndoCommand[] | null = null;

function notify() {
  listeners.forEach(fn => fn());
}

/**
 * Execute a command and push it onto the undo stack.
 */
export function executeCommand(cmd: UndoCommand) {
  if (batchCommands) {
    batchCommands.push(cmd);
    cmd.execute();
    return;
  }

  cmd.execute();
  undoStack.push(cmd);
  if (undoStack.length > MAX_HISTORY) {
    undoStack = undoStack.slice(undoStack.length - MAX_HISTORY);
  }
  redoStack = [];
  markDirty();
  notify();
}

/**
 * Undo the last command.
 */
export function undo(): UndoCommand | null {
  const cmd = undoStack.pop();
  if (!cmd) return null;
  cmd.undo();
  redoStack.push(cmd);
  markDirty();
  notify();
  return cmd;
}

/**
 * Redo the last undone command.
 */
export function redo(): UndoCommand | null {
  const cmd = redoStack.pop();
  if (!cmd) return null;
  cmd.execute();
  undoStack.push(cmd);
  markDirty();
  notify();
  return cmd;
}

/**
 * Start a batch — multiple commands grouped as one undo step.
 */
export function startBatch(label: string) {
  batchCommands = [];
}

/**
 * End a batch — collapses all batched commands into one.
 */
export function endBatch(label: string) {
  if (!batchCommands || batchCommands.length === 0) {
    batchCommands = null;
    return;
  }

  const commands = [...batchCommands];
  batchCommands = null;

  const batchCmd: UndoCommand = {
    id: crypto.randomUUID(),
    label,
    timestamp: Date.now(),
    execute: () => commands.forEach(c => c.execute()),
    undo: () => [...commands].reverse().forEach(c => c.undo()),
  };

  undoStack.push(batchCmd);
  if (undoStack.length > MAX_HISTORY) {
    undoStack = undoStack.slice(undoStack.length - MAX_HISTORY);
  }
  redoStack = [];
  markDirty();
  notify();
}

/**
 * Get current undo/redo state for UI.
 */
export function getUndoState() {
  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null,
    redoLabel: redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null,
    history: undoStack.map(c => ({ id: c.id, label: c.label, timestamp: c.timestamp })),
    futureHistory: redoStack.map(c => ({ id: c.id, label: c.label, timestamp: c.timestamp })),
  };
}

/**
 * Subscribe to undo state changes.
 */
export function subscribeUndo(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

/**
 * Clear all history (e.g., when loading a new project).
 */
export function clearHistory() {
  undoStack = [];
  redoStack = [];
  notify();
}

// ─── Pre-built command factories ────────────────────────────────────

/**
 * Create a command for changing a track property.
 */
export function trackPropertyCommand(
  trackId: string,
  property: string,
  oldValue: any,
  newValue: any,
  applyFn: (trackId: string, property: string, value: any) => void,
): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: `Change ${property} on track`,
    timestamp: Date.now(),
    execute: () => applyFn(trackId, property, newValue),
    undo: () => applyFn(trackId, property, oldValue),
  };
}

/**
 * Create a command for adding/removing a note.
 */
export function noteCommand(
  action: 'add' | 'remove',
  trackId: string,
  note: any,
  addFn: (trackId: string, note: any) => void,
  removeFn: (trackId: string, noteId: string) => void,
): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: action === 'add' ? 'Add note' : 'Remove note',
    timestamp: Date.now(),
    execute: () => action === 'add' ? addFn(trackId, note) : removeFn(trackId, note.id),
    undo: () => action === 'add' ? removeFn(trackId, note.id) : addFn(trackId, note),
  };
}

/**
 * Create a command for moving/resizing a note.
 */
export function noteMoveCommand(
  trackId: string,
  noteId: string,
  oldProps: { step: number; length: number; velocity: number },
  newProps: { step: number; length: number; velocity: number },
  updateFn: (trackId: string, noteId: string, props: any) => void,
): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: 'Move note',
    timestamp: Date.now(),
    execute: () => updateFn(trackId, noteId, newProps),
    undo: () => updateFn(trackId, noteId, oldProps),
  };
}

/**
 * Create a command for adding/removing a track.
 */
export function trackCommand(
  action: 'add' | 'remove',
  track: any,
  addFn: (track: any) => void,
  removeFn: (trackId: string) => void,
): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: action === 'add' ? `Add track "${track.name}"` : `Remove track "${track.name}"`,
    timestamp: Date.now(),
    execute: () => action === 'add' ? addFn(track) : removeFn(track.id),
    undo: () => action === 'add' ? removeFn(track.id) : addFn(track),
  };
}

/**
 * Create a command for clip operations.
 */
export function clipCommand(
  action: 'add' | 'remove' | 'move' | 'trim',
  clipId: string,
  oldState: any,
  newState: any,
  applyFn: (clipId: string, state: any) => void,
  removeFn?: (clipId: string) => void,
  addFn?: (state: any) => void,
): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: `${action.charAt(0).toUpperCase() + action.slice(1)} clip`,
    timestamp: Date.now(),
    execute: () => {
      if (action === 'add' && addFn) addFn(newState);
      else if (action === 'remove' && removeFn) removeFn(clipId);
      else applyFn(clipId, newState);
    },
    undo: () => {
      if (action === 'add' && removeFn) removeFn(clipId);
      else if (action === 'remove' && addFn) addFn(oldState);
      else applyFn(clipId, oldState);
    },
  };
}

/**
 * Create a command for automation point changes.
 */
export function automationCommand(
  laneId: string,
  oldPoints: any[],
  newPoints: any[],
  applyFn: (laneId: string, points: any[]) => void,
): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: 'Edit automation',
    timestamp: Date.now(),
    execute: () => applyFn(laneId, newPoints),
    undo: () => applyFn(laneId, oldPoints),
  };
}

/**
 * Create a command for mixer changes.
 */
export function mixerCommand(
  channelId: string,
  property: string,
  oldValue: any,
  newValue: any,
  applyFn: (channelId: string, property: string, value: any) => void,
): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: `Change mixer ${property}`,
    timestamp: Date.now(),
    execute: () => applyFn(channelId, property, newValue),
    undo: () => applyFn(channelId, property, oldValue),
  };
}

/**
 * Create a command for effect chain changes.
 */
export function effectCommand(
  action: 'add' | 'remove' | 'reorder' | 'update',
  trackId: string,
  oldEffects: any[],
  newEffects: any[],
  applyFn: (trackId: string, effects: any[]) => void,
): UndoCommand {
  return {
    id: crypto.randomUUID(),
    label: `${action.charAt(0).toUpperCase() + action.slice(1)} effect`,
    timestamp: Date.now(),
    execute: () => applyFn(trackId, newEffects),
    undo: () => applyFn(trackId, oldEffects),
  };
}
