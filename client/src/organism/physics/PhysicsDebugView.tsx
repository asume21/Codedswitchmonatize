import React from 'react'
import { type PhysicsState, OrganismMode } from './types'

interface Props { state: PhysicsState | null }

const modeColors: Record<OrganismMode, string> = {
  [OrganismMode.Heat]:   '#ff4444',
  [OrganismMode.Ice]:    '#44aaff',
  [OrganismMode.Smoke]:  '#aa88ff',
  [OrganismMode.Gravel]: '#aa7744',
  [OrganismMode.Glow]:   '#44ffaa',
}

export function PhysicsDebugView({ state }: Props) {
  if (!state) return <div style={{ fontFamily: 'monospace' }}>No physics state</div>

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, padding: 16 }}>
      <div style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        background: modeColors[state.mode],
        color: '#000',
        marginBottom: 8,
        fontWeight: 'bold',
      }}>
        {state.mode.toUpperCase()}
      </div>
      <pre>{JSON.stringify({
        pulse:    state.pulse.toFixed(1)              + ' BPM',
        bounce:   state.bounce.toFixed(3),
        swing:    state.swing.toFixed(3),
        pocket:   state.pocket.toFixed(3),
        presence: state.presence.toFixed(3),
        density:  state.density.toFixed(3),
        beatMs:   state.beatDurationMs.toFixed(1)     + ' ms',
        '16thMs': state.sixteenthDurationMs.toFixed(1) + ' ms',
      }, null, 2)}</pre>
    </div>
  )
}
