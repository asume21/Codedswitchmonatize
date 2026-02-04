/**
 * GLOBAL LIVING GLYPH
 * 
 * The main glyph instance that appears in the studio interface.
 * Positioned in a corner, shows overall session state.
 */

import React, { useState, useCallback } from 'react';
import { LivingGlyph } from './LivingGlyph';
import { usePresence, useGlyphState, usePresenceMetrics } from './PresenceContext';
import { GLYPH_STATE_LABELS, GLYPH_STATE_MEANINGS, type GlyphState } from './types';

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

  const positionStyles = {
    'top-left': { top: 16, left: 16 },
    'top-right': { top: 16, right: 16 },
    'bottom-left': { bottom: 16, left: 16 },
    'bottom-right': { bottom: 16, right: 16 },
  };

  const handleClick = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleForceState = useCallback((newState: GlyphState) => {
    forceState(newState, 5000); // Force for 5 seconds
  }, [forceState]);

  return (
    <div
      className="global-living-glyph"
      style={{
        position: 'fixed',
        ...positionStyles[position],
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: position.includes('right') ? 'flex-end' : 'flex-start',
        gap: 8,
      }}
    >
      {/* Main Glyph */}
      <button
        onClick={handleClick}
        className="glyph-button"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          padding: 8,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }}
        title={`${GLYPH_STATE_LABELS[state]} - ${GLYPH_STATE_MEANINGS[state]}`}
      >
        <LivingGlyph
          size={size}
          variant="global"
          debug={showDebug}
        />
      </button>

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
