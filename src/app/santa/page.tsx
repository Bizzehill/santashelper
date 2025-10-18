'use client'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import WishItemCard, { WishItem } from '@/components/WishItemCard'
import SantaChatCard from '@/components/SantaChatCard'

type Child = { id: string; name?: string }
type SantaGiftResult = { title: string; image: string | null; url: string | null; retailer: 'amazon'|'walmart'|'ai'; hasPrice: boolean }

export default function SantaPage() {
  const { user } = useAuth()
  const [children, setChildren] = useState<Child[]>([])
  const [childId, setChildId] = useState<string>('')
  const [wishlist, setWishlist] = useState<WishItem[]>([])
  const [childAge, setChildAge] = useState<number | undefined>(undefined)
  const [noteText, setNoteText] = useState<string>('')
  const [mode, setMode] = useState<'gifts'|'deeds'>('gifts')
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
  const [lastAffirmation, setLastAffirmation] = useState<string | null>(null)
  const [lastAffirmationAt, setLastAffirmationAt] = useState<Date | null>(null)
  const [history, setHistory] = useState<Array<{ text: string; createdAtDate: Date | null }>>([])

  const formatUpdatedAt = (d: Date) => d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  })
  

  // Load children for user
  useEffect(() => {
    if (!user) return
    const ref = collection(db, 'users', user.uid, 'children')
    const unsub = onSnapshot(ref, snap => {
      const list: Child[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as Partial<Child>) }))
      setChildren(list)
      if (!childId && list[0]) setChildId(list[0].id)
    })
    return () => unsub()
  }, [user, childId])

  // Subscribe to last 10 affirmations for selected child
  useEffect(() => {
    if (!user || !childId) return
    const affRef = collection(db, 'users', user.uid, 'children', childId, 'affirmations')
    const qy = query(affRef, orderBy('createdAt', 'desc'), limit(10))
    const unsub = onSnapshot(qy, snap => {
      const rows = snap.docs.map(d => {
        const data = d.data() as { text?: string; createdAt?: { toDate?: () => Date } }
        return {
          text: (data.text || '').toString(),
          createdAtDate: typeof data.createdAt?.toDate === 'function' ? data.createdAt!.toDate() : null
        }
      })
      setHistory(rows)
    })
    return () => unsub()
  }, [user, childId])

  // Load settings & wishlist for selected child
  useEffect(() => {
    if (!user || !childId) return
    const cRef = doc(db, 'users', user.uid, 'children', childId)
    const unsubC = onSnapshot(cRef, d => {
      const data = (d.data() as { age?: number; lastAffirmation?: string | null; lastAffirmationAt?: any } | undefined)
      setChildAge(typeof data?.age === 'number' ? data!.age : undefined)
      const msg = (data?.lastAffirmation ?? null)
      setLastAffirmation(typeof msg === 'string' && msg.trim() ? msg : null)
      const at = data?.lastAffirmationAt as { toDate?: () => Date } | undefined
      setLastAffirmationAt(typeof at?.toDate === 'function' ? at!.toDate() : null)
    })
    const wRef = query(collection(db, 'users', user.uid, 'children', childId, 'wishlist'), orderBy('createdAt','desc'))
    const unsubW = onSnapshot(wRef, snap => {
      setWishlist(snap.docs.map(d=>({ id: d.id, ...(d.data() as Partial<WishItem>) })) as WishItem[])
    })
    return () => { unsubC(); unsubW() }
  }, [user, childId])

  // Submit handlers by mode
  const onSubmitGifts = async (text: string) => {
    if (!user || !childId) return
    setSearching(true)
    setResults(null)
    setToast('')
    try {
      const res = await fetch('/api/gift-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, childAge, limit: 8 })
      })
      const json = await res.json() as { ok?: boolean; results?: SantaGiftResult[] }
      if (res.ok && json.ok && Array.isArray(json.results)) {
        setResults(json.results)
      } else {
        setResults([])
        setToast('We had a hiccup delivering your note. Please try again.')
        setTimeout(()=> setToast(''), 2200)
      }
    } catch (e) {
      setToast('We had a hiccup delivering your note. Please try again.')
      setTimeout(()=> setToast(''), 2200)
    } finally {
      setSearching(false)
    }
  }

  const onSubmitDeed = async (text: string) => {
    if (!user || !childId) return
    try {
      setReading(true)
      // Optional moderation step
      const modRes = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (modRes.ok) {
        const modJson = await modRes.json() as { flagged?: boolean }
        if (modJson.flagged) {
          setToast('Please rephrase.')
          setTimeout(()=> setToast(''), 2200)
          setReading(false)
          return
        }
      }

      const deedsCol = collection(db, 'users', user.uid, 'children', childId, 'deeds')
      const docRef = await addDoc(deedsCol, {
        description: text,
        status: 'noted',
        source: 'santa-note',
        createdAt: serverTimestamp(),
      })
      // Affirmation: attempt API with simple cache (1 minute)
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
        const aff = affirmations[Math.floor(Math.random()*affirmations.length)]
        santaMsg = `Santa read your note! 🎅 ${aff}`
      }
      // Persist the message on the child doc; if it fails, still show locally
      setLastAffirmation(santaMsg)
      setLastAffirmationAt(new Date())
      try {
        await updateDoc(doc(db, 'users', user.uid, 'children', childId), {
          lastAffirmation: santaMsg,
          lastAffirmationAt: serverTimestamp(),
        })
        // Optional history append (simple, last 10 read)
        await addDoc(collection(db, 'users', user.uid, 'children', childId, 'affirmations'), {
          text: santaMsg,
          createdAt: serverTimestamp(),
        })
      } catch (e) {
        // Keep local state; next deed submit can try again
        console.warn('[santa] failed to persist affirmation', e)
      }
      // Clear any temporary loading toast
      setToast('')
      setUndo({ type: 'deed', id: docRef.id })
      if (undoTimeout.current) clearTimeout(undoTimeout.current)
      undoTimeout.current = setTimeout(() => { setUndo(null); setToast('') }, 5000)
      setNoteText('')
    } catch (e) {
      setToast('We couldn’t save that this time. Please try again.')
      setTimeout(()=> setToast(''), 2200)
    } finally {
      setReading(false)
    }
  }

  const addResultToList = async (r: SantaGiftResult) => {
    if (!user || !childId) return
    try {
      const ref = collection(db, 'users', user.uid, 'children', childId, 'wishlist')
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
      setTimeout(()=> setToast(''), 2200)
    }
  }

  const undoAdd = async () => {
    if (!user || !childId || !undo) return
    try {
      if (undo.type === 'wishlist') {
        await deleteDoc(doc(db, 'users', user.uid, 'children', childId, 'wishlist', undo.id))
      } else {
        await deleteDoc(doc(db, 'users', user.uid, 'children', childId, 'deeds', undo.id))
      }
      setToast('Removed.')
      setTimeout(()=> setToast(''), 1200)
    } catch (e) {
      setToast('Could not remove item.')
      setTimeout(()=> setToast(''), 1800)
    } finally {
      setUndo(null)
      if (undoTimeout.current) { clearTimeout(undoTimeout.current); undoTimeout.current = null }
    }
  }
  

  return (
    <div className="santa-bg">
      {!user ? (
        <section className="santa-page">
          <section className="card">
            <h2>Santa View</h2>
           <p>To protect your family&#39;s privacy, please <a className="link" href="/login">sign in</a> first.</p>
          </section>
        </section>
      ) : (
      <section className="santa-page">
      <h2>Santa View ✨</h2>
      <label>
        Choose child:
        <select value={childId} onChange={e=>setChildId(e.target.value)}>
          {children.map(c=> <option key={c.id} value={c.id}>{c.name ?? c.id}</option>)}
        </select>
      </label>

  <div className="card" aria-labelledby="santa-note-heading">
        <h3 id="santa-note-heading">Santa Note</h3>
        {/* Chat-style pinned reply at top */}
        <SantaChatCard
          lastAffirmation={lastAffirmation}
          lastAffirmationAt={lastAffirmationAt}
          history={history}
          mode={mode}
          onModeChange={setMode}
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
          canSubmit={!!childId}
        />
        {/* Input, mode pills, loaders, toast, and gift results are rendered inside SantaChatCard */}
      </div>

      <h3>My Wish List</h3>
      <div className="grid3">
        {wishlist.map(w=> <WishItemCard key={w.id} item={w} />)}
      </div>
      </section>
      )}
    </div>
  )
}
