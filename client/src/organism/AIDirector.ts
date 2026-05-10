/**
 * AIDirector — real-time beat section pipeline
 *
 * Listens for organism:section-change events. When section N starts, it fires
 * an API call for section N+1 in the background. The result is cached and
 * applied the moment section N+1 begins. If the call fails or times out, the
 * hardcoded arrangement fallback is used — music never stops.
 */

import type { GeneratorOrchestrator } from './generators/GeneratorOrchestrator'

export interface AIBeatDirective {
  section: string
  energy: number
  subGenre: 'trap' | 'boom-bap' | 'drill' | 'r&b-soul' | 'afrobeats'
  groove: 'straight' | 'swing' | 'triplet'
  drums: { kick: number; hat: number; arrangement: number }
  bass: { volume: number }
  melody: {
    volume: number
    behavior: 'lead' | 'hint' | 'rest'
    chordTechnique: 'pad' | 'rolled' | 'stab'
  }
  reasoning: string
}

// Matches the GeneratorOrchestrator's ARRANGEMENT section order
const SECTION_ORDER = ['intro', 'verse', 'build', 'drop', 'breakdown', 'drop2']

const FETCH_TIMEOUT_MS = 8000

export class AIDirector {
  private orchestrator: GeneratorOrchestrator
  private enabled = true

  // directive buffered for the next section
  private pendingDirective: AIBeatDirective | null = null
  private pendingForSection: string | null = null
  private fetchInFlight = false
  private cycleCount = 0

  private handleSectionChange: (e: Event) => void

  constructor(orchestrator: GeneratorOrchestrator) {
    this.orchestrator = orchestrator

    this.handleSectionChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        section: string
        physics: { energy?: number } | null
        bpm: number
        subGenre?: string
        barInCycle?: number
        totalBars?: number
      }
      this.onSectionChange(detail)
    }

    window.addEventListener('organism:section-change', this.handleSectionChange)
  }

  enable(): void  { this.enabled = true }
  disable(): void { this.enabled = false }

  dispose(): void {
    window.removeEventListener('organism:section-change', this.handleSectionChange)
  }

  private onSectionChange(detail: {
    section: string
    physics: { energy?: number } | null
    bpm: number
    subGenre?: string
    barInCycle?: number
    totalBars?: number
  }): void {
    const { section, physics, bpm, subGenre = 'trap', barInCycle = 0, totalBars = 32 } = detail

    // Apply the buffered directive for this section if it arrived in time
    if (this.pendingForSection === section && this.pendingDirective) {
      this.applyDirective(this.pendingDirective)
      this.pendingDirective = null
      this.pendingForSection = null
    }

    if (section === SECTION_ORDER[SECTION_ORDER.length - 1]) {
      this.cycleCount++
    }

    // Pre-generate the next section while current one plays
    const nextSection = this.nextSectionAfter(section)
    if (!nextSection || !this.enabled || this.fetchInFlight) return

    this.fetchInFlight = true
    this.pendingForSection = nextSection
    this.pendingDirective = null

    const context = {
      subGenre,
      bpm,
      energy: physics?.energy ?? 0.7,
      barInCycle,
      totalBars,
      cycleCount: this.cycleCount,
    }

    this.fetchDirective(section, nextSection, context)
      .then(directive => {
        if (directive && this.pendingForSection === nextSection) {
          this.pendingDirective = directive
          console.debug(`[AIDirector] ready for "${nextSection}": ${directive.reasoning}`)
        }
      })
      .catch(err => console.warn('[AIDirector] fetch failed:', err))
      .finally(() => { this.fetchInFlight = false })
  }

  private async fetchDirective(
    currentSection: string,
    nextSection: string,
    context: object
  ): Promise<AIBeatDirective | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const res = await fetch('/api/ai/next-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSection, nextSection, context }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) return null
      return await res.json() as AIBeatDirective
    } catch {
      clearTimeout(timeout)
      return null
    }
  }

  private applyDirective(d: AIBeatDirective): void {
    console.info(`[AIDirector] applying "${d.section}" — ${d.reasoning}`)
    this.orchestrator.setNextSectionDirective(d)
  }

  private nextSectionAfter(section: string): string | null {
    const idx = SECTION_ORDER.indexOf(section)
    if (idx === -1) return null
    return SECTION_ORDER[(idx + 1) % SECTION_ORDER.length]
  }
}
