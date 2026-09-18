'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthWithClaims } from '@/lib/auth/useAuthWithClaims'
import { useParentSession } from '@/hooks/useParentSession'
import { db } from '@/lib/firebase'
import { collection, getCountFromServer } from 'firebase/firestore'

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, claims, loading } = useAuthWithClaims()
  const { parentSessionValid } = useParentSession()
  const [checking, setChecking] = useState(true)

  const role = useMemo(() => (claims?.role as string | undefined) || undefined, [claims])
  // Onboarding must stay reachable for a brand-new parent who has no PIN set yet --
  // the PIN gate itself sends first-timers here, so it can't also block the door.
  const isOnboarding = pathname === '/parent/onboarding'

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (loading) return // still determining auth/claims
      if (!user || role !== 'parent') {
        router.replace('/parent-gate')
        return
      }
      // Every /parent/* page except onboarding requires a fresh PIN entry, not just
      // a signed-in parent account -- otherwise the PIN gate can be skipped entirely
      // by navigating straight to a URL like /parent/dashboard.
      if (!isOnboarding && !parentSessionValid) {
        router.replace('/parent-gate')
        return
      }
      // Parent: check if any children exist
      try {
        const childrenCol = collection(db, `users/${user.uid}/children`)
        const snapshot = await getCountFromServer(childrenCol)
        const count = snapshot.data().count || 0
        if (cancelled) return
        if (count === 0 && !isOnboarding) {
          router.replace('/parent/onboarding')
          return
        }
      } catch {
        // On failure, be conservative and stay put rather than bounce the user.
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [loading, user, role, parentSessionValid, isOnboarding, router])

  if (loading || checking) {
    return (
      <div className="p-6 animate-pulse" aria-busy="true" aria-live="polite">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-64 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-56 bg-gray-200 rounded" />
      </div>
    )
  }

  return <>{children}</>
}
