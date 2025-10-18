import './globals.css'
import type { Metadata } from 'next'
import { AuthProvider } from '@/context/AuthContext'
import Header from '@/components/Header'

export const metadata: Metadata = {
  title: "Santa's Helper",
  description: 'A joyful, family-friendly goodness-based Christmas list.',
  icons: { icon: '/santashelper.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <main className="container">{children}</main>
          <footer className="site-footer">Made with love and stewardship.</footer>
        </AuthProvider>
      </body>
    </html>
  )
}
