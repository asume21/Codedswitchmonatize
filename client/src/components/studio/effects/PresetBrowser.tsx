/**
 * PresetBrowser — Reusable dropdown for browsing/loading/saving effect presets.
 * Works with any effect type via the shared presetManager.
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Save, Trash2, FolderOpen } from 'lucide-react';
import {
  getAllPresetsForEffect,
  savePreset,
  deletePreset,
  type EffectPreset,
} from '@/lib/presetManager';
import { useToast } from '@/hooks/use-toast';

interface PresetBrowserProps {
  effectType: string;
  currentParams: Record<string, number>;
  onLoadPreset: (params: Record<string, number>) => void;
}

export default function PresetBrowser({ effectType, currentParams, onLoadPreset }: PresetBrowserProps) {
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);

  const presets = useMemo(() => getAllPresetsForEffect(effectType), [effectType, refreshKey]);
  const factoryPresets = presets.filter(p => p.isFactory);
  const userPresets = presets.filter(p => !p.isFactory);

  const handleSave = () => {
    const name = prompt('Preset name:', `My ${effectType} preset`);
    if (!name?.trim()) return;
    savePreset(effectType, name.trim(), currentParams);
    setRefreshKey(k => k + 1);
    toast({ title: 'Preset Saved', description: `"${name}" saved.` });
  };

  const handleLoad = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      onLoadPreset(preset.parameters);
      toast({ title: 'Preset Loaded', description: `"${preset.name}" applied.` });
    }
  };

  const handleDelete = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    deletePreset(presetId);
    setRefreshKey(k => k + 1);
    toast({ title: 'Preset Deleted' });
  };

  return (
    <div className="flex items-center gap-2">
      <Select onValueChange={handleLoad}>
        <SelectTrigger className="h-8 w-[180px] bg-black/30 border-cyan-500/15 text-cyan-100 text-xs">
          <FolderOpen className="w-3 h-3 mr-1 text-cyan-400" />
          <SelectValue placeholder="Load Preset..." />
        </SelectTrigger>
        <SelectContent className="bg-gray-900 border-cyan-500/20 max-h-64">
          {factoryPresets.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-cyan-500/50 text-[10px] uppercase">Factory</SelectLabel>
              {factoryPresets.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-cyan-100 text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {userPresets.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-cyan-500/50 text-[10px] uppercase">User</SelectLabel>
              {userPresets.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-cyan-100 text-xs">
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{p.name}</span>
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      className="text-red-400/50 hover:text-red-400 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {presets.length === 0 && (
            <div className="px-3 py-2 text-xs text-cyan-500/40">No presets yet</div>
          )}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="outline"
        onClick={handleSave}
        className="h-8 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 text-xs px-2"
        title="Save current settings as preset"
      >
        <Save className="w-3 h-3" />
      </Button>
    </div>
  );
}
