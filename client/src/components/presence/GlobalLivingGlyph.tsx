/**
 * GLOBAL LIVING GLYPH
 * 
 * The main glyph instance that appears in the studio interface.
 * Positioned in a corner, shows overall session state.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LivingGlyph } from './LivingGlyph';
import { usePresence, useGlyphState, usePresenceMetrics } from './PresenceContext';
import { GLYPH_STATE_LABELS, GLYPH_STATE_MEANINGS, type GlyphState } from './types';

const STORAGE_KEY = 'codedswitch-glyph-position';

function loadSavedPosition(): { x: number; y: number } | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function savePosition(x: number, y: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
  } catch {
    // ignore
  }
}

interface GlobalLivingGlyphProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: number;
  showDebug?: boolean;
}

export const GlobalLivingGlyph: React.FC<GlobalLivingGlyphProps> = ({
  position = 'bottom-right',
  size = 48,
  showDebug = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { state } = useGlyphState();
  const { forceState } = usePresence();
  const metrics = usePresenceMetrics();

  const defaultPositions = {
    'top-left': { x: 16, y: 16 },
    'top-right': { x: window.innerWidth - size - 32, y: 16 },
    'bottom-left': { x: 16, y: window.innerHeight - size - 32 },
    'bottom-right': { x: window.innerWidth - size - 32, y: window.innerHeight - size - 32 },
  };

  const saved = loadSavedPosition();
  const [pos, setPos] = useState(saved || defaultPositions[position]);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false, startTime: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const clampPosition = useCallback((x: number, y: number) => {
    const totalSize = size + 16;
    return {
      x: Math.max(0, Math.min(window.innerWidth - totalSize, x)),
      y: Math.max(0, Math.min(window.innerHeight - totalSize, y)),
    };
  }, [size]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      moved: false,
      startTime: Date.now(),
    };
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.moved = true;
    }
    const newPos = clampPosition(
      dragRef.current.startPosX + dx,
      dragRef.current.startPosY + dy
    );
    setPos(newPos);
  }, [isDragging, clampPosition]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const elapsed = Date.now() - dragRef.current.startTime;
    if (!dragRef.current.moved && elapsed < 250) {
      setIsExpanded(prev => !prev);
    } else {
      savePosition(pos.x, pos.y);
    }
  }, [isDragging, pos]);

  useEffect(() => {
    const handleResize = () => {
      setPos(prev => clampPosition(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  const handleForceState = useCallback((newState: GlyphState) => {
    forceState(newState, 5000);
  }, [forceState]);

  const isRight = pos.x > window.innerWidth / 2;

  return (
    <div
      ref={containerRef}
      className="global-living-glyph"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: isRight ? 'flex-end' : 'flex-start',
        gap: 8,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Main Glyph — draggable */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="glyph-button"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${isDragging ? 'rgba(234, 179, 8, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: 12,
          padding: 8,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'border-color 0.2s ease, box-shadow 0.2s ease',
          boxShadow: isDragging
            ? '0 8px 32px rgba(234, 179, 8, 0.2), 0 0 20px rgba(234, 179, 8, 0.1)'
            : '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
        title={`${GLYPH_STATE_LABELS[state]} - ${GLYPH_STATE_MEANINGS[state]}\nDrag to move`}
      >
        <LivingGlyph
          size={size}
          variant="global"
          debug={showDebug}
        />
      </div>

      {/* Expanded Info Panel */}
      {isExpanded && (
        <div
          className="glyph-info-panel"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 12,
            padding: 16,
            minWidth: 200,
            maxWidth: 280,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: 4,
              }}
            >
              Current State
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              {GLYPH_STATE_LABELS[state]}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255, 255, 255, 0.6)',
                marginTop: 2,
              }}
            >
              {GLYPH_STATE_MEANINGS[state]}
            </div>
          </div>

          {/* Pulse Info */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255, 255, 255, 0.4)',
                marginBottom: 4,
              }}
            >
              Pulse
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                gap: 12,
              }}
            >
              <span>{metrics.pulse.mode}</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>•</span>
              <span>{metrics.pulse.frequency.toFixed(1)} Hz</span>
            </div>
          </div>

          {/* Debug Metrics */}
          {showDebug && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'rgba(255, 255, 255, 0.4)',
                  marginBottom: 8,
                }}
              >
                Debug Metrics
              </div>
              <pre
                style={{
                  fontSize: 10,
                  color: 'rgba(255, 255, 255, 0.6)',
                  margin: 0,
                  overflow: 'auto',
                  maxHeight: 150,
                }}
              >
                {JSON.stringify(metrics.metrics, null, 2)}
              </pre>
            </div>
          )}

          {/* State Override Buttons (Debug Only) */}
          {showDebug && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'rgba(255, 255, 255, 0.4)',
                  marginBottom: 8,
                }}
              >
                Force State
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 4,
                }}
              >
                {(['wave', 'quasicrystal', 'breathing-torus', 'spiral-helix', 'superposition', 'honeycomb', 'distortion-light'] as GlyphState[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleForceState(s)}
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      background: state === s ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      borderRadius: 4,
                      color: 'rgba(255, 255, 255, 0.8)',
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Close hint */}
          <div
            style={{
              marginTop: 12,
              fontSize: 10,
              color: 'rgba(255, 255, 255, 0.4)',
              textAlign: 'center',
            }}
          >
            Click glyph to close
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalLivingGlyph;
