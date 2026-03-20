import React from 'react'
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
    isRecording,
    startRecording,
    stopRecording,
    lastSavedSession,
    downloadSession,
  } = useOrganism()

  const hasLyrics = (transcription?.lines.length ?? 0) > 0

  const btnBase: React.CSSProperties = {
    padding: '7px 18px',
    borderRadius: 'var(--border-radius-md)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 13,
  }

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
      flexWrap: 'wrap',
    }}>

      {/* Start / Stop */}
      <button
        onClick={isRunning ? stop : start}
        style={{
          ...btnBase,
          padding: '7px 22px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          border: isRunning
            ? '1px solid #ef4444'
            : '1px solid #22c55e',
          background: isRunning
            ? 'rgba(239, 68, 68, 0.15)'
            : 'rgba(34, 197, 94, 0.15)',
          color: isRunning ? '#f87171' : '#4ade80',
        }}
      >
        {isRunning ? '⏹ Stop' : '▶ Start'}
      </button>

      {/* Record / Stop Recording — captures beat + vocals + MIDI + lyrics */}
      <button
        onClick={isRecording ? () => stopRecording() : startRecording}
        style={{
          ...btnBase,
          border: isRecording
            ? '1px solid #ef4444'
            : '1px solid #f97316',
          background: isRecording
            ? 'rgba(239, 68, 68, 0.2)'
            : 'rgba(249, 115, 22, 0.12)',
          color: isRecording ? '#f87171' : '#fb923c',
          animation: isRecording ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
        title={isRecording
          ? 'Stop recording — saves beat audio + vocals + MIDI + lyrics'
          : 'Record everything — beat audio, vocals, MIDI, and lyrics'}
      >
        {isRecording ? '⏹ Save Recording' : '⏺ Record'}
      </button>

      {/* Capture */}
      <button
        onClick={() => capture()}
        disabled={!isRunning || isCapturing}
        style={{
          ...btnBase,
          border: '1px solid rgba(34, 211, 238, 0.4)',
          background: 'rgba(34, 211, 238, 0.1)',
          color: '#22d3ee',
          cursor: isRunning && !isCapturing ? 'pointer' : 'not-allowed',
          opacity: isRunning && !isCapturing ? 1 : 0.4,
        }}
      >
        {isCapturing ? 'Saving...' : 'Capture'}
      </button>

      {/* Download MIDI */}
      {lastSessionDNA && (
        <button
          onClick={downloadMidi}
          style={{
            ...btnBase,
            border: '1px solid rgba(167, 139, 250, 0.4)',
            background: 'rgba(167, 139, 250, 0.1)',
            color: '#a78bfa',
          }}
        >
          MIDI
        </button>
      )}

      {/* Download last saved session (all files) */}
      {lastSavedSession && (
        <button
          onClick={() => downloadSession(lastSavedSession)}
          style={{
            ...btnBase,
            border: '1px solid rgba(34, 211, 238, 0.4)',
            background: 'rgba(34, 211, 238, 0.08)',
            color: '#67e8f9',
          }}
          title="Download last recorded session: beat + vocals + MIDI + lyrics"
        >
          ⬇ Session
        </button>
      )}

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'var(--color-border-tertiary)', margin: '0 4px' }} />

      {/* Transcription toggle */}
      {transcription?.isSupported && (
        <button
          onClick={() => setTranscriptionEnabled(!transcriptionEnabled)}
          style={{
            ...btnBase,
            padding: '7px 14px',
            border: transcriptionEnabled
              ? '1px solid rgba(251, 191, 36, 0.5)'
              : '1px solid rgba(100, 116, 139, 0.3)',
            background: transcriptionEnabled
              ? 'rgba(251, 191, 36, 0.12)'
              : 'transparent',
            color: transcriptionEnabled ? '#fbbf24' : 'var(--color-text-tertiary)',
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
            ...btnBase,
            padding: '7px 14px',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
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
            ...btnBase,
            padding: '7px 14px',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
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

      {/* Recording badge */}
      {isRecording && (
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: '#ef4444',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#ef4444',
            animation: 'pulse 1s ease-in-out infinite',
          }} />
          RECORDING — Beat + Vocals + MIDI + Lyrics
        </span>
      )}

      {/* Shortcut hint */}
      {!isRecording && (
        <span style={{
          marginLeft: 'auto',
          fontSize: 12,
          color: 'var(--color-text-tertiary)',
        }}>
          Space to start · R to record · C to capture · M for MIDI
        </span>
      )}
    </div>
  )
}
