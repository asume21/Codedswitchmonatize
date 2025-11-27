export interface UndoableAction<T> {
  past: T;
  future: T;
}

export class UndoManager<T> {
  private past: T[] = [];
  private future: T[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Record a new state. Clears the redo stack.
   */
  record(state: T) {
    this.past = [...this.past, state];
    if (this.past.length > this.maxSize) {
      this.past = this.past.slice(this.past.length - this.maxSize);
    }
    this.future = [];
  }

  /**
   * Undo to the previous state, returning it, or null if none.
   */
  undo(current: T): T | null {
    if (this.past.length === 0) return null;
    const previous = this.past[this.past.length - 1];
    this.past = this.past.slice(0, -1);
    this.future = [current, ...this.future];
    return previous;
  }

  /**
   * Redo to the next state, returning it, or null if none.
   */
  redo(current: T): T | null {
    if (this.future.length === 0) return null;
    const [next, ...rest] = this.future;
    this.future = rest;
    this.past = [...this.past, current];
    if (this.past.length > this.maxSize) {
      this.past = this.past.slice(this.past.length - this.maxSize);
    }
    return next;
  }

  clear() {
    this.past = [];
    this.future = [];
  }
}
