'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'parentSessionExpiresAt'

export function useParentSession() {
  const [expiresAt, setExpiresAt] = useState<number | null>(null)

  // Load from localStorage on mount (SSR-safe)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const n = raw ? Number(raw) : NaN
      setExpiresAt(Number.isFinite(n) ? n : null)
    } catch {
      setExpiresAt(null)
    }
  }, [])

  const parentSessionValid = useMemo(() => {
    if (expiresAt == null) return false
    return Date.now() < expiresAt
  }, [expiresAt])

  const startParentSession = useCallback((expiresAtEpochMs: number) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, String(expiresAtEpochMs))
      setExpiresAt(expiresAtEpochMs)
    } catch {
      // ignore storage errors
    }
  }, [])

  const endParentSession = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } finally {
      setExpiresAt(null)
    }
  }, [])

  return { parentSessionValid, startParentSession, endParentSession, expiresAt }
}

export type UseParentSession = ReturnType<typeof useParentSession>
