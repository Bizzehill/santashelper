'use client'
import Image from 'next/image'
import Link from 'next/link'
import { signOut } from 'firebase/auth'
import CandyCaneCountdown from '@/components/CandyCaneCountdown'
import { daysUntilChristmas } from '@/lib/date'
import { useAuthWithClaims } from '@/lib/auth/useAuthWithClaims'
import { useParentSession } from '@/hooks/useParentSession'
import { auth } from '@/lib/firebase'

type HeaderProps = {
  pathname?: string | null
}

export default function Header({ pathname }: HeaderProps) {
  const safePath = pathname ?? ''
  const isSanta = safePath.startsWith('/santa')
  const daysRemaining = daysUntilChristmas(new Date()).days
  const { user, claims, loading } = useAuthWithClaims()
  const { endParentSession } = useParentSession()
  const isParent = !loading && !!user && (claims?.role as string | undefined) === 'parent'

  const handleSignOut = async () => {
    endParentSession()
    await signOut(auth)
  }

  return (
    <header className={`site-header ${isSanta ? 'translucent' : ''}`}>
      <div className="container">
        <div className="brand-row">
          <Link className="brand-link brand-sparkle" href="/">
            <span aria-hidden className="sparkle s1" />
            <span aria-hidden className="sparkle s2" />
            <span aria-hidden className="flake f1" />
            <Image src="/santashelper.png" alt="Santa's Helper logo" width={40} height={40} priority />
            <h1 className="brand">Santa&rsquo;s Helper</h1>
          </Link>
          <div className="brand-extra" style={{ gap: 12, display: 'flex', alignItems: 'center' }}>
            <CandyCaneCountdown daysRemaining={daysRemaining} />
          </div>
        </div>
        <nav className="nav-holiday" style={{ paddingTop: 8 }}>
          <Link href="/">Home</Link>
          <Link href="/santa">Santa View</Link>
          <Link href="/parent/dashboard">Parent</Link>
          {isParent ? (
            <button
              type="button"
              onClick={handleSignOut}
              style={{ background: 'none', border: 'none', color: '#c7d2fe', font: 'inherit', cursor: 'pointer', padding: 0 }}
            >
              Sign out
            </button>
          ) : (
            <Link href="/login">Login</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
