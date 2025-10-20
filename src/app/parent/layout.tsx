'use client'
import React from 'react'
import ParentGuard from '@/components/ParentGuard'

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ParentGuard>
      {children}
    </ParentGuard>
  )
}
