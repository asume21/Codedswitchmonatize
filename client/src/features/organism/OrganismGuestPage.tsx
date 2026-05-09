import React from 'react'
import * as Tone from 'tone'
import { Link } from 'wouter'
import { Activity, Clock, Lock, Mic, Play, Radio, UserPlus, Volume2, Zap } from 'lucide-react'
import { OrganismCommandCenter } from './OrganismCommandCenter'
import { useOrganismPhysics } from './OrganismContext'
import { useOrganismActivation, useOrganismSafe } from './GlobalOrganismWrapper'

export function OrganismGuestPage() {
  const { isActivated, activate } = useOrganismActivation()
  const organism = useOrganismSafe()

  React.useEffect(() => {
    if (!isActivated) activate()
  }, [activate, isActivated])

  if (!organism) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-cyan-300">
        <div className="text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 animate-pulse" />
          <p className="text-sm font-semibold">Booting Organism engines...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="relative h-screen bg-black">
      <OrganismCommandCenter />
      <GuestTrialBanner organism={organism} />
      <TalkToOrganismCoach organism={organism} />
      <WowLiveConsole organism={organism} />
      {organism.isGuestLocked && <GuestLockOverlay />}
    </main>
  )
}

type LiveOrganism = NonNullable<ReturnType<typeof useOrganismSafe>>

function useVoiceTrialStarter(organism: LiveOrganism) {
  const {
    inputSource,
    isGuestLocked,
    isRunning,
    isStarting,
    setInputSource,
    setMicMonitoringEnabled,
    start,
  } = organism
  const [startingVoice, setStartingVoice] = React.useState(false)
  const [voiceTrialPending, setVoiceTrialPending] = React.useState(false)
  const expired = isGuestLocked

  React.useEffect(() => {
    if (!voiceTrialPending || inputSource !== 'mic') return
    if (isRunning || isStarting || expired) return

    let cancelled = false
    start()
      .finally(() => {
        if (!cancelled) {
          setStartingVoice(false)
          setVoiceTrialPending(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [expired, inputSource, isRunning, isStarting, start, voiceTrialPending])

  const startVoiceTrial = async () => {
    if (expired || isRunning || isStarting) return
    setStartingVoice(true)
    try {
      await Tone.start()
      setVoiceTrialPending(true)
      setInputSource('mic')
      setMicMonitoringEnabled(false)
    } catch {
      setStartingVoice(false)
      setVoiceTrialPending(false)
    }
  }

  return { startVoiceTrial, startingVoice }
}

function GuestTrialBanner({ organism }: { organism: LiveOrganism }) {
  const { guestSecondsRemaining, isGuestLocked, isRunning, isStarting } = organism
  const { startVoiceTrial, startingVoice } = useVoiceTrialStarter(organism)
  const seconds = Math.max(0, guestSecondsRemaining)
  const expired = isGuestLocked
  const hasStarted = isRunning || isStarting || seconds < 60

  return (
    <div className="pointer-events-none fixed left-3 right-3 top-3 z-[2147483000] flex justify-center">
      <div className="pointer-events-auto flex w-full max-w-5xl flex-col gap-3 rounded-xl border border-cyan-500/25 bg-black/78 p-4 shadow-[0_0_28px_rgba(6,182,212,0.18)] backdrop-blur-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-500/10">
            <Mic className="h-4 w-4 text-cyan-300" />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-[0.18em] text-white">
              Your Voice Becomes the Instrument
            </div>
            <div className="mt-1 text-xs leading-relaxed text-cyan-100/65">
              Say a rhythm like <span className="font-semibold text-cyan-200">boom boom clap</span>. The Organism listens, wakes the engines, and turns it into drums, bass, and melody.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-widest text-cyan-100">
            <Clock className="h-3.5 w-3.5 text-cyan-300" />
            {expired ? 'Trial ended' : `${seconds}s free`}
          </div>
          {!hasStarted && (
            <button
              type="button"
              onClick={startVoiceTrial}
              disabled={startingVoice}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-black transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70"
            >
              <Play className="h-3.5 w-3.5" />
              {startingVoice ? 'Starting' : 'Start Voice Trial'}
            </button>
          )}
          <Link href="/signup">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Save Your Session
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function TalkToOrganismCoach({ organism }: { organism: LiveOrganism }) {
  const { guestSecondsRemaining, inputSource, isGuestLocked, isRunning, isStarting } = organism
  const { startVoiceTrial, startingVoice } = useVoiceTrialStarter(organism)
  const seconds = Math.max(0, guestSecondsRemaining)
  const hasStarted = isRunning || isStarting || seconds < 60

  if (hasStarted || isGuestLocked) return null

  return (
    <section className="pointer-events-none fixed inset-0 z-[2147482500] flex items-center justify-center px-4 pt-28">
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-cyan-400/40 bg-black/88 p-6 text-center shadow-[0_0_60px_rgba(6,182,212,0.28)] backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10">
          <Radio className="h-7 w-7 text-cyan-300" />
        </div>
        <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
          Talk to the Organism
        </div>
        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">
          Click the mic. Say the beat.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cyan-100/70">
          This is the WOW mode. Start the mic, allow permission, then say:
        </p>
        <div className="my-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-lg font-black tracking-wide text-white">
          boom boom clap
        </div>
        <button
          type="button"
          onClick={startVoiceTrial}
          disabled={startingVoice || isStarting}
          className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-cyan-400 px-6 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70"
        >
          <Mic className="h-5 w-5" />
          {startingVoice || isStarting ? 'Opening Mic' : 'Start Talking to It'}
        </button>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-widest text-cyan-100/55">
          <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">1. Allow mic</span>
          <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">2. Say rhythm</span>
          <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">3. Watch logs</span>
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-cyan-100/45">
          {inputSource === 'mic' ? 'Mic mode selected' : 'Will switch to mic mode'} · {seconds}s free
        </p>
      </div>
    </section>
  )
}

function WowLiveConsole({ organism }: { organism: LiveOrganism }) {
  const { analysisEngine, inputSource, isRunning, performerState, selfListenReport, wowMoment } = organism
  const { physicsState } = useOrganismPhysics()
  const [micSignal, setMicSignal] = React.useState({ level: 0, fresh: false, active: false })
  const [masterVol, setMasterVol] = React.useState(100)

  const handleVolumeChange = (val: number) => {
    setMasterVol(val)
    // 100 = 0dB (unity), 200 = +6dB (boost), 0 = -inf
    Tone.getDestination().volume.value = val === 0 ? -60 : Tone.gainToDb(val / 100)
  }
  const listening = isRunning && inputSource === 'mic'
  const outputLevel = selfListenReport?.isSilent
    ? 0
    : Math.max(0, Math.min(1, selfListenReport?.rmsLinear ? selfListenReport.rmsLinear * 8 : 0))
  const logs = wowMoment.logs.length > 0 ? wowMoment.logs : [{ id: 'empty', text: listening ? 'listening: say boom boom clap' : 'waiting for mic start', tone: 'info' as const, timestamp: Date.now() }]

  React.useEffect(() => {
    if (!listening) {
      setMicSignal({ level: 0, fresh: false, active: false })
      return
    }

    const update = () => {
      const now = performance.now()
      const frame = analysisEngine?.getLastFrame?.() ?? null
      const fresh = !!frame && now - frame.timestamp < 1200
      const frameLevel = frame
        ? Math.max(frame.rms * 8, frame.voiceConfidence * 0.9)
        : 0
      const fallbackLevel = Math.max(
        performerState?.energy ?? 0,
        (physicsState?.presence ?? 0) * 0.85,
      )
      const level = Math.max(0, Math.min(1, fresh ? frameLevel : fallbackLevel))
      const active = fresh && !!(frame?.voiceActive || level > 0.08 || performerState?.isInPhrase || physicsState?.voiceActive)
      setMicSignal({ level, fresh, active })
    }

    update()
    const timer = window.setInterval(update, 100)
    return () => window.clearInterval(timer)
  }, [analysisEngine, listening, performerState?.energy, performerState?.isInPhrase, physicsState?.presence, physicsState?.voiceActive])

  return (
    <aside className="pointer-events-none fixed bottom-4 right-4 z-[2147482000] w-[min(360px,calc(100vw-2rem))]">
      <div className="pointer-events-auto rounded-xl border border-cyan-500/25 bg-black/82 p-3 shadow-[0_0_32px_rgba(6,182,212,0.18)] backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            <Activity className={`h-3.5 w-3.5 ${listening ? 'animate-pulse' : ''}`} />
            WOW Console
          </div>
          <div className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest ${listening ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/5 text-white/45'}`}>
            {listening ? 'Listening' : 'Idle'}
          </div>
        </div>
        <div className="mb-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-cyan-100/60">Mic Input</span>
            <span className={micSignal.active ? 'text-emerald-300' : micSignal.fresh ? 'text-amber-300' : 'text-white/35'}>
              {micSignal.active ? 'Voice picked up' : micSignal.fresh ? 'Mic live, waiting' : listening ? 'No mic signal' : 'Not started'}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-900">
            <div
              className={`h-full rounded-full transition-all duration-100 ${micSignal.active ? 'bg-emerald-300' : 'bg-cyan-400'}`}
              style={{ width: `${Math.round(micSignal.level * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-cyan-100/60">Computer Output</span>
            <span className={outputLevel > 0.02 ? 'text-emerald-300' : 'text-white/35'}>
              {outputLevel > 0.02 ? 'Sound detected' : 'No output yet'}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full rounded-full bg-violet-300 transition-all duration-150"
              style={{ width: `${Math.round(outputLevel * 100)}%` }}
            />
          </div>
        </div>
        <div className="mb-2 grid grid-cols-3 gap-1.5">
          {([
            ['drums', 'Drums'],
            ['bass', 'Bass'],
            ['harmony', 'Harmony'],
          ] as const).map(([key, label]) => (
            <div
              key={key}
              className={`rounded-md border px-2 py-1.5 text-center text-[10px] font-black uppercase tracking-widest ${
                wowMoment.engines[key]
                  ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.28)]'
                  : 'border-white/10 bg-white/[0.03] text-white/35'
              }`}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="max-h-28 overflow-auto rounded-lg border border-white/10 bg-slate-950 px-3 py-2 font-mono text-[11px] leading-relaxed">
          {logs.map(entry => (
            <div key={entry.id} className={entry.tone === 'pulse' ? 'text-amber-300' : entry.tone === 'wake' ? 'text-emerald-300' : entry.tone === 'sync' ? 'text-cyan-300' : 'text-cyan-100/65'}>
              &gt; {entry.text}
            </div>
          ))}
        </div>

        {/* Master volume */}
        <div className="mt-2.5 flex items-center gap-2 border-t border-white/10 pt-2.5">
          <Volume2 className="h-3.5 w-3.5 shrink-0 text-cyan-300/70" />
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={masterVol}
            onChange={e => handleVolumeChange(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
          />
          <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums text-white/40">
            {masterVol}%
          </span>
        </div>
      </div>
    </aside>
  )
}

function GuestLockOverlay() {
  return (
    <div
      className="absolute inset-0 z-[10000] flex items-center justify-center backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-lock-title"
    >
      <div
        className="mx-4 max-w-md rounded-2xl border border-cyan-500/30 bg-black/80 p-7 text-center shadow-[0_0_40px_rgba(6,182,212,0.25)]"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10">
          <Lock className="h-5 w-5 text-cyan-300" />
        </div>
        <h2 id="guest-lock-title" className="mb-2 text-xl font-black tracking-wide text-white">
          Your 60 seconds are up
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-cyan-100/70">
          Create a free account to keep jamming, save sessions, and unlock every control.
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/signup">
            <button className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:opacity-90">
              Sign Up Free
            </button>
          </Link>
          <Link href="/login">
            <button className="w-full rounded-xl border border-white/15 bg-transparent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70 hover:bg-white/5">
              Already have an account? Log in
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default OrganismGuestPage
