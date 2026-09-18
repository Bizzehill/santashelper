'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthWithClaims } from '@/lib/auth/useAuthWithClaims'
import { createShareLink } from '@/lib/functions'

type WishItem = {
  id: string
  name: string
  description?: string | null
  url?: string | null
  image?: string | null
}
type Deed = { id: string; description: string; status?: string }

export default function ChildDetailPage() {
  const { user } = useAuthWithClaims()
  const params = useParams<{ childId: string }>()
  const childId = params?.childId
  const [childName, setChildName] = useState<string>('')
  const [wishlist, setWishlist] = useState<WishItem[]>([])
  const [deeds, setDeeds] = useState<Deed[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  const parentId = useMemo(() => user?.uid ?? null, [user])

  useEffect(() => {
    if (!parentId || !childId) return
    const unsubChild = onSnapshot(doc(db, `users/${parentId}/children/${childId}`), (snap) => {
      setChildName((snap.data() as { name?: string } | undefined)?.name || 'this child')
    })
    const unsubWishlist = onSnapshot(
      query(collection(db, `users/${parentId}/children/${childId}/wishlist`), orderBy('createdAt', 'desc')),
      (snap) => setWishlist(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<WishItem>) })) as WishItem[])
    )
    const unsubDeeds = onSnapshot(
      query(collection(db, `users/${parentId}/children/${childId}/deeds`), orderBy('createdAt', 'desc')),
      (snap) => setDeeds(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<Deed>) })) as Deed[])
    )
    return () => { unsubChild(); unsubWishlist(); unsubDeeds() }
  }, [parentId, childId])

  const handleAddGift = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!parentId || !childId || submitting) return
    const trimmed = name.trim()
    if (!trimmed) {
      setStatus('Please give this gift a name.')
      return
    }
    setSubmitting(true)
    setStatus(null)
    try {
      await addDoc(collection(db, `users/${parentId}/children/${childId}/wishlist`), {
        name: trimmed,
        description: description.trim() || null,
        url: null,
        image: null,
        retailer: null,
        status: 'wants',
        price: null,
        createdAt: serverTimestamp(),
      })
      setName('')
      setDescription('')
      setStatus('Added to the wishlist! 🎁')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not add this gift. Try again?')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteGift = async (giftId: string) => {
    if (!parentId || !childId) return
    await deleteDoc(doc(db, `users/${parentId}/children/${childId}/wishlist`, giftId))
  }

  const handleDeedStatus = async (deedId: string, nextStatus: 'approved' | 'noted') => {
    if (!parentId || !childId) return
    await updateDoc(doc(db, `users/${parentId}/children/${childId}/deeds`, deedId), { status: nextStatus })
  }

  const handleShare = async () => {
    if (!childId) return
    setSharing(true)
    try {
      const res = await createShareLink(childId)
      const url = `${window.location.origin}/view/child/${res.childId}?parent=${res.parentId}&token=${res.token}`
      setShareLink(url)
    } catch {
      setStatus('Could not create a share link right now. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  const copyShareLink = async () => {
    if (!shareLink) return
    try { await navigator.clipboard.writeText(shareLink) } catch { /* ignore */ }
  }

  return (
    <div className="column" style={{ gap: 16 }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>{childName}&rsquo;s wishlist</h2>
        <form onSubmit={handleAddGift} className="column" style={{ gap: 12 }}>
          <label className="column" style={{ gap: 4 }}>
            Gift name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rocket sled" disabled={submitting} required />
          </label>
          <label className="column" style={{ gap: 4 }}>
            Notes (optional)
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={submitting} />
          </label>
          <div className="row">
            <button className="btn" type="submit" disabled={submitting}>Add gift</button>
          </div>
        </form>
        {status && <div className="badge" style={{ marginTop: 10 }} role="status">{status}</div>}

        {wishlist.length === 0 ? (
          <p className="meter-text" style={{ marginTop: 14 }}>No gifts on the list yet.</p>
        ) : (
          <ul className="list" style={{ marginTop: 14 }}>
            {wishlist.map((item) => (
              <li key={item.id} className="list-item">
                <span style={{ flex: 1 }}>{item.name}</span>
                <button className="btn secondary" type="button" onClick={() => handleDeleteGift(item.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Good deeds</h3>
        {deeds.length === 0 ? (
          <p className="meter-text">No deeds logged yet.</p>
        ) : (
          <ul className="list">
            {deeds.map((d) => (
              <li key={d.id} className="list-item">
                <span style={{ flex: 1 }}>{d.description}</span>
                <span className={`badge ${d.status === 'approved' ? 'approved' : ''}`}>{d.status || 'noted'}</span>
                {d.status !== 'approved' && (
                  <button className="btn secondary" type="button" onClick={() => handleDeedStatus(d.id, 'approved')}>Approve</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Share this wishlist</h3>
        <p className="meter-text">Get a read-only link to send to grandparents or family friends.</p>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" type="button" onClick={handleShare} disabled={sharing}>
            {sharing ? 'Creating link…' : 'Get share link'}
          </button>
        </div>
        {shareLink && (
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
            <code style={{ wordBreak: 'break-all' }}>{shareLink}</code>
            <button className="btn secondary" type="button" onClick={copyShareLink}>Copy</button>
          </div>
        )}
      </section>
    </div>
  )
}
