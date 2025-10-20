import Image from 'next/image'
import type { ReactNode } from 'react'

type Props = {
  src: string
  alt: string
  width?: number
  height?: number
  children: ReactNode
  compact?: boolean // smaller on mobile
  hoverBob?: boolean // whimsical bob on hover
}

export default function FeatureIcon({ src, alt, width = 60, height = 60, compact = true, hoverBob = true, children }: Props) {
  return (
    <div className={`feature-icon flex items-center gap-3 ${compact ? 'feature-icon-compact' : ''}`}>
      <Image src={src} alt={alt} width={width} height={height} className={`feature-icon-img mr-2 ${hoverBob ? 'bob-hover' : ''}`} />
      {children}
    </div>
  )
}
