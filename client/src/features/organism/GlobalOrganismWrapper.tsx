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

import React, { useState, useCallback, createContext, useContext, useMemo } from 'react'
import { OrganismProvider } from './OrganismProvider'
import { OrganismContext } from './OrganismContext'
import type { OrganismContextValue } from './OrganismContext'
import { useAuth } from '@/contexts/AuthContext'

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

  // Derive user ID from stored auth token (format: "Bearer <userId>") or fall back to guest
  const userId = useMemo(() => {
    if (!isAuthenticated) return 'guest-user'
    const token = localStorage.getItem('authToken') ?? ''
    const id = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim()
    return id || 'guest-user'
  }, [isAuthenticated])

  return (
    <GlobalOrganismActivationContext.Provider value={activationValue}>
      {isActivated ? (
        <OrganismProvider userId={userId} isGuest={!isAuthenticated}>
          {children}
        </OrganismProvider>
      ) : (
        children
      )}
    </GlobalOrganismActivationContext.Provider>
  )
}
