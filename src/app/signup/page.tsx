'use client'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from '@/lib/firebase'
import { useAuthWithClaims } from '@/lib/auth/useAuthWithClaims'
import { createFamilyOnSignup } from '@/lib/functions'

export default function SignupPage() {
  const router = useRouter()
  const { user, loading } = useAuthWithClaims()
  const [displayName, setDisplayName] = useState('')
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
    const name = displayName.trim()
    if (!name) {
      setError('Please enter your name so Santa knows who to greet!')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(credential.user, { displayName: name })
      // Grants the role=parent custom claim and creates the family + its shareable code.
      await createFamilyOnSignup()
      await credential.user.getIdToken(true)
      router.replace('/parent-gate')
    } catch (err) {
      if (err instanceof FirebaseError && err.code === 'auth/email-already-in-use') {
        setError('That email is already registered. Try signing in instead or reset your password.')
      } else {
        setError('Sign up failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!loading && user) return null

  return (
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
          <Link href="/login" className="btn secondary">
            Already have an account? Log in
          </Link>
        </div>
      </form>
    </section>
  )
}
