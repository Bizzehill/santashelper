'use client'
import React from 'react'

type TagProps = {
  text: string
  scheme?: 'silver' | 'gold' | 'accent' | 'neutral'
  className?: string
}

export default function Tag({ text, scheme = 'neutral', className = '' }: TagProps) {
  const base = 'inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full shadow-sm border'
  const schemes: Record<Required<TagProps>['scheme'], string> = {
    neutral: 'bg-[#1a2236] border-[#2c3a5a] text-gray-100',
    accent: 'bg-[var(--accent)] border-[var(--accent)] text-[#0b1220]',
    silver: 'bg-gradient-to-r from-[#cfd8e3] to-[#e2e8f0] text-[#0b1220] border-[#94a3b8]',
    gold: 'bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] text-[#0b1220] border-[#b45309]'
  }
  return (
    <span className={`${base} ${schemes[scheme]} ${className}`}>{text}</span>
  )
}
