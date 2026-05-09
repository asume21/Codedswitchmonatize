/**
 * ORGANISM COMMAND CENTER
 *
 * Unified control panel that replaces OrganismPage.
 * Everything in one place: style picker, beat shape controls,
 * flow meter, session controls, live lyrics, report card.
 *
 * Voice command (mic button) is stubbed here — wired in Feature 2.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'wouter'
import { useOrganism, useOrganismPhysics } from './OrganismContext'
import { OrganismVisualizer } from './OrganismVisualizer'
import { InputSourceSelector } from './InputSourceSelector'
import { VoiceMonitorWindow } from './VoiceMonitorWindow'
import { useOrganismShortcuts } from './useOrganismShortcuts'
import { OState } from '../../organism/state/types'
import { useStudioStore } from '../../stores/useStudioStore'
import { INSTRUMENT_PERFORMERS } from '../../organism/performers'
import type { InstrumentPerformerId, PerformerRole } from '../../organism/performers'

// ── Web Speech API local typings ───────────────────────────────────────────
// The browser's SpeechRecognition is experimental — TS lib doesn't always
// provide it, and ESLint's no-undef flags the DOM globals even when TS knows
// them. These minimal interfaces capture just the surface we use below.

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  readonly length: number
  readonly isFinal: boolean
  readonly [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionResultListLike {
  readonly length: number
  readonly [index: number]: SpeechRecognitionResultLike
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: SpeechRecognitionResultListLike
}

interface SpeechRecognitionLike {
  continuous:     boolean
  interimResults: boolean
  lang:           string
  onstart:  (() => void) | null
  onend:    (() => void) | null
  onerror:  (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start: () => void
  stop:  () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionWindow {
  SpeechRecognition?:       SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

// ── Style constants ────────────────────────────────────────────────────────────

const C = {
  bg:      'var(--color-background-primary)',
  bg2:     'var(--color-background-secondary)',
  border:  'var(--color-border-tertiary)',
  border2: 'var(--color-border-secondary)',
  borderAccent: 'var(--color-border-accent)',
  text:    'var(--color-text-primary)',
  text2:   'var(--color-text-secondary)',
  text3:   'var(--color-text-tertiary)',
  accent:  'var(--color-text-accent)',
  green:   '#4ade80',
  red:     '#f87171',
  amber:   '#fbbf24',
  cyan:    '#22d3ee',
  purple:  '#a78bfa',
} as const

const label11: React.CSSProperties = {
  fontSize: 11, fontWeight: 600,
  color: C.text3,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

// ── Slider row helper ──────────────────────────────────────────────────────────

function SliderRow({
  label, value, onChange, color = C.cyan, min = 0, max = 2, step = 0.05,
}: {
  label: string; value: number; onChange: (v: number) => void
  color?: string; min?: number; max?: number; step?: number
}) {
  const pct = Math.round(((value - min) / (max - min)) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: C.text3, width: 76, flexShrink: 0 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: color, height: 3, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 11, color: C.text2, width: 30, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  )
}

// ── Flow depth meter ───────────────────────────────────────────────────────────

function FlowMeter({ depth }: { depth: number }) {
  const pct = Math.round(depth * 100)
  const color = depth >= 0.5 ? C.green : depth >= 0.25 ? C.amber : C.cyan
  const label = depth >= 0.5 ? 'In the pocket' : depth >= 0.25 ? 'Warming up' : 'Getting started'
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ ...label11 }}>Flow</span>
        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label} · {pct}%</span>
      </div>
      <div style={{
        height: 6, borderRadius: 3,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: 'width 0.3s ease, background 0.5s ease',
        }} />
      </div>
    </div>
  )
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ active, color }: { active: boolean; color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 7, height: 7, borderRadius: '50%',
      background: active ? color : 'rgba(255,255,255,0.15)',
      boxShadow: active ? `0 0 6px ${color}` : 'none',
      transition: 'background-color 140ms ease, box-shadow 140ms ease',
      flexShrink: 0,
    }} />
  )
}

interface PillToggleProps {
  active: boolean
  label: string
  onToggle: () => void
  color: string
}

const PillToggle = React.memo(function PillToggle({
  active,
  label,
  onToggle,
  color,
}: PillToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 9px',
        borderRadius: 999,
        border: active ? `1px solid ${color}55` : '1px solid rgba(100,116,139,0.2)',
        background: active ? `${color}18` : 'transparent',
        color: active ? color : C.text3,
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background-color 140ms ease, border-color 140ms ease, color 140ms ease',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        contain: 'paint',
      }}
    >
      <StatusDot active={active} color={color} />
      {label}
    </button>
  )
})

function InstrumentSelect({
  label,
  role,
  value,
  onChange,
}: {
  label: string
  role: PerformerRole
  value: InstrumentPerformerId | null
  onChange: (id: InstrumentPerformerId | null) => void
}) {
  const options = INSTRUMENT_PERFORMERS.filter(profile => profile.roles.includes(role))
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 112, flex: '1 1 112px' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <select
        value={value ?? 'auto'}
        onChange={event => {
          const next = event.currentTarget.value
          onChange(next === 'auto' ? null : next as InstrumentPerformerId)
        }}
        style={{
          width: '100%',
          height: 28,
          borderRadius: 6,
          border: `0.5px solid ${C.border2}`,
          background: C.bg2,
          color: value ? C.cyan : C.text2,
          fontSize: 11,
          fontWeight: 700,
          padding: '0 8px',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        <option value="auto">Auto</option>
        {options.map(profile => (
          <option key={profile.id} value={profile.id}>{profile.name}</option>
        ))}
      </select>
    </label>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  ORGANISM COMMAND CENTER
// ══════════════════════════════════════════════════════════════════════════════

export function OrganismCommandCenter() {
  useOrganismShortcuts()

  const {
    start, stop, isRunning, isStarting, error,
    quickStartPresets, activePresetId, swapPreset, countInStart, countInBeat,
    soundTriggerArmed, armSoundTrigger, disarmSoundTrigger,
    isRecording, startRecording, stopRecording,
    // Tweak controls
    hatDensity,   setHatDensity,
    kickVelocity, setKickVelocity,
    bassVolume,   setBassVolume,
    melodyVolume, setMelodyVolume,
    melodyFocusEnabled, setMelodyFocusEnabled,
    instrumentAssignments, setOrganismInstrument,
    // Feature toggles
    cadenceLockEnabled, setCadenceLockEnabled,
    callResponseEnabled, setCallResponseEnabled,
    dropDetectorEnabled, setDropDetectorEnabled,
    vibeMatchEnabled, setVibeMatchEnabled,
    isPatternLocked, toggleStoryMode,
    // Transcription
    transcription,
    // Report card
    lastReport, generateReport,
    // Session
    lastSessionDNA, capture,
    shareSession, isSharingSession, lastSharedPostUrl,
    // Input
    inputSource, setInputSource, autoEnergy, setAutoEnergy,
    micMonitoringEnabled, setMicMonitoringEnabled,
    // Guest
    isGuestNudgeVisible, dismissGuestNudge,
    // Vibe
    currentVibe,
    // Vibe Interpreter
    interpretVibe,
    vibeInterpretation,
    // WOW moment
    wowMoment,
    clearWowMomentLog,
    // Engines (for direct mode + technique control)
    physicsEngine,
    orchestrator,
    reactiveBehaviors,
  } = useOrganism()

  const { physicsState, organismState } = useOrganismPhysics()

  // ── Voice command state ──────────────────────────────────────────────────
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [isListening,  setIsListening]  = useState(false)
  const [vibeText,     setVibeText]     = useState('')
  const [vibeStatus,   setVibeStatus]   = useState<'idle' | 'interpreting' | 'done'>('idle')

  // Resolve the SpeechRecognition constructor once — null when unsupported.
  const SpeechRecognitionCtor = useMemo<SpeechRecognitionCtor | null>(() => {
    if (typeof window === 'undefined') return null
    const w = window as unknown as SpeechRecognitionWindow
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
  }, [])
  const hasSpeechRecognition = SpeechRecognitionCtor !== null

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    if (!SpeechRecognitionCtor) return

    const recog = new SpeechRecognitionCtor()
    recog.continuous      = false
    recog.interimResults  = true
    recog.lang            = 'en-US'

    recog.onstart = () => {
      setIsListening(true)
      setVibeText('')
      setVibeStatus('idle')
    }
    recog.onend = () => setIsListening(false)
    recog.onerror = () => {
      setIsListening(false)
      setVibeStatus('idle')
    }

    recog.onresult = async (event: SpeechRecognitionEventLike) => {
      let interim = ''
      let final   = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) final   += r[0].transcript
        else           interim += r[0].transcript
      }
      const current = final || interim
      setVibeText(current)

      if (final) {
        setVibeStatus('interpreting')
        await interpretVibe(final.trim())
        setVibeStatus('done')
      }
    }

    recognitionRef.current = recog
    recog.start()
  }, [isListening, interpretVibe, SpeechRecognitionCtor])

  // ── Mode + Technique state ───────────────────────────────────────────────
  const [lockedMode,   setLockedMode]   = useState<string | null>(null)
  const [chordTech,    setChordTechLocal]  = useState('piano-block-chord')
  const [melodyArt,    setMelodyArtLocal]  = useState('none')
  const [bassArt,      setBassArtLocal]    = useState('none')
  const [styleShifts,  setStyleShiftsLocal] = useState(true)
  const [bpmInput,     setBpmInput]     = useState('')

  const applyMode = useCallback((mode: string | null) => {
    setLockedMode(mode)
    if (mode) physicsEngine?.lockMode(mode as import('../../organism/physics/types').OrganismMode)
    else       physicsEngine?.unlockMode()
  }, [physicsEngine])

  const applyChordTech = useCallback((id: string) => {
    setChordTechLocal(id)
    orchestrator?.setChordTechnique(id)
  }, [orchestrator])

  const applyMelodyArt = useCallback((id: string) => {
    setMelodyArtLocal(id)
    orchestrator?.setMelodyArticulation(id)
  }, [orchestrator])

  const applyBassArt = useCallback((id: string) => {
    setBassArtLocal(id)
    orchestrator?.setBassArticulation(id)
  }, [orchestrator])

  const resetChordTech = useCallback(() => {
    orchestrator?.resetChordTechniqueOverride()
  }, [orchestrator])

  const resetMelodyArt = useCallback(() => {
    orchestrator?.resetMelodyArticulationOverride()
  }, [orchestrator])

  const resetBassArt = useCallback(() => {
    orchestrator?.resetBassArticulationOverride()
  }, [orchestrator])

  // Sync local UI state with engine state
  useEffect(() => {
    const handleMusicalState = (e: any) => {
      const { chordTechnique, melodyArticulation, bassArticulation } = e.detail
      if (chordTechnique) setChordTechLocal(chordTechnique)
      if (melodyArticulation) setMelodyArtLocal(melodyArticulation)
      if (bassArticulation) setBassArtLocal(bassArticulation)
    }
    window.addEventListener('organism:musical-state', handleMusicalState)
    return () => window.removeEventListener('organism:musical-state', handleMusicalState)
  }, [])

  const toggleStyleShifts = useCallback(() => {
    const next = !styleShifts
    setStyleShiftsLocal(next)
    reactiveBehaviors?.setStyleShiftsEnabled(next)
  }, [styleShifts, reactiveBehaviors])

  const commitBpm = useCallback(() => {
    const v = parseInt(bpmInput)
    if (v >= 40 && v <= 220) {
      orchestrator?.setBpm(v)
      // Also sync the studio store BPM
      useStudioStore.getState().setBpm(v)
    }
    setBpmInput('')
  }, [bpmInput, orchestrator])

  const lyricsEndRef = useRef<HTMLDivElement>(null)
  const [shareCaption, setShareCaption] = useState('')
  const [shareConfirmed, setShareConfirmed] = useState(false)
  const [triggerPresetId, setTriggerPresetId] = useState<string>(
    () => quickStartPresets[0]?.id ?? ''
  )

  const activePreset = activePresetId
    ? quickStartPresets.find(p => p.id === activePresetId) ?? null
    : null
  const studioBpm = useStudioStore(s => s.bpm)

  const handleInstantStart = useCallback(() => {
    if (isStarting) return
    const presetId = activePresetId ?? quickStartPresets[0]?.id
    if (presetId) {
      void swapPreset(presetId)
      return
    }
    void start()
  }, [activePresetId, quickStartPresets, swapPreset, start, isStarting])

  const flowDepth  = organismState?.flowDepth ?? 0
  const currentBpm = Math.round(orchestrator?.getBpm() ?? studioBpm ?? activePreset?.bpm ?? 0)
  const countingIn = countInBeat !== null
  const startLocked = isStarting || countingIn

  const ostate = organismState?.current
  const isFlow = ostate === OState.Flow

  const handleShare = useCallback(async () => {
    const result = await shareSession(shareCaption)
    if (result) setShareConfirmed(true)
  }, [shareSession, shareCaption])

  const micMonitorBlocked = isRunning && inputSource !== 'mic'
  const handleMicMonitorToggle = useCallback(() => {
    if (micMonitoringEnabled) {
      setMicMonitoringEnabled(false)
      return
    }

    if (inputSource !== 'mic') {
      if (isRunning || isStarting) return
      setInputSource('mic')
    }
    setMicMonitoringEnabled(true)
  }, [
    inputSource,
    isRunning,
    isStarting,
    micMonitoringEnabled,
    setInputSource,
    setMicMonitoringEnabled,
  ])

  const toggleCadenceLock = useCallback(() => {
    setCadenceLockEnabled(!cadenceLockEnabled)
  }, [cadenceLockEnabled, setCadenceLockEnabled])

  const toggleCallResponse = useCallback(() => {
    setCallResponseEnabled(!callResponseEnabled)
  }, [callResponseEnabled, setCallResponseEnabled])

  const toggleDropDetector = useCallback(() => {
    setDropDetectorEnabled(!dropDetectorEnabled)
  }, [dropDetectorEnabled, setDropDetectorEnabled])

  const toggleVibeMatch = useCallback(() => {
    setVibeMatchEnabled(!vibeMatchEnabled)
  }, [setVibeMatchEnabled, vibeMatchEnabled])

  const toggleMelodyFocus = useCallback(() => {
    setMelodyFocusEnabled(!melodyFocusEnabled)
  }, [melodyFocusEnabled, setMelodyFocusEnabled])

  useEffect(() => {
    lyricsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcription?.lines.length])


  // Story Mode (formerly Pattern Lock) — toggle is on the context now.
  const isStoryMode = isPatternLocked

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundColor: '#0a0a0a', color: C.text,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* ═══ INSTANT VIBE HEADER ═══ */}
      <div style={{
        padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
        background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 15px rgba(6,182,212,0.3)',
          }}>
            <span style={{ fontSize: 18 }}>🧠</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 900, letterSpacing: -0.5 }}>AI PRODUCER</h1>
            <p style={{ margin: 0, fontSize: 10, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
              {isStarting ? 'Starting...' : isRunning ? 'Listening & Reacting' : 'Ready to Create'}
            </p>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {error && (
              <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700, maxWidth: 160 }}
                title={error}>⚠ {error.slice(0, 40)}{error.length > 40 ? '…' : ''}</span>
            )}
            {!isRunning ? (
              <button
                onClick={handleInstantStart}
                disabled={startLocked}
                style={{
                  padding: '8px 20px', borderRadius: 20, border: 'none',
                  background: startLocked ? '#334155' : C.green,
                  color: startLocked ? C.text3 : '#000',
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: startLocked ? 'not-allowed' : 'pointer',
                  boxShadow: startLocked ? 'none' : '0 4px 10px rgba(16,185,129,0.3)',
                }}
              >
                {isStarting ? 'STARTING...' : 'START ENGINE'}
              </button>
            ) : (
              <button
                onClick={stop}
                style={{
                  padding: '8px 20px', borderRadius: 20, border: `1px solid ${C.red}44`,
                  background: `${C.red}15`, color: C.red, fontWeight: 900,
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                STOP
              </button>
            )}
          </div>
        </div>

        {/* Voice/Text Vibe Input — The primary way to interact */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder={'Say something like "I\'m having a bad day" or "Dark drill vibe"...'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                interpretVibe(e.currentTarget.value)
                e.currentTarget.value = ''
              }
            }}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 12,
              background: '#1a1a1a', border: '1px solid #333',
              color: '#fff', fontSize: 14, outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          <div style={{ 
            marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap'
          }}>
            {[
              { label: 'Bad Day', text: "I'm having a bad day, play something moody" },
              { label: 'Hype Me Up', text: 'Give me something high energy and aggressive' },
              { label: 'Lofi Chill', text: 'Lo-fi chill beat for late night' },
            ].map(hint => (
              <button
                key={hint.label}
                onClick={() => interpretVibe(hint.text)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none',
                  background: '#222', color: C.text3, fontSize: 10,
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                + {hint.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 96, boxSizing: 'border-box' }}>
        {/* Guest nudge moved inside scrollable area */}
        {isGuestNudgeVisible && (
          <div style={{
            background: 'linear-gradient(90deg,#0e7490,#7c3aed)',
            padding: '8px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>
              You&apos;ve been jamming for 60s — sign up to save it forever.
            </span>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Link href="/signup">
                <button style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px',
                  background: '#fff', color: '#0e7490', borderRadius: 6, border: 'none', cursor: 'pointer',
                }}>Sign Up Free</button>
              </Link>
              <button onClick={dismissGuestNudge} style={{
                fontSize: 11, padding: '3px 7px',
                background: 'transparent', color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, cursor: 'pointer',
              }}>✕</button>
            </div>
          </div>
        )}

        <div style={{ padding: 20 }}>
          {/* Vibe Status Indicator */}
          {vibeInterpretation && (
            <div style={{
              marginBottom: 20, padding: 12, borderRadius: 8,
              background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.1)',
            }}>
              <div style={{ fontSize: 10, color: C.text3, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
                Current Intent
              </div>
              <div style={{ fontSize: 13, color: '#06b6d4', fontWeight: 600 }}>
                {vibeInterpretation.result}
              </div>
            </div>
          )}

          {/* ── Top bar removed, redundant with AI PRODUCER header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '0.04em' }}>
            ORGANISM
          </span>
          {/* State indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', borderRadius: 999,
            background: isRunning ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
            border: isRunning ? '0.5px solid rgba(34,197,94,0.25)' : '0.5px solid rgba(255,255,255,0.1)',
          }}>
            <StatusDot active={isRunning} color={C.green} />
            <span style={{ fontSize: 10, fontWeight: 600, color: isRunning ? C.green : C.text3 }}>
              {isRunning
                ? isFlow ? 'IN FLOW' : ostate?.toUpperCase() ?? 'RUNNING'
                : 'STANDBY'}
            </span>
          </div>
          {/* BPM badge */}
          {currentBpm && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: C.text2,
              padding: '2px 7px', borderRadius: 4,
              border: `0.5px solid ${C.border2}`,
              background: C.bg2,
            }}>
              {currentBpm} BPM
            </span>
          )}
          {/* Vibe label */}
          {currentVibe && isRunning && (
            <span style={{ fontSize: 10, color: C.cyan, fontWeight: 500 }}>
              {currentVibe.genre}
            </span>
          )}
        </div>

        {/* Record button */}
        <button
          onClick={isRecording
            ? () => stopRecording()
            : () => startRecording()}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 12px',
            borderRadius: 6,
            border: isRecording
              ? '1px solid rgba(239,68,68,0.5)'
              : '1px solid rgba(239,68,68,0.2)',
            background: isRecording ? 'rgba(239,68,68,0.15)' : 'transparent',
            color: isRecording ? C.red : C.text3,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            animation: isRecording ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isRecording ? C.red : C.text3,
            flexShrink: 0,
          }} />
          {isRecording ? 'REC' : 'REC'}
        </button>
      </div>

      {/* ── Main grid: left (voice + styles) | right (beat shape + tweaks) ─ */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(440px, 1fr) minmax(360px, 1fr)',
        gap: 20,
        alignItems: 'start',
      }}>

        {/* ── LEFT: Voice command + Style picker + Visualizer ─────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          minWidth: 0,
        }}>

          {/* Voice command */}
          <div style={{
            padding: '12px 14px 10px',
            borderBottom: `0.5px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ ...label11 }}>Vibe Command</span>
              {!hasSpeechRecognition && (
                <span style={{ fontSize: 9, color: C.text3 }}>Chrome only</span>
              )}
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '8px 10px',
              borderRadius: 8,
              border: isListening
                ? `0.5px solid rgba(34,211,238,0.5)`
                : `0.5px solid ${C.border2}`,
              background: isListening ? 'rgba(34,211,238,0.04)' : C.bg2,
              transition: 'all 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={toggleListening}
                  disabled={!hasSpeechRecognition}
                  title={
                    !hasSpeechRecognition ? 'Speech recognition requires Chrome'
                    : isListening ? 'Stop listening'
                    : 'Say your vibe (e.g. "dark drill beat like Kendrick")'
                  }
                  style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: isListening
                      ? 'rgba(34,211,238,0.20)'
                      : 'rgba(34,211,238,0.08)',
                    border: isListening
                      ? '1px solid rgba(34,211,238,0.60)'
                      : '1px solid rgba(34,211,238,0.20)',
                    color: C.cyan, fontSize: 14,
                    cursor: hasSpeechRecognition ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: isListening ? 'pulse 1s ease-in-out infinite' : 'none',
                    opacity: hasSpeechRecognition ? 1 : 0.5,
                  }}
                >
                  🎤
                </button>
                <span style={{
                  fontSize: 12,
                  color: isListening ? C.cyan : (vibeText ? C.text : C.text3),
                  fontStyle: (isListening || vibeText) ? 'normal' : 'italic',
                  flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {isListening
                    ? (vibeText || 'Listening…')
                    : vibeStatus === 'interpreting'
                    ? 'Interpreting…'
                    : (vibeText || '"dark drill beat like Kendrick…"')
                  }
                </span>
                {vibeText && !isListening && vibeStatus !== 'interpreting' && (
                  <button
                    onClick={() => { setVibeText(''); setVibeStatus('idle') }}
                    style={{
                      fontSize: 10, color: C.text3, background: 'transparent',
                      border: 'none', cursor: 'pointer', flexShrink: 0, padding: 2,
                    }}
                    title="Clear"
                  >✕</button>
                )}
              </div>
              {/* Interpretation result */}
              {vibeStatus === 'interpreting' && (
                <div style={{ fontSize: 10, color: C.amber, paddingLeft: 38, fontWeight: 500 }}>
                  Interpreting…
                </div>
              )}
              {vibeInterpretation && vibeStatus === 'done' && (
                <div style={{ fontSize: 10, color: C.green, paddingLeft: 38, fontWeight: 500 }}>
                  ✓ {vibeInterpretation.result}
                </div>
              )}
            </div>
          </div>

          {/* Style picker */}
          <div style={{ padding: '10px 14px 8px', flexShrink: 0 }}>
            <div style={{ ...label11, marginBottom: 8 }}>
              Style
              {isRunning && activePreset && (
                <span style={{ fontSize: 10, color: C.accent, textTransform: 'none', marginLeft: 6, letterSpacing: 0, fontWeight: 500 }}>
                  — tap to swap live
                </span>
              )}
            </div>

            {/* Count-in visual */}
            {countingIn && (
              <div style={{
                display: 'flex', gap: 6, marginBottom: 8,
                justifyContent: 'center',
              }}>
                {[1,2,3,4].map(b => (
                  <div key={b} style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14,
                    border: countInBeat === b ? '2px solid #22c55e' : '1px solid rgba(100,116,139,0.3)',
                    background: countInBeat === b ? 'rgba(34,197,94,0.2)' : 'transparent',
                    color: countInBeat === b ? C.green : C.text3,
                    transform: countInBeat === b ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.1s ease',
                  }}>
                    {b}
                  </div>
                ))}
              </div>
            )}

            {/* Preset grid */}
            {!countingIn && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: 5,
              }}>
                {quickStartPresets.map(preset => {
                  const active = preset.id === activePresetId
                  return (
                    <button
                      key={preset.id}
                      onClick={() => swapPreset(preset.id)}
                      disabled={isStarting}
                      title={`${preset.genre} · ${preset.bpm} BPM`}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 2, padding: '8px 4px 6px',
                        borderRadius: 8,
                        border: active
                          ? `1.5px solid ${C.borderAccent}`
                          : `0.5px solid ${C.border2}`,
                        background: active
                          ? 'var(--color-background-accent-subtle)'
                          : C.bg2,
                        color: C.text,
                        cursor: isStarting ? 'not-allowed' : 'pointer',
                        opacity: isStarting ? 0.55 : 1,
                        fontSize: 10, fontWeight: 500,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (!active && !isStarting) {
                          e.currentTarget.style.border = `1.5px solid ${C.borderAccent}`
                          e.currentTarget.style.background = 'var(--color-background-accent-subtle)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active && !isStarting) {
                          e.currentTarget.style.border = `0.5px solid ${C.border2}`
                          e.currentTarget.style.background = C.bg2
                        }
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{preset.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 10 }}>{preset.label}</span>
                      <span style={{ fontSize: 9, color: C.text3 }}>{preset.bpm} BPM</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Alternate start modes (cold start only) */}
            {!isRunning && (
              <div style={{
                marginTop: 8,
                display: 'flex', flexDirection: 'column', gap: 5,
                borderTop: `0.5px solid ${C.border}`,
                paddingTop: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: C.text3, flexShrink: 0 }}>Preset:</span>
                  <select
                    value={triggerPresetId}
                    onChange={e => setTriggerPresetId(e.target.value)}
                    disabled={startLocked}
                    style={{
                      flex: 1, fontSize: 11, padding: '3px 6px',
                      borderRadius: 4,
                      border: `0.5px solid ${C.border2}`,
                      background: C.bg2, color: C.text,
                      cursor: startLocked ? 'not-allowed' : 'pointer',
                      opacity: startLocked ? 0.6 : 1,
                    }}
                  >
                    {quickStartPresets.map(p => (
                      <option key={p.id} value={p.id}>{p.icon} {p.label} — {p.bpm} BPM</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => countInStart(triggerPresetId)}
                  disabled={startLocked}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: countingIn ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(34,197,94,0.25)',
                    background: countingIn ? 'rgba(34,197,94,0.15)' : 'transparent',
                    color: countingIn ? C.green : C.text2,
                    cursor: startLocked ? 'not-allowed' : 'pointer',
                    fontSize: 11, fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span>🎙</span>
                  <span>{countingIn ? `Listening… beat ${countInBeat}` : 'Count-In Start'}</span>
                  <span style={{ fontSize: 9, color: C.text3, marginLeft: 'auto' }}>say "1 2 3 4"</span>
                </button>
                <button
                  onClick={soundTriggerArmed ? disarmSoundTrigger : () => armSoundTrigger(triggerPresetId)}
                  disabled={isStarting && !soundTriggerArmed}
                  style={{
                    padding: '6px 8px', borderRadius: 6,
                    border: soundTriggerArmed ? '1px solid rgba(249,115,22,0.6)' : '1px solid rgba(249,115,22,0.25)',
                    background: soundTriggerArmed ? 'rgba(249,115,22,0.15)' : 'transparent',
                    color: soundTriggerArmed ? '#fb923c' : C.text2,
                    cursor: isStarting && !soundTriggerArmed ? 'not-allowed' : 'pointer',
                    opacity: isStarting && !soundTriggerArmed ? 0.55 : 1,
                    fontSize: 11, fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 5,
                    animation: soundTriggerArmed ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  }}
                >
                  <span>🎯</span>
                  <span>{soundTriggerArmed ? 'Armed — make a sound!' : 'Sound Trigger'}</span>
                  <span style={{ fontSize: 9, color: C.text3, marginLeft: 'auto' }}>
                    {soundTriggerArmed ? 'tap to disarm' : 'any loud sound'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Visualizer — fills remaining space */}
          <div style={{
            flex: 1, overflow: 'auto',
            borderTop: `0.5px solid ${C.border}`,
          }}>
            <OrganismVisualizer />
          </div>

          <div style={{
            borderTop: `0.5px solid ${C.border}`,
            padding: '10px 12px',
            background: 'rgba(2,6,23,0.78)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ ...label11, color: C.cyan }}>Organism Thinking</div>
              <button
                type="button"
                onClick={clearWowMomentLog}
                style={{
                  border: `0.5px solid ${C.border2}`,
                  background: 'transparent',
                  color: C.text3,
                  borderRadius: 5,
                  padding: '2px 6px',
                  fontSize: 9,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                CLEAR
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
              {([
                ['drums', 'Drums', C.amber],
                ['bass', 'Bass', C.green],
                ['harmony', 'Harmony', C.purple],
              ] as const).map(([key, label, color]) => {
                const active = wowMoment.engines[key]
                return (
                  <div
                    key={key}
                    style={{
                      border: `0.5px solid ${active ? color : C.border2}`,
                      background: active ? `${color}1f` : C.bg2,
                      color: active ? color : C.text3,
                      borderRadius: 6,
                      padding: '6px 7px',
                      fontSize: 11,
                      fontWeight: 800,
                      textAlign: 'center',
                      boxShadow: active ? `0 0 14px ${color}33` : 'none',
                      transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
                    }}
                  >
                    {label}
                  </div>
                )
              })}
            </div>

            <div style={{
              minHeight: 92,
              maxHeight: 120,
              overflow: 'auto',
              border: `0.5px solid ${C.border2}`,
              background: '#020617',
              borderRadius: 6,
              padding: '7px 9px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 10,
              lineHeight: 1.55,
            }}>
              {wowMoment.logs.length === 0 ? (
                <div style={{ color: C.text3 }}>
                  &gt; say boom boom clap
                </div>
              ) : (
                wowMoment.logs.map(entry => (
                  <div
                    key={entry.id}
                    style={{
                      color: entry.tone === 'pulse'
                        ? C.amber
                        : entry.tone === 'sync'
                          ? C.cyan
                          : entry.tone === 'wake'
                            ? C.green
                            : C.text2,
                    }}
                  >
                    &gt; {entry.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: controls ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          minWidth: 0,
        }}>

          {/* ── Pinned transport bar — always visible ─────────────────── */}
          <div style={{
            padding: '8px 14px',
            borderBottom: `0.5px solid ${C.border}`,
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {/* Flow meter inline */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <FlowMeter depth={flowDepth} />
            </div>
            {/* Transport buttons */}
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              {!isRunning ? (
                <button
                  onClick={handleInstantStart}
                  disabled={startLocked}
                  style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: startLocked ? '#1f2937' : '#166534',
                    color: startLocked ? C.text3 : C.green,
                    border: '1px solid rgba(34,197,94,0.3)',
                    cursor: startLocked ? 'not-allowed' : 'pointer',
                  }}
                >{isStarting ? 'Starting...' : '▶ Start'}</button>
              ) : (
                <button
                  onClick={stop}
                  style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: 'rgba(239,68,68,0.15)', color: C.red,
                    border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                  }}
                >⏹ Stop</button>
              )}
              <button
                onClick={isRecording ? () => stopRecording() : () => startRecording()}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: isRecording ? 'rgba(239,68,68,0.15)' : 'transparent',
                  color: isRecording ? C.red : C.text2,
                  border: isRecording ? '1px solid rgba(239,68,68,0.4)' : `1px solid ${C.border2}`,
                  cursor: 'pointer',
                  animation: isRecording ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}
              >{isRecording ? '⏺ REC' : '⏺ REC'}</button>
              <button
                onClick={() => capture()}
                style={{
                  padding: '5px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: 'transparent', color: C.text2,
                  border: `1px solid ${C.border2}`, cursor: 'pointer',
                }}
                title="Capture session DNA"
              >💾</button>
            </div>
          </div>

          {/* ── Scrollable sections ───────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Beat shape: tweak sliders */}
          <div style={{
            padding: '12px 14px 10px',
            borderBottom: `0.5px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <div style={{ ...label11, marginBottom: 10 }}>Beat Shape</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SliderRow label="Hat density"  value={hatDensity}   onChange={setHatDensity}   color={C.purple} />
              <SliderRow label="Kick vel."    value={kickVelocity} onChange={setKickVelocity} color='#f472b6' />
              <SliderRow label="Bass vol."    value={bassVolume}   onChange={setBassVolume}   color={C.green} />
              <SliderRow label="Melody vol."  value={melodyVolume} onChange={setMelodyVolume} color='#38bdf8' />
            </div>
          </div>

          {/* Organism Mode + BPM */}
          <div style={{
            padding: '10px 14px 8px',
            borderBottom: `0.5px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ ...label11 }}>Mode</span>
              {/* BPM manual input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: C.text3 }}>BPM</span>
                <input
                  type="number" min={40} max={220}
                  value={bpmInput || (currentBpm || '')}
                  onChange={e => setBpmInput(e.target.value)}
                  onBlur={commitBpm}
                  onKeyDown={e => { if (e.key === 'Enter') commitBpm() }}
                  style={{
                    width: 52, height: 24, borderRadius: 5, textAlign: 'center',
                    border: `0.5px solid ${C.border2}`, background: C.bg2,
                    color: C.text, fontSize: 11, fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
            {/* Mode buttons — Heat / Ice / Smoke / Gravel / Glow + Auto */}
            {(() => {
              const MODES = [
                { key: 'heat',   label: 'Heat',   color: '#f87171' },
                { key: 'ice',    label: 'Ice',    color: '#93c5fd' },
                { key: 'smoke',  label: 'Smoke',  color: '#d1d5db' },
                { key: 'gravel', label: 'Gravel', color: '#fbbf24' },
                { key: 'glow',   label: 'Glow',   color: '#6ee7b7' },
              ]
              const currentMode = (physicsState?.mode as string) ?? lockedMode
              return (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {MODES.map(m => {
                    const active = currentMode === m.key
                    return (
                      <button
                        key={m.key}
                        onClick={() => applyMode(m.key)}
                        style={{
                          padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                          cursor: 'pointer',
                          border: active ? `1px solid ${m.color}55` : `1px solid rgba(100,116,139,0.2)`,
                          background: active ? `${m.color}18` : 'transparent',
                          color: active ? m.color : C.text3,
                          transition: 'all 0.15s',
                        }}
                      >{m.label}</button>
                    )
                  })}
                  <button
                    onClick={() => applyMode(null)}
                    style={{
                      padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                      cursor: 'pointer',
                      border: lockedMode === null ? `1px solid ${C.cyan}55` : `1px solid rgba(100,116,139,0.2)`,
                      background: lockedMode === null ? `${C.cyan}18` : 'transparent',
                      color: lockedMode === null ? C.cyan : C.text3,
                      transition: 'all 0.15s',
                    }}
                  >Auto</button>
                </div>
              )
            })()}
          </div>

          {/* Playing Style: chord technique + articulations + style shifts */}
          <div style={{
            padding: '10px 14px 8px',
            borderBottom: `0.5px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ ...label11 }}>Playing Style</span>
              {/* Style Shifts toggle */}
              <button
                onClick={toggleStyleShifts}
                style={{
                  padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 600,
                  cursor: 'pointer',
                  border: styleShifts ? `1px solid ${C.green}55` : `1px solid rgba(100,116,139,0.2)`,
                  background: styleShifts ? `${C.green}18` : 'transparent',
                  color: styleShifts ? C.green : C.text3,
                  letterSpacing: '0.05em',
                }}
                title="Auto style-shifts — reactive engine adapts technique based on rapper energy"
              >
                {styleShifts ? 'AUTO SHIFTS' : 'MANUAL'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Chord technique */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: C.text3, width: 62, flexShrink: 0 }}>Chords</span>
                <select
                  value={chordTech}
                  onChange={e => applyChordTech(e.target.value)}
                  style={{
                    flex: 1, height: 26, borderRadius: 5, fontSize: 10,
                    border: `0.5px solid ${C.border2}`, background: C.bg2,
                    color: C.text, paddingLeft: 6, outline: 'none',
                  }}
                >
                  <optgroup label="Piano">
                    <option value="piano-block-chord">Block Chord</option>
                    <option value="piano-rolled-chord">Rolled Chord</option>
                    <option value="piano-alberti">Alberti 1-5-3-5</option>
                    <option value="piano-sustained-pad">Sustained Pad</option>
                  </optgroup>
                  <optgroup label="Guitar">
                    <option value="guitar-strum-down">Strum Down</option>
                    <option value="guitar-strum-up">Strum Up</option>
                    <option value="guitar-arp-rolled">Arpeggio Rolled</option>
                    <option value="guitar-muted-stab">Muted Stab</option>
                  </optgroup>
                  <optgroup label="Strings">
                    <option value="strings-pizzicato">Strings Pizzicato</option>
                    <option value="strings-legato">Strings Legato</option>
                    <option value="strings-tremolo">Tremolo</option>
                    <option value="strings-staccato">Staccato</option>
                  </optgroup>
                  <optgroup label="Brass">
                    <option value="brass-stab">Brass Stab</option>
                    <option value="brass-swell">Swell</option>
                    <option value="brass-fanfare">Fanfare</option>
                    <option value="brass-section-pad">Section Pad</option>
                  </optgroup>
                  <optgroup label="Wind">
                    <option value="wind-legato">Wind Legato</option>
                    <option value="wind-run">Scalar Run</option>
                    <option value="wind-staccato">Wind Staccato</option>
                    <option value="wind-trill">Trill</option>
                  </optgroup>
                </select>
                <button
                  onClick={resetChordTech}
                  style={{
                    fontSize: 9, fontWeight: 700, padding: '4px 6px',
                    borderRadius: 4, border: `0.5px solid ${C.border2}`,
                    background: C.bg2, color: C.cyan, cursor: 'pointer',
                  }}
                  title="Reset to Mode Auto"
                >AUTO</button>
              </div>
              {/* Melody articulation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: C.text3, width: 62, flexShrink: 0 }}>Melody</span>
                <select
                  value={melodyArt}
                  onChange={e => applyMelodyArt(e.target.value)}
                  style={{
                    flex: 1, height: 26, borderRadius: 5, fontSize: 10,
                    border: `0.5px solid ${C.border2}`, background: C.bg2,
                    color: C.text, paddingLeft: 6, outline: 'none',
                  }}
                >
                  <option value="none">Straight</option>
                  <option value="legato-slur">Legato Slur</option>
                  <option value="staccato-pop">Staccato Pop</option>
                  <option value="grace-flick">Grace-Note Flick</option>
                  <option value="trill-ornament">Trill Ornament</option>
                </select>
                <button
                  onClick={resetMelodyArt}
                  style={{
                    fontSize: 9, fontWeight: 700, padding: '4px 6px',
                    borderRadius: 4, border: `0.5px solid ${C.border2}`,
                    background: C.bg2, color: C.cyan, cursor: 'pointer',
                  }}
                  title="Reset to Mode Auto"
                >AUTO</button>
              </div>
              {/* Bass articulation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: C.text3, width: 62, flexShrink: 0 }}>Bass</span>
                <select
                  value={bassArt}
                  onChange={e => applyBassArt(e.target.value)}
                  style={{
                    flex: 1, height: 26, borderRadius: 5, fontSize: 10,
                    border: `0.5px solid ${C.border2}`, background: C.bg2,
                    color: C.text, paddingLeft: 6, outline: 'none',
                  }}
                >
                  <option value="none">Straight</option>
                  <option value="bass-slide-up">Slide-Up</option>
                  <option value="bass-ghost-note">Ghost Note</option>
                  <option value="bass-octave-jump">Octave Jump</option>
                  <option value="bass-walking-step">Walking Step</option>
                </select>
                <button
                  onClick={resetBassArt}
                  style={{
                    fontSize: 9, fontWeight: 700, padding: '4px 6px',
                    borderRadius: 4, border: `0.5px solid ${C.border2}`,
                    background: C.bg2, color: C.cyan, cursor: 'pointer',
                  }}
                  title="Reset to Mode Auto"
                >AUTO</button>
              </div>
            </div>
          </div>

          {/* Input source */}
          <div style={{
            padding: '10px 14px 8px',
            borderBottom: `0.5px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <InputSourceSelector
              current={inputSource}
              onChange={setInputSource}
              disabled={isRunning || isStarting}
              autoEnergy={autoEnergy}
              onAutoEnergyChange={setAutoEnergy}
            />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginTop: 8,
              paddingTop: 8,
              borderTop: `0.5px solid ${C.border2}`,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>Capture Monitor</div>
                <div style={{ fontSize: 10, color: micMonitorBlocked ? C.red : C.text3 }}>
                  {micMonitorBlocked
                    ? 'Stop to switch input'
                    : micMonitoringEnabled
                      ? 'Capture window active'
                      : inputSource === 'mic'
                        ? 'Ready for voice capture'
                        : 'Selects mic before start'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleMicMonitorToggle}
                disabled={micMonitorBlocked || isStarting}
                style={{
                  minWidth: 92,
                  height: 30,
                  borderRadius: 6,
                  border: `0.5px solid ${micMonitoringEnabled ? C.cyan : C.border2}`,
                  background: micMonitoringEnabled ? 'rgba(34,211,238,0.16)' : C.bg2,
                  color: micMonitoringEnabled ? C.cyan : C.text2,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  cursor: micMonitorBlocked || isStarting ? 'not-allowed' : 'pointer',
                  opacity: micMonitorBlocked || isStarting ? 0.55 : 1,
                }}
              >
                {micMonitoringEnabled ? 'ON' : 'MONITOR'}
              </button>
            </div>
          </div>

          {/* Feature toggles */}
          <div style={{
            padding: '8px 14px',
            borderBottom: `0.5px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <div style={{ ...label11, marginBottom: 7 }}>Features</div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 5,
              isolation: 'isolate',
              transformStyle: 'flat',
            }}>
              <PillToggle active={cadenceLockEnabled}   label="Cadence Lock"  onToggle={toggleCadenceLock}   color={C.cyan} />
              <PillToggle active={callResponseEnabled}  label="Call + Response" onToggle={toggleCallResponse} color={C.purple} />
              <PillToggle active={dropDetectorEnabled}  label="Drop Detector" onToggle={toggleDropDetector}   color={C.amber} />
              <PillToggle active={vibeMatchEnabled}     label="Vibe Match"    onToggle={toggleVibeMatch}      color={C.green} />
              <PillToggle active={isStoryMode}          label="Story Mode"    onToggle={toggleStoryMode}                                     color={C.red} />
              <PillToggle active={melodyFocusEnabled}   label="Melody Focus"  onToggle={toggleMelodyFocus}   color={C.cyan} />
            </div>
          </div>

          {/* Instrument assignment */}
          <div style={{
            padding: '8px 14px',
            borderBottom: `0.5px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <div style={{ ...label11, marginBottom: 7 }}>Instruments</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <InstrumentSelect
                label="Lead"
                role="lead"
                value={instrumentAssignments.lead}
                onChange={id => setOrganismInstrument('lead', id)}
              />
              <InstrumentSelect
                label="Bass"
                role="bass"
                value={instrumentAssignments.bass}
                onChange={id => setOrganismInstrument('bass', id)}
              />
              <InstrumentSelect
                label="Chords"
                role="chord"
                value={instrumentAssignments.chord}
                onChange={id => setOrganismInstrument('chord', id)}
              />
            </div>
          </div>

          {/* Lyrics + report card + share */}
          <div style={{ padding: '10px 14px' }}>

            {/* Error */}
            {error && (
              <div style={{
                padding: '6px 10px', borderRadius: 6, marginBottom: 10,
                background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.3)',
                fontSize: 12, color: C.red,
              }}>{error}</div>
            )}

            {/* Live lyrics */}
            {transcription?.isSupported && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...label11, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 7 }}>
                  Live Lyrics
                  {transcription.isActive && (
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: C.red, display: 'inline-block',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                  )}
                </div>
                <div style={{
                  maxHeight: 140, overflowY: 'auto',
                  background: C.bg2, borderRadius: 6,
                  padding: '8px 10px', fontSize: 12, lineHeight: 1.6,
                }}>
                  {transcription.lines.length === 0 && !transcription.currentInterim ? (
                    <span style={{ color: C.text3, fontStyle: 'italic' }}>
                      {isRunning ? 'Listening…' : 'Start organism to capture lyrics'}
                    </span>
                  ) : (
                    <>
                      {transcription.lines.map(line => (
                        <div key={line.barNumber} style={{ color: C.text, marginBottom: 2 }}>
                          <span style={{ color: C.text3, fontSize: 9, marginRight: 5 }}>{line.barNumber}.</span>
                          {line.text}
                        </div>
                      ))}
                      {transcription.currentInterim && (
                        <div style={{ color: C.text2, opacity: 0.6, fontStyle: 'italic' }}>
                          {transcription.currentInterim}
                        </div>
                      )}
                      <div ref={lyricsEndRef} />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Report card */}
            {lastReport && !isRunning && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...label11, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  Report Card
                  <button
                    onClick={() => generateReport()}
                    style={{
                      fontSize: 9, padding: '2px 7px',
                      border: `0.5px solid ${C.border2}`, borderRadius: 4,
                      background: 'transparent', color: C.text3, cursor: 'pointer',
                    }}
                  >Refresh</button>
                </div>
                {/* Grade */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 6,
                  background: C.bg2, marginBottom: 8,
                }}>
                  <div style={{
                    fontSize: 28, fontWeight: 800, lineHeight: 1,
                    color: lastReport.overallScore >= 80 ? C.green
                         : lastReport.overallScore >= 60 ? C.amber : C.red,
                  }}>
                    {lastReport.grade}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                      {lastReport.overallScore}/100
                    </div>
                    <div style={{ fontSize: 10, color: C.text3 }}>
                      {Math.round(lastReport.durationMs/1000)}s · {lastReport.totalLines} bars · {lastReport.wordsPerMinute} WPM
                    </div>
                  </div>
                </div>
                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                  {[
                    { label: 'Syl/beat',   value: lastReport.syllablesPerBeat.toFixed(2) },
                    { label: 'Cadence',    value: `${Math.round(lastReport.cadenceConsistency*100)}%` },
                    { label: 'Bar streak', value: lastReport.longestBarStreak },
                    { label: 'Silence',    value: `${Math.round(lastReport.silenceRatio*100)}%` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ padding: '4px 7px', background: C.bg2, borderRadius: 4 }}>
                      <div style={{ fontSize: 9, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{value}</div>
                    </div>
                  ))}
                </div>
                {lastReport.strengths.map((s,i) => (
                  <div key={i} style={{ fontSize: 11, color: C.green, display: 'flex', gap: 4, marginBottom: 2 }}>
                    <span>✓</span><span>{s}</span>
                  </div>
                ))}
                {lastReport.improvements.map((s,i) => (
                  <div key={i} style={{ fontSize: 11, color: C.amber, display: 'flex', gap: 4, marginBottom: 2 }}>
                    <span>→</span><span>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Share */}
            {!isRunning && (lastSessionDNA || lastReport) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...label11, marginBottom: 7 }}>Share Session</div>
                {shareConfirmed ? (
                  <div style={{
                    padding: '8px 10px', background: 'rgba(16,185,129,0.1)',
                    border: '0.5px solid rgba(16,185,129,0.3)', borderRadius: 6, fontSize: 12,
                  }}>
                    <div style={{ color: C.green, fontWeight: 600, marginBottom: 3 }}>Session shared!</div>
                    <Link href={lastSharedPostUrl || '/social-hub'}>
                      <span style={{ color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer', fontSize: 11 }}>
                        View in Social Hub →
                      </span>
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <textarea
                      placeholder="Describe your session… (optional)"
                      value={shareCaption}
                      onChange={e => setShareCaption(e.target.value)}
                      rows={2}
                      style={{
                        width: '100%', resize: 'none', fontSize: 11,
                        background: C.bg2,
                        border: `0.5px solid ${C.border2}`,
                        borderRadius: 5, padding: '5px 7px',
                        color: C.text, boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        onClick={handleShare}
                        disabled={isSharingSession}
                        style={{
                          flex: 1, fontSize: 11, fontWeight: 600,
                          padding: '5px 0',
                          background: isSharingSession ? 'rgba(6,182,212,0.3)' : '#0e7490',
                          color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer',
                        }}
                      >
                        {isSharingSession ? 'Sharing…' : '↑ Share to Feed'}
                      </button>
                      <Link href="/signup">
                        <button style={{
                          fontSize: 11, fontWeight: 600, padding: '5px 9px',
                          background: 'rgba(124,58,237,0.3)',
                          color: '#c4b5fd', border: '0.5px solid rgba(124,58,237,0.4)',
                          borderRadius: 5, cursor: 'pointer',
                        }}>
                          Save →
                        </button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Last session DNA (no report) */}
            {!lastReport && !isRunning && lastSessionDNA && (
              <div>
                <div style={{ ...label11, marginBottom: 8 }}>Last Session</div>
                <div style={{ fontSize: 12, color: C.text2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span><span style={{ color: C.text3 }}>Mode </span>{lastSessionDNA.dominantMode}</span>
                  <span><span style={{ color: C.text3 }}>Avg BPM </span>{lastSessionDNA.avgPulse.toFixed(1)}</span>
                  <span><span style={{ color: C.text3 }}>Time in flow </span>{Math.round(lastSessionDNA.timeInFlowMs/1000)}s</span>
                  <span><span style={{ color: C.text3 }}>Flow % </span>{Math.round(lastSessionDNA.flowPercentage*100)}%</span>
                </div>
              </div>
            )}

          </div>

          </div>{/* end scrollable sections */}
        </div>
        <VoiceMonitorWindow
          open={micMonitoringEnabled}
          onClose={() => setMicMonitoringEnabled(false)}
        />
      </div>
    </div>
    </div>
  )
}
