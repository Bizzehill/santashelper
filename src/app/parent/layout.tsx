'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthWithClaims } from '@/lib/auth/useAuthWithClaims'
import { db } from '@/lib/firebase'
import { collection } from 'firebase/firestore'
import { getCountFromServer } from 'firebase/firestore'

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, claims, loading } = useAuthWithClaims()
  const [checking, setChecking] = useState(true)

  const role = useMemo(() => (claims?.role as string | undefined) || undefined, [claims])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (loading) return // still determining auth/claims
      if (!user || role !== 'parent') {
        router.replace('/parent-gate')
        return
      }
      // Parent: check if any children exist
      try {
        const childrenCol = collection(db, `users/${user.uid}/children`)
        const snapshot = await getCountFromServer(childrenCol)
        const count = snapshot.data().count || 0
        if (cancelled) return
        if (count === 0) {
          router.replace('/parent/onboarding')
          return
        }
      } catch (e) {
        // On failure, be conservative and stay; optionally you could log
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [loading, user, role, router])

  if (loading || checking) {
    return (
      <div className="p-6 animate-pulse" aria-busy="true" aria-live="polite">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-64 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-56 bg-gray-200 rounded" />
      </div>
    )
  }

  // Parent with at least one child: render content
  return <>{children}</>
}
