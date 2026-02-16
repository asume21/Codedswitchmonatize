import { useState, useCallback, useMemo } from 'react';
import { GripVertical, Power, Trash2, Plus, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  EFFECT_DEFINITIONS,
  createEffect,
  reorderEffects,
  getPresetsForType,
  type EffectInstance,
  type EffectDefinition,
} from '@/lib/effectsChain';

interface EffectsChainPanelProps {
  trackId: string;
  trackName: string;
  effects: EffectInstance[];
  onEffectsChange: (effects: EffectInstance[]) => void;
}

export default function EffectsChainPanel({
  trackId,
  trackName,
  effects,
  onEffectsChange,
}: EffectsChainPanelProps) {
  const [expandedEffect, setExpandedEffect] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleAddEffect = useCallback((type: string) => {
    const newEffect = createEffect(type);
    onEffectsChange([...effects, newEffect]);
    setExpandedEffect(newEffect.id);
  }, [effects, onEffectsChange]);

  const handleRemoveEffect = useCallback((effectId: string) => {
    onEffectsChange(effects.filter(e => e.id !== effectId));
    if (expandedEffect === effectId) setExpandedEffect(null);
  }, [effects, onEffectsChange, expandedEffect]);

  const handleToggleEffect = useCallback((effectId: string) => {
    onEffectsChange(effects.map(e => e.id === effectId ? { ...e, enabled: !e.enabled } : e));
  }, [effects, onEffectsChange]);

  const handleParamChange = useCallback((effectId: string, param: string, value: number) => {
    onEffectsChange(effects.map(e => {
      if (e.id !== effectId) return e;
      return { ...e, parameters: { ...e.parameters, [param]: value } };
    }));
  }, [effects, onEffectsChange]);

  const handleLoadPreset = useCallback((effectId: string, presetParams: Record<string, number>) => {
    onEffectsChange(effects.map(e => {
      if (e.id !== effectId) return e;
      return { ...e, parameters: { ...presetParams } };
    }));
  }, [effects, onEffectsChange]);

  const handleResetEffect = useCallback((effectId: string) => {
    const effect = effects.find(e => e.id === effectId);
    if (!effect) return;
    const def = EFFECT_DEFINITIONS.find(d => d.type === effect.type);
    if (!def) return;
    onEffectsChange(effects.map(e => {
      if (e.id !== effectId) return e;
      return { ...e, parameters: { ...def.defaultParams } };
    }));
  }, [effects, onEffectsChange]);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    onEffectsChange(reorderEffects(effects, dragIndex, index));
    setDragIndex(index);
  }, [dragIndex, effects, onEffectsChange]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  const categoryColors: Record<string, string> = {
    dynamics: 'text-blue-400',
    eq: 'text-green-400',
    time: 'text-purple-400',
    modulation: 'text-cyan-400',
    distortion: 'text-red-400',
    filter: 'text-yellow-400',
    utility: 'text-zinc-400',
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-zinc-900 rounded-xl border border-zinc-700 w-72">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{trackName} - Effects</h3>
        <span className="text-[10px] text-zinc-500">{effects.length} effect{effects.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Effect chain */}
      <div className="flex flex-col gap-1">
        {effects.length === 0 && (
          <div className="text-xs text-zinc-500 text-center py-4">No effects. Add one below.</div>
        )}

        {effects.map((effect, index) => {
          const def = EFFECT_DEFINITIONS.find(d => d.type === effect.type);
          if (!def) return null;
          const isExpanded = expandedEffect === effect.id;
          const presets = getPresetsForType(effect.type);

          return (
            <div
              key={effect.id}
              className={`border rounded-lg transition-colors ${
                effect.enabled ? 'border-zinc-600 bg-zinc-800/50' : 'border-zinc-700/50 bg-zinc-800/20 opacity-60'
              } ${dragIndex === index ? 'ring-1 ring-purple-500' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              {/* Effect header */}
              <div className="flex items-center gap-1 px-2 py-1.5">
                <GripVertical className="w-3 h-3 text-zinc-600 cursor-grab shrink-0" />
                <button
                  onClick={() => handleToggleEffect(effect.id)}
                  className={`p-0.5 rounded ${effect.enabled ? 'text-green-400' : 'text-zinc-600'}`}
                  title={effect.enabled ? 'Bypass' : 'Enable'}
                >
                  <Power className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setExpandedEffect(isExpanded ? null : effect.id)}
                  className="flex-1 text-left flex items-center gap-1"
                >
                  <span className={`text-xs font-medium ${categoryColors[def.category] || 'text-zinc-300'}`}>
                    {def.label}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3 h-3 text-zinc-500 ml-auto" /> : <ChevronDown className="w-3 h-3 text-zinc-500 ml-auto" />}
                </button>
                <button
                  onClick={() => handleResetEffect(effect.id)}
                  className="p-0.5 text-zinc-600 hover:text-zinc-300"
                  title="Reset to defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleRemoveEffect(effect.id)}
                  className="p-0.5 text-zinc-600 hover:text-red-400"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Expanded parameters */}
              {isExpanded && (
                <div className="px-2 pb-2 flex flex-col gap-2 border-t border-zinc-700/50 pt-2">
                  {/* Presets */}
                  {presets.length > 0 && (
                    <Select onValueChange={(presetName) => {
                      const preset = presets.find(p => p.name === presetName);
                      if (preset) handleLoadPreset(effect.id, preset.parameters);
                    }}>
                      <SelectTrigger className="h-6 text-[10px] bg-zinc-700/50 border-zinc-600">
                        <SelectValue placeholder="Load preset..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-600">
                        {presets.map(p => (
                          <SelectItem key={p.name} value={p.name} className="text-xs">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Parameter sliders */}
                  {Object.entries(def.paramRanges).map(([param, range]) => (
                    <div key={param} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400 capitalize">{param.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {typeof effect.parameters[param] === 'number'
                            ? effect.parameters[param].toFixed(range.step < 1 ? 1 : 0)
                            : '0'
                          }
                          {range.unit && <span className="ml-0.5">{range.unit}</span>}
                        </span>
                      </div>
                      <Slider
                        value={[effect.parameters[param] ?? range.min]}
                        min={range.min}
                        max={range.max}
                        step={range.step}
                        onValueChange={([val]) => handleParamChange(effect.id, param, val)}
                        className="h-4"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add effect */}
      <Select onValueChange={handleAddEffect}>
        <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-600 border-dashed">
          <div className="flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Effect</span>
          </div>
        </SelectTrigger>
        <SelectContent className="bg-zinc-800 border-zinc-600">
          {EFFECT_DEFINITIONS.map(def => (
            <SelectItem key={def.type} value={def.type} className="text-xs">
              <span className={categoryColors[def.category] || ''}>{def.label}</span>
              <span className="text-zinc-500 ml-2 text-[10px]">{def.category}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
