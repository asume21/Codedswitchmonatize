// Organism-specific structured logger. Emits [organism] events so the user can
// filter the console (DevTools → type "[organism]" in the filter box).
//
// Enabled in DEV, or in prod when the URL contains ?organism-log=1. The phase
// helper times a block; the heartbeat publishes a periodic snapshot of the
// live state so stalls can be correlated to state/preset/arrangement changes.
//
// Keep payloads small — this runs on hot paths.

type LogLevel = 'info' | 'warn' | 'error'

const enabled: boolean = (() => {
  try {
    if (import.meta.env.DEV) return true
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).has('organism-log')
    }
  } catch {
    // ignore — we default to false below
  }
  return false
})()

const levelStyle: Record<LogLevel, string> = {
  info:  'color:#7dd3fc;font-weight:600',
  warn:  'color:#fbbf24;font-weight:600',
  error: 'color:#f87171;font-weight:700',
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return String(v)
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  try { return JSON.stringify(v) } catch { return String(v) }
}

export function orgLog(
  event: string,
  data?: Record<string, unknown>,
  level: LogLevel = 'info',
): void {
  if (!enabled) return
  const t = performance.now().toFixed(0).padStart(7)
  const payload = data
    ? ' ' + Object.entries(data).map(([k, v]) => `${k}=${formatValue(v)}`).join(' ')
    : ''
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
   
  ;(console as unknown as Record<string, (...a: unknown[]) => void>)[method](
    `%c[organism]%c ${t}ms  ${event}${payload}`,
    levelStyle[level],
    'color:inherit',
  )
}

/**
 * Time a block. Returns a done() that logs the duration; thresholds promote to
 * warn when the phase runs longer than its budget.
 *
 *   const end = orgPhase('quickStart', 300)
 *   await doWork()
 *   end({ presetId })
 */
export function orgPhase(
  event: string,
  warnAboveMs: number = 250,
): (data?: Record<string, unknown>) => void {
  if (!enabled) return () => {}
  const start = performance.now()
  orgLog(event + ':begin')
  return (data) => {
    const ms = performance.now() - start
    const level: LogLevel = ms > warnAboveMs ? 'warn' : 'info'
    orgLog(event + ':end', { ms: Math.round(ms), ...(data ?? {}) }, level)
  }
}

/**
 * Publish a snapshot every `intervalMs`. Snapshot throws are swallowed so the
 * heartbeat survives transient nulls during engine init/teardown.
 */
export function startOrgHeartbeat(
  getSnapshot: () => Record<string, unknown>,
  intervalMs: number = 2000,
): () => void {
  if (!enabled) return () => {}
  const id = window.setInterval(() => {
    try {
      orgLog('heartbeat', getSnapshot())
    } catch (err) {
      orgLog('heartbeat:error', { err: String(err) }, 'warn')
    }
  }, intervalMs)
  return () => window.clearInterval(id)
}

export const ORGANISM_LOG_ENABLED = enabled
