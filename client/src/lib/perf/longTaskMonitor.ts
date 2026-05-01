// Dev-only long-task monitor.
// A "long task" is a main-thread task that runs for more than 50ms (the
// browser's PerformanceObserver threshold). Anything >50ms causes dropped
// frames; anything >5000ms triggers Chrome's "page not responding" dialog.
//
// This monitor logs every long task to the console and shows a small red
// overlay of the most recent ones (top-left, to avoid the render counter).
//
// It also observes User Timing `measure` entries with the `trace:` prefix
// (written by `tracedTask`) so wrapped hot paths show up with real names
// instead of Chrome's privacy-limited "unknown" attribution.
//
// In production, Vite dead-strips the DEV block — zero runtime cost.

import { TRACE_MARK_PREFIX } from './tracedTask';

interface LongTaskRecord {
  duration: number;
  startTime: number;
  name: string;
  attrNames: string[];
}

const TRACE_MIN_MS = 50; // same threshold the browser uses for longtask

// Chrome's PerformanceEntry for longtask extends with `attribution` — not in
// the default lib.dom types, so we declare the shape locally.
interface LongTaskAttribution {
  name?: string;
  containerType?: string;
  containerSrc?: string;
  containerName?: string;
  containerId?: string;
}

const recent: LongTaskRecord[] = [];
const MAX_KEEP = 12;

let overlayEl: HTMLElement | null = null;
let started = false;

function ensureOverlay(): void {
  if (typeof document === 'undefined' || overlayEl) return;

  overlayEl = document.createElement('div');
  overlayEl.id = '__long-task-overlay';
  Object.assign(overlayEl.style, {
    position: 'fixed',
    top: '8px',
    left: '8px',
    zIndex: '999998',
    background: 'rgba(40,0,0,0.9)',
    color: '#ff9f9f',
    font: '11px/1.3 ui-monospace, Menlo, monospace',
    padding: '6px 10px',
    borderRadius: '4px',
    pointerEvents: 'none',
    maxWidth: '420px',
    whiteSpace: 'pre',
    border: '1px solid rgba(255,127,127,0.35)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
    display: 'none',
  });
  document.body.appendChild(overlayEl);
}

function renderOverlay(): void {
  if (!overlayEl) return;
  if (recent.length === 0) {
    overlayEl.style.display = 'none';
    return;
  }
  overlayEl.style.display = 'block';

  const rows = recent
    .slice(-8)
    .reverse()
    .map((r) => {
      const color =
        r.duration >= 1000 ? '#ff5f5f' :
        r.duration >= 200  ? '#ffaf5f' :
        '#ffdf8f';
      const names = r.attrNames.join(',') || r.name || 'self';
      const clipped = names.length > 40 ? names.slice(0, 37) + '…' : names;
      return `<span style="color:${color}">${r.duration.toFixed(0).padStart(5)}ms</span>  ${clipped}`;
    })
    .join('\n');

  overlayEl.innerHTML =
    `<span style="color:#fff;font-weight:bold">Long tasks (most recent)</span>\n${'─'.repeat(30)}\n${rows}`;
}

export function startLongTaskMonitor(): void {
  if (!import.meta.env.DEV) return;
  if (started) return;
  started = true;

  if (typeof PerformanceObserver === 'undefined') {
    console.info('[PERF:LongTask] PerformanceObserver unavailable — skipping.');
    return;
  }
  const supported = PerformanceObserver.supportedEntryTypes;
  if (!supported || !supported.includes('longtask')) {
    console.info('[PERF:LongTask] longtask entry type not supported in this browser — skipping.');
    return;
  }

  ensureOverlay();

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const attrs = ((entry as PerformanceEntry & { attribution?: LongTaskAttribution[] }).attribution ?? []);
      const attrNames = attrs
        .map((a) => a.name || a.containerName || a.containerSrc || a.containerType || '')
        .filter(Boolean);

      const rec: LongTaskRecord = {
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name,
        attrNames,
      };
      recent.push(rec);
      if (recent.length > MAX_KEEP) recent.shift();

      // Chrome's "page not responding" threshold is ~5s. Anything ≥1s is a
      // user-visible freeze. Below that, it's a dropped-frame / stutter source.
      const isFreeze = entry.duration >= 1000;
      const tag = isFreeze ? '[PERF:LongTask FREEZE]' : '[PERF:LongTask]';
      const method = isFreeze ? 'error' : 'warn';
      const suffix = attrNames.length ? ' ← ' + attrNames.join(',') : '';
       
      (console as unknown as Record<string, (...a: unknown[]) => void>)[method](
        `${tag} ${entry.duration.toFixed(0)}ms ${entry.name}${suffix}`
      );
    }
    renderOverlay();
  });

  try {
    observer.observe({ entryTypes: ['longtask'] });
    console.info('[PERF:LongTask] Monitor started — watching for main-thread stalls >50ms.');
  } catch (e) {
    console.warn('[PERF:LongTask] Failed to start observer:', e);
  }

  // Named-measure observer — picks up tracedTask() output and surfaces it
  // in the same overlay so "unknown" long tasks can be attributed by name.
  if (PerformanceObserver.supportedEntryTypes?.includes('measure')) {
    const measureObserver = new PerformanceObserver((list) => {
      let dirty = false;
      for (const entry of list.getEntries()) {
        if (entry.duration < TRACE_MIN_MS) continue;
        if (!entry.name.startsWith(TRACE_MARK_PREFIX)) continue;

        // Strip prefix + trailing "#N" counter for readability.
        const raw = entry.name.slice(TRACE_MARK_PREFIX.length);
        const label = raw.replace(/#\d+$/, '');

        recent.push({
          duration: entry.duration,
          startTime: entry.startTime,
          name: 'trace',
          attrNames: [label],
        });
        if (recent.length > MAX_KEEP) recent.shift();
        dirty = true;

        const isFreeze = entry.duration >= 1000;
        const tag = isFreeze ? '[PERF:Trace FREEZE]' : '[PERF:Trace]';
        const method = isFreeze ? 'error' : 'warn';
         
        (console as unknown as Record<string, (...a: unknown[]) => void>)[method](
          `${tag} ${entry.duration.toFixed(0)}ms ← ${label}`
        );
      }
      if (dirty) renderOverlay();
    });
    try {
      measureObserver.observe({ entryTypes: ['measure'] });
    } catch (e) {
      console.warn('[PERF:Trace] Failed to start measure observer:', e);
    }
  }
}

/** Dev helper: clear the recent log + overlay. */
export function resetLongTaskMonitor(): void {
  if (!import.meta.env.DEV) return;
  recent.length = 0;
  renderOverlay();
}
