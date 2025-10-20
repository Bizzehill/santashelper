'use client'
import React from 'react'
import ParentRoute from '@/components/ParentRoute'

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ParentRoute>
      {children}
    </ParentRoute>
  )
}
