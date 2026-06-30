/**
 * WebShield browser bridge — captures client-side security policies, TLS state,
 * visible cookie scopes, and sensitive local storage exposure, and relays to the relay.
 *
 * Listens for capture commands from the webshield relay via SSE,
 * gathers client-side security profiles, and posts the report.
 */

declare global {
  interface Window {
    __webshieldStatus?: WebShieldBridgeStatus;
    __webShield?: {
      startCapture: () => Promise<string>;
      getLastCaptureId: () => string | null;
      status: () => 'connected' | 'disconnected' | 'capturing';
    };
  }
}

const BLOB_URL = (id: string) => `/api/webshield/blob/${id}`;

type WebShieldBridgeState = 'initializing' | 'connected' | 'disconnected' | 'no-auth' | 'error';

interface WebShieldBridgeStatus {
  state: WebShieldBridgeState;
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
let status: WebShieldBridgeStatus = {
  state: 'initializing',
  message: 'WebShield bridge starting',
  updatedAt: Date.now(),
};

function log(msg: string) {
  console.debug(`[webshield-bridge] ${msg}`);
}

function setWebShieldStatus(state: WebShieldBridgeState, message: string) {
  status = { state, message, updatedAt: Date.now() };
  window.__webshieldStatus = status;
  window.dispatchEvent(new CustomEvent('webshield:status', { detail: status }));
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

async function resolveWebShieldApiKey(): Promise<string | null> {
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
      setWebShieldStatus('no-auth', 'Log in before WebShield can connect');
      return null;
    }

    setWebShieldStatus('error', `Could not reveal WebShield key (${revealed.status})`);
    return null;
  } catch (err: any) {
    setWebShieldStatus('error', `Key resolution error: ${err.message}`);
    return null;
  } finally {
    isResolvingKey = false;
  }
}

async function doCapture(captureId: string): Promise<void> {
  if (isCapturing) return;
  isCapturing = true;
  log('Gathering client security profile...');

  try {
    // 1. Check for sensitive keys exposed in storage
    const storageRisks: string[] = [];
    const sensitiveRegex = /token|jwt|auth|key|secret|password|private|credential/i;

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && sensitiveRegex.test(k)) {
        storageRisks.push(`localStorage: ${k}`);
      }
    }

    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && sensitiveRegex.test(k)) {
        storageRisks.push(`sessionStorage: ${k}`);
      }
    }

    // 2. Cookie visibility (if we can read cookies via JavaScript, it means they lack HttpOnly flag!)
    const readableCookies: string[] = [];
    if (document.cookie) {
      document.cookie.split(';').forEach((cookie) => {
        const name = cookie.split('=')[0]?.trim();
        if (name) readableCookies.push(name);
      });
    }

    // 3. Iframe context (clickjacking indicator)
    const isFramed = window.self !== window.top;

    // 4. Meta CSP policy
    const metaCspElements = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
    const metaCsps = Array.from(metaCspElements).map((el) => el.getAttribute('content') || '');

    const report = {
      captureId,
      timestamp: Date.now(),
      protocol: window.location.protocol,
      origin: window.location.origin,
      isHttps: window.location.protocol === 'https:',
      security: {
        isFramed,
        metaCsps,
        readableCookies,
        storageRisks,
      },
    };

    const apiKey = await resolveWebShieldApiKey();
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
    log(`WebShield security profile uploaded. Capture ID: ${captureId}`);
  } catch (err: any) {
    console.error('[webshield-bridge] Security capture failed:', err);
  } finally {
    isCapturing = false;
  }
}

async function connectSSE() {
  if (sseSource || isCapturing) return;

  const apiKey = await resolveWebShieldApiKey();
  if (!apiKey) {
    scheduleReconnect();
    return;
  }

  setWebShieldStatus('initializing', 'Connecting to WebShield relay...');

  const url = `/api/webshield/connect?key=${encodeURIComponent(apiKey)}`;
  sseSource = new EventSource(url);

  sseSource.addEventListener('connected', () => {
    isConnected = true;
    reconnectDelayMs = 3000;
    setWebShieldStatus('connected', 'WebShield is active and scanning security parameters');
    log('Connected to WebShield relay ✓');
  });

  sseSource.addEventListener('capture', (e: MessageEvent) => {
    const { captureId } = JSON.parse(e.data);
    doCapture(captureId);
  });

  sseSource.onerror = () => {
    isConnected = false;
    setWebShieldStatus('disconnected', 'WebShield relay disconnected; reconnecting');
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

  window.__webShield = {
    startCapture: async () => {
      const id = Math.random().toString(36).substring(2, 10);
      await doCapture(id);
      return id;
    },
    getLastCaptureId: () => lastCaptureId,
    status: () => isCapturing ? 'capturing' : isConnected ? 'connected' : 'disconnected',
  };
}
