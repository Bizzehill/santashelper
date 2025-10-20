'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, User } from 'firebase/auth'

type Claims = Record<string, unknown> | null

export function useAuthWithClaims() {
  const [user, setUser] = useState<User | null>(null)
  const [claims, setClaims] = useState<Claims>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!mounted.current) return
        setUser(u)
        setClaims(null)
        setError(null)
        if (u) {
          // Force refresh to ensure latest custom claims
          await u.getIdToken(true)
          const token = await u.getIdTokenResult()
          if (!mounted.current) return
          setClaims(token.claims || null)
        } else {
          if (!mounted.current) return
          setClaims(null)
        }
      } catch (e: any) {
        if (!mounted.current) return
        setError(e?.message || 'Failed to load auth claims')
      } finally {
        if (mounted.current) setLoading(false)
      }
    })
    return () => {
      mounted.current = false
      unsub()
    }
  }, [])

  const value = useMemo(() => ({ user, claims, loading, error }), [user, claims, loading, error])
  return value
}

export type UseAuthWithClaims = ReturnType<typeof useAuthWithClaims>
