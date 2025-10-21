import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type Gift = {
  id: string
  title: string
  description?: string | null
  createdAt?: { seconds: number; nanoseconds: number }
}

export default function PublicChildWishlistPage() {
  const router = useRouter()
  const { childId, parent, token } = router.query as { childId?: string; parent?: string; token?: string }
  const [gifts, setGifts] = useState<Gift[]>([])
  const [childName, setChildName] = useState<string>('this child')
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parentId = useMemo(() => (typeof parent === 'string' ? parent : undefined), [parent])
  const shareToken = useMemo(() => (typeof token === 'string' ? token : undefined), [token])

  useEffect(() => {
    if (!childId || !parentId || !shareToken) {
      setLoading(false)
      setAuthorized(false)
      setError('This sharing link is missing details. Ask the parent to resend it!')
      return
    }

    let unsubscribe: (() => void) | undefined

    const verifyAndSubscribe = async () => {
      try {
        const docId = `${parentId}_${childId}`
        const shareRef = doc(db, 'shareTokens', docId)
        const shareSnap = await getDoc(shareRef)
        if (!shareSnap.exists()) {
          setError('This share link has expired or never existed.')
          setAuthorized(false)
          setLoading(false)
          return
        }
        const data = shareSnap.data() as { token?: string; childName?: string }
        if (!data.token || data.token !== shareToken) {
          setError('This share link is no longer valid. Please request a new one.')
          setAuthorized(false)
          setLoading(false)
          return
        }
        setChildName(data.childName || 'this child')
        const giftsQuery = query(
          collection(db, 'users', parentId, 'children', childId, 'gifts'),
          orderBy('createdAt', 'desc')
        )
        unsubscribe = onSnapshot(giftsQuery, snap => {
          const items: Gift[] = snap.docs.map(docSnap => {
            const giftData = docSnap.data()
            return {
              id: docSnap.id,
              title: giftData.title || 'Untitled gift',
              description: giftData.description ?? null,
              createdAt: (giftData as { createdAt?: Gift['createdAt'] }).createdAt
            }
          })
          setGifts(items)
        })
        setAuthorized(true)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'We could not open this wish list right now.'
        setError(message)
        setAuthorized(false)
      } finally {
        setLoading(false)
      }
    }

    verifyAndSubscribe()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [childId, parentId, shareToken])

  if (loading) {
    return (
      <main className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 360, margin: '0 auto' }}>
          <p className="meter-text" style={{ margin: 0 }}>Loading this magical wish list…</p>
        </div>
      </main>
    )
  }

  if (!authorized) {
    return (
      <main className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
          <h2>Uh oh!</h2>
          <p className="meter-text">{error ?? 'We could not show this list. The link may be invalid.'}</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <Head>
        <title>{`Wish List for ${childName}`}</title>
      </Head>
      <main className="container" style={{ padding: '36px 0 80px' }}>
        <section className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ marginTop: 0, fontSize: 32, fontFamily: '"Comic Sans MS", "Comic Neue", cursive', textAlign: 'center' }}>
            {childName}&apos;s Christmas Wish List
          </h1>
          <p className="meter-text" style={{ textAlign: 'center', fontSize: 18 }}>A peek at the magic they&apos;re hoping for this season.</p>

          {gifts.length === 0 ? (
            <p className="meter-text" style={{ marginTop: 20, fontSize: 18, textAlign: 'center' }}>
              No wishes yet. Check back soon!
            </p>
          ) : (
            <ul className="list" style={{ marginTop: 18 }}>
              {gifts.map(gift => (
                <li
                  key={gift.id}
                  className="list-item"
                  style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 6,
                    padding: '16px 18px',
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, rgba(148,163,184,0.12), rgba(248,250,252,0.15))'
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#fef08a' }}>{gift.title}</span>
                  {gift.description && <p style={{ fontSize: 16, color: '#e2e8f0', margin: 0 }}>{gift.description}</p>}
                </li>
              ))}
            </ul>
          )}

          <p className="meter-text" style={{ marginTop: 24, fontSize: 13, textAlign: 'center' }}>
            View only — updates still happen in the parent dashboard.
          </p>
        </section>
      </main>
    </>
  )
}
