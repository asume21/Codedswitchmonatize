import { describe, it, expect } from 'vitest'
import { parseRetryAfterMs } from '../replicateService'

/**
 * Replicate throttles hard on low-credit accounts:
 *   429 {"detail":"...reduced to 6 requests per minute with a burst of 1
 *        requests while you have less than $5.0 in credit...",
 *        "retry_after":6}
 *
 * The pack generator fires one request per variation back to back, so on a
 * low-credit account 3 of every 4 were rejected instantly and silently dropped
 * — packs came back with a single sample. Waiting costs nothing; throwing away
 * a paid-for generation slot costs everything.
 */
describe('parseRetryAfterMs', () => {
  it('reads retry_after (seconds) from the JSON body', () => {
    expect(parseRetryAfterMs('{"detail":"throttled","retry_after":6}', new Headers())).toBe(6000)
  })

  it('falls back to the Retry-After header', () => {
    expect(parseRetryAfterMs('not json', new Headers({ 'retry-after': '3' }))).toBe(3000)
  })

  it('prefers the body value over the header', () => {
    expect(parseRetryAfterMs('{"retry_after":9}', new Headers({ 'retry-after': '2' }))).toBe(9000)
  })

  it('uses a sane default when neither is present', () => {
    expect(parseRetryAfterMs('{}', new Headers())).toBe(2000)
  })

  it('never waits absurdly long on a hostile value', () => {
    expect(parseRetryAfterMs('{"retry_after":100000}', new Headers())).toBe(60000)
  })

  it('ignores negative or non-numeric values', () => {
    expect(parseRetryAfterMs('{"retry_after":-5}', new Headers())).toBe(2000)
    expect(parseRetryAfterMs('{"retry_after":"soon"}', new Headers())).toBe(2000)
  })
})
