import { OrganismControls }       from './OrganismControls'
import { OrganismVisualizer }     from './OrganismVisualizer'
import { InputSourceSelector }    from './InputSourceSelector'
import { useOrganism }            from './OrganismContext'
import { useOrganismShortcuts }   from './useOrganismShortcuts'

export function OrganismPage() {
  useOrganismShortcuts()
  const {
    lastSessionDNA,
    inputSource,
    setInputSource,
    autoEnergy,
    setAutoEnergy,
    isRunning,
  } = useOrganism()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--color-background-primary)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
      }}>
        <h1 style={{
          fontSize: 20, fontWeight: 500,
          color: 'var(--color-text-primary)',
          margin: 0,
        }}>
          Hip-Hop Organism
        </h1>
        <p style={{
          fontSize: 13, color: 'var(--color-text-secondary)',
          margin: '4px 0 0',
        }}>
          Voice, MIDI, audio file, or auto — the organism reacts and creates.
        </p>
      </div>

      {/* Controls */}
      <OrganismControls />

      {/* Main content: visualizer + sidebar */}
      <div style={{
        flex: 1, overflow: 'auto',
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 0,
      }}>
        {/* Visualizer */}
        <div style={{ borderRight: '0.5px solid var(--color-border-tertiary)' }}>
          <OrganismVisualizer />
        </div>

        {/* Sidebar: input source + session info */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Input source selector */}
          <InputSourceSelector
            current={inputSource}
            onChange={setInputSource}
            disabled={isRunning}
            autoEnergy={autoEnergy}
            onAutoEnergyChange={setAutoEnergy}
          />

          {/* Divider */}
          <div style={{
            height: 1,
            background: 'var(--color-border-tertiary)',
          }} />

          {/* Last session */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              marginBottom: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
            }}>
              Last Session
            </div>

            {lastSessionDNA ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Mode </span>
                  {lastSessionDNA.dominantMode}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Avg BPM </span>
                  {lastSessionDNA.avgPulse.toFixed(1)}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Time in flow </span>
                  {Math.round(lastSessionDNA.timeInFlowMs / 1000)}s
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Flow % </span>
                  {Math.round(lastSessionDNA.flowPercentage * 100)}%
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Energy </span>
                  {lastSessionDNA.energyProfile}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                No session captured yet. Hit Capture after freestyling.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
