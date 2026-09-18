'use client'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from '@/lib/firebase'
import { useAuthWithClaims } from '@/lib/auth/useAuthWithClaims'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading } = useAuthWithClaims()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      router.replace('/parent-gate')
    }
  }, [loading, user, router])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
      await credential.user.getIdToken(true)
      router.replace('/parent-gate')
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          setError('Those credentials don’t match our records. Double-check your email and password.')
        } else if (err.code === 'auth/too-many-requests') {
          setError('Too many attempts. Please wait a moment before trying again.')
        } else {
          setError('Unable to sign in right now. Please try again.')
        }
      } else {
        setError('Unable to sign in right now. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!loading && user) return null

  return (
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
          <Link href="/signup" className="btn secondary">
            Need an account? Sign up
          </Link>
        </div>
      </form>
    </section>
  )
}
