/**
 * OrganismDebugOverlay — on-screen vitals HUD for the live Organism.
 *
 * Listens for the `organism:debug` CustomEvent emitted ~4Hz by
 * GeneratorOrchestrator.emitDebugSnapshot and paints the engine's live state
 * in a fixed corner panel. Built so we can SEE why the beat goes silent
 * without digging through the browser console.
 *
 * Read it like this when sound dies:
 *   - state turns red (Dormant/Awakening)  → the engine powered itself down
 *   - presence < 0.05 AND bounce < 0.3 (both red) → input starvation: nothing
 *     is feeding the engine, so it winds down (this is the no-mic case)
 *   - a generator row is red (on but level ~0) → that voice went silent
 *
 * DEV-only: returns null in production builds.
 */

import { useEffect, useRef, useState } from 'react'

interface GenVitals { on: boolean; lvl: number; out: number }
interface DebugSnapshot {
  state:       string
  running:     boolean
  transport:   string
  bar:         number
  mode:        string
  subGenre:    string
  section:     string
  presence:    number
  bounce:      number
  density:     number
  voiceActive: boolean
  flowDepth:   number
  destVol:     number
  gens: {
    drum:    GenVitals
    bass:    GenVitals
    melody:  GenVitals
    chord:   GenVitals
    texture: GenVitals
  }
}

const GREEN = '#4ade80'
const RED   = '#f87171'
const DIM   = '#94a3b8'

function n(x: number): string {
  return Number.isFinite(x) ? x.toFixed(2) : '—'
}

export function OrganismDebugOverlay() {
  const [snap, setSnap] = useState<DebugSnapshot | null>(null)
  const [open, setOpen] = useState(true)

  const lastSnapRef = useRef(0)

  useEffect(() => {
    const handler = (e: Event) => {
      const now = performance.now()
      if (now - lastSnapRef.current < 500) return
      lastSnapRef.current = now
      setSnap((e as CustomEvent).detail as DebugSnapshot)
    }
    window.addEventListener('organism:debug', handler)
    return () => window.removeEventListener('organism:debug', handler)
  }, [])

  // DEV-only — never ships to production.
  if (!import.meta.env.DEV) return null

  const downState = snap ? (snap.state === 'dormant' || snap.state === 'awakening') : false
  const presenceLow = snap ? snap.presence < 0.05 : false
  const bounceLow    = snap ? snap.bounce < 0.3 : false
  // "Starving" = the exact StateMachine wind-down condition.
  const starving = snap ? (!snap.voiceActive && presenceLow && bounceLow) : false

  const wrap: React.CSSProperties = {
    position: 'fixed', left: 8, bottom: 8, zIndex: 99999,
    font: '11px/1.4 ui-monospace, Menlo, Consolas, monospace',
    background: 'rgba(10,12,18,0.92)', color: '#e2e8f0',
    border: `1px solid ${starving ? RED : '#334155'}`, borderRadius: 8,
    padding: open ? '8px 10px' : '4px 8px', minWidth: open ? 230 : 'auto',
    pointerEvents: 'auto', userSelect: 'text', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  }

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: DIM }}>{label}</span><span>{value}</span>
    </div>
  )

  const genRow = (name: string, g: GenVitals) => {
    // The REAL test: enabled + active, but output gain is ~0 → muted somewhere.
    const silentButOn = g.on && g.lvl >= 0.02 && g.out < 0.001
    return (
      <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12,
        color: silentButOn ? RED : g.on ? GREEN : DIM }}>
        <span>{name}{g.on ? '' : ' (off)'}</span>
        <span>act {n(g.lvl)} · out {n(g.out)}{silentButOn ? ' ⚠' : ''}</span>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        marginBottom: open ? 6 : 0, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <strong style={{ color: starving ? RED : GREEN }}>
          🩺 ORGANISM {starving ? '— STARVING' : ''}
        </strong>
        <span style={{ color: DIM }}>{open ? '▾' : '▸'}</span>
      </div>

      {!snap && open && <div style={{ color: DIM }}>waiting for engine… (press Start)</div>}

      {snap && open && (
        <>
          {row('state', <span style={{ color: downState ? RED : GREEN }}>{snap.state}</span>)}
          {row('transport', `${snap.transport} · bar ${snap.bar}`)}
          {row('mode / sub', `${snap.mode} / ${snap.subGenre}`)}
          {row('section', snap.section)}
          {row('presence', <span style={{ color: presenceLow ? RED : GREEN }}>{n(snap.presence)}{presenceLow ? ' ⚠<0.05' : ''}</span>)}
          {row('bounce', <span style={{ color: bounceLow ? RED : GREEN }}>{n(snap.bounce)}{bounceLow ? ' ⚠<0.3' : ''}</span>)}
          {row('voiceActive', <span style={{ color: snap.voiceActive ? GREEN : DIM }}>{String(snap.voiceActive)}</span>)}
          {row('flow / dens', `${n(snap.flowDepth)} / ${n(snap.density)}`)}
          {row('dest vol dB', <span style={{ color: (!Number.isFinite(snap.destVol) || snap.destVol < -60) ? RED : GREEN }}>
            {Number.isFinite(snap.destVol) ? snap.destVol.toFixed(1) : '-inf (MUTED)'}</span>)}
          <div style={{ borderTop: '1px solid #334155', margin: '6px 0' }} />
          {genRow('drum', snap.gens.drum)}
          {genRow('bass', snap.gens.bass)}
          {genRow('melody', snap.gens.melody)}
          {genRow('chord', snap.gens.chord)}
          {genRow('texture', snap.gens.texture)}
          {starving && (
            <div style={{ marginTop: 6, color: RED }}>
              ⚠ winding down: no input + presence/bounce below threshold
            </div>
          )}
        </>
      )}
    </div>
  )
}
