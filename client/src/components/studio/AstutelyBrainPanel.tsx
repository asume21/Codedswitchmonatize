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
  Guitar,
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
    organismSetChordTechnique, organismSetMelodyArticulation,
    organismSetBassArticulation, organismSetStyleShiftsEnabled,
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

  // Playing technique / articulation controls.
  // Defaults match the engine side (piano-block-chord / none / none) so
  // "Auto" reflects what's running when style-shifts are enabled.
  const [chordTech, setChordTech] = useState<string>('piano-block-chord');
  const [melodyArt, setMelodyArt] = useState<string>('none');
  const [bassArt, setBassArt] = useState<string>('none');
  const [styleShifts, setStyleShifts] = useState<boolean>(true);

  const onChordTechChange = (id: string) => {
    setChordTech(id);
    organismSetChordTechnique(id);
  };
  const onMelodyArtChange = (id: string) => {
    setMelodyArt(id);
    organismSetMelodyArticulation(id);
  };
  const onBassArtChange = (id: string) => {
    setBassArt(id);
    organismSetBassArticulation(id);
  };
  const toggleStyleShifts = () => {
    const next = !styleShifts;
    setStyleShifts(next);
    organismSetStyleShiftsEnabled(next);
  };

  const physics = organismPhysicsState;

  // Local overrides so buttons respond immediately even when the organism
  // hasn't emitted a physics-update yet (e.g. organism not running).
  const [localMode, setLocalMode] = useState<string | null>(null);
  const [localState, setLocalState] = useState<string | null>(null);

  // Sync: when the organism emits real state, clear local overrides
  const bridgeMode = physics?.mode ?? null;
  const bridgeState = organismCurrentState?.current?.toLowerCase() ?? null;

  const currentMode = bridgeMode ?? localMode ?? 'glow';
  const currentStateName = bridgeState ?? localState ?? 'dormant';

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
                onClick={() => { setLocalMode(key); organismLockMode(key as OrganismMode); }}
                className="text-[9px]"
              >
                {info.label}
              </AstutelyLedButton>
            ))}
            <AstutelyLedButton
              active={localMode === null && !bridgeMode}
              tone="cyan"
              size="sm"
              onClick={() => { setLocalMode(null); organismUnlockMode(); }}
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
                onClick={() => { setLocalState(key); organismForceState(key); }}
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

      {/* ═══ STYLE (Technique + Articulation) ════════════════════ */}
      <Section
        id="style"
        label="Style"
        icon={<Guitar className="w-4 h-4" />}
        expanded={expandedSection === 'style'}
        onToggle={() => toggleSection('style')}
        badge={styleShifts ? 'AUTO' : 'MANUAL'}
        badgeColor={styleShifts ? 'text-emerald-400' : 'text-amber-400'}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-white/70">Auto style-shifts</span>
          <AstutelyLedButton
            active={styleShifts}
            tone={styleShifts ? 'emerald' : 'red'}
            size="sm"
            onClick={toggleStyleShifts}
          >
            {styleShifts ? 'On' : 'Off'}
          </AstutelyLedButton>
        </div>
        <div className="text-[9px] text-white/40 mb-3 leading-relaxed">
          When on, the reactive engine shifts technique + articulations based
          on rapper energy (low/mid/high) with 8s cooldown. Manual picks
          below override the engine until you change mode.
        </div>

        {/* Chord Technique */}
        <div className="mb-2">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">
            Chord Technique
          </label>
          <select
            value={chordTech}
            onChange={(e) => onChordTechChange(e.target.value)}
            className="w-full h-8 rounded-lg border border-cyan-500/30 bg-black/60 px-2 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400"
          >
            <optgroup label="Piano">
              <option value="piano-block-chord">Block Chord (Default)</option>
              <option value="piano-rolled-chord">Rolled Chord</option>
              <option value="piano-alberti">Alberti 1-5-3-5</option>
              <option value="piano-sustained-pad">Sustained Pad</option>
            </optgroup>
            <optgroup label="Guitar">
              <option value="guitar-strum-down">Strum Down</option>
              <option value="guitar-strum-up">Strum Up</option>
              <option value="guitar-arp-rolled">Arpeggio Rolled</option>
              <option value="guitar-muted-stab">Muted Stab</option>
            </optgroup>
            <optgroup label="Strings">
              <option value="strings-pizzicato">Pizzicato</option>
              <option value="strings-legato">Legato</option>
              <option value="strings-tremolo">Tremolo</option>
              <option value="strings-staccato">Staccato</option>
            </optgroup>
            <optgroup label="Brass">
              <option value="brass-stab">Stab</option>
              <option value="brass-swell">Swell</option>
              <option value="brass-fanfare">Fanfare</option>
              <option value="brass-section-pad">Section Pad</option>
            </optgroup>
            <optgroup label="Wind">
              <option value="wind-legato">Legato Line</option>
              <option value="wind-run">Scalar Run</option>
              <option value="wind-staccato">Staccato</option>
              <option value="wind-trill">Trill</option>
            </optgroup>
          </select>
        </div>

        {/* Melody Articulation */}
        <div className="mb-2">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">
            Melody Articulation
          </label>
          <select
            value={melodyArt}
            onChange={(e) => onMelodyArtChange(e.target.value)}
            className="w-full h-8 rounded-lg border border-cyan-500/30 bg-black/60 px-2 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400"
          >
            <option value="none">None (Straight)</option>
            <option value="legato-slur">Legato Slur</option>
            <option value="staccato-pop">Staccato Pop</option>
            <option value="grace-flick">Grace-Note Flick</option>
            <option value="trill-ornament">Trill Ornament</option>
          </select>
        </div>

        {/* Bass Articulation */}
        <div>
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">
            Bass Articulation
          </label>
          <select
            value={bassArt}
            onChange={(e) => onBassArtChange(e.target.value)}
            className="w-full h-8 rounded-lg border border-cyan-500/30 bg-black/60 px-2 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400"
          >
            <option value="none">None (Straight)</option>
            <option value="bass-slide-up">Slide-Up</option>
            <option value="bass-ghost-note">Ghost Note</option>
            <option value="bass-octave-jump">Octave Jump</option>
            <option value="bass-walking-step">Walking Step</option>
          </select>
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
