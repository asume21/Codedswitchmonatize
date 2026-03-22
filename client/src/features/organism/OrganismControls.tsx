import React, { useEffect, useState } from 'react'
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
    // Feature toggles
    cadenceLockEnabled,    setCadenceLockEnabled,    cadenceSnapshot,
    callResponseEnabled,   setCallResponseEnabled,   callResponsePhase,
    dropDetectorEnabled,   setDropDetectorEnabled,   lastDropIntensity,
    vibeMatchEnabled,      setVibeMatchEnabled,       currentVibe,
    isPatternLocked,       lockPattern,               unlockPattern,
  } = useOrganism()

  const hasLyrics = (transcription?.lines.length ?? 0) > 0

  // Flash effect when a drop is detected
  const [dropFlash, setDropFlash] = useState(false)
  useEffect(() => {
    if (lastDropIntensity && lastDropIntensity > 0) {
      setDropFlash(true)
      const t = setTimeout(() => setDropFlash(false), 600)
      return () => clearTimeout(t)
    }
  }, [lastDropIntensity])

  const btnBase: React.CSSProperties = {
    padding: '7px 18px',
    borderRadius: 'var(--border-radius-md)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 13,
  }

  // Pill toggle style
  const pill = (active: boolean, activeColor: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 11px',
    borderRadius: 999,
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 12,
    border: active ? `1px solid ${activeColor}55` : '1px solid rgba(100,116,139,0.25)',
    background: active ? `${activeColor}18` : 'transparent',
    color: active ? activeColor : 'var(--color-text-tertiary)',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
  })

  const dot = (color: string): React.CSSProperties => ({
    width: 6, height: 6, borderRadius: '50%',
    background: color,
    flexShrink: 0,
    animation: 'pulse 1.5s ease-in-out infinite',
  })

  return (
    <div style={{
      borderBottom: '0.5px solid var(--color-border-tertiary)',
    }}>

      {/* ── Row 1: Transport + session actions ───────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '10px 16px',
        flexWrap: 'wrap',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
      }}>

        {/* Start / Stop */}
        <button
          onClick={isRunning ? stop : start}
          style={{
            ...btnBase,
            padding: '7px 22px',
            fontWeight: 600,
            letterSpacing: '0.02em',
            border: isRunning ? '1px solid #ef4444' : '1px solid #22c55e',
            background: isRunning ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            color: isRunning ? '#f87171' : '#4ade80',
          }}
        >
          {isRunning ? '⏹ Stop' : '▶ Start'}
        </button>

        {/* Record */}
        <button
          onClick={isRecording ? () => stopRecording() : startRecording}
          style={{
            ...btnBase,
            border: isRecording ? '1px solid #ef4444' : '1px solid #f97316',
            background: isRecording ? 'rgba(239,68,68,0.2)' : 'rgba(249,115,22,0.12)',
            color: isRecording ? '#f87171' : '#fb923c',
            animation: isRecording ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}
          title={isRecording
            ? 'Stop recording — saves beat + vocals + MIDI + lyrics'
            : 'Record everything — beat, vocals, MIDI, and lyrics'}
        >
          {isRecording ? '⏹ Save Recording' : '⏺ Record'}
        </button>

        {/* Capture */}
        <button
          onClick={() => capture()}
          disabled={!isRunning || isCapturing}
          style={{
            ...btnBase,
            border: '1px solid rgba(34,211,238,0.4)',
            background: 'rgba(34,211,238,0.1)',
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
              border: '1px solid rgba(167,139,250,0.4)',
              background: 'rgba(167,139,250,0.1)',
              color: '#a78bfa',
            }}
          >
            MIDI
          </button>
        )}

        {/* Download session */}
        {lastSavedSession && (
          <button
            onClick={() => downloadSession(lastSavedSession)}
            style={{
              ...btnBase,
              border: '1px solid rgba(34,211,238,0.4)',
              background: 'rgba(34,211,238,0.08)',
              color: '#67e8f9',
            }}
            title="Download last recorded session: beat + vocals + MIDI + lyrics"
          >
            ⬇ Session
          </button>
        )}

        <div style={{ width: 1, height: 20, background: 'var(--color-border-tertiary)', margin: '0 4px' }} />

        {/* Transcription toggle */}
        {transcription?.isSupported && (
          <button
            onClick={() => setTranscriptionEnabled(!transcriptionEnabled)}
            style={{
              ...btnBase,
              padding: '7px 14px',
              border: transcriptionEnabled
                ? '1px solid rgba(251,191,36,0.5)'
                : '1px solid rgba(100,116,139,0.3)',
              background: transcriptionEnabled ? 'rgba(251,191,36,0.12)' : 'transparent',
              color: transcriptionEnabled ? '#fbbf24' : 'var(--color-text-tertiary)',
            }}
          >
            {transcriptionEnabled ? '🎤 Lyrics On' : '🎤 Lyrics Off'}
          </button>
        )}

        {hasLyrics && (
          <>
            <button
              onClick={() => copyLyrics()}
              style={{ ...btnBase, padding: '7px 14px', border: '1px solid rgba(148,163,184,0.3)', background: 'transparent', color: 'var(--color-text-secondary)' }}
            >
              Copy Lyrics
            </button>
            <button
              onClick={exportLyrics}
              style={{ ...btnBase, padding: '7px 14px', border: '1px solid rgba(148,163,184,0.3)', background: 'transparent', color: 'var(--color-text-secondary)' }}
            >
              Export .txt
            </button>
          </>
        )}

        {error && (
          <span style={{ fontSize: 13, color: 'var(--color-text-danger)', marginLeft: 8 }}>
            {error}
          </span>
        )}

        {isRecording ? (
          <span style={{
            marginLeft: 'auto', fontSize: 11, color: '#ef4444', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s ease-in-out infinite' }} />
            RECORDING — Beat + Vocals + MIDI + Lyrics
          </span>
        ) : (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            Space · R · C · M
          </span>
        )}
      </div>

      {/* ── Row 2: Feature toggles ─────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        padding: '7px 16px',
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
          letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          marginRight: 4, flexShrink: 0,
        }}>
          Features
        </span>

        {/* Cadence Lock */}
        <button
          onClick={() => setCadenceLockEnabled(!cadenceLockEnabled)}
          style={pill(cadenceLockEnabled, '#a78bfa')}
          title="Cadence Lock — nudges BPM to match your syllable rhythm"
        >
          {cadenceLockEnabled && <span style={dot('#a78bfa')} />}
          🎯 Cadence Lock
          {cadenceLockEnabled && cadenceSnapshot?.smoothedBpm && (
            <span style={{ fontSize: 10, opacity: 0.8 }}>
              {cadenceSnapshot.smoothedBpm.toFixed(0)}
            </span>
          )}
        </button>

        {/* Call & Response */}
        <button
          onClick={() => setCallResponseEnabled(!callResponseEnabled)}
          style={pill(callResponseEnabled, '#34d399')}
          title="Call & Response — melody answers when you pause"
        >
          {callResponseEnabled && callResponsePhase !== 'idle' && (
            <span style={dot(callResponsePhase === 'responding' ? '#34d399' : '#6ee7b7')} />
          )}
          🎵 Call &amp; Response
          {callResponseEnabled && callResponsePhase !== 'idle' && (
            <span style={{ fontSize: 10, opacity: 0.8, textTransform: 'capitalize' as const }}>
              {callResponsePhase}
            </span>
          )}
        </button>

        {/* Drop Detector */}
        <button
          onClick={() => setDropDetectorEnabled(!dropDetectorEnabled)}
          style={{
            ...pill(dropDetectorEnabled, dropFlash ? '#f59e0b' : '#fb923c'),
            ...(dropFlash ? { boxShadow: '0 0 10px rgba(245,158,11,0.5)' } : {}),
          }}
          title="Drop Detector — detects energy spikes and triggers arrangement drops"
        >
          {dropDetectorEnabled && <span style={dot(dropFlash ? '#f59e0b' : '#fb923c')} />}
          💥 Drop Detect
          {dropFlash && <span style={{ fontSize: 10 }}>DROP!</span>}
        </button>

        {/* Vibe Match */}
        <button
          onClick={() => setVibeMatchEnabled(!vibeMatchEnabled)}
          style={pill(vibeMatchEnabled, '#38bdf8')}
          title="Vibe Match — classifies your beat genre and announces vibe changes"
        >
          {vibeMatchEnabled && currentVibe && <span style={dot('#38bdf8')} />}
          🎭 Vibe Match
          {vibeMatchEnabled && currentVibe && (
            <span style={{ fontSize: 10, opacity: 0.9, fontWeight: 600 }}>
              {currentVibe.genre}
            </span>
          )}
        </button>

        {/* Pattern Lock */}
        <button
          onClick={isPatternLocked ? unlockPattern : lockPattern}
          style={pill(isPatternLocked, '#f472b6')}
          title={isPatternLocked ? 'Pattern locked — click to unlock and let it evolve again' : 'Lock the current drum groove so it loops unchanged'}
        >
          {isPatternLocked ? '🔒' : '🔓'} Pattern
          {isPatternLocked && <span style={{ fontSize: 10, opacity: 0.8 }}>Locked</span>}
        </button>
      </div>
    </div>
  )
}
