/**
 * WebLog browser bridge — intercepts console history (log/warn/error),
 * captures uncaught exceptions, collects application state dumps, and relays to cloud.
 *
 * Listens for capture commands from the weblog relay via SSE,
 * bundles captured logs and status reports, and posts the report.
 */

declare global {
  interface Window {
    __weblogStatus?: WebLogBridgeStatus;
    __webLog?: {
      startCapture: (durationMs?: number) => Promise<string>;
      getLastCaptureId: () => string | null;
      status: () => 'connected' | 'disconnected' | 'capturing';
      getLogs: () => ConsoleLogEntry[];
    };
  }
}

interface ConsoleLogEntry {
  type: 'log' | 'warn' | 'error' | 'exception';
  message: string;
  timestamp: number;
}

const BLOB_URL = (id: string) => `/api/weblog/blob/${id}`;

type WebLogBridgeState = 'initializing' | 'connected' | 'disconnected' | 'no-auth' | 'error';

interface WebLogBridgeStatus {
  state: WebLogBridgeState;
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
let status: WebLogBridgeStatus = {
  state: 'initializing',
  message: 'WebLog bridge starting',
  updatedAt: Date.now(),
};

const logBuffer: ConsoleLogEntry[] = [];
const MAX_LOGS = 100;

function log(msg: string) {
  console.debug(`[weblog-bridge] ${msg}`);
}

function pushLog(type: ConsoleLogEntry['type'], args: any[]) {
  const message = args.map((arg) => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  logBuffer.push({ type, message, timestamp: Date.now() });
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }
}

// ── Monkey-Patch Console ──────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = function (...args: any[]) {
    originalLog.apply(console, args);
    pushLog('log', args);
  };

  console.warn = function (...args: any[]) {
    originalWarn.apply(console, args);
    pushLog('warn', args);
  };

  console.error = function (...args: any[]) {
    originalError.apply(console, args);
    pushLog('error', args);
  };

  window.addEventListener('error', (e) => {
    pushLog('exception', [`Uncaught Exception: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`]);
  });

  window.addEventListener('unhandledrejection', (e) => {
    pushLog('exception', [`Unhandled Rejection: ${String(e.reason)}`]);
  });
}

function setWebLogStatus(state: WebLogBridgeState, message: string) {
  status = { state, message, updatedAt: Date.now() };
  window.__weblogStatus = status;
  window.dispatchEvent(new CustomEvent('weblog:status', { detail: status }));
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

async function resolveWebLogApiKey(): Promise<string | null> {
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
      setWebLogStatus('no-auth', 'Log in before WebLog can connect');
      return null;
    }

    setWebLogStatus('error', `Could not reveal WebLog key (${revealed.status})`);
    return null;
  } catch (err: any) {
    setWebLogStatus('error', `Key resolution error: ${err.message}`);
    return null;
  } finally {
    isResolvingKey = false;
  }
}

async function doCapture(captureId: string, durationMs: number): Promise<void> {
  if (isCapturing) return;
  isCapturing = true;
  log(`Recording console logs & state over next ${durationMs}ms...`);

  // Clear or note start boundary
  const captureStartTime = Date.now();

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  try {
    // Collect console entries recorded during/up to this point
    const recentLogs = logBuffer.filter((l) => l.timestamp >= captureStartTime - 30_000); // include 30s history

    // App state snapshot indicators
    const audioState = (window as any).__audioDebug?.status?.() || 'unknown';
    const isPlaying = (window as any).Tone?.Transport?.state === 'started';
    const activeBpm = (window as any).Tone?.Transport?.bpm?.value || 120;

    const report = {
      captureId,
      timestamp: Date.now(),
      durationMs,
      logs: recentLogs,
      stateSnapshot: {
        audioState,
        isPlaying,
        activeBpm,
      },
    };

    const apiKey = await resolveWebLogApiKey();
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
    log(`WebLog diagnostics snapshot uploaded. Capture ID: ${captureId}`);
  } catch (err: any) {
    console.error('[weblog-bridge] Console capture failed:', err);
  } finally {
    isCapturing = false;
  }
}

async function connectSSE() {
  if (sseSource || isCapturing) return;

  const apiKey = await resolveWebLogApiKey();
  if (!apiKey) {
    scheduleReconnect();
    return;
  }

  setWebLogStatus('initializing', 'Connecting to WebLog relay...');

  const url = `/api/weblog/connect?key=${encodeURIComponent(apiKey)}`;
  sseSource = new EventSource(url);

  sseSource.addEventListener('connected', () => {
    isConnected = true;
    reconnectDelayMs = 3000;
    setWebLogStatus('connected', 'WebLog is active and listening to console outputs');
    log('Connected to WebLog relay ✓');
  });

  sseSource.addEventListener('capture', (e: MessageEvent) => {
    const { captureId, durationMs } = JSON.parse(e.data);
    doCapture(captureId, durationMs ?? 3000);
  });

  sseSource.onerror = () => {
    isConnected = false;
    setWebLogStatus('disconnected', 'WebLog relay disconnected; reconnecting');
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

  window.__webLog = {
    startCapture: async (durationMs) => {
      const id = Math.random().toString(36).substring(2, 10);
      await doCapture(id, durationMs ?? 3000);
      return id;
    },
    getLastCaptureId: () => lastCaptureId,
    status: () => isCapturing ? 'capturing' : isConnected ? 'connected' : 'disconnected',
    getLogs: () => logBuffer,
  };
}
