'use client'
import Header from '@/components/Header'
import { usePathname } from 'next/navigation'

export default function HeaderAppShell() {
  const pathname = usePathname()
  return <Header pathname={pathname} />
}
