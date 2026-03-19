import { useEffect, useRef, useState, useCallback } from 'react'
import { AudioAnalysisEngine } from './AudioAnalysisEngine'
import { AnalysisConfig, AnalysisFrame } from './types'

interface UseAudioAnalysisReturn {
  start: () => Promise<void>
  stop: () => void
  isRunning: boolean
  lastFrame: AnalysisFrame | null
  error: string | null
}

export function useAudioAnalysis(config?: Partial<AnalysisConfig>): UseAudioAnalysisReturn {
  const engineRef = useRef<AudioAnalysisEngine | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const [isRunning, setIsRunning] = useState(false)
  const [lastFrame, setLastFrame] = useState<AnalysisFrame | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    engineRef.current = new AudioAnalysisEngine(config)

    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
      engineRef.current?.stop()
      engineRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) {
      return
    }

    try {
      setError(null)
      await engine.start()

      unsubscribeRef.current?.()
      unsubscribeRef.current = engine.subscribe((frame) => {
        setLastFrame(frame)
      })

      setIsRunning(true)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Microphone access failed')
      setIsRunning(false)
    }
  }, [])

  const stop = useCallback(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null

    engineRef.current?.stop()

    setIsRunning(false)
    setLastFrame(null)
  }, [])

  return {
    start,
    stop,
    isRunning,
    lastFrame,
    error,
  }
}
