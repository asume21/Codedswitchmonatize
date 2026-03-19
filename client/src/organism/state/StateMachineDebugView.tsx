import React from 'react'
import { OrganismState, OState, TransitionEvent } from './types'

interface Props {
  state: OrganismState | null
  transition: TransitionEvent | null
}

const stateColors: Record<OState, string> = {
  [OState.Dormant]:   '#444',
  [OState.Awakening]: '#aa6600',
  [OState.Breathing]: '#006688',
  [OState.Flow]:      '#006600',
}

export function StateMachineDebugView({ state, transition }: Props) {
  if (!state) return <div style={{ fontFamily: 'monospace' }}>No state</div>

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, padding: 16 }}>
      <div style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 4,
        background: stateColors[state.current],
        color: '#fff',
        fontWeight: 'bold',
        marginBottom: 8,
        fontSize: 14,
      }}>
        {state.current}
      </div>
      {transition && (
        <div style={{ color: '#888', marginBottom: 8 }}>
          Last: {transition.from} → {transition.to}
        </div>
      )}
      <pre>{JSON.stringify({
        barsInState:       state.barsInState.toFixed(2),
        silenceMs:         state.silenceDurationMs.toFixed(0),
        awakeningProgress: state.awakeningProgress.toFixed(2),
        breathingWarmth:   state.breathingWarmth.toFixed(3),
        flowDepth:         state.flowDepth.toFixed(3),
        syllabicDensity:   state.syllabicDensity.toFixed(2),
        cadenceLockBars:   state.cadenceLockBars.toFixed(2),
        cadenceLocked:     state.cadenceLockAchieved,
      }, null, 2)}</pre>
    </div>
  )
}
