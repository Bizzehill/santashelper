'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getSharedWishlist, type SharedWishlistItem } from '@/lib/functions'

export default function PublicChildWishlistPage() {
  const params = useParams<{ childId: string }>()
  const childId = params?.childId
  const searchParams = useSearchParams()
  const parentId = searchParams?.get('parent') ?? null
  const token = searchParams?.get('token') ?? null

  const [loading, setLoading] = useState(true)
  const [childName, setChildName] = useState('this child')
  const [items, setItems] = useState<SharedWishlistItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!childId || !parentId || !token) {
        setError('This sharing link is missing details. Ask the parent to resend it!')
        setLoading(false)
        return
      }
      try {
        const res = await getSharedWishlist({ parentId, childId, token })
        if (cancelled) return
        if (!res.ok) {
          setError(
            res.error === 'INVALID_TOKEN'
              ? 'This share link is no longer valid. Please request a new one.'
              : 'This share link has expired or never existed.'
          )
          setLoading(false)
          return
        }
        setChildName(res.childName)
        setItems(res.items)
      } catch {
        if (!cancelled) setError('We could not open this wish list right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [childId, parentId, token])

  if (loading) {
    return (
      <div className="card" style={{ maxWidth: 360, margin: '80px auto', textAlign: 'center' }}>
        <p className="meter-text" style={{ margin: 0 }}>Loading this magical wish list…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ maxWidth: 420, margin: '80px auto', textAlign: 'center' }}>
        <h2>Uh oh!</h2>
        <p className="meter-text">{error}</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ maxWidth: 720, margin: '36px auto 80px' }}>
      <h1 style={{ marginTop: 0, fontSize: 32, textAlign: 'center' }}>{childName}&rsquo;s Christmas Wish List</h1>
      <p className="meter-text" style={{ textAlign: 'center', fontSize: 18 }}>
        A peek at the magic they&rsquo;re hoping for this season.
      </p>

      {items.length === 0 ? (
        <p className="meter-text" style={{ marginTop: 20, textAlign: 'center' }}>No wishes yet. Check back soon!</p>
      ) : (
        <ul className="list" style={{ marginTop: 18 }}>
          {items.map((item) => (
            <li key={item.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{item.name}</span>
              {item.description && <p style={{ margin: 0 }}>{item.description}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="meter-text" style={{ marginTop: 24, fontSize: 13, textAlign: 'center' }}>
        View only — updates still happen in the parent dashboard.
      </p>
    </div>
  )
}
