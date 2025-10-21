import Head from 'next/head'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

type Gift = {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  createdAt?: { seconds: number; nanoseconds: number }
}

export default function ChildGiftPage() {
  const router = useRouter()
  const { childId } = router.query as { childId?: string }
  const { user } = useAuth()
  const [giftName, setGiftName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [gifts, setGifts] = useState<Gift[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const parentId = useMemo(() => user?.uid ?? null, [user])

  useEffect(() => {
    if (!parentId || !childId) return
    const giftsRef = query(
      collection(db, 'users', parentId, 'children', childId, 'gifts'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(giftsRef, snap => {
      const items: Gift[] = snap.docs.map(docSnap => {
        const data = docSnap.data() as Gift
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed gift',
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
          createdAt: data.createdAt
        }
      })
      setGifts(items)
    })
    return () => unsub()
  }, [parentId, childId])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!parentId || !childId || submitting) return
    const trimmedName = giftName.trim()
    if (!trimmedName) {
      setStatus('Please give this gift a name to keep Santa organized!')
      return
    }
    setSubmitting(true)
    setStatus(null)
    try {
      await addDoc(collection(db, 'users', parentId, 'children', childId, 'gifts'), {
        name: trimmedName,
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        createdAt: serverTimestamp()
      })
      setGiftName('')
      setDescription('')
      setImageUrl('')
      setStatus('Gift added to the list! 🎁')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Uh oh! Could not add this gift. Try again?'
      setStatus(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (giftId: string) => {
    if (!parentId || !childId) return
    try {
      await deleteDoc(doc(db, 'users', parentId, 'children', childId, 'gifts', giftId))
      setStatus('Gift removed from the workshop.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete this gift. Give it another go.'
      setStatus(message)
    }
  }

  const heading = useMemo(() => {
    if (!childId) return 'Child Gift List'
    return `Magical wishlist for ${childId}`
  }, [childId])

  return (
    <>
      <Head>
        <title>Child Gifts | Santa&apos;s Helper</title>
      </Head>
      <section className="card" aria-live="polite">
        <h2 style={{ marginTop: 0, fontSize: 30, fontFamily: '"Comic Sans MS", "Comic Neue", cursive' }}>{heading}</h2>
        <p className="meter-text" style={{ fontSize: 18 }}>Add sparkly gift ideas below. Santa&apos;s elves love lots of details!</p>
        <form
          onSubmit={handleSubmit}
          className="column"
          style={{
            gap: 14,
            marginTop: 16,
            padding: 16,
            borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(32,56,102,0.85), rgba(54,96,142,0.85))',
            boxShadow: '0 12px 30px rgba(12,18,36,0.35)'
          }}
        >
          <label className="column" style={{ gap: 6, fontSize: 18, fontWeight: 600 }}>
            Gift name
            <input
              type="text"
              value={giftName}
              onChange={e => setGiftName(e.target.value)}
              placeholder="Glittery Rocket Sled"
              required
              disabled={submitting}
              style={{
                fontSize: 18,
                padding: '12px 16px',
                borderRadius: 14,
                border: '3px solid #8b5cf6',
                backgroundColor: '#0f172a',
                color: '#fff'
              }}
            />
          </label>
          <label className="column" style={{ gap: 6, fontSize: 18, fontWeight: 600 }}>
            Description
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add sparkles, colors, or magical notes here!"
              rows={3}
              disabled={submitting}
              style={{
                fontSize: 17,
                padding: '12px 16px',
                borderRadius: 14,
                border: '3px solid #38bdf8',
                backgroundColor: '#0f172a',
                color: '#fff'
              }}
            />
          </label>
          <label className="column" style={{ gap: 6, fontSize: 18, fontWeight: 600 }}>
            Image URL (optional)
            <input
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://example.com/sparkle.png"
              disabled={submitting}
              style={{
                fontSize: 18,
                padding: '12px 16px',
                borderRadius: 14,
                border: '3px solid #facc15',
                backgroundColor: '#0f172a',
                color: '#fff'
              }}
            />
          </label>
          <button
            className="btn"
            type="submit"
            disabled={submitting}
            style={{
              fontSize: 20,
              padding: '14px 18px',
              borderRadius: 16,
              background: 'linear-gradient(90deg, #f97316, #f472b6)',
              border: 'none',
              color: '#0f172a',
              fontWeight: 700,
              boxShadow: '0 12px 24px rgba(248,113,113,0.45)',
              transform: submitting ? 'scale(0.98)' : 'scale(1)',
              transition: 'transform 0.2s ease'
            }}
          >
            {submitting ? 'Sending to Santa…' : 'Add Gift 🎁'}
          </button>
        </form>
        {status && (
          <div className="badge" style={{ marginTop: 14, fontSize: 16 }} role="status">
            {status}
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 24, fontFamily: '"Comic Sans MS", "Comic Neue", cursive' }}>Gift ideas so far</h3>
        {gifts.length === 0 ? (
          <p className="meter-text" style={{ fontSize: 18 }}>No gifts yet. Let’s dream up something magical!</p>
        ) : (
          <div
            className="grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16
            }}
          >
            {gifts.map(gift => (
              <div
                key={gift.id}
                className="card"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(148,163,184,0.12))',
                  borderRadius: 20,
                  padding: 16,
                  border: '2px solid rgba(148, 163, 184, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div>
                  <h4 style={{ fontSize: 20, margin: 0, fontFamily: '"Comic Sans MS", "Comic Neue", cursive', color: '#fef08a' }}>
                    {gift.name}
                  </h4>
                  {gift.description && (
                    <p style={{ marginTop: 8, fontSize: 16, color: '#e2e8f0' }}>{gift.description}</p>
                  )}
                </div>
                {gift.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={gift.imageUrl}
                    alt={gift.name}
                    style={{
                      width: '100%',
                      height: 140,
                      objectFit: 'cover',
                      borderRadius: 16,
                      border: '3px solid rgba(248,250,252,0.4)'
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(gift.id)}
                  className="btn secondary"
                  style={{
                    fontSize: 18,
                    borderRadius: 14,
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '2px solid #fb7185',
                    color: '#f8fafc',
                    fontWeight: 600
                  }}
                >
                  Remove ❌
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
