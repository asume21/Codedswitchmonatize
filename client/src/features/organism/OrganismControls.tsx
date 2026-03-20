import { useOrganism } from './OrganismContext'

export function OrganismControls() {
  const {
    start, stop, capture, downloadMidi,
    isRunning, isCapturing, error,
    lastSessionDNA,
    transcription,
    transcriptionEnabled,
    setTranscriptionEnabled,
    copyLyrics,
    exportLyrics,
  } = useOrganism()

  const hasLyrics = (transcription?.lines.length ?? 0) > 0

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
          padding: '7px 22px',
          borderRadius: 'var(--border-radius-md)',
          border: isRunning
            ? '1px solid #ef4444'
            : '1px solid #22c55e',
          background: isRunning
            ? 'rgba(239, 68, 68, 0.15)'
            : 'rgba(34, 197, 94, 0.15)',
          color: isRunning ? '#f87171' : '#4ade80',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: '0.02em',
        }}
      >
        {isRunning ? '⏹ Stop' : '▶ Start'}
      </button>

      {/* Capture */}
      <button
        onClick={() => capture()}
        disabled={!isRunning || isCapturing}
        style={{
          padding: '7px 18px',
          borderRadius: 'var(--border-radius-md)',
          border: '1px solid rgba(34, 211, 238, 0.4)',
          background: 'rgba(34, 211, 238, 0.1)',
          color: '#22d3ee',
          cursor: isRunning && !isCapturing ? 'pointer' : 'not-allowed',
          opacity: isRunning && !isCapturing ? 1 : 0.4,
          fontWeight: 500,
          fontSize: 13,
        }}
      >
        {isCapturing ? 'Saving...' : 'Capture'}
      </button>

      {/* Download MIDI */}
      {lastSessionDNA && (
        <button
          onClick={downloadMidi}
          style={{
            padding: '7px 18px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid rgba(167, 139, 250, 0.4)',
            background: 'rgba(167, 139, 250, 0.1)',
            color: '#a78bfa',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          Download MIDI
        </button>
      )}

      {/* Transcription toggle */}
      {transcription?.isSupported && (
        <button
          onClick={() => setTranscriptionEnabled(!transcriptionEnabled)}
          style={{
            padding: '7px 14px',
            borderRadius: 'var(--border-radius-md)',
            border: transcriptionEnabled
              ? '1px solid rgba(251, 191, 36, 0.5)'
              : '1px solid rgba(100, 116, 139, 0.3)',
            background: transcriptionEnabled
              ? 'rgba(251, 191, 36, 0.12)'
              : 'transparent',
            color: transcriptionEnabled ? '#fbbf24' : 'var(--color-text-tertiary)',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          {transcriptionEnabled ? '🎤 Lyrics On' : '🎤 Lyrics Off'}
        </button>
      )}

      {/* Copy Lyrics */}
      {hasLyrics && (
        <button
          onClick={() => copyLyrics()}
          style={{
            padding: '7px 14px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          Copy Lyrics
        </button>
      )}

      {/* Export Lyrics */}
      {hasLyrics && (
        <button
          onClick={exportLyrics}
          style={{
            padding: '7px 14px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          Export .txt
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
