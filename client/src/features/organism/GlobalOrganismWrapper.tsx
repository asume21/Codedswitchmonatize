/**
 * GlobalOrganismWrapper
 *
 * Provides the OrganismProvider at the app level so the beat engine is
 * available on every page. The heavy engines are only initialized once the
 * user explicitly activates the organism (via the floating controller or the
 * dedicated studio tab). Until then, this renders just the context shell
 * with no audio overhead — keeping the landing page fast.
 *
 * Usage in App.tsx:
 *   <GlobalOrganismWrapper>
 *     {children}
 *   </GlobalOrganismWrapper>
 */

import React, { useState, useCallback, createContext, useContext, useMemo, Suspense, lazy } from 'react'
import { OrganismDebugOverlay } from './OrganismDebugOverlay'
import { OrganismContext } from './OrganismContext'
import type { OrganismContextValue } from './OrganismContext'
import { useAuth } from '@/contexts/AuthContext'

// Lazy-load the heavy provider so Tone.js + the generator engines (~300KB+)
// stay OUT of the initial chunk. The landing/login/signup pages never call
// activate(), so they never download the audio engine. The chunk only loads
// once the organism is actually activated (studio / organism / recording booth).
// Consumers read state via useOrganism() from the lightweight ./OrganismContext,
// so this split never affects them.
const OrganismProvider = lazy(() =>
  import('./OrganismProvider').then(m => ({ default: m.OrganismProvider })),
)

interface GlobalOrganismState {
  /** Whether the heavy OrganismProvider is mounted */
  isActivated: boolean
  /** Mount the OrganismProvider (call once to boot engines) */
  activate: () => void
}

const GlobalOrganismActivationContext = createContext<GlobalOrganismState>({
  isActivated: false,
  activate: () => {},
})

export function useOrganismActivation(): GlobalOrganismState {
  return useContext(GlobalOrganismActivationContext)
}

/**
 * Tries to consume the OrganismContext. Returns null if provider is not
 * mounted yet (i.e. organism hasn't been activated).
 */
export function useOrganismSafe(): OrganismContextValue | null {
  return useContext(OrganismContext)
}

interface Props {
  children: React.ReactNode
}

export function GlobalOrganismWrapper({ children }: Props) {
  const [isActivated, setIsActivated] = useState(false)
  const { isAuthenticated } = useAuth()

  const activate = useCallback(() => {
    if (!isActivated) setIsActivated(true)
  }, [isActivated])

  const activationValue = { isActivated, activate }

  // userId is stashed by login/signup alongside the JWT — the JWT is opaque to the
  // client now, so we can't derive userId from it without a decode dependency.
  const userId = useMemo(() => {
    if (!isAuthenticated) return 'guest-user'
    const id = (localStorage.getItem('authUserId') ?? '').trim()
    return id || 'guest-user'
  }, [isAuthenticated])

  return (
    <GlobalOrganismActivationContext.Provider value={activationValue}>
      {isActivated ? (
        // fallback={children} keeps the app visible while the audio-engine
        // chunk downloads; the subtree re-mounts wrapped once it resolves
        // (same remount that already happened on activation before this split).
        <Suspense fallback={children}>
          <OrganismProvider userId={userId} isGuest={!isAuthenticated}>
            {children}
            <OrganismDebugOverlay />
          </OrganismProvider>
        </Suspense>
      ) : (
        children
      )}
    </GlobalOrganismActivationContext.Provider>
  )
}
