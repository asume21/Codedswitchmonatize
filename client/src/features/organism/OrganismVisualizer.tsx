import { useOrganism }    from './OrganismContext'
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

function PhysicsBar({ label, value, max = 1 }: {
  label: string, value: number, max?: number
}) {
  const pct = Math.round((value / max) * 100)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 12, color: 'var(--color-text-secondary)',
        marginBottom: 3,
      }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value.toFixed(2)}
        </span>
      </div>
      <div style={{
        height: 4,
        background: 'var(--color-background-tertiary)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'var(--color-text-primary)',
          borderRadius: 2,
          transition: 'width 80ms linear',
        }} />
      </div>
    </div>
  )
}

export function OrganismVisualizer() {
  const { physicsState, organismState, meterReading, isRunning } = useOrganism()

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
        <PhysicsBar label="Bounce"   value={physicsState.bounce} />
        <PhysicsBar label="Swing"    value={physicsState.swing}   max={0.75} />
        <PhysicsBar label="Pocket"   value={physicsState.pocket} />
        <PhysicsBar label="Presence" value={physicsState.presence} />
        <PhysicsBar label="Density"  value={physicsState.density} />
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
        <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 12 }}>
          <div style={{
            fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8,
          }}>
            Levels
          </div>
          {Object.entries(meterReading.channels).map(([name, ch]) => (
            <div key={name} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
            }}>
              <span style={{
                width: 52, fontSize: 11,
                color: 'var(--color-text-tertiary)',
                textTransform: 'capitalize',
              }}>
                {name}
              </span>
              <div style={{
                flex: 1, height: 3,
                background: 'var(--color-background-tertiary)',
                borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, (ch.rmsDb + 60) / 60 * 100))}%`,
                  background: 'var(--color-text-primary)',
                  borderRadius: 2,
                  transition: 'width 100ms linear',
                }} />
              </div>
              <span style={{
                width: 36, fontSize: 11, textAlign: 'right',
                color: 'var(--color-text-tertiary)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {ch.rmsDb === -Infinity ? '–∞' : ch.rmsDb.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
