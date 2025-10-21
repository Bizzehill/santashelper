import type { AppProps } from 'next/app'
import '@/app/globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { ReauthProvider } from '@/context/ReauthContext'
import Header from '@/components/HeaderPagesShell'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <ReauthProvider>
        <Header />
        <main className="container">
          <Component {...pageProps} />
        </main>
        <footer className="site-footer">Made with love and stewardship.</footer>
      </ReauthProvider>
    </AuthProvider>
  )
}
