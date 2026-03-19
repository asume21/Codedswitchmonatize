import { useEffect } from 'react'
import { useOrganism } from './OrganismContext'

export function useOrganismShortcuts() {
  const { start, stop, capture, downloadMidi, isRunning } = useOrganism()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if focus is in an input, textarea, or contenteditable
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if ((e.target as HTMLElement)?.isContentEditable) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          isRunning ? stop() : start()
          break
        case 'c':
        case 'C':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            capture()
          }
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
  }, [start, stop, capture, downloadMidi, isRunning])
}
