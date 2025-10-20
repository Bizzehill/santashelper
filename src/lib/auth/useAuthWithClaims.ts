'use client'
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export type AuthClaims = Record<string, unknown>

export function useAuthWithClaims(): {
  user: User | null
  claims: AuthClaims | null
  loading: boolean
  error: Error | null
} {
  const [user, setUser] = useState<User | null>(null)
  const [claims, setClaims] = useState<AuthClaims | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Subscribe to auth state. On login, force a token refresh so we read latest custom claims.
    const unsub = onAuthStateChanged(auth, async (u) => {
      setError(null)
      setUser(u)
      if (!u) {
        setClaims(null)
        setLoading(false)
        return
      }
      try {
        // Force refresh to ensure we get up-to-date custom claims
        await u.getIdToken(true)
        const token = await u.getIdTokenResult()
        setClaims(token.claims as AuthClaims)
      } catch (e: any) {
        // Non-fatal: capture error and best-effort read claims without refresh
        setError(e instanceof Error ? e : new Error(String(e)))
        try {
          const token = await u.getIdTokenResult()
          setClaims(token.claims as AuthClaims)
        } catch {
          // Ignore secondary failure; claims remain null
        }
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  return { user, claims, loading, error }
}
