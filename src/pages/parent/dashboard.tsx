import Head from 'next/head'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

type Child = { id: string; name?: string; age?: number }

export default function ParentDashboardPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [age, setAge] = useState<number | ''>('')
  const [children, setChildren] = useState<Child[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const parentId = useMemo(() => user?.uid ?? null, [user])

  useEffect(() => {
    if (!parentId) return
    const ref = query(collection(db, 'users', parentId, 'children'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(ref, snap => {
      const items: Child[] = snap.docs.map(docSnap => {
        const data = docSnap.data() as { name?: string; age?: number }
        return { id: docSnap.id, ...data }
      })
      setChildren(items)
    })
    return () => unsub()
  }, [parentId])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!parentId || submitting) return
    const trimmed = name.trim()
    if (!trimmed || age === '') {
      setStatus('Please provide both a name and age.')
      return
    }
    setSubmitting(true)
    setStatus(null)
    try {
      await addDoc(collection(db, 'users', parentId, 'children'), {
        name: trimmed,
        age,
        createdAt: serverTimestamp(),
      })
      setName('')
      setAge('')
      setStatus('Child profile added!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add child. Please try again.'
      setStatus(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Parent Dashboard | Santa&apos;s Helper</title>
      </Head>
      <section className="card" aria-live="polite">
        <h2 style={{ marginTop: 0 }}>Parent Dashboard</h2>
        <p className="meter-text">Add your children so Santa knows who is on the nice list.</p>
        <form onSubmit={handleSubmit} className="column" style={{ gap: 12, maxWidth: 400 }}>
          <label className="column" style={{ gap: 4 }}>
            Child name
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Buddy the Elf"
              required
              disabled={submitting}
            />
          </label>
          <label className="column" style={{ gap: 4 }}>
            Age
            <input
              type="number"
              min={0}
              max={18}
              value={age}
              onChange={e => setAge(e.target.value ? Number(e.target.value) : '')}
              placeholder="8"
              required
              disabled={submitting}
            />
          </label>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add Child'}
          </button>
        </form>
        {status && (
          <div className="badge" style={{ marginTop: 12 }} role="status">
            {status}
          </div>
        )}
      </section>

      {children.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Your registered children</h3>
          <ul className="list">
            {children.map(child => (
              <li key={child.id} className="list-item" style={{ justifyContent: 'space-between' }}>
                <div>
                  <strong>{child.name || 'Unnamed child'}</strong>
                  {typeof child.age === 'number' && (
                    <span className="meter-text" style={{ marginLeft: 8 }}>Age {child.age}</span>
                  )}
                </div>
                <ChildActions parentId={parentId!} childId={child.id} childName={child.name} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function ChildActions({ parentId, childId, childName }: { parentId: string; childId: string; childName?: string }) {
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)

  useEffect(() => {
    if (!shareStatus) return
    const timer = setTimeout(() => setShareStatus(null), 4000)
    return () => clearTimeout(timer)
  }, [shareStatus])

  const generateLink = useCallback(async () => {
    setShareStatus(null)
    setShareLoading(true)
    try {
      const ticketRef = doc(db, 'shareTokens', `${parentId}_${childId}`)
      const snap = await getDoc(ticketRef)
      let token: string
      if (snap.exists()) {
        const data = snap.data() as { token?: string }
        token = data.token || uuid()
        await setDoc(ticketRef, { parentId, childId, childName: childName ?? null, token }, { merge: true })
      } else {
        token = uuid()
        await setDoc(ticketRef, { parentId, childId, childName: childName ?? null, token, createdAt: serverTimestamp() })
      }
      const url = `${window.location.origin}/view/child/${childId}?parent=${encodeURIComponent(parentId)}&token=${token}`
      await navigator.clipboard.writeText(url)
      setShareStatus('Shareable link copied to clipboard!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create link. Please try again.'
      setShareStatus(message)
    } finally {
      setShareLoading(false)
    }
  }, [childId, parentId])

  return (
    <div className="column" style={{ gap: 6, alignItems: 'flex-end' }}>
      <div className="row" style={{ gap: 8 }}>
        <a className="btn secondary" href={`/parent/child/${childId}`}>
          Manage gifts
        </a>
        <button
          type="button"
          className="btn"
          onClick={generateLink}
          disabled={shareLoading}
        >
          {shareLoading ? 'Creating…' : 'Share list'}
        </button>
      </div>
      {shareStatus && (
        <span className="meter-text" style={{ fontSize: 13 }}>{shareStatus}</span>
      )}
    </div>
  )
}
