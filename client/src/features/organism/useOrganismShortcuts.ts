import { useEffect } from 'react'
import { useOrganism } from './OrganismContext'

export function useOrganismShortcuts() {
  const { start, stop, capture, downloadMidi, isRunning, isStarting } = useOrganism()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if focus is in an input, textarea, or contenteditable
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if ((e.target as HTMLElement)?.isContentEditable) return

      // Space intentionally NOT bound here — it belongs to the transport
      // (MasterMultiTrackPlayer). Previously this raced with two other
      // window-level listeners and made Space behavior non-deterministic.
      // Use `o` to toggle the Organism generator explicitly.
      if (e.metaKey || e.ctrlKey) return

      switch (e.key) {
        case 'o':
        case 'O':
          e.preventDefault()
          if (isStarting) return
          isRunning ? stop() : start()
          break
        case 'c':
        case 'C':
          e.preventDefault()
          capture()
          break
        case 'm':
        case 'M':
          e.preventDefault()
          downloadMidi()
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [start, stop, capture, downloadMidi, isRunning, isStarting])
}
