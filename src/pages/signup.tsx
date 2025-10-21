import Head from 'next/head'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/context/AuthContext'

export default function SignupPage() {
  const router = useRouter()
  const { signUp, loading, user } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    const name = displayName.trim()
    if (!name) {
      setError('Please enter your name so Santa knows who to greet!')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
  await signUp(email.trim(), password, name)
  router.push('/parent/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.'
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
        <title>Sign Up | Santa&apos;s Helper</title>
      </Head>
      <section className="card" aria-live="polite">
        <h2 style={{ marginTop: 0 }}>Create your parent account</h2>
        <p className="meter-text">Sign up to manage wish lists, Santa notes, and magical surprises.</p>
        <form onSubmit={handleSubmit} className="column" style={{ gap: 12, marginTop: 16 }}>
          <label className="column" style={{ gap: 4 }}>
            Display name
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Jane Doe"
              required
              disabled={submitting}
            />
          </label>
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
              {submitting ? 'Creating account…' : 'Sign Up'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => router.push('/login')}
              disabled={submitting}
            >
              Already have an account? Log in
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
