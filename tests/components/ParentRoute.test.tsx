// @ts-nocheck
import React from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'

// Map next/navigation router mock via jest.config.js
import { __routerMock as router } from '../mocks/nextNavigation'

// Mock useAuthWithClaims and useParentSession to control states
jest.mock('@/hooks/useAuthWithClaims', () => ({
  useAuthWithClaims: jest.fn(),
}))

jest.mock('@/hooks/useParentSession', () => ({
  useParentSession: jest.fn(),
}))

import ParentRoute from '@/components/ParentRoute'
import { useAuthWithClaims } from '@/hooks/useAuthWithClaims'
import { useParentSession } from '@/hooks/useParentSession'

function render(el: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(el) })
  return { container, root }
}

describe('ParentRoute', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    router.calls.length = 0
  })

  test('redirects to /parent-gate when not allowed', async () => {
    ;(useAuthWithClaims as jest.Mock).mockReturnValue({ user: { uid: 'u' }, claims: { role: 'child' }, loading: false, error: null })
    ;(useParentSession as jest.Mock).mockReturnValue({ parentSessionValid: false })
    const { root } = render(<ParentRoute>ok</ParentRoute>)
    expect(router.calls[0]).toBe('/parent-gate')
    act(() => root.unmount())
  })

  test('renders children when user is parent and session valid', async () => {
    ;(useAuthWithClaims as jest.Mock).mockReturnValue({ user: { uid: 'u' }, claims: { role: 'parent' }, loading: false, error: null })
    ;(useParentSession as jest.Mock).mockReturnValue({ parentSessionValid: true })
    const { container, root } = render(<ParentRoute><div id="ok">OK</div></ParentRoute>)
    expect(container.querySelector('#ok')?.textContent).toBe('OK')
    act(() => root.unmount())
  })

  test('shows skeleton while loading', async () => {
    ;(useAuthWithClaims as jest.Mock).mockReturnValue({ user: null, claims: null, loading: true, error: null })
    ;(useParentSession as jest.Mock).mockReturnValue({ parentSessionValid: false })
    const { container, root } = render(<ParentRoute>ok</ParentRoute>)
    expect(container.querySelector('.skeleton')).toBeTruthy()
    act(() => root.unmount())
  })
})
