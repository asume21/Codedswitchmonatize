import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useOrganism, useOrganismPhysics } from './OrganismContext'

interface VoiceMonitorWindowProps {
  open: boolean
  onClose: () => void
}

const COLORS = {
  bg: 'rgba(4, 12, 16, 0.96)',
  panel: 'rgba(8, 24, 30, 0.92)',
  border: 'rgba(34, 211, 238, 0.42)',
  borderSoft: 'rgba(34, 211, 238, 0.18)',
  text: '#e6fbff',
  textDim: '#7dd3fc',
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#fb7185',
}

export function VoiceMonitorWindow({ open, onClose }: VoiceMonitorWindowProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const historyRef = useRef<number[]>(Array.from({ length: 112 }, () => 0))
  const lastSampleAtRef = useRef(0)
  const lastStatsAtRef = useRef(0)
  const { analysisEngine, isRunning, inputSource, performerState } = useOrganism()
  const { physicsState } = useOrganismPhysics()
  const [liveStats, setLiveStats] = useState({
    level: 0,
    active: false,
    rate: 0,
    bright: 0,
  })

  const fallbackVoiceLevel = useMemo(() => {
    const performerEnergy = performerState?.energy ?? 0
    const physicsPresence = physicsState?.presence ?? 0
    const density = physicsState?.density ?? 0
    const base = inputSource === 'mic'
      ? Math.max(performerEnergy, physicsPresence * 0.85)
      : 0
    return Math.max(0, Math.min(1, base + density * 0.08))
  }, [inputSource, performerState?.energy, physicsState?.density, physicsState?.presence])

  const voiceActive = inputSource === 'mic' && (
    liveStats.active ||
    performerState?.isInPhrase ||
    physicsState?.voiceActive ||
    liveStats.level > 0.08
  )

  useEffect(() => {
    if (!open) return

    let frame = 0
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const render = () => {
      const now = performance.now()
      const latestFrame = analysisEngine?.getLastFrame?.() ?? null
      const rawLevel = latestFrame
        ? Math.max(latestFrame.rms * 8, latestFrame.voiceConfidence * 0.9)
        : fallbackVoiceLevel
      const liveLevel = isRunning && inputSource === 'mic'
        ? Math.max(0, Math.min(1, rawLevel))
        : 0
      const activeNow = inputSource === 'mic' && isRunning && (
        latestFrame?.voiceActive ||
        liveLevel > 0.08
      )

      if (now - lastSampleAtRef.current > 33) {
        const values = historyRef.current
        values.push(liveLevel)
        while (values.length > 112) values.shift()
        lastSampleAtRef.current = now
      }

      if (now - lastStatsAtRef.current > 90) {
        setLiveStats({
          level: liveLevel,
          active: !!activeNow,
          rate: performerState?.syllabicRate ?? 0,
          bright: latestFrame
            ? Math.max(0, Math.min(1, latestFrame.spectralCentroid / 5000))
            : performerState?.spectralBrightness ?? 0,
        })
        lastStatsAtRef.current = now
      }

      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(rect.width * dpr))
      const height = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      const w = rect.width
      const h = rect.height
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = COLORS.panel
      ctx.fillRect(0, 0, w, h)

      const center = h / 2
      const values = historyRef.current

      ctx.strokeStyle = 'rgba(125, 211, 252, 0.12)'
      ctx.beginPath()
      ctx.moveTo(0, center)
      ctx.lineTo(w, center)
      ctx.stroke()

      const step = values.length > 1 ? w / (values.length - 1) : w
      ctx.beginPath()
      values.forEach((value, index) => {
        const x = index * step
        const direction = index % 2 === 0 ? -1 : 1
        const y = center + direction * Math.max(1, value * h * 0.42)
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = activeNow ? COLORS.green : COLORS.cyan
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.88
      ctx.stroke()

      ctx.beginPath()
      values.forEach((value, index) => {
        const x = index * step
        const barHeight = Math.max(1, value * h * 0.74)
        if (index % 3 === 0) {
          ctx.moveTo(x, center - barHeight / 2)
          ctx.lineTo(x, center + barHeight / 2)
        }
      })
      ctx.strokeStyle = activeNow ? 'rgba(52, 211, 153, 0.55)' : 'rgba(34, 211, 238, 0.28)'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.globalAlpha = 1
      ctx.restore()
      frame = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(frame)
  }, [
    analysisEngine,
    fallbackVoiceLevel,
    inputSource,
    isRunning,
    open,
    performerState?.spectralBrightness,
    performerState?.syllabicRate,
  ])

  if (!open) return null

  const monitorLabel = inputSource === 'mic'
    ? isRunning
      ? voiceActive ? 'VOICE' : 'WAITING'
      : 'READY'
    : 'MIC OFF'

  return (
    <div
      style={{
        position: 'fixed',
        right: 22,
        top: 92,
        zIndex: 1200,
        width: 'min(430px, calc(100vw - 32px))',
        borderRadius: 8,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.bg,
        boxShadow: '0 18px 50px rgba(0,0,0,0.45), 0 0 26px rgba(34,211,238,0.12)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 12px',
        borderBottom: `1px solid ${COLORS.borderSoft}`,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: COLORS.text }}>
            CAPTURE MONITOR
          </div>
          <div style={{ marginTop: 2, fontSize: 10, fontWeight: 700, color: COLORS.textDim }}>
            {monitorLabel} / {inputSource.toUpperCase()}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 30,
            height: 28,
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            background: 'rgba(34,211,238,0.08)',
            color: COLORS.cyan,
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
          }}
          aria-label="Close voice monitor"
        >
          x
        </button>
      </div>

      <div style={{ padding: 12 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 154,
            display: 'block',
            borderRadius: 6,
            border: `1px solid ${COLORS.borderSoft}`,
            background: COLORS.panel,
          }}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          marginTop: 10,
        }}>
          <MonitorStat label="Level" value={`${Math.round(liveStats.level * 100)}%`} color={voiceActive ? COLORS.green : COLORS.textDim} />
          <MonitorStat label="Rate" value={`${liveStats.rate.toFixed(1)}/s`} color={COLORS.cyan} />
          <MonitorStat label="Bright" value={`${Math.round(liveStats.bright * 100)}%`} color={COLORS.amber} />
        </div>
      </div>
    </div>
  )
}

function MonitorStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      minWidth: 0,
      padding: '7px 8px',
      borderRadius: 6,
      border: `1px solid ${COLORS.borderSoft}`,
      background: 'rgba(2, 8, 11, 0.72)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', color: COLORS.textDim }}>
        {label.toUpperCase()}
      </div>
      <div style={{ marginTop: 3, fontSize: 15, fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}
