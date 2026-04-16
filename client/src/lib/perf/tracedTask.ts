// Named performance tracer — wraps a synchronous hot path so the long-task
// monitor can attribute its duration by name instead of showing "unknown".
//
// Usage:
//   tracedTask('ai.beatLoad', () => { /* work */ });
//   const result = tracedTask('organism.transition', () => compute());
//
// In production, Vite dead-strips the DEV-only measurement to zero cost.

const MARK_PREFIX = 'trace:';

let counter = 0;

export function tracedTask<T>(name: string, fn: () => T): T {
  if (!import.meta.env.DEV || typeof performance === 'undefined' || !performance.mark) {
    return fn();
  }
  const id = `${MARK_PREFIX}${name}#${counter++}`;
  const startMark = `${id}:start`;
  const endMark   = `${id}:end`;
  performance.mark(startMark);
  try {
    return fn();
  } finally {
    performance.mark(endMark);
    try {
      performance.measure(id, startMark, endMark);
    } catch {
      // measure can throw if marks were cleared; swallow — the fn result is the contract
    }
    // Prevent unbounded growth of the User Timing buffer.
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
  }
}

export const TRACE_MARK_PREFIX = MARK_PREFIX;
