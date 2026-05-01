/**
 * AstutelyBrainContent — Brain controls for the unified Astutely panel.
 *
 * Consistently focuses on high-level AI studio tasks:
 *  1. Genre Selector — one-click genre enforcement
 *  2. Auto-Mix toggle + decision log
 *  3. Mixer quick controls (master level)
 *
 * NOTE: Granular Organism controls (modes, sliders, styles) were removed
 * to resolve UX split-brain. The Organism tab is the primary home for
 * beat machine controls.
 */

import { useState } from 'react';
import {
  Music2,
  Zap,
  ChevronDown,
  ChevronUp,
  Volume2,
} from 'lucide-react';
import { useAstutelyCore } from '@/contexts/AstutelyCoreContext';
import {
  AstutelyLedButton,
  AstutelyFader,
} from '@/components/astutely/AstutelyControls';
import { cn } from '@/lib/utils';

export default function AstutelyBrainContent() {
  const {
    activeGenre, availableGenres, setGenre, clearGenre,
    autoMixEnabled, setAutoMixEnabled, lastDecisionResult,
    setMixerMasterLevel,
  } = useAstutelyCore();

  const [expandedSection, setExpandedSection] = useState<string | null>('genre');

  const toggleSection = (id: string) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  const [masterLevel, setMasterLevelLocal] = useState(0.8);
  const onMasterChange = (val: number) => {
    const normalized = val / 100;
    setMasterLevelLocal(normalized);
    setMixerMasterLevel(normalized);
  };

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
              {activeGenre.defaultBpm} BPM &middot; {activeGenre.patternStyle}
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
          <div className="mt-2 rounded-lg border border-cyan-500/20 bg-black/40 p-2 max-h-48 overflow-y-auto">
            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1">Decision Log</div>
            {lastDecisionResult.log.map((entry, i) => (
              <div key={i} className="text-[10px] text-white/60 leading-relaxed">
                {entry}
              </div>
            ))}
          </div>
        )}
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

      <div className="pt-4 px-2">
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">AI Assistant</div>
          <p className="text-[10px] text-white/40 leading-relaxed">
            Astutely is managing the global session energy and mixer. To control the reactive beat machine directly, use the <span className="text-cyan-400/60 font-bold">Organism</span> tab (F10).
          </p>
        </div>
      </div>
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
