// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'

// Mock firebase app wrapper used by the hook
jest.mock('@/lib/firebase', () => ({ auth: {} }))

// Control variables for firebase/auth mock
let mockUser: any = null
let shouldTokenRefreshFail = false

// Mock firebase/auth functions consumed by the hook
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: any, cb: (u: any)=>void) => {
    // call asynchronously to simulate real behavior
    Promise.resolve().then(() => cb(mockUser))
    return () => {}
  },
}))

// Build a dynamic user object with token methods
function makeUser(claims: Record<string, unknown>) {
  return {
    getIdToken: async (_force?: boolean) => {
      if (shouldTokenRefreshFail) throw new Error('token refresh failed')
      return 'token'
    },
    getIdTokenResult: async () => ({ claims }),
  }
}

// Import under test AFTER mocks
import { useAuthWithClaims } from '@/hooks/useAuthWithClaims'

function HookProbe({ onValue }: { onValue: (v: any)=>void }) {
  const v = useAuthWithClaims()
  useEffect(() => { onValue(v) }, [v.user, v.claims, v.loading, v.error])
  return null
}

describe('useAuthWithClaims', () => {
  let container: HTMLElement
  let root: any

  beforeEach(() => {
    jest.resetModules()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockUser = null
    shouldTokenRefreshFail = false
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
  })

  test('returns user and claims on success', async () => {
    const values: any[] = []
    mockUser = makeUser({ role: 'parent' })

    await act(async () => {
      root.render(<HookProbe onValue={(v)=>values.push(v)} />)
      // allow promises to settle
      await Promise.resolve()
      await Promise.resolve()
    })

    const last = values[values.length-1]
    expect(last.loading).toBe(false)
    expect(last.error).toBeNull()
    expect(last.user).toBeTruthy()
    expect(last.claims).toEqual({ role: 'parent' })
  })

  test('handles token refresh failure', async () => {
    const values: any[] = []
    mockUser = makeUser({ role: 'parent' })
    shouldTokenRefreshFail = true

    await act(async () => {
      root.render(<HookProbe onValue={(v)=>values.push(v)} />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const last = values[values.length-1]
    expect(last.loading).toBe(false)
    expect(last.user).toBeTruthy()
    expect(last.claims).toBeNull()
    expect(last.error).toMatch(/failed/i)
  })

  test('returns nulls when signed out', async () => {
    const values: any[] = []
    mockUser = null

    await act(async () => {
      root.render(<HookProbe onValue={(v)=>values.push(v)} />)
      await Promise.resolve()
    })

    const last = values[values.length-1]
    expect(last.loading).toBe(false)
    expect(last.user).toBeNull()
    expect(last.claims).toBeNull()
    expect(last.error).toBeNull()
  })
})
