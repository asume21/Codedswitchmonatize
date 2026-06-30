/**
 * WebNerve browser bridge — captures client-side API latencies, resource timing,
 * and system load, and relays them to the cloud relay.
 *
 * Listens for capture commands from the webnerve relay via SSE,
 * records performance statistics, and posts the report.
 */

declare global {
  interface Window {
    __webnerveStatus?: WebNerveBridgeStatus;
    __webNerve?: {
      startCapture: (durationMs?: number) => Promise<string>;
      getLastCaptureId: () => string | null;
      status: () => 'connected' | 'disconnected' | 'capturing';
    };
  }
  interface Navigator {
    connection?: {
      effectiveType: string;
      rtt: number;
      downlink: number;
      saveData: boolean;
    };
  }
}

const BLOB_URL = (id: string) => `/api/webnerve/blob/${id}`;

type WebNerveBridgeState = 'initializing' | 'connected' | 'disconnected' | 'no-auth' | 'error';

interface WebNerveBridgeStatus {
  state: WebNerveBridgeState;
  message: string;
  updatedAt: number;
}

let sseSource: EventSource | null = null;
let isCapturing = false;
let isConnected = false;
let lastCaptureId: string | null = null;
let resolvedApiKey: string | null = null;
let reconnectTimer: number | null = null;
let reconnectDelayMs = 3000;
let isResolvingKey = false;
let status: WebNerveBridgeStatus = {
  state: 'initializing',
  message: 'WebNerve bridge starting',
  updatedAt: Date.now(),
};

function log(msg: string) {
  console.debug(`[webnerve-bridge] ${msg}`);
}

function setWebNerveStatus(state: WebNerveBridgeState, message: string) {
  status = { state, message, updatedAt: Date.now() };
  window.__webnerveStatus = status;
  window.dispatchEvent(new CustomEvent('webnerve:status', { detail: status }));
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  if (!token) return {};
  return { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` };
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: T | null }> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...getAuthHeaders(),
      ...(init.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => null) as T | null;
  return { ok: res.ok, status: res.status, body };
}

async function resolveWebNerveApiKey(): Promise<string | null> {
  if (resolvedApiKey?.startsWith('wbr_')) return resolvedApiKey;
  if (isResolvingKey) return null;

  isResolvingKey = true;
  try {
    const envKey = import.meta.env.VITE_WEBEAR_API_KEY as string | undefined;
    if (envKey?.startsWith('wbr_')) {
      resolvedApiKey = envKey;
      return resolvedApiKey;
    }

    const revealed = await fetchJson<{ key?: string }>('/api/webear-keys/reveal');
    if (revealed.ok && revealed.body?.key?.startsWith('wbr_')) {
      resolvedApiKey = revealed.body.key;
      return resolvedApiKey;
    }

    if (revealed.status === 401) {
      setWebNerveStatus('no-auth', 'Log in before WebNerve can connect');
      return null;
    }

    setWebNerveStatus('error', `Could not reveal WebNerve key (${revealed.status})`);
    return null;
  } catch (err: any) {
    setWebNerveStatus('error', `Key resolution error: ${err.message}`);
    return null;
  } finally {
    isResolvingKey = false;
  }
}

async function doCapture(captureId: string, durationMs: number): Promise<void> {
  if (isCapturing) return;
  isCapturing = true;
  log(`Starting performance timing capture (${durationMs}ms)...`);

  // Clear resource timings to only measure during this window
  if (typeof performance.clearResourceTimings === 'function') {
    performance.clearResourceTimings();
  }

  const startTime = Date.now();

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  try {
    // Gather resource metrics
    const resourceTimings = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const apiRequests = resourceTimings
      .filter((r) => r.name.includes('/api/'))
      .map((r) => ({
        name: r.name,
        durationMs: r.duration,
        transferSize: r.transferSize,
        decodedBodySize: r.decodedBodySize,
        initiatorType: r.initiatorType,
      }));

    // Estimate storage usage
    let localStorageBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) localStorageBytes += k.length + (localStorage.getItem(k)?.length ?? 0);
    }

    let sessionStorageBytes = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) sessionStorageBytes += k.length + (sessionStorage.getItem(k)?.length ?? 0);
    }

    // Network connection indicators
    const connection = navigator.connection ? {
      effectiveType: navigator.connection.effectiveType,
      rttMs: navigator.connection.rtt,
      downlinkMb: navigator.connection.downlink,
      saveData: navigator.connection.saveData,
    } : null;

    const report = {
      captureId,
      timestamp: Date.now(),
      windowMs: durationMs,
      actualWindowMs: Date.now() - startTime,
      metrics: {
        totalResources: resourceTimings.length,
        apiRequestsCount: apiRequests.length,
        apiRequests,
        storage: {
          localStorageBytes,
          sessionStorageBytes,
        },
        connection,
      },
    };

    const apiKey = await resolveWebNerveApiKey();
    if (!apiKey) throw new Error('No API key available for upload');

    const res = await fetch(BLOB_URL(captureId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(report),
    });

    if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);

    lastCaptureId = captureId;
    log(`WebNerve capture uploaded successfully. Capture ID: ${captureId}`);
  } catch (err: any) {
    console.error('[webnerve-bridge] Capture failed:', err);
  } finally {
    isCapturing = false;
  }
}

async function connectSSE() {
  if (sseSource || isCapturing) return;

  const apiKey = await resolveWebNerveApiKey();
  if (!apiKey) {
    scheduleReconnect();
    return;
  }

  setWebNerveStatus('initializing', 'Connecting to WebNerve relay...');

  const url = `/api/webnerve/connect?key=${encodeURIComponent(apiKey)}`;
  sseSource = new EventSource(url);

  sseSource.addEventListener('connected', () => {
    isConnected = true;
    reconnectDelayMs = 3000;
    setWebNerveStatus('connected', 'WebNerve is connected and tracking api timings');
    log('Connected to WebNerve relay ✓');
  });

  sseSource.addEventListener('capture', (e: MessageEvent) => {
    const { captureId, durationMs } = JSON.parse(e.data);
    doCapture(captureId, durationMs ?? 3000);
  });

  sseSource.onerror = () => {
    isConnected = false;
    setWebNerveStatus('disconnected', 'WebNerve relay disconnected; reconnecting');
    sseSource?.close();
    sseSource = null;
    resolvedApiKey = null;
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectSSE();
  }, reconnectDelayMs);
  reconnectDelayMs = Math.min(30000, reconnectDelayMs * 1.5);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => connectSSE());
  } else {
    connectSSE();
  }

  window.__webNerve = {
    startCapture: async (durationMs) => {
      const id = Math.random().toString(36).substring(2, 10);
      await doCapture(id, durationMs ?? 3000);
      return id;
    },
    getLastCaptureId: () => lastCaptureId,
    status: () => isCapturing ? 'capturing' : isConnected ? 'connected' : 'disconnected',
  };
}
