/**
 * GLYPH ANIMATOR
 * 
 * The visual representation of the Living Glyph with 6 collapsed states
 * plus the Wave state. Uses SVG for geometry and CSS for animations.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type {
  GlyphState,
  PulseParameters,
  AIOverlay,
  LivingGlyphProps,
} from './types';
import { GLYPH_STATE_LABELS, GLYPH_STATE_MEANINGS } from './types';

/** Animation configuration for each state */
const STATE_CONFIG: Record<GlyphState, {
  hue: number;
  saturation: number;
  glowIntensity: number;
  geometryStability: number;
  pulseBase: number;
}> = {
  'wave': {
    hue: 260,
    saturation: 60,
    glowIntensity: 0.3,
    geometryStability: 0,
    pulseBase: 0.8,
  },
  'quasicrystal': {
    hue: 45,
    saturation: 90,
    glowIntensity: 0.7,
    geometryStability: 0.8,
    pulseBase: 1.2,
  },
  'breathing-torus': {
    hue: 180,
    saturation: 80,
    glowIntensity: 0.6,
    geometryStability: 0.9,
    pulseBase: 1.0,
  },
  'spiral-helix': {
    hue: 320,
    saturation: 100,
    glowIntensity: 0.9,
    geometryStability: 0.85,
    pulseBase: 2.5,
  },
  'superposition': {
    hue: 200,
    saturation: 50,
    glowIntensity: 0.5,
    geometryStability: 0.4,
    pulseBase: 1.1,
  },
  'honeycomb': {
    hue: 35,
    saturation: 100,
    glowIntensity: 0.8,
    geometryStability: 0.95,
    pulseBase: 1.3,
  },
  'distortion-light': {
    hue: 280,
    saturation: 40,
    glowIntensity: 1.0,
    geometryStability: 1.0,
    pulseBase: 0.4,
  },
};

export const LivingGlyph: React.FC<LivingGlyphProps> = ({
  size = 64,
  variant = 'global',
  className = '',
  onStateChange,
  debug = false,
}) => {
  const [state, setState] = useState<GlyphState>('wave');
  const [pulseParams, setPulseParams] = useState<PulseParameters>({
    frequency: 1,
    amplitude: 0.3,
    brightness: 0.5,
    mode: 'slow',
  });
  const [aiOverlay, setAiOverlay] = useState<AIOverlay>('idle');
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number | null>(null);
  const pulsePhaseRef = useRef(0);
  
  // Get current config based on state
  const config = STATE_CONFIG[state];
  
  // Calculate dynamic styles based on pulse parameters
  const pulseScale = 1 + (pulseParams.amplitude * 0.2 * Math.sin(pulsePhaseRef.current));
  const glowOpacity = config.glowIntensity * pulseParams.brightness;
  
  // Animation loop
  useEffect(() => {
    let lastTime = performance.now();
    
    const animate = (time: number) => {
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;
      
      // Update pulse phase
      pulsePhaseRef.current += deltaTime * pulseParams.frequency * Math.PI * 2;
      
      // Trigger re-render for smooth animation
      if (svgRef.current) {
        svgRef.current.style.setProperty('--pulse-phase', pulsePhaseRef.current.toString());
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [pulseParams.frequency]);

  // Handle state change with transition
  const handleStateChange = useCallback((newState: GlyphState, reason?: string) => {
    if (newState === state) return;
    
    setIsTransitioning(true);
    
    // Transition effect
    setTimeout(() => {
      const previousState = state;
      setState(newState);
      setIsTransitioning(false);
      
      if (onStateChange) {
        onStateChange(newState, previousState);
      }
      
      console.log(`[LivingGlyph] ${variant}: ${previousState} → ${newState}${reason ? ` (${reason})` : ''}`);
    }, 150);
  }, [state, variant, onStateChange]);

  // Expose state change handler via window for PresenceEngine integration
  useEffect(() => {
    const handleEngineStateChange = (event: CustomEvent<{ state: GlyphState; previousState: GlyphState; reason: string }>) => {
      handleStateChange(event.detail.state, event.detail.reason);
    };
    
    const handlePulseUpdate = (event: CustomEvent<{ parameters: PulseParameters }>) => {
      setPulseParams(event.detail.parameters);
    };
    
    const handleAIOverlay = (event: CustomEvent<{ overlay: AIOverlay }>) => {
      setAiOverlay(event.detail.overlay);
    };
    
    window.addEventListener('presence:state-change' as any, handleEngineStateChange);
    window.addEventListener('presence:pulse-update' as any, handlePulseUpdate);
    window.addEventListener('presence:ai-overlay' as any, handleAIOverlay);
    
    return () => {
      window.removeEventListener('presence:state-change' as any, handleEngineStateChange);
      window.removeEventListener('presence:pulse-update' as any, handlePulseUpdate);
      window.removeEventListener('presence:ai-overlay' as any, handleAIOverlay);
    };
  }, [handleStateChange]);

  // Render the appropriate geometry based on state
  const renderGeometry = () => {
    const center = size / 2;
    const baseRadius = size * 0.35;
    
    switch (state) {
      case 'wave':
        return renderWaveGeometry(center, baseRadius);
      case 'quasicrystal':
        return renderQuasicrystalGeometry(center, baseRadius);
      case 'breathing-torus':
        return renderBreathingTorusGeometry(center, baseRadius);
      case 'spiral-helix':
        return renderSpiralHelixGeometry(center, baseRadius);
      case 'superposition':
        return renderSuperpositionGeometry(center, baseRadius);
      case 'honeycomb':
        return renderHoneycombGeometry(center, baseRadius);
      case 'distortion-light':
        return renderDistortionLightGeometry(center, baseRadius);
      default:
        return renderWaveGeometry(center, baseRadius);
    }
  };

  // WAVE STATE: Drifting geometry, soft shimmer, low pulse
  const renderWaveGeometry = (center: number, radius: number) => {
    const points: string[] = [];
    const numPoints = 12;
    const time = pulsePhaseRef.current * 0.5;
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const waveOffset = Math.sin(angle * 3 + time) * radius * 0.2;
      const r = radius + waveOffset;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      points.push(`${x},${y}`);
    }
    
    return (
      <g className="glyph-wave">
        <polygon
          points={points.join(' ')}
          fill={`hsla(${config.hue}, ${config.saturation}%, 50%, 0.2)`}
          stroke={`hsla(${config.hue}, ${config.saturation}%, 70%, 0.6)`}
          strokeWidth="1"
          className="animate-pulse-slow"
        />
        {[0.6, 0.4, 0.2].map((scale, i) => (
          <polygon
            key={i}
            points={points.map((p, idx) => {
              const [x, y] = p.split(',').map(Number);
              const dx = x - center;
              const dy = y - center;
              return `${center + dx * scale},${center + dy * scale}`;
            }).join(' ')}
            fill="none"
            stroke={`hsla(${config.hue}, ${config.saturation}%, 70%, ${0.3 - i * 0.1})`}
            strokeWidth="0.5"
            style={{
              animation: `drift ${3 + i}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </g>
    );
  };

  // QUASICRYSTAL HEART: Exploration - crystalline, faceted
  const renderQuasicrystalGeometry = (center: number, radius: number) => {
    const polygons: JSX.Element[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
    const numPetals = 8;
    
    // Central core
    polygons.push(
      <polygon
        key="core"
        points={Array.from({ length: 6 }, (_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const r = radius * 0.3;
          return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
        }).join(' ')}
        fill={`hsla(${config.hue}, ${config.saturation}%, 55%, 0.8)`}
        stroke={`hsla(${config.hue}, ${config.saturation}%, 80%, 0.9)`}
        strokeWidth="1"
      />
    );
    
    // Radiating crystalline petals
    for (let i = 0; i < numPetals; i++) {
      const angle = i * goldenAngle;
      const petalRadius = radius * (0.5 + Math.sin(pulsePhaseRef.current + i) * 0.1);
      const x1 = center + Math.cos(angle) * radius * 0.3;
      const y1 = center + Math.sin(angle) * radius * 0.3;
      const x2 = center + Math.cos(angle - 0.3) * petalRadius;
      const y2 = center + Math.sin(angle - 0.3) * petalRadius;
      const x3 = center + Math.cos(angle + 0.3) * petalRadius;
      const y3 = center + Math.sin(angle + 0.3) * petalRadius;
      
      polygons.push(
        <polygon
          key={`petal-${i}`}
          points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
          fill={`hsla(${config.hue + i * 10}, ${config.saturation}%, 60%, ${0.4 + Math.sin(pulsePhaseRef.current + i * 0.5) * 0.2})`}
          stroke={`hsla(${config.hue}, ${config.saturation}%, 80%, 0.6)`}
          strokeWidth="0.5"
          style={{
            transformOrigin: `${center}px ${center}px`,
            animation: `crystal-pulse ${2 + i * 0.2}s ease-in-out infinite`,
          }}
        />
      );
    }
    
    return <g className="glyph-quasicrystal">{polygons}</g>;
  };

  // BREATHING TORUS: Steady flow - smooth, rhythmic expansion/contraction
  const renderBreathingTorusGeometry = (center: number, radius: number) => {
    const breathScale = 1 + Math.sin(pulsePhaseRef.current * 0.8) * 0.15;
    
    return (
      <g className="glyph-breathing-torus">
        {/* Outer ring */}
        <circle
          cx={center}
          cy={center}
          r={radius * breathScale}
          fill="none"
          stroke={`hsla(${config.hue}, ${config.saturation}%, 60%, 0.8)`}
          strokeWidth="3"
          style={{
            filter: `drop-shadow(0 0 ${10 * glowOpacity}px hsla(${config.hue}, ${config.saturation}%, 60%, 0.5))`,
          }}
        />
        {/* Inner ring */}
        <circle
          cx={center}
          cy={center}
          r={radius * 0.6 * breathScale}
          fill="none"
          stroke={`hsla(${config.hue}, ${config.saturation}%, 70%, 0.6)`}
          strokeWidth="2"
        />
        {/* Core */}
        <circle
          cx={center}
          cy={center}
          r={radius * 0.25 * breathScale}
          fill={`hsla(${config.hue}, ${config.saturation}%, 55%, 0.5)`}
          stroke={`hsla(${config.hue}, ${config.saturation}%, 80%, 0.8)`}
          strokeWidth="1"
        />
        {/* Breathing dots */}
        {Array.from({ length: 6 }, (_, i) => {
          const angle = (i / 6) * Math.PI * 2 + pulsePhaseRef.current * 0.3;
          const dotRadius = radius * (0.4 + Math.sin(pulsePhaseRef.current + i) * 0.1);
          return (
            <circle
              key={i}
              cx={center + Math.cos(angle) * dotRadius * breathScale}
              cy={center + Math.sin(angle) * dotRadius * breathScale}
              r={3}
              fill={`hsla(${config.hue}, ${config.saturation}%, 80%, 0.9)`}
            />
          );
        })}
      </g>
    );
  };

  // SPIRAL-HELIX: Momentum - energetic, swirling
  const renderSpiralHelixGeometry = (center: number, radius: number) => {
    const spirals: JSX.Element[] = [];
    const numArms = 3;
    const rotationSpeed = pulseParams.frequency * 0.5;
    
    for (let arm = 0; arm < numArms; arm++) {
      const armAngle = (arm / numArms) * Math.PI * 2 + pulsePhaseRef.current * rotationSpeed;
      const points: string[] = [];
      
      for (let t = 0; t <= 20; t++) {
        const r = (t / 20) * radius;
        const angle = armAngle + (t / 5);
        const x = center + Math.cos(angle) * r;
        const y = center + Math.sin(angle) * r;
        points.push(`${x},${y}`);
      }
      
      spirals.push(
        <polyline
          key={`spiral-${arm}`}
          points={points.join(' ')}
          fill="none"
          stroke={`hsla(${config.hue + arm * 15}, ${config.saturation}%, ${60 + arm * 10}%, 0.9)`}
          strokeWidth={3 - arm * 0.5}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 ${8 * glowOpacity}px hsla(${config.hue}, ${config.saturation}%, 60%, 0.6))`,
          }}
        />
      );
    }
    
    // Central vortex
    spirals.push(
      <circle
        key="vortex"
        cx={center}
        cy={center}
        r={radius * 0.15}
        fill={`hsla(${config.hue}, ${config.saturation}%, 70%, 0.9)`}
        style={{
          animation: 'spin 1s linear infinite',
        }}
      />
    );
    
    return <g className="glyph-spiral-helix">{spirals}</g>;
  };

  // SUPERPOSITION: Ambiguity - overlapping, uncertain states
  const renderSuperpositionGeometry = (center: number, radius: number) => {
    const blur = 2 + Math.sin(pulsePhaseRef.current) * 1;
    
    return (
      <g className="glyph-superposition">
        {/* Overlapping circles representing possible states */}
        {[
          { offset: -0.3, opacity: 0.4, hue: config.hue - 20 },
          { offset: 0, opacity: 0.6, hue: config.hue },
          { offset: 0.3, opacity: 0.4, hue: config.hue + 20 },
        ].map((config2, i) => (
          <ellipse
            key={i}
            cx={center + config2.offset * radius * 0.3}
            cy={center}
            rx={radius * (0.7 + Math.sin(pulsePhaseRef.current + i) * 0.1)}
            ry={radius * (0.5 + Math.cos(pulsePhaseRef.current + i * 0.7) * 0.1)}
            fill={`hsla(${config2.hue}, ${config.saturation}%, 50%, ${config2.opacity})`}
            stroke={`hsla(${config2.hue}, ${config.saturation}%, 70%, 0.5)`}
            strokeWidth="1"
            style={{
              filter: `blur(${blur}px)`,
              mixBlendMode: 'screen',
            }}
          />
        ))}
        {/* Central interference pattern */}
        <circle
          cx={center}
          cy={center}
          r={radius * 0.2}
          fill={`hsla(${config.hue}, ${config.saturation}%, 80%, 0.8)`}
          style={{
            animation: 'pulse-opacity 2s ease-in-out infinite',
          }}
        />
      </g>
    );
  };

  // HONEYCOMB SINGULARITY: Collaboration - interconnected hexagons
  const renderHoneycombGeometry = (center: number, radius: number) => {
    const hexagons: JSX.Element[] = [];
    const hexRadius = radius * 0.25;
    
    // Central hexagon
    hexagons.push(renderHexagon(center, center, hexRadius, config.hue, 0));
    
    // Surrounding hexagons
    for (let ring = 1; ring <= 2; ring++) {
      const count = ring === 1 ? 6 : 12;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (ring === 2 ? Math.PI / count : 0);
        const distance = hexRadius * (ring === 1 ? 2 : 3.8);
        const x = center + Math.cos(angle) * distance;
        const y = center + Math.sin(angle) * distance;
        const hue = config.hue + i * 5;
        const phase = pulsePhaseRef.current + i * 0.3;
        
        hexagons.push(renderHexagon(x, y, hexRadius * 0.8, hue, phase));
      }
    }
    
    // Connection lines
    const lines: JSX.Element[] = [];
    // Add subtle connection lines between hexagons
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x1 = center + Math.cos(angle) * hexRadius * 0.8;
      const y1 = center + Math.sin(angle) * hexRadius * 0.8;
      const x2 = center + Math.cos(angle) * hexRadius * 2;
      const y2 = center + Math.sin(angle) * hexRadius * 2;
      
      lines.push(
        <line
          key={`conn-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={`hsla(${config.hue}, ${config.saturation}%, 60%, 0.4)`}
          strokeWidth="1"
          style={{
            animation: `pulse-opacity ${1.5 + i * 0.1}s ease-in-out infinite`,
          }}
        />
      );
    }
    
    return (
      <g className="glyph-honeycomb">
        {lines}
        {hexagons}
      </g>
    );
  };

  // Helper to render a single hexagon
  const renderHexagon = (cx: number, cy: number, r: number, hue: number, phase: number) => {
    const points = Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
    }).join(' ');
    
    return (
      <polygon
        key={`${cx}-${cy}`}
        points={points}
        fill={`hsla(${hue}, ${config.saturation}%, 50%, ${0.3 + Math.sin(phase) * 0.2})`}
        stroke={`hsla(${hue}, ${config.saturation}%, 70%, 0.8)`}
        strokeWidth="1.5"
        style={{
          filter: `drop-shadow(0 0 ${5 * glowOpacity}px hsla(${hue}, ${config.saturation}%, 60%, 0.4))`,
        }}
      />
    );
  };

  // DISTORTION-LIGHT: Deep presence - stable but distorted glow
  const renderDistortionLightGeometry = (center: number, radius: number) => {
    const distortion = Math.sin(pulsePhaseRef.current * 0.3) * 0.05;
    
    return (
      <g className="glyph-distortion-light">
        {/* Outer glow */}
        <circle
          cx={center}
          cy={center}
          r={radius * (1.2 + distortion)}
          fill={`radial-gradient(circle, hsla(${config.hue}, ${config.saturation}%, 50%, 0.3) 0%, transparent 70%)`}
          style={{
            filter: `blur(${15 * glowOpacity}px)`,
          }}
        />
        {/* Core with chromatic aberration effect */}
        {[
          { offset: -2, hue: config.hue - 30, opacity: 0.5 },
          { offset: 0, hue: config.hue, opacity: 0.8 },
          { offset: 2, hue: config.hue + 30, opacity: 0.5 },
        ].map((cfg, i) => (
          <circle
            key={i}
            cx={center + cfg.offset}
            cy={center}
            r={radius * (0.5 - i * 0.1)}
            fill={`hsla(${cfg.hue}, ${config.saturation}%, 60%, ${cfg.opacity})`}
            style={{
              mixBlendMode: 'screen',
              filter: `blur(${i === 1 ? 0 : 2}px)`,
            }}
          />
        ))}
        {/* Sharp core */}
        <circle
          cx={center}
          cy={center}
          r={radius * 0.2}
          fill={`hsla(${config.hue}, ${config.saturation}%, 90%, 1)`}
          style={{
            filter: `drop-shadow(0 0 ${20 * glowOpacity}px hsla(${config.hue}, ${config.saturation}%, 80%, 0.8))`,
          }}
        />
      </g>
    );
  };

  return (
    <div
      className={`living-glyph living-glyph--${variant} living-glyph--${state} ${className}`}
      style={{
        width: size,
        height: size,
        position: 'relative',
      }}
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={`glyph-svg ${isTransitioning ? 'transitioning' : ''}`}
        style={{
          transform: `scale(${pulseScale})`,
          transition: 'transform 0.15s ease-out',
        }}
      >
        {/* Glow filter */}
        <defs>
          <filter id={`glow-${variant}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={4 * glowOpacity} result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* AI overlay gradient */}
          {aiOverlay !== 'idle' && (
            <radialGradient id={`ai-glow-${variant}`} cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={aiOverlay === 'generating' ? 'hsla(60, 100%, 70%, 0.8)' : 'hsla(200, 100%, 70%, 0.6)'}
              />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          )}
        </defs>
        
        {/* Main geometry */}
        <g filter={`url(#glow-${variant})`}>
          {renderGeometry()}
        </g>
        
        {/* AI overlay */}
        {aiOverlay !== 'idle' && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.4}
            fill={`url(#ai-glow-${variant})`}
            style={{
              animation: aiOverlay === 'generating' ? 'micro-pulse 0.2s ease-in-out infinite' : 'none',
            }}
          />
        )}
      </svg>
      
      {/* Debug overlay */}
      {debug && (
        <div
          className="glyph-debug"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            fontSize: 10,
            color: `hsl(${config.hue}, ${config.saturation}%, 70%)`,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            zIndex: 100,
          }}
        >
          <div>{GLYPH_STATE_LABELS[state]}</div>
          <div>{pulseParams.mode} | {pulseParams.frequency.toFixed(1)}Hz</div>
          {aiOverlay !== 'idle' && <div>AI: {aiOverlay}</div>}
        </div>
      )}
      
      {/* Tooltip on hover */}
      <div
        className="glyph-tooltip"
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.8)',
          color: `hsl(${config.hue}, ${config.saturation}%, 80%)`,
          fontSize: 11,
          borderRadius: 4,
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.2s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.opacity = '0';
        }}
      >
        {GLYPH_STATE_MEANINGS[state]}
      </div>
    </div>
  );
};

export default LivingGlyph;
