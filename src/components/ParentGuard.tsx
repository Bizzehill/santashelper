'use client'
import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react'
import { useAuthWithClaims } from '@/hooks/useAuthWithClaims'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { ensureFamilySettings } from '@/lib/functions'

type GuardState = 'loading' | 'show-gate' | 'redirect-gate' | 'redirect-setup' | 'allow'

export default function ParentGuard({ children }: PropsWithChildren) {
  const router = useRouter()
  const { user, claims, loading: authLoading } = useAuthWithClaims()
  const [state, setState] = useState<GuardState>('loading')
  const [mounted, setMounted] = useState(false)

  const role = useMemo(() => (claims?.role as string | undefined) ?? undefined, [claims])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!mounted) return
      if (authLoading) { setState('loading'); return }
      // If not signed in or not a parent → redirect to gate with kid-safe message
      if (!user || role !== 'parent') {
        setState('redirect-gate')
        router.replace('/parent-gate')
        return
      }
      // Ensure settings doc exists (idempotent) and then load it
      try {
        const fid = user.uid
        try { await ensureFamilySettings() } catch {}
        const settingsSnap = await getDoc(doc(db, 'families', fid, 'settings'))
        const parentPinHash = settingsSnap.exists() ? (settingsSnap.data()?.parentPinHash as string | undefined) : undefined
        // Decision matrix
        if (parentPinHash && parentPinHash.length > 0) {
          // Parent and PIN set → show gate (PIN verification happens there)
          setState('show-gate')
          router.replace('/parent-gate')
        } else {
          // Parent, but no PIN yet (404 or empty) → go to setup
          setState('redirect-setup')
          router.replace('/parent-pin-setup')
        }
      } catch {
        // Treat fetch errors same as unset to avoid blocking
        setState('redirect-setup')
        router.replace('/parent-pin-setup')
      }
    }
    run()
    return () => { cancelled = true }
  }, [mounted, authLoading, user, role, router])

  if (!mounted || authLoading || state === 'loading') {
    return (
      <div className="card" aria-busy="true" aria-live="polite">
        <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: '70%' }} />
      </div>
    )
  }

  // While redirecting, render nothing to avoid flicker
  if (state !== 'allow') return null

  return <>{children}</>
}
