// Wow-Moment system — the live "freestyle reaction" engine: it listens to the
// performer's onsets/words, maps them to drum hits, and builds a responding
// pattern. Extracted out of OrganismProvider (which had grown to ~3.7k lines)
// into a self-contained hook. The provider feeds it transcript words + analysis
// frames; it owns all wow state/refs internally and exposes a small interface.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { WowMomentState } from '../OrganismContext'
import type { AnalysisFrame } from '../../../organism/analysis/types'
import type { PerformerState } from '../../../organism/audio/types'
import { DrumInstrument, type DrumHit } from '../../../organism/generators/types'
import { humanize } from '../../../organism/generators/groove'
import type { GeneratorOrchestrator } from '../../../organism/generators/GeneratorOrchestrator'
import type { PhysicsEngine } from '../../../organism/physics/PhysicsEngine'
import type { InputSourceType } from '../../../organism/input/types'

type WowPulseInstrument = 'kick' | 'snare' | 'hat'

interface WowOnset {
  time: number
  strength: number
  centroid: number
  instrument: WowPulseInstrument
  word: string | null
}

const WOW_INITIAL_STATE: WowMomentState = {
  logs: [],
  engines: { drums: false, bass: false, harmony: false },
  phraseActive: false,
  lastPulse: null,
  capturedOnsets: 0,
  syncBpm: null,
}

const WOW_WORDS: Record<string, WowPulseInstrument> = {
  boom: 'kick',
  boomp: 'kick',
  bum: 'kick',
  dum: 'kick',
  doom: 'kick',
  thump: 'kick',
  clap: 'snare',
  clack: 'snare',
  snap: 'snare',
  pak: 'snare',
  bap: 'snare',
  tss: 'hat',
  ts: 'hat',
  hat: 'hat',
  tick: 'hat',
  tik: 'hat',
  shh: 'hat',
}

function normalizeWowWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, '')
}

function drumInstrumentForWow(instrument: WowPulseInstrument): DrumInstrument {
  if (instrument === 'snare') return DrumInstrument.Snare
  if (instrument === 'hat') return DrumInstrument.Hat
  return DrumInstrument.Kick
}

export interface UseWowMomentsArgs {
  orchestrRef: RefObject<GeneratorOrchestrator | null>
  physicsRef: RefObject<PhysicsEngine | null>
  inputSource: InputSourceType
}

export interface UseWowMomentsResult {
  wowMoment: WowMomentState
  /** Feed each new analysis frame + current performer to drive the reaction. */
  processWowFrame: (frame: AnalysisFrame, performer: PerformerState | null) => void
  /** Clear the on-screen wow log. */
  clearWowMomentLog: () => void
  /** Feed the latest transcript token so spoken beatbox words map to drums. */
  ingestTranscriptWord: (rawToken: string) => void
  /** Reset wow timers/state — call from the provider's stop(). */
  resetWow: () => void
}

export function useWowMoments({ orchestrRef, physicsRef, inputSource }: UseWowMomentsArgs): UseWowMomentsResult {
  const [wowMoment, setWowMoment] = useState<WowMomentState>(WOW_INITIAL_STATE)
  const wowMomentRef = useRef<WowMomentState>(WOW_INITIAL_STATE)
  const wowSnapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wowLogIdRef = useRef(0)
  const wowOnsetsRef = useRef<WowOnset[]>([])
  const wowPhraseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wowLastVoiceLogRef = useRef(0)
  const wowLastOnsetLogRef = useRef(0)
  const wowLastSyncLogRef = useRef(0)
  const wowSyncBpmRef = useRef<number | null>(null)
  const wowLatestWordRef = useRef<{ word: string; instrument: WowPulseInstrument; timestamp: number } | null>(null)
  const wowLastTranscriptTokenRef = useRef('')

  const pushWowLog = useCallback((text: string, tone: WowMomentState['logs'][number]['tone'] = 'info') => {
    const entry = {
      id: ++wowLogIdRef.current,
      timestamp: Date.now(),
      text,
      tone,
    }
    wowMomentRef.current = {
      ...wowMomentRef.current,
      logs: [entry, ...wowMomentRef.current.logs].slice(0, 8),
    }
  }, [])

  const setWowEngineActive = useCallback((engine: keyof WowMomentState['engines'], activeMs = 700) => {
    wowMomentRef.current = {
      ...wowMomentRef.current,
      engines: { ...wowMomentRef.current.engines, [engine]: true },
    }
    window.setTimeout(() => {
      wowMomentRef.current = {
        ...wowMomentRef.current,
        engines: { ...wowMomentRef.current.engines, [engine]: false },
      }
    }, activeMs)
  }, [])

  const mapFrameToWowInstrument = useCallback((frame: AnalysisFrame): { instrument: WowPulseInstrument; word: string | null } => {
    const latestWord = wowLatestWordRef.current
    if (latestWord && performance.now() - latestWord.timestamp < 1200) {
      wowLatestWordRef.current = null
      return { instrument: latestWord.instrument, word: latestWord.word }
    }

    if (frame.spectralCentroid < 900) return { instrument: 'kick', word: null }
    if (frame.spectralCentroid < 3200) return { instrument: 'snare', word: null }
    return { instrument: 'hat', word: null }
  }, [])

  const buildWowPattern = useCallback((onsets: WowOnset[], bpm: number): DrumHit[] => {
    if (onsets.length === 0) return []
    const start = onsets[0].time
    const end = onsets[onsets.length - 1].time
    const phraseMs = Math.max(600, end - start)
    const byStep = new Map<number, WowOnset>()

    onsets.forEach((onset) => {
      const step = Math.max(0, Math.min(15, Math.round(((onset.time - start) / phraseMs) * 15)))
      const current = byStep.get(step)
      if (!current || onset.strength > current.strength) byStep.set(step, onset)
    })

    // Humanization rules live in groove.ts so this Wow path and stock genre
    // patterns from DrumPatternLibrary share one curve. Hits go through
    // humanize() at construction; DrumGenerator's Tone.Part callback applies
    // the resulting microShift in seconds against the BBS-quantized time.
    const hits: DrumHit[] = Array.from(byStep.entries())
      .sort(([a], [b]) => a - b)
      .map(([step, onset]) => {
        const instrument = drumInstrumentForWow(onset.instrument)
        const time = `0:${Math.floor(step / 4)}:${step % 4}`
        const base = Math.max(0.35, Math.min(1, 0.46 + onset.strength * 0.5))
        const { velocity, microShift } = humanize(instrument, time, base)
        return { instrument, time, velocity, microShift }
      })

    const hasHit = (instrument: DrumInstrument, time: string) =>
      hits.some(hit => hit.instrument === instrument && hit.time === time)
    const addHit = (instrument: DrumInstrument, time: string, base: number) => {
      if (hasHit(instrument, time)) return
      const { velocity, microShift } = humanize(instrument, time, base)
      hits.push({ instrument, time, velocity, microShift })
    }

    // Keep the human rhythm, but add musical anchors so the response feels like
    // a beat instead of a literal click track. Humanization is applied inside
    // addHit, so each anchor inherits the same pocket/swing/variance rules.
    addHit(DrumInstrument.Kick, '0:0:0', 0.82)
    if (!hits.some(hit => hit.instrument === DrumInstrument.Kick && hit.time !== '0:0:0')) {
      addHit(DrumInstrument.Kick, '0:2:2', 0.58)
    }

    addHit(DrumInstrument.Snare, '0:1:0', 0.66)
    addHit(DrumInstrument.Snare, '0:3:0', 0.62)

    if (hits.filter(hit => hit.instrument === DrumInstrument.Hat).length < 2 && bpm >= 70) {
      ;['0:0:2', '0:1:2', '0:2:2', '0:3:2'].forEach((time, index) => {
        addHit(DrumInstrument.Hat, time, index % 2 === 0 ? 0.42 : 0.36)
      })
    }

    return hits.sort((a, b) => {
      const [, beatA, subA] = a.time.split(':').map(Number)
      const [, beatB, subB] = b.time.split(':').map(Number)
      return beatA === beatB ? subA - subB : beatA - beatB
    })
  }, [])

  const finalizeWowPhrase = useCallback(() => {
    const onsets = wowOnsetsRef.current
    wowOnsetsRef.current = []
    wowMomentRef.current = { ...wowMomentRef.current, phraseActive: false, capturedOnsets: 0 }
    if (onsets.length < 2) return

    const bpm = Math.round(orchestrRef.current?.getBpm() ?? physicsRef.current?.getLastState()?.pulse ?? 90)
    const hits = buildWowPattern(onsets, bpm)
    if (hits.length === 0) return

    pushWowLog(`phrase captured: ${onsets.length} pulses`, 'info')
    pushWowLog('pattern detected: 4/4, syncopation mild', 'sync')
    pushWowLog('generating response...', 'info')
    orchestrRef.current?.loadGeneratedDrumPattern(hits, true)

    setWowEngineActive('drums', 900)
    pushWowLog('drums online', 'wake')
    window.setTimeout(() => {
      setWowEngineActive('bass', 900)
      pushWowLog('bass online', 'wake')
    }, 260)
    window.setTimeout(() => {
      setWowEngineActive('harmony', 1000)
      pushWowLog('harmony online', 'wake')
    }, 520)
  }, [buildWowPattern, pushWowLog, setWowEngineActive, orchestrRef, physicsRef])

  const processWowFrame = useCallback((frame: AnalysisFrame, performer: PerformerState | null) => {
    if (inputSource !== 'mic') return
    const now = performance.now()

    if (frame.voiceActive && now - wowLastVoiceLogRef.current > 1800) {
      wowLastVoiceLogRef.current = now
      pushWowLog('voice detected', 'info')
    }

    if (
      performer &&
      performer.bpmConfidence > 0.55 &&
      Math.abs(performer.bpm - (wowSyncBpmRef.current ?? 0)) > 3 &&
      now - wowLastSyncLogRef.current > 3000
    ) {
      wowLastSyncLogRef.current = now
      wowSyncBpmRef.current = Math.round(performer.bpm)
      wowMomentRef.current = { ...wowMomentRef.current, syncBpm: Math.round(performer.bpm) }
      pushWowLog(`sync established at ${Math.round(performer.bpm)} BPM`, 'sync')
    }

    if (!frame.onsetDetected || frame.onsetStrength < 0.25) return
    if (now - wowLastOnsetLogRef.current < 85) return
    wowLastOnsetLogRef.current = now

    const mapped = mapFrameToWowInstrument(frame)
    const drumInstrument = drumInstrumentForWow(mapped.instrument)
    const pulse: WowOnset = {
      time: frame.onsetTimestamp || now,
      strength: frame.onsetStrength,
      centroid: frame.spectralCentroid,
      instrument: mapped.instrument,
      word: mapped.word,
    }

    wowOnsetsRef.current = [...wowOnsetsRef.current, pulse].slice(-16)
    wowMomentRef.current = {
      ...wowMomentRef.current,
      phraseActive: true,
      lastPulse: mapped.instrument,
      capturedOnsets: wowOnsetsRef.current.length,
    }
    setWowEngineActive('drums', 420)
    orchestrRef.current?.triggerWowDrumPulse(
      drumInstrument,
      Math.max(0.45, Math.min(1, 0.5 + frame.onsetStrength * 0.45)),
    )

    pushWowLog(`heard: ${mapped.word ?? 'transient'}`, 'pulse')
    pushWowLog(`mapped: ${mapped.instrument}`, 'pulse')

    if (wowPhraseTimerRef.current) clearTimeout(wowPhraseTimerRef.current)
    wowPhraseTimerRef.current = setTimeout(finalizeWowPhrase, 560)
  }, [
    finalizeWowPhrase,
    inputSource,
    mapFrameToWowInstrument,
    pushWowLog,
    setWowEngineActive,
    orchestrRef,
  ])

  const clearWowMomentLog = useCallback(() => {
    wowMomentRef.current = { ...wowMomentRef.current, logs: [] }
    setWowMoment(wowMomentRef.current)
  }, [])

  /** Reset wow timers/state — called from the provider's stop(). */
  const resetWow = useCallback(() => {
    if (wowPhraseTimerRef.current) {
      clearTimeout(wowPhraseTimerRef.current)
      wowPhraseTimerRef.current = null
    }
    wowOnsetsRef.current = []
    wowSyncBpmRef.current = null
    wowMomentRef.current = {
      ...wowMomentRef.current,
      engines: { drums: false, bass: false, harmony: false },
      phraseActive: false,
      lastPulse: null,
      capturedOnsets: 0,
      syncBpm: null,
    }
    setWowMoment(wowMomentRef.current)
  }, [])

  const ingestTranscriptWord = useCallback((rawToken: string) => {
    const latestToken = rawToken
    if (!latestToken || latestToken === wowLastTranscriptTokenRef.current) return
    wowLastTranscriptTokenRef.current = latestToken
    const normalized = normalizeWowWord(latestToken)
    const instrument = WOW_WORDS[normalized]
    if (instrument) {
      wowLatestWordRef.current = {
        word: normalized,
        instrument,
        timestamp: performance.now(),
      }
    }
  }, [])

  // Snapshot timer: sync the mutable ref into React state ~4×/s so the UI
  // updates without re-rendering on every onset.
  useEffect(() => {
    if (wowSnapshotTimerRef.current) return
    wowSnapshotTimerRef.current = setInterval(() => {
      setWowMoment(prev => {
        const next = wowMomentRef.current
        if (
          prev === next ||
          (
            prev.logs === next.logs &&
            prev.phraseActive === next.phraseActive &&
            prev.lastPulse === next.lastPulse &&
            prev.capturedOnsets === next.capturedOnsets &&
            prev.syncBpm === next.syncBpm &&
            prev.engines.drums === next.engines.drums &&
            prev.engines.bass === next.engines.bass &&
            prev.engines.harmony === next.engines.harmony
          )
        ) {
          return prev
        }
        return next
      })
    }, 250)

    return () => {
      if (wowSnapshotTimerRef.current) {
        clearInterval(wowSnapshotTimerRef.current)
        wowSnapshotTimerRef.current = null
      }
    }
  }, [])

  return { wowMoment, processWowFrame, clearWowMomentLog, ingestTranscriptWord, resetWow }
}
