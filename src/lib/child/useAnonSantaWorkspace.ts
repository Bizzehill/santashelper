'use client'
import { useEffect, useMemo, useState } from 'react'
import { auth } from '@/lib/firebase'
import { signInAnonymously } from 'firebase/auth'
import { useChildSession } from '@/hooks/useChildSession'

// Resolves where a kid's Santa data lives, in either of two states:
// - "anon": trying Santa out before linking to a family. Data lives in a private
//   scratch space scoped to their anonymous Firebase uid.
// - "linked": already linked to a family (via /santa/link-family). Data lives in
//   the real, parent-visible child record, and Santa's helper functions grant
//   access to exactly that one child via a short-lived child session.
//
// In both states `basePath` points at a single Firestore *document* whose
// subcollections (wishlist/deeds/affirmations) hold the actual data, so callers
// can treat both states identically once they have basePath.
export function useSantaAccess() {
  const { session, childSessionValid } = useChildSession()
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null)
  const [authReady, setAuthReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const linked = childSessionValid && !!session

  useEffect(() => {
    let cancelled = false
    async function ensureAuth() {
      try {
        if (!auth.currentUser) {
          const credential = await signInAnonymously(auth)
          if (!cancelled) setUid(credential.user.uid)
        } else if (!cancelled) {
          setUid(auth.currentUser.uid)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    }
    ensureAuth()
    return () => { cancelled = true }
  }, [])

  const basePath = useMemo(() => {
    if (linked && session) return `users/${session.familyId}/children/${session.childId}`
    return uid ? `users/${uid}/anonSanta/data` : null
  }, [linked, session, uid])

  return {
    ready: authReady && !!basePath,
    error,
    mode: linked ? ('linked' as const) : ('anon' as const),
    basePath,
    familyId: linked && session ? session.familyId : null,
    childId: linked && session ? session.childId : null,
  }
}

export type SantaAccess = ReturnType<typeof useSantaAccess>
