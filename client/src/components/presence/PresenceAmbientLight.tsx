/**
 * PRESENCE AMBIENT LIGHT
 * 
 * Connects the Living Glyph presence system to the global UI ambient lighting.
 * Listens for presence:state-change and presence:pulse-update events and sets
 * CSS custom properties on the document root so the entire UI's warm glow
 * morphs, breathes, and shifts in sync with the glyph state.
 * 
 * The effect: light that feels like it comes from nowhere and everywhere,
 * connected to the living presence of the app.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { GlyphState, PulseParameters } from './types';

interface AmbientConfig {
  warmHue: number;
  warmSaturation: number;
  warmLightness: number;
  glowIntensity: number;
  pulseSpeed: number;
  secondaryHue: number;
}

const STATE_AMBIENT_CONFIG: Record<GlyphState, AmbientConfig> = {
  'wave': {
    warmHue: 45,
    warmSaturation: 90,
    warmLightness: 55,
    glowIntensity: 0.3,
    pulseSpeed: 0.8,
    secondaryHue: 30,
  },
  'quasicrystal': {
    warmHue: 42,
    warmSaturation: 95,
    warmLightness: 58,
    glowIntensity: 0.6,
    pulseSpeed: 1.2,
    secondaryHue: 25,
  },
  'breathing-torus': {
    warmHue: 48,
    warmSaturation: 85,
    warmLightness: 52,
    glowIntensity: 0.5,
    pulseSpeed: 1.0,
    secondaryHue: 35,
  },
  'spiral-helix': {
    warmHue: 38,
    warmSaturation: 100,
    warmLightness: 60,
    glowIntensity: 0.8,
    pulseSpeed: 2.0,
    secondaryHue: 20,
  },
  'superposition': {
    warmHue: 50,
    warmSaturation: 70,
    warmLightness: 50,
    glowIntensity: 0.4,
    pulseSpeed: 1.1,
    secondaryHue: 40,
  },
  'honeycomb': {
    warmHue: 40,
    warmSaturation: 100,
    warmLightness: 62,
    glowIntensity: 0.7,
    pulseSpeed: 1.3,
    secondaryHue: 28,
  },
  'distortion-light': {
    warmHue: 44,
    warmSaturation: 80,
    warmLightness: 65,
    glowIntensity: 0.9,
    pulseSpeed: 0.4,
    secondaryHue: 32,
  },
};

export function PresenceAmbientLight() {
  const stateRef = useRef<GlyphState>('wave');
  const pulseRef = useRef<PulseParameters>({
    frequency: 1,
    amplitude: 0.3,
    brightness: 0.5,
    mode: 'slow',
  });
  const phaseRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const updateCSSVars = useCallback(() => {
    const config = STATE_AMBIENT_CONFIG[stateRef.current];
    const pulse = pulseRef.current;
    const phase = phaseRef.current;

    const breathe = Math.sin(phase) * 0.5 + 0.5;
    const intensity = config.glowIntensity * pulse.brightness;
    const dynamicIntensity = intensity * (0.7 + breathe * 0.3);

    const root = document.documentElement;

    root.style.setProperty('--presence-warm-hue', `${config.warmHue}`);
    root.style.setProperty('--presence-warm-sat', `${config.warmSaturation}%`);
    root.style.setProperty('--presence-warm-light', `${config.warmLightness}%`);
    root.style.setProperty('--presence-glow-intensity', `${dynamicIntensity.toFixed(3)}`);
    root.style.setProperty('--presence-glow-opacity', `${(dynamicIntensity * 0.12).toFixed(3)}`);
    root.style.setProperty('--presence-border-opacity', `${(dynamicIntensity * 0.5).toFixed(3)}`);
    root.style.setProperty('--presence-inset-opacity', `${(dynamicIntensity * 0.08).toFixed(3)}`);
    root.style.setProperty('--presence-grid-opacity', `${(0.04 + dynamicIntensity * 0.06).toFixed(3)}`);
    root.style.setProperty('--presence-secondary-hue', `${config.secondaryHue}`);
    root.style.setProperty('--presence-pulse-speed', `${config.pulseSpeed}s`);

    const warmColor = `hsla(${config.warmHue}, ${config.warmSaturation}%, ${config.warmLightness}%,`;
    root.style.setProperty('--presence-warm-glow', `${warmColor} ${(dynamicIntensity * 0.3).toFixed(3)})`);
    root.style.setProperty('--presence-warm-border', `${warmColor} ${(dynamicIntensity * 0.5).toFixed(3)})`);
    root.style.setProperty('--presence-warm-inset', `${warmColor} ${(dynamicIntensity * 0.06).toFixed(3)})`);
    root.style.setProperty('--presence-warm-grid', `${warmColor} ${(dynamicIntensity * 0.15).toFixed(3)})`);
  }, []);

  useEffect(() => {
    let lastTime = performance.now();

    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      const config = STATE_AMBIENT_CONFIG[stateRef.current];
      phaseRef.current += dt * config.pulseSpeed * Math.PI * 2;

      updateCSSVars();
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateCSSVars]);

  useEffect(() => {
    const handleStateChange = (event: CustomEvent<{ state: GlyphState }>) => {
      stateRef.current = event.detail.state;
    };

    const handlePulseUpdate = (event: CustomEvent<{ parameters: PulseParameters }>) => {
      pulseRef.current = event.detail.parameters;
    };

    window.addEventListener('presence:state-change' as any, handleStateChange);
    window.addEventListener('presence:pulse-update' as any, handlePulseUpdate);

    updateCSSVars();

    return () => {
      window.removeEventListener('presence:state-change' as any, handleStateChange);
      window.removeEventListener('presence:pulse-update' as any, handlePulseUpdate);
    };
  }, [updateCSSVars]);

  return null;
}

export default PresenceAmbientLight;
