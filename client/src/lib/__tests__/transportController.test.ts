import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  registerTransportOwner,
  requestTransportStart,
  requestTransportStop,
  requestTransportCancel,
  requestTransportPosition,
  hasTransportOwner,
} from '../transportController'

type MockTransport = {
  state: 'started' | 'stopped'
  start: () => void
  stop: () => void
  cancel: () => void
  position: number | string
}

const mockTransport: MockTransport = {
  state: 'stopped',
  start: vi.fn(() => { mockTransport.state = 'started' }),
  stop: vi.fn(() => { mockTransport.state = 'stopped' }),
  cancel: vi.fn(),
  position: 0,
}

vi.mock('tone', () => ({
  getTransport: () => mockTransport,
}))

describe('transportController', () => {
  beforeEach(() => {
    mockTransport.state = 'stopped'
    mockTransport.start.mockClear()
    mockTransport.stop.mockClear()
    mockTransport.cancel.mockClear()
    mockTransport.position = 0
  })

  it('uses default owner when no owner registered', async () => {
    expect(hasTransportOwner()).toBe(false)
    await requestTransportStart()
    expect(mockTransport.start).toHaveBeenCalled()
    requestTransportStop()
    expect(mockTransport.stop).toHaveBeenCalled()
  })

  it('routes calls to the registered owner', async () => {
    const owner = {
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      setPosition: vi.fn(),
    }
    const unregister = registerTransportOwner(owner)

    expect(hasTransportOwner()).toBe(true)
    await requestTransportStart()
    expect(owner.start).toHaveBeenCalled()
    requestTransportStop()
    expect(owner.stop).toHaveBeenCalled()
    requestTransportCancel()
    expect(owner.cancel).toHaveBeenCalled()
    requestTransportPosition('1:0')
    expect(owner.setPosition).toHaveBeenCalledWith('1:0')

    unregister()
    expect(hasTransportOwner()).toBe(false)
  })

  it('falls back to default owner after unregister', async () => {
    const owner = { start: vi.fn(), stop: vi.fn() }
    const unregister = registerTransportOwner(owner)
    unregister()

    await requestTransportStart()
    expect(mockTransport.start).toHaveBeenCalled()
  })
})
