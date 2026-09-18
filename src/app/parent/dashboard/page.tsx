'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signOut } from 'firebase/auth'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuthWithClaims } from '@/lib/auth/useAuthWithClaims'
import { useParentSession } from '@/hooks/useParentSession'
import { deleteFamilyData } from '@/lib/functions'

type Child = { id: string; name?: string; avatar?: string }

export default function ParentDashboardPage() {
  const { user } = useAuthWithClaims()
  const { endParentSession } = useParentSession()
  const [children, setChildren] = useState<Child[]>([])
  const [familyCode, setFamilyCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const unsubChildren = onSnapshot(collection(db, `users/${user.uid}/children`), (snap) => {
      setChildren(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<Child>) })))
    })
    const unsubFamily = onSnapshot(doc(db, `families/${user.uid}`), (snap) => {
      setFamilyCode((snap.data() as { familyCode?: string } | undefined)?.familyCode ?? null)
    })
    return () => {
      unsubChildren()
      unsubFamily()
    }
  }, [user])

  const copyCode = async () => {
    if (!familyCode) return
    try {
      await navigator.clipboard.writeText(familyCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can fail silently (e.g. insecure context); no harm done.
    }
  }

  const handleSignOut = async () => {
    endParentSession()
    await signOut(auth)
  }

  const handleDeleteEverything = async () => {
    if (deleteConfirmText !== 'DELETE' || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteFamilyData()
      endParentSession()
      await signOut(auth)
      // Hard navigation, not router.replace: signing out while still mounted
      // under /parent's layout guard races with that layout's own redirect
      // to /parent-gate (a "please sign in" page that's wrong to show right
      // after the account itself was just deleted). A full page load sidesteps
      // the race entirely.
      window.location.href = '/'
    } catch {
      setDeleteError('Something went wrong deleting your data. Please try again, or contact support if it keeps happening.')
      setDeleting(false)
    }
  }

  return (
    <div className="column" style={{ gap: 16 }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Your family</h2>
        <p className="meter-text">
          Share this code with your kid so they can link their own device to Santa&rsquo;s Helper.
        </p>
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8 }}>
          <span
            className="badge"
            style={{ fontSize: 22, letterSpacing: 4, padding: '10px 16px' }}
            aria-label="Family code"
          >
            {familyCode ?? '…'}
          </span>
          <button className="btn secondary" type="button" onClick={copyCode} disabled={!familyCode}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Your children</h2>
          <Link className="btn secondary" href="/parent/onboarding">Add a child</Link>
        </div>
        {children.length === 0 ? (
          <p className="meter-text" style={{ marginTop: 12 }}>No children added yet.</p>
        ) : (
          <ul className="list" style={{ marginTop: 12 }}>
            {children.map((c) => (
              <li key={c.id} className="list-item">
                <span style={{ fontSize: 22, marginRight: 10 }}>{c.avatar || '🧝'}</span>
                <span style={{ flex: 1 }}>{c.name || 'Unnamed'}</span>
                <Link className="btn" href={`/parent/child/${c.id}`}>View wishlist</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="row">
        <button className="btn secondary" type="button" onClick={handleSignOut}>Sign out</button>
      </div>

      <section className="card" style={{ borderColor: 'rgba(220,38,38,0.5)' }}>
        <h3 style={{ marginTop: 0 }}>Delete my account</h3>
        <p className="meter-text">
          Permanently deletes your family&rsquo;s account and everything in it &mdash; every child, wishlist, deed, and
          share link. This cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <button className="btn secondary" type="button" onClick={() => setShowDeleteConfirm(true)}>
            Delete my account and all data
          </button>
        ) : (
          <div className="column" style={{ gap: 10, marginTop: 8 }}>
            <label className="column" style={{ gap: 4 }}>
              Type DELETE to confirm
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={deleting}
              />
            </label>
            {deleteError && <div className="badge" role="alert">{deleteError}</div>}
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn"
                type="button"
                onClick={handleDeleteEverything}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                style={{ background: '#dc2626' }}
              >
                {deleting ? 'Deleting…' : 'Permanently delete everything'}
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeleteError(null) }}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
