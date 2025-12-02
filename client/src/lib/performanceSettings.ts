export type PerformancePrefs = {
  gpuAcceleration: boolean;
  multiThreading: boolean;
  cacheSize: string; // MB as string to align with existing select values
};

export type PerformanceEnvironment = {
  cores: number | null;
  memoryGB: number | null;
  platform: string | null;
  gpuAvailable: boolean;
  webglAvailable: boolean;
};

export const PERFORMANCE_STORAGE_KEY = "codedswitch-performance";

export const DEFAULT_PERFORMANCE_PREFS: PerformancePrefs = {
  gpuAcceleration: true,
  multiThreading: true,
  cacheSize: "1024",
};

export function detectPerformanceEnvironment(): PerformanceEnvironment {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      cores: null,
      memoryGB: null,
      platform: null,
      gpuAvailable: false,
      webglAvailable: false,
    };
  }

  const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : null;

  const memoryGB =
    typeof navigator !== "undefined" && (navigator as any).deviceMemory
      ? Number((navigator as any).deviceMemory)
      : null;

  const platform = typeof navigator !== "undefined" ? navigator.platform : null;

  const gpuAvailable =
    typeof navigator !== "undefined" &&
    (!!(navigator as any).gpu ||
      typeof (window as any).matchMedia === "function" &&
        (window as any).matchMedia("(prefers-reduced-transparency: no-preference)").matches); // heuristic fallback

  const webglAvailable = (() => {
    try {
      const canvas = document.createElement("canvas");
      return !!(
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
      );
    } catch {
      return false;
    }
  })();

  return {
    cores,
    memoryGB,
    platform,
    gpuAvailable,
    webglAvailable,
  };
}

export function applyPerformanceSettings(prefs: PerformancePrefs) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Persist a lightweight copy just for performance-related consumers
  try {
    localStorage.setItem(PERFORMANCE_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore write failures (e.g., private mode)
  }

  const root = document.documentElement;
  root.dataset.gpuAcceleration = prefs.gpuAcceleration ? "on" : "off";
  root.dataset.multiThreading = prefs.multiThreading ? "on" : "off";
  root.style.setProperty("--cs-cache-size-mb", prefs.cacheSize);

  // Broadcast so other parts of the app (audio engine, workers, etc.) can react.
  window.dispatchEvent(
    new CustomEvent("codedswitch:performance", { detail: prefs })
  );
}

export function loadPerformanceSettings(): PerformancePrefs {
  try {
    const saved = localStorage.getItem(PERFORMANCE_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_PERFORMANCE_PREFS, ...JSON.parse(saved) };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_PERFORMANCE_PREFS;
}
