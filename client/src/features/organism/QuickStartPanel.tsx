/**
 * QUICK START PANEL
 *
 * Displays preset buttons for instant beat start.
 * Also exposes Count-In Start (count 1-2-3-4 then beat drops)
 * and Sound Trigger Start (any loud sound fires the beat).
 */

import { useState } from 'react'
import { useOrganism } from './OrganismContext'

export function QuickStartPanel() {
  const {
    quickStart,
    quickStartPresets,
    activePresetId,
    isRunning,
    countInStart,
    countInBeat,
    soundTriggerArmed,
    armSoundTrigger,
    disarmSoundTrigger,
  } = useOrganism()

  const activePreset = activePresetId
    ? quickStartPresets.find(p => p.id === activePresetId) ?? null
    : null

  // Which preset to use for count-in / sound trigger
  const [triggerPresetId, setTriggerPresetId] = useState<string>(
    () => quickStartPresets[0]?.id ?? ''
  )

  const countingIn = countInBeat !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: 'var(--color-text-tertiary)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        Quick Start
        {isRunning && activePresetId && (
          <span style={{
            fontSize: 10, fontWeight: 500,
            color: 'var(--color-text-accent)',
            textTransform: 'none' as const,
            letterSpacing: 'normal',
          }}>
            — {activePreset?.label ?? 'Custom'}
          </span>
        )}
      </div>

      {/* Running state: show active preset badge */}
      {isRunning ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          borderRadius: 'var(--border-radius-md)',
          background: 'var(--color-background-accent-subtle)',
          border: '0.5px solid var(--color-border-accent)',
          fontSize: 12, color: 'var(--color-text-accent)',
        }}>
          {activePresetId ? (
            <>
              <span style={{ fontSize: 16 }}>{activePreset?.icon ?? '🎵'}</span>
              <span>{activePreset?.genre ?? 'Custom'} — {activePreset?.bpm ?? '?'} BPM</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 16 }}>🎵</span>
              <span>Running — reactive mode</span>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Count-In big indicator (shown while counting in) */}
          {countingIn && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '12px 0',
            }}>
              {[1, 2, 3, 4].map((beat) => (
                <div key={beat} style={{
                  width: 36, height: 36,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 15,
                  border: countInBeat === beat
                    ? '2px solid #22c55e'
                    : '1px solid rgba(100,116,139,0.3)',
                  background: countInBeat === beat
                    ? 'rgba(34,197,94,0.2)'
                    : 'transparent',
                  color: countInBeat === beat
                    ? '#4ade80'
                    : 'var(--color-text-tertiary)',
                  transition: 'all 0.1s ease',
                  transform: countInBeat === beat ? 'scale(1.15)' : 'scale(1)',
                }}>
                  {beat}
                </div>
              ))}
            </div>
          )}

          {/* Preset grid (hidden while counting in) */}
          {!countingIn && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {quickStartPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => quickStart(preset.id)}
                  title={`${preset.genre} — ${preset.bpm} BPM`}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 3, padding: '10px 4px 8px',
                    borderRadius: 'var(--border-radius-md)',
                    border: '0.5px solid var(--color-border-secondary)',
                    background: 'var(--color-background-secondary)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer', fontSize: 10, fontWeight: 500,
                    transition: 'all 0.15s ease', minWidth: 0,
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
                  <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
                    {preset.bpm} BPM
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── Alternate start modes ──────────────────────────────── */}
          <div style={{
            borderTop: '0.5px solid var(--color-border-tertiary)',
            paddingTop: 10,
            display: 'flex', flexDirection: 'column', gap: 7,
          }}>
            {/* Preset selector for count-in / sound trigger */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                Preset:
              </span>
              <select
                value={triggerPresetId}
                onChange={(e) => setTriggerPresetId(e.target.value)}
                style={{
                  flex: 1, fontSize: 11, padding: '3px 6px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '0.5px solid var(--color-border-secondary)',
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                {quickStartPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.label} — {p.bpm} BPM
                  </option>
                ))}
              </select>
            </div>

            {/* Count-In Start */}
            <button
              onClick={() => countInStart(triggerPresetId)}
              disabled={countingIn}
              style={{
                padding: '7px 10px',
                borderRadius: 'var(--border-radius-md)',
                border: countingIn
                  ? '1px solid rgba(34,197,94,0.5)'
                  : '1px solid rgba(34,197,94,0.25)',
                background: countingIn ? 'rgba(34,197,94,0.15)' : 'transparent',
                color: countingIn ? '#4ade80' : 'var(--color-text-secondary)',
                cursor: countingIn ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              title="Count in 1-2-3-4 aloud and the beat drops on the 1"
            >
              <span>🎙</span>
              <span>{countingIn ? `Listening… beat ${countInBeat ?? '?'}` : 'Count-In Start'}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>
                say "1 2 3 4"
              </span>
            </button>

            {/* Sound Trigger */}
            <button
              onClick={soundTriggerArmed
                ? disarmSoundTrigger
                : () => armSoundTrigger(triggerPresetId)}
              style={{
                padding: '7px 10px',
                borderRadius: 'var(--border-radius-md)',
                border: soundTriggerArmed
                  ? '1px solid rgba(249,115,22,0.6)'
                  : '1px solid rgba(249,115,22,0.25)',
                background: soundTriggerArmed ? 'rgba(249,115,22,0.15)' : 'transparent',
                color: soundTriggerArmed ? '#fb923c' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: 12, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
                animation: soundTriggerArmed ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}
              title="Arm the sound trigger — any loud sound fires the beat"
            >
              <span>🎯</span>
              <span>{soundTriggerArmed ? 'Armed — make a sound!' : 'Sound Trigger'}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>
                {soundTriggerArmed ? 'tap to disarm' : 'any loud sound'}
              </span>
            </button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
            Tap a preset for instant start. The organism still reacts to your voice.
          </div>
        </>
      )}
    </div>
  )
}
