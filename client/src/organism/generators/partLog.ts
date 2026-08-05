// Part lifecycle log — answers "what tore the sound down, and WHEN".
//
// The user hears a phrase get cut off mid-way. Static reading of the code gives
// several candidates (per-bar chord rebuilds, hard-cut stopPart, preset swap
// teardown) and no way to tell which one he actually heard. Guessing between
// them has already cost a day this session; __audioHealth() and getPartDebug()
// both settled their questions in minutes because they RECORDED instead.
//
// Ring buffer, no console spam. While playing, read it in the browser console:
//
//   __partLog()            -> the last 200 lifecycle events, newest last
//   __partLog('chord')     -> just that role
//   __partLogClear()
//
// Each row carries the transport position, so an audible tear at bar 7 can be
// matched to whatever happened at bar 7.
import * as Tone from 'tone'

export type PartAction =
  | 'rebuild:seamless'   // old part stopped AT the next boundary — should be inaudible
  | 'rebuild:hard-cut'   // old part stopped NOW, mid-phrase — audible teardown
  | 'stopPart'           // full stop + dispose + releaseAll — audible if it was sounding
  | 'silent'             // generator chose to play nothing this cycle
  | 'start'

interface PartLogRow {
  t: number
  role: string
  action: PartAction
  pos: string
  detail?: Record<string, unknown>
}

const RING = 200
const rows: PartLogRow[] = []

export function logPart(role: string, action: PartAction, detail?: Record<string, unknown>): void {
  let pos = '?'
  try { pos = String(Tone.getTransport().position) } catch { /* transport not up yet */ }
  rows.push({ t: Math.round(performance.now()), role, action, pos, detail })
  if (rows.length > RING) rows.shift()
}

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__partLog = (role?: string) =>
    (role ? rows.filter(r => r.role === role) : rows).map(r =>
      `${String(r.pos).padEnd(14)} ${r.role.padEnd(7)} ${r.action}${r.detail ? ' ' + JSON.stringify(r.detail) : ''}`)
  ;(window as unknown as Record<string, unknown>).__partLogClear = () => { rows.length = 0 }
}
