import { ToolTarget } from "../../../shared/schema";

export interface ToolNavigationPayload {
  trackId?: string;
  action?: string;
  params?: Record<string, any>;
}

export interface NavigateToToolOptions {
  toolId: ToolTarget;
  payload?: ToolNavigationPayload;
}

const TOOL_ROUTES: Record<ToolTarget, string> = {
  [ToolTarget.MIX_STUDIO]: "/studio?tab=mix",
  [ToolTarget.BEAT_STUDIO]: "/beat-studio",
  [ToolTarget.PIANO_ROLL]: "/piano-roll",
  [ToolTarget.LYRICS_LAB]: "/studio?tab=lyrics",
  [ToolTarget.UNIFIED_STUDIO]: "/",
};

export const TOOL_NAVIGATION_EVENT = "tool-navigation";
const SESSION_STORAGE_KEY = "pending-tool-navigation";

export function navigateToTool(
  options: NavigateToToolOptions,
  setLocation?: (path: string) => void
): void {
  const { toolId, payload } = options;
  
  const route = TOOL_ROUTES[toolId];
  if (!route) {
    console.error(`Unknown tool ID: ${toolId}`);
    return;
  }

  console.log(`🚀 Navigating to ${toolId} with payload:`, payload);

  if (payload) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      toolId,
      payload,
      timestamp: Date.now(),
    }));

    window.dispatchEvent(
      new CustomEvent(TOOL_NAVIGATION_EVENT, {
        detail: { toolId, payload },
      })
    );
  }

  if (setLocation) {
    setLocation(route);
  } else {
    window.location.href = route;
  }
}

export function getPendingNavigation(): {
  toolId: ToolTarget;
  payload: ToolNavigationPayload;
} | null {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);
    
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - data.timestamp > fiveMinutes) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return {
      toolId: data.toolId,
      payload: data.payload,
    };
  } catch (error) {
    console.error("Failed to parse pending navigation:", error);
    return null;
  }
}

export function clearPendingNavigation(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function setupToolNavigationListener(
  toolId: ToolTarget,
  onNavigate: (payload: ToolNavigationPayload) => void
): () => void {
  const handleEvent = (event: CustomEvent) => {
    if (event.detail.toolId === toolId) {
      onNavigate(event.detail.payload);
      clearPendingNavigation();
    }
  };

  window.addEventListener(TOOL_NAVIGATION_EVENT, handleEvent as EventListener);

  const pending = getPendingNavigation();
  if (pending && pending.toolId === toolId) {
    onNavigate(pending.payload);
    clearPendingNavigation();
  }

  return () => {
    window.removeEventListener(TOOL_NAVIGATION_EVENT, handleEvent as EventListener);
  };
}

export function getToolDisplayName(toolId: ToolTarget): string {
  const displayNames: Record<ToolTarget, string> = {
    [ToolTarget.MIX_STUDIO]: "Mix Studio",
    [ToolTarget.BEAT_STUDIO]: "Beat Studio",
    [ToolTarget.PIANO_ROLL]: "Piano Roll",
    [ToolTarget.LYRICS_LAB]: "Lyrics Lab",
    [ToolTarget.UNIFIED_STUDIO]: "Unified Studio",
  };
  
  return displayNames[toolId] || toolId;
}
