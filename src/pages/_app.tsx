import type { AppProps } from 'next/app'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import '@/app/globals.css'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ReauthProvider } from '@/context/ReauthContext'
import Header from '@/components/HeaderPagesShell'

function RouteGuard({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const { user, loading } = useAuth()

  const isPublicRoute = useMemo(() => {
    const path = router.pathname
    if (path === '/login' || path === '/signup' || path === '/') return true
    if (path.startsWith('/santa')) return true
    return false
  }, [router.pathname])

  const [authorized, setAuthorized] = useState<boolean>(() => isPublicRoute)

  useEffect(() => {
    if (loading) return
    const path = router.pathname

    if (!user) {
      setAuthorized(isPublicRoute)
      if (!isPublicRoute) {
        router.replace('/login')
      }
      return
    }

    if (path.startsWith('/parent') && user.role !== 'parent') {
      setAuthorized(false)
      router.replace('/login')
      return
    }

    setAuthorized(true)
  }, [loading, user, router, router.pathname, isPublicRoute])

  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 360, margin: '0 auto' }}>
          <p className="meter-text" style={{ margin: 0 }}>Checking Santa’s list…</p>
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 360, margin: '0 auto' }}>
          <p className="meter-text" style={{ margin: 0 }}>Taking you to the right place…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Header />
      <main className="container">
        <Component {...pageProps} />
      </main>
      <footer className="site-footer">Made with love and stewardship.</footer>
    </>
  )
}

export default function App(appProps: AppProps) {
  return (
    <AuthProvider>
      <ReauthProvider>
        <RouteGuard {...appProps} />
      </ReauthProvider>
    </AuthProvider>
  )
}
