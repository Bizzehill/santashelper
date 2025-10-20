'use client'
import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react'
import { useAuthWithClaims } from '@/hooks/useAuthWithClaims'
import { useParentSession } from '@/hooks/useParentSession'
import { useRouter } from 'next/navigation'

export default function ParentRoute({ children }: PropsWithChildren) {
  const router = useRouter()
  const { user, claims, loading, error } = useAuthWithClaims()
  const { parentSessionValid } = useParentSession()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const role = useMemo(() => (claims?.role as string | undefined) ?? undefined, [claims])
  const allowed = useMemo(() => !!user && role === 'parent' && parentSessionValid, [user, role, parentSessionValid])

  useEffect(() => {
    if (!mounted) return
    if (loading) return
    if (!allowed) {
      router.replace('/parent-gate')
    }
  }, [mounted, loading, allowed, router])

  // Minimal skeleton while loading or until mounted
  if (!mounted || loading) {
    return (
      <div className="card" aria-busy="true" aria-live="polite">
        <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: '70%' }} />
      </div>
    )
  }

  if (!allowed) return null

  return <>{children}</>
}
