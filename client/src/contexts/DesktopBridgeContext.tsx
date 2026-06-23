// client/src/contexts/DesktopBridgeContext.tsx

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { desktopBridge, BridgeConnectionState, BridgeStats } from '../lib/desktopBridge';

interface DesktopBridgeContextValue {
  isEnabled: boolean;               // feature-flagged
  isActive: boolean;                // user-toggled active state
  connectionState: BridgeConnectionState;
  toggleActive: () => void;
  getStats: () => Promise<BridgeStats>;
}

const DesktopBridgeContext = createContext<DesktopBridgeContextValue | null>(null);

export const useDesktopBridge = () => {
  const ctx = useContext(DesktopBridgeContext);
  if (!ctx) {
    throw new Error('useDesktopBridge must be used within a DesktopBridgeProvider');
  }
  return ctx;
};

export const DesktopBridgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Feature flag check: VITE_ENABLE_DESKTOP_BRIDGE env var must be set to true
  const isEnabled = import.meta.env.VITE_ENABLE_DESKTOP_BRIDGE === 'true';

  // Active state persisted in localStorage
  const [isActive, setIsActive] = useState(() => {
    if (!isEnabled) return false;
    return localStorage.getItem('cs_desktop_bridge_active') === 'true';
  });

  const [connectionState, setConnectionState] = useState<BridgeConnectionState>('disconnected');

  // Sync state changes from the singleton
  useEffect(() => {
    if (!isEnabled) return;

    const unsub = desktopBridge.onStateChange((state) => {
      setConnectionState(state);
    });

    return unsub;
  }, [isEnabled]);

  // Manage connection lifecycle based on isActive
  useEffect(() => {
    if (!isEnabled) {
      desktopBridge.disconnect();
      return;
    }

    if (isActive) {
      desktopBridge.connect();
    } else {
      desktopBridge.disconnect();
    }

    return () => {
      desktopBridge.disconnect();
    };
  }, [isEnabled, isActive]);

  const toggleActive = useCallback(() => {
    if (!isEnabled) return;
    setIsActive(prev => {
      const next = !prev;
      localStorage.setItem('cs_desktop_bridge_active', String(next));
      return next;
    });
  }, [isEnabled]);

  const getStats = useCallback(() => {
    return desktopBridge.getStats();
  }, []);

  const value = React.useMemo(() => ({
    isEnabled,
    isActive,
    connectionState,
    toggleActive,
    getStats,
  }), [isEnabled, isActive, connectionState, toggleActive, getStats]);

  return (
    <DesktopBridgeContext.Provider value={value}>
      {children}
    </DesktopBridgeContext.Provider>
  );
};
