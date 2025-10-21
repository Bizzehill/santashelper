import Head from 'next/head'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, loading, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      router.push('/parent/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!loading && user) {
      router.replace('/parent/dashboard')
    }
  }, [loading, user, router])

  if (!loading && user) {
    return null
  }

  return (
    <>
      <Head>
        <title>Login | Santa&apos;s Helper</title>
      </Head>
      <section className="card" aria-live="polite">
        <h2 style={{ marginTop: 0 }}>Welcome back!</h2>
        <p className="meter-text">Log in to review wish lists, Santa replies, and child updates.</p>
        <form onSubmit={handleSubmit} className="column" style={{ gap: 12, marginTop: 16 }}>
          <label className="column" style={{ gap: 4 }}>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="parent@email.com"
              required
              disabled={submitting}
            />
          </label>
          <label className="column" style={{ gap: 4 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={submitting}
            />
          </label>
          {error && <div className="badge" role="alert">{error}</div>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Log In'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => router.push('/signup')}
              disabled={submitting}
            >
              Need an account? Sign up
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
