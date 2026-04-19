import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a function that yields a fresh `AbortSignal` for each call and
 * automatically aborts any in-flight signal when:
 *   1. A new call supersedes the previous one (re-click "Generate" → old request dies).
 *   2. The component unmounts mid-request (modal closed, route changed).
 *
 * Intended for long-running AI generation fetches where the response might
 * outlive the user's patience — cancelling early prevents wasted API credits,
 * dead toasts on unmounted components, and "loading forever" states.
 *
 * Usage:
 *   const getAbortSignal = useAbortableRequest();
 *   const signal = getAbortSignal();
 *   await apiRequest('POST', '/api/ai/generate', body, { signal });
 */
export function useAbortableRequest(): () => AbortSignal {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  // Wrapped in useCallback so consumers can safely put `getAbortSignal` in
  // effect/useCallback dependency arrays without triggering cascade re-renders.
  return useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  }, []);
}

/** Type-guard for AbortError so handlers can silently ignore user-cancelled requests. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
