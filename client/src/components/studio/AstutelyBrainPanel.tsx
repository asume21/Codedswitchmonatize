/**
 * AstutelyBrainContent — Brain controls for the unified Astutely panel.
 *
 * Sections:
 *  1. Genre Selector — one-click genre enforcement
 *  2. Auto-Mix toggle + decision log
 *  3. Organism state overview (mode, BPM, physics)
 *  4. Generator volume knobs (bass, melody, hats, kick, texture)
 *  5. Mixer quick controls (master level)
 */

import { useState } from 'react';
import {
  Music2,
  Sliders,
  Activity,
  Zap,
  ChevronDown,
  ChevronUp,
  Volume2,
} from 'lucide-react';
import { useAstutelyCore } from '@/contexts/AstutelyCoreContext';
import { OrganismMode } from '@/organism/physics/types';
import {
  AstutelyLedButton,
  AstutelyKnob,
  AstutelyFader,
  AstutelyMeter,
} from '@/components/astutely/AstutelyControls';
import { cn } from '@/lib/utils';

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  heat:   { label: 'Heat',   color: 'text-red-400' },
  ice:    { label: 'Ice',    color: 'text-blue-300' },
  smoke:  { label: 'Smoke',  color: 'text-gray-300' },
  gravel: { label: 'Gravel', color: 'text-amber-400' },
  glow:   { label: 'Glow',   color: 'text-emerald-300' },
};

const STATE_LABELS: Record<string, string> = {
  dormant: 'Dormant',
  awakening: 'Awakening',
  breathing: 'Breathing',
  flow: 'Flow',
};

export default function AstutelyBrainContent() {
  const {
    activeGenre, availableGenres, setGenre, clearGenre,
    autoMixEnabled, setAutoMixEnabled, lastDecisionResult,
    organismPhysicsState, organismCurrentState, organismIsRunning,
    organismLockMode, organismUnlockMode, organismSetBpm, organismForceState,
    organismSetGeneratorVolume, organismSetTextureEnabled,
    setMixerMasterLevel,
  } = useAstutelyCore();

  const [expandedSection, setExpandedSection] = useState<string | null>('genre');
  const [bpmInput, setBpmInput] = useState('');

  const toggleSection = (id: string) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  const [genVols, setGenVols] = useState({
    bass: 1.0, melody: 1.0, hatDensity: 1.0, kickVelocity: 1.0, texture: 1.0,
  });

  const setGenVol = (gen: 'bass' | 'melody' | 'hatDensity' | 'kickVelocity' | 'texture', val: number) => {
    const clamped = Math.round(val * 100) / 100;
    setGenVols(prev => ({ ...prev, [gen]: clamped }));
    organismSetGeneratorVolume(gen, clamped);
  };

  const [masterLevel, setMasterLevelLocal] = useState(0.8);
  const onMasterChange = (val: number) => {
    const normalized = val / 100;
    setMasterLevelLocal(normalized);
    setMixerMasterLevel(normalized);
  };

  const [textureEnabled, setTextureLocal] = useState(true);
  const toggleTexture = () => {
    const next = !textureEnabled;
    setTextureLocal(next);
    organismSetTextureEnabled(next);
  };

  const physics = organismPhysicsState;
  const currentMode = physics?.mode ?? 'glow';
  const currentStateName = organismCurrentState?.current?.toLowerCase() ?? 'dormant';

  return (
    <div className="space-y-2 p-3 overflow-y-auto">

      {/* ═══ GENRE SELECTOR ═══════════════════════════════════════ */}
      <Section
        id="genre"
        label="Genre"
        icon={<Music2 className="w-4 h-4" />}
        expanded={expandedSection === 'genre'}
        onToggle={() => toggleSection('genre')}
        badge={activeGenre?.label}
        badgeColor="text-amber-300"
      >
        <div className="grid grid-cols-3 gap-2">
          {availableGenres.map(g => (
            <AstutelyLedButton
              key={g.id}
              active={activeGenre?.id === g.id}
              tone={activeGenre?.id === g.id ? 'amber' : 'cyan'}
              size="sm"
              onClick={() => setGenre(g.id)}
              className="text-[9px] w-full"
            >
              {g.label}
            </AstutelyLedButton>
          ))}
        </div>
        {activeGenre && (
          <div className="mt-2 flex items-center justify-between">
            <div className="text-[10px] text-white/50">
              {activeGenre.defaultBpm} BPM &middot; {MODE_LABELS[activeGenre.organismMode]?.label} mode &middot; {activeGenre.patternStyle}
            </div>
            <button
              onClick={clearGenre}
              className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider"
            >
              Clear
            </button>
          </div>
        )}
      </Section>

      {/* ═══ AUTO-MIX ═════════════════════════════════════════════ */}
      <Section
        id="automix"
        label="Auto-Mix"
        icon={<Zap className="w-4 h-4" />}
        expanded={expandedSection === 'automix'}
        onToggle={() => toggleSection('automix')}
        badge={autoMixEnabled ? 'ON' : 'OFF'}
        badgeColor={autoMixEnabled ? 'text-emerald-400' : 'text-white/40'}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-white/70">Reactive auto-mixing</span>
          <AstutelyLedButton
            active={autoMixEnabled}
            tone={autoMixEnabled ? 'emerald' : 'red'}
            size="sm"
            onClick={() => setAutoMixEnabled(!autoMixEnabled)}
          >
            {autoMixEnabled ? 'Enabled' : 'Disabled'}
          </AstutelyLedButton>
        </div>

        {lastDecisionResult && lastDecisionResult.log.length > 0 && (
          <div className="mt-2 rounded-lg border border-cyan-500/20 bg-black/40 p-2 max-h-28 overflow-y-auto">
            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1">Decision Log</div>
            {lastDecisionResult.log.map((entry, i) => (
              <div key={i} className="text-[10px] text-white/60 leading-relaxed">
                {entry}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ═══ ORGANISM STATE ═══════════════════════════════════════ */}
      <Section
        id="organism"
        label="Organism"
        icon={<Activity className="w-4 h-4" />}
        expanded={expandedSection === 'organism'}
        onToggle={() => toggleSection('organism')}
        badge={organismIsRunning ? STATE_LABELS[currentStateName] ?? currentStateName : 'Stopped'}
        badgeColor={organismIsRunning ? 'text-emerald-400' : 'text-white/40'}
      >
        <div className="mb-3">
          <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Mode</div>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(MODE_LABELS).map(([key, info]) => (
              <AstutelyLedButton
                key={key}
                active={currentMode === key}
                tone={currentMode === key ? 'magenta' : 'cyan'}
                size="sm"
                onClick={() => organismLockMode(key as OrganismMode)}
                className="text-[9px]"
              >
                {info.label}
              </AstutelyLedButton>
            ))}
            <AstutelyLedButton
              active={false}
              tone="cyan"
              size="sm"
              onClick={organismUnlockMode}
              className="text-[9px]"
            >
              Auto
            </AstutelyLedButton>
          </div>
        </div>

        <div className="mb-3">
          <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">State</div>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(STATE_LABELS).map(([key, label]) => (
              <AstutelyLedButton
                key={key}
                active={currentStateName === key}
                tone={currentStateName === key ? 'emerald' : 'cyan'}
                size="sm"
                onClick={() => organismForceState(key)}
                className="text-[9px]"
              >
                {label}
              </AstutelyLedButton>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">BPM</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={40}
              max={220}
              value={bpmInput || (physics?.pulse ? Math.round(physics.pulse) : '')}
              onChange={(e) => setBpmInput(e.target.value)}
              onBlur={() => {
                const v = parseInt(bpmInput);
                if (v >= 40 && v <= 220) organismSetBpm(v);
                setBpmInput('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseInt(bpmInput);
                  if (v >= 40 && v <= 220) organismSetBpm(v);
                  setBpmInput('');
                }
              }}
              className="w-20 h-8 rounded-lg border border-cyan-500/30 bg-black/60 text-center text-sm text-cyan-100 font-bold focus:outline-none focus:border-cyan-400"
              placeholder="BPM"
            />
            {[80, 100, 120, 140].map(bpm => (
              <button
                key={bpm}
                onClick={() => organismSetBpm(bpm)}
                className="h-7 px-2 rounded-md border border-white/10 text-[10px] text-white/60 hover:text-white hover:border-cyan-500/40 bg-black/40 transition-colors"
              >
                {bpm}
              </button>
            ))}
          </div>
        </div>

        {physics && (
          <div className="grid grid-cols-5 gap-3 mt-2">
            <PhysicsMeter label="Bounce" value={physics.bounce} />
            <PhysicsMeter label="Swing" value={physics.swing} />
            <PhysicsMeter label="Pocket" value={physics.pocket} />
            <PhysicsMeter label="Presence" value={physics.presence} />
            <PhysicsMeter label="Density" value={physics.density} />
          </div>
        )}
      </Section>

      {/* ═══ GENERATORS ═══════════════════════════════════════════ */}
      <Section
        id="generators"
        label="Generators"
        icon={<Sliders className="w-4 h-4" />}
        expanded={expandedSection === 'generators'}
        onToggle={() => toggleSection('generators')}
      >
        <div className="flex items-center justify-center gap-4 py-2">
          <AstutelyKnob label="Bass" value={genVols.bass * 100} onValueChange={(v) => setGenVol('bass', v / 100)} min={0} max={200} step={1} tone="magenta" size={52} unit="%" />
          <AstutelyKnob label="Melody" value={genVols.melody * 100} onValueChange={(v) => setGenVol('melody', v / 100)} min={0} max={200} step={1} tone="cyan" size={52} unit="%" />
          <AstutelyKnob label="Hats" value={genVols.hatDensity * 100} onValueChange={(v) => setGenVol('hatDensity', v / 100)} min={0} max={200} step={1} tone="amber" size={52} unit="%" />
          <AstutelyKnob label="Kick" value={genVols.kickVelocity * 100} onValueChange={(v) => setGenVol('kickVelocity', v / 100)} min={0} max={200} step={1} tone="red" size={52} unit="%" />
          <AstutelyKnob label="Texture" value={genVols.texture * 100} onValueChange={(v) => setGenVol('texture', v / 100)} min={0} max={200} step={1} tone="emerald" size={52} unit="%" disabled={!textureEnabled} />
        </div>
        <div className="flex justify-center mt-1">
          <AstutelyLedButton active={textureEnabled} tone={textureEnabled ? 'emerald' : 'red'} size="sm" onClick={toggleTexture}>
            Texture {textureEnabled ? 'On' : 'Off'}
          </AstutelyLedButton>
        </div>
      </Section>

      {/* ═══ MASTER ═══════════════════════════════════════════════ */}
      <Section
        id="master"
        label="Master"
        icon={<Volume2 className="w-4 h-4" />}
        expanded={expandedSection === 'master'}
        onToggle={() => toggleSection('master')}
      >
        <AstutelyFader label="Master Level" value={masterLevel * 100} onValueChange={onMasterChange} min={0} max={100} step={1} tone="cyan" />
      </Section>
    </div>
  );
}

// ── Collapsible Section ───────────────────────────────────────────────────────

function Section({
  id,
  label,
  icon,
  expanded,
  onToggle,
  badge,
  badgeColor,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer bg-transparent border-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">{icon}</span>
          <span className="text-xs font-black uppercase tracking-widest text-white/80">{label}</span>
          {badge && (
            <span className={cn('text-[10px] font-bold', badgeColor ?? 'text-cyan-400')}>
              {badge}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-white/40" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1">{children}</div>
      )}
    </div>
  );
}

function PhysicsMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <AstutelyMeter value={value} orientation="vertical" tone="cyan" className="h-16 w-3" />
      <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">{label}</span>
    </div>
  );
}
