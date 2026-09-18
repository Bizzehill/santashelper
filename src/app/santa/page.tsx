'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { useSantaAccess } from '@/lib/child/useAnonSantaWorkspace'
import WishItemCard, { WishItem } from '@/components/WishItemCard'
import SantaChatCard from '@/components/SantaChatCard'

type SantaGiftResult = { title: string; image: string | null; url: string | null; retailer: 'amazon'|'walmart'|'ai'; hasPrice: boolean }

export default function SantaPage() {
  const { ready, mode, basePath } = useSantaAccess()
  const [childName, setChildName] = useState<string | null>(null)
  const [childAge, setChildAge] = useState<number | undefined>(undefined)
  const [wishlist, setWishlist] = useState<WishItem[]>([])
  const [noteText, setNoteText] = useState<string>('')
  const [modeTab, setModeTab] = useState<'gifts'|'deeds'>('gifts')
  const [searching, setSearching] = useState(false)
  const [reading, setReading] = useState(false)
  const [results, setResults] = useState<SantaGiftResult[] | null>(null)
  const [toast, setToast] = useState<string>('')
  const [undo, setUndo] = useState<{ type: 'wishlist'|'deed'; id: string } | null>(null)
  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const affirmations = [
    'Proud of you for helping!',
    'Acts of kindness light up Christmas!',
    'That’s the spirit!'
  ]
  const affirmCache = useRef<{ text: string; message: string; at: number } | null>(null)
  const [history, setHistory] = useState<Array<{ text: string; createdAtDate: Date | null }>>([])
  const lastAffirmation = history[0]?.text ?? null
  const lastAffirmationAt = history[0]?.createdAtDate ?? null

  // Fetch child name (linked mode only -- anon scratch space has no profile doc)
  useEffect(() => {
    if (!ready || !basePath || mode !== 'linked') { setChildName(null); return }
    const unsub = onSnapshot(doc(db, basePath), (snap) => {
      const data = snap.data() as { name?: string; age?: number } | undefined
      setChildName(data?.name ?? null)
      setChildAge(typeof data?.age === 'number' ? data.age : undefined)
    })
    return () => unsub()
  }, [ready, basePath, mode])

  // Wishlist + Santa's reply history
  useEffect(() => {
    if (!ready || !basePath) return
    const unsubWishlist = onSnapshot(
      query(collection(db, `${basePath}/wishlist`), orderBy('createdAt', 'desc')),
      (snap) => setWishlist(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<WishItem>) })) as WishItem[])
    )
    const unsubHistory = onSnapshot(
      query(collection(db, `${basePath}/affirmations`), orderBy('createdAt', 'desc'), limit(10)),
      (snap) => setHistory(snap.docs.map((d) => {
        const data = d.data() as { text?: string; createdAt?: { toDate?: () => Date } }
        return {
          text: (data.text || '').toString(),
          createdAtDate: typeof data.createdAt?.toDate === 'function' ? data.createdAt!.toDate() : null,
        }
      }))
    )
    return () => { unsubWishlist(); unsubHistory() }
  }, [ready, basePath])

  const onSubmitGifts = async (text: string) => {
    if (!basePath) return
    setSearching(true)
    setResults(null)
    setToast('')
    try {
      const res = await fetch('/api/gift-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, childAge, limit: 8 })
      })
      const json = await res.json() as { ok?: boolean; results?: SantaGiftResult[]; error?: string }
      if (res.ok && json.ok && Array.isArray(json.results)) {
        setResults(json.results)
      } else {
        setResults([])
        setToast(res.status === 400 && json.error ? json.error : 'We had a hiccup delivering your note. Please try again.')
        setTimeout(() => setToast(''), 2200)
      }
    } catch {
      setToast('We had a hiccup delivering your note. Please try again.')
      setTimeout(() => setToast(''), 2200)
    } finally {
      setSearching(false)
    }
  }

  const onSubmitDeed = async (text: string) => {
    if (!basePath) return
    try {
      setReading(true)
      const modRes = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (modRes.ok) {
        const modJson = await modRes.json() as { flagged?: boolean }
        if (modJson.flagged) {
          setToast('Please rephrase.')
          setTimeout(() => setToast(''), 2200)
          setReading(false)
          return
        }
      }

      const deedsCol = collection(db, `${basePath}/deeds`)
      const docRef = await addDoc(deedsCol, {
        description: text,
        status: 'noted',
        source: 'santa-note',
        createdAt: serverTimestamp(),
      })

      let santaMsg: string | null = null
      const now = Date.now()
      if (affirmCache.current && affirmCache.current.text === text && (now - affirmCache.current.at) < 60_000) {
        santaMsg = affirmCache.current.message
      } else {
        try {
          setToast('Santa is thinking of a message… 🎅')
          const affRes = await fetch('/api/santa-affirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
          })
          const affJson = await affRes.json() as { ok?: boolean; message?: string }
          if (affRes.ok && affJson.ok && affJson.message) {
            santaMsg = affJson.message
            affirmCache.current = { text, message: santaMsg, at: now }
          }
        } catch {
          // swallow; fallback below
        }
      }

      if (!santaMsg) {
        const aff = affirmations[Math.floor(Math.random() * affirmations.length)]
        santaMsg = `Santa read your note! 🎅 ${aff}`
      }
      try {
        await addDoc(collection(db, `${basePath}/affirmations`), {
          text: santaMsg,
          createdAt: serverTimestamp(),
        })
      } catch (e) {
        console.warn('[santa] failed to save affirmation', e)
      }
      setToast('')
      setUndo({ type: 'deed', id: docRef.id })
      if (undoTimeout.current) clearTimeout(undoTimeout.current)
      undoTimeout.current = setTimeout(() => { setUndo(null); setToast('') }, 5000)
      setNoteText('')
    } catch {
      setToast('We couldn’t save that this time. Please try again.')
      setTimeout(() => setToast(''), 2200)
    } finally {
      setReading(false)
    }
  }

  const addResultToList = async (r: SantaGiftResult) => {
    if (!basePath) return
    try {
      const ref = collection(db, `${basePath}/wishlist`)
      const docRef = await addDoc(ref, {
        name: r.title,
        url: r.url ?? null,
        image: r.image ?? null,
        retailer: r.retailer,
        status: 'wants',
        price: null,
        createdAt: serverTimestamp(),
      })
      setUndo({ type: 'wishlist', id: docRef.id })
      setToast('Added to your list! 🎁')
      if (undoTimeout.current) clearTimeout(undoTimeout.current)
      undoTimeout.current = setTimeout(() => { setUndo(null); setToast('') }, 5000)
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not add to list')
      setTimeout(() => setToast(''), 2200)
    }
  }

  const undoAdd = async () => {
    if (!basePath || !undo) return
    try {
      const col = undo.type === 'wishlist' ? 'wishlist' : 'deeds'
      await deleteDoc(doc(db, `${basePath}/${col}`, undo.id))
      setToast('Removed.')
      setTimeout(() => setToast(''), 1200)
    } catch {
      setToast('Could not remove item.')
      setTimeout(() => setToast(''), 1800)
    } finally {
      setUndo(null)
      if (undoTimeout.current) { clearTimeout(undoTimeout.current); undoTimeout.current = null }
    }
  }

  if (!ready) {
    return (
      <div className="santa-bg">
        <section className="santa-page">
          <section className="card" aria-busy="true" aria-live="polite">
            <p className="meter-text" style={{ margin: 0 }}>Getting the workshop ready…</p>
          </section>
        </section>
      </div>
    )
  }

  return (
    <div className="santa-bg">
      <section className="santa-page">
        <h2>Santa View ✨</h2>

        {mode === 'anon' ? (
          <div className="card">
            <p className="meter-text" style={{ margin: 0 }}>
              You&rsquo;re trying Santa&rsquo;s Helper as a guest. <Link className="link" href="/santa/link-family">Link your family</Link> to save your wishes and deeds for real, and let a parent see them.
            </p>
          </div>
        ) : (
          <div className="card">
            <p className="meter-text" style={{ margin: 0 }}>Hi {childName || 'there'}! Linked to your family. 🎄</p>
          </div>
        )}

        <div className="card" aria-labelledby="santa-note-heading">
          <h3 id="santa-note-heading">Santa Note</h3>
          <SantaChatCard
            lastAffirmation={lastAffirmation}
            lastAffirmationAt={lastAffirmationAt}
            history={history}
            mode={modeTab}
            onModeChange={setModeTab}
            noteText={noteText}
            onChangeNote={setNoteText}
            onSubmitGifts={onSubmitGifts}
            onSubmitDeed={onSubmitDeed}
            searching={searching}
            reading={reading}
            giftResults={results}
            onAddGift={addResultToList}
            toast={toast}
            undoAvailable={!!undo}
            onUndo={undoAdd}
            canSubmit={!!basePath}
          />
        </div>

        <h3>My Wish List</h3>
        <div className="grid3">
          {wishlist.map((w) => <WishItemCard key={w.id} item={w} />)}
        </div>
      </section>
    </div>
  )
}
