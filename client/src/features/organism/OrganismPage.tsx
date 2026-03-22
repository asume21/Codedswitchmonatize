import { useRef, useEffect, useState } from 'react'
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
    // Tweak controls
    hatDensity,  setHatDensity,
    kickVelocity, setKickVelocity,
    bassVolume,   setBassVolume,
    melodyVolume, setMelodyVolume,
    // Report card
    lastReport, generateReport,
  } = useOrganism()

  const lyricsEndRef = useRef<HTMLDivElement>(null)
  const [showReport, setShowReport] = useState(false)

  // Auto-scroll lyrics panel to latest line
  useEffect(() => {
    lyricsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcription?.lines.length])

  // Auto-show report card when organism stops and report exists
  useEffect(() => {
    if (!isRunning && lastReport) setShowReport(true)
  }, [isRunning, lastReport])

  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 8,
  }

  const divider = (
    <div style={{ height: 1, background: 'var(--color-border-tertiary)' }} />
  )

  // Render a simple range slider row
  const tweakSlider = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    color: string,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', width: 72, flexShrink: 0 }}>
        {label}
      </span>
      <input
        type="range"
        min={0} max={2} step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: color, height: 3, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 28, textAlign: 'right' }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  )

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--color-background-primary)',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
          Hip-Hop Organism
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
          Voice, MIDI, audio file, or auto — the organism reacts and creates.
        </p>
      </div>

      {/* Controls (2 rows) */}
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

        {/* Sidebar */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

          {/* Quick Start Panel */}
          <QuickStartPanel />

          {divider}

          {/* Input source selector */}
          <InputSourceSelector
            current={inputSource}
            onChange={setInputSource}
            disabled={isRunning}
            autoEnergy={autoEnergy}
            onAutoEnergyChange={setAutoEnergy}
          />

          {divider}

          {/* Tweak controls — visible when running */}
          {isRunning && (
            <>
              <div>
                <div style={sectionLabel}>Tweaks</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tweakSlider('Hat density', hatDensity,  setHatDensity,  '#a78bfa')}
                  {tweakSlider('Kick vel.',   kickVelocity, setKickVelocity, '#f472b6')}
                  {tweakSlider('Bass vol.',   bassVolume,   setBassVolume,   '#34d399')}
                  {tweakSlider('Melody vol.', melodyVolume, setMelodyVolume, '#38bdf8')}
                </div>
              </div>
              {divider}
            </>
          )}

          {/* Live Lyrics Panel */}
          {transcription?.isSupported && (
            <>
              <div>
                <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
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
                      {transcription.lines.map((line) => (
                        <div key={line.barNumber} style={{ color: 'var(--color-text-primary)', marginBottom: 2 }}>
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
              {divider}
            </>
          )}

          {/* Freestyle Report Card — shown after session ends */}
          {lastReport && !isRunning && (
            <>
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10,
                }}>
                  <div style={sectionLabel}>Report Card</div>
                  <button
                    onClick={() => generateReport()}
                    style={{
                      fontSize: 10, padding: '3px 8px',
                      border: '0.5px solid var(--color-border-secondary)',
                      borderRadius: 'var(--border-radius-sm)',
                      background: 'transparent',
                      color: 'var(--color-text-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    Refresh
                  </button>
                </div>

                {/* Grade badge */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  borderRadius: 'var(--border-radius-md)',
                  background: 'var(--color-background-secondary)',
                  marginBottom: 10,
                }}>
                  <div style={{
                    fontSize: 32, fontWeight: 800,
                    color: lastReport.overallScore >= 80 ? '#4ade80'
                         : lastReport.overallScore >= 60 ? '#fbbf24'
                         : '#f87171',
                    lineHeight: 1,
                  }}>
                    {lastReport.grade}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {lastReport.overallScore}/100
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      {Math.round(lastReport.durationMs / 1000)}s · {lastReport.totalLines} bars · {lastReport.wordsPerMinute} WPM
                    </div>
                  </div>
                </div>

                {/* Key stats grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: 6, marginBottom: 10,
                }}>
                  {[
                    { label: 'Syllables/beat', value: lastReport.syllablesPerBeat.toFixed(2) },
                    { label: 'Cadence',        value: `${Math.round(lastReport.cadenceConsistency * 100)}%` },
                    { label: 'Bar streak',     value: lastReport.longestBarStreak },
                    { label: 'Silence',        value: `${Math.round(lastReport.silenceRatio * 100)}%` },
                    { label: 'Unique words',   value: lastReport.uniqueWords },
                    { label: 'Drops triggered', value: lastReport.dropsTriggered },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      padding: '6px 8px',
                      background: 'var(--color-background-secondary)',
                      borderRadius: 'var(--border-radius-sm)',
                    }}>
                      <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Strengths */}
                {lastReport.strengths.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {lastReport.strengths.map((s, i) => (
                      <div key={i} style={{
                        fontSize: 11, color: '#4ade80',
                        display: 'flex', alignItems: 'flex-start', gap: 5,
                        marginBottom: 3,
                      }}>
                        <span>✓</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Improvements */}
                {lastReport.improvements.length > 0 && (
                  <div>
                    {lastReport.improvements.map((s, i) => (
                      <div key={i} style={{
                        fontSize: 11, color: '#fbbf24',
                        display: 'flex', alignItems: 'flex-start', gap: 5,
                        marginBottom: 3,
                      }}>
                        <span>→</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {divider}
            </>
          )}

          {/* Last Session DNA (only if no report available) */}
          {!lastReport && (
            <div>
              <div style={{ ...sectionLabel, marginBottom: 12 }}>Last Session</div>
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
                  <div>
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
          )}

        </div>
      </div>
    </div>
  )
}
