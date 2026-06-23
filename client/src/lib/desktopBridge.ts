// client/src/lib/desktopBridge.ts

export type BridgeConnectionState = 'disconnected' | 'connecting' | 'syncing' | 'ready' | 'error';

export interface BridgeStats {
  count: number;
  median_ms: number;
  max_ms: number;
  min_ms: number;
}

class DesktopBridge {
  private ws: WebSocket | null = null;
  private _connectionState: BridgeConnectionState = 'disconnected';
  private offset = 0; // serverTime - clientTime
  private stateListeners = new Set<(state: BridgeConnectionState) => void>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private statsResolver: ((stats: BridgeStats) => void) | null = null;
  private tSend = 0;

  get connectionState(): BridgeConnectionState {
    return this._connectionState;
  }

  get isConnected(): boolean {
    return this._connectionState === 'ready';
  }

  private setConnectionState(state: BridgeConnectionState) {
    if (this._connectionState !== state) {
      this._connectionState = state;
      this.stateListeners.forEach(cb => cb(state));
    }
  }

  onStateChange(cb: (state: BridgeConnectionState) => void): () => void {
    this.stateListeners.add(cb);
    // Emit current state immediately
    cb(this._connectionState);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  connect(url = 'ws://127.0.0.1:8765') {
    if (this.ws) {
      this.disconnect();
    }

    this.setConnectionState('connecting');
    console.log(`[DesktopBridge] Connecting to ${url}...`);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[DesktopBridge] WebSocket connected. Starting clock sync...');
        this.setConnectionState('syncing');
        this.syncClock();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[DesktopBridge] Failed to parse message:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[DesktopBridge] WebSocket error:', error);
        this.setConnectionState('error');
      };

      this.ws.onclose = () => {
        console.log('[DesktopBridge] WebSocket disconnected.');
        this.setConnectionState('disconnected');
        this.cleanupSync();
        this.scheduleReconnect(url);
      };
    } catch (e) {
      console.error('[DesktopBridge] Connection attempt failed:', e);
      this.setConnectionState('error');
      this.scheduleReconnect(url);
    }
  }

  disconnect() {
    this.cleanupReconnect();
    this.cleanupSync();
    if (this.ws) {
      // Clear handlers to prevent reconnect loop during manual disconnect
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState('disconnected');
  }

  private syncClock() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.tSend = performance.now();
    this.ws.send(JSON.stringify({ type: 'hello' }));
  }

  private handleMessage(msg: any) {
    if (msg.type === 'welcome') {
      const tRecv = performance.now();
      const clientMid = (this.tSend + tRecv) / 2;
      this.offset = msg.serverTimeMs - clientMid;
      console.log(`[DesktopBridge] Clock sync complete. Offset: ${this.offset.toFixed(2)}ms`);
      this.setConnectionState('ready');

      // Start periodic sync to maintain alignment
      this.setupPeriodicSync();
    } else if (msg.type === 'stats') {
      if (this.statsResolver) {
        this.statsResolver({
          count: msg.count,
          median_ms: msg.median_ms,
          max_ms: msg.max_ms,
          min_ms: msg.min_ms,
        });
        this.statsResolver = null;
      }
    }
  }

  sendNote(instrument: string, playAtClientMs: number, velocity = 1.0) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const serverPlayAtMs = playAtClientMs + this.offset;
    this.ws.send(JSON.stringify({
      type: 'note',
      instrument,
      velocity: Math.max(0.0, Math.min(1.0, velocity)),
      playAtMs: serverPlayAtMs,
    }));
  }

  getStats(): Promise<BridgeStats> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Bridge not connected'));
        return;
      }

      this.statsResolver = resolve;
      this.ws.send(JSON.stringify({ type: 'stats' }));

      // Timeout safety
      setTimeout(() => {
        if (this.statsResolver === resolve) {
          this.statsResolver = null;
          reject(new Error('Stats request timed out'));
        }
      }, 1000);
    });
  }

  private setupPeriodicSync() {
    this.cleanupSync();
    // Re-sync every 30 seconds
    this.syncInterval = setInterval(() => {
      this.syncClock();
    }, 30000);
  }

  private cleanupSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private scheduleReconnect(url: string) {
    this.cleanupReconnect();
    this.reconnectTimeout = setTimeout(() => {
      console.log('[DesktopBridge] Retrying connection...');
      this.connect(url);
    }, 5000);
  }

  private cleanupReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

export const desktopBridge = new DesktopBridge();
