// Section 06 — React hook for mix engine

import { useEffect, useRef, useState } from 'react'
import { MixEngine }                   from './MixEngine'
import type { MixConfig, MixMeterReading } from './types'
import type { GeneratorOrchestrator }  from '../generators/GeneratorOrchestrator'

interface UseMixEngineReturn {
  mixEngine:    MixEngine | null
  meterReading: MixMeterReading | null
}

export function useMixEngine(
  orchestrator: GeneratorOrchestrator | null,
  config?:      Partial<MixConfig>
): UseMixEngineReturn {
  const mixRef                          = useRef<MixEngine | null>(null)
  const [meterReading, setMeterReading] = useState<MixMeterReading | null>(null)

  useEffect(() => {
    if (!orchestrator) return

    mixRef.current = new MixEngine(config)
    mixRef.current.wire(orchestrator)
    mixRef.current.startMetering()

    const unsubMeter = mixRef.current.onMeter((reading) => {
      setMeterReading(reading)
    })

    return () => {
      unsubMeter()
      mixRef.current?.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orchestrator])

  return { mixEngine: mixRef.current, meterReading }
}
