'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '@/components/Header'

export default function HeaderPagesShell() {
  const router = useRouter()
  const [pathname, setPathname] = useState(router.asPath)

  useEffect(() => {
    const handleRoute = (url: string) => setPathname(url)
    router.events.on('routeChangeComplete', handleRoute)
    router.events.on('hashChangeComplete', handleRoute)
    return () => {
      router.events.off('routeChangeComplete', handleRoute)
      router.events.off('hashChangeComplete', handleRoute)
    }
  }, [router])

  return <Header pathname={pathname} />
}
