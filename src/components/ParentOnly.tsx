'use client'
import React, { PropsWithChildren, useMemo } from 'react'
import { useAuthWithClaims } from '@/hooks/useAuthWithClaims'
import { useParentSession } from '@/hooks/useParentSession'

type Props = PropsWithChildren<{ fallback?: React.ReactNode }>

export default function ParentOnly({ children, fallback = null }: Props) {
  const { claims } = useAuthWithClaims()
  const { parentSessionValid } = useParentSession()
  const allowed = useMemo(() => (claims?.role as string | undefined) === 'parent' && parentSessionValid, [claims, parentSessionValid])
  if (!allowed) return <>{fallback}</>
  return <>{children}</>
}
