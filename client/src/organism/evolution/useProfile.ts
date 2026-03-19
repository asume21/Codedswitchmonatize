import { useEffect, useState, useCallback } from 'react'
import type { PhysicsProfile }  from './types'
import type { PhysicsEngine }   from '../physics/PhysicsEngine'

interface UseProfileReturn {
  profile:        PhysicsProfile | null
  recomputing:    boolean
  recompute:      () => Promise<void>
  applyToEngine:  (engine: PhysicsEngine) => void
}

export function useProfile(
  userId:        string,
  physicsEngine: PhysicsEngine | null
): UseProfileReturn {
  const [profile,     setProfile]     = useState<PhysicsProfile | null>(null)
  const [recomputing, setRecomputing] = useState(false)

  // Load profile on mount
  useEffect(() => {
    if (!userId) return
    fetch(`/api/organism/profile/${userId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setProfile(data)
          physicsEngine?.setProfile(data)
        }
      })
      .catch(() => {})   // No profile yet — organism starts neutral
  }, [userId, physicsEngine])

  const recompute = useCallback(async () => {
    if (!userId) return
    setRecomputing(true)
    try {
      const res  = await fetch(`/api/organism/profile/${userId}/recompute`, {
        method: 'POST',
      })
      if (res.ok) {
        const newProfile = await res.json()
        setProfile(newProfile)
        physicsEngine?.setProfile(newProfile)
      }
    } finally {
      setRecomputing(false)
    }
  }, [userId, physicsEngine])

  const applyToEngine = useCallback((engine: PhysicsEngine) => {
    if (profile) engine.setProfile(profile)
  }, [profile])

  return { profile, recomputing, recompute, applyToEngine }
}
