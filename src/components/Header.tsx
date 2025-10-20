'use client'
import Image from 'next/image'
import CandyCaneCountdown from '@/components/CandyCaneCountdown'
import { daysUntilChristmas } from '@/lib/date'
import { usePathname } from 'next/navigation'

export default function Header() {
  const pathname = usePathname()
  const isSanta = pathname?.startsWith('/santa')
  const daysRemaining = daysUntilChristmas(new Date()).days
  return (
    <header className={`site-header ${isSanta ? 'translucent' : ''}`}>
      <div className="container">
        <div className="brand-row">
          <a className="brand-link brand-sparkle" href="/">
            <span aria-hidden className="sparkle s1" />
            <span aria-hidden className="sparkle s2" />
            <span aria-hidden className="flake f1" />
            <Image src="/santashelper.png" alt="Santa's Helper logo" width={40} height={40} priority />
            <h1 className="brand">Santa’s Helper</h1>
          </a>
          <div className="brand-extra" style={{gap:12, display:'flex', alignItems:'center'}}>
            <CandyCaneCountdown daysRemaining={daysRemaining} />
          </div>
        </div>
        <nav className="nav-holiday" style={{ paddingTop: 8 }}>
          <a href="/">Home</a>
          <a href="/santa">Santa View</a>
          <a href="/parent">Parent</a>
          <a href="/login">Login</a>
        </nav>
      </div>
    </header>
  )
}
