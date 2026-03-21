import { useOrganism, useOrganismPhysics } from './OrganismContext'
import { OrganismMode } from '../../organism/physics/types'

const MODE_LABELS: Record<OrganismMode, string> = {
  [OrganismMode.Heat]:   'HEAT',
  [OrganismMode.Ice]:    'ICE',
  [OrganismMode.Smoke]:  'SMOKE',
  [OrganismMode.Gravel]: 'GRAVEL',
  [OrganismMode.Glow]:   'GLOW',
}

const MODE_COLORS: Record<OrganismMode, string> = {
  [OrganismMode.Heat]:   '#ef4444',
  [OrganismMode.Ice]:    '#3b82f6',
  [OrganismMode.Smoke]:  '#6b7280',
  [OrganismMode.Gravel]: '#f59e0b',
  [OrganismMode.Glow]:   '#22c55e',
}

export function OrganismModeIndicator() {
  const { isRunning }    = useOrganism()
  const { physicsState } = useOrganismPhysics()

  if (!isRunning || !physicsState) return null

  const mode  = physicsState.mode
  const color = MODE_COLORS[mode]

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 10px',
      borderRadius: 12,
      border: `1px solid ${color}`,
      color,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.08em',
    }}>
      <span style={{
        width: 6, height: 6,
        borderRadius: '50%',
        background: color,
      }} />
      {MODE_LABELS[mode]}
    </span>
  )
}
