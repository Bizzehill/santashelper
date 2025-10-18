import NorthPoleCounter from '@/components/NorthPoleCounter'
import Image from 'next/image'

export default function Page() {
  return (
    <>
      <section className="hero">
        <div className="hero-illustration" aria-hidden="true">
          {/* Simple festive skyline + trees + star */}
          <svg width="100%" height="100%" viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="gradSky" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0b1220"/>
                <stop offset="100%" stopColor="#0e1628"/>
              </linearGradient>
            </defs>
            <rect width="800" height="260" fill="url(#gradSky)"/>
            {/* Stars */}
            {Array.from({length:40}).map((_,i)=> (
              <circle key={i} cx={(i*19)%800} cy={(i*37)%120+10} r={(i%3)+1} fill="#fff" opacity="0.8" />
            ))}
            {/* Hills */}
            <path d="M0 190 C 160 150, 320 220, 480 180 C 620 150, 720 200, 800 180 L 800 260 L 0 260 Z" fill="#0a1326"/>
            {/* Trees */}
            {[
              {x:80,y:170},{x:180,y:175},{x:260,y:168},{x:560,y:175},{x:650,y:170}
            ].map((t,i)=> (
              <g key={i} transform={`translate(${t.x},${t.y})`}>
                <polygon points="0,0 18,0 9,-26" fill="#0f2a33"/>
                <rect x="7" y="0" width="4" height="10" fill="#372c1d"/>
              </g>
            ))}
            {/* Big star */}
            <g transform="translate(640 60)">
              <polygon points="0,-10 3,-3 10,0 3,3 0,10 -3,3 -10,0 -3,-3" fill="#ffd166"/>
            </g>
          </svg>
        </div>
        <div className="hero-content card hero-card">
          <h1 className="hero-title">Welcome to the North Pole</h1>
          <p className="hero-sub">Build your wish list and grow your goodness meter with real-world kindness.</p>
          <div className="hero-counter">
            <NorthPoleCounter />
          </div>
          <div className="cta-row">
            <a className="btn" href="/santa">Enter Santa View</a>
            <a className="btn secondary" href="/parent">Parent Dashboard</a>
          </div>
        </div>
        <div className="hero-elf" aria-hidden="true">
          <Image src="/elf.png" alt="Friendly Christmas elf holding a scroll" width={280} height={280} priority />
        </div>
        {/* Snowflakes */}
        <div className="snow-layer" aria-hidden="true">
          {Array.from({length:14}).map((_,i)=> (
            <span className="snowflake" key={i} style={{
              left: `${(i*7)%100}%`,
              animationDelay: `${(i%7)*0.8}s`,
              animationDuration: `${8 + (i%5)}s`,
              opacity: 0.4 + ((i%5)*0.1)
            }}>✦</span>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>How it works</h2>
        <p>
          Kids add wishes and log good deeds. Parents review and approve deeds,
          set a gift budget, and celebrate progress together.
        </p>
        <ul className="list">
          <li className="list-item"><strong>Log deeds</strong> like helping, sharing, and serving others.</li>
          <li className="list-item"><strong>Earn points</strong> that unlock gifts on the wish list.</li>
          <li className="list-item"><strong>Grow in goodness</strong> with simple, joyful steps.</li>
        </ul>
      </section>
    </>
  )
}
