import Head from 'next/head'
import { FormEvent, useEffect, useState } from 'react'
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore'
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

  useEffect(() => {
    if (!user) return
    const ref = query(collection(db, 'users', user.uid, 'children'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(ref, snap => {
      const items: Child[] = snap.docs.map(docSnap => {
        const data = docSnap.data() as { name?: string; age?: number }
        return { id: docSnap.id, ...data }
      })
      setChildren(items)
    })
    return () => unsub()
  }, [user])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || submitting) return
    const trimmed = name.trim()
    if (!trimmed || age === '') {
      setStatus('Please provide both a name and age.')
      return
    }
    setSubmitting(true)
    setStatus(null)
    try {
      await addDoc(collection(db, 'users', user.uid, 'children'), {
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
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
