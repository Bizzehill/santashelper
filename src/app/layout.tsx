import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ReauthProvider } from '@/context/ReauthContext'
import Header from '@/components/HeaderAppShell'

export const metadata: Metadata = {
  title: "Santa's Helper",
  description: 'A joyful, family-friendly goodness-based Christmas list.',
  icons: { icon: '/santashelper.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReauthProvider>
          <Header />
          <main className="container">{children}</main>
          <footer className="site-footer">
            <p style={{ margin: 0 }}>Made with love and stewardship.</p>
            <p style={{ margin: '6px 0 0', display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Link className="link" href="/privacy">Privacy Policy</Link>
              <Link className="link" href="/terms">Terms of Service</Link>
            </p>
          </footer>
        </ReauthProvider>
      </body>
    </html>
  )
}
