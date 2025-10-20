'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { signInAnonymously } from 'firebase/auth'
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { useChildSession } from '@/hooks/useChildSession'

type Wish = { id?: string; title: string; createdAt?: any }
type Deed = { id?: string; description: string; createdAt?: any }

// Storage layout:
// - Anonymous: users/{anonUid}/anonSanta/{wishes|deeds}
// - Linked child session: users/{familyId}/children/{childId}/{wishlist|deeds}

export function useAnonSantaWorkspace() {
  const { session, childSessionValid } = useChildSession()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const linked = childSessionValid && !!session
  const base = useMemo(() => {
    if (linked && session) {
      return { path: `users/${session.familyId}/children/${session.childId}`, mode: 'linked' as const }
    }
    const uid = auth.currentUser?.uid
    return { path: uid ? `users/${uid}/anonSanta` : null, mode: 'anon' as const }
  }, [linked, session])

  useEffect(() => {
    let cancelled = false
    async function ensureAnon() {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth)
        }
        if (!cancelled) setReady(true)
      } catch (e: any) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      }
    }
    if (!linked) ensureAnon()
    else setReady(true)
    return () => { cancelled = true }
  }, [linked])

  const getWishes = useCallback(async (): Promise<Wish[]> => {
    const basePath = base.path
    if (!basePath) return []
    const col = linked
      ? collection(db, `${basePath}/wishlist`)
      : collection(db, `${basePath}/wishes`)
    const snap = await getDocs(query(col))
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
  }, [base, linked])

  const addWish = useCallback(async (title: string) => {
    const basePath = base.path
    if (!basePath || !title.trim()) return
    const col = linked
      ? collection(db, `${basePath}/wishlist`)
      : collection(db, `${basePath}/wishes`)
    await addDoc(col, { title: title.trim(), createdAt: serverTimestamp() })
  }, [base, linked])

  const getDeeds = useCallback(async (): Promise<Deed[]> => {
    const basePath = base.path
    if (!basePath) return []
    const col = collection(db, `${basePath}/deeds`)
    const snap = await getDocs(query(col))
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
  }, [base])

  const addDeed = useCallback(async (description: string) => {
    const basePath = base.path
    if (!basePath || !description.trim()) return
    const col = collection(db, `${basePath}/deeds`)
    // In linked mode, rules allow child create; in anon mode, owned by anon uid.
    await addDoc(col, { description: description.trim(), createdAt: serverTimestamp() })
  }, [base])

  return { ready, error, mode: base.mode, getWishes, addWish, getDeeds, addDeed }
}

export type UseAnonSantaWorkspace = ReturnType<typeof useAnonSantaWorkspace>
