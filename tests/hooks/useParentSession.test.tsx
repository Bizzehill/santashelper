// @ts-nocheck
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import React, { useEffect } from 'react'
import { useParentSession } from '@/hooks/useParentSession'

function Probe({ onValue }: { onValue: (v:any)=>void }) {
  const v = useParentSession()
  useEffect(() => { onValue(v) }, [v.parentSessionValid, v.expiresAt])
  return null
}

describe('useParentSession', () => {
  let container: HTMLElement
  let root: any

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    window.localStorage.clear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
    jest.useRealTimers()
  })

  test('starts and respects expiry (clock skew)', async () => {
    const values: any[] = []
    await act(async () => {
      root.render(<Probe onValue={(v)=>values.push(v)} />)
    })
    const ttl = Date.now() + 1000
    await act(async () => {
      values[values.length-1].startParentSession(ttl)
    })
    expect(values[values.length-1].parentSessionValid).toBe(true)

    // Advance past expiry to simulate skew
    await act(async () => {
      jest.setSystemTime(ttl + 5)
      root.render(<Probe onValue={(v)=>values.push(v)} />)
    })
    expect(values[values.length-1].parentSessionValid).toBe(false)
  })

  test('handles cleared localStorage gracefully', async () => {
    const values: any[] = []
    await act(async () => {
      root.render(<Probe onValue={(v)=>values.push(v)} />)
    })
    expect(values[values.length-1].parentSessionValid).toBe(false)
    const ttl = Date.now() + 1000
    await act(async () => { values[values.length-1].startParentSession(ttl) })
    expect(values[values.length-1].parentSessionValid).toBe(true)
    await act(async () => { window.localStorage.clear(); root.render(<Probe onValue={(v)=>values.push(v)} />) })
    expect(values[values.length-1].parentSessionValid).toBe(false)
  })
})
