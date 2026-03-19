import { useOrganism } from './OrganismContext'

export function OrganismControls() {
  const {
    start, stop, capture, downloadMidi,
    isRunning, isCapturing, error,
    lastSessionDNA,
  } = useOrganism()

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
    }}>

      {/* Start / Stop */}
      <button
        onClick={isRunning ? stop : start}
        style={{
          padding: '8px 20px',
          borderRadius: 'var(--border-radius-md)',
          border: '0.5px solid var(--color-border-secondary)',
          background: isRunning
            ? 'var(--color-background-danger)'
            : 'var(--color-background-success)',
          color: isRunning
            ? 'var(--color-text-danger)'
            : 'var(--color-text-success)',
          cursor: 'pointer',
          fontWeight: 500,
          fontSize: 14,
        }}
      >
        {isRunning ? 'Stop' : 'Start'}
      </button>

      {/* Capture */}
      <button
        onClick={() => capture()}
        disabled={!isRunning || isCapturing}
        style={{
          padding: '8px 20px',
          borderRadius: 'var(--border-radius-md)',
          border: '0.5px solid var(--color-border-secondary)',
          background: 'var(--color-background-secondary)',
          color: 'var(--color-text-primary)',
          cursor: isRunning && !isCapturing ? 'pointer' : 'not-allowed',
          opacity: isRunning && !isCapturing ? 1 : 0.5,
          fontWeight: 500,
          fontSize: 14,
        }}
      >
        {isCapturing ? 'Saving...' : 'Capture'}
      </button>

      {/* Download MIDI */}
      {lastSessionDNA && (
        <button
          onClick={downloadMidi}
          style={{
            padding: '8px 20px',
            borderRadius: 'var(--border-radius-md)',
            border: '0.5px solid var(--color-border-secondary)',
            background: 'var(--color-background-secondary)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 14,
          }}
        >
          Download MIDI
        </button>
      )}

      {/* Error */}
      {error && (
        <span style={{
          fontSize: 13,
          color: 'var(--color-text-danger)',
          marginLeft: 8,
        }}>
          {error}
        </span>
      )}

      {/* Shortcut hint */}
      <span style={{
        marginLeft: 'auto',
        fontSize: 12,
        color: 'var(--color-text-tertiary)',
      }}>
        Space to start · C to capture · M for MIDI
      </span>
    </div>
  )
}
