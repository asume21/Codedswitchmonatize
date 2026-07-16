import React, { memo } from 'react'
import { useOrganism, useOrganismPhysics } from './OrganismContext'
import { OrganismMode }   from '../../organism/physics/types'
import { OState }         from '../../organism/state/types'

const MODE_COLORS: Record<OrganismMode, string> = {
  [OrganismMode.Heat]:   'var(--color-text-danger)',
  [OrganismMode.Ice]:    'var(--color-text-info)',
  [OrganismMode.Smoke]:  'var(--color-text-secondary)',
  [OrganismMode.Gravel]: 'var(--color-text-warning)',
  [OrganismMode.Glow]:   'var(--color-text-success)',
}

const STATE_COLORS: Record<OState, string> = {
  [OState.Dormant]:   'var(--color-text-tertiary)',
  [OState.Awakening]: 'var(--color-text-warning)',
  [OState.Breathing]: 'var(--color-text-info)',
  [OState.Flow]:      'var(--color-text-success)',
}

const BAR_COLORS: Record<string, string> = {
  Bounce:   '#22d3ee',
  Swing:    '#a78bfa',
  Pocket:   '#34d399',
  Presence: '#fbbf24',
  Density:  '#f87171',
}

const CHANNEL_ORDER = ['drum', 'bass', 'melody', 'texture', 'chord']

// Display labels — the `texture` channel is now the Synth Pads / Keys voice; the
// internal key stays `texture` for backward compatibility (loop packs, meters).
const CHANNEL_LABELS: Record<string, string> = {
  texture: 'Synth Pads',
}

function dbToPct(db: number): number {
  if (!Number.isFinite(db)) return 0
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100))
}

function LevelMeter({ label, db, compact = false }: {
  label: string
  db: number
  compact?: boolean
}) {
  const pct = dbToPct(db)
  const meterColor = pct > 85 ? '#ef4444' : pct > 60 ? '#fbbf24' : '#22d3ee'
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: compact ? '52px 1fr 38px' : '64px 1fr 44px',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    }}>
      <span style={{
        fontSize: 10,
        color: 'var(--color-text-tertiary)',
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {label}
      </span>
      <div style={{
        height: compact ? 7 : 8,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 4,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${meterColor}cc, ${meterColor})`,
          borderRadius: 4,
          transition: 'width 160ms linear',
          boxShadow: `0 0 6px ${meterColor}30`,
        }} />
      </div>
      <span style={{
        fontSize: 10,
        textAlign: 'right',
        color: 'var(--color-text-tertiary)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {db === -Infinity ? '-inf' : db.toFixed(1)}
      </span>
    </div>
  )
}

function PhysicsBar({ label, value, max = 1 }: {
  label: string, value: number, max?: number
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const barColor = BAR_COLORS[label] || '#60a5fa'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        fontSize: 13, fontWeight: 600,
        marginBottom: 5,
      }}>
        <span style={{ color: '#e2e8f0', letterSpacing: '0.03em' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>
            {pct}%
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: barColor, fontSize: 14, fontWeight: 700 }}>
            {value.toFixed(2)}
          </span>
        </div>
      </div>
      <div style={{
        height: 10,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 5,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
          borderRadius: 5,
          transition: 'width 80ms linear',
          boxShadow: `0 0 8px ${barColor}40`,
        }} />
      </div>
    </div>
  )
}

function OrganismVisualizerImpl() {
  const { isRunning }                              = useOrganism()
  const { physicsState, organismState, meterReading } = useOrganismPhysics()

  if (!isRunning || !physicsState || !organismState) {
    return (
      <div style={{
        padding: 24,
        textAlign: 'center',
        color: 'var(--color-text-tertiary)',
        fontSize: 14,
      }}>
        Organism is dormant. Press Start to wake it.
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>

      {/* State + Mode badges */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <span style={{
          padding: '3px 10px',
          borderRadius: 'var(--border-radius-md)',
          border: `0.5px solid ${STATE_COLORS[organismState.current]}`,
          color: STATE_COLORS[organismState.current],
          fontSize: 12, fontWeight: 500,
        }}>
          {organismState.current}
        </span>
        <span style={{
          padding: '3px 10px',
          borderRadius: 'var(--border-radius-md)',
          border: `0.5px solid ${MODE_COLORS[physicsState.mode]}`,
          color: MODE_COLORS[physicsState.mode],
          fontSize: 12, fontWeight: 500,
        }}>
          {physicsState.mode.toUpperCase()}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {physicsState.pulse.toFixed(1)} BPM
        </span>
      </div>

      {/* Physics vitals */}
      <div style={{ marginBottom: 16 }}>
        <MemoPhysicsBar label="Bounce"   value={physicsState.bounce} />
        <MemoPhysicsBar label="Swing"    value={physicsState.swing}   max={0.75} />
        <MemoPhysicsBar label="Pocket"   value={physicsState.pocket} />
        <MemoPhysicsBar label="Presence" value={physicsState.presence} />
        <MemoPhysicsBar label="Density"  value={physicsState.density} />
      </div>

      {/* Flow progress */}
      {organismState.current === OState.Flow && (
        <div style={{
          marginBottom: 16,
          padding: '10px 12px',
          background: 'var(--color-background-success)',
          borderRadius: 'var(--border-radius-md)',
          border: '0.5px solid var(--color-border-success)',
        }}>
          <div style={{
            fontSize: 12,
            color: 'var(--color-text-success)',
            marginBottom: 4,
          }}>
            Flow depth
          </div>
          <div style={{
            height: 6,
            background: 'var(--color-background-tertiary)',
            borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round(organismState.flowDepth * 100)}%`,
              background: 'var(--color-text-success)',
              borderRadius: 3,
              transition: 'width 200ms linear',
            }} />
          </div>
        </div>
      )}

      {/* Meter */}
      {meterReading && (
        <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 10 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)',
            marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          }}>
            Levels
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '7px 14px',
            marginBottom: 8,
          }}>
            {CHANNEL_ORDER.map((name) => {
              const channel = meterReading.channels[name]
              return (
                <MemoLevelMeter
                  key={name}
                  label={CHANNEL_LABELS[name] ?? name}
                  db={channel?.rmsDb ?? -Infinity}
                  compact
                />
              )
            })}
          </div>
          <MemoLevelMeter label="master" db={meterReading.masterRmsDb} />
        </div>
      )}
    </div>
  )
}

const MemoLevelMeter = memo(LevelMeter)
const MemoPhysicsBar = memo(PhysicsBar)
export const OrganismVisualizer = memo(OrganismVisualizerImpl)
