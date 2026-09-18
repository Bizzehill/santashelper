'use client'
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'parentSessionExpiresAt'

function readExpiresAt(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function useParentSession() {
  const [mounted, setMounted] = useState(false)
  const [, tick] = useState(0)
  const forceUpdate = useCallback(() => tick((t) => t + 1), [])

  useEffect(() => { setMounted(true) }, [])

  // Re-read on every render rather than caching in state, so an external
  // change (another tab signing out, the PIN session simply timing out)
  // is reflected the moment anything causes this component to re-render.
  const expiresAt = mounted ? readExpiresAt() : null
  const parentSessionValid = expiresAt != null && Date.now() < expiresAt

  // A session that's merely sitting open with no unrelated re-render would
  // otherwise never notice it expired. Schedule one right at the expiry
  // moment so the UI locks itself out on its own.
  useEffect(() => {
    if (expiresAt == null) return
    const msRemaining = expiresAt - Date.now()
    if (msRemaining <= 0) return
    const id = setTimeout(forceUpdate, msRemaining)
    return () => clearTimeout(id)
  }, [expiresAt, forceUpdate])

  const startParentSession = useCallback((expiresAtEpochMs: number) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, String(expiresAtEpochMs))
    } catch {
      // ignore storage errors
    }
    forceUpdate()
  }, [forceUpdate])

  const endParentSession = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } finally {
      forceUpdate()
    }
  }, [forceUpdate])

  return { parentSessionValid, startParentSession, endParentSession, expiresAt }
}

export type UseParentSession = ReturnType<typeof useParentSession>
