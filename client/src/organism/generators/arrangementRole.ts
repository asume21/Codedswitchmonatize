import type { InstrumentRole } from '@shared/arrangement'
export type { InstrumentRole }

/**
 * A section role -> activity ceiling. The composer sets the ceiling (who plays /
 * how forward); the generator's reactive curve adds living feel UNDERNEATH it.
 * Defaults to 'support' so a generator with no plan loaded behaves like today.
 */
export function roleCeiling(role: InstrumentRole | undefined): number {
  switch (role) {
    case 'out':     return 0
    case 'lead':    return 1.0
    case 'support': return 0.6
    default:        return 0.6
  }
}
