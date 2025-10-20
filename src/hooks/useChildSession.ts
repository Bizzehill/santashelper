'use client'
import { useEffect, useMemo, useState } from 'react'

type ChildSession = {
  familyId: string
  childId: string
  expiresAt: number
}

const KEY = 'childSession'

export function useChildSession() {
  const [session, setSession] = useState<ChildSession | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as ChildSession
      setSession(parsed)
    } catch {
      // ignore
    }
  }, [])

  const valid = useMemo(() => {
    if (!session) return false
    return Date.now() < session.expiresAt
  }, [session])

  function startChildSession(familyId: string, childId: string, expiresAt: number) {
    const s: ChildSession = { familyId, childId, expiresAt }
    setSession(s)
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(s))
  }
  function endChildSession() {
    setSession(null)
    if (typeof window !== 'undefined') window.localStorage.removeItem(KEY)
  }

  return { session, childSessionValid: valid, startChildSession, endChildSession }
}

export type UseChildSession = ReturnType<typeof useChildSession>
