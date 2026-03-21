import { useRef, useEffect } from 'react'
import { OrganismControls }       from './OrganismControls'
import { OrganismVisualizer }     from './OrganismVisualizer'
import { InputSourceSelector }    from './InputSourceSelector'
import { QuickStartPanel }        from './QuickStartPanel'
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
    transcription,
  } = useOrganism()

  const lyricsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll lyrics panel to latest line
  useEffect(() => {
    lyricsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcription?.lines.length])

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

        {/* Sidebar: quick start + input source + session info */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Quick Start Panel — instant beat presets */}
          <QuickStartPanel />

          {/* Divider */}
          <div style={{
            height: 1,
            background: 'var(--color-border-tertiary)',
          }} />

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

          {/* Live Lyrics Panel */}
          {transcription?.isSupported && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600,
                color: 'var(--color-text-tertiary)',
                marginBottom: 8,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                Live Lyrics
                {transcription.isActive && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#ef4444', display: 'inline-block',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                )}
              </div>
              <div style={{
                maxHeight: 180, overflowY: 'auto',
                background: 'var(--color-background-secondary)',
                borderRadius: 8, padding: '10px 12px',
                fontSize: 13, lineHeight: 1.6,
              }}>
                {transcription.lines.length === 0 && !transcription.currentInterim ? (
                  <div style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                    {isRunning ? 'Listening for your freestyle...' : 'Start the organism to capture lyrics'}
                  </div>
                ) : (
                  <>
                    {transcription.lines.map((line, i) => (
                      <div key={i} style={{ color: 'var(--color-text-primary)', marginBottom: 2 }}>
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10, marginRight: 6 }}>
                          {line.barNumber}.
                        </span>
                        {line.text}
                      </div>
                    ))}
                    {transcription.currentInterim && (
                      <div style={{ color: 'var(--color-text-secondary)', opacity: 0.6, fontStyle: 'italic' }}>
                        {transcription.currentInterim}
                      </div>
                    )}
                    <div ref={lyricsEndRef} />
                  </>
                )}
              </div>
            </div>
          )}

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
