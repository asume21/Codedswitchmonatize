// Dev-only render counter + floating HUD.
// Usage: call `useRenderCounter('MyComponent')` at the top of a component.
// In production builds, Vite dead-strips the DEV branch — zero runtime cost.

import { useRef } from 'react';

interface RenderStats {
  name: string;
  count: number;
  lastReset: number;
}

const registry = new Map<string, RenderStats>();
let overlayEl: HTMLElement | null = null;
let overlayTimer: number | null = null;

function ensureOverlay(): void {
  if (typeof document === 'undefined') return;
  if (overlayEl) return;

  overlayEl = document.createElement('div');
  overlayEl.id = '__render-counter-overlay';
  Object.assign(overlayEl.style, {
    position: 'fixed',
    top: '8px',
    right: '8px',
    zIndex: '999999',
    background: 'rgba(0,0,0,0.85)',
    color: '#7fff7f',
    font: '11px/1.3 ui-monospace, Menlo, monospace',
    padding: '6px 10px',
    borderRadius: '4px',
    pointerEvents: 'none',
    maxWidth: '320px',
    whiteSpace: 'pre',
    border: '1px solid rgba(127,255,127,0.35)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
  });
  document.body.appendChild(overlayEl);

  overlayTimer = window.setInterval(() => {
    if (!overlayEl) return;
    const now = performance.now();
    const rows = Array.from(registry.values())
      .map((s) => {
        const elapsed = Math.max(0.001, (now - s.lastReset) / 1000);
        return { name: s.name, rps: s.count / elapsed };
      })
      .sort((a, b) => b.rps - a.rps)
      .slice(0, 14)
      .map(({ name, rps }) => {
        // Color by severity: >10/s = red, 3–10 = yellow, <3 = green
        const color = rps >= 10 ? '#ff7f7f' : rps >= 3 ? '#ffcf5f' : '#7fff7f';
        return `<span style="color:${color}">${rps.toFixed(1).padStart(5)}/s</span>  ${name}`;
      })
      .join('\n');
    overlayEl.innerHTML = `<span style="color:#fff;font-weight:bold">Renders / sec</span>\n${'─'.repeat(24)}\n${rows || '<span style="color:#888">(no instrumented components)</span>'}`;

    // Reset counters for the next window
    for (const s of registry.values()) {
      s.count = 0;
      s.lastReset = now;
    }
  }, 1000);
}

// Gate the whole hook behind localStorage.perf-debug. Computed ONCE at module
// load; toggling the flag requires a page reload. Keeps the rules-of-hooks
// invariant (useRef still called every render) while making the body a no-op
// for normal users — no overlay, no registry growth, no DOM churn.
const PERF_DEBUG_ENABLED =
  typeof localStorage !== 'undefined' &&
  localStorage.getItem('perf-debug') === '1';

export function useRenderCounter(name: string): void {
  // useRef must be called every render per Rules of Hooks.
  // `import.meta.env.DEV` is a compile-time constant — Vite dead-strips the
  // DEV block in production builds, so the whole body is a no-op in prod.
  const statsRef = useRef<RenderStats | null>(null);

  if (import.meta.env.DEV && PERF_DEBUG_ENABLED) {
    if (!statsRef.current) {
      ensureOverlay();
      const existing = registry.get(name);
      if (existing) {
        statsRef.current = existing;
      } else {
        statsRef.current = { name, count: 0, lastReset: performance.now() };
        registry.set(name, statsRef.current);
      }
    }
    statsRef.current.count += 1;
  }
}

/** Dev helper: clear all render stats. Useful between test scenarios. */
export function resetRenderCounters(): void {
  if (!import.meta.env.DEV) return;
  const now = performance.now();
  for (const s of registry.values()) {
    s.count = 0;
    s.lastReset = now;
  }
}

/** Dev helper: tear down the overlay entirely. */
export function disposeRenderCounterOverlay(): void {
  if (!import.meta.env.DEV) return;
  if (overlayTimer !== null) {
    window.clearInterval(overlayTimer);
    overlayTimer = null;
  }
  if (overlayEl && overlayEl.parentNode) {
    overlayEl.parentNode.removeChild(overlayEl);
  }
  overlayEl = null;
  registry.clear();
}
