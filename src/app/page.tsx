import Image from 'next/image'
import FeatureIcon from '@/components/FeatureIcon'
import Section from '@/components/Section'

export default function Page() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Intro hero */}
      <section className="hero">
        <div className="hero-illustration" aria-hidden="true">
          {/* Background art retained */}
          <svg width="100%" height="100%" viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="gradSky" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0b1220"/>
                <stop offset="100%" stopColor="#0e1628"/>
              </linearGradient>
            </defs>
            <rect width="800" height="260" fill="url(#gradSky)"/>
          </svg>
        </div>
        <div className="hero-content card hero-card py-12 px-6">
          <h1 className="hero-title text-2xl font-bold">Welcome to Santa’s Workshop Online</h1>
          <p className="hero-sub text-lg leading-relaxed">where kids and parents bring Christmas magic to life together!</p>
          <div className="cta-row mt-2">
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

      {/* Features section */}
      <Section title="Make merry with magical features">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl p-4 bg-[rgba(14,22,40,.44)] border border-[#334155]">
            <div className="mb-2">
              <FeatureIcon src="/giftbox.png" alt="Whimsical wrapped Christmas gift">
                <h3 className="m-0 text-2xl font-bold">Send a Santa Note</h3>
              </FeatureIcon>
            </div>
            <p className="m-0 text-lg leading-relaxed text-gray-300">Kids can write letters to Santa, ask for gifts, or tell him about their day.</p>
          </div>
          <div className="rounded-xl p-4 bg-[rgba(14,22,40,.44)] border border-[#334155]">
            <div className="mb-2">
              <FeatureIcon src="/christmastree.png" alt="Whimsical Christmas tree">
                <h3 className="m-0 text-2xl font-bold">Magic Replies from Santa</h3>
              </FeatureIcon>
            </div>
            <p className="m-0 text-lg leading-relaxed text-gray-300">Santa reads each note and responds with joyful encouragement or gift ideas.</p>
          </div>
          <div className="rounded-xl p-4 bg-[rgba(14,22,40,.44)] border border-[#334155]">
            <div className="mb-2">
              <FeatureIcon src="/mailbox.png" alt="Whimsical snow-covered mailbox">
                <h3 className="m-0 text-2xl font-bold">Parent View</h3>
              </FeatureIcon>
            </div>
            <p className="m-0 text-lg leading-relaxed text-gray-300">Grown-ups can see all messages, review wishes, and plan Christmas surprises.</p>
          </div>
        </div>
      </Section>

      {/* Santa's Latest Messages scroller (placeholder text) */}
      <Section title="Santa’s Latest Messages">
        <div className="overflow-x-auto whitespace-nowrap py-1 text-base leading-relaxed text-gray-300">
          <span className="inline-block px-3">“Ho ho ho! Your kindness made the elves smile today.”</span>
          <span className="inline-block px-3">“Helping your family is true Christmas magic!”</span>
          <span className="inline-block px-3">“Wonderful wish! Let’s add it to the list.”</span>
          <span className="inline-block px-3">“Thank you for sharing and caring, little star.”</span>
        </div>
      </Section>
    </div>
  )
}
