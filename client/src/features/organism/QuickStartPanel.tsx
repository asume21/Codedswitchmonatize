/**
 * QUICK START PANEL
 *
 * Displays preset buttons that let users start the Organism instantly
 * without the cold start delay. One tap = beat playing in <500ms.
 *
 * Shown when the Organism is NOT running. Once started, this panel
 * collapses to show which preset is active.
 */

import { useOrganism } from './OrganismContext'

export function QuickStartPanel() {
  const {
    quickStart,
    quickStartPresets,
    activePresetId,
    isRunning,
  } = useOrganism()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-tertiary)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        Quick Start
        {isRunning && activePresetId && (
          <span style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--color-text-accent)',
            textTransform: 'none' as const,
            letterSpacing: 'normal',
          }}>
            — {quickStartPresets.find(p => p.id === activePresetId)?.label ?? 'Custom'}
          </span>
        )}
      </div>

      {!isRunning ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6,
        }}>
          {quickStartPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => quickStart(preset.id)}
              title={`${preset.genre} — ${preset.bpm} BPM`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: '10px 4px 8px',
                borderRadius: 'var(--border-radius-md)',
                border: '0.5px solid var(--color-border-secondary)',
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 500,
                transition: 'all 0.15s ease',
                minWidth: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1.5px solid var(--color-border-accent)'
                e.currentTarget.style.background = 'var(--color-background-accent-subtle)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '0.5px solid var(--color-border-secondary)'
                e.currentTarget.style.background = 'var(--color-background-secondary)'
              }}
            >
              <span style={{ fontSize: 20 }}>{preset.icon}</span>
              <span style={{ fontWeight: 600 }}>{preset.label}</span>
              <span style={{
                fontSize: 9,
                color: 'var(--color-text-tertiary)',
                fontWeight: 400,
              }}>
                {preset.bpm} BPM
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 'var(--border-radius-md)',
          background: 'var(--color-background-accent-subtle)',
          border: '0.5px solid var(--color-border-accent)',
          fontSize: 12,
          color: 'var(--color-text-accent)',
        }}>
          {activePresetId ? (
            <>
              <span style={{ fontSize: 16 }}>
                {quickStartPresets.find(p => p.id === activePresetId)?.icon ?? '🎵'}
              </span>
              <span>
                {quickStartPresets.find(p => p.id === activePresetId)?.genre ?? 'Custom'} —{' '}
                {quickStartPresets.find(p => p.id === activePresetId)?.bpm ?? '?'} BPM
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 16 }}>🎵</span>
              <span>Running — reactive mode</span>
            </>
          )}
        </div>
      )}

      {!isRunning && (
        <div style={{
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          lineHeight: 1.4,
        }}>
          Tap a preset to drop the beat instantly. The organism still reacts to your voice.
        </div>
      )}
    </div>
  )
}
