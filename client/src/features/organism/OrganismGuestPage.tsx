import React from 'react'
import { Link } from 'wouter'
import { Zap, Lock } from 'lucide-react'
import { OrganismCommandCenter } from './OrganismCommandCenter'
import { useOrganismActivation, useOrganismSafe } from './GlobalOrganismWrapper'

export function OrganismGuestPage() {
  const { isActivated, activate } = useOrganismActivation()
  const organism = useOrganismSafe()

  React.useEffect(() => {
    if (!isActivated) activate()
  }, [activate, isActivated])

  if (!organism) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-cyan-300">
        <div className="text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 animate-pulse" />
          <p className="text-sm font-semibold">Booting Organism engines...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="relative h-screen bg-black">
      <OrganismCommandCenter />
      {organism.isGuestLocked && <GuestLockOverlay />}
    </main>
  )
}

function GuestLockOverlay() {
  return (
    <div
      className="absolute inset-0 z-[10000] flex items-center justify-center backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-lock-title"
    >
      <div
        className="mx-4 max-w-md rounded-2xl border border-cyan-500/30 bg-black/80 p-7 text-center shadow-[0_0_40px_rgba(6,182,212,0.25)]"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10">
          <Lock className="h-5 w-5 text-cyan-300" />
        </div>
        <h2 id="guest-lock-title" className="mb-2 text-xl font-black tracking-wide text-white">
          Your 60 seconds are up
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-cyan-100/70">
          The beat keeps playing. Sign up free to keep jamming, save sessions, and unlock every control.
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/signup">
            <button className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:opacity-90">
              Sign Up Free
            </button>
          </Link>
          <Link href="/login">
            <button className="w-full rounded-xl border border-white/15 bg-transparent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70 hover:bg-white/5">
              Already have an account? Log in
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default OrganismGuestPage
